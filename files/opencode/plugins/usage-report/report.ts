import { existsSync, readFileSync } from "node:fs"
import { localDay, parseLocal, weekOf } from "./dates"
import { commits, prBodies, shellClass, shellCommand, type ShellClass } from "./shell"
import { ERROR_CLASSES, EXECUTE_TOOL, FILE_TOOLS, SHELL_TOOLS, emptyJson, len, splitLines, sum, type Call, type ErrorClass, type Tool, type Usage } from "./usage"

export interface Change {
  when: number
  day: string
  label: string
  major: boolean
}

export type Windows = [label: string, start: number][]
export type Format = "md" | "csv" | "json"

const SUBAGENT_TOOLS = ["task", "subagent"]
const MIN_LISTED_TOOL_CALLS = 50
const MIN_WEEKLY_SHELL_CALLS = 20
const MIN_MODEL_CALLS = 100
const TOP_MODELS_PER_WINDOW = 3
const TOP_ERROR_TOOLS = 15
const BIG_OUTPUT_TOKENS = 2000
const WHOLE_READ_CHARS = 40 * 1024
const COMMIT_PREVIEW_CHARS = 160
const LONGEST_COMMITS_SHOWN = 4

const TOKEN_FIELDS = ["tokens_input", "tokens_cache_read", "tokens_cache_write", "tokens_output", "tokens_reasoning"] as const

const NUMERIC_COLUMNS = [
  "root_sessions",
  "subagent_sessions",
  "user_turns",
  "assistant_calls",
  "tool_calls",
  "shell_calls",
  "execute_calls",
  ...TOKEN_FIELDS,
  "cost_list",
  "cost_reported",
  "unpriced_calls",
  "unpriced_tokens",
  ...ERROR_CLASSES.map((k) => `shell_${k}` as const),
  ...ERROR_CLASSES.map((k) => `total_${k}` as const),
  "aborted_messages",
  "compactions",
  "root_busy_ms",
  "lines_added",
  "lines_deleted",
] as const

export type NumericColumn = (typeof NUMERIC_COLUMNS)[number]
export type ExportRow = { day: string; agent: string; model: string; tool_calls_per_user_turn: number | "" } & Record<NumericColumn, number>

const EXPORT_COLUMNS: (keyof ExportRow)[] = [
  "day",
  "agent",
  "model",
  "root_sessions",
  "subagent_sessions",
  "user_turns",
  "assistant_calls",
  "tool_calls",
  "tool_calls_per_user_turn",
  "shell_calls",
  "execute_calls",
  ...NUMERIC_COLUMNS.slice(NUMERIC_COLUMNS.indexOf("tokens_input")),
]

type Cell = string | number
type Table = { title: string; header: string[]; rows: Cell[][]; footer?: string[] }
type Commit = { msg: string; parts: number; t: number }
interface Context {
  usage: Usage
  windows: string[]
  inWindow: (w: string) => Call[]
  rootsIn: Map<string, string[]>
  subsIn: Map<string, string[]>
  perSession: Map<string, Call[]>
  toolNames: Map<string, number>
  commitsIn: (w: string) => Commit[]
}

export function readChanges(path: string): Change[] {
  if (!existsSync(path)) return []
  const entries: unknown = JSON.parse(readFileSync(path, "utf8"))
  if (!Array.isArray(entries)) throw new Error(`${path}: expected a JSON array of changes`)
  return entries.map((e: Record<string, unknown> | null, i) => {
    const bad = (why: string) => new Error(`${path}: entry ${i} ${JSON.stringify(e)}: ${why}`)
    if (typeof e !== "object" || e === null) throw bad("not an object")
    if (typeof e.date !== "string" || Number.isNaN(parseLocal(e.date))) throw bad("date must be a parseable date string")
    if (typeof e.label !== "string" || !e.label) throw bad("label must be a non-empty string")
    if (typeof e.major !== "boolean") throw bad("major must be a boolean")
    const when = parseLocal(e.date)
    return { when, day: localDay(when), label: e.label, major: e.major }
  })
}

export function loadWindows(changes: Change[]): Windows {
  const majors = changes.filter((c) => c.major).sort((a, b) => a.when - b.when || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0))
  if (!majors.length) return [["all history", 0]]
  return [[`W0 baseline (before ${majors[0].day})`, 0], ...majors.map((m, i): [string, number] => [`W${i + 1} ${m.day} ${m.label}`, m.when])]
}

export function windowOf(windows: Windows, t: number): string {
  return windows.filter(([, start]) => t >= start).at(-1)![0]
}

function percentile(xs: number[], p: number): number {
  const sorted = [...xs].sort((a, b) => a - b)
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0
}

const fixed = (x: number, digits: number) => x.toFixed(digits)
const round = (x: number, digits: number) => Number(x.toFixed(digits))

function mean(xs: number[]): string {
  if (!xs.length) return "0"
  const total = sum(xs)
  return total % xs.length === 0 ? String(total / xs.length) : fixed(total / xs.length, 1)
}

const rate = (n: number, d: number) => (d ? `${fixed((100 * n) / d, 0)}%` : "-")
const count = <T>(xs: T[], pred: (x: T) => boolean) => xs.filter(pred).length
const words = (s: string) => s.split(/\s+/).filter(Boolean)
const paragraphs = (s: string) => s.split(/\n\s*\n/).filter((p) => p.trim()).length
const messageLines = (k: { msg: string }) => splitLines(k.msg).filter((l) => l.trim()).length
const hasBody = (k: { msg: string; parts: number }) => messageLines(k) > 1 || k.parts > 1
const toolsOf = (cs: Call[]) => cs.flatMap((c) => c.tools)
const shellOf = (cs: Call[]) => toolsOf(cs).filter((t) => SHELL_TOOLS.includes(t.name))

function shellCounts(shell: Tool[]): (k: ShellClass) => number {
  const cnt = new Map<ShellClass, number>()
  for (const t of shell) for (const k of shellClass(shellCommand(t))) cnt.set(k, (cnt.get(k) ?? 0) + 1)
  return (k) => cnt.get(k) ?? 0
}

function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const x of xs) {
    const k = key(x)
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(x)
  }
  return m
}

function countBy<T>(xs: T[], key: (x: T) => string): [string, number][] {
  const m = new Map<string, number>()
  for (const x of xs) m.set(key(x), (m.get(key(x)) ?? 0) + 1)
  return [...m].sort((a, b) => b[1] - a[1])
}

export function exportRows({ sessions, calls, compactions, userTurns }: Usage): ExportRow[] {
  const rows = new Map<string, { day: string; agent: string; model: string; n: Record<string, number> }>()
  const row = (t: number, agent: string, model: string) => {
    const day = localDay(t)
    const key = [day, agent, model].join("\u0000")
    if (!rows.has(key)) rows.set(key, { day, agent, model, n: {} })
    const n = rows.get(key)!.n
    return (col: string, by = 1) => void (n[col] = (n[col] ?? 0) + by)
  }

  for (const s of sessions.values()) {
    const add = row(s.created, s.agent, s.model)
    if (s.parent === null) {
      add("root_sessions")
      add("root_busy_ms", s.busy)
    } else add("subagent_sessions")
  }
  for (const [sid, t] of userTurns) row(t, sessions.get(sid)!.agent, sessions.get(sid)!.model)("user_turns")
  for (const [sid, t] of compactions) row(t, sessions.get(sid)!.agent, sessions.get(sid)!.model)("compactions")
  for (const c of calls) {
    const add = row(c.t, c.agent, c.model)
    add("assistant_calls")
    add("aborted_messages", Number(c.aborted))
    add("cost_list", c.costList)
    add("cost_reported", c.costReported)
    if (c.unpriced) {
      add("unpriced_calls")
      add("unpriced_tokens", c.fresh + c.cacheRead + c.cacheWrite + c.output + c.reasoning)
    }
    add("tokens_input", c.fresh)
    add("tokens_cache_read", c.cacheRead)
    add("tokens_cache_write", c.cacheWrite)
    add("tokens_output", c.output)
    add("tokens_reasoning", c.reasoning)
    for (const t of c.tools) {
      add("tool_calls")
      if (SHELL_TOOLS.includes(t.name)) add("shell_calls")
      if (t.name === EXECUTE_TOOL) add("execute_calls")
      add("lines_added", t.added)
      add("lines_deleted", t.deleted)
      if (t.cls) {
        add(`total_${t.cls}`)
        if (SHELL_TOOLS.includes(t.name)) add(`shell_${t.cls}`)
      }
    }
  }

  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
  return [...rows.values()]
    .sort((a, b) => cmp(a.day, b.day) || cmp(a.agent, b.agent) || cmp(a.model, b.model))
    .map(({ day, agent, model, n }) => {
      const out = { day, agent, model } as ExportRow
      for (const k of NUMERIC_COLUMNS) out[k] = n[k] ?? 0
      out.cost_list = round(out.cost_list, 6)
      out.cost_reported = round(out.cost_reported, 6)
      out.tool_calls_per_user_turn = out.user_turns ? round(out.tool_calls / out.user_turns, 2) : ""
      return out
    })
}

export function toJson(rows: ExportRow[]): string {
  return JSON.stringify(rows.map((r) => Object.fromEntries(EXPORT_COLUMNS.map((k) => [k, r[k]]))), null, 1) + "\n"
}

export function toCsv(rows: ExportRow[]): string {
  const cell = (v: string | number) => (/[",\r\n]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : String(v))
  return [EXPORT_COLUMNS.join(","), ...rows.map((r) => EXPORT_COLUMNS.map((k) => cell(r[k])).join(","))].join("\n") + "\n"
}

function buildContext(usage: Usage, windows: Windows): Context {
  const { sessions, calls } = usage
  const labels = windows.map(([l]) => l)
  const byWindow = groupBy(calls, (c) => windowOf(windows, c.t))
  const rootsIn = new Map<string, string[]>(labels.map((l) => [l, []]))
  const subsIn = new Map<string, string[]>(labels.map((l) => [l, []]))
  for (const [sid, s] of sessions) (s.parent ? subsIn : rootsIn).get(windowOf(windows, s.created))!.push(sid)
  const inWindow = (w: string) => byWindow.get(w) ?? []
  const commitsIn = (w: string): Commit[] => inWindow(w).flatMap((c) => shellOf([c]).flatMap((t) => commits(shellCommand(t)).map((k) => ({ ...k, t: c.t }))))
  return {
    usage,
    windows: labels.filter((l) => inWindow(l).length || rootsIn.get(l)!.length || subsIn.get(l)!.length),
    inWindow,
    rootsIn,
    subsIn,
    perSession: groupBy(calls.filter((c) => c.hasTokens), (c) => c.sid),
    toolNames: new Map(countBy(toolsOf(calls), (t) => t.name)),
    commitsIn,
  }
}

const scopeTable = ({ windows, inWindow, rootsIn, subsIn }: Context): Table => ({
  title: "0 Scope (sessions attributed by creation time, calls by call time)",
  header: ["window", "root sessions", "subagent sessions", "calls", "calls without tokens", "aborted messages", "model mix (calls)"],
  rows: windows.filter((w) => inWindow(w).length).map((w) => [
    w,
    rootsIn.get(w)!.length,
    subsIn.get(w)!.length,
    inWindow(w).length,
    count(inWindow(w), (c) => !c.hasTokens),
    count(inWindow(w), (c) => c.aborted),
    countBy(inWindow(w), (c) => c.model)
      .slice(0, TOP_MODELS_PER_WINDOW)
      .map(([m, n]) => `${m} ${Math.floor((100 * n) / inWindow(w).length)}%`)
      .join(", "),
  ]),
})

const costTable = ({ windows, inWindow, rootsIn }: Context): Table => ({
  title: "0b Cost, tokens and edited lines (calls in window / root sessions created in window; lines include subagent edits; cost_list = tokens x list price)",
  header: ["window", "root sessions", "cost_list USD", "cost_list per root session", "cost_reported USD", "reported/list", "unpriced calls", "fresh input", "cache read", "cache write", "output", "reasoning", "cache-hit ratio", "lines added per root", "lines deleted per root"],
  rows: windows.map((w) => {
    const cs = inWindow(w)
    const roots = rootsIn.get(w)!.length
    const fresh = sum(cs.map((c) => c.fresh))
    const cr = sum(cs.map((c) => c.cacheRead))
    const cw = sum(cs.map((c) => c.cacheWrite))
    const cost = sum(cs.map((c) => c.costList))
    const rep = sum(cs.map((c) => c.costReported))
    const perRoot = (f: (t: Tool) => number) => (roots ? round(sum(toolsOf(cs).map(f)) / roots, 0) : "-")
    return [
      w,
      roots,
      fixed(cost, 2),
      roots ? fixed(cost / roots, 2) : "-",
      fixed(rep, 2),
      cost ? fixed(rep / cost, 2) : "-",
      count(cs, (c) => c.unpriced),
      fresh,
      cr,
      cw,
      sum(cs.map((c) => c.output)),
      sum(cs.map((c) => c.reasoning)),
      rate(cr, fresh + cr + cw),
      perRoot((t) => t.added),
      perRoot((t) => t.deleted),
    ]
  }),
})

const toolCallsTable = ({ windows, inWindow, toolNames }: Context): Table => {
  const shown = [...toolNames].filter(([n, k]) => k >= MIN_LISTED_TOOL_CALLS || [...SHELL_TOOLS, ...SUBAGENT_TOOLS].includes(n)).map(([n]) => n)
  return {
    title: "0c Tool calls per raw tool name",
    header: ["tool", "total", ...windows.map((w) => w.split(/\s+/)[0])],
    rows: shown.map((n) => [n, toolNames.get(n)!, ...windows.map((w) => count(toolsOf(inWindow(w)), (t) => t.name === n))]),
  }
}

const shellMisuseTable = ({ windows, inWindow }: Context): Table => ({
  title: "1 Shell misuse (share of shell calls; commands can match more than one)",
  header: ["window", "shell calls", "edit via shell", "python-script writes", "scratch redirect", "read via shell", "search via shell", "pipe filters", "cd prefix", "shell share of tools", "execute share of tools"],
  rows: windows.map((w) => {
    const shell = shellOf(inWindow(w))
    const n = shell.length
    const cnt = shellCounts(shell)
    const all = toolsOf(inWindow(w))
    return [w, n, rate(cnt("edit_via_shell"), n), rate(cnt("python_write"), n), rate(cnt("scratch_redirect"), n), rate(cnt("read_via_shell"), n), rate(cnt("search_via_shell"), n), rate(cnt("pipe_filter"), n), rate(cnt("cd_prefix"), n), rate(n, all.length), rate(count(all, (t) => t.name === EXECUTE_TOOL), all.length)]
  }),
})

const shellMisuseWeeklyTable = ({ usage }: Context): Table => {
  const weekly = groupBy(usage.calls, (c) => weekOf(c.t))
  return {
    title: `1b Shell misuse by week (weeks with >=${MIN_WEEKLY_SHELL_CALLS} shell calls)`,
    header: ["week", "shell calls", "edit", "read", "search", "pipe filter", "cd"],
    rows: [...weekly.keys()]
      .sort()
      .map((wk) => {
        const shell = shellOf(weekly.get(wk)!)
        const n = shell.length
        const cnt = shellCounts(shell)
        return [wk, n, rate(cnt("edit_via_shell"), n), rate(cnt("read_via_shell"), n), rate(cnt("search_via_shell"), n), rate(cnt("pipe_filter"), n), rate(cnt("cd_prefix"), n)]
      })
      .filter((r) => (r[1] as number) >= MIN_WEEKLY_SHELL_CALLS),
  }
}

const fileChangesTable = ({ windows, inWindow }: Context): Table => ({
  title: "1c File changes: edit/write tool vs shell",
  header: ["window", "edit+write calls", "shell edits", "shell share of file changes", "shell-edit cmd chars p50", "p90"],
  rows: windows.map((w) => {
    const edits = count(toolsOf(inWindow(w)), (t) => FILE_TOOLS.includes(t.name))
    const shellEdits = shellOf(inWindow(w)).filter((t) => shellClass(shellCommand(t)).has("edit_via_shell"))
    const chars = shellEdits.map((t) => len(shellCommand(t)))
    return [w, edits, shellEdits.length, rate(shellEdits.length, edits + shellEdits.length), percentile(chars, 0.5), percentile(chars, 0.9)]
  }),
})

const shellOutcomesTable = ({ windows, inWindow }: Context): Table => ({
  title: "1d Shell call outcomes (share of shell calls)",
  header: ["window", "shell calls", ...ERROR_CLASSES],
  rows: windows.map((w) => {
    const shell = shellOf(inWindow(w))
    return [w, shell.length, ...ERROR_CLASSES.map((k) => rate(count(shell, (t) => t.cls === k), shell.length))]
  }),
})

const errorsPerToolTable = ({ usage, toolNames }: Context): Table => {
  const perTool = new Map<string, Map<ErrorClass, number>>()
  for (const t of toolsOf(usage.calls)) {
    if (!t.cls) continue
    if (!perTool.has(t.name)) perTool.set(t.name, new Map())
    perTool.get(t.name)!.set(t.cls, (perTool.get(t.name)!.get(t.cls) ?? 0) + 1)
  }
  const errorTotal = (n: string) => sum([...perTool.get(n)!.values()])
  return {
    title: `1e Error classes per raw tool name (all windows, top ${TOP_ERROR_TOOLS} by errors)`,
    header: ["tool", "calls", ...ERROR_CLASSES],
    rows: [...perTool.keys()]
      .sort((a, b) => errorTotal(b) - errorTotal(a))
      .slice(0, TOP_ERROR_TOOLS)
      .map((n) => [n, toolNames.get(n)!, ...ERROR_CLASSES.map((k) => perTool.get(n)!.get(k) ?? 0)]),
  }
}

const commitsTable = ({ windows, inWindow, commitsIn }: Context): Table => ({
  title: "2 Commit messages and PR bodies",
  header: ["window", "commits", "has body", ">1 paragraph", "lines mean", "lines p90", "words mean", "words p90", "words max", "co-author trailer", "PR bodies", "PR chars p50"],
  rows: windows.map((w) => {
    const cm = commitsIn(w)
    const lines = cm.map(messageLines)
    const wordCounts = cm.map((k) => words(k.msg).length)
    const prs = shellOf(inWindow(w)).flatMap((t) => prBodies(shellCommand(t)))
    return [w, cm.length, rate(count(cm, hasBody), cm.length), rate(count(cm, (k) => paragraphs(k.msg) > 1), cm.length), mean(lines), percentile(lines, 0.9), mean(wordCounts), percentile(wordCounts, 0.9), wordCounts.length ? Math.max(...wordCounts) : 0, rate(count(cm, (k) => k.msg.includes("Co-authored")), cm.length), prs.length, percentile(prs, 0.5)]
  }),
})

const commitsWeeklyTable = ({ windows, commitsIn }: Context): Table => {
  const allCommits = windows.flatMap(commitsIn)
  const weeks = groupBy(allCommits, (k) => weekOf(k.t))
  return {
    title: "2b Commit messages by week",
    header: ["week", "commits", "has body", "lines mean", "words mean"],
    rows: [...weeks.keys()].sort().map((wk) => {
      const cm = weeks.get(wk)!
      return [wk, cm.length, rate(count(cm, hasBody), cm.length), mean(cm.map(messageLines)), mean(cm.map((k) => words(k.msg).length))]
    }),
    footer: [
      `\nLongest commit messages (first ${COMMIT_PREVIEW_CHARS} chars):`,
      ...[...allCommits]
        .sort((a, b) => b.msg.length - a.msg.length)
        .slice(0, LONGEST_COMMITS_SHOWN)
        .map((k) => `- ${localDay(k.t)} ${words(k.msg).length} words: ${JSON.stringify([...k.msg].slice(0, COMMIT_PREVIEW_CHARS).join(""))}`),
    ],
  }
}

const withTokens = ({ inWindow }: Context, w: string) => inWindow(w).filter((c) => c.hasTokens)

const outputTokensTable = (ctx: Context): Table => ({
  title: "3 Output tokens per call (reasoning excluded)",
  header: ["window", "p50", "p90", "p99", "with-tools p50", "text-only p50", "text-only p90", `calls >${BIG_OUTPUT_TOKENS / 1000}k out`, `share of output tokens in >${BIG_OUTPUT_TOKENS / 1000}k calls`],
  rows: ctx.windows.filter((w) => withTokens(ctx, w).length).map((w) => {
    const cs = withTokens(ctx, w)
    const o = cs.map((c) => c.output)
    const big = o.filter((n) => n > BIG_OUTPUT_TOKENS)
    const textOnly = cs.filter((c) => !c.tools.length).map((c) => c.output)
    return [w, percentile(o, 0.5), percentile(o, 0.9), percentile(o, 0.99), percentile(cs.filter((c) => c.tools.length).map((c) => c.output), 0.5), percentile(textOnly, 0.5), percentile(textOnly, 0.9), `${fixed((100 * big.length) / cs.length, 1)}%`, `${fixed((100 * sum(big)) / (sum(o) || 1), 0)}%`]
  }),
})

const finalRepliesTable = ({ windows, inWindow }: Context): Table => ({
  title: "3b Final replies (main sessions, text-only calls)",
  header: ["window", "n", "chars p50", "chars p90", "paragraphs p50", "paragraphs p90", "bullets mean", "with headers", "with tables"],
  rows: windows.map((w) => {
    const fin = inWindow(w).filter((c) => !c.tools.length && !c.sub && c.text.trim())
    const chars = fin.map((c) => len(c.text))
    const paras = fin.map((c) => paragraphs(c.text))
    const bullets = fin.map((c) => (c.text.match(/^\s*[-*] /gm) ?? []).length)
    return [w, fin.length, percentile(chars, 0.5), percentile(chars, 0.9), percentile(paras, 0.5), percentile(paras, 0.9), mean(bullets), rate(count(fin, (c) => /^#{1,4} /m.test(c.text)), fin.length), rate(count(fin, (c) => /^\|.*\|/m.test(c.text)), fin.length)]
  }),
})

const narrationTable = ({ windows, inWindow }: Context): Table => ({
  title: "3c Narration before tool calls and edit/write payload size (chars)",
  header: ["window", "tool calls with narration", "narration p50", "p90", "edit/write n", "payload p50", "payload p90"],
  rows: windows.map((w) => {
    const cs = inWindow(w)
    const narration = cs.filter((c) => c.tools.length && c.text.trim()).map((c) => len(c.text))
    const payload = toolsOf(cs).filter((t) => t.name === "edit" || t.name === "write").map((t) => len(String(t.input.newString || t.input.content || "")))
    return [w, rate(narration.length, count(cs, (c) => c.tools.length > 0)), percentile(narration, 0.5), percentile(narration, 0.9), payload.length, percentile(payload, 0.5), percentile(payload, 0.9)]
  }),
})

const modelOutputTable = (ctx: Context): Table => ({
  title: "3d Output size by model within window",
  header: ["window", "model", "calls", "out p50", "out p90", "reasoning mean"],
  rows: ctx.windows.flatMap((w) =>
    countBy(withTokens(ctx, w), (c) => c.model)
      .slice(0, TOP_MODELS_PER_WINDOW)
      .filter(([, n]) => n >= MIN_MODEL_CALLS)
      .map(([m, n]) => {
        const cs = withTokens(ctx, w).filter((c) => c.model === m)
        return [w, m, n, percentile(cs.map((c) => c.output), 0.5), percentile(cs.map((c) => c.output), 0.9), mean(cs.map((c) => c.reasoning))]
      }),
  ),
})

const contextTable = ({ windows, inWindow, rootsIn, perSession }: Context): Table => ({
  title: "4 Context (root sessions by creation window, with token data; prompts = turns with >=2 calls)",
  header: ["window", "sessions", "first-call ctx p50", "prompts", "calls/prompt p50", "growth/prompt p50", "growth/prompt mean", "ctx re-read Mtok/prompt", "reads ranged", "repeat reads", "webfetch n", "tool result chars p90", "p99"],
  rows: windows.map((w) => {
    const ms = rootsIn.get(w)!.map((s) => perSession.get(s) ?? []).filter((cs) => cs.length)
    const first = ms.map((cs) => cs[0].context)
    const prompts = ms.flatMap((cs) => [...groupBy(cs, (c) => String(c.turn)).values()].filter((v) => v.length >= 2))
    const growth = prompts.map((v) => v.at(-1)!.context - v[0].context)
    let reads = 0
    let ranged = 0
    let repeated = 0
    for (const cs of ms) {
      const seen = new Set<unknown>()
      for (const t of toolsOf(cs).filter((t) => t.name === "read")) {
        const p = t.input.filePath || t.input.path || undefined
        reads++
        if ("limit" in t.input || "offset" in t.input) ranged++
        if (seen.has(p)) repeated++
        seen.add(p)
      }
    }
    const tools = toolsOf(inWindow(w))
    const results = tools.filter((t) => t.name !== "edit" && t.name !== "write").map((t) => t.chars)
    return [
      w,
      ms.length,
      percentile(first, 0.5),
      prompts.length,
      percentile(prompts.map((v) => v.length), 0.5),
      percentile(growth, 0.5),
      growth.length ? round(sum(growth) / growth.length, 0) : 0,
      fixed(sum(prompts.map((v) => sum(v.map((c) => c.context)))) / Math.max(1, prompts.length) / 1e6, 2),
      rate(ranged, reads),
      rate(repeated, reads),
      count(tools, (t) => t.name === "webfetch"),
      percentile(results, 0.9),
      percentile(results, 0.99),
    ]
  }),
})

const routingTable = ({ usage, windows, inWindow, rootsIn, perSession }: Context): Table => ({
  title: "5 Routing and guardrails (root sessions by creation window; child = subagent sessions)",
  header: ["window", "root sessions", "orchestrator", "build", "subagent calls", "no model set", "model actually run (no model set)", "pipe-only policy rejections / all", "child permission-denied / child tool calls", `whole-file reads >${WHOLE_READ_CHARS / 1024}KB`],
  rows: windows.map((w) => {
    const roots = rootsIn.get(w)!
    const cs = inWindow(w)
    const sub = toolsOf(cs).filter((t) => SUBAGENT_TOOLS.includes(t.name))
    const unset = sub.filter((t) => emptyJson(t.input.model))
    const ran = countBy(unset, (t) => {
      const sid = t.metadata.sessionId || t.metadata.sessionID || ""
      return t.metadata.model?.modelID || (perSession.get(sid)?.length ? perSession.get(sid)![0].model : "unknown")
    })
    const policy = shellOf(cs).filter((t) => t.cls === "policy_rejected").map((t) => t.message)
    const pipeOnly = count(policy, (m) => {
      const bullets = splitLines(m).filter((l) => l.startsWith("- `"))
      return bullets.length > 0 && bullets.every((l) => l.includes("pipe filters are rejected"))
    })
    const child = toolsOf(cs.filter((c) => c.sub))
    const wholeReads = count(toolsOf(cs), (t) => t.name === "read" && !("limit" in t.input) && !("offset" in t.input) && t.chars > WHOLE_READ_CHARS)
    const root = (agent: string) => count(roots, (s) => usage.sessions.get(s)!.agent === agent)
    return [w, roots.length, rate(root("orchestrator"), roots.length), rate(root("build"), roots.length), sub.length, unset.length, ran.slice(0, TOP_MODELS_PER_WINDOW).map(([m, n]) => `${m} ${n}`).join(", ") || "-", `${pipeOnly}/${policy.length}`, `${count(child, (t) => t.cls === "permission_denied")}/${child.length}`, wholeReads]
  }),
})

const TABLES: ((ctx: Context) => Table)[] = [
  scopeTable,
  costTable,
  toolCallsTable,
  shellMisuseTable,
  shellMisuseWeeklyTable,
  fileChangesTable,
  shellOutcomesTable,
  errorsPerToolTable,
  commitsTable,
  commitsWeeklyTable,
  outputTokensTable,
  finalRepliesTable,
  narrationTable,
  modelOutputTable,
  contextTable,
  routingTable,
]

function renderTable({ title, header, rows, footer = [] }: Table): string[] {
  return [`\n## ${title}`, `| ${header.join(" | ")} |`, `|${"---|".repeat(header.length)}`, ...rows.map((r) => `| ${r.join(" | ")} |`), ...footer]
}

export function markdownReport(usage: Usage, windows: Windows): string {
  const ctx = buildContext(usage, windows)
  return TABLES.flatMap((table) => renderTable(table(ctx))).join("\n") + "\n"
}

export function buildReport(format: Format, usage: Usage, windows: Windows): string {
  if (format === "md") return markdownReport(usage, windows)
  const rows = exportRows(usage)
  return format === "csv" ? toCsv(rows) : toJson(rows)
}

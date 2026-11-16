import { Database } from "bun:sqlite"
import { existsSync, readFileSync, realpathSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

type Json = Record<string, any>

export type ErrorClass = "permission_denied" | "policy_rejected" | "aborted" | "other_error" | "pending"
export type ShellClass =
  | "edit_via_shell"
  | "python_write"
  | "scratch_redirect"
  | "read_via_shell"
  | "search_via_shell"
  | "pipe_filter"
  | "cd_prefix"

export interface Tool {
  name: string
  input: Json
  chars: number
  cls: ErrorClass | null
  message: string
  metadata: Json
  added: number
  deleted: number
}

export interface Call {
  sid: string
  t: number
  agent: string
  model: string
  sub: boolean
  hasTokens: boolean
  fresh: number
  cacheRead: number
  cacheWrite: number
  output: number
  reasoning: number
  costReported: number
  costList: number
  unpriced: boolean
  aborted: boolean
  tools: Tool[]
  text: string
  turn: number
  context: number
}

export interface Session {
  parent: string | null
  agent: string
  model: string
  created: number
  busy: number
  turns: number
}

export interface Usage {
  sessions: Map<string, Session>
  calls: Call[]
  compactions: [string, number][]
  userTurns: [string, number][]
}

export interface PriceTier {
  size: number | null
  input?: number
  output?: number
  cache_read?: number
  cache_write?: number
}

export type Prices = Map<string, PriceTier[]>
export type Windows = [label: string, start: number][]
export type Format = "md" | "csv" | "json"

const TOKEN_FIELDS = ["tokens_input", "tokens_cache_read", "tokens_cache_write", "tokens_output", "tokens_reasoning"] as const
export const ERROR_CLASSES: readonly ErrorClass[] = ["permission_denied", "policy_rejected", "aborted", "other_error", "pending"]

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

const SHELL_TOOLS = ["bash", "shell"]
const SUBAGENT_TOOLS = ["task", "subagent"]
const EXECUTE_TOOL = "execute"
const FILE_TOOLS = ["edit", "write", "apply_patch"]
const PRICE_FIELDS = ["input", "output", "cache_read", "cache_write"] as const

const TMP_DIR = tmpdir()
const SCRATCH_REDIRECT_PREFIXES = ["/tmp", "/private/tmp", "/private/var", "/var/folders", TMP_DIR]
const SCRATCH_SESSION_ROOTS = [...new Set([TMP_DIR, realpathSync(TMP_DIR), "/tmp", "/private/tmp"])].map((d) => join(d, "opencode") + "/")

const RE_PERMISSION = /rejected permission|specified a rule which prevents|^Permission denied/i
const HEREDOC = /<<-?\s*['"]?(\w+)['"]?[^\n]*\n([\s\S]*?)\n[ \t]*\1\b/
const HEREDOC_ALL = new RegExp(HEREDOC.source, "g")
const START = String.raw`(?:^|&&|\|\||;|\n)\s*`
const RE_EDIT = [/\bsed\s+(-\w*i\w*|--in-place)/, /\bperl\s+-\w*i/, /awk\s+-i\s+inplace/, /\btee\b/, /\bgit\s+apply\b|\bpatch\s+-p/]
const RE_REDIR = /(?<![0-9&>=-])>{1,2}\s*(?![&=]|\/dev\/null)([^\s|;&]+)/g
const RE_CAT_HEREDOC = /\bcat\s*>>?\s*([^\s<]+)\s*<</
const RE_PYWRITE = /write_text|open\([^)]*,\s*['"][wa]b?['"]/
const RE_QUOTED = /'[^']*'|"(?:[^"\\]|\\.)*"/g
const RE_READ = new RegExp(`${START}(cat|head|tail|bat|less|more)\\b|${START}sed\\s+-n\\b`)
const RE_SEARCH = new RegExp(`${START}(grep|rg|ag|find|fd|ls|tree)\\b`)
const RE_FILTER = /\|\s*(head|tail|grep|rg|sed|awk|cat|ls|find)\b/
const RE_CD = /^\s*cd\s/

export function loadWindows(changesPath: string): Windows {
  if (!existsSync(changesPath)) return [["all history", 0]]
  const majors = (JSON.parse(readFileSync(changesPath, "utf8")) as Json[])
    .filter((e) => e.major)
    .map((e) => ({ date: e.date as string, label: e.label as string, when: parseLocal(e.date) }))
    .sort((a, b) => a.when - b.when || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0))
  if (!majors.length) return [["all history", 0]]
  return [
    [`W0 baseline (before ${majors[0].date.slice(0, 10)})`, 0],
    ...majors.map((m, i): [string, number] => [`W${i + 1} ${m.date.slice(0, 10)} ${m.label}`, m.when]),
  ]
}

// A date-only string is local midnight, unlike `new Date(string)`, which reads it as UTC.
export function parseLocal(date: string): number {
  return new Date(/^\d{4}-\d\d-\d\d$/.test(date) ? `${date}T00:00:00` : date).getTime()
}

export function windowOf(windows: Windows, t: number): string {
  return windows.filter(([, start]) => t >= start).at(-1)![0]
}

const pad = (n: number) => String(n).padStart(2, "0")
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function localDay(t: number): string {
  return isoDay(new Date(t))
}

export function weekOf(t: number): string {
  const d = new Date(t)
  return isoDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)))
}

function percentile(xs: number[], p: number): number {
  const sorted = [...xs].sort((a, b) => a - b)
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0
}

// Rounds the exact decimal value of the double, ties to even: the same numbers as the previous report.
function roundEven(x: number, digits: number): number {
  const rounded = x.toFixed(digits)
  const exact = x.toFixed(digits + 30)
  const tail = exact.slice(exact.length - 30)
  if (!/^50*$/.test(tail)) return Number(rounded)
  const truncated = exact.slice(0, exact.length - 30)
  const lastDigit = Number(truncated.replace(/\D/g, "").slice(-1))
  return Number(lastDigit % 2 === 0 ? truncated.replace(/\.$/, "") : rounded)
}

const fixed = (x: number, digits: number) => roundEven(x, digits).toFixed(digits)

function mean(xs: number[]): string {
  if (!xs.length) return "0"
  const total = sum(xs)
  return total % xs.length === 0 ? String(total / xs.length) : fixed(total / xs.length, 1)
}

const len = (s: string) => {
  let n = s.length
  for (let i = 0; i < s.length - 1; i++) {
    const c = s.charCodeAt(i)
    if (c >= 0xd800 && c < 0xdc00 && (s.charCodeAt(i + 1) & 0xfc00) === 0xdc00) n--
  }
  return n
}
const rate = (n: number, d: number) => (d ? `${fixed((100 * n) / d, 0)}%` : "-")
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const count = <T>(xs: T[], pred: (x: T) => boolean) => xs.filter(pred).length
const words = (s: string) => s.split(/\s+/).filter(Boolean)
const cmd = (t: Tool) => String(t.input.command ?? "")
const emptyJson = (v: unknown) => !v || (typeof v === "object" && Object.keys(v as object).length === 0)

function splitLines(s: string): string[] {
  if (!s) return []
  const lines = s.split(/\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/)
  if (lines.at(-1) === "") lines.pop()
  return lines
}

function pyRepr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'"
  const body = [...s]
    .map((ch) => {
      if (ch === "\\" || ch === quote) return "\\" + ch
      if (ch === "\n") return "\\n"
      if (ch === "\r") return "\\r"
      if (ch === "\t") return "\\t"
      const code = ch.codePointAt(0)!
      return code < 32 || code === 127 ? `\\x${code.toString(16).padStart(2, "0")}` : ch
    })
    .join("")
  return quote + body + quote
}

const stripHeredoc = (c: string) => c.replace(HEREDOC_ALL, (_, tag) => "<<" + tag)

function isScratch(path: string): boolean {
  return (SCRATCH_REDIRECT_PREFIXES.some((p) => path.startsWith(p)) || path.startsWith("$")) && !path.startsWith("$HOME") && !path.startsWith("$PWD")
}

export function shellClass(command: string): Set<ShellClass> {
  const c = stripHeredoc(command)
  const out = new Set<ShellClass>()
  if (RE_EDIT.some((r) => r.test(c))) out.add("edit_via_shell")
  if (RE_PYWRITE.test(command) && /\bpython3?\b/.test(c)) out.add("python_write")
  for (const m of c.replace(RE_QUOTED, "''").matchAll(RE_REDIR)) out.add(isScratch(m[1]) ? "scratch_redirect" : "edit_via_shell")
  const heredocTarget = RE_CAT_HEREDOC.exec(command)
  if (heredocTarget) out.add(isScratch(heredocTarget[1]) ? "scratch_redirect" : "edit_via_shell")
  if (RE_READ.test(c)) out.add("read_via_shell")
  if (RE_SEARCH.test(c)) out.add("search_via_shell")
  if (RE_FILTER.test(c)) out.add("pipe_filter")
  if (RE_CD.test(c)) out.add("cd_prefix")
  return out
}

export function commits(command: string): { msg: string; parts: number }[] {
  const res: { msg: string; parts: number }[] = []
  for (const m of command.matchAll(/\bgit\s+(?:-\S+\s+\S+\s+)*commit\b/g)) {
    const end = m.index + m[0].length
    const next = /\n\s*(?:git|gh)\s|&&\s*(?:git|gh)\s/.exec(command.slice(end))
    const tail = command.slice(m.index, end + (next ? next.index : command.length))
    if (tail.includes("--no-edit")) continue
    const heredoc = HEREDOC.exec(tail)
    let parts: string[] = []
    if (heredoc && /-F\s*-|\$\(cat\s*<</.test(tail)) parts = [heredoc[2]]
    else {
      for (const a of tail.matchAll(/(?:-m|--message)[ =]\s*("(?:[^"\\]|\\.)*"|'[^']*'|\S+)/g)) {
        parts.push(a[1][0] === '"' || a[1][0] === "'" ? a[1].slice(1, -1) : a[1])
      }
    }
    const msg = parts.map((p) => p.trim()).join("\n\n").trim()
    if (msg) res.push({ msg, parts: parts.length })
  }
  return res
}

export function prBodies(command: string): number[] {
  const res: number[] = []
  for (const m of command.matchAll(/\bgh\s+pr\s+(create|edit)\b/g)) {
    const tail = command.slice(m.index)
    const heredoc = HEREDOC.exec(tail)
    if (heredoc) res.push(len(heredoc[2]))
    else {
      const body = /--body\s+("(?:[^"\\]|\\.)*"|'[^']*')/.exec(tail)
      if (body) res.push(len(body[1]) - 2)
    }
  }
  return res
}

/** Class of a tool call that did not complete; classified from the error type, then its text. */
export function errorClass(state: Json): ErrorClass | null {
  if (state.status === "completed") return null
  if (state.status !== "error") return "pending"
  const err = state.error ?? {}
  const msg: string = err.message ?? ""
  if (msg.includes("rejected by policy")) return "policy_rejected"
  if (err.type === "permission.rejected" || RE_PERMISSION.test(msg)) return "permission_denied"
  if (err.type === "aborted" || msg.toLowerCase().includes("aborted")) return "aborted"
  return "other_error"
}

/** Added and deleted lines of a completed file change; `write` has no diff metadata, so its content length counts as added. */
export function churn(name: string, state: Json): [added: number, deleted: number] {
  if (state.status !== "completed") return [0, 0]
  if (name === "write") return [splitLines(state.input?.content ?? "").length, 0]
  const md = state.metadata ?? {}
  const files: Json[] = !emptyJson(md.filediff) ? [md.filediff] : (md.files ?? [])
  return [sum(files.map((f) => f.additions ?? 0)), sum(files.map((f) => f.deletions ?? 0))]
}

export function priceKey(provider: string, model: string): string {
  return `${provider}\u0000${model}`
}

/** Per-Mtok prices by provider and model; the first entry is the base price, the rest are context tiers. */
export function listPrices(models: Json): Prices {
  const prices: Prices = new Map()
  for (const [provider, p] of Object.entries<Json>(models)) {
    for (const [model, m] of Object.entries<Json>(p.models)) {
      const cost = m.cost
      if (!cost) continue
      const tiers: PriceTier[] = (cost.tiers ?? []).filter((t: Json) => t.tier.type === "context").map((t: Json) => ({ ...t, size: t.tier.size }))
      const base: PriceTier = { size: null }
      for (const k of PRICE_FIELDS) if (k in cost) base[k] = cost[k]
      prices.set(priceKey(provider, model), [base, ...tiers])
    }
  }
  return prices
}

/** Cost at list price, or null when no price covers a used token class. Mirrors OpenCode's tier choice: the context tier with the largest size below input+cache tokens wins. */
export function listCost(prices: Prices, provider: string, model: string, tokens: { fresh: number; cacheRead: number; cacheWrite: number; output: number; reasoning: number }): number | null {
  const options = prices.get(priceKey(provider, model))
  if (!options) return null
  const context = tokens.fresh + tokens.cacheRead + tokens.cacheWrite
  let tier = options[0]
  let best = -Infinity
  for (const t of options) {
    if (t.size !== null && context > t.size && t.size > best) {
      best = t.size
      tier = t
    }
  }
  const used = { input: tokens.fresh, output: tokens.output + tokens.reasoning, cache_read: tokens.cacheRead, cache_write: tokens.cacheWrite }
  const entries = Object.entries(used) as [(typeof PRICE_FIELDS)[number], number][]
  if (entries.some(([k, n]) => n && !(k in tier))) return null
  return sum(entries.map(([k, n]) => n * (tier[k] ?? 0))) / 1e6
}

/** Sessions and assistant calls outside scratch dirs. Only session_v2/session_message are read: they already hold the migrated V1 history. */
export function loadUsage(db: Database, prices: Prices, scratch: string[]): Usage {
  const sessions = new Map<string, Session>()
  const sessionRows = db.query("select id,parent_id,agent,model,time_created,time_busy,directory from session_v2").all() as Json[]
  for (const r of sessionRows) {
    if (typeof r.directory !== "string" || scratch.some((root) => r.directory.startsWith(root))) continue
    sessions.set(r.id, {
      parent: r.parent_id,
      agent: r.agent || "",
      model: r.model ? (JSON.parse(r.model) ?? {}).id ?? "" : "",
      created: r.time_created,
      busy: r.time_busy || 0,
      turns: 0,
    })
  }
  const calls: Call[] = []
  const compactions: [string, number][] = []
  const userTurns: [string, number][] = []
  for (const r of db.query("select session_id,type,time_created,data from session_message order by session_id,seq").iterate() as Iterable<Json>) {
    const s = sessions.get(r.session_id)
    if (!s) continue
    if (r.type === "user") {
      s.turns++
      userTurns.push([r.session_id, r.time_created])
      continue
    }
    if (r.type === "compaction") {
      compactions.push([r.session_id, r.time_created])
      continue
    }
    if (r.type !== "assistant") continue
    const d: Json = JSON.parse(r.data)
    const tk: Json | null = d.tokens ?? null
    const content: Json[] = d.content ?? []
    const tools: Tool[] = content
      .filter((c) => c.type === "tool")
      .map((c) => {
        const state: Json = c.state ?? {}
        const text = ((state.content ?? []) as Json[]).filter((x) => x.type === "text").map((x) => x.text ?? "").join("")
        const [added, deleted] = FILE_TOOLS.includes(c.name) ? churn(c.name, state) : [0, 0]
        return { name: c.name, input: state.input ?? {}, chars: len(text), cls: errorClass(state), message: state.error?.message ?? "", metadata: state.metadata ?? {}, added, deleted }
      })
    const model: Json = d.model ?? {}
    const fresh = tk?.input ?? 0
    const cacheRead = tk?.cache?.read ?? 0
    const cacheWrite = tk?.cache?.write ?? 0
    const output = tk?.output ?? 0
    const reasoning = tk?.reasoning ?? 0
    const listed = tk ? listCost(prices, model.providerID ?? "", model.id ?? "", { fresh, cacheRead, cacheWrite, output, reasoning }) : 0
    calls.push({
      sid: r.session_id,
      t: r.time_created,
      agent: d.agent ?? "",
      model: model.id ?? "",
      sub: s.parent !== null,
      hasTokens: tk !== null,
      fresh,
      cacheRead,
      cacheWrite,
      output,
      reasoning,
      costReported: d.cost || 0,
      costList: listed ?? 0,
      unpriced: listed === null,
      aborted: d.error != null,
      tools,
      text: content.filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n"),
      turn: s.turns,
      context: fresh + cacheWrite + cacheRead,
    })
  }
  return { sessions, calls, compactions, userTurns }
}

export function unpricedWarning(usage: Usage): string {
  const unpriced = new Map<string, number>()
  for (const c of usage.calls) if (c.unpriced) unpriced.set(c.model || "?", (unpriced.get(c.model || "?") ?? 0) + 1)
  if (!unpriced.size) return ""
  return `warning: ${sum([...unpriced.values()])} calls have no list price and are excluded from cost_list: ${JSON.stringify(Object.fromEntries(unpriced))}`
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
      out.cost_list = roundEven(out.cost_list, 6)
      out.cost_reported = roundEven(out.cost_reported, 6)
      out.tool_calls_per_user_turn = out.user_turns ? roundEven(out.tool_calls / out.user_turns, 2) : ""
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

function table(out: string[], title: string, header: string[], rows: (string | number)[][]) {
  out.push(`\n## ${title}`, `| ${header.join(" | ")} |`, `|${"---|".repeat(header.length)}`)
  for (const r of rows) out.push(`| ${r.join(" | ")} |`)
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

const paragraphs = (s: string) => s.split(/\n\s*\n/).filter((p) => p.trim()).length
const messageLines = (k: { msg: string }) => splitLines(k.msg).filter((l) => l.trim()).length
const hasBody = (k: { msg: string; parts: number }) => messageLines(k) > 1 || k.parts > 1

export function markdownReport({ sessions, calls }: Usage, windows: Windows): string {
  const out: string[] = []
  const labels = windows.map(([l]) => l)
  const byWindow = groupBy(calls, (c) => windowOf(windows, c.t))
  const perSession = groupBy(
    calls.filter((c) => c.hasTokens),
    (c) => c.sid,
  )
  const rootsIn = new Map<string, string[]>()
  const subsIn = new Map<string, string[]>()
  for (const l of labels) {
    rootsIn.set(l, [])
    subsIn.set(l, [])
  }
  for (const [sid, s] of sessions) (s.parent ? subsIn : rootsIn).get(windowOf(windows, s.created))!.push(sid)
  const inWindow = (w: string) => byWindow.get(w) ?? []
  const W = labels.filter((l) => inWindow(l).length || rootsIn.get(l)!.length || subsIn.get(l)!.length)
  const toolsOf = (cs: Call[]) => cs.flatMap((c) => c.tools)
  const shellOf = (cs: Call[]) => toolsOf(cs).filter((t) => SHELL_TOOLS.includes(t.name))
  const shellCounts = (shell: Tool[]) => {
    const cnt = new Map<ShellClass, number>()
    for (const t of shell) for (const k of shellClass(cmd(t))) cnt.set(k, (cnt.get(k) ?? 0) + 1)
    return (k: ShellClass) => cnt.get(k) ?? 0
  }

  table(
    out,
    "0 Scope (sessions attributed by creation time, calls by call time)",
    ["window", "root sessions", "subagent sessions", "calls", "calls without tokens", "aborted messages", "model mix (calls)"],
    W.filter((w) => inWindow(w).length).map((w) => [
      w,
      rootsIn.get(w)!.length,
      subsIn.get(w)!.length,
      inWindow(w).length,
      count(inWindow(w), (c) => !c.hasTokens),
      count(inWindow(w), (c) => c.aborted),
      countBy(inWindow(w), (c) => c.model)
        .slice(0, 3)
        .map(([m, n]) => `${m} ${Math.floor((100 * n) / inWindow(w).length)}%`)
        .join(", "),
    ]),
  )

  table(
    out,
    "0b Cost, tokens and edited lines (calls in window / root sessions created in window; lines include subagent edits; cost_list = tokens x list price)",
    ["window", "root sessions", "cost_list USD", "cost_list per root session", "cost_reported USD", "reported/list", "unpriced calls", "fresh input", "cache read", "cache write", "output", "reasoning", "cache-hit ratio", "lines added per root", "lines deleted per root"],
    W.map((w) => {
      const cs = inWindow(w)
      const roots = rootsIn.get(w)!.length
      const fresh = sum(cs.map((c) => c.fresh))
      const cr = sum(cs.map((c) => c.cacheRead))
      const cw = sum(cs.map((c) => c.cacheWrite))
      const cost = sum(cs.map((c) => c.costList))
      const rep = sum(cs.map((c) => c.costReported))
      const perRoot = (f: (t: Tool) => number) => (roots ? roundEven(sum(toolsOf(cs).map(f)) / roots, 0) : "-")
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
  )

  const names = new Map(countBy(calls.flatMap((c) => c.tools), (t) => t.name))
  const shown = [...names].filter(([n, k]) => k >= 50 || [...SHELL_TOOLS, ...SUBAGENT_TOOLS].includes(n)).map(([n]) => n)
  table(
    out,
    "0c Tool calls per raw tool name",
    ["tool", "total", ...W.map((w) => w.split(/\s+/)[0])],
    shown.map((n) => [n, names.get(n)!, ...W.map((w) => count(toolsOf(inWindow(w)), (t) => t.name === n))]),
  )

  table(
    out,
    "1 Shell misuse (share of shell calls; commands can match more than one)",
    ["window", "shell calls", "edit via shell", "python-script writes", "scratch redirect", "read via shell", "search via shell", "pipe filters", "cd prefix", "shell share of tools", "execute share of tools"],
    W.map((w) => {
      const shell = shellOf(inWindow(w))
      const n = shell.length
      const cnt = shellCounts(shell)
      const all = toolsOf(inWindow(w))
      return [w, n, rate(cnt("edit_via_shell"), n), rate(cnt("python_write"), n), rate(cnt("scratch_redirect"), n), rate(cnt("read_via_shell"), n), rate(cnt("search_via_shell"), n), rate(cnt("pipe_filter"), n), rate(cnt("cd_prefix"), n), rate(n, all.length), rate(count(all, (t) => t.name === EXECUTE_TOOL), all.length)]
    }),
  )

  const weekly = groupBy(calls, (c) => weekOf(c.t))
  table(
    out,
    "1b Shell misuse by week (weeks with >=20 shell calls)",
    ["week", "shell calls", "edit", "read", "search", "pipe filter", "cd"],
    [...weekly.keys()]
      .sort()
      .map((wk) => {
        const shell = shellOf(weekly.get(wk)!)
        const n = shell.length
        const cnt = shellCounts(shell)
        return [wk, n, rate(cnt("edit_via_shell"), n), rate(cnt("read_via_shell"), n), rate(cnt("search_via_shell"), n), rate(cnt("pipe_filter"), n), rate(cnt("cd_prefix"), n)]
      })
      .filter((r) => (r[1] as number) >= 20),
  )

  table(
    out,
    "1c File changes: edit/write tool vs shell",
    ["window", "edit+write calls", "shell edits", "shell share of file changes", "shell-edit cmd chars p50", "p90"],
    W.map((w) => {
      const edits = count(toolsOf(inWindow(w)), (t) => FILE_TOOLS.includes(t.name))
      const shellEdits = shellOf(inWindow(w)).filter((t) => shellClass(cmd(t)).has("edit_via_shell"))
      const chars = shellEdits.map((t) => len(cmd(t)))
      return [w, edits, shellEdits.length, rate(shellEdits.length, edits + shellEdits.length), percentile(chars, 0.5), percentile(chars, 0.9)]
    }),
  )

  table(
    out,
    "1d Shell call outcomes (share of shell calls)",
    ["window", "shell calls", ...ERROR_CLASSES],
    W.map((w) => {
      const shell = shellOf(inWindow(w))
      return [w, shell.length, ...ERROR_CLASSES.map((k) => rate(count(shell, (t) => t.cls === k), shell.length))]
    }),
  )

  const perTool = new Map<string, Map<ErrorClass, number>>()
  for (const t of toolsOf(calls)) {
    if (!t.cls) continue
    if (!perTool.has(t.name)) perTool.set(t.name, new Map())
    perTool.get(t.name)!.set(t.cls, (perTool.get(t.name)!.get(t.cls) ?? 0) + 1)
  }
  const errorTotal = (n: string) => sum([...perTool.get(n)!.values()])
  table(
    out,
    "1e Error classes per raw tool name (all windows, top 15 by errors)",
    ["tool", "calls", ...ERROR_CLASSES],
    [...perTool.keys()]
      .sort((a, b) => errorTotal(b) - errorTotal(a))
      .slice(0, 15)
      .map((n) => [n, names.get(n)!, ...ERROR_CLASSES.map((k) => perTool.get(n)!.get(k) ?? 0)]),
  )

  type Commit = { msg: string; parts: number; t: number }
  const allCommits: Commit[] = []
  const commitRows: (string | number)[][] = []
  for (const w of W) {
    const cm: Commit[] = inWindow(w).flatMap((c) => shellOf([c]).flatMap((t) => commits(cmd(t)).map((k) => ({ ...k, t: c.t }))))
    allCommits.push(...cm)
    const lines = cm.map(messageLines)
    const wordCounts = cm.map((k) => words(k.msg).length)
    const withBody = count(cm, hasBody)
    const prs = shellOf(inWindow(w)).flatMap((t) => prBodies(cmd(t)))
    commitRows.push([w, cm.length, rate(withBody, cm.length), rate(count(cm, (k) => paragraphs(k.msg) > 1), cm.length), mean(lines), percentile(lines, 0.9), mean(wordCounts), percentile(wordCounts, 0.9), wordCounts.length ? Math.max(...wordCounts) : 0, rate(count(cm, (k) => k.msg.includes("Co-authored")), cm.length), prs.length, percentile(prs, 0.5)])
  }
  table(out, "2 Commit messages and PR bodies", ["window", "commits", "has body", ">1 paragraph", "lines mean", "lines p90", "words mean", "words p90", "words max", "co-author trailer", "PR bodies", "PR chars p50"], commitRows)

  const commitWeeks = groupBy(allCommits, (k) => weekOf(k.t))
  table(
    out,
    "2b Commit messages by week",
    ["week", "commits", "has body", "lines mean", "words mean"],
    [...commitWeeks.keys()].sort().map((wk) => {
      const cm = commitWeeks.get(wk)!
      return [wk, cm.length, rate(count(cm, hasBody), cm.length), mean(cm.map(messageLines)), mean(cm.map((k) => words(k.msg).length))]
    }),
  )
  out.push("\nLongest commit messages (first 160 chars):")
  for (const k of [...allCommits].sort((a, b) => b.msg.length - a.msg.length).slice(0, 4)) {
    out.push(`- ${localDay(k.t)} ${words(k.msg).length} words: ${pyRepr([...k.msg].slice(0, 160).join(""))}`)
  }

  const withTokens = (w: string) => inWindow(w).filter((c) => c.hasTokens)
  table(
    out,
    "3 Output tokens per call (reasoning excluded)",
    ["window", "p50", "p90", "p99", "with-tools p50", "text-only p50", "text-only p90", "calls >2k out", "share of output tokens in >2k calls"],
    W.filter((w) => withTokens(w).length).map((w) => {
      const cs = withTokens(w)
      const o = cs.map((c) => c.output)
      const big = o.filter((n) => n > 2000)
      const textOnly = cs.filter((c) => !c.tools.length).map((c) => c.output)
      return [w, percentile(o, 0.5), percentile(o, 0.9), percentile(o, 0.99), percentile(cs.filter((c) => c.tools.length).map((c) => c.output), 0.5), percentile(textOnly, 0.5), percentile(textOnly, 0.9), `${fixed((100 * big.length) / cs.length, 1)}%`, `${fixed((100 * sum(big)) / (sum(o) || 1), 0)}%`]
    }),
  )

  table(
    out,
    "3b Final replies (main sessions, text-only calls)",
    ["window", "n", "chars p50", "chars p90", "paragraphs p50", "paragraphs p90", "bullets mean", "with headers", "with tables"],
    W.map((w) => {
      const fin = inWindow(w).filter((c) => !c.tools.length && !c.sub && c.text.trim())
      const chars = fin.map((c) => len(c.text))
      const paras = fin.map((c) => paragraphs(c.text))
      const bullets = fin.map((c) => (c.text.match(/^\s*[-*] /gm) ?? []).length)
      return [w, fin.length, percentile(chars, 0.5), percentile(chars, 0.9), percentile(paras, 0.5), percentile(paras, 0.9), mean(bullets), rate(count(fin, (c) => /^#{1,4} /m.test(c.text)), fin.length), rate(count(fin, (c) => /^\|.*\|/m.test(c.text)), fin.length)]
    }),
  )

  table(
    out,
    "3c Narration before tool calls and edit/write payload size (chars)",
    ["window", "tool calls with narration", "narration p50", "p90", "edit/write n", "payload p50", "payload p90"],
    W.map((w) => {
      const cs = inWindow(w)
      const narration = cs.filter((c) => c.tools.length && c.text.trim()).map((c) => len(c.text))
      const payload = toolsOf(cs).filter((t) => t.name === "edit" || t.name === "write").map((t) => len(String(t.input.newString || t.input.content || "")))
      return [w, rate(narration.length, count(cs, (c) => c.tools.length > 0)), percentile(narration, 0.5), percentile(narration, 0.9), payload.length, percentile(payload, 0.5), percentile(payload, 0.9)]
    }),
  )

  const modelRows: (string | number)[][] = []
  for (const w of W) {
    for (const [m, n] of countBy(withTokens(w), (c) => c.model).slice(0, 3)) {
      const cs = withTokens(w).filter((c) => c.model === m)
      if (n >= 100) modelRows.push([w, m, n, percentile(cs.map((c) => c.output), 0.5), percentile(cs.map((c) => c.output), 0.9), mean(cs.map((c) => c.reasoning))])
    }
  }
  table(out, "3d Output size by model within window", ["window", "model", "calls", "out p50", "out p90", "reasoning mean"], modelRows)

  table(
    out,
    "4 Context (root sessions by creation window, with token data; prompts = turns with >=2 calls)",
    ["window", "sessions", "first-call ctx p50", "prompts", "calls/prompt p50", "growth/prompt p50", "growth/prompt mean", "ctx re-read Mtok/prompt", "reads ranged", "repeat reads", "webfetch n", "tool result chars p90", "p99"],
    W.map((w) => {
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
        growth.length ? roundEven(sum(growth) / growth.length, 0) : 0,
        pyFloat(roundEven(sum(prompts.map((v) => sum(v.map((c) => c.context)))) / Math.max(1, prompts.length) / 1e6, 2)),
        rate(ranged, reads),
        rate(repeated, reads),
        count(tools, (t) => t.name === "webfetch"),
        percentile(results, 0.9),
        percentile(results, 0.99),
      ]
    }),
  )

  table(
    out,
    "5 Routing and guardrails (root sessions by creation window; child = subagent sessions)",
    ["window", "root sessions", "orchestrator", "build", "subagent calls", "no model set", "model actually run (no model set)", "pipe-only policy rejections / all", "child permission-denied / child tool calls", "whole-file reads >40KB"],
    W.map((w) => {
      const roots = rootsIn.get(w)!
      const cs = inWindow(w)
      const sub = toolsOf(cs).filter((t) => SUBAGENT_TOOLS.includes(t.name))
      const unset = sub.filter((t) => emptyJson(t.input.model))
      const ran = countBy(unset, (t) => {
        const sid = t.metadata.sessionId || t.metadata.sessionID
        return t.metadata.model?.modelID || (perSession.get(sid)?.length ? perSession.get(sid)![0].model : "unknown")
      })
      const policy = shellOf(cs).filter((t) => t.cls === "policy_rejected").map((t) => t.message)
      const pipeOnly = count(policy, (m) => {
        const bullets = splitLines(m).filter((l) => l.startsWith("- `"))
        return bullets.length > 0 && bullets.every((l) => l.includes("pipe filters are rejected"))
      })
      const child = toolsOf(cs.filter((c) => c.sub))
      const wholeReads = count(toolsOf(cs), (t) => t.name === "read" && !("limit" in t.input) && !("offset" in t.input) && t.chars > 40 * 1024)
      const root = (agent: string) => count(roots, (s) => sessions.get(s)!.agent === agent)
      return [w, roots.length, rate(root("orchestrator"), roots.length), rate(root("build"), roots.length), sub.length, unset.length, ran.slice(0, 3).map(([m, n]) => `${m} ${n}`).join(", ") || "-", `${pipeOnly}/${policy.length}`, `${count(child, (t) => t.cls === "permission_denied")}/${child.length}`, wholeReads]
    }),
  )

  return out.join("\n") + "\n"
}

const pyFloat = (x: number) => (Number.isInteger(x) ? x.toFixed(1) : String(x))

export function buildReport(format: Format, usage: Usage, windows: Windows): string {
  if (format === "md") return markdownReport(usage, windows)
  const rows = exportRows(usage)
  return format === "csv" ? toCsv(rows) : toJson(rows)
}

export function openUsage(dbPath: string, modelsPath: string): Usage {
  for (const path of [dbPath, modelsPath]) if (!existsSync(path)) throw new Error(`${path} not found`)
  const db = new Database(dbPath, { readonly: true })
  try {
    const usage = loadUsage(db, listPrices(JSON.parse(readFileSync(modelsPath, "utf8"))), SCRATCH_SESSION_ROOTS)
    if (!usage.calls.length) throw new Error(`no assistant calls in ${dbPath}: nothing to report yet`)
    return usage
  } finally {
    db.close()
  }
}

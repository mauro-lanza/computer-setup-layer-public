import { Database } from "bun:sqlite"
import { existsSync, readFileSync, realpathSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { localDay } from "./dates"

export type ErrorClass = "permission_denied" | "policy_rejected" | "aborted" | "other_error" | "pending"

export const ERROR_CLASSES: readonly ErrorClass[] = ["permission_denied", "policy_rejected", "aborted", "other_error", "pending"]
export const SHELL_TOOLS = ["bash", "shell"]
export const EXECUTE_TOOL = "execute"
export const FILE_TOOLS = ["edit", "write", "apply_patch"]
const PRICE_FIELDS = ["input", "output", "cache_read", "cache_write"] as const
const MIGRATION_DOC = join(import.meta.dir, "MIGRATION.md")
const RE_PERMISSION = /rejected permission|specified a rule which prevents|^Permission denied/i
const REQUIRED_COLUMNS = {
  session_v2: ["id", "parent_id", "agent", "model", "time_created", "time_busy", "directory"],
  session_message: ["session_id", "seq", "type", "time_created", "data"],
}

export type ToolInput = { command?: string; content?: string; newString?: string; filePath?: string; path?: string; limit?: unknown; offset?: unknown; model?: unknown }
type FileDiff = { additions?: number; deletions?: number }
export type ToolMetadata = { filediff?: FileDiff; files?: FileDiff[]; sessionId?: string; sessionID?: string; model?: { modelID?: string } }
export interface ToolState {
  status?: string
  input?: ToolInput
  error?: { type?: string; message?: string }
  metadata?: ToolMetadata
  content?: { type: string; text?: string }[]
}
type Content = { type: string; name?: string; text?: string; state?: ToolState }
interface AssistantData {
  agent?: string
  model?: { providerID?: string; id?: string }
  cost?: number
  tokens?: { input?: number; output?: number; reasoning?: number; cache?: { read?: number; write?: number } } | null
  content?: Content[]
  error?: unknown
}
interface SessionRow {
  id: string
  parent_id: string | null
  agent: string | null
  model: string | null
  time_created: number
  time_busy: number | null
  directory: string | null
}
interface MessageRow {
  session_id: string
  type: string
  time_created: number
  data: string
}
type PriceFields = { input?: number; output?: number; cache_read?: number; cache_write?: number }
type ModelCost = PriceFields & { tiers?: (PriceFields & { tier: { type: string; size: number } })[] }
export type ModelsFile = Record<string, { models: Record<string, { cost?: ModelCost }> }>

export interface Tool {
  name: string
  input: ToolInput
  chars: number
  cls: ErrorClass | null
  message: string
  metadata: ToolMetadata
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
  skippedRows: number
  missingV1: MissingV1 | null
}

interface MissingV1 {
  count: number
  from: string
  to: string
}

export interface PriceTier extends PriceFields {
  size: number | null
}

export type Prices = Map<string, PriceTier[]>

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
export const emptyJson = (v: unknown) => !v || (typeof v === "object" && Object.keys(v).length === 0)

/** Length in code points, like Python's `len`. */
export function len(s: string): number {
  let n = s.length
  for (let i = 0; i < s.length - 1; i++) {
    const c = s.charCodeAt(i)
    if (c >= 0xd800 && c < 0xdc00 && (s.charCodeAt(i + 1) & 0xfc00) === 0xdc00) n--
  }
  return n
}

export function splitLines(s: string): string[] {
  if (!s) return []
  const lines = s.split(/\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/)
  if (lines.at(-1) === "") lines.pop()
  return lines
}

/** Class of a tool call that did not complete; classified from the error type, then its text. */
export function errorClass(state: ToolState): ErrorClass | null {
  if (state.status === "completed") return null
  if (state.status !== "error") return "pending"
  const err = state.error ?? {}
  const msg = err.message ?? ""
  if (msg.includes("rejected by policy")) return "policy_rejected"
  if (err.type === "permission.rejected" || RE_PERMISSION.test(msg)) return "permission_denied"
  if (err.type === "aborted" || msg.toLowerCase().includes("aborted")) return "aborted"
  return "other_error"
}

/** Added and deleted lines of a completed file change; `write` has no diff metadata, so its content length counts as added. */
export function churn(name: string, state: ToolState): [added: number, deleted: number] {
  if (state.status !== "completed") return [0, 0]
  if (name === "write") return [splitLines(state.input?.content ?? "").length, 0]
  const md = state.metadata ?? {}
  const files = !emptyJson(md.filediff) ? [md.filediff!] : (md.files ?? [])
  return [sum(files.map((f) => f.additions ?? 0)), sum(files.map((f) => f.deletions ?? 0))]
}

export function priceKey(provider: string, model: string): string {
  return `${provider}\u0000${model}`
}

/** Per-Mtok prices by provider and model; the first entry is the base price, the rest are context tiers. */
export function listPrices(models: ModelsFile): Prices {
  const prices: Prices = new Map()
  for (const [provider, p] of Object.entries(models)) {
    for (const [model, m] of Object.entries(p.models)) {
      const cost = m.cost
      if (!cost) continue
      const tiers: PriceTier[] = (cost.tiers ?? []).filter((t) => t.tier.type === "context").map((t) => ({ ...t, size: t.tier.size }))
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

function parseObject<T extends object>(text: string): T | null {
  try {
    const v: unknown = JSON.parse(text)
    return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as T) : null
  } catch {
    return null
  }
}

/** V1 sessions the one-time import never copied (created by a V1 client afterwards); null when none or when there is no V1 table. */
function missingV1Sessions(db: Database): MissingV1 | null {
  if (!db.query("select 1 from sqlite_master where type='table' and name='session'").get()) return null
  const times = (db.query("select time_created from session where id not in (select id from session_v2)").all() as { time_created: number }[]).map((r) => r.time_created)
  if (!times.length) return null
  return { count: times.length, from: localDay(Math.min(...times)), to: localDay(Math.max(...times)) }
}

/** Sessions and assistant calls outside scratch dirs. Reads session_v2/session_message, which hold V1 history only up to the one-time import; later V1 sessions are counted in missingV1. Rows with unparseable JSON are skipped and counted. */
export function loadUsage(db: Database, prices: Prices, scratch: string[]): Usage {
  let skippedRows = 0
  const sessions = new Map<string, Session>()
  const sessionRows = db.query("select id,parent_id,agent,model,time_created,time_busy,directory from session_v2").all() as SessionRow[]
  for (const r of sessionRows) {
    if (typeof r.directory !== "string" || scratch.some((root) => r.directory!.startsWith(root))) continue
    const model = r.model ? parseObject<{ id?: string }>(r.model) : {}
    if (!model) {
      skippedRows++
      continue
    }
    sessions.set(r.id, {
      parent: r.parent_id,
      agent: r.agent || "",
      model: model.id ?? "",
      created: r.time_created,
      busy: r.time_busy || 0,
      turns: 0,
    })
  }
  const calls: Call[] = []
  const compactions: [string, number][] = []
  const userTurns: [string, number][] = []
  for (const r of db.query("select session_id,type,time_created,data from session_message order by session_id,seq").iterate() as Iterable<MessageRow>) {
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
    const d = parseObject<AssistantData>(r.data)
    if (!d || (d.content !== undefined && !Array.isArray(d.content))) {
      skippedRows++
      continue
    }
    const tk = d.tokens ?? null
    const content = d.content ?? []
    const tools: Tool[] = content
      .filter((c) => c.type === "tool")
      .map((c) => {
        const state = c.state ?? {}
        const name = c.name ?? ""
        const text = (state.content ?? []).filter((x) => x.type === "text").map((x) => x.text ?? "").join("")
        const [added, deleted] = FILE_TOOLS.includes(name) ? churn(name, state) : [0, 0]
        return { name, input: state.input ?? {}, chars: len(text), cls: errorClass(state), message: state.error?.message ?? "", metadata: state.metadata ?? {}, added, deleted }
      })
    const model = d.model ?? {}
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
  return { sessions, calls, compactions, userTurns, skippedRows, missingV1: missingV1Sessions(db) }
}

export function usageWarnings(usage: Usage): string {
  const lines: string[] = []
  const unpriced = new Map<string, number>()
  for (const c of usage.calls) if (c.unpriced) unpriced.set(c.model || "?", (unpriced.get(c.model || "?") ?? 0) + 1)
  if (unpriced.size) lines.push(`warning: ${sum([...unpriced.values()])} calls have no list price and are excluded from cost_list: ${JSON.stringify(Object.fromEntries(unpriced))}`)
  if (usage.skippedRows) lines.push(`warning: ${usage.skippedRows} rows with unreadable JSON were skipped`)
  const gap = usage.missingV1
  if (gap) lines.push(`warning: ${gap.count} V1 sessions (${gap.from}..${gap.to}) are not in session_v2 and are not counted; see ${MIGRATION_DOC}`)
  return lines.join("\n")
}

function assertSchema(db: Database, dbPath: string): void {
  for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
    const present = new Set((db.query(`pragma table_info(${table})`).all() as { name: string }[]).map((c) => c.name))
    if (!present.size) throw new Error(`${dbPath}: table ${table} is missing; this plugin needs the OpenCode V2 database`)
    const missing = columns.filter((c) => !present.has(c))
    if (missing.length) throw new Error(`${dbPath}: table ${table} lacks column(s) ${missing.join(", ")}`)
  }
}

export function openUsage(dbPath: string, modelsPath: string): Usage {
  for (const path of [dbPath, modelsPath]) if (!existsSync(path)) throw new Error(`${path} not found`)
  const db = new Database(dbPath, { readonly: true })
  try {
    assertSchema(db, dbPath)
    const tmp = tmpdir()
    const scratchRoots = [...new Set([tmp, realpathSync(tmp), "/tmp", "/private/tmp"])].map((d) => join(d, "opencode") + "/")
    const usage = loadUsage(db, listPrices(JSON.parse(readFileSync(modelsPath, "utf8")) as ModelsFile), scratchRoots)
    if (!usage.calls.length) throw new Error(`no assistant calls in ${dbPath}: nothing to report yet`)
    return usage
  } finally {
    db.close()
  }
}

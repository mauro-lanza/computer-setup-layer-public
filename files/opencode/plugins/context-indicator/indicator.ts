export type Thresholds = { warn: number; alert: number }
export type State = "normal" | "warn" | "alert"

// Only the fields the count reads, all unknown: see contextTokens.
type Message = {
  id?: unknown
  type?: unknown
  status?: unknown
  tokens?: { input?: unknown; output?: unknown; reasoning?: unknown; cache?: { read?: unknown; write?: unknown } }
}

export const DEFAULT_THRESHOLDS: Thresholds = { warn: 100_000, alert: 150_000 }

const isPositiveInteger = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0

/** Configured thresholds, or the defaults when either is invalid or warn >= alert. */
export function parseThresholds(options: Readonly<Record<string, unknown>> | undefined): Thresholds {
  const warn = options?.warn
  const alert = options?.alert
  if (!isPositiveInteger(warn) || !isPositiveInteger(alert) || warn >= alert) return DEFAULT_THRESHOLDS
  return { warn, alert }
}

const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0)

// Mirrors the built-in sidebar count (client/solid/usage.ts lastAssistantWithUsage). Fields are typed
// unknown on purpose: the message shape belongs to OpenCode and may change in an update.
export function contextTokens(messages: readonly Message[] | undefined, revertMessageID?: string): number | undefined {
  if (!Array.isArray(messages)) return undefined
  const boundaryIndex = revertMessageID ? messages.findIndex((message) => message?.id === revertMessageID) : -1
  if (revertMessageID && boundaryIndex === -1) return undefined
  const end = boundaryIndex === -1 ? messages.length : boundaryIndex
  const compactionIndex = messages.findLastIndex(
    (message, index) => message?.type === "compaction" && message.status === "completed" && index < end,
  )
  const last = messages.findLast(
    (message, index) =>
      message?.type === "assistant" && typeof message.tokens === "object" && message.tokens !== null && index > compactionIndex && index < end,
  )
  if (!last?.tokens) return undefined
  const { input, output, reasoning, cache } = last.tokens
  const total = count(input) + count(output) + count(reasoning) + count(cache?.read) + count(cache?.write)
  return total > 0 ? total : undefined
}

export function contextState(tokens: number | undefined, thresholds: Thresholds): State {
  if (tokens === undefined) return "normal"
  if (tokens >= thresholds.alert) return "alert"
  if (tokens >= thresholds.warn) return "warn"
  return "normal"
}

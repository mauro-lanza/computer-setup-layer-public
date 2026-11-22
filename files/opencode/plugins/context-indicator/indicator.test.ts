import { expect, test } from "bun:test"
import { contextState, contextTokens, DEFAULT_THRESHOLDS, parseThresholds } from "./indicator"

const assistant = (id: string, input: number, extra: Record<string, number> = {}) => ({
  id,
  type: "assistant",
  tokens: { input, output: extra.output ?? 0, reasoning: extra.reasoning ?? 0, cache: { read: extra.read ?? 0, write: extra.write ?? 0 } },
})

test("sums every token kind of the last assistant message", () => {
  const messages = [assistant("a", 999), assistant("b", 1, { output: 2, reasoning: 3, read: 4, write: 5 })]
  expect(contextTokens(messages)).toBe(15)
})

test("ignores messages after the revert boundary", () => {
  const messages = [assistant("a", 10), assistant("b", 20), assistant("c", 30)]
  expect(contextTokens(messages, "c")).toBe(20)
  expect(contextTokens(messages, "b")).toBe(10)
})

test("an unknown revert boundary yields no data, like the built-in", () => {
  expect(contextTokens([assistant("a", 10)], "missing")).toBeUndefined()
})

test("restarts after a completed compaction", () => {
  const messages = [assistant("a", 500), { id: "c", type: "compaction", status: "completed" }]
  expect(contextTokens(messages)).toBeUndefined()
  expect(contextTokens([...messages, assistant("b", 7)])).toBe(7)
})

test("a running compaction does not reset the count", () => {
  expect(contextTokens([assistant("a", 500), { id: "c", type: "compaction", status: "running" }])).toBe(500)
})

test("missing or odd data gives no tokens", () => {
  expect(contextTokens(undefined)).toBeUndefined()
  expect(contextTokens(null as never)).toBeUndefined()
  expect(contextTokens([])).toBeUndefined()
  expect(contextTokens([{ type: "user" }, null as never, { type: "assistant" }])).toBeUndefined()
  expect(contextTokens([{ type: "assistant", tokens: {} }])).toBeUndefined()
  expect(contextTokens([{ type: "assistant", tokens: { input: "x", output: NaN, cache: null as never } }])).toBeUndefined()
})

test("maps tokens to a state at the thresholds", () => {
  const t = { warn: 100, alert: 150 }
  expect(contextState(undefined, t)).toBe("normal")
  expect(contextState(99, t)).toBe("normal")
  expect(contextState(100, t)).toBe("warn")
  expect(contextState(149, t)).toBe("warn")
  expect(contextState(150, t)).toBe("alert")
})

test("accepts valid options", () => {
  expect(parseThresholds({ warn: 50, alert: 80 })).toEqual({ warn: 50, alert: 80 })
})

test("falls back to the defaults on invalid options", () => {
  for (const options of [undefined, {}, { warn: 50 }, { warn: 0, alert: 10 }, { warn: -1, alert: 10 }, { warn: 1.5, alert: 10 }, { warn: "5", alert: 10 }, { warn: 10, alert: 10 }, { warn: 20, alert: 10 }]) {
    expect(parseThresholds(options)).toEqual(DEFAULT_THRESHOLDS)
  }
})

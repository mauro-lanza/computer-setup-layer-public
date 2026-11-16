import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { chartsHtml } from "./charts"
import { weekOf } from "./dates"
import { locations, resolveOutDir } from "./paths"
import { exportRows, loadWindows, markdownReport, readChanges, toCsv, toJson, windowOf } from "./report"
import { commits, prBodies, shellClass } from "./shell"
import { churn, errorClass, listCost, listPrices, loadUsage, openUsage, usageWarnings } from "./usage"

const prices = listPrices({
  acme: {
    models: {
      small: { cost: { input: 1, output: 2, cache_read: 0.5, cache_write: 1.25 } },
      tiered: {
        cost: {
          input: 1,
          output: 2,
          tiers: [{ tier: { type: "context", size: 1000 }, input: 4, output: 8, cache_read: 2, cache_write: 5 }],
        },
      },
      free: {},
    },
  },
})
const none = { fresh: 0, cacheRead: 0, cacheWrite: 0, output: 0, reasoning: 0 }

test("shellClass flags shell misuse and ignores clean commands", () => {
  expect([...shellClass("cat a.txt")]).toEqual(["read_via_shell"])
  expect(shellClass("sed -i s/a/b/ f")).toContain("edit_via_shell")
  expect(shellClass("echo hi > src/out.txt")).toContain("edit_via_shell")
  expect(shellClass("echo hi > /tmp/out.txt")).toContain("scratch_redirect")
  expect(shellClass("cat > /tmp/x <<'EOF'\nbody\nEOF")).toContain("scratch_redirect")
  expect(shellClass("echo hi > /dev/null")).not.toContain("edit_via_shell")
  expect(shellClass("cd /x && ls")).toEqual(new Set(["cd_prefix", "search_via_shell"]))
  expect(shellClass("git log | head")).toContain("pipe_filter")
  expect(shellClass("python3 -c \"open('f','w').write('x')\"")).toContain("python_write")
  expect(shellClass("git status").size).toBe(0)
})

test("commits extracts messages from -m flags and heredocs", () => {
  expect(commits('git commit -m "Add thing"')).toEqual([{ msg: "Add thing", parts: 1 }])
  expect(commits('git commit -m "Title" -m "Body"')).toEqual([{ msg: "Title\n\nBody", parts: 2 }])
  expect(commits("git commit -F - <<'EOF'\nTitle\nEOF")).toEqual([{ msg: "Title", parts: 1 }])
  expect(commits("git commit --amend --no-edit")).toEqual([])
  expect(commits("git status")).toEqual([])
})

test("prBodies measures heredoc and inline bodies", () => {
  expect(prBodies('gh pr create --body "hello"')).toEqual([5])
  expect(prBodies("gh pr create --body-file - <<'EOF'\nabc\nEOF")).toEqual([3])
  expect(prBodies("gh pr list")).toEqual([])
})

test("errorClass maps tool states", () => {
  expect(errorClass({ status: "completed" })).toBeNull()
  expect(errorClass({ status: "running" })).toBe("pending")
  expect(errorClass({ status: "error", error: { message: "Shell call rejected by policy" } })).toBe("policy_rejected")
  expect(errorClass({ status: "error", error: { type: "permission.rejected" } })).toBe("permission_denied")
  expect(errorClass({ status: "error", error: { message: "Permission denied: shell" } })).toBe("permission_denied")
  expect(errorClass({ status: "error", error: { message: "Aborted by user" } })).toBe("aborted")
  expect(errorClass({ status: "error", error: { message: "boom" } })).toBe("other_error")
})

test("churn counts diff metadata and write content", () => {
  expect(churn("write", { status: "completed", input: { content: "a\nb\n" } })).toEqual([2, 0])
  expect(churn("edit", { status: "completed", metadata: { filediff: { additions: 3, deletions: 1 } } })).toEqual([3, 1])
  expect(churn("apply_patch", { status: "completed", metadata: { files: [{ additions: 1, deletions: 2 }, { additions: 4, deletions: 0 }] } })).toEqual([5, 2])
  expect(churn("edit", { status: "error" })).toEqual([0, 0])
})

test("listCost picks the context tier and refuses unpriced token classes", () => {
  expect(listCost(prices, "acme", "small", { ...none, fresh: 1e6, output: 1e6, cacheRead: 2e6, cacheWrite: 1e6 })).toBeCloseTo(1 + 2 + 1 + 1.25)
  expect(listCost(prices, "acme", "tiered", { ...none, fresh: 500, output: 1e6 })).toBeCloseTo(2 + 500e-6)
  expect(listCost(prices, "acme", "tiered", { ...none, fresh: 1001, output: 1e6 })).toBeCloseTo(8 + 1001 * 4e-6)
  expect(listCost(prices, "acme", "tiered", { ...none, cacheRead: 10 })).toBeNull()
  expect(listCost(prices, "acme", "tiered", none)).toBe(0)
  expect(listCost(prices, "acme", "free", none)).toBeNull()
  expect(listCost(prices, "other", "small", none)).toBeNull()
})

test("weekOf buckets by local Monday across a DST change", () => {
  expect(weekOf(new Date(2026, 2, 29, 12).getTime())).toBe("2026-03-23")
  expect(weekOf(new Date(2026, 2, 30, 0, 30).getTime())).toBe("2026-03-30")
  expect(weekOf(new Date(2026, 10, 1, 23, 30).getTime())).toBe("2026-10-26")
})

test("loadWindows splits at major changes only", () => {
  const dir = mkdtempSync(join(tmpdir(), "usage-report-"))
  const file = join(dir, "changes.json")
  writeFileSync(file, JSON.stringify([{ date: "2026-02-01", label: "a", major: true }, { date: "2026-02-10", label: "b", major: false }, { date: "2026-03-01T12:00:00", label: "c", major: true }]))
  const windows = loadWindows(readChanges(file))
  expect(windows.map(([l]) => l)).toEqual(["W0 baseline (before 2026-02-01)", "W1 2026-02-01 a", "W2 2026-03-01 c"])
  expect(windowOf(windows, new Date(2026, 1, 1).getTime() - 1)).toBe(windows[0][0])
  expect(windowOf(windows, new Date(2026, 1, 20).getTime())).toBe(windows[1][0])
  expect(loadWindows(readChanges(join(dir, "missing.json")))).toEqual([["all history", 0]])
})

test("readChanges names the bad entry in a malformed file", () => {
  const dir = mkdtempSync(join(tmpdir(), "usage-report-"))
  const read = (entries: unknown) => {
    const file = join(dir, "bad.json")
    writeFileSync(file, JSON.stringify(entries))
    return () => readChanges(file)
  }
  const ok = { date: "2026-02-01", label: "a", major: true }
  expect(read([ok, { ...ok, date: "not a date" }])).toThrow("entry 1")
  expect(read([{ ...ok, label: 3 }])).toThrow("label")
  expect(read([{ ...ok, major: "yes" }])).toThrow("major")
  expect(read({})).toThrow("JSON array")
})

test("locations honours OPENCODE_DB and resolveOutDir accepts only absolute or ~/ paths", () => {
  expect(locations("/h", {})).toEqual({ db: "/h/.local/share/opencode/opencode.db", models: "/h/.cache/opencode/models.json", changes: "/h/.config/opencode/usage-config-changes.json" })
  expect(locations("/h", { OPENCODE_DB: "/x/o.db" }).db).toBe("/x/o.db")
  expect(locations("/h", { OPENCODE_DB: "o.db", XDG_DATA_HOME: "/d" }).db).toBe("/d/opencode/o.db")
  expect(locations("/h", { XDG_CACHE_HOME: "/c", XDG_CONFIG_HOME: "/f" })).toMatchObject({ models: "/c/opencode/models.json", changes: "/f/opencode/usage-config-changes.json" })
  expect(resolveOutDir("~/out", "/h")).toBe("/h/out")
  expect(resolveOutDir("/abs/out/", "/h")).toBe("/abs/out")
  expect(() => resolveOutDir("rel/out", "/h")).toThrow("absolute")
})

function fixture(): Database {
  const db = new Database(":memory:")
  db.run("create table session_v2 (id text, parent_id text, agent text, model text, time_created integer, time_busy integer, directory text)")
  db.run("create table session_message (session_id text, seq integer, type text, time_created integer, data text)")
  const t0 = new Date(2026, 2, 30, 10).getTime()
  const session = db.prepare("insert into session_v2 values (?,?,?,?,?,?,?)")
  session.run("root", null, "build", JSON.stringify({ id: "small" }), t0, 5000, "/work/project")
  session.run("child", "root", "general", null, t0, null, "/work/project")
  session.run("scratch", null, "build", null, t0, 0, "/tmp/opencode/scratch")
  const message = db.prepare("insert into session_message values (?,?,?,?,?)")
  const assistant = (tools: object[], tokens: object | null = { input: 100, output: 50, reasoning: 10, cache: { read: 400, write: 20 } }, agent = "build") =>
    JSON.stringify({ agent, model: { providerID: "acme", id: "small" }, cost: 0.01, tokens, content: [{ type: "text", text: "done" }, ...tools] })
  const shell = (command: string, state: object) => ({ type: "tool", name: "shell", state: { input: { command }, content: [], ...state } })
  message.run("root", 1, "user", t0, "{}")
  message.run("root", 2, "assistant", t0 + 1, assistant([shell('git commit -m "Add thing"', { status: "completed" }), shell("cat f", { status: "error", error: { message: "Shell call rejected by policy" } })]))
  message.run("root", 3, "compaction", t0 + 2, "{}")
  message.run("child", 1, "assistant", t0 + 3, assistant([{ type: "tool", name: "write", state: { status: "completed", input: { content: "x\ny" } } }], null, "general"))
  message.run("scratch", 1, "assistant", t0 + 4, assistant([]))
  return db
}

test("loadUsage skips scratch sessions and totals tokens, cost and tool outcomes", () => {
  const usage = loadUsage(fixture(), prices, ["/tmp/opencode/"])
  expect([...usage.sessions.keys()]).toEqual(["root", "child"])
  expect(usage.calls).toHaveLength(2)
  expect(usage.userTurns).toHaveLength(1)
  expect(usage.compactions).toHaveLength(1)
  const [child, root] = usage.calls
  expect(root.costList).toBeCloseTo((100 + 50 * 2 + 10 * 2 + 400 * 0.5 + 20 * 1.25) / 1e6)
  expect(root.tools.map((t) => t.cls)).toEqual([null, "policy_rejected"])
  expect(child.hasTokens).toBe(false)
  expect(child.sub).toBe(true)
  expect(child.tools[0].added).toBe(2)
})

test("exportRows aggregates per local day, agent and model and renders csv/json", () => {
  const usage = loadUsage(fixture(), prices, ["/tmp/opencode/"])
  const rows = exportRows(usage)
  expect(rows.map((r) => [r.day, r.agent, r.model])).toEqual([
    ["2026-03-30", "build", "small"],
    ["2026-03-30", "general", ""],
    ["2026-03-30", "general", "small"],
  ])
  const build = rows[0]
  expect(build).toMatchObject({ root_sessions: 1, user_turns: 1, assistant_calls: 1, tool_calls: 2, shell_calls: 2, shell_policy_rejected: 1, compactions: 1, root_busy_ms: 5000, tool_calls_per_user_turn: 2 })
  expect(rows[1]).toMatchObject({ subagent_sessions: 1, tool_calls_per_user_turn: "" })
  expect(rows[2]).toMatchObject({ lines_added: 2, unpriced_calls: 0 })
  expect(toCsv(rows).split("\n")[0].startsWith("day,agent,model,root_sessions")).toBe(true)
  expect(JSON.parse(toJson(rows))).toHaveLength(3)
})

test("markdown report and charts render from the fixture", () => {
  const usage = loadUsage(fixture(), prices, ["/tmp/opencode/"])
  expect(markdownReport(usage, [["all history", 0]])).toContain("| all history | 1 | 1 | 2 |")
  const html = chartsHtml(exportRows(usage), [{ when: 0, day: "2026-03-30", label: "change", major: true }])
  expect(html.match(/<svg/g)).toHaveLength(7)
  expect(html).not.toContain("http")
})

test("loadUsage skips and counts rows with unreadable JSON", () => {
  const db = fixture()
  db.run("insert into session_v2 values ('badmodel', null, 'build', '{oops', 0, 0, '/work/project')")
  db.run("insert into session_message values ('root', 9, 'assistant', 1, 'not json')")
  const usage = loadUsage(db, prices, ["/tmp/opencode/"])
  expect(usage.skippedRows).toBe(2)
  expect(usage.sessions.has("badmodel")).toBe(false)
  expect(usage.calls).toHaveLength(2)
  expect(usageWarnings(usage)).toContain("2 rows with unreadable JSON")
})

test("usageWarnings reports V1 sessions missing from session_v2 and stays silent without a V1 table", () => {
  const db = fixture()
  expect(loadUsage(db, prices, []).missingV1).toBeNull()
  db.run("create table session (id text, time_created integer)")
  db.run("insert into session values ('root', 0)")
  expect(loadUsage(db, prices, []).missingV1).toBeNull()
  db.run("insert into session values ('gap1', ?)", [new Date(2026, 9, 16, 12).getTime()])
  db.run("insert into session values ('gap2', ?)", [new Date(2026, 9, 18, 12).getTime()])
  const warning = usageWarnings(loadUsage(db, prices, []))
  expect(warning).toContain("2 V1 sessions (2026-10-16..2026-10-18) are not in session_v2 and are not counted; see ")
  expect(warning).toContain("MIGRATION.md")
})

test("openUsage reports a missing database and an empty one clearly", () => {
  expect(() => openUsage("/nonexistent/opencode.db", "/nonexistent/models.json")).toThrow("not found")
  const dir = mkdtempSync(join(tmpdir(), "usage-report-"))
  writeFileSync(join(dir, "models.json"), "{}")
  const old = new Database(join(dir, "old.db"), { create: true })
  old.run("create table session_v2 (id text)")
  old.close()
  expect(() => openUsage(join(dir, "old.db"), join(dir, "models.json"))).toThrow("table session_v2 lacks column(s) parent_id")
  const db = new Database(join(dir, "opencode.db"), { create: true })
  db.run("create table session_v2 (id text, parent_id text, agent text, model text, time_created integer, time_busy integer, directory text)")
  db.run("create table session_message (session_id text, seq integer, type text, time_created integer, data text)")
  db.close()
  writeFileSync(join(dir, "models.json"), "{}")
  expect(() => openUsage(join(dir, "opencode.db"), join(dir, "models.json"))).toThrow("nothing to report")
  expect(() => openUsage(join(dir, "opencode.db"), join(dir, "absent.json"))).toThrow("absent.json not found")
})

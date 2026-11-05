import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { cases } from "./cases"
import { check, simpleCommands } from "./policy"

interface Rule {
  resource: string
  effect: "allow" | "deny" | "ask"
  pattern: RegExp
}

// Same matching as OpenCode V2: `*` is `.*`, `?` is `.`, anchored, dotAll, and a trailing " *" also matches the bare command.
function compile(resource: string): RegExp {
  const trailing = resource.endsWith(" *")
  const body = trailing ? resource.slice(0, -2) : resource
  const source = [...body].map((c) => (c === "*" ? ".*" : c === "?" ? "." : c.replace(/[.+^${}()|[\]\\]/g, "\\$&"))).join("")
  return new RegExp(`^${source}${trailing ? "( .*)?" : ""}$`, "s")
}

const rule = (resource: string, effect: Rule["effect"]): Rule => ({ resource, effect, pattern: compile(resource) })

function templateRules(): Rule[] {
  const source = readFileSync(new URL("../../../../templates/opencode.jsonc.j2", import.meta.url), "utf8")
  const start = source.indexOf('"permissions": [') + '"permissions": '.length
  const block = source.slice(start, source.indexOf("\n  ]", start) + 4)
  const entries: { action: string; resource: string; effect: Rule["effect"] }[] = JSON.parse(block)
  return entries.filter((e) => e.action === "shell").map((e) => rule(e.resource, e.effect))
}

function orchestratorRules(): Rule[] {
  const source = readFileSync(new URL("../../agents/orchestrator.md", import.meta.url), "utf8")
  const frontmatter = source.split("\n---\n")[0]
  const entries = [...frontmatter.matchAll(/^\s*- \{ action: shell, resource: "(.*)", effect: (\w+) \}$/gm)]
  return entries.map((m) => rule(m[1], m[2] as Rule["effect"]))
}

const decide = (rules: Rule[], subcommand: string): Rule["effect"] =>
  rules.findLast((r) => r.pattern.test(subcommand))?.effect ?? "ask"

const subcommands = (command: string) => simpleCommands(command).map((c) => [c.name, ...c.args.map((a) => a.text)].join(" "))

const globDenies = (rules: Rule[], command: string) => subcommands(command).some((s) => decide(rules, s) === "deny")

// The orchestrator's catch-all deny is its allow-list design, so only its explicit rules are compared.
const sets: [string, Rule[]][] = [
  ["template", templateRules()],
  ["orchestrator", orchestratorRules().filter((r) => r.resource !== "*")],
]

test("the permission rules were read", () => {
  expect(sets[0][1].length).toBeGreaterThan(50)
  expect(sets[1][1].length).toBeGreaterThan(20)
})

for (const [label, rules] of sets) {
  for (const [command, expected] of cases) {
    if (expected.length === 0) test(`${label} globs do not deny plugin-allowed ${JSON.stringify(command).slice(0, 70)}`, () => expect(globDenies(rules, command)).toBe(false))
  }
}

const probes = [
  "cat",
  "cat <<'EOF'\nx\nEOF",
  "git log | cat",
  "less",
  "more",
  "bat",
  "tree src",
  "fd",
  "ls-files | ls",
  "sed -i s/a/b/ f",
  "sort -o f x",
  "sort x -ofile",
  "git log --output=f",
  "git diff --output f",
  "git show --output=f",
  "ls -la",
  "ls",
  "cat x",
  "less x",
  "more x",
  "bat x",
  "tree",
  "fd x",
  "find . -name x",
  "cd x",
  "sed -i s/a/b/ f",
  "gh api x -X POST",
  "gh api x --method DELETE",
  "gh api x -XGET",
  "gh api x --method=GET",
  "gh api x -f a=1",
  "gh api x -F a=1",
  "gh api x --field a=1",
  "gh api x --raw-field a=1",
  "gh api x --input f",
  "ps eww",
  "ps e",
  "ps -E",
  "ps -p 1 -e",
  "ps -p 1 eww",
  "ps -axe",
  "ps auxe",
  "ps aux e",
]
const orchestratorProbes = probes.filter((p) => p.startsWith("gh api"))

for (const [label, list] of [["template", probes], ["orchestrator", orchestratorProbes]] as const) {
  for (const probe of list) {
    test(`${label} globs deny ${probe} and the plugin rejects it with a hint`, () => {
      expect(globDenies(sets.find(([name]) => name === label)![1], probe)).toBe(true)
      expect(check(probe)).toContain("Shell call rejected by policy")
    })
  }
}

test("allowed ps forms stay allowed", () => {
  const rules = sets[0][1]
  for (const command of ["ps", "ps aux", "ps -ax", "ps -p 1", "ps -o pid,command", "ps -p 1 -o pid,command"]) {
    expect(decide(rules, command)).toBe("allow")
    expect(check(command)).toBeUndefined()
  }
})

test("the glob matcher follows the V2 rules", () => {
  const rules = [rule("ls *", "deny"), rule("ls -x", "allow")]
  expect(decide(rules, "ls")).toBe("deny")
  expect(decide(rules, "ls a b")).toBe("deny")
  expect(decide(rules, "ls -x")).toBe("allow")
  expect(decide(rules, "lsx")).toBe("ask")
})

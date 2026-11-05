import { forEachChild, parse } from "./vendor/unbash.js"
import { violation } from "./rules"

export interface Word {
  text: string
  dirty: boolean
}

export interface Command {
  name: string
  args: Word[]
  redirects: { op: string; target?: string }[]
  heredoc?: string
  hereString: boolean
  pipeIn: boolean
  background: boolean
  xargs: boolean
}

interface Node {
  type: string
  value?: string
  operator?: string
  text?: string
  parts?: Node[]
  script?: Node
  commands?: Node[]
  command?: Node
  name?: Node
  prefix?: Node[]
  suffix?: Node[]
  redirects?: Node[]
  target?: Node
  body?: Node
  background?: boolean
}

interface Context {
  pipeIn: boolean
  background: boolean
  redirects: Node[]
}

const FRESH: Context = { pipeIn: false, background: false, redirects: [] }
const MAX_EMBEDDED_DEPTH = 2
const SHELLS = new Set(["sh", "bash", "zsh"])
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/
const EXPANSIONS = new Set(["SimpleExpansion", "ParameterExpansion", "CommandExpansion", "ArithmeticExpansion", "ProcessSubstitution"])
const SUBSTITUTIONS = new Set(["CommandExpansion", "ProcessSubstitution", "ArithmeticCommandExpansion"])
const REDIRECTS = new Set(["Redirect", "HereString", "HereDoc"])

// Value flags of each wrapper; `operand` wrappers take one positional argument before the command.
const WRAPPERS: Record<string, { valueFlags: string; operand?: true }> = {
  exec: { valueFlags: "" },
  nohup: { valueFlags: "" },
  time: { valueFlags: "" },
  builtin: { valueFlags: "" },
  command: { valueFlags: "" },
  nice: { valueFlags: "n" },
  timeout: { valueFlags: "ks", operand: true },
  sudo: { valueFlags: "ugCDhprTU" },
  env: { valueFlags: "uCS" },
  xargs: { valueFlags: "nIPLdEsa" },
}

const basename = (path: string) => path.split("/").pop()!

function hasExpansion(node: Node): boolean {
  if (EXPANSIONS.has(node.type)) return true
  let found = false
  forEachChild(node, (child: Node) => {
    found ||= hasExpansion(child)
  })
  return found
}

// `"$(cat <<'EOF' ... EOF)"` is a literal message, not a dynamic one.
function heredocMessage(word: Node): string | undefined {
  let part = word.parts?.length === 1 ? word.parts[0] : undefined
  if (part?.type === "DoubleQuoted") part = part.parts!.length === 1 ? part.parts![0] : undefined
  const only = part?.type === "CommandExpansion" && part.script?.commands?.length === 1 ? part.script.commands[0].command : undefined
  const doc = only?.type === "Command" && only.name?.value === "cat" && only.suffix!.length === 1 ? only.suffix![0] : undefined
  return doc?.type === "HereDoc" ? doc.body!.text!.replace(/\n+$/, "") : undefined
}

function toWord(node: Node): Word {
  const message = heredocMessage(node)
  return message === undefined ? { text: node.value!, dirty: hasExpansion(node) } : { text: message, dirty: false }
}

function toCommand(node: Node, ctx: Context): Command {
  const own = [...node.prefix!, ...node.suffix!]
  const command: Command = {
    name: node.name!.value!,
    args: node.suffix!.filter((n) => n.type === "Word").map(toWord),
    redirects: [],
    hereString: false,
    pipeIn: ctx.pipeIn,
    background: ctx.background,
    xargs: false,
  }
  for (const redirect of [...ctx.redirects, ...own.filter((n) => REDIRECTS.has(n.type))]) {
    if (redirect.type === "HereDoc") command.heredoc = redirect.body!.text!
    else if (redirect.type === "HereString") command.hereString = true
    else command.redirects.push({ op: redirect.operator!, target: redirect.target?.value })
  }
  return command
}

function flatten(node: Node, ctx: Context, out: Command[]): void {
  switch (node.type) {
    case "Command":
      if (node.name) out.push(toCommand(node, ctx))
      return forEachChild(node, (child: Node) => flatten(child, FRESH, out))
    case "Statement":
      return flatten(node.command!, { ...ctx, pipeIn: false, background: ctx.background || !!node.background }, out)
    case "Pipeline":
      return node.commands!.forEach((child, i) => flatten(child, { ...ctx, pipeIn: i > 0 }, out))
    case "Redirected":
      flatten(node.command!, { ...ctx, redirects: [...ctx.redirects, ...node.redirects!] }, out)
      return node.redirects!.forEach((redirect) => flatten(redirect, FRESH, out))
    default:
      return forEachChild(node, (child: Node) => flatten(child, SUBSTITUTIONS.has(node.type) ? FRESH : { ...ctx, pipeIn: false }, out))
  }
}

// Drops a wrapper's own flags, skipping the value of those that take one.
function skipFlags(args: Word[], valueFlags: string): Word[] {
  let k = 0
  while (k < args.length && args[k].text.startsWith("-") && args[k].text.length > 1) {
    const flag = args[k].text
    k += flag === "--" ? 1 : flag.length === 2 && valueFlags.includes(flag[1]) ? 2 : 1
    if (flag === "--") break
  }
  return args.slice(k)
}

// Peels wrappers and leading assignments so the rules see the command that actually runs; name "" means nothing runs.
function normalise(cmd: Command): Command {
  let { name, args, xargs } = cmd
  for (;;) {
    const wrapper = WRAPPERS[basename(name)]
    let rest: Word[]
    if (ASSIGNMENT.test(name)) rest = args
    // `command -v x` only looks x up
    else if (basename(name) === "command" && /^-p?[vV]/.test(args[0]?.text ?? "")) break
    else if (Object.hasOwn(WRAPPERS, basename(name))) {
      xargs ||= basename(name) === "xargs"
      rest = skipFlags(args, wrapper.valueFlags)
      if (wrapper.operand) rest = rest.slice(1)
    } else break
    if (!rest.length) return { ...cmd, name: "", args: [] }
    name = rest[0].text
    args = rest.slice(1)
  }
  return { ...cmd, name: basename(name), args, xargs }
}

// eval bodies and `sh|bash|zsh -c` bodies are shell source themselves.
function embeddedSource({ name, args }: Command): string | undefined {
  if (name === "eval") return args.map((a) => a.text).join(" ")
  if (!SHELLS.has(name)) return undefined
  const flag = args.findIndex((a) => /^-[a-z]*c$/.test(a.text))
  return flag >= 0 ? args[flag + 1]?.text : undefined
}

// Splits a shell command into the simple commands it would run, after unwrapping wrappers, eval and `sh -c`.
export function simpleCommands(source: string, depth = 0): Command[] {
  // A parse error still yields a partial tree: lint what was read and leave the rest to the permission globs.
  const flat: Command[] = []
  flatten(parse(source), FRESH, flat)
  return flat
    .map(normalise)
    .filter((cmd) => cmd.name)
    .flatMap((cmd) => {
      const embedded = depth < MAX_EMBEDDED_DEPTH ? embeddedSource(cmd) : undefined
      return embedded === undefined ? [cmd] : [cmd, ...simpleCommands(embedded, depth + 1)]
    })
}

function describe({ name, args }: Command): string {
  const shown = [name, ...args.map((a) => a.text)].join(" ").replace(/\s+/g, " ")
  // Keep the tail too: long commands often differ only in a trailing path.
  return shown.length > 90 ? `${shown.slice(0, 50)}…${shown.slice(-39)}` : shown
}

// Returns a message for the model when the command breaks policy, undefined to fall back to the configured rules.
export function check(command: string): string | undefined {
  const problems = simpleCommands(command).flatMap((cmd) => {
    const hint = violation(cmd)
    return hint ? [`- \`${describe(cmd)}\`: ${hint}`] : []
  })
  if (!problems.length) return undefined
  const chained = /&&|;|\b(for|while|until)\s/.test(command)
    ? "\nIf this is a loop or `&&`/`;` chain, run the statements as separate parallel calls."
    : ""
  return `Shell call rejected by policy, nothing was run (the shell tool itself is enabled). Fix and resubmit:\n${problems.join("\n")}${chained}`
}

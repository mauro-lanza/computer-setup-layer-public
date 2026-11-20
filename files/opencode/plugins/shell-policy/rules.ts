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

type Rule = (cmd: Command) => string | undefined

interface Options {
  flags: Map<string, string | true>
  operands: string[]
}

const CD = "use the shell tool's `workdir` parameter instead of `cd`"
const READ = "use the `read` tool (offset/limit for line ranges)"
const PASS_HEREDOC = "pass the heredoc to the command directly, e.g. `git commit -F - <<'EOF'` or `gh pr create --body-file - <<'EOF'`"
const GLOB = "use the `glob` tool to list or find files"
const LS = "use `stat` for file metadata, the `glob` tool to list or find files (or `read` on a directory)"
const TAIL = "use the `read` tool (offset/limit; `wc -l` gives the line count for a tail)"
const GREP = "use the `grep` tool"
const EDIT = "use the `edit` tool (or `write` for a whole file)"
const SHELL_STDIN = "do not feed a script to a shell on stdin (pipe, heredoc, `-s`): write the commands as separate shell calls or run a script file"
const PS_ENVIRONMENT = "ps with the `e` flag shows other processes' environment; drop it"
const GH_API = "gh api is read-only here: GET requests only, no -f/-F/--input fields or graphql; ask the user or use a worker with approval for writes"
const BACKGROUND = "run it with the shell tool's background option instead of `&` and a log redirect"
const WORKTREE = "do not run `git worktree add`: use the `worktree_create` tool, which creates it in ../worktrees/<name> next to the repo (never in /tmp or the session temp dir)"

const GH_API_VALUE_FLAGS = new Set(["-H", "--header", "-q", "--jq", "-t", "--template", "--hostname", "--cache", "-p", "--preview"])
const PYTHON_WRITE = /write_text|write_bytes|open\([^)]*(?:,|mode\s*=)\s*["'][wax]/
const SCRIPT_WRITE = /writeFile|appendFile|createWriteStream|Bun\.write|File\.write|File\.open\([^)]*,\s*["'][wa]/
const MAX_COMMIT_WORDS = 25
const BODY_OK = /^Body-OK:\s*\S/m
const FILE_MESSAGE = /^\$\(\s*cat\s+([^\s<)'"$`][^\s)]*)\s*\)$/
const DYNAMIC: Word = { text: "", dirty: true }
const WRITE_REDIRECTS = new Set([">", ">>", ">|", "&>", "&>>"])
const NOT_FILES = new Set(["/dev/null", "/dev/stderr", "/dev/stdout", "/dev/tty"])

// Splits args into flags and operands; valueFlags lists the short flags that take a value, longValue the long ones.
function options(args: Word[], valueFlags: string, longValue: string[] = []): Options {
  const flags = new Map<string, string | true>()
  const operands: string[] = []
  for (let k = 0; k < args.length; k++) {
    const arg = args[k].text
    if (arg === "--") {
      operands.push(...args.slice(k + 1).map((w) => w.text))
      break
    }
    if (arg.startsWith("--")) {
      const [name, value] = arg.slice(2).split(/=(.*)/s)
      if (value !== undefined) flags.set(name, value)
      else if (longValue.includes(name)) flags.set(name, args[++k]?.text ?? "")
      else flags.set(name, true)
    } else if (arg.length > 1 && arg.startsWith("-")) {
      for (let j = 1; j < arg.length; j++) {
        const flag = arg[j]
        if (valueFlags.includes(flag)) {
          flags.set(flag, arg.slice(j + 1) || args[++k]?.text || "")
          break
        }
        flags.set(flag, true)
      }
    } else operands.push(arg)
  }
  return { flags, operands }
}

const always = (hint: string): Rule => () => hint
const readsFile = ({ redirects }: Command) => redirects.some((r) => r.op === "<")
const readsStdin = (cmd: Command) => (cmd.pipeIn && !cmd.xargs) || cmd.heredoc !== undefined || cmd.hereString

// The `cat *` glob also matches a bare `cat`, so every cat is rejected.
const cat: Rule = (cmd) => (options(cmd.args, "").operands.some((o) => o !== "-") || readsFile(cmd) ? READ : PASS_HEREDOC)
const nl: Rule = (cmd) => (options(cmd.args, "bdfhilnsvw").operands.length || readsFile(cmd) ? READ : undefined)

const headTail: Rule = (cmd) => {
  const { flags, operands } = options(cmd.args, "nc", ["lines", "bytes"])
  const follows = cmd.name === "tail" && ["f", "F", "follow"].some((k) => flags.has(k))
  return !follows && (operands.length || readsFile(cmd)) ? `${cmd.name} with a file: ${TAIL}` : undefined
}

const GREP_CONTEXT = ["regexp", "file", "max-count", "after-context", "before-context", "context"]
function grepLike(valueFlags: string, longValue: string[]): Rule {
  return (cmd) => {
    const { flags, operands } = options(cmd.args, valueFlags, longValue)
    const hasPattern = ["e", "f", "regexp", "file"].some((k) => flags.has(k))
    const files = operands.length - (hasPattern ? 0 : 1)
    const recursive = ["r", "R", "recursive"].some((k) => flags.has(k))
    return files > 0 || recursive || readsFile(cmd) || !readsStdin(cmd) ? GREP : undefined
  }
}
const grep = grepLike("efmABCdD", [...GREP_CONTEXT, "include", "exclude"])
const rg = grepLike("efmABCgtTjMrdE", [...GREP_CONTEXT, "glob", "type"])

function sedAwk(valueFlags: string, longValue: string[], scriptFlags: string[]): Rule {
  return ({ name, args }) => {
    const { flags, operands } = options(args, valueFlags, longValue)
    if (flags.has("i") || flags.has("in-place")) return `${name} in place: ${EDIT}`
    const files = operands.length - (scriptFlags.some((k) => flags.has(k)) ? 0 : 1)
    return files > 0 ? `${name} on a file: ${READ}` : undefined
  }
}
const sed = sedAwk("ef", ["expression", "file"], ["e", "expression", "f", "file"])
const awk = sedAwk("fvF", ["file", "assign", "field-separator"], ["f", "file"])
const perl: Rule = ({ args }) => (options(args, "eIMm").flags.has("i") ? `perl -i: ${EDIT}` : undefined)
const tee: Rule = ({ args }) => (options(args, "").operands.length ? `tee to a file: ${EDIT}` : undefined)
// The `sort *-o*` glob matches any argument containing -o, so the rule is as broad.
const sort: Rule = ({ args }) => (args.some((a) => a.text.includes("-o")) ? `sort -o writes a file: ${EDIT}` : undefined)

function inlineWrites(label: string, evalFlags: string, valueFlags: string, pattern: RegExp): Rule {
  return ({ args, heredoc }) => {
    const { flags } = options(args, valueFlags)
    const inline = evalFlags.split("").some((f) => flags.has(f)) || args.some((a) => a.text === "-") || heredoc !== undefined
    const body = (heredoc ?? "") + args.map((a) => a.text).join(" ")
    return inline && pattern.test(body) ? `inline ${label} that writes files: ${EDIT}` : undefined
  }
}
const python = inlineWrites("python", "c", "cmWX", PYTHON_WRITE)
const node = inlineWrites("script", "ep", "erI", SCRIPT_WRITE)

const shell: Rule = (cmd) => {
  const { flags, operands } = options(cmd.args, "")
  if (flags.has("s")) return SHELL_STDIN
  const fed = readsStdin(cmd) || readsFile(cmd)
  return fed && !flags.has("c") && operands.length === 0 ? SHELL_STDIN : undefined
}

const ps: Rule = ({ args }) => {
  for (let k = 0; k < args.length; k++) {
    const arg = args[k].text
    if (/^-[po]/.test(arg)) k += arg.length === 2 ? 1 : 0
    else if (/^-[A-Za-z]*[eE]/.test(arg) || /^[A-Za-z]*[eE][A-Za-z]*$/.test(arg)) return PS_ENVIRONMENT
  }
  return undefined
}

// gh api turns into a POST with -f/-F/--input; graphql needs -f too, so it is refused as well.
// Only the separate `-X GET` / `--method GET` form is allowed: the permission globs cannot tell the joined forms apart.
const ghApi: Rule = ({ args }) => {
  if (args[0]?.text !== "api") return undefined
  const fields: string[] = []
  for (let k = 1; k < args.length; k++) {
    const t = args[k].text
    if (t === "-X" || t === "--method") {
      if (args[++k]?.text !== "GET") return GH_API
    } else if (/^-X./.test(t) || t.startsWith("--method=")) return GH_API
    else if (t === "--input" || t.startsWith("--input=")) return GH_API
    else if (["-f", "-F", "--field", "--raw-field"].includes(t)) fields.push(args[++k]?.text ?? "")
    else if (/^-[fF]./.test(t)) fields.push(t.slice(2))
    else if (/^--(field|raw-field)=/.test(t)) fields.push(t.slice(t.indexOf("=") + 1))
    else if (GH_API_VALUE_FLAGS.has(t)) k++
  }
  return fields.length ? GH_API : undefined
}

const git: Rule = ({ args, heredoc }) => {
  let sub = -1
  for (let k = 0; k < args.length; k++) {
    const arg = args[k].text
    if (["-C", "-c", "--git-dir", "--work-tree"].includes(arg)) k++
    else if (!arg.startsWith("-")) {
      sub = k
      break
    }
  }
  if (sub < 0) return undefined
  if (["log", "diff", "show"].includes(args[sub].text) && args.some((a) => a.text.includes("--output"))) return `git ${args[sub].text} --output writes a file: ${EDIT}`
  if (args[sub].text === "worktree" && args[sub + 1]?.text === "add") return WORKTREE
  if (args[sub].text !== "commit") return undefined

  const messages: Word[] = []
  const rest = args.slice(sub + 1)
  for (let k = 0; k < rest.length; k++) {
    const arg = rest[k].text
    const file = arg === "-F" || arg === "--file" ? rest[++k]?.text : arg.startsWith("--file=") ? arg.slice(7) : /^-F(.+)$/s.exec(arg)?.[1]
    const short = /^-[A-Za-z]*m(.*)$/s.exec(arg)
    if (file !== undefined) messages.push(file === "-" && heredoc !== undefined ? { text: heredoc, dirty: false } : DYNAMIC)
    else if (arg === "--message" || short?.[1] === "") messages.push(rest[++k] ?? DYNAMIC)
    else if (arg.startsWith("--message=")) messages.push({ ...rest[k], text: arg.slice(10) })
    else if (short) messages.push({ ...rest[k], text: short[1] })
  }
  if (messages.length === 0) return undefined
  const fromFile = messages.map((m) => FILE_MESSAGE.exec(m.text.trim())).find(Boolean)
  if (fromFile) return `commit message read with cat: pass the file directly with \`git commit -F ${fromFile[1]}\``
  if (messages.some((m) => m.dirty)) return undefined

  const text = messages.map((m) => m.text).join("\n\n")
  if (BODY_OK.test(text)) return undefined
  const lines = text.split("\n").filter((l) => l.trim())
  const words = lines.join(" ").split(/\s+/).length
  const bullets = lines.filter((l) => /^\s*([-*•]|\d+[.)])\s/.test(l)).length
  if (lines.length <= 1 && words <= MAX_COMMIT_WORDS && bullets === 0) return undefined

  return (
    `commit message has ${lines.length} non-empty lines, ${words} words, ${bullets} bullet lines ` +
    `(limit: 1 line, ${MAX_COMMIT_WORDS} words, no bullets). Use a single -m with one imperative subject line, ` +
    `e.g. git commit -m "Add retry to upload step", and no body. If a reviewer could not infer something from the diff ` +
    `(breaking change, non-obvious migration), keep the body and end it with a line "Body-OK: <reason>"`
  )
}

const redirectWrites: Rule = ({ name, redirects, background }) => {
  const writes = redirects.some((r) => WRITE_REDIRECTS.has(r.op) && r.target && !NOT_FILES.has(r.target))
  if (writes && background) return `${name} in the background with a file redirect: ${BACKGROUND}`
  if (["echo", "printf", "cat"].includes(name) && writes) return `${name} redirected into a file: ${EDIT}`
  return undefined
}

const ALIASES = new Map([
  ["egrep", "grep"],
  ["fgrep", "grep"],
  ["ugrep", "grep"],
  ["python3", "python"],
  ["bun", "node"],
  ["ruby", "node"],
  ["bash", "sh"],
  ["zsh", "sh"],
])

const RULES = new Map<string, Rule>(Object.entries({
  cd: always(CD),
  cat,
  nl,
  bat: always(READ),
  less: always(READ),
  more: always(READ),
  ls: always(LS),
  tree: always(GLOB),
  find: always(GLOB),
  fd: always(GLOB),
  head: headTail,
  tail: headTail,
  grep,
  rg,
  sed,
  awk,
  perl,
  tee,
  sort,
  python,
  node,
  sh: shell,
  ps,
  gh: ghApi,
  git,
}))

// Returns the hint for the first rule the command breaks, undefined when it is fine.
export function violation(cmd: Command): string | undefined {
  return redirectWrites(cmd) ?? RULES.get(ALIASES.get(cmd.name) ?? cmd.name)?.(cmd)
}

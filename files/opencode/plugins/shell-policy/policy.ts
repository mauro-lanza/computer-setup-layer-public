export interface Word {
  text: string
  quoted: boolean
  dirty: boolean
}

export interface Stage {
  words: Word[]
  redirects: { op: string; target?: Word }[]
  heredoc?: string
  pipeIn: boolean
  nested: boolean
}

class Unparseable extends Error {}

const REDIRECT_OPS = ["<<<", "<<-", "&>>", "<<", ">>", "&>", ">&", ">|", "<&", ">", "<"]
const RESERVED = new Set(["if", "then", "else", "elif", "fi", "do", "done", "while", "until", "time", "!", "{", "}", "case", "esac"])

// Splits a shell command into simple commands, flattening $(...), backticks, subshells, case arms and heredocs.
// Throws Unparseable on anything it cannot follow with confidence.
export function parse(source: string): Stage[] {
  const stages: Stage[] = []
  let i = 0
  let nest = 0
  let loops = 0

  const fail = (reason: string): never => {
    throw new Unparseable(reason)
  }

  const list = (end: "" | ")"): void => {
    let stage: Stage | undefined
    let word: Word | undefined
    let redirectOp: string | undefined
    let pipeNext = false
    let functionName = false
    const cases: ("head" | "pattern" | "body")[] = []
    const heredocs: { delim: string; strip: boolean; stage: Stage }[] = []

    const current = (): Stage => {
      if (!stage) {
        stage = { words: [], redirects: [], pipeIn: pipeNext, nested: false }
        pipeNext = false
        stages.push(stage)
      }
      return stage
    }
    const append = (text: string, opts: { quoted?: boolean; dirty?: boolean } = {}) => {
      word ??= { text: "", quoted: false, dirty: false }
      word.text += text
      word.quoted ||= opts.quoted ?? false
      word.dirty ||= opts.dirty ?? false
    }
    const endWord = () => {
      if (!word) return
      const done = word
      word = undefined
      const target = current()
      if (cases.at(-1) === "head") {
        if (done.text === "in") cases[cases.length - 1] = "pattern"
        return
      }
      if (redirectOp !== undefined) {
        target.redirects.push({ op: redirectOp, target: done })
        redirectOp = undefined
      } else if (target.words.length === 0 && !done.quoted && done.text === "function") {
        functionName = true
        return
      } else if (functionName) {
        functionName = false
        return
      } else if (target.words.length === 0 && !done.quoted && RESERVED.has(done.text)) {
        if (done.text === "do") loops++
        else if (done.text === "done") loops = Math.max(0, loops - 1)
        else if (done.text === "case") cases.push("head")
        else if (done.text === "esac") cases.pop()
        return
      } else {
        // A reserved word shares its stage with the next command, so nesting is set when a word lands.
        target.nested = nest > 0 || loops > 0
        target.words.push(done)
      }
    }
    const endCommand = () => {
      endWord()
      if (redirectOp !== undefined) fail("redirect without target")
      stage = undefined
    }
    const readHeredocBodies = () => {
      for (const h of heredocs.splice(0)) {
        const lines: string[] = []
        for (;;) {
          if (i >= s.length) fail("unterminated heredoc")
          const eol = s.indexOf("\n", i)
          const line = s.slice(i, eol < 0 ? s.length : eol)
          i = eol < 0 ? s.length : eol + 1
          if ((h.strip ? line.replace(/^\t+/, "") : line) === h.delim) break
          lines.push(line)
        }
        h.stage.heredoc = lines.join("\n")
      }
    }
    const readHeredocDelimiter = (): string => {
      while (s[i] === " " || s[i] === "\t") i++
      let delim = ""
      while (i < s.length && !/[\s;|&<>()]/.test(s[i])) {
        const c = s[i]
        if (c === "'" || c === '"') {
          const close = s.indexOf(c, i + 1)
          if (close < 0) fail("unterminated quote")
          delim += s.slice(i + 1, close)
          i = close + 1
        } else if (c === "\\") {
          delim += s[i + 1] ?? ""
          i += 2
        } else {
          delim += c
          i++
        }
      }
      if (!delim) fail("heredoc without delimiter")
      return delim
    }
    // Appends a $(...) at s[i]; a bare `cat <<EOF` substitution resolves to its body, anything else stays raw and dirty.
    const substitution = (quoted: boolean) => {
      const start = i
      if (s.startsWith("$((", i)) {
        let depth = 0
        for (; i < s.length; i++) {
          if (s[i] === "(") depth++
          else if (s[i] === ")" && --depth === 0) break
        }
        if (i >= s.length) fail("unterminated arithmetic")
        i++
        append(s.slice(start, i), { quoted, dirty: true })
        return
      }
      i += 2
      const first = stages.length
      nest++
      list(")")
      nest--
      const inner = stages.slice(first)
      const only = inner.length === 1 ? inner[0] : undefined
      if (only && commandName(only) === "cat" && only.words.length === 1 && only.heredoc !== undefined) {
        append(only.heredoc.replace(/\n+$/, ""), { quoted })
      } else append(s.slice(start, i), { quoted, dirty: true })
    }
    const backticks = (quoted: boolean) => {
      let close = i + 1
      while (close < s.length && s[close] !== "`") close += s[close] === "\\" ? 2 : 1
      if (close >= s.length) fail("unterminated backtick")
      stages.push(...parse(s.slice(i + 1, close)).map((inner) => ({ ...inner, nested: true })))
      append(s.slice(i, close + 1), { quoted, dirty: true })
      i = close + 1
    }

    while (i < s.length) {
      const c = s[i]
      if (cases.at(-1) === "pattern") {
        // A quoted ")" inside a pattern is cut short here and then fails as an unbalanced paren.
        const arm = /^[\s;]*(?:(esac)(?=[\s;&|)]|$)|\(?[^)]*\))/.exec(s.slice(i)) ?? fail("unterminated case")
        i += arm[0].length
        if (arm[1]) cases.pop()
        else cases[cases.length - 1] = "body"
      } else if (c === " " || c === "\t") {
        endWord()
        i++
      } else if (c === "\n") {
        endCommand()
        i++
        readHeredocBodies()
      } else if (c === "#" && !word) {
        while (i < s.length && s[i] !== "\n") i++
      } else if (c === "\\") {
        if (i + 1 >= s.length) fail("trailing backslash")
        if (s[i + 1] !== "\n") append(s[i + 1], { quoted: true })
        i += 2
      } else if (c === "'") {
        const close = s.indexOf("'", i + 1)
        if (close < 0) fail("unterminated quote")
        append(s.slice(i + 1, close), { quoted: true })
        i = close + 1
      } else if (c === '"') {
        i++
        append("", { quoted: true })
        for (;;) {
          if (i >= s.length) fail("unterminated quote")
          if (s[i] === '"') break
          if (s[i] === "\\" && '$"\\`\n'.includes(s[i + 1] ?? "")) {
            if (s[i + 1] !== "\n") append(s[i + 1], { quoted: true })
            i += 2
          } else if (s.startsWith("$(", i)) substitution(true)
          else if (s[i] === "`") backticks(true)
          else if (s[i] === "$" && /[A-Za-z_{@*#?!0-9]/.test(s[i + 1] ?? "")) {
            append("$", { quoted: true, dirty: true })
            i++
          } else append(s[i++], { quoted: true })
        }
        i++
      } else if (c === "$" && s.startsWith("$(", i)) {
        substitution(false)
      } else if (c === "$" && /[A-Za-z_{@*#?!0-9]/.test(s[i + 1] ?? "")) {
        append("$", { dirty: true })
        i++
      } else if (c === "`") {
        backticks(false)
      } else if ((c === "<" || c === ">") && s[i + 1] === "(") {
        const start = i
        i += 2
        nest++
        list(")")
        nest--
        append(s.slice(start, i), { dirty: true })
      } else if (c === "<" || c === ">" || (c === "&" && s[i + 1] === ">")) {
        if (word && /^\d+$/.test(word.text) && !word.quoted) word = undefined
        else endWord()
        const op = REDIRECT_OPS.find((candidate) => s.startsWith(candidate, i))!
        i += op.length
        if (op === "<<" || op === "<<-") {
          heredocs.push({ delim: readHeredocDelimiter(), strip: op === "<<-", stage: current() })
        } else redirectOp = op
      } else if (c === "|" || c === ";" || c === "&") {
        endCommand()
        const two = s.slice(i, i + 2)
        if (two === "|&") {
          pipeNext = true
          i += 2
        } else if (two === "||" || two === "&&") i += 2
        else if (two === ";;" || two === ";&") {
          if (cases.at(-1) !== "body") fail("case terminator outside case")
          cases[cases.length - 1] = "pattern"
          i += 2
        } else {
          pipeNext ||= c === "|"
          i++
        }
      } else if (c === "(" && !word) {
        i++
        endCommand()
        nest++
        list(")")
        nest--
      } else if (c === ")") {
        if (end !== ")") fail("unbalanced paren")
        endCommand()
        i++
        if (heredocs.length) fail("heredoc pending at end of substitution")
        return
      } else if (c === "(" && /^\(\s*\)/.test(s.slice(i))) {
        // function definition `name() {`: drop the name; the body is parsed as ordinary commands
        word = undefined
        i += s.slice(i).match(/^\(\s*\)/)![0].length
      } else if (c === "(") {
        fail("unsupported paren")
      } else {
        append(c)
        i++
      }
    }
    if (end === ")") fail("unterminated substitution")
    if (cases.length) fail("unterminated case")
    endCommand()
    if (heredocs.length) fail("unterminated heredoc")
  }

  const s = source
  list("")
  return stages
}

interface Cmd {
  name: string
  args: Word[]
  stage: Stage
}

const WRAPPERS: Record<string, string> = { exec: "", nohup: "", time: "", builtin: "", command: "", nice: "n", timeout: "ks", sudo: "ugCDhprTU", env: "uCS", xargs: "nIPLdEsa" }
const LEADING_OPERAND = new Set(["timeout"])
const SHELLS = new Set(["sh", "bash", "zsh"])
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/

// Drops a wrapper's own flags, skipping the value of those that take one.
function skipFlags(words: Word[], valueFlags: string): Word[] {
  let k = 0
  while (k < words.length && words[k].text.startsWith("-") && words[k].text.length > 1) {
    const flag = words[k].text
    k += flag === "--" ? 1 : flag.length === 2 && valueFlags.includes(flag[1]) ? 2 : 1
    if (flag === "--") break
  }
  return words.slice(k)
}

function commandWords(stage: Stage): Word[] {
  let words = stage.words
  for (;;) {
    const first = words[0]
    if (first && !first.quoted && ASSIGNMENT.test(first.text)) words = words.slice(1)
    // `command -v x` only looks x up
    else if (first?.text === "command" && /^-p?[vV]/.test(words[1]?.text ?? "")) return words
    else if (first && Object.hasOwn(WRAPPERS, first.text)) {
      words = skipFlags(words.slice(1), WRAPPERS[first.text])
      if (LEADING_OPERAND.has(first.text)) words = words.slice(1)
    } else return words
  }
}

// xargs feeds the command arguments, not stdin, so a pipe into it is not a pipe filter.
const viaXargs = (stage: Stage) =>
  stage.words.slice(0, stage.words.length - commandWords(stage).length).some((w) => w.text === "xargs")

function commandName(stage: Stage): string | undefined {
  return commandWords(stage)[0]?.text.split("/").pop()
}

interface Options {
  flags: Map<string, string | true>
  operands: string[]
}

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

const MAX_COMMIT_WORDS = 25
const BODY_OK = /^Body-OK:\s*\S/m
const FILE_MESSAGE = /^\$\(\s*cat\s+([^\s<)'"$`][^\s)]*)\s*\)$/

const READ = "use the `read` tool (offset/limit for line ranges)"
const GLOB = "use the `glob` tool to list or find files"
const GREP = "use the `grep` tool"
const EDIT = "use the `edit` tool (or `write` for a whole file)"
const CD = "use the shell tool's `workdir` parameter instead of `cd`"
const WRITE_REDIRECTS = new Set([">", ">>", ">|", "&>", "&>>"])

const readsStdin = (stage: Stage) =>
  (stage.pipeIn && !viaXargs(stage)) || stage.heredoc !== undefined || stage.redirects.some((r) => r.op === "<<<")
const readsFileRedirect = (stage: Stage) => stage.redirects.some((r) => r.op === "<")

function headTail({ args, stage, name }: Cmd): string | undefined {
  const { operands } = options(args, "nc", ["lines", "bytes"])
  return operands.length || readsFileRedirect(stage) ? `${name} with a file: ${READ}` : undefined
}

function grepLike(valueFlags: string, longValue: string[]) {
  return ({ args, stage }: Cmd) => {
    const { flags, operands } = options(args, valueFlags, longValue)
    const hasPattern = ["e", "f", "regexp", "file"].some((k) => flags.has(k))
    const files = operands.length - (hasPattern ? 0 : 1)
    const recursive = ["r", "R", "recursive"].some((k) => flags.has(k))
    if (files > 0 || recursive || readsFileRedirect(stage) || !readsStdin(stage)) return GREP
    return undefined
  }
}

function sedAwk(valueFlags: string, longValue: string[], scriptFlags: string[], name: string) {
  return ({ args }: Cmd) => {
    const { flags, operands } = options(args, valueFlags, longValue)
    if (flags.has("i") || flags.has("in-place")) return `${name} in place: ${EDIT}`
    const files = operands.length - (scriptFlags.some((k) => flags.has(k)) ? 0 : 1)
    return files > 0 ? `${name} on a file: ${READ}` : undefined
  }
}

const always = (hint: string) => () => hint

const PYTHON_WRITE = /write_text|write_bytes|open\([^)]*,\s*["'][wax]/
const SCRIPT_WRITE = /writeFile|appendFile|createWriteStream|Bun\.write|File\.write|File\.open\([^)]*,\s*["'][wa]/

function inlineWrites(evalFlags: string, valueFlags: string, pattern: RegExp) {
  return ({ args, stage }: Cmd) => {
    const flags = options(args, valueFlags).flags
    const inline = evalFlags.split("").some((f) => flags.has(f)) || args.some((a) => a.text === "-") || stage.heredoc !== undefined
    const body = (stage.heredoc ?? "") + args.map((a) => a.text).join(" ")
    return inline && pattern.test(body) ? `inline ${evalFlags === "c" ? "python" : "script"} that writes files: ${EDIT}` : undefined
  }
}

const rules: Record<string, (cmd: Cmd) => string | undefined> = {
  cd: ({ stage }) => (stage.nested ? undefined : CD),
  cat: ({ args, stage }) => (options(args, "").operands.some((o) => o !== "-") || readsFileRedirect(stage) ? READ : undefined),
  bat: always(READ),
  less: always(READ),
  more: always(READ),
  ls: ({ args }) => {
    const { flags } = options(args, "")
    return flags.has("l") || flags.has("d") ? undefined : `${GLOB} (or \`read\` on a directory)`
  },
  tree: always(GLOB),
  find: ({ args }) => {
    const texts = args.map((a) => a.text)
    const inspects = texts.some((t) => /^-(newer|newer[acmBt]{2}|mtime|mmin|size|perm|empty)$/.test(t))
    const acts = texts.some((t) => /^-(exec|execdir|ok|okdir|delete|fprint|fprint0|fprintf|fls)$/.test(t))
    return inspects && !acts ? undefined : GLOB
  },
  fd: always(GLOB),
  head: headTail,
  tail: headTail,
  grep: grepLike("efmABCdD", ["regexp", "file", "max-count", "after-context", "before-context", "context", "include", "exclude"]),
  egrep: grepLike("efmABCdD", ["regexp", "file", "max-count", "after-context", "before-context", "context"]),
  fgrep: grepLike("efmABCdD", ["regexp", "file", "max-count", "after-context", "before-context", "context"]),
  rg: grepLike("efmABCgtTjMrdE", ["regexp", "file", "max-count", "after-context", "before-context", "context", "glob", "type"]),
  sed: sedAwk("ef", ["expression", "file"], ["e", "expression", "f", "file"], "sed"),
  awk: sedAwk("fvF", ["file", "assign", "field-separator"], ["f", "file"], "awk"),
  perl: ({ args }) => (options(args, "eIMm").flags.has("i") ? `perl -i: ${EDIT}` : undefined),
}

for (const name of ["python", "python3"]) rules[name] = inlineWrites("c", "cmWX", PYTHON_WRITE)
for (const name of ["node", "bun", "ruby"]) rules[name] = inlineWrites("ep", "erI", SCRIPT_WRITE)

function writesViaRedirect({ name, args, stage }: Cmd): string | undefined {
  const writes = stage.redirects.some((r) => WRITE_REDIRECTS.has(r.op) && r.target && r.target.text !== "/dev/null")
  if (["echo", "printf", "cat"].includes(name) && writes) return `${name} redirected into a file: ${EDIT}`
  if (name === "tee" && options(args, "").operands.length) return `tee to a file: ${EDIT}`
  return undefined
}

function commitProblem({ name, args, stage }: Cmd): string | undefined {
  if (name !== "git") return undefined
  let sub = -1
  for (let k = 0; k < args.length; k++) {
    const arg = args[k].text
    if (["-C", "-c", "--git-dir", "--work-tree"].includes(arg)) k++
    else if (!arg.startsWith("-")) {
      sub = k
      break
    }
  }
  if (sub < 0 || args[sub].text !== "commit") return undefined

  const messages: Word[] = []
  const rest = args.slice(sub + 1)
  for (let k = 0; k < rest.length; k++) {
    const arg = rest[k].text
    const short = /^-[A-Za-z]*m(.*)$/s.exec(arg)
    if (arg === "--message" || short?.[1] === "") messages.push(rest[++k] ?? { text: "", quoted: false, dirty: true })
    else if (arg.startsWith("--message=")) messages.push({ ...rest[k], text: arg.slice(10) })
    else if (short) messages.push({ ...rest[k], text: short[1] })
    else if (arg === "-F" || arg === "--file" || arg === "--file=-") {
      const target = arg === "--file=-" ? "-" : rest[++k]?.text
      messages.push(
        target === "-" && stage.heredoc !== undefined
          ? { text: stage.heredoc, quoted: true, dirty: false }
          : { text: "", quoted: false, dirty: true },
      )
    }
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

function stagesOf(command: string, depth: number): Stage[] {
  const stages = parse(command)
  if (depth >= 2) return stages
  for (const stage of [...stages]) {
    const words = commandWords(stage)
    if (words[0]?.text === "eval") stages.push(...stagesOf(words.slice(1).map((w) => w.text).join(" "), depth + 1))
    if (!words[0] || !SHELLS.has(words[0].text)) continue
    const c = words.findIndex((w) => /^-[a-z]*c$/.test(w.text))
    if (c >= 0 && words[c + 1]) stages.push(...stagesOf(words[c + 1].text, depth + 1))
  }
  return stages
}

// Returns a message for the model when the command breaks policy, undefined to fall back to the configured rules.
export function check(command: string): string | undefined {
  try {
    const problems: string[] = []
    for (const stage of stagesOf(command, 0)) {
      const words = commandWords(stage)
      const name = commandName(stage)
      if (!name) continue
      const cmd: Cmd = { name, args: words.slice(1), stage }
      const hint = writesViaRedirect(cmd) ?? commitProblem(cmd) ?? rules[name]?.(cmd)
      if (!hint) continue
      const shown = words.map((w) => w.text).join(" ").replace(/\s+/g, " ")
      // Keep the tail too: long commands often differ only in a trailing path.
      problems.push(`- \`${shown.length > 90 ? `${shown.slice(0, 50)}…${shown.slice(-39)}` : shown}\`: ${hint}`)
    }
    if (!problems.length) return undefined
    const chained = /&&|;|\b(for|while|until)\s/.test(command)
      ? "\nIf this is a loop or `&&`/`;` chain, run the statements as separate parallel calls."
      : ""
    return `Shell call rejected by policy, nothing was run (the shell tool itself is enabled). Fix and resubmit:\n${problems.join("\n")}${chained}`
  } catch {
    // Fail open on a command we cannot parse (e.g. a quoted ")" in a case pattern), except a `cd` in command position, which cannot be proven nested.
    return /(^|[;&|()\n])\s*cd\s/.test(command) ? `Shell call rejected by policy, nothing was run: ${CD}` : undefined
  }
}

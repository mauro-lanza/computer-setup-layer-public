import { tmpdir } from "node:os"
import { len, type Tool } from "./usage"

export type ShellClass =
  | "edit_via_shell"
  | "python_write"
  | "scratch_redirect"
  | "read_via_shell"
  | "search_via_shell"
  | "pipe_filter"
  | "cd_prefix"

const SCRATCH_REDIRECT_STATIC = ["/tmp", "/private/tmp", "/private/var", "/var/folders"]
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

export const shellCommand = (t: Tool) => t.input.command ?? ""

const stripHeredoc = (c: string) => c.replace(HEREDOC_ALL, (_, tag) => "<<" + tag)

function isScratch(path: string): boolean {
  return ([...SCRATCH_REDIRECT_STATIC, tmpdir()].some((p) => path.startsWith(p)) || path.startsWith("$")) && !path.startsWith("$HOME") && !path.startsWith("$PWD")
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

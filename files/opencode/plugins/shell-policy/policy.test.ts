import { expect, test } from "bun:test"
import { check } from "./policy"

const heredocCommit = (body: string) => `git commit -m "$(cat <<'EOF'\n${body}\nEOF\n)"`
const long = Array.from({ length: 30 }, (_, i) => `w${i}`).join(" ")

// [command, expected denial substrings; empty = allowed]
const cases: [string, string[]][] = [
  // legitimate
  ["git grep foo || true", []],
  ["ls-files", []],
  ['echo "a | b" && echo c', []],
  ["echo $(date) | wc -c", []],
  ["echo hi > /dev/null", []],
  ["make test 2>&1 > build.log", []],
  ["cat <<'EOF' | wc -l\none\ntwo\nEOF", []],
  ["echo 'cd /tmp; cat x' | wc -c", []],
  ["# cat x\necho ok", []],
  ["for f in a b; do echo $f; done", []],
  ["git commit --amend --no-edit", []],
  ['git commit -m "Add retry to upload step"', []],
  [heredocCommit("Add retry to upload step"), []],
  ["git commit -F - <<'EOF'\nFix flaky test\nEOF", []],
  ['git commit -m "$(date)"', []],
  ['git commit -m "$MSG"', []],
  ["git commit -F msg.txt", []],
  [heredocCommit("Drop v1 API\n\nBody-OK: breaking change reviewers need to know"), []],
  ["git commit -m 'unterminated", []],
  ["echo $(cat <<'EOF'\nno end", []],
  // banned
  ["cat README.md", ["`cat README.md`", "`read`"]],
  ["cat a b | wc -l", ["`read`"]],
  ["ls", ["`glob`"]],
  ["ls -R src | wc -l", ["`glob`"]],
  ["find . -name '*.ts'", ["`glob`"]],
  ["tree", ["`glob`"]],
  ["cd /tmp; ls", ["`workdir`", "`glob`"]],
  ["cd dir && make", ["`workdir`"]],
  ["(cd /tmp && make)", ["`workdir`"]],
  ["echo ok; cd x", ["`workdir`"]],
  ["head -n 5 file", ["head with a file", "`read`"]],
  ["tail -n 3 x.txt", ["`read`"]],
  ["head file < /dev/null", ["`read`"]],
  ["head -5 < file", ["`read`"]],
  ["git log | head -n 100", ["pipe filters"]],
  ["git log | tail -n +5", ["pipe filters"]],
  ["./scripts/check.sh 2>&1 | tail -n 8", ["pipe filters"]],
  ["git log | head -n 5", ["pipe filters"]],
  ["git diff | grep -c foo", ["pipe filters"]],
  ["git log --oneline | sed -n 5p", ["pipe filters"]],
  ["curl -s x | awk '{print $1}'", ["pipe filters"]],
  ["sed 's/a/b/' <<< abc", ["pipe filters"]],
  ["grep foo file", ["`grep`"]],
  ["grep -rn foo .", ["`grep`"]],
  ["rg foo", ["`grep`"]],
  ["grep foo", ["`grep`"]],
  ["git log | grep -e foo -m 3 file", ["`grep`"]],
  ["sed -i 's/a/b/' f", ["`edit`"]],
  ["sed -n '1,5p' file", ["`read`"]],
  ["perl -pi -e 's/a/b/' f", ["`edit`"]],
  ['echo "x" > f', ["`edit`", "`write`"]],
  ["echo x >> f", ["`edit`"]],
  ["printf x | tee out.txt", ["tee"]],
  ["cat <<'EOF' > f.txt\nhi\nEOF", ["`edit`"]],
  ["python3 - <<'PY'\nopen('a','w').write('x')\nPY", ["`edit`"]],
  ["bash -c 'cat x'", ["`read`"]],
  ["echo $(cat x)", ["`read`"]],
  ["echo `ls`", ["`glob`"]],
  ["FOO=1 cat x", ["`read`"]],
  ["/bin/cat x", ["`read`"]],
  ["ls | grep x", ["`glob`"]],
  // commit messages
  [heredocCommit("Add thing\n\nBody line here."), ["2 non-empty lines", "Body-OK"]],
  [heredocCommit("Add thing\n\n- one\n- two"), ["3 non-empty lines", "2 bullet"]],
  [`git commit -m "${long}"`, ["30 words"]],
  ['git commit -m "Add a" -m "More detail"', ["2 non-empty lines"]],
  ["git commit -am 'x\ny'", ["2 non-empty lines"]],
  ["git commit --message='x\ny'", ["2 non-empty lines"]],
  ["git commit -F - <<'EOF'\nFix thing\n\nlong body\nEOF", ["2 non-empty lines"]],
  ["git -C sub commit --amend -m 'a\nb'", ["2 non-empty lines"]],
  ["git add -A && git commit -m 'a\nb'", ["2 non-empty lines"]],
  [heredocCommit("Add thing\n\nBody-OK:"), ["2 non-empty lines"]],
]

for (const [command, expected] of cases) {
  test(`${expected.length ? "deny " : "allow"} ${JSON.stringify(command).slice(0, 80)}`, () => {
    const result = check(command)
    if (expected.length === 0) expect(result).toBeUndefined()
    else {
      expect(result).toBeDefined()
      for (const part of expected) expect(result).toContain(part)
    }
  })
}

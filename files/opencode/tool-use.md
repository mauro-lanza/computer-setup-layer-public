# Tool Use

Use the tool that exists. Do not reimplement it in bash, Python, or Node.

## File operations

| Task | Use | Not |
| --- | --- | --- |
| Read a file or list a directory | `read` (`offset`/`limit` for ranges) | `cat`, `head`, `tail`, `sed -n`, `awk`, `ls` |
| Edit a file | `edit` (`write` to replace wholesale) | `sed -i`, `perl -pi`, Python heredocs |
| Create a file | `write` | heredocs, `echo >`, `cat >` |
| Find files by name | `glob` | `find`, `ls -R` |
| Search file contents | `grep` | `grep`, `rg` via shell |

A shell one-liner looking faster is not a reason: the dedicated tools give
reviewable diffs, respect permissions and ignore rules, and fail loudly.

## Shell

Legitimate uses: `git`, `gh`, `make`, test runners, package managers, build tools,
and service CLIs (`bq`, `gcloud`, `terraform`, `docker`, `kubectl`). Passing a
commit or PR body on stdin (`git commit -F -`, `gh pr create --body-file -`) is
fine, as is `python -c` or `jq` to analyse CLI output.

Set `workdir` instead of prefixing `cd dir &&`.

A rejected shell call (`Shell call rejected by policy` or `Permission denied: shell`)
does not mean the shell tool is off. One banned command anywhere in the call, including after `|`, `;` or `&&`,
rejects the whole call: `cd`, `cat`, `head`, `tail`, `ls`, `tree`, `find`, `fd`,
`grep`, `rg`, `sed`, `awk`, `bat` (`git grep` is allowed). Follow the hint in the
message: drop the `| head`, use `workdir`, or use `read`, `glob` and `grep`.

## Scripts

A script is justified for a mechanical transform across many files (a repo-wide
rename, a codemod), because of the shape of the work, not the size of one edit.
Momentum, hand-rolled verification (`edit` already fails on a missing or ambiguous
match) and batching (tool calls run in parallel) are not reasons. Show the script,
then verify the result with `grep`/`read` rather than the exit code. For one to
three files, use `edit`.

## Side effects

- Reads through `gcloud`, `gh`, `bq` or `terraform plan` are fine when auth is
  already set up. Ask before anything that mutates remote state, runs a long job
  against shared data, or restarts a server or process.
- Never kill a process you did not start.
- A long or irreversible command that is not obviously correct gets a small test
  run first.

## Elsewhere

Prefer a specialised subagent or skill over ad-hoc exploration when one matches,
and the project's own entry points (`make test`, `prek`) over reconstructing the
command. When no tool fits, say so and explain what you are doing instead.

# Tool Use

Use the tool that exists. Do not reimplement it in bash, Python, or Node.

## File operations

Always use the dedicated tools:

| Task | Use | Never |
| --- | --- | --- |
| Read a file or list a directory | `read` (with `offset`/`limit` for ranges) | `cat`, `head`, `tail`, `sed -n`, `awk`, `ls` |
| Edit a file | `edit` (or `write` to replace wholesale) | `sed -i`, `python - <<'PY'`, `perl -pi` |
| Create a file | `write` | heredocs, `echo >`, `cat >` |
| Find files by name | `glob` | `find`, `ls -R` |
| Search file contents | `grep` | `grep`, `rg`, `ag` via bash |

This holds even when a shell one-liner looks faster. It is not a style
preference: the dedicated tools surface reviewable diffs, respect permissions
and ignore rules, and fail loudly instead of silently.

## Bash is for running things, not editing them

Legitimate uses: `git`, `gh`, `make`, test runners, package managers, build
tools, and service CLIs (`bq`, `gcloud`, `terraform`, `docker`, `kubectl`).
Passing a commit or PR body on stdin (`git commit -F -`, `gh pr create
--body-file -`) is fine, as is `python -c` or `jq` to analyse CLI output.

If a command's purpose is to read, search, or modify a file in the workspace,
it belongs in a tool call instead.

## Non-reasons for reaching for a script

- **Momentum.** Having already used a script earlier in the session is not a
  reason to keep using one.
- **Verification.** `edit` already fails when the target string is missing or
  ambiguous. A hand-rolled `assert old in s` duplicates that guarantee, and
  omitting it turns a failed match into a silent no-op that reports success.
- Batching is not one either: independent tool calls run in parallel.

## Narrow exceptions

A script is justified for genuinely mechanical transforms across many files —
a repo-wide rename, or a codemod. Two conditions:

1. Reach for it because of the shape of the work, not the size of one edit.
2. Show the script, then verify the result with `grep`/`read` rather than
   trusting the exit code.

For anything touching one to three files, use `edit`.

## Side effects

- Reads through `gcloud`, `gh`, `bq` or `terraform plan` are fine when auth is
  already set up. Ask before anything that mutates remote state, runs a long job
  against shared data, or restarts a server or process.
- Never kill a process you did not start.
- A long or irreversible command that is not obviously correct gets a small test
  run first.

## The same principle elsewhere

- Prefer a specialised subagent or skill over ad-hoc exploration when one
  matches the task.
- Prefer the project's own entry points (`make test`, `prek`) over
  reconstructing the underlying command.

When no tool fits, say so and explain what you are doing instead.

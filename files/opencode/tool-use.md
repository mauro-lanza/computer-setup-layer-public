# Tool Use

Use the tool that exists. Do not reimplement it in bash, Python, or Node.

## File operations

Always use the dedicated tools:

| Task | Use | Never |
| --- | --- | --- |
| Read a file | `read` (with `offset`/`limit` for ranges) | `cat`, `head`, `tail`, `sed -n`, `awk` |
| Edit a file | `edit` (or `write` to replace wholesale) | `sed -i`, `python - <<'PY'`, `perl -pi` |
| Create a file | `write` | heredocs, `echo >`, `cat >` |
| Find files by name | `glob` | `find`, `ls -R` |
| Search file contents | `grep` | `grep`, `rg`, `ag` via bash |
| List a directory | `list` | `ls` |

This holds even when a shell one-liner looks faster. It is not a style
preference: the dedicated tools surface reviewable diffs, respect permissions
and ignore rules, and fail loudly instead of silently.

## Bash is for running things, not editing them

Legitimate uses: `git`, `gh`, `make`, test runners, package managers, build
tools, and service CLIs (`bq`, `gcloud`, `terraform`, `docker`, `kubectl`).

If a command's purpose is to read, search, or modify a file in the workspace,
it belongs in a tool call instead.

## Non-reasons for reaching for a script

- **Batching.** Independent tool calls run in parallel in a single message.
  Several `edit` calls are not slower than one script, and each is reviewable.
- **Verification.** `edit` already fails when the target string is missing or
  ambiguous. Hand-rolled `assert old in s` duplicates a guarantee you already
  have — and omitting it turns a failed match into a silent no-op that reports
  success.
- **Momentum.** Having already used a script earlier in the session is not a
  reason to keep using one.

## Narrow exceptions

A script is justified for genuinely mechanical transforms across many files —
a repo-wide rename, or a codemod. Two conditions:

1. Reach for it because of the shape of the work, not the size of one edit.
2. Show the script, then verify the result with `grep`/`read` rather than
   trusting the exit code.

For anything touching one to three files, use `edit`.

## The same principle elsewhere

- Prefer a specialised subagent or skill over ad-hoc exploration when one
  matches the task.
- Prefer an MCP tool or documented CLI over scraping or hand-rolled HTTP.
- Prefer the project's own entry points (`make test`, `make lint`) over
  reconstructing the underlying command.

When no tool fits, say so and explain what you are doing instead.

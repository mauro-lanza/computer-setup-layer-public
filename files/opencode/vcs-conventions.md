# Commits and PRs

## Repo conventions win

- If the repo has its own commit or PR convention (ticket prefix, Conventional
  Commits, PR template), follow it. Check `git log`, the template and the repo's
  AGENTS.md first.

## Commit messages

- One line, imperative mood, summarising the overall change. No body, no
  bullet lists, no explanation of reasoning.
- Only add a body when a commit does something a reviewer could not infer
  from the diff (a breaking change, a non-obvious migration step).
- Never commit scratch or migration scripts, logs or generated output unless asked.
- The shell hook enforces at most 25 words, no bullets, and a body only when it
  ends with a `Body-OK: <reason>` line.

## Branches

- Names follow the tracker's generated form, ticket key first
  (`DATA-123-short-slug`). Use the key from the user or the current branch; never
  invent one.
- One concern per branch and PR. If the work splits, propose the split instead of
  bundling.

## Staging

- Leave changes unstaged unless asked to stage. If the user staged changes to
  review, keep further edits unstaged so they can diff them.
- Do not commit, push, tag or merge unless asked.

## PR descriptions

- Short and direct: what changed, in a few lines. Skip restating the diff,
  narrating the exploration process, justifying each decision, or repeating the
  commit list.
- Only call out context the reviewer cannot get from the diff: breaking
  changes, follow-up work, or a link to the issue/ticket.
- After further commits, refresh the description from the full diff against base,
  not the last commit, and re-check facts (flags, thresholds, behaviour) in code.

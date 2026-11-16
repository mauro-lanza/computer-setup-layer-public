---
name: pr-review
description: Use when reviewing someone else's PR, branch or code (a colleague or junior, often AI-assisted) to annotate it with inline review notes and prepare the discussion with the author. Never changes the code.
---

# PR Review

Review another person's work so they learn from it, not to rewrite it. The output
is inline notes in the user's voice plus a short themes summary to open the
discussion. The checklist is shared with `repo-review`: read
`../repo-review/references/criteria.md` and `../repo-review/references/anti-patterns.md`.
Style rules live in the global `code-style.md` and `workflow.md`; the reasoning
behind them, for judging trade-offs, is in `engineering-handbook.md`.

## Invocation

- **target:** a PR (number or URL) plus an optional path inside it, or a path to a
  local checkout of the branch. A local checkout widens the scope: notes may go on
  files the PR does not touch.
- **marker:** the user's note marker, default `# REVIEW_NOTE:`, written in the
  comment syntax of each file.
- Review the target in isolation. Look at sibling code only to learn a repo
  convention (does any other workload have an `__init__.py`?), never to grade
  against it.

## Workflow

1. **Orient.** For a PR: `gh pr view`, `gh pr diff`, the linked ticket. Read the
   target's README and config. Read the user's existing notes first: they set the
   voice, the depth and their vision. Take a position on each one (agree, partly,
   disagree), do not just echo it.
2. **Map.** Read the whole target and describe its shape back in a few lines: the
   entry point, the steps in order, the data passed between functions, where config
   and env vars are read. Wait for the user before writing notes.
3. **Review** against the criteria, correctness first. Lenses that pay off on
   AI-assisted code:
   - Does the structure fit the size? Modules that read each other's dicts, paths
     or env vars are one module. A short single-purpose script is one file.
   - Does the entry point read as the plan, each step one call, with the details in
     the functions? Warn against the opposite overcorrection as well.
   - Is data passed between functions typed, with dicts only where it is written
     as JSON? Is a value returned only so the caller can dig it back out? Are
     arguments mutated?
   - Custom machinery (generic helpers, defensive parsing, wrapper classes) with
     one caller, where the standard library or a parameter does the job.
   - Edge cases that are accidents rather than decisions: input that becomes a
     path, switching modes on the same data, partial failures.
   - Failure modes that actually happen: timeouts, kills, retries. Anything needing
     manual recovery needs detection or an alert.
   - Every comment, docstring and README claim checked against the code and the
     deployment.
   - Where future generalisation is expected: cheap seams (config at the top,
     explicit arguments) instead of modules or helpers built ahead of time.
4. **Verify against reality.** Evidence outranks reading.
   - Library behaviour: read the installed source, cite `path:line`. If the venv is
     missing or stale, sync it (a worker runs `uv sync` or the repo equivalent).
   - Deployed code: read-only logs, metrics and executions. Measure resource
     concerns instead of guessing; trace incidents (a stale lock, a timeout) back to
     the code that caused them.
   - Deployment and orchestration in other repos (infra, scheduler, DAG): what is
     actually deployed and scheduled, on which branch, versus what the docs claim.
5. **Second opinion.** Send an independent reviewer (Opus) the code, the notes and
   the user's values. It returns agree, partly or disagree per note, plus missed
   findings ranked with bugs separate from style. Re-verify its claims before
   adopting them.
6. **Annotate.**
   - Write in the user's voice, learned from their notes: tone, casing, hedges,
     length. Typically one point and one suggestion in one to three lines.
   - Each note says why, so the author learns the principle, not just the fix.
   - Keep dates, counts and file paths for the summary, not the note.
   - One note per point; a later note builds on an earlier one instead of
     repeating it.
   - When new evidence changes a note, soften or correct it rather than delete it.
   - Edit the user's own notes, or the author's code comments, only when asked.
   - Only comment lines change. Check with `git diff -U0` on the target.
7. **Summarise.** A shareable themes list to open the discussion:
   - Open with what the code does well.
   - Each theme is a principle plus its example from this code; bugs and
     operations issues as their own themes.
   - Questions that need a product or team decision (time zones, retry policy) go
     in a separate list for the meeting, not in the code.
   - End with a pointer to the inline notes.

## Rules

- Never change code, stage, commit or post PR comments unless asked. Posting is a
  remote change; when asked, post the notes as `file:line` review comments with
  `gh`.
- Scale the suggested design to the task. Name the trap of overcorrecting next to
  the fix.
- Rank findings; bugs before style. Do not flag what the repo's conventions settle.
- Keep the evidence in the chat; the notes stay short.

---
name: repo-review
description: Use when asked to review, clean up, simplify, declutter, restructure or dedupe a repo, folder, file or diff. Reports first; changes only after approval.
---

# Repo Review

Judge whether the structure earns its place: pretty is not the test, functional is.
This skill is the procedure and the checklist. Style rules live in the global
instruction files (`code-style.md`, `workflow.md`) when installed; the repo's own
conventions and recorded decisions override both.

## Invocation

`<target>` is a path, or a diff scope: `staged`, `unstaged`, `branch` (vs base).
Default is the whole target.

- **mode:** `review` (steps 1-5, then stop), `plan` (adds step 6, then stop),
  `apply` (step 7 on an approved plan). Default: `plan`.
- **focus:** optional, one or more of `dead-code`, `structure`, `comments`, `docs`,
  `naming`, `tooling`. Default: all, in that priority.

If the user gave constraints or non-goals, they override everything below.

## Workflow

1. **Orient.** Read the target's AGENTS.md, README and config, then its siblings.
   Learn the local conventions before judging; they win over this checklist.
   Skip vendored, generated and submodule trees. State scope and non-goals in one
   line; ask only if unclear.
2. **Measure.** Count lines, files, references and callers. Find the real
   consumers of anything you might move or delete (`grep`, `git log`). Run the
   repo's gate for a baseline only if it is non-mutating or has a check mode;
   otherwise skip it and say so. On a large repo, read the docs and entry points fully,
   sample repeated or generated files, and state the sample.
3. **Review.** Walk `references/criteria.md`, following the review rules in
   `workflow.md`.
4. **Re-verify** each finding per `workflow.md`.
5. **Report** in the format of `references/report-template.md`. Stop.
6. **Plan.** For restructures give 2-3 options with a before/after tree, the
   blast radius (references, generated files, CI, docs) and a recommendation.
   Wait for the choice.
7. **Apply** in phases, each ending with the gate green and docs updated:
   - Behaviour-preserving moves and renames get their own step, with proof (no-op
     plan, tests, byte-identical output).
   - One rule per step when applying consistency rules.
   - After moves, grep for stale references: docs, CI, editor config, generated
     files, old names.
   - Leave all edits unstaged. Never commit, push or stage unless asked.
8. **Close.** Verdict, what changed, what was deliberately not touched, one open
   question at most. Quantify (files, lines before and after).

## Rules of engagement

- Stay in scope. Out-of-scope findings go in a separate list; never fix them.
- Default to deleting. Adding is the last resort and needs a named consumer.
- Do not add custom machinery when a standard tool or an existing helper does it.
- Do not decouple independent deployables to share code.
- Do not flag choices that are convention in this repo (version suffixes, type
  ignores already standard) or recorded as decisions in its docs, even when they
  break a rule in `criteria.md` (e.g. load-bearing comments in config). List them
  as "dropped: settled" in the report.
- Rank findings by impact. Doc drift that misleads readers outranks a cosmetic
  code nit, whatever its category.
- Unique rationale in a doc you are cutting moves to where it belongs; it is not
  deleted. Check the pointer resolves.
- Challenge the framing when the evidence says so, and concede plainly when wrong.
- Before fixing, confirm each finding is a real issue; group them for approval.
- Never print secrets. Check `git status` for credential files before reporting.
- Tooling you add is enforced mechanically (pre-commit, CI), not by documentation.
  Test new checks by breaking the thing they guard and seeing them fail.

## References

- `references/criteria.md`: the ranked checklist with the reason for each item.
- `references/anti-patterns.md`: what goes wrong in reviews; read before reporting.
- `references/layouts.md`: per-stack layout preferences and their confidence.
- `references/report-template.md`: output formats.

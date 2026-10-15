# Code Style

Simplicity is well-implemented complexity, not less capability. Never trade
correctness for brevity.

## Structure

- Fewer files and a clean root are the default. A module earns its own file when
  it has a name you would use in a sentence and more than one or two things in
  it. Otherwise fold it into its only caller. Merge near-duplicates; extract
  only what is duplicated across files.
- A helper with one call site should be inlined, unless naming it is what makes
  the caller readable.
- Put a constant next to its only user, not in a shared bucket.
- Names say what the thing does. Drop a parent's name only when the path already
  makes it unambiguous; otherwise be descriptive over short.

## Follow the repo

- Match the patterns already in the repo before introducing a better one. A
  cleaner construct that differs from its neighbours is added complexity.
- Keep a change inside the scope asked. Do not touch other modules, jobs or
  workloads; list what you noticed instead.
- Shared config (linters, formatters, hooks) lives once at the repo root, not per
  package. Dependencies go in the project's manifest.

## Complexity

- No speculative generality: no config knob, parameter, abstraction or extension
  point with a single value or single caller. Add it when the second case arrives.
- Close the interface. Prefer a required argument, a narrow type and no default
  over an optional one with a fallback. Type values as tightly as the data allows.
- No defensive handling for states that cannot occur. A test environment is not a
  reason for cleanup, migration or fallback code.
- Delete dead options, unused fields and superseded approaches outright. Version
  control is the history.
- Complexity that reflects the problem stays. Complexity that reflects indecision,
  a past design, or an anticipated future goes.

## Comments and docstrings

- Comment the *why*, never the *what*. If the code already says it, say nothing.
- Reserve a paragraph for genuinely non-obvious invariants: ordering constraints,
  race conditions, misbehaving APIs, or a deliberate deviation from the obvious
  implementation. Everything else gets one line or none.
- Docstrings: one line on what it does and what it returns. Extend only for the
  caller's contract or subtle failure modes. Skip entirely when the signature is
  self-evident. A docstring longer than the function body is a smell.
- Re-read your own comments before finishing; they come out long. Cut each to the
  why.
- No restating types, no decorative banners, no changelog or history in comments.
- A comment that a refactor would silently make wrong should not have been written.
- Rationale lives in exactly one place. Do not repeat it across code, README and
  design docs.

## Config and docs files

- YAML, TOML and similar config carry no prose comments. Use the format's
  `description` field if it has one; otherwise one short line at most.
- Docs state how it works now, not how it got there: no history, jargon or filler
  sections. When a doc grows, dedupe and split by topic rather than append.

## Refactoring

- Preserve behaviour unless removing it was the point. Verify it, do not assume it.
- Terse rewrites are where edge cases die. Re-check null/empty/missing handling in
  every condition you compress.

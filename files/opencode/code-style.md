# Code Style

Simplicity is well-implemented complexity, not less capability. Never trade
correctness for brevity. The reasoning and worked examples behind these rules
are in `engineering-handbook.md`, next to this file.

## Structure

- Fewer files and a clean root are the default. A module earns its own file when
  it owns a concern its callers can use without knowing how it works (a file
  format, a protocol), or when more than one consumer imports it. Modules that
  depend on each other's internals (dict shapes, paths, env vars) belong in one.
  A single-purpose script stays one file: constants and types first, then
  functions in the order they run, `main` last. Merge near-duplicates. Extract
  when the abstraction is plug and play: usable from its name alone, hiding one
  decision, with no flags to fit callers. Otherwise keep the code inline.
- The entry point reads as the plan: the steps in order, each a single call. It
  owns the order; the functions own the details. Pass each function the values it
  needs, not the whole parsed input.
- Read env vars and settings once, at the entry point or the top of the file, not
  at import time across modules.
- A helper with one call site should be inlined, unless naming it is what makes
  the caller readable.
- Constants go together at the top of the file that uses them, not in a shared
  bucket and not above a function deep in the file.
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
- Values passed between functions are typed; dicts only where data is serialised
  (JSON, API payloads). Return what the caller needs, not an object it has to
  unpack. Do not mutate arguments.
- No defensive handling for states that cannot occur. A test environment is not a
  reason for cleanup, migration or fallback code. Untrusted input is validated
  once where it enters (CLI, external data, names that become paths), then
  trusted.
- Prefer the standard library over custom machinery, and check its actual
  behaviour in the source before relying on it.
- Design for the failures that actually happen (timeouts, kills, retries).
  Anything that needs manual recovery also needs detection or an alert.
- Delete dead options, unused fields and superseded approaches outright. Version
  control is the history.
- Complexity that reflects the problem stays. Complexity that reflects indecision,
  a past design, or an anticipated future goes.

## Comments and docstrings

- Comment the *why*, never the *what*. If the code already says it, say nothing.
  No restating types, decorative banners, or changelog and history in comments.
- Reserve a paragraph for genuinely non-obvious invariants: ordering constraints,
  race conditions, misbehaving APIs, or a deliberate deviation from the obvious
  implementation. Everything else gets one line or none.
- Docstrings: one line on what it does and what it returns. Extend only for the
  caller's contract or subtle failure modes. Skip entirely when the signature is
  self-evident. A docstring longer than the function body is a smell, except in
  code written to teach an idea (an algorithm, a domain model), where it carries
  the idea the code depends on.
- Re-read your own comments before finishing; they come out long. Cut each to the
  why.
- A comment that a refactor would silently make wrong should not have been written.
- Rationale lives in exactly one place. Do not repeat it across code, README and
  design docs.

## Config and docs files

- YAML, TOML and similar config carry no prose comments. Use the format's
  `description` field if it has one; otherwise one short line at most.
- Docs state how it works now, not how it got there or what is planned: no
  history, roadmaps, jargon or filler sections. When a doc grows, dedupe and split
  by topic rather than append.

## Refactoring

- Preserve behaviour unless removing it was the point. Verify it, do not assume it.
- Terse rewrites are where edge cases die. Re-check null/empty/missing handling in
  every condition you compress.

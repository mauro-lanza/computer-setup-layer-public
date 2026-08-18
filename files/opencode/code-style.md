# Code Style

Simplicity is well-implemented complexity, not less capability. Never trade
correctness for brevity.

## Structure

- Group by concern, not by file count. A module earns its own file when it has a
  name you would use in a sentence and more than one or two things in it.
  Otherwise fold it into its only caller.
- A helper with one call site should be inlined, unless naming it is what makes
  the caller readable.
- Keep the import graph acyclic and one-directional. Shared types and constants
  live in a leaf that imports nothing from the project.
- Put a constant next to its only user, not in a shared bucket.
- Context comes from the path. Inside a well-named module or directory, generic
  names are better than restating the parent's name.

## Complexity

- No speculative generality: no config knob, parameter, abstraction or extension
  point with a single value or single caller. Add it when the second case arrives.
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
  self-evident.
- No restating types, no decorative banners, no changelog or history in comments.
- A comment that a refactor would silently make wrong should not have been written.
- Rationale lives in exactly one place. Do not repeat it across code, README and
  design docs.

## Refactoring

- Preserve behaviour unless removing it was the point. Verify it, do not assume it.
- Terse rewrites are where edge cases die. Re-check null/empty/missing handling in
  every condition you compress.
- Say what you removed and why.

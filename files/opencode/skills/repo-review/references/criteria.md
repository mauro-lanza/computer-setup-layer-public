# Criteria

Ranked: earlier items are reported first and weigh more. Each bullet is
a question to ask, then the reason. The standards behind them are in
`engineering-handbook.md` (§ numbers below); this list adds only what a review
must check on top.

## 1. Correctness

- Does it do what it claims? Trace each line; treat comments, docs and tests as
  hypotheses. Bugs go first, by severity.
- Do tests assert behaviour, or only mocks and generated text? Tests that rot are
  worse than none; keep contract tests, drop brittle ones.

## 2. Does it earn its place? (deletion)

Every file, folder, option, pin, config and abstraction must justify itself
(handbook §1, §3 "Toward less structure").

- Dead options, unused fields, superseded approaches, legacy and back-compat
  paths with no second consumer.
- Knobs, parameters or extension points with one value or one caller.
- Helpers with one call site that add a hop without adding a name worth having.
- Retries, caches, guards and validators for states or schemas nobody has.
- Ceremony: empty `__init__.py`, placeholder files, one-file category folders,
  `common`/`utils`/`misc` drawers, per-unit copies of root-level config.
- Custom machinery that an existing package, tool, or in-repo helper covers.
- Split by cause before deleting: misplaced content moves; too much content goes.
- Keep, and note why in the file, anything that looks removable but is used.

## 3. Single source of truth

- Fact, constant, list or rule defined in two places. Docs restating what a glob
  or pattern already covers.
- Near-identical files: collapse via config data plus a factory, unless each is an
  independent deployable (then keep them separate; isolation is the feature).
- Generated files: marked, guarded by a drift check, separate from hand-edited
  ones.
- Dependencies in the canonical manifest, not ad hoc.

## 4. Structure that is functional

Ask what each layer buys: isolation, discoverability, stable external IDs, build
or deploy triggers, permissions. If it buys nothing, flatten it. Each structural
finding names its slider (handbook §4), the force present in the code now, and
the signal that would move it back; with no force, the §5 defaults apply.

- Group by concern and lifecycle, not by category or mechanism.
- Colocate: config next to what it configures, helpers next to their only
  consumer; shared ones in one named place.
- Root holds only what tooling requires there; governance config (lint, hooks,
  ignore) lives once at the root.
- Public surface minimal (`_` prefix unless imported elsewhere).
- Modules that depend on each other's internals (dict shapes, paths, env vars)
  belong in one.
- Acyclic, one-directional imports.
- Names stable where something outside the repo references them (DAG ids,
  resource addresses, image paths).
- Justify any move with usage counts and real consumers, never with "tidier".
- Prefer the layout that leaves existing mechanisms (globs, load order, derived
  paths) untouched.
- Enforce ordering and uniqueness rules mechanically, not by prose.

## 5. Interfaces

Handbook §5 "Data and state", "Interfaces" and "Boundaries and errors". Also:

- Derive values instead of passing them.
- Data over code: flat schemas, defaults as a constant merged with overrides.
- Config values required, no hidden fallbacks.

## 6. Naming

- Short, predictable, descriptive when the path is ambiguous; no redundant
  prefixes or repeated parent names.
- One vocabulary along a pipeline; rename the concept, not just the symbol.
- Rename sweeps are complete: grep every spelling, case, plural and generated copy.
- No junk-drawer names.

## 7. Comments and docstrings

Handbook §5 "Comments and docs"; agent-specific rules in `code-style.md`.

- Sweep the whole pattern across all files, not just the quoted example.

## 8. Docs

Handbook §5 "Comments and docs"; `code-style.md` for config files.

- Consistency pass after any rename, across docs and generated copies.

## 9. Tooling and gates

- One documented gate (`make lint|test`, or the repo equivalent) that CI also runs.
- Pins and versions declared once.

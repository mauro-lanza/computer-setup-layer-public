# Report formats

Terse. Verdict first. No narration of the exploration.

## Review report

```
Verdict: <one or two sentences: state of the target, biggest lever>
Scope: <what was reviewed: paths, diff scope> | Not reviewed: <vendored, other repos>
Baseline: <gate result, size in files/lines>

| # | Pri | Type | Finding | Where | Evidence | Fix | Effort |
|---|-----|------|---------|-------|----------|-----|--------|

Pri: must / should / nice, ordered by impact. Type: bug, delete, structure,
naming, docs, tooling. Gate not run or partly run: say so in Baseline.
Dropped after re-verification: <n>, <one line why>; settled-by-repo: <list>
Pre-existing vs introduced: <split, for diffs and PRs>
Out of scope (not touched): <list>
```

For PR reviews, give the table as file:line comments instead.

## Restructure options

```
Blast radius: <references, generated files, CI, docs, external ids>

Option A: <name>   Option B: <name>   [Option C]
<before/after tree for each; one line on what each buys and costs>

Recommendation: <option and why, one or two lines>
Phases: <batches, each ending with the gate green>
```

Then wait for the user's choice.

## Close-out

```
Changed: <per file or folder, what moved or was removed; before -> after counts>
Verified: <gate output, plan diff, stale-reference grep>
Deliberately not touched: <list and why>
Open question: <at most one>
```

Edits stay unstaged. Offer a one-line commit message and, if a PR exists, a
refreshed short description.

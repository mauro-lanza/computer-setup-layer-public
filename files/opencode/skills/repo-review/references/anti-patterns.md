# Anti-patterns

Observed failures in past reviews. Check the report against this list.

## Judgement

- Proposing a layout before finding who uses the code.
- Justifying a placement by mechanism ("it shells out") instead of purpose.
- Introducing a cleverer idiom in one place only, or in a PR scoped to something
  else (loops where siblings are explicit; DRY abstractions that add flags).
- Speculative abstractions, validators for schemas nobody uses, command-builder
  helpers, defensive guards against user error.
- Decoupling self-contained scripts to share code.
- Building or adding something before checking whether an existing package or
  helper does it, or whether it fits.
- Copying the layout of a repo that lags behind this one.
- Agreeing too easily. Take a position and back it with evidence.
- Flagging a problem and leaving it without a recommendation.
- Re-arguing a decision the user already made.

## Verification

- Reading instead of running. Run the gate; test failure paths too.
- Claiming a benchmark or result without saying how it was measured.
- Reporting unverified findings; a large share do not survive re-checking.
- A first pass that is incomplete, so "check again" finds more. Finish the pass.
- Incomplete rename or move sweeps (docs, CI, generated files, editor config).
- Relying on a docstring or comment as evidence of behaviour.

## Scope and process

- Fixing the quoted example instead of the whole pattern when the request names a
  pattern.
- Fixing before confirming that findings are real.
- Overwriting an existing file (AGENTS.md, config) without reading it first.
- Killing a process or server the user started.
- Sessions with no stop condition drift for hundreds of messages. State what
  "done" is up front and stop there.

## Output

- Essay comments and docstrings added by the review itself.
- Leaving review rationale or history in code or docs.
- Echoing secrets while "redacting" them.
- Hiding a negative result. State what was not done and why.

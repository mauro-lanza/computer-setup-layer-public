# Layouts by stack

Starting points, not rules. The repo's existing layout wins; use these when
proposing options. Confidence reflects how much history backs each stack.

## Python services and jobs (high)

- Each job or service: `src/`, Dockerfile and `pyproject.toml` side by side.
  `pyproject.toml` is the single source for version, dependencies and dev tooling;
  lockfile committed.
- One shared multi-stage Dockerfile per kind of target.
- Registry or deploy path derived from the folder path, not configured twice.
- Lint, type-check and hook config once at the repo root.
- Config: required values, no defaults, derived values as properties, CLI args
  override env.
- Strong typing (strict checker), typed structures over loose dicts.
- Builds are gated so untouched jobs do not show up as skipped.

## Airflow DAG repos (high)

- `dags/<domain>/<pipeline>/` with `helpers/` (frozen-dataclass config per
  environment, environments module importable without Airflow, DAG factory),
  `tasks/`, and a README. Shared task groups live in `dags/<domain>/dependencies/`.
- One entry file per environment, a few lines calling the register function, so an
  import error stays isolated. Explicit `dag_id` kept stable; no version suffixes.
- Table or job lists in YAML grouped by schedule, sorted, group names unique; the
  rule is enforced by a hook, not documentation.
- One gate (`make lint`, `make test`, `make test-dags`); `AIRFLOW_HOME` exported
  once in the Makefile, repo-local and gitignored. Scratch work in a gitignored
  folder.

## Terraform / IaC (high)

- Keep explicit per-resource blocks unless the repo already uses loops. `locals`
  for repeated literals are welcome.
- Split large resource files per principal, environment or service; sort lists
  whose order is arbitrary. Keep resource addresses unchanged: a restructure must
  produce a zero-diff plan.
- Same naming across dev, uat and prod.
- Remove credentials that impersonation or workload identity replaced.
- Related resources (a secret and its accessors) defined together, from YAML where
  the repo does so, with defaults as a constant merged with extras.
- Gate: `fmt`, `validate`, `plan`.
- When moving a YAML or a project template, grep every reference across repos.

## dbt / SQL (medium)

- Everything dbt under one `dbt/` folder (models, groups, tests, macros, exposures,
  sources); `dbt_project` and packages stay at the root; linter config inside the
  dbt folder.
- One declaration file per data product plus its docs, in the product's folder;
  exposures, sources and data products as top-level siblings. Groups and config are
  not kept in the models folder.
- Machine-managed sections marked and edited non-destructively; custom non-dbt
  files go in `.dbtignore`.

## Scripts and tooling (medium)

- Scripts in role folders (`lib/`, `checks/`), no `__init__.py` unless proven
  necessary. Makefile `.PHONY` next to each target. Dev dependencies declared.
- Prefer the simplest Python version the tooling supports.

## Provisioning / Ansible / shell (medium)

- Declared and tracked is clean, for things the tool owns; do not police what it
  doesn't own.
- Anything that is only "place a file" is data, not code.
- Numbered load-order prefixes with no duplicates; shellcheck waivers inline with
  a reason, never global.
- Gate every change; phase large cleanups into batches, each ending green.

## Embedded / hardware (low)

- Treat comments, docs and tests as hypotheses when auditing.
- Handoff plans split into a folder: work doable now versus work needing the
  device, with references and rationale.
- Reference material as submodules; docs reflect reality.

## Docs and meta files (high)

- AGENTS.md holds repo conventions; global style is referenced, not copied.
- Instruction and memory files that grow get a prune pass; settled decisions stay,
  append-only session logs do not.

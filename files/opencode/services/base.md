# Service Access

Services are normally already authenticated. Run the one-line check once; if it
passes, use the service without further probing. Report a blocker only after the
check fails. Never print or paste a token.

| Service | Check | Use |
| --- | --- | --- |
| GitHub | `gh auth status` | `gh` CLI (see github-ops skill) |
| Google Cloud | `gcloud auth list`, `gcloud config get project` | `gcloud`, ADC for client libraries |
| BigQuery | `bq ls --max_results=1` | `bq query --use_legacy_sql=false --project_id=<project> ...` |


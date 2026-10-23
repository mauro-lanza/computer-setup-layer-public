# Service Access

Services are normally already authenticated. Run the one-line check once; if it
passes, use the service without further probing. Report a blocker only after the
check fails. Never print or paste a token.

| Service | Check | Use |
| --- | --- | --- |
| GitHub | `gh auth status` | `gh` CLI (see github-ops skill) |
| Google Cloud | `gcloud auth list`, `gcloud config get project` | `gcloud`, ADC for client libraries |
| BigQuery | `bq ls --max_results=1` | `bq query --use_legacy_sql=false --project_id=<project> ...` |
| Terraform Cloud | the token request below returns `200` | HTTP API with the token |
| Atlassian (Jira) | any read call, e.g. `atlassian_getJiraIssue` | `atlassian_*` MCP tools; Jira needs the site as `cloudId` |

## Terraform Cloud

- Token: `~/.terraform.d/credentials.tfrc.json` at
  `credentials["app.terraform.io"].token`, or `TF_TOKEN_app_terraform_io`.
  Load it in the same command (`TOKEN=$(python3 -c ...)`), never echo it.
- Check: `curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" https://app.terraform.io/api/v2/account/details`
- Headers: `Authorization: Bearer $TOKEN`, `Content-Type: application/vnd.api+json`.
- `terraform plan` against a remote backend is a speculative run: it cannot save
  `-out`, can exceed the shell timeout, so run it in the background to a log file.
- Plan output for a run: `GET /api/v2/runs/<run-id>?include=plan`, read the plan's
  `log-read-url` and `curl` it without auth. Plan `/json-output` returns 404 on
  speculative runs.
- Run status and timestamps: `GET /api/v2/runs/<run-id>`; runs of a workspace:
  `GET /api/v2/workspaces/<ws-id>/runs`.

# docs/GCP.md

Hosting on Google Cloud. Two workload shapes drive everything.

## Two workload shapes

| | Authoring / tool calls | Batch rendering |
|---|---|---|
| Shape | Short request/response | Long-running job |
| State | Stateless per call | Holds scene + engine in memory |
| GCP fit | **Cloud Run** service | **Cloud Run Jobs** → **GKE** at volume |

Keep them separate from day one. Don't cram the renderer into the request/response service (memory pressure, timeouts); don't put tool calls on GKE (cluster tax for nothing).

## Service map

| Component | Service |
|---|---|
| MCP server | Cloud Run, `min-instances >= 1` |
| Renderer | Cloud Run Jobs → GKE Autopilot at volume |
| Queue | Cloud Tasks / Pub/Sub |
| Tenant DB | Cloud SQL / AlloyDB, per tenant |
| Asset storage | Cloud Storage, one bucket per tenant |
| Secrets | Secret Manager |
| Keys | Cloud KMS (CMEK optional) |
| Edge | Cloud Load Balancing + Cloud Armor |
| Observability | Cloud Logging / Monitoring / Trace + Agents SDK tracing |

## Rules

- Cloud Run first. Escalate the renderer to GKE only on a concrete trigger (sustained volume, GPU scheduling, per-tenant node isolation). Both run OCI containers, so migration is adding manifests, not rewriting.
- MCP server is not internet-exposed; egress restricted to OpenAI API + tenant bucket.
- Data residency is a **per-tenant** setting (pins region for Cloud Run, DB, bucket). Confirm OpenAI honours matching residency/ZDR terms.

## Per-tenant infra

One Terraform module per tenant (`infra/modules/tenant/`): DB, bucket, KMS key, Cloud Run service, IAM. Keep it cheap and automated — siloing scales cost with client count, so provisioning must be one command.

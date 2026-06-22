# Tenant Module

Provisions one DEPT Canvas tenant silo in a single module call:

- Cloud SQL PostgreSQL instance and application database
- Cloud Storage asset bucket with uniform access, public access prevention, versioning, and CMEK
- KMS key ring and crypto key, unless `cmek_key` supplies an existing tenant key
- Tenant-scoped Cloud Run v2 MCP service with `min_instance_count >= 1`
- Tenant runtime service account with IAM scoped to the tenant bucket and KMS key

```hcl
module "tenant" {
  source = "./infra/modules/tenant"

  tenant_id = "acme-emea"
  region    = "europe-west1"
  mcp_image = "europe-docker.pkg.dev/example/dept-canvas/scene-mcp:sha"
}
```

Required inputs are `tenant_id` and `region`. `cmek_key` is optional; when omitted, the module creates a
tenant-dedicated key and returns it as `kms_key_id`.

Outputs:

- `db_conn`
- `bucket_name`
- `mcp_service_url`
- `kms_key_id`

The Cloud Run service is internal-only and uses a tenant-specific service account. The module intentionally
does not grant `allUsers`, `allAuthenticatedUsers`, or project-wide tenant data roles.

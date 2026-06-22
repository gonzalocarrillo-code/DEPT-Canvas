mock_provider "google" {
  mock_data "google_project" {
    defaults = {
      number = "123456789012"
    }
  }

  mock_resource "google_cloud_run_v2_service" {
    defaults = {
      uri = "https://tenant-acme-emea-mcp-europe-west1.run.app"
    }
  }

  mock_resource "google_kms_crypto_key" {
    defaults = {
      id = "projects/dept-canvas-test/locations/europe-west1/keyRings/tenant-acme-emea-kr/cryptoKeys/tenant-acme-emea-key"
    }
  }

  mock_resource "google_service_account" {
    defaults = {
      email = "tenant-acme-emea-mcp@dept-canvas-test.iam.gserviceaccount.com"
    }
  }

  mock_resource "google_sql_database_instance" {
    defaults = {
      connection_name = "dept-canvas-test:europe-west1:tenant-acme-emea-db"
    }
  }
}

run "tenant_module_plan" {
  command = plan

  module {
    source = "./modules/tenant"
  }

  variables {
    tenant_id = "acme-emea"
    region    = "europe-west1"
    mcp_image = "europe-docker.pkg.dev/example/dept-canvas/scene-mcp:test"
  }

  assert {
    condition     = google_sql_database_instance.tenant.name == "tenant-acme-emea-db"
    error_message = "The module must create a tenant-dedicated Cloud SQL instance."
  }

  assert {
    condition     = google_storage_bucket.assets.name == "dept-canvas-acme-emea-assets"
    error_message = "The module must create a tenant-dedicated bucket."
  }

  assert {
    condition     = google_storage_bucket.assets.public_access_prevention == "enforced"
    error_message = "Tenant buckets must prevent public access."
  }

  assert {
    condition     = google_kms_crypto_key.tenant[0].name == "tenant-acme-emea-key"
    error_message = "The module must create a tenant-dedicated KMS key when cmek_key is omitted."
  }

  assert {
    condition     = google_cloud_run_v2_service.mcp.name == "tenant-acme-emea-mcp"
    error_message = "The module must create a tenant-dedicated MCP Cloud Run service."
  }

  assert {
    condition     = google_cloud_run_v2_service.mcp.ingress == "INGRESS_TRAFFIC_INTERNAL_ONLY"
    error_message = "The tenant MCP service must not be internet exposed."
  }

  assert {
    condition     = google_cloud_run_v2_service.mcp.template[0].scaling[0].min_instance_count >= 1
    error_message = "The tenant MCP service must keep at least one warm instance."
  }

  assert {
    condition = alltrue([
      google_storage_bucket_iam_member.mcp_assets.member != "allUsers",
      google_storage_bucket_iam_member.mcp_assets.member != "allAuthenticatedUsers",
      google_kms_crypto_key_iam_member.mcp.member != "allUsers",
      google_kms_crypto_key_iam_member.mcp.member != "allAuthenticatedUsers",
    ])
    error_message = "Tenant IAM bindings must never grant public or cross-tenant principals."
  }

  assert {
    condition     = google_storage_bucket.assets.encryption[0].default_kms_key_name == google_kms_crypto_key.tenant[0].id
    error_message = "Tenant bucket must use the tenant CMEK key for encryption."
  }

  assert {
    condition     = google_sql_database_instance.tenant.encryption_key_name == google_kms_crypto_key.tenant[0].id
    error_message = "Tenant Cloud SQL instance must use the tenant CMEK key for encryption."
  }

  assert {
    condition     = google_kms_crypto_key_iam_member.gcs_service_agent.role == "roles/cloudkms.cryptoKeyEncrypterDecrypter"
    error_message = "Cloud Storage service agent must have CMEK encrypter/decrypter on the tenant key."
  }

  assert {
    condition     = google_kms_crypto_key_iam_member.cloudsql_service_agent.role == "roles/cloudkms.cryptoKeyEncrypterDecrypter"
    error_message = "Cloud SQL service agent must have CMEK encrypter/decrypter on the tenant key."
  }

  assert {
    condition     = output.bucket_name == google_storage_bucket.assets.name
    error_message = "The module must expose the tenant bucket output from the planned bucket."
  }
}

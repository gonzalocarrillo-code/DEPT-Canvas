output "db_conn" {
  value       = google_sql_database_instance.tenant.connection_name
  description = "Cloud SQL connection name for the tenant database instance."
}

output "bucket_name" {
  value       = google_storage_bucket.assets.name
  description = "Tenant-dedicated asset bucket."
}

output "mcp_service_url" {
  value       = google_cloud_run_v2_service.mcp.uri
  description = "Internal Cloud Run URL for the tenant MCP service."
}

output "kms_key_id" {
  value       = local.kms_key_id
  description = "Tenant CMEK crypto key resource ID, created or supplied."
}

output "mcp_service_account" {
  value       = google_service_account.mcp.email
  description = "Tenant-scoped MCP runtime service account."
}

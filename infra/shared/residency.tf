locals {
  default_residency_region = var.region

  tenant_residency_regions = {
    for tenant_id, region in var.tenant_residency_map :
    tenant_id => region
  }
}

output "default_residency_region" {
  value       = local.default_residency_region
  description = "Region pinned for shared control-plane resources when no tenant override exists"
}

output "tenant_residency_regions" {
  value       = local.tenant_residency_regions
  description = "Per-tenant region overrides for residency enforcement"
}

output "render_queue_residency_region" {
  value = google_cloud_tasks_queue.render_jobs.location
}

output "renderer_job_residency_region" {
  value = google_cloud_run_v2_job.renderer.location
}

output "audit_sink_residency_region" {
  value = google_storage_bucket.audit_sink.location
}

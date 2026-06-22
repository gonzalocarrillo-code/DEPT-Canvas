resource "google_project_service" "cloudtrace" {
  project = var.project_id
  service = "cloudtrace.googleapis.com"
}

resource "google_project_service" "logging" {
  project = var.project_id
  service = "logging.googleapis.com"
}

resource "google_project_service" "monitoring" {
  project = var.project_id
  service = "monitoring.googleapis.com"
}

resource "google_logging_project_sink" "audit_events" {
  name        = "dept-canvas-audit-events"
  project     = var.project_id
  destination = "storage.googleapis.com/${google_storage_bucket.audit_sink.name}"

  unique_writer_identity = true

  filter = <<-EOT
    resource.type="cloud_run_revision"
    jsonPayload.audit_event=true
  EOT

  depends_on = [
    google_project_service.logging,
    google_storage_bucket.audit_sink,
  ]
}

output "cloud_trace_api" {
  value = google_project_service.cloudtrace.service
}

output "audit_log_sink_writer" {
  value = google_logging_project_sink.audit_events.writer_identity
}

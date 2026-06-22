resource "google_storage_bucket" "audit_sink" {
  name                        = "${var.project_id}-dept-canvas-audit"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  encryption {
    default_kms_key_name = var.audit_kms_key_id
  }

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 365
    }
    action {
      type = "Delete"
    }
  }
}

output "audit_sink_bucket" {
  value = google_storage_bucket.audit_sink.name
}

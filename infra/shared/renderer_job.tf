resource "google_cloud_run_v2_job" "renderer" {
  name     = "dept-canvas-renderer"
  location = var.region

  template {
    template {
      containers {
        image = "gcr.io/${var.project_id}/dept-canvas-renderer:latest"
        env {
          name  = "RENDER_MODE"
          value = "cloud-run-job"
        }
      }
      timeout = "3600s"
    }
  }
}

output "renderer_job_name" {
  value = google_cloud_run_v2_job.renderer.name
}

output "gke_escalation_note" {
  value = "Escalate renderer to GKE GPU node pool when Cloud Run Jobs concurrency or GPU scheduling limits are hit."
}

variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

resource "google_cloud_tasks_queue" "render_jobs" {
  name     = "dept-canvas-render-jobs"
  location = var.region

  rate_limits {
    max_dispatches_per_second = 50
    max_concurrent_dispatches = 20
  }

  retry_config {
    max_attempts = 5
  }
}

output "render_queue_name" {
  value = google_cloud_tasks_queue.render_jobs.name
}

output "render_queue_id" {
  value = google_cloud_tasks_queue.render_jobs.id
}

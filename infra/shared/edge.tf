variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "edge_domain" {
  type = string
}

variable "rate_limit_rpm" {
  type = number
}

resource "google_compute_global_address" "edge" {
  name = "dept-canvas-edge-ip"
}

resource "google_compute_managed_ssl_certificate" "edge" {
  name = "dept-canvas-edge-cert"
  managed {
    domains = [var.edge_domain]
  }
}

resource "google_compute_security_policy" "edge_armor" {
  name = "dept-canvas-edge-armor"

  rule {
    action   = "rate_based_ban"
    priority = 1000
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"
      rate_limit_threshold {
        count        = var.rate_limit_rpm
        interval_sec = 60
      }
    }
  }

  rule {
    action   = "allow"
    priority = 2147483647
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
  }
}

output "edge_ip" {
  value = google_compute_global_address.edge.address
}

output "cloud_armor_policy_id" {
  value = google_compute_security_policy.edge_armor.id
}

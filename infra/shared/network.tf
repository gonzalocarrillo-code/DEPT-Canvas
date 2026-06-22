variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

locals {
  mcp_egress_allow_hosts = [
    "api.openai.com",
  ]
}

resource "google_vpc_access_connector" "control_plane" {
  name          = "dept-canvas-cp"
  region        = var.region
  ip_cidr_range = "10.8.0.0/28"
  network       = "default"
}

resource "google_compute_firewall" "deny_mcp_public_ingress" {
  name    = "dept-canvas-deny-mcp-public-ingress"
  network = "default"

  direction = "INGRESS"
  priority  = 1000

  deny {
    protocol = "tcp"
    ports    = ["443", "8080"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["dept-canvas-mcp"]
}

resource "google_compute_firewall" "allow_mcp_internal_ingress" {
  name    = "dept-canvas-allow-mcp-internal-ingress"
  network = "default"

  direction = "INGRESS"
  priority  = 900

  allow {
    protocol = "tcp"
    ports    = ["8080"]
  }

  source_ranges = ["10.8.0.0/28"]
  target_tags   = ["dept-canvas-mcp"]
}

output "mcp_egress_allow_list" {
  value = local.mcp_egress_allow_hosts
}

output "mcp_exposure" {
  value = "internal-only — reachable via edge API, not public internet"
}

output "mcp_network_tags" {
  value = ["dept-canvas-mcp"]
}

# Tenant-scoped bucket egress is enforced in edge/src/egress-policy.ts at runtime.
# OpenAI egress is limited to api.openai.com via the same allow-list.

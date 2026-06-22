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

output "mcp_egress_allow_list" {
  value = local.mcp_egress_allow_hosts
}

output "mcp_exposure" {
  value = "internal-only — enforced by tenant Cloud Run ingress=INGRESS_TRAFFIC_INTERNAL_ONLY"
}

output "vpc_connector_region" {
  value = google_vpc_access_connector.control_plane.region
}

# Tenant-scoped bucket egress is enforced in edge/src/egress-policy.ts at runtime.

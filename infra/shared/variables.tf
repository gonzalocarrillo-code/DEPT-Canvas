variable "project_id" {
  type        = string
  description = "GCP project hosting the shared control plane"
}

variable "region" {
  type        = string
  default     = "europe-west1"
  description = "Default region for shared control-plane resources"
}

variable "edge_domain" {
  type        = string
  default     = "edge.example.deptcanvas.com"
  description = "Public hostname for the edge API (TLS terminated at load balancer)"
}

variable "rate_limit_rpm" {
  type        = number
  default     = 120
  description = "Cloud Armor per-IP requests per minute threshold"
}

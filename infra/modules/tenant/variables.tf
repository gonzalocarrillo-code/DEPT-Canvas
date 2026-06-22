variable "tenant_id" {
  type        = string
  description = "Lowercase tenant slug used to name the isolated tenant silo."

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,38}[a-z0-9]$", var.tenant_id)) && !can(regex("--", var.tenant_id))
    error_message = "tenant_id must be 4-40 chars, start with a letter, end with a letter or digit, and contain only lowercase letters, digits, and single hyphens."
  }
}

variable "region" {
  type        = string
  description = "Residency-pinned GCP region for tenant Cloud Run, Cloud SQL, KMS, and storage."

  validation {
    condition     = can(regex("^[a-z]+-[a-z]+[0-9]$", var.region))
    error_message = "region must be a GCP region such as europe-west1 or us-central1."
  }
}

variable "cmek_key" {
  type        = string
  default     = null
  nullable    = true
  description = "Optional existing KMS crypto key resource ID. If omitted, the module creates a tenant-dedicated key."
}

variable "mcp_image" {
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
  description = "MCP service container image. Override with the tenant-ready scene-mcp image in real environments."
}

variable "mcp_min_instances" {
  type        = number
  default     = 1
  description = "Minimum Cloud Run instances for interactive authoring traffic."

  validation {
    condition     = var.mcp_min_instances >= 1
    error_message = "mcp_min_instances must be at least 1."
  }
}

variable "db_tier" {
  type        = string
  default     = "db-f1-micro"
  description = "Small default Cloud SQL tier; raise per tenant when sustained load requires it."
}

variable "db_version" {
  type        = string
  default     = "POSTGRES_15"
  description = "Cloud SQL database engine version for the tenant database."
}

variable "private_network" {
  type        = string
  default     = null
  nullable    = true
  description = "Optional VPC self-link for private Cloud SQL connectivity."
}

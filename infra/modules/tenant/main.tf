terraform {
  required_version = ">= 1.7.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

locals {
  name_prefix       = "tenant-${var.tenant_id}"
  bucket_name       = "dept-canvas-${var.tenant_id}-assets"
  kms_key_id        = var.cmek_key != null ? var.cmek_key : google_kms_crypto_key.tenant[0].id
  service_account   = google_service_account.mcp.email
  service_member    = "serviceAccount:${local.service_account}"
  cloud_sql_conn    = google_sql_database_instance.tenant.connection_name
  normalized_region = lower(var.region)
}

resource "google_kms_key_ring" "tenant" {
  count    = var.cmek_key == null ? 1 : 0
  name     = "${local.name_prefix}-kr"
  location = local.normalized_region
}

resource "google_kms_crypto_key" "tenant" {
  count           = var.cmek_key == null ? 1 : 0
  name            = "${local.name_prefix}-key"
  key_ring        = google_kms_key_ring.tenant[0].id
  rotation_period = "7776000s"

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_service_account" "mcp" {
  account_id   = substr("${local.name_prefix}-mcp", 0, 30)
  display_name = "DEPT Canvas ${var.tenant_id} MCP runtime"
  description  = "Tenant-scoped service account for the ${var.tenant_id} MCP Cloud Run service."
}

resource "google_storage_bucket" "assets" {
  name                        = local.bucket_name
  location                    = upper(local.normalized_region)
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  encryption {
    default_kms_key_name = local.kms_key_id
  }

  versioning {
    enabled = true
  }

  depends_on = [google_kms_crypto_key_iam_member.mcp]
}

resource "google_sql_database_instance" "tenant" {
  name                = "${local.name_prefix}-db"
  region              = local.normalized_region
  database_version    = var.db_version
  encryption_key_name = local.kms_key_id
  deletion_protection = true

  settings {
    tier              = var.db_tier
    availability_type = "ZONAL"
    disk_autoresize   = true
    disk_type         = "PD_SSD"

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = var.private_network
    }
  }

  depends_on = [google_kms_crypto_key_iam_member.mcp]
}

resource "google_sql_database" "app" {
  name     = "dept_canvas"
  instance = google_sql_database_instance.tenant.name
}

resource "google_cloud_run_v2_service" "mcp" {
  name     = "${local.name_prefix}-mcp"
  location = local.normalized_region
  ingress  = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  lifecycle {
    prevent_destroy = true
  }

  template {
    service_account = local.service_account

    scaling {
      min_instance_count = var.mcp_min_instances
      max_instance_count = 20
    }

    containers {
      image = var.mcp_image

      env {
        name  = "TENANT_ID"
        value = var.tenant_id
      }

      env {
        name  = "TENANT_DB_CONN"
        value = local.cloud_sql_conn
      }

      env {
        name  = "TENANT_BUCKET"
        value = google_storage_bucket.assets.name
      }

      env {
        name  = "TENANT_KMS_KEY"
        value = local.kms_key_id
      }
    }
  }
}

resource "google_storage_bucket_iam_member" "mcp_assets" {
  bucket = google_storage_bucket.assets.name
  role   = "roles/storage.objectAdmin"
  member = local.service_member
}

resource "google_kms_crypto_key_iam_member" "mcp" {
  crypto_key_id = local.kms_key_id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = local.service_member
}

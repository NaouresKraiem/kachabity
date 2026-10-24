# The production infrastructure (docs/DEPLOY.md): one Oracle Cloud "Always Free" ARM VM that runs
# Postgres + the NestJS API (deploy/docker-compose.prod.yml), and on Cloudflare the tunnel that
# publishes the API, its DNS record and the R2 buckets. The storefront itself is on Vercel.
terraform {
  required_version = ">= 1.9"

  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 6.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # State in an R2 bucket (created by hand once, see docs/DEPLOY.md):
  # terraform init -backend-config=backend.hcl
  backend "s3" {}
}

provider "oci" {
  tenancy_ocid     = var.oci_tenancy_ocid
  user_ocid        = var.oci_user_ocid
  fingerprint      = var.oci_fingerprint
  private_key_path = var.oci_private_key_path
  region           = var.oci_region
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

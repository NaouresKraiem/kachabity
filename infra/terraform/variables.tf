# Oracle Cloud API key (Profile → API keys → Add API key; the dialog shows these values).
variable "oci_tenancy_ocid" { type = string }
variable "oci_user_ocid" { type = string }
variable "oci_fingerprint" { type = string }
variable "oci_private_key_path" {
  type        = string
  description = "Path to the API key's private .pem file (never commit it)."
}
variable "oci_region" {
  type        = string
  description = "Your home region, e.g. eu-frankfurt-1 or eu-marseille-1 (Always Free resources live there)."
}
variable "oci_compartment_ocid" {
  type        = string
  description = "Compartment for the resources; the tenancy OCID (root compartment) is fine."
}
variable "availability_domain_index" {
  type        = number
  default     = 0
  description = "Try 1 or 2 when the region says it is out of capacity for A1 machines."
}

# The machine: Always Free allows up to 4 ARM cores, 24 GB of memory and 200 GB of disk in total.
variable "ocpus" {
  type    = number
  default = 4
}
variable "memory_gb" {
  type    = number
  default = 24
}
variable "boot_volume_gb" {
  type    = number
  default = 100
}

variable "admin_ssh_public_key" {
  type        = string
  description = "Your own SSH public key, for the default 'ubuntu' user."
}
variable "deploy_ssh_public_key" {
  type        = string
  description = "Public key of the CI deploy key (the private half is the GitHub secret DEPLOY_SSH_KEY)."
}
variable "ssh_allowed_cidr" {
  type        = string
  default     = "0.0.0.0/0"
  description = "Who may reach SSH (key-only logins). GitHub's runners use many addresses, hence open by default."
}

# Cloudflare: an API token with Zone DNS edit, Account Cloudflare Tunnel edit and Account R2 edit.
variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}
variable "cloudflare_account_id" { type = string }
variable "cloudflare_zone_id" {
  type        = string
  description = "The zone of var.domain (Cloudflare dashboard → the domain → Overview)."
}
variable "domain" {
  type        = string
  description = "e.g. kachabity.com: the API answers at api.<domain>, files at files.<domain>."
}
variable "r2_location" {
  type        = string
  default     = "weur"
  description = "R2 location hint (weur: Western Europe)."
}

# Cloudflare: the tunnel that publishes the API (the cloudflared container on the server connects
# out with its token), api.<domain> pointing at it, and the R2 buckets (products: public at
# files.<domain>; documents and backups: private).

resource "random_bytes" "tunnel_secret" {
  length = 32
}

resource "cloudflare_zero_trust_tunnel_cloudflared" "api" {
  account_id    = var.cloudflare_account_id
  name          = "kachabity-api"
  config_src    = "cloudflare"
  tunnel_secret = random_bytes.tunnel_secret.base64
}

resource "cloudflare_zero_trust_tunnel_cloudflared_config" "api" {
  account_id = var.cloudflare_account_id
  tunnel_id  = cloudflare_zero_trust_tunnel_cloudflared.api.id
  config = {
    ingress = [
      # 'api' is the compose service name: cloudflared runs in the same Docker network.
      { hostname = "api.${var.domain}", service = "http://api:4000" },
      { service = "http_status:404" },
    ]
  }
}

data "cloudflare_zero_trust_tunnel_cloudflared_token" "api" {
  account_id = var.cloudflare_account_id
  tunnel_id  = cloudflare_zero_trust_tunnel_cloudflared.api.id
}

resource "cloudflare_dns_record" "api" {
  zone_id = var.cloudflare_zone_id
  name    = "api.${var.domain}"
  type    = "CNAME"
  content = "${cloudflare_zero_trust_tunnel_cloudflared.api.id}.cfargotunnel.com"
  proxied = true
  ttl     = 1
}

resource "cloudflare_r2_bucket" "products" {
  account_id = var.cloudflare_account_id
  name       = "products"
  location   = var.r2_location
}

resource "cloudflare_r2_bucket" "documents" {
  account_id = var.cloudflare_account_id
  name       = "documents"
  location   = var.r2_location
}

resource "cloudflare_r2_bucket" "backups" {
  account_id = var.cloudflare_account_id
  name       = "kachabity-backups"
  location   = var.r2_location
}

# Product photos are public at https://files.<domain>/<key> (FILES_PUBLIC_URL).
resource "cloudflare_r2_custom_domain" "files" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.products.name
  domain      = "files.${var.domain}"
  zone_id     = var.cloudflare_zone_id
  enabled     = true
}

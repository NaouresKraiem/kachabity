output "server_public_ip" {
  description = "The GitHub secret DEPLOY_HOST, and for ssh ubuntu@<ip>."
  value       = oci_core_instance.server.public_ip
}

output "api_url" {
  description = "NEST_URL on Vercel."
  value       = "https://api.${var.domain}"
}

output "files_url" {
  description = "FILES_PUBLIC_URL (server .env and Vercel)."
  value       = "https://files.${var.domain}"
}

output "s3_endpoint" {
  description = "S3_ENDPOINT in the server .env."
  value       = "https://${var.cloudflare_account_id}.r2.cloudflarestorage.com"
}

output "tunnel_token" {
  description = "CLOUDFLARE_TUNNEL_TOKEN in the server .env: terraform output -raw tunnel_token"
  value       = data.cloudflare_zero_trust_tunnel_cloudflared_token.api.token
  sensitive   = true
}

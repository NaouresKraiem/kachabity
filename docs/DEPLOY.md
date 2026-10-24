# Production: one free Oracle server, Cloudflare, Vercel

```
Shoppers / admin ──▶ Vercel (Next.js storefront + admin, /api rewritten to NEST_URL)
                         │
                         ▼ https://api.<domain>  (Cloudflare, HTTPS)
                Cloudflare Tunnel ◀── outbound ── Oracle Always Free ARM VM
                                                   ├─ cloudflared
                                                   ├─ api (NestJS, ghcr.io/<owner>/kachabity-api)
                                                   └─ db  (Postgres 17, backups nightly to R2)
Product photos ──▶ https://files.<domain> (R2 bucket "products")
```

- **Infrastructure** (`infra/terraform/`): the VM, its network (only SSH open), the tunnel, `api.<domain>`,
  the R2 buckets and `files.<domain>`. You run Terraform yourself; nothing is created without `apply`.
- **Server files** (`deploy/`): `docker-compose.prod.yml`, `deploy.sh` (backup → migrate → start →
  health check → rollback), `backup.sh` (nightly to R2, 30 days kept).
- **CI/CD** (`.github/workflows/`): `ci.yml` checks every pull request and push (types, lint, API build,
  all end-to-end suites on an empty database built from `db/baseline.sql`). `deploy.yml` runs on every
  push to `kachabiti-nest`: CI, then the ARM image to GitHub's registry, then `deploy.sh` on the server.
  Vercel deploys the storefront from the same push.

Free tiers and prices change: check Oracle, Cloudflare and Vercel before you start. Vercel's Hobby plan is
for non-commercial projects; a shop that takes orders should use Pro, or run `web` on the same server.

## One-time setup

### 1. Cloudflare
1. Add your domain to Cloudflare (its nameservers at your registrar).
2. Note the **Account ID** and the domain's **Zone ID** (domain → Overview, right column).
3. Enable **R2** (it may ask for a payment method; the free allowance covers this shop).
4. Create the bucket **`kachabity-terraform-state`** by hand (R2 → Create bucket). Terraform keeps its state there.
5. R2 → **Manage API tokens** → create a token with **Object Read & Write** on all buckets. Keep its
   **Access Key ID** and **Secret Access Key**: Terraform's state backend and the server's `S3_*` use them.
6. My profile → **API Tokens** → create a token with: Zone · DNS · Edit (your zone), Account · Cloudflare
   Tunnel · Edit, Account · Workers R2 Storage · Edit. This is `cloudflare_api_token`.

### 2. Oracle Cloud
1. Create an account (pick a home region near your customers, e.g. Frankfurt or Marseille; Always Free
   resources live in the home region). It asks for a card for verification; Always Free isn't charged.
   Upgrading to "Pay As You Go" keeps the free resources free and stops Oracle from reclaiming an idle VM.
2. Profile → **API keys** → **Add API key** → download the private key (`~/.oci/oci_api_key.pem`).
   The dialog shows the tenancy OCID, user OCID, fingerprint and region for `terraform.tfvars`.

### 3. SSH keys
```bash
ssh-keygen -t ed25519 -f ~/.ssh/kachabity-deploy -N "" -C github-deploy
```
`kachabity-deploy.pub` goes in `deploy_ssh_public_key`; the private file becomes the GitHub secret
`DEPLOY_SSH_KEY`. Your own `~/.ssh/id_ed25519.pub` goes in `admin_ssh_public_key`.

### 4. Terraform
```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # fill it in
cp backend.hcl.example backend.hcl             # your Cloudflare account ID in the endpoint
export AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=…   # the R2 token's keys (state backend)
export TF_VAR_cloudflare_api_token=…
terraform init -backend-config=backend.hcl
terraform plan
terraform apply
```
Without Terraform installed: `docker run --rm -it -v "$PWD:/tf" -w /tf -v ~/.oci:/root/.oci -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e TF_VAR_cloudflare_api_token hashicorp/terraform:1.9.8 <command>`
(then use `/root/.oci/oci_api_key.pem` as the key path).

"Out of capacity" for A1 machines: try `availability_domain_index = 1` or `2`, or try again later.

Afterwards: `terraform output` (IP, URLs) and `terraform output -raw tunnel_token`. Wait for the first boot:
`ssh ubuntu@<ip> cloud-init status --wait`.

### 5. GitHub
Settings → **Environments** → **production** (add yourself as a required reviewer if you want to approve
each deploy):
- Secrets: `DEPLOY_HOST` = the IP, `DEPLOY_SSH_KEY` = the private deploy key,
  `DEPLOY_KNOWN_HOSTS` = the output of `ssh-keyscan -t ed25519 <ip>`, `PROD_ENV` = the whole server `.env`
  (template: `deploy/.env.example`; `POSTGRES_PASSWORD` letters and digits only; `CLOUDFLARE_TUNNEL_TOKEN`
  from Terraform; `S3_ENDPOINT` from `terraform output s3_endpoint`).
- Variable: `API_URL` = `https://api.<domain>` (the deploy checks it answers).
- Last, Settings → Secrets and variables → Actions → **Variables**: `DEPLOY_ENABLED` = `true`. Until then
  pushes run CI only, so nothing tries to reach a server that doesn't exist yet.

### 6. Vercel
Project → Settings → Environment Variables (Production): `NEST_URL=https://api.<domain>`, the same
`AUTH_SECRET` and `REVALIDATE_SECRET` as the server, `FILES_PUBLIC_URL=https://files.<domain>`,
`ENV=production`, `NEXT_PUBLIC_SITE_URL`, and the Sentry variables. Set the production branch to the one
`deploy.yml` deploys (`kachabiti-nest` for now), and redeploy so the build picks them up.

### 7. First deploy and the data
1. Actions → **Deploy** → Run workflow. On the empty server, `migrate.mjs` loads `db/baseline.sql`.
2. Move the shop's data and files from Supabase as in `docs/MIGRATION-NESTJS.md` (phase 5 runbook). The
   target database is reached through an SSH tunnel:
   `ssh -N -L 15432:127.0.0.1:5432 ubuntu@<ip>` then
   `TARGET_DATABASE_URL=postgresql://kachabity:<password>@host.docker.internal:15432/kachabity node scripts/db/move-database.mjs --replace`.
   The same tunnel works for pgAdmin (host `localhost`, port `15432`).

## Everyday

- **Deploy:** merge or push to `kachabiti-nest`. CI must pass; then the API deploys and Vercel builds the site.
- **Roll back the API:** Actions → Deploy → Run workflow on an older commit, or on the server
  `cd /opt/kachabity && ./deploy.sh ghcr.io/<owner>/kachabity-api:<older-sha>`. A failed health check
  rolls back by itself. Migrations are not undone: restore a backup for that.
- **Logs and status:** `ssh deploy@<ip>` then `cd /opt/kachabity && docker compose -f docker-compose.prod.yml ps`
  (or `logs -f api`).
- **New migration:** add the file to `supabase/migrations/`; the next deploy applies it after a backup.

## Backups

Nightly at 02:30 (server time) and before every deploy that has a previous version: `backup.sh` dumps the
database into the private R2 bucket `kachabity-backups` (30 days kept; 7 days on the server too).

Restore into an empty database:
```bash
pg_restore --clean --if-exists --no-owner -d postgresql://… kachabity-<date>.dump
```
(create the extensions first on a brand-new database: `pgcrypto`, `pg_trgm`, `unaccent`, `uuid-ossp` in
schema `extensions`; `api/scripts/migrate.mjs` shows the statements).

## When kachabiti-nest is merged into main

Change `branches: [kachabiti-nest]` in `.github/workflows/deploy.yml` to `main`, and Vercel's production
branch to `main`.

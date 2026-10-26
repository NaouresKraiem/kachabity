# Production: everything on one AWS server

```
Shoppers / admin ──▶ https://<site_domain> (A record → the server's Elastic IP)
                         │
                         ▼
              EC2 t4g.small (ARM, Ubuntu 24.04, 2 GB + 2 GB swap)
               ├─ caddy  (ports 80/443, HTTPS from Let's Encrypt)
               │    /api/* ──▶ api   (NestJS, ghcr.io/<owner>/kachabity-api)
               │    the rest ──▶ web (Next.js, ghcr.io/<owner>/kachabity-web; /api/internal too)
               └─ db (Postgres 17, nightly backups to S3)
Product photos ──▶ S3 bucket kachabity-products-<id> (public read); documents and backups: private buckets
```

- **Infrastructure** (`infra/terraform/`): the instance and its role (read/write on the three buckets, so
  no S3 keys anywhere), its firewall (80, 443, SSH), the Elastic IP, the buckets, daily disk snapshots and a monthly budget
  alert. You run Terraform yourself; nothing is created without `apply`.
- **Server files** (`deploy/`): `docker-compose.prod.yml`, `deploy.sh` (backup → migrate → start →
  health checks → rollback), `backup.sh` (nightly to S3, 30 days kept).
- **CI/CD** (`.github/workflows/`): `ci.yml` checks every pull request and push (types, lint, API build,
  all end-to-end suites on an empty database built from `db/baseline.sql`). `deploy.yml` runs on every
  push to `kachabiti-nest`: CI, then both images built on GitHub's ARM runners, then `deploy.sh` on the server.

## What it costs

Approximate on-demand prices in eu-north-1 (Stockholm), October 2026. Check the AWS Pricing Calculator.

| Item | Per month |
|---|---|
| EC2 t4g.small, 730 h × ~$0.017 | ~$12.40 |
| EBS gp3 30 GB × ~$0.084 | ~$2.50 |
| Public IPv4 address (the Elastic IP), $0.005/h | ~$3.65 |
| S3: a few GB of photos, documents, 30 days of backups, requests | < $0.50 |
| Disk snapshots, 7 daily (incremental: about the disk's used space, ~$0.05/GB) | ~$0.50–1 |
| Data out to the internet (first 100 GB a month free) | $0 |
| AWS Budgets (first two budgets free) | $0 |
| **Total** | **~$19** |

On the Free plan the $100 sign-up credit covers about 5 months. Launching an EC2 instance and setting up
a budget (both done by this Terraform) are two of the console's "Earn AWS credits" activities, $20
each, which covers the full 6 months. The Free plan ends after 6 months or when the credits run out,
whichever comes first. **Upgrade to the paid plan before then, or the account closes and the server
with its database goes.** After that it's about $19 a month (less with a 1-year Savings Plan).

The Free plan allows only some instance types (t3.micro, t3.small, t4g.micro, t4g.small, c7i-flex.large,
m7i-flex.large); t4g.small is the smallest with enough memory for the site, the API and Postgres.

## One-time setup

### 1. AWS
1. Check your project's Region: AWS Settings → the project → Overview → Region (resources can only go
   there; `aws_region` in `terraform.tfvars`).
2. Sign in from the terminal and hand the short-lived keys to Terraform (redo this when they expire):
   ```bash
   aws login --profile <name>
   eval "$(aws configure export-credentials --profile <name> --format env)"
   ```
3. Create the bucket for Terraform's state once (any unique name, in your Region):
   ```bash
   aws s3api create-bucket --bucket kachabity-terraform-state-<something unique> --region <region> \
     --create-bucket-configuration LocationConstraint=<region>
   aws s3api put-bucket-versioning --bucket kachabity-terraform-state-<…> --versioning-configuration Status=Enabled
   ```

### 2. SSH keys
```bash
ssh-keygen -t ed25519 -f ~/.ssh/kachabity-deploy -N "" -C github-deploy
```
`kachabity-deploy.pub` goes in `deploy_ssh_public_key`; the private file becomes the GitHub secret
`DEPLOY_SSH_KEY`. Your own `~/.ssh/id_ed25519.pub` goes in `admin_ssh_public_key`.

### 3. Terraform
```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # fill it in
cp backend.hcl.example backend.hcl             # the state bucket and your Region
terraform init -backend-config=backend.hcl
terraform plan
terraform apply
```
Without Terraform installed: `docker run --rm -it -v "$PWD:/tf" -w /tf -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_SESSION_TOKEN hashicorp/terraform:1.10.5 <command>`

Afterwards: `terraform output server_public_ip` and `terraform output -raw server_env` (the S3 and domain
lines of the server `.env`). Wait for the first boot: `ssh ubuntu@<ip> cloud-init status --wait`.

### 4. DNS
At your domain's DNS provider, add an **A record** for `site_domain` (e.g. `test` for test.kachabiti.com)
pointing to the server's IP, before the first deploy: Caddy gets the HTTPS certificate as soon as the
name points at it.

### 5. GitHub
Settings → **Environments** → **production** (add yourself as a required reviewer if you want to approve
each deploy):
- Secrets:
  - `DEPLOY_HOST` = the IP, `DEPLOY_SSH_KEY` = the private deploy key, `DEPLOY_KNOWN_HOSTS` = the output
    of `ssh-keyscan -t ed25519 <ip>`.
  - `PROD_ENV` = the whole server `.env` (template: `deploy/.env.example`; `POSTGRES_PASSWORD` letters
    and digits only; the S3 and domain lines from `terraform output -raw server_env`).
  - `WEB_BUILD_ENV` = the site's build settings, fixed in the image when it's built:
    ```
    ENV=production
    NEST_URL=http://api:4000
    NEXT_PUBLIC_SITE_URL=https://<site_domain>
    FILES_PUBLIC_URL=<the same as in PROD_ENV>
    ```
    plus any `NEXT_PUBLIC_*` you use (Sentry DSN, phone, social links: see `ENV-EXAMPLE.md`).
- Variable: `SITE_URL` = `https://<site_domain>` (the deploy checks it answers).
- Last, Settings → Secrets and variables → Actions → **Variables**: `DEPLOY_ENABLED` = `true`. Until then
  pushes run CI only, so nothing tries to reach a server that doesn't exist yet.

### 6. First deploy and the data
1. Actions → **Deploy** → Run workflow. On the empty server, `migrate.mjs` loads `db/baseline.sql`.
2. Move the shop's data from Supabase as in `docs/MIGRATION-NESTJS.md` (phase 5 runbook). The target
   database is reached through an SSH tunnel:
   `ssh -N -L 15432:127.0.0.1:5432 ubuntu@<ip>` then
   `TARGET_DATABASE_URL=postgresql://kachabity:<password>@host.docker.internal:15432/kachabity node scripts/db/move-database.mjs --replace`.
   The same tunnel works for pgAdmin (host `localhost`, port `15432`).
3. Copy the files with `api/scripts/copy-storage.mjs --rewrite` (from `api/`), with the `server_env`
   values, your exported keys as `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_SESSION_TOKEN`, and
   `DATABASE_URL` through the tunnel.

## Everyday

- **Deploy:** merge or push to `kachabiti-nest`. CI must pass; then both images build and deploy.
- **Roll back:** Actions → Deploy → Run workflow on an older commit, or on the server
  `cd /opt/kachabity && ./deploy.sh ghcr.io/<owner>/kachabity-api:<sha> ghcr.io/<owner>/kachabity-web:<sha>`.
  A failed health check rolls back by itself. Migrations are not undone: restore a backup for that.
- **Logs and status:** `ssh deploy@<ip>` then `cd /opt/kachabity && docker compose -f docker-compose.prod.yml ps`
  (or `logs -f api`, `logs -f web`).
- **New migration:** add the file to `supabase/migrations/`; the next deploy applies it after a backup.
- **Costs:** Billing and Cost Management → Cost Explorer; the budget e-mails you at 80% of
  `monthly_budget_usd`.
- **Stop paying for a test:** `terraform destroy` removes everything except the state bucket (empty the
  three buckets first; S3 refuses to delete a bucket with files in it).

## Backups

Two kinds, both automatic:
- **Database dumps:** nightly at 02:30 (server time, UTC) and before every deploy that has a previous
  version, `backup.sh` dumps the database into the private bucket `kachabity-backups-<id>` (30 days kept;
  7 days on the server too). Use them to restore the database alone, on this server or another.
- **Disk snapshots:** every day at 01:00 UTC, AWS snapshots the server's whole disk (Postgres included;
  Data Lifecycle Manager, `aws_dlm_lifecycle_policy.server`), keeping the last `snapshot_days` (7). Use them
  when the server itself is lost or broken: EC2 → Snapshots → the snapshot → Create volume (same
  availability zone), stop the instance, detach its root volume, attach the new one as `/dev/sda1`, start.
  Postgres starts from it as after a power cut (it replays its log), so a snapshot is consistent.

Restore into an empty database:
```bash
pg_restore --clean --if-exists --no-owner -d postgresql://… kachabity-<date>.dump
```
(create the extensions first on a brand-new database: `pgcrypto`, `pg_trgm`, `unaccent`, `uuid-ossp` in
schema `extensions`; `api/scripts/migrate.mjs` shows the statements).

## When kachabiti-nest is merged into main

Change `branches: [kachabiti-nest]` in `.github/workflows/deploy.yml` to `main`.

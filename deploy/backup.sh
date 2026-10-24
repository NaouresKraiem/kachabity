#!/bin/sh
# Backs up the database to R2 (bucket BACKUP_BUCKET), keeps 30 days there and 7 days on the server.
# Run nightly by cron (set up by infra/terraform/cloud-init.yaml) and by deploy.sh before migrating.
# Restore: pg_restore --clean --if-exists --no-owner -d <database> <file> (docs/DEPLOY.md).
set -eu
cd "$(dirname "$0")"
set -a
# shellcheck source=/dev/null  # the server's .env (deploy/.env.example)
. ./.env
set +a
mkdir -p backups
FILE="kachabity-$(date -u +%Y%m%dT%H%M%SZ).dump"

docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom > "backups/$FILE"

rclone() {
  docker run --rm -v "$PWD/backups:/backups" \
    -e RCLONE_CONFIG_R2_TYPE=s3 -e RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
    -e RCLONE_CONFIG_R2_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
    -e RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
    -e RCLONE_CONFIG_R2_ENDPOINT="$S3_ENDPOINT" \
    -e RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true \
    rclone/rclone:1.68.2 "$@"
}
rclone copy "/backups/$FILE" "r2:$BACKUP_BUCKET/"
rclone delete --min-age 30d "r2:$BACKUP_BUCKET/"
find backups -name 'kachabity-*.dump' -mtime +7 -delete
echo "Backed up: $FILE"

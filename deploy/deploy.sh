#!/bin/sh
# Deploys new API and site images on the server (run by .github/workflows/deploy.yml over SSH, in
# /opt/kachabity): back up the database, apply pending migrations, start the new images, and go back
# to the previous ones if they don't become healthy.
# Usage: ./deploy.sh ghcr.io/<owner>/kachabity-api:<sha> ghcr.io/<owner>/kachabity-web:<sha>
set -eu
cd "$(dirname "$0")"
NEW_API="$1"
NEW_WEB="$2"
COMPOSE="docker compose -f docker-compose.prod.yml"
PREVIOUS_API="$(cat current-api-image 2>/dev/null || true)"
PREVIOUS_WEB="$(cat current-web-image 2>/dev/null || true)"

echo "Deploying $NEW_API and $NEW_WEB (previous: ${PREVIOUS_API:-none}, ${PREVIOUS_WEB:-none})"
export API_IMAGE="$NEW_API" WEB_IMAGE="$NEW_WEB"
$COMPOSE pull api web
# --wait: until Postgres accepts connections (its health check), or the migrations would fail.
$COMPOSE up -d --wait db

# A backup before any migration: migrations can't be undone by switching images.
if [ -n "$PREVIOUS_API" ]; then ./backup.sh; fi

# Pending migrations (an empty database gets db/baseline.sql first), with the new image's files.
$COMPOSE run --rm --no-deps api node scripts/migrate.mjs

# Old images go; the current and the previous one (for a rollback) stay. $1 new image, $2 previous.
prune() {
  docker images "${1%:*}" --format '{{.Repository}}:{{.Tag}}' \
    | grep -v -x -e "$1" -e "${2:-none}" -e "${1%:*}:latest" \
    | xargs -r docker rmi >/dev/null 2>&1 || true
}

# Waits up to 3 minutes for the health checks.
if $COMPOSE up -d --wait --wait-timeout 180 --remove-orphans; then
  echo "$NEW_API" > current-api-image
  echo "$NEW_WEB" > current-web-image
  docker tag "$NEW_API" kachabity-api:current
  docker tag "$NEW_WEB" kachabity-web:current
  prune "$NEW_API" "$PREVIOUS_API"
  prune "$NEW_WEB" "$PREVIOUS_WEB"
  echo "Deployed: $NEW_API $NEW_WEB"
  exit 0
fi

echo "The new images did not become healthy:" >&2
$COMPOSE logs --tail 80 api web >&2 || true
if [ -n "$PREVIOUS_API" ] && [ -n "$PREVIOUS_WEB" ]; then
  echo "Going back to $PREVIOUS_API and $PREVIOUS_WEB (the database keeps the migrations; restore a backup if needed)" >&2
  API_IMAGE="$PREVIOUS_API" WEB_IMAGE="$PREVIOUS_WEB" $COMPOSE up -d api web
  docker tag "$PREVIOUS_API" kachabity-api:current
  docker tag "$PREVIOUS_WEB" kachabity-web:current
fi
exit 1

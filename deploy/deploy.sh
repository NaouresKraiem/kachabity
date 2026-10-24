#!/bin/sh
# Deploys an API image on the server (run by .github/workflows/deploy.yml over SSH, in /opt/kachabity):
# back up the database, apply pending migrations, start the new image, and go back to the
# previous image if it doesn't become healthy. Usage: ./deploy.sh ghcr.io/<owner>/kachabity-api:<sha>
set -eu
cd "$(dirname "$0")"
NEW_IMAGE="$1"
COMPOSE="docker compose -f docker-compose.prod.yml"
PREVIOUS_IMAGE="$(cat current-image 2>/dev/null || true)"

echo "Deploying $NEW_IMAGE (previous: ${PREVIOUS_IMAGE:-none})"
export API_IMAGE="$NEW_IMAGE"
$COMPOSE pull api
# --wait: until Postgres accepts connections (its health check), or the migrations would fail.
$COMPOSE up -d --wait db

# A backup before any migration: migrations can't be undone by switching images.
if [ -n "$PREVIOUS_IMAGE" ]; then ./backup.sh; fi

# Pending migrations (an empty database gets db/baseline.sql first), with the new image's files.
$COMPOSE run --rm --no-deps api node scripts/migrate.mjs

$COMPOSE up -d --remove-orphans

# Wait up to 2 minutes for the API's health check.
for _ in $(seq 24); do
  status="$(docker inspect --format '{{.State.Health.Status}}' "$($COMPOSE ps -q api)" 2>/dev/null || echo starting)"
  if [ "$status" = "healthy" ]; then
    echo "$NEW_IMAGE" > current-image
    docker tag "$NEW_IMAGE" kachabity-api:current
    # Old API images go; the current one and the previous one (for a rollback) stay.
    docker images "${NEW_IMAGE%:*}" --format '{{.Repository}}:{{.Tag}}' \
      | grep -v -x -e "$NEW_IMAGE" -e "${PREVIOUS_IMAGE:-none}" -e "${NEW_IMAGE%:*}:latest" \
      | xargs -r docker rmi >/dev/null 2>&1 || true
    echo "Deployed: $NEW_IMAGE"
    exit 0
  fi
  sleep 5
done

echo "The new API did not become healthy:" >&2
$COMPOSE logs --tail 80 api >&2 || true
if [ -n "$PREVIOUS_IMAGE" ]; then
  echo "Going back to $PREVIOUS_IMAGE (the database keeps the migrations; restore a backup if needed)" >&2
  API_IMAGE="$PREVIOUS_IMAGE" $COMPOSE up -d api
  docker tag "$PREVIOUS_IMAGE" kachabity-api:current
fi
exit 1

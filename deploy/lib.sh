#!/usr/bin/env bash
# Shared helpers for the deploy scripts.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC2034 # used by the scripts that source this file
REPO_DIR="$(dirname "$DEPLOY_DIR")"
ENV_FILE="$DEPLOY_DIR/.env"
CADDY_DIR="${CADDY_DIR:-/opt/caddy}"

say() { printf '\n\033[1m▶ %s\033[0m\n' "$*"; }
die() { printf '\n\033[31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

load_env() {
  [ -f "$ENV_FILE" ] || die "Missing $ENV_FILE. Run deploy/setup.sh first."
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
}

# The app image to run: one built by the CD pipeline (recorded in deploy/.image), or the
# one built on this server.
current_image() { cat "$DEPLOY_DIR/.image" 2>/dev/null || echo "extract-app:latest"; }

compose() {
  APP_IMAGE="$(current_image)" docker compose --env-file "$ENV_FILE" -f "$DEPLOY_DIR/docker-compose.yml" "$@"
}

# True once the app container reports healthy (migrations done, database reachable),
# false after about 3 minutes.
healthy_within() {
  local status=""
  for _ in $(seq 1 90); do
    status="$(docker inspect -f '{{.State.Health.Status}}' extract-app 2>/dev/null || true)"
    [ "$status" = "healthy" ] && return 0
    sleep 2
  done
  return 1
}

wait_healthy() {
  healthy_within && return 0
  docker logs --tail 50 extract-app || true
  die "The app didn't become healthy. Logs are above."
}

confirm() {
  # confirm "question" "word"  -> the user must type the word (skipped with --yes)
  [ "${ASSUME_YES:-}" = "1" ] && return 0
  local answer
  read -r -p "$1 Type '$2' to continue: " answer
  [ "$answer" = "$2" ] || die "Cancelled."
}

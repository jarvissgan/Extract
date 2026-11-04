#!/usr/bin/env bash
# Restores the database from a backup, or imports a SQL dump (e.g. your existing data).
# REPLACES everything currently in the database.
#
#   sudo ./deploy/restore.sh                      # latest backup
#   sudo ./deploy/restore.sh <snapshot-id>        # a specific backup (see backup.sh --list)
#   sudo ./deploy/restore.sh --file dump.sql      # a SQL dump, e.g. exported from your Mac
#
# Add --yes to skip the confirmation.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
load_env
export RESTIC_REPOSITORY RESTIC_PASSWORD

snapshot="latest"
file=""
while [ $# -gt 0 ]; do
  case "$1" in
    --file) file="${2:?--file needs a path}"; shift 2 ;;
    --yes) export ASSUME_YES=1; shift ;;
    *) snapshot="$1"; shift ;;
  esac
done

workdir="$(mktemp -d)"
chmod 700 "$workdir"
trap 'rm -rf "$workdir"' EXIT

if [ -n "$file" ]; then
  [ -f "$file" ] || die "No such file: $file"
  source_sql="$file"
  what="the SQL dump $file"
else
  say "Fetching backup '$snapshot'"
  restic restore "$snapshot" --tag extract --target "$workdir" --quiet
  source_sql="$(find "$workdir" -name extract.sql -type f | head -n 1)"
  [ -n "$source_sql" ] || die "That backup doesn't contain extract.sql."
  what="backup '$snapshot'"
fi

confirm "This replaces ALL data in the Extract database with $what." "restore"

say "Taking a safety backup of the current data first"
"$DEPLOY_DIR/backup.sh" >/dev/null && echo "Saved."

say "Stopping the app"
compose stop app

say "Loading $what"
# Recreate the database, then load the SQL into it. Dumps made with --databases contain
# their own CREATE DATABASE/USE lines; strip them so data always lands in `extract`.
docker exec extract-mariadb sh -c \
  'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" -e "DROP DATABASE IF EXISTS \`$MARIADB_DATABASE\`; CREATE DATABASE \`$MARIADB_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL ON \`$MARIADB_DATABASE\`.* TO \`$MARIADB_USER\`@\`%\`;"'
sed -E '/^(CREATE DATABASE|USE) /d' "$source_sql" |
  docker exec -i extract-mariadb sh -c 'exec mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" "$MARIADB_DATABASE"'

say "Starting the app (applies any newer migrations)"
compose up -d app
wait_healthy
echo "Restored from $what."

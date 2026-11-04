#!/usr/bin/env bash
# Encrypted database backup with restic. Runs nightly from cron (set up by setup.sh) and
# before every deploy. Keeps 7 daily, 4 weekly and 12 monthly backups.
#
#   sudo ./deploy/backup.sh            # back up now
#   sudo ./deploy/backup.sh --list     # show existing backups
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
load_env
export RESTIC_REPOSITORY RESTIC_PASSWORD

if [ "${1:-}" = "--list" ]; then
  restic snapshots --tag extract
  exit 0
fi

# create the (encrypted) backup repository the first time
if ! restic cat config >/dev/null 2>&1; then
  say "Creating backup repository at $RESTIC_REPOSITORY"
  restic init
fi

# Dump to a private temporary file first, so a failed dump never becomes a "backup".
workdir="$(mktemp -d)"
chmod 700 "$workdir"
trap 'rm -rf "$workdir"' EXIT
dump="$workdir/extract.sql"

say "Dumping the database"
docker exec extract-mariadb sh -c \
  'exec mariadb-dump --single-transaction --routines --triggers --default-character-set=utf8mb4 -uroot -p"$MARIADB_ROOT_PASSWORD" --databases "$MARIADB_DATABASE"' \
  >"$dump"
grep -q "Dump completed" "$dump" || die "The database dump looks incomplete; no backup was saved."

say "Saving encrypted backup"
restic backup --tag extract --host extract "$dump" --quiet
restic forget --tag extract --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --prune --quiet
echo "Backup done at $(date -u '+%F %T UTC'). Backups:"
restic snapshots --tag extract --compact | tail -n 4

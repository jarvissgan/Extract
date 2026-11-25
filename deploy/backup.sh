#!/usr/bin/env bash
# Encrypted database backup with restic. Runs nightly from cron (set up by setup.sh) and
# before every deploy. Keeps 7 daily, 4 weekly and 12 monthly backups.
#
#   sudo ./deploy/backup.sh            # back up now
#   sudo ./deploy/backup.sh --list     # show existing backups
#   sudo ./deploy/backup.sh --check    # check the latest backup is recent and restorable
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
load_env
export RESTIC_REPOSITORY RESTIC_PASSWORD

if [ "${1:-}" = "--list" ]; then
  restic snapshots --tag extract
  exit 0
fi

# --check: catches backups that silently stopped, came out empty, or can't be read back.
# Runs nightly after the backup (see install_backup_cron in lib.sh); the result is kept in
# deploy/.backup-status and shown after every deploy.
if [ "${1:-}" = "--check" ]; then
  checked_at="$(date -u '+%F %T UTC')"
  fail() {
    echo "failed $checked_at: $*" >"$BACKUP_STATUS_FILE"
    die "Backup check failed: $*"
  }

  say "Checking the latest backup"
  latest="$(restic snapshots --tag extract --latest 1 --json 2>/dev/null | grep -o '"time":"[^"]*"' | head -n 1 | cut -d'"' -f4)" ||
    fail "the backup repository can't be read (wrong RESTIC_PASSWORD or repository missing?)"
  [ -n "$latest" ] || fail "there are no backups yet"
  age_hours=$(( ( $(date +%s) - $(date -d "$latest" +%s) ) / 3600 ))
  [ "$age_hours" -le 26 ] || fail "the latest backup is ${age_hours} hours old (nightly backups may have stopped)"

  # restore the latest dump somewhere private and make sure it's a complete database dump
  workdir="$(mktemp -d)"
  chmod 700 "$workdir"
  trap 'rm -rf "$workdir"' EXIT
  restic restore latest --tag extract --target "$workdir" --quiet >/dev/null || fail "the latest backup couldn't be restored"
  dump="$(find "$workdir" -name extract.sql -type f | head -n 1)"
  [ -n "$dump" ] || fail "the latest backup has no extract.sql in it"
  grep -q "Dump completed" "$dump" || fail "the restored dump is incomplete"
  grep -q "CREATE TABLE \`transaction\`" "$dump" || fail "the restored dump has no transaction table"
  size="$(du -h "$dump" | cut -f1)"

  # and that the encrypted repository itself is intact (reads a sample of the data each night)
  restic check --read-data-subset=5% --quiet || fail "restic found damage in the backup repository"

  echo "ok $checked_at: latest backup $latest (${age_hours}h old, $size dump restored and verified)" | tee "$BACKUP_STATUS_FILE"
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

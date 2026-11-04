#!/usr/bin/env bash
# Updates the server to the latest code: backs up, pulls, rebuilds, applies migrations,
# restarts. About a minute of downtime while the new version starts.
#
#   sudo ./deploy/deploy.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
load_env
cd "$REPO_DIR" || exit 1

branch="${DEPLOY_BRANCH:-master}"
before="$(git rev-parse --short HEAD)"

say "Backing up before updating"
"$DEPLOY_DIR/backup.sh" >/dev/null && echo "Saved."

say "Pulling $branch"
git fetch --quiet origin "$branch"
git checkout --quiet "$branch"
git merge --ff-only --quiet "origin/$branch" || die "Local changes on the server block the update. Run 'git status' in $REPO_DIR."
after="$(git rev-parse --short HEAD)"

say "Building and restarting ($before → $after)"
compose up -d --build
wait_healthy
docker image prune -f >/dev/null

echo "Deployed $after."
[ "$before" = "$after" ] && echo "(No new commits; rebuilt anyway.)"
exit 0

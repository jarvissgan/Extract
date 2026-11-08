#!/usr/bin/env bash
# Updates the server: backs up, updates the code, starts the new version (applying any new
# migrations), and checks it's healthy. About a minute of downtime while it starts.
#
#   sudo ./deploy/deploy.sh                 build on this server from the latest master
#   sudo ./deploy/deploy.sh --rollback      go back to the previous version
#
# The CD pipeline (.github/workflows/deploy.yml, via deploy/ci-entry.sh) runs:
#   deploy.sh --image ghcr.io/<owner>/extract:<commit> --registry-user <name>
# with a short-lived registry token on stdin. It downloads that ready-made image instead of
# building, and rolls back automatically if the new version doesn't become healthy.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
load_env
cd "$REPO_DIR" || exit 1

image=""
registry_user=""
rollback=0
while [ $# -gt 0 ]; do
  case "$1" in
    --image) image="${2:-}"; shift 2 ;;
    --registry-user) registry_user="${2:-}"; shift 2 ;;
    --rollback) rollback=1; shift ;;
    *) die "Unknown option: $1" ;;
  esac
done

IMAGE_PATTERN='^ghcr\.io/[a-z0-9._-]+/[a-z0-9._-]+:[0-9a-f]{40}$'
[ -z "$image" ] || [[ "$image" =~ $IMAGE_PATTERN ]] || die "Not an image this script deploys: $image"
[ -z "$registry_user" ] || [[ "$registry_user" =~ ^[A-Za-z0-9-]{1,39}$ ]] || die "Invalid registry user."
if [ -n "$image" ]; then
  # only this repository's own image (ghcr.io/<owner>/<repo>, lowercase)
  origin="$(git config --get remote.origin.url)"
  repo_path="$(printf '%s' "$origin" | sed -E 's#^(https://github\.com/|git@github\.com:)##; s#\.git$##' | tr '[:upper:]' '[:lower:]')"
  [ "${image%:*}" = "ghcr.io/$repo_path" ] || die "Only ghcr.io/$repo_path images can be deployed here."
fi

branch="${DEPLOY_BRANCH:-master}"
before="$(git rev-parse --short HEAD)"
previous="$(current_image)"

# Starts $1 as the app image and waits for it to be healthy; returns non-zero if it isn't.
start_image() {
  echo "$1" >"$DEPLOY_DIR/.image"
  compose up -d --no-build && healthy_within
}

# Keeps the running image and the one before it; removes older pipeline images.
prune_images() {
  local keep_a keep_b repo
  keep_a="$(current_image)"
  keep_b="$(cat "$DEPLOY_DIR/.previous-image" 2>/dev/null || true)"
  repo="${keep_a%:*}"
  if [[ "$repo" == ghcr.io/* ]]; then
    docker images "$repo" --format '{{.Repository}}:{{.Tag}}' | while read -r old; do
      [ "$old" = "$keep_a" ] || [ "$old" = "$keep_b" ] || docker rmi "$old" >/dev/null 2>&1 || true
    done
  fi
  docker image prune -f >/dev/null
}

if [ "$rollback" = "1" ]; then
  target="$(cat "$DEPLOY_DIR/.previous-image" 2>/dev/null || true)"
  [ -n "$target" ] || die "There's no previous version to roll back to."
  docker image inspect "$target" >/dev/null 2>&1 || die "The previous image ($target) is no longer on this server."
  say "Rolling back to $target"
  echo "$previous" >"$DEPLOY_DIR/.previous-image"
  start_image "$target" || { docker logs --tail 50 extract-app || true; die "The previous version didn't become healthy either. Logs are above."; }
  echo "Rolled back to $target."
  exit 0
fi

say "Backing up before updating"
"$DEPLOY_DIR/backup.sh" >/dev/null && echo "Saved."

say "Updating the code from $branch"
git fetch --quiet origin "$branch"
if [ -n "$image" ]; then
  # run the scripts and compose file from the same commit as the image
  commit="${image##*:}"
  git cat-file -e "$commit^{commit}" 2>/dev/null || die "Commit $commit isn't on $branch here."
  git checkout --quiet --detach "$commit"
else
  git checkout --quiet "$branch"
  git merge --ff-only --quiet "origin/$branch" || die "Local changes on the server block the update. Run 'git status' in $REPO_DIR."
fi
after="$(git rev-parse --short HEAD)"

if [ -n "$image" ]; then
  say "Downloading $image"
  if [ -n "$registry_user" ]; then
    # short-lived token from the pipeline, on stdin; not kept on the server
    IFS= read -r token || die "No registry token on stdin."
    printf '%s' "$token" | docker login ghcr.io -u "$registry_user" --password-stdin >/dev/null
  fi
  pulled=0
  docker pull --quiet "$image" >/dev/null && pulled=1
  [ -n "$registry_user" ] && docker logout ghcr.io >/dev/null 2>&1
  [ "$pulled" = "1" ] || die "Couldn't download $image."

  say "Starting the new version ($before → $after)"
  if start_image "$image"; then
    [ "$previous" != "$image" ] && echo "$previous" >"$DEPLOY_DIR/.previous-image"
  else
    docker logs --tail 50 extract-app || true
    say "The new version isn't healthy: rolling back to $previous"
    start_image "$previous" || die "The previous version didn't come back either. Check: docker logs extract-app"
    die "Deploy of $after failed and was rolled back. Logs are above."
  fi
else
  say "Building and restarting ($before → $after)"
  [ "$previous" != "extract-app:latest" ] && echo "$previous" >"$DEPLOY_DIR/.previous-image"
  echo "extract-app:latest" >"$DEPLOY_DIR/.image"
  compose up -d --build
  wait_healthy
fi

prune_images
echo "Deployed $after."
exit 0

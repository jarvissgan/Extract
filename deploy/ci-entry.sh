#!/usr/bin/env bash
# The only thing the CD pipeline's SSH key can run (a forced command in the deploy user's
# authorized_keys, set up by deploy/setup-cd.sh). The pipeline connects with:
#   ssh deploy@server "deploy <image> <registry user>"   (registry token on stdin)
# and this passes exactly that on to deploy.sh, as root through a narrow sudo rule.
set -euo pipefail

read -r action image user extra <<<"${SSH_ORIGINAL_COMMAND:-}"
if [ "$action" != "deploy" ] || [ -z "${image:-}" ] || [ -z "${user:-}" ] || [ -n "${extra:-}" ]; then
  echo "Only 'deploy <image> <registry user>' is allowed." >&2
  exit 2
fi
[[ "$image" =~ ^ghcr\.io/[a-z0-9._-]+/[a-z0-9._-]+:[0-9a-f]{40}$ ]] || { echo "Bad image name." >&2; exit 2; }
[[ "$user" =~ ^[A-Za-z0-9-]{1,39}$ ]] || { echo "Bad registry user." >&2; exit 2; }

exec sudo -n "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/deploy.sh" --image "$image" --registry-user "$user"

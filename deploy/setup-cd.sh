#!/usr/bin/env bash
# One-time setup for automatic deploys from GitHub (.github/workflows/deploy.yml).
#
#   sudo ./deploy/setup-cd.sh
#
# Creates a `deploy` user whose SSH key can only run deploy/ci-entry.sh (no shell, no
# forwarding), lets it run deploy.sh as root and nothing else, and prints what to add to
# GitHub. Safe to run again: it replaces the key.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
[ "$(id -u)" -eq 0 ] || die "Run with sudo: sudo ./deploy/setup-cd.sh"
load_env

USER_NAME=deploy
ENTRY="$DEPLOY_DIR/ci-entry.sh"
chmod 755 "$ENTRY" "$DEPLOY_DIR/deploy.sh"
# the scripts run as root, so only root may change them
chown root:root "$ENTRY" "$DEPLOY_DIR/deploy.sh" "$DEPLOY_DIR/lib.sh"

say "Creating the '$USER_NAME' user"
id "$USER_NAME" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$USER_NAME"
passwd -l "$USER_NAME" >/dev/null

say "Allowing it to run deploy.sh (and nothing else) as root"
cat >/etc/sudoers.d/extract-deploy <<SUDO
$USER_NAME ALL=(root) NOPASSWD: $DEPLOY_DIR/deploy.sh
SUDO
chmod 440 /etc/sudoers.d/extract-deploy
visudo -cf /etc/sudoers.d/extract-deploy >/dev/null || die "sudoers rule is invalid"

say "Creating its SSH key (it can only start a deploy)"
home="$(getent passwd "$USER_NAME" | cut -d: -f6)"
install -d -m 700 -o "$USER_NAME" -g "$USER_NAME" "$home/.ssh"
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT
ssh-keygen -q -t ed25519 -N "" -C "extract-cd" -f "$workdir/key"
echo "command=\"$ENTRY\",restrict $(cat "$workdir/key.pub")" >"$home/.ssh/authorized_keys"
chown "$USER_NAME:$USER_NAME" "$home/.ssh/authorized_keys"
chmod 600 "$home/.ssh/authorized_keys"

host="${APP_DOMAIN:-$(hostname -f)}"
known_hosts="$(for k in /etc/ssh/ssh_host_*_key.pub; do echo "$host $(cut -d' ' -f1,2 "$k")"; done)"

cat <<DONE

  Add these in GitHub → the Extract repo → Settings → Secrets and variables → Actions.

  Secrets:
    DEPLOY_HOST         $host
    DEPLOY_USER         $USER_NAME
    DEPLOY_SSH_KEY      (everything between the lines below)
    DEPLOY_KNOWN_HOSTS  (everything between the lines below that)

  Variables (public settings baked into the website):
    APP_DOMAIN          ${APP_DOMAIN:-}
    AUTH0_DOMAIN        ${AUTH0_DOMAIN:-}
    AUTH0_CLIENT_ID     ${AUTH0_CLIENT_ID:-}
    AUTH0_AUDIENCE      ${AUTH0_AUDIENCE:-}

  If SSH isn't on port 22, also add a DEPLOY_PORT secret.

----- DEPLOY_SSH_KEY -----
$(cat "$workdir/key")
----- DEPLOY_KNOWN_HOSTS -----
$known_hosts
--------------------------

  The private key is shown only now and isn't kept on this server.
DONE

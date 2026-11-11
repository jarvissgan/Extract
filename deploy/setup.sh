#!/usr/bin/env bash
# First-time setup on a fresh Ubuntu server. Safe to run again: existing secrets are kept.
#
#   sudo ./deploy/setup.sh
#
# Asks for your domain and Auth0 settings (or set APP_DOMAIN, AUTH0_DOMAIN, AUTH0_CLIENT_ID,
# AUTH0_AUDIENCE, ACME_EMAIL beforehand). SKIP_SYSTEM=1 skips installing packages and the
# firewall, for servers where Docker is already set up.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

[ "$(id -u)" -eq 0 ] || die "Run with sudo: sudo ./deploy/setup.sh"

# ---------- 1. system packages, firewall, automatic security updates ----------
if [ "${SKIP_SYSTEM:-}" != "1" ]; then
  say "Installing packages (Docker, restic, firewall, automatic security updates)"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -q
  apt-get install -y -q ca-certificates curl git openssl restic ufw unattended-upgrades cron
  if ! command -v docker >/dev/null; then
    curl -fsSL https://get.docker.com | sh
  fi
  systemctl enable --now docker cron

  # security updates install themselves every day
  dpkg-reconfigure -f noninteractive unattended-upgrades

  # only SSH and web traffic in
  ufw allow OpenSSH
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow 443/udp
  ufw --force enable
fi

command -v docker >/dev/null || die "Docker isn't installed."
command -v restic >/dev/null || die "restic isn't installed (apt-get install restic)."

# ---------- 2. settings and secrets ----------
ask() {
  # ask VAR "question" [default]
  local var="$1" question="$2" default="${3:-}" value
  value="${!var:-}"
  if [ -z "$value" ]; then
    read -r -p "$question${default:+ [$default]}: " value
    value="${value:-$default}"
  fi
  [ -n "$value" ] || die "$var is required."
  printf -v "$var" '%s' "$value"
}

if [ -f "$ENV_FILE" ]; then
  say "Keeping existing settings and secrets in deploy/.env"
  load_env
else
  say "Settings"
  ask APP_DOMAIN "Address for Extract, e.g. extract.legallyalive.com"
  ask AUTH0_DOMAIN "Auth0 domain, e.g. your-tenant.us.auth0.com"
  AUTH0_DOMAIN="${AUTH0_DOMAIN#https://}"
  AUTH0_DOMAIN="${AUTH0_DOMAIN%/}"
  ask AUTH0_CLIENT_ID "Auth0 application Client ID"
  ask AUTH0_AUDIENCE "Auth0 API identifier (audience)"

  say "Generating passwords"
  DB_PASSWORD="$(openssl rand -hex 24)"
  MARIADB_ROOT_PASSWORD="$(openssl rand -hex 24)"
  RESTIC_PASSWORD="$(openssl rand -hex 24)"

  umask 077
  cat >"$ENV_FILE" <<ENV
# Created by deploy/setup.sh on $(date -u +%F). Server only: never commit or share.
APP_DOMAIN=$APP_DOMAIN
AUTH0_DOMAIN=$AUTH0_DOMAIN
AUTH0_CLIENT_ID=$AUTH0_CLIENT_ID
AUTH0_AUDIENCE=$AUTH0_AUDIENCE
RATE_LIMIT_PER_MINUTE=300
DEPLOY_BRANCH=${DEPLOY_BRANCH:-master}

DB_PASSWORD=$DB_PASSWORD
MARIADB_ROOT_PASSWORD=$MARIADB_ROOT_PASSWORD
RESTIC_PASSWORD=$RESTIC_PASSWORD

# Local backups. For off-server copies see deploy/README.md ("Off-server backups").
RESTIC_REPOSITORY=/var/backups/extract
ENV
  chmod 600 "$ENV_FILE"
  NEW_SECRETS=1
  # the rest of setup reads the settings just written
  load_env
fi

# ---------- 3. shared HTTPS proxy (Caddy) ----------
say "Setting up HTTPS (Caddy) in $CADDY_DIR"
docker network inspect web >/dev/null 2>&1 || docker network create web >/dev/null
mkdir -p "$CADDY_DIR/sites"
[ -f "$CADDY_DIR/docker-compose.yml" ] || cp "$DEPLOY_DIR/caddy/docker-compose.yml" "$CADDY_DIR/"
if [ ! -f "$CADDY_DIR/Caddyfile" ]; then
  cp "$DEPLOY_DIR/caddy/Caddyfile" "$CADDY_DIR/"
  if [ -n "${ACME_EMAIL:-}" ]; then
    # certificate expiry notices go to this address
    sed -i "s|# email {\$ACME_EMAIL}|email $ACME_EMAIL|" "$CADDY_DIR/Caddyfile"
  fi
fi
cat >"$CADDY_DIR/sites/extract.caddy" <<CADDY
$APP_DOMAIN {
	encode zstd gzip
	reverse_proxy extract:3000
}
CADDY
docker compose -f "$CADDY_DIR/docker-compose.yml" up -d
docker exec caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1 || true

# ---------- 4. the app ----------
say "Building and starting Extract (this takes a few minutes the first time)"
cd "$REPO_DIR" || exit 1
compose up -d --build
wait_healthy

# ---------- 5. nightly encrypted backups ----------
say "Setting up nightly backups"
mkdir -p "$(dirname "${RESTIC_REPOSITORY:-/var/backups/extract}")"
"$DEPLOY_DIR/backup.sh"
if [ -d /etc/cron.d ]; then
  cat >/etc/cron.d/extract-backup <<CRON
# Nightly encrypted database backup for Extract (03:37 server time, after the other apps on a shared server)
37 3 * * * root $DEPLOY_DIR/backup.sh >> /var/log/extract-backup.log 2>&1
CRON
  chmod 644 /etc/cron.d/extract-backup
fi

# ---------- done ----------
say "Extract is running"
cat <<DONE

  Address:  https://$APP_DOMAIN
  Health:   https://$APP_DOMAIN/healthz

  Still to do (see deploy/README.md for details):
  1. DNS: an A record for ${APP_DOMAIN%%.*} pointing to this server's IP address.
  2. Auth0 > Applications > your app > Settings:
       Allowed Callback URLs:  https://$APP_DOMAIN/setup
       Allowed Logout URLs:    https://$APP_DOMAIN
       Allowed Web Origins:    https://$APP_DOMAIN
  3. Off-server backups (recommended): see "Off-server backups" in deploy/README.md.
DONE

if [ "${NEW_SECRETS:-}" = "1" ]; then
  cat <<SECRETS

  ┌─ SAVE THESE IN YOUR PASSWORD MANAGER NOW (shown only once) ─────────────
  │ Extract database password:   $DB_PASSWORD
  │ MariaDB root password:       $MARIADB_ROOT_PASSWORD
  │ Backup encryption password:  $RESTIC_PASSWORD
  │ Without the backup password, backups can't be restored.
  │ They're also stored in $ENV_FILE (readable by root only).
  └─────────────────────────────────────────────────────────────────────────
SECRETS
fi

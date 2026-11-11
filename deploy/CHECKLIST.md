# Go-live checklist

Work top to bottom. Details for each step are in [README.md](README.md).

## Before you start

- [ ] `master` has everything you want live (the server deploys `master`).
- [ ] Domain decided, e.g. `extract.legallyalive.com`.
- [ ] Server ready: Ubuntu 24.04, at least 1 GB RAM (add 2 GB swap if building on the server), SSH access as root or a sudo user.
- [ ] Auth0: the application's Callback, Logout and Web Origin URLs include `https://<domain>` (README → Auth0 settings). Domain, Client ID and API identifier (audience) at hand.

## DNS

- [ ] `A` record for the domain → the server's IPv4 address (Cloudflare: **DNS only**).
- [ ] `dig +short <domain>` returns the server's IP (may take a few minutes).

## Server

- [ ] Logged in: `ssh root@<server ip>`.
- [ ] Read-only deploy key added to GitHub and the repo cloned to `/opt/extract`.
- [ ] `sudo ./deploy/setup.sh` finished without errors. On a server that already runs another app (e.g. Calendaamor) and Caddy: `sudo SKIP_SYSTEM=1 ./deploy/setup.sh`.
- [ ] Database and backup passwords from `deploy/.env` saved in your password manager.
- [ ] `docker ps` shows `extract-app` and `extract-mariadb` as `healthy`, and `caddy` running.

## Smoke test (in a browser)

- [ ] `https://<domain>/healthz` shows `{"ok":true}` with a valid padlock.
- [ ] Log in with Auth0 and create your account (or your existing data shows, if you restored it).
- [ ] Add a transaction, see it on Home and Transactions, then delete it.
- [ ] Import a statement or CSV and check the review screen.
- [ ] On your phone: the bottom tab bar shows and the site can be added to the home screen.

## Backups and safety

- [ ] `sudo ./deploy/backup.sh --list` shows at least one backup.
- [ ] `cat /etc/cron.d/extract-backup` exists (nightly backups).
- [ ] `sudo ufw status` shows only OpenSSH, 80 and 443.
- [ ] Optional: off-server backups (R2) set up.
- [ ] Optional: automatic deploys (`sudo ./deploy/setup-cd.sh` + GitHub secrets and variables).

## If something goes wrong

| Problem | Fix |
| --- | --- |
| Certificate or site not loading | DNS not pointing yet, or Cloudflare proxy on. `docker logs caddy` |
| Login fails or loops | Auth0 URLs don't include the domain, or wrong Client ID/audience in `deploy/.env` (then `sudo ./deploy/deploy.sh`) |
| App unhealthy | `docker logs --tail 100 extract-app` |
| Bad deploy | `sudo ./deploy/deploy.sh --rollback` |
| Build runs out of memory | Add 2 GB swap (README → Troubleshooting), or use automatic deploys so the server never builds |

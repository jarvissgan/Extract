# Deploying Extract

One small Ubuntu server runs everything with Docker:

```
internet ──► Caddy (HTTPS, shared by all your apps) ──► Extract app ──► MariaDB
             ports 80/443                               (private network, not reachable from outside)
```

- **Caddy** gets and renews HTTPS certificates automatically, and can serve more apps later (`bungo.legallyalive.com`, ...).
- **The Extract app** is one container: the API plus the built website. New database migrations are applied automatically when it starts.
- **Backups** are encrypted with restic, run nightly and before every deploy, and are kept for 7 days, 4 weeks and 12 months.

Cost: the server (about US$5–7/month for 1 GB RAM in Singapore) plus the domain (about US$10–15/year).

Going live for the first time? [CHECKLIST.md](CHECKLIST.md) is the short version to tick through.

---

## First-time setup (about an hour)

### 1. Domain and DNS
1. Buy the domain (e.g. `legallyalive.com`) at Cloudflare, Porkbun or Namecheap.
2. Create the server first (step 2) to get its IP address, then add a DNS record:

   | Type | Name | Value |
   | --- | --- | --- |
   | A | `extract` | your server's IPv4 address |

   On Cloudflare, set it to **DNS only** (grey cloud) so Caddy can get its certificate.

### 2. The server
Create an **Ubuntu 24.04** server in **Singapore** with at least **1 GB RAM** (DigitalOcean, Vultr, Linode, Hetzner...). Add your SSH key when creating it, then log in:

```bash
ssh root@YOUR_SERVER_IP
```

### 3. Auth0 settings
In the Auth0 dashboard:
- **Applications → your app → Settings**:
  - Allowed Callback URLs: `https://extract.legallyalive.com/setup`
  - Allowed Logout URLs: `https://extract.legallyalive.com`
  - Allowed Web Origins: `https://extract.legallyalive.com`
  - Refresh Token Rotation: **on**
- **APIs → your API → Settings**: Allow Offline Access: **on** (the app uses refresh tokens).

Keep any `http://localhost:5173` entries if you still develop locally (separate them with commas).

Note your Auth0 **Domain**, the app's **Client ID**, and the API's **Identifier** (the "audience"); setup asks for them.

### 4. Install
On the server:

```bash
git clone https://github.com/jarvissgan/Extract.git /opt/extract
cd /opt/extract
sudo ./deploy/setup.sh
```

If the repository is private, clone with a read-only **deploy key** instead: run `ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519`, add the contents of `~/.ssh/id_ed25519.pub` under GitHub → the repo → Settings → Deploy keys (leave "write access" off), then `git clone git@github.com:jarvissgan/Extract.git /opt/extract`.

`setup.sh`:
1. installs Docker, restic, a firewall (only SSH, HTTP and HTTPS open) and automatic security updates,
2. asks for your domain and Auth0 settings,
3. **generates all passwords** and stores them in `deploy/.env` (readable by root only),
4. starts Caddy and the app, and sets up nightly backups at 03:37.

### 5. Save the secrets
At the end, setup prints three passwords **once**. Put them in your password manager now. Without the **backup encryption password**, backups can't be restored.

### 6. Check it
Open `https://extract.legallyalive.com`. The first visit can take a minute while the certificate is issued. `https://extract.legallyalive.com/healthz` should show `{"ok":true}`.

### 7. Bring your existing data (optional)
On your Mac, export the database you've been using:

```bash
mariadb-dump -u root -p extract > extract-export.sql
```

(`mysqldump` works too.) Copy it to the server and load it. This **replaces** whatever is in the server's database:

```bash
scp extract-export.sql root@YOUR_SERVER_IP:/tmp/
```

Then, on the server:

```bash
sudo /opt/extract/deploy/restore.sh --file /tmp/extract-export.sql
```

```bash
shred -u /tmp/extract-export.sql
```

Missing columns and tables are added automatically when the app restarts. Existing accounts are linked to their Auth0 login by email the first time each person signs in.

---

## Everyday tasks

| Task | Command (on the server, in `/opt/extract`) |
| --- | --- |
| Update to the latest `master` (building here) | `sudo ./deploy/deploy.sh` |
| Go back to the previous version | `sudo ./deploy/deploy.sh --rollback` |
| Back up now | `sudo ./deploy/backup.sh` |
| List backups | `sudo ./deploy/backup.sh --list` |
| Restore the latest backup | `sudo ./deploy/restore.sh` |
| Restore a specific backup | `sudo ./deploy/restore.sh <id from --list>` |
| Change the database password | `sudo ./deploy/rotate-db-password.sh` |
| See the app's logs | `docker logs --tail 100 -f extract-app` |
| Is it running? | `docker ps` (both `extract-app` and `extract-mariadb` should say `healthy`) |

`deploy.sh` backs up, pulls `master`, rebuilds and restarts, with about a minute of downtime. To deploy a different branch, change `DEPLOY_BRANCH` in `deploy/.env`.

`restore.sh` always takes a safety backup of the current data before replacing it.

---

## Automatic deploys (CD)

Once set up, every push to `master` that passes CI goes live by itself:

```
push to master → CI (tests) → Deploy workflow: builds the image on GitHub, pushes it to
ghcr.io/<you>/extract → SSH to the server → deploy.sh downloads that image and restarts
```

The server never builds anything, so deploys are quicker and a 1 GB server won't run out of
memory. If the new version doesn't become healthy within 3 minutes, it switches back to the
previous one automatically.

### Set it up (once, about 10 minutes)
1. On the server: `cd /opt/extract && sudo ./deploy/setup-cd.sh`. It creates an `extract-deploy` user
   whose SSH key can *only* start a deploy (no shell), and prints:
   - **secrets**: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS` (and
     `DEPLOY_PORT` if SSH isn't on 22)
   - **variables**: `APP_DOMAIN`, `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_AUDIENCE`
2. On GitHub: the repo → **Settings → Secrets and variables → Actions**: add each secret under
   *Secrets* and each variable under *Variables*.
3. Push to `master` (or **Actions → Deploy → Run workflow**) and watch it in the Actions tab.

Until the secrets exist the Deploy workflow just skips, so it's safe to have it in the repo.

### Good to know
- **Rollback:** `sudo ./deploy/deploy.sh --rollback` on the server switches to the previous image
  (the server keeps the current and previous ones). To redeploy any older commit, run the
  Deploy workflow from that commit, or revert on `master`.
- **Registry access:** the image is private (the repo is private). The server logs in with the
  workflow's own token, which expires when the job ends, so no registry password is stored.
- **Manual deploys still work:** `sudo ./deploy/deploy.sh` builds on the server as before.
- **Turning it off:** delete `/etc/sudoers.d/extract-deploy` and the `extract-deploy` user's
  `~/.ssh/authorized_keys`, or remove the `DEPLOY_HOST` secret.

---

## Off-server backups (recommended)

By default backups are stored on the server itself, so they won't survive losing the server. To also keep them off the server, for example in **Cloudflare R2** (free up to 10 GB):

1. In Cloudflare: **R2 → Create bucket** (e.g. `extract-backups`), then **Manage API tokens → Create API token** with *Object Read & Write* for that bucket. Note the Access Key ID, Secret Access Key and your Account ID.
2. On the server, edit `deploy/.env` (`sudo nano /opt/extract/deploy/.env`):

   ```
   RESTIC_REPOSITORY=s3:https://<ACCOUNT_ID>.r2.cloudflarestorage.com/extract-backups
   AWS_ACCESS_KEY_ID=<access key id>
   AWS_SECRET_ACCESS_KEY=<secret access key>
   ```

3. Run `sudo ./deploy/backup.sh`. It creates the encrypted repository and saves the first backup.

Backblaze B2 works the same way with its S3 endpoint. The backup encryption password stays the same; the storage provider only ever sees encrypted data.

---

## Secrets

| Secret | Where it lives |
| --- | --- |
| Database passwords, backup encryption password, backup storage keys | `deploy/.env` on the server only (`chmod 600`), plus your password manager |
| Auth0 domain, client ID, audience | Also in `deploy/.env`, but **not secret**: they're visible in the browser by design |
| SSH key | Your computer and your password manager |

Rules:
- Never commit `deploy/.env` (it's in `.gitignore`) or paste its contents into chats, issues or pull requests.
- Only the app container gets the app's database password. The root password stays with MariaDB, and backup keys stay on the host.
- To change the database password, use `rotate-db-password.sh` rather than editing `.env` by hand.
- Production secrets never need to be on your laptop: local development uses its own Docker database.

---

## Adding another app (e.g. `bungo.legallyalive.com`)

1. DNS: add an `A` record for `bungo` pointing to the same server.
2. Run the app in Docker, attached to the shared `web` network with a name Caddy can reach (e.g. `networks: { web: { aliases: [bungo] } }`, with `web` marked `external: true`).
3. Create `/opt/caddy/sites/bungo.caddy`:

   ```
   bungo.legallyalive.com {
       encode zstd gzip
       reverse_proxy bungo:8080
   }
   ```

4. Reload Caddy: `docker exec caddy caddy reload --config /etc/caddy/Caddyfile`.

Give each app its own database and database user.

---

## Troubleshooting

- **The site doesn't load or the certificate fails:** check the DNS record points to the server (`dig +short extract.legallyalive.com`), it's set to "DNS only" on Cloudflare, and ports 80 and 443 are open. Caddy's logs: `docker logs caddy`.
- **Login fails or loops:** check the three URLs in the Auth0 application settings (step 3) exactly match your domain, and that Allow Offline Access is on for the API.
- **The app isn't healthy after a deploy:** `docker logs --tail 100 extract-app`. A failed migration is shown there. Restore the backup taken just before the deploy with `sudo ./deploy/restore.sh`.
- **Server out of memory:** 1 GB is enough to run Extract. Building during a deploy is the heaviest step; if it fails, add swap with `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`, plus a line in `/etc/fstab` to keep it after reboots.

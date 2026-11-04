# Extract

Full-stack personal finance app built with React + Vite, Mantine UI, Auth0, and MariaDB.

## Stack
- Frontend: React 19, Vite 6, Mantine 8, TypeScript
- Auth: Auth0
- API: Express
- Database: MariaDB 11

## Quick start (offline, no Auth0 needed)
Needs Node 22+ and Docker.

```bash
cp .env.example .env
npm install
npm run setup:dev      # start MariaDB in Docker and fill it with dummy data
npm run dev:offline    # app on http://localhost:5173 with dev login
```

Click **Log in** and pick a seeded user (`dev@extract.local` or `alice@extract.local`), or type any email to try sign-up as a new user. A yellow **Dev auth** badge shows when offline login is on.

## Scripts
| Script | What it does |
| --- | --- |
| `npm run dev` | Frontend + backend with real Auth0 |
| `npm run dev:offline` | Frontend + backend with offline dev login (no Auth0) |
| `npm run db:up` / `db:down` | Start / stop the local MariaDB container (schema applied on first start) |
| `npm run db:seed` | Create dummy users and transactions (see options below) |
| `npm run db:reset -- --yes` | Drop and recreate the tables from `db/schema.sql` (deletes all data) |
| `npm run setup:dev` | `db:up` then `db:seed` |
| `npm run test:api` | API integration tests against the local database |
| `npm run lint` | ESLint |
| `npm run build` | Production build of the frontend |

### Seeding options
```bash
npm run db:seed -- --users me@x.com,friend@x.com --months 12 --per-month 30 --budget 1500 --seed 7
```
Re-running replaces the transactions of the listed users and leaves other users alone. The same options and `--seed` always give the same data.

## Environment
Copy `.env.example` to `.env` and fill it in.

- Variables starting with `VITE_` are bundled into the browser JavaScript, so they must never hold secrets.
- Database and Auth0 API settings use unprefixed names (`DB_*`, `AUTH0_*`) and are only read by the server.

## How auth works
- **Normal mode:** the API checks the Auth0 access token, looks up the user's email via Auth0's `/userinfo`, and only lets them read or change their own account and transactions.
- **Offline mode** (`AUTH_MODE=dev` + `VITE_AUTH_MODE=dev`): the frontend sends `Authorization: Bearer dev:<email>` and the API trusts it. The server refuses to start in this mode with `NODE_ENV=production`, and the dev login code is left out of production builds.

You can call the API directly in offline mode, e.g.:
```bash
curl -H "Authorization: Bearer dev:dev@extract.local" http://localhost:3000/api/user
```

## Database schema
`db/schema.sql` was written from the queries in `api/`. If your real database differs, update it so local setups and tests match.

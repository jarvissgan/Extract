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
npm install
npm run local
```

`npm run local` does everything: creates `.env` from `.env.example` if you don't have one, starts MariaDB in Docker, adds dummy data if the database is empty, and starts the app on http://localhost:5173 with offline login.

Click **Log in** and pick a seeded user (`dev@extract.local` or `alice@extract.local`), or type any email to try sign-up as a new user. A yellow **Dev auth** badge shows when offline login is on.

## Scripts
Day to day you only need the first three.

| Script | What it does |
| --- | --- |
| `npm run local` | Database + dummy data + app with offline login. Add `-- --fresh` to wipe and reseed first |
| `npm run dev` | App with real Auth0 (uses your `.env` database) |
| `npm test` | Starts the database if needed, then runs the API tests |
| `npm run lint` | ESLint |
| `npm run build` | Production build of the frontend |
| `npm run db:seed` | Add dummy data with custom options (see below) |
| `npm run db:reset -- --yes` | Drop and recreate the tables (deletes all data) |
| `npm run db:down` | Stop the database container (data is kept) |

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
- **Offline mode** (`npm run local`, which sets `AUTH_MODE=dev` + `VITE_AUTH_MODE=dev`): the frontend sends `Authorization: Bearer dev:<email>` and the API trusts it. The server refuses to start in this mode with `NODE_ENV=production`, and the dev login code is left out of production builds.

You can call the API directly in offline mode, e.g.:
```bash
curl -H "Authorization: Bearer dev:dev@extract.local" http://localhost:3000/api/user
```

## Database schema
`db/schema.sql` was written from the queries in `api/`. If your real database differs, update it so local setups and tests match.

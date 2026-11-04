# Extract

Personal expense tracker built with React + Vite, Mantine UI, Auth0, Express and MariaDB.

**Features:** monthly dashboard with budget tracking and charts · transactions with search, category filter and sorting · custom categories · monthly recurring transactions · CSV import and export · per-user currency.

## Stack
- Frontend: React 19, Vite 6, Mantine 8, TypeScript
- Auth: Auth0
- API: Express, validated with zod (shared with the frontend in `shared/schemas.js`)
- Database: MariaDB 11 via `mysql2`

## Quick start (offline, no Auth0 needed)
Needs Node 22+ and Docker.

```bash
npm install
npm run local
```

`npm run local` creates `.env` from `.env.example` if you don't have one, starts MariaDB in Docker, applies migrations, adds dummy data if the database is empty, and starts the app on http://localhost:5173 with offline login.

Click **Log in** and pick a seeded user (`dev@extract.local` or `alice@extract.local`), or type any email to try sign-up as a new user. A yellow **Dev auth** badge shows when offline login is on.

## Scripts
| Script | What it does |
| --- | --- |
| `npm run local` | Database + migrations + dummy data + app with offline login. `-- --fresh` wipes and reseeds first |
| `npm run dev` | App with real Auth0 (uses the database in your `.env`) |
| `npm test` | Starts the database if needed, then runs the API tests |
| `npm run test:e2e` | Browser tests with Playwright (starts the app if it isn't running). First time: `npx playwright install chromium` |
| `npm run lint` / `typecheck` | ESLint / TypeScript checks |
| `npm run build` | Production build of the frontend |
| `npm run db:migrate` | Apply new files in `db/migrations` to the database in `.env` |
| `npm run db:seed` | Add dummy data with custom options (see below) |
| `npm run db:reset -- --yes` | Drop all tables and rebuild them from migrations (deletes all data) |
| `npm run db:down` | Stop the database container (data is kept) |

GitHub Actions runs lint, typecheck, build, API tests and browser tests on every push and pull request (`.github/workflows/ci.yml`).

### Seeding options
```bash
npm run db:seed -- --users me@x.com,friend@x.com --months 12 --per-month 30 --budget 1500 --seed 7
```
Each user gets day-to-day spending, an electricity bill, four recurring bills and a custom "Travel" category. Re-running replaces the listed users' data and leaves other users alone. The same options and `--seed` always give the same data.

## Database migrations
Schema changes live in `db/migrations` as numbered SQL files, applied in order and recorded in a `schema_migrations` table.

- To change the schema, add a new file (e.g. `004_add_tags.sql`). Never edit one that has already been applied.
- **Existing databases:** run `npm run db:migrate` once. `001_initial.sql` only creates tables that don't exist, so it's safe on a database that already has data.

## Environment
Copy `.env.example` to `.env` and fill it in.

- Variables starting with `VITE_` are bundled into the browser JavaScript, so they must never hold secrets.
- Database, Auth0 API, `CORS_ORIGIN` and `RATE_LIMIT_PER_MINUTE` are only read by the server.

## How auth works
- **Normal mode:** the API checks the Auth0 access token and finds the account by the token's Auth0 user ID (`sub`). Users can only read or change their own account, transactions and recurring rules.
- **Accounts created before `sub` was stored** are linked automatically on their owner's next login, by verified email (looked up once via Auth0's `/userinfo`).
- **Offline mode** (`npm run local`, which sets `AUTH_MODE=dev` + `VITE_AUTH_MODE=dev`): the frontend sends `Authorization: Bearer dev:<email>` and the API trusts it. The server refuses to start in this mode with `NODE_ENV=production`, and the dev login code is left out of production builds.

You can call the API directly in offline mode:
```bash
curl -H "Authorization: Bearer dev:dev@extract.local" http://localhost:3000/api/user
```

## Dates and time zones
Dates are stored in UTC. The browser sends exact start/end instants for "this month", so months follow the user's local time zone whatever the server's time zone is. Recurring transactions are dated 12:00 UTC on their day.

## CSV import format
A header row with `date`, `name`, `amount`, and optionally `category` (name or key) and `note`, in any order. Dates like `2026-11-04`, `2026-11-04 18:30` or `4/11/2026` work. Files from **Export CSV** can be imported as they are. Every row is checked before anything is saved.

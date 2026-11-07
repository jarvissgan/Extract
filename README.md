# Extract

Personal expense tracker built with React + Vite, Mantine UI, Auth0, Express and MariaDB.

**Features:**
- Dashboard: spending, income and net for any month, comparison with last month, overall and per-category budgets with alerts
- Transactions: expenses and income, search, filters, sorting, bulk re-categorize and delete, CSV import and export
- Reports: 3/6/12-month income vs spending, spending by category over time, savings rate
- Categorization rules ("name contains grab → Transport"), offered automatically when you correct a category
- Custom categories, monthly recurring bills and salary, per-user currency
- Savings goals with targets, deadlines, progress rings, history, and confetti when you reach one
- Light, Dark and "A mode" (butter yellow and pink, with classic Pooh and his hunny pot) appearances, switchable from the header or Settings
- Fast entry: a quick-add bar ("coffee 4.50", "+3200 salary", "lunch 12 yesterday #food"), suggestions from your history,
  "Add another", undo, and shortcuts (N = add, / = quick add); a floating + button on phones
- Import DBS/POSB credit card and account PDF statements: read on your device (never uploaded), reviewed before saving,
  with transfers and card payments left out and duplicates detected
- Download all your data as JSON, or delete your account

Works on phones: bottom tab bar, full-screen forms, lists instead of tables, and it can be added to the home screen as an app. See [`mobile.md`](mobile.md) for the mobile-first rules every change follows.

## Stack
- Frontend: React 19, Vite 6, Mantine 8, TypeScript
- Auth: Auth0
- API: Express, validated with zod (shared with the frontend in `shared/schemas.js`)
- Database: MariaDB 11 via `mysql2` (MySQL 8 works too; CI tests both)

## Quick start (offline, no Auth0 needed)
Needs Node 22+, Docker, and Docker Compose (the `docker compose` plugin from Docker Desktop, or the standalone `docker-compose`, e.g. `brew install docker-compose`).

```bash
npm install
npm run local
```

`npm run local` creates `.env` from `.env.example` if you don't have one, starts its own MariaDB in Docker on `localhost:3307`, applies migrations, adds dummy data if that database is empty, and starts the app on http://localhost:5173 with offline login.

**Two databases:** the dev tools (`npm run local`, `npm test`, `test:e2e`, `db:seed`, `db:reset`) always use that Docker database and ignore the `DB_*` settings in `.env`, so they can never touch your real data. `npm run dev` and `npm run db:migrate` use the database in `.env`. If port 3307 is taken, set `LOCAL_DB_PORT` in `.env`.

Click **Log in** and pick a seeded user (`dev@extract.local` or `alice@extract.local`), or type any email to try sign-up as a new user. A yellow **Dev auth** badge shows when offline login is on.

## Scripts
| Script | What it does |
| --- | --- |
| `npm run local` | Database + migrations + dummy data + app with offline login. `-- --fresh` wipes and reseeds first |
| `npm run dev` | App with real Auth0 (uses the database in your `.env`) |
| `npm test` | Starts the database if needed, then runs the API tests |
| `npm run test:e2e` | Browser tests with Playwright on desktop and phone sizes (starts the app if it isn't running). First time: `npx playwright install chromium` |
| `npm run lint` / `typecheck` | ESLint / TypeScript checks |
| `npm run build` | Production build of the frontend |
| `npm run db:migrate` | Apply new files in `db/migrations` to **the database in `.env`** |
| `npm run db:seed` | Add dummy data to the local Docker database, with custom options (see below) |
| `npm run db:reset -- --yes` | Wipe the local Docker database and rebuild it from migrations |
| `npm run db:down` | Stop the local Docker database (data is kept) |
| `npm run statement:redact -- file.pdf` | Make a privacy-safe text copy of a statement or transaction history (PDF, or a CSV/text export) (digits and personal words masked) to share its layout when adding support for a new bank format |

GitHub Actions runs lint, typecheck, build, API tests and browser tests on every push and pull request (`.github/workflows/ci.yml`).

### Seeding options
```bash
npm run db:seed -- --users me@x.com,friend@x.com --months 12 --per-month 30 --budget 1500 --seed 7
```
Each user gets day-to-day spending, an electricity bill, four recurring bills and a custom "Pets" category. Re-running replaces the listed users' data and leaves other users alone. The same options and `--seed` always give the same data.

## Database migrations
Schema changes live in `db/migrations` as numbered SQL files, applied in order and recorded in a `schema_migrations` table.

- To change the schema, add a new file (e.g. `004_add_tags.sql`). Never edit one that has already been applied.
- **Existing databases:** run `npm run db:migrate` once. `001_initial.sql` only creates tables that don't exist, so it's safe on a database that already has data.

## Deploying

See [`deploy/README.md`](deploy/README.md): one small server running Docker, HTTPS through a shared Caddy, encrypted nightly backups, and scripts for setup, updates, restores and rotating the database password.

## Environment
Copy `.env.example` to `.env` and fill it in.

- Variables starting with `VITE_` are bundled into the browser JavaScript, so they must never hold secrets.
- Database (`DB_*`), Auth0 API, `CORS_ORIGIN` and `RATE_LIMIT_PER_MINUTE` are only read by the server.
- `DB_*` is your real database. The local Docker database's settings are fixed in `scripts/use-local-db.js` and `docker-compose.yml`.

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
Imported CSVs get the same review screen as statements (tick or untick rows, pick categories, duplicates caught). A header row with `date`, `name`, `amount`, and optionally `type` (`expense` or `income`), `category` (name or key) and `note`, in any order. Blank categories are filled in from your rules. Dates like `2026-11-04`, `2026-11-04 18:30` or `4/11/2026` work. Files from **Export CSV** can be imported as they are. Negative amounts count as expenses. Lines that can't be read are listed and skipped.

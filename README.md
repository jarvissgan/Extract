# Extract

Full-stack personal finance app built with React + Vite, Mantine UI, Auth0, and MariaDB.

## Stack
- Frontend: React 19, Vite 6, Mantine 8, TypeScript
- Auth: Auth0
- API: Express
- Database: MariaDB 11

## Scripts
- `npm run dev` — run frontend and backend in development
- `npm run build` — build frontend for production
- `npm run lint` — run ESLint checks

## Environment
Copy `.env.example` to `.env` and fill it in.

- Variables starting with `VITE_` are bundled into the browser JavaScript, so they must never hold secrets.
- Database and Auth0 API settings use unprefixed names (`DB_*`, `AUTH0_*`) and are only read by the server.

The API identifies the signed-in user from their Auth0 access token (looking up their email via Auth0's `/userinfo`), and only lets them read or change their own account and transactions.

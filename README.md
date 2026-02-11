# Extract

Full-stack personal finance app built with React + Vite, Mantine UI, Auth0, and MariaDB.

## Stack
- Frontend: React 19, Vite 6, Mantine 8
- Auth: Auth0
- API: Express
- Database: MariaDB 11

## Scripts
- `npm run dev` — run frontend and backend in development
- `npm run build` — build frontend for production
- `npm run lint` — run ESLint checks

## Notes
- Frontend expects Auth0-related environment variables used in `src/App.jsx`.
- Backend expects Auth0 API issuer/audience configuration used in `server.js`.

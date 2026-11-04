// Points DB_* at the local Docker database, whatever .env says.
//
// The dev tools (npm run local, npm test, db:seed, db:reset) always use this database,
// so they can never write dummy data to, or wipe, the database configured in .env.
// Load it before anything that connects:  node --import ./scripts/use-local-db.js <script>
import { config } from "dotenv";

config({ quiet: true });

export const LOCAL_DB = {
  DB_HOST: "127.0.0.1",
  DB_PORT: process.env.LOCAL_DB_PORT || "3307",
  DB_USER: "extract",
  DB_PASSWORD: "extract",
  DB_DATABASE: "extract",
};

Object.assign(process.env, LOCAL_DB, { AUTH_MODE: "dev" });

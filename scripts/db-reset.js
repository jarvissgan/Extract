// Drops all app tables and rebuilds them from db/migrations.
// Usage: npm run db:reset -- --yes
// always the local Docker database, never the one in .env
import "./use-local-db.js";
import { connect } from "./connect.js";
import { migrate } from "./migrate.js";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to reset the database with NODE_ENV=production.");
  process.exit(1);
}
if (!process.argv.includes("--yes")) {
  console.error(
    `This deletes ALL data in ${process.env.DB_DATABASE} on ${process.env.DB_HOST}.\n` +
      "Run again with --yes to confirm:  npm run db:reset -- --yes"
  );
  process.exit(1);
}

const db = await connect();
try {
  await db.query(
    "DROP TABLE IF EXISTS savings_entry, savings_goal, `transaction`, recurring_transaction, users, schema_migrations"
  );
} finally {
  await db.end();
}
await migrate();
console.log(`Reset ${process.env.DB_DATABASE}.`);

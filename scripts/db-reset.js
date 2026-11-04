// Drops the app tables and recreates them from db/schema.sql.
// Usage: npm run db:reset -- --yes
import { readFile } from "node:fs/promises";
import { connect } from "./connect.js";

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

const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
const db = await connect({ multipleStatements: true });

try {
  await db.query("DROP TABLE IF EXISTS `transaction`; DROP TABLE IF EXISTS users;");
  await db.query(schema);
  console.log(`Reset ${process.env.DB_DATABASE}: tables recreated from db/schema.sql.`);
} finally {
  await db.end();
}

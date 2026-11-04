// Applies any SQL files in db/migrations that haven't been applied yet, in name order.
// Usage: npm run db:migrate
//
// To change the schema, add a new file like db/migrations/004_add_thing.sql.
// Never edit a migration that has already been applied somewhere.
import { readdir, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { connect } from "./connect.js";

const dir = new URL("../db/migrations/", import.meta.url);

export async function migrate({ log = console.log } = {}) {
  const db = await connect({ multipleStatements: true });
  try {
    await db.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(255) PRIMARY KEY, applied_at DATETIME NOT NULL)"
    );
    const applied = new Set((await db.query("SELECT name FROM schema_migrations")).map((r) => r.name));
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
    const pending = files.filter((f) => !applied.has(f));

    for (const file of pending) {
      log(`  applying ${file}`);
      await db.query(await readFile(new URL(file, dir), "utf8"));
      await db.query("INSERT INTO schema_migrations (name, applied_at) VALUES (?, UTC_TIMESTAMP())", [file]);
    }
    log(pending.length ? `Applied ${pending.length} migration(s).` : "Database schema is up to date.");
  } finally {
    await db.end();
  }
}

// run directly: node scripts/migrate.js
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  migrate().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

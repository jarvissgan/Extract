// One command for offline local development:
//   1. creates .env from .env.example if it doesn't exist
//   2. starts the MariaDB container and waits until it's healthy
//   3. seeds dummy data if the database has no users yet
//   4. starts the frontend + backend with offline dev login
//
// Usage: npm run local               (keeps existing data)
//        npm run local -- --fresh    (wipes the database and reseeds first)
//        npm run local -- --db-only  (steps 1-3, then exits; used by `npm test`)
import { spawn } from "node:child_process";
import { copyFile, access } from "node:fs/promises";

const root = new URL("..", import.meta.url);
const fresh = process.argv.includes("--fresh");
const dbOnly = process.argv.includes("--db-only");

const run = (cmd, args, env = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, ...env },
    });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited with ${code}`))));
  });

const step = (text) => console.log(`\n▶ ${text}`);

try {
  try {
    await access(new URL(".env", root));
  } catch {
    step("No .env found: creating one from .env.example");
    await copyFile(new URL(".env.example", root), new URL(".env", root));
  }

  const { config } = await import("dotenv");
  config({ path: new URL(".env", root).pathname });

  step("Starting the database");
  await run("docker", ["compose", "up", "-d", "--wait", "db"]);

  if (fresh) {
    step("Wiping the database (--fresh)");
    await run("node", ["scripts/db-reset.js", "--yes"]);
  }

  const { connect } = await import("./connect.js");
  const db = await connect();
  const [{ count }] = await db.query("SELECT COUNT(*) AS count FROM users");
  await db.end();

  if (count === 0) {
    step("Database is empty: adding dummy data");
    await run("node", ["scripts/seed.js"]);
  } else {
    step(`Database already has ${count} user(s): keeping existing data (use --fresh to reset)`);
  }

  if (!dbOnly) {
    step("Starting the app with offline login on http://localhost:5173");
    await run("npm", ["run", "dev"], { AUTH_MODE: "dev", VITE_AUTH_MODE: "dev" });
  }
} catch (err) {
  console.error(`\n✖ ${err.message}`);
  process.exit(1);
}

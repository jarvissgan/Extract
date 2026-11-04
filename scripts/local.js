// One command for offline local development:
//   1. creates .env from .env.example if it doesn't exist
//   2. starts the local MariaDB container (port 3307, separate from the database in .env)
//      and applies migrations
//   3. seeds dummy data if the database has no users yet
//   4. starts the frontend + backend with offline dev login
//
// Usage: npm run local               (keeps existing data)
//        npm run local -- --fresh    (wipes the database and reseeds first)
//        npm run local -- --db-only  (steps 1-3, then exits; used by `npm test`)
import { execFileSync, spawn } from "node:child_process";
import { copyFile, access } from "node:fs/promises";
import net from "node:net";
import { compose } from "./compose.js";

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

const portInUse = (port) =>
  new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
  });

const ourContainerRunning = () => {
  try {
    return execFileSync("docker", ["ps", "-q", "--filter", "name=^extract-db$"], { encoding: "utf8" }).trim() !== "";
  } catch {
    return false;
  }
};

try {
  try {
    await access(new URL(".env", root));
  } catch {
    step("No .env found: creating one from .env.example");
    await copyFile(new URL(".env.example", root), new URL(".env", root));
  }

  // loads .env, then points DB_* at the local Docker database (never the one in .env)
  const { LOCAL_DB } = await import("./use-local-db.js");

  step(`Starting the local database (localhost:${LOCAL_DB.DB_PORT})`);
  if (!ourContainerRunning() && (await portInUse(Number(LOCAL_DB.DB_PORT)))) {
    throw new Error(
      `Port ${LOCAL_DB.DB_PORT} is already in use by something else. ` +
        "Set LOCAL_DB_PORT=<free port> in .env and try again."
    );
  }
  await compose(["up", "-d", "db"], { ...process.env, LOCAL_DB_PORT: LOCAL_DB.DB_PORT });
  console.log("  waiting for it to accept connections...");
  const { connect: waitFor } = await import("./connect.js");
  await (await waitFor({ timeoutMs: 120_000 })).end();

  if (fresh) {
    step("Wiping the database (--fresh)");
    await run("node", ["scripts/db-reset.js", "--yes"]);
  } else {
    step("Applying database migrations");
    const { migrate } = await import("./migrate.js");
    await migrate({ log: (line) => console.log(`  ${line.trim()}`) });
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

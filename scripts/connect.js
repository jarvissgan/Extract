import mysql from "mysql2/promise";
import { poolOptions } from "../db-connections.js";

// Opens a single connection, retrying for up to `timeoutMs` while the database starts up.
export async function connect({ timeoutMs = 60_000, multipleStatements = false } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const conn = await mysql.createConnection({ ...poolOptions(), multipleStatements });
      await conn.query("SET time_zone = '+00:00'");
      return {
        query: async (sql, params = []) => (await conn.query(sql, params))[0],
        end: () => conn.end(),
      };
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  throw new Error(
    `Could not connect to ${process.env.DB_HOST}:${process.env.DB_PORT} (${lastError?.code || lastError?.message}). ` +
      "Is the database running? Try `npm run local -- --db-only`."
  );
}

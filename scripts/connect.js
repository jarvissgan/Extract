import mysql from "mysql";

// Opens a connection, retrying for up to `timeoutMs` while the database starts up.
export async function connect({ timeoutMs = 60_000, multipleStatements = false } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    const conn = mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      multipleStatements,
    });
    try {
      await new Promise((resolve, reject) => conn.connect((err) => (err ? reject(err) : resolve())));
      return {
        query: (sql, params = []) =>
          new Promise((resolve, reject) =>
            conn.query(sql, params, (err, results) => (err ? reject(err) : resolve(results)))
          ),
        end: () => new Promise((resolve) => conn.end(() => resolve())),
      };
    } catch (err) {
      lastError = err;
      conn.destroy();
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  throw new Error(
    `Could not connect to ${process.env.DB_HOST}:${process.env.DB_PORT} (${lastError?.code || lastError?.message}). ` +
      "Is the database running? Try `npm run db:up`."
  );
}

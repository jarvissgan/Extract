import mysql from "mysql";

// A pool reconnects on its own if the server drops idle connections.
const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  connectionLimit: 10,
});

// promise wrapper so route handlers can use async/await
const query = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => (err ? reject(err) : resolve(results)));
  });

const closeDb = () => new Promise((resolve) => db.end(() => resolve()));

export { db, query, closeDb };

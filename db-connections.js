import mysql from "mysql2/promise";

// All dates are stored and read as UTC. The browser converts to local time for display.
export const poolOptions = () => ({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  timezone: "Z",
  decimalNumbers: true,
});

const pool = mysql.createPool({ ...poolOptions(), connectionLimit: 10 });

// Make NOW() / CURRENT_TIMESTAMP use UTC as well.
pool.pool.on("connection", (conn) => conn.query("SET time_zone = '+00:00'"));

// Returns rows for SELECT, or the result header (insertId, affectedRows) otherwise.
const query = async (sql, params = []) => {
  const [results] = await pool.query(sql, params);
  return results;
};

const closeDb = () => pool.end();

export { pool, query, closeDb };

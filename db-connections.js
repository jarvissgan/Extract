import mysql from "mysql";

const db = mysql.createConnection({
  host: process.env.VITE_dbHost,
  port: process.env.VITE_dbPort,
  user: process.env.VITE_dbUser,
  password: process.env.VITE_dbPassword,
  database: process.env.VITE_dbDatabase,
});

db.connect((err) => {
  if (err) throw err;
  console.log("Connected to db");
});

export { db };

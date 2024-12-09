// var mysql = require('mysql');
import { mysql } from "mysql";

var connection = mysql.createConnection({
  host: import.meta.env.VITE_dbHost,
  port: import.meta.env.VITE_dbPort,
  user: import.meta.env.VITE_dbUser,
  password: import.meta.env.VITE_dbPassword,
  database: import.meta.env.VITE_dbDatabase,
});
connection.connect((err) => {
  if (err) throw err;
  console.log("Connected to db");
});
module.exports = connection;

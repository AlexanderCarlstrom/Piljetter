const dotenv = require('dotenv');
const mysql = require('mysql2');
dotenv.config();

const con = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});

module.exports = con;

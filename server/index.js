const bodyParser = require('body-parser');
const express = require('express');
const dotenv = require('dotenv');
const mysql = require('mysql');
const app = express();
dotenv.config();

const port = 3000;

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: process.env.DB_PASS,
  database: 'piljetter'
});

db.connect(err => {
  if (err) throw err;
  console.log('connected to db');
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.listen(port, () => {
  console.log(`server running on ${port}`);
});

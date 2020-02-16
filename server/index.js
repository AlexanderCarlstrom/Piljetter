const bodyParser = require('body-parser');
const express = require('express');
const dotenv = require('dotenv');
const mysql = require('@mysql/xdevapi');
const app = express();
dotenv.config();

const port = 3000;
const config = {
  host: 'localhost',
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASS,
  database: 'piljetter',
  port: process.env.DB_PORT
};

mysql.getSession(config).then(session => {
  console.log(session.inspect());
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.listen(port, () => {
  console.log(`server running on ${port}`);
});

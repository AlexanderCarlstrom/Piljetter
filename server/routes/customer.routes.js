const express = require('express');
const router = express.Router();
const validator = require('email-validator');
const jwt = require('jsonwebtoken');
const expressJwt = require('express-jwt');
const dotenv = require('dotenv');
const con = require('../connection');
dotenv.config();

// customer login
router.post('/login', (req, res) => {
  login(req, res);
});

// customer register
router.post('/register', (req, res) => {
  register(req, res);
});

// buy pesetas
router.post('/buy_pesetas', expressJwt({ secret: process.env.JWT_SECRET }), (req, res) => {
  buyPesetas(req, res);
});

// buy ticket
router.post('/buy_ticket', expressJwt({ secret: process.env.JWT_SECRET }), (req, res) => {
  buyTicket(req, res);
});

function login(req, res) {
  // validate email
  if (!validator.validate(req.body.email)) {
    res.send('invalid email');
    return;
  }

  // storing inputs - variables will be escaped in query
  const email = req.body.email;
  const password = req.body.password;

  // query
  const sql =
    'SELECT `id`, `first_name`, `last_name`, `email`, `pesetas` FROM `customer` WHERE `email` = ? AND `password` = ?';
  con.query(sql, [email, password], (err, result) => {
    if (err) return next(err);
    const row = result[0];
    const user = {
      id: row.id,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      pesetas: row.pesetas,
      role: 'user',
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 10
    };

    jwt.sign({ user: user }, process.env.JWT_SECRET, (err, token) => {
      if (err) return res.send(err);
      res.send(token);
    });
  });
}

async function register(req, res) {
  // validate email
  if (!validator.validate(req.body.email)) {
    res.send('invalid email');
    return;
  }

  // storing inputs - variables will be escaped in query
  const firstName = req.body.first_name;
  const lastName = req.body.last_name;
  const email = req.body.email;
  const password = req.body.password;

  // check if email already exists
  const checkSql = 'SELECT * FROM `customer` WHERE `email` = ?';
  const [row] = await con.promise().query(checkSql, [email]);
  if (row.length > 0) {
    res.send('email already exist');
  }

  // query
  const sql =
    'INSERT INTO customer (`first_name`, `last_name`, `email`, `password`) VALUES (?, ?, ?, ?)';
  con.query(sql, [firstName, lastName, email, password], err => {
    if (err) return next(err);
    res.send('Done');
  });
}

async function buyPesetas(req, res) {
  const user = req.user.user;
  const amount = req.body.amount;
  await con
    .promise()
    .query('UPDATE `customer` SET pesetas = pesetas + ? WHERE `id` = ?', [amount, user.id]);

  con.query(
    'SELECT `id`, `first_name`, `last_name`, `email`, `pesetas` FROM `customer` WHERE `id` = ?',
    [user.id],
    (err, result) => {
      if (err) return res.send(err);
      const newUser = {
        id: result[0].id,
        first_name: result[0].first_name,
        last_name: result[0].last_name,
        email: result[0].email,
        pesetas: result[0].pesetas,
        role: user.role,
        exp: user.exp
      };

      jwt.sign({ user: newUser }, process.env.JWT_SECRET, (err, token) => {
        if (err) return res.send(err);
        res.send(token);
      });
    }
  );
}

// TODO
// 1. get event price
// 2. check if customer has enough pesetas
// 3. create order
async function buyTicket(req, res) {
  const event_id = req.body.event;
  const customer_id = req.user.user.id;
  const tickets = req.body.tickets;

  // get event price
  const [event_row] = await con
    .promise()
    .query('SELECT `ticket_price` FROM `event` WHERE `id` = ?', [event_id]);
  if (event_row.length === 0) return res.send('invalid event');
  const price = event_row[0].price;

  // check if customer has enough pesetas
  con.query('SELECT `pesetas` FROM `customer` WHERE `id` = ?', [customer_id], (err, result) => {
    if (err) return res.send(err);
    if (result.length === 0) return res.send('invalid customer');
    const pesetas = result[0].pesetas;

    if (pesetas < price) {
      return res.send('not enough pesetas');
    }

    // create order
    con.query(
      'INSERT INTO `order` (`event_id`, `customer_id`, `tickets`) VALUES (?, ?, ?)',
      [event_id, customer_id, tickets],
      err => {
        if (err) res.send(err);
        res.send('Done');
      }
    );
  });
}

module.exports = router;

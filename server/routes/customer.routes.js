const validator = require('email-validator');
const expressJwt = require('express-jwt');
const con = require('../connection');
const jwt = require('jsonwebtoken');
const express = require('express');
const dotenv = require('dotenv');
const promiseCon = con.promise();
const router = express.Router();
const dateFormat = require('dateformat');
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

// get events
router.get('/events', expressJwt({ secret: process.env.JWT_SECRET }), (req, res) => {
  getEvents(req, res);
});

// get tickets
router.get('/tickets', expressJwt({ secret: process.env.JWT_SECRET }), (req, res) => {
  getTickets(req, res);
});

// get voucher - since all vouchers are the same, this will only return how many vouchers are available
router.get('/vouchers', expressJwt({ secret: process.env.JWT_SECRET }), (req, res) => {
  getVouchers(req, res);
});

async function login(req, res) {
  // validate email
  if (!validator.validate(req.body.email)) {
    res.send('invalid email');
    return;
  }

  // storing inputs - variables will be escaped in query
  const email = req.body.email;
  const password = req.body.password;

  const result = await promiseCon.query(
    'SELECT `id`, `first_name`, `last_name`, `email`, `pesetas` FROM `customer` WHERE `email` = ? AND `password` = ?',
    [email, password]
  );
  if (result[0].length < 1) return res.sendStatus(404);
  const row = result[0][0];

  con.query(
    'SELECT COUNT(*) AS no FROM `voucher` WHERE `customer_id` = ?',
    [row.id],
    (err, result) => {
      if (err) res.send(err);

      // create new user
      const user = {
        id: row.id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        pesetas: row.pesetas,
        role: 'user',
        vouchers: result[0],
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 10
      };

      // create and send json web token to user
      jwt.sign({ user: user }, process.env.JWT_SECRET, (err, token) => {
        if (err) return res.send(err);
        return res.send(token);
      });
    }
  );
}

async function register(req, res) {
  // validate email
  if (!validator.validate(req.body.email)) {
    res.sendStatus('406');
    return;
  }

  // storing inputs - variables will be escaped in query
  const firstName = req.body.first_name;
  const lastName = req.body.last_name;
  const email = req.body.email;
  const password = req.body.password;

  // check if email already exists
  const [row] = await promiseCon.query('SELECT * FROM `customer` WHERE `email` = ?', [email]);
  if (row.length > 0) {
    res.send('email already exist');
  }

  // create new customer
  promiseCon.query(
    'INSERT INTO customer (`first_name`, `last_name`, `email`, `password`) VALUES (?, ?, ?, ?)',
    [firstName, lastName, email, password],
    err => {
      if (err) return next(err);
      res.send('Done');
    }
  );
}

async function buyPesetas(req, res) {
  const user = req.user.user;
  const amount = req.body.amount;
  con.query(
    'UPDATE `customer` SET pesetas = pesetas + ? WHERE `id` = ?',
    [amount, user.id],
    err => {
      if (err) throw err;
      con.query(
        'SELECT `id`, `first_name`, `last_name`, `email`, `pesetas` FROM `customer` WHERE `id` = ?',
        [user.id],
        (err, result) => {
          if (err) return next(err);

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
            return res.status(200).send(token);
          });
        }
      );
    }
  );
}

async function buyTicket(req, res) {
  const event_id = req.body.event;
  const customer_id = req.user.user.id;
  const amount = req.body.amount;
  const voucher = req.body.voucher;

  await promiseCon.beginTransaction();

  // get ticket_price, stage_id and tickets_sold from event
  const [
    event_row
  ] = await promiseCon.query(
    'SELECT `ticket_price`, `stage_id`, `tickets_sold`, `date` FROM `event` WHERE `id` = ? FOR UPDATE',
    [event_id]
  );
  if (event_row.length < 1) return res.status(404).send('event not found');
  const price = event_row[0].ticket_price;
  const totPrice = price * amount;
  const stage_id = event_row[0].stage_id;
  const tickets_sold = event_row[0].tickets_sold;

  // get stage capacity
  const [stage_row] = await promiseCon.query('SELECT `capacity` FROM `stage` WHERE `id` = ?', [
    stage_id
  ]);

  // check if event has enough tickets left
  const tickets_left = stage_row[0].capacity - tickets_sold;
  if (tickets_left < amount) return res.status(403).send('not enough tickets left');

  // get customer pesetas
  const [
    customer_row
  ] = await promiseCon.query('SELECT `pesetas` FROM `customer` WHERE `id` = ? FOR UPDATE', [
    customer_id
  ]);
  if (customer_row.length < 1) return res.status(404).send('customer not found');
  const pesetas = customer_row[0].pesetas;
  console.log(pesetas);

  // get vouchers
  let voucher_row;
  let voucher_count = 0;
  if (voucher === 'true') {
    [voucher_row] = await promiseCon.query(
      'SELECT `id` FROM `voucher` WHERE `customer_id` = ? AND `used` = 0 LIMIT ?',
      [customer_id, amount],
      err => {
        if (err) {
          promiseCon.rollback();
        }
      }
    );
    voucher_count = voucher_row.length;
  }

  // check if customer has enough pesetas
  if (voucher_count * price + pesetas < totPrice) return res.status(403).send('not enough pesetas');

  // create new tickets
  for (let i = 0; i < amount; i++) {
    await promiseCon.query(
      'INSERT INTO `ticket` (`customer_id`, `event_id`, `price`) VALUES (?, ?, ?)',
      [customer_id, event_id, price],
      err => {
        if (err) {
          promiseCon.rollback();
        }
      }
    );
  }

  // update customer pesetas and update voucher
  let count = 0;
  if (voucher === 'true') {
    voucher_row.forEach(v => {
      con.query('UPDATE `voucher` SET `used` = 1 WHERE `id` = ?', [v.id], err => {
        if (err) {
          promiseCon.rollback();
        }
      });
      count++;
    });
  }
  let priceToPay = (amount - count) * price;
  await promiseCon.query(
    'UPDATE `customer` SET `pesetas` = `pesetas` - ? WHERE `id` = ?',
    [priceToPay, customer_id],
    err => {
      if (err) {
        promiseCon.rollback();
      }
    }
  );

  // update event tickets_sold and income
  await promiseCon.query(
    'UPDATE `event` SET `tickets_sold` = `tickets_sold` + ?, `income` = `income` + ? WHERE `id` = ?',
    [amount, totPrice, event_id],
    err => {
      if (err) {
        promiseCon.rollback();
      }
    }
  );

  await promiseCon.commit();
  res.sendStatus(200);
}

function getEvents(req, res) {
  const user_id = req.user.user.id;
  con.query(
    `SELECT e.id, e.ticket_price, e.date, e.time, a.name as artist_name, s.city, s.country, s.name as stage_name
    FROM ((event AS e
      INNER JOIN artist AS a ON e.artist_id = a.id)
      INNER JOIN stage AS s ON e.stage_id = s.id)
      WHERE e.date >= NOW()`,
    [user_id],
    (err, result) => {
      if (err) return res.send(err);
      result.forEach(row => {
        row.date = dateFormat(row.date, 'yyyy-mm-dd');
      });
      res.send(result);
    }
  );
}

function getTickets(req, res) {
  const user_id = req.user.user.id;
  con.query(
    `SELECT e.id, e.ticket_price, e.date, e.time, a.name as artist_name, s.city, s.country, s.name as stage_name
    FROM (((ticket AS t
      INNER JOIN event AS e ON t.event_id = e.id)
      INNER JOIN artist AS a ON e.artist_id = a.id)
      INNER JOIN stage AS s ON e.stage_id = s.id)
    WHERE t.customer_id = ? AND e.date >= NOW()`,
    [user_id],
    (err, result) => {
      if (err) return res.send(err);
      res.send(result);
    }
  );
}

function getVouchers(req, res) {
  const user_id = req.user.user.id;
  con.query(
    'SELECT COUNT(*) AS no FROM `voucher` WHERE `customer_id` = ?',
    [user_id],
    (err, result) => {
      if (err) res.send(err);
      res.send(result[0]);
    }
  );
}

module.exports = router;

const expressJwt = require('express-jwt');
const con = require('../connection');
const jwt = require('jsonwebtoken');
const express = require('express');
const dotenv = require('dotenv');
const mysql = require('mysql2');
const router = express.Router();
dotenv.config();

// admin login
router.post('/login', (req, res) => {
  login(req, res);
});

// customer register
router.post('/register', expressJwt({ secret: process.env.JWT_SECRET }), (req, res) => {
  if (req.user.user.role !== 'admin') return res.send('Unathorized');
  register(req, res);
});

router.post('/create_stage', expressJwt({ secret: process.env.JWT_SECRET }), (req, res) => {
  if (req.user.user.role !== 'admin') return res.send('Unathorized');
  createStage(req, res);
});

router.post('/create_artist', expressJwt({ secret: process.env.JWT_SECRET }), (req, res) => {
  if (req.user.user.role !== 'admin') return res.send('Unathorized');
  createArtist(req, res);
});

router.post('/create_event', expressJwt({ secret: process.env.JWT_SECRET }), (req, res) => {
  if (req.user.user.role !== 'admin') return res.send('Unathorized');
  createEvent(req, res, req.user.user.id);
});

function login(req, res) {
  // storing inputs - variables will be escaped in query
  const username = req.body.username;
  const password = req.body.password;

  // query
  const sql = 'SELECT `id`, `username` FROM `admin` WHERE `username` = ? AND `password` = ?';
  con.query(sql, [username, password], (err, result) => {
    if (err) return res.send(err);
    if (result.length === 0) return res.send('invalid credentials');
    const row = result[0];
    const user = {
      id: row.id,
      username: row.username,
      role: 'admin',
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 10
    };

    jwt.sign({ user: user }, process.env.JWT_SECRET, (err, token) => {
      if (err) return res.send(err);
      res.send(token);
    });
  });
}

async function register(req, res) {
  // storing inputs - variables will be escaped in query
  const username = req.body.username;
  const password = req.body.password;

  // check if email already exists
  const checkSql = 'SELECT `username` FROM `admin` WHERE `username` = ?';
  const [row] = await con.promise().query(checkSql, [username]);
  if (row.length > 0) {
    return res.send('admin user already exist');
  }

  // query
  const sql = 'INSERT INTO admin (`username`, `password`) VALUES (?, ?)';
  con.query(sql, [username, password], err => {
    if (err) return res.send(err);
    res.send('Done');
  });
}

async function createStage(req, res) {
  // storing inputs - variables will be escaped in query
  const city = req.body.city;
  const country = req.body.country;
  const reputation = req.body.reputation;
  const name = req.body.name;

  // check if stage already exist
  const checkSql = 'SELECT `name` FROM `stage` WHERE `name` = ? AND `city` = ? AND `country` = ?';
  await con.promise().query(checkSql, [name, city, country], (err, result) => {
    if (err) return res.send(err);
    if (result.length > 0) {
      return res.send('Stage already exist');
    }
  });

  // query
  const sql = 'INSERT INTO `stage` (`city`, `country`, `reputation`, `name`) VALUES (?, ?, ?, ?)';
  con.query(sql, [city, country, reputation, name], err => {
    if (err) return res.send(err);
    res.send('Done');
  });
}

async function createArtist(req, res) {
  // storing inputs - variables will be escaped in query
  const name = req.body.name;
  const popularity = req.body.popularity;
  const country = req.body.country;

  // check if stage already exist
  const checkSql = 'SELECT `name` FROM `artist` WHERE `name` = ?';
  await con.promise().query(checkSql, [name], (err, result) => {
    if (err) return next(err);
    if (result.length > 0) {
      return res.send('Artist already exist');
    }
  });
  // query
  const sql = 'INSERT INTO `artist` (`name`, `popularity`, `country`) VALUES (?, ?, ?)';
  con.query(sql, [name, popularity, country], err => {
    if (err) return res.send(err);
  });
}

async function createEvent(req, res, admin) {
  // storing inputs - variables will be escaped in query
  const artist = req.body.artist;
  const stage = req.body.stage;
  const tickets = req.body.tickets;
  const ticket_price = req.body.ticket_price;
  const date = req.body.date;
  const time = req.body.time;

  // get artist popularity
  const [artist_row] = await con
    .promise()
    .query('SELECT `popularity` FROM `artist` WHERE `id` = ?', [artist]);
  if (artist_row.length === 0) return res.send('invalid artist');
  const popularity = artist_row[0].popularity;

  // get stage reputation
  const [stage_row] = await con
    .promise()
    .query('SELECT `reputation` FROM `stage` WHERE `id` = ?', [stage]);
  if (stage_row.length === 0) return res.send('invalid stage');
  const reputation = stage_row[0].reputation;

  // cost is calculated from artist popularity and stage reputation
  const cost = popularity * reputation * 100000;

  // check if event already exist
  const [
    event_row
  ] = await con
    .promise()
    .query('SELECT * FROM `event` WHERE `artist_id` = ? AND `stage_id` = ? AND `date` = ?', [
      artist,
      stage,
      date
    ]);
  if (event_row.length > 0) return res.send('event already exist');
  const sql =
    'INSERT INTO `event` (`stage_id`, `artist_id`, `tickets`, `ticket_price`, `created_by`, `cost`, `date`, `time`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
  con.query(sql, [stage, artist, tickets, ticket_price, admin, cost, date, time], (err, result) => {
    if (err) return res.send(err);
    res.send('Done');
  });
}

module.exports = router;

const customerRoutes = require('./routes/customer.routes');
const adminRoutes = require('./routes/admin.routes');
const bodyParser = require('body-parser');
const con = require('./connection');
const express = require('express');
const app = express();

const port = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use((req, res, next) => {
  //Enabling CORS
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, x-client-key, x-client-token, x-client-secret, Authorization'
  );
  next();
});
app.use('/api/customer', customerRoutes);
app.use('/api/admin', adminRoutes);
app.listen(port, () => {
  console.log(`server running on ${port}`);
});

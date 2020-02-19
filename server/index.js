const customerRoutes = require('./routes/customer.routes');
const adminRoutes = require('./routes/admin.routes');
const bodyParser = require('body-parser');
const con = require('./connection');
const express = require('express');
const app = express();

const port = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/api/customer', customerRoutes);
app.use('/api/admin', adminRoutes);
app.listen(port, () => {
  console.log(`server running on ${port}`);
});

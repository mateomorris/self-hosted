const cors = require('cors')({ origin: true })
const express = require('express')

express()
  .use(cors)
  .get('/', (req, res) => {
    res.send('ok');
  })
  .listen(process.env.PORT || 3000, err => {
    if (err) throw err;
    console.log(`> Running on ${process.env.PORT || 3000}`);
  });

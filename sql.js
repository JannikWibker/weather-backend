const sqlite = require('sqlite')
const express = require('express')

const app = express()

const dbPromise = sqlite.open('./city.sqlite')

app.get('/city', (req, res) => {
  const sql_str = `select * from city where "nm" like "%${req.query.city}%"${req.query.country ? ` and "countryCode" = "${req.query.country}"` : ''};`
  console.log(req.query.city, req.query.country, '\n', sql_str)

  dbPromise
    .then(db =>
      db.all(sql_str)
        .then(rows => {
          console.log(rows)
          res.json(rows)
        })
        .catch(console.log)
    )
    .catch(console.log)
})



app.listen(8080)

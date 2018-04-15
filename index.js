const NodeCache = require('node-cache')
const fetch = require('node-fetch')
const express = require('express')
const didYouMean = require('didyoumean2')
const sqlite = require('sqlite')
const _normalize = require('normalize-strings')

const weatherCache = new NodeCache({ stdTTL: 21600 })
const cityCache = new NodeCache({ stdTTL: 0 })

const dbPromise = sqlite.open('./city.sqlite')

const result = require('dotenv').config()

if(result.error) throw result.error
const config = result.parsed

const normalize = str => _normalize(str, {
  '228': 'ae',
  '246': 'oe',
  '252': 'ue',
  '196': 'Ae',
  '214': 'Oe',
  '220': 'Ue'
})

const app = express()


const cors = (req, res, next) => {
  const allowed = ['http://jannik.ddns.net', 'http://jannik.ddns.net:3000', 'http://localhost', 'http://localhost:3000']
  res.header('Access-Control-Allow-Origin', allowed.indexOf(req.get('origin')) !== -1 ? req.get('origin') : '')
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  next()
}

const proxy = x => { console.log('PROXY: ', x); return x }

const fakeGetWeather = async (city_code) => Promise.resolve({"coord":{"lon":7.63,"lat":51.96},"weather":[{"id":520,"main":"Rain","description":"light intensity shower rain","icon":"09d"}],"base":"stations","main":{"temp":288.15,"pressure":1001,"humidity":58,"temp_min":288.15,"temp_max":288.15},"visibility":10000,"wind":{"speed":5.1,"deg":190},"clouds":{"all":75},"dt":1522756200,"sys":{"type":1,"id":4882,"message":0.0064,"country":"DE","sunrise":1522731541,"sunset":1522778836},"id":2867543,"name":"Muenster","cod":200})

const getWeather = async (city_code) =>
  fetch(`${config.OPENWEATHERMAP_API_URL}/weather?id=${city_code}&APPID=${config.OPENWEATHERMAP_API_KEY}`)
    .then(res => res.json())

const getCity = (city_name, city_country) =>
  new Promise((resolve, reject) => {
    dbPromise
      .then(db =>
        db.all(`select * from city where "nm" like "%${city_name}%"${city_country ? ` and "countryCode" = "${city_country}"` : ''};`)
          .then(proxy)
          .then(resolve)
          .catch(proxy)
          .catch(reject)
      )
      .catch(proxy)
      .catch(reject)
  })

app.use(cors)

app.get('/weather', (req, res) => {
  weatherCache.get(req.query.code, (err, value) => {
    if(!err) {
      if(value) {
        console.log('VALUE IN CACHE:', req.query.code, value)
        res.json(value)
      } else {
        getWeather(req.query.code)
        //fakeGetWeather(req.query.code)
          .then(x => { console.log('VALUE NOT IN CACHE: ', req.query.code, x); return x })
          .then(json => {
            res.json(json)
            weatherCache.set(req.query.code, json)
          })
      }
    }
  })
})

app.get('/city', (req, res) => {
  const city = req.query.city
  const n_city = proxy(normalize(city))
  getCity(n_city, req.query.country)
    .then(arr => didYouMean(n_city, arr, {matchPath: 'nm', returnType: 'all-sorted-matches', thresholdType: 'edit-distance' }))
    .then(arr =>
      arr.map(x => ({
        ...x,
        nm: city !== n_city ? x.nm.replace(new RegExp(n_city, 'g'), city) : x.nm
      })
    ))
    .then(proxy)
    .then(arr => res.json(arr))
})

app.listen(8080)

const fs = require('fs')
const {find} = require('lodash')
const cors = require('cors')({ origin: true })
const express = require('express')
const { json } = require('body-parser');

// Heroku
const APP_NAME = process.env.HEROKU_APP_NAME
const Heroku = require('heroku-client')
const heroku = new Heroku({ token: process.env.HEROKU_API_TOKEN })
function setConfigVar(variable) {
  heroku.patch(`/apps/${APP_NAME}/config-vars`, variable)
}
heroku.get(`/apps/${APP_NAME}/config-vars`).then(variables => {
  runExpress(variables.MONGO_URI)
})



// Serve primo
const { join } = require('path');
const primoDir = join(__dirname, 'public');
const primoServe = require('serve-static')(primoDir);

// Database
const {saveData,getData,connectDatabase} = require('./server/mongo')

// PostCSS
const processStyles = require('./functions/postcss')

// Building 
const {buildSite,combineTailwindConfigs,buildPageCSS} = require('./functions/build')

// SSR
const renderer = require('./functions/render')

// Storage
const bucketID = process.env.AWS_S3_BUCKET
const bucketRegion = process.env.AWS_S3_REGION
const {setupS3,uploadFile} = require('./server/hosting/aws')

// // Primo
// function serve(req, res, next) {
//   const editing = req.headers.host.split('.')[0] === 'edit'
//   if (editing) primoServe(req, res, next) 
//   else next()
// }

// Authentication
const {passport,createUser} = require('./server/auth')

function runExpress(initialized) {
  express()
    .use(passport.initialize())
    .use(passport.session())
    .use(json())
    .use(cors)
    .use(primoServe)
    .post('/__fn/postcss', async (req, res) => {
      const styles = await processStyles(req.body)
      res.send(styles);
    })
    .post('/__fn/login', (req, res, next) => {
      passport.authenticate('local', function(err, user, info) {
        if (err) return next(err)  // not being passed in yet
        if (!user) return res.send(info)
        req.logIn(user, function(err) {
          if (err) { return next(err); } // not being passed in yet
          return res.send({ success: true });
        });
      })(req, res, next);
    })
    .post('/__fn/build', async (req, res) => {
      const siteFiles = await buildSite(req.body)
      const stored = await Promise.all(
        siteFiles.map(uploadFile)
      )
      res.send(file);
    })

    // Database
    .get('/__fn/data', async (req, res) => {
      const data = initialized ? (await getData('site')) : null
      res.send(data);
    })
    .post('/__fn/data', async (req, res) => {
      await saveData('site', JSON.stringify(req.body))
      res.send(true);
    })

    .post('/__fn/auth/create', async (req, res) => {
      await createUser(req.body)
      res.send({ success: true });
    })

    // SETUP
    .post('/__fn/setup/db', async (req, res) => {
      setConfigVar({ MONGO_URI: req.body.uri })
      const success = await connectDatabase(req.body.uri)
      res.send({ success })
    })
    .post('/__fn/setup/hosting', async (req, res) => {
      setConfigVar({
        AWS_ACCESS_KEY_ID: req.body.keyID,
        AWS_SECRET_ACCESS_KEY: req.body.accessKey,
        AWS_REGION: req.body.region
      })
      const response = await setupS3(req.body)
      res.send(response);
    })

    // Static Site Generation
    // .get('/', (req, res) => {
    //   res.redirect(`http://${bucketID}.s3-website.${bucketRegion}.amazonaws.com/`)
    // })
    // .get('/:page', (req, res) => {
    //   const {page} = req.params
    //   res.redirect(`http://${bucketID}.s3-website.${bucketRegion}.amazonaws.com/${page}`)
    // })

    // Server-side Rendering (assets served from S3)
    // .get('/:page.html', (req, res) => {
    //   const pageID = req.params.page
    //   const page = find(site.pages, ['id', pageID])
    //   if (page) {
    //     const HTML = renderer.renderPage(page, site)
    //     res.send(HTML);
    //   } else res.send('')
    // })
    // .get('/:page', (req, res) => {
    //   const {page} = req.params
    //   res.redirect(`http://${bucketID}.s3-website.us-east-2.amazonaws.com/${page}`)
    // })
    // .get('/', (req, res) => {
    //   const page = find(site.pages, ['id', 'index'])
    //   const HTML = renderer.renderPage(page, site)
    //   res.send(HTML);
    // })


    .listen(process.env.PORT || 3000, err => {
      if (err) throw err;
      console.log(`> Running on ${process.env.PORT || 3000}`);
    });


}

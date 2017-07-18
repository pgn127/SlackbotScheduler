
// var fs = require('fs');
var logger = require('morgan');
var google = require('googleapis');
var OAuth2 = google.auth.OAuth2;
var mongoose = require('mongoose');
var models = require('./models');
var {User} = require('./models');
var slackID;

mongoose.connect(process.env.MONGODB_URI);
mongoose.Promise = global.Promise;

// var googleAuth = require('google-auth-library');
var express = require('express');
// var request = require('request');
require('./rtm-client');
var app = express();
var bodyParser = require('body-parser');

app.use(logger('dev'));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
// var app = express();

var {RtmClient, WebClient, CLIENT_EVENTS, RTM_EVENTS} = require('@slack/client');

var CLIENT_ID = process.env.CLIENT_ID;
var CLIENT_SECRET = process.env.CLIENT_SECRET;
const PORT=3000;

  var oauth2Client;
  var url;

// Start our server
app.listen(PORT, function () {
    //Callback triggered when server is successfully listening. Hurray!
    console.log("Example app listening on port " + PORT);
});

app.get('/oauth', function(req, res){
   oauth2Client = new OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.DOMAIN + '/connect/callback'
  )

   url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/calendar'
    ],
    state: encodeURIComponent(JSON.stringify({
      auth_id: req.query.auth_id
    }))
  });
  slackID = req.query.auth_id
  res.redirect(url);
})

app.get('/connect/callback', function(req, res) {
  const code = req.query.code;
  oauth2Client.getToken(code, function (err, tokens) {
    const refresh_token = tokens.refresh_token;
    const access_token = tokens.access_token;
    const auth_id = JSON.parse(decodeURIComponent(req.query.state));
    const token_type = tokens.token_type;
    const expiry_date = tokens.expiry_date;
    console.log(auth_id);
    var newUser = new User({
      slackID: slackID,
      refresh_token: refresh_token,
      access_token: access_token,
      auth_id: auth_id.auth_id,
      token_type: token_type,
      expiry_date: expiry_date
    });

    newUser.save();

    res.send("Your account was successfuly authenticated")
    // TODO: Put all of these into the database with the corresponding user;
    res.status(200)
  // Now tokens contains an access_token and an optional refresh_token. Save them.
  if (!err) {
    oauth2Client.setCredentials(tokens);
  }
});
})

// This route handles GET requests to our root ngrok address and responds with the same "Ngrok is working message" we used before
app.get('/', function(req, res) {
    res.send('Ngrok is working! Path Hit: ' + req.url);
});

// Route the endpoint that our slash command will point to and send back a simple response to indicate that ngrok is working
app.post('/command', function(req, res) {
    res.send('Your ngrok tunnel is up and running!');
});

app.post('/slack/interactive', function(req,res){
    var payload = JSON.parse(req.body.payload);
    //if user clicks confirm button
    if(payload.actions[0].value === 'true') {
        res.send('Created reminder');
        // TODO: create a calendar event here
    } else{
        console.log('cancel was clicked');
        res.send('Cancelled');
    }
})

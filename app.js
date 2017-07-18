
// var fs = require('fs');
var logger = require('morgan');
var google = require('googleapis');
var OAuth2 = google.auth.OAuth2;
var mongoose = require('mongoose');
var models = require('./models');
var {User} = require('./models');
var googleAuth = require('google-auth-library');
var fs = require('fs');
var slackID;
var url;
var globalToken;

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
  oauth2Client = new OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.DOMAIN + '/connect/callback'
  )
  oauth2Client.getToken(code, function (err, tokens) {
    let auth_id = JSON.parse(decodeURIComponent(req.query.state));
    globalToken = tokens;
    var newUser = new User({
      token: tokens,
      slackID: slackID,
      auth_id: auth_id.auth_id,
      date: '',
      subject: ''
    });
    newUser.save();
    res.status(200).send("Your account was successfuly authenticated")
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
    slackID = payload.user.id;
    if(Date.now() > globalToken.expiry_date) {
      oauth2Client = new OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.DOMAIN + '/connect/callback'
      )
      oauth2Client.refreshAccessToken(function(err, tokens) {
        User.findOne({slackID: slackID}).exec(function(err, user){
          if(err){
            console.log(err)
          } else {
            user.token = tokens;
            user.save();
          }
        })
      });
    }
    User.findOne({slackID: slackID}).exec(function(err, user) {
      if(err) {
        res.send("An error occured")
      } else {
        createCalendarReminder(user.date, user.subject, user.token);
        res.send("Reminder Made")
      }
    })
  } else{
    res.send('Cancelled');
  }
})

app.listen(PORT, function () {
    //Callback triggered when server is successfully listening. Hurray!
    console.log("Example app listening on port " + PORT);
});

function createCalendarReminder(date, subject, tokens){
  var event = {
    'summary': subject,
    'start': {
      'date': date,
    },
    'end': {
      'dateTime': date
    }
  };

  oauth2Client = new OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.DOMAIN + '/connect/callback'
  )
  console.log("The token is:" ,tokens)
  oauth2Client.setCredentials(tokens);

var calendar = google.calendar('v3');
  calendar.events.insert({
    auth: oauth2Client,
    calendarId: 'primary',
    resource: event,
  }, function(err, event) {
    if(err){
      console.log("There was an error adding the calendar", err);
      return
    }else {
      console.log('event created')
    }
  })

}

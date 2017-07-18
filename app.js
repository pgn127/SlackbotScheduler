
// var fs = require('fs');
var logger = require('morgan');
var google = require('googleapis');
var OAuth2 = google.auth.OAuth2;
var mongoose = require('mongoose');
var models = require('./models');
var {User} = require('./models');
var {Reminder} = require('./models');
var slackID;
var expiry_date

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
    expiry_date = tokens.expiry_date;
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


app.post('/interactive', function(req,res){
  var payload = JSON.parse(req.body.payload);
  console.log(payload);
  //if user clicks confirm button
  if(payload.actions[0].value === 'true') {
    console.log('We made it into here')
    if(Date.now() > expiry_date) {
      oauth2Client.refreshAccessToken(function(err, tokens) {
        User.findOne({slackID: slackID}).exec(function(err, user){
          if(err){
            console.log(err)
          } else {
            user.refresh_token = tokens.refresh_token;
            user.access_token = tokens.access_token;
            user.expiry_date = tokens.expiry_date;
            user.auth_id = JSON.parse(decodeURIComponent(req.query.state));
            user.token_type = tokens.token_type;
            console.log("made it to this point in time before crashing")
            user.save()
            .then((user)=>{
              var reminderSubject = payload.original_message.attachments[0].fields[0].value;
              var reminderDate = Date.parse(payload.original_message.attachments[0].fields[1].value);
              var newReminder = new Reminder({
                userID: payload.user.id,
                channelID: payload.channel.id,
                subject: reminderSubject,
                date: reminderDate,
              })
              newReminder.save(function(err){
                if (err){
                  res.status(400).json({error:err});
                }else{
                  res.send('Reminder Confirmed')
                }
              })
            })
          }
        })
      });
    }
  } else{
    res.send('Cancelled');
  }
})
app.listen(process.env.PORT || 3000);

var logger = require('morgan');
var google = require('googleapis');
var {User, Reminder} = require('./models')
var OAuth2 = google.auth.OAuth2;
var mongoose = require('mongoose');
var models = require('./models');
var googleAuth = require('google-auth-library');
var fs = require('fs');
var slackID;
var url;
mongoose.connect(process.env.MONGODB_URI);
mongoose.Promise = global.Promise;
// var googleAuth = require('google-auth-library');
var express = require('express');
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
    var newUser = new User({
      token: tokens,
      slackID: slackID,
      auth_id: auth_id.auth_id,
      //   date: '',
      //   subject: ''
    });
    newUser.save()
    .then( () => res.status(200).send("Your account was successfuly authenticated"))
    .catch((err) => {
      console.log('error in newuser save of connectcallback');
      res.status(400).json({error:err});
    })
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
// app.post('/slack/interactive', function(req,res){
//   var payload = JSON.parse(req.body.payload);
//   console.log('payload date', payload.original_message.attachments[0].fields[0]);
//   //if user clicks confirm button
//   if(payload.actions[0].value === 'true') {
//
//           if(Date.now() > expiry_date) {
//             oauth2Client.refreshAccessToken(function(err, tokens) {
//               User.findOne({slackID: slackID}).exec(function(err, user){
//                 if(err){
//                   console.log(err)
//                 } else {
//                   user.refresh_token = tokens.refresh_token;
//                   user.access_token = tokens.access_token;
//                   user.expiry_date = tokens.expiry_date;
//                   user.auth_id = JSON.parse(decodeURIComponent(req.query.state));
//                   user.token_type = tokens.token_type;
//                   console.log("made it to this point in time before crashing")
//                   user.save()
//                   .then((user) => {
//                       var reminderSubject = payload.original_message.attachments[0].fields[0].value;
//                       var reminderDate = Date.parse(payload.original_message.attachments[0].fields[1].value);
//                       console.log('reminder date', typeof payload.original_message.attachments[0].fields[1].value, payload.original_message.attachments[0].fields[1].value);
//
//                       var newReminder = new Reminder({
//                           userID: user._id,
//                           channelID: payload.channel_id,
//                           subject: reminderSubject,
//                           date: reminderDate
//                       })
//                       newReminder.save();
//                   })
//                 }
//               })
//             });
//         } else {
//             User.findOne({slackID: slackID}).exec(function(err, user){
//               if(err){
//                 console.log(err)
//               } else {
//                 var reminderSubject = payload.original_message.attachments[0].fields[0].value;
//                 var reminderDate = Date.parse(payload.original_message.attachments[0].fields[1].value);
//                 console.log('reminder date', typeof payload.original_message.attachments[0].fields[1].value, payload.original_message.attachments[0].fields[1].value);
//
//                 var newReminder = new Reminder({
//                     userID: user._id,
//                     channelID: payload.channel_id,
//                     subject: reminderSubject,
//                     date: reminderDate
//                     })
//                 newReminder.save();
//
//               }
//             })
//         }
//           res.send('Reminder Confirmed')
//
//   } else{
//     res.send('Cancelled');
//   }
// })


app.post('/slack/interactive', function(req,res){
  var payload = JSON.parse(req.body.payload);
  if(payload.actions[0].value === 'true') {
      slackID = payload.user.id;
    User.findOne({slackID: slackID}).exec(function(err, user){
      if(err || !user){
        console.log(err);
        res.send('an error occured');
      } else if (user){
        var reminderSubject = payload.original_message.attachments[0].fields[0].value;
        var reminderDate = Date.parse(payload.original_message.attachments[0].fields[1].value);
        // console.log();
        if(Date.now() > user.token.expiry_date) {
          oauth2Client = new OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.DOMAIN + '/connect/callback'
          )
          oauth2Client.refreshAccessToken(function(err, tokens) {
            user.token = tokens;
            user.save()
            .then((user)=>{
              var newReminder = new Reminder({
                userID: user._id,
                channelID: payload.channel.id,
                subject: reminderSubject,
                date: reminderDate,
              })
              newReminder.save(function(err){
                if (err){
                  res.status(400).json({error:err});
                }else{
                  reminderDate = new Date(reminderDate);
                  createCalendarReminder(reminderDate.toISOString().substring(0, 10), reminderSubject, user.token);
                  res.send('Reminder Confirmed')
                }
              })
            })
          });
          //ELSE STILL SAVE REMINDER EVEN IF THEIR TOKEN IS EXPIRED
        } else {
          var newReminder = new Reminder({
            userID: user._id,
            channelID: payload.channel.id,
            subject: reminderSubject,
            date: reminderDate,
          })
          newReminder.save(function(err){
            if (err){
              res.status(400).json({error:err});
            }else{
              reminderDate = new Date(reminderDate);
              createCalendarReminder(reminderDate.toISOString().substring(0, 10), reminderSubject, user.token);
              res.send('Reminder Confirmed')
            }
          })
        }
      }
    })
  } else {
    res.send('Cancelled');
}
})
app.listen(process.env.PORT || 3000);
function createCalendarReminder(date, subject, tokens){
  var event = {
    'summary': subject,
    'start': {
      'date': date,
    },
    'end': {
      'date': date
    }
  };
  oauth2Client = new OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.DOMAIN + '/connect/callback'
  )
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

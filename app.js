var logger = require('morgan');
var google = require('googleapis');
var {User, Reminder, Meeting} = require('./models')
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

var pamtofrankie = {
    userID: '596f927c2945b10011ad86b0',
    invitees: ['fflores'],
    subject: 'get some dinna',
    channelID: 'D6ATM9WMU',
    date: '2017-07-20',
    time: '17:00:00'

}

app.post('/slack/interactive', function(req,res){
    checkConflicts(pamtofrankie);
  var payload = JSON.parse(req.body.payload);
  console.log(payload.original_message.attachments)
  if(payload.actions[0].value === 'true') {
      slackID = payload.user.id;
    User.findOne({slackID: slackID}).exec(function(err, user){
      if(err || !user){
        console.log(err);
        res.send('an error occured');
      } else if (user){
        var reminderSubject = payload.original_message.attachments[0].fields[0].value;
        var reminderDate = Date.parse(payload.original_message.attachments[0].fields[1].value);
        if(Date.now() > user.token.expiry_date) {
          oauth2Client = new OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.DOMAIN + '/connect/callback'
          )
          oauth2Client.setCredentials({
            refresh_token: user.token.refresh_token
          });
          oauth2Client.refreshAccessToken(function(err, tokens) {
            user.token = tokens;
            console.log(tokens);
            user.save()
            .then((user)=>{
              if(payload.original_message.text === "Would you like me to create a reminder for "){
                //it was a reminder
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
              } else {
                // it was a meeting
                var newMeeting = new Reminder({
                  userID: user._id,
                  channelID: payload.channel.id,
                  subject: payload.original_message.attachments[0].fields[0].value,
                  date: payload.original_message.attachments[0].fields[1].value,
                  time: payload.original_message.attachments[0].fields[2].value,
                  invitees: payload.original_message.attachments[0].fields[1].value,
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






function checkConflicts(meeting){
    // var meetingStart = meeting.date+'T'+meeting.time+'-00:00';
    var dateSplit = meeting.time.split('-');
    var timeSplit = meeting.time.split(':');
    var meetingStart = new Date(dateSplit[0], dateSplit[1], dateSplit[2], timeSplit[0], timeSplit[1], timeSplit[2]).toISOString();
    var meetingEnd = new Date(dateSplit[0], dateSplit[1], dateSplit[2], timeSplit[0] + 1, timeSplit[1], timeSplit[2]).toISOString();

    meeting.invitees.forEach( function(invitee) {
        var inviteeuser = rtm.dataStore.getUserByName(invitee);
        var inviteeSlackID = inviteeuser.id;
        User.findOne({slackID: inviteeSlackID}, function(err, user) {
            if(user) {
                var tokens = user.token;
                oauth2Client = new OAuth2(
                  process.env.GOOGLE_CLIENT_ID,
                  process.env.GOOGLE_CLIENT_SECRET,
                  process.env.DOMAIN + '/connect/callback'
                )
                oauth2Client.setCredentials(tokens);
                var calendar = google.calendar('v3');
                calendar.freebusy.query({
                    auth: oauth2Client,
                    items: [{id: 'primary', busy: 'Active'}],
                    timeMax: (new Date(2017, 7, 21)).toISOString(),
                    timeMin: (new Date(2017, 7, 20)).toISOString()
                }, function(err, schedule) {
                  if(err){
                    console.log("There was an error adding the calendar", err);
                    return
                  }else {
                    var busyList = schedule.calendars.busy;
                    busyList.forEach((time) => {
                        console.log('busy at time: ', time.start, time.end);
                    })
                  }
                })

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
        })
    })
}

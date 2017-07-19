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
//defining rtm in this document
var {RtmClient, WebClient, CLIENT_EVENTS, RTM_EVENTS} = require('@slack/client');
var token = process.env.SLACK_API_TOKEN || '';
var rtm = new RtmClient(token);

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

app.post('/slack/interactive', function(req,res){
  var payload = JSON.parse(req.body.payload);
  if(payload.actions[0].value === 'true') {
    slackID = payload.user.id;
    User.findOne({slackID: slackID}).exec(function(err, user){
      if(err || !user){
        console.log(err);
        res.send('an error occured');
      } else if (user){
        if(payload.original_message.text === "Would you like me to create a reminder for "){
          //it was a reminder
          var reminderSubject = payload.original_message.attachments[0].fields[0].value;
          var reminderDate = Date.parse(payload.original_message.attachments[0].fields[1].value);
        } else {
          //it was a meeting
          var meetingSubject = payload.original_message.attachments[0].fields[0].value;
          var meetingDate = Date.parse(payload.original_message.attachments[0].fields[1].value);
          var meetingTime = payload.original_message.attachments[0].fields[2].value;
          var meetingInvitees = payload.original_message.attachments[0].fields[1].value;

        }
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
                  subject: meetingSubject,
                  date: meetingDate,
                  time: meetingTime,
                  invitees: meetingInvitees,
                })

                newMeeting.save(function(err){
                  if (err){
                    res.status(400).json({error:err});
                  }else{
                    meetingDate = new Date(meetingDate);
                    // let dateTime = meetingDate.toISOString().substring(0, 11) + meetingTime + "-07:00"
                    let dateTime = meetingDate.toISOString().substring(0, 10);
                    // createCalendarReminder(dateTime, meetingSubject, user.token , meetingInvitees);
                    var meeting = {
                      userID: user._id, //mongodb user model _id
                      invitees: meetingInvitees, // list of slack usernames invited
                      subject: meetingSubject,
                      channelID: 'D6ATM9WMU', //TODO: not sure where to get this from yet
                      date: dateTime,
                      time: meetingTime
                    }
                    checkConflicts(meeting, rtm);
                    res.send('Meeting Confirmed')
                  }
                })
              }
            })
          });
          //ELSE STILL SAVE REMINDER EVEN IF THEIR TOKEN IS EXPIRED
        } else {
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
            //it was a meeting
            var newMeeting = new Reminder({
              userID: user._id,
              channelID: payload.channel.id,
              subject: meetingSubject,
              date: meetingDate,
              time: meetingTime,
              invitees: meetingInvitees,
            })
            newMeeting.save(function(err){
              console.log("There was an error saving this for some freaking reason!: ", err)
              if (err){
                res.status(400).json({error:err});
              }else{
                meetingDate = new Date(meetingDate);
                let dateTime = meetingDate.toISOString().substring(0, 10);
                // createCalendarReminder(dateTime, meetingSubject, user.token , meetingInvitees);
                var meeting = {
                  userID: user._id, //mongodb user model _id
                  invitees: meetingInvitees, // list of slack usernames invited
                  subject: meetingSubject,
                  channelID: 'D6ATM9WMU', //TODO: not sure where to get this from yet
                  date: dateTime,
                  time: meetingTime
                }
                if(checkConflicts(meeting, rtm)){
                  //there was no conflict
                  // TODO: meeting.invitees needs to be the array of emails
                  createCalendarReminder(meeting.date, meeting.subject, tokens, meeting.invitees, meeting.time);
                };
                res.send('Meeting Confirmed')
              }
            })
          }
        }
      }
    })
  } else {
    res.send('Cancelled');
  }
})
app.listen(process.env.PORT || 3000);
function createCalendarReminder(date, subject, tokens, invitees, time){
  if(!invitees){
    var event = {
      'summary': subject,
      'start': {
        'date': date,
      },
      'end': {
        'date': date
      }
    };
  } else {
    let attendeesArr = [];
    invitees.forEach((invited) => {
      attendeesArr.push({
        'email' : invited
      })
    })

    let dateTime = date + "T" + time + "-07:00"
    var event = {
      'summary': subject,
      'start': {
        'dateTime': date
      },
      'end': {
        'dateTime': dateTime
      },
      'attendees': [
    {'email': 'ryan.clyde15@gmail.com'},
  ],
    };
  }

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

function checkConflicts(meeting, rtm){
    // var meetingStart = meeting.date+'T'+meeting.time+'-00:00';
    // var dateSplit = meeting.date.split('-');
    // var timeSplit = meeting.time.split(':');
    // var meetingStart = new Date(dateSplit[0], dateSplit[1], dateSplit[2], timeSplit[0], timeSplit[1], timeSplit[2]).toISOString();
    // var meetingEnd = new Date(dateSplit[0], dateSplit[1], dateSplit[2], timeSplit[0] + 1, timeSplit[1], timeSplit[2]).toISOString();

    meeting.invitees.forEach( function(invitee) {
        var inviteeuser = rtm.dataStore.getUserByName(invitee); //given the invitee slack name, find their slack user object
        var inviteeSlackID = inviteeuser.id; //get slack id from slack user

        //find a user in our DB with that slack username
        User.findOne({slackID: inviteeSlackID}, function(err, user) {
            if(user) {
                //save user tokens
                var tokens = user.token;
                oauth2Client = new OAuth2(
                  process.env.GOOGLE_CLIENT_ID,
                  process.env.GOOGLE_CLIENT_SECRET,
                  process.env.DOMAIN + '/connect/callback'
                )
                oauth2Client.setCredentials(tokens);
                var calendar = google.calendar('v3');
                //AT THIS POINT YOU ARE AUTHENTICATED TO SEE THE INVITEE GOOGLE calendar

                //get all busy time slots IGNORE BELOW HERE BC ITS NONSENSE
                calendar.freebusy.query({
                    auth: oauth2Client,
                    headers: { "content-type" : "application/json" },
                    resource:{items: [{id: 'primary', busy: 'Active'}],
                    // timeZone: "America/Los_Angeles",
                     timeMin: (new Date(2017, 06, 20)).toISOString(),
                     timeMax: (new Date(2017, 06, 21)).toISOString()
                   }
                }, function(err, schedule) {
                  if(err){
                    console.log("There was an error getting invitee calendar", err);
                    return
                  }else {

                    //   console.log('schedule is', schedule);
                    var busyList = schedule.calendars.primary.busy;
                    busyList.forEach((time) => {
                        // console.log('busy at time: ', time);
                        var newtimestart = new Date(time.start).toUTCString();
                        var newtimeend = new Date(time.end).toUTCString();
                        console.log('utc version', newtimestart, newtimeend);
                        if(meetingStart >= time.start && meetingStart <= time.end || meetingEnd >= time.start && meetingEnd <= time.end){
                            //the person is busy at that meeting time
                            console.log('USER IS BUSY DURING THAT MEETING TIME');
                        }
                    })
                  }
                })
            }
        })
    })
}

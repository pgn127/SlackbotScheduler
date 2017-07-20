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
var {rtm} = require('./rtm-client')

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
      'email',
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
  console.log("hit /connect/callback");
  const code = req.query.code;
  oauth2Client = new OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.DOMAIN + '/connect/callback'
  )
  console.log("this is oauth", oauth2Client);
  oauth2Client.getToken(code, function (err, tokens) {
    if(err) {
      console.log(err)
    } else {
      //set credentials. not entirely sure what this does but necessary for google plus
      //when a person gives access to their google calendar, we also make a request to google plus
      //with their oauth2client in order to get their email address which is then saved in the user object
      //in mongodb.
      oauth2Client.setCredentials(tokens);
      console.log("this is tokens", tokens);
      var plus = google.plus('v1');
      plus.people.get({auth: oauth2Client, userId: 'me'}, function(err, person){
        if(err){
          console.log(err)
        } else {
          //when a person
          console.log("this is googleplus person object", person);
          var tempEmail = person.emails[0].value;
          let auth_id = JSON.parse(decodeURIComponent(req.query.state));
          var newUser = new User({
            token: tokens,
            slackID: slackID,
            auth_id: auth_id.auth_id,
            email: tempEmail
          });
          newUser.save()
          .then( () => res.status(200).send("Your account was successfuly authenticated"))
          .catch((err) => {
            console.log('error in newuser save of connectcallback');
            res.status(400).json({error:err});
          })
        }
      });
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
          var meetingInvitees = payload.original_message.attachments[0].fields[3].value.split(", ");

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
                    // TODO: uncomment the following lines
                    // if(checkConflicts(meeting, rtm)){
                    //   findAndReturnEmails(meeting.invitees, meeting.date,  meeting.subject, tokens, meeting.time);
                    // };
                      findAndReturnEmails(meeting.invitees, meeting.date,  meeting.subject, tokens, meeting.time);

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
                console.log(meeting)
                // TODO: uncomment the following lines
                // if(checkConflicts(meeting, rtm)){
                //   findAndReturnEmails(meeting.invitees, meeting.date,  meeting.subject, tokens, meeting.time);
                // };
                findAndReturnEmails(meeting.invitees, meeting.date,  meeting.subject, user.token, meeting.time);

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
    console.log(attendeesArr);
    let dateTime = date + "T" + time + "-07:00"
    var event = {
      'summary': subject,
      'start': {
        'dateTime': dateTime
      },
      'end': {
        'dateTime': dateTime
      },
      'attendees': attendeesArr,
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


function findAndReturnEmails (users, date, subject, tokens, time) {

  var slackIdArray = [];

  users.forEach((username) => {
    let userObj = rtm.dataStore.getUserByName(username);
    slackIdArray.push(userObj.id);
  })

  var emailArray = [];
  var promisArray = [];

  slackIdArray.forEach((slackId) => {
    promisArray.push(User.findOne({slackID: slackId}).exec()
  .then((user) => user.email))
  })

  Promise.all(promisArray).then((arr) => {
    createCalendarReminder(date, subject, tokens, arr, time);
  })
}

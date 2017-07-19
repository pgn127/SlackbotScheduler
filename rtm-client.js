var mongoose = require('mongoose');
var models = require('./models');
var google = require('googleapis');
var {User, Reminder} = require('./models');
var slackID;
var _ = require('underscore')
var axios = require('axios');
const timeZone = "2017-07-17T14:26:36-0700";
const identifier = 20150910;
var OAuth2 = google.auth.OAuth2;
var googleAuth = require('google-auth-library');
// var messageButtons = {
//           "attachments": [
//               {
//                   "fields": [
//                       {
//                           "title": "Subject",
//                           "value": `${data.result.parameters.subject}`
//                       },
//                       {
//                           "title": "Date",
//                           "value": `${data.result.parameters.date}`
//                       }
//                   ],
//                   "fallback": "You are unable to choose a game",
//                   "callback_id": "wopr_game",
//                   "color": "#3AA3E3",
//                   "attachment_type": "default",
//                   "actions": [
//                       {
//                           "name": "yes",
//                           "text": "Yes",
//                           "type": "button",
//                           "value": "true"
//                       },
//                       {
//                           "name": "no",
//                           "text": "No",
//                           "type": "button",
//                           "value": "false"
//                       }
//                   ]
//               }
//           ]
//       }
var {RtmClient, WebClient, CLIENT_EVENTS, RTM_EVENTS} = require('@slack/client');
//same as var RtmClient = require('@slack/client').RtmClient
var token = process.env.SLACK_API_TOKEN || '';
var rtm = new RtmClient(token);
var web = new WebClient(token);
let channel;
var awaitingResponse = false;


// var pamtofrankie = {
//     userID: '596f927c2945b10011ad86b0',
//     invitees: ['fflores'],
//     subject: 'get some dinna',
//     channelID: 'D6ATM9WMU',
//     date: '2017-07-20',
//     time: '17:00:00'
//
// }
var pamtofrankie = {
    userID: '596f91760f86e7001144794d',
    invitees: ['pneedle'],
    subject: 'get some dinna',
    channelID: 'D6ATM9WMU',
    date: '2017-06-21', //equivalent to 07/19/2017
    time: '17:00:00'

}

rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, (rtmStartData) => {
  // console.log(`Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name}, but not yet connected to a channel`);
});
rtm.on(RTM_EVENTS.MESSAGE, function handleRtmMessage(message) {

  var dm = rtm.dataStore.getDMByUserId(message.user); //gets the channel ID for the specific conversation between one user and bot
  slackID = message.user;
  const userId = message.user;
  if(message.subtype && message.subtype === 'message_changed') {
    awaitingResponse = false;
    return;
  }
  if( !dm || dm.id !== message.channel || message.type !== 'message') {
    // console.log('MESSAGE WAS NOT SENT TOA  DM SO INGORING IT');
    return;
  }
  User.findOne({slackID: slackID}).exec(function(err, user){
    if(err){
      console.log(err)
    } else {
      if(!user){
        rtm.sendMessage('Please visit the following link to activate your account ' + process.env.DOMAIN + '/oauth?auth_id='+slackID, message.channel);
      } else {
          checkConflicts(pamtofrankie, rtm);
        processMessage(message, rtm);
      }
    }
  })
});
rtm.on(RTM_EVENTS.REACTION_ADDED, function handleRtmReactionAdded(reaction) {
  console.log('Reaction added:', reaction);
});
rtm.on(RTM_EVENTS.REACTION_REMOVED, function handleRtmReactionRemoved(reaction) {
  console.log('Reaction removed:', reaction);
});
rtm.start();
function processMessage(message, rtm) {
  // console.log('entered process message');
  axios.get('https://api.api.ai/api/query', {
    params: {
      v: identifier,
      lang: 'en',
      timezone: timeZone,
      query: message.text,
      sessionId: message.user
    },
    headers: {
      Authorization: `Bearer ${process.env.API_ACCESS_TOKEN}`
    }
  })
  .then(function({data}) {
    // console.log('data.result', data.result);
    if(awaitingResponse) {
      rtm.sendMessage('Please accept or decline the previous reminder', message.channel);
    }
    else if(data.result.actionIncomplete) {
      rtm.sendMessage(data.result.fulfillment.speech, message.channel)
    } else if(Object.keys(data.result.parameters).length !== 0){
      awaitingResponse = true;

      if(data.result.metadata.intentName === "Setting a Reminder"){
        //remind intent
        web.chat.postMessage(message.channel, `Would you like me to create a reminder for ` , {
          "attachments": [
            {
              "fields": [
                {
                  "title": "Subject",
                  "value": `${data.result.parameters.subject}`
                },
                {
                  "title": "Date",
                  "value": `${data.result.parameters.date}`
                }
              ],
              "fallback": "You are unable to choose a game",
              "callback_id": "wopr_game",
              "color": "#3AA3E3",
              "attachment_type": "default",
              "actions": [
                {
                  "name": "yes",
                  "text": "Yes",
                  "type": "button",
                  "value": "true"
                },
                {
                  "name": "no",
                  "text": "No",
                  "type": "button",
                  "value": "false"
                }
              ]
            }
          ]
        });
      } else {
        //it is the meeting intent

        var fields = [
          {
            "title": "Subject",
            "value": `${data.result.parameters.subject}`
          },
          {
            "title": "Date",
            "value": `${data.result.parameters.date}`
          },
          {
            "title": "Time",
            "value": `${data.result.parameters.time}`
          },
          {
            "title": "Invitees",
            "value": `${data.result.parameters.invitees}`
          }
        ];

        web.chat.postMessage(message.channel, `Would you like me to create the following meeting: ` , {
          "attachments": [
            {
              "fields": fields,
              "callback_id": "wopr_game",
              "color": "#3AA3E3",
              "attachment_type": "default",
              "actions": [
                {
                  "name": "yes",
                  "text": "Yes",
                  "type": "button",
                  "value": "true"
                },
                {
                  "name": "no",
                  "text": "No",
                  "type": "button",
                  "value": "false"
                }
              ]
            }
          ]
        });
      }
    }
    else {
      rtm.sendMessage(data.result.fulfillment.speech, message.channel)
    }
  })
  .catch(function(err){
    console.log('error in procesmessage', err);
  })
  // rtm.sendMessage(messageText, message.channel, function() {
  //   // getAndSendCurrentWeather(locationName, query, message.channel, rtm);
  // });
}


function checkConflicts(meeting, rtm){
    // var meetingStart = meeting.date+'T'+meeting.time+'-00:00';
    var dateSplit = meeting.date.split('-');
    var timeSplit = meeting.time.split(':');
    var meetingStart = new Date(dateSplit[0], dateSplit[1], dateSplit[2], timeSplit[0], timeSplit[1], timeSplit[2]).toISOString();
    var meetingEnd = new Date(dateSplit[0], dateSplit[1], dateSplit[2], timeSplit[0] + 1, timeSplit[1], timeSplit[2]).toISOString();

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
                var timemin = new Date(dateSplit[0], dateSplit[1], dateSplit[2], timeSplit[0], timeSplit[1], timeSplit[2]);
                var timemax = new Date(dateSplit[0], dateSplit[1], (parseInt(dateSplit[2]) + 1).toString(), timeSplit[0], timeSplit[1], timeSplit[2]);
                console.log('timemin and max', timemin.toISOString(),timemax.toISOString());
                calendar.freebusy.query({
                    auth: oauth2Client,
                    headers: { "content-type" : "application/json" },
                    resource:{items: [{id: 'primary', busy: 'Active'}],
                    // timeZone: "America/Los_Angeles",
                     timeMin: timemin.toISOString(),//(new Date(2017, 06, 20)).toISOString(),
                     timeMax: timemax.toISOString(),//(new Date(2017, 06, 21)).toISOString()
                   }
                }, function(err, schedule) {
                  if(err){
                    console.log("There was an error getting invitee calendar", err);
                    return
                  }else {
                    //   console.log('schedule is', schedule);
                    var busyList = schedule.calendars.primary.busy;
                    console.log('busy list', busyList);
                    busyList.forEach((time) => {
                        // console.log('busy at time: ', time);
                        var newtimestart = new Date(time.start).toUTCString();
                        var newtimeend = new Date(time.end).toUTCString();
                        //
                        // //UTC DATE OBJECT FOR BUSY TIME
                        // var busyUTCstart = new Date(newtimestart);
                        // var busyUTCend = new Date(newtimeend);
                        //
                        // //UTC DATE OBJECTS FOR MEETING START AND end
                        // var meetingUTCstart = new Date(new Date(dateSplit[0], dateSplit[1], dateSplit[2], timeSplit[0], timeSplit[1], timeSplit[2]).toUTCString());
                        // var meetingUTCend = new Date(new Date(dateSplit[0], dateSplit[1], dateSplit[2], timeSplit[0] + 1, timeSplit[1], timeSplit[2]).toUTCString());


                        console.log('utc version', newtimestart, newtimeend);
                        // if(meetingStart >= time.start && meetingStart <= time.end || meetingEnd >= time.start && meetingEnd <= time.end){
                        //     //the person is busy at that meeting time
                        //     console.log('USER IS BUSY DURING THAT MEETING TIME');
                        // }
                    })
                  }
                })

            }
        })
    })
}

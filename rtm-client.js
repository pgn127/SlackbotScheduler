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
    channelID: 'D6A33DH52',//'D6ASP325U',
    date: '2017-07-20', //equivalent to 07/20/2017
    time: '16:00:00'
}

rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, (rtmStartData) => {
  // console.log(`Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name}, but not yet connected to a channel`);
});
rtm.on(RTM_EVENTS.MESSAGE, function handleRtmMessage(message) {
    // console.log(message);
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
    var dateSplit = meeting.date.split('-');
    var timeSplit = meeting.time.split(':');

    meetingDate= new Date(meeting.date);
    let startTime = meetingDate.toISOString().substring(0, 11) + meeting.time + "-07:00";
    let endTime = meetingDate.toISOString().substring(0, 11) + '17:00:00' + "-07:00";



    var inviteesAllAvailable = true;
    meeting.invitees.forEach( function(invitee) {
        var inviteeuser = rtm.dataStore.getUserByName(invitee); //given the invitee slack name, find their slack user object
        var inviteeSlackID = inviteeuser.id; //get slack id from slack user
        //find a user in our DB with that slack username
        User.findOne({slackID: inviteeSlackID}, function(err, user) {
            // console.log('user is ', user);
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

                calendar.freebusy.query({
                    auth: oauth2Client,
                    headers: { "content-type" : "application/json" },
                    resource:{items: [{id: 'primary', busy: 'Active'}],
                    // timeZone: "America/Los_Angeles",
                     timeMin: startTime,//timemin.toISOString(),//(new Date(2017, 06, 20)).toISOString(),
                     timeMax: new Date(Date.parse((new Date(endTime))) + 7*24*60*60*1000).toISOString()//timemax.toISOString(),//(new Date(2017, 06, 21)).toISOString()
                   }
                }, function(err, schedule) {
                  if(err){
                    console.log("There was an error getting invitee calendar", err);
                    return
                  }else {
                    var busyList = schedule.calendars.primary.busy;
                    var inviteeFreeSlots = []; //array of time invertvals that this invitee is free
                    busyList.forEach((time) => {
                        var timezone = {timeZone: "America/Los_Angeles"};


                        //TEST FOR CONFLICT:
                        //1. meeting starts during the invitee's event OR 2. meeting ends during the invitee's event

                        console.log('startTime new date(starttime)', startTime, new Date(startTime), '\n time.start new date of time.start \n', time.start, new Date(time.start));
                        console.log('\n')

                        var meetingStartTime = (new Date(Date.parse(startTime))).toTimeString();
                        var meetingEndTime = (new Date(Date.parse(endTime))).toTimeString();
                        var userEventStartTime = (new Date(Date.parse(time.start))).toTimeString();
                        var userEventEndTime = (new Date(Date.parse(time.end))).toTimeString();
                        var userEventDate = (new Date(Date.parse(time.start))).toDateString();


                        if(Date.parse(startTime) >= Date.parse(time.start) && Date.parse(startTime) <= Date.parse(time.end) || Date.parse(endTime) >= Date.parse(time.start) && Date.parse(endTime) <= Date.parse(time.end)){
                        // if(new Date(startTime) >= new Date(time.start) && new Date(startTime) <= new Date(time.end) || new Date(endTime) >= new Date(time.start) && new Date(endTime) <= new Date(time.end)){

                            rtm.sendMessage(`BUSY: the meeting you tried to schedule for day  ${startTime.substring(0, 10)} from \n ${meetingStartTime}-${meetingEndTime} \n conflicts with ${invitee}'s event on day ${time.start.substring(0,10)} from \n ${userEventStartTime}-${new Date(time.end).toLocaleTimeString(timezone)}.\n\n`,'D6ATM9WMU');

                        } else {


                            rtm.sendMessage(`FREE: ${invitee} has no overlap with meeting on day ${startTime.substring(0, 10)} from \n ${new Date(startTime).toLocaleTimeString(timezone)}-${new Date(endTime).toLocaleTimeString(timezone)} \n and ${invitee}s event on day ${time.start.substring(0,10)} from \n ${new Date(time.start).toLocaleTimeString(timezone)}-${new Date(time.end).toLocaleTimeString(timezone)}.\n\n`,'D6ATM9WMU');


                        }
                    })
                  }
                })

            }
        })
    })
    return inviteesAllAvailable;
}

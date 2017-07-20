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
    // let dateTime = meetingDate.toISOString().substring(0, 11) + meetingTime + "-07:00"
    let dateTime = meetingDate.toISOString().substring(0, 11) + meeting.time + "-07:00";
    let startTime = meetingDate.toISOString().substring(0, 11) + meeting.time + "-07:00";
    let endTime = meetingDate.toISOString().substring(0, 11) + '17:00:00' + "-07:00";
    console.log('meeting datetime', dateTime, new Date(dateTime), new Date(dateTime).toLocaleTimeString({timeZone: "America/Los_Angeles"}));



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
                //AT THIS POINT YOU ARE AUTHENTICATED TO SEE THE INVITEE GOOGLE calendar

                //need to subtract one month because of weird time conversion shit idk
                var timemin = new Date(dateSplit[0], (parseInt(dateSplit[1]) - 1).toString(), dateSplit[2], timeSplit[0], timeSplit[1], timeSplit[2]);
                var timemax = new Date(dateSplit[0], (parseInt(dateSplit[1]) - 1).toString(), (parseInt(dateSplit[2]) + 2).toString(), timeSplit[0], timeSplit[1], timeSplit[2]);

                calendar.freebusy.query({
                    auth: oauth2Client,
                    headers: { "content-type" : "application/json" },
                    resource:{items: [{id: 'primary', busy: 'Active'}],
                    // timeZone: "America/Los_Angeles",
                     timeMin: startTime,//timemin.toISOString(),//(new Date(2017, 06, 20)).toISOString(),
                     timeMax: endTime//timemax.toISOString(),//(new Date(2017, 06, 21)).toISOString()
                   }
                }, function(err, schedule) {
                  if(err){
                    console.log("There was an error getting invitee calendar", err);
                    return
                  }else {

                    var busyList = schedule.calendars.primary.busy;
                     //true when no vconflict exists between invitee events and meeting time and false otherwise

                    var inviteeFreeSlots = []; //array of time invertvals that this invitee is free
                    busyList.forEach((time) => {

                        //TIME WILL BE IN UTC --- UTC DATE OBJECT FOR BUSY TIME
                        var busyUTCstart = new Date(time.start);
                        var busyUTCend = new Date(time.end);

                        // //UTC DATE OBJECTS FOR MEETING START AND end (assume meeting is 1 horu long)
                        var meetingUTCstart = new Date(dateSplit[0], parseInt(dateSplit[1]) - 1, dateSplit[2], timeSplit[0], timeSplit[1], timeSplit[2]);
                        var meetingUTCend = new Date(dateSplit[0], parseInt(dateSplit[1]) - 1, dateSplit[2], (parseInt(timeSplit[0]) +1).toString(), timeSplit[1], timeSplit[2]);


                        var timezone = {timeZone: "America/Los_Angeles"};


                        //TEST FOR CONFLICT:
                        //1. meeting starts during the invitee's event OR 2. meeting ends during the invitee's event
                        if(meetingUTCstart >= new Date(time.start) && meetingUTCstart <= new Date(time.end) || meetingUTCend >= new Date(time.start) && meetingUTCend <= new Date(time.end)){

                            console.log('BUSY: The meeting time \n', meetingUTCstart.toUTCString(), ' - ', meetingUTCend.toUTCString(), '\n conflicts with user event at \n', busyUTCstart.toUTCString(), ' - ', busyUTCend.toUTCString(), '\n');
                            inviteesAllAvailable = false;

                            rtm.sendMessage(`BUSY: the meeting you tried to schedule for day  ${meetingUTCstart.toLocaleDateString()} from \n ${meetingUTCstart.toLocaleTimeString(timezone)}-${meetingUTCend.toLocaleTimeString(timezone)} \n conflicts with ${invitee}'s event on day ${busyUTCstart.toLocaleDateString()} from \n ${new Date(time.start).toLocaleTimeString(timezone)}-${new Date(time.end).toLocaleTimeString(timezone)}.\n\n`,'D6ATM9WMU');

                            // rtm.sendMessage(`BUSY: the meeting you tried to schedule for day  ${meetingUTCstart.toLocaleDateString()} from \n ${meetingUTCstart.toLocaleTimeString(timezone)}-${meetingUTCend.toLocaleTimeString(timezone)} \n conflicts with ${invitee}'s event on day ${busyUTCstart.toLocaleDateString()} from \n ${busyUTCstart.toLocaleTimeString(timezone)}-${busyUTCend.toLocaleTimeString(timezone)}.\n\n`, meeting.channelID);
                        } else {
                            console.log('FREE: No overlap between meeting at \n',meetingUTCstart.toUTCString(), ' - ', meetingUTCend.toUTCString(), '\n and the users event at \n', busyUTCstart.toUTCString(), ' - ', busyUTCend.toUTCString(), '\n');

                            // var str = `FREE: ${invitee} has no overlap with meeting from \n ${meetingUTCstart.toLocaleDateString()}-${meetingUTCend.toLocaleDateString()} \n and the users event from \n ${busyUTCstart.toLocaleDateString()}-${busyUTCend.toLocaleDateString()}.`



                            rtm.sendMessage(`FREE: ${invitee} has no overlap with meeting on day ${new Date(startTime)} from \n ${new Date(startTime).toLocaleTimeString(timezone)}-${new Date(endTime).toLocaleTimeString(timezone)} \n and ${invitee}s event on day ${time.start.substring(0,11)} from \n ${new Date(time.start).toLocaleTimeString(timezone)}-${new Date(time.end).toLocaleTimeString(timezone)}.\n\n`,'D6ATM9WMU');

                            // rtm.sendMessage(`FREE: ${invitee} has no overlap with meeting on day ${meetingUTCstart.toLocaleDateString()} from \n ${meetingUTCstart.toLocaleTimeString(timezone)}-${meetingUTCend.toLocaleTimeString(timezone)} \n and the ${invitee}s event on day ${busyUTCstart.toLocaleDateString()} from \n ${busyUTCstart.toLocaleTimeString(timezone)}-${busyUTCend.toLocaleTimeString(timezone)} \n\n`, meeting.channelID);

                            // rtm.sendMessage('FREE: '+invitee+' has No overlap between meeting at \n'+meetingUTCstart.toLocaleDateString()+' - '+meetingUTCend.toLocaleDateString()+'\n and the users event at \n'+busyUTCstart.toLocaleDateString()+' - ', busyUTCend.toLocaleDateString()+'\n', meeting.channelID);
                        }
                    })
                  }
                })

            }
        })
    })
    return inviteesAllAvailable;
}

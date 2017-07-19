var mongoose = require('mongoose');
var models = require('./models');
var {User, Reminder} = require('./models');
var slackID;
var _ = require('underscore')
var axios = require('axios');
const timeZone = "2017-07-17T14:26:36-0700";
const identifier = 20150910;
var slackID;
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
// The client will emit an RTM.AUTHENTICATED event on successful connection, with the `rtm.start` payload
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
                  "text": "Confirm",
                  "type": "button",
                  "value": "true"
                },
                {
                  "name": "no",
                  "text": "Cancel",
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
                  "text": "Confirm",
                  "type": "button",
                  "value": "true"
                },
                {
                  "name": "no",
                  "text": "Cancel",
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

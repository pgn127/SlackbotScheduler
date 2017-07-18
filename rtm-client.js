const timeZone = "2017-07-17T14:26:36-0700";
const identifier = "20150910";

var messageButtons = {
          "attachments": [
              {
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
      }

var {RtmClient, WebClient, CLIENT_EVENTS, RTM_EVENTS} = require('@slack/client');
//same as var RtmClient = require('@slack/client').RtmClient
var token = process.env.SLACK_API_TOKEN || '';

var rtm = new RtmClient(token);
var web = new WebClient(token);
let channel;

// The client will emit an RTM.AUTHENTICATED event on successful connection, with the `rtm.start` payload
rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, (rtmStartData) => {
  console.log(`Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name}, but not yet connected to a channel`);
});

// you need to wait for the client to fully connect before you can send messages
// rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, function () {
//   rtm.sendMessage("Hello!", channel);
// });


var axios = require('axios');
rtm.on(RTM_EVENTS.MESSAGE, function handleRtmMessage(message) {
  //need to determine who this message was sent to
  var dm = rtm.dataStore.getDMByUserId(message.user); //gets the channel ID for the specific conversation between one user and bot
  if( !dm || dm.id !== message.channel || message.type !== 'message') {
      console.log('MESSAGE WAS NOT SENT TOA  DM SO INGORING IT');
      return;
  }

  processMessage(message, rtm);



});

rtm.on(RTM_EVENTS.REACTION_ADDED, function handleRtmReactionAdded(reaction) {
  console.log('Reaction added:', reaction);
});

rtm.on(RTM_EVENTS.REACTION_REMOVED, function handleRtmReactionRemoved(reaction) {
  console.log('Reaction removed:', reaction);
});

rtm.start();


function processMessage(message, rtm) {
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
        console.log(data.result);
        if(data.result.actionIncomplete) {
            rtm.sendMessage(data.result.fulfillment.speech, message.channel)
        } else {
            console.log('is complete', data.result.parameters);
            web.chat.postMessage(message.channel, `Creating reminder for ${data.result.parameters.subject} on ${data.result.parameters.date}`, messageButtons);
        }
    })
    .catch(function(err){
        console.log(err);
    })

  // rtm.sendMessage(messageText, message.channel, function() {
  //   // getAndSendCurrentWeather(locationName, query, message.channel, rtm);
  // });
}


import axios from 'axios'

const timeZone = "2017-07-17T14:26:36-0700";
const identifier = "20150910";

var RtmClient = require('@slack/client').RtmClient;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;

var token = process.env.SLACK_API_TOKEN || '';

var rtm = new RtmClient(token, { logLevel: 'debug' });
rtm.start();

rtm.on(RTM_EVENTS.MESSAGE, function handleRtmMessage(message) {
  console.log('Message:', message);
  //MAKE GET REQUEST TO THE API.AI SERVER
  //prase the message so it is the correct format for the get request
  axios.get('https://api.api.ai/api/query?v=' + identifier, {
    headers: {
      Authorization: "Bearer" + process.env.API_ACCESS_TOKEN
    },
    params: {
      query: message.text,
      lang: en,
      sessionId: message.user,
      timezone: timeZone,
    }
  }).then((response) => {
    if(response.result.actionIncomplete) {
      //need to prompt the user for more information
      // TODO: send the user response.result.fulfillment.speech
    } else {
      // TODO: send the user a confirmation with response.result.fulfillment.speech
    }
  })


});

rtm.on(RTM_EVENTS.REACTION_ADDED, function handleRtmReactionAdded(reaction) {
  console.log('Reaction added:', reaction);
});

rtm.on(RTM_EVENTS.REACTION_REMOVED, function handleRtmReactionRemoved(reaction) {
  console.log('Reaction removed:', reaction);
});

curl 'https://api.api.ai/api/query?v=20150910&
query=remind%20me%20to%20do%20the%20dishes%20tomorrow&
lang=en&
sessionId=b72bd408-bcf1-4366-8bb6-9224142420b0&
timezone=
 -H 'Authorization:Bearer f3b4569a54774d98be21567b952ebebd'

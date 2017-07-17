
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
  const parsedString = message.text.replace(" ", "%20");
  axios.get('https://api.api.ai/api/query?v=' + identifier, {
    params: {
      query: parsedString,
      lang: en,
      sessionId: message.user,
      timezone: timeZone,
      headers: {Authorization: "Bearer" + process.env.API_ACCESS_TOKEN}

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

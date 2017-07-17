
import axios from 'axios'

const timeZone = "2017-07-17T14:26:36-0700";
const identifier = "20150910";

var messageButtons = {
            "text": "Would you like to play a game?",
            "attachments": [
                {
                    "text": "Choose a game to play",
                    "fallback": "You are unable to choose a game",
                    "callback_id": "wopr_game",
                    "color": "#3AA3E3",
                    "attachment_type": "default",
                    "actions": [
                        {
                            "name": "game",
                            "text": "Chess",
                            "type": "button",
                            "value": "chess"
                        },
                        {
                            "name": "game",
                            "text": "Falken's Maze",
                            "type": "button",
                            "value": "maze"
                        },
                        {
                            "name": "game",
                            "text": "Thermonuclear War",
                            "style": "danger",
                            "type": "button",
                            "value": "war",
                            "confirm": {
                                "title": "Are you sure?",
                                "text": "Wouldn't you prefer a good game of chess?",
                                "ok_text": "Yes",
                                "dismiss_text": "No"
                            }
                        }
                    ]
                }
            ]
        }

var RtmClient = require('@slack/client').RtmClient;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;

var token = process.env.SLACK_API_TOKEN || 'xoxb-213948372850-8BZYcWtZJvHWTzfZhpTsjGbl';

var rtm = new RtmClient(token);
rtm.start();

rtm.on(RTM_EVENTS.MESSAGE, function handleRtmMessage(message) {
  processMessage(message, rtm);
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


function processMessage(message, rtm) {
  var messageText = message.text;
  //var query = (isNaN(locationName) ? 'q=' + locationName : 'zip=' + locationName) + '&units=imperial&APPID=' + WEATHER_API_KEY;
  rtm.sendMessage(messageText, message.channel, function() {
    // getAndSendCurrentWeather(locationName, query, message.channel, rtm);
  });
}

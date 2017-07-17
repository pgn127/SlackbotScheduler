
/**
 * Example for creating and working with the Slack RTM API.
 */

/* eslint no-console:0 */

var messageButtons = {
            "text": "Would you like to play a game?",
            "attachments": [
                {
                    "text": "Choose a game to play",
                    "fallback": "You are unable to choose a game",
                    "callback_id": "wopr_game",
                    "color": "#3AA3E3",
                    "attachment_type": "default",
                    "confirm": {
                        "title": "Are you sure?",
                        "text": "Wouldn't you prefer a good game of chess?",
                        "ok_text": "Yes",
                        "dismiss_text": "No"
                    },
                  },

                    ]
                }



var RtmClient = require('@slack/client').RtmClient;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;

var token = process.env.SLACK_API_TOKEN;
console.log(token);

var rtm = new RtmClient(token);
rtm.start();

rtm.on(RTM_EVENTS.MESSAGE, function handleRtmMessage(message) {
  processMessage(message, rtm);
  console.log('Message:', message);
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

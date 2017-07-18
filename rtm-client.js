var mongoose = require('mongoose');
var models = require('./models');
var {User} = require('./models');
var {Reminder} = require('./models');
var slackID;

var axios = require('axios');
const timeZone = "2017-07-17T14:26:36-0700";
const identifier = 20150910;


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

var token = process.env.SLACK_API_TOKEN || '';


console.log(token);
var notPending = true;
var rtm = new RtmClient(token);
var web = new WebClient(token);
rtm.start();

rtm.on(RTM_EVENTS.MESSAGE, function handleRtmMessage(message) {
  var dm = rtm.dataStore.getDMByUserId(message.user); //gets the channel ID for the specific conversation between one user and bot
  const userId = message.user;
  if(message.subtype && message.subtype === 'message_changed') {
    awaitingResponse = false;
    return;
  }
  if( !dm || dm.id !== message.channel || message.type !== 'message') {
    console.log('Message was not sent to DM. Ignoring.');
    return;
  }
  User.findOne({slackID: userId}).exec(function(err, user){
    if(err){console.log(err)
    } else {
      if(!user){
        rtm.sendMessage('Please visit the following link to activate your account ' + process.env.DOMAIN + '/oauth?auth_id='+userId, message.channel);
        return;
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
  axios.get('https://api.api.ai/api/query',{
    params: {
      v: 20150910,
      lang: 'en',
      timezone: '2017-07-17T16:55:33-0700',
      query: message.text,
      sessionId: message.user
    },
    headers: {
      Authorization: `Bearer ${process.env.API_AI_TOKEN}`
    }
  })
  .then(function({data}){
    if (data.result.actionIncomplete){
      console.log('first ',data.result);
      //console.log(data.result);
      rtm.sendMessage(data.result.fulfillment.speech, message.channel)
    }else if (!data.result.actionIncomplete && Object.keys(data.result.parameters).length !== 0){
      //console.log('inside ',data.result);
      notPending = false;
      web.chat.postMessage(message.channel,
        `Please confirm your reminder: `,
        {
          "attachments": [
            {
              "fallback": "You are unable to choose a game",
              "callback_id": "wopr_game",
              "color": "#3AA3E3",
              "attachment_type": "default",
              "fields" : [
                {
                  "title": "subject",
                  "value": `${data.result.parameters.subject}`,
                },
                {
                  "title": "date",
                  "value": `${data.result.parameters.date}`,
                },
              ],
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
        })
      }else{
        console.log('last ',data.result);
        rtm.sendMessage(data.result.fulfillment.speech, message.channel)
      }
    })
    .catch(function(err){
      console.log('error');
    })
  }

  function findReminders(){
    var now = Date.now();
    var tomorrow = new Date(new Date().getTime() + 24 * 60 * 60 * 1000).getTime();
    Reminder.find({}).where('date').gt(now).lt(tomorrow).populate('userID').exec(function(err,reminders){
      if (err){
        // res.status(400).json({error:err});
        return [];
      }else {
        console.log(reminders);
        return reminders;
      }
    })
  }

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
mongoose.Promise = global.Promise;


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
        let inviteArr = [];
        var i = 0;
        console.log('The invitees are: ', data.result.parameters.invitees);
        data.result.parameters.invitees.forEach((user) => {
          if(user.length > 1){
            if(user.charAt(0) === "<"){
              var newUser = user.substr(2)
            } else {
              var newUser = user.substr(1)
            }
            console.log(newUser)
            let userObj = rtm.dataStore.getUserById(newUser)
            if(!i){
              inviteArr.push(userObj.name)
            }else{
              inviteArr.push(" " + userObj.name)
            }
            i++;
          }
        })

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
            "value": `${inviteArr}`
          }
        ];

        if(data.result.parameters.duration !== "") {
          fields.push({
            "title": "Duration",
            "value": `${data.result.parameters.duration.amount} ${data.result.parameters.duration.unit}`
          })
        }

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
}




function checkConflicts(meeting, rtm){
    var busySlots = [];
    var counter = 0;
    var counterGoal = meeting.invitees.length;
    var invitee, user,sevenBusinessDays, meetingDate;
    meeting.invitees.forEach( function(invitee) {
        invitee = invitee;
        var inviteeuser = rtm.dataStore.getUserByName(invitee); //given the invitee slack name, find their slack user object
        var inviteeSlackID = inviteeuser.id; //get slack id from slack user
        //find a user in our DB with that slack username
        User.findOne({slackID: inviteeSlackID}).exec()
        .then((user) =>{
            if(user) {
                user = user;
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
                meetingDate = new Date(meeting.date + ' ' + meeting.time + "-07:00");
                var meetingEnd = new Date(meeting.date + ' ' + meeting.time + "-07:00");
                meetingEnd.setMinutes(meetingEnd.getMinutes() + 30);
                var n = 7;
                while (workingDaysBetweenDates(meetingDate, new Date(Date.parse(meetingEnd) + n*24*60*60*1000)) < 7){
                    n++;
                }
                sevenBusinessDays = new Date(Date.parse(meetingEnd) + n*24*60*60*1000)
                calendar.freebusy.query({
                    auth: oauth2Client,
                    headers: { "content-type" : "application/json" },
                    resource:{
                        items: [{id: 'primary', busy: 'Active'}],
                        timeMin: meetingDate.toISOString(),
                        timeMax: sevenBusinessDays.toISOString() //first # controls # of days to check for conflicting events
                    }
                }
                , function(err, schedule) {
                    console.log(typeof schedule);
                    if(schedule){
                        // console.log(schedule);
                        return schedule
                    } else {
                        console.log('INSIDE ELSE');
                        console.log("There was an error getting invitee calendar", err);
                        throw new Error('couldnt find scheduke for user');

                    }
                }
            )
            } else {
                // continue; //WILL THIS CONTINEU THE FOR EACHc

                throw new Error('couldnt find user');
            }
        })
        .then((schedule) => {
            if(!schedule){
                console.log("There was an error getting invitee calendar");
                throw new Error('couldnt find scheduke for user');
            }else {
                // console.log('schedule is ', schedule);
                var busyList = schedule.calendars.primary.busy;
                busySlots = busySlots.concat(busyList);
                console.log(invitee);
                busyList.forEach((time) => {
                    var meetingStartTime = new Date(meeting.date + ' ' + meeting.time + "-07:00");;
                    meetingStartTime.setDate(meetingStartTime.getDate());
                    var meetingEndTime = new Date(meeting.date + ' ' + meeting.time + "-07:00");
                    meetingEndTime.setDate(meetingEndTime.getDate());
                    meetingEndTime.setMinutes(meetingEndTime.getMinutes() + 30);
                    var conflictStartTime = new Date(time.start);
                    // conflictStartTime.setDate(conflictStartTime.getDate());
                    var conflictEndTime = new Date(time.end);
                    // conflictEndTime.setDate(conflictEndTime.getDate());
                    var convertedMeetingStartTime = new Date(meetingStartTime.toDateString() + ' ' + meetingStartTime.toTimeString() + "+07:00").toLocaleString();
                    var convertedMeetingEndTime = new Date(meetingEndTime.toDateString() + ' ' + meetingEndTime.toTimeString() + "+07:00").toLocaleString();
                    var convertedConflictStartTime = new Date(conflictStartTime.toDateString() + ' ' + conflictStartTime.toTimeString() + "+07:00").toLocaleString();
                    var convertedConflictEndTime = new Date(conflictEndTime.toDateString() + ' ' + conflictEndTime.toTimeString() + "+07:00").toLocaleString();
                    if((meetingStartTime <= conflictStartTime && meetingEndTime > conflictStartTime) || (meetingStartTime >= conflictStartTime && meetingStartTime <= conflictEndTime)){
                        console.log('BUSY: The meeting time \n', convertedMeetingStartTime, ' - ', convertedMeetingEndTime, '\n conflicts with user event at \n', convertedConflictStartTime, ' - ', convertedConflictEndTime, '\n');
                        conflictExists = true;
                    } else {
                        console.log(meetingEndTime >= conflictStartTime && meetingEndTime <= conflictEndTime);
                        console.log('FREE: No overlap between meeting at \n',convertedMeetingStartTime, ' - ', convertedMeetingEndTime, '\n and the users event at \n', convertedConflictStartTime, ' - ', convertedConflictEndTime, '\n');
                    }
                })
            }
            return;
        })
        .then( () => {
            count+=1
            if(count === counterGoal){
                var freetimelist = findFreeTimes(busySlots, meetindDate.toISOString(), sevenBusinessDays.toISOString());
                console.log('freetimelist', freetimelist);
                return freetimelist;
            }
        })
        .catch((err) => {
            counterGoal -= 1; //if you cant get a user, subtract from counter goal so your not waiting on a users info that will never come
            console.log('there was an error in catch', err);
        })


    }) //end of for each
}

function workingDaysBetweenDates(startDate, endDate) {
  // Validate input
  if (endDate < startDate)
  return 0;

  // Calculate days between dates
  var millisecondsPerDay = 86400 * 1000; // Day in milliseconds
  startDate.setHours(0,0,0,1);  // Start just after midnight
  endDate.setHours(23,59,59,999);  // End just before midnight
  var diff = endDate - startDate;  // Milliseconds between datetime objects
  var days = Math.ceil(diff / millisecondsPerDay);

  // Subtract two weekend days for every week in between
  var weeks = Math.floor(days / 7);
  days = days - (weeks * 2);

  // Handle special cases
  var startDay = startDate.getDay();
  var endDay = endDate.getDay();

  // Remove weekend not previously removed.
  if (startDay - endDay > 1)
  days = days - 2;

  // Remove start day if span starts on Sunday but ends before Saturday
  if (startDay == 0 && endDay != 6)
  days = days - 1

  // Remove end day if span ends on Saturday but starts after Sunday
  if (endDay == 6 && startDay != 0)
  days = days - 1

  return days;
}

function reduceTimeIntervals(busyArray){
    var intervalStack = [];
    //sort the intervals based on increasing order of starting time
    var sortedIntervals = _.sortBy(busyArray, 'start');
    intervalStack.push(sortedIntervals[0]); //push the first interval on stack
    sortedIntervals.forEach( (interval) => {
        var stackTop = intervalStack[intervalStack.length - 1];
        //If the current interval overlaps with stack top and ending
        //        time of current interval is more than that of stack top,
        //        update stack top with the ending  time of current interval.
        if((Date.parse(interval.start) <= Date.parse(stackTop.start)&& Date.parse(interval.end) > Date.parse(stackTop.start)) || (Date.parse(interval.start) >= Date.parse(stackTop.start) && Date.parse(interval.start) <= Date.parse(stackTop.end))){
            if(Date.parse(interval.end) > Date.parse(stackTop.end)){
                var modifiedStackTop = Object.assign({}, intervalStack.pop(), {end: interval.end})
                intervalStack.push(modifiedStackTop);
            }
        } else {
            //if for some reason the busy interval has same start and end time, dont add it
            if(Date.parse(interval.start) !== Date.parse(interval.end)){
                intervalStack.push(interval);
            }

        }
    })
    return intervalStack;
}

function findFreeTimes(busyArray, meetingStartDate, sevenBusinessDays){
    //meetingStartDate and sevenBusinessDays must be in format '2017-07-22T23:59:59Z'
    var intervals = reduceTimeIntervals(busyArray);
    var freeStart = meetingStartDate.slice(0,11)+'00:00:00Z'
    var freeEnd = sevenBusinessDays.slice(0,11)+'23:59:59Z'
    var freeStack = []
    intervals.forEach((interval) => {
        freeStack.push({start: freeStart, end: interval.start})
        freeStart = interval.end;
    })
    freeStack.push({start: freeStart, end: freeEnd})
    return freeStack;
}

//
// function checkConflicts(meeting, rtm){
//     var dateSplit = meeting.date.split('-');
//     var timeSplit = meeting.time.split(':');
//
//     meetingDate= new Date(meeting.date);
//     let startTime = meetingDate.toISOString().substring(0, 11) + meeting.time + "-07:00";
//     let endTime = meetingDate.toISOString().substring(0, 11) + '17:00:00' + "-07:00";
//
//
//
//     var inviteesAllAvailable = true;
//     meeting.invitees.forEach( function(invitee) {
//         var inviteeuser = rtm.dataStore.getUserByName(invitee); //given the invitee slack name, find their slack user object
//         var inviteeSlackID = inviteeuser.id; //get slack id from slack user
//         //find a user in our DB with that slack username
//         User.findOne({slackID: inviteeSlackID}, function(err, user) {
//             // console.log('user is ', user);
//             if(user) {
//                 //save user tokens
//                 var tokens = user.token;
//                 oauth2Client = new OAuth2(
//                   process.env.GOOGLE_CLIENT_ID,
//                   process.env.GOOGLE_CLIENT_SECRET,
//                   process.env.DOMAIN + '/connect/callback'
//                 )
//                 oauth2Client.setCredentials(tokens);
//                 var calendar = google.calendar('v3');
//
//                 calendar.freebusy.query({
//                     auth: oauth2Client,
//                     headers: { "content-type" : "application/json" },
//                     resource:{items: [{id: 'primary', busy: 'Active'}],
//                     // timeZone: "America/Los_Angeles",
//                      timeMin: startTime,//timemin.toISOString(),//(new Date(2017, 06, 20)).toISOString(),
//                      timeMax: new Date(Date.parse((new Date(endTime))) + 7*24*60*60*1000).toISOString()//timemax.toISOString(),//(new Date(2017, 06, 21)).toISOString()
//                    }
//                 }, function(err, schedule) {
//                   if(err){
//                     console.log("There was an error getting invitee calendar", err);
//                     return
//                   }else {
//                     var busyList = schedule.calendars.primary.busy;
//                     var inviteeFreeSlots = []; //array of time invertvals that this invitee is free
//                     busyList.forEach((time) => {
//                         var timezone = {timeZone: "America/Los_Angeles"};
//
//
//                         //TEST FOR CONFLICT:
//                         //1. meeting starts during the invitee's event OR 2. meeting ends during the invitee's event
//
//                         // console.log('startTime new date(starttime)', startTime, new Date(startTime), '\n time.start new date of time.start \n', time.start, new Date(time.start));
//                         // console.log('\n')
//                         var meetingDate = (new Date(Date.parse(startTime))).toDateString();
//                         var meetingStartTime = (new Date(Date.parse(startTime))).toTimeString();
//                         var meetingEndTime = (new Date(Date.parse(endTime))).toTimeString();
//                         var userEventStartTime = (new Date(Date.parse(time.start))).toTimeString();
//                         var userEventEndTime = (new Date(Date.parse(time.end))).toTimeString();
//                         var userEventDate = (new Date(Date.parse(time.start))).toDateString();
//                         console.log('USEREVENT DATE', userEventDate);
//
//                         if(Date.parse(startTime) >= Date.parse(time.start) && Date.parse(startTime) <= Date.parse(time.end) || Date.parse(endTime) >= Date.parse(time.start) && Date.parse(endTime) <= Date.parse(time.end)){
//                         // if(new Date(startTime) >= new Date(time.start) && new Date(startTime) <= new Date(time.end) || new Date(endTime) >= new Date(time.start) && new Date(endTime) <= new Date(time.end)){
//
//                             rtm.sendMessage(`BUSY: the meeting you tried to schedule for day  ${meetingDate} from \n ${meetingStartTime.slice(0,8)}-${meetingEndTime.slice(0,8)}UTC \n conflicts with ${invitee}'s event on day ${userEventDate} from \n ${userEventStartTime.slice(0,8)}-${userEventEndTime.slice(0,8)}UTC.\n\n`,'D6ATM9WMU');
//                             rtm.sendMessage(`BUSY: the meeting you tried to schedule for day  ${meetingDate} from \n ${meetingStartTime.slice(0,8)}-${meetingEndTime.slice(0,8)}UTC \n conflicts with ${invitee}'s event on day ${userEventDate} from \n ${userEventStartTime.slice(0,8)}-${userEventEndTime.slice(0,8)}UTC.\n\n`,meeting.channelID);
//
//                         } else {
//
//                             rtm.sendMessage(`FREE: ${invitee} has no overlap with meeting on day ${startTime.substring(0, 10)} from \n ${meetingStartTime.slice(0,8)}-${meetingEndTime.slice(0,8)}UTC \n and ${invitee}s event on day ${userEventDate} from \n ${userEventStartTime.slice(0,8)}-${userEventEndTime.slice(0,8)}UTC.\n\n`,'D6ATM9WMU');
//                             rtm.sendMessage(`FREE: ${invitee} has no overlap with meeting on day ${startTime.substring(0, 10)} from \n ${meetingStartTime.slice(0,8)}-${meetingEndTime.slice(0,8)}UTC \n and ${invitee}s event on day ${userEventDate} from \n ${userEventStartTime.slice(0,8)}-${userEventEndTime.slice(0,8)}UTC.\n\n`,meeting.channelID);
//
//
//                         }
//                     })
//                   }
//                 })
//
//             }
//         })
//     })
//     return inviteesAllAvailable;
// }
module.exports = {
  rtm : rtm
}

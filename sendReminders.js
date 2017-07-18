var mongoose = require('mongoose');
var {Reminder} = require('./models');
mongoose.connect(process.env.MONGODB_URI);

var {RtmClient, WebClient, CLIENT_EVENTS, RTM_EVENTS} = require('@slack/client');
//same as var RtmClient = require('@slack/client').RtmClient

var token = process.env.SLACK_API_TOKEN || '';

var rtm = new RtmClient(token);
var web = new WebClient(token);
sendReminder();


function sendReminder(){
  var reminders = findReminders();
  reminders.forEach(function(reminder) {
      var dmChannel = rtm.dataStore.getDMByUserId(reminder.userID);
      var date = new Date(reminder.date);
      rtm.sendMessage(`Reminder: ${date} for ${reminder.subject}`, dmChannel.id);
  })

}

function findReminders(){
  var now = Date.now();
  var tomorrow = new Date(new Date().getTime() + 24 * 60 * 60 * 1000).getTime();
  Reminder.find({}).where('date').gt(now).lt(tomorrow).exec(function(err,reminders){
    if (err){
      // res.status(400).json({error:err});
      return [];
    }else {
      console.log(reminders);
      return reminders;
    }
  })
}


// var date = new Date();
// var threedaysago = date.setDate(date.getDate() - 3);
// var tomorrow = new Date(new Date().getTime() + 24 * 60 * 60 * 1000).getTime();
// var today = new Date(new Date().getTime() + 2 * 60 * 60 * 1000).getTime();
// var threedaysfromnow = date.setDate(date.getDate() + 3);

// var oldreminder = new Reminder({
//     userID: 'U6ANS0NNS',
//     subject: 'This is a reminder from 3 days ago',
//     access_token: process.env.API_ACCESS_TOKEN,
//     date: threedaysago
// })
//
// var tomorrowreminder = new Reminder({
//     userID: 'U6ANS0NNS',
//     subject: 'This is a reminder from tomorrow',
//     access_token: process.env.API_ACCESS_TOKEN,
//     date: tomorrow
// })
//
// var todayreminder = new Reminder({
//     userID: 'U6ANS0NNS',
//     subject: 'This is a reminder from today',
//     access_token: process.env.API_ACCESS_TOKEN,
//     date: today
// })
//
// var futurereminder = new Reminder({
//     userID: 'U6ANS0NNS',
//     subject: 'This is a reminder for 3 days FROM NOW',
//     access_token: process.env.API_ACCESS_TOKEN,
//     date: threedaysfromnow
// })

// mongoose.Promise = global.Promise;
// oldreminder.save()
// .then(()=>todayreminder.save())
// .then(()=>tomorrowreminder.save())
// .then(()=>futurereminder.save())
// .then(()=>reminderTest())

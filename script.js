var models = require('./models');
var {User} = require('./models');
var {Reminder} = require('./models');
var mongoose = require('mongoose');

var slackID;

var {RtmClient, WebClient, CLIENT_EVENTS, RTM_EVENTS} = require('@slack/client');
var token = process.env.SLACK_API_TOKEN || '';

var rtm = new RtmClient(token);
var web = new WebClient(token);
rtm.start();

mongoose.connect(process.env.MONGODB_URI);


// var tomorrowTest = new Date(new Date().getTime() + 24 * 60 * 60 * 1000).getTime();
// var todayTest = new Date(new Date().getTime() + 2 * 60 * 60 * 1000).getTime();
// var date = new Date();
// var threedaysago = date.setDate(date.getDate() - 3);
// var threedaysfuture = date.setDate(date.getDate() + 3);

// var tomorrowReminder = new Reminder({
//   userID: 'U6A0BLRNZ',
//   subject: 'DO the dishes tomorrow',
//   access_token: process.env.API_ACCESS_TOKEN,
//   date: tomorrowTest
// })
//
// var todayReminder = new Reminder({
//   userID: 'U6A0BLRNZ',
//   subject: 'Walk Dog in 2 hours',
//   access_token: process.env.API_ACCESS_TOKEN,
//   date: todayTest
// })
//
// var pastReminder = new Reminder({
//   userID: 'U6A0BLRNZ',
//   subject: 'IN THE PAST BITCH',
//   access_token: process.env.API_ACCESS_TOKEN,
//   date: threedaysago
// })
//
// var futureReminder = new Reminder({
//   userID: 'U6A0BLRNZ',
//   subject: 'IN THE FUTURE DONT PRINT',
//   access_token: process.env.API_ACCESS_TOKEN,
//   date: threedaysfuture
// })
mongoose.Promise = global.Promise;
reminderTest();
function reminderTest(){
  var reminders = findReminders();
  reminders.forEach(function(reminder){
    var dm = rtm.dataStore.getDMByUserId(reminder.userID);
    rtm.sendMessage("UPCOMING REMINDER: " + reminder.subject + ' on ' + new Date(reminder.date), dm.id);
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

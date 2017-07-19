var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var userSchema = new Schema({
  slackID: String,
  auth_id: String,
  token: Object,
})
var reminderSchema = new Schema({
  userID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
  },
  subject: String,
  channelID: String,
  date: Number
})

var meetingSchema = new Schema({
  userID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
  },
  subject: String,
  channelID: String,
  date: String,
  invitees: Array,
  Time: String,
})

var Meeting = mongoose.model('Meeting', meetingSchema);
var User = mongoose.model('User', userSchema);
var Reminder = mongoose.model('Reminder', reminderSchema);
module.exports = {
  User: User,
  Reminder: Reminder,
  Meeting: Meeting,
 };

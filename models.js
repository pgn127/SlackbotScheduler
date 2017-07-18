var mongoose = require('mongoose');

var Schema = mongoose.Schema;

var userSchema = new Schema({
  slackID: String,
  auth_id: String,
  subject: String,
  date: Date,
  token: Object,
})


var User = mongoose.model('User', userSchema);

module.exports = {
  User: User };

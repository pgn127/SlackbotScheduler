var mongoose = require('mongoose');

var Schema = mongoose.Schema;

var userSchema = new Schema({
  slackID: String,
  refresh_token: String,
  access_token: String,
  auth_id: String,
  token_type: String,
  expiry_date: Number,
  subject: String,
  date: Date,
})

var User = mongoose.model('User', userSchema);

module.exports = {
  User: User };

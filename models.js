import mongoose from 'mongoose';

var Schema = mongoose.Schema;

var userSchema = new Schema({
  slackID: String,
  refresh_token: String,
  access_token: String,
  auth_id: String,
  token_type: String,
  expiry_date: Number
})

var User = mongoose.model('User', userSchema);

export { User };

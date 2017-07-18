var mongoose = require('mongoose');

// Step 0: Remember to add your MongoDB information in one of the following ways!
var connect = process.env.MONGODB_URI || require('./connect');
mongoose.connect(connect);


var userSchema = mongoose.Schema({
  slackId: {
    type: String,
    required: true
  },
  slackName: {
    type: String,
    required: true
  }
});

var User = mongoose.model('User', userSchema);


module.exports = {
  User: User
}

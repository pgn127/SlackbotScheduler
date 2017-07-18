
// var fs = require('fs');
var mongoose = require('mongoose');
var logger = require('morgan');
var google = require('googleapis');
var {User} = require('./models')
var OAuth2 = google.auth.OAuth2;
// var googleAuth = require('google-auth-library');
var express = require('express');
// var request = require('request');
require('./rtm-client');
var app = express();
var bodyParser = require('body-parser');

app.use(logger('dev'));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
// var app = express();

var {RtmClient, WebClient, CLIENT_EVENTS, RTM_EVENTS} = require('@slack/client');

var CLIENT_ID = process.env.CLIENT_ID;
var CLIENT_SECRET = process.env.CLIENT_SECRET;
const PORT=3000;

var oauth2Client;
var url;
var slackID;

// Start our server

app.get('/oauth', function(req, res){
    oauth2Client = new OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.DOMAIN + '/connect/callback'
    )
    url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: [
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/calendar'
        ],
        state: encodeURIComponent(JSON.stringify({
            auth_id: req.query.auth_id
        }))
    });
    slackID = req.query.auth_id
    res.redirect(url);
})

app.get('/connect/callback', function(req, res) {
    const code = req.query.code;
    // console.log('request ', req);
    // console.log('code is ', code);
    oauth2Client.getToken(code, function (err, tokens) {
        const refresh_token = tokens.refresh_token;
        const access_token = tokens.access_token;
        const auth_id = JSON.parse(decodeURIComponent(req.query.state));
        const token_type = tokens.token_type;
        const expiry_date = tokens.expiry_date;
        // console.log(tokens);

        var newUser = new User({
            slackId: slackID,
            refreshToken: refresh_token,
            accessToken: access_token,
            authId: auth_id.auth_id,
            tokenType: token_type,
            expiryDate: expiry_date
        });

        newUser.save(function(err, user){
            if (err){
                res.status(400).json({error:err})
            }else{
                res.json({success:true, message:"Your account was successfuly authenticated", user: user })
            }
        });


        // User.findOne({slackId: req.query.code}, function(err,user){
        //
        //     console.log('user find one');
        //     if (err){
        //         res.status(400).json({error:err});
        //     }else{
        //         if(!user) {
        //             console.log('user is ', user);
        //             user.refreshToken = refresh_token;
        //             user.accessToken = access_token;
        //             user.authId = auth_id;
        //             user.tokenType = token_type;
        //             user.expiryDate = expiry_date;
        //             user.slackId = user.slackId;
        //             // user.slackName = user.slackName;
        //             user.save(function(err){
        //                 console.log('in user save');
        //                 if (err){
        //                     res.status(400).json({error:err});
        //                 }else{
        //                     oauth2Client.setCredentials(tokens);
        //                     res.status(200).json({success:'Successful Connection'});
        //                 }
        //             })
        //         }
        //     }
        // })

        // Now tokens contains an access_token and an optional refresh_token. Save them.
        res.status(200);
        if (!err) {
            oauth2Client.setCredentials(tokens);
        }
    });
})

// This route handles GET requests to our root ngrok address and responds with the same "Ngrok is working message" we used before
app.get('/', function(req, res) {
    res.send('Ngrok is working! Path Hit: ' + req.url);
});

// Route the endpoint that our slash command will point to and send back a simple response to indicate that ngrok is working
app.post('/command', function(req, res) {
    res.send('Your ngrok tunnel is up and running!');
});

app.post('/slack/interactive', function(req,res){
    var payload = JSON.parse(req.body.payload);
    //if user clicks confirm button
    if(payload.actions[0].value === 'true') {
        res.send('Created reminder');
        // TODO: create a calendar event here
    } else{
        console.log('cancel was clicked');
        res.send('Cancelled');
    }
})

// app.use((req, res, next) => {
//   var err = new Error('Not Found');
//   err.status = 404;
//   next(err);
// });
//
//
// // error handler
// app.use((err, req, res, next) => {
//   // set locals, only providing error in development
//   res.locals.message = err.message;
//   res.locals.error = req.app.get('env') === 'development' ? err : {};
//
//   // render the error page
//   res.status(err.status || 500);
//   res.render('error');
// });
// export default app;

app.listen(PORT, function () {
    //Callback triggered when server is successfully listening. Hurray!
    console.log("Example app listening on port " + PORT);
});

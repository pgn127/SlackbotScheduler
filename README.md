# slack-scheduler


## Install ngrok
https://ngrok.com/  
Download the file, extract, and move the extracted file to your $PATH directory.  
Find your path directory:
```
echo $PATH
```
```
mv /Users/franciscoflores/horizons/slack-scheduler/ngrok /usr/local/bin
```
*Note: This is an example on my directory, path names will vary.*

Start up the ngrok server:
```
ngrok http 4390
```
*Note: Port sprecified here must match port in your code later on.*

Add your redirect URL [here](https://api.slack.com/apps/A696Q4WKA/oauth) if you want to use your own ngrok.  
When adding a redirect, use the forwarding URL given after running the ngrok command, and adding /oauth at the end.  
Example:  
```
http://9b492ca6.ngrok.io/oauth
```

Start your localhost server:
```
node app.js
```



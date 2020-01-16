# squad-bot

Installation

docker run -d --name Squad-Bot --restart always -v "/path/to/local/data:/usr/src/app" -e LANG=C.UTF-8 -w "/usr/src/app/" node:latest node bot.js

Create a ./settings Folder
Must contain a ./settings/settings.json
With following content:
{
  "discordtoken": "",
  "discordreportchannelid": "",
  "discordcontrolchannelid": "",
  "discordseedingchannelid": "",
  "discorddebugchannelid": "",
  "discordserveradminroleid": "",
  "discorddeveloperuserid": "",
  "prefix": "!",
  "serverip": "",
  "rconport": "",
  "rconpassword": "",
  "steamqueryport": "",
  "discordinvitelink": "",
  "logolink": "",
  "servername": "",
  "servernameshort": "",
  "battlemetricsid": "",
  "pingforseed": "",
  "seedingcommand": ,
  "seedingcommandroles": [
    "",
    "",
    "",
    "",
    ""
  ],
  "cafinmapvote": ,
  "automaticmapvote": ,
  "seedingmessage": ,
  "admincall": true,
  "admincallping": "@here",
  "debug": false,
  "nextmapinstate": true
}


After getting npm Packages replace node-rcon.js with ./node_modules/node-rcon/node-rcon.js
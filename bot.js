console.log("Start Script Time: " + new Date());
global.botstart = new Date();
//Requirements
var settingspath = "./settings/settings.json";
global.secrets = require(settingspath);
var fs = require("fs");
var csvwriter = require("csv-writer").createObjectCsvWriter;
var csvloadsync = require("csv-load-sync");
var nodeschedule = require("node-schedule");

var layerlistpath = "./settings/layernames.txt";
var recentmappath = "./settings/recentmap.csv";
var mutelistpath = "./settings/mutelist.txt";

//Global Variables & Paths
global.debug = false;
global.mapvotemode = false;
global.automaticmapvote = secrets.automaticmapvote;
global.seedingmessage = secrets.seedingmessage; //Disable SeedingMessages by default
global.cafinmapvote = secrets.cafinmapvote;
global.admincall = secrets.admincall;
global.seedingcommand = secrets.seedingcommand;
global.nextmapinstate = secrets.nextmapinstate;
global.servermodeskrimish = secrets.servermodeskrimish;
global.varcommands = [
  "debug",
  "admincall",
  "seedingmessage",
  "automaticmapvote",
  "cafinmapvote",
  "seedingcommand",
  "nextmapinstate",
  "servermodeskrimish"
];

global.CurrentGame = new Object();
global.CurrentGame.Full = ""; //Will be updated after 30 Seconds
global.CurrentGame.Map = ""; //Will be updated after 30 Seconds
global.CurrentGame.Mode = ""; //Will be updated after 30 Seconds
global.CurrentGame.Version = ""; //Will be updated after 30 Seconds
global.CurrentGame.MaxPlayerCount = 80; //Will be updated after 30 Seconds
global.CurrentGame.PlayerCount = 0; //Will be updated after 30 Seconds
global.CurrentGame.duration = new Object();
global.CurrentGame.duration.hours = 0;
global.CurrentGame.duration.minutes = 0;
global.CurrentGame.duration.seconds = 0;

global.NextMap = new Object();
global.NextMap.Full = ""; //Will be updated after 30 Seconds
global.NextMap.Map = ""; //Will be updated after 30 Seconds
global.NextMap.Mode = ""; //Will be updated after 30 Seconds
global.NextMap.Version = ""; //Will be updated after 30 Seconds

global.timezoneoffset = new Date().getTimezoneOffset() / 60;
global.seedinghourweekday =
  new Date(Date.UTC(0, 0, 0, 17, 0, 0, 0)).getUTCHours() - timezoneoffset;
global.seedinghourweekend =
  new Date(Date.UTC(0, 0, 0, 15, 0, 0, 0)).getUTCHours() - timezoneoffset;

//Discord Client
const Discordjs = require("discord.js");
const DiscordClient = new Discordjs.Client();
DiscordClient.on("ready", () => {
  console.log(
    `[discord][connection] connected Username: ${DiscordClient.user.tag} ID: ${DiscordClient.user.id} | ${DiscordClient.guilds.size} Server`
  );
  global.botuserid = DiscordClient.user.id;
  global.discordreportchannel = DiscordClient.channels.get(
    secrets.discordreportchannelid
  );
  global.discordcontrolchannel = DiscordClient.channels.get(
    secrets.discordcontrolchannelid
  );
  global.discordseedingchannel = DiscordClient.channels.get(
    secrets.discordseedingchannelid
  );
  global.discorddebugchannel = DiscordClient.channels.get(
    secrets.discorddebugchannelid
  );
  interval();
})
  .on("message", async message => {
    if (
      !message.content.startsWith(secrets.prefix) ||
      message.author == DiscordClient.user ||
      message.author.bot == true
    ) {
      return;
    }

    var messagecontentregexp = new RegExp(secrets.prefix + "(?<message>.*)");
    var commandregexp = new RegExp("(?<command>\\w*)[ ]?(?<arguments>.*)");
    var messagecontent = messagecontentregexp.exec(message.content).groups
      .message; //Returns the received Message without the Prefix
    var command = commandregexp.exec(messagecontent).groups.command; // Returns the Command
    var arguments = commandregexp.exec(messagecontent).groups.arguments;
    if (arguments != "") {
      arguments = arguments.split(" ");
    }
    //Used to change Variables defiend in global.varcommands
    var commandvalid =
      global.varcommands[containsinarray(command, global.varcommands)[0]];
    if (
      commandvalid != undefined &&
      ((message.member._roles.includes(secrets.discordserveradminroleid) &&
        message.channel.id == secrets.discordcontrolchannelid) ||
        message.channel.id == secrets.discorddebugchannelid)
    ) {
      var embed = {
        description:
          "Variable [" +
          commandvalid +
          "]: " +
          global[commandvalid] +
          "\nConfig [" +
          commandvalid +
          "]: " +
          secrets[commandvalid],
        color: 65339, //green
        timestamp: new Date().toISOString(),
        author: {
          name: secrets.servernameshort + "-Bot"
        }
      };
      if (arguments.length >= 1) {
        if (arguments[0] == "false") {
          global[commandvalid] = false;
        } else if (arguments[0] == "true") {
          global[commandvalid] = true;
        }
        embed.description =
          "Variable [" + commandvalid + "]:SET}=> " + global[commandvalid];
        if (arguments.length == 2) {
          if (arguments[1] == "p") {
            embed.description =
              "Variable [" +
              commandvalid +
              "]:SET-Persitent}=> " +
              global[commandvalid];
            secrets[commandvalid] = global[commandvalid];
            rewriteconfig();
          }
        }
      }
      message.channel.send({ embed });
      debug(embed.description);
    }
    if (
      command == "mapvote" &&
      message.member._roles.includes(secrets.discordserveradminroleid) &&
      message.channel.id == secrets.discordcontrolchannelid
    ) {
      mapvote();
    } else if (
      command == "send" &&
      message.member._roles.includes(secrets.discordserveradminroleid) &&
      (message.channel.id == secrets.discordcontrolchannelid ||
        message.channel.id == secrets.discordreportchannelid)
    ) {
      var CommandRegEx = new RegExp('send (?<name>".+") (?<message>.+)');
      var Commandmatch = messagecontent.match(CommandRegEx);
      logentry(
        "send Command to: " +
          Commandmatch.groups.name +
          " message: " +
          Commandmatch.groups.message +
          " || from " +
          message.author.username +
          "#" +
          message.author.discriminator
      );
      rconsend(
        "AdminWarn " +
          Commandmatch.groups.name +
          " " +
          Commandmatch.groups.message
      );
      message.react("✅");
    } else if (
      command == "seeding" &&
      global.seedingcommand == true &&
      searchforarrayelelementsinarray(
        secrets.seedingcommandroles,
        message.member._roles
      ) &&
      (message.channel.id == secrets.discordcontrolchannelid ||
        message.channel.id == secrets.discordseedingchannelid)
    ) {
      seedingmessage();
      global.seedingmessage = false;
      logentry(
        "Seedingmessage trigger by " +
          message.author.username +
          "#" +
          message.author.discriminator
      );
      message.react("✅");
    } else if (
      command == "credits" &&
      message.author.id == secrets.discorddeveloperuserid
    ) {
      seedingmessage();

      /*
        const embed = {
            "description": "Developer: Bjoerek\nSupporters: Sklz(RegexGod), Jeremy, Rawfoss, Delta\nDependencies:discordjs, node-nodeschedule, csv-load-sync, csvwriter, fs, node-rcon(modified), gamedig",
            "color": 65339, //green
            "timestamp": new Date().toISOString(),
            "author": {
                "name": secrets.servernameshort+"-Bot Credits"
            }
        };
        message.channel.send({ embed });
        */
    } else if (
      command == "purge" &&
      message.author.id == secrets.discorddeveloperuserid
    ) {
      message.channel
        .fetchMessages({ limit: 100 })
        .then(messages => {
          message.channel.bulkDelete(messages);
          messagesDeleted = messages.array().length;
          message.channel
            .send(
              "Deletion of messages successful. Total messages deleted: " +
                messagesDeleted
            )
            .then(message => {
              message.delete(2000);
            });
        })
        .catch(err => {
          console.log("Error while doing Bulk Delete");
          console.log(err);
        });
    } else if (
      command == "mutelist" &&
      ((message.member._roles.includes(secrets.discordserveradminroleid) &&
        (message.channel.id == secrets.discordcontrolchannelid || message.channel.id == secrets.discordreportchannelid)) ||
        message.channel.id == secrets.discorddebugchannelid)
    ) {
      const fs = require("fs");
      if (fs.existsSync(mutelistpath)) {
        if (arguments.length == 0) {
          var inmessageamount = 50;
          var inmessageindex = inmessageamount;
          var i = 0;
          var j = 0;

          var array = fs.readFileSync(mutelistpath, "utf8").split("\r\n");
          var entries = array.length - 1;
          var empty = false;
          while (empty == false) {
            var embed = {
              description: "**Mutelist-Entries**",
              color: 65339, //green
              timestamp: new Date().toISOString(),
              author: {
                name: secrets.servernameshort + "-Bot"
              },
              footer: {
                text: j + 1 + "/" + (Math.floor(entries / inmessageamount) + 1)
              }
            };
            for (var i = i; entries > i; i++) {
              if (i >= inmessageindex) {
                inmessageindex = inmessageindex + inmessageamount;
                j++;
                break;
              }
              embed.description += "\n<" + i + "> " + array[i];
            }
            message.channel.send({ embed });
            if (i >= entries) {
              empty = true;
            }
          }
        } else if (
          arguments.length == 2 &&
          arguments[0] == "delete" &&
          typeof parseFloat(arguments[1]) == "number"
        ) {
          var number = Number(arguments[1]);
          var text = fs.readFileSync(mutelistpath, "utf8");
          var test = text.split("\r\n");
          if (number <= test.length) {
            var test2 = test.splice(number, 1);
            var test3 = test.join("\r\n");
            fs.writeFile(mutelistpath, test3, function(err) {
              if (err) {
                return console.log(err);
              }

              message.react("✅");
            });
          }
        }
      }
    } else if (
      command == "state" &&
      message.author.id == secrets.discorddeveloperuserid &&
      (message.channel.id == secrets.discordcontrolchannelid ||
        message.channel.id == secrets.discorddebugchannelid)
    ) {
      const embed = {
        description:
          "[Starttime]" +
          global.botstart +
          "\n" +
          "[Discord]Username:" +
          DiscordClient.user.tag +
          " ID:" +
          DiscordClient.user.id +
          " Servercount:" +
          DiscordClient.guilds.size +
          "\n" +
          "[rcon]IP:" +
          rcon.host +
          ":" +
          rcon.port +
          "\n" +
          "[timezoneoffset]" +
          global.timezoneoffset +
          "\n" +
          "[debug]" +
          global.debug +
          "\n" +
          "[automaticmapvote]" +
          global.automaticmapvote +
          "\n" +
          "[mapvotemode]" +
          global.mapvotemode +
          "\n" +
          "[cafinmapvote]" +
          global.cafinmapvote +
          "\n" +
          "[servermodeskrimish]" +
          global.servermodeskrimish +
          "\n" +
          "[admincall]" +
          global.admincall +
          "\n" +
          "[nextmapinstate]" +
          global.nextmapinstate +
          "\n" +
          "[seedingmessage]" +
          global.seedingmessage +
          " weekday:" +
          seedinghourweekday +
          " weekend:" +
          seedinghourweekend +
          " | Seedingcommand:" +
          global.seedingcommand +
          "\n" +
          "[Serverstate]CurrentMap:" +
          global.CurrentGame.Full +
          " Playercount:" +
          global.CurrentGame.PlayerCount +
          " duration:" +
          global.CurrentGame.duration.hours +
          ":" +
          global.CurrentGame.duration.minutes +
          ":" +
          global.CurrentGame.duration.seconds +
          "\n",
        color: 8311585, //green
        timestamp: new Date().toISOString(),
        author: {
          name: secrets.servernameshort + "-Bot current State"
        }
      };
      message.channel.send({ embed });
    }
  })
  .on("raw", async event => {
    if (event.t == "MESSAGE_REACTION_ADD") {
      if (event.d.message_id == "651077472091373568") {
        channel = DiscordClient.channels.get(event.d.channel_id);
        channel.send(
          DiscordClient.emojis.get(event.d.emoji.id) +
            " |Name: " +
            event.d.emoji.name +
            " |animated: " +
            event.d.emoji.animated +
            " |EmojiID: " +
            event.d.emoji.id
        );
      }
    }

    if (event.t == "MESSAGE_REACTION_ADD") {
      var guildid = event.d.guild_id;
      var channelid = event.d.channel_id;
      var messageid = event.d.message_id;
      var userid = event.d.user_id;
      var emoji = event.d.emoji;
      if (
        channelid == secrets.discordreportchannelid &&
        !(userid == global.botuserid) &&
        global.admincall == true
      ) {
        channel = DiscordClient.channels.get(channelid);
        channel.fetchMessage(messageid).then(message => {
          var user = DiscordClient.users.get(userid);
          authorname = message.embeds[0].author.name;
          timestamp = message.embeds[0].timestamp;
          content = message.embeds[0].description;
          if (emoji.name == "✅") {
            rconsend(
              'AdminWarn "' +
                authorname +
                '" Your submission has been processed and marked as completed.'
            );
          } else if (emoji.name == "📞") {
            rconsend(
              'AdminWarn "' +
                authorname +
                '" Your submission has been reviewed, but a more detailed interaction is required. Please come to our Discord Server. \n' +
                secrets.discordinvitelink +
                "\nMessage " +
                user.username +
                "#" +
                user.discriminator +
                " for further discussion."
            );
          } else if (emoji.name == "🚫") {
            var add;
            if (!fs.existsSync(mutelistpath)) {
              fs.writeFile(mutelistpath, "", function(err) {
                if (err) throw err;
              });
              add = true;
            } else {
              var i = 0;
              add = true;
              var text = fs.readFileSync(mutelistpath, "utf8");
              var mutelist = text.split("\r\n");
              while (i < mutelist.length) {
                if (mutelist[i] == authorname) {
                  add = false;
                }
                i++;
              }
            }
            if (add == true) {
              fs.appendFile(
                "./settings/mutelist.txt",
                authorname + "\r\n",
                err => {
                  if (err) logentry(err);
                  logentry(
                    "Successfully Written " +
                      authorname +
                      " to Mutelist." +
                      " || from " +
                      message.author.username +
                      "#" +
                      message.author.discriminator
                  );
                }
              );
            }
          } else if (emoji.name == "⏳") {
            rconsend(
              'AdminWarn "' +
                authorname +
                '" Your submission is currently in review.'
            );
          } else if (emoji.name == "❌") {
            rconsend(
              'AdminWarn "' + authorname + '" Placeholder for an bad Message.'
            );
          }
        });
      }
    }
  })
  .on("error", function(err) {
    console.log("Discord Connection Error");
    console.error(err.stack);
    DiscordClient.login(secrets.discordtoken);
  });
DiscordClient.login(secrets.discordtoken);
//Functions
function randomint(min, max) {
  return Math.floor(min + Math.random() * (max + 1 - min));
}
function searchforarrayelelementsinarray(secrets, array) {
  var found = false;
  for (var t = 0; secrets.length >= t; t++) {
    if (array.includes(secrets[t]) == true) {
      found = true;
    }
  }
  return found;
}
function containsinarray(value, array) {
  var endarray = [];
  var j = 0;
  for (var i = 0; i <= array.length; i++) {
    if (array[i] == value) {
      endarray[j] = i;
      j++;
    }
  }
  return endarray;
}
function rewriteconfig() {
  let data = JSON.stringify(secrets, null, 2);
  fs.writeFileSync(settingspath, data);
  logentry("[fs][settings.json] Config File Updated");
  debug("[fs][settings.json] " + data);
}
function debug(content) {
  if (global.debug == true) {
    console.log(content);
    var discorddebugchannelid = DiscordClient.channels.get(
      secrets.discorddebugchannelid
    );
    discorddebugchannelid.send(content);
  }
}

function logentry(content) {
  console.log(content);
  var discorddebugchannelid = DiscordClient.channels.get(
    secrets.discorddebugchannelid
  );
  discorddebugchannelid.send(content);
}

function rconsend(command) {
  rcon.send(command);
  debug("[rcon][send]=>" + command);
}

function mapvote() {
  if (global.mapvotemode == false) {
    global.mapvotemode = true;
    debug("Mapvote started | Timestamp: " + Date.now());
    var loadingemoji1 = DiscordClient.emojis.get("651069268280082472");
    var loadingemoji2 = DiscordClient.emojis.get("651069304741298176");
    var loadingemoji3 = DiscordClient.emojis.get("651069305298878484");
    var loadingemoji4 = DiscordClient.emojis.get("651069309229203463");
    var loadingemoji5 = DiscordClient.emojis.get("651069322072162304");
    var loadingemoji6 = DiscordClient.emojis.get("651069332461322240");
    var loadingemoji7 = DiscordClient.emojis.get("651069344960217088");
    var loadingemoji8 = DiscordClient.emojis.get("651069356406603777");
    var discordcontrolchannelid = DiscordClient.channels.get(
      secrets.discordcontrolchannelid
    );
    const embed = {
      description:
        loadingemoji1 +
        loadingemoji2 +
        loadingemoji3 +
        loadingemoji4 +
        loadingemoji5 +
        loadingemoji6 +
        loadingemoji7 +
        loadingemoji8,
      color: 8421504,
      timestamp: new Date().toISOString(),
      footer: {
        text: "started at"
      },
      author: {
        name: "Mapvote started"
      },
      fields: [
        {
          name: "Current Map",
          value: global.CurrentGame.Full,
          inline: true
        },
        {
          name: "Current Player",
          value:
            global.CurrentGame.PlayerCount +
            "/" +
            global.CurrentGame.MaxPlayerCount,
          inline: true
        }
      ]
    };

    discordcontrolchannelid.send("", { embed }).then(message => {
      global.mapvotes = [];
      global.mapselection = [];
      //Mapselection
      //Read Layers from txt file in array[object]
      if (fs.existsSync(layerlistpath)) {
        var layerlistunformated = fs
          .readFileSync(layerlistpath)
          .toString()
          .split("\r\n");
        var modes = "AAS|RAAS|TC|Invasion";
        if (global.servermodeskrimish == true) {
          modes = "Skirmish";
        }
        var CommandRegEx = new RegExp(
          "(?<FullMap>(?<Map>.+) (?<Mode>" +
            modes +
            ") (?<Version>v[0-9]{0,2}( Night)*))"
        );
        var CommandRegExCAF = new RegExp(
          "(?<FullMap>CAF_(?<Map>.+)_(?<Mode>" +
            modes +
            ")_(?<Version>[v,V][0-9]{0,2}( Night)*))"
        );
        var layerlist = [];
        for (var i = 0; i < layerlistunformated.length; i++) {
          var formatedrow = CommandRegEx.exec(layerlistunformated[i]);
          if (formatedrow) {
            layerlist.push({
              FullMap: formatedrow.groups.FullMap,
              Map: formatedrow.groups.Map,
              Mode: formatedrow.groups.Mode,
              Version: formatedrow.groups.Version
            });
          }
          if (global.cafinmapvote == "true") {
            var formatedrowCAF = CommandRegExCAF.exec(layerlistunformated[i]);
            if (formatedrowCAF) {
              layerlist.push({
                FullMap: formatedrowCAF.groups.FullMap,
                Map: formatedrowCAF.groups.Map,
                Mode: formatedrowCAF.groups.Mode,
                Version: formatedrowCAF.groups.Version
              });
            }
          }
        }
        debug("layerlist:", layerlist);
      } else {
        return;
      }
      //Read Recentmaps from csv to array[object]
      if (fs.existsSync(recentmappath)) {
        var recentmap = csvloadsync(recentmappath);
        var recentmapreverse = recentmap.reverse();
        debug("recentmaps:", recentmapreverse);
        var rndmapcount = 4;
        var rndmapfound = false;
        var i = 1;
        while (rndmapcount > i) {
          mapselection[i] = layerlist[randomint(0, layerlist.length - 1)];
          rndmapfound = true;
          //------Checks
          if (global.servermodeskrimish != true) {
            //If the First Selection isnt AAS search for new map
            if (mapselection[1].Mode != "AAS") {
              rndmapfound = false;
            }
            //If the Second Selection isnt AAS search for new map
            if (mapselection.length >= 3) {
              if (mapselection[2].Mode != "AAS") {
                rndmapfound = false;
              }
            }
            //If the Third Selection is AAS search for new map
            if (mapselection.length >= 4) {
              if (mapselection[3].Mode == "AAS") {
                rndmapfound = false;
              }
            }
          }
          //If the same Map played in the Last 3 Rounds(and current) search for new map
          if (recentmapreverse.length >= 4) {
            if (rndmapfound) {
              for (var j = 0; j <= 3; j++) {
                if (recentmapreverse[j].CurrentMap == mapselection[i].Map) {
                  rndmapfound = false;
                }
              }
            }
          }

          //If the mode already chosen in a Selection search for new map
          //if (rndmapfound) { var containingmodes = []; for (var k = 1; k < mapselection.length; k++) { if (k != i) { containingmodes.push(mapselection[k].Mode); }; } if (containingmodes.includes(mapselection[i].Mode)) { rndmapfound = false; }; };
          //If the map already chosen in a Selection search for new map
          if (rndmapfound) {
            var containingmaps = [];
            for (var k = 1; k < mapselection.length; k++) {
              if (k != i) {
                containingmaps.push(mapselection[k].Map);
              }
            }
            if (containingmaps.includes(mapselection[i].Map)) {
              rndmapfound = false;
            }
          }
          //------Checks END
          if (rndmapfound == true) {
            i++;
          }
        }
        debug(
          "Mapvote: options: " +
            mapselection[1].FullMap +
            " | " +
            mapselection[2].FullMap +
            " | " +
            mapselection[3].FullMap
        );
      } else {
        logentry("Error could not read from:>" + recentmappath);
        return;
      }
      //---
      var mapseltext =
        'Write "1" in Chat for ' +
        mapselection[1].FullMap +
        ' | "2" for ' +
        mapselection[2].FullMap +
        ' | "3" for ' +
        mapselection[3].FullMap;
      rconsend(
        "AdminBroadcast A mapvote has been started. Use your vote within the next 2 minutes."
      );
      rconsend("AdminBroadcast " + mapseltext);
      setTimeout(function() {
        rconsend("AdminBroadcast Mapvote active for 1:15 min | " + mapseltext);
        setTimeout(function() {
          rconsend(
            "AdminBroadcast Mapvote active for 30 seconds | " + mapseltext
          );
          setTimeout(function() {
            var mapcounts = [0, 0, 0, 0];
            var i = 0;
            while (i < global.mapvotes.length) {
              if (global.mapvotes[i][1] == 1) {
                mapcounts[1] = mapcounts[1] + 1;
              } else if (global.mapvotes[i][1] == 2) {
                mapcounts[2] = mapcounts[2] + 1;
              } else if (global.mapvotes[i][1] == 3) {
                mapcounts[3] = mapcounts[3] + 1;
              }
              i = i + 1;
            }
            var nextmap;
            var nextmapindex = 1;
            if (mapcounts[1] >= mapcounts[2] && mapcounts[1] >= mapcounts[3]) {
              nextmapindex = 1;
            } else if (
              mapcounts[2] > mapcounts[1] &&
              mapcounts[2] >= mapcounts[3]
            ) {
              nextmapindex = 2;
            } else if (
              mapcounts[3] > mapcounts[1] &&
              mapcounts[3] > mapcounts[2]
            ) {
              nextmapindex = 3;
            } else {
              nextmapindex = 1;
            } //Fallback, logical not possible
            nextmap = mapselection[nextmapindex].FullMap;
            rconsend(
              "AdminBroadcast The mapvote is finished. The next map will be " +
                nextmap +
                " with [" +
                mapcounts[nextmapindex] +
                "] votes."
            );
            debug(
              "Mapvote end | Nextmap: " +
                nextmap +
                " with [" +
                mapcounts[nextmapindex] +
                "] votes" +
                " | Timestamp: " +
                Date.now()
            );
            rconsend("Adminsetnextlayer " + nextmap);
            global.mapvotemode = false;
            const embed = {
              color: 12118406,
              timestamp: new Date().toISOString(),
              footer: {
                text: "Mapvote ended at"
              },
              author: {
                name: "Mapvote ended"
              },
              fields: [
                {
                  name: "Current Map",
                  value: global.CurrentGame.Full,
                  inline: true
                },
                {
                  name: "NextMap",
                  value: nextmap,
                  inline: true
                },
                {
                  name: "Options",
                  value:
                    "[" +
                    mapcounts[1] +
                    "] " +
                    mapselection[1].FullMap +
                    "\n[" +
                    mapcounts[2] +
                    "] " +
                    mapselection[2].FullMap +
                    "\n[" +
                    mapcounts[3] +
                    "] " +
                    mapselection[3].FullMap
                }
              ]
            };

            message.edit("", { embed });
          }, 30000);
        }, 45000);
      }, 45000);
    });
  }
}
function checkBool(x) {
  if (x == "true") {
    return true;
  } else if (x == "false") {
    return false;
  }
}
function seedingmessage() {
  if (global.seedingmessage == true && global.CurrentGame.PlayerCount <= 40) {
    var discordseedingchannel = DiscordClient.channels.get(
      secrets.discordseedingchannelid
    );
    const embed = {
      color: 16777215,
      description: "\n**" + secrets.servername + "**",
      timestamp: new Date().toISOString(),
      thumbnail: {
        url: secrets.logolink
      },
      author: {
        name: secrets.servernameshort + " Seeding Reminder",
        url:
          "https://www.battlemetrics.com/servers/squad/" +
          secrets.battlemetricsid
      },
      fields: [
        {
          name: "Current Players",
          value:
            global.CurrentGame.PlayerCount +
            "/" +
            global.CurrentGame.MaxPlayerCount,
          inline: true
        },
        {
          name: "Current Map",
          value: global.CurrentGame.Full,
          inline: true
        },
        {
          name: "Direct join",
          value:
            "steam://connect/" + secrets.serverip + ":" + secrets.steamqueryport
        }
      ]
    };
    discordseedingchannel.send(secrets.pingforseed, { embed }).then(message => {
      var seedingmessagerenew = setInterval(function() {
        const embed = {
          color: 16777215,
          description: "\n**" + secrets.servername + "**",
          timestamp: new Date().toISOString(),
          footer: {
            text: "edited at ->"
          },
          thumbnail: {
            url: secrets.logolink
          },
          author: {
            name: secrets.servernameshort + " Seeding Reminder",
            url:
              "https://www.battlemetrics.com/servers/squad/" +
              secrets.battlemetricsid
          },
          fields: [
            {
              name: "Current Players",
              value:
                global.CurrentGame.PlayerCount +
                "/" +
                global.CurrentGame.MaxPlayerCount,
              inline: true
            },
            {
              name: "Current Map",
              value:
                global.CurrentGame.Map +
                " " +
                global.CurrentGame.Mode +
                " " +
                global.CurrentGame.Version,
              inline: true
            },
            {
              name: "Direct join",
              value:
                "steam://connect/" +
                secrets.serverip +
                ":" +
                secrets.steamqueryport
            }
          ]
        };
        message.edit(secrets.pingforseed, { embed });
      }, 30000);
      setTimeout(function() {
        clearInterval(seedingmessagerenew);
        var discordseedingchannel = DiscordClient.channels.get(
          secrets.discordseedingchannelid
        );
        discordseedingchannel
          .fetchMessages()
          .then(messages => {
            //Delete pinned Messages from gettingdeleted list
            for (let entry of messages) {
              if (entry[1].pinned == true) {
                messages.delete(entry[0]);
              }
            }
            discordseedingchannel.bulkDelete(messages);
          })
          .catch(err => {
            logentry("Error while doing Bulk Delete");
            logentry(err);
          });
      }, 60000); //7200000 == 2 Hours
    });
  }
}
//RCON Client
var options = {
  tcp: true,
  challenge: false,
  id: "0"
};
const Rcon = require("rcon-bjoerek/node-rcon.js");
var rcon = new Rcon(
  secrets.serverip,
  secrets.rconport,
  secrets.rconpassword,
  options
);
rcon
  .on("auth", function() {
    console.log(
      "[rcon][connection] connected to " + rcon.host + ":" + rcon.port
    );
  })
  .on("response", function(str) {
    debug("[rcon][receive]=> " + str);
    //Answer of the GetNextMap Command sended via the Interval
    var CurrentMapanswerRegexp = new RegExp(
      "Current map is (?<FullCurrentMap>(?<CurrentDLC>([CAF]*?)[_]?)(?<CurrentMap>.+)[_, ](?<CurrentMode>AAS|RAAS|TC|Destruction|Invasion|Skirmish|Tanks)[_, ](?<CurrentVersion>[v,V]\\d( Night)*)), Next map is (?<FullNextMap>(?<NextDLC>([CAF]*?)[_]?)(?<Nextmap>.*)[_, ](?<NextMode>AAS|RAAS|TC|Destruction|Invasion|Skirmish|Tanks)[_, ](?<NextVersion>[v,V]\\d( Night)*))*"
    );
    var CurrentMapMatch = CurrentMapanswerRegexp.exec(str);
    if (CurrentMapMatch) {
      global.CurrentGame.Full = CurrentMapMatch.groups.FullCurrentMap;
      global.CurrentGame.Map = CurrentMapMatch.groups.CurrentMap;
      global.CurrentGame.Mode = CurrentMapMatch.groups.CurrentMode;
      global.CurrentGame.Version = CurrentMapMatch.groups.CurrentVersion;
      global.NextMap.Full = CurrentMapMatch.groups.FullNextMap; //Will be updated after 30 Seconds
      global.NextMap.Map = CurrentMapMatch.groups.Nextmap; //Will be updated after 30 Seconds
      global.NextMap.Mode = CurrentMapMatch.groups.NextMode; //Will be updated after 30 Seconds
      global.NextMap.Version = CurrentMapMatch.groups.NextVersion; //Will be updated after 30 Seconds
      var appendbol = false;
      if (fs.existsSync(recentmappath)) {
        var csv = csvloadsync(recentmappath);
        appendbol = true;
      }
      var cm;
      if (!fs.existsSync(recentmappath)) {
        cm = true;
      } else {
        cm = !(
          csv[csv.length - 1].FullCurrentMap ==
          CurrentMapMatch.groups.FullCurrentMap
        );
      }
      if (cm == true) {
        if (
          (CurrentMapMatch.groups.CurrentMode != "Skirmish" ||
            global.servermodeskrimish == true) &&
          global.CurrentGame.PlayerCount >= 20
        ) {
          const csvWriter = csvwriter({
            path: recentmappath,
            append: appendbol,
            header: [
              { id: "FullCurrentMap", title: "FullCurrentMap" },
              { id: "CurrentMap", title: "CurrentMap" },
              { id: "CurrentMode", title: "CurrentMode" },
              { id: "CurrentVersion", title: "CurrentVersion" },
              { id: "FullNextMap", title: "FullNextMap" },
              { id: "Nextmap", title: "Nextmap" },
              { id: "NextMode", title: "NextMode" },
              { id: "NextVersion", title: "NextVersion" },
              { id: "Timestamp", title: "Timestamp" }
            ]
          });
          const data = [
            {
              FullCurrentMap: CurrentMapMatch.groups.FullCurrentMap,
              CurrentMap: CurrentMapMatch.groups.CurrentMap,
              CurrentMode: CurrentMapMatch.groups.CurrentMode,
              CurrentVersion: CurrentMapMatch.groups.CurrentVersion,
              FullNextMap: CurrentMapMatch.groups.FullNextMap,
              Nextmap: CurrentMapMatch.groups.Nextmap,
              NextMode: CurrentMapMatch.groups.NextMode,
              NextVersion: CurrentMapMatch.groups.NextVersion,
              Timestamp: Date.now()
            }
          ];
          csvWriter
            .writeRecords(data)
            .then(() =>
              debug(
                "[currentmaptofile] Added the current Map Data to recentmap.csv <" +
                  global.CurrentGame.Full +
                  ">"
              )
            );
        } else {
          debug(
            "[currentmaptofile] Recentmaplist Entry Skipped because of Mode is <Skrimish> or less then 20 Players"
          );
        }
      } else {
        debug(
          "[currentmaptofile] Recentmaplist Entry Skipped because of Map already in List"
        );
      }
    }
  })
  .on("chat", function(str) {
    //Chat Formatter --- Still breaks on " : " in Username or Clantag
    debug("[rcon][chat]=>" + str);
    var ChatRegEx = /\[(?<Chattype>[A-z]+?)] \[SteamID:(?<SteamID>\d+?)] (?<Name>.+?) : (?<Message>.*)/;
    var Chatmatch = ChatRegEx.exec(str);
    var chattype = Chatmatch.groups.Chattype; //Type of Chat
    var steamid = Chatmatch.groups.SteamID; //Sender SteamID
    var name = Chatmatch.groups.Name; //Sender Steamname (could include Clantag)
    var message = Chatmatch.groups.Message; //Chatmessage
    debug("[rcon][chat][Formatter]Chatmatch : " + Chatmatch);
    debug("[rcon][chat][Formatter]chattype : " + chattype);
    debug("[rcon][chat][Formatter]steamid : " + steamid);
    debug("[rcon][chat][Formatter]name : " + name);
    debug("[rcon][chat][Formatter]message : " + message);
    if (
      global.mapvotemode == true &&
      (message == "1" || message == "2" || message == "3")
    ) {
      var alreadyvoted = false;
      var i = 0;
      for (i = 0; i < global.mapvotes.length; i++) {
        if (global.mapvotes[i][0] == steamid) {
          alreadyvoted = true;
          break;
        }
      }
      if (alreadyvoted) {
        rconsend(
          'AdminWarn "' +
            name +
            '" Your already voted for Map ' +
            global.mapselection[global.mapvotes[i][1]].FullMap +
            "[" +
            global.mapvotes[i][1] +
            "]" +
            " your vote will be changed to " +
            global.mapselection[message].FullMap +
            "[" +
            message +
            "]"
        );
        global.mapvotes[i] = [steamid, message];
      } else {
        global.mapvotes.push([steamid, message]);
        rconsend(
          'AdminWarn "' +
            name +
            '" Your vote for ' +
            global.mapselection[message].FullMap +
            "[" +
            message +
            "] has been accepted. Thank you for your participation."
        );
      }
    }
    if (message.charAt(0) == secrets.prefix) {
      var CommandRegEx = new RegExp(
        secrets.prefix +
          "(?<command>admin|report|mapvote) ?(?<ReportMessage>.*)",
        "i"
      );
      var Commandmatch = CommandRegEx.exec(message);
      debug("[rcon][chat][Formatter]message:" + message);
      debug("[rcon][chat][Formatter]Commandmatch:" + Commandmatch);
      debug("[rcon][chat][Formatter]CommandRegEx:" + CommandRegEx);
      if (Commandmatch != null) {
        var command = Commandmatch.groups.command.toLowerCase();
        var ReportMessage = Commandmatch.groups.ReportMessage;
        debug("[rcon][chat][Formatter]Command : " + command);
        debug("[rcon][chat][Formatter]ReportMessage : " + ReportMessage);
        if ((command == "admin" || command == "report") && global.admincall == true) {
          //Create Embedded Discord Message
          const embed = {
            description: ReportMessage,
            color: 2124210, //Blue
            timestamp: new Date().toISOString(),
            author: {
              name: name,
              url:
                "https://www.battlemetrics.com/players?filter%5Bsearch%5D=" +
                steamid +
                "&filter%5Bservers%5D=" +
                secrets.battlemetricsid +
                "&sort=score",
              icon_url:
                "https://cdn.iconscout.com/icon/free/png-512/messaging-15-461719.png"
            }
          };
          var reportchannel = DiscordClient.channels.get(
            secrets.discordreportchannelid
          );
          var here = secrets.admincallping;
          var i = 0;
          var mute = false;
          if (fs.existsSync(mutelistpath)) {
            var text = fs.readFileSync(mutelistpath, "utf8");
            var mutelist = text.split("\r\n");
            while (i < mutelist.length) {
              if (mutelist[i] == name) {
                here = "muted User";
                mute = true;
              }
              i++;
            }
          }
          reportchannel.send(here, { embed }).then(function(message) {
            message
              .react("📞")
              .then(message.react("✅"))
              .then(message.react("⏳"))
              .then(message.react("❌"))
              .then(() => {
                if (mute == false) {
                  message.react("🚫");
                  rconsend(
                    'AdminWarn "' +
                      name +
                      '" Your Report has been submitted. An admin will take care of it as soon as possible.'
                  );
                } else {
                  rconsend(
                    'AdminWarn "' + name + '" Your Report has been submitted.'
                  );
                }
              });
          });
        } else if (command == "mapvote" && chattype == "ChatAdmin") {
          debug("Mapvote started from Ingame");
          mapvote();
        }
      }
    }
  })
  .on("end", function() {
    console.log("RCON Connection Closed");
    rcon.connect();
  })
  .on("error", function(err) {
    console.log("RCON Connection Error");
    console.error(err.stack);
    rcon.connect();
  });
rcon.connect();
//All 30 Seconds
function interval() {
  rconsend("ShowNextMap");
  //Steamquery
  var Steamquery = require("gamedig");
  Steamquery.query({
    type: "squad",
    host: secrets.serverip,
    port: secrets.steamqueryport,
    maxAttempts: 3,
    socketTimeout: 5000,
    attemptTimeout: 10000,
    debug: false
  })
    .then(Serverquery => {
      global.CurrentGame.PlayerCount = Serverquery.raw.rules.PlayerCount_i;
      global.CurrentGame.MaxPlayerCount =
        Serverquery.maxplayers - Serverquery.raw.rules.PlayerReserveCount_i;
      var timetext = "";
      var maptext = "";
      var playertext = "";
      if (Serverquery.raw.rules.PlayerCount_i == 0) {
        playertext = "Server is Empty 💤";
        var nextmap = "";
      } else {
        if (global.CurrentGame.Full != "" && global.nextmapinstate == true) {
          nextmap = " |NM: " + global.CurrentGame.Full;
        } else {
          nextmap = "";
        }
        maptext = Serverquery.map;
        if (fs.existsSync(recentmappath)) {
          var csv = csvloadsync(recentmappath);
          appendbol = true;
          var matchstart = new Date(parseInt(csv[csv.length - 1].Timestamp));
          var currenttime = new Date();
          var difference = new Date(currenttime - matchstart);
          var hours = difference.getUTCHours();
          var minutes = difference.getMinutes();
          var seconds = difference.getUTCSeconds();
          global.CurrentGame.duration.hours = hours;
          global.CurrentGame.duration.minutes = minutes;
          global.CurrentGame.duration.seconds = seconds;
          if (seconds != "NaN" && minutes != "NaN" && hours != "NaN") {
            if (hours >= 2 || global.CurrentGame.PlayerCount == 0) {
              timetext = "";
            } else {
              timetext = " @ ";
              if (!(hours == 0)) {
                timetext = timetext + hours + ":";
              }
              timetext = timetext + minutes + ":" + seconds;
              if (hours == 0 && minutes == 20 && seconds > 10 && seconds < 50) {
                if (global.automaticmapvote == true) {
                  debug("[mapvote] automatic Mapvote started");
                  mapvote();
                }
              }
            }
          }
        }
        playertext =
          "(" +
          global.CurrentGame.PlayerCount +
          "/" +
          global.CurrentGame.MaxPlayerCount +
          ") ";
      }
      var activity = playertext + maptext + timetext + nextmap;

      DiscordClient.user.setActivity(activity);
    })
    .catch(error => {
      logentry("[steamquerry][Error]");
      logentry(error);
    });
}

$ongoingupdates = setInterval(function() {
  interval();
}, 30000);

var weekday = nodeschedule.scheduleJob(
  "0 " + seedinghourweekday + " * * 1-5",
  function() {
    seedingmessage();
  }
);
var weekend = nodeschedule.scheduleJob(
  "0 " + seedinghourweekend + " * * 6,0",
  function() {
    seedingmessage();
  }
);

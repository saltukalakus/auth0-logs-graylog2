require('dotenv-safe').load({
  allowEmptyValues: true
});
const path      = require('path');
const request   = require("request");
const cache     = require('memory-cache');
const winston   = require('winston');
const fs        = require('fs');
const sleep     = require('sleep');

// TODO: These could also be .env variables
const logDir       = 'logs';
const logFile      = 'auth0.log';
const TenHours     = 10*60*60; //In sec, max token refresh period

// Some variables which are just an implementation detail

// TODO: lastLogIdFile stores the last log position sent to server
// So that when server restarts it starts from the last log sent. 
// Instead of storing this in a file send this value to a database like
// MongoDB
const lastLogIdFile      = '.lastLogId'; 

var logCount = 0;
var fileLogDebugLevel  = 'info';
var filterClientArray  = String(process.env.FILTER_CLIENTS_WITH_ID).split(",").map(function(item) {
  return item.trim();
});

// This basically disables the log to FILELOG
if (String(process.env.FILELOG_ENABLE).toLowerCase() == `false`) {
  fileLogDebugLevel  = 'error';
} 

// Create the log directory if it does not exist
if (!fs.existsSync(logDir) && fileLogDebugLevel == `info`) {
  fs.mkdirSync(logDir);
}

const logger = new (winston.Logger)({
  transports: [
    // Log to file winston settings
    new (winston.transports.File)({
      filename: `${logDir}/${logFile}`,
      timestamp: false,
      prettyPrint: true,
      level: fileLogDebugLevel
    })
  ]
});

var options = { method: 'POST',
  url: 'https://' + process.env.AUTH0_DOMAIN + '/oauth/token',
  headers: { 'content-type': 'application/json' },
  body: 
  { grant_type: 'client_credentials',
    client_id: process.env.AUTH0_CLIENT_ID,
    client_secret: process.env.AUTH0_CLIENT_SECRET,
    audience: 'https://' + process.env.AUTH0_DOMAIN + '/api/v2/' },
  json: true };

function getManagementToken(cb) {
  var cached = cache.get(process.env.AUTH0_CLIENT_ID);
  if (cached) {
    cb(null, cached);
  } else {
    console.log("Getting a new API v2 token for Logger");
    request(options, function (error, response, body) {
      if (error) {
        return cb(error);
      }
      if (body.error){
        return cb(body);
      }
      var cacheTimeout = parseInt(body.expires_in) > TenHours ? TenHours : parseInt(body.expires_in);
      cache.put(process.env.AUTH0_CLIENT_ID, body, cacheTimeout*1000);
      cb(null, body);
    });
  }
}

function getLogs(domain, token, take, from, cb) {
  var url = `https://` + process.env.AUTH0_DOMAIN + `/api/v2/logs`;

  request({
    method: 'GET',
    url: url,
    json: true,
    qs: {
      take: take,
      from: from,
      sort: 'date:1',
      per_page: take
    },
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  }, (err, res, body) => {
    if (err) {
      console.log('Error getting logs', err);
      cb(null, err);
    } else {
      cb(body);
    }
  });
}


function saveLogs(logs){
  // Put the last log entry we will continue to log
  cache.put("AUTH0CheckpointID", logs[logs.length - 1]._id);

  for (log in logs) {
    var logThisClient = false;
    for (item in filterClientArray) {
      if (JSON.stringify(logs[log]).indexOf(filterClientArray[item]) !== -1 ) logThisClient = true;
    }
    if (logThisClient) {
      var logToSend =  JSON.stringify(logs[log]).replace(/\\/g, '\\\\').replace(/\"/g,'\\"');
      var logMeta = String(process.env.GRAYLOG2_META).replace(/\\/g, '\\\\').replace(/\"/g,'\\"');
      var sendString = '{"short_message":"' + logToSend + '", "meta":"' + logMeta + '"}';
      var body = {url:'http://' + process.env.GRAYLOG2_HOST + ':' + process.env.GRAYLOG2_PORT+ '/gelf',
                 form : sendString};

      // Prevent too much TCP connections
      sleep.msleep(150);
      
      logger.info(logs[log]);
      fs.writeFileSync('./'+lastLogIdFile, JSON.stringify(logs[log]));
      request.post(body,
        function(err, resp, body) {
          if (err) console.log("ERR 1: " + err);
          if (body && body.error) console.log("ERR 2: " + body.error);
          logCount += 1;
        }
      );
    }
  }
}

function isTheLatestLogVeryNew(log){
  var logTime = new Date(log)
  var cTime = new Date();
  var res = (cTime > logTime)?(((cTime - logTime) < process.env.TRACK_THE_LATEST_IN_SEC * 1000)?true:false):true;
  return res;
}

function transferLogs (accessToken) {
  // Get the last log received from cache
  var checkpointId = cache.get("AUTH0CheckpointID");

  if (!checkpointId) {		
    if (fs.existsSync('./'+lastLogIdFile)) {		
      console.log("GET CHECKPOINT FROM FILE.........");		
      var buf = fs.readFileSync('./'+lastLogIdFile, "utf8");		
      var re = /(\"_id\":\"(.*?)\")/g;		
      var matches = buf.match(re);

     // Get the log _id and set as last log position		
     var re2 = /[0-9]+/g;		
     checkpointId = matches[matches.length-1].match(re2)[0];		
   }		
  }		

  // If last log's _id is not available in the cache and log file is not created yet
  // use the env variable for log _id otherwise first log id is null which forces the 
  // logging from the beginning of the logs currently available in Auth0
  var startFromId = process.env.START_FROM_ID ? process.env.START_FROM_ID : null;
  var startCheckpointId = checkpointId === null ? startFromId : checkpointId;
  console.log("Log position : " + startCheckpointId);
  console.log("Total Log Count : " + logCount);
  var take = parseInt(process.env.BATCH_SIZE);
  take = take ? take : 100;

  getLogs(process.env.AUTH0_DOMAIN, accessToken, take, startCheckpointId, (logs, err) => {
    if (err) {
      console.log('Error getting logs from Auth0', err);
    }

    if (logs && logs.length) {
      if (isTheLatestLogVeryNew(logs[logs.length - 1].date)) {
        console.log("We are on the edge of Log queue. Forcing into a long sleep.")
        console.log("Log time : " + new Date(logs[logs.length - 1].date))
        console.log("Current time : " + new Date());
        sleep.sleep(parseInt(process.env.TRACK_THE_LATEST_IN_SEC));
      } else {
        saveLogs(logs);
      }
    }
    cache.put("GetNextBatchCompleted", true);
  });
}

cache.put("GetNextBatchCompleted", true);

setInterval(function() {
  if (cache.get("GetNextBatchCompleted")) {
    cache.put("GetNextBatchCompleted", false);
    getManagementToken(function(err, resp) {
      if (err) {
        cache.put("GetNextBatchCompleted", true);
        return console.log(err); 
      }
      console.log("Run in loop");
      transferLogs(resp.access_token);
    })  
  }
}, process.env.POLLING_INTERVAL_IN_SEC * 1000); // in milisec

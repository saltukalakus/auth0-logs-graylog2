require('dotenv-safe').load();
const path = require('path');
const request = require("request");
const cache = require('memory-cache');
const winston   = require('winston');
const fs        = require('fs');
const sleep     = require('sleep');

// TODO: These could also be .env variables
const logDir       = 'logs';
const logFile      = 'auth0.log';
const TenHours     = 10*60*60; //In sec, max token refresh period

// Store last log id for recover in restarts.
// This is an implementation detail and 
// no need to be .env var
const lastLogIdFile    = '.lastLogIdFile'; 

// Create the log directory if it does not exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logger = new (winston.Logger)({
  transports: [
    new (winston.transports.File)({
      filename: `${logDir}/${logFile}`,
      timestamp: false,
      prettyPrint: true,
      level: 'info'
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
        console.log(error);
        throw new Error(error);
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

function arraysEqual(arr1, arr2) {
    if(arr1.length !== arr2.length) {
      console.log("2. pass number of logs not equal");
      return false;
    }
        
    for(var i = arr1.length; i--;) {
        if(String(arr1[i]) !== String(arr2[i]))
        {
          console.log("Not matched in " + i);
          console.dir(arr1[i]);
          console.dir(arr2[i]);
          return false;
        }          
    }

    return true;
}

function saveLogs(logs){
  var numberOfLogs = cache.get("AUTH0NumberOfLogs");
  if (!numberOfLogs) numberOfLogs = 0;
  
  // Discard last 10 
  if (logs.length > 10) {
    logs = logs.slice(0, logs.length - 10);
  } else {
    console.log('No enough logs to write!');
    return;
  }
  numberOfLogs += logs.length;
  cache.put("AUTH0NumberOfLogs", numberOfLogs);
          
  console.log("New logs: " + logs.length);
  console.log("Total logs: " + numberOfLogs);

  // Put the newest log entry we will log to transport
  cache.put("AUTH0CheckpointID", logs[logs.length - 1]._id);

  // write to transport
  for (log in logs) {
    logger.info(logs[log]);
  }
  console.log('Write complete.');
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

  // If cache doesn't have the last log id, check to see if log file
  // exists and get the last log's _id from the log file.
  if (!checkpointId) {
    if (fs.existsSync(logDir + '/' + logFile)) {
        console.log("GET CHECKPOINT FROM FILE.........");
        var buf = fs.readFileSync(logDir + '/' + logFile, "utf8");
        var re = /(\"_id\":\"(.*?)\")/g;
        var matches = buf.match(re);
        
        // matches.length is the current number of logs in the file
        cache.put("AUTH0NumberOfLogs", matches.length);
        
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
        return console.log(err); 
      }
      console.log("Run in loop");
      transferLogs(resp.access_token);
    })  
  }
}, process.env.POLLING_INTERVAL_IN_SEC * 1000); // in milisec

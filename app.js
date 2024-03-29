var express = require('express');
var app = express();
var http = require('http').Server(app);
// var https = require('https');

const { constants } = require('crypto');
var bodyParser = require('body-parser');
var cron = require('cron').CronJob;
const helmet = require('helmet');
const favicon = require('serve-favicon');
var path = require('path');
var session = require('express-session');
var cookieParser = require('cookie-parser');
// const proxy = require('http-proxy-middleware');
const fs = require('fs');
var log4js = require('log4js');
var logger = log4js.getLogger();
logger.level = 'debug';


//settings
const login = require('./settings/login.js');
const options = require('./settings/options.js');
const messengerInfo = require('./settings/messengerInfo.js');

var sockets = {};

process.argv.forEach((val, index, array)=> {
	if(array[2]=='debug'){
		options.debugMode = true;
		logger.debug("debug enabled");
	}
});

if(options.localDebug){
	options.debugMode = true;
	options.enableHue = false;
}

var io = require('socket.io')(http);
var messenger = require('./services/messenger.js')(logger, options.debugMode);

setTimeout(()=>{
	messenger.send(true, messengerInfo.alertNumbers, 'The garage software has rebooted.  Garage open alerts disabled until you leave home!', false, false);
},10*1000);


const hue = require('./services/hue.js')(logger,messenger);
const video = require('./services/video.js')(app, logger, io, hue, sockets);
var garageTracking = require("./garageTracking.json");

const garageTimeRules = require('./services/garageTimeRules.js')(options,garageTracking.garageTimesToOpenLog,garageTracking.garageTimesToOpen,logger);

const homeAway = require('./services/homeAway.js')(logger, login, messenger, messengerInfo, io, options)
var iot = require('./services/iot.js')(app, options.debugMode, io, logger, video, messenger, hue, cron, homeAway,garageTimeRules,garageTracking);
const authService = require('./services/auth.js')(logger, login, messengerInfo, options, messenger);

app.use(helmet());
app.use(cookieParser());

app.use('/', express.static(path.join(__dirname, 'public')));
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

//settings
var port = 2323;

process.on('uncaughtException', (e) => {
	logger.error('Exception thrown', e);
});

process.on('unhandledRejection', (reason, p) => {
	logger.error('Unhandled rejection for Promise:', p, 'With a reason of:', reason);
});


http.listen(port, function() {
	logger.info('listening on *:', port);
});
logger.error('new error log started');

app.use(
	session({
		secret: login.secret,
		resave: false,
		saveUninitialized: true,
		cookie: { secure: true, httpOnly: true, sameSite: true }
	})
);

if (options.debugMode) {
	logger.level = 'debug';
	logger.debug('___________________________________');
	logger.debug('In debug mode not sending texts or opening garage!!!');
	logger.debug('___________________________________');
}

require('./controllers/routes.js')(app, logger, io, video, authService, homeAway, bodyParser, iot, sockets, garageTimeRules,messenger);
require('./controllers/gpsAuthRoutes.js')(app, logger, messenger, homeAway, bodyParser, iot);
require('./controllers/websiteAuthRoutes.js')(app, logger, io, hue, messenger, video, authService, homeAway, bodyParser, iot,garageTimeRules);
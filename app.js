// @ts-ignore
var express = require('express');
var app = express();
// @ts-ignore
var http = require('http').Server(app);
var https = require('https');

const { constants } = require('crypto');
var bodyParser = require('body-parser');
var cron = require('cron').CronJob;
const helmet = require('helmet');
const favicon = require('serve-favicon');
var path = require('path');
var session = require('express-session');
var cookieParser = require('cookie-parser');
const proxy = require('http-proxy-middleware');
const fs = require('fs');
var log4js = require('log4js');
var logger = log4js.getLogger();

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

var httpsServer = https.createServer(
	{
		secureOptions: constants.SSL_OP_NO_TLSv1 | constants.SSL_OP_NO_TLSv1_1,
		key: fs.readFileSync(login.sslPath + 'privkey.pem'),
		cert: fs.readFileSync(login.sslPath + 'fullchain.pem')
	},
	app
);
var io = require('socket.io')(httpsServer);

const hue = require('./services/hue.js')(logger);


const video = require('./services/video.js')(app, logger, io, hue, sockets);
var messenger = require('./services/messenger.js')(logger, options.debugMode);


const homeAway = require('./services/homeAway.js')(logger, login, messenger,messengerInfo, io)
var iot = require('./services/iot.js')(app, options.debugMode, io, logger, video, messenger, hue, cron, homeAway);


const authService = require('./services/auth.js')(logger, login, messengerInfo, options, messenger);

app.use(helmet());
app.use(cookieParser());

app.use(function(req, res, next) {
	if (!req.secure) {
		return res.redirect([ 'https://', req.get('Host'), req.url ].join(''));
	}
	next();
});

var hueEnergyUsageHealthOptions = {
	target: 'http://localhost:1234/health',
	changeOrigin: false,
	pathRewrite: {
		'^/proxy/hue-energy-usage/health': ''
	}
};

var nestEnergyUsageIftttOptions = {
	target: 'http://localhost:1235/ifttt',
	changeOrigin: false,
	pathRewrite: {
		'^/proxy/nest-energy-usage/ifttt': ''
	}
};



app.use('/', express.static(path.join(__dirname, 'public')));
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

//settings
var port = 80;
logger.level = 'debug';

process.on('uncaughtException', (e) => {
	logger.error('Exception thrown', e);
});

process.on('unhandledRejection', (reason, p) => {
	logger.error('Unhandled rejection for Promise:', p, 'With a reason of:', reason);
});

httpsServer.listen(443, function() {
	logger.info('listening on *:', 443);
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

if (options.enableNestEnergyUsageReport) {
	app.use('/proxy/nest-energy-usage/ifttt', proxy(nestEnergyUsageIftttOptions));
}

if (options.enableHueEnergyUsageReport) {
	app.use('/proxy/hue-energy-usage/health', proxy(hueEnergyUsageHealthOptions));
}

require('./controllers/routes.js')(app, logger, io, video, authService, homeAway, bodyParser, iot, sockets);
require('./controllers/gpsAuthRoutes.js')(app, logger, messenger, homeAway, bodyParser, iot);
require('./controllers/websiteAuthRoutes.js')(app, logger, io, hue, messenger, video, authService, homeAway, proxy, bodyParser, iot);



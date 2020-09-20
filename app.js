// @ts-ignore
var express = require('express');
var app = express();
// @ts-ignore
var http = require('http').Server(app);
var https = require('https');
const { constants } = require('crypto');

const login = require('./settings/login.js');

const options = require('./settings/options.js');
const helmet = require('helmet');
const favicon = require('serve-favicon');

const hue = require('./services/hue.js')(logger);
var messenger = require('./services/messenger.js')(logger, options.debugMode);
var sockets = {};
const video = require('./services/video.js')(app, logger, io, hue, sockets);
var iot = require('./services/iot.js')(app, options.debugMode, io, logger, video, messenger, hue, cron);

// @ts-ignore
var log4js = require('log4js');
var logger = log4js.getLogger();

const messengerInfo = require('./settings/messengerInfo.js');

const authService = require('./services/auth.js')(logger, login, messengerInfo, options, messenger);

// @ts-ignore
const proxy = require('http-proxy-middleware');
const fs = require('fs');

var path = require('path');
// @ts-ignore
var bodyParser = require('body-parser');
// @ts-ignore
var session = require('express-session');
// @ts-ignore
var cookieParser = require('cookie-parser');
// @ts-ignore

var cron = require('cron').CronJob;

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

var httpsServer = https.createServer(
	{
		secureOptions: constants.SSL_OP_NO_TLSv1 | constants.SSL_OP_NO_TLSv1_1,
		key: fs.readFileSync(login.sslPath + 'privkey.pem'),
		cert: fs.readFileSync(login.sslPath + 'fullchain.pem')
	},
	app
);
var io = require('socket.io')(httpsServer);

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


const homeAway = require('./services/homeAway.js')(logger, login, messenger,messengerInfo, iot, io)


if (options.enableNestEnergyUsageReport) {
	app.use('/proxy/nest-energy-usage/ifttt', proxy(nestEnergyUsageIftttOptions));
}

if (options.enableHueEnergyUsageReport) {
	app.use('/proxy/hue-energy-usage/health', proxy(hueEnergyUsageHealthOptions));
}

require('./controllers/routes.js')(app, logger, io, options.debugMode, cron, authService, homeAway);
require('./controllers/gpsAuthRoutes.js')(app, logger, options.debugMode, messenger, homeAway);
require('./controllers/websiteAuthRoutes.js')(app, logger, io, hue, messenger, iot, video, authService, homeAway, proxy);



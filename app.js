// @ts-ignore
var express = require('express');
var app = express();
// @ts-ignore
var http = require('http').Server(app);
var https = require('https');
const login = require('./settings/login.js');
const options = require('./settings/options.js');
const messengerInfo = require('./settings/messengerInfo.js');
// @ts-ignore
const proxy = require('http-proxy-middleware');
const fs = require('fs');

const sslSettings = {
    key: fs.readFileSync(login.sslPath + 'privkey.pem'),
    cert: fs.readFileSync(login.sslPath + 'fullchain.pem')
};

var path = require('path');
// @ts-ignore
var bodyParser = require('body-parser');
// @ts-ignore
var session = require('express-session');
// @ts-ignore
var cookieParser = require('cookie-parser');
// @ts-ignore
var basicAuth = require('basic-auth-connect');

app.use(cookieParser());

app.use(function (req, res, next) {
    if (!req.secure) {
        return res.redirect(['https://', req.get('Host'), req.url].join(''));
    }
    next();
});

var proxyOptions = {
    target: 'http://192.168.0.120/image/jpeg.cgi', // target host
    changeOrigin: false, // needed for virtual hosted sites
    pathRewrite: {
        '^/proxy/stream': ''
    }
};

//if using https://github.com/Connor-Knabe/hue-energy-usage
var hueEnergyUsageOptions = {
    target: 'http://localhost:1234',
    changeOrigin: false,
    pathRewrite: {
        '^/proxy/hue-energy-usage': ''
    }
};

var hueEnergyUsageHealthOptions = {
    target: 'http://localhost:1234/health',
    changeOrigin: false,
    pathRewrite: {
        '^/proxy/hue-energy-usage/health': ''
    }
};


var nestEnergyUsageOptions = {
    target: 'http://localhost:1235',
    changeOrigin: false,
    pathRewrite: {
        '^/proxy/nest-energy-usage': ''
    }
};

var nestEnergyUsageIftttOptions = {
    target: 'http://localhost:1235/ifttt',
    changeOrigin: false,
    pathRewrite: {
        '^/proxy/nest-energy-usage/ifttt': ''
    }
};

function authChecker(req, res, next) {
    var redirectToUrl = req.originalUrl ? req.originalUrl : '/';
    req.session.redirectTo = redirectToUrl;
    if (req && req.cookies && req.cookies.holkaCookie === login.secretAdminCookie) {
        next();
    } else {
        res.status(401);
        res.redirect('/');
    }
}

var httpsServer = https.createServer(sslSettings, app);

var io = require('socket.io')(httpsServer);
// @ts-ignore
var log4js = require('log4js');
var logger = log4js.getLogger();

app.use('/', express.static(path.join(__dirname, 'public')));
app.use(
    bodyParser.urlencoded({
        extended: true
    })
);

httpsServer.listen(443, function () {
    logger.info('listening on *:', 443);
});

//settings
var port = 80;
logger.level = 'info';
http.listen(port, function () {
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
    logger.debug('In debug mode not sending texts!!!');
    logger.debug('___________________________________');
}

app.use(
    '/pictures',
    basicAuth(messengerInfo.twilioPictureUser, messengerInfo.twilioPicturePass)
);

var routes = require('./controllers/routes.js')(app, logger, io, options.debugMode);

var iot = require('./services/iot.js')(app, options.debugMode, io, logger);


if (options.enableNestEnergyUsageReport) {
	app.use('/proxy/nest-energy-usage/ifttt', proxy(nestEnergyUsageIftttOptions));
}


if (options.enableHueEnergyUsageReport) {
	app.use('/proxy/hue-energy-usage/health', proxy(hueEnergyUsageHealthOptions));
}

app.use(authChecker);

if (options.enableWebcamStream) {
    app.use('/proxy/stream', proxy(proxyOptions));
}
if (options.enableHueEnergyUsageReport) {
    app.use('/proxy/hue-energy-usage', proxy(hueEnergyUsageOptions));
}
if (options.enableNestEnergyUsageReport) {
	app.use('/proxy/nest-energy-usage', proxy(nestEnergyUsageOptions));
}

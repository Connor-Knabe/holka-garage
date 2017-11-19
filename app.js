var express = require('express');
var app = express();
var http = require('http').Server(app);
var https = require('https');
const login = require('./settings/login.js');
const options = require('./settings/options.js');
const messengerInfo = require('./settings/messengerInfo.js');
const proxy = require('http-proxy-middleware');
const fs = require('fs');

const sslSettings = {
    key: fs.readFileSync(login.sslPath + 'privkey.pem'),
    cert: fs.readFileSync(login.sslPath + 'fullchain.pem')
};

var path = require('path');
var bodyParser = require('body-parser');
var session = require('express-session');
var cookieParser = require('cookie-parser');
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

function authChecker(req, res, next) {
    var redirectToUrl = req.originalUrl ? req.originalUrl : '/';
    req.session.redirectTo = redirectToUrl;
    if (req && req.cookies && req.cookies.holkaCookie === login.secretCookie) {
        next();
    } else {
        res.status(401);
        res.redirect('/');
    }
}

var httpsServer = https.createServer(sslSettings, app);

var io = require('socket.io')(httpsServer);

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
logger.level = 'debug';
var enableMotionSensor = false;
http.listen(port, function () {
    logger.info('listening on *:', port);
});

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

var routes = require('./controllers/routes.js')(
    app,
    logger,
    io,
    options.debugMode
);

var iot = require('./services/iot.js')(
    app,
    enableMotionSensor,
    options.debugMode,
    io,
    logger
);

require('./services/certrenewcron.js')(logger);

app.use(authChecker);

app.use('/proxy/stream', proxy(proxyOptions));

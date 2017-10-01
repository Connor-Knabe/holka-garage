var express = require('express');
var app = express();
var http = require('http').Server(app);
var https = require('https');
var login = require('./settings/login.js');
var path = require('path');
require('./services/certrenewcron.js');
var fs = require('fs');
var bodyParser = require('body-parser');
var session = require('express-session');
var cookieParser = require('cookie-parser');
app.use(cookieParser());

app.use(function(req, res, next) {
	if(!req.secure) {
		return res.redirect(['https://', req.get('Host'), req.url].join(''));
 		}
	next();
});

var proxy = require('http-proxy-middleware');

var proxyOptions = {
    target: 'http://localhost:9090/stream/video.mjpeg', // target host
    changeOrigin: false,               // needed for virtual hosted sites
    pathRewrite: {
        '^/proxy/stream' : ''
    }
};





function authChecker(req, res, next) {
    if (req && req.cookies && (req.cookies.holkaCookie === login.secretCookie)) {
        next();
    } else {
        res.status(401);
        res.send('not auth');
    }
}
// app.use('/', proxy({target: 'http://localhost:80', changeOrigin: false}));

//
// app.use('/proxy/stream',function(req, res, next) {
//
//     if(auth(req)){
//         return proxy(proxyOptions);
//     } else {
//
//     }
// 	next();
// });
//



var options = {
  key: fs.readFileSync(login.sslPath + 'privkey.pem'),
  cert: fs.readFileSync(login.sslPath + 'fullchain.pem')
};

var httpsServer = https.createServer(options, app);

var io = require('socket.io')(httpsServer);

var log4js = require('log4js');
var logger = log4js.getLogger();


app.use('/', express.static(path.join(__dirname, 'js')));
app.use(bodyParser.urlencoded({
	extended: true
}));

httpsServer.listen(443, function() {
  logger.info('listening on *:',443);
});

//settings
var port = 80;
logger.level = 'debug';
var debugMode = false;
var enableMotionSensor = false;
http.listen(port, function() {
  logger.info('listening on *:',port);
});

app.use(session({
	secret: login.secret,
	resave: false,
	saveUninitialized: true,
	cookie: { secure: true, httpOnly:true, sameSite:true }
}));

if(debugMode){
// 	logger.level = 'debug';
	logger.debug('___________________________________');
	logger.debug('In debug mode not sending texts!!!');
	logger.debug('___________________________________');
}
var routes = require('./controllers/routes.js')(app,logger,io,debugMode);
var iot = require('./services/iot.js')(app,enableMotionSensor,debugMode,io,logger);

app.use(authChecker);

app.use('/proxy/stream', proxy(proxyOptions));

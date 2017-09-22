var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var path = require('path');
var Gpio = require('onoff').Gpio;
var request = require('request');
var login = require('./login.js');
<<<<<<< HEAD
<<<<<<< HEAD
var twilioLoginInfo = require('./settings/twilioLoginInfo.js');
var twilio = require('twilio');
var client = twilio(twilioLoginInfo.TWILIO_ACCOUNT_SID, twilioLoginInfo.TWILIO_AUTH_TOKEN);
var bodyParser = require('body-parser');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var spawn = require('child_process').spawn;

var proc;
var port = 3000;
var log4js = require('log4js');
var logger = log4js.getLogger();
logger.level = 'debug';
var debugMode = true;
var hoursToWaitBeforeNextSecurityAlert = 2;

app.use(cookieParser());
=======
var bodyParser = require('body-parser')
var session = require('express-session')
var cookieParser = require('cookie-parser')

app.use(cookieParser())
>>>>>>> fc55780... Attempting new logic to secure site

app.use(session({
  secret: login.secret,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
<<<<<<< HEAD
}));

var garageSensor = new Gpio(21, 'in','both');
var garageSwitch = new Gpio(24, 'in','both');
var garageTimeout;
var securityMsgTimeout = null;
var shouldSendSecurityAlert = true;
var hasSent = false;

garageSensor.watch(function(err, value) {
   if (value==1 && !hasSent){
       hasSent = true;
       logger.info('Garge door opened');
       sendMessage(twilioLoginInfo.toNumbers,'Garage opened');
   } else {
       hasSent = false;
       logger.info('Garge door closed');
       sendMessage(twilioLoginInfo.toNumbers,'Garage closed');
   }
});

// sendMessage(twilioLoginInfo.toNumbers,'Garage closed');
function sendMessage(numbers, msgContent){
    if(numbers) {
		for (var i = 0; i < numbers.length; i++) {
            if(numbers[i].email){
                sendEmail(numbers[i],msgContent);
            }
            if(numbers[i].number){
                console.log('number',numbers[i].number);
                sendText(numbers[i],msgContent);
            }
		}
	}
}

function sendText(alertInfo, msgContent){
    if(!debugMode){
        client.messages.create({
            to: alertInfo.number,
            from: twilioLoginInfo.fromNumber,
            body: msgContent
            // mediaUrl:'http://24.217.217.94:3000/cam2.jpg'
        }, function(err, message) {
            if(err){
                logger.error(new Date(), ' Error sending text message for message: ', message, '\nFor error: ', err);
            } else {
                logger.info(new Date(),' Text sent: ', msgContent);
            }
        });
    } else {
        logger.info('Not sending text in debug mode. Message contains:',msgContent);
    }
}

function sendEmail(alertInfo, msgContent){
    var transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: twilioLoginInfo.gmailUsername,
            pass: twilioLoginInfo.gmailPass
        }
    });
    var mailOptions = {
        from: twilioLoginInfo.gmailUsername,
        to: alertInfo.email,
        subject: 'Garge Monitor!',
        text: msgContent
    };
    if(!debugMode){
        transporter.sendMail(mailOptions, function(error, info){
            if(error){
                return logger.error(error);
            }
            logger.info(new Date(),' Email sent: ', msgContent);
        });
    } else {
        logger.info(new Date(), 'not sending email in debug mode', msgContent);
    }
}

app.use('/', express.static(path.join(__dirname, 'js')));
// app.use(bodyParser.urlencoded())
app.use(bodyParser.urlencoded({
	extended: true
}));

function auth(req){
    var authenticated = (req.session && req.session.userInfo && req.session.userInfo.username === login.username) && req.cookies.holkaCookie === login.secretCookie;
    logger.debug('isauth', authenticated);
    return authenticated;
}
app.get('/', function(req, res) {
	if(auth(req)){
	    var options = {
	        maxAge: 1000 * 60* 60 * 24  * 180,
	        httpOnly: true
	    };
		res.cookie('holkaCookie', login.secretCookie, options);

		logger.info('cookies',req.cookies.holkaCookie);
		res.sendFile(__dirname + '/admin.html');
	} else {
		res.sendFile(__dirname + '/index.html');
	}
});

app.post('/', function(req,res){
	if(req.body.username === login.username && req.body.password === login.password ){
		req.session.userInfo = req.body;
		res.redirect('/');
	} else {
		res.send('Access denied wrong username/password');
	}
});

function garageIsOpen(){
    var isOpen = (garageSensor.readSync()==1) ? true :  false;
    return isOpen;
}

app.post('/openOrCloseGarage', function(req,res){
    var garageStatus = null;
    logger.debug('body',req.body);
    if(auth(req)){
        if(req.body && req.body.garageSwitch == 'open' && !garageIsOpen()){
            toggleGarageDoor();
             garageStatus = 'opening';
        } else if(req.body && req.body.garageSwitch == 'close' && garageIsOpen()){
            toggleGarageDoor();
            garageStatus = 'closing';
        }
        var msg = garageStatus+' garage via button';
        if(garageStatus){
            sendMessage(twilioLoginInfo.toNumbers,msg);
        }
        logger.info(msg);
        res.send('auth');
    } else {
        var securityMsg = 'SECURITY: tried to open garage via post without being authenticated!!';
        clearTimeout(securityMsgTimeout);

        securityMsgTimeout = setTimeout(function(){
            shouldSendSecurityAlert = true;
        },hoursToWaitBeforeNextSecurityAlert*60*60*10000);

        if(shouldSendSecurityAlert){
            sendMessage(twilioLoginInfo.toNumbers,securityMsg);
            shouldSendSecurityAlert = false;
        }
        logger.fatal(securityMsg,'Ip address is: ',req.headers['x-forwaded-for'],'or: ',req.connection.remoteAddress);
        res.status(401);
        res.send('not auth');
    }
});

function toggleGarageDoor(){
    clearTimeout(garageTimeout);
    if(!debugMode){
        garageSwitch.writeSync(1);
        garageTimeout = setTimeout(function(){
            garageSwitch.writeSync(0);
        },1000);
    }
}

var sockets = {};
io.on('connection', function(socket) {
  sockets[socket.id] = socket;
  logger.info('Total clients connected : ', Object.keys(sockets).length);
  io.sockets.emit('clients', Object.keys(sockets).length);
  socket.on('disconnect', function() {
    delete sockets[socket.id];
    // no more sockets, kill the stream
    if (Object.keys(sockets).length === 0) {
=======

=======
}))
>>>>>>> fc55780... Attempting new logic to secure site
// var garageSensor = new Gpio(14, 'in');

var spawn = require('child_process').spawn;
var proc;

app.use('/', express.static(path.join(__dirname, 'stream')));
// app.use(bodyParser.urlencoded())
app.use(bodyParser.urlencoded({
	extended: true
}));



// Authenticator
/*
app.use(function(req, res, next) {
    var auth;

    // check whether an autorization header was send    
    if (req.headers.authorization) {
      // only accepting basic auth, so:
      // * cut the starting "Basic " from the header
      // * decode the base64 encoded username:password
      // * split the string at the colon
      // -> should result in an array
      auth = new Buffer(req.headers.authorization.substring(6), 'base64').toString().split(':');
    }

    // checks if:
    // * auth array exists 
    // * first value matches the expected user 
    // * second value the expected password
console.log(login.user,login.pass,'test');
    if (!auth || auth[0] !== login.user || auth[1] !== login.pass) {
        // any of the tests failed
        // send an Basic Auth request (HTTP Code: 401 Unauthorized)
        res.statusCode = 401;
        // MyRealmName can be changed to anything, will be prompted to the user
        res.setHeader('WWW-Authenticate', 'Basic realm="MyRealmName"');
        // this will displayed in the browser when authorization is cancelled
        res.end('Unauthorized');
    } else {
        // continue with processing, user was authenticated
        next();
    }
});
*/


var loggedIn = false;
app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

app.post('/', function(req,res){
	console.log('req',req.body);
	if(req.body.login=== login.user && login.pass ){
		req.session.user = req.body;
		res.redirect('/loggedin');

	} else {
		res.send('Access denied');
	}
});


app.get('/loggedin', function(req,res){
	console.log('loggedin req',req.session.user);
	  console.log('Cookies: ', req.cookies)
	if(loggedIn){
		res.sendFile(__dirname + '/admin.html');
	} else {
		res.send('Access denied');
	}
});


var sockets = {};

io.on('connection', function(socket) {

  sockets[socket.id] = socket;
  console.log("Total clients connected : ", Object.keys(sockets).length);

  io.sockets.emit('clients', Object.keys(sockets).length);

  socket.on('disconnect', function() {
    delete sockets[socket.id];

    // no more sockets, kill the stream
    if (Object.keys(sockets).length == 0) {
>>>>>>> 46047b9... Init
      app.set('watchingFile', false);
      if (proc) proc.kill();
      fs.unwatchFile('./stream/image_stream.jpg');
    }
  });
<<<<<<< HEAD
  socket.on('start-stream', function() {
    startStreaming(io);
  });
});

http.listen(port, function() {
  logger.info('listening on *:',port);
});

function stopStreaming() {
  if (Object.keys(sockets).length === 0) {
=======

  socket.on('start-stream', function() {
    startStreaming(io);
  });

});

http.listen(3000, function() {
  console.log('listening on *:3000');
});

function stopStreaming() {
  if (Object.keys(sockets).length == 0) {
>>>>>>> 46047b9... Init
    app.set('watchingFile', false);
    if (proc) proc.kill();
    fs.unwatchFile('./stream/image_stream.jpg');
  }
}

<<<<<<< HEAD

app.get('/stream/image_stream.jpg',function(req,res){
    if(auth(req)){
        fs.readFile('./stream/image_stream.jpg', function(err, data) {
          if (err) throw err; // Fail if the file can't be read.
            res.writeHead(200, {'Content-Type': 'image/jpeg'});
            res.end(data); // Send the file data to the browser.
        });
    } else{
        logger.fatal('Unauthorized request for image_stream.jpg',req.headers['x-forwaded-for'],req.connection.remoteAddress);
        res.status(401);
        res.send('not auth');
    }

});

function startStreaming(io) {
    if (app.get('watchingFile')) {
        io.sockets.emit('liveStream', '/stream/image_stream.jpg?_t=' + (Math.random() * 100000));
        return;
    }
    var args = ['-w', '1200', '-h', '900', '-vf', '-hf', '-o', './stream/image_stream.jpg', '-t', '999999999', '-tl', '3000', '-ex','night'];
    proc = spawn('raspistill', args);
    logger.debug('Watching for changes...');
    app.set('watchingFile', true);
    fs.watchFile('./stream/image_stream.jpg', function(current, previous) {
    io.sockets.emit('liveStream', '/stream/image_stream.jpg?_t=' + (Math.random() * 100000));
    fs.stat('./stream/image_stream.jpg', function(err, stats){
        var mtime = new Date(stats.mtime);
    	io.sockets.emit('liveStreamDate', mtime.toString());
    });
});
=======
function startStreaming(io) {

  if (app.get('watchingFile')) {
    io.sockets.emit('liveStream', 'image_stream.jpg?_t=' + (Math.random() * 100000));
    return;
  }

  var args = ["-w", "640", "-h", "480", "-vf", "-hf", "-o", "./stream/image_stream.jpg", "-t", "999999999", "-tl", "100"];
  proc = spawn('raspistill', args);

  console.log('Watching for changes...');

  app.set('watchingFile', true);

  fs.watchFile('./stream/image_stream.jpg', function(current, previous) {
    io.sockets.emit('liveStream', 'image_stream.jpg?_t=' + (Math.random() * 100000));
    
    fs.stat("./stream/image_stream.jpg", function(err, stats){
	    var mtime = new Date(stats.mtime);
	    console.log(mtime.toString());
		io.sockets.emit('liveStreamDate', mtime.toString());

	});

  })
>>>>>>> 46047b9... Init

}

var app = express();
var http = require('http').Server(app);

<<<<<<< HEAD
=======
http.listen(8080, function() {
  console.log('listening on *:8080');
});
>>>>>>> 46047b9... Init

app.get('/', function(req, res) {
	res.send('200');
});

/*
garageSensor.watch(function(err, val){
	console.log('val',val);
});
*/
<<<<<<< HEAD
=======

/*
request('http://www.google.com', function (error, response, body) {
  console.log('error:', error); // Print the error if one occurred
  console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
  console.log('body:', body); // Print the HTML for the Google homepage.
});
*/


/*

var serverTwo = require('http').createServer(app);
serverTwo.listen(8080, function(){
	console.log('listening on 80');
})
*/



>>>>>>> 46047b9... Init

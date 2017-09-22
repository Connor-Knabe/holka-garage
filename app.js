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
=======
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
>>>>>>> ee556a5... adding twilio

app.use(session({
  secret: login.secret,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
<<<<<<< HEAD
<<<<<<< HEAD
}));

var garageSensor = new Gpio(21, 'in','both');
var garageSwitch = new Gpio(24, 'in','both');
<<<<<<< HEAD
<<<<<<< HEAD
var garageTimeout;
var securityMsgTimeout = null;
var shouldSendSecurityAlert = true;
=======


<<<<<<< HEAD
>>>>>>> 6edde25... Changing security for image
=======


>>>>>>> 54b6e6d... Adding logic to open garage via post route
=======
var garageTimeout;
var securityMsgTimeout = null;
var shouldSendSecurityAlert = true;
>>>>>>> c9b90e5... About to implement auth0
var hasSent = false;

garageSensor.watch(function(err, value) {
   if (value==1 && !hasSent){
       hasSent = true;
<<<<<<< HEAD
<<<<<<< HEAD
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
=======
       console.log(new Date(),"Garge door opened");
       sendMessage(twilioLoginInfo.toNumbers,"Garage opened");
=======
       logger.info('Garge door opened');
       sendMessage(twilioLoginInfo.toNumbers,'Garage opened');
>>>>>>> 54b6e6d... Adding logic to open garage via post route
   } else {
       hasSent = false;
       logger.info('Garge door closed');
       sendMessage(twilioLoginInfo.toNumbers,'Garage closed');
   }
});

// sendMessage(twilioLoginInfo.toNumbers,'Garage closed');
function sendMessage(numbers, msgContent){
<<<<<<< HEAD
<<<<<<< HEAD
    console.log('numbers',numbers);
>>>>>>> 6edde25... Changing security for image
=======
    logger.info('Sending text message containing', msgContent);
>>>>>>> 54b6e6d... Adding logic to open garage via post route
=======
>>>>>>> c9b90e5... About to implement auth0
    if(numbers) {
		for (var i = 0; i < numbers.length; i++) {
            if(numbers[i].email){
                sendEmail(numbers[i],msgContent);
            }
            if(numbers[i].number){
<<<<<<< HEAD
<<<<<<< HEAD
                console.log('number',numbers[i].number);
=======
                console.log("number",numbers[i].number);
>>>>>>> 6edde25... Changing security for image
=======
                console.log('number',numbers[i].number);
>>>>>>> 54b6e6d... Adding logic to open garage via post route
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
<<<<<<< HEAD
<<<<<<< HEAD
                logger.error(new Date(), ' Error sending text message for message: ', message, '\nFor error: ', err);
            } else {
                logger.info(new Date(),' Text sent: ', msgContent);
            }
        });
    } else {
        logger.info('Not sending text in debug mode. Message contains:',msgContent);
=======
                console.error(new Date(), ' Error sending text message for message: ', message, '\nFor error: ', err);
=======
                logger.error(new Date(), ' Error sending text message for message: ', message, '\nFor error: ', err);
>>>>>>> 54b6e6d... Adding logic to open garage via post route
            } else {
                logger.info(new Date(),' Text sent: ', msgContent);
            }
        });
    } else {
<<<<<<< HEAD
        console.log('not sending text in debug mode',msgContent);
>>>>>>> 6edde25... Changing security for image
=======
        logger.info('Not sending text in debug mode. Message contains:',msgContent);
>>>>>>> 54b6e6d... Adding logic to open garage via post route
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
<<<<<<< HEAD
<<<<<<< HEAD
                return logger.error(error);
            }
            logger.info(new Date(),' Email sent: ', msgContent);
        });
    } else {
        logger.info(new Date(), 'not sending email in debug mode', msgContent);
    }
}

app.use('/', express.static(path.join(__dirname, 'js')));
<<<<<<< HEAD
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
=======
}));
>>>>>>> ee556a5... adding twilio

var garageSensor = new Gpio(21, 'in','both');
var garageSwitch = new Gpio(24, 'in','both');


var hasSent = false;

garageSensor.watch(function(err, value) {
   if (value==1 && !hasSent){
       var curTime = new Date();
       hasSent = true;
       console.log("Garge door opened "+value+new Date());
       sendMessage(twilioLoginInfo.toNumbers,"");
   }
});


function sendMessage(numbers, msgContent){
    if(numbers) {
		for (var i = 0; i < numbers.length; i++) {
            if(numbers[i].email){
                sendEmail(numbers[i],msgContent);
            }
            if(numbers[i].number){
                sendText(numbers[i],msgContent);
            }
		}
	}
}


=======
                return console.log(error);
=======
                return logger.error(error);
>>>>>>> 54b6e6d... Adding logic to open garage via post route
            }
            logger.info(new Date(),' Email sent: ', msgContent);
        });
    } else {
        logger.info(new Date(), 'not sending email in debug mode', msgContent);
    }
}

>>>>>>> 6edde25... Changing security for image
app.use('/', express.static(path.join(__dirname, 'stream')));
=======
>>>>>>> c9b90e5... About to implement auth0
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
<<<<<<< HEAD
    if (Object.keys(sockets).length == 0) {
>>>>>>> 46047b9... Init
=======
    if (Object.keys(sockets).length === 0) {
>>>>>>> ee556a5... adding twilio
      app.set('watchingFile', false);
      if (proc) proc.kill();
      fs.unwatchFile('./stream/image_stream.jpg');
    }
  });
<<<<<<< HEAD
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

=======
>>>>>>> 54b6e6d... Adding logic to open garage via post route
  socket.on('start-stream', function() {
    startStreaming(io);
  });
});

http.listen(port, function() {
  logger.info('listening on *:',port);
});

function stopStreaming() {
<<<<<<< HEAD
  if (Object.keys(sockets).length == 0) {
>>>>>>> 46047b9... Init
=======
  if (Object.keys(sockets).length === 0) {
>>>>>>> ee556a5... adding twilio
    app.set('watchingFile', false);
    if (proc) proc.kill();
    fs.unwatchFile('./stream/image_stream.jpg');
  }
}

<<<<<<< HEAD
<<<<<<< HEAD

app.get('/stream/image_stream.jpg',function(req,res){
    if(auth(req)){
=======

app.get('/stream/image_stream.jpg',function(req,res){
    if(auth(req)){
<<<<<<< HEAD
<<<<<<< HEAD

        console.log("req",req.headers['x-forwaded-for'],req.connection.remoteAddress);
>>>>>>> 6edde25... Changing security for image
=======
        logger.debug('req',req.headers['x-forwaded-for'],req.connection.remoteAddress);
>>>>>>> 54b6e6d... Adding logic to open garage via post route
=======
>>>>>>> c9b90e5... About to implement auth0
        fs.readFile('./stream/image_stream.jpg', function(err, data) {
          if (err) throw err; // Fail if the file can't be read.
            res.writeHead(200, {'Content-Type': 'image/jpeg'});
            res.end(data); // Send the file data to the browser.
        });
<<<<<<< HEAD
<<<<<<< HEAD
    } else{
        logger.fatal('Unauthorized request for image_stream.jpg',req.headers['x-forwaded-for'],req.connection.remoteAddress);
=======
        console.log('ye');
=======
>>>>>>> 54b6e6d... Adding logic to open garage via post route
    } else{
<<<<<<< HEAD
>>>>>>> 6edde25... Changing security for image
=======
        logger.fatal('Unauthorized request for image_stream.jpg',req.headers['x-forwaded-for'],req.connection.remoteAddress);
>>>>>>> c9b90e5... About to implement auth0
        res.status(401);
        res.send('not auth');
    }

});

<<<<<<< HEAD
<<<<<<< HEAD
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
=======

>>>>>>> 6edde25... Changing security for image
=======
>>>>>>> 54b6e6d... Adding logic to open garage via post route
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
<<<<<<< HEAD

<<<<<<< HEAD
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
=======
=======
>>>>>>> 54b6e6d... Adding logic to open garage via post route
});
>>>>>>> ee556a5... adding twilio

}

var app = express();
var http = require('http').Server(app);

<<<<<<< HEAD
<<<<<<< HEAD
=======
http.listen(8080, function() {
  console.log('listening on *:8080');
});
>>>>>>> 46047b9... Init
=======
>>>>>>> 700b3c9... New login

app.get('/', function(req, res) {
	res.send('200');
});

/*
garageSensor.watch(function(err, val){
	console.log('val',val);
});
*/
<<<<<<< HEAD
<<<<<<< HEAD
=======



>>>>>>> 46047b9... Init
=======
>>>>>>> ee556a5... adding twilio

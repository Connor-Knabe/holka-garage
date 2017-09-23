var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var path = require('path');
var Gpio = require('onoff').Gpio;
var request = require('request');
var login = require('./settings/login.js');
var twilioLoginInfo = require('./settings/twilioLoginInfo.js');
var twilio = require('twilio');
var client = twilio(twilioLoginInfo.TWILIO_ACCOUNT_SID, twilioLoginInfo.TWILIO_AUTH_TOKEN);
var bodyParser = require('body-parser');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var spawn = require('child_process').spawn;

var proc;
var port = 80;
var log4js = require('log4js');
var logger = log4js.getLogger();
logger.level = 'info';
var debugMode = true;
var hoursToWaitBeforeNextSecurityAlert = 2;
var garageOpenStatus = null;

app.use(cookieParser());

if(debugMode){
	logger.level = 'debug';
	logger.debug('___________________________________');
	logger.debug('In debug mode not sending texts!!!');
	logger.debug('___________________________________');

}

app.use(session({
  secret: login.secret,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

var motionSensor = new Gpio(15, 'in','both');
var garageSensor = new Gpio(4, 'in','both');
var garageSwitch = new Gpio(21, 'out');


var garageTimeout;
var securityMsgTimeout = null;
var shouldSendSecurityAlert = true;
var hasSentMotionSensorAlert = false;
var hasSentGarageDoorAlert = false;
var garageSensorTimeoutOne = null;
var garageSensorTimeoutTwo = null;

garageSensor.watch(function(err, value) { 	
	logger.debug('val',value);
	if(err){
		logger.error('Error watching garage sensor: ',err);
	}
	
	if (value==1 && !hasSentGarageDoorAlert){
// 	   clearTimeout(garageSensorTimeoutOne);
// 	   garageSensorTimeoutOne = setTimeout(function(){
	       hasSentGarageDoorAlert = true;       
// 	   }, 15*1000);
	   var msg = 'Garage door opened';
	   logger.debug(msg);
	   sendMessage(twilioLoginInfo.toNumbers,msg);
		io.sockets.emit('garageErrorStatus', null);
	} else if (value==0 && hasSentGarageDoorAlert){
// 	   clearTimeout(garageSensorTimeoutTwo);
// 	   garageSensorTimeoutTwo = setTimeout(function(){
	       hasSentGarageDoorAlert = false;	       
// 	   }, 15*1000);
	   var msg = 'Garage door closed';
	   logger.debug(msg);
	   sendMessage(twilioLoginInfo.toNumbers,msg);
		io.sockets.emit('garageErrorStatus', null);
	}   
});


/*
setInterval(function(){

	if(garageSensor.readSync()==1){
		logger.debug('Garage opened: ',garageSensor.readSync(), new Date());
	} else {
		logger.debug('Garage closed: ',garageSensor.readSync(), new Date());
	}
}, 2000);
	
*/
	
var motionSensorTimeoutOne = null;
var motionSensorTimeoutTwo = null;
	
motionSensor.watch(function(err, value) {
	if(err){
		logger.error('Error watching motion sensor: ',err);
	}
	if (value==1 && !hasSentMotionSensorAlert){
		clearTimeout(motionSensorTimeoutOne);
		motionSensorTimeoutOne = setTimeout(function(){
		   hasSentMotionSensorAlert = true;       
		}, 2*60*1000);
		var msg = 'Motion detected in garage'
		logger.debug(msg);
 		sendMessage(twilioLoginInfo.toNumbers,msg);

	} else if (value==0 && hasSentMotionSensorAlert){
		clearTimeout(motionSensorTimeoutTwo);
		motionSensorTimeoutTwo = setTimeout(function(){
		   hasSentMotionSensorAlert = false;	       
		}, 2*60*1000);
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
                logger.debug('number',numbers[i].number);
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
    var authenticated = (req && req.cookies && (req.cookies.holkaCookie === login.secretCookie));
    return authenticated;
}

function vpnAuth(req){
	var clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
	var isOnVpn = clientIp.includes(login.vpnIp);
    return isOnVpn;	
}

app.get('/', function(req, res) {
	if(auth(req)){
		res.sendFile(__dirname + '/admin.html');
	} else {
		res.sendFile(__dirname + '/index.html');
	}
});

app.post('/', function(req,res){
	if(req.body.username === login.username && req.body.password === login.password ){
		req.session.userInfo = req.body;
		var options = {
	        maxAge: 1000 * 60* 60 * 24  * 180,
	        httpOnly: true
	    };
		res.cookie('holkaCookie', login.secretCookie, options);

		logger.info('cookies',req.cookies.holkaCookie);
		res.redirect('/');
	} else {
		res.send('Access denied wrong username/password');
	}
});

function garageIsOpen(){
    var isOpen = (garageSensor.readSync()==1) ? true :  false;
    return isOpen;
}

var garageOpenStatus = null;
var garageErrorStatus = null
app.post('/openOrCloseGarage', function(req,res){
    logger.debug('body',req.body);
    if(auth(req) && vpnAuth(req)){
        if(req.body && req.body.garageSwitch == 'open'){
	        if(!garageIsOpen()){
                toggleGarageDoor();
				garageOpenStatus = 'Opening...';
		   		io.sockets.emit('garageOpenStatus', garageOpenStatus);
		        var msg = garageOpenStatus+' garage via button';
		        if(garageOpenStatus){
		            sendMessage(twilioLoginInfo.toNumbers,msg);
		        }
				io.sockets.emit('garageErrorStatus', null);

	        } else {
		        logger.debug('err');
				io.sockets.emit('garageOpenStatus', null);
				garageErrorStatus = 'Garage is already open!!'
				io.sockets.emit('garageErrorStatus', garageErrorStatus);
 	        }
        } else if(req.body && req.body.garageSwitch == 'close'){
	        if(garageIsOpen()){
                toggleGarageDoor();
				garageOpenStatus = 'Closing...';
		   		io.sockets.emit('garageOpenStatus', garageOpenStatus);
		        var msg = garageOpenStatus+' garage via button';
		        if(garageOpenStatus){
		            sendMessage(twilioLoginInfo.toNumbers,msg);
		        }
				io.sockets.emit('garageErrorStatus', null);
	        } else {
		        logger.debug('err');
				io.sockets.emit('garageOpenStatus', null);
				io.sockets.emit('garageErrorStatus', 'Garage is already closed!!');
 	        }
        }        

        logger.info(msg);
        res.send(garageOpenStatus);

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
    logger.debug('toggling now');

    if(debugMode){
        logger.debug('opening/closing now');
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
		app.set('watchingFile', false);
		if (proc) proc.kill();
		fs.unwatchFile('./stream/image_stream.jpg');
	}
	});
	if(garageIsOpen()){
		io.sockets.emit('garageStatus', 'open');
	} else {
		io.sockets.emit('garageStatus', 'closed');
	}
	socket.on('start-stream', function() {
		startStreaming(io);
	});
});

http.listen(port, function() {
  logger.info('listening on *:',port);
});

function stopStreaming() {
  if (Object.keys(sockets).length === 0) {
    app.set('watchingFile', false);
    if (proc) proc.kill();
    fs.unwatchFile('./stream/image_stream.jpg');
  }
}


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
    var args = ['-w', '800', '-h', '600', '-vf', '-hf', '-o', './stream/image_stream.jpg', '-t', '999999999', '-tl', '1000', '-ex','night'];
    proc = spawn('raspistill', args);
    logger.debug('Watching for changes...');
    app.set('watchingFile', true);
    fs.watchFile('./stream/image_stream.jpg', function(current, previous) {
	    io.sockets.emit('liveStream', '/stream/image_stream.jpg?_t=' + (Math.random() * 100000));
	    fs.stat('./stream/image_stream.jpg', function(err, stats){
		    if(stats){
				var mtime = new Date(stats.mtime);
		    	io.sockets.emit('liveStreamDate', mtime.toString());
		    	if(garageIsOpen()){
					if(garageOpenStatus=='Opening...'){
						io.sockets.emit('garageOpenStatus', null);
						garageOpenStatus = null;
					}
					io.sockets.emit('garageStatus', 'open');
		    	} else {
					if(garageOpenStatus=='Closing...'){
						io.sockets.emit('garageOpenStatus', null);
						garageOpenStatus = null;
					}
					io.sockets.emit('garageStatus', 'closed');
		    	}
		    }
	        
	    });
	});

}

var app = express();
var http = require('http').Server(app);


app.get('/', function(req, res) {
	res.send('200');
});

/*
garageSensor.watch(function(err, val){
	console.log('val',val);
});
*/

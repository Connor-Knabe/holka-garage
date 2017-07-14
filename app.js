var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var path = require('path');
var Gpio = require('onoff').Gpio;
var request = require('request');
var login = require('./login.js');
var bodyParser = require('body-parser')
var session = require('express-session')
var cookieParser = require('cookie-parser')

app.use(cookieParser())

app.use(session({
  secret: login.secret,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}))
// var garageSensor = new Gpio(14, 'in');

var spawn = require('child_process').spawn;
var proc;

app.use('/', express.static(path.join(__dirname, 'stream')));
// app.use(bodyParser.urlencoded())
app.use(bodyParser.urlencoded({
	extended: true
}));


app.get('/', function(req, res) {
	if((req.session && req.session.userInfo && req.session.userInfo.username === login.username && req.session.userInfo.password === login.password) || req.cookies.holkaCookie === login.secretCookie){
		

	    var options = {
	        maxAge: 1000 * 60* 60 * 24  * 180, 
	        httpOnly: true
	    }
			
		res.cookie('holkaCookie', login.secretCookie, options)

		
		console.log('cookies',req.cookies.holkaCookie);
// 		cookies.forEach(console.log);
		res.sendFile(__dirname + '/admin.html');
	} else {
		res.sendFile(__dirname + '/index.html');
	}
});

app.post('/', function(req,res){
	console.log('req',req.body);
	if(req.body.username === login.username && req.body.password === login.password ){
		req.session.userInfo = req.body;
		res.redirect('/');
	} else {
		res.send('Access denied wrong username/password');
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
      app.set('watchingFile', false);
      if (proc) proc.kill();
      fs.unwatchFile('./stream/image_stream.jpg');
    }
  });

  socket.on('start-stream', function() {
    startStreaming(io);
  });

});

http.listen(3000, function() {
  console.log('listening on *:3000');
});

function stopStreaming() {
  if (Object.keys(sockets).length == 0) {
    app.set('watchingFile', false);
    if (proc) proc.kill();
    fs.unwatchFile('./stream/image_stream.jpg');
  }
}

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




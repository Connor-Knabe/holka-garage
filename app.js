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

http.listen(8080, function() {
  console.log('listening on *:8080');
});

app.get('/', function(req, res) {
	res.send('200');
});

/*
garageSensor.watch(function(err, val){
	console.log('val',val);
});
*/

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




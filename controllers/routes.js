var messengerInfo = require('../settings/messengerInfo.js');
var options = require('../settings/options.js');

var garageOpenStatus = null;
const geoip = require('geoip-lite');
const { constants } = require('buffer');
var sockets = {};
var personOneAway = false;
var personTwoAway = false;
var personOneTime = new Date();
var personTwoTime = new Date();
const rebootTime = new Date();

module.exports = function(app, logger, io, debugMode, cron, authService) {
	const hue = require('../services/hue.js')(logger);
	const video = require('../services/video.js')(app, logger, io, hue, sockets);
	var messenger = require('../services/messenger.js')(logger, debugMode);
	var iot = require('../services/iot.js')(app, debugMode, io, logger, video, messenger, hue, cron);
	const rp = require('request-promise');

	var securityMsgTimeout = null;
	var garageErrorStatus = null;
	var shouldSendSecurityAlert = true;

	var fs = require('fs');
	var bodyParser = require('body-parser');
	var login = require('../settings/login.js');


	function isValidLogin(username, password) {
		var user = null;
		login.users.forEach((userLogin) => {
			if (userLogin.username.toLowerCase() === username.toLowerCase() && userLogin.password === password) {
				user = userLogin;
			}
		});
		return user;
	}

	io.on('connection', function(socket) {
		sockets[socket.id] = socket;
		io.sockets.emit('clients', Object.keys(sockets).length);

		socket.on('disconnect', function() {
			delete sockets[socket.id];
			hue.garageLightsOffTimed();
			video.stopStreaming();
		});

		if (iot.garageIsOpen()) {
			io.sockets.emit('garageStatus', 'open');
		} else {
			io.sockets.emit('garageStatus', 'closed');
		}

		if (options.garageGpsEnabledMain) {
			io.sockets.emit('garageGPSStatus', 'enabled');
		} else {
			io.sockets.emit('garageGPSStatus', 'disabled');
		}

		if (options.garageGpsEnabledPersonTwo) {
			const timeAway = getTimeAway(personTwoTime);
			io.sockets.emit('personTwoTime', `${timeAway}`);
			io.sockets.emit('personTwoName', `${login.users[1].name}: `);
			if (personTwoAway) {
				io.sockets.emit('personTwoAway', `away`);
			} else {
				io.sockets.emit('personTwoAway', 'home');
			}
		}

		if (options.garageGpsEnabledPersonOne) {
			const timeAway = getTimeAway(personOneTime);
			io.sockets.emit('personOneTime', `${timeAway}`);
			io.sockets.emit('personOneName', `${login.users[0].name}: `);
			if (personOneAway) {
				io.sockets.emit('personOneAway', `away`);
			} else {
				io.sockets.emit('personOneAway', 'home');
			}
		}

		const timeSinceReboot = getTimeAway(rebootTime);

		io.sockets.emit('rebootTime', timeSinceReboot);

		io.sockets.emit('garageTimer', `${options.minsToWaitAfterLeavingHouseForGPSOpen} mins`);

		io.sockets.emit('garageLastOpenedTime', iot.getGarageLastOpenedTime());

		if (app.get('takingVideo')) {
			io.sockets.emit('garageOpenStatus', 'Recording video');
		}

		socket.on('start-stream', function() {
			video.startStreaming(io);
		});
	});

	

	app.get('/', function(req, res) {
		if (authService.auth(req)) {
			res.sendFile('admin.html', { root: './views/' });
		} else {
			res.sendFile('index.html', { root: './views/' });
		}
	});

	//Used to verify letsencrypt manually
	app.get('/.well-known/acme-challenge/' + login.acmeChallengeKey.split('.')[0], function(req, res) {
		res.send(login.acmeChallengeKey);
	});

	//Used to verify letsencrypt manually
	app.get('/.well-known/acme-challenge/' + login.acmeChallengeKey2.split('.')[0], function(req, res) {
		res.send(login.acmeChallengeKey2);
	});

	//Used to verify letsencrypt manually
	app.get('/.well-known/acme-challenge/' + login.acmeChallengeKey3.split('.')[0], function(req, res) {
		res.send(login.acmeChallengeKey3);
	});



	app.post('/', bodyParser.urlencoded({ extended: false }), function(req, res) {
		var options = {
			maxAge: 1000 * 60 * 60 * 24 * 180,
			httpOnly: true
		};

		var shouldRedirect = false;
		var user = req.body.username && req.body.password ? isValidLogin(req.body.username, req.body.password) : null;

		if (user) {
			req.session.userInfo = req.body;
			res.cookie('holkaCookie', user.secretCookie, options);
			shouldRedirect = true;
		} else {
			res.status(401);
			res.send('Access denied wrong username/password');
		}

		if (shouldRedirect) {
			if (req && req.session && req.session.redirectTo) {
				res.redirect(req.session.redirectTo);
			} else {
				res.redirect('/');
			}
		}
	});
};

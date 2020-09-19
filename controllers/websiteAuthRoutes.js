var messengerInfo = require('../settings/messengerInfo.js');
var options = require('../settings/options.js');
var login = require('../settings/login.js');

var garageOpenStatus = null;
const geoip = require('geoip-lite');
const { constants } = require('buffer');


const rebootTime = new Date();

module.exports = function(app, logger, io, hue, messenger, iot, video, authService, homeAway) {
	var fs = require('fs');
	var bodyParser = require('body-parser');

	var garageErrorStatus = null;

	app.get('/stream/image_stream.jpg', function(req, res) {
		fs.readFile('./stream/image_stream.jpg', function(err, data) {
			if (err) logger.error('failed to read image stream', err); // Fail if the file can't be read.
			res.writeHead(200, { 'Content-Type': 'image/jpeg' });
			res.end(data); // Send the file data to the browser.
		});
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

	function isValidLogin(username, password) {
		var user = null;
		login.users.forEach((userLogin) => {
			if (userLogin.username.toLowerCase() === username.toLowerCase() && userLogin.password === password) {
				user = userLogin;
			}
		});
		return user;
	}

	app.post('/video', bodyParser.urlencoded({ extended: false }), function(req, res) {
		io.sockets.emit('garageOpenStatus', 'Recording video');
		video
			.streamVideo()
			.then(() => {
				var msg = 'Sending video via website';
				var btnPress = true;
				messenger.send(options.alertButtonPressTexts, messengerInfo.toNumbers, msg, options.alertSendPictureText, btnPress);
				io.sockets.emit('garageOpenStatus', 'Video sent');
			})
			.catch(() => {});
		res.send('Ok');
	});

	app.post('/gpsToggle', bodyParser.urlencoded({ extended: false }), function(req, res) {
		if (options.garageGpsEnabledMain) {
			options.garageGpsEnabledMain = false;
		} else {
			options.garageGpsEnabledMain = true;
		}
		var garageGPSStatus = options.garageGpsEnabledMain ? 'enabled' : 'disabled';
		io.sockets.emit('garageGPSStatus', garageGPSStatus);
		res.send('Ok');
	});

	app.post('/lights/:brightness', bodyParser.urlencoded({ extended: false }), function(req, res) {
		io.sockets.emit('garageLightStatus', 'Changing light brightness');
		hue
			.lightsOn(req.params.brightness)
			.then(() => {
				setTimeout(() => {
					io.sockets.emit('garageLightStatus', 'Light brightness changed, wait for image to update');
					setTimeout(() => {
						io.sockets.emit('garageLightStatus', null);
					}, 3 * 1000);
				}, 2 * 1000);
			})
			.catch((e) => {
				logger.error('Error setting light brightness:', e);
			});
		res.send(`Set to brightness ${req.params.brightness}`);
	});

	app.post('/openOrCloseGarage', bodyParser.urlencoded({ extended: false }), function(req, res) {
		var user = authService.auth(req);

		if (req.body && req.body.garageSwitch == 'open') {
			if (!iot.garageIsOpen()) {
				iot.openCloseGarageDoor();
				garageOpenStatus = 'Opening...';
				video.updateGarageStatus(garageOpenStatus);
				io.sockets.emit('garageOpenStatus', garageOpenStatus);
				var msg = `${garageOpenStatus} garage via button for ${user.name}`;
				var btnPress = true;
				video
					.streamVideo()
					.then(() => {
						messenger.send(options.alertButtonPressTexts, messengerInfo.toNumbers, msg, options.openViaButtonAlertSendPictureText, btnPress);
					})
					.catch(() => {
						logger.debug('failed to stream video when garage was opening');
						video.stopStreaming();
						messenger.send(options.alertButtonPressTexts, messengerInfo.toNumbers, msg, options.openViaButtonAlertSendPictureText, btnPress);
					});

				io.sockets.emit('garageErrorStatus', null);
			} else {
				logger.debug('err');
				io.sockets.emit('garageOpenStatus', null);
				garageErrorStatus = 'Garage is already open!!';
				io.sockets.emit('garageErrorStatus', garageErrorStatus);
			}
		} else if (req.body && req.body.garageSwitch == 'close') {
			if (iot.garageIsOpen()) {
				iot.openCloseGarageDoor();
				garageOpenStatus = 'Closing...';
				video.updateGarageStatus(garageOpenStatus);
				io.sockets.emit('garageOpenStatus', garageOpenStatus);
				var msg = `${garageOpenStatus} garage via button for ${user.name}`;
				var btnPress = true;
				video
					.streamVideo()
					.then(() => {
						messenger.send(options.alertButtonPressTexts, messengerInfo.toNumbers, msg, options.openViaButtonAlertSendPictureText, btnPress);
					})
					.catch(() => {
						logger.debug('failed to stream video when garage was closing');
						video.stopStreaming();
						messenger.send(options.alertButtonPressTexts, messengerInfo.toNumbers, msg, options.openViaButtonAlertSendPictureText, btnPress);
					});
				io.sockets.emit('garageErrorStatus', null);
			} else {
				logger.debug('err');
				video.updateGarageStatus(null);
				io.sockets.emit('garageOpenStatus', null);
				io.sockets.emit('garageErrorStatus', 'Garage is already closed!!');
			}
		}
		logger.info(msg);
		res.send(garageOpenStatus);
	});

	app.post('/togglePersonOneHomeAway', bodyParser.urlencoded({ extended: false }), function(req, res) {
		var personTwo = false;
		if (homeAway.isPersonAway(personTwo)) {
			homeAway.setPersonOneHome();
		} else {
			const isPersonTwo = false;
			homeAway.setPersonAway(req, res, isPersonTwo);
		}
	});

	app.post('/togglePersonTwoHomeAway', bodyParser.urlencoded({ extended: false }), function(req, res) {
		var personTwo = true;
		if (homeAway.isPersonAway(personTwo)){
			homeAway.setPersonTwoHome();
		} else {
			const isPersonTwo = true;
			homeAway.setPersonAway(req, res, isPersonTwo);
		}
	});
	
};

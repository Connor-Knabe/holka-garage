var messengerInfo = require('../settings/messengerInfo.js');
var options = require('../settings/options.js');
var basicAuth = require('basic-auth-connect');
var fs = require('fs');
var garageOpenStatus = null;

module.exports = function(app, logger, io, hue, messenger, video, authService, homeAway, proxy, bodyParser,iot) {
	var garageErrorStatus = null;

	//requires basic auth for twilio mms
	app.use('/pictures', basicAuth(messengerInfo.twilioPictureUser, messengerInfo.twilioPicturePass));
	app.get('/pictures', function(req, res) {
		fs.readFile('./stream/video.gif', function(err, data) {
			if (err) logger.error('error reading image_stream', err); // Fail if the file can't be read.
			res.writeHead(200, { 'Content-Type': 'image/gif' });
			res.end(data); // Send the file data to the browser.
		});
	});

	//routes below this line check for logged in user
	app.use(authService.authChecker);

	app.get('/stream/image_stream.jpg', function(req, res) {
		fs.readFile('./stream/image_stream.jpg', function(err, data) {
			if (err) logger.error('failed to read image stream', err); // Fail if the file can't be read.
			res.writeHead(200, { 'Content-Type': 'image/jpeg' });
			res.end(data); // Send the file data to the browser.
		});
	});

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
			.catch(() => {

				io.sockets.emit('garageOpenStatus', 'Video failed to send');

			});
		res.send('Ok');
	});

	app.post('/toggleGarageStillOpenAlert', bodyParser.urlencoded({ extended: false }), function(req, res) {
		res.send(iot.toggleTemporaryDisableGarageStillOpenAlert());
	});

	app.post('/toggleGuestIsHome', bodyParser.urlencoded({ extended: false }), function(req, res) {
		res.send(iot.toggleTemporaryEnableGuestIsHome());
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
				iot.Status.wasOpenedViaWebsite = true; 
				iot.openCloseGarageDoor();
				garageOpenStatus = 'Opening...';
				video.updateGarageStatus(garageOpenStatus);
				io.sockets.emit('garageOpenStatus', garageOpenStatus);
				var msg = `${garageOpenStatus} garage via button for ${user.name}`;
				setTimeout(()=>{
					homeAway.Status.whoOpenedGarageLast = user.name;
					io.sockets.emit('whoOpenedGarageLast', homeAway.Status.whoOpenedGarageLast);
					iot.Status.wasOpenedViaWebsite = false;
				}, 5*1000);
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
				iot.Status.wasClosedViaWebsite = true; 
				iot.openCloseGarageDoor();
				garageOpenStatus = 'Closing...';
				video.updateGarageStatus(garageOpenStatus);
				io.sockets.emit('garageOpenStatus', garageOpenStatus);
				var msg = `${garageOpenStatus} garage via button for ${user.name}`;
				setTimeout(()=>{
					homeAway.Status.whoClosedGarageLast = user.name;
					io.sockets.emit('whoCloseGarageLast', homeAway.Status.whoClosedGarageLast);
					iot.Status.wasClosedViaWebsite = false;
				}, 5*1000);
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
			iot.activateGarageGpsOpenAwayTimer(isPersonTwo);
		}
	});

	app.post('/togglePersonTwoHomeAway', bodyParser.urlencoded({ extended: false }), function(req, res) {
		var personTwo = true;
		if (homeAway.isPersonAway(personTwo)){
			homeAway.setPersonTwoHome();
		} else {
			const isPersonTwo = true;
			homeAway.setPersonAway(req, res, isPersonTwo);
			iot.activateGarageGpsOpenAwayTimer(isPersonTwo);
		}
	});

	//if using https://github.com/Connor-Knabe/hue-energy-usage
	if (options.enableHueEnergyUsageReport) {
		var hueEnergyUsageOptions = {
			target: 'http://localhost:1234',
			changeOrigin: false,
			pathRewrite: {
				'^/proxy/hue-energy-usage': ''
			}
		};
		app.use('/proxy/hue-energy-usage', proxy(hueEnergyUsageOptions));
	}
	if (options.enableNestEnergyUsageReport) {
		var nestEnergyUsageOptions = {
			target: 'http://localhost:1235',
			changeOrigin: false,
			pathRewrite: {
				'^/proxy/nest-energy-usage': ''
			}
		};
		app.use('/proxy/nest-energy-usage', proxy(nestEnergyUsageOptions));
	}
	
};

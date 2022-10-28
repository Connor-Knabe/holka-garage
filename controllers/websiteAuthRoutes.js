var messengerInfo = require('../settings/messengerInfo.js');
var options = require('../settings/options.js');
var basicAuth = require('basic-auth-connect');
var fs = require('fs');
var garageOpenStatus = null;
var wasOpenedViaWebsiteTimeout = null;
var wasClosedViaWebsiteTimeout = null;

module.exports = function(app, logger, io, hue, messenger, video, authService, homeAway, bodyParser,iot) {
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

	app.get('/status', function(req, res) {
		var garageOpenClosed = iot.garageIsOpen() ? "Open": "Closed";
		var personOneAway = homeAway.isPersonAway(true) ? "Away": "Home";
		var personTwoAway = homeAway.isPersonAway(false) ? "Away": "Home";
		res.send(`Garage is ${garageOpenClosed}:\nPerson One ${personOneAway}:\nPerson Two ${personTwoAway}`);
	});

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
			?.streamVideo()
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
		hue.lightsOn();
		
		res.send(`Set to brightness ${req.params.brightness}`);
	});




	app.post('/openOrCloseGarage', bodyParser.urlencoded({ extended: false }), function(req, res) {
		var user = authService.auth(req);
		if (req.body && req.body.garageSwitch == 'open') {
			if (!iot.garageIsOpen()) {
				iot.Status.wasOpenedViaWebsite = true; 
				iot.openCloseGarageDoor();
				garageOpenStatus = 'Opening...';
				video?.updateGarageStatus(garageOpenStatus);
				io.sockets.emit('garageOpenStatus', garageOpenStatus);
				var msg = `${garageOpenStatus} garage via button for ${user.name}`;
				homeAway.Status.whoOpenedGarageLast = user.name;
				io.sockets.emit('whoOpenedGarageLast', homeAway.Status.whoOpenedGarageLast);
				clearTimeout(wasOpenedViaWebsiteTimeout);
				wasOpenedViaWebsiteTimeout = setTimeout(()=>{
					iot.Status.wasOpenedViaWebsite = false;
				}, 40*1000);
				var btnPress = true;
				video
					?.streamVideo()
					.then(() => {
						messenger.send(options.alertButtonPressTexts, messengerInfo.toNumbers, msg, options.openViaButtonAlertSendPictureText, btnPress);
					})
					.catch(() => {
						logger.debug('failed to stream video when garage was opening');
						video?.stopStreaming();
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
				video?.updateGarageStatus(garageOpenStatus);
				io.sockets.emit('garageOpenStatus', garageOpenStatus);
				var msg = `${garageOpenStatus} garage via button for ${user.name}`;
				homeAway.Status.whoClosedGarageLast = user.name;
				io.sockets.emit('whoCloseGarageLast', homeAway.Status.whoClosedGarageLast);
				clearTimeout(wasClosedViaWebsiteTimeout);
				wasClosedViaWebsiteTimeout = setTimeout(()=>{
					iot.Status.wasClosedViaWebsite = false;
				}, 40*1000);
				var btnPress = true;
				video
					?.streamVideo()
					.then(() => {
						messenger.send(options.alertButtonPressTexts, messengerInfo.toNumbers, msg, options.openViaButtonAlertSendPictureText, btnPress);
					})
					.catch(() => {
						logger.debug('failed to stream video when garage was closing');
						video?.stopStreaming();
						messenger.send(options.alertButtonPressTexts, messengerInfo.toNumbers, msg, options.openViaButtonAlertSendPictureText, btnPress);
					});
				io.sockets.emit('garageErrorStatus', null);
			} else {
				logger.debug('err');
				video?.updateGarageStatus(null);
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
			res.send('Person One Now Home');
		} else {
			const isPersonTwo = false;
			homeAway.setPersonAway(isPersonTwo);
			iot.activateGarageGpsOpenAwayTimer(isPersonTwo);
			res.send('Person One Now Away');
		}
	});

	app.post('/togglePersonTwoHomeAway', bodyParser.urlencoded({ extended: false }), function(req, res) {
		var personTwo = true;
		if (homeAway.isPersonAway(personTwo)){
			homeAway.setPersonTwoHome();
			res.send('Person Two Now Home');
		} else {
			const isPersonTwo = true;
			homeAway.setPersonAway(isPersonTwo);
			iot.activateGarageGpsOpenAwayTimer(isPersonTwo);
			res.send('Person Two Now Away');
		}
	});
	
};

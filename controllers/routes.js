var messengerInfo = require('../settings/messengerInfo.js');
var options = require('../settings/options.js');
var garageOpenStatus = null;
const geoip = require('geoip-lite');
module.exports = function(app, logger, io, debugMode) {
	var iot = require('../services/iot.js')(app, debugMode, io, logger);
	const hue = require('../services/hue.js')(logger);
	const video = require('../services/video.js')(app, logger, io);
	const rp = require('request-promise');

	var securityMsgTimeout = null;
	var garageErrorStatus = null;
	var shouldSendSecurityAlert = true;

	var messenger = require('../services/messenger.js')(logger, debugMode);
	var fs = require('fs');
	var bodyParser = require('body-parser');
	var login = require('../settings/login.js');

	function auth(req) {
		var authenticated = req && req.cookies && (req.cookies.holkaCookie === login.secretCookie || req.cookies.holkaCookie === login.secretAdminCookie);

		return authenticated;
	}

	function vpnAuth(req) {
		var clientIp = req.connection.remoteAddress;
		var isOnVpn = clientIp.includes(options.vpnIp) || clientIp.includes(options.localIp) || debugMode || (options.vpnIp === '' && options.localIp === '');
		return isOnVpn;
	}

	function regionAuth(req) {
		var clientIp = req.connection.remoteAddress;
		var geo = geoip.lookup(clientIp);
		logger.debug(`Region auth from ${geo.region}`);
		return options.geoIpFilter.includes(geo.region) || options.geoIpFilter === '';
	}

	app.get('/', function(req, res) {
		if (auth(req)) {
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

	app.get('/stream/image_stream.jpg', function(req, res) {
		if (auth(req)) {
			fs.readFile('./stream/image_stream.jpg', function(err, data) {
				if (err) logger.error('failed to read image stream', err); // Fail if the file can't be read.
				res.writeHead(200, { 'Content-Type': 'image/jpeg' });
				res.end(data); // Send the file data to the browser.
			});
		} else {
			logger.fatal('Unauthorized request for image_stream.jpg', req.connection.remoteAddress);
			res.status(401);
			res.send('not auth');
		}
	});

	app.get('/pictures', function(req, res) {
		fs.readFile('./stream/video.gif', function(err, data) {
			if (err) logger.error('error reading image_stream', err); // Fail if the file can't be read.
			res.writeHead(200, { 'Content-Type': 'image/gif' });
			res.end(data); // Send the file data to the browser.
		});
	});

	app.post('/', function(req, res) {
		var options = {
			maxAge: 1000 * 60 * 60 * 24 * 180,
			httpOnly: true
		};

		var shouldRedirect = false;

		if (req.body.username && req.body.password && isAdminLogin(req.body.username, req.body.password)) {
			req.session.userInfo = req.body;
			res.cookie('holkaCookie', login.secretAdminCookie, options);
			shouldRedirect = true;
		} else if (req.body.username && req.body.password && isUserLogin(req.body.username, req.body.password)) {
			req.session.userInfo = req.body;
			res.cookie('holkaCookie', login.secretCookie, options);
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

	function isAdminLogin(username, password) {
		return username.toLowerCase() === login.adminUsername.toLowerCase() && password === login.adminPassword;
	}

	function isUserLogin(username, password) {
		return username.toLowerCase() === login.username.toLowerCase() && password === login.password;
	}

	app.post('/video', function(req, res) {
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

	app.post('/gpsToggle', function(req, res) {
		if (options.garageGpsEnabledMain) {
			options.garageGpsEnabledMain = false;
		} else {
			options.garageGpsEnabledMain = true;
		}

		var garageGPSStatus = options.garageGpsEnabledMain ? 'enabled' : 'disabled';

		io.sockets.emit('garageGPSStatus', garageGPSStatus);

		res.send('Ok');
	});

	app.post('/lights/:brightness', function(req, res) {
		io.sockets.emit('garageOpenStatus', 'Changing light brightness');
		hue
			.lightsOn(req.params.brightness)
			.then(() => {
				setTimeout(() => {
					io.sockets.emit('garageOpenStatus', 'Light brightness changed, wait for image to update');
				}, 2 * 1000);
			})
			.catch((e) => {
				logger.error('Error setting light brightness:', e);
			});
		res.send(`Set to brightness ${req.params.brightness}`);
	});

	app.post('/sms', function(req, res) {
		var incomingPhoneNumber = req.body.From;

		var msg = {
			sid: req.body.MessageSid,
			type: 'text',
			textMessage: req.body.Body,
			fromCity: req.body.FromCity,
			fromState: req.body.FromState,
			fromCountry: req.body.FromCountry
		};
		logger.info(`SMS containing: "${msg.textMessage}". Recieved from: ${incomingPhoneNumber}`);

		var alertInfo = [
			{
				number: incomingPhoneNumber
			}
		];

		if (msg.textMessage.toLowerCase().trim() == 'video' || msg.textMessage.toLowerCase().trim() == 'stream') {
			video
				.streamVideo()
				.then(() => {
					var txtMsg = 'Video requested from ' + incomingPhoneNumber;
					var btnPress = true;
					video
						.streamVideo()
						.then(() => {
							messenger.send(options.alertButtonPressTexts, messengerInfo.toNumbers, txtMsg, options.alertSendPictureText, btnPress);
						})
						.catch(() => {});
					io.sockets.emit('garageOpenStatus', 'Video sent');
				})
				.catch(() => {});
		} else if (containsString(msg.textMessage.toLowerCase(), 'pause')) {
			var parsedTime = msg.textMessage.toLowerCase().split(' ')[1];

			var hoursToPause = isInt(parsedTime) ? parsedTime : 12;

			iot.setIsHomeEnabled(false, hoursToPause);

			var txtMsg = `Pausing home/away trigger for ${hoursToPause} hours`;
			messenger.send(true, alertInfo, txtMsg, false, true);
		} else if (msg.textMessage.toLowerCase().trim() == 'resume') {
			iot.setIsHomeEnabled(true);
			var txtMsg = 'Resuming home/away trigger';
			messenger.send(true, alertInfo, txtMsg, false, true);
		} else {
			var txtMsg = 'Unrecognized command: ' + msg.textMessage + '. Video, pause, stream, resume are the only recognized commands at the moment.';
			messenger.send(true, alertInfo, txtMsg, false, true);
		}

		res.status(204);
		res.send('No content');
	});

	app.post('/openViaGps', bodyParser.json(), function(req, res) {
		logger.debug('openViaGps called');

		if (options.garageGpsEnabledPersonOne) {
			logger.debug('openViaGpsTwo active');
			openViaGps(res, req, false);
		} else {
			res.status(200);
			res.send('OK');
		}
	});

	app.post('/openViaGpsTwo', bodyParser.json(), function(req, res) {
		logger.debug('openViaGpsTwo called');
		if (options.garageGpsEnabledPersonTwo) {
			logger.debug('openViaGpsTwo active');
			openViaGps(res, req, true);
		} else {
			res.status(200);
			res.send('OK');
		}
	});

	function containsString(str, containsStr) {
		return str.indexOf(containsStr) > -1;
	}

	function isInt(value) {
		var x = parseFloat(value);
		return !isNaN(value) && (x | 0) === x;
	}

	function openViaGps(res, req, two) {
		var gpsOpenKey = login.iftttGpsGarageOpenKey;
		var gpsPerson = 'one';
		if (two) {
			gpsOpenKey = login.iftttGpsGarageOpenKeyTwo;
			gpsPerson = 'two;';
		}

		if (gpsOpenKey === req.body.iftttGpsGarageOpenKey) {
			if (!options.garageGpsEnabledMain) {
				messenger.sendIftt(true, `NOT opening GPS open disabled`);
				res.status(200);
				res.send('OK');
				return;
			}

			iot.garageDoorOpenHandler(two, gpsPerson, req.connection.remoteAddress);

			res.status(200);
			res.send('OK');
		} else {
			logger.info(`Failed attempt to open garage for person ${gpsPerson} via gps from ip: ${req.connection.remoteAddress} with body of ${JSON.stringify(req.body)}`);
			res.status(401);
			res.send('not auth to open garage');
		}
	}

	app.post('/openOrCloseGarage', function(req, res) {
		if (auth(req)) {
			if (req.body && req.body.garageSwitch == 'open') {
				if (!iot.garageIsOpen()) {
					iot.toggleGarageDoor();
					garageOpenStatus = 'Opening...';
					video.updateGarageStatus(garageOpenStatus);
					io.sockets.emit('garageOpenStatus', garageOpenStatus);
					var msg = garageOpenStatus + ' garage via button';
					var btnPress = true;
					video
						.streamVideo()
						.then(() => {
							messenger.send(options.alertButtonPressTexts, messengerInfo.toNumbers, msg, options.openViaButtonAlertSendPictureText, btnPress);
						})
						.catch(() => {});

					io.sockets.emit('garageErrorStatus', null);
				} else {
					logger.debug('err');
					io.sockets.emit('garageOpenStatus', null);
					garageErrorStatus = 'Garage is already open!!';
					io.sockets.emit('garageErrorStatus', garageErrorStatus);
				}
			} else if (req.body && req.body.garageSwitch == 'close') {
				if (iot.garageIsOpen()) {
					iot.toggleGarageDoor();
					garageOpenStatus = 'Closing...';
					video.updateGarageStatus(garageOpenStatus);
					io.sockets.emit('garageOpenStatus', garageOpenStatus);
					var msg = garageOpenStatus + ' garage via button';
					var btnPress = true;
					video
						.streamVideo()
						.then(() => {
							messenger.send(options.alertButtonPressTexts, messengerInfo.toNumbers, msg, options.openViaButtonAlertSendPictureText, btnPress);
						})
						.catch(() => {});
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
		} else {
			var garageStatus = 'hack';
			var hoursToWaitBeforeNextSecurityAlert = 2;

			if (req.body && req.body.garageSwitch == 'open') {
				garageStatus = 'open';
			} else if (req.body && req.body.garageSwitch == 'close') {
				garageStatus = 'close';
			}
			var securityMsg = 'SECURITY: tried to ' + garageStatus + ' garage via post without being authenticated!! From ip: ' + req.connection.remoteAddress;

			clearTimeout(securityMsgTimeout);
			securityMsgTimeout = setTimeout(function() {
				shouldSendSecurityAlert = true;
			}, hoursToWaitBeforeNextSecurityAlert * 60 * 60 * 10000);
			var btnPress = true;
			if (shouldSendSecurityAlert) {
				messenger.send(true, messengerInfo.toNumbers, securityMsg, options.alertSendPictureText, btnPress);
				shouldSendSecurityAlert = false;
			}
			logger.fatal(securityMsg, 'Ip address is: ', req.connection.remoteAddress);
			io.sockets.emit('garageErrorStatus', 'You are not authorized to do this!');
			res.status(401);
			res.send('not auth');
		}
	});

	app.get('/gpsOn/:gpsKey', function(req, res) {
		//away from home turn alert on
		if (req.params && req.params.gpsKey === login.gpsAlertKey) {
			iot.toggleGarageOpenAlert(true);
			logger.debug('/gpsOn/:gpsKey');
			messenger.sendGenericIfttt(`gpsPersonOneOn`);
			res.send('Ok');
		} else {
			logger.error('malformed request for /gpsOn');
			res.status(401);
			res.send('None shall pass');
		}
	});

	app.get('/gpsOff/:gpsKey', function(req, res) {
		//close to home turn alert off
		if (req.params && req.params.gpsKey === login.gpsAlertKey) {
			iot.toggleGarageOpenAlert(false);
			logger.debug('/gpsOff/:gpsKey');
			messenger.sendGenericIfttt(`gpsPersonOneOff`);
			res.send('Ok');
		} else {
			logger.error('malformed request for /gpsOff');
			res.status(401);
			res.send('None shall pass');
		}
	});

	app.get('/gpsPersonTwoOn/:gpsAlertPersonTwoKey', function(req, res) {
		//away from home turn alert on
		if (req.params && req.params.gpsAlertPersonTwoKey === login.gpsAlertPersonTwoKey) {
			iot.toggleGarageOpenAlertSecondPerson(true);
			logger.debug('/gpsPersonTwoOn/:gpsAlertPersonTwoKey');
			messenger.sendGenericIfttt(`gpsPersonTwoOn`);
			res.send('Ok');
		} else {
			logger.error('malformed request for /gpsPersonTwoOn');
			res.status(401);
			res.send('None shall pass');
		}
	});

	app.get('/gpsPersonTwoOff/:gpsAlertPersonTwoKey', function(req, res) {
		//close to home turn alert off
		if (req.params && req.params.gpsAlertPersonTwoKey === login.gpsAlertPersonTwoKey) {
			iot.toggleGarageOpenAlertSecondPerson(false);
			logger.debug('/gpsPersonTwoOff/:gpsAlertPersonTwoKey');
			messenger.sendGenericIfttt(`gpsPersonTwoOff`);
			res.send('Ok');
		} else {
			logger.error('malformed request for /gpsPersonTwoOff');
			res.status(401);
			res.send('None shall pass');
		}
	});
};

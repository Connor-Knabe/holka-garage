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

module.exports = function(app, logger, io, debugMode) {
	const hue = require('../services/hue.js')(logger);
	const video = require('../services/video.js')(app, logger, io, hue, sockets);
	var messenger = require('../services/messenger.js')(logger, debugMode);
	var iot = require('../services/iot.js')(app, debugMode, io, logger, video, messenger, hue);
	const rp = require('request-promise');

	var securityMsgTimeout = null;
	var garageErrorStatus = null;
	var shouldSendSecurityAlert = true;

	var fs = require('fs');
	var bodyParser = require('body-parser');
	var login = require('../settings/login.js');

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
			io.sockets.emit('personTwoName', `${options.personTwoName}: `);
			if (personTwoAway) {
				io.sockets.emit('personTwoAway', `away`);
			} else {
				io.sockets.emit('personTwoAway', 'home');
			}
		}

		if (options.garageGpsEnabledPersonOne) {
			const timeAway = getTimeAway(personOneTime);
			io.sockets.emit('personOneTime', `${timeAway}`);
			io.sockets.emit('personOneName', `${options.personOneName}: `);
			if (personOneAway) {
				io.sockets.emit('personOneAway', `away`);
			} else {
				io.sockets.emit('personOneAway', 'home');
			}
		}

		const timeSinceReboot = getTimeAway(rebootTime);

		io.sockets.emit('rebootTime', timeSinceReboot);

		io.sockets.emit('garageTimer', `${options.minsToWaitAfterLeavingHouseForGPSOpen} mins`);

		if (app.get('takingVideo')) {
			io.sockets.emit('garageOpenStatus', 'Recording video');
		}

		socket.on('start-stream', function() {
			video.startStreaming(io);
		});
	});

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

	app.post('/', bodyParser.urlencoded({ extended: false }), function(req, res) {
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
		if (auth(req)) {
			if (options.garageGpsEnabledMain) {
				options.garageGpsEnabledMain = false;
			} else {
				options.garageGpsEnabledMain = true;
			}
			var garageGPSStatus = options.garageGpsEnabledMain ? 'enabled' : 'disabled';
			io.sockets.emit('garageGPSStatus', garageGPSStatus);
			res.send('Ok');
		} else {
			res.status(401);
			res.send('not auth');
		}
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

	app.post('/sms', bodyParser.urlencoded({ extended: false }), function(req, res) {
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

			var txtMsg = `Pausing home/away trigger for ${hoursToPause} hours`;
			messenger.send(true, alertInfo, txtMsg, false, true);
		} else if (msg.textMessage.toLowerCase().trim() == 'resume') {
			var txtMsg = 'Resuming home/away trigger';
			messenger.send(true, alertInfo, txtMsg, false, true);
		} else {
			var txtMsg = 'Unrecognized command: ' + msg.textMessage + '. Video, pause, stream, resume are the only recognized commands at the moment.';
			messenger.send(true, alertInfo, txtMsg, false, true);
		}

		res.status(204);
		res.send('No content');
	});

	app.post('/openViaGps', bodyParser.text(), function(req, res) {
		logger.debug('openViaGpsOne called');
		if (options.garageGpsEnabledPersonOne) {
			logger.debug('openViaGpsOne attempting to open');
			var isSecondPerson = false;
			iot.toggleGarageOpenAlert(false, isSecondPerson);
			setPersonOneHome();
			openViaGps(res, req, false);
		} else {
			logger.info('garage gps open is disabled for person one!');
			res.status(200);
			res.send('OK');
		}
	});

	app.post('/openViaGpsTwo', bodyParser.text(), function(req, res) {
		logger.debug('openViaGpsTwo called');
		if (options.garageGpsEnabledPersonTwo) {
			logger.debug('openViaGpsTwo attempting to open');
			var isSecondPerson = true;
			iot.toggleGarageOpenAlert(false, isSecondPerson);
			setPersonTwoHome();
			openViaGps(res, req, true);
		} else {
			logger.info('garage gps open is disabled for person two!');
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
		var gpsOpenKey = login.gpsPersonOneKey;
		var gpsPerson = 'one';
		if (two) {
			logger.debug('person two!');
			gpsOpenKey = login.gpsPersonTwoKey;
			gpsPerson = 'two';
		}

		logger.debug('open garage via gps');

		if (req.body && req.body.includes(gpsOpenKey)) {
			logger.debug('open garage via gps, correct key');

			if (options.garageGpsEnabledMain) {
				logger.debug('garageDoorOpenHandler');
				iot.garageDoorOpenHandler(two, gpsPerson, req.connection.remoteAddress);
			} else {
				messenger.sendGenericIfttt(`NOT opening GPS open disabled person:${gpsPerson}`);
			}

			res.status(200);
			res.send('OK');
		} else {
			const minsToWaitBeforeNextSecurityAlert = 5;
			possibleHackAlert('openViaGPS', req, minsToWaitBeforeNextSecurityAlert);

			logger.info(`Failed attempt to open garage for person ${gpsPerson} via gps from ip: ${req.connection.remoteAddress} with body of ${JSON.stringify(req.body)}, Possible Hack?`);
			res.status(401);
			res.send('not auth to open garage');
		}
	}

	app.post('/openOrCloseGarage', bodyParser.urlencoded({ extended: false }), function(req, res) {
		if (auth(req)) {
			if (req.body && req.body.garageSwitch == 'open') {
				if (!iot.garageIsOpen()) {
					iot.openCloseGarageDoor();
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
					iot.openCloseGarageDoor();
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
			const minsToWaitBeforeNextSecurityAlert = 5;
			if (req.body && req.body.garageSwitch == 'open') {
				garageStatus = 'open';
			} else if (req.body && req.body.garageSwitch == 'close') {
				garageStatus = 'close';
			}
			possibleHackAlert(garageStatus, req, minsToWaitBeforeNextSecurityAlert);
			io.sockets.emit('garageErrorStatus', 'You are not authorized to do this!');
			res.status(401);
			res.send('not auth');
		}
	});

	function possibleHackAlert(garageStatus, req, minsToWaitBeforeNextSecurityAlert) {
		var securityMsg = 'SECURITY: tried to ' + garageStatus + ' garage via post without being authenticated!! From ip: ' + req.connection.remoteAddress;

		clearTimeout(securityMsgTimeout);
		securityMsgTimeout = setTimeout(function() {
			shouldSendSecurityAlert = true;
		}, minsToWaitBeforeNextSecurityAlert * 60 * 10000);
		logger.fatal(securityMsg, 'Ip address is: ', req.connection.remoteAddress);

		if (shouldSendSecurityAlert) {
			var btnPress = true;
			messenger.send(true, messengerInfo.toNumbers, securityMsg, options.alertSendPictureText, btnPress);
			shouldSendSecurityAlert = false;
		}
	}

	app.post('/togglePersonOneHomeAway', bodyParser.urlencoded({ extended: false }), function(req, res) {
		if (auth(req)) {
			if (personOneAway) {
				setPersonOneHome(res);
			} else {
				const isPersonTwo = false;
				setPersonAway(req, res, isPersonTwo);
			}
		} else {
			res.status(401);
			res.send('not auth');
		}
	});

	app.post('/togglePersonTwoHomeAway', bodyParser.urlencoded({ extended: false }), function(req, res) {
		if (auth(req)) {
			if (personTwoAway) {
				setPersonTwoHome(res);
			} else {
				const isPersonTwo = true;
				setPersonAway(req, res, isPersonTwo);
			}
		} else {
			res.status(401);
			res.send('not auth');
		}
	});

	app.post('/personOneAway', bodyParser.text(), function(req, res) {
		//away from home turn alert on
		const isPersonTwo = false;
		var gpsKey = isPersonTwo ? login.gpsPersonTwoKey : login.gpsPersonOneKey;
		var personText = isPersonTwo ? 'personTwo' : 'personOne';
		if (req.body && req.body.includes(gpsKey)) {
			setPersonAway(req, res, isPersonTwo);
		} else {
			logger.error(`malformed request for ${personText}Away or wrong key`);
			res.status(401);
			res.send('None shall pass');
		}
	});

	app.post('/personTwoAway', bodyParser.text(), function(req, res) {
		//away from home turn alert on
		const isPersonTwo = true;
		var gpsKey = isPersonTwo ? login.gpsPersonTwoKey : login.gpsPersonOneKey;
		var personText = isPersonTwo ? 'personTwo' : 'personOne';

		if (req.body && req.body.includes(gpsKey)) {
			setPersonAway(req, res, isPersonTwo);
		} else {
			logger.error(`malformed request for ${personText}Away or wrong key`);
			res.status(401);
			res.send('None shall pass');
		}
	});

	function setPersonAway(req, res, isPersonTwo) {
		var personName = isPersonTwo ? options.personTwoName : options.personOneName;
		var personText = isPersonTwo ? 'personTwo' : 'personOne';

		if (isPersonTwo) {
			personTwoAway = true;
			personTwoTime = new Date();
			const timeAway = getTimeAway(personTwoTime);
			io.sockets.emit('personTwoTime', `${timeAway}`);
			io.sockets.emit('personTwoAway', 'away');
		} else {
			personOneAway = true;
			personOneTime = new Date();
			const timeAway = getTimeAway(personOneTime);
			io.sockets.emit('personOneTime', `${timeAway}`);
			io.sockets.emit('personOneAway', 'away');
		}

		if (personOneAway && personTwoAway) {
			messenger.sendIftt(null, 'set away', messengerInfo.iftttGarageSetAwayUrl);
		}

		iot.toggleGarageOpenAlert(true, isPersonTwo);
		logger.debug(`Garage set to away via ${personText}`);
		messenger.sendGenericIfttt(`${personName} Set to Away`);
		res.send('Ok');
	}
	function getTimeAway(startDate) {
		var minsBetweenDates = 0;
		const curDate = new Date();

		if (startDate && curDate) {
			var diff = curDate.getTime() - startDate.getTime();
			minsBetweenDates = Math.floor(diff / 60000);
		}

		var timeAway;
		var hours = Math.floor(minsBetweenDates / 60);

		if (hours > 24) {
			var days = Math.floor(hours / 24);
			timeAway = `for ${days} day(s) ${hours} hrs`;
		} else {
			timeAway = hours >= 2 ? `for ${hours} hours` : `for ${minsBetweenDates} mins`;
		}

		return timeAway;
	}

	function setPersonOneHome(res) {
		personOneAway = false;
		personOneTime = new Date();
		io.sockets.emit('personOneAway', 'home');
		const timeAway = getTimeAway(personOneTime);
		io.sockets.emit('personOneTime', `${timeAway}`);
		messenger.sendIftt(null, 'set home', messengerInfo.iftttGarageSetHomeUrl);
		messenger.sendGenericIfttt(`${options.personOneName} Set to Home`);
		res.send('Ok');
	}

	function setPersonTwoHome(res) {
		personTwoAway = false;
		personTwoTime = new Date();
		io.sockets.emit('personTwoAway', 'home');
		const timeAway = getTimeAway(personOneTime);
		io.sockets.emit('personTwoTime', `${timeAway}`);
		messenger.sendIftt(null, 'set home', messengerInfo.iftttGarageSetHomeUrl);
		messenger.sendGenericIfttt(`${options.personTwoName} Set to Home`);
		res.send('Ok');
	}
};

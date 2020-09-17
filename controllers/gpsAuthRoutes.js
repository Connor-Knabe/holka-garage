var messengerInfo = require('../settings/messengerInfo.js');
var options = require('../settings/options.js');

var personOneAway = false;
var personTwoAway = false;
var personOneTime = new Date();
var personTwoTime = new Date();

module.exports = function(app, logger, io, iot, sockets) {
	var securityMsgTimeout = null;
	var shouldSendSecurityAlert = true;

	var bodyParser = require('body-parser');
	var login = require('../settings/login.js');

	app.post('/openViaGps', bodyParser.text(), function(req, res) {
		if (options.garageGpsEnabledPersonOne) {
			logger.debug('openViaGpsOne attempting to open');
			var isSecondPerson = false;
			iot.activateGarageGpsOpenAwayTimer(isSecondPerson);
			openViaGps(res, req, false);
			setPersonOneHome();
		} else {
			logger.info('garage gps open is disabled for person one!');
			res.status(200);
			res.send('OK');
		}
	});

	app.post('/openViaGpsTwo', bodyParser.text(), function(req, res) {
		if (options.garageGpsEnabledPersonTwo) {
			logger.debug('openViaGpsTwo attempting to open');
			var isSecondPerson = true;
			iot.activateGarageGpsOpenAwayTimer(isSecondPerson);
			openViaGps(res, req, true);
			setPersonTwoHome();
		} else {
			logger.info('garage gps open is disabled for person two!');
			res.status(200);
			res.send('OK');
		}
	});

	function openViaGps(res, req, two) {
		var gpsOpenKey = login.gpsPersonOneKey;
		var gpsPerson = 'one';

		if (two) {
			logger.debug('person two!');
			gpsOpenKey = login.gpsPersonTwoKey;
			gpsPerson = 'two';
			if (!personTwoAway) {
				logger.debug(`person two already home not opening garage!`);
				res.status(200);
				res.send('OK');
				return;
			}
		} else {
			if (!personOneAway) {
				logger.debug(`person one already home not opening garage!`);
				res.status(200);
				res.send('OK');
				return;
			}
		}

		logger.debug(`open garage via gps ${gpsPerson}`);

		if (req.body && req.body.includes(gpsOpenKey)) {
			if (options.garageGpsEnabledMain) {
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

	function possibleHackAlert(garageStatus, req, minsToWaitBeforeNextSecurityAlert) {
		var securityMsg = 'SECURITY: tried to ' + garageStatus + ' garage via post without being authenticated!! From ip: ' + req.connection.remoteAddress;

		clearTimeout(securityMsgTimeout);
		securityMsgTimeout = setTimeout(function() {
			shouldSendSecurityAlert = true;
		}, minsToWaitBeforeNextSecurityAlert * 60 * 1000);
		logger.fatal(securityMsg, 'Ip address is: ', req.connection.remoteAddress);

		if (shouldSendSecurityAlert) {
			var btnPress = true;
			messenger.send(true, messengerInfo.toNumbers, securityMsg, options.alertSendPictureText, btnPress);
			shouldSendSecurityAlert = false;
		}
	}

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
		var personName = isPersonTwo ? login.users[1].name : login.users[0].name;
		var personText = isPersonTwo ? 'personTwo' : 'personOne';

		if (isPersonTwo) {
			iot.setHome(true, true);

			personTwoAway = true;
			personTwoTime = new Date();
			const timeAway = getTimeAway(personTwoTime);
			io.sockets.emit('personTwoTime', `${timeAway}`);
			io.sockets.emit('personTwoAway', 'away');
		} else {
			iot.setHome(false, true);
			personOneAway = true;
			personOneTime = new Date();
			const timeAway = getTimeAway(personOneTime);
			io.sockets.emit('personOneTime', `${timeAway}`);
			io.sockets.emit('personOneAway', 'away');
		}

		if (personOneAway && personTwoAway) {
			messenger.sendGenericIfttt(`Home going to sleep as both home owners are away`);
			messenger.sendIftt(null, 'set away', messengerInfo.iftttGarageSetAwayUrl);
		}

		iot.activateGarageGpsOpenAwayTimer(isPersonTwo);
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

		if (hours >= 24) {
			var days = Math.floor(hours / 24);
			hours = hours - days * 24;
			timeAway = `for ${days} day(s) ${hours} hrs`;
		} else {
			timeAway = hours >= 2 ? `for ${hours} hours` : `for ${minsBetweenDates} mins`;
		}

		return timeAway;
	}

	function setPersonOneHome() {
		iot.setHome(false, false);
		personOneAway = false;
		personOneTime = new Date();
		io.sockets.emit('personOneAway', 'home');
		const timeAway = getTimeAway(personOneTime);
		io.sockets.emit('personOneTime', `${timeAway}`);
		messenger.sendIftt(null, 'set home', messengerInfo.iftttGarageSetHomeUrl);
		messenger.sendGenericIfttt(`${login.users[0].name} Set to Home`);
	}

	function setPersonTwoHome() {
		iot.setHome(true, false);
		personTwoAway = false;
		personTwoTime = new Date();
		io.sockets.emit('personTwoAway', 'home');
		const timeAway = getTimeAway(personOneTime);
		io.sockets.emit('personTwoTime', `${timeAway}`);
		messenger.sendIftt(null, 'set home', messengerInfo.iftttGarageSetHomeUrl);
		messenger.sendGenericIfttt(`${login.users[1].name} Set to Home`);
	}
};

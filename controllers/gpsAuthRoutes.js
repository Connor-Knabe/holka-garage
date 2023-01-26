var messengerInfo = require('../settings/messengerInfo.js');
var options = require('../settings/options.js');


module.exports = function(app, logger, messenger, homeAway, bodyParser, iot) {

	var securityMsgTimeout = null;
	var shouldSendSecurityAlert = true;

	var login = require('../settings/login.js');

	app.post('/openViaGps', bodyParser.json(), function(req, res) {
		if (options.garageGpsEnabledPersonOne) {
			logger.debug('openViaGpsOne attempting to open');
			var isSecondPerson = false;
			iot.activateGarageGpsOpenAwayTimer(isSecondPerson);
			openViaGps(res, req, false);
			homeAway.setPersonOneHome();
		} else {
			logger.info('garage gps open is disabled for person one!');
			res.status(200);
			res.send('OK');
		}
	});

	app.post('/openViaGpsTwo', bodyParser.json(), function(req, res) {
		if (options.garageGpsEnabledPersonTwo) {
			logger.debug('openViaGpsTwo attempting to open');
			var isSecondPerson = true;
			iot.activateGarageGpsOpenAwayTimer(isSecondPerson);
			openViaGps(res, req, true);
			homeAway.setPersonTwoHome();
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
			var isPersonTwo = true;
			

			if (!homeAway.isPersonAway(isPersonTwo)) {
				var msg = `person two already home not opening garage!`
				messenger.sendGenericIfttt(msg);
				logger.debug(msg);
				res.status(200);
				res.send('OK');
				return;
			}
		} else {
			var isPersonTwo = false;

			if (!homeAway.isPersonAway(isPersonTwo)) {
				var msg = `person one already home not opening garage!`
				messenger.sendGenericIfttt(msg);
				logger.debug(msg);
				res.status(200);
				res.send('OK');
				return;
			}
		}

		logger.debug(`open garage via gps ${gpsPerson}`);
		if (req.body && req.body.Key && req.body.Key.includes(gpsKey)) {
			if (options.garageGpsEnabledMain) {
				iot.garageDoorOpenHandler(two, gpsPerson, req.connection.remoteAddress);
			} else {
				messenger.sendGenericIfttt(`NOT opening GPS open disabled person:${gpsPerson}`);
			}

			res.status(200);
			res.send('OK');
		} else {
			possibleHackAlert('openViaGPS', req, options.minsToWaitBeforeNextSecurityAlert);

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
			messenger.send(true, messengerInfo.alertNumbers, securityMsg, options.alertSendPictureText, btnPress);
			shouldSendSecurityAlert = false;
		}
	}
	

	app.post('/personOneAway', bodyParser.json(), function(req, res) {
		//away from home turn alert on
		const isPersonTwo = false;
		var gpsKey = isPersonTwo ? login.gpsPersonTwoKey : login.gpsPersonOneKey;
		var personText = isPersonTwo ? 'personTwo' : 'personOne';
		// logger.debug('req.body', req.body.Key);
		if (req.body && req.body.Key && req.body.Key.includes(gpsKey)) {
			homeAway.setPersonAway(isPersonTwo);
			iot.activateGarageGpsOpenAwayTimer(isPersonTwo);
			const garageStatus = iot.getGarageStatus();
			res.send(garageStatus);
		} else {
			logger.error(`malformed request for ${personText}Away or wrong key`);
			res.status(401);
			res.send('None shall pass');
		}
	});

	app.post('/personTwoAway', bodyParser.json(), function(req, res) {
		//away from home turn alert on
		const isPersonTwo = true;
		var gpsKey = isPersonTwo ? login.gpsPersonTwoKey : login.gpsPersonOneKey;
		var personText = isPersonTwo ? 'personTwo' : 'personOne';

		if (req.body && req.body.Key && req.body.Key.includes(gpsKey)) {
			homeAway.setPersonAway(isPersonTwo);
			iot.activateGarageGpsOpenAwayTimer(isPersonTwo);
			const garageStatus = iot.getGarageStatus();
			res.send(garageStatus);
		} else {
			logger.error(`malformed request for ${personText}Away or wrong key`);
			res.status(401);
			res.send('None shall pass');
		}
	});
	
};

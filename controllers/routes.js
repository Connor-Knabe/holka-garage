var options = require('../settings/options.js');

var personOneTime = new Date();
var personTwoTime = new Date();
const rebootTime = new Date();

module.exports = function(app, logger, io, video, authService, homeAway, bodyParser, iot, sockets) {
	const hue = require('../services/hue.js')(logger);
	var login = require('../settings/login.js');
	const httpReq = require('../services/httpReq.js')(logger);

	io.on('connection', async function(socket) {
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

		io.sockets.emit('toggleGarageStillOpenAlert', iot.getTemporaryDisableGarageStillOpenAlertStatus());
		io.sockets.emit('toggleGuestIsHome', iot.getTemporaryGuestIsHomeStatus());
		io.sockets.emit('garageLightStatus', null);

	

		if (options.garageGpsEnabledPersonTwo) {
			var personTwo = true;
			personTwoTime = homeAway.getPersonTime(personTwo)
			const timeAway = homeAway.getTimeAway(personTwoTime);
			io.sockets.emit('personTwoTime', `${timeAway}`);
			io.sockets.emit('personTwoName', `${login.users[1].name}: `);
			if (homeAway.isPersonAway(personTwo)) {
				io.sockets.emit('personTwoAway', `away`);
			} else {
				io.sockets.emit('personTwoAway', 'home');
			}
		}

		if (options.garageGpsEnabledPersonOne) {
			var personTwo = false;
			personOneTime = homeAway.getPersonTime(personTwo)
			const timeAway = homeAway.getTimeAway(personOneTime);
			io.sockets.emit('personOneTime', `${timeAway}`);
			io.sockets.emit('personOneName', `${login.users[0].name}: `);
			var personTwo = false;
			if (homeAway.isPersonAway(personTwo)) {
				io.sockets.emit('personOneAway', `away`);
			} else {
				io.sockets.emit('personOneAway', 'home');
			}

			io.sockets.emit('whoOpenedGarageLast', homeAway.Status.whoOpenedGarageLast);
			io.sockets.emit('whoClosedGarageLast', homeAway.Status.whoClosedGarageLast);
			io.sockets.emit('garageOpenCount', iot.getGarageOpenCount())
			io.sockets.emit('springLifeRemaining', iot.getSpringLifeRemaining());
		}

		const timeSinceReboot = homeAway.getTimeAway(rebootTime);

		io.sockets.emit('rebootTime', timeSinceReboot);

		io.sockets.emit('garageTimer', `${options.minsToWaitAfterLeavingHouseForGPSOpen} mins`);

		io.sockets.emit('stillOpenAlert', `${options.garageStillOpenAlertDisableForHours} hours`);

		io.sockets.emit('guestIsHome', `${options.guestIsHomeEnableForHours} hours`);


		io.sockets.emit('garageLastOpenedTime', iot.getGarageLastOpenedTime());
		io.sockets.emit('garageLastClosedTime', iot.getGarageLastClosedTime());
		
		var shouldOpenGarageBaesdOnRules = iot.shouldOpenGarageBaesdOnRules() ? "Yes" : "No";
		io.sockets.emit('shouldOpenGarageBaesdOnRules', shouldOpenGarageBaesdOnRules);

		if (app.get('takingVideo')) {
			io.sockets.emit('garageOpenStatus', 'Recording video');
		}

		socket.on('start-stream', function() {
			video.startStreaming(io);
		});

		if(options.automatedHueHome){
			logger.debug('emitting automated hue home');
			var automationDisabledUntilTime = await httpReq.automationDisabledUntilTime();
			logger.debug("automated hue home enabled in routes", automationDisabledUntilTime);
			if(!automationDisabledUntilTime){
				logger.debug("set to enabled");
				io.sockets.emit('toggleAutomatedHueHome',`Light automation is Enabled`);
			} else {
				logger.debug("set to disabled");
				io.sockets.emit('toggleAutomatedHueHome',`Light automation is Disabled until ${automationDisabledUntilTime.toLocaleTimeString()}`);
			}
		}
	});

	app.get('/', function(req, res) {
		if (authService.auth(req)) {
			res.sendFile('admin.html', { root: './views/' });
		} else {
			res.sendFile('index.html', { root: './views/' });
		}
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

	function isValidLogin(username, password) {
		var user = null;
		login.users.forEach((userLogin) => {
			if (userLogin.username.toLowerCase() === username.toLowerCase() && userLogin.password === password) {
				user = userLogin;
			}
		});
		return user;
	}

};

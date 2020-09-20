module.exports = function(logger, login, messengerInfo, options, messenger) {

	var securityMsgTimeout = null;
	var shouldSendSecurityAlert = true;


	function auth(req) {
		var user = null;
		if (req && req.cookies) {
			login.users.forEach((userLogin) => {
				if (userLogin.secretCookie === req.cookies.holkaCookie) {
					user = userLogin;
				}
			});
		}
		if (!user) {
			logger.info('unauthorized request for ', req.path);
		}
		return user;
	}

	function authChecker(req, res, next) {
		var redirectToUrl = req.originalUrl ? req.originalUrl : '/';
		req.session.redirectTo = redirectToUrl;
		if (auth(req)) {
			next();
		} else if (req.path.toLowerCase().includes('open')) {
			var garageStatus = 'hack';
			const minsToWaitBeforeNextSecurityAlert = 5;
			if (req.body && req.body.garageSwitch == 'open') {
				garageStatus = 'open';
			} else if (req.body && req.body.garageSwitch == 'close') {
				garageStatus = 'close';
			}
			possibleHackAlert(garageStatus, req, minsToWaitBeforeNextSecurityAlert);
			res.status(401);
			res.send('not auth');
		} else {
			res.status(401);
			res.redirect('/');
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

	return {
		auth: auth,
		authChecker: authChecker
	};
};

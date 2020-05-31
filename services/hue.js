var login = require('../settings/login.js'),
	hue = require('node-hue-api'),
	options = require('../settings/options.js');

var HueApi = hue.HueApi,
	lightState = hue.lightState,
	host = options.hueBridgeIp,
	username = options.hueUser,
	api = new HueApi(host, username),
	state = lightState.create(),
	lightsOffTimeout = null,
	lightsOffTimedTimeout = null;

module.exports = function(logger) {
	function garageLightsOnTimed(brightness) {
		if (options.enableHue) {
			lightsOn(brightness).then(() => {}).catch(() => {});
			logger.debug('Lights on for ' + options.garageLightTimeoutMins + ' mins');
			clearTimeout(lightsOffTimeout);
			lightsOffTimeout = setTimeout(function() {
				lightsOff();
			}, options.garageLightTimeoutMins * 60 * 1000);
		}
	}

	function garageLightsOffTimed() {
		if (options.enableHue) {
			clearTimeout(lightsOffTimedTimeout);
			lightsOffTimedTimeout = setTimeout(function() {
				lightsOff();
			}, options.garageLightTimeoutMins * 60 * 1000);
		}
	}

	function lightsOn(brightness) {
		if (options.enableHue) {
			return new Promise((resolve, reject) => {
				api
					.setGroupLightState(8, state.on().brightness(brightness))
					.then(() => {
						resolve();
					})
					.catch((e) => {
						logger.error(`Error setting light brightness ${e}`);
						reject();
					});
			});
		}
	}

	function lightsOff() {
		api.setGroupLightState(8, state.off()).then(() => {}).catch(() => {});
	}

	return {
		lightsOn: lightsOn,
		garageLightsOnTimed: garageLightsOnTimed,
		garageLightsOffTimed: garageLightsOffTimed
	};
};

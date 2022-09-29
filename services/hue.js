
var options = require('../settings/options.js');
const messengerInfo = require('../settings/messengerInfo.js');



if(!options.localDebug){
	var v3 = require('node-hue-api').v3, 
	host = options.hueBridgeIp,
	username = options.hueUser,
	lightsOffTimeout = null,
	lightsOffTimedTimeout = null,
	GroupLightState = v3.model.lightStates.GroupLightState;

	var api = null;
	(async function() {
		api = await v3.api.createLocal(host).connect(username);
	})();
}


module.exports = function(logger,messenger) {

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
		messenger.requestIfttt(options.garageLightsOnUrl, messengerInfo.iftttRecipients[0].ApiKey, "", "");
	}

	function lightsOff() {
		messenger.requestIfttt(options.garageLightsOnUrl, messengerInfo.iftttRecipients[0].ApiKey, "", "");
	}

	return {
		lightsOn: lightsOn,
		garageLightsOnTimed: garageLightsOnTimed,
		garageLightsOffTimed: garageLightsOffTimed
	};
};

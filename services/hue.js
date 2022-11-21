
var options = require('../settings/options.js');
const messengerInfo = require('../settings/messengerInfo.js');

if(!options.localDebug){
	// var v3 = require('node-hue-api').v3, 
	var host = options.hueBridgeIp,
	username = options.hueUser,
	lightsOffTimeout = null,
	lightsOffTimedTimeout = null;
	// GroupLightState = v3.model.lightStates.GroupLightState;

	// var api = null;
	// (async function() {
	// 	api = await v3.api.createLocal(host).connect(username);
	// })();
}


module.exports = function(logger,messenger) {

	function garageLightsOnTimed() {
		if (options.enableHue) {
			lightsOn();
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

	function lightsOn() {
		messenger.requestIfttt(messengerInfo.garageLightsOnUrl, messengerInfo.iftttRecipients[0].ApiKey, "", "");
	}

	function lightsOff() {
		//fix bug
		messenger.requestIfttt(messengerInfo.garageLightsOffUrl, messengerInfo.iftttRecipients[0].ApiKey, "", "");
	}

	return {
		lightsOn: lightsOn,
		garageLightsOnTimed: garageLightsOnTimed,
		garageLightsOffTimed: garageLightsOffTimed
	};
};


var options = require('../settings/options.js');

var v3 = require('node-hue-api').v3, 
	host = options.hueBridgeIp,
	username = options.hueUser,
	lightsOffTimeout = null,
	lightsOffTimedTimeout = null,
	GroupLightState = v3.model.lightStates.GroupLightState;
	


module.exports = async function(logger) {
	const api = await v3.api.createLocal(host).connect(username);

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

		api.groups.getAll()
		.then(allGroups => {
			// Display the groups from the bridge
			allGroups.forEach(group => {
			console.log(group.toStringDetailed());
			});
		});

		
		if (options.enableHue) {
			return new Promise((resolve, reject) => {
				api.groups.setGroupState(8, new GroupLightState().on().brightness(brightness))
					.then(() => {
						logger.info('turned on lights successfully');
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

		
		api.groups.setGroupLightState(8, new GroupLightState().off()).then(() => {}).catch(() => {});
	}


	//refactor into separate app
	function temporarilyDisableLRMotionSensor(){

	}

	function temporarilyDisableSchedule(){

	}

	return {
		lightsOn: lightsOn,
		garageLightsOnTimed: garageLightsOnTimed,
		garageLightsOffTimed: garageLightsOffTimed
	};
};

var login = require('../settings/login.js');

var hue = require("node-hue-api"),
    HueApi = hue.HueApi,
    lightState = hue.lightState;


var host = "192.168.0.154",
    username = login.hueUser,
    api = new HueApi(host, username),
    state = lightState.create();


var lightsOffTimeout = null;

module.exports = function(logger) {
	function garageLightsOn15(){
		lightsOn();
		logger.debug('Lights on for '+login.garageLightTimeoutMins+' mins');

		clearTimeout(lightsOffTimeout);
		lightsOffTimeout = setTimeout(function(){
			lightsOff();
		}, login.garageLightTimeoutMins*60*1000);			
	}
	
	function garageLightsOnOff(toggleOn){
		
		if(toggleOn){
			lightsOn();
			logger.debug('lights on');
		} else {
			lightsOff();
			logger.debug('lights off');
		}
			
	}

	var displayResult = function(result) {
    	logger.debug(result);
	};
	
	var displayError = function(err) {
	    logger.error(err);
	};
	
	function lightsOn(){
		api.setGroupLightState(2, state.on())
			.then()
		    .fail(displayError)
		    .done();
	}

	function lightsOff(){
		api.setGroupLightState(2, state.off())
			.then()
		    .fail(displayError)
		    .done();
	}
	
	return {
		garageLightsOnOff: garageLightsOnOff,
		garageLightsOn15:garageLightsOn15
	}

}

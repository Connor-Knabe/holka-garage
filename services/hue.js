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
    function garageLightsOnTimed() {
        if (options.enableHue) {
            lightsOn();
            logger.debug(
                'Lights on for ' + options.garageLightTimeoutMins + ' mins'
            );
            clearTimeout(lightsOffTimeout);
            lightsOffTimeout = setTimeout(function() {
                lightsOff();
            }, options.garageLightTimeoutMins * 60 * 1000);
        }
    }

    function garageLightsOnOff(toggleOn) {
        if (options.enableHue) {
            if (toggleOn) {
                lightsOn();
                logger.debug('lights on');
            } else {
                lightsOff();
                logger.debug('lights off');
            }
        }
    }

    var displayResult = function(result) {
        logger.debug(result);
    };

    function garageLightsOffTimed() {
        logger.debug(
            `Lights turning off in ${options.garageLightTimeoutMins} mins`
        );
        clearTimeout(lightsOffTimedTimeout);
        lightsOffTimedTimeout = setTimeout(function() {
            lightsOff();
        }, options.garageLightTimeoutMins * 60 * 1000);
    }

    function garageLightsOnOff(toggleOn) {
        if (toggleOn) {
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

    function lightsOn() {
        api.setGroupLightState(8, state.on().brightness(100)).then();
    }

    function lightsOff() {
        api.setGroupLightState(8, state.off()).then();
    }

    return {
        garageLightsOnOff: garageLightsOnOff,
        garageLightsOnTimed: garageLightsOnTimed,
        garageLightsOffTimed: garageLightsOffTimed
    };
};

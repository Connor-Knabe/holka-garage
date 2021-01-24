const got = require('got');
const options = require('../settings/options.js');

module.exports = function(logger) {

	function getAutomatedHueStatus() {
        (async () => {
            try {
                const response = await got(options.automatedHueHomeUrl+'/sensorScheduleStatus');
                console.log(response.body);
                return response.body;
            } catch (error) {
                logger.error(error.response.body);
            }
        })();
	}

    function setAutomatedHueDisableLights() {
        (async () => {
            try {
                const {body} = await got.post(options.automatedHueHomeUrl+'/disableSchedulesAndSensors', {
					responseType: 'json'
				});
                console.log(response.body);
                return response.body;
            } catch (error) {
                logger.error(error.response.body);
            }
        })();
	}

    function setAutomatedHueEnableLights() {
        (async () => {
            try {
                const {body} = await got.post(options.automatedHueHomeUrl+'/enableSchedulesAndSensors', {
					responseType: 'json'
				});
                console.log(response.body);
                return response.body;
            } catch (error) {
                logger.error(error.response.body);
            }
        })();
	}

	return {
		getAutomatedHueStatus: getAutomatedHueStatus,
        setAutomatedHueDisableLights:setAutomatedHueDisableLights,
        setAutomatedHueEnableLights:setAutomatedHueEnableLights
	};
};

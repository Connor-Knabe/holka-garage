const got = require('got');
const options = require('../settings/options.js');

module.exports = function(logger) {
	async function getAutomatedHueStatus() {
        await (async () => {
            try {
                const response = await got(options.automatedHueHomeUrl+'/sensorScheduleStatus');
                logger.debug('sensorschedule status', response.body);
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
                logger.debug("setAutomatedHueDisableLights success");
            } catch (error) {
                logger.error(error);
            }
        })();
	}

    function setAutomatedHueEnableLights() {
        (async () => {
            try {
                const {body} = await got.post(options.automatedHueHomeUrl+'/enableSchedulesAndSensors', {
					responseType: 'json'
				});
                console.log("setAutomatedHueEnableLights success");
            } catch (error) {
                logger.error(error);
            }
        })();
	}

	return {
		getAutomatedHueStatus: getAutomatedHueStatus,
        setAutomatedHueDisableLights:setAutomatedHueDisableLights,
        setAutomatedHueEnableLights:setAutomatedHueEnableLights
	};
};

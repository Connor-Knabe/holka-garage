const got = require('got');
const options = require('../settings/options.js');

module.exports = function(logger) {
	async function automationDisabledUntilTime() {
        try {
            const response = await got(options.automatedHueHomeUrl+'/sensorScheduleStatus');
            logger.debug('sensorschedule status', response);
            if (response){
                response = new Date(response);
            }
            return response;
        } catch (error) {
            logger.error(error.response.body);
        }
	}

    async function setAutomatedHueDisableLights() {
            try {
                const {body} = await got.post(options.automatedHueHomeUrl+'/disableSchedulesAndSensors', {
					responseType: 'json'
				});
                logger.debug("setAutomatedHueDisableLights success");
            } catch (error) {
                logger.error(error);
            }
	}

    async function setAutomatedHueEnableLights() {
            try {
                const {body} = await got.post(options.automatedHueHomeUrl+'/enableSchedulesAndSensors', {
					responseType: 'json'
				});
                console.log("setAutomatedHueEnableLights success");
            } catch (error) {
                logger.error(error);
            }
	}

	return {
		automationDisabledUntilTime: automationDisabledUntilTime,
        setAutomatedHueDisableLights:setAutomatedHueDisableLights,
        setAutomatedHueEnableLights:setAutomatedHueEnableLights
	};
};

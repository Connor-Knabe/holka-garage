const got = require('got');
const options = require('../settings/options.js');

module.exports = function(logger) {
	async function automationDisabledUntilTime() {
        try {
            var response = await got(options.automatedHueHomeUrl+'/sensorScheduleStatus');
            var disabledUntilDate = null;
            if (response && response.body){
                logger.debug('sensorschedule status', response.body);
                disabledUntilDate = new Date(response.body);
            }
            return disabledUntilDate;
        } catch (error) {
            logger.error(error);
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

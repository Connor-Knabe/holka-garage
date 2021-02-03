const got = require('got');
const options = require('../settings/options.js');

module.exports = function(logger) {
	async function automationDisabledUntilTime() {
        var disabledUntilDate = null;
        try {
            var response = await got(options.automatedHueHomeUrl+'/sensorScheduleStatus');
            if (response && response.body){
                logger.debug('sensorschedule status', response.body);
                logger.debug("test", new Date(""2021-02-03T17:00:05.321Z""));
                disabledUntilDate = new Date(response.body);
                logger.debug('disabled until date', disabledUntilDate);
            }
        } catch (error) {
            logger.error(error);
        }
        return disabledUntilDate;

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

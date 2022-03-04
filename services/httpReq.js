const got = require('got');
const options = require('../settings/options.js');

module.exports = function(logger) {
	async function automationDisabledUntilTime() {
        var disabledUntilDate = null;
        try {
            var response = await got(options.automatedHueHomeUrl+'/sensorScheduleStatus');
            if (response && response.body){
                logger.debug("date");
                logger.debug(response.body);
                var dateToSet = response.body;
                logger.debug('sensorschedule status', dateToSet);
                disabledUntilDate = new Date(dateToSet);
                logger.debug('disabled until date1', disabledUntilDate);
            }
        } catch (error) {
            logger.debug("error parsing date",  error);
            logger.error(error);
        }
        return disabledUntilDate;

	}

    async function setAutomatedHueDisableLights() {
        var dateRes = null;
            try {
                var response = await got.post(options.automatedHueHomeUrl+'/disableSchedulesAndSensors');

                if (response && response.body){
                    logger.debug('setAutomatedHueDisableLights status', response.body);
                    disabledUntilDate = new Date(response.body);
                    logger.debug('disabled until date2', disabledUntilDate);
                    dateRes = disabledUntilDate;
                }
                
                logger.debug("setAutomatedHueDisableLights success");
            } catch (error) {
                logger.error(error);
            }
            return dateRes;
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

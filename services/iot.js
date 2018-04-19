const Gpio = require('onoff').Gpio;
const path = require('path');

const motionSensor = new Gpio(15, 'in', 'both');
const garageSensor = new Gpio(4, 'in', 'both');
const garageSwitch = new Gpio(21, 'out');

var garageTimeout = null,
    motionSensorTimeoutOne = null,
    motionSensorTimeoutTwo = null,
    hasTurnedLightsOn = false,
    shouldSendGarageDoorAlertOne = true,
    shouldSendGarageDoorAlertTwo = true,
    garageSensorTimeoutOne = null,
    garageSensorTimeoutTwo = null,
    garageOpened = false,
    garageOpenAlertTimeout = null,
    garageOpenAlertMessageTimeout = null,
    garageOpenAlertEnabled,
    garageOpenAlertManualEnable = true;

module.exports = function (app, debugMode, io, logger) {
    var hasBeenOpened = garageIsOpen();
    const messenger = require('./messenger.js')(logger, debugMode);
    const messengerInfo = require('../settings/messengerInfo.js');
    const options = require('../settings/options.js');
    const hue = require('./hue.js')(logger);
    const video = require('./video.js')(app, logger, io);
    app.set('takingVideo', false);

    garageSensor.watch(function (err, value) {
        if (err) {
            logger.error('Error watching garage sensor: ', err);
        }
        if (value == 1 && !hasBeenOpened) {
            hasBeenOpened = true;
            garageOpened = true;
            var msg = 'Garage door opened';
            if (options.enableLightsOnGarageOpen) {
                hue.garageLightsOnTimed();
            }
            clearTimeout(garageSensorTimeoutOne);
            garageSensorTimeoutOne = setTimeout(() => {
                shouldSendGarageDoorAlertOne = true;
            }, 1 * 60 * 10000);
            logger.debug('garage open');
            clearTimeout(garageOpenAlertTimeout);
            garageOpenAlertTimeout = setTimeout(() => {
                if (garageIsOpen()) {
                    garageOpenAlertMessageTimeout = setTimeout(() => {
                        var garageAlertMsg = `Garage has been open for more than: ${options.garageOpenAlertMins} minutes!`;
                        logger.debug(garageAlertMsg);
                        if (options.garageOpenMinsAlert) {
                            logger.debug(garageAlertMsg);
                            video.streamVideo().then(() => {
                                messenger.send(options.alertButtonPressTexts, messengerInfo.toNumbers, garageAlertMsg,
                                    options.alertSendPictureText, true);
                                video.stopStreaming();

                            }).catch(() => {
                                garageAlertMsg = `Garage has been open for more than: ${options.garageOpenAlertMins} minutes! Error taking new video.`;
                                messenger.send(options.alertButtonPressTexts, messengerInfo.toNumbers, garageAlertMsg,
                                    options.alertSendPictureText, true);
                                video.stopStreaming();

                            });
                        }
                        messenger.sendIfttGarageOpenedAlert(options.iftttSendGarageOpenAlert, options.garageOpenAlertMins);
                    }, 30 * 1000);
                }
            }, options.garageOpenAlertMins * 60 * 1000);

            if (shouldSendGarageDoorAlertOne && garageOpenAlertManualEnable) {
                if (options.alertButtonPressTexts) {
                    messenger.send(true, messengerInfo.toNumbers, msg, false, false);
                }
                messenger.sendIftt(garageOpened);
                shouldSendGarageDoorAlertOne = false;
            }
            logger.debug(msg);
            io.sockets.emit('garageErrorStatus', null);
        } else if (value == 0 && hasBeenOpened) {
            hasBeenOpened = false;
            garageOpened = false;
            var msg = 'Garage door closed';
            clearTimeout(garageSensorTimeoutTwo);
            garageSensorTimeoutTwo = setTimeout(() => {
                shouldSendGarageDoorAlertTwo = true;
            }, 1 * 60 * 10000);

            if (shouldSendGarageDoorAlertTwo && garageOpenAlertManualEnable) {
                if (options.alertButtonPressTexts) {
                    messenger.send(true, messengerInfo.toNumbers, msg, false, false);
                }
                messenger.sendIftt(garageOpened);
                shouldSendGarageDoorAlertTwo = false;
            }
            logger.debug(msg);
            io.sockets.emit('garageErrorStatus', null);
        }
    });

    if (options.enableMotionSensor && options.enableHue) {
        motionSensor.watch((err, value) => {
            if (err) {
                logger.error('Error watching motion sensor: ', err);
            }
            logger.debug('value:', value);
            if (value == 1 && !hasTurnedLightsOn) {
                clearTimeout(motionSensorTimeoutOne);
                motionSensorTimeoutOne = setTimeout(function () {
                    hasTurnedLightsOn = true;
                }, 5 * 1000);
                hue.garageLightsOnTimed();
            } else if (value == 0 && hasTurnedLightsOn) {
                clearTimeout(motionSensorTimeoutTwo);
                motionSensorTimeoutTwo = setTimeout(function () {
                    hasTurnedLightsOn = false;
                }, 5 * 1000);
            }
        });
    }

    function garageIsOpen() {
        var isOpen = garageSensor.readSync() == 1 ? true : false;
        return isOpen;
    }

    function toggleGarageDoor() {

        if (!debugMode) {
            logger.debug('Opening/closing door now');
            garageSwitch.writeSync(1);
            garageTimeout = setTimeout(function () {
                garageSwitch.writeSync(0);
            }, 1000);
        }
    }

    function toggleGarageOpenAlert(enable){
        logger.debug('Enable toggleGarageOpenAlert'+ enable);
        garageOpenAlertManualEnable = enable;
    }

    return {
        garageIsOpen: garageIsOpen,
        toggleGarageDoor: toggleGarageDoor,
        toggleGarageOpenAlert:toggleGarageOpenAlert
    };
};

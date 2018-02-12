const Gpio = require('onoff').Gpio;
const path = require('path');

const motionSensor = new Gpio(15, 'in', 'both');
const garageSensor = new Gpio(4, 'in', 'both');
const garageSwitch = new Gpio(21, 'out');

var garageTimeout = null,
    motionSensorTimeoutOne = null,
    motionSensorTimeoutTwo = null,
    hasSentMotionSensorAlert = false,
    shouldSendGarageDoorAlertOne = true,
    shouldSendGarageDoorAlertTwo = true,
    garageSensorTimeoutOne = null,
    garageSensorTimeoutTwo = null,
    garageOpened = false,
    garageOpenAlertTimeout = null,
    garageOpenAlertMessageTimeout = null;

module.exports = function (app, enableMotionSensor, debugMode, io, logger) {
    var hasBeenOpened = garageIsOpen();
    const messenger = require('./messenger.js')(logger, debugMode);
    const messengerInfo = require('../settings/messengerInfo.js');
    const hue = require('./hue.js')(logger);
    const options = require('../settings/options.js');
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
            hue.garageLightsOnTimed();

            clearTimeout(garageSensorTimeoutOne);
            garageSensorTimeoutOne = setTimeout(() => {
                shouldSendGarageDoorAlertOne = true;
            }, 1 * 60 * 10000);

            clearTimeout(garageOpenAlertTimeout);
            garageOpenAlertTimeout = setTimeout(() => {
                if (garageIsOpen()) {
                    video.startCamera();
                    garageOpenAlertMessageTimeout = setTimeout(() => {
                        var garageAlertMsg = `Garage has been open for more than: ${options.garageOpenAlertMins} minutes!`;
                        logger.debug(garageAlertMsg);
                        if (options.garageOpenMinsAlert) {
                            video.streamVideo().then(() => {
                                messenger.send(options.alertButtonPressTexts, messengerInfo.toNumbers, garageAlertMsg,
                                    options.alertSendPictureText, true);
                            }).catch(() => {
                                garageAlertMsg = `Garage has been open for more than: ${options.garageOpenAlertMins} minutes! Error taking new video.`;
                                messenger.send(options.alertButtonPressTexts, messengerInfo.toNumbers, garageAlertMsg,
                                    options.alertSendPictureText, true);
                            });
                        }
                        messenger.sendIfttGarageOpenedAlert(options.iftttSendGarageOpenAlert, options.garageOpenAlertMins);
                        video.stopStreaming();
                    }, 30 * 1000);
                }
            }, options.garageOpenAlertMins * 60 * 1000);

            if (shouldSendGarageDoorAlertOne) {
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
            hue.garageLightsOnTimed();
            clearTimeout(garageSensorTimeoutTwo);
            garageSensorTimeoutTwo = setTimeout(() => {
                shouldSendGarageDoorAlertTwo = true;
            }, 1 * 60 * 10000);

            if (shouldSendGarageDoorAlertTwo) {
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

    if (enableMotionSensor) {
        motionSensor.watch(function (err, value) {
            if (err) {
                logger.error('Error watching motion sensor: ', err);
            }
            if (value == 1 && !hasSentMotionSensorAlert) {
                clearTimeout(motionSensorTimeoutOne);
                motionSensorTimeoutOne = setTimeout(function () {
                    hasSentMotionSensorAlert = true;
                }, 2 * 60 * 1000);
                var msg = 'Motion detected in garage';
                logger.debug(msg);
                messenger.send(
                    true,
                    messengerInfo.toNumbers,
                    msg,
                    false,
                    false
                );
            } else if (value == 0 && hasSentMotionSensorAlert) {
                clearTimeout(motionSensorTimeoutTwo);
                motionSensorTimeoutTwo = setTimeout(function () {
                    hasSentMotionSensorAlert = false;
                }, 2 * 60 * 1000);
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
    return {
        garageIsOpen: garageIsOpen,
        toggleGarageDoor: toggleGarageDoor
    };
};

const Gpio = require('onoff').Gpio;

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
	garageOpenAlertOneTimeout = null,
	garageOpenAlertTwoTimeout = null,
	garageOpenAlertManualEnable = false,
	garageOpenAlertPersonTwoManualEnable = false,
	manualButtonToggle = false,
	manualGarageOpenTimeout = null;

module.exports = function(app, debugMode, io, logger) {
	var hasBeenOpened = garageIsOpen();
	const messenger = require('./messenger.js')(logger, debugMode);
	const messengerInfo = require('../settings/messengerInfo.js');
	const options = require('../settings/options.js');
	const hue = require('./hue.js')(logger);
	const video = require('./video.js')(app, logger, io);
	const rp = require('request-promise');
	app.set('takingVideo', false);

	garageSensor.watch(function(err, value) {
		if (err) {
			logger.error('Error watching garage sensor: ', err);
		}
		if (value == 1 && !hasBeenOpened) {
			hasBeenOpened = true;
			garageOpened = true;
			var msg = 'Garage door opened';
			if (options.enableLightsOnGarageOpen) {
				hue.garageLightsOnTimed(25);
			}
			clearTimeout(garageSensorTimeoutOne);
			garageSensorTimeoutOne = setTimeout(() => {
				shouldSendGarageDoorAlertOne = true;
			}, 1 * 60 * 10000);
			logger.debug('garage open');

			garageAlertOpenCheck(options.garageOpenAlertOneMins, garageOpenAlertOneTimeout, false);

			if (!manualButtonToggle) {
				logger.debug('garage not opened via button');
				if (shouldSendGarageDoorAlertOne && garageOpenAlertManualEnable) {
					logger.debug('sending garage door gps alert');

					if (garageOpenAlertPersonTwoManualEnable) {
						logger.debug('about to send video message');
						video
							.streamVideo()
							.then(() => {
								var garageAlertMsg = `The garage has been opened but the homeowners are not home!`;
								messenger.send(true, messengerInfo.toNumbers, garageAlertMsg, options.alertSendPictureText, true);
								video.stopStreaming();
							})
							.catch(() => {
								var garageAlertMsg = `The garage has been opened but the homeowners are not home! Error taking new video.`;
								messenger.send(true, messengerInfo.toNumbers, garageAlertMsg, options.alertSendPictureText, true);
								video.stopStreaming();
							});
					} else {
						messenger.sendIftt(garageOpened);
					}
					shouldSendGarageDoorAlertOne = false;
				}
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
			//logger.debug('value:', value);
			if (value == 1 && !hasTurnedLightsOn) {
				clearTimeout(motionSensorTimeoutOne);
				motionSensorTimeoutOne = setTimeout(function() {
					hasTurnedLightsOn = true;
				}, 5 * 1000);
				hue.garageLightsOnTimed(100);
			} else if (value == 0 && hasTurnedLightsOn) {
				clearTimeout(motionSensorTimeoutTwo);
				motionSensorTimeoutTwo = setTimeout(function() {
					hasTurnedLightsOn = false;
				}, 5 * 1000);
			}
		});
	}

	function garageAlertOpenCheck(timeUntilAlert, timeOut, shouldCall) {
		clearTimeout(timeOut);
		logger.debug('garage alert open check');
		timeOut = setTimeout(() => {
			if (garageIsOpen()) {
				setTimeout(() => {
					var garageAlertMsg = `Garage has been open for more than: ${timeUntilAlert} minutes!`;
					logger.debug(garageAlertMsg);
					if (options.garageOpenMinsAlert) {
						logger.debug(garageAlertMsg);
						video
							.streamVideo()
							.then(() => {
								if (shouldCall) {
									messenger.sendCallAlert();
								} else {
									messenger.send(options.alertButtonPressTexts, messengerInfo.toNumbers, garageAlertMsg, options.alertSendPictureText, true);
								}
								video.stopStreaming();
							})
							.catch(() => {
								if (shouldCall) {
									messenger.sendCallAlert();
								} else {
									garageAlertMsg = `Garage has been open for more than: ${timeUntilAlert} minutes! Error taking new video.`;
									messenger.send(options.alertButtonPressTexts, messengerInfo.toNumbers, garageAlertMsg, options.alertSendPictureText, true);
								}
								video.stopStreaming();
							});
						if (!shouldCall) {
							garageAlertOpenCheck(options.garageOpenAlertTwoMins, garageOpenAlertTwoTimeout, true);
						}
					}
					messenger.sendIfttGarageOpenedAlert(options.iftttSendGarageOpenAlert, timeUntilAlert);
				}, 45 * 1000);
			}
		}, timeUntilAlert * 60 * 1000);
	}

	function garageIsOpen() {
		var isOpen = garageSensor.readSync() == 1 ? true : false;
		return isOpen;
	}

	function toggleGarageDoor() {
		if (!debugMode) {
			manualButtonToggle = true;
			clearTimeout(manualGarageOpenTimeout);
			manualGarageOpenTimeout = setTimeout(() => {
				manualButtonToggle = false;
			}, 60 * 1000);
			logger.debug('Opening/closing door now');
			garageSwitch.writeSync(1);
			garageTimeout = setTimeout(function() {
				garageSwitch.writeSync(0);
			}, 1000);
		}
	}

	function toggleGarageOpenAlert(enable) {
		logger.debug('Enable toggleGarageOpenAlert' + enable);
		garageOpenAlertManualEnable = enable;
	}

	function toggleGarageOpenAlertSecondPerson(enable) {
		logger.debug('Enable toggleGarageOpenAlertSecondPerson' + enable);
		garageOpenAlertPersonTwoManualEnable = enable;
	}

	return {
		garageIsOpen: garageIsOpen,
		toggleGarageDoor: toggleGarageDoor,
		toggleGarageOpenAlert: toggleGarageOpenAlert,
		toggleGarageOpenAlertSecondPerson: toggleGarageOpenAlertSecondPerson
	};
};

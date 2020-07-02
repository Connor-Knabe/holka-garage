const Gpio = require('onoff').Gpio;

const motionSensor = new Gpio(15, 'in', 'both');
const garageSensor = new Gpio(4, 'in', 'both');
const garageSwitch = new Gpio(21, 'out');

var motionSensorTimeoutOne = null,
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
	expectedGarageOpen = false,
	manualGarageOpenTimeout = null,
	personOneShouldOpenTimer = false,
	personTwoShouldOpenTimer = false,
	personOneShouldOpenTimerTimeout = null,
	personTwoShouldOpenTimerTimeout = null;

module.exports = function(app, debugMode, io, logger, video, messenger, hue) {
	var hasBeenOpened = garageIsOpen();
	const messengerInfo = require('../settings/messengerInfo.js');
	const options = require('../settings/options.js');
	const garageOpenRules = require('./garageOpenRules.js')();

	app.set('takingVideo', false);

	garageSensor.watch(function(err, value) {
		if (err) {
			logger.error('Error watching garage sensor: ', err);
		}
		if (value == 1 && !hasBeenOpened) {
			io.sockets.emit('garageStatus', 'open');

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
			shouldAlertHomeOwners();

			logger.debug(msg);
			io.sockets.emit('garageErrorStatus', null);
		} else if (value == 0 && hasBeenOpened) {
			io.sockets.emit('garageStatus', 'closed');

			hasBeenOpened = false;
			garageOpened = false;
			var msg = 'Garage door closed';
			clearTimeout(garageSensorTimeoutTwo);
			garageSensorTimeoutTwo = setTimeout(() => {
				shouldSendGarageDoorAlertTwo = true;
			}, 1 * 60 * 10000);

			if (shouldSendGarageDoorAlertTwo && garageOpenAlertManualEnable) {
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

	function shouldAlertHomeOwners() {
		if (!expectedGarageOpen) {
			logger.debug('!expectedGarageOpen');
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
	}

	function garageAlertOpenCheck(timeUntilAlert, timeOut, shouldCall) {
		clearTimeout(timeOut);
		logger.debug('garage alert open check');
		timeOut = setTimeout(() => {
			if (garageIsOpen()) {
				setTimeout(() => {
					garageAlert(timeUntilAlert, shouldCall);
				}, 45 * 1000);
			}
		}, timeUntilAlert * 60 * 1000);
	}

	function garageIsOpen() {
		var isOpen = garageSensor.readSync() == 1 ? true : false;
		return isOpen;
	}

	function garageAlert(timeUntilAlert, shouldCall) {
		var garageAlertMsg = `Garage has been open for more than: ${timeUntilAlert} minutes!`;
		logger.debug(garageAlertMsg);
		if (options.garageOpenMinsAlert) {
			logger.debug(garageAlertMsg);

			if (shouldCall) {
				garageAlertMsg = `Garage has been open for more than: ${timeUntilAlert + options.garageOpenAlertOneMins} minutes!`;
			}
			video
				.streamVideo()
				.then(() => {
					if (shouldCall) {
						messenger.sendCallAlert();
					}
					messenger.send(options.alertButtonPressTexts, messengerInfo.toNumbers, garageAlertMsg, options.alertSendPictureText, true);
					video.stopStreaming();
				})
				.catch(() => {
					if (shouldCall) {
						messenger.sendCallAlert();
					}
					messenger.send(options.alertButtonPressTexts, messengerInfo.toNumbers, garageAlertMsg, options.alertSendPictureText, true);
					video.stopStreaming();
				});
			if (!shouldCall) {
				garageAlertOpenCheck(options.garageOpenAlertTwoMins, garageOpenAlertTwoTimeout, true);
			}
		}
		messenger.sendIfttGarageOpenedAlert(options.iftttSendGarageOpenAlert, timeUntilAlert);
	}

	function toggleGarageDoor(gpsPerson, remoteAddress) {
		if (garageOpenRules.isFridayAndShouldOpen() || garageOpenRules.isTuesdayAndShouldOpen() || garageOpenRules.genericShouldOpenBasedOnTime() || garageOpenRules.isWeekendAndShouldOpen()) {
			if (!garageIsOpen()) {
				logger.info(`Opening garage via gps person ${gpsPerson} from ip: ${remoteAddress}`);
				openCloseGarageDoor();
				messenger.sendIftt(true, `Garage open via GPS for person ${gpsPerson}`);
			} else {
				logger.info(`Attempted to open garage via gps person ${gpsPerson} from ip: ${remoteAddress} but garage was open`);
			}
		} else {
			messenger.sendIftt(true, `Not opening for person ${gpsPerson} due to time range`);
			logger.info(`Not opening garage for person ${gpsPerson} outside of time range from ip: ${remoteAddress}`);
		}
	}

	function openCloseGarageDoor() {
		expectedGarageOpen = true;
		clearTimeout(manualGarageOpenTimeout);
		manualGarageOpenTimeout = setTimeout(() => {
			expectedGarageOpen = false;
		}, 60 * 1000);

		if (!debugMode) {
			logger.debug('Opening/closing door now');
			garageSwitch.writeSync(1);
			setTimeout(function() {
				garageSwitch.writeSync(0);
			}, 1000);
		}
	}

	function toggleGarageOpenAlert(enable, personTwo) {
		if (personTwo) {
			clearTimeout(personTwoShouldOpenTimerTimeout);
			personTwoShouldOpenTimerTimeout = setTimeout(() => {
				personTwoShouldOpenTimer = true;
			}, options.minsToWaitAfterLeavingHouseForGPSOpen * 60 * 1000);

			logger.debug('Enable toggleGarageOpenAlertSecondPerson: ' + enable);
			garageOpenAlertPersonTwoManualEnable = enable;
		} else {
			clearTimeout(personOneShouldOpenTimerTimeout);
			logger.debug(`personOneTimer QUEUED for ${options.minsToWaitAfterLeavingHouseForGPSOpen}`);

			personOneShouldOpenTimerTimeout = setTimeout(() => {
				personOneShouldOpenTimer = true;
				logger.debug('personOneTimer Active');
			}, options.minsToWaitAfterLeavingHouseForGPSOpen * 60 * 1000);

			logger.debug('Enable toggleGarageOpenAlertPersonOne: ' + enable);
			garageOpenAlertManualEnable = enable;
		}
	}

	function garageDoorOpenHandler(isPersonTwo, gpsPerson, remoteAddress) {
		var personTimerShouldOpen = isPersonTwo ? personTwoShouldOpenTimer : personOneShouldOpenTimer;
		if (!personTimerShouldOpen) {
			const logMsg = `Not opening for person ${gpsPerson} due to timer. ${options.minsToWaitAfterLeavingHouseForGPSOpen} min delay`;
			logger.debug(logMsg);
			messenger.sendGenericIfttt(logMsg);
		} else {
			logger.debug('should open garage');
		}

		if (personTimerShouldOpen) {
			if (isPersonTwo) {
				personTwoShouldOpenTimer = false;
			} else {
				personOneShouldOpenTimer = false;
			}
			logger.debug('toggle garage door');
			toggleGarageDoor(gpsPerson, remoteAddress);
		}
	}

	return {
		garageIsOpen: garageIsOpen,
		toggleGarageDoor: toggleGarageDoor,
		toggleGarageOpenAlert: toggleGarageOpenAlert,
		garageDoorOpenHandler: garageDoorOpenHandler,
		openCloseGarageDoor: openCloseGarageDoor
	};
};

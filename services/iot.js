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

module.exports = function(app, debugMode, io, logger, video, messenger) {
	var hasBeenOpened = garageIsOpen();
	const messengerInfo = require('../settings/messengerInfo.js');
	const options = require('../settings/options.js');
	const hue = require('./hue.js')(logger);
	app.set('takingVideo', false);

	//DEBUG REMOVE
	//ALSO ENABLE E texts in messengerInfo file on server
	//SET TO 15 min for timer in options.js

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

			shouldAlertHomeOwners();

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

	function shouldAlertHomeOwners() {
		if (!expectedGarageOpen) {
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

	function toggleGarageDoor(gpsPerson, remoteAddress) {
		if (options.debugMode || isFridayAndShouldOpen() || isTuesdayAndShouldOpen() || genericShouldOpenBasedOnTime() || isWeekendAndShouldOpen()) {
			if (!garageIsOpen()) {
				logger.info(`Opening garage via gps person ${gpsPerson} from ip: ${remoteAddress}`);
				openGarageDoor();
				messenger.sendIftt(true, `Garage open via GPS for person ${gpsPerson}`);
			} else {
				logger.info(`Attempted to open garage via gps person ${gpsPerson} from ip: ${remoteAddress} but garage was closed`);
			}
		} else {
			messenger.sendIftt(true, `Not opening for person ${gpsPerson} due to time range`);
			logger.info(`Not opening garage for person ${gpsPerson} outside of time range from ip: ${remoteAddress}`);
		}
	}

	function openGarageDoor() {
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

	function toggleGarageOpenAlert(enable) {
		if (enable) {
			clearTimeout(personOneShouldOpenTimerTimeout);
			logger.debug(`personOneTimer QUEUED for ${options.minsToWaitAfterLeavingHouseForGPSOpen}`);

			personOneShouldOpenTimerTimeout = setTimeout(() => {
				personOneShouldOpenTimer = true;
				logger.debug('personOneTimer Active');
			}, options.minsToWaitAfterLeavingHouseForGPSOpen * 60 * 1000);
		}
		logger.debug('Enable toggleGarageOpenAlertPersonOne: ' + enable);
		garageOpenAlertManualEnable = enable;
	}

	function toggleGarageOpenAlertSecondPerson(enable) {
		if (enable) {
			clearTimeout(personTwoShouldOpenTimerTimeout);
			personTwoShouldOpenTimerTimeout = setTimeout(() => {
				personTwoShouldOpenTimer = true;
			}, options.minsToWaitAfterLeavingHouseForGPSOpen * 60 * 1000);
		}
		logger.debug('Enable toggleGarageOpenAlertSecondPerson: ' + enable);
		garageOpenAlertPersonTwoManualEnable = enable;
	}

	function garageDoorOpenHandler(isPersonTwo, gpsPerson, remoteAddress) {
		var shouldLogAlert = true;
		if (personTwoShouldOpenTimer && isPersonTwo) {
			personTwoShouldOpenTimer = false;
			shouldLogAlert = false;
			toggleGarageDoor(gpsPerson, remoteAddress);
		}

		if (personOneShouldOpenTimer && !isPersonTwo) {
			personOneShouldOpenTimer = false;
			shouldLogAlert = false;
			toggleGarageDoor(gpsPerson, remoteAddress);
		}

		if (shouldLogAlert) {
			const logMsg = `Not opening for person ${gpsPerson} due to timer`;
			logger.debug(logMsg);
			messenger.sendGenericIfttt(logMsg);
		}
	}

	function isFridayAndShouldOpen() {
		var dayOfWeek = new Date().getDay();
		var theTime = new Date();
		return dayOfWeek == 5 && theTime.getHours() >= 11 && theTime.getHours() <= 21;
	}

	function isTuesdayAndShouldOpen() {
		var dayOfWeek = new Date().getDay();
		var theTime = new Date();
		return (dayOfWeek == 2 && theTime.getHours() >= 11 && theTime.getHours() <= 12) || (theTime.getHours() >= 16 && theTime.getHours() <= 23);
	}

	function isWeekendAndShouldOpen() {
		var dayOfWeek = new Date().getDay();
		var theTime = new Date();
		return (dayOfWeek == 6 && (theTime.getHours() >= 11 && theTime.getHours() <= 23)) || (dayOfWeek == 0 && (theTime.getHours() >= 8 && theTime.getHours() <= 20));
	}

	function genericShouldOpenBasedOnTime() {
		var theTime = new Date();
		return (theTime.getHours() >= 6 && theTime.getHours() <= 7) || (theTime.getHours() >= 11 && theTime.getHours() <= 12) || (theTime.getHours() >= 16 && theTime.getHours() <= 19);
	}

	return {
		garageIsOpen: garageIsOpen,
		toggleGarageDoor: toggleGarageDoor,
		toggleGarageOpenAlert: toggleGarageOpenAlert,
		toggleGarageOpenAlertSecondPerson: toggleGarageOpenAlertSecondPerson,
		garageDoorOpenHandler: garageDoorOpenHandler
	};
};

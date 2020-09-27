const Gpio = require('onoff').Gpio;

const motionSensor = new Gpio(15, 'in', 'both');
const garageSensor = new Gpio(4, 'in', 'both');
const garageSwitch = new Gpio(21, 'out');

var motionSensorTimeoutOne = null,
	motionSensorTimeoutTwo = null,
	hasTurnedLightsOn = false,
	garageOpenAlertOneTimeout = null,
	garageOpenAlertTwoTimeout = null,
	expectedGarageOpen = false,
	manualGarageOpenTimeout = null,
	personOneShouldOpenTimer = false,
	personTwoShouldOpenTimer = false,
	personOneShouldOpenTimerTimeout = null,
	personTwoShouldOpenTimerTimeout = null,
	garageLastOpenedTime = null,
	garageLastClosedTime = null,
	temporaryDisableGarageStillOpenAlert = false,
	tempGarageDisableStillOpenAlertTimeout = null,
	temporaryDisableGarageStillOpenAlertTime = null,
	shouldAlertTimeoutOne = null,
	shouldAlertTimeoutTwo = null;

module.exports = function(app, debugMode, io, logger, video, messenger, hue, cron,homeAway) {
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
			garageLastOpenedTime = new Date();
			io.sockets.emit('garageLastOpenedTime', garageLastOpenedTime);

			var msg = 'Garage door opened';

			if (options.enableLightsOnGarageOpen) {
				hue.garageLightsOnTimed(25);
			}

			logger.debug('garage open');

			garageAlertOpenCheck(options.garageOpenAlertOneMins, garageOpenAlertOneTimeout, false);
			clearTimeout(shouldAlertTimeoutOne)
			clearTimeout(shouldAlertTimeoutTwo)
			shouldAlertTimeoutOne = setTimeout(() => {
				shouldAlertHomeOwners('opened');
			}, 30 * 1000);

			logger.debug(msg);
			io.sockets.emit('garageErrorStatus', null);
		} else if (value == 0 && hasBeenOpened) {
			clearTimeout(tempGarageDisableStillOpenAlertTimeout);
			temporaryDisableGarageStillOpenAlert = false;
			io.sockets.emit('garageStatus', 'closed');

			hasBeenOpened = false;
			garageLastClosedTime = new Date();
			io.sockets.emit('garageLastClosedTime', garageLastClosedTime);

			var msg = 'Garage door closed';
			clearTimeout(garageOpenAlertOneTimeout);
			clearTimeout(garageOpenAlertTwoTimeout);
			clearTimeout(shouldAlertTimeoutOne)
			clearTimeout(shouldAlertTimeoutTwo)
			shouldAlertTimeoutTwo = setTimeout(() => {
				shouldAlertHomeOwners('closed');
			}, 30 * 1000);

			logger.debug(msg);
			io.sockets.emit('garageErrorStatus', null);
		}
	});

	//if motion is detected in garage turn on hue lights
	if (options.enableMotionSensor && options.enableHue) {
		motionSensor.watch((err, value) => {
			if (err) {
				logger.error('Error watching motion sensor: ', err);
			}
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

	function shouldAlertHomeOwners(status) {
		logger.debug(`possibly alert home owners not home? expectedGarageOpen${expectedGarageOpen} | homeAway.Status.personOneAway && homeAway.Status.personTwoAway ${homeAway.Status.personOneAway} && ${homeAway.Status.personTwoAway}`);
		if (!expectedGarageOpen) {
			if (homeAway.Status.personOneAway && homeAway.Status.personTwoAway) {
				var sendPictureText = true;
				video
					.streamVideo()
					.then(() => {
						var garageAlertMsg = `The garage has been ${status} but the homeowners are not home!`;
						messenger.send(true, messengerInfo.toNumbers, garageAlertMsg, sendPictureText, true);
						video.stopStreaming();
					})
					.catch(() => {
						var garageAlertMsg = `The garage has been ${status} but the homeowners are not home! Error taking new video.`;
						sendPictureText = false;
						messenger.send(true, messengerInfo.toNumbers, garageAlertMsg, sendPictureText, true);
						video.stopStreaming();
					});
			}
		}
	}

	function garageAlertOpenCheck(timeUntilAlert, timeOut, shouldCall) {
		clearTimeout(timeOut);
		timeOut = setTimeout(() => {
			if (garageIsOpen() && !temporaryDisableGarageStillOpenAlert) {
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

		var garageAlertOpenMins = shouldCall ? timeUntilAlert + options.garageOpenAlertOneMins : timeUntilAlert

		var garageAlertMsg = `Garage has been open for more than: ${garageAlertOpenMins} minutes!`;
		logger.debug(garageAlertMsg);
		if (options.garageOpenMinsAlert) {
			logger.debug(garageAlertMsg);
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

	function activateGarageGpsOpenAwayTimer(personTwo) {
		if (personTwo) {
			clearTimeout(personTwoShouldOpenTimerTimeout);
			logger.debug(`personTwoTimer QUEUED for ${options.minsToWaitAfterLeavingHouseForGPSOpen}`);
			personTwoShouldOpenTimerTimeout = setTimeout(() => {
				personTwoShouldOpenTimer = true;
				logger.debug('personTwoTimer Active');
			}, options.minsToWaitAfterLeavingHouseForGPSOpen * 60 * 1000);
		} else {
			clearTimeout(personOneShouldOpenTimerTimeout);
			logger.debug(`personOneTimer QUEUED for ${options.minsToWaitAfterLeavingHouseForGPSOpen}`);
			personOneShouldOpenTimerTimeout = setTimeout(() => {
				personOneShouldOpenTimer = true;
				logger.debug('personOneTimer Active');
			}, options.minsToWaitAfterLeavingHouseForGPSOpen * 60 * 1000);
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
			if (isPersonTwo) {
				clearTimeout(personTwoShouldOpenTimerTimeout);
				personTwoShouldOpenTimer = false;
			} else {
				clearTimeout(personOneShouldOpenTimerTimeout);
				personOneShouldOpenTimer = false;
			}
			logger.debug('toggle garage door');
			toggleGarageDoor(gpsPerson, remoteAddress);
		}
	}

	function setHome(personTwo, setAway) {
		if (personTwo) {
			homeAway.Status.personTwoAway = setAway;
		} else {
			homeAway.Status.personOneAway = setAway;
		}
	}

	function getGarageLastOpenedTime() {
		return garageLastOpenedTime;
	}

	function getGarageLastClosedTime() {
		return garageLastClosedTime;
	}

	function getTemporaryDisableGarageStillOpenAlertStatus(){
		var status = temporaryDisableGarageStillOpenAlert ? `Still Open Alert Disabled unitl ${temporaryDisableGarageStillOpenAlertTime.toLocaleTimeString()}` : 'Still Open Alert Enabled';
		return status
	}

	function toggleTemporaryDisableGarageStillOpenAlert(){
		if(temporaryDisableGarageStillOpenAlert){
			temporaryDisableGarageStillOpenAlert = false;
			clearTimeout(tempGarageDisableStillOpenAlertTimeout);
		} else {
			temporaryDisableGarageStillOpenAlert = true;
			temporaryDisableGarageStillOpenAlertTime = new Date(new Date().setHours(new Date().getHours() + options.garageStillOpenAlertDisableForHours));
			tempGarageDisableStillOpenAlertTimeout = setTimeout(()=>{
				temporaryDisableGarageStillOpenAlert = false;
			},options.garageStillOpenAlertDisableForHours*60*60*1000)
		}

		return getTemporaryDisableGarageStillOpenAlertStatus();
	}

	//cron
	var job = new cron(
		'5 * * * *',
		function() {
			if (homeAway.getIsHome()) {
				//turn off specific iot devices that may be on a schedule to turn on at top of the hour
				messenger.sendIftt(null, 'set away', messengerInfo.iftttGarageSetAway2Url);
			}
		},
		null,
		true,
		'America/Chicago'
	);
	job.start();

	return {
		garageIsOpen: garageIsOpen,
		toggleGarageDoor: toggleGarageDoor,
		activateGarageGpsOpenAwayTimer: activateGarageGpsOpenAwayTimer,
		garageDoorOpenHandler: garageDoorOpenHandler,
		openCloseGarageDoor: openCloseGarageDoor,
		setHome: setHome,
		getGarageLastOpenedTime: getGarageLastOpenedTime,
		getGarageLastClosedTime:getGarageLastClosedTime,
		toggleTemporaryDisableGarageStillOpenAlert:toggleTemporaryDisableGarageStillOpenAlert,
		getTemporaryDisableGarageStillOpenAlertStatus:getTemporaryDisableGarageStillOpenAlertStatus
	};
};

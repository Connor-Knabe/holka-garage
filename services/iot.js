const options = require('../settings/options.js');

var motionSensor = null;
var garageSensor = null;
var garageSwitch = null;


if(!options.localDebug){
	const Gpio = require('onoff').Gpio;
	motionSensor = new Gpio(15, 'in', 'both');
	garageSensor = new Gpio(4, 'in', 'both');
	garageSwitch = new Gpio(21, 'out');
} 


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
	temporaryDisableGarageStillOpenAlertTime = new Date(),
	temporaryEnableGuestIsHomeTimeout = null,
	temporaryEnableGuestIsHomeTime = null,
	shouldAlertTimeoutOne = null,
	shouldAlertTimeoutTwo = null;

module.exports = function(app, debugMode, io, logger, video, messenger, hue, cron, homeAway,garageTimeRules,garageTracking) {
	var Status = {
		wasOpenedViaWebsite: false,
		wasClosedViaWebsite: false
	};

	var hasBeenOpened = garageIsOpen();
	const messengerInfo = require('../settings/messengerInfo.js');

	const fs = require("fs").promises;

	app.set('takingVideo', false);
	if(!options.localDebug){
		garageSensor.watch(async function(err, value) {
			if (err) {
				logger.error('Error watching garage sensor: ', err);
			}
			if (value == 1 && !hasBeenOpened) {
				io.sockets.emit('garageStatus', 'open');
				garageTracking.garageOpens++;
				io.sockets.emit('garageOpenCount', getGarageOpenCount());
				io.sockets.emit('springLifeRemaining', getSpringLifeRemaining());
				shouldAlertHomeOwnersBasedOnTime('opened');
				
				await writeToGarageTrackingFile();
	
				hasBeenOpened = true;
				garageLastOpenedTime = new Date();
				io.sockets.emit('garageLastOpenedTime', garageLastOpenedTime);
	
				var msg = 'Garage door opened';
	
				if (options.enableLightsOnGarageOpen) {
					hue.garageLightsOnTimed();
				}
				logger.debug(`garage open {Status.wasOpenedViaWebsite} ${Status.wasOpenedViaWebsite}`);
	
				garageAlertStillOpenCheck(options.garageOpenAlertOneMins, garageOpenAlertOneTimeout, false);
				clearTimeout(shouldAlertTimeoutOne)
				clearTimeout(shouldAlertTimeoutTwo)
				shouldAlertTimeoutOne = setTimeout(() => {
					shouldAlertHomeOwners('opened');
				}, 30 * 1000);
	
				logger.debug(msg);
				io.sockets.emit('garageErrorStatus', null);
				const open = true;
				if(!Status.wasOpenedViaWebsite){
					io.sockets.emit('whoOpenedGarageLast', homeAway.Status.getWhoJustOpenedOrClosedGarage(open,true));
				}
				
			} else if (value == 0 && hasBeenOpened) {
				shouldAlertHomeOwnersBasedOnTime('closed');
	
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
				}, 30 * 1000);4
	
				logger.debug(`Garage door closed {Status.wasClosedViaWebsite} ${Status.wasClosedViaWebsite}`);
	
				io.sockets.emit('garageErrorStatus', null);
				const open = false;
				if(!Status.wasClosedViaWebsite){
					io.sockets.emit('whoClosedGarageLast', homeAway.Status.getWhoJustOpenedOrClosedGarage(open,true));
				}
			}
		});
	}
	

	//if motion is detected in garage turn on hue lights
	if (!options.localDebug && options.enableMotionSensor && options.enableHue) {
		motionSensor.watch((err, value) => {
			if (err) {
				logger.error('Error watching motion sensor: ', err);
			}
			if (value == 1 && !hasTurnedLightsOn) {
				clearTimeout(motionSensorTimeoutOne);
				motionSensorTimeoutOne = setTimeout(function() {
					hasTurnedLightsOn = true;
				}, 5 * 1000);
				hue.garageLightsOnTimed();
			} else if (value == 0 && hasTurnedLightsOn) {
				clearTimeout(motionSensorTimeoutTwo);
				motionSensorTimeoutTwo = setTimeout(function() {
					hasTurnedLightsOn = false;
				}, 5 * 1000);
			}
		});
	}

	function shouldAlertHomeOwnersBasedOnTime(status){
		logger.debug('Should check alert homeowners based on odd time');

		if(garageTimeRules.shouldAlertBasedOnTime()){
			logger.debug('Should alert homeowners based on odd time');
			if(status=="opened"){
				messenger.sendCallAlert();
			}
			video
			?.streamVideo()
			.then(() => {
				var garageAlertMsg = `ALERT! The garage has been ${status} during odd hours!`;
				messenger.send(true, messengerInfo.toNumbers, garageAlertMsg, sendPictureText, true);
				video?.stopStreaming();
			})
			.catch(() => {
				var garageAlertMsg = `ALERT! The garage has been ${status} during odd hours`;
				sendPictureText = false;
				messenger.send(true, messengerInfo.toNumbers, garageAlertMsg, sendPictureText, true);
				video?.stopStreaming();
			});
		}


	}

	function shouldAlertHomeOwners(status) {
		logger.debug(`possibly alert home owners not home? expectedGarageOpen${expectedGarageOpen} | homeAway.Status.personOneAway && homeAway.Status.personTwoAway ${homeAway.Status.personOneAway} && ${homeAway.Status.personTwoAway}`);
		if (!expectedGarageOpen) {
			if (homeAway.Status.personOneAway && homeAway.Status.personTwoAway && options.shouldAlertIfBothOwnersAwayAndOpen) {
				var sendPictureText = true;
				messenger.sendCallAlert();
				video
					?.streamVideo()
					.then(() => {
						var garageAlertMsg = `The garage has been ${status} but the homeowners are not home!`;
						messenger.send(true, messengerInfo.toNumbers, garageAlertMsg, sendPictureText, true);
						video?.stopStreaming();
					})
					.catch(() => {
						var garageAlertMsg = `The garage has been ${status} but the homeowners are not home! Error taking new video.`;
						sendPictureText = false;
						messenger.send(true, messengerInfo.toNumbers, garageAlertMsg, sendPictureText, true);
						video?.stopStreaming();
					});
			}
		}
	}

	function getGarageOpenCount(){
		return garageTracking.garageOpens;
	}

	function getSpringLifeRemaining(){

		var startDate = new Date(garageTracking.springReplacedDate);
		var currentDate = new Date();
		
		var daysSinceNewSpringInstalled = (currentDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24); 

		const maxCycles = 10000;
		
		var timesOpenedPerDay = garageTracking.garageOpens/daysSinceNewSpringInstalled;

		var cyclesLeft = maxCycles-garageTracking.garageOpens;
		var daysTillNewSpring = cyclesLeft/timesOpenedPerDay;
		var yearsTillNewSpring = daysTillNewSpring/365;

		var years = yearsTillNewSpring;
		var months = (yearsTillNewSpring % 1)*12;
		var days = (months % 1)*31;

		return `${Math.floor(years)} years, ${Math.floor(months)} months, ${Math.floor(days)} days`;
	}

	function garageAlertStillOpenCheck(timeUntilAlert, timeOut, shouldCall) {
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
		var isOpen = false;

		if(!options.localDebug){
			isOpen = garageSensor.readSync() == 1 ? true : false;
		}
		return isOpen;
	}

	function garageAlert(timeUntilAlert, shouldCall) {
		var garageAlertOpenMins = shouldCall ? timeUntilAlert + options.garageOpenAlertOneMins : timeUntilAlert
		var garageAlertMsg = `Garage has been open for more than: ${garageAlertOpenMins} minutes!`;
		logger.debug(garageAlertMsg);
		if (options.garageOpenMinsAlert) {
			logger.debug(garageAlertMsg);
			video
				?.streamVideo()
				.then(() => {
					if (shouldCall) {
						messenger.sendCallAlert();
					}
					messenger.send(options.alertButtonPressTexts, messengerInfo.toNumbers, garageAlertMsg, options.alertSendPictureText, true);
					video?.stopStreaming();
				})
				.catch(() => {
					if (shouldCall) {
						messenger.sendCallAlert();
					}
					messenger.send(options.alertButtonPressTexts, messengerInfo.toNumbers, garageAlertMsg, options.alertSendPictureText, true);
					video?.stopStreaming();
				});
			if (!shouldCall) {
				garageAlertStillOpenCheck(options.garageOpenAlertTwoMins, garageOpenAlertTwoTimeout, true);
			}
		}
		messenger.sendIfttGarageOpenedAlert(options.iftttSendGarageOpenAlert, timeUntilAlert);
	}

	async function toggleGarageDoor(gpsPerson, remoteAddress) {
		if (shouldOpenGarageBaesdOnRules()) {
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
		await writeToGarageTrackingFile();

	}

	function shouldOpenGarageBaesdOnRules(){
		// var shouldOpenGarage = false;
		const shouldOpenGarageBasedOnDayTimeLog = garageTimeRules.shouldOpenCheckAndLog(garageTracking.garageTimesToOpenLog);
		const shouldOpenGarageBasedOnDayTime = garageTimeRules.shouldOpenCheck(garageTracking.garageTimesToOpen);
		
		shouldOpenGarage = shouldOpenGarageBasedOnDayTime || shouldOpenGarageBasedOnDayTimeLog;
		return shouldOpenGarage;
	}

	function openCloseGarageDoor() {
		expectedGarageOpen = true;
		clearTimeout(manualGarageOpenTimeout);
		manualGarageOpenTimeout = setTimeout(() => {
			expectedGarageOpen = false;
		}, 60 * 1000);

		if (!debugMode && !options.localDebug) {
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

	async function garageDoorOpenHandler(isPersonTwo, gpsPerson, remoteAddress) {
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

			// await garageTimeRules.shouldLog(garageTracking.garageTimesToOpenLog);
			// await writeToGarageTrackingFile();
			toggleGarageDoor(gpsPerson, remoteAddress);
		}
	}

	function getGarageLastOpenedTime() {
		return garageLastOpenedTime;
	}

	function getGarageLastClosedTime() {
		return garageLastClosedTime;
	}

	//clean up these two functions 
	function getTemporaryGuestIsHomeStatus(){

		var guestHomeTime = "";
		if(temporaryEnableGuestIsHomeTime){
			guestHomeTime = `until ${temporaryEnableGuestIsHomeTime.toLocaleTimeString()}`;
		}
		var status = homeAway.Status.temporaryEnableGuestIsHome ? `Guest Is Home Enabled ${guestHomeTime}` : `Guest Is Home Disabled`;

		return status
	}

	function toggleTemporaryEnableGuestIsHome(){
		if(homeAway.Status.temporaryEnableGuestIsHome){
			homeAway.Status.temporaryEnableGuestIsHome = false;
			messenger.sendGenericIfttt(`Guest is NOT home shutting off lights when home owners are away`);
			clearTimeout(temporaryEnableGuestIsHomeTimeout);
		} else {
			homeAway.Status.temporaryEnableGuestIsHome = true;
			temporaryEnableGuestIsHomeTime = new Date(new Date().setHours(new Date().getHours() + options.guestIsHomeEnableForHours));
			messenger.sendGenericIfttt(`Guest is home until ${temporaryEnableGuestIsHomeTime} NOT shutting off lights when home owners are away`);
			temporaryEnableGuestIsHomeTimeout = setTimeout(()=>{
				homeAway.Status.temporaryEnableGuestIsHome = false;
			},options.guestIsHomeEnableForHours*60*60*1000)
		}

		return getTemporaryGuestIsHomeStatus();
	}

	function getTemporaryDisableGarageStillOpenAlertStatus(){
		var status = temporaryDisableGarageStillOpenAlert ? `Still Open Alert Disabled until ${temporaryDisableGarageStillOpenAlertTime.toLocaleTimeString()}` : 'Still Open Alert Enabled';

		return status
	}

	function toggleTemporaryDisableGarageStillOpenAlert(){
		if(temporaryDisableGarageStillOpenAlert){
			messenger.sendGenericIfttt(`Alerting users when garage has been left open`);
			temporaryDisableGarageStillOpenAlert = false;
			clearTimeout(tempGarageDisableStillOpenAlertTimeout);
		} else {
			temporaryDisableGarageStillOpenAlert = true;
			temporaryDisableGarageStillOpenAlertTime = new Date(new Date().setHours(new Date().getHours() + options.garageStillOpenAlertDisableForHours));
			messenger.sendGenericIfttt(`NOT alerting users when garage has been left open until ${temporaryDisableGarageStillOpenAlertTime}`);

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
			if (homeAway.Status.isAway()) {
				//turn off specific iot devices that may be on a schedule to turn on at top of the hour
				messenger.sendIftt(null, 'set away', messengerInfo.iftttGarageSetAwayUrl);
			}
		},
		null,
		true,
		'America/Chicago'
	);
	job.start();

	async function writeToGarageTrackingFile() {
		try { 
			await fs.writeFile( "garageTracking.json", JSON.stringify( garageTracking ), "utf8");
		} catch(err) { 
			logger.error(`Error writing garageTracking file ${err}`); 
		} 	
	}

	function getGarageStatus(){
		var garageGPSOpenTime = garageTimeRules.nextOpenBasedOnDayTime();
		const time = new Date(garageGPSOpenTime).toLocaleTimeString(undefined,{ hour12: false}).slice(0, -3)
		const date = new Date(garageGPSOpenTime).toLocaleDateString({month: 'numeric', day: 'numeric'});
		garageGPSOpenTime = `${time}||${date}`
		var shouldOpenGarageBaesdOnRules = shouldOpenGarageBaesdOnRules() ? "Y" : garageGPSOpenTime;

		var garageOpenClosed = garageIsOpen() ? "Opn": "Cld";
		var personOneAway = homeAway.isPersonAway(false) ? "Awy": "Hme";
		var personTwoAway = homeAway.isPersonAway(true) ? "Awy": "Hme";
		
		return `${garageOpenClosed}|1${personOneAway}|2${personTwoAway}|${shouldOpenGarageBaesdOnRules}`;
	}

	return {
		garageIsOpen: garageIsOpen,
		toggleGarageDoor: toggleGarageDoor,
		activateGarageGpsOpenAwayTimer: activateGarageGpsOpenAwayTimer,
		garageDoorOpenHandler: garageDoorOpenHandler,
		openCloseGarageDoor: openCloseGarageDoor,
		getGarageLastOpenedTime: getGarageLastOpenedTime,
		getGarageLastClosedTime:getGarageLastClosedTime,
		toggleTemporaryDisableGarageStillOpenAlert:toggleTemporaryDisableGarageStillOpenAlert,
		getTemporaryDisableGarageStillOpenAlertStatus:getTemporaryDisableGarageStillOpenAlertStatus,
		toggleTemporaryEnableGuestIsHome:toggleTemporaryEnableGuestIsHome,
		getTemporaryGuestIsHomeStatus:getTemporaryGuestIsHomeStatus,
		Status:Status,
		getGarageOpenCount:getGarageOpenCount,
		getSpringLifeRemaining:getSpringLifeRemaining,
		shouldOpenGarageBaesdOnRules:shouldOpenGarageBaesdOnRules,
		getGarageStatus:getGarageStatus
	};
};

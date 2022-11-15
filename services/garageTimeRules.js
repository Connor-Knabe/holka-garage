Date.prototype.addHours = function(h) {
	this.setTime(this.getTime() + (h*60*60*1000));
	return this;
}

module.exports = function(options,garageTimesToOpenLog,garageTimesToOpen,logger) {
	function shouldAlertBasedOnTime() {
		var theTime = new Date();
		if(!options.shouldAlertBasedOnOddHours){
			return false;
		}
		return (theTime.getHours() >= 23 || theTime.getHours() <= 3);
	}

	function logGarageOpenHours(dayToLog) {
		var theTime = new Date();

		dayToLog.hourAndCount[theTime.getHours()] = dayToLog.hourAndCount[theTime.getHours()] == undefined ? 1 : dayToLog.hourAndCount[theTime.getHours()] += 1;
		//log time to "All"
		dayToLog = garageTimesToOpenLog[7];
		dayToLog.hourAndCount[theTime.getHours()] = dayToLog.hourAndCount[theTime.getHours()] == undefined ? 1 : dayToLog.hourAndCount[theTime.getHours()] += 1;
		return;
	}

	function shouldOpenCheckAndLog(garageTimesToOpen){
		var shouldOpenBasedOnTime = false;
		var currentDayObj = returnCurrentDay(garageTimesToOpenLog);
		if (currentDayObj) {
			logGarageOpenHours(currentDayObj);
			var theTime = new Date();
			shouldOpenBasedOnTime = shouldOpenBasedOnDayTime(garageTimesToOpen,theTime);
		}
		return shouldOpenBasedOnTime;
	}

	function shouldOpenCheck(garageTimesToOpen){
		var shouldOpenBasedOnTime = false;
		var currentDayObj = returnCurrentDay(garageTimesToOpenLog);
		if (currentDayObj) {
			var theTime = new Date();
			shouldOpenBasedOnTime = shouldOpenBasedOnDayTime(garageTimesToOpen,theTime);
		}
		return shouldOpenBasedOnTime;

	}

	(function () {
		var garageGPSOpenTime = nextOpenBasedOnDayTime();
		const time = new Date(garageGPSOpenTime).toLocaleTimeString('en-US',{ hour12: true, hour: 'numeric'});
		const date = new Date(garageGPSOpenTime).toLocaleDateString(undefined,{month: 'numeric', day: 'numeric'});
		garageGPSOpenTime = `${time} ${date}`
	})();
	function nextOpenBasedOnDayTime(){
		var date = new Date();
		var hourCounter = 1;
		var dayCounter = 0;
		var shouldLoop = true;
		date.setMinutes(0);
		date.setSeconds(0);

		
		while (shouldLoop){
			var shouldOpen = shouldOpenBasedOnDayTime(garageTimesToOpenLog,date) || shouldOpenBasedOnDayTime(garageTimesToOpen,date);
			if (shouldOpen){
				shouldLoop = false;
				//if match get day/time that it matched
			} else {
				var currentDate = new Date();
				let differenceBetweenDates = date.getTime() - currentDate.getTime();
				let days = Math.ceil(differenceBetweenDates / (1000 * 3600 * 24));
				if(days > 7){
					logger.error("Failed to find next garage open time");
					shouldLoop = false;
				} else if(date.getHours()>=23){
					hourCounter = 1;
					date.setDate(date.getDate() + 1);
					date.setHours(0);
				} else {
					date.addHours(hourCounter);
				}
			}
		}
		logger.debug("nextOpenBasedOnDayTime",date);
		return date;
	}



	function shouldOpenBasedOnDayTime(garageTimesToOpenLog,theTime) {
		var shouldOpenBasedOnTime = false;
		var currentDayObj = returnCurrentDay(garageTimesToOpenLog);
		if (currentDayObj) {
			const shouldOpenCurrentDay = shouldOpenBasedOnDayObject(currentDayObj,theTime);
			const shouldOpenGenericTimes = shouldOpenBasedOnDayObject(garageTimesToOpenLog[7],theTime);
			shouldOpenBasedOnTime = shouldOpenCurrentDay || shouldOpenGenericTimes;
		} else {
			logger.error("couldn't find current day!");
		}

		return shouldOpenBasedOnTime;
	}


	function shouldOpenBasedOnDayObject(currentDayObj,theTime){
		var shouldOpenBasedOnTime = false;
		var shouldOpenBasedOnFixedTime = false;

		if (currentDayObj.hourAndCount != null) {
			for (var hour in currentDayObj.hourAndCount) {
				if (currentDayObj.hourAndCount.hasOwnProperty(hour)) {
					const count = currentDayObj.hourAndCount[hour];
					if (hour == theTime.getHours() && count > options.arrivalFrequencyCountToOpen) {
						shouldOpenBasedOnTime = true;
					}
				}
			}
		}
		if (currentDayObj.hoursToOpen != null){
			currentDayObj.hoursToOpen.forEach(hour => {
				if (hour == theTime.getHours()) {
					shouldOpenBasedOnFixedTime = true;
				}
			});
		}

		var shouldOpen = shouldOpenBasedOnTime || shouldOpenBasedOnFixedTime;

		return shouldOpen;
	}

	function returnCurrentDay(garageTimesToOpen) {
		var currentDayOfWeek = new Date().getDay();
		var currentDayObject = null;
		for (var dayOfWeek in garageTimesToOpen) {
			if (garageTimesToOpen.hasOwnProperty(currentDayOfWeek)) {
				if (currentDayOfWeek == dayOfWeek) {
					currentDayObject = garageTimesToOpen[dayOfWeek];
				}
			}
		}
		return currentDayObject;
	}

	return {
		shouldAlertBasedOnTime:shouldAlertBasedOnTime,
		shouldOpenCheck:shouldOpenCheck,
		shouldOpenCheckAndLog:shouldOpenCheckAndLog,
		nextOpenBasedOnDayTime:nextOpenBasedOnDayTime
	}
};

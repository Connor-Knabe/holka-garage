module.exports = function(options,garageTimesToOpenLog) {
	function shouldAlertBasedOnTime() {
		var theTime = new Date();
		if(!options.shouldAlertBasedOnOddHours){
			return false;
		}
		return (theTime.getHours() >= 22 || theTime.getHours() <= 3);
	}

	console.log('garageTimesToOpenLog',garageTimesToOpenLog);
	console.log('garageTimesToOpenLog[7]',garageTimesToOpenLog[7]);


	function logGarageOpenHours(dayToLog) {
		var theTime = new Date();
		console.log(dayToLog);
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
			shouldOpenBasedOnTime = shouldOpenBasedOnDayTime(garageTimesToOpen);
		}
		return shouldOpenBasedOnTime;
	}

	function shouldOpenCheck(garageTimesToOpen){
		var shouldOpenBasedOnTime = false;
		var currentDayObj = returnCurrentDay(garageTimesToOpenLog);
		if (currentDayObj) {
			shouldOpenBasedOnTime = shouldOpenBasedOnDayTime(garageTimesToOpen);
		}
		return shouldOpenBasedOnTime;

	}

	function shouldOpenBasedOnDayTime(garageTimesToOpenLog) {
		var shouldOpenBasedOnTime = false;
		var currentDayObj = returnCurrentDay(garageTimesToOpenLog);
		if (currentDayObj) {
			logGarageOpenHours(currentDayObj);
			const shouldOpenCurrentDay = shouldOpenBasedOnDayObject(currentDayObj);
			const shouldOpenGenericTimes = shouldOpenBasedOnDayObject(garageTimesToOpenLog[7]);
			shouldOpenBasedOnTime = shouldOpenCurrentDay || shouldOpenGenericTimes;
		} else {
			logger.error("couldn't find current day!");
		}

		return shouldOpenBasedOnTime;
	}


	function shouldOpenBasedOnDayObject(currentDayObj){
		var theTime = new Date();
		var shouldOpenBasedOnTime = false;
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
		return shouldOpenBasedOnTime;
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
		shouldOpenCheckAndLog,shouldOpenCheckAndLog
	}
};

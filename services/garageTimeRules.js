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
		console.log('here');
		var nextOpen = nextOpenBasedOnDayTime();
		console.log(nextOpen);
	})();

	function nextOpenBasedOnDayTime(){
		console.log('checking');
		var date = new Date();
		var hourCounter = 1;
		var dayCounter = 1;
		var shouldLoop = true;
		while (shouldLoop){
			console.log("WHILE", date.toLocaleDateString());
			var shouldOpen = shouldOpenBasedOnDayTime(garageTimesToOpenLog,date) || shouldOpenBasedOnDayTime(garageTimesToOpen,date);

			if (shouldOpen){
				console.log("FOUND MATCH",date);
				shouldLoop = false;
				//if match get day/time that it matched
			} else {
				console.log(`NO MATCH ${date.toLocaleDateString()} ${date.toLocaleTimeString()} Day counter: ${dayCounter} HourCounter${hourCounter}`);
				
				var currentDate = new Date();
				if(dayCounter >= 7){
					console.log("failed to match", date);
					shouldLoop = false;
				} else if(hourCounter>=23){
					hourCounter = 1;
					date.setDate(currentDate.getDate() + dayCounter++)
					console.log('MORE THAN 24 hours!', dayCounter);
				} else if (dayCounter > 1) {
					date.setHours(currentDate.getHours() + hourCounter++);
				} else {
					console.log("HIT ELSE?");
				}
			}
		}
		return date;

	}


	function addDays(date, days) {
		var result = new Date(date);
		result.setDate(result.getDate() + days);
		return result;
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

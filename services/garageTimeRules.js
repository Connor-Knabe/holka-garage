module.exports = function(options) {

	function isFridayAndShouldOpen() {
		var dayOfWeek = new Date().getDay();
		var theTime = new Date();
		return dayOfWeek == 5 && theTime.getHours() >= 9 && theTime.getHours() <= 21;
	}

	function isTuesdayAndShouldOpen() {
		var dayOfWeek = new Date().getDay();
		var theTime = new Date();
		return (dayOfWeek == 2 && theTime.getHours() >= 11 && theTime.getHours() <= 12) || (theTime.getHours() >= 16 && theTime.getHours() <= 23);
	}

	function isWeekendAndShouldOpen() {
		var dayOfWeek = new Date().getDay();
		var theTime = new Date();
		return (dayOfWeek == 6 && (theTime.getHours() >= 8 && theTime.getHours() <= 19)) || (dayOfWeek == 0 && (theTime.getHours() >= 8 && theTime.getHours() <= 19));
	}

	function genericShouldOpenBasedOnTime() {
		var theTime = new Date();
		return (theTime.getHours() >= 11 && theTime.getHours() <= 13) || (theTime.getHours() >= 16 && theTime.getHours() <= 19);
	}

	function shouldAlertBasedOnTime() {
		var theTime = new Date();
		if(!options.shouldAlertBasedOnOddHours){
			return false;
		}
		return (theTime.getHours() >= 22 || theTime.getHours() <= 3);
	}




function newShouldOpenBasedOnDayTime(garageTimesToOpen,garageTimesToOpenLog){
    var currentDayNum = new Date().getDay();
    var theTime = new Date();
    var shouldOpenBasedOnTime = false;
    for (var dayOfWeekNumberKey in garageTimesToOpen) {
        if (garageTimesToOpen.hasOwnProperty(dayOfWeekNumberKey)) {
            if(currentDayNum == dayOfWeekNumberKey){
				var dayToLog = garageTimesToOpenLog[dayOfWeekNumberKey];
				dayToLog.hourAndCount[theTime.getHours()] = dayToLog.hourAndCount[theTime.getHours()] == undefined ? 1 : dayToLog.hourAndCount[theTime.getHours()] += 1;
                var day = garageTimesToOpen[dayOfWeekNumberKey];
                if(day.hoursToOpen != null){
                    day.hoursToOpen.forEach(function(hour){
                        if(hour==theTime.getHours()){
                            shouldOpenBasedOnTime = true;
                            return;
                        }   
                    });
                }
            }
        }
    }

	//check generic times for all days
	var day = garageTimesToOpen[7];
	if(day.hoursToOpen != null){
		day.hoursToOpen.forEach(function(hour){
			if(hour==theTime.getHours()){
				shouldOpenBasedOnTime = true;
				return;
			}   
		});
	}

    return shouldOpenBasedOnTime;
}




	return {
		isFridayAndShouldOpen: isFridayAndShouldOpen,
		isTuesdayAndShouldOpen: isTuesdayAndShouldOpen,
		isWeekendAndShouldOpen: isWeekendAndShouldOpen,
		genericShouldOpenBasedOnTime: genericShouldOpenBasedOnTime,
		shouldAlertBasedOnTime:shouldAlertBasedOnTime,
		newShouldOpenBasedOnDayTime:newShouldOpenBasedOnDayTime
	};
};

module.exports = function(options) {


	//create a function to save which times garage is being used
	var garageTime = function(garage, time) {
		var garageTime = {
			garage: garage,
			time: time
		};
		return garageTime;
	}
	

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

	return {
		isFridayAndShouldOpen: isFridayAndShouldOpen,
		isTuesdayAndShouldOpen: isTuesdayAndShouldOpen,
		isWeekendAndShouldOpen: isWeekendAndShouldOpen,
		genericShouldOpenBasedOnTime: genericShouldOpenBasedOnTime,
		shouldAlertBasedOnTime:shouldAlertBasedOnTime
	};
};

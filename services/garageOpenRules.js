module.exports = function() {
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
		return (dayOfWeek == 6 && (theTime.getHours() >= 8 && theTime.getHours() <= 20)) || (dayOfWeek == 0 && (theTime.getHours() >= 8 && theTime.getHours() <= 20));
	}

	function genericShouldOpenBasedOnTime() {
		var theTime = new Date();
		return (theTime.getHours() >= 5 && theTime.getHours() <= 7) || (theTime.getHours() >= 11 && theTime.getHours() <= 13) || (theTime.getHours() >= 16 && theTime.getHours() <= 19);
	}

	return {
		isFridayAndShouldOpen: isFridayAndShouldOpen,
		isTuesdayAndShouldOpen: isTuesdayAndShouldOpen,
		isWeekendAndShouldOpen: isWeekendAndShouldOpen,
		genericShouldOpenBasedOnTime: genericShouldOpenBasedOnTime
	};
};

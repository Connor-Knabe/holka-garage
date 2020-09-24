var personOneAway = false;
var personTwoAway = false;
var personOneTime = new Date();
var personTwoTime = new Date();

module.exports = function(logger, login, messenger, messengerInfo, iot, io) {
	function setPersonAway(req, res, isPersonTwo) {
        var personName = isPersonTwo ? login.users[1].name : login.users[0].name;
        var personText = isPersonTwo ? 'personTwo' : 'personOne';

		if (isPersonTwo) {
			iot.setHome(true, true);
			personTwoAway = true;
			personTwoTime = new Date();
			const timeAway = getTimeAway(personTwoTime);
			io.sockets.emit('personTwoTime', `${timeAway}`);
			io.sockets.emit('personTwoAway', 'away');
		} else {
			iot.setHome(false, true);
			personOneAway = true;
			personOneTime = new Date();
			const timeAway = getTimeAway(personOneTime);
			io.sockets.emit('personOneTime', `${timeAway}`);
			io.sockets.emit('personOneAway', 'away');
		}

		if (personOneAway && personTwoAway) {
			messenger.sendGenericIfttt(`Home going to sleep as both home owners are away`);
			messenger.sendIftt(null, 'set away', messengerInfo.iftttGarageSetAwayUrl);
		}

		iot.activateGarageGpsOpenAwayTimer(isPersonTwo);
		logger.debug(`Garage set to away via ${personText}`);
		messenger.sendGenericIfttt(`${personName} Set to Away`);
		res.send('Ok');
	}
	
	function getTimeAway(startDate) {
		var minsBetweenDates = 0;
		const curDate = new Date();

		if (startDate && curDate) {
			var diff = curDate.getTime() - startDate.getTime();
			minsBetweenDates = Math.floor(diff / 60000);
		}

		var timeAway;
		var hours = Math.floor(minsBetweenDates / 60);

		if (hours >= 24) {
			var days = Math.floor(hours / 24);
			hours = hours - days * 24;
			timeAway = `for ${days} day(s) ${hours} hrs`;
		} else {
			timeAway = hours >= 2 ? `for ${hours} hours` : `for ${minsBetweenDates} mins`;
		}

		return timeAway;
	}


    //need to refactor these into one function 
	function setPersonOneHome() {
		iot.setHome(false, false);
		personOneAway = false;
		personOneTime = new Date();
		io.sockets.emit('personOneAway', 'home');
		const timeAway = getTimeAway(personOneTime);
		io.sockets.emit('personOneTime', `${timeAway}`);
		messenger.sendIftt(null, 'set home', messengerInfo.iftttGarageSetHomeUrl);
		messenger.sendGenericIfttt(`${login.users[0].name} Set to Home`);
	}

	function setPersonTwoHome() {
		iot.setHome(true, false);
		personTwoAway = false;
		personTwoTime = new Date();
		io.sockets.emit('personTwoAway', 'home');
		const timeAway = getTimeAway(personOneTime);
		io.sockets.emit('personTwoTime', `${timeAway}`);
		messenger.sendIftt(null, 'set home', messengerInfo.iftttGarageSetHomeUrl);
		messenger.sendGenericIfttt(`${login.users[1].name} Set to Home`);
    }
    
    function isPersonAway(two){
        return two ? personTwoAway : personOneAway
	}
	
	function getPersonTime(two){
		return two ? personTwoTime : personOneTime
	}

	return {
        setPersonAway: setPersonAway,
        isPersonAway: isPersonAway,
        setPersonOneHome:setPersonOneHome,
		setPersonTwoHome:setPersonTwoHome,
		getTimeAway:getTimeAway,
		getPersonTime:getPersonTime
	};
};

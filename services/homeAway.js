const { iftttGarageSetHomeUrl } = require("../settings/messengerInfoExample");

var Status = {
	personOneAway: false,
	personTwoAway: false,
	personOneTime: new Date(),
	personTwoTime: new Date(),
	homeManualEnable: false,
	isAway: ()=>{return Status.personOneAway && Status.personTwoAway}
};

module.exports = function(logger, login, messenger, messengerInfo, io) {
	function setPersonAway(req, res, isPersonTwo) {
        var personName = isPersonTwo ? login.users[1].name : login.users[0].name;
        var personText = isPersonTwo ? 'personTwo' : 'personOne';

		if (isPersonTwo) {
			Status.personTwoAway = true;
			Status.personTwoTime = new Date();
			const timeAway = getTimeAway(Status.personTwoTime);
			io.sockets.emit('personTwoTime', `${timeAway}`);
			io.sockets.emit('personTwoAway', 'away');
		} else {
			Status.personOneAway = true;
			Status.personOneTime = new Date();
			const timeAway = getTimeAway(Status.personOneTime);
			io.sockets.emit('personOneTime', `${timeAway}`);
			io.sockets.emit('personOneAway', 'away');
		}

		if (Status.isAway()) {
			messenger.sendGenericIfttt(`Home going to sleep as both home owners are away`);
			messenger.sendIftt(null, 'set away', messengerInfo.iftttGarageSetAwayUrl);
		}

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
		Status.personOneAway = false;
		Status.personOneTime = new Date();
		io.sockets.emit('personOneAway', 'home');
		const timeAway = getTimeAway(Status.personOneTime);
		io.sockets.emit('personOneTime', `${timeAway}`);
		messenger.sendIftt(null, 'set home', messengerInfo.iftttGarageSetHomeUrl);
		messenger.sendGenericIfttt(`${login.users[0].name} Set to Home`);
	}

	function setPersonTwoHome() {
		Status.personTwoAway = false;
		Status.personTwoTime = new Date();
		io.sockets.emit('personTwoAway', 'home');
		const timeAway = getTimeAway(Status.personOneTime);
		io.sockets.emit('personTwoTime', `${timeAway}`);
		messenger.sendIftt(null, 'set home', messengerInfo.iftttGarageSetHomeUrl);
		messenger.sendGenericIfttt(`${login.users[1].name} Set to Home`);
    }
    
    function isPersonAway(two){
        return two ? Status.personTwoAway : Status.personOneAway
	}
	
	function getPersonTime(two){
		return two ? Status.personTwoTime : Status.personOneTime
	}



	function toggleIsHomeManualEnable(){
		Status.homeManualEnable = Status.homeManualEnable ? false : true;
	}

	return {
        setPersonAway: setPersonAway,
        isPersonAway: isPersonAway,
        setPersonOneHome:setPersonOneHome,
		setPersonTwoHome:setPersonTwoHome,
		getTimeAway:getTimeAway,
		getPersonTime:getPersonTime,
		toggleIsHomeManualEnable: toggleIsHomeManualEnable,
		Status:Status
	};
};

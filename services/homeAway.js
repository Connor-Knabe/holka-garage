module.exports = function(logger, login, messenger, messengerInfo, io, options) {

	var Status = {
		personOneAway: true,
		personTwoAway: true,
		personOneTime: new Date(),
		personTwoTime: new Date(),
		temporaryEnableGuestIsHome: options.defaultGuestIsHome,
		temporaryEnableGuestIsHomeTillSomeoneHome: false,
		isAway: ()=>{return Status.personOneAway && Status.personTwoAway},
		isOnlyOnePersonHome: ()=>{
			var personName = null;
				
			if(Status.temporaryEnableGuestIsHome || Status.temporaryEnableGuestIsHomeTillSomeoneHome){
				personName = "Guest?";
			} else if(Status.personOneAway && !Status.personTwoAway){
				personName = login.users[1].name
			} else if(!Status.personOneAway && Status.personTwoAway) {
				personName = login.users[0].name
			} 
			logger.debug(`Is only one person home ${personName}`);
			return personName;
		},
		getWhoJustOpenedOrClosedGarage: (opened,recheck)=>{
			const personTwoTime = getMinsAway(Status.personTwoTime);
			const personOneTime = getMinsAway(Status.personOneTime);
			var whoOpenOrClosedGarage = "Unknown";
			if (personTwoTime < 10 && personOneTime < 10){
				whoOpenOrClosedGarage = "both, home/away at same time";
				if(recheck){
					setTimeout(()=>{
						Status.getWhoJustOpenedOrClosedGarage(opened,false)
					},8*60*1000);
				}	
			} else if(personTwoTime < 10){
				whoOpenOrClosedGarage = login.users[1].name;
			} else if(personOneTime < 10){
				whoOpenOrClosedGarage = login.users[0].name;
			} else if(personTwoTime > 10 && personOneTime > 10){
				if(Status.isOnlyOnePersonHome()){
					whoOpenOrClosedGarage = Status.isOnlyOnePersonHome();
				} else {
					whoOpenOrClosedGarage = "unknown as both owners are home/away 10+ mins";
				}
				if(recheck){
					setTimeout(()=>{
						Status.getWhoJustOpenedOrClosedGarage(opened,false)
					},8*60*1000);
				}				
			} else  {
				whoOpenOrClosedGarage = "either home owner";
			}
			logger.debug(`getWhoJustOpenedOrClosedGarage() opened ${opened} recheck ${recheck} personOneTime ${personOneTime} personTwoTime ${personTwoTime} whoOpenOrClosedGarage ${whoOpenOrClosedGarage}`)

			if(opened){
				Status.whoOpenedGarageLast = whoOpenOrClosedGarage;
			} else{
				Status.whoClosedGarageLast = whoOpenOrClosedGarage;
			}
			
			return whoOpenOrClosedGarage;
		},
		whoOpenedGarageLast: "unknown..",
		whoClosedGarageLast: "unknown.."
	};
	function setPersonAway(isPersonTwo) {
        var personName = isPersonTwo ? login.users[1].name : login.users[0].name;

		if (isPersonTwo) {
			Status.personTwoAway = true;
			Status.personTwoTime = new Date();
			io.sockets.emit('personTwoTime', `${Status.personTwoTime}`);
			io.sockets.emit('personTwoAway', 'away');
		} else {
			Status.personOneAway = true;
			Status.personOneTime = new Date();
			io.sockets.emit('personOneTime', `${Status.personOneTime}`);
			io.sockets.emit('personOneAway', 'away');
		}

		if (Status.isAway()) {
			if(Status.temporaryEnableGuestIsHome || Status.temporaryEnableGuestIsHomeTillSomeoneHome){
				messenger.sendGenericIfttt(`Home NOT going to sleep as guest is home`);
			} else {
				messenger.sendGenericIfttt(`Home going to sleep as both home owners are away`);
				messenger.sendIftt(null, 'set away', messengerInfo.iftttGarageSetAwayUrl);
			}
		}

		messenger.sendGenericIfttt(`${personName} Set to Away`);
	}

	function getMinsAway(startDate){
		var minsBetweenDates = 0;
		const curDate = new Date();

		if (startDate && curDate) {
			var diff = curDate.getTime() - startDate.getTime();
			minsBetweenDates = Math.floor(diff / 60000);
		}
		return minsBetweenDates;
	}
	
	function getTimeAway(startDate) {
		var minsBetweenDates = getMinsAway(startDate);
	
		var timeAway;
		var hours = Math.floor(minsBetweenDates / 60);

		if (hours >= 24) {
			var days = Math.floor(hours / 24);
			hours = hours - days * 24;
			timeAway = ` for ${days} day(s) ${hours} hrs`;
		} else {
			timeAway = hours >= 2 ? ` for ${hours} hours` : ` for ${minsBetweenDates} mins`;
		}

		return timeAway;
	}

    //need to refactor these into one function 
	function setPersonOneHome() {
		Status.temporaryEnableGuestIsHomeTillSomeoneHome = false;
		Status.personOneAway = false;
		Status.personOneTime = new Date();
		io.sockets.emit('personOneAway', 'home');
		io.sockets.emit('personOneTime', `${Status.personOneTime}`);
		messenger.sendIftt(null, 'set home', messengerInfo.iftttGarageSetHomeUrl);
		messenger.sendGenericIfttt(`${login.users[0].name} Set to Home`);
	}

	function setPersonTwoHome() {
		Status.temporaryEnableGuestIsHomeTillSomeoneHome = false;
		Status.personTwoAway = false;
		Status.personTwoTime = new Date();
		io.sockets.emit('personTwoAway', 'home');
		io.sockets.emit('personTwoTime', `${Status.personOneTime}`);
		messenger.sendIftt(null, 'set home', messengerInfo.iftttGarageSetHomeUrl);
		messenger.sendGenericIfttt(`${login.users[1].name} Set to Home`);
    }
    
    function isPersonAway(two){
        return two ? Status.personTwoAway : Status.personOneAway
	}
	
	function getPersonTime(two){
		return two ? Status.personTwoTime : Status.personOneTime
	}

	function isGuestHome(){
		return Status.temporaryEnableGuestIsHome || Status.temporaryEnableGuestIsHomeTillSomeoneHome;
	}

	return {
        setPersonAway: setPersonAway,
        isPersonAway: isPersonAway,
        setPersonOneHome:setPersonOneHome,
		setPersonTwoHome:setPersonTwoHome,
		getTimeAway:getTimeAway,
		getPersonTime:getPersonTime,
		Status:Status,
		getMinsAway:getMinsAway,
		isGuestHome:isGuestHome
	};
};

const { ExportInstance } = require("twilio/lib/rest/bulkexports/v1/export");

var garageTimesToOpen = [
    {day: 'Sunday', hoursToOpen: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]},
    {day: 'Monday', hoursToOpen: [11, 12, 16, 17]},
    {day: 'Tuesday', hoursToOpen: null},
    {day: 'Wednesday', hoursToOpen: [5]},
    {day: 'Thursday', hoursToOpen: null},
    {day: 'Friday', hoursToOpen: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]},
    {day: 'Saturday', hoursToOpen: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]},
    {day: 'All', hoursToOpen: [11, 12, 13, 16, 17, 18, 19]}
];

var garageTimesToOpenLog = [
    {day: 'Sunday', hourAndCount: {}},
    {day: 'Monday', hourAndCount: {}},
    {day: 'Tuesday', hourAndCount: {}},
    {day: 'Wednesday', hourAndCount: {}},
    {day: 'Thursday', hourAndCount: {}},
    {day: 'Friday', hourAndCount: {}},
    {day: 'Saturday', hourAndCount: {}},
    {day: 'All', hourAndCount:{}}
];

// garageTimesToOpenLog[3].hourAndCount["5"]=1;
// garageTimesToOpenLog[3].hourAndCount["5"]++;
// console.log(garageTimesToOpenLog[3]);

shouldOpenBasedOnTime();


function shouldOpenBasedOnTime(){
    var currentDayNum = new Date().getDay();
    var theTime = new Date();

    var shouldOpenBasedOnTime = false;

    for (var dayOfWeekNumberKey in garageTimesToOpen) {
        if (garageTimesToOpen.hasOwnProperty(dayOfWeekNumberKey)) {
            if(currentDayNum == dayOfWeekNumberKey){
                var day = garageTimesToOpen[dayOfWeekNumberKey];
                var dayToLog = garageTimesToOpenLog[dayOfWeekNumberKey];
                dayToLog.hourAndCount[theTime.getHours()] = dayToLog.hourAndCount[theTime.getHours()] == undefined ? 1 : dayToLog.hourAndCount[theTime.getHours()] += 1;

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

    console.log(`shouldOpenBasedOnTime: ${shouldOpenBasedOnTime}`);
    return shouldOpenBasedOnTime;
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
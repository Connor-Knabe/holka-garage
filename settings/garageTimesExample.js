module.exports.garageTimesToOpen = [
    {day: 'Sunday', hourAndCount: {8:0, 9:0, 10:0, 11:0, 12:0, 13:0, 14:0, 15:0, 16:0, 17:0, 18:0, 19:0}},
    {day: 'Monday', hourAndCount: [11, 12, 16, 17]},
    {day: 'Tuesday', hourAndCount: null},
    {day: 'Wednesday', hourAndCount: null},
    {day: 'Thursday', hourAndCount: null},
    {day: 'Friday', hourAndCount: {8:0, 9:0, 10:0, 11:0, 12:0, 13:0, 14:0, 15:0, 16:0, 17:0, 18:0, 19:0}},
    {day: 'Saturday', hourAndCount: {8:0, 9:0, 10:0, 11:0, 12:0, 13:0, 14:0, 15:0, 16:0, 17:0, 18:0, 19:0}},
    {day: 'All', hourAndCount: {11:0, 12:0, 13:0, 16:0, 17:0, 18:0, 19:0}}
];


function shouldOpenBasedOnTime(){
    var currentDayNum = new Date().getDay();
    var theTime = new Date();

    for (var dayOfWeekNumberKey in garageTimesToOpen) {
        if (garageTimesToOpen.hasOwnProperty(dayOfWeekNumberKey)) {
            if(currentDayNum == dayOfWeekNumberKey){
                var day = garageTimesToOpen[dayOfWeekNumberKey];
                console.log('day', day);
                for (var hourAndCountKey in day.hourAndCount) {
                    if (day.hourAndCount.hasOwnProperty(hourAndCountKey)) {
                        console.log('hourAndCountKey', hourAndCountKey);
                        console.log('thetime', theTime.getHours());
                        console.log(hourAndCountKey == theTime.getHours());

                        if(hourAndCountKey == theTime.getHours()){
                            return true;
                        }

                    }
                }
                return false;
            }
        }
    }
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
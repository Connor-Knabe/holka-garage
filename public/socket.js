var socket = io();
socket.on('liveStream', function (url) {
    $('#stream').attr('src', url);
});

socket.on('liveStreamDate', function (date) {
    $(".date").text(new Date(date).toLocaleString());
    $('.start').hide();
    $('#stream').show();
});

socket.on('clients', function (clients) {
    $(".clients").text(clients);
});


socket.on('garageOpenStatus', function (status) {
    if (status) {
        if (status === "Opening..." || status === "Closing...") {
            $("#progress").show();
        } else {
            $("#progress").hide();
        }
        $("#garageOpenStatus").show();
        $("#garageOpenStatus").text(status);
    } else {
        $("#garageOpenStatus").hide();
        $("#progress").hide();

    }
});

socket.on('garageLightStatus', function (status) {
    if (status) {
        $("#garageLightStatus").show();
        $("#garageLightStatus").text(status);
    } else {
        $("#garageLightStatus").hide();
    }
});



socket.on('toggleAutomatedHueHome', function (status) {
    if (status) {
        $("#toggleAutomatedHueHome").text(status);
        $("#toggleAutomatedHueHome").show();
    } else {
        $("#toggleAutomatedHueHome").hide();
    }
});


socket.on('garageGPSStatus', function (status) {
    if (status) {
        $("#garageGPSStatus").text(status);
        $("#garageGPSStatus").show();
        $("#gps").removeAttr("disabled");

    } else {
        $("#garageGPSStatus").hide();
    }
});

socket.on('garageStatus', function (status) {
    if (status) {
        if(status=="open"){
            $("#open").attr('disabled', 'disabled');
            $("#close").removeAttr("disabled");
        } else if (status=="closed"){
            $("#open").removeAttr("disabled");
            $("#close").attr('disabled', 'disabled');
        }
        $("#garageStatus").text(status);
        $("#garageStatus").show();
    } else {
        $("#garageStatus").hide();
    }
});


socket.on('personOneAway', function (status) {
    if (status) {
        if(status=='home'){
            $("#personOneTime").css("color", "green");
        } else {
            $("#personOneTime").css("color", "red");
        }

        $("#personOneAway").text(status);
        $("#personOneAway").show();
    } else {
        $("#personOneAway").hide();
    }
});


socket.on('personTwoAway', function (status) {
    if (status) {
        if(status=='home'){
            $("#personTwoTime").css("color", "green");
        } else {
            $("#personTwoTime").css("color", "red");
        }

        $("#personTwoAway").text(status);
        $("#personTwoAway").show();
    } else {
        $("#personTwoAway").hide();
    }
});

socket.on('personOneName', function (status) {
    if (status) {
        if (navigator.userAgent.indexOf('Safari') != -1 && navigator.userAgent.indexOf('Chrome') == -1) {
            $("#personOneName").text("."+status);
        } else {
            $("#personOneName").text(status);
        }

    
        $("#personOneName").show();
    } else {
        $("#personOneName").hide();
    }
});

socket.on('personTwoName', function (status) {
    if (status) {
        $("#personTwoName").text(status);
        $("#personTwoName").show();
    } else {
        $("#personTwoName").hide();
    }
});

socket.on('personOneTime', function (status) {
    if (status) {
        $("#personOneTime").text(status);
        $("#personOneTime").show();
    } else {
        $("#personOneTime").hide();
    }
});

socket.on('personTwoTime', function (status) {
    if (status) {
        $("#personTwoTime").text(status);
        $("#personTwoTime").show();
    } else {
        $("#personTwoTime").hide();
    }
});

socket.on('personTwoTime', function (status) {
    if (status) {
        $("#personTwoTime").text(status);
        $("#personTwoTime").show();
    } else {
        $("#personTwoTime").hide();
    }
});        

socket.on('garageTimer', function (status) {
    if (status) {
        $("#garageTimer").text(status);
        $("#garageTimer").show();
    } else {
        $("#garageTimer").hide();
    }
});

socket.on('stillOpenAlert', function (status) {
    if (status) {
        $("#stillOpenAlert").text(status);
        $("#stillOpenAlert").show();
    } else {
        $("#stillOpenAlert").hide();
    }
});

socket.on('guestIsHome', function (status) {
    if (status) {
        $("#guestIsHome").text(status);
        $("#guestIsHome").show();
    } else {
        $("#guestIsHome").hide();
    }
});

socket.on('toggleGarageStillOpenAlert', function (status) {
    if (status) {
        $("#toggleGarageStillOpenAlert").text(status);
        $("#toggleGarageStillOpenAlert").show();
    }
});

socket.on('toggleGuestIsHome', function (status) {
    if (status) {
        $("#toggleGuestIsHome").text(status);
        $("#toggleGuestIsHome").show();
    }
});


socket.on('garageStatus', function (status) {
    if (status) {
        $("#garageStatus").text(status);
        $("#garageStatus").show();
    } else {
        $("#garageStatus").hide();
    }
});


socket.on('garageErrorStatus', function (status) {
    if (status) {
        $("#garageErrorStatus").text(status);
        $("#garageErrorStatus").show();
    } else {
        $("#garageErrorStatus").hide();
    }
});

socket.on('rebootTime', function (status) {
    if (status) {
        $("#rebootTime").text(status);
        $("#rebootTime").show();
    } else {
        $("#rebootTime").hide();
    }
});

socket.on('garageLastOpenedTime', function (status) {
    if (status) {
        $("#garageLastOpenedTime").text(new Date(status).toLocaleString());
    } else {
        $("#garageLastOpenedTime").text("Unknown");
    }
});

socket.on('whoOpenedGarageLast', function (status) {
    if (status) {
        $("#whoOpenedGarageLast").text(status);
    } else {
        $("#whoOpenedGarageLast").text("Unknown!");
    }
});

socket.on('whoClosedGarageLast', function (status) {
    if (status) {
        $("#whoClosedGarageLast").text(status);
    } else {
        $("#whoClosedGarageLast").text("Unknown!");
    }
});


socket.on('garageOpenCount', function (status) {
    if (status) {
        $("#garageOpenCount").text(status);
    } else {
        $("#garageOpenCount").text("Unknown!");
    }
});

socket.on('springLifeRemaining', function (status) {
    if (status) {
        $("#springLifeRemaining").text(status);
    } else {
        $("#springLifeRemaining").text("Unknown!");
    }
});

socket.on('shouldOpenGarageBaesdOnRules', function (status) {
    if (status) {
        $("#shouldOpenGarageBaesdOnRules").text(status);
    } else {
        $("#shouldOpenGarageBaesdOnRules").text("Unknown!");
    }
});      

socket.on('garageGPSOpenTime', function (status) {
    if (status) {
        $("#garageGPSOpenTime").text(status);
    } else {
        $("#garageGPSOpenTime").hide();
    }
});     


socket.on('garageLastClosedTime', function (status) {
    if (status) {
        $("#garageLastClosedTime").text(new Date(status).toLocaleString());

        if($("#garageLastOpenedTime").text() != "Unknown"){
            var garageLastOpened = new Date($("#garageLastOpenedTime").text());
            var garageLastClosed = new Date(status);

            var diff = (garageLastClosed - garageLastOpened); 
            var timeOpened = Math.round((diff/1000)/60); 
            if(timeOpened<0){
                timeOpened = "Unknown"
            }
            $("#garageTimeOpened").text(timeOpened + " mins");
        }
    } else {
        $("#garageLastClosedTime").text("Unknown");
    }
});

socket.emit('start-stream');

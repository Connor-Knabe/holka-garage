var sockets = {};
var Gpio = require('onoff').Gpio;
var spawn = require('child_process').spawn;
var fs = require('fs');

var motionSensor = new Gpio(15, 'in','both');
var garageSensor = new Gpio(4, 'in','both');
var garageSwitch = new Gpio(21, 'out');
var garageTimeout;
var motionSensorTimeoutOne = null;
var motionSensorTimeoutTwo = null;
var garageOpenStatus = null;
var hasSentMotionSensorAlert = false;
var shouldSendGarageDoorAlertOne = true;
var shouldSendGarageDoorAlertTwo = true;
var garageSensorTimeoutOne = null;
var garageSensorTimeoutTwo = null;
var raspistillProc;
var uv4lProc; 

//uv4l -nopreview --auto-video_nr --driver raspicam --encoding mjpeg --width 640 --height 480 --framerate 20 --server-option '--port=9090' --server-option '--max-queued-connections=30' --server-option '--max-streams=25' --server-option '--max-threads=29' --vflip yes --hflip yes


// var args = ['-nopreview', '-auto-video_nr', '-driver', 'raspicam', '-encoding', '-width', '1920', '-height', '1080', '-framerate', '20', '-server-option', '-port=9090','-server-option','-server-option', '-port=9090' '-server-option', '-max-queued-connections=30','-server-option','-max-streams=25','-server-option','-max-threads=29','-vflip','yes','-hflip','yes'];



/*

spawn('pkill',['uv4l']);


var args = ['-nopreview', '--auto-video_nr', '--driver', 'raspicam', '--encoding','mjpeg', '--width', '1920', '--height', '1080', '--framerate', '20', '--server-option', '--port=9090', '--server-option', '-max-queued-connections=30','--server-option','-max-streams=25','--server-option','-max-threads=29','--vflip','yes','--hflip','yes'];

uv4lProc  = spawn('uv4l', args);

uv4lProc.stdout.on('data', (data) => {
  console.log(`stdout: ${data}`);
});

uv4lProc.stderr.on('data', (data) => {
  console.log(`stderr: ${data}`);
});

uv4lProc.on('close', (code) => {
  console.log(`child process exited with code ${code}`);
});
*/



        
module.exports = function(app,enableMotionSensor,debugMode,io,logger) {
    var hasBeenOpened = garageIsOpen();
	var messenger = require('./messenger.js')(logger,debugMode);
	var twilioLoginInfo = require('../settings/twilioLoginInfo.js');


    garageSensor.watch(function(err, value) {
    	if(err){
    		logger.error('Error watching garage sensor: ',err);
    	}
    	if (value==1 && !hasBeenOpened){
    		hasBeenOpened = true;
     		var msg = 'Garage door opened';
            clearTimeout(garageSensorTimeoutOne);
            garageSensorTimeoutOne = setTimeout(function(){
                shouldSendGarageDoorAlertOne = true;
            },1*60*10000);

            if(shouldSendGarageDoorAlertOne){
                messenger.send(twilioLoginInfo.toNumbers,msg);
                shouldSendGarageDoorAlertOne = false;
            }
            logger.debug(msg);
    		io.sockets.emit('garageErrorStatus', null);
    		
			if(garageOpenStatus=='Opening...'){
				io.sockets.emit('garageOpenStatus', null);
				garageOpenStatus = null;
			}
			io.sockets.emit('garageStatus', 'open');
			
			
    	} else if (value==0 && hasBeenOpened){
    		hasBeenOpened = false;
    		var msg = 'Garage door closed';
            clearTimeout(garageSensorTimeoutTwo);
            garageSensorTimeoutTwo = setTimeout(function(){
                shouldSendGarageDoorAlertTwo = true;
            },1*60*10000);

            if(shouldSendGarageDoorAlertTwo){
                messenger.send(twilioLoginInfo.toNumbers,msg);
                shouldSendGarageDoorAlertTwo = false;
            }
            logger.debug(msg);
			io.sockets.emit('garageErrorStatus', null);
			if(garageOpenStatus=='Closing...'){
				io.sockets.emit('garageOpenStatus', null);
				garageOpenStatus = null;
			}
			io.sockets.emit('garageStatus', 'closed');
    	}
    });

    if(enableMotionSensor){
    	motionSensor.watch(function(err, value) {
    		if(err){
    			logger.error('Error watching motion sensor: ',err);
    		}
    		if (value==1 && !hasSentMotionSensorAlert){
    			clearTimeout(motionSensorTimeoutOne);
    			motionSensorTimeoutOne = setTimeout(function(){
    			   hasSentMotionSensorAlert = true;
    			}, 2*60*1000);
    			var msg = 'Motion detected in garage'
    			logger.debug(msg);
    	 		messenger.send(twilioLoginInfo.toNumbers,msg);
    		} else if (value==0 && hasSentMotionSensorAlert){
    			clearTimeout(motionSensorTimeoutTwo);
    			motionSensorTimeoutTwo = setTimeout(function(){
    			   hasSentMotionSensorAlert = false;
    			}, 2*60*1000);
    		}
    	});
    }




    function garageIsOpen(){
        var isOpen = (garageSensor.readSync()==1) ? true :  false;
        return isOpen;
    }

    function toggleGarageDoor(){
        logger.debug('toggling now');
        if(!debugMode){
            logger.debug('opening/closing now');
            garageSwitch.writeSync(1);
            garageTimeout = setTimeout(function(){
                garageSwitch.writeSync(0);
            },1000);
        }
    }

	

    io.on('connection', function(socket) {
    	sockets[socket.id] = socket;
    	logger.info('Total clients connected : ', Object.keys(sockets).length);
    	io.sockets.emit('clients', Object.keys(sockets).length);
    	socket.on('disconnect', function() {
    	delete sockets[socket.id];
    	// no more sockets, kill the stream
    	if (Object.keys(sockets).length === 0) {
    		app.set('watchingFile', false);
    		if (raspistillProc) raspistillProc.kill();
    		fs.unwatchFile('./stream/image_stream.jpg');
    	}
    	});
    	if(garageIsOpen()){
    		io.sockets.emit('garageStatus', 'open');
    	} else {
    		io.sockets.emit('garageStatus', 'closed');
    	}

    });

    function stopStreaming() {
    	if (Object.keys(sockets).length === 0) {
    		app.set('watchingFile', false);
    	if (raspistillProc) raspistillProc.kill();
    		fs.unwatchFile('./stream/image_stream.jpg');
    	}
    }



	return {
		garageIsOpen: garageIsOpen,
		toggleGarageDoor: toggleGarageDoor
	}
}


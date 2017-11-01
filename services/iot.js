var sockets = {};
var Gpio = require('onoff').Gpio;
var spawn = require('child_process').spawn;
var fs = require('fs');

var motionSensor = new Gpio(15, 'in', 'both');
var garageSensor = new Gpio(4, 'in', 'both');
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
var garageOpened = false;
var sendPicture = false;

module.exports = function(app, enableMotionSensor, debugMode, io, logger) {
    var hasBeenOpened = garageIsOpen();
    const messenger = require('./messenger.js')(logger, debugMode);
    const twilioLoginInfo = require('../settings/twilioLoginInfo.js');
    const hue = require('./hue.js')(logger);
    const options = require('../settings/options.js');

    garageSensor.watch(function(err, value) {
        if (err) {
            logger.error('Error watching garage sensor: ', err);
        }
        if (value == 1 && !hasBeenOpened) {
            hasBeenOpened = true;
            garageOpened = true;
            var msg = 'Garage door opened';
            hue.garageLightsOn15();

            clearTimeout(garageSensorTimeoutOne);
            garageSensorTimeoutOne = setTimeout(function() {
                shouldSendGarageDoorAlertOne = true;
            }, 1 * 60 * 10000);

            if (shouldSendGarageDoorAlertOne) {
                if (options.enableTexting) {
                    messenger.send(twilioLoginInfo.toNumbers, msg);
                }
                if (options.enableIfttt) {
                    messenger.sendIftt(garageOpened);
                }
                shouldSendGarageDoorAlertOne = false;
            }
            logger.debug(msg);
            io.sockets.emit('garageErrorStatus', null);
        } else if (value == 0 && hasBeenOpened) {
            hasBeenOpened = false;
            garageOpened = false;
            var msg = 'Garage door closed';
            hue.garageLightsOn15();
            clearTimeout(garageSensorTimeoutTwo);
            garageSensorTimeoutTwo = setTimeout(function() {
                shouldSendGarageDoorAlertTwo = true;
            }, 1 * 60 * 10000);

            if (shouldSendGarageDoorAlertTwo) {
                if (options.enableTexting) {
                    messenger.send(twilioLoginInfo.toNumbers, msg);
                }
                if (options.enableIfttt) {
                    messenger.sendIftt(garageOpened);
                }
                shouldSendGarageDoorAlertTwo = false;
            }
            logger.debug(msg);
            io.sockets.emit('garageErrorStatus', null);
        }
    });

    if (enableMotionSensor) {
        motionSensor.watch(function(err, value) {
            if (err) {
                logger.error('Error watching motion sensor: ', err);
            }
            if (value == 1 && !hasSentMotionSensorAlert) {
                clearTimeout(motionSensorTimeoutOne);
                motionSensorTimeoutOne = setTimeout(function() {
                    hasSentMotionSensorAlert = true;
                }, 2 * 60 * 1000);
                var msg = 'Motion detected in garage';
                logger.debug(msg);
                messenger.send(twilioLoginInfo.toNumbers, msg);
            } else if (value == 0 && hasSentMotionSensorAlert) {
                clearTimeout(motionSensorTimeoutTwo);
                motionSensorTimeoutTwo = setTimeout(function() {
                    hasSentMotionSensorAlert = false;
                }, 2 * 60 * 1000);
            }
        });
    }

    function garageIsOpen() {
        var isOpen = garageSensor.readSync() == 1 ? true : false;
        return isOpen;
    }

    function toggleGarageDoor() {
        logger.debug('toggling now');
        if (!debugMode) {
            logger.debug('opening/closing now');
            garageSwitch.writeSync(1);
            garageTimeout = setTimeout(function() {
                garageSwitch.writeSync(0);
            }, 1000);
        }
    }

    io.on('connection', function(socket) {
        sockets[socket.id] = socket;
        logger.info('Total clients connected : ', Object.keys(sockets).length);
        io.sockets.emit('clients', Object.keys(sockets).length);

        hue.garageLightsOn15();

        socket.on('disconnect', function() {
            delete sockets[socket.id];
            logger.info(
                'Client Disconnected, total clients connected : ',
                Object.keys(sockets).length
            );
            stopStreaming();
        });
        if (garageIsOpen()) {
            io.sockets.emit('garageStatus', 'open');
        } else {
            io.sockets.emit('garageStatus', 'closed');
        }
        socket.on('start-stream', function() {
            startStreaming(io);
        });
    });

    function stopStreaming() {
        // no more sockets, kill the stream
        if (Object.keys(sockets).length === 0) {
            var lightOn = false;
            hue.garageLightsOff5(lightOn);
            app.set('watchingFile', false);
            if (raspistillProc) raspistillProc.kill();
            fs.unwatchFile('./stream/image_stream.jpg');
        }
    }

    function updateGarageStatus(status) {
        garageOpenStatus = status;
        return;
    }

    function startStreaming(io) {
        if (app.get('watchingFile')) {
            io.sockets.emit(
                'liveStream',
                '/stream/image_stream.jpg?_t=' + Math.random() * 100000
            );
            return;
        }
        var args = [
            '-w',
            '800',
            '-h',
            '600',
            '-vf',
            '-hf',
            '-o',
            './stream/image_stream.jpg',
            '-t',
            '999999999',
            '-tl',
            '1000',
            '-ex',
            'night'
        ];
        raspistillProc = spawn('raspistill', args);
        logger.debug('Watching for changes...');
        app.set('watchingFile', true);
        fs.watchFile('./stream/image_stream.jpg', function(current, previous) {
            io.sockets.emit(
                'liveStream',
                '/stream/image_stream.jpg?_t=' + Math.random() * 100000
            );
            fs.stat('./stream/image_stream.jpg', function(err, stats) {
                if (stats) {
                    var mtime = new Date(stats.mtime);
                    io.sockets.emit('liveStreamDate', mtime.toString());
                    if (garageIsOpen()) {
                        if (garageOpenStatus == 'Opening...') {
                            console.log('status', garageOpenStatus);
                            io.sockets.emit('garageOpenStatus', null);
                            garageOpenStatus = null;
                        }
                        io.sockets.emit('garageStatus', 'open');
                    } else {
                        console.log('status close', garageOpenStatus);
                        if (garageOpenStatus == 'Closing...') {
                            io.sockets.emit('garageOpenStatus', null);
                            garageOpenStatus = null;
                        }
                        io.sockets.emit('garageStatus', 'closed');
                    }
                }
            });
        });
    }

    return {
        garageIsOpen: garageIsOpen,
        toggleGarageDoor: toggleGarageDoor,
        updateGarageStatus: updateGarageStatus
    };
};

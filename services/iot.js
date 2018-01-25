var sockets = {};
var Gpio = require('onoff').Gpio;
var spawn = require('child_process').spawn;
var fs = require('fs');
var path = require('path');

var motionSensor = new Gpio(15, 'in', 'both');
var garageSensor = new Gpio(4, 'in', 'both');
var garageSwitch = new Gpio(21, 'out');
var garageTimeout = null;
var motionSensorTimeoutOne = null;
var motionSensorTimeoutTwo = null;
var garageOpenStatus = null;
var hasSentMotionSensorAlert = false;
var shouldSendGarageDoorAlertOne = true;
var shouldSendGarageDoorAlertTwo = true;
var garageSensorTimeoutOne = null;
var garageSensorTimeoutTwo = null;
var raspistillProc;
var convertProc;
var garageOpened = false;
var garageOpenAlertTimeout = null;
var garageOpenAlertMessageTimeout = null;
var pictureCounter = 0;

module.exports = function(app, enableMotionSensor, debugMode, io, logger) {
    var hasBeenOpened = garageIsOpen();
    const messenger = require('./messenger.js')(logger, debugMode);
    const messengerInfo = require('../settings/messengerInfo.js');
    const hue = require('./hue.js')(logger);
    const options = require('../settings/options.js');
    app.set('takingVideo', false);

    garageSensor.watch(function(err, value) {
        if (err) {
            logger.error('Error watching garage sensor: ', err);
        }
        if (value == 1 && !hasBeenOpened) {
            hasBeenOpened = true;
            garageOpened = true;
            var msg = 'Garage door opened';
            hue.garageLightsOnTimed();

            clearTimeout(garageSensorTimeoutOne);
            garageSensorTimeoutOne = setTimeout(() => {
                shouldSendGarageDoorAlertOne = true;
            }, 1 * 60 * 10000);

            clearTimeout(garageOpenAlertTimeout);
            garageOpenAlertTimeout = setTimeout(() => {
                if (garageIsOpen()) {
                    startCamera();
                    garageOpenAlertMessageTimeout = setTimeout(() => {
                        var garageAlertMsg = `Garage has been open for more than: ${
                            options.garageOpenAlertMins
                        } minutes!`;
                        logger.debug(garageAlertMsg);
                        if (options.garageOpenMinsAlert) {
                            streamVideo().then(() => {
                                messenger.send(
                                    options.alertButtonPressTexts,
                                    messengerInfo.toNumbers,
                                    garageAlertMsg,
                                    options.alertSendPictureText,
                                    true
                                );
                            });
                        }
                        messenger.sendIfttGarageOpenedAlert(
                            options.iftttSendGarageOpenAlert,
                            options.garageOpenAlertMins
                        );
                        app.set('takingVideo', false);
                        stopStreaming();
                    }, 30 * 1000);
                }
            }, options.garageOpenAlertMins * 60 * 1000);

            if (shouldSendGarageDoorAlertOne) {
                if (options.alertButtonPressTexts) {
                    messenger.send(
                        true,
                        messengerInfo.toNumbers,
                        msg,
                        false,
                        false
                    );
                }
                messenger.sendIftt(garageOpened);

                shouldSendGarageDoorAlertOne = false;
            }
            logger.debug(msg);
            io.sockets.emit('garageErrorStatus', null);
        } else if (value == 0 && hasBeenOpened) {
            hasBeenOpened = false;
            garageOpened = false;
            var msg = 'Garage door closed';
            hue.garageLightsOnTimed();
            clearTimeout(garageSensorTimeoutTwo);
            garageSensorTimeoutTwo = setTimeout(() => {
                shouldSendGarageDoorAlertTwo = true;
            }, 1 * 60 * 10000);

            if (shouldSendGarageDoorAlertTwo) {
                if (options.alertButtonPressTexts) {
                    messenger.send(
                        true,
                        messengerInfo.toNumbers,
                        msg,
                        false,
                        false
                    );
                }
                messenger.sendIftt(garageOpened);
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
                messenger.send(
                    true,
                    messengerInfo.toNumbers,
                    msg,
                    false,
                    false
                );
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
        if (!debugMode) {
            logger.debug('Opening/closing door now');
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

        hue.garageLightsOnTimed();

        socket.on('disconnect', function() {
            delete sockets[socket.id];
            logger.info(
                'Client Disconnected, total clients connected : ',
                Object.keys(sockets).length
            );
            hue.garageLightsOffTimed();
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
        if (Object.keys(sockets).length === 0 && !app.get('takingVideo')) {
            app.set('watchingFile', false);
            if (raspistillProc) raspistillProc.kill();
            fs.unwatchFile('./stream/image_stream.jpg');
        }
    }

    function startCamera() {
        hue.garageLightsOnTimed();
        // streamVideo();
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

        logger.debug('Starting camera...');
        app.set('watchingFile', true);
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
        startCamera();
        logger.debug('Watching for changes...');
        fs.watchFile('./stream/image_stream.jpg', function(current, previous) {
            fs.stat('./stream/image_stream.jpg', function(err, stats) {
                if (stats) {
                    var mtime = new Date(stats.mtime);
                    io.sockets.emit(
                        'liveStream',
                        '/stream/image_stream.jpg?_t=' + Math.random() * 100000
                    );
                    io.sockets.emit('liveStreamDate', mtime.toString());
                    if (garageIsOpen()) {
                        if (garageOpenStatus == 'Opening...') {
                            logger.debug('status', garageOpenStatus);
                            io.sockets.emit('garageOpenStatus', null);
                            garageOpenStatus = null;
                        }
                        io.sockets.emit('garageStatus', 'open');
                    } else {
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

    function streamVideo() {
        return new Promise(function(resolve, reject) {
            pictureCounter = 0;
            logger.debug('streaming video');
            deleteStream();

            if (!app.get('takingVideo')) {
                app.set('takingVideo', true);
                fs.watchFile('./stream/image_stream.jpg', function(
                    current,
                    previous
                ) {
                    fs.stat('./stream/image_stream.jpg', function(err, stats) {
                        if (stats && app.get('takingVideo')) {
                            var mtime = new Date(stats.mtime);
                            logger.debug('stats', stats.mtime);
                            logger.debug('picture counter', pictureCounter);
                            fs
                                .createReadStream('./stream/image_stream.jpg')
                                .pipe(
                                    fs.createWriteStream(
                                        './stream/video/' +
                                            pictureCounter++ +
                                            '.jpg'
                                    )
                                );

                            if (pictureCounter > 5) {
                                logger.debug('count greater than 5');
                                var args = [
                                    '-loop',
                                    '0',
                                    './stream/video/*.jpg',
                                    '-resize',
                                    '100%',
                                    './stream/video.gif'
                                ];

                                convertProc = spawn('convert', args);

                                convertProc.stdout.on('data', data => {
                                    logger.debug(`stdout: ${data}`);
                                });

                                convertProc.stderr.on('data', data => {
                                    logger.error(`stderr: ${data}`);
                                });
                                convertProc.on('exit', () => {
                                    pictureCounter = 0;
                                    deleteStream();
                                    app.set('takingVideo', false);
                                    resolve();
                                });
                            }
                        }
                    });
                });
            }
        });
    }

    function rmDir(dirPath) {
        try {
            var files = fs.readdirSync(dirPath);
        } catch (e) {
            return;
        }
        if (files.length > 0) {
            for (var i = 0; i < files.length; i++) {
                var filePath = dirPath + '/' + files[i];
                if (fs.statSync(filePath).isFile()) {
                    fs.unlinkSync(filePath);
                } else {
                    rmDir(filePath);
                }
            }
        }
    }

    function deleteStream() {
        if (convertProc) convertProc.kill();
        console.log('deleteing stream');
        var directory = './stream/video/';
        rmDir(directory);
    }

    //testVideo();
    function testVideo() {
        startCamera();
        console.log('about to stream video');

        streamVideo().then(() => {
            console.log('done streaming video');
        });
        console.log('taking video');
        app.set('takingVideo', true);
        var garageAlertMsg = `test gif`;
        logger.debug(garageAlertMsg);
        messenger.send(
            options.alertButtonPressTexts,
            messengerInfo.toTestNumbers,
            garageAlertMsg,
            options.alertSendPictureText,
            true
        );
    }

    return {
        streamVideo: streamVideo,
        garageIsOpen: garageIsOpen,
        toggleGarageDoor: toggleGarageDoor,
        updateGarageStatus: updateGarageStatus
    };
};

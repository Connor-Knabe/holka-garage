var fs = require('fs');
var raspistillProc;
var convertProc;
var sockets = {};

module.exports = (logger, io) => {
    const hue = require('./hue.js')(logger);
    const iot = require('./iot.js')();
    io.on('connection', function (socket) {
        sockets[socket.id] = socket;
        logger.info('Total clients connected : ', Object.keys(sockets).length);
        io.sockets.emit('clients', Object.keys(sockets).length);

        hue.garageLightsOnTimed();

        socket.on('disconnect', function () {
            delete sockets[socket.id];
            logger.info(
                'Client Disconnected, total clients connected : ',
                Object.keys(sockets).length
            );
            hue.garageLightsOffTimed();
            stopStreaming();
        });

        if (iot.garageIsOpen()) {
            io.sockets.emit('garageStatus', 'open');
        } else {
            io.sockets.emit('garageStatus', 'closed');
        }

        socket.on('start-stream', function () {
            startStreaming(io);
        });
    });

    function stopStreaming() {
        // no more sockets, kill the stream
        if (Object.keys(sockets).length === 0 && !app.get('takingVideo')) {
            app.set('cameraOn', false);
            if (raspistillProc) raspistillProc.kill();
            fs.unwatchFile('./stream/image_stream.jpg');
        }
    }

    function startCamera() {
        hue.garageLightsOnTimed();
        logger.debug('camera status', !app.get('cameraOn'));
        if (!app.get('cameraOn')) {
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
            app.set('cameraOn', true);
        }
    }


    function startStreaming(io) {
        if (app.get('cameraOn')) {
            io.sockets.emit(
                'liveStream',
                '/stream/image_stream.jpg?_t=' + Math.random() * 100000
            );
            return;
        }
        startCamera();
        logger.debug('Watching for changes...');
        fs.watchFile('./stream/image_stream.jpg', function (current, previous) {
            fs.stat('./stream/image_stream.jpg', function (err, stats) {
                if (stats) {
                    logger.debug('Updated image from stream');
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
        return new Promise((resolve, reject) => {
            logger.debug('About to stream video');
            if (!app.get('takingVideo')) {
                pictureCounter = 0;
                startCamera();
                deleteStream().then(() => {
                    logger.debug('Wasnt already taking video, starting stream');
                    app.set('takingVideo', true);
                    fs.watchFile('./stream/image_stream.jpg', function (current, previous) {
                        fs.stat('./stream/image_stream.jpg', function (err, stats) {
                            if (stats && app.get('takingVideo')) {
                                var mtime = new Date(stats.mtime);
                                logger.debug('stats', stats.mtime);
                                logger.debug('picture counter', pictureCounter);
                                fs.createReadStream('./stream/image_stream.jpg').pipe(fs.createWriteStream('./stream/video/' + pictureCounter++ + '.jpg'));

                                if (pictureCounter > options.numberOfGifFrames && needsToConvert) {
                                    needsToConvert = false;
                                    logger.debug(`count greater than ${options.numberOfGifFrames}`);
                                    var args = [
                                        '-loop',
                                        '0',
                                        './stream/video/*.jpg',
                                        '-resize',
                                        '50%',
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
                                        logger.debug('picture count 0');
                                        deleteStream().then(() => {
                                            logger.debug('taking video now set to false');
                                            app.set('takingVideo', false);
                                            stopStreaming();
                                            needsToConvert = true;
                                            resolve();
                                        });
                                    });
                                }
                            }
                        });
                    });

                });
            }
        });
    }

    function rmDir(dirPath) {
        return new Promise((resolve, reject) => {
            try {
                var files = fs.readdirSync(dirPath);
                console.log('files', files);
            } catch (e) {
                console.log('error', e);
                resolve();
                return;
            }
            if (files.length > 0) {
                console.log('more files to delete');
                for (var i = 0; i < files.length; i++) {
                    var filePath = dirPath + '/' + files[i];
                    if (i == files.length - 1) {
                        fs.unlinkSync(filePath);
                        resolve();
                    } else if (fs.statSync(filePath).isFile()) {
                        fs.unlinkSync(filePath);
                    } else {
                        rmDir(filePath);
                    }
                }
            } else {
                resolve();
            }
        });
    }

    function deleteStream() {
        return new Promise((resolve, reject) => {
            if (convertProc) convertProc.kill();
            console.log('deleteing stream');
            var directory = './stream/video/';
            rmDir(directory).then(() => {
                logger.debug('resolving from delete stream');
                resolve();
            });
        });

    }
    return {
        streamVideo: streamVideo
    };
};
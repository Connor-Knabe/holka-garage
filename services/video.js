var fs = require('fs');
var raspistillProc;
var convertProc;
var sockets = {};
var Gpio = require('onoff').Gpio;
var spawn = require('child_process').spawn;

var garageSensor = new Gpio(4, 'in', 'both');
var pictureCounter = 0;
var needsToConvert = true;
const options = require('../settings/options.js');
var garageOpenStatus = null;

module.exports = (app, logger, io) => {
	const hue = require('./hue.js')(logger);
	const remove = require('./remove.js')(convertProc, logger);

	io.on('connection', function(socket) {
		sockets[socket.id] = socket;
		logger.debug('Total clients connected : ', Object.keys(sockets).length);
		io.sockets.emit('clients', Object.keys(sockets).length);

		socket.on('disconnect', function() {
			delete sockets[socket.id];
			logger.debug('Client Disconnected, total clients connected : ', Object.keys(sockets).length);
			hue.garageLightsOffTimed();
			stopStreaming();
		});

		if (garageIsOpen()) {
			io.sockets.emit('garageStatus', 'open');
		} else {
			io.sockets.emit('garageStatus', 'closed');
		}

		if (garageGpsEnabledMain()) {
			io.sockets.emit('garageGPSStatus', 'enabled');
		} else {
			io.sockets.emit('garageGPSStatus', 'disabled');
		}

		if (app.get('takingVideo')) {
			io.sockets.emit('garageOpenStatus', 'Recording video');
		}

		socket.on('start-stream', function() {
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
		hue.garageLightsOnTimed(100);
		if (!app.get('cameraOn')) {
			var args = [ '-w', '800', '-h', '600', '-vf', '-hf', '-o', './stream/image_stream.jpg', '-t', '999999999', '-tl', '1000', '-ex', 'night' ];
			raspistillProc = spawn('raspistill', args);
			app.set('cameraOn', true);
		}
	}
	function garageIsOpen() {
		var isOpen = garageSensor.readSync() == 1 ? true : false;
		return isOpen;
	}
	function garageGpsEnabledMain() {
		return options.garageGpsEnabledMain;
	}

	function startStreaming(io) {
		if (app.get('cameraOn')) {
			io.sockets.emit('liveStream', '/stream/image_stream.jpg?_t=' + Math.random() * 100000);
			return;
		}
		startCamera();
		fs.watchFile('./stream/image_stream.jpg', function(current, previous) {
			fs.stat('./stream/image_stream.jpg', function(err, stats) {
				if (stats) {
					var mtime = new Date(stats.mtime);
					io.sockets.emit('liveStream', '/stream/image_stream.jpg?_t=' + Math.random() * 100000);
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
				remove
					.deleteStream()
					.then(() => {
						app.set('takingVideo', true);
						fs.watchFile('./stream/image_stream.jpg', function(current, previous) {
							fs.stat('./stream/image_stream.jpg', function(err, stats) {
								if (stats && app.get('takingVideo')) {
									var mtime = new Date(stats.mtime);
									fs.createReadStream('./stream/image_stream.jpg').pipe(fs.createWriteStream('./stream/video/' + pictureCounter++ + '.jpg'));

									if (pictureCounter > options.numberOfGifFrames && needsToConvert) {
										needsToConvert = false;
										logger.debug(`count greater than ${options.numberOfGifFrames}`);
										var args = [ '-loop', '0', './stream/video/*.jpg', '-resize', '50%', './stream/video.gif' ];

										convertProc = spawn('convert', args);
										convertProc.stdout.on('data', (data) => {
											logger.debug(`stdout: ${data}`);
										});

										convertProc.stderr.on('data', (data) => {
											logger.error(`stderr: ${data}`);
										});
										convertProc.on('exit', () => {
											pictureCounter = 0;
											remove
												.deleteStream()
												.then(() => {
													logger.debug('taking video now set to false');
													app.set('takingVideo', false);
													stopStreaming();
													needsToConvert = true;
													resolve();
												})
												.catch(() => {});
										});
									}
								}
							});
						});
					})
					.catch(() => {});
			} else {
				logger.error('rejecting stream video');
				reject();
			}
		});
	}

	function updateGarageStatus(status) {
		garageOpenStatus = status;
		return;
	}

	return {
		streamVideo: streamVideo,
		stopStreaming: stopStreaming,
		updateGarageStatus: updateGarageStatus
	};
};

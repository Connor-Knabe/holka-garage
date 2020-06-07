const fs = require('fs');

module.exports = (convertProc, logger) => {
	function rmDir(dirPath) {
		return new Promise((resolve, reject) => {
			try {
				var files = fs.readdirSync(dirPath);
			} catch (e) {
				logger.error('Issue deleting files', e);
				resolve();
				return;
			}
			if (files.length > 0) {
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
			var directory = './stream/video/';
			rmDir(directory)
				.then(() => {
					resolve();
				})
				.catch(() => {});
		});
	}

	return {
		deleteStream: deleteStream
	};
};

const fs = require('fs');

module.exports = (convertProc) => {

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
        deleteStream: deleteStream
    };
};
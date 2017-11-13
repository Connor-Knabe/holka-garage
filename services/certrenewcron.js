var CronJob = require('cron').CronJob;
var certbotProc;
var spawn = require('child_process').spawn;

//jan 25
module.exports = function(logger) {
    var certbotRenew = new CronJob(
        '00 45 7 * * 0',
        () => {
            logger.info(new Date(), 'running cert renew');
            if (certbotProc) certbotProc.kill();

            certbotProc = spawn('certbot', ['renew']);

            certbotProc.stdout.on('data', data => {
                logger.info(`Certbot info: ${data}`);
            });

            certbotProc.stderr.on('data', data => {
                logger.error(`Certbot error: ${data}`);
            });

            certbotProc.on('close', code => {
                logger.info(`Certbot process exited with code ${code}`);
            });
        },
        () => {
            /* This function is executed when the job stops */
        },
        true /* Start the job right now */,
        'America/Chicago'
    );
};

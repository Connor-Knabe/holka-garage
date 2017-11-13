var CronJob = require('cron').CronJob;
var certbotProc;
//jan 25
var certbotRenew = new CronJob(
    '00 40 6 * * 0',
    () => {
		console.log(new Date(),'running cert renew');
        if (certbotProc) certbotProc.kill();
        certbotProc = spawn('certbot', ['renew']);
    },
    () => {
        /* This function is executed when the job stops */
    },
    true /* Start the job right now */,
    'America/Chicago'
);

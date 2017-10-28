var CronJob = require('cron').CronJob;
var certbotProc;

var certbotRenew = new CronJob('00 40 6 * * 0', function() {
        if (certbotProc) certbotProc.kill();
        certbotProc = spawn('certbot',['renew']);
    }, function () {
    /* This function is executed when the job stops */
    },
    true, /* Start the job right now */
    "America/Chicago"
);

var messageTimeout=null;
var messageCount = 0;

module.exports = function(logger) {
    console.log('logger2',logger);
    function send(numbers, msgContent){
        clearTimeout(messageTimeout);
        messageTimeout = setTimeout(function(){
            messageCount=0;
        }, 1*60*60*1000)
        messageCount++;

        if(numbers && messageCount<10) {
            for (var i = 0; i < numbers.length; i++) {
                if(numbers[i].email){
                    sendEmail(numbers[i],msgContent);
                }
                if(numbers[i].number){

                    logger.debug('number',numbers[i].number);
                    sendText(numbers[i],msgContent);
                }
            }
        }
    }

    function sendText(alertInfo, msgContent){
        if(!debugMode){
            client.messages.create({
                to: alertInfo.number,
                from: twilioLoginInfo.fromNumber,
                body: msgContent
            }, function(err, message) {
                if(err){
                    logger.error(new Date(), ' Error sending text message for message: ', message, '\nFor error: ', err);
                } else {
                    logger.info(new Date(),' Text sent: ', msgContent);
                }
            });
        } else {
            logger.info('Not sending text in debug mode. Message contains:',msgContent);
        }
    }

    function sendEmail(alertInfo, msgContent){
        var transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: twilioLoginInfo.gmailUsername,
                pass: twilioLoginInfo.gmailPass
            }
        });
        var mailOptions = {
            from: twilioLoginInfo.gmailUsername,
            to: alertInfo.email,
            subject: 'Garge Monitor!',
            text: msgContent
        };
        if(!debugMode){
            transporter.sendMail(mailOptions, function(error, info){
                if(error){
                    return logger.error(error);
                }
                logger.info(new Date(),' Email sent: ', msgContent);
            });
        } else {
            logger.info(new Date(), 'not sending email in debug mode', msgContent);
        }
    }

    return {
        send:send
    }

}

var messageTimeout = null;
var messageCount = 0;
var twilio = require('twilio');
var twilioLoginInfo = require('../settings/twilioLoginInfo.js');
var login = require('../settings/login.js');
var rp = require('request-promise');

var client = twilio(
    twilioLoginInfo.TWILIO_ACCOUNT_SID,
    twilioLoginInfo.TWILIO_AUTH_TOKEN
);

module.exports = function(logger, debugMode) {
    function sendIftt(garageOpened) {
        for (var i = 0; i < login.iftttRecipients.length; i++) {
            requestIfttt(garageOpened, login.iftttRecipients[i].ApiKey);
        }
    }

    function requestIfttt(garageOpened, apiKey) {
        var url = login.iftttGarageClosedUrl;
        if (garageOpened) {
            url = login.iftttGarageOpenedUrl;
        }
        logger.debug(
            'requesting ifttt with url: ',
            url,
            '. Garage opened:',
            garageOpened
        );
        url += apiKey;
        var options = {
            method: 'POST',
            uri: url,
            body: {
                value1: login.iftttSecret
            },
            json: true
        };

        rp(options)
            .then(function(parsedBody) {
                // POST succeeded...
            })
            .catch(function(err) {
                // POST failed...
            });
    }

    function send(numbers, msgContent, sendPicture) {
        clearTimeout(messageTimeout);
        messageTimeout = setTimeout(function() {
            messageCount = 0;
        }, 1 * 60 * 60 * 1000);
        messageCount++;

        if (numbers && messageCount < 10) {
            for (var i = 0; i < numbers.length; i++) {
                if (numbers[i].email) {
                    sendEmail(numbers[i], msgContent);
                }
                if (numbers[i].number) {
                    logger.debug('number', numbers[i].number);
                    sendText(numbers[i], msgContent, sendPicture);
                }
            }
        }
    }

    function sendText(alertInfo, msgContent, sendPicture) {
        if (!debugMode) {
            var twilioRequestObj = {
                to: alertInfo.number,
                from: twilioLoginInfo.fromNumber,
                body: msgContent
            };
            var textTimeout = 0;
            if (sendPicture) {
                var pictureUrl =
                    'https://' +
                    login.twilioPictureUser +
                    ':' +
                    login.twilioPicturePass +
                    '@' +
                    login.serverPictureUrl;
                twilioRequestObj = {
                    to: alertInfo.number,
                    from: twilioLoginInfo.fromNumber,
                    body: msgContent,
                    mediaUrl: pictureUrl
                };
                textTimeout = 5;
            }
            logger.info('timeout', textTimeout);

            setTimeout(function() {
                client.messages.create(twilioRequestObj, function(
                    err,
                    message
                ) {
                    if (err) {
                        logger.error(
                            new Date(),
                            ' Error sending text message for message: ',
                            message,
                            '\nFor error: ',
                            err
                        );
                    } else {
                        logger.info(new Date(), ' Text sent: ', msgContent);
                    }
                });
                logger.debug('timeout triggered');
            }, textTimeout * 1000);
        } else {
            logger.info(
                'Not sending text in debug mode. Message contains:',
                msgContent
            );
        }
    }

    function sendEmail(alertInfo, msgContent) {
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
        if (!debugMode) {
            transporter.sendMail(mailOptions, function(error, info) {
                if (error) {
                    return logger.error(error);
                }
                logger.info(new Date(), ' Email sent: ', msgContent);
            });
        } else {
            logger.info(
                new Date(),
                'not sending email in debug mode',
                msgContent
            );
        }
    }

    return {
        send: send,
        sendIftt: sendIftt
    };
};

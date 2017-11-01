var messageTimeout = null;
var messageCount = 0;
const twilio = require('twilio');
const messengerInfo = require('../settings/messengerInfo.js');
const login = require('../settings/login.js');
const rp = require('request-promise');
const options = require('../settings/options.js');
const nodemailer = require('nodemailer');

var client = twilio(
    messengerInfo.TWILIO_ACCOUNT_SID,
    messengerInfo.TWILIO_AUTH_TOKEN
);

module.exports = function(logger, debugMode) {
    function sendIftt(garageOpened) {
        if (options.enableIfttt) {
            for (var i = 0; i < messengerInfo.iftttRecipients.length; i++) {
                requestIfttt(
                    garageOpened,
                    messengerInfo.iftttRecipients[i].ApiKey
                );
            }
        }
    }

    function requestIfttt(garageOpened, apiKey) {
        var url = messengerInfo.iftttGarageClosedUrl;
        if (garageOpened) {
            url = messengerInfo.iftttGarageOpenedUrl;
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
                value1: messengerInfo.iftttSecret
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

    function send(numbers, msgContent, sendPicture = false) {
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
                from: messengerInfo.fromNumber,
                body: msgContent
            };
            var textTimeout = 0;
            if (sendPicture) {
                var pictureUrl =
                    'https://' +
                    messengerInfo.twilioPictureUser +
                    ':' +
                    messengerInfo.twilioPicturePass +
                    '@' +
                    options.serverDomain +
                    messengerInfo.serverPictureUrl;
                twilioRequestObj = {
                    to: alertInfo.number,
                    from: messengerInfo.fromNumber,
                    body: msgContent,
                    mediaUrl: pictureUrl
                };
                textTimeout = messengerInfo.photoTextTiemeoutSeconds;
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
                user: messengerInfo.gmailUsername,
                pass: messengerInfo.gmailPass
            }
        });
        var mailOptions = {
            from: messengerInfo.gmailUsername,
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

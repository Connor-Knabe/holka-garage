module.exports = function(logger, debugMode) {
    var messageTimeout = null;
    var messageCount = 0;
    const twilio = require('twilio');

    const messengerInfo = require('../settings/messengerInfo.js');
    const rp = require('request-promise');
    const options = require('../settings/options.js');
    const nodemailer = require('nodemailer');
    const client = twilio(messengerInfo.TWILIO_ACCOUNT_SID, messengerInfo.TWILIO_AUTH_TOKEN);
    var minsOpened = 0;
    function sendIftt(garageOpened, message) {
        if (options.enableIfttt) {
            var iftttMessage = messengerInfo.iftttValue1;
            if (message) {
                iftttMessage = message;
            }
            for (var i = 0; i < messengerInfo.iftttRecipients.length; i++) {
                requestIfttt(garageOpened, messengerInfo.iftttRecipients[i].ApiKey, minsOpened, iftttMessage);
            }
        }
    }

    function sendGenericIfttt(message) {
        if (options.enableIfttt) {
            messengerInfo.iftttRecipients.forEach(iftttRecipient => {
                // @ts-ignore
                var url = messengerInfo.iftttGarageAlertUrl;
                url += iftttRecipient.ApiKey;
                var options = {
                    method: 'POST',
                    uri: url,
                    body: {
                        value1: message
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
            });
        }
    }

    function sendIfttGarageOpenedAlert(shouldSend = true, minsOpened) {
        if (shouldSend && options.enableIfttt) {
            for (var i = 0; i < messengerInfo.iftttRecipients.length; i++) {
                requestIfttt(null, messengerInfo.iftttRecipients[i].ApiKey, minsOpened, messengerInfo.iftttValue1);
            }
        }
    }

    function requestIfttt(garageOpened, apiKey, minsOpened, message) {
        logger.debug(`Minutes opened request ifttt ${minsOpened}`);
        var url = messengerInfo.iftttGarageClosedUrl;
        if (garageOpened) {
            url = messengerInfo.iftttGarageOpenedUrl;
        } else if (garageOpened === null) {
            url = messengerInfo.iftttGarageOpenAlertUrl;
        }
        logger.debug('requesting ifttt with url: ', url, '. Garage opened:', garageOpened);
        url += apiKey;
        var options = {
            method: 'POST',
            uri: url,
            body: {
                value1: message,
                value2: minsOpened
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

    function send(shouldSend = true, numbers, msgContent, sendPicture = false, btnPress = false) {
        if (!shouldSend) {
            return;
        }

        clearTimeout(messageTimeout);
        messageTimeout = setTimeout(function() {
            messageCount = 0;
        }, 1 * 60 * 60 * 1000);
        messageCount++;
        logger.debug(
            `Sending message? -> msgContent:${msgContent} messageCount:${messageCount} generalTexts:${options.generalTexts}alertButtonPressTexts:${
                options.alertButtonPressTexts
            } btnPress:${btnPress} sendPicture:${sendPicture}`
        );

        if (numbers && messageCount < 10) {
            for (var i = 0; i < numbers.length; i++) {
                if (numbers[i].email) {
                    sendEmail(numbers[i], msgContent);
                }
                if (numbers[i].number) {
                    logger.debug('number', numbers[i].number);
                    if (options.generalTexts || (options.alertButtonPressTexts && btnPress)) {
                        sendText(numbers[i], msgContent, sendPicture);
                    } else {
                        logger.debug(
                            `Not sending texts generalTexts:${options.generalTexts}alertButtonPressTexts:${
                                options.alertButtonPressTexts
                            } btnPress:${btnPress} sendPicture:${sendPicture}`
                        );
                    }
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
                var pictureUrl = 'https://' + messengerInfo.twilioPictureUser + ':' + messengerInfo.twilioPicturePass + '@' + messengerInfo.serverPictureUrl;
                twilioRequestObj = {
                    to: alertInfo.number,
                    from: messengerInfo.fromNumber,
                    body: msgContent,
                    mediaUrl: pictureUrl
                };
                textTimeout = messengerInfo.photoTextTimeoutSeconds;
            }
            logger.debug('timeout', textTimeout);

            setTimeout(function() {
                client.messages.create(twilioRequestObj, (err, message) => {
                    if (err) {
                        logger.error(new Date(), ' Error sending text message for message: ', message, '\nFor error: ', err);
                    } else {
                        logger.info('Msg sid: ', message.sid);

                        setTimeout(() => {
                            if (message && message.sid) {
                                //@ts-ignore
                                client.messages(message.sid).media.each(media => {
                                    if (media && media.sid) {
                                        console.log(`Deleting media for message.sid ${message.sid}`);
                                        client
                                            .messages(message.sid)
                                            .media(media.sid)
                                            //@ts-ignore
                                            .remove()
                                            .then(() => {
                                                logger.info(`Media Sid ${media.sid}  deleted successfully. Message.sid ${message.sid}`);
                                            })
                                            .catch(err => logger.error(`Issue deleting media for Twilio ${err} Message.SID:${message.sid} Media SID:${media.sid}`));
                                    }
                                });
                            }
                        }, 75 * 1000);

                        logger.info(new Date(), ' Text sent: ', msgContent);
                    }
                });
                logger.debug('timeout triggered');
            }, textTimeout * 1000);
        } else {
            logger.info('Not sending text in debug mode. Message contains:', msgContent);
        }
    }

    function sendEmail(alertInfo, msgContent) {
        if (options.emailAlerts) {
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
                logger.info(new Date(), 'not sending email in debug mode', msgContent);
            }
        }
    }

    return {
        send: send,
        sendIftt: sendIftt,
        sendIfttGarageOpenedAlert: sendIfttGarageOpenedAlert,
        sendGenericIfttt: sendGenericIfttt
    };
};

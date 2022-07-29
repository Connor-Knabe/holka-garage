module.exports = function(logger, debugMode) {
	var messageTimeout = null;
	var messageCount = 0;
	const twilio = require('twilio');

	const messengerInfo = require('../settings/messengerInfo.js');
	const got = require('got');
	
	const options = require('../settings/options.js');
	const client = twilio(messengerInfo.TWILIO_ACCOUNT_SID, messengerInfo.TWILIO_AUTH_TOKEN);
	var minsOpened = 0;

	send(true, messengerInfo.toNumbers, 'The garage software has rebooted.  Garage open alerts disabled until you leave home!');

	function sendIftt(garageOpened, message, url) {
		if (options.enableIfttt) {
			var iftttMessage = messengerInfo.iftttValue1;

			if (garageOpened != null) {
				url = garageOpened ? messengerInfo.iftttGarageOpenedUrl : messengerInfo.iftttGarageClosedUrl;
			}

			if (message) {
				iftttMessage = message;
			}

			for (var i = 0; i < messengerInfo.iftttRecipients.length; i++) {
				requestIfttt(url, messengerInfo.iftttRecipients[i].ApiKey, minsOpened, iftttMessage);
			}
		}
	}

	function sendGenericIfttt(message) {
		if (options.enableIfttt) {
			messengerInfo.iftttRecipients.forEach((iftttRecipient) => {
				var url = messengerInfo.iftttGarageAlertUrl;
				url += iftttRecipient.ApiKey;
	
				(async () => {
					const {body} = await got.post(url, {
						json: {
							value1: message
						},
						responseType: 'text'
					});
				})();

			});
		}
	}

	function sendIfttGarageOpenedAlert(shouldSend = true, minsOpened) {
		if (shouldSend && options.enableIfttt) {
			for (var i = 0; i < messengerInfo.iftttRecipients.length; i++) {
				requestIfttt(messengerInfo.iftttGarageOpenAlertUrl, messengerInfo.iftttRecipients[i].ApiKey, minsOpened, messengerInfo.iftttValue1);
			}
		}
	}

	function requestIfttt(url, apiKey, minsOpened, message) {
		logger.debug(`Request ifttt ${minsOpened}, with message ${message}`);
		logger.debug('requesting ifttt with url: ', url + apiKey.substring(0, 5), '<--- key is truncated.');
		url += apiKey;
		(async () => {
			try{
				const {body} = await got.post(url, {
					json: {
						value1: message,
						value2: minsOpened
					},
					responseType: 'text'
				});
			} catch (err){
				logger.error('error making requestIfttt', err);
			}
		})();
	}

	function send(shouldSend = true, numbers, msgContent, sendPicture = false, btnPress = false) {
		if (!shouldSend) {
			return;
		}

		clearTimeout(messageTimeout);
		messageTimeout = setTimeout(function() {
			messageCount = 0;
		}, 1 * 60 * 1000);
		messageCount++;
		logger.debug(
			`Sending message? -> msgContent:${msgContent} \nmessageCount:${messageCount} generalTexts:${options.generalTexts}alertButtonPressTexts:${options.alertButtonPressTexts} btnPress:${btnPress} sendPicture:${sendPicture}`
		);

		if (numbers && messageCount < 10) {
			for (var i = 0; i < numbers.length; i++) {
				if (numbers[i].number) {
					if (options.generalTexts) {
						sendText(numbers[i], msgContent, sendPicture);
					} else if (options.alertButtonPressTexts && btnPress) {
						sendText(numbers[i], msgContent, sendPicture);
					} else {
						logger.debug(`Not sending texts generalTexts:${options.generalTexts}alertButtonPressTexts:${options.alertButtonPressTexts} btnPress:${btnPress} sendPicture:${sendPicture}`);
					}
				}
			}
		}
	}

	function sendCallAlert() {
		var numbers = messengerInfo.toNumbers;

		for (var i = 0; i < numbers.length; i++) {
			client.calls
				.create({
					url: messengerInfo.voiceXmlUrl,
					to: numbers[i].number,
					from: messengerInfo.fromNumber,
					method: 'get'
				})
				.then((call) => logger.info(`Succesfully called ${call} with call.sid: ${call.sid}`))
				.catch((err) => {
					logger.error(`Failed to call via twilio`, err);
				});
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

			setTimeout(function() {
				client.messages.create(twilioRequestObj, (err, message) => {
					if (err) {
						logger.error(new Date(), ' Error sending text message for message: ', message, '\nFor error: ', err);
					} else {
						setTimeout(() => {
							if (message && message.sid) {
								client.messages(message.sid).media.each((media) => {
									if (media && media.sid) {
										(`Deleting media for message.sid ${message.sid}`);
										client
											.messages(message.sid)
											.media(media.sid)
											.remove()
											.then(() => {
												logger.info(`Media Sid ${media.sid}  deleted successfully. Message.sid ${message.sid}`);
											})
											.catch((err) => logger.error(`Issue deleting media for Twilio ${err} Message.SID:${message.sid} Media SID:${media.sid}`));
									}
								});
							}
						}, 75 * 1000);

						logger.info(`Text sent: ${msgContent} to number: ${twilioRequestObj.to} MsgSid: ${message.sid}`);
					}
				});
			}, textTimeout * 1000);
		} else {
			logger.info('Not sending text in debug mode. Message contains:', msgContent);
		}
	}

	return {
		send: send,
		sendIftt: sendIftt,
		sendIfttGarageOpenedAlert: sendIfttGarageOpenedAlert,
		sendGenericIfttt: sendGenericIfttt,
		sendCallAlert: sendCallAlert
	};
};

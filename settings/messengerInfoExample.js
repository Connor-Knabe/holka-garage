module.exports.voiceXmlUrl = 'https://example.com/voice.xml';
module.exports.fromNumber = '5735550333';
module.exports.toNumbers = [
	{
		name: 'Connor',
		number: '314-555-0333',
		email: 'myemailaddress@gmail.com'
	}
];

//For gmail emails must enable less secure apps....
//https://support.google.com/accounts/answer/6010255?hl=en
module.exports.gmailUsername = 'mygmailsendingemail@gmail.com';
module.exports.gmailPass = 'mygmailsendingemailPassword';
module.exports.TWILIO_AUTH_TOKEN = 'authtokenLKAJSLKFDJSSDF';
module.exports.TWILIO_ACCOUNT_SID = 'accountSIDlkasjdf0jSIDFJ11DF';
module.exports.photoTextTimeoutSeconds = 20;

module.exports.iftttRecipients = [ { Name: 'Connor', ApiKey: 'apiKeylaksdjf09sdjf' } ];
module.exports.iftttHomeAwayAccount = { ApiKey: 'lkajsdfj02ijf0', baseUrl: 'https://maker.ifttt.com/trigger/' };

module.exports.iftttGarageOpenedUrl = 'https://maker.ifttt.com/trigger/garage_open_trigger/with/key/';
module.exports.iftttGarageClosedUrl = 'https://maker.ifttt.com/trigger/garage_close_trigger/with/key/';
module.exports.iftttGarageOpenAlertUrl = 'https://maker.ifttt.com/trigger/garage_alert/with/key/';
module.exports.iftttGarageAlertUrl = 'https://maker.ifttt.com/trigger/alert/with/key/';
//set null to disable
module.exports.iftttGarageSetHomeUrl = 'https://maker.ifttt.com/trigger/garage_home/alert/with/key/';
//set null to disable
module.exports.iftttGarageSetAwayUrl = 'https://maker.ifttt.com/trigger/garage_away/alert/with/key/';

module.exports.iftttGarageSetAway2Url = 'https://maker.ifttt.com/trigger/garage_away2/alert/with/key/';

module.exports.iftttValue1 = 'This will be displayed in the notification';

module.exports.twilioPictureUser = 'make this a random string like -> alksjdfiajsd0fjsd';
module.exports.twilioPicturePass = 'make this a random string like -> ksldjf0j2jf0';
module.exports.serverPictureUrl = '/pictures';

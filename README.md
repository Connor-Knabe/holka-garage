# holka-garage

IoT project running on a Raspberry Pi to open/close a garage door and to see if it's opened or closed.

Features:

* Ability to open close garage via website
* Send notifications via IFTTT/Texting when garage opens/closes
* MMS photo sent when garage open/closed clicked

Coming soon:

* Open garage via GPS
* Wire diagram

Required for setup:

1.Raspberry Pi with 16GB+ class 10 SD card  (<https://www.amazon.com/CanaKit-Raspberry-Complete-Starter-Kit/dp/B01C6Q2GSY/ref=sr_1_3?ie=UTF8&qid=1508849215&sr=8-3&keywords=pi+3+kit)>

2.Power relay (<https://www.amazon.com/Indicator-Light-Channel-Module-Arduino/dp/B00P7QDJD2/ref=sr_1_4?s=electronics&ie=UTF8&qid=1508849168&sr=1-4&keywords=power+relay+single+simple)>

3.Optional PIR motion sensor (<https://www.amazon.com/Gowoops-HC-SR501-Pyroelectric-Infrared-Detector/dp/B01MZIQZG1/ref=sr_1_5?ie=UTF8&qid=1508849206&sr=8-5&keywords=pir+motion+sensor)>

4.Pi Camera (<https://www.amazon.com/Arducam-Megapixels-Sensor-OV5647-Raspberry/dp/B012V1HEP4/ref=sr_1_6?ie=UTF8&qid=1508849318&sr=8-6&keywords=raspberry+pi+camera+module>)

5.Door magnent sensor (<https://www.amazon.com/Gikfun-Sensor-Magnetic-Switch-Arduino/dp/B0154PTDFI/ref=sr_1_1_sspa?ie=UTF8&qid=1508849795&sr=8-1-spons&keywords=wired+door+sensor&psc=1>)

6. Optional Hue light bulbs (will need bridge too) (<https://www.amazon.com/Philips-Hue-Equivalent-Dimmable-Assistant/dp/B073SSNNNH/ref=sr_1_4?ie=UTF8&qid=1538656218&sr=8-4&keywords=hue+light+bulbs+white>)

Setup:

1.Setup Rasbperry Pi

2.Get packages installed on RPi <https://github.com/Connor-Knabe/install-scripts>

3.Rename example files in settings folder.  Note the files (login.js, options.js, messengerInfo.js) are .gitignored.  Be sure to NOT commit these files as they contain sensitive info! If you mistype this command you might accidently commit these if you use version control.  Use command below:

    mv optionsExample.js options.js && mv messengerInfoExample.js messengerInfo.js && mv loginExample.js login.js

4.Get a Twilio account (for texting) <https://www.twilio.com/try-twilio>

    4a. Fill out TWILIO_AUTH_TOKEN and TWILIO_ACCOUNT_SID in messengerInfo.js

5.Get an IFTTT account (for push notifications) <https://ifttt.com/join>

    5a.Setup a new applet (webhook, receive a request) with the event name that matches the one in messengerInfoExample.js then notification(garage_open_trigger, garage_alert, etc.)
    5b. Fill out the text such as: {{Value1}} Garage Door Opened or {{Value1}} Garage Door has been open for more than: {{Value2}} minutes!.
    Value1 = iftttValue1 from the messengerInfoExample.js file
    Value2 = mins garage has been opened before alert sends.
    5c.Download and login to the IFTTT mobile app on your phone and turn notifications on.

6.Add your IFTTT API key from <https://ifttt.com/services/maker_webhooks/settings> to the messengerInfo file under iftttRecipients -> ApiKey

7.Clone holka-garage repo <https://github.com/Connor-Knabe/holka-garage>

8.Fill out information including API keys phone numbers etc in the various setting files

9.Use pm2 to start the program using the following command
    sudo pm2 start app.js --name hg && pm2 startup && pm2 --save

10.Setup a domain name and point it to your external ip address.

11.Install ssl certificate <https://github.com/certbot/certbot> use ./certbot-auto certonly --manual --email admin@example.com -d example.com -d www.example.com -d other.example.net note you will need to make sure app.js is running and add a route to routes.js with the specified info to verify this.

11b.If you're using certbot you will want to check to see if you need to renew this script monthly .  You can add a .sh file to /etc/cron.monthly that contains certbot renew --standalone --pre-hook "pm2 stop hg" --post-hook "pm2 start hg" which will run monthly and renew your cert.  Also run sudo chmod +x yourFileName.sh to give permissions to execute it.

12.Change the sslPath variable in login.js to the location of your certificate.

13.Visting https://yourdomain.com should pull up the website.

14.If you've entered geoIpFilter in options.js it will limit ip addresses within those state abbreviations (comma separated) to open the garage door.

15.If you've entered values for vpnIp or localIp it will only allow an ip address from those ip's to open the garage door

#!/bin/sh
sudo pm2 start app.js --name "hg" --watch --ignore-watch "logs stream *.html"
sudo pm2 startup
sudo pm2 save

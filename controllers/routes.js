var twilioLoginInfo = require('../settings/twilioLoginInfo.js');

module.exports = function(app,logger,io,debugMode) {
	var iot = require('../services/iot.js')(app,false,debugMode,io,logger);

    var securityMsgTimeout = null;
    var garageErrorStatus = null;
    var garageOpenStatus = null;
    var shouldSendSecurityAlert = true;

    var messenger = require('../services/messenger.js')(logger,debugMode);
    var fs = require('fs');
    var bodyParser = require('body-parser');
    var login = require('../settings/login.js');

    function auth(req){
        var authenticated = (req && req.cookies && (req.cookies.holkaCookie === login.secretCookie));
        return authenticated;
    }

    function vpnAuth(req){
    	var clientIp = req.connection.remoteAddress;
    	var isOnVpn = clientIp.includes(login.vpnIp);
        return isOnVpn;
    }
    // var router = require('express').Router();
    app.get('/', function(req, res) {
    	if(auth(req)){
    		res.sendFile('admin.html',{'root': './views/'});
    	} else {
            res.sendFile('index.html',{'root': './views/'});
    	}
    });

    app.get('/stream/image_stream.jpg',function(req,res){
        if(auth(req)){
            fs.readFile('./stream/image_stream.jpg', function(err, data) {
              if (err) throw err; // Fail if the file can't be read.
                res.writeHead(200, {'Content-Type': 'image/jpeg'});
                res.end(data); // Send the file data to the browser.
            });
        } else{
            logger.fatal('Unauthorized request for image_stream.jpg',req.connection.remoteAddress);
            res.status(401);
            res.send('not auth');
        }

    });

    app.post('/', function(req,res){
    	if(req.body.username === login.username && req.body.password === login.password ){
    		req.session.userInfo = req.body;
    		var options = {
    	        maxAge: 1000 * 60* 60 * 24  * 180,
    	        httpOnly: true
    	    };
    		res.cookie('holkaCookie', login.secretCookie, options);

    		logger.info('cookies',req.cookies.holkaCookie);
    		res.redirect('/');
    	} else {
    		res.send('Access denied wrong username/password');
    	}
    });


    app.post('/openOrCloseGarage', function(req,res){
        logger.debug('body',req.body);
        if(auth(req) && vpnAuth(req)){
            if(req.body && req.body.garageSwitch == 'open'){
    	        if(!iot.garageIsOpen()){
                    iot.toggleGarageDoor();
    				garageOpenStatus = 'Opening...';
    		   		io.sockets.emit('garageOpenStatus', garageOpenStatus);
    		        var msg = garageOpenStatus+' garage via button';
    		        if(garageOpenStatus){
    		            messenger.send(twilioLoginInfo.toNumbers,msg);
    		        }
    				io.sockets.emit('garageErrorStatus', null);

    	        } else {
    		        logger.debug('err');
    				io.sockets.emit('garageOpenStatus', null);
    				garageErrorStatus = 'Garage is already open!!'
    				io.sockets.emit('garageErrorStatus', garageErrorStatus);
     	        }
            } else if(req.body && req.body.garageSwitch == 'close'){
    	        if(iot.garageIsOpen()){
                    iot.toggleGarageDoor();
    				garageOpenStatus = 'Closing...';
    		   		io.sockets.emit('garageOpenStatus', garageOpenStatus);
    		        var msg = garageOpenStatus+' garage via button';
    		        if(garageOpenStatus){
    		            messenger.send(twilioLoginInfo.toNumbers,msg);
    		        }
    				io.sockets.emit('garageErrorStatus', null);
    	        } else {
    		        logger.debug('err');
    				io.sockets.emit('garageOpenStatus', null);
    				io.sockets.emit('garageErrorStatus', 'Garage is already closed!!');
     	        }
            }
       		io.sockets.emit('garageErrorStatus', null);
            logger.info(msg);
            res.send(garageOpenStatus);
        } else {
    	    var garageStatus = 'hack';
            var hoursToWaitBeforeNextSecurityAlert = 2;
                                    
    	    if(req.body && req.body.garageSwitch == 'open'){
    		    garageStatus = 'open'
    	    } else if(req.body && req.body.garageSwitch == 'close'){
    		    garageStatus = 'close'
    	    }
            var securityMsg = 'SECURITY: tried to '+garageStatus+' garage via post without being authenticated!! From ip: '+req.connection.remoteAddress;
            
            clearTimeout(securityMsgTimeout);
            securityMsgTimeout = setTimeout(function(){
                shouldSendSecurityAlert = true;
            },hoursToWaitBeforeNextSecurityAlert*60*60*10000);

            if(shouldSendSecurityAlert){
                console.log('logger',logger);
                messenger.send(twilioLoginInfo.toNumbers,securityMsg);
                shouldSendSecurityAlert = false;
            }
            logger.fatal(securityMsg,'Ip address is: ',req.connection.remoteAddress);
       		io.sockets.emit('garageErrorStatus', 'You are not authorized to do this!');
            res.status(401);
            res.send('not auth');
        }
    });

};
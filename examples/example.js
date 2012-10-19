var insteon = require('insteon')
var utils   = require('insteon/utils.js')
var port    = "/dev/ttyUSB0"
var logMeta = {source: 'example'}

//There is not currently any intelligence regarding this connection.
//It does not verify a PLM is connected to the port before sending any 
//queued messaged; once the port is open, queued messages are sent.
//It does not offer callbacks for failures/otherwise.
insteon.connect({
	port:port
	//uncommenting the following line will disable logging (don't forget comma above).
	//logger: function(data, source, message){}
})

sentCallback = function(e, r){
	if(!e){
		utils.winston.debug("Successfully sent SD command", logMeta)
	}else{
		utils.winston.error("Error sending SD to PLM: " + e, logMeta)
	}
}

//Notice we don't have to wait for the serial port to be connected.
//The communication driver will automatically queue the
//messages until the connection is made.
insteon.sendSD({
	address  : '111111',
	cmd1     : '11',  //Turn light on
	cmd2     : 'FF',  //to max level
	callback : sentCallback, //called when the command is sent to the PLM.
	success  : false, //Not implemented; callback when ack.
	error    : false, //Not implemented; callback if fail / nak.
	maxAge   : 60*5,  //Not implemented. a value in seconds, this says "don't send this command if it hasn't been sent within this timeframe"
	delay    : 60*5   //Not implemented. a value in seconds, this says "queue this command after this delay."  A value here will automatically
	                  //adjust maxAge by making maxAge += delay.
})

setInterval(function(){
	insteon.sendSD({
		address  : '111111',
		cmd1     : '13', //Turn light off
		cmd2     : '00',
		callback : sentCallback
	});insteon.sendSD({
		address  : '111111',
		cmd1     : '11',
		cmd2     : 'FF',
		callback : sentCallback
	})
}, 2000)
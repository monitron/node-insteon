var insteon = require('insteon')
var port = "/dev/ttyUSB0"


//There is not currently any intelligence regarding this connection.
//It does not verify a PLM is conencted to the port before sending any 
//queued messaged; once the port is open, queued messages are sent.
//It does not offer callbacks for failures/otherwise.
insteon.connect({port:port})

sentCallback = function(e, r){
	if(!e){
		console.log("Successfully sent SD command to PLM")
	}else{
		console.log("Error sending SD to PLM: " + e)	
	}
}

//Notice we don't have to wait for the serial port to be connected.
//The communication driver will automatically queue the
//messages until the connection is made.
insteon.sendSD({
	address  : '111111',
	cmd1     : '11', //Turn light on
	cmd2     : 'FF', //to max level
	callback : sentCallback, //called when the command is sent to the PLM.
	maxAge   : 60*5, //Not implemented. a value in seconds, this says "don't send this command if it hasn't been sent within this timeframe"
	delay    : 60*5  //Not implemented. a value in seconds, this says "queue this command after this delay."  A value here will automatically
	                 //adjust maxAge by making maxAge += delay.
});insteon.sendSD({
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
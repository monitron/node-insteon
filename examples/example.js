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

var callbacks = {
	cbSent     : function(e,sent){
		//This callback fires when the command is sent to the PLM.
		if(!e){
			utils.winston.debug("Began communication (" + sent.debugID + ")", logMeta)
		}else{
			utils.winston.error("Error beginning communication (" + sent.debugID + "): " + e, logMeta)
		}
	},
	cbComplete : function(e, sent){
		//This callback fired when the process is complete.
		if(!e){
			utils.winston.info("Successfully completed communication (" + sent.debugID + ")", logMeta)
		}else{
			utils.winston.error("Failed to complete communication (" + sent.debugID + " - " + e + ")", logMeta)
		}
	}
}
//Notice we don't have to wait for the serial port to be connected.
//The communication driver will automatically queue the
//messages until the connection is made.
insteon.sendSD(utils.extend({
	address  : '111111',
	cmd1     : '11',  //Turn light on
	cmd2     : 'FF',  //to max level
	maxAge   : 60*5,  //Not implemented. a value in seconds, this says "don't send this command if it hasn't been sent within this timeframe"
	delay    : 60*5   //Not implemented. a value in seconds, this says "queue this command after this delay."  A value here will automatically
	                  //adjust maxAge by making maxAge += delay.
}, callbacks) )

setInterval(function(){
	insteon.sendSD(utils.extend({
		address  : '111111',
		cmd1     : '13', //Turn light off
		cmd2     : '00'
	}, callbacks) );insteon.sendSD(utils.extend({
		address  : '111111',
		cmd1     : '11',
		cmd2     : 'FF'
	}, callbacks) )
}, 2000)

//Uncomment the following to make it stop after a time.
// setTimeout(function(){
//         process.exit()
// }, 10000)
var insteon = require('insteon')
var utils   = require('insteon/utils.js')
var logMeta = {source: 'example'}

var port    = "/dev/ttyUSB0"
insteon.connect({ port:port }) //If you don't specify a port, or specify the wrong port, the PLM module should eventually recover
                               //if there is a PLM connected to any port on the system.

var callbacks = {
	cbSent     : function(e,sent){
		//This callback fires when the command is sent to the serial port (an thus to the PLM).
		if(!e){
			utils.winston.debug("Began communication (" + sent.debugID + ")", logMeta)
		}else{
			utils.winston.error("Error beginning communication (" + sent.debugID + "): " + e, logMeta)
		}
	},
	cbComplete : function(e, sent){
		//This callback fires when the process is complete.
		if(!e){
			utils.winston.info("Successfully completed communication (" + sent.debugID + ")", logMeta)
		}else{
			utils.winston.error("Failed to complete communication (" + sent.debugID + " - " + e + ")", logMeta)
		}
	}
}
var desk = new insteon.light({ address: '111111' })

//Notice we don't have to wait for the serial port to be connected.
//The communication driver will automatically queue the
//messages until the connection is made.
setInterval(function(){
	//Light-switch rave party!!!
	
	var lowLevel  = Math.floor(Math.random()*51)
	var highLevel = Math.floor(Math.random()*51)+50
	
	desk.turnOn( utils.extend({level: lowLevel   + '%', maxAge: 5, delay: 10}, callbacks) ) //Won't run because maxAge < delay; will expire.
	desk.turnOn( utils.extend({level: highLevel  + '%', delay: 10}, callbacks) )

	
}, 1000)

//Uncomment the following to make it stop after a time.
// setTimeout(function(){
//         process.exit()
// }, 20000)
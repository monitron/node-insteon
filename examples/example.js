var insteon = require('insteon')
var utils   = require('insteon/utils.js')
var port    = "/dev/ttyUSB0"
var logMeta = {source: 'example'}

insteon.connect({
	port:port
})

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
	//Light-switch rave party!!!
	
	// insteon.lightOff(
	// 	utils.extend({address  : '111111', fast: true}, callbacks)
	// )
	
	var lowLevel  = Math.floor(Math.random()*51)
	var highLevel = Math.floor(Math.random()*51)+50
	insteon.lightOn(
		utils.extend({address  : '111111', level: lowLevel  + '%'}, callbacks)
	)
	insteon.lightOn(
		utils.extend({address  : '111111', level: highLevel + '%'}, callbacks)
	)

	
}, 1000)

//Uncomment the following to make it stop after a time.
// setTimeout(function(){
//         process.exit()
// }, 10000)
/*****************************************
* This module provides a lightweight
* wrapper for the serialport connection
* to a PLM.
*********************/
var SerialPort = require('serialport')
var utils      = require('./utils.js')
var parser     = require('./parser.js').parser
var sp         = null
var events     = require('events')

function logger(level, message){
	utils.log(level, 'plm', message)
}
function PLM(args){
	var self = this
	var port = '/dev/ttyS0' //TODO: check for it.
	if(process.platform == 'win32')  ;//TODO: this
	if(process.platform == 'darwin') ;//TODO: this
	var options = {
		port: port,
		verifyConnection : true, //after the port opens, verify a PLM is connected before allowing communication.

		//It is unlikely you'll want to change the following options, but they're here in case they need be.
		baudrate    : 19200,
		databits    : 8,
		stopbits    : 1,
		parity      : 'none',
		flowcontrol : false,
		parser      : parser()
	}
	utils.extend(options, args)
	var looking_for_plm = false

	//set this to true by default.  It will be reset to false when the serial port is connected IF
	//options.verifyConnection is enabled.  Otherwise we pretend it's verified to emit all messages.
	var plmVerified = true
	var verifyPLMinterval
	function verifyPLM(){
		var count = 0
		var verify = function() {
	    	self.sendHex('0260') //get IM info
	    	count++
	    	if(count > 5){
				if(verifyPLMinterval){
					clearInterval(verifyPLMinterval)
					verifyPLMinterval = null
				}
	    		self.emit("noPLM")
	    	}
		}
		verifyPLMinterval = setInterval(verify, 1000)
	}

	function spOpen(){
	    setTimeout(
	    	function(){
		    	sp.close(function(e){
			    	if(e) logger('warn', "FAILED to close serial port: " + e)
			    })
		    }, 5000
	    )
		
		if(options.verifyConnection){
			plmVerified = false
			verifyPLM()
		}else{
			self.emit("connected")
		}
	}
	function spEnd(){
		plmVerified = false
		self.emit("disconnected")
	}
	function spClose(){
		plmVerified = false
		logger('info', "sp is closed")
		self.emit("disconnected")
	}
	function spError(e){
		plmVerified = false
		logger('warn', "Serialport error: " + e)
		self.emit("disconnected")
	}
	function spData(d){
		var message = utils.insteonJS(d)
		if(options.verifyConnection && !plmVerified && message.type == "Get IM Info"){
			plmVerified = true
			if(verifyPLMinterval){
				clearInterval(verifyPLMinterval)
				verifyPLMinterval = null
			}
			self.emit("connected") //don't emit the message; emit a connect notification.
		}else if(plmVerified){
			self.emit("data"  , message)
		}
	}
	
	this.connect = function(port){
		//Commented following.  Don't think it necessary due to reassignment.
		//TODO: confirm reassignment flushes listeners.
		// sp.removeLisener('end'  , spEnd   )
		// sp.removeLisener("open" , spOpen  )
		// sp.removeLisener('close', spClose )
		// sp.removeLisener('error', spError )
		// sp.removeLisener('data' , spData  )

		sp = new SerialPort.SerialPort(port, {
	        baudrate    : options.baudrate,
	        databits    : options.databits,
	        stopbits    : options.stopbits,
	        parity      : options.parity,
	        flowcontrol : options.flowcontrol,
	        parser      : options.parser
	    })
		sp.on("open" , spOpen  )
		sp.on('end'  , spEnd   )
		sp.on('close', spClose )
		sp.on('error', spError )
	    sp.on('data' , spData  )
	}

    this.sendByteArray = function(byteArray, callback){
	    //logger('sendRawSerial::write serial hex: '+utils.byteArrayToHexStringArray(data));
	    if(!sp)
	    sp.write(new Buffer(byteArray), callback)
	}
	this.sendHex = function(hex, callback) {
	    //logger('sendCommand::write> '+c)
	    logger('info', "sending: " + hex)
	    sp.write(new Buffer(hex, "hex"), callback)
	}

	function found(error, ports){
		//TODO: There's a flagrent logic error, probably.  I only have one port on my system.  I
		//suspect this will run through so fast that it'll only really test the last port.
		//progression through ports needs to be handled on a callback.
		if(error){
			logger('warn', "Went looking for PLM, but received error: " + error)
		}else{
			logger('info', "The following serial ports are available on your system:")
			for(port in ports){
				self.connect(ports[port].comName)
				logger('info', "    Port " + port + ":")
				logger('info', "        path: " + ports[port].comName)
				logger('info', "        make: " + ports[port].manufacturer)
				logger('info', "        id  : " + ports[port].pnpId)
			}
			logger('info', "done listing ports.")
		}
	}

	this.find = function(){
		SerialPort.list(found)
	}

	self.connect(options.port)
}
PLM.prototype  = new events.EventEmitter
module.exports.PLM = PLM

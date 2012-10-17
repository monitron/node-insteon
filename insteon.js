/*
** node-insteon
** ------------
** main driver for node insteon, exposes
**  * parser: raw serial port parser for insteon messages
**  * connect: connect to insteon plm (powerlinc modem)
** 
*/ 
var utils = require('./utils.js');
var config = require('./config.js');
var send = require('./send.js');
var receive = require('./receive.js');
var SerialPort = require('serialport').SerialPort;

/*
** Exported Interface 
*/
var parser = exports.parser = require('./parser.js').parser; // for v.0.0.3 compatibility
exports.send = send.send;
exports.sendRawSerial = send.sendRawSerial;
exports.eventEmitter = config.eventEmitter
exports.setMessageFlags = utils.setMessageFlags;

var logger = exports.logger = function(d){
	console.log(d)
}

var queue = []
function enqueue(args){
	queue.push(args)
}

config.eventEmitter.on("noPLM", function(){
	logger("The serial port is open, but a PLM is not connected to it (or is not responding).")
	if(config.queueInterval) clearInterval(config.queueInterval)
})
config.eventEmitter.on("validPLM", function(){
	config.validPLM = true
	logger("Yay!  The port is open, and a PLM is connected to it, and the PLM is responsive!")
	
	config.queueInterval = setInterval(shiftQueue, 240)
})
function wCallback(e, r){
	logger("Wrote to PLM.")
	if(e) logger("    received error: " + e)
}
exports.sendSD = function sendSD(args){
	options = {
		flags: '0B' //TODO: why not 0F working?
 	}
	utils.extend(options, args)
	var command = '0262' + options.address + options.flags + options.cmd1 + options.cmd2
	logger("Sending " + command)
	
	//queue_everything!
	enqueue({
		action: function(){ send.sendCommand(command, args.callback) }
	})
}
function shiftQueue(){
	if(!config.portIsOpen || !config.validPLM || config.PLM_BUSY) return
	if(!queue.length) return
	item = queue.shift()
	item.action()
}

function verifyPLM(){

	var count = 0
	var verifyPLMinterval
	var verify = function() {
		if(config.validPLM) return
		logger('connect::verify connection with getversion');
		var getversion = [0x02, 0x60]; // get IM info
    	send.sendRawSerial(getversion);
    	count++
    	if(count > 2){
    		clearInterval(verifyPLMinterval)
    		if(!config.validPLM) config.eventEmitter.emit("noPLM")
    	}
	}
	verifyPLMinterval = setInterval(verify, 1000)
}
exports.connect = function connect(args) {
	// cleanup in case of re-connect
    if(config.sp != null) {
        config.sp.close()
        config.sp.removeAllListeners()
		config.sp = null
    }
	
	var options = {
		port : config.port ? config.port : '/dev/ttyS0'
	}
	utils.extend(options, args); config.port = options.port
	logger('connect::opening serialport ' + config.port)
	
	config.sp = new SerialPort(config.port, {
        baudrate: 19200,
        databits: 8,
        stopbits: 1,
        parity: 'none',
        flowcontrol: false,
        parser: parser()
    })
	config.sp.on("open", function(){ 
		logger("**** PORT IS OPEN ****")
		config.portIsOpen = true
		verifyPLM()
		//processQueue()
	})

	config.sp.on('end', function() {
		config.portIsOpen = false
		logger('connect: serial end')
		if(config.queueInterval) clearInterval(config.queueInterval)
	})
	config.sp.on('close', function() {
		config.portIsOpen = false
		logger('connect: serial close')
		if(config.queueInterval) clearInterval(config.queueInterval)
	})
	config.sp.on('error', function() { 
		config.portIsOpen = false
		logger('connect: serial error')
		if(config.queueInterval) clearInterval(config.queueInterval)
	})
    
    config.sp.on('data', function(data){
		var insteonMsg = utils.insteonJS(data);
		logger(insteonMsg)
    	receive.processMsg(insteonMsg)
    	if(insteonMsg.type == "Get IM Info") config.eventEmitter.emit("validPLM")
    })
}

/*
** Built-in Events and Event Handlers
*/
//setInterval(send.dequeue, 250); // always check for queued commands (by default, send() will dequeue immediately)
config.eventEmitter.on('cleanup', receive.cleanup);
//config.eventEmitter.on('message', someEvent);

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
exports.eventEmitter = config.eventEmitter;
exports.setMessageFlags = utils.setMessageFlags;

var logger = exports.logger = function(d){
	console.log(d)
}

var queue = []
function enqueue(args){
	queue.push(args)
}

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
	
	if(config.portIsOpen){
		send.sendCommand(command, args.callback)
	}else{
		logger(" >:(  port not ready.  queueing action.")
		enqueue({
			action: function(){ send.sendCommand(command, args.callback) }
		})
	}
}
function processQueue(start){
	/**************************************************************************
	* Excerpt from: Dev Guide, Chapter 10 (Page 222) published February 23, 2009
	* The IM buffers IM Commands as it receives them, so you can send a complete IM
	* Command without pause. To maintain compatibility with earlier IM versions, the IM
	* will echo each byte that it receives (earlier versions of the IM used byte echoing for
	* flow control). You can now ignore the byte echos, but in order to avoid overrunning
	* the IM’s receive buffer, you must wait for the IM to send its response to your current
	* IM Command before sending a new one.
	*
	* Note that there is a maximum time between IM Command bytes that you send to the
	* IM. If you do not send the next expected byte of an IM Command within 240
	* milliseconds after sending the previous one, the IM will reset its message parser and
	* you will have to resend the message from the beginning. You can disable this
	* Deadman feature by setting a configuration bit (see Set IM Configuration258 below).
	* There is no flow control when the IM sends data to the host—the IM will transfer data
	* to the host as fast as it can send it.
	* © 2005-2009 SmartLabs Technology
	*****************************************************************************
	* If the queue holds more than about 3 actions, the PLM will becomve overloaded
	* if all are queued simultaneously.  To overcome this, we space them out in 240ms
	* intervals.  Initial testing showed good response (no losses).
	*****************************************************************************/
	
	var increment = 0
	do{
		//use do{}while instead of for{} to catch anything that might get queued while processing.
		item = queue.shift()
		setTimeout(item.action, 240*(increment))
		increment++
	}while(queue.length)
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
		processQueue()
	})

	config.sp.on('end', function() {
		config.portIsOpen = false
		logger('connect: serial end')
	})
	config.sp.on('close', function() {
		config.portIsOpen = false
		logger('connect: serial close')
	})
	config.sp.on('error', function() { 
		config.portIsOpen = false
		logger('connect: serial error')
	})
    
	// queue all messages until serial connection confirmed
	config.PLM_BUSY = true;
	config.sp.once('data', function(data) {
	    logger('connect::read serial hex: '+utils.byteArrayToHexStringArray(data));
    	logger('connect::serial port connected');
		config.sp.on('data', receive.serialport_handler);
		config.PLM_BUSY = false;
    	config.expired_count = 0;
	});

	// send command to verify connection
	var timerid = null;
	var count = 0
	var verify = function() {
		if(!config.PLM_BUSY) clearInterval(timerid);
		logger('connect::verify connection with getversion');
		var getversion = [0x02, 0x60]; // get IM info
    	send.sendRawSerial(getversion);
    	count++
    	if(count > 2){
    		logger("Failed to confirm a PLM is connected to the port; exiting.")
    		process.exit()
    	}
	}
	timerid = setInterval(verify, 1000);
}

/*
** Built-in Events and Event Handlers
*/
setInterval(send.dequeue, 250); // always check for queued commands (by default, send() will dequeue immediately)
config.eventEmitter.on('cleanup', receive.cleanup);
//config.eventEmitter.on('message', someEvent);

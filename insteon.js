/*
** node-insteon
** ------------
*/
var utils = require('./utils.js');
var config = require('./config.js');

var PLM = require('./plm.js').PLM
var plm
exports.eventEmitter = config.eventEmitter
exports.setMessageFlags = utils.setMessageFlags;

function logger(level, message){
    utils.log(level, 'insteon', message)
}
var setLogger = exports.logger = function(f){
    logger = f
    plm.logger = f //TODO: can we do this without mangling the source argument?
}

var queue = []
function enqueue(args){
    queue.push(args)
}


function wCallback(e, r){
    logger('info', "Wrote to PLM.")
    if(e) logger('warn', "    received error: " + e)
}

exports.sendSD = function sendSD(args){
    options = {
        flags: '0B' //TODO: why not 0F working?
    }
    utils.extend(options, args)
    var command = '0262' + options.address + options.flags + options.cmd1 + options.cmd2
    logger('info', "Queueing " + command)
    
    //queue_everything!
    enqueue({
        action: function(){ plm.sendHex(command, args.callback) }
    })
}
function shiftQueue(){
    if(!config.portIsOpen || config.PLM_BUSY) return
    if(!queue.length) return
    item = queue.shift()
    item.action()
}

exports.connect = function connect(args) {
    var options = {
        port : config.port ? config.port : '/dev/ttyS0'
    }
    utils.extend(options, args); config.port = options.port
	plm = new PLM({port: '/dev/tty1USB0', logger: options.logger})
	plm.on("disconnected", function(){
	    config.portIsOpen = false
	    logger("info", 'plm is disconnected')
	    if(config.queueInterval) clearInterval(config.queueInterval)
	    plm.find()
	})
	plm.on("connected", function(){
	    config.portIsOpen = true
	    logger('info', "plm is connected")
	    config.queueInterval = setInterval(shiftQueue, 240)
	})
	plm.on('data', function(data){
	    logger('info', data)
	})
    if(options.logger) setLogger(options.logger)

    logger("info", 'connect::opening serialport ' + config.port)
}
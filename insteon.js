/*
** node-insteon
** ------------
*/
var utils     = require('./utils.js')
var config    = require('./config.js')
var logMeta   = {source: 'insteon'}
var PLM       = require('./plm.js').PLM
var plm
exports.eventEmitter    = config.eventEmitter
exports.setMessageFlags = utils.setMessageFlags

var queue = []
function enqueue(args){
    queue.push(args)
}


function wCallback(e, r){
    utils.winston.info("Wrote to PLM", logMeta)
    if(e) utils.winston.warn("    received error: " + e, logMeta)
}

exports.sendSD = function sendSD(args){
    options = {
        flags: '0B' //TODO: why not 0F working?
    }
    utils.extend(options, args)
    var command = '0262' + options.address + options.flags + options.cmd1 + options.cmd2
    utils.winston.info("Queueing " + command, logMeta)
    
    //queue_everything!
    enqueue({
        action: function(){ plm.sendHex(command, args.callback) }
    })
    if(options.callback) options.callback()
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
	plm = new PLM({port: '/dev/tty1USB0'})
	plm.on("disconnected", function(){
	    config.portIsOpen = false
	    utils.winston.warn('PLM is disconnected', logMeta)
	    if(config.queueInterval) clearInterval(config.queueInterval)
	    plm.find()
	})
	plm.on("connected", function(){
	    config.portIsOpen = true
	    utils.winston.info("PLM is connected", logMeta)
	    config.queueInterval = setInterval(shiftQueue, 240)
	})
	plm.on('data', function(data){
	    utils.winston.info("Received data from PLM", utils.extend(data, logMeta))
	})

    utils.winston.info("Attempting connection to " + config.port, logMeta)
}
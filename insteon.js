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

var queue = [] //Items waiting to be sent to PLM.
var sent  = [] //After sent to PLM, hold here to track ACKs.
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
    
    
    
    //queue_everything!
    utils.winston.debug("Queueing " + command, logMeta)
    enqueue(
        utils.extend(options, {
            action: function(){ plm.sendHex(command, args.callback) },
            command: command
        })
    )
    if(options.callback) options.callback()
}
function shiftQueue(){
    if(!config.portIsOpen || config.PLM_BUSY) return
    if(!queue.length) return
    item = queue.shift()
    sent.push(item)
    item.action()
}

exports.connect = function connect(args) {
    var options = {
        port : config.port ? config.port : '/dev/ttyS0'
    }
    utils.extend(options, args); config.port = options.port
	plm = new PLM({port: options.port})
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
	plm.on('data', function(message){
        var hexStr  = (message.hex.join('')).toUpperCase()
        var matched = false
        if(message.type == "Send INSTEON Standard or Extended Message"){
            for(i in sent){
                if(sent[i].plmAck) continue
                var lookingFor = (sent[i].command+"06").toUpperCase()
                
                if(hexStr == lookingFor){
                    utils.winston.debug("**********got PLM ack")
                    sent[i].plmAck = true
                    matched = {type: 'plmAck', index: i}; break //prevent improper multiple matches
                }else{
                    utils.winston.error(hexStr + " != " + lookingFor)
                }
            }
        }else if(message.type == "INSTEON Standard Message Received"){
            for(i in sent){
                if(sent[i].ack) continue
                
                var r1 = message.command1.toUpperCase(); var s1 = sent[i].cmd1.toUpperCase()
                var r2 = message.command2.toUpperCase(); var s2 = sent[i].cmd2.toUpperCase()
                var sentTo = (sent[i].address).toUpperCase()
                var receivedFrom = message.from.join('').toUpperCase()
                if(r1 == s1 && r2 == s2 && receivedFrom == sentTo){
                    if(message.flags.ack){
                        utils.winston.debug("*********** got ack from receiving device")
                        sent[i].ack = true
                        matched = {type: 'remote ack', index: i}; break //prevent improper multiple matches
                    }else if(message.flags.nak){
                        utils.winston.error("*********** got nak from receiving device")
                        sent[i].nak = true
                        matched = {type: 'remote nak', index: i}; break //prevent improper multiple matches
                    }
                }
            }
        }
        if(!matched){
            utils.winston.error("Unmatched message from PLM", utils.extend(message, logMeta))
            console.log(sent); process.exit()
        }else{
            if(matched.type == 'remote ack' || matched.type == 'remote nak') sent.splice(matched.i, 1)
            //TODO: callbacks go here.  Also need a "no response" callback somewhere.
        }
	})
    setTimeout(function(){
        console.log(sent); process.exit()
    }, 10000)
    utils.winston.info("Attempting connection to " + config.port, logMeta)
}
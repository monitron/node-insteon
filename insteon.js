/*
** node-insteon
** ------------
*/
var utils     = require('./utils.js')
var config    = require('./config.js')
var logMeta   = {source: 'insteon'}
var PLM       = require('./plm.js').PLM
var plm                          //defined in exports.connect()
var debugCounter         = 0     //a running counter.
var plm_nak_timestamp    = false //when a NAK occurs, this determines the wait period.
var SHIFT_QUEUE_INTERVAL = 300   //PLM should only need 240ms between commands, but queuing endless commands on this
                                 //interval would generate NAKs and introduce delays.  An interval of 300ms works better.
var queue                = []    //Items waiting to be sent to PLM.
var sent                 = []    //After sent to PLM, hold here to track ACKs.

exports.sendSD = function sendSD(args){
    var options = {
        flags   : '0B',
        debugID : ++debugCounter
    }
    utils.extend(options, args)
    if(debugCounter > 100) debugCounter = 0 //don't let it get too big.
    
    var command = '0262' + options.address + options.flags + options.cmd1 + options.cmd2
    
    //queue_everything!
    utils.winston.debug("Queueing " + command + " (" + options.debugID + ")", logMeta)
    queue.push(
        utils.extend(options, {
            action: function(){ plm.sendHex(command, function(e,r){ options.cbSent(e,options)} ) },
            command: command
        })
    )
}
function shiftQueue(){
    var now  = new Date()
    do{
        //Originally, we issued a setTimeout() when the item was pushed
        //to expire it, but the timer was unreliable; this do loop seems
        //more accurate.  Maybe the more timers Node tries to track, the
        //worse it does?  Docs warn to unreliability of timers.
        //http://nodejs.org/api/timers.html
        var something_expired = false
        for(i in sent){
            if(sent[i].expiresAt < now){
                something_expired = i
                break //because we'll splice it out, we can only do one at a time.
            }
        }
        if(something_expired){
            var item = sent[something_expired]
            sent.splice(something_expired, 1)
            if(item.cbComplete) item.cbComplete("timeout", item)
        }
        
    }while(something_expired)

    if(!config.portIsOpen) return //can't do nothing.
    if(!queue.length)      return //nothing to do.
    
    if(plm_nak_timestamp){
        var now = new Date()
        if((now.getTime()-plm_nak_timestamp) < 3000) return
        plm_nak_timestamp = null
    }
    
    var item = queue.shift()
    var timer = utils.flags2Timer(item.flags)
    now = new Date()
    item.expiresAt = new Date(now.getTime() + timer)
    
    item.action()
    sent.push(item)
}

exports.connect = function connect(args) {
    var options = {
        port : config.port ? config.port : '/dev/ttyS0'
    }
    utils.extend(options, args); config.port = options.port
	plm = new PLM({port: options.port})
	plm.on("disconnected", function(){
        config.portIsOpen = false
        clearInterval(config.queueInterval)
	})
	plm.on("connected", function(){
	    config.portIsOpen = true
        clearInterval(config.queueInterval) //shouldn't ever be set at this stage, but just in case.
	    config.queueInterval = setInterval(shiftQueue, SHIFT_QUEUE_INTERVAL)
	})
	plm.on('data', function(message){
        var hexStr  = (message.hex.join('')).toUpperCase()
        var matched = false
        if(message.type == "Send INSTEON Standard or Extended Message"){
            for(i in sent){
                if(sent[i].plmAck) continue
                var lookingFor = (sent[i].command+"06").toUpperCase()
                
                if(hexStr == lookingFor){
                    utils.winston.debug("Matched a PLM ACK (" + sent[i].debugID + ")", logMeta)
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
                        utils.winston.debug("Matched an Ack from a remote device (" + sent[i].debugID + ")", logMeta)
                        sent[i].ack = true
                        matched = {type: 'remote ack', index: i}; break //prevent improper multiple matches
                    }else if(message.flags.nak){
                        utils.winston.error("Matched a Nak from a remote device (" + sent[i].debugID + ")", logMeta)
                        sent[i].nak = true
                        matched = {type: 'remote nak', index: i}; break //prevent improper multiple matches
                    }
                }
            }
        }
        if(!matched){
            if(message.hex.toString(16) == '15'){
                utils.winston.error("PLM NAK", utils.extend(message, logMeta))
                plm_nak_timestamp = new Date().getTime()
                if(sent.length){
                    item = sent.pop()
                    item.tries = typeof(item.tries) == 'number'? item.tries+1 : 0
                    if(item.tries > 5){
                        if(sent[matched.index].cbComplete) sent[matched.index].cbComplete("PLM nak", sent[matched.index])
                        //Don't put it back in the queue; give up on it.
                    }else{
                        item.expiresAt = false
                        utils.winston.warn("Re-queuing (" + item.debugID + " - " + item.tries + ")")
                        queue.unshift(item)
                    }
                }
                    
            }else{
                utils.winston.info("Unmatched message from PLM", utils.extend(message, logMeta))
                //button presses or other events.  Also, some PLM traffic can end up here.
            }
        }else{
            if(sent[matched.index].timeout) clearTimeout(sent[matched.index].timeout)
            if(matched.type == 'remote ack'){
                if(sent[matched.index].cbComplete) sent[matched.index].cbComplete(null, sent[matched.index])
                sent.splice(matched.index, 1) //we're done with this; clean it up.
                
            }else if(matched.type == 'remote nak'){
                if(sent[matched.index].cbComplete) sent[matched.index].cbComplete("nak", sent[matched.index])
                sent.splice(matched.index, 1) //we're done with this; clean it up.
            }
        }
	})
    
    utils.winston.info("Attempting connection to " + config.port, logMeta)
}
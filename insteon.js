/***********************************************
* This module provides the protocol control.
* It leverages the PLM module to communicate
* with an INSTEON Modem.
* Features include automatic message queuing
* with ACK/NAK matching and timeouts.
* Right now it doesn't know much of the 
* protocol.  The API for using this module
* is not finalized.
****************************/
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

var sendSD = exports.sendSD = function(args){
    var options = {
        flags   : "0b",
        debugID : ++debugCounter
    }
    utils.extend(options, args)
    if(debugCounter > 100) debugCounter = 0 //don't let it get too big.
    
    var command = '0262' + options.address + options.flags + options.cmd1 + options.cmd2
    
    //queue_everything!
    utils.winston.debug("Queueing " + command + " (" + options.debugID + ")", logMeta)
    var queuedAt = new Date().getTime() //used when reviewing maxAge and delay options.
    var runAfter = false; var expireAfter = false
    
    if(parseInt(options.delay ) >= 0) runAfter    = queuedAt + parseInt(options.delay )*1000
    if(parseInt(options.maxAge) >= 0) expireAfter = queuedAt + parseInt(options.maxAge)*1000
    queue.push(
        utils.extend(options, {
            action: function(){ plm.sendHex(command, function(e,r){ options.cbSent(e,options)} ) },
            command: command,
            queuedAt: queuedAt, runAfter: runAfter, expireAfter: expireAfter
        })
    )
}
function zPad(str){
    if(str.length == 1) return "0" + str
    return str
}
exports.light = function(args){
    /**********************************************************************************
    * a simplified object.
    ***********************************************************************************/
    var globals = {}
    utils.extend(globals, args)
    
    this.turnOn  = function(args){
        //named "turn on" rather than "on" to avoid confusion with callback syntax
        var options = { address: globals.address, cmd1: '11', cmd2: 'ff' }
        utils.extend(options, args)
        if(options.level){
            if(options.level.indexOf("%")){
                var percent = parseInt(options.level) / 100
                if(percent > 100) throw "Invalid argument; level cannot be >100%"
                var level = parseInt( parseInt(options.cmd2, 16) * percent )
                options.cmd2 = zPad(level.toString(16))
            }
        }
        if(options.fast){
            options.cmd1 = "12"
            delete options.fast
        }
        delete options.level
        sendSD(options)
    }
    this.turnOff = function(args){
        //named "turn off" rather than "off" to be consistent with turnOn()
        var options = { address: globals.address, cmd1: '13', cmd2: '00' }
        utils.extend(options, args)
        if(options.fast){
            options.cmd1 = "14"
            delete options.fast
        }
        sendSD(options)
    }
}
function shiftQueue(){
    var now
    do{
        //Originally, we issued a setTimeout() when the item was pushed
        //to expire it, but the timer was unreliable; this do loop seems
        //more accurate.  Maybe the more timers Node tries to track, the
        //worse it does?  Docs warn to unreliability of timers.
        //http://nodejs.org/api/timers.html
        //
        //Because of that, maxAge and delay options are also handled
        //in this manner rather than by setting timers.
        now = new Date()
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

    if(!queue.length) return //nothing to do.
    do{
        //Similar to the expirations in the sent array, we need to
        //check the maxAge and delay options in the queue array.
        //assumed this would be more accurate than using timers.
        now = new Date()
        var something_expired = false
        for(i in queue){
            //if(i > 10) break //let's not waste time doing this; we'll get to 'em eventually.
            if(queue[i].expireAfter && (queue[i].expireAfter < now.getTime())){
                something_expired = i
                break
            }
        }
        if(something_expired){
            var item = queue[something_expired]
            queue.splice(something_expired, 1)
            if(item.cbComplete) item.cbComplete("expired", item)
        }
        
    }while(something_expired)
    if(!config.portIsOpen) return //can't do nothing.
    
    now = new Date()
    if(plm_nak_timestamp){
        //If we triggered a NAK, let's wait 3 seconds before trying again.
        if((now.getTime()-plm_nak_timestamp) < 3000) return
        plm_nak_timestamp = null
    }
    
    var next_item = false
    for(i in queue){
        if(queue[i].runAfter < now.getTime()){
            next_item = i; break
        }
    }
    
    if(next_item){
        var item  = queue[next_item]; queue.splice(next_item, 1)
        var timer = utils.flags2Timer(item.flags)
        now = new Date()
        item.expiresAt = new Date(now.getTime() + timer) //Not to be confused with expireAfter, this tracks a 'no reply' condition.
        
        item.action()
        sent.push(item)
    }
}

exports.connect = function connect(args) {
    var options = {
        port : config.port ? config.port : '/dev/ttyS0'
    }
    
    //We always want this to run because it'll handle the expirations.
    config.queueInterval = setInterval(shiftQueue, SHIFT_QUEUE_INTERVAL)
    
    utils.extend(options, args); config.port = options.port
	plm = new PLM({port: options.port})
    plm.on("disconnected", function(){
        config.portIsOpen = false
	})
	plm.on("connected", function(){
	    config.portIsOpen = true
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
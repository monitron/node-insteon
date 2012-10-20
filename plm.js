/*************************************************
* This module manages the connection to the PLM.
* By default, it checks to confirm a PLM is
* connected to the connected port before
* accepting messages.  It also features an
* automated recovery process that checks all
* serial ports for a PLM.
* TODO: offer an option to limit ports to check.
*********************/
var SerialPort = require('serialport')
var utils      = require('./utils.js')
var parser     = require('./parser.js').parser
var sp         = null
var events     = require('events')
var logMeta    = {source: 'plm'}

function PLM(args){
    var self = this
    var port = '/dev/ttyS0' //don't care to try to make a better guess.  If it fails, this.find() will fix it.
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
    var verifyPLMinterval //used to control multiple verify attempts.
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
        if(options.verifyConnection){
            plmVerified = false
            verifyPLM()
        }else{
            self.emit("connected")
        }
    }
    self.on("disconnected", function(){
        utils.winston.warn('PLM is disconnected; will look for it.', logMeta)
        self.find()
    })
    self.on("connected", function(){
        utils.winston.info("PLM is connected!", logMeta)
    })
    function spEnd(){
        plmVerified = false
        utils.winston.debug("Serialport end", logMeta)
        self.emit("disconnected")
    }
    function spClose(){
        plmVerified = false
        utils.winston.debug("Serialport closed", logMeta)
        self.emit("disconnected")
    }
    function spError(e){
        plmVerified = false
        utils.winston.warn("Serialport error: " + e, logMeta)
        self.emit("disconnected")
    }
    function spData(d){
        var message = utils.insteonJS(d)
        if(options.verifyConnection && !plmVerified && message.type == "Get IM Info"){
            plmVerified = true
            if(portFinder) clearInterval(portFinder.interval)
            portFinder = null
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
        sp.write(new Buffer(byteArray), callback)
    }
    this.sendHex = function(hex, callback) {
        sp.write(new Buffer(hex, "hex"), callback)
    }
    
    var portFinder = null
    function found(error, foundPorts){
        if(error){
            utils.winston.warn("Went looking for PLM, but received error: " + error, logMeta)
        }else{
            portFinder = {
                interval : null,
                ports    : foundPorts
            }
            
            portFinder.interval = setInterval(checkPortForPLM, 5000)
        }
    }
    function checkPortForPLM(){
        if(!portFinder.ports.length){
            //Done checking.  packup and quit; interval should recover it eventually.
            if(portFinder) clearInterval(portFinder.interval)
            portFinder = null
            return
        }
        port = portFinder.ports.pop() //shift()
        self.connect(port.comName)
        utils.winston.debug("Checking for PLM on:", logMeta)
        utils.winston.debug("    path: " + port.comName, logMeta)
        utils.winston.debug("    make: " + port.manufacturer, logMeta)
        utils.winston.debug("    id  : " + port.pnpId, logMeta)
    }
    this.find = function(){
        if(portFinder){
            utils.winston.warn("portFinder is already processing, but was called again.", logMeta)
        }else{
            SerialPort.list(found)
        }
    }
    
    self.connect(options.port)
    setInterval(function(){
        //Periodically check if the connection needs to be recovered.
        //theoretically, self.on("disconnected") should initiate recovery,
        //but testing showed it didn't always.  TODO: look into that.
        if(!plmVerified) self.find()
    }, 60*1000 )
    //Commented the following.  It was used during development of reconnect.
    // setTimeout(
    //     function(){
    //         sp.close(function(e){
    //             if(e) utils.winston.warn("FAILED to close serial port: " + e, logMeta)
    //         })
    //     }, 7000
    // )

}
PLM.prototype  = new events.EventEmitter
module.exports.PLM = PLM

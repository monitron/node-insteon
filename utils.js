/*
** Utility Functions
*/
var config = require('./config.js')
var winston = require('winston')

//winston.remove(winston.transports.Console)
//winston.add(winston.transports.Console, {  colorize: true, timestamp: true } )
winston.cli()
exports.winston = winston

var extend = exports.extend = function extend() {
    /**********************************************************
    * This function credit:jQuery (https://github.com/jquery/jquery/blob/master/src/core.js)
    * The following license governs this function.
    ***********************************************************
    * Copyright 2012 jQuery Foundation and other contributors
    * http://jquery.com/
    * 
    * Permission is hereby granted, free of charge, to any person obtaining
    * a copy of this software and associated documentation files (the
    * "Software"), to deal in the Software without restriction, including
    * without limitation the rights to use, copy, modify, merge, publish,
    * distribute, sublicense, and/or sell copies of the Software, and to
    * permit persons to whom the Software is furnished to do so, subject to
    * the following conditions:
    * 
    * The above copyright notice and this permission notice shall be
    * included in all copies or substantial portions of the Software.
    * 
    * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
    * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
    * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
    * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
    * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
    * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
    *************************************************************/
    var options, name, src, copy, copyIsArray, clone,
        target = arguments[0] || {},
        i = 1,
        length = arguments.length,
        deep = false;

    // Handle a deep copy situation
    if ( typeof target === "boolean" ) {
        deep = target;
        target = arguments[1] || {};
        // skip the boolean and the target
        i = 2;
    }

    // Handle case when target is a string or something (possible in deep copy)
    if ( typeof target !== "object" && !jQuery.isFunction(target) ) {
        target = {};
    }

    // extend jQuery itself if only one argument is passed
    if ( length === i ) {
        target = this;
        --i;
    }

    for ( ; i < length; i++ ) {
        // Only deal with non-null/undefined values
        if ( (options = arguments[ i ]) != null ) {
            // Extend the base object
            for ( name in options ) {
                src = target[ name ];
                copy = options[ name ];

                // Prevent never-ending loop
                if ( target === copy ) {
                    continue;
                }

                // Recurse if we're merging plain objects or arrays
                if ( deep && copy && ( jQuery.isPlainObject(copy) || (copyIsArray = jQuery.isArray(copy)) ) ) {
                    if ( copyIsArray ) {
                        copyIsArray = false;
                        clone = src && jQuery.isArray(src) ? src : [];

                    } else {
                        clone = src && jQuery.isPlainObject(src) ? src : {};
                    }

                    // Never move original objects, clone them
                    target[ name ] = jQuery.extend( deep, clone, copy );

                // Don't bring in undefined values
                } else if ( copy !== undefined ) {
                    target[ name ] = copy;
                }
            }
        }
    }

    // Return the modified object
    return target;
};
/*
** General utilities
*/ 
var dec2binstr = exports.dec2binstr = function dec2binstr(str,padding) {
	//http://stackoverflow.com/questions/57803/how-to-convert-decimal-to-hex-in-javascript
    var bin = Number(str).toString(2);
    while(bin.length < padding) {
        bin = '0' + bin;
    }
    return bin;
};

var dec2hexstr = exports.dec2hexstr = function dec2hexstr(str) {
	//http://stackoverflow.com/questions/57803/how-to-convert-decimal-to-hex-in-javascript
    var hex = Number(str).toString(16);
    if(hex.length == 1) hex = '0'+hex
    return hex;
};

var arrayToString = exports.arrayToString = function arrayToString(a) {
    return a.join('')
};

var byteArrayToHexString = exports.byteArrayToHexString = function byteArrayToHexString(ba) {
    var str = '';
    for(i in ba) {
        str += dec2hexstr(ba[i]);
    }
    return str;
};

var byteArrayToHexStringArray = exports.byteArrayToHexStringArray = function byteArrayToHexStringArray(ba) {
    var data = [];
    for(var i=0; i < ba.length; i++) {
        data.push(dec2hexstr(ba[i]));
    }
    return data;
};

var compareArray = exports.compareArray = function compareArray(arr1, arr2) {
    if(arr1.length != arr1.length) return false;
    for(i=0; i < arr1.length; i++) {
        if(arr1[i] != arr2[i]) return false;
    }
    return true;
};

var sleep = exports.sleep = function sleep(milliSeconds) {
    // use only in case of emergencies
    var startTime = new Date().getTime();
    while (new Date().getTime() < startTime + milliSeconds);
};



/*
** Insteon Utilities
*/
var getInsteonMessageLength = exports.getInsteonMessageLength = function getInsteonMessageLength(aByte) {
    // given insteon command code (second byte) return expected length of message
    var cmd = dec2hexstr(aByte);
    if(typeof(config.INSTEON_MESSAGES[cmd]) != 'undefined') {
        if(cmd == '62') return 9; // insteon standard or extended message - assume standard;
        return config.INSTEON_MESSAGES[cmd].len;
    }
    return -1; // not implemented
};

var getInsteonCommandType = exports.getInsteonCommandType = function getInsteonCommandType(aByte) {
    // given insteon command code (second byte) return associated type of message in plaintext
    var cmd = dec2hexstr(aByte);
    if(typeof(config.INSTEON_MESSAGES[cmd]) != 'undefined') return config.INSTEON_MESSAGES[cmd].type;
    return ''; // not implemented
};

var getMessageFlagsByHex = exports.getMessageFlagsByHex = function getMessageFlagsByHex(hex) {
    return getMessageFlags(parseInt(hex, 16));
};

var flags2Hex = exports.flags2Hex = function(flags){
    defaults = {
        hopsLeft  : 1,
        maxHops   : 3
    }
    extend(defaults, flags); flags = defaults
    if( (flags.nak || flags.ack) && flags.broadcast) throw { 
        summary: 'When broadcast flag is enabled, ack and nak must be disabled.' 
    }
    if(flags.ack && flags.nak) throw {
        summary: 'Cannot have nak and ack both enabled'
    }
    if(flags.hopsLeft > flags.maxHops) throw {
        summary: 'maxHops must be greater than hopsLeft'
    }
    if(flags.maxHops > 3) throw {
        summary: 'maxHops cannot be greater than 3'
    }

    var hex = flags.maxHops + (4*flags.hopsLeft)
    if(flags.extended)  hex += 16
    if(flags.ack)       hex += 32
    if(flags.allLink)   hex += 64
    if(flags.broadcast) hex += 128
    if(flags.nak)       hex += 160 //broadcast+ack == nak.

    return hex.toString(16)
}
var hex2Flags = exports.hex2Flags = function(aByte){
    switch(typeof(aByte)){
        case 'string':
            aByte = parseInt(aByte, 16)
            break
        case 'number':
            break
        default:
            throw { summary: 'invalid argument' }
    }
    if( aByte < 0 || aByte > 0xff ) throw {
        summary: 'argument out of range'
    }
    var flags = {
        broadcast : !!(aByte & 128),
        nak       : false,
        allLink   : !!(aByte &  64),
        ack       : !!(aByte &  32),
        extended  : !!(aByte &  16),
        hopsLeft  : (aByte   &  12) /4,
        maxHops   :  aByte   &   3 
    }
    if(flags.ack && flags.broadcast){
        flags.broadcast = flags.ack = false
        flags.nak = true
    }
    return flags
}
var flags2Timer = exports.flags2Timer = function(flags){
    if(typeof(flags) == 'string') return hex2Timer(flags) //assuming....
    //Based on the type of message, this returns the maximum amount of time a reply can take due to message retrying.
    //If no reply is received within this time, it is safe to assume no reply is coming.
    if(flags.extended){
        switch(flags.maxHops){
            case 3  : return 3170
            case 2  : return 3010
            case 1  : return 2690
            default : return 2220
        }
    }else{
        switch(flags.maxHops){
            case 3  : return 2000
            case 2  : return 1900
            case 1  : return 1700
            default : return 1400
        }
    }
}
var hex2Timer = exports.hex2Timer = function(hex){
    //see flags2Timer.
    return flags2Timer(hex2Flags(hex))
}
var getMessageFlags = exports.getMessageFlags = function getMessageFlags(aByte) {
    // returns parsed message flag in json
    var binstr = dec2binstr(aByte, 8);
    var type = binstr.substring(0,3);
    switch(type) {
        case '000':
            type = 'Direct Message';
            break;
        case '001':
            type = 'ACK of Direct Message';
            break;
        case '010':
            type = 'ALL-Link Cleanup Message';
            break;
        case '011':
            type = 'ACK of ALL-Link Cleanup Message';
            break;
        case '100':
            type = 'Broadcast Message';
            break;
        case '101':
            type = 'NAK of Direct Message';
            break;
        case '110':
            type = 'ALL-Link Broadcast Message';
            break;
        case '111':
            type = 'NAK of ALL-Link Cleanup Message';
            break;
        default:
            throw 'getMessageFlags:: undefined message type '+type+'';
    }
    var extended = parseInt(binstr.substring(3,4), 2);
    var hops_left = parseInt(binstr.substring(4,6), 2);
    var max_hops = parseInt(binstr.substring(6),2);
    return {type: type, extended: extended, hops_left: hops_left, max_hops: max_hops};
};

var setMessageFlags = exports.setMessageFlags = function setMessageFlags(type, extended, hops_left, max_hops) {
    // returns binary string representation of provided message flags
    extended = typeof(extended) != 'undefined' ? extended : false;
    hops_left = typeof(hops_left) != 'undefined' ? hops_left : 1; // hops left should = max_hops
    max_hops = typeof(max_hops) != 'undefined' ? max_hops : 1;
    // TO DO -
    // broadcast & all-link broadcast messages max_hops should be 3 by default
    // direct and all-link cleanup max_hops should be 1 by default
    var binstr = '';
    switch(type) {
        case 'Broadcast Message':
            binstr = '100';
            break;
        case 'Direct Message':
            binstr = '000';
            break;
        case 'ACK of Direct Message':
            binstr = '001';
            break;
        case 'NAK of Direct Message':
            binstr = '101';
            break;
        case 'ALL-Link Broadcast Message':
            binstr = '110';
            break;
        case 'ALL-Link Cleanup Message':
            binstr = '010';
            break;
        case 'ACK of ALL-Link Cleanup Message':
            binstr = '011';
            break;
        case 'NAK of ALL-Link Cleanup Message':
            binstr = '111';
            break;
        default:
            throw('setMessageFlags::' + type + ' undefined message type');
    }
    if(extended) {
        binstr += '1';
    } else {
        binstr += '0';
    }
    binstr += dec2binstr(hops_left, 2);
    binstr += dec2binstr(max_hops, 2);
    return binstr;
};
var getInsteonTimer = exports.getInsteonTimer = function getInsteonTimer(extended, ack, max_hops) {
    // INSTEON Full Message Cycle Times (Dev Guide, Chapter 6, rounded up)
    var times = [];
    times[0] = [], times[1] = [], times[0][0] = [], times[0][1] = [], times[1][0] = [], times[1][1] = [];
    // standard
    times[0][0][0] = 50;
    times[0][0][1] = 100;
    times[0][0][2] = 150;
    times[0][0][3] = 200;
    times[0][1][0] = 100;
    times[0][1][1] = 200;
    times[0][1][2] = 300;
    times[0][1][3] = 400;
    // extended
    times[1][0][0] = 109;
    times[1][0][1] = 217;
    times[1][0][2] = 325;
    times[1][0][3] = 434;
    times[1][1][0] = 159;
    times[1][1][1] = 317;
    times[1][1][2] = 475;
    times[1][1][3] = 634;
    if(config.active_timers == undefined) config.active_timers = 0;
    if(times[extended][ack][max_hops] != undefined) {
        return times[extended][ack][max_hops] + 240*2 + Math.min(1400*config.active_timers, 2800);
        // heuristic: 240ms request to PLM, time on network above, 240ms response from PLM, plus add 1.4s allowance for each item in the queue due to higher likelihood of buffer overruns and reconnects (trial-and-error).
    }
    return 240*2 + 634;  // no time found, default max
};

var getPlmTimer = exports.getPlmTimer = function getPlmTimer(cmd) {
    var type = getInsteonCommandType(cmd);
    switch(type) {
        case 'Reset the IM':
            return '5000';
            break;
        default:
            return config.INSTEON_PLM_TRANS_TIME_LIMIT;
    }
};

/*
** insteonJS: 'jsonify' an insteon message into various parts
*/

var insteonJS = exports.insteonJS = function insteonJS(byteArray) {
    var data = new Object;
    data['dec'] = byteArray;
    data['hex'] = byteArrayToHexStringArray(byteArray);

    data['cmd'] = byteArray[1];
    data['type'] = getInsteonCommandType(data.cmd);

    switch(data['type']) {
        case 'Button Event Report':
            data['button_event'] = data['hex'][2];
            break;
        case 'Get IM Info':
            data['device_id'] = data['hex'].slice(2,5);
            data['device_cat'] = data['hex'][5];
            data['device_subcat'] = data['hex'][6];
            data['device_firmware'] = data['hex'][7];
            data['ack_nak'] = data['hex'][8];
            break;
        case 'INSTEON Standard Message Received':
            data['from'] = data['hex'].slice(2,5);
            data['to']  = data['hex'].slice(5,8);
            //data['message_flags'] = data['hex'][8];
            data['flags'] = hex2Flags(data['hex'][8])
            data['command1'] = data['hex'][9];
            data['command2'] = data['hex'][10];
            //data['message_flags_details'] = getMessageFlags(data['dec'][8]);
            break;
        case 'Send INSTEON Standard or Extended Message':
            data['to'] = data['hex'].slice(2,5);
            data['flags'] = hex2Flags(data['hex'][5])
            data['command1'] = data['hex'][6];
            data['command2'] = data['hex'][7];
            if(data['hex'].length == 9) { // standard
                data['ack_nak'] = data['hex'][8];
            } else if(data['hex'].length == 23) { // extended
                data['user_data'] = data['hex'].slice(8,22);
                data['ack_nak'] = data['hex'][22];
            } else {
                throw('insteonjs: standard or extended messages is invalid');
            }
            break;
        case 'Get IM Configuration':
            data['config_flags'] = data['hex'][2];
            data['ack_nak'] = data['hex'][5];
            break;
        case 'Set IM Configuration':
            data['config_flags'] = data['hex'][2];
            data['ack_nak'] = data['hex'][3];
            break;
        case 'Get First ALL-Link Record':
            data['ack_nak'] = data['hex'][2];
            break;
        case 'Get Next ALL-Link Record':
            data['ack_nak'] = data['hex'][2];
            break;
        case 'Start ALL-Linking':
            data['link_code'] = data['hex'][2];
            data['all_link_group'] = data['hex'][3];
            data['ack_nak'] = data['hex'][4];
            break;
        case 'Cancel ALL-Linking':
            data['ack_nak'] = data['hex'][2];
            break;
        case 'ALL-Link Record Response':
            data['record_flags'] = data['hex'][2];
            data['link_group'] = data['hex'][3];
            data['deviceid'] = data['hex'].slice(4,7);
            data['data1'] = data['hex'][7];
            data['data2'] = data['hex'][8];
            data['data3'] = data['hex'][9];
            break;
        case 'Send ALL-Link Command':
            data['all_link_group'] = data['hex'][2];
            data['all_link_command'] = data['hex'][3];
            data['broadcast_cmd2'] = data['hex'][4];
            break;
        case 'ALL-Linking Completed':
            data['link_code'] = data['hex'][2];
            data['link_group'] = data['hex'][3];
            data['device_id'] = data['hex'].slice(4,7);
            data['device_cat'] = data['hex'][7];
            data['device_subcat'] = data['hex'][8];
            data['device_firmware'] = data['hex'][9];
            break;
        case 'Reset the IM':
            data['ack_nak'] = data['hex'][2];
            break;
        default:
            data['error'] = 'Unrecognized command or command not implemented';
            if(byteArray[0] == config.INSTEON_PLM_NAK) data['error'] = 'PLM NAK received (buffer overrun)';
            break;
    }
    return data;
};


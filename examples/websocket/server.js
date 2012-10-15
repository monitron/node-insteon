var insteon = require('insteon')
var SerialPort = require("serialport"); var serialport = SerialPort.SerialPort
var WebSocketServer = require('websocket').server
var http = require('http')
var fs = require('fs')
//the following is the relative path to the directory containing index.html (without a trailing /)
//It is relative to the path from which the server is run.  If you follow the README, it should
//be accurate.
var path = "node_modules/insteon/examples/websocket"
//the following is the COM port connected to the PLM.
var port = "/dev/ttyUSB0"

var writeCallback = function(e, r){
	console.log("Wrote to PLM.")
	if(e) console.log("    received error: " + e)
}
console.log("opening " + port)
var sp = new serialport(port, {
    baudrate: 19200,
    databits: 8,
    stopbits: 1,
    parity: 'none',
    flowcontrol: false,
    parser: insteon.parser()
})

var connections = [] //a collection of all our websocket clients.

sp.on('data', function(data) {
    console.log("    Received from PLM: " + data)
    sendReply("Received from PLM: " + data)
})

var server = http.createServer(); server.listen(8080, function() {
    console.log((new Date()) + ' Server is listening on port 8080')
})

//The following function handles web requests.  We'll accept any request except /favicon.ico
server.on('request', function(request, response) {
    console.log('Received request for: ' + request.url)//; console.log(request)
    if(request.url == "/favicon.ico"){
    	response.statusCode = 404
    	response.write("404 - not found")
    	response.end()
    }else{
	    response.statusCode = 200
	    response.setHeader("Content-type", "text/html")

	    fs.readFile(path + "/index.html", 'utf8', function(err, data){
	    	if(err){
	    		console.log("Error reading index.html: " + err)
	    		response.statusCode = 500
    			response.write("500 - Could not load file")
    			response.end()
    		}else{
	    		response.statusCode = 200
	    		response.setHeader("Content-type", "text/html")
	    		response.write(data)
	    		response.end()
	    	}
	    })
	}
})

wsServer = new WebSocketServer({
    httpServer: server,
    // You should not use autoAcceptConnections for production
    // applications, as it defeats all standard cross-origin protection
    // facilities built into the protocol and the browser.  You should
    // *always* verify the connection's origin and decide whether or not
    // to accept it.
    autoAcceptConnections: false
})

function originIsAllowed(origin) {
  // put logic here to detect whether the specified origin is allowed.
  if(origin.indexOf("http://localhost:8080") == 0) return true

  console.log("Rejecting request from: "); console.log(origin)
  return false
}

function pruneConnections(){
	var didRemoval = false
	do{
		didRemoval = false
		for(connection in connections){
			if(!connections[connection].connected){
				console.log("removing " + connection + " (state: " + connections[connection].state + ")")
				connections.splice(connection,1)
				//if we continue after splicing, our index will be out of position.  we must start over.
				didRemoval = true
				break
			}
		}
	}while(didRemoval)
}
function sendReply(d){
	//send the message to all connections.
    for(connection in connections){
		connections[connection].sendUTF(d)
	}
}
wsServer.on('request', function(request) {
    if (!originIsAllowed(request.origin)) {
      // Make sure we only accept requests from an allowed origin
      request.reject()
      console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.')
      return
    }

    var connection = request.accept('insteon-protocol', request.origin)
    console.log((new Date()) + ' websocket connection accepted from ' + request.origin)
    connections.push(connection)

    connection.on('message', function(message) {
        if(message.type === 'utf8'){
            console.log('Received Message: ' + message.utf8Data)
			sendReply("Received request: " + message.utf8Data)
            try{
				sp.write(new Buffer(message.utf8Data, 'hex'), writeCallback)
			}catch(e){
				sendReply("    Could not process: " + e)
			}
        }else if(message.type === 'binary'){
        	//Pretty much ignoring this for now.
            console.log('Received Binary Message of ' + message.binaryData.length + ' bytes')
            connection.sendBytes(message.binaryData)
        }
    })
    connection.on('close', function(reasonCode, description) {
    	pruneConnections()
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.')
    })
})

//setInterval(function(){ sp.write(new Buffer('0260', 'hex'), writeCallback) }, 4000)
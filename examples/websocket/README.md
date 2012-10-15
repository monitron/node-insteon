Insteon Websocket Server Example
================================

This example shows how to create a websocket server to communicate with an Insteon network through a PLM.  It offers a realtime communication bridge between a PLM and a webbrowser.  This is in a preliminary / proof-of-concept state; while it does provide the desired functionality, it needs an API to be formalized and the server needs much improvement.

1 - Install
----------
Note that this will not currently work; the insteon module provided does not include this websocket example.  But eventually, it should be this easy.  Until then, after installing the insteon module, you must manually drop the websocket directory into the examples.

	npm install serialport
	npm install insteon
	npm install websocket
	npm install http

2 - Edit
-------

Before starting the server, you need to edit the example so that it uses the correct COM port to communicate with the PLM.

**edit the `port` variable in** `insteon/examples/websocket/server.js`


3 - Run
------
    node node_modules/insteon/examples/websocket/server.js

4 - Browse
---------

Now open a webbrowser (that supports websockets) and browse to [localhost:8080](http://localhost:8080).
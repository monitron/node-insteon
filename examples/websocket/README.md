Insteon Websocket Server Example
================================

This example shows how to create a websocket server to communicate with an Insteon network through a PLM.  It offers a realtime communication bridge between a PLM and a webbrowser.  This is in a preliminary / proof-of-concept state; while it does provide the desired functionality, it needs an API to be formalized and the server needs much improvement.

1 - Install
----------
see the master [README](https://github.com/secesh/node-insteon/tree/websocket) of this branch.

2 - Edit
-------

Before starting the server, you need to edit the example so that it uses the correct COM port to communicate with the PLM.

**edit the `port` variable in** `insteon/examples/websocket/server.js`


3 - Run
------
    node node_modules/insteon/examples/websocket/server.js

4 - Browse
---------

Now open a webbrowser (that supports websockets) and browse to [localhost:8080](http://localhost:8080).  See [this demonstration](http://youtu.be/TMzlQQOwhfI)

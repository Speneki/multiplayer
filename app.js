var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/client/index.html');
});

const MAX_HEIGHT = 500;
const MAX_WIDTH = 500;

app.use("client", express.static(__dirname + "/client"));

serv.listen(2000);
console.log(" ===> Server has started... ")

var SOCKET_LIST = {};

var Entity = function() {
    var self = {
        x: 250,
        y: 250,
        spdX: 0,
        spdY: 0,
        id: ""
    }
    self.update = function() {
        self.updatePosition();
    }
    self.updatePosition = function() {
        self.x += self.spdX;
        self.y += self.spdY;
    }
}
var Player = function(id) {
    var self = Entity();

    self.id = id;
    self.pressingRight = false;
    self.pressingLeft = false;
    self.pressingUp = false;
    self.pressingDown = false;
    self.number = "" + Math.floor(10 * Math.random());

    var super_update = self.update;

    self.updatePosition = function() {
        if(self.pressingRight)
            if (self.x < MAX_WIDTH - 20)
                self.spdX += self.maxSpd;
        if(self.pressingLeft)
            if (self.x > 0 )
                self.spdX -= self.maxSpd;
        if(self.pressingUp)
            if (self.y > 0 + 15)
                self.spdY -= self.maxSpd;
        if(self.pressingDown) 
            if (self.y < MAX_HEIGHT)
                self.spdY += self.maxSpd;
    }

    return self;
}
Player.list = {};
Player.onConnect = function(socket){
    var player = Player(socket.id);
    socket.on("keyPress", function (data) {
        if (data.inputId === 'right') player.pressingRight = data.state
        if (data.inputId === 'left') player.pressingLeft = data.state
        if (data.inputId === 'up') player.pressingUp = data.state
        if (data.inputId === 'down') player.pressingDown = data.state
    }); 
}
Player.onDisconnect = function (socket) {
    console.log(" ===> A player has disconnected");
    delete Player.list[socket.id];
}
Player.update = function() {
    var pack = [];
    for (var i in Player.list) {
        var player = Player.list[i];
        player.update();
        pack.push({
            x: player.x,
            y: player.y,
            number: player.number
        })
    }
    return pack;
}
var io = require("socket.io")(serv,{});
io.sockets.on('connection', function(socket) { 
    console.log(" ===> A socket is connected")
    socket.id = Math.random();
    SOCKET_LIST[socket.id] = socket;

    Player.onConnect(socket); 
    socket.on("disconnect", function() {
        console.log(" ===> A socket is disconnected")
        delete SOCKET_LIST[socket.id];
        Player.onDisconnect(socket);
    });

});

setInterval(function() {
    var pack = Player.update();
    for (var i in SOCKET_LIST) {
        var socket = SOCKET_LIST[i];
        socket.emit('newPositions', pack)
    }
    
}, 1000/25)
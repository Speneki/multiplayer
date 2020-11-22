let express = require('express');
const { setMaxListeners } = require('process');
let app = express();
let serv = require('http').Server(app);

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/client/index.html');
});

const MAX_HEIGHT = 500;
const MAX_WIDTH = 500;

app.use("client", express.static(__dirname + "/client"));

serv.listen(2000);
console.log(" ===> Server has started... ")

let SOCKET_LIST = {};

let Entity = function() {
    let self = {
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
    self.getDistance = function(pt) {
        return Math.sqrt(Math.pow(self.x-pt.x, 2) + Math.pow(self.y-pt.y ,2))
    }
    return self;
}
let Player = function(id) {
    let self = Entity();
    
    self.id = id;
    self.pressingRight = false;
    self.pressingLeft = false;
    self.pressingUp = false;
    self.pressingDown = false;
    self.pressingAttack = false;
    self.mouseAngle = 0;
    self.number = "" + Math.floor(10 * Math.random());
    self.maxSpd = 10;

    let super_update = self.update;

    self.update = function() {
        self.updateSpd();
        super_update();

        if (self.pressingAttack) {
            self.shootBullet(self.mouseAngle)
        } 
    }
    self.shootBullet = function(angle) {
        let b = Bullet(self.id, angle);
        b.x = self.x;
        b.y = self.y;
    }
    
    self.updateSpd = function() {
        if(self.pressingRight) {
            self.spdX = self.maxSpd;
        }
        else if(self.pressingLeft) {
            self.spdX = -self.maxSpd;
        }
        else self.spdX = 0 

        if(self.pressingUp) {
            self.spdY = -self.maxSpd;
        }
        else if(self.pressingDown) {
           self.spdY = self.maxSpd;
        } else self.spdY = 0
    }
    Player.list[id] = self;

    return self;
}
Player.list = {};
Player.onConnect = function(socket){
    let player = Player(socket.id);
    socket.on("keyPress", function (data) {
        if (data.inputId === 'right') player.pressingRight = data.state
        if (data.inputId === 'left') player.pressingLeft = data.state
        if (data.inputId === 'up') player.pressingUp = data.state
        if (data.inputId === 'down') player.pressingDown = data.state
        if (data.inputId === 'attack') player.pressingAttack = data.state
        if (data.inputId === 'mouseAngle') player.mouseAngle = data.state
    }); 
}
Player.onDisconnect = function (socket) {
    console.log(" ===> A player has disconnected");
    delete Player.list[socket.id];
}
Player.update = function() {
    let pack = [];
    for (let i in Player.list) {
        let player = Player.list[i];
        player.update();
        pack.push({
            x: player.x,
            y: player.y,
            number: player.number
        })
    }
    return pack;
}

let Bullet = function(parent, angle) {
    let self = Entity();
    self.id = Math.random();
    self.spdX = Math.cos(angle/180 * Math.PI) * 10;
    self.spdY = Math.sin(angle/180 * Math.PI) * 10;
    self.timer = 0;
    self.parent = parent;
    self.toRemove = false;
    let super_update = self.update;
    self.update = function() {
        if (self.timer++ > 100) 
            self.toRemove = true;
        super_update();

        for(let i in Player.list) {
            var p = Player.list[i];
            if(self.getDistance(p) < 32 && self.parent!== p.id) {
                //handle Collission 
                self.toRemove = true;
            }
        }
    }
    Bullet.list[self.id] = self;
    return self;
}

Bullet.list = {};

Bullet.update = function() {

    let pack = [];
    for(let i in Bullet.list) {
        let bullet = Bullet.list[i];
        bullet.update();
        if(bullet.toRemove) {
            delete Bullet.list[i];
        }
        pack.push({
            x: bullet.x,
            y: bullet.y
        })
    }
    return pack;
} 

let USERS = {
    // username: password
    "spencer":"pass"
}

let isValidPassword = function(data) {
    return USERS[data.username] === data.password;
}

let io = require("socket.io")(serv,{});
io.sockets.on('connection', function(socket) { 
    console.log(" ===> A socket is connected")
    socket.id = Math.random();
    SOCKET_LIST[socket.id] = socket;

    socket.on('signIn', function (data) {
        if (isValidPassword(data)) {
            Player.onConnect(socket); 
            socket.emit('signInResponse', {success: true})
        } else 
            socket.emit('signInResponse', {success:false})
    })
    
    socket.on('signUp', function (data) {
        if (!Object.keys(USERS).includes(data.username)) {
            USERS[data.username] = data.password
            Player.onConnect(socket);
            socket.emit('signInResponse', { success: true })
        } else
            socket.emit('signInResponse', { success: false })
    })

    socket.on("disconnect", function() {
        console.log(" ===> A socket is disconnected")
        delete SOCKET_LIST[socket.id];
        Player.onDisconnect(socket);
    });

    socket.on("sendMesgToServer", function(data){
        let playerName = ("" + socket.id).slice(2,7);
        for( let i in SOCKET_LIST ) {
            SOCKET_LIST[i].emit("addToChat", playerName + ': ' + data);
        }
    })

    socket.on('evalServer', function(data){
        let res = eval(data);
        socket.emit('evalAnswer', res)
    })
});

setInterval(function() {
    let pack = {
        player: Player.update(),
        bullet: Bullet.update()
    }

    for (let i in SOCKET_LIST) {
        let socket = SOCKET_LIST[i];
        socket.emit('newPositions', pack)
    }
}, 1000/25)
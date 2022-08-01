


/*************** Required Modules **************/
var app = require("express")();
var bodyParser = require('body-parser');

var http = require("http").Server(app);
var io = require("socket.io")(http);
const PORT = process.env.PORT || 5000;

const custIds = new Map(); //connected sockets' map

/**************** Event List **********************/
const EVENT_CONNECTION = "connection";
const EVENT_USER_CREATION = "new user";
const EVENT_DISCONNECTION = "disconnect";
const EVENT_COMMUNICATION = "send message";
const EVENT_PRIVATE_CHAT = "private-chat";
const EVENT_GROUP_CHAT = "group-chat";
/******************************************************/


app.use(bodyParser.json());

app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  
  if (req.method == 'OPTIONS') {
      res.sendStatus(200);
  } else {
      next();
  }
});

app.get("/", function (req, res) {
  res.sendFile(__dirname + "/browser1.html");
});

app.get("/checkUser/:username", function (req, res) {

  res.send(custIds.has(req.params.username) ? "EXISTS" : "NOT_EXISTS");
});


app.post("/checkUsers",function (req, res) {
  let users = req.body.users;
  let tempObj = {};

  users.forEach(user => {
    tempObj[user] = custIds.has(user) ? "EXISTS" : "NOT_EXISTS";
  });

  res.json(tempObj);
});

app.get("/listUsers", function (req, res) {
  // console.info(custIds);
  res.json({
    total: custIds.size,
    users: Array.from(custIds.keys()),
    // users: Object.fromEntries(custIds)
  });
});

app.get("/healthcheck", function (req, res) {
  res.sendStatus(200);
});

io.on(EVENT_CONNECTION, function (socket) {
  socket.on(EVENT_USER_CREATION, function (data, callback) {
    var room = data ? data.trim() : "";

    if (!room || room == "") {
      socket.disconnect();
      callback(false);

      return;
    }

    if (custIds.has(room)) { // check if any entry of prev socket
      let prevId = custIds.get(room);
      console.info("disconnecting previous socket of " + room + ":" + prevId);
      io.to(prevId).emit("private", { msg: "forceLogout", nick: "SERVER" });
      if (io.sockets.connected[prevId]) {
        io.sockets.connected[prevId].disconnect();
      }
    }

    custIds.set(room, socket.id);
    console.info("joined in room: " + room + " " + socket.id);
    console.info("latest socket for " + room + ": " + custIds.get(room));

    if (callback) {
      callback(true);
    }

  });

  socket.on(EVENT_DISCONNECTION, function () {
    // console.log(socket);
    
    let disconnectedSocketId = socket.id;
    for (let [key, value] of custIds.entries()) {
      if (value === disconnectedSocketId) {
        console.info("user disconnected from room #" + key + " " + disconnectedSocketId);
        custIds.delete(key);
        break;
      }
    }

  });

  socket.on(EVENT_COMMUNICATION, function (data) {
    //communication only
    var msg = data.message;
    var custId = data.customer;
    console.info("sending to :" + custId);

    if (custIds.has(custId)) {
      // if user is online
      var socketId = custIds.get(custId);
      console.info(custId + "(" + socketId + ") " + msg);
      io.to(socketId).emit("private", {
        msg: msg,
        nick: socket.nickname,
      });
    } else {
      console.info(custId + " is not available");
    }
  });

  socket.on(EVENT_PRIVATE_CHAT, function (data) {
    //private chat
    var msg = data.message;
    var custId = data.customer;

    if (custIds.has(custId)) {
      // if user is online
      var socketId = custIds.get(custId);
      io.to(socketId).emit("private-chat", {
        msg: msg,
        nick: socket.nickname,
      });
    }
  });

  socket.on(EVENT_GROUP_CHAT, function (data) {
    //group chat
    console.info(data);
    var msg = data.message;
    var receivers = data.receivers;

    console.info(
      "group chat receiver list array check :" + Array.isArray(receivers)
    );

    //receivers = (data.receivers.slice(1, -1)).split(',');

    for (var i = 0; i < receivers.length; i++) {
      if (custIds.has(receivers[i].trim())) {
        let receiverSocketId = custIds.get(receivers[i].trim());
        io.to(receiverSocketId).emit("group-chat", {
          msg: msg,
          nick: socket.nickname,
        });
      }
    }
  });
});


http.listen(PORT, function () {
  // console.log("environment:",process.env.NODE_ENV);
  console.info("server started");

});


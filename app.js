
/**
 * Module dependencies.
 */

var express = require('express');
var http = require('http');
var path = require('path');
var mongoose = require('mongoose');
var socketio = require('socket.io');
var parseSignedCookies = require('express/node_modules/connect/lib/utils').parseSignedCookies;
var parseCookie = require('express/node_modules/cookie').parse;
var MemoryStore = MemoryStore = express.session.MemoryStore;
var sessionStore = new MemoryStore();

var app = express();

var db = mongoose.connect('mongodb://localhost:27017/WebCrawler');

var sessionConfig = {
	store: sessionStore,
	secret:'secret',
	key:'express.sid'
};

// Load Models
require('./models/models')();

app.set('port', process.env.PORT || 3000);
app.set('views', './public/views');
app.set ('view engine', 'ejs');
app.use(express.favicon('./public/favicon.ico'));
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.cookieParser());
app.use(express.session(sessionConfig));
app.use(app.router);

if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

// // Load Routes
// require('./controllers/routes')(app);

//Start Server
var server = http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

//Start Socket.io
var io = socketio.listen(server);
io.set('log level', 1);

// Load Routes
require('./controllers/routes')(app, io);

//Socket on connect
io.sockets.on('connection', function (socket) {
  console.log('A socket with sessionID ' + socket.handshake.sessionID + ' connected!');
  socket.join(socket.handshake.sessionID);
  socket.on('disconnect', function (){
  	console.log('client disconnected');
  })
});

io.set('authorization', function (data, accept) {
    // check if there's a cookie header
    if (data.headers.cookie) {
        signedCookies = parseCookie(data.headers.cookie);
  			data.cookie = parseSignedCookies(signedCookies, 'secret');
        data.sessionID = data.cookie['express.sid'];
        sessionStore.get(data.sessionID, function (err, session) {
            if (err || !session) {
              return accept('Error', false);
            } 
            else {
             data.session = session;
             return accept(null, true);
            }
        });
    } 
    else {
      return accept('No cookie transmitted.', false);
    }
});
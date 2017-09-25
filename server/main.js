var path = require("path");
var express = require('express')

var app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.json());

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.use(express.static(path.join(__dirname, '../'), { maxAge: 86400000 }));
app.use(express.static(path.join(__dirname + '../node_modules')));  

var http = require('http').Server(app);
var io = require('socket.io')(http);

// Datenbank initialisieren
var storage = require('node-persist');
storage.initSync( /* options ... */ );


var initPlayers = function() {
    var players = [
        {
            playerId: 0,
            name: 'Martin',
            socketId: null,
            isConnected: false
        },
        {
            playerId: 1,
            name: 'Karin',
            socketId: null,
            isConnected: false
        },
        {
            playerId: 2,
            name: 'Alicia',
            socketId: null,
            isConnected: false
        },
        {
            playerId: 3,
            name: 'Simon',
            socketId: null,
            isConnected: false
        }
    ]
    storage.setItemSync('players', players);
};

var initCards = function() {
    // current cards
    storage.setItemSync('currentCards', []);

    // init cards
    var cards = [];
    var cardId = 0;
    for(var i = 0; i<4; i++) {
        var color = '';
        switch (i) {
            case 0:
                color = 'black';
            break;

            case 1:
                color = 'blue';
            break;

            case 2:
                color = 'red';
            break;

            case 3:
                color = 'yellow';
        }

        for (var j=1; j<=13; j++) {
            var card = {
                id : cardId,
                color: color,
                value: j,
                player: -1,
                isJoker: false  
            };
            cardId++;
            cards.push(card);

            var cardCopy = JSON.parse(JSON.stringify(card));
            cardCopy.id = cardId;
            cardId++;
            cards.push(cardCopy);
        }
    }

    // jokers
    var jokerCard = {
        id : cardId,
        color: '',
        value: 0,
        player: -1,
        isJoker: true  
    };
    cardId++;
    cards.push(jokerCard);

    var cardCopy = JSON.parse(JSON.stringify(jokerCard));
    cardCopy.id = cardId;
    cards.push(cardCopy);

    storage.setItemSync('cards', cards);
};

var initBoard = function() {
    var board = {
        rows: []
    };

    for(var i=0; i<11; i++) {
        var columns = [];
        for(var j=0; j<26; j++) {
            columns.push({card: { value: '', color: 'white'}});
        }

        board.rows.push(columns);
    }

    storage.setItemSync('board', board);
};

var getRandomCard = function(cards) {
    var foundOne = false;
    var card = null;

    var cardsAvailable = cards.filter(function(card) {
        return card.player == -1;
    });

    if (cardsAvailable.length > 0) {
        while (!foundOne) {
            var rndNr = Math.floor((Math.random() * 1000)) % 105;
            if (cards[rndNr].player == -1) {
                card = cards[rndNr]
                foundOne = true;
            }
        }
    }

    return card;
}

var initPlayerCards = function() {
    var cards = storage.getItemSync('cards');
    
    for (var i=0; i<4; i++) {
        for (var j=0; j<14; j++) {
            var foundOne = false;
            var card = getRandomCard(cards);
            card.player = i;
        }
    }
    storage.setItemSync('cards', cards);  
};

var removeCardFromCurrentCards = function(cardToRemove) {
    var currentCards = storage.getItemSync('currentCards');    
    var index = currentCards.map(function(card) { return card.id }).indexOf(cardToRemove.id);
    if (index >= 0) {
        currentCards.splice(index, 1);
        storage.setItemSync('currentCards', currentCards);
    }
};

// BACKEND
// Spieler
app.get('/players', function(req, res) {
    try
    {
        var players = storage.getItemSync('players');
        res.json({ players: players });
    }
    catch (e)
    {
        console.log(e);
    }
});  

// aktuelle Karte hinzufügen setzen
app.post('/currentCard', function(req, res) {
    try
    {
        var currentCardFromBody = req.body;
        if (currentCardFromBody != null && currentCardFromBody.value != '') {
            var currentCards = storage.getItemSync('currentCards'); 

            if (currentCards.map(function(card) { return card.id }).indexOf(currentCardFromBody.id) < 0) {
                currentCards.push(currentCardFromBody);
                storage.setItemSync('currentCards', currentCards);
            } else {
                removeCardFromCurrentCards(currentCardFromBody);
            }

            io.emit('refresh', 'hello World');
        }
        res.json({ok: true});
    }
    catch (e)
    {
        console.log(e);
        res.json({ok: false});
    }
});

// aktuelle Karte bekommen
app.get('/currentCards', function(req, res) {
    try
    {
        var card = storage.getItemSync('currentCards');
        res.json(card);
    }
    catch (e)
    {
        console.log(e);
        res.json({ok: false});
    }
});

// Karte legen (card.player: board= -2, niemand=-1, 0-3=spieler)
app.post('/putCard', function(req, res) {
    try
    {
        var position = req.body;

        console.log(position);
        var board = storage.getItemSync('board');
        if (position.card != null) {
            var cards = storage.getItemSync('cards');    
            // suche karte und sage das diese auf dem Spiel liegt
            console.log("suche karte");
            cards.forEach(function(card) {
                if (card.id == position.card.id) {
                    card.player = -2;
                }
            }, this);
            storage.setItemSync('cards', cards);
            console.log("karte gefunden");
    
            // setze Karte auf Spielfeld
            console.log("setze karte aufs spielfeld");
            board.rows[position.row][position.col].card = position.card;
            
            // nehme es aus den currentCards heraus
            removeCardFromCurrentCards(position.card);
        } else {
            board.rows[position.row][position.col].card = { value: '', color: 'white' };
        }
        
        storage.setItemSync('board', board);
        
        io.emit('refresh', { for: 'everyone' });
        res.json({ok: true});
    }
    catch (e)
    {
        console.log(e);
        res.json({ok: false});
    }
});

// Karte ziehen
app.get('/getCard', function(req, res) {
    try
    {
        var player = req.query.playerId;
        var cards = storage.getItemSync('cards');
        
        var card = getRandomCard(cards);
        card.player = player;
        storage.setItemSync('cards', cards);

        res.json(card);
    }
    catch(e) {
        console.log(e);
    }
});

app.get('/giveCardToPlayer', function(req, res) {
    try
    {
        var playerId = req.query.playerId;
        var cardId = req.query.cardId;
        
        var cards = storage.getItemSync('cards');        
        var card = cards.filter(function(card) {
            return card.id == cardId;
        })[0];

        card.player = playerId;
        storage.setItemSync('cards', cards);

        removeCardFromCurrentCards(card);

        io.emit('refresh', 'hello world.');
        res.json(card);
    }
    catch(e) {
        console.log(e);
    }
});

// alle Karten
app.get('/cards', function(req, res) {
    try
    {
        var playerId = req.query.playerId;
        var cards = storage.getItemSync('cards');

        var playerCards = cards.filter(function(card) {
            return card.player == playerId;
        });

        res.json({ cards: playerCards });
    }
    catch (e)
    {
        console.log(e);
    }
});

// aktueller Bordstand
app.get('/board', function(req, res) {
    try {
        var board = storage.getItemSync('board');
        res.json({ board: board });
    }
    catch (e)
    {
        console.log(e);
    }
});

app.get('/reset', function(req, res) {
    try {
        initCards();
        initPlayerCards();
        initBoard();
    }
    catch (e)
    {
        console.log(e);
    }
});

app.get('/save', function(req, res) {
    try {
        var saveState = {
            board: storage.getItemSync('board'),
            cards: storage.getItemSync('cards'),
            currentCards: storage.getItemSync('currentCards'),
            timestamp: Date.now()
        }
    
        var saveStates = storage.getItemSync('saveStates');
        saveStates.push(saveState);
        storage.setItemSync('saveStates', saveStates);
        res.json({ok: true, lastStateTimeStamp: saveState.timestamp});
    }
    catch (e) {
        console.log(e);
        res.json({ok: false});
    }
    
});

app.get('/load', function(req, res) {
    try {
        console.log('load...');
        var saveStates = storage.getItemSync('saveStates');
        console.log('loaded...');
        if (saveStates.length > 0) {
            console.log('pop');
            var lastState = saveStates.pop();
            console.log(lastState);

            var board = lastState.board; 
            var cards = lastState.cards; 
            var currentCards = lastState.currentCards; 

            storage.setItemSync('board', board);
            storage.setItemSync('cards', cards);
            storage.setItemSync('currentCards', currentCards);
            storage.setItemSync('saveStates', saveStates);

            io.emit('refresh', 'hello world.');
        }
        res.json({ ok: true });
    }
    catch (e) {
        console.log(e);
        res.json({ ok: false });
    }
});

app.get('/nextPlayer', function(req, res) { 
    var currentPlayer = storage.getItemSync('currentPlayer');
    
});

// INIT APP
try {
    // Websockets
    io.on('connection', function(socket){
        var playerId = -1;
        var socketId = socket.id;

        socket.on('disconnect', function(socket){
            var players = storage.getItemSync('players');
            players[playerId].isConnected = false;
            console.log(players[playerId].name + ' disconnected');
            storage.setItemSync('players', players);
        });

        socket.on('setPlayer', function(msg) {
            var players = storage.getItemSync('players');
            var player = players[msg.playerId];
            player.isConnected = true;
            playerId = msg.playerId;
            player.socketId = msg.socketId;
            storage.setItemSync('players', players);
            console.log(player.name + ' connected');
        });

        io.emit('refresh', { for: 'everyone' });
    });

    storage.setItemSync('saveStates', []);
    initPlayers();
    initCards();
    initPlayerCards();
    initBoard();

    var port = process.env.PORT || 8080;    
    http.listen(port, function() {
        console.log('listening on: ' + port );
    });  
} catch(e) {
    console.log(e);
}


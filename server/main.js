var express = require('express')

var app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.json());

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});


var storage = require('node-persist');


// Datenbank initialisieren
storage.initSync( /* options ... */ );
storage.setItemSync('players','[Simon, Alicia, Karin, Martin]');

var initCards = function() {
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

    for(var i=0; i<100; i++) {
        var columns = [];
        for(var j=0; j<13; j++) {
            columns.push({card: { value: '', color: 'black'}});
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
})  

// aktuelle Karte setzen
app.post('/currentCard', function(req, res) {
    try
    {
        var currentCardFromBody = req.body;
        storage.setItemSync('currentCard', currentCardFromBody);        
        res.json({ok: true});
    }
    catch (e)
    {
        console.log(e);
        res.json({ok: false});
    }
});

// aktuelle Karte bekommen
app.get('/currentCard', function(req, res) {
    try
    {
        var card = storage.getItemSync('currentCard');
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
        var board = storage.getItemSync('board');
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
        storage.setItemSync('board', board);
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

// INIT APP
try {
    initCards();
    initPlayerCards();
    initBoard();
    app.listen(3000, '0.0.0.0')
} catch(e) {
    console.log(e);
}


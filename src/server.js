let sockets = [];
let game = null;

module.exports = {
  io: (socket) => {
    let name = socket.handshake.query.name;
    let createdGameAutostartTimeout;

    socket.on('disconnect', () => {
      console.log('disconnected', socket.id, name);
      if(createdGameAutostartTimeout) {
        clearTimeout(createdGameAutostartTimeout);
      }
      delete sockets[socket.id];
      if(!socket.game.isFull()) {
        game = null;
      } else {
        socket.game.end(socket.id);
      }
    });

    socket.on('bot', () => {
      let r = rand(10);
      socket.game.addPlayer('bot' + r, 'Bot-' + r);
      socket.game.bot = 'bot' + r;
      console.log(name + ' play against bot ' + r);
    });

    socket.on('activate', (e) => {
      if(socket.game.state === 'pick') {
        socket.game.pick(socket.id, e.char);
        if(socket.game.bot) {
          setTimeout(() => {
            let char = pick(socket.game.chars.filter(c => !c.owner));
            if(char) {
              socket.game.pick(socket.game.bot, char.id);
            }
          }, 2000);
        }
      } else if(socket.game.state === 'play') {
        socket.game.move(socket.id, e.char);
        if(socket.game.bot) {
          setTimeout(() => {
            let char = pick(socket.game.chars.filter(c => c.hp > 0 && c.owner === socket.game.bot));
            if(char) {
              socket.game.move(socket.game.bot, char.id);
            }
          }, 7000);
        }
      }
    });

    console.log('connected', socket.id, name, JSON.stringify(socket.handshake));
    sockets[socket.id] = socket;

    if(!game || game.isFull()) {
      game = new Game({
        onevent: async e => {
          socket.game.players.forEach(p => {
            if(sockets[p.id]) {
              sockets[p.id].emit(e.name, e.data);
            }
          });
          if(e.name === 'state' && e.data.state === 'game-over') {
            let evt = e.data;
            console.log(`Game Over: ${evt.data.winner.name} won against ${evt.data.loser.name}. ${evt.data.reason || ''}`);
            let ranking = await storage.get('ranking', []);
            let winner = ranking.find(e => e.n === evt.data.winner.name);
            if(!winner) {
              winner = {n: evt.data.winner.name, p: 1500, w: 0, l: 0};
              ranking.push(winner);
            }
            let loser = ranking.find(e => e.n === evt.data.loser.name);
            if(!loser) {
              loser = {n: evt.data.loser.name, p: 1500, w: 0, l: 0};
              ranking.push(loser);
            }
            winner.w++;
            loser.l++;
            let expectedW = 1 / (1 + Math.pow(10, ((loser.p - winner.p) / 400)));
            let expectedL = 1 / (1 + Math.pow(10, ((winner.p - loser.p) / 400)));
            winner.p = Math.round(winner.p + 32 * (1 - expectedW));
            loser.p = Math.round(loser.p + 32 * (0 - expectedL));
            ranking.sort((b, a) => a.p !== b.p ? a.p - b.p : a.w - b.w);
            let saved = false;
            while(!saved) {
              saved = await storage.set('ranking', ranking);
              if(!saved) {
                ranking.pop();
              }
            }
          }
        }
      });
      console.log('new game', game.id);

      createdGameAutostartTimeout = setTimeout(() => {
        if(socket.game.state === 'wait') {
          let r = rand(10);
          socket.game.addPlayer('bot' + r, 'Bot-' + r);
          socket.game.bot = 'bot' + r;
          console.log(name + ' autoplay against bot ' + r);
        }
      }, 120 * 1000);
    }

    socket.game = game;
    game.addPlayer(socket.id, name);
  },

  ranking: (req, res) => {
    storage.get('ranking', []).then(r => {
      res.send(r);
    });
  }

};

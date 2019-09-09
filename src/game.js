class Player {
  constructor(cfg) {
    this.id = cfg.id;
    this.index = cfg.index;
    this.name = cfg.name;
  }
}

class Char {
  constructor(cfg) {
    this.id = id('char');
    this.owner = null;
    this.pos = cfg.pos;
    this.hp = 100;
    this.directions = new Array(4).fill(0).map(() => ({dir: pick(DIRS), size: 4}));
    this.nextDir = 0;
    this.dir = pick(DIRS);
  }
}

class Event {
  constructor(name, data) {
    this.name = name;
    this.data = data;
  }
}

class Game {
  constructor(cfg) {
    this.id = id('game');
    cfg.participants = cfg.participants || 2;
    cfg.squad = cfg.squad || 4;
    this.cfg = cfg;
    this.state = null;
    this.players = [];
    this.chars = [];
    this.field = {
      height: (cfg.squad + cfg.participants) * 2 - 2,
      width: (cfg.squad + cfg.participants) * 2 - 2
    };
    this.turn = 0;
  }

  emit(evtName, evtData) {
    this.cfg.onevent(new Event(evtName, evtData));
  }

  changeState(state, data) {
    if(this.state === 'game-over') {
      return;
    }
    this.state = state;
    this.emit('state', {
      state: this.state,
      chars: this.chars,
      cfg: {
        squad: this.cfg.squad,
        participants: this.cfg.participants
      },
      players: this.players,
      field: this.field,
      data
    });
  }

  isFull() {
    return this.players.length === this.cfg.participants;
  }

  addPlayer(pid, name) {
    if(this.state && this.state !== 'wait') {
      return;
    }
    if(!this.isFull()) {
      this.players.push(new Player({id: pid, index: this.players.length, name}));
    }
    if(this.isFull()) {
      for(let x = 0; x < this.cfg.squad * (this.cfg.participants + 1); x++) {
        this.chars.push(new Char({
          pos: this.getRandomFreePos()
        }));
      }
      this.changeState('pick');
    } else {
      this.changeState('wait');
    }
  }

  end(pid) {
    this.changeState('game-over', {
      reason: 'abandon',
      loser: this.getPlayer(pid),
      winner: this.players.find(p => p.id !== pid)
    });
  }

  getRandomPos() {
    return {
      x: rand(this.field.width - 1),
      y: rand(this.field.height - 1)
    }
  }

  getInPos(pos) {
    return this.chars.find(c => c.pos.x === pos.x && c.pos.y === pos.y);
  }

  getNearestEnemy(char) {
    let enemies = shuffle(this.chars.filter(c => c.owner !== char.owner));
    let sorted = enemies.map((c) => {
      return {
        dist: dist(c.pos, char.pos),
        char: c
      };
    }).sort((a, b) => {
      return a.dist - b.dist;
    });
    if(sorted.length) {
      return sorted[0].char;
    }
  }

  getRandomFreePos() {
    let pos = this.getRandomPos();
    while(this.getInPos(pos)) {
      pos = this.getRandomPos();
    }
    return pos;
  }

  getNewPos(pos, dir) {
    let newPos;
    switch(dir) {
      case 'left':
        newPos = {...pos, x: pos.x - 1};
        break;
      case 'right':
        newPos = {...pos, x: pos.x + 1};
        break;
      case 'up':
        newPos = {...pos, y: pos.y - 1};
        break;
      case 'down':
        newPos = {...pos, y: pos.y + 1};
        break;
    }
    if(newPos.x < 0) {
      newPos.x = this.field.width - 1;
    }
    if(newPos.y < 0) {
      newPos.y = this.field.height - 1;
    }
    if(newPos.x >= this.field.width) {
      newPos.x = 0;
    }
    if(newPos.y >= this.field.height) {
      newPos.y = 0;
    }
    return newPos;
  }

  getPlayer(pid) {
    return this.players.find(p => p.id == pid);
  }

  getChar(cid) {
    return this.chars.find(c => c.id == cid);
  }

  getPlayerChars(pid) {
    return this.chars.filter(c => c.owner == pid);
  }

  pick(pid, cid) {
    if(this.getPlayerChars(pid).length === this.cfg.squad) {
      return;
    }
    let c = this.getChar(cid);
    if(!c || c.owner) {
      return;
    }
    c.owner = pid;
    this.emit('pick', {
      pid,
      pindex: this.getPlayer(pid).index,
      cid,
      done: this.getPlayerChars(pid).length === this.cfg.squad
    });
    for(let x = 0; x < this.players.length; x++) {
      if(this.getPlayerChars(this.players[x].id).length < this.cfg.squad) {
        return;
      }
    }
    this.removeChars();
    this.changeState('play');
    this.turn = 0;
    this.emit('turn', {turn: this.turn});
  }

  async move(pid, cid) {
    let player = this.getPlayer(pid);
    if(this.turn % this.players.length !== player.index) {
      return;
    }

    let char = this.getChar(cid);
    if(char.owner !== pid) {
      return;
    }

    if(this._moving) {
      return;
    }
    this._moving = true;

    this.turn++;

    // move in dir
    let direction = char.directions[char.nextDir];
    char.nextDir = ((char.nextDir + 1) % (char.directions.length)) || 0;

    // move
    let size = direction.size;
    let newPos;
    let moves = [];
    //console.log('prev pos', char.pos);
    //console.log('direction', direction);
    while(size--) {
      let nextPos = this.getNewPos(newPos || char.pos, direction.dir);
      if(this.getInPos(nextPos)) {
        //console.log('stop', 'pos is occupied by', this.getInPos(nextPos));
        break;
      } else {
        newPos = nextPos;
        moves.push(nextPos);
      }
    }
    if(newPos) {
      char.pos = newPos;
    }
    char.dir = direction.dir;
    this.emit('new-pos', {char, moves});

    await sleep(1 + moves.length / 2);

    // find the nearest opp
    let enemy = this.getNearestEnemy(char);

    // attack
    let fromBack = isFromBack(char.pos, enemy.pos, enemy.dir);
    let damage = 3 * dist(char.pos, enemy.pos) * (fromBack ? 3 : 1);

    enemy.hp = Math.max(enemy.hp - damage, 0);

    this.emit('attack', {
      char,
      enemy,
      damage,
      fromBack,
      chars: this.chars
    });

    if(enemy.hp === 0) {
      //console.log('die', enemy.id, enemy.hp);
      await sleep(1);
      this.chars = this.chars.filter(c => c.id !== enemy.id);
      this.emit('die', {enemy});

      let other = this.getNearestEnemy(char);
      if(!other) {
        this.changeState('game-over', {
          winner: player,
          loser: this.getPlayer(enemy.owner)
        });
        return;
      }
    }

    await sleep(1);
    this._moving = false;
    this.emit('turn', {turn: this.turn});

  }

  removeChars() {
    this.emit('remove-chars', {chars: this.chars.filter(c => c.owner === null)});
    this.chars = this.chars.filter(c => c.owner !== null);
  }

}

document.addEventListener('DOMContentLoaded', () => {

  let socket = null;
  let main = document.querySelector('main');
  let header = document.querySelector('header');
  let field;
  let squad;
  let players = null;
  let formInput = document.querySelector('form.start input');
  formInput.value = localStorage.getItem('n') || '';

  document.querySelector('form.start').addEventListener('submit', e => {
    e.preventDefault();
    connect(formInput.value);
    music();
  });

  document.querySelectorAll('a.ranking').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      document.querySelector('div.ranking').classList.add('show');
      let tbody = document.querySelector('div.ranking table tbody');
      tbody.innerHTML = 'Loading...';
      fetch('/ranking').then(r => r.json()).then(res => {
        tbody.innerHTML = '';
        res.forEach((r, i) => {
          let tr = document.createElement('tr');
          let td0 = document.createElement('td');
          td0.innerHTML = i + 1 + '.';
          tr.appendChild(td0);
          let td1 = document.createElement('td');
          td1.innerHTML = r.n;
          tr.appendChild(td1);
          let td2 = document.createElement('td');
          td2.innerHTML = r.p;
          tr.appendChild(td2);
          let td3 = document.createElement('td');
          td3.innerHTML = r.w;
          tr.appendChild(td3);
          let td4 = document.createElement('td');
          td4.innerHTML = r.l;
          tr.appendChild(td4);
          tbody.appendChild(tr);
        })
      });
    });
  }); 

  document.querySelector('div.ranking button').addEventListener('click', e => {
    e.preventDefault();
    document.querySelector('div.ranking').classList.remove('show');
  });

  document.querySelector('a.bot').addEventListener('click', e => {
    e.preventDefault();
    socket.emit('bot');
  });

  let inviteLink = document.querySelector('.wait small a');
  inviteLink.innerHTML = location.href;
  inviteLink.href = location.href;

  function connect(name) {
    localStorage.setItem('n', name);
    document.body.classList.remove('initial');
    socket = io({query: `name=${encodeURIComponent(name)}`});

    socket.on('connect', () => {
      console.log('connected', socket.id);
      document.body.classList.add('connected');
    });
    
    socket.on('disconnect', () => {
      console.log('disconnected');
      location.reload();
    });

    socket.on('state', (e) => {
      console.log('state', e);
      document.body.dataset.state = e.state;
      if(e.cfg.squad) {
        squad = e.cfg.squad;
      }
      if(e.players) {
        players = e.players;
      }
      if(e.field) {
        createField(e.field.height, e.field.width);
      }
      if(e.state === 'pick') {
        createChars(e.chars);
        header.innerHTML = e.players.map(p => `<div class="name" data-owner="${p.index}" data-owner-id="${p.id}"><span>${p.name}</span><div class="hp"></div></div>`).join('<span class="vs">VS</span>');
        setTimeout(() => {
          field.classList.add('ok');
          play('state');
        }, 100);
      }
      if(e.state === 'game-over') {
        play('state');
        if(e.data.reason === 'abandon') {
          document.body.classList.add('abandon');
        } else if(e.data.winner.id === socket.id) {
          document.body.classList.add('won');
        } else {
          document.body.classList.add('lost');
        }
      }
    });

    socket.on('pick', (e) => {
      console.log('pick', e);
      let el = field.querySelector('#' + e.cid);
      el.focus();
      el.dataset.owner = e.pindex;
      if(e.pid === socket.id) {
        el.classList.add('own');
      } else {
        el.classList.add('nope');
      }
      if(e.done && e.pid === socket.id) {
        document.querySelector('.picking').classList.add('done');
      }
      play('pick' + (e.pid !== socket.id ? '2' : ''));
    });

    socket.on('turn', (e) => {
      console.log('turn', e);
      let p = players[e.turn % players.length];
      document.body.dataset.turn = p.id === socket.id ? 'me' : 'opp';
    });

    socket.on('remove-chars', (e) => {
      console.log('remove-chars', e);
      e.chars.forEach(c => {
        let el = field.querySelector('#' + c.id);
        el.remove();
      });
    });

    socket.on('new-pos', (e) => {
      console.log('new-pos', e);
      let c = field.querySelector('#' + e.char.id);
      c.focus();
      c.tabIndex = e.char.pos.y * 100 + e.char.pos.x + 1;
      c.dataset.dir = e.char.dir;
      for(let m = 0; m < e.moves.length; m++) {
        setTimeout(() => {
          play('new-pos');
          c.style.setProperty('--x', e.moves[m].x);
          c.style.setProperty('--y', e.moves[m].y);
        }, 400 * m);
      }
      setTimeout(() => {
        c.querySelector('.dirs .next').classList.remove('next');
        c.querySelectorAll('.dirs > *')[e.char.nextDir].classList.add('next');  
      }, 4000);
    });

    socket.on('attack', (e) => {
      console.log('attack', e);
      let bullet = document.createElement('div');
      bullet.classList.add('bullet');
      bullet.style.setProperty('--x', e.char.pos.x);
      bullet.style.setProperty('--y', e.char.pos.y);
      field.appendChild(bullet);
      setTimeout(() => {
        bullet.style.setProperty('--x', e.enemy.pos.x);
        bullet.style.setProperty('--y', e.enemy.pos.y);
        play('shot');
      }, 30);
      setTimeout(() => {
        bullet.remove();
        particles(e.enemy.pos, e.fromBack ? 30 : 10, e.fromBack ? 200 : 100, e.fromBack ? '#F00' : '#FFF');
        let enemy = document.querySelector('#' + e.enemy.id);
        enemy.title = e.enemy.hp + ' HP';
        let enemyHp = enemy.querySelector('.hp');
        enemyHp.style.setProperty('--hp', e.enemy.hp);
        let totalHp = document.querySelector('header [data-owner-id="' + e.enemy.owner + '"] .hp');
        let totHp = e.chars.filter(c => c.owner === e.enemy.owner).reduce((prev, curr) => prev + (curr.hp / squad), 0);
        totalHp.title = totHp + ' HP';
        totalHp.style.setProperty('--hp', totHp);
        play('hit' + (e.fromBack ? '' : '0'), e.damage);
        let dmg = document.createElement('div');
        dmg.innerHTML = '-' + e.damage;
        dmg.classList.add('dmg');
        dmg.style.setProperty('--x', e.enemy.pos.x);
        dmg.style.setProperty('--y', e.enemy.pos.y);
        field.appendChild(dmg);
        setTimeout(() => {
          dmg.style.setProperty('--y', e.enemy.pos.y - 1);
          dmg.style.opacity = 0;
          setTimeout(() => {
            dmg.remove();
          }, 500);
          if(e.fromBack) {
            speak('backshot!');
          }
        }, 1000);
      }, 800);
    });

    socket.on('die', (e) => {
      console.log('die', e);
      setTimeout(() => {
        play('die', 2);
      }, 0);
      setTimeout(() => {
        play('die', 4);
      }, 300);
      setTimeout(() => {
        play('die', 6);
      }, 600);
      setTimeout(() => {
        play('die', 10);
      }, 1000);
      let el = field.querySelector('#' + e.enemy.id);
      el.classList.add('died');
      setTimeout(() => {
        el.remove();
      }, 1800);
    });

    socket.on('error', (e) => {
      console.error(e);
      document.body.classList.add('error');
    });

  }

  function createField(h, w) {
    field = main.querySelector('.field');
    if(field) {
      return;
    }
    field = document.createElement('div');
    field.classList.add('field');
    field.style.setProperty('--h', h);
    field.style.setProperty('--w', w);
    main.appendChild(field);
  }

  function createChars(chars) {
    chars.forEach(char => {
      let el = document.createElement('a');
      el.classList.add('char');
      el.id = char.id;
      el.href = '#';
      el.title = char.hp + ' HP';
      el.style.setProperty('--x', char.pos.x);
      el.style.setProperty('--y', char.pos.y);
      el.tabIndex = char.pos.y * 100 + char.pos.x + 1;
      el.dataset.dir = char.dir;
      el.addEventListener('click', (e) => {
        e.preventDefault();
        socket.emit('activate', {char: char.id});
      });

      let hp = document.createElement('div');
      hp.classList.add('hp');
      el.appendChild(hp);

      let body = document.createElement('div');
      body.classList.add('body');
      el.appendChild(body);

      let dirs = document.createElement('div');
      dirs.classList.add('dirs');
      dirs.innerHTML = char.directions.map(((d, i) => {
        return `<span class="${d.dir}${i === char.nextDir ? ' next' : ''}"></span>`
      })).join(' ');
      el.appendChild(dirs);

      field.appendChild(el);
    });
  }

  function particles(pos, n, dist, color) {
    for(let x = 0; x < n; x++) {
      let p = document.createElement('div');
      p.classList.add('particle');
      p.style.setProperty('--x', pos.x);
      p.style.setProperty('--y', pos.y);
      p.style.setProperty('--scale', rand(5, 1) / 10);
      p.style.background = color;
      field.appendChild(p);
      setTimeout(() => {
        p.style.setProperty('--x', pos.x + (rand(dist, -dist) / 100));
        p.style.setProperty('--y', pos.y + (rand(dist, -dist) / 100));
        p.classList.add('go');
        setTimeout(() => {
          p.remove();
        }, 1000);
      }, 10);
    }
  }

  function play(sound, p = 1) {
    let a = new Audio();
    a.src = jsfxr({
      state: [1,0,0.38,0.4,0.41,0.23,0,0.49,0,0,0,0,0,0,0,0.44,0,0,1,0,0,0,0,0.5],
      pick: [0,0,0.17,0.4,0.11,0.26,0,0,0,0,0,0,0,0.2,0,0,0,0,1,0,0,0.1,0,0.5],
      pick2: [2,0,0.13,0.4,0.13,0.37,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0.1,0,0.8],
      'new-pos': [0,0,0.19,0.4,0.19,0.43,0,0.2,0,0,0,0,0,0.27,0,0,0,0,0.66,0,0,0,0,0.5],
      shot: [1,0,0.1,0.4,0.2,0.82,0.2,-0.3,0,0,0,0,0,0.62,-0.6,0,0,-0.2,1,0,0,0,0,0.8],
      hit: [3,0,0.01*p,0.6,0.4,0.02,0,0,0,0,0,0.79,0.74,0,0,0,-0.02,-0.25,1,0,0,0,0,0.75],
      hit0: [3,0,0.34,0.69,0.15,0.1,0,-0.2,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0.5],
      die: [3,0,0.3,0.7,0.47,0.03,0,0.2,0,0,0,0,0,0,0,0.85,0.4,-0.27,0.1*p,0,0,0,0,0.6]
    }[sound]);
    a.play();
  }

  function music() {
    let actx = new AudioContext();
    let anode = actx.createScriptProcessor(0, 0, 1);
    let anr = 0;
    let aseq = [[0,1,,,2,1],[3,1,,,3,0],[1,3,,,2,0],[6,2,,,3,5]];
    let aseqi = 0;
    anode.onaudioprocess = function(e) {
      let data = e.outputBuffer.getChannelData(0);
      for(let i = 0; i < data.length; i++) {
        let t = ++anr / actx.sampleRate * 2.2;
        if(anr % (((7.27275 * actx.sampleRate)|0)*2) == 0) {
          aseqi++;
        }
        data[i] = (Math.random()*(((1-t*2%1)**5)+((1-t/2%1)**16)*8)+(t*(t&12|32)*aseq[aseqi%aseq.length][t*2&5]%1))/16;
      }
    }
    anode.connect(actx.destination);
  }

  function speak(txt) {
    if(window.SpeechSynthesisUtterance && window.speechSynthesis) {
      let s = new SpeechSynthesisUtterance(txt);
      s.pitch = 0.01;
      s.rate = 0.5;
      speechSynthesis.speak(s);
    }
  };

});

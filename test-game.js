const vm = require('vm');
const fs = require('fs');
const assert = require('assert');

new vm.Script(fs.readFileSync('./src/shared.js')).runInThisContext();
new vm.Script('GAME_SPEED = 1000;').runInThisContext();

assert.ok(isFromBack({x: 0, y: 0}, {x: 1, y: 0}, 'right'));
assert.ok(!isFromBack({x: 0, y: 0}, {x: 1, y: 0}, 'left'));
assert.ok(isFromBack({x: 5, y: 9}, {x: 5, y: 0}, 'up'));
assert.ok(isFromBack({x: 5, y: 9}, {x: 50, y: 100}, 'down'));

new vm.Script(fs.readFileSync('./src/game.js')).runInThisContext();

assert.ok(Game);

const game = new Game({
  participants: 2,
  onevent: e => {/*console.log(e)*/}
});
assert.ok(game);
assert.ok(game.players.length === 0);
assert.ok(!game.state);
assert.ok(game.chars.length === 0);

game.addPlayer('A');
assert.ok(game.state === 'wait');
assert.ok(game.players.length === 1);

game.addPlayer('B');
assert.ok(game.players.length === 2);
assert.ok(game.state === 'pick');
assert.ok(game.chars.length > 0);
assert.ok(game.chars[0].directions.length === 4);
assert.ok(game.getChar(game.chars[0].id).owner === null);
assert.ok(game.getInPos(game.chars[0].pos) === game.chars[0]);

game.pick('A', game.chars[0].id);
assert.ok(game.getChar(game.chars[0].id).owner === 'A');

game.pick('B', game.chars[1].id);
game.pick('A', game.chars[2].id);
game.pick('B', game.chars[3].id);
game.pick('A', game.chars[4].id);
game.pick('A', game.chars[5].id);
game.pick('B', game.chars[6].id);
game.pick('B', game.chars[7].id);
assert.ok(game.state === 'play');
assert.ok(game.chars.length === 8);

(async function play() {
  while(game.state === 'play') {
    let pid = game.players[game.turn % 2].id;
    let cid = pick(game.chars.filter(c => c.owner === pid && c.hp > 0)).id;
    await game.move(pid, cid);
  }
  assert.ok(game.state === 'game-over');
  
  console.log('Game test OK');
})();

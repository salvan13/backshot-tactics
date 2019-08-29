let DIRS = ['up', 'down', 'left', 'right'];

let GAME_SPEED = 200; /* 0 to 1000 */

let rand = (max = 100, min = 0) => Math.floor(Math.random() * (max - min + 1) + min);

let pick = list => list[rand(list.length - 1)];

let shuffle = list => list.map(x => ({value: x, sort: rand()})).sort((a, b) => a.sort - b.sort).map(x => x.value);

let id = (prefix = 'x') => prefix + (id[prefix] >= 0 ? ++id[prefix] : (id[prefix] = 0));

let sleep = (times = 1) => new Promise(resolve => setTimeout(resolve, (1000 - GAME_SPEED) * times));

let dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

let isFromBack = (posA, posB, dirB) => {
  switch (dirB) {
    case 'right':
      return posA.x < posB.x;
    case 'left':
      return posA.x > posB.x;
    case 'up':
      return posA.y > posB.y;
    case 'down':
      return posA.y < posB.y;
  }
};

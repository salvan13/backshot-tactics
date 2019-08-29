const fs = require('fs');
const child_process = require('child_process');
const terser = require("terser");
const csso = require('csso');

child_process.execSync('rm -rf ./public && mkdir ./public')

const minifyJs = (file) => {
  const contnents = fs.readFileSync(file);
  const minified = terser.minify(contnents.toString());
  if(minified.error) {
    console.error(minified.error);
    process.exit(1);
  }
  return minified.code;
}

fs.writeFileSync('./public/client.js', minifyJs('./src/client.js'));
fs.writeFileSync('./public/shared.js', minifyJs('./src/shared.js'));
fs.writeFileSync('./public/jsfxr.js', minifyJs('./src/jsfxr.js'));
fs.writeFileSync('./public/server.js', minifyJs('./src/game.js') + '\n' + minifyJs('./src/server.js'));
fs.writeFileSync('./public/style.css', csso.minify(fs.readFileSync('./src/style.css').toString()).css);
fs.copyFileSync('./src/index.html', './public/index.html');
fs.copyFileSync('./src/p.woff2', './public/p.woff2');

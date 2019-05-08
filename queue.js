'use strict';

process.once('unhandledRejection', err => {
  console.error(err);
  process.exit(1);
});

const Queue = require('./JavaScript/5-pipe');

const fs = require('fs').promises;
const path = require('path');

const N = 1000;

const q = new Queue(100).pause();

for (let i = 0; i < N; i++) {
  q.add({ path: path.join(process.cwd(), `file${i}`), i });
}

let result = 0;

q.process(({ path, i }, next) => {
  fs.readFile(path).then(data => {
    result += data[i];
  });
}).done(() => {
  console.timeEnd();
  console.log(result);
});

console.time();
q.resume();

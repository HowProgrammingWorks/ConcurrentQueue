'use strict';

const { Readable, Writable, Transform, pipeline } = require('node:stream');

class QueueStream extends Readable {
  constructor(concurrency) {
    super({ objectMode: true });
    this.concurrency = concurrency;
    this.count = 0;
    this.waiting = [];
  }

  static channels(concurrency) {
    return new QueueStream(concurrency);
  }

  add(task) {
    this.waiting.push(task);
  }

  _read() {
    const emptyChannels =  this.concurrency - this.count;
    let launchCount = Math.min(emptyChannels, this.waiting.length);
    while (launchCount-- > 0) {
      const task = this.waiting.shift();
      this.count++;
      this.onProcess(task, (err, res) => {
        if (err) this.emit('error', err);
        this.push({ err, res });
        this.count--;
      });
    }
    if (this.waiting.length === 0 && this.count === 0) {
      this.push(null);
    }
  }

  process(listener) {
    this.onProcess = listener;
    return this;
  }
}

// Usage

const fs = require('node:fs');

const fileWStream = fs.createWriteStream('./tasks.txt');

const stringifyStream = new Transform({
  readableObjectMode: true,
  writableObjectMode: true,
  write(data, encoding, next) {
    const result = JSON.stringify(data);
    this.push(result + '\n');
    next();
  },
});

const writable = new Writable({
  objectMode: true,
  write(data, encoding, next) {
    console.log({ data });
    next();
  }
});

const job = (task, next) => {
  setTimeout(next, task.interval, null, task);
};

const queue = QueueStream.channels(3).process(job);

pipeline(queue, stringifyStream, fileWStream, (err) => {
  if (err) throw err;
  console.log('pipeline done');
});

queue.pipe(writable);
// queue.on('data', (data) => void console.log(data));

queue.on('end', () => void console.log('tasks end'));
queue.on('close', () => void console.log('stream closed'));

writable.on('finish', () => void console.log('writable finished'));

for (let i = 0; i < 20; i++) {
  if (i < 10) queue.add({ name: `Task${i}`, interval: 1000 });
  else queue.add({ name: `Task${i}`, interval: i * 100 });
}

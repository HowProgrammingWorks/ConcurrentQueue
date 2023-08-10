'use strict';

const { Readable } = require('node:stream');

class QueueStream extends Readable {
  constructor(concurrent) {
    super({ objectMode: true });
    this.concurrent = concurrent;
    this.count = 0;
    this.queue = [];
  }

  static channels(concurrent) {
    return new QueueStream(concurrent);
  }

  add(task) {
    this.queue.push(task);
  }

  _read() {
    while (this.count < this.concurrent && this.queue.length > 0) {
      const task = this.queue.shift();
      this.count++;
      this.onProcess(task, (err, res) => {
        if (err) this.emit('error', err);
        this.push({ err, res });
        this.count--;
      });
    }
    if (this.queue.length === 0 && this.count === 0) {
      this.push(null);
    }
  }

  process(listener) {
    this.onProcess = listener;
    return this;
  }
}

// Usage

const job = (task, next) => {
  setTimeout(next, task.interval, null, task);
};

const queue = QueueStream.channels(3).process(job);

for (let i = 0; i < 20; i++) {
  if (i < 10) queue.add({ name: `Task${i}`, interval: 1000 });
  else queue.add({ name: `Task${i}`, interval: i * 100 });
}

queue.on('data', (data) => void console.log(data));
queue.on('end', () => void console.log('Tasks end'));
queue.on('close', () => void console.log('Stream closed'));
queue.on('error', (err) => {
  throw err;
});

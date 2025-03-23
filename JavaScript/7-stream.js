'use strict';

const { Readable } = require('node:stream');

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
    const emptyChannels = this.concurrency - this.count;
    let launchCount = Math.min(emptyChannels, this.waiting.length);
    while (launchCount-- > 0) {
      this.count++;
      const task = this.waiting.shift();
      this.onProcess(task, (error, res) => {
        if (error) this.emit('error', error);
        this.push({ error, res });
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
queue.on('error', (error) => void console.error(error));

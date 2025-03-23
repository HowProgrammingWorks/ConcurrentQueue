'use strict';

class Queue {
  constructor(concurrency) {
    this.concurrency = concurrency;
    this.count = 0;
    this.waiting = [];
    this.onProcess = null;
    this.onDone = null;
    this.onSuccess = null;
    this.onFailure = null;
    this.onDrain = null;
  }

  static channels(concurrency) {
    return new Queue(concurrency);
  }

  add(task) {
    this.waiting.push(task);
    const hasChannel = this.count < this.concurrency;
    if (hasChannel) this.next();
  }

  next() {
    const emptyChannels = this.concurrency - this.count;
    let launchCount = Math.min(emptyChannels, this.waiting.length);
    while (launchCount-- > 0) {
      this.count++;
      const task = this.waiting.shift();
      this.onProcess(task)
        .then(
          (res) => void this.finish(null, res),
          (err) => void this.finish(err),
        )
        .finally(() => {
          this.count--;
          if (this.waiting.length > 0) this.next();
        });
    }
  }

  finish(error, res) {
    const { onFailure, onSuccess, onDone, onDrain } = this;
    if (error && onFailure) onFailure(error, res);
    else if (onSuccess) onSuccess(res);
    if (onDone) onDone(error, res);
    if (this.count === 0 && this.waiting.length === 0 && onDrain) onDrain();
  }

  process(listener) {
    this.onProcess = listener;
    return this;
  }

  done(listener) {
    this.onDone = listener;
    return this;
  }

  success(listener) {
    this.onSuccess = listener;
    return this;
  }

  failure(listener) {
    this.onFailure = listener;
    return this;
  }

  drain(listener) {
    this.onDrain = listener;
    return this;
  }
}

// Usage

const job = ({ name, interval }) =>
  new Promise((resolve, reject) => {
    if (interval === 1200) {
      setTimeout(reject, interval, new Error('Big error!'));
    } else {
      setTimeout(resolve, interval, name);
    }
  });

const queue = Queue.channels(3)
  .process(job)
  .done((error, res) => {
    const { count } = queue;
    const waiting = queue.waiting.length;
    console.log(`Done | res: ${res}, err: ${error}`);
    console.log(`     | count: ${count}, waiting: ${waiting}`);
  })
  // .success((res) => void console.log(`Success: ${res}`))
  // .failure((err) => void console.log(`Failure: ${err}`))
  .drain(() => void console.log('Queue drain'));

for (let i = 0; i < 20; i++) {
  if (i < 10) queue.add({ name: `Task${i}`, interval: 1000 });
  else queue.add({ name: `Task${i}`, interval: i * 100 });
}

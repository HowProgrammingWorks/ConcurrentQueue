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
    this.waitTimeout = Infinity;
    this.processTimeout = Infinity;
  }

  static channels(concurrency) {
    return new Queue(concurrency);
  }

  wait(msec) {
    this.waitTimeout = msec;
    return this;
  }

  timeout(msec) {
    this.processTimeout = msec;
    return this;
  }

  add(task) {
    const hasChannel = this.count < this.concurrency;
    if (hasChannel) return void this.next(task);
    this.waiting.push({ task, start: Date.now() });
  }

  next(task) {
    this.count++;
    let timer = null;
    let finished = false;
    const { processTimeout, onProcess } = this;
    const finish = (error, res) => {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      this.count--;
      this.finish(error, res);
      if (this.waiting.length > 0) this.takeNext();
    };
    if (processTimeout !== Infinity) {
      timer = setTimeout(() => {
        timer = null;
        const error = new Error('Process timed out');
        finish(error, task);
      }, processTimeout);
    }
    onProcess(task, finish);
  }

  takeNext() {
    const { waiting, waitTimeout } = this;
    const { task, start } = waiting.shift();
    if (waitTimeout !== Infinity) {
      const delay = Date.now() - start;
      if (delay > waitTimeout) {
        const error = new Error('Waiting timed out');
        this.finish(error, task);
        if (waiting.length > 0) this.takeNext();
        return;
      }
    }
    this.next(task);
  }

  finish(error, res) {
    const { onFailure, onSuccess, onDone, onDrain } = this;
    if (error) {
      if (onFailure) onFailure(error, res);
    } else if (onSuccess) {
      onSuccess(res);
    }
    if (onDone) onDone(error, res);
    if (this.count === 0 && onDrain) onDrain();
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

const job = (task, next) => {
  setTimeout(next, task.interval, null, task);
};

const queue = Queue.channels(3)
  .wait(4000)
  .timeout(5000)
  .process(job)
  .success((task) => void console.log(`Success: ${task.name}`))
  .failure((error, task) => void console.log(`Failure: ${error} ${task.name}`))
  .drain(() => void console.log('Queue drain'));

for (let i = 0; i < 10; i++) {
  queue.add({ name: `Task${i}`, interval: i * 1000 });
}

'use strict';

class QueueFactory {
  constructor() {
    this.concurrency = 0;
    this.count = 0;
    this.waiting = [];
    this.waitTimeout = Infinity;
    this.processTimeout = Infinity;
    this.onProcess = null;
    this.onDone = null;
    this.onSuccess = null;
    this.onFailure = null;
    this.onDrain = null;
  }
  static init() {
    return new QueueFactory();
  }
  build() {
    return new Queue(this);
  }
  wait(msec) {
    this.waitTimeout = msec;
    return this;
  }
  timeout(msec) {
    this.processTimeout = msec;
    return this;
  }
  channels(concurrency) {
    this.concurrency = concurrency;
    return this;
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

class Queue {
  constructor(factoryContext) {
    this.count = 0;
    this.waiting = [];
    Object.assign(this, factoryContext);   
  }
  add(task) {
    const hasChannel = this.count < this.concurrency;
    if (hasChannel) {
      this.next(task);
      return;
    }
    this.waiting.push({ task, start: Date.now() });
  }
  next(task) {
    this.count++;
    let timer = null;
    let finished = false;
    const { processTimeout, onProcess } = this;
    const finish = (err, res) => {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      this.count--;
      this.finish(err, res);
      if (this.waiting.length > 0) this.takeNext();
    };
    if (processTimeout !== Infinity) {
      timer = setTimeout(() => {
        timer = null;
        const err = new Error('Process timed out');
        finish(err, task);
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
        const err = new Error('Waiting timed out');
        this.finish(err, task);
        if (waiting.length > 0) this.takeNext();
        return;
      }
    }
    this.next(task);
    return;
  }
  finish(err, res) {
    const { onFailure, onSuccess, onDone, onDrain } = this;
    if (err) {
      if (onFailure) onFailure(err, res);
    } else if (onSuccess) {
      onSuccess(res);
    }
    if (onDone) onDone(err, res);
    if (this.count === 0 && onDrain) onDrain();
  }
}

// Usage

const job = (task, next) => {
  setTimeout(next, task.interval, null, task);
};

const queue = QueueFactory.init()
  .channels(3)
  .wait(4000)
  .timeout(5000)
  .process(job)
  .success(task => console.log(`Success: ${task.name}`))
  .failure((err, task) => console.log(`Failure: ${err} ${task.name}`))
  .drain(() => console.log('Queue drain'))
  .build();

for (let i = 0; i < 10; i++) {
  queue.add({ name: `Task${i}`, interval: i * 1000 });
}

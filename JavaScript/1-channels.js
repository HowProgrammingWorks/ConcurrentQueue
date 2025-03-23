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
    const hasChannel = this.count < this.concurrency;
    if (hasChannel) return void this.next(task);
    this.waiting.push(task);
  }

  next(task) {
    this.count++;
    this.onProcess(task, (error, result) => {
      if (error) {
        if (this.onFailure) this.onFailure(error);
      } else if (this.onSuccess) {
        this.onSuccess(result);
      }
      if (this.onDone) this.onDone(error, result);
      this.count--;
      if (this.waiting.length > 0) {
        const task = this.waiting.shift();
        this.next(task);
        return;
      }
      if (this.count === 0 && this.onDrain) {
        this.onDrain();
      }
    });
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
  console.log(`Process: ${task.name}`);
  setTimeout(next, task.interval, null, task);
};

const queue = Queue.channels(3)
  .process(job)
  .done((error, res) => {
    if (error) console.log(`Done with error: ${error}`);
    const { count } = queue;
    const waiting = queue.waiting.length;
    console.log(`Done: ${res.name}, count:${count}, waiting: ${waiting}`);
  })
  .success((res) => void console.log(`Success: ${res.name}`))
  .failure((error) => void console.log(`Failure: ${error}`))
  .drain(() => void console.log('Queue drain'));

for (let i = 0; i < 10; i++) {
  queue.add({ name: `Task${i}`, interval: i * 1000 });
}

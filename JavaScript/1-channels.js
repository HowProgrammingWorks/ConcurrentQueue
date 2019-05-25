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
    if (hasChannel) {
      this.next(task);
      return;
    }
    this.waiting.push(task);
  }

  next(task) {
    this.count++;
    this.onProcess(task, (err, result) => {
      if (err) {
        if (this.onFailure) this.onFailure(err);
      } else if (this.onSuccess) {
        this.onSuccess(result);
      }
      if (this.onDone) this.onDone(err, result);
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
  .done((err, res) => {
    const { count } = queue;
    const waiting = queue.waiting.length;
    console.log(`Done: ${res.name}, count:${count}, waiting: ${waiting}`);
  })
  .success(res => console.log(`Success: ${res.name}`))
  .failure(err => console.log(`Failure: ${err}`))
  .drain(() => console.log('Queue drain'));

for (let i = 0; i < 10; i++) {
  queue.add({ name: `Task${i}`, interval: i * 1000 });
}

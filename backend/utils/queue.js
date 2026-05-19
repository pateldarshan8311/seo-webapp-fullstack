const { EventEmitter } = require("events");

const sleep = (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs));

class AsyncQueue extends EventEmitter {
  constructor({ concurrency = 5, delayMs = 200 } = {}) {
    super();
    this.concurrency = Math.max(1, concurrency);
    this.delayMs = Math.max(0, delayMs);
    this.pending = [];
    this.activeCount = 0;
    this.processedCount = 0;
    this.failedCount = 0;
    this.paused = false;
    this.idleResolvers = [];
  }

  add(task, meta = {}) {
    return new Promise((resolve, reject) => {
      this.pending.push({ task, meta, resolve, reject });
      this.emit("queued", { ...this.getStats(), meta });
      this.schedule();
    });
  }

  pause() {
    this.paused = true;
    this.emit("paused", this.getStats());
  }

  resume() {
    if (!this.paused) {
      return;
    }

    this.paused = false;
    this.emit("resumed", this.getStats());
    this.schedule();
  }

  getStats() {
    return {
      activeCount: this.activeCount,
      concurrency: this.concurrency,
      delayMs: this.delayMs,
      failedCount: this.failedCount,
      paused: this.paused,
      pendingCount: this.pending.length,
      processedCount: this.processedCount,
    };
  }

  async onIdle() {
    if (this.activeCount === 0 && this.pending.length === 0) {
      return;
    }

    await new Promise((resolve) => {
      this.idleResolvers.push(resolve);
    });
  }

  schedule() {
    if (this.paused) {
      return;
    }

    while (this.activeCount < this.concurrency && this.pending.length > 0 && !this.paused) {
      const nextItem = this.pending.shift();
      this.activeCount += 1;
      this.runItem(nextItem);
    }
  }

  async runItem(item) {
    try {
      if (this.delayMs > 0) {
        await sleep(this.delayMs);
      }

      this.emit("taskStart", { ...this.getStats(), meta: item.meta });
      const result = await item.task();
      this.processedCount += 1;
      item.resolve(result);
      this.emit("taskComplete", { ...this.getStats(), meta: item.meta });
    } catch (error) {
      this.failedCount += 1;
      item.reject(error);
      this.emit("taskError", { ...this.getStats(), error, meta: item.meta });
    } finally {
      this.activeCount -= 1;

      if (this.activeCount === 0 && this.pending.length === 0) {
        for (const resolve of this.idleResolvers.splice(0)) {
          resolve();
        }
      }

      this.schedule();
    }
  }
}

module.exports = AsyncQueue;


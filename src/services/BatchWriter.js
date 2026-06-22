class BulkWriter {
  constructor(tree, tracker, cache, options = {}) {
    this.tree = tree;
    this.tracker = tracker;
    this.cache = cache;
    
    this.batchLimit = options.batchLimit || 500;
    this.flushMs = options.flushMs || 5000;
    
    this.buffer = new Map();
    this.pendingCount = 0;
    this.stats = { 
      flushCount: 0, 
      itemsFlushed: 0,
      totalDirectWritesAvoided: 0 
    };
    
    this.flushTimer = setInterval(() => this.commit(), this.flushMs);
  }

  queueSearch(term) {
    const lower = term.toLowerCase().trim();
    if (!lower) return;

    this.buffer.set(lower, (this.buffer.get(lower) || 0) + 1);
    this.pendingCount++;

    if (this.pendingCount >= this.batchLimit) {
      this.commit();
    }
  }

  commit() {
    if (this.buffer.size === 0) return;

    for (const [term, delta] of this.buffer.entries()) {
      this.tree.updateFrequency(term, delta);
      this.tracker.recordActivity(term, delta);
      
      for (let i = 1; i <= term.length; i++) {
        this.cache.invalidate(term.substring(0, i));
      }
    }

    this.stats.flushCount++;
    this.stats.itemsFlushed += this.pendingCount;
    // By grouping writes into map keys, we saved multiple DB inserts
    this.stats.totalDirectWritesAvoided += (this.pendingCount - this.buffer.size);

    this.buffer.clear();
    this.pendingCount = 0;
  }

  getBufferStats() {
    return {
      bufferSize: this.buffer.size,
      totalDirectWritesAvoided: this.stats.totalDirectWritesAvoided,
      compressionRatio: this.pendingCount > 0 ? ((1 - (this.buffer.size / this.pendingCount)) * 100).toFixed(1) + '%' : '0%'
    };
  }

  getBufferContents() {
    const arr = [];
    for (const [word, delta] of this.buffer.entries()) {
      arr.push({ word, pendingDelta: delta });
    }
    return arr.sort((a,b) => b.pendingDelta - a.pendingDelta);
  }

  shutdown() {
    clearInterval(this.flushTimer);
    this.commit();
  }
}

module.exports = BulkWriter;

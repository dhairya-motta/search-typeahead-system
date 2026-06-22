class SlidingWindowTracker {
  constructor(tree, config = {}) {
    this.tree = tree;
    // Keep 24 hour window
    this.windowMs = config.windowMs || 24 * 60 * 60 * 1000;
    this.multiplier = config.multiplier || 5;
    
    // Store array of timestamps per term
    this.recentSearches = new Map(); 
    
    // Clean up every minute
    this.cleanupInterval = setInterval(() => this.purgeOldQueries(), 60000);
  }

  recordActivity(term, count = 1) {
    const now = Date.now();
    if (!this.recentSearches.has(term)) {
      this.recentSearches.set(term, []);
    }
    const timestamps = this.recentSearches.get(term);
    for(let i = 0; i < count; i++) {
      timestamps.push(now);
    }
    this.calculateScore(term);
  }

  purgeOldQueries() {
    const cutoff = Date.now() - this.windowMs;
    for (const [term, times] of this.recentSearches.entries()) {
      const valid = times.filter(t => t >= cutoff);
      if (valid.length === 0) {
        this.recentSearches.delete(term);
      } else {
        this.recentSearches.set(term, valid);
      }
      this.calculateScore(term);
    }
  }

  calculateScore(term) {
    const cutoff = Date.now() - this.windowMs;
    const times = this.recentSearches.get(term) || [];
    
    // Only count times inside the window
    const recentCount = times.filter(t => t >= cutoff).length;
    
    // Pure sliding window score: Historical Count + (Recent Count * Multiplier)
    const historicalCount = this.tree.getFrequency(term);
    const combinedScore = historicalCount + (recentCount * this.multiplier);
    
    this.tree.updateDecayScore(term, combinedScore);
  }

  getTopSuggestions(prefix, max = 10, ranking = 'basic') {
    return this.tree.findMatches(prefix, max, ranking);
  }

  getExplanation() {
    return {
      formula: "score = totalCount + (recentCount_in_24h * multiplier)",
      windowHours: this.windowMs / (1000 * 60 * 60),
      multiplier: this.multiplier
    };
  }

  destroy() {
    clearInterval(this.cleanupInterval);
  }
}

module.exports = SlidingWindowTracker;

const express = require('express');

module.exports = function buildRoutes(tree, cache, tracker, writer, appMetrics) {
  const router = express.Router();

  router.get('/suggest', (req, res) => {
    const q = req.query.q || '';
    const mode = req.query.mode === 'enhanced' ? 'enhanced' : 'basic';
    
    if (!q) return res.json([]);

    const cacheKey = `${q}:${mode}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const results = tracker.getTopSuggestions(q, 10, mode);
    cache.set(cacheKey, results);
    res.json(results);
  });

  router.post('/search', (req, res) => {
    const term = req.body.query;
    if (term) {
      writer.queueSearch(term);
      res.json({ message: 'Searched', query: term });
    } else {
      res.status(400).json({ error: 'Missing query' });
    }
  });

  router.get('/trending', (req, res) => {
    const mode = req.query.mode === 'enhanced' ? 'enhanced' : 'basic';
    const limit = parseInt(req.query.limit) || 10;
    
    const results = tree.getTopTerms(limit, mode);
    
    // Format to match old trending payload
    const payload = results.map(r => ({
      query: r.term,
      count: r.freq,
      score: r.score,
      trending: mode === 'enhanced' && r.score > r.freq // simple heuristic
    }));
    
    res.json(payload);
  });

  // Cache Routes
  router.get('/cache/debug', (req, res) => {
    const prefix = req.query.prefix || '';
    if (!prefix) return res.json({});
    
    const routeInfo = cache.hashRing.debugRoute(prefix);
    res.json({
      prefix,
      assignedNode: routeInfo.targetNode,
      hashValue: routeInfo.hash
    });
  });

  router.get('/cache/stats', (req, res) => {
    res.json({ nodes: cache.getNodeStats() });
  });

  router.get('/cache/buffer', (req, res) => {
    res.json({
      stats: writer.getBufferStats(),
      buffer: writer.getBufferContents()
    });
  });

  router.post('/cache/fail-node', (req, res) => {
    if (req.body.node) cache.simulateFailure(req.body.node);
    res.json({ status: 'ok' });
  });

  router.post('/cache/recover-node', (req, res) => {
    if (req.body.node) cache.restoreNode(req.body.node);
    res.json({ status: 'ok' });
  });

  // Metrics Route
  router.get('/metrics', (req, res) => {
    let p50 = 0, p95 = 0;
    if (appMetrics.latencies.length > 0) {
      const sorted = [...appMetrics.latencies].sort((a,b) => a-b);
      p50 = sorted[Math.floor(sorted.length * 0.5)];
      p95 = sorted[Math.floor(sorted.length * 0.95)];
    }

    res.json({
      latency: {
        p50: p50.toFixed(2) + 'ms',
        p95: p95.toFixed(2) + 'ms'
      },
      cache: cache.getStats(),
      batchWriter: writer.stats,
      trie: { size: tree.size }
    });
  });

  return router;
};

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const { performance } = require('perf_hooks');

const PrefixTree = require('./structures/Trie');
const DistributedCacheManager = require('./cache/CacheManager');
const SlidingWindowTracker = require('./services/TrendingService');
const BulkWriter = require('./services/BatchWriter');
const { loadDataIntoTree } = require('./data/loader');
const buildRoutes = require('./routes/api');

const app = express();
const PORT = 3001;

// Global App Metrics
const appMetrics = {
  latencies: []
};

// Latency Tracking Middleware
app.use((req, res, next) => {
  const start = performance.now();
  res.on('finish', () => {
    if (req.path.startsWith('/suggest') || req.path.startsWith('/search')) {
      const ms = performance.now() - start;
      appMetrics.latencies.push(ms);
      if (appMetrics.latencies.length > 2000) {
        appMetrics.latencies.shift();
      }
    }
  });
  next();
});

// Middlewares
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(morgan('dev'));

// Core instances
const tree = new PrefixTree();
const cacheNodes = ['node-alpha', 'node-beta', 'node-gamma'];
const cache = new DistributedCacheManager(cacheNodes, 30000, 100);
const tracker = new SlidingWindowTracker(tree, { windowMs: 24*60*60*1000, multiplier: 5 });
const writer = new BulkWriter(tree, tracker, cache, { batchLimit: 500, flushMs: 5000 });

// Load data
loadDataIntoTree(tree);

// API Routes
const apiRoutes = buildRoutes(tree, cache, tracker, writer, appMetrics);
app.use('/', apiRoutes);

// Static frontend
app.use(express.static(path.join(__dirname, '../public')));

// Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const server = app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});

function shutdown() {
  writer.shutdown();
  tracker.destroy();
  server.close(() => process.exit(0));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

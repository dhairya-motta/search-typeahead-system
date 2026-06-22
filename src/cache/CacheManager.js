const ConsistentHashRing = require('../structures/ConsistentHash');

class DistributedCacheManager {
  constructor(servers, ttlMs = 30000, virtualNodes = 100) {
    this.hashRing = new ConsistentHashRing(servers, virtualNodes);
    this.ttl = ttlMs;
    
    this.nodeStates = new Map();
    this.cacheStores = new Map();
    
    servers.forEach(server => {
      this.cacheStores.set(server, new Map());
      this.nodeStates.set(server, { healthy: true, hits: 0, requests: 0 });
    });

    this.stats = { hits: 0, misses: 0, totalRequests: 0 };
  }

  simulateFailure(nodeId) {
    if (this.nodeStates.has(nodeId)) {
      this.nodeStates.get(nodeId).healthy = false;
      this.hashRing.removeServerNode(nodeId);
      this.cacheStores.get(nodeId).clear(); // clear dropped node
    }
  }

  restoreNode(nodeId) {
    if (this.nodeStates.has(nodeId)) {
      this.nodeStates.get(nodeId).healthy = true;
      this.hashRing.addServerNode(nodeId);
    }
  }

  get(key) {
    this.stats.totalRequests++;
    const server = this.hashRing.getServerNode(key);
    if (!server) return null;

    const nodeState = this.nodeStates.get(server);
    nodeState.requests++;

    const store = this.cacheStores.get(server);
    const entry = store.get(key);

    if (entry) {
      if (Date.now() > entry.expiry) {
        store.delete(key);
        this.stats.misses++;
        return null;
      }
      this.stats.hits++;
      nodeState.hits++;
      return entry.data;
    }

    this.stats.misses++;
    return null;
  }

  set(key, data) {
    const server = this.hashRing.getServerNode(key);
    if (!server) return;

    const store = this.cacheStores.get(server);
    store.set(key, {
      data,
      expiry: Date.now() + this.ttl
    });
  }

  invalidate(key) {
    const server = this.hashRing.getServerNode(key);
    if (server) {
      this.cacheStores.get(server).delete(key);
    }
  }

  getNodeStats() {
    const nodes = [];
    for (const [name, state] of this.nodeStates.entries()) {
      const store = this.cacheStores.get(name);
      nodes.push({
        name,
        healthy: state.healthy,
        hits: state.hits,
        requests: state.requests,
        hitRate: state.requests > 0 ? ((state.hits / state.requests) * 100).toFixed(1) + '%' : '0%',
        keysStored: store.size
      });
    }
    return nodes;
  }

  getStats() {
    return {
      globalHitRate: this.stats.totalRequests > 0 ? ((this.stats.hits / this.stats.totalRequests) * 100).toFixed(1) + '%' : '0%',
      totalHits: this.stats.hits,
      totalRequests: this.stats.totalRequests
    };
  }
}

module.exports = DistributedCacheManager;

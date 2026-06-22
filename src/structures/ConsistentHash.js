const crypto = require('crypto');

class ConsistentHashRing {
  constructor(nodeList, virtualPerNode = 100) {
    this.ring = new Map();
    this.sortedHashes = [];
    this.virtualPerNode = virtualPerNode;

    nodeList.forEach(node => this.addServerNode(node));
  }

  _computeHash(input) {
    return crypto.createHash('md5').update(input).digest('hex');
  }

  addServerNode(nodeId) {
    for (let i = 0; i < this.virtualPerNode; i++) {
      const virtualId = `${nodeId}-v-${i}`;
      const h = this._computeHash(virtualId);
      this.ring.set(h, nodeId);
      this.sortedHashes.push(h);
    }
    this.sortedHashes.sort();
  }

  removeServerNode(nodeId) {
    for (let i = 0; i < this.virtualPerNode; i++) {
      const virtualId = `${nodeId}-v-${i}`;
      const h = this._computeHash(virtualId);
      this.ring.delete(h);
      const idx = this.sortedHashes.indexOf(h);
      if (idx !== -1) {
        this.sortedHashes.splice(idx, 1);
      }
    }
  }

  getServerNode(key) {
    if (this.sortedHashes.length === 0) return null;
    const h = this._computeHash(key);
    
    let low = 0;
    let high = this.sortedHashes.length - 1;
    let foundIdx = -1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.sortedHashes[mid] === h) {
        foundIdx = mid;
        break;
      } else if (this.sortedHashes[mid] < h) {
        low = mid + 1;
      } else {
        foundIdx = mid;
        high = mid - 1;
      }
    }

    if (foundIdx === -1) {
      foundIdx = 0;
    }

    const matchedHash = this.sortedHashes[foundIdx];
    return this.ring.get(matchedHash);
  }

  debugRoute(key) {
    if (this.sortedHashes.length === 0) return null;
    const h = this._computeHash(key);
    const node = this.getServerNode(key);
    return {
      key,
      hash: h,
      targetNode: node
    };
  }
}

module.exports = ConsistentHashRing;

class Node {
  constructor() {
    this.children = new Map();
    this.isTerminal = false;
    this.value = null;
    this.frequency = 0;
    this.decayScore = 0;
  }
}

class PrefixTree {
  constructor() {
    this.root = new Node();
    this.nodeCount = 0;
  }

  insertNode(term, amount = 1) {
    if (!term || typeof term !== 'string') return;
    const lower = term.toLowerCase().trim();
    if (!lower) return;

    let curr = this.root;
    for (const ch of lower) {
      if (!curr.children.has(ch)) {
        curr.children.set(ch, new Node());
      }
      curr = curr.children.get(ch);
    }

    if (!curr.isTerminal) {
      this.nodeCount++;
      curr.isTerminal = true;
      curr.value = lower;
    }
    curr.frequency = amount;
    curr.decayScore = amount;
  }

  updateFrequency(term, change = 1) {
    if (!term) return;
    const lower = term.toLowerCase().trim();
    if (!lower) return;

    let curr = this.root;
    for (const ch of lower) {
      if (!curr.children.has(ch)) {
        curr.children.set(ch, new Node());
      }
      curr = curr.children.get(ch);
    }

    if (!curr.isTerminal) {
      this.nodeCount++;
      curr.isTerminal = true;
      curr.value = lower;
    }
    curr.frequency += change;
    curr.decayScore += change;
  }

  updateDecayScore(term, newScore) {
    const lower = term?.toLowerCase().trim();
    if (!lower) return;
    const target = this._locate(lower);
    if (target && target.isTerminal) {
      target.decayScore = newScore;
    }
  }

  _locate(prefix) {
    let curr = this.root;
    for (const ch of prefix) {
      if (!curr.children.has(ch)) return null;
      curr = curr.children.get(ch);
    }
    return curr;
  }

  getFrequency(term) {
    const target = this._locate(term?.toLowerCase().trim());
    return (target && target.isTerminal) ? target.frequency : 0;
  }

  findMatches(prefix, max = 10, ranking = 'basic') {
    if (!prefix && prefix !== '') return [];
    const lower = prefix.toLowerCase().trim();
    const startNode = this._locate(lower);
    if (!startNode) return [];

    const found = [];
    const q = [startNode];

    while (q.length > 0 && found.length < 5000) {
      const curr = q.shift();
      if (curr.isTerminal) {
        found.push({
          term: curr.value,
          freq: curr.frequency,
          score: curr.decayScore
        });
      }
      for (const child of curr.children.values()) {
        q.push(child);
      }
    }

    const sortProp = ranking === 'enhanced' ? 'score' : 'freq';
    found.sort((a, b) => b[sortProp] - a[sortProp]);
    return found.slice(0, max);
  }

  getTopTerms(max = 10, ranking = 'basic') {
    return this.findMatches('', max, ranking);
  }

  get size() {
    return this.nodeCount;
  }
}

module.exports = PrefixTree;

const fs = require('fs');
const path = require('path');

function loadDataIntoTree(tree) {
  const dataPath = path.join(__dirname, '../../data/queries.json');
  let count = 0;
  
  if (fs.existsSync(dataPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      data.forEach(item => {
        tree.insertNode(item.query, item.count);
        count++;
      });
      console.log(`Loaded ${count} queries from data/queries.json`);
    } catch (e) {
      console.error("Failed to parse dataset", e);
    }
  } else {
    console.log("Dataset not found, using dummy seed data.");
    const dummy = [
      { query: "iphone", count: 100000 },
      { query: "iphone 15", count: 65000 },
      { query: "iphone charger", count: 48000 },
      { query: "java tutorial", count: 43000 },
      { query: "javascript", count: 50000 }
    ];
    dummy.forEach(item => tree.insertNode(item.query, item.count));
  }
}

module.exports = { loadDataIntoTree };

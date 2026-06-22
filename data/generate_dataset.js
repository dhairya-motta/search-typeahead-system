const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const numQueries = 100000;
const words = ["apple", "banana", "phone", "laptop", "charger", "javascript", "react", "node", "express", "java", "tutorial", "guide", "how to"];
const queries = [];

for (let i = 0; i < numQueries; i++) {
  const w1 = words[Math.floor(Math.random() * words.length)];
  const w2 = words[Math.floor(Math.random() * words.length)];
  const query = `${w1} ${w2}`;
  queries.push({
    query,
    count: Math.floor(Math.random() * 5000) + 1
  });
}

// Ensure requirements are in dataset
queries.push({ query: "iphone", count: 100000 });
queries.push({ query: "iphone 15", count: 65000 });
queries.push({ query: "iphone charger", count: 48000 });
queries.push({ query: "java tutorial", count: 43000 });

fs.writeFileSync(path.join(dataDir, 'queries.json'), JSON.stringify(queries, null, 2));
console.log(`Generated ${queries.length} queries in data/queries.json`);

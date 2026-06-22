const API_URL = 'http://localhost:3001';
let searchMode = 'basic';
let trendMode = 'enhanced';

// --- Navigation Logic ---
function showTab(tabId) {
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`nav${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`).classList.add('active');
  
  document.querySelectorAll('.tab-section').forEach(sec => sec.classList.remove('active'));
  document.getElementById(`tab${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`).classList.add('active');
  
  if (tabId === 'trending') loadTrending();
  if (tabId === 'cache') { loadCacheStats(); loadBuffer(); }
  if (tabId === 'metrics') loadMetrics();
}

// --- Search Logic ---
const searchInput = document.getElementById('searchInput');
const suggDropdown = document.getElementById('suggestionsDropdown');
const suggList = document.getElementById('suggestionsList');
const suggIndicator = document.getElementById('suggModeIndicator');
let debounceTimer;
let currentFocus = -1;
let currentSuggestions = [];

function setMode(mode) {
  searchMode = mode;
  document.getElementById('modeBasic').classList.toggle('active', mode === 'basic');
  document.getElementById('modeEnhanced').classList.toggle('active', mode === 'enhanced');
  suggIndicator.textContent = mode === 'enhanced' ? '🔥 Hot Trends' : '📊 Basic Score';
  if (searchInput.value.trim()) fetchSuggestions(searchInput.value.trim());
}

searchInput.addEventListener('input', (e) => {
  clearTimeout(debounceTimer);
  const q = e.target.value.trim();
  if (!q) { suggDropdown.classList.add('hidden'); return; }
  
  debounceTimer = setTimeout(() => fetchSuggestions(q), 250);
});

searchInput.addEventListener('focus', () => {
  document.getElementById('inputWrapper').classList.add('focused');
  if (searchInput.value.trim()) suggDropdown.classList.remove('hidden');
});

document.addEventListener('click', (e) => {
  const wrap = document.getElementById('inputWrapper');
  if (!wrap.contains(e.target) && !suggDropdown.contains(e.target)) {
    wrap.classList.remove('focused');
    suggDropdown.classList.add('hidden');
  }
});

searchInput.addEventListener('keydown', (e) => {
  const items = suggList.getElementsByClassName('sugg-item');
  if (e.key === 'ArrowDown') { e.preventDefault(); currentFocus++; setActiveItem(items); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); currentFocus--; setActiveItem(items); }
  else if (e.key === 'Enter') {
    e.preventDefault();
    if (currentFocus > -1 && items.length > 0) items[currentFocus].click();
    else submitSearch();
  }
  else if (e.key === 'Escape') suggDropdown.classList.add('hidden');
});

function setActiveItem(items) {
  if (!items || items.length === 0) return;
  Array.from(items).forEach(el => el.classList.remove('active'));
  if (currentFocus >= items.length) currentFocus = 0;
  if (currentFocus < 0) currentFocus = items.length - 1;
  items[currentFocus].classList.add('active');
}

async function fetchSuggestions(q) {
  try {
    const res = await fetch(`${API_URL}/suggest?q=${encodeURIComponent(q)}&mode=${searchMode}`);
    currentSuggestions = await res.json();
    renderSuggestions(q);
  } catch (err) { console.error(err); }
}

function renderSuggestions(q) {
  suggList.innerHTML = '';
  currentFocus = -1;
  if (currentSuggestions.length === 0) {
    suggList.innerHTML = '<div style="padding:1rem;color:var(--text-muted)">No matches found in the cosmos</div>';
  } else {
    currentSuggestions.forEach((item, idx) => {
      const div = document.createElement('div');
      div.className = 'sugg-item';
      
      const lowerItem = item.term.toLowerCase();
      const lowerQ = q.toLowerCase();
      let htmlTerm = item.term;
      if (lowerItem.startsWith(lowerQ)) {
        htmlTerm = `<strong>${item.term.substring(0, q.length)}</strong>${item.term.substring(q.length)}`;
      }
      
      div.innerHTML = `<span class="sugg-term">${htmlTerm}</span><span class="sugg-score">${Math.round(item.score || item.freq)}</span>`;
      div.addEventListener('click', () => {
        searchInput.value = item.term;
        submitSearch();
      });
      div.addEventListener('mouseenter', () => { currentFocus = idx; setActiveItem(suggList.getElementsByClassName('sugg-item')); });
      suggList.appendChild(div);
    });
  }
  suggDropdown.classList.remove('hidden');
}

async function submitSearch() {
  const q = searchInput.value.trim();
  if (!q) return;
  suggDropdown.classList.add('hidden');
  try {
    await fetch(`${API_URL}/search`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({query: q}) });
    showToast(`Registered search: "${q}"`);
  } catch (err) { showToast('Error submitting search'); }
}

// --- Trending Tab ---
function setTrendMode(mode) {
  trendMode = mode;
  document.getElementById('trendModeBasic').classList.toggle('active', mode === 'basic');
  document.getElementById('trendModeEnhanced').classList.toggle('active', mode === 'enhanced');
  loadTrending();
}

async function loadTrending() {
  const grid = document.getElementById('trendingGrid');
  grid.innerHTML = '<div class="spinner"></div>';
  try {
    const res = await fetch(`${API_URL}/trending?limit=12&mode=${trendMode}`);
    const data = await res.json();
    grid.innerHTML = '';
    data.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'trend-card';
      card.innerHTML = `
        <div class="t-rank">#${idx+1} ${item.trending ? '🚀' : ''}</div>
        <div class="t-query">${item.query}</div>
        <div class="t-score">${trendMode === 'enhanced' ? 'Score: '+Math.round(item.score) : 'Count: '+item.count}</div>
      `;
      grid.appendChild(card);
    });
  } catch (err) { grid.innerHTML = 'Error loading trends'; }
}

// --- Cache Tab ---
async function loadCacheStats() {
  try {
    const res = await fetch(`${API_URL}/cache/stats`);
    const data = await res.json();
    const grid = document.getElementById('nodesGrid');
    grid.innerHTML = '';
    
    data.nodes.forEach(node => {
      const card = document.createElement('div');
      card.className = `node-card ${!node.healthy ? 'unhealthy' : ''}`;
      card.innerHTML = `
        <div class="n-header">
          <span>${node.name}</span>
          <span class="n-status ${node.healthy ? 'ok' : 'fail'}">${node.healthy ? 'HEALTHY' : 'DOWN'}</span>
        </div>
        <div class="n-stat"><span>Hit Rate</span><span>${node.hitRate}</span></div>
        <div class="n-stat"><span>Keys Stored</span><span>${node.keysStored}</span></div>
        <button class="n-btn ${node.healthy ? 'fail-btn' : 'restore-btn'}" onclick="toggleNode('${node.name}', ${node.healthy})">
          ${node.healthy ? 'Simulate Failure' : 'Restore Node'}
        </button>
      `;
      grid.appendChild(card);
    });
    drawRing(data.nodes);
  } catch (err) { console.error(err); }
}

async function toggleNode(name, isHealthy) {
  const endpoint = isHealthy ? '/cache/fail-node' : '/cache/recover-node';
  await fetch(`${API_URL}${endpoint}`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({node: name}) });
  loadCacheStats();
}

function drawRing(nodes) {
  const canvas = document.getElementById('ringCanvas');
  const legend = document.getElementById('ringLegend');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const cx = canvas.width/2, cy = canvas.height/2, radius = cx - 20;
  
  ctx.clearRect(0,0, canvas.width, canvas.height);
  ctx.beginPath(); ctx.arc(cx,cy,radius,0,Math.PI*2);
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 4; ctx.stroke();
  
  const colors = ['#8a2be2', '#00ffcc', '#ff3366', '#4169e1'];
  legend.innerHTML = '';
  
  nodes.forEach((node, idx) => {
    const color = node.healthy ? colors[idx%colors.length] : '#555';
    legend.innerHTML += `<div class="legend-item"><div class="l-color" style="background:${color}"></div>${node.name}</div>`;
    
    if (!node.healthy) return;
    for (let i=0; i<30; i++) {
      const angle = ((Math.sin(idx*100 + i*10)+1)/2) * Math.PI*2;
      ctx.beginPath(); ctx.arc(cx + Math.cos(angle)*radius, cy + Math.sin(angle)*radius, 4, 0, Math.PI*2);
      ctx.fillStyle = color; ctx.fill();
    }
  });
}

async function debugCacheRoute() {
  const q = document.getElementById('debugPrefix').value.trim();
  const out = document.getElementById('debugOutput');
  if (!q) { out.textContent = 'Enter a prefix...'; return; }
  try {
    const res = await fetch(`${API_URL}/cache/debug?prefix=${encodeURIComponent(q)}`);
    const data = await res.json();
    out.textContent = JSON.stringify(data, null, 2);
  } catch (err) { out.textContent = 'Routing error'; }
}

async function loadBuffer() {
  try {
    const res = await fetch(`${API_URL}/cache/buffer`);
    const data = await res.json();
    
    document.getElementById('bufferStats').innerHTML = `
      <span style="color:var(--text-muted);font-size:0.9rem;display:flex;gap:1rem;">
        <span>Pending: <strong style="color:white">${data.stats.bufferSize}</strong></span>
        <span>Writes Avoided: <strong style="color:var(--success)">${data.stats.totalDirectWritesAvoided}</strong></span>
      </span>
    `;
    
    const wrap = document.getElementById('bufferTable');
    if (data.buffer.length === 0) { wrap.innerHTML = '<p style="color:var(--text-muted);padding:1rem;">Buffer is empty.</p>'; return; }
    
    let html = `<table><tr><th>Query</th><th>Pending Delta</th></tr>`;
    data.buffer.slice(0,8).forEach(i => html += `<tr><td>${i.word}</td><td style="color:var(--success)">+${i.pendingDelta}</td></tr>`);
    if(data.buffer.length > 8) html += `<tr><td colspan="2" style="color:var(--text-muted);text-align:center;">...and ${data.buffer.length-8} more</td></tr>`;
    wrap.innerHTML = html + `</table>`;
  } catch (err) { console.error(err); }
}

// --- Metrics Tab ---
async function loadMetrics() {
  const grid = document.getElementById('metricsGrid');
  grid.innerHTML = '<div class="spinner"></div>';
  try {
    const res = await fetch(`${API_URL}/metrics`);
    const data = await res.json();
    
    const m = [
      { l: 'Latency p95', v: data.latency.p95, s: 'Suggestion API' },
      { l: 'Latency p50', v: data.latency.p50, s: 'Suggestion API' },
      { l: 'Cache Hits', v: data.cache.globalHitRate, s: 'Global Rate' },
      { l: 'Trie Size', v: data.trie.size.toLocaleString(), s: 'Indexed prefixes' },
      { l: 'Batch Flushes', v: data.batchWriter.flushCount, s: 'Total IO commits' },
      { l: 'Compression', v: data.batchWriter.totalDirectWritesAvoided, s: 'Writes avoided' }
    ];
    
    grid.innerHTML = m.map(i => `
      <div class="metric-box">
        <div style="font-size:0.9rem;color:var(--text-muted);text-transform:uppercase;">${i.l}</div>
        <div class="m-val">${i.v}</div>
        <div class="m-sub">${i.s}</div>
      </div>
    `).join('');
  } catch (err) { grid.innerHTML = 'Error loading metrics'; }
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
}

// Set initial tab mode labels
setMode('basic');

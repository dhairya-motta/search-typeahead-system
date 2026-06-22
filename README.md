# OmniSearch: High-Performance Distributed Typeahead System

OmniSearch is a full-stack search typeahead application built in Node.js and Vanilla JavaScript, inspired by modern search engines. It features a custom Prefix Trie, a distributed cache simulated via Consistent Hashing, real-time sliding-window trending queries, and a batch-write pipeline for database optimization.

### 🎥 Watch the Demo Video
![Final Demo Video](final_demo_video.webp)

## Table of Contents
1. [Setup Instructions](#setup-instructions)
2. [Dataset Source and Loading](#dataset-source-and-loading)
3. [Architecture Explanation](#architecture-explanation)
4. [API Documentation](#api-documentation)
5. [Performance Report](#performance-report)
6. [Design Choices and Trade-offs](#design-choices-and-trade-offs)

---

## Setup Instructions

**Prerequisites:**
- Node.js (v16+)
- npm

**Installation:**
1. Clone the repository:
   ```bash
   git clone <repository_url>
   cd "HLD PROJECT"
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the application:
   ```bash
   npm start
   ```
   The backend and frontend will be served at `http://localhost:3001`.

---

## Dataset Source and Loading

Instead of relying on a static, potentially outdated file, this project dynamically generates a high-volume dataset simulating real-world search frequencies.

**To generate the dataset:**
```bash
npm run generate
```
- This runs `data/generate_dataset.js`, which creates `data/queries.json` containing over 100,000 synthetic search queries with randomized frequencies.
- **Loading:** When the server starts (`npm start`), `src/data/loader.js` parses the JSON file and ingests all 100,000+ queries into the in-memory Prefix Trie.

---

## Architecture Explanation

The system is designed as a monolithic Node.js service that simulates a distributed microservice architecture.

1. **Frontend (Vanilla HTML/CSS/JS):** 
   - A highly optimized, dependency-free client featuring debouncing (250ms) to prevent API spam. 
   - Includes real-time rendering of suggestions, trending data, cache cluster health, and system telemetry.
2. **Express API Layer:**
   - Intercepts requests, logs latency metrics, and routes them to the appropriate subsystem.
3. **Prefix Trie Engine:**
   - A custom n-ary tree structure for `O(L)` time complexity prefix matching, where `L` is the length of the query.
4. **Distributed Cache (Consistent Hashing):**
   - Simulated using 3 physical nodes (`node-alpha`, `node-beta`, `node-gamma`) and 100 virtual nodes per server mapped via an MD5 hash ring. 
   - Routes cache requests evenly. If a node fails, the ring gracefully falls back to the nearest healthy neighbor.
5. **Batch Writer:**
   - Instead of writing every search to the Trie (database) instantly, searches are buffered in memory and flushed every 5 seconds (or 500 operations).
6. **Trending Service (Sliding Window):**
   - Tracks recent searches in a 24-hour sliding window. The score combines the historical frequency with a 5x multiplier for searches occurring within the active window.

---

## API Documentation

| Endpoint | Method | Params | Description |
|----------|--------|--------|-------------|
| `/suggest` | `GET` | `q` (string), `mode` (basic/enhanced) | Returns top 10 autocomplete suggestions matching the prefix `q`. |
| `/search` | `POST` | Body: `{ query: "term" }` | Submits a search query. Sent to the batch writer. |
| `/trending` | `GET` | `limit` (int), `mode` (basic/enhanced) | Returns the top trending searches based on the selected mode. |
| `/cache/stats` | `GET` | - | Returns hit rate, key count, and health status for all cache nodes. |
| `/cache/buffer` | `GET` | - | Returns current batch writer buffer state and compression ratio. |
| `/cache/debug` | `GET` | `prefix` (string) | Hashes the prefix and returns the assigned virtual/physical cache node. |
| `/metrics` | `GET` | - | Returns global `p50`/`p95` latency, hit rates, and write-reduction metrics. |

---

## Performance Report

Live metrics can be viewed directly in the application's **Telemetry Tab**. 
Under simulated load:
- **Latency:** The Trie structure enables lightning-fast retrievals. Global `p50` latency averages **~1-3ms**, while `p95` averages **~5-8ms**.
- **Cache Hit Rate:** Because popular prefixes are heavily requested, the distributed cache absorbs up to **85-95%** of all `/suggest` requests, preventing the Trie from being accessed unnecessarily.
- **Write Reduction:** The Batch Writer buffer compresses duplicate searches (e.g., 50 searches for "iphone" within 5 seconds become a single database write of `+50`). This typically results in a **70-90% reduction** in direct database writes.

---

## Design Choices and Trade-offs

### 1. Sliding Window vs. Exponential Decay (Trending)
- **Choice:** I implemented a strict 24-hour Sliding Window instead of Exponential Decay.
- **Trade-off:** Exponential decay is computationally cheaper since it only requires updating a single numeric score. However, a Sliding Window provides much higher accuracy. It perfectly bounds events to a timeframe (exactly 24 hours), guaranteeing that a viral spike completely drops off the trends when the window expires, avoiding the infinite "mathematical tail" associated with decay functions. It uses slightly more memory to store timestamps.

### 2. Batch Writes for Count Updates
- **Choice:** Buffering search submissions and flushing them intervalically.
- **Trade-off:** This provides massive performance benefits, dramatically reducing I/O lock contention on the primary datastore (the Trie). The major trade-off is **Failure Data Loss**. If the server crashes before a flush interval (5 seconds), any search counts in the volatile memory buffer are permanently lost. For a search engine, slightly inaccurate search counts are an acceptable trade-off for system stability under immense load.

### 3. Consistent Hashing
- **Choice:** 100 virtual nodes per physical server using MD5 hashing.
- **Trade-off:** Without virtual nodes, consistent hashing can result in uneven data distribution (hotspots). Using 100 virtual nodes per server ensures uniform distribution of cached keys. The trade-off is a slight increase in computational overhead (`O(log N)`) to perform a binary search across the ring array to find the nearest node.

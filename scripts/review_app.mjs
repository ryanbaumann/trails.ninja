#!/usr/bin/env node
/**
 * review_app.mjs
 * 
 * Local Zero-Dependency Web Application for A/B synthetic data curation.
 * Enables 1-click & keyboard-driven selection of A/B synthetic training pairs,
 * instant negative constraint checking, and automated dataset generation for MLX training.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.dirname(__dirname);

const REVIEW_DIR = path.join(ROOT_DIR, 'experiment', 'voice-ft', 'review');
const TRAINING_DIR = path.join(ROOT_DIR, 'experiment', 'voice-ft', 'training');
const CANDIDATES_FILE = path.join(REVIEW_DIR, 'candidates.jsonl');
const STATE_FILE = path.join(REVIEW_DIR, 'review_state.json');
const TRAIN_JSONL = path.join(TRAINING_DIR, 'train.jsonl');
const DPO_JSONL = path.join(TRAINING_DIR, 'dpo_pairs.jsonl');
const LEXICON_FILE = path.join(ROOT_DIR, 'scripts', 'lib', 'voice-lexicon.json');

const PORT = parseInt(process.env.PORT || '8085', 10);

// Ensure directories
fs.mkdirSync(REVIEW_DIR, { recursive: true });
fs.mkdirSync(TRAINING_DIR, { recursive: true });

function loadJson(filepath, fallback = {}) {
  try {
    if (fs.existsSync(filepath)) {
      return JSON.parse(fs.readFileSync(filepath, 'utf8'));
    }
  } catch (err) {
    console.error(`Error loading JSON ${filepath}:`, err.message);
  }
  return fallback;
}

function loadCandidates() {
  if (!fs.existsSync(CANDIDATES_FILE)) {
    return [];
  }
  const lines = fs.readFileSync(CANDIDATES_FILE, 'utf8').trim().split('\n');
  return lines.filter(Boolean).map(line => JSON.parse(line));
}

function saveCandidates(items) {
  const content = items.map(it => JSON.stringify(it)).join('\n') + '\n';
  fs.writeFileSync(CANDIDATES_FILE, content, 'utf8');
}

function loadState() {
  return loadJson(STATE_FILE, {
    currentIndex: 0,
    decisions: {}, // id -> { action: 'select_a' | 'select_b' | 'remove' | 'edit', text: string, timestamp: number }
    stats: { approved: 0, removed: 0, total: 0 }
  });
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function exportDatasets() {
  const candidates = loadCandidates();
  const state = loadState();
  const trainRecords = [];
  const dpoRecords = [];

  for (const c of candidates) {
    const dec = state.decisions[c.id];
    if (!dec) continue;

    if (dec.action === 'select_a') {
      trainRecords.push({
        messages: [
          { role: 'system', content: "You are Ryan Baumann's writing voice assistant." },
          { role: 'user', content: c.prompt },
          { role: 'assistant', content: c.candidate_a.text }
        ]
      });
      dpoRecords.push({
        prompt: c.prompt,
        chosen: c.candidate_a.text,
        rejected: c.candidate_b.text
      });
    } else if (dec.action === 'select_b') {
      trainRecords.push({
        messages: [
          { role: 'system', content: "You are Ryan Baumann's writing voice assistant." },
          { role: 'user', content: c.prompt },
          { role: 'assistant', content: c.candidate_b.text }
        ]
      });
      dpoRecords.push({
        prompt: c.prompt,
        chosen: c.candidate_b.text,
        rejected: c.candidate_a.text
      });
    } else if (dec.action === 'edit' && dec.text) {
      trainRecords.push({
        messages: [
          { role: 'system', content: "You are Ryan Baumann's writing voice assistant." },
          { role: 'user', content: c.prompt },
          { role: 'assistant', content: dec.text }
        ]
      });
    }
  }

  // Write datasets
  if (trainRecords.length > 0) {
    fs.writeFileSync(
      path.join(TRAINING_DIR, 'train_reviewed.jsonl'),
      trainRecords.map(r => JSON.stringify(r)).join('\n') + '\n',
      'utf8'
    );
  }
  if (dpoRecords.length > 0) {
    fs.writeFileSync(
      DPO_JSONL,
      dpoRecords.map(r => JSON.stringify(r)).join('\n') + '\n',
      'utf8'
    );
  }

  // Update stats
  let approved = 0;
  let removed = 0;
  for (const k in state.decisions) {
    const d = state.decisions[k];
    if (d.action === 'select_a' || d.action === 'select_b' || d.action === 'edit') {
      approved++;
    } else if (d.action === 'remove') {
      removed++;
    }
  }
  state.stats = { approved, removed, total: candidates.length };
  saveState(state);

  return { approved, removed, total: candidates.length };
}

// Server logic
const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Set CORS and headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === '/api/data' && req.method === 'GET') {
    const candidates = loadCandidates();
    const state = loadState();
    const lexicon = loadJson(LEXICON_FILE, {});
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ candidates, state, lexicon }));
    return;
  }

  if (pathname === '/api/action' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const { id, action, text, nextIndex } = payload;
        const state = loadState();
        
        state.decisions[id] = {
          action,
          text: text || null,
          timestamp: Date.now()
        };
        if (typeof nextIndex === 'number') {
          state.currentIndex = nextIndex;
        }

        saveState(state);
        const stats = exportDatasets();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, stats, state }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/generate' && req.method === 'POST') {
    const genScript = path.join(ROOT_DIR, 'scripts', 'generate_review_candidates.py');
    const child = spawn('python3', [genScript], { cwd: ROOT_DIR });
    let output = '';
    child.stdout.on('data', d => { output += d; });
    child.stderr.on('data', d => { output += d; });
    child.on('close', code => {
      if (code === 0) {
        const candidates = loadCandidates();
        const state = loadState();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, count: candidates.length, output, candidates, state }));
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: output }));
      }
    });
    return;
  }

  if (pathname === '/api/rebuild' && req.method === 'POST') {
    exportDatasets();
    const child = spawn('python3', [path.join(ROOT_DIR, 'scripts', 'generate-ft-dataset.py')], { cwd: ROOT_DIR });
    let output = '';
    child.stdout.on('data', d => { output += d; });
    child.stderr.on('data', d => { output += d; });
    child.on('close', code => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: code === 0, output }));
    });
    return;
  }

  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML_TEMPLATE);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Synthetic Voice Dataset Studio — Fieldwork</title>
<style>
  :root {
    --bg-page: #0f1115;
    --bg-card: #181b21;
    --bg-card-hover: #1f232b;
    --bg-header: #13161c;
    --border: #2a303c;
    --border-highlight: #3b82f6;
    --text-main: #e2e8f0;
    --text-muted: #94a3b8;
    --text-bright: #ffffff;
    --accent: #38bdf8;
    --green-bg: #064e3b;
    --green-text: #34d399;
    --red-bg: #7f1d1d;
    --red-text: #f87171;
    --amber-bg: #78350f;
    --amber-text: #fbbf24;
    --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background-color: var(--bg-page);
    color: var(--text-main);
    font-family: var(--font-sans);
    line-height: 1.5;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Top Navigation Bar */
  header {
    background: var(--bg-header);
    border-bottom: 1px solid var(--border);
    padding: 12px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-shrink: 0;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .brand h1 {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text-bright);
    letter-spacing: -0.02em;
  }
  .brand .tag {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    padding: 2px 8px;
    border-radius: 4px;
    background: #1e293b;
    color: var(--accent);
    border: 1px solid #334155;
  }

  .stats-bar {
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 0.85rem;
    font-family: var(--font-mono);
  }
  .stat-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 12px;
    background: #1e2430;
  }
  .stat-pill.approved { color: var(--green-text); }
  .stat-pill.removed { color: var(--red-text); }
  .stat-pill.pending { color: var(--amber-text); }

  .header-actions {
    display: flex;
    gap: 10px;
  }
  button {
    font-family: var(--font-sans);
    font-weight: 500;
    font-size: 0.85rem;
    cursor: pointer;
    border-radius: 6px;
    border: 1px solid var(--border);
    padding: 6px 12px;
    background: #1e232d;
    color: var(--text-main);
    transition: all 0.15s ease;
  }
  button:hover {
    background: #28303e;
    border-color: #475569;
  }
  button.primary {
    background: #2563eb;
    border-color: #3b82f6;
    color: white;
  }
  button.primary:hover {
    background: #1d4ed8;
  }

  /* Main App Container */
  main {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 20px 24px;
    overflow-y: auto;
    gap: 18px;
    max-width: 1440px;
    width: 100%;
    margin: 0 auto;
  }

  /* Prompt Panel */
  .prompt-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px 20px;
  }
  .prompt-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  .task-badge {
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: 0.8rem;
    background: #0369a1;
    color: #e0f2fe;
    padding: 3px 10px;
    border-radius: 4px;
  }
  .item-counter {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    color: var(--text-muted);
  }
  .prompt-text {
    font-size: 0.95rem;
    color: var(--text-bright);
    white-space: pre-wrap;
    line-height: 1.6;
  }

  /* A/B Comparison Cards */
  .comparison-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    flex: 1;
    min-height: 320px;
  }
  .candidate-card {
    background: var(--bg-card);
    border: 2px solid var(--border);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: border-color 0.15s ease, transform 0.1s ease;
  }
  .candidate-card.selected {
    border-color: #3b82f6;
    box-shadow: 0 0 16px rgba(59, 130, 246, 0.2);
  }
  .candidate-card.rejected {
    opacity: 0.6;
    border-color: #475569;
  }

  .card-header {
    background: #14171d;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .card-title {
    font-weight: 700;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .card-title .key-hint {
    background: #334155;
    color: #f8fafc;
    font-family: var(--font-mono);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.75rem;
  }
  .card-badges {
    display: flex;
    gap: 6px;
  }
  .badge {
    font-size: 0.7rem;
    padding: 2px 8px;
    border-radius: 10px;
    font-family: var(--font-mono);
  }
  .badge.pass { background: var(--green-bg); color: var(--green-text); }
  .badge.fail { background: var(--red-bg); color: var(--red-text); }
  .badge.info { background: #1e293b; color: #94a3b8; }

  .card-body {
    padding: 16px;
    flex: 1;
    font-size: 0.95rem;
    line-height: 1.6;
    color: var(--text-main);
    white-space: pre-wrap;
    overflow-y: auto;
  }
  .card-footer {
    padding: 12px 16px;
    background: #14171d;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: flex-end;
  }
  .card-footer button {
    width: 100%;
    padding: 10px 16px;
    font-size: 0.95rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  /* Bottom Controls */
  .bottom-bar {
    background: var(--bg-header);
    border-top: 1px solid var(--border);
    padding: 12px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }
  .nav-group {
    display: flex;
    gap: 10px;
  }
  .shortcut-legend {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--text-muted);
    display: flex;
    gap: 16px;
  }
  .shortcut-legend kbd {
    background: #1e293b;
    border: 1px solid #475569;
    border-radius: 3px;
    padding: 2px 6px;
    color: #f1f5f9;
  }

  /* Modal Edit Dialog */
  .modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.7);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .modal-content {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 20px;
    width: 90%;
    max-width: 700px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .modal-content textarea {
    width: 100%;
    height: 200px;
    background: #0f1115;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 12px;
    color: white;
    font-family: var(--font-sans);
    font-size: 0.95rem;
    line-height: 1.5;
    resize: vertical;
  }
</style>
</head>
<body>

<header>
  <div class="brand">
    <h1>Synthetic Voice Studio</h1>
    <span class="tag">Local A/B Curation</span>
  </div>
  <div class="stats-bar">
    <div class="stat-pill approved">Approved: <strong id="stat-approved">0</strong></div>
    <div class="stat-pill removed">Removed: <strong id="stat-removed">0</strong></div>
    <div class="stat-pill pending">Remaining: <strong id="stat-remaining">0</strong></div>
  </div>
  <div class="header-actions">
    <button onclick="generateMore()">➕ Synthesize Pairs</button>
    <button class="primary" onclick="rebuildDataset()">⚡ Build Training Datasets</button>
  </div>
</header>

<main id="main-content">
  <div class="prompt-card">
    <div class="prompt-meta">
      <span class="task-badge" id="task-badge">Task: Edit</span>
      <div class="item-counter" id="item-counter">Item 1 of 56</div>
    </div>
    <div class="prompt-text" id="prompt-text">Loading candidate prompt...</div>
  </div>

  <div class="comparison-grid">
    <!-- Option A -->
    <div class="candidate-card" id="card-a">
      <div class="card-header">
        <div class="card-title">
          <span class="key-hint">A</span> Option A (<span id="source-a">Authentic</span>)
        </div>
        <div class="card-badges" id="badges-a"></div>
      </div>
      <div class="card-body" id="text-a">...</div>
      <div class="card-footer">
        <button class="primary" onclick="choose('select_a')">
          <span>Choose Option A</span> <span class="key-hint">A / 1</span>
        </button>
      </div>
    </div>

    <!-- Option B -->
    <div class="candidate-card" id="card-b">
      <div class="card-header">
        <div class="card-title">
          <span class="key-hint">B</span> Option B (<span id="source-b">Synthetic</span>)
        </div>
        <div class="card-badges" id="badges-b"></div>
      </div>
      <div class="card-body" id="text-b">...</div>
      <div class="card-footer">
        <button class="primary" onclick="choose('select_b')">
          <span>Choose Option B</span> <span class="key-hint">B / 2</span>
        </button>
      </div>
    </div>
  </div>
</main>

<div class="bottom-bar">
  <div class="nav-group">
    <button onclick="prevItem()">← Prev (J)</button>
    <button onclick="nextItem()">Next (K) →</button>
    <button onclick="choose('remove')" style="background: #7f1d1d; border-color: #b91c1c; color: white;">
      🗑️ Discard Both (R / X)
    </button>
    <button onclick="openEditModal()">✏️ Edit Custom (E)</button>
  </div>
  <div class="shortcut-legend">
    <span><kbd>A</kbd> Select A</span>
    <span><kbd>B</kbd> Select B</span>
    <span><kbd>R</kbd> Discard</span>
    <span><kbd>J</kbd>/<kbd>K</kbd> Prev/Next</span>
    <span><kbd>E</kbd> Edit</span>
  </div>
</div>

<!-- Modal Dialog for custom editing -->
<div class="modal-overlay" id="edit-modal">
  <div class="modal-content">
    <h3>Custom Edit & Approve</h3>
    <textarea id="modal-textarea"></textarea>
    <div style="display: flex; justify-content: flex-end; gap: 10px;">
      <button onclick="closeEditModal()">Cancel</button>
      <button class="primary" onclick="saveCustomEdit()">Save & Approve</button>
    </div>
  </div>
</div>

<script>
let state = { currentIndex: 0, decisions: {}, stats: {} };
let candidates = [];
let lexicon = {};

async function init() {
  const res = await fetch('/api/data');
  const data = await res.json();
  candidates = data.candidates || [];
  state = data.state || { currentIndex: 0, decisions: {}, stats: {} };
  lexicon = data.lexicon || {};
  renderCurrent();
}

function lintText(text) {
  const badges = [];
  // Em-dash check
  if (text.includes('—')) {
    badges.push({ text: 'Contains em-dash', type: 'fail' });
  } else {
    badges.push({ text: '0 em-dashes', type: 'pass' });
  }

  // Word count
  const words = text.trim().split(/\\s+/).length;
  badges.push({ text: words + ' words', type: 'info' });

  // Common tell checks
  const tells = ['delve into', 'testament', 'tapestry', 'transformative', 'game-changer', 'pleased to announce'];
  const found = tells.filter(t => text.toLowerCase().includes(t));
  if (found.length > 0) {
    badges.push({ text: 'Slop: ' + found[0], type: 'fail' });
  }

  return badges;
}

function renderCurrent() {
  if (candidates.length === 0) {
    document.getElementById('prompt-text').textContent = 'No candidate pairs found. Click "Synthesize Pairs" above to generate some!';
    return;
  }

  const idx = state.currentIndex;
  const item = candidates[idx] || candidates[0];

  document.getElementById('task-badge').textContent = 'Task: ' + item.task;
  document.getElementById('item-counter').textContent = 'Item ' + (idx + 1) + ' of ' + candidates.length;
  document.getElementById('prompt-text').textContent = item.prompt;

  // Render Card A
  document.getElementById('source-a').textContent = item.candidate_a.label || 'Candidate A';
  document.getElementById('text-a').textContent = item.candidate_a.text;
  renderBadges('badges-a', lintText(item.candidate_a.text));

  // Render Card B
  document.getElementById('source-b').textContent = item.candidate_b.label || 'Candidate B';
  document.getElementById('text-b').textContent = item.candidate_b.text;
  renderBadges('badges-b', lintText(item.candidate_b.text));

  // Highlight selection state if already reviewed
  const dec = state.decisions[item.id];
  const cardA = document.getElementById('card-a');
  const cardB = document.getElementById('card-b');
  cardA.className = 'candidate-card';
  cardB.className = 'candidate-card';

  if (dec) {
    if (dec.action === 'select_a') {
      cardA.classList.add('selected');
      cardB.classList.add('rejected');
    } else if (dec.action === 'select_b') {
      cardB.classList.add('selected');
      cardA.classList.add('rejected');
    } else if (dec.action === 'remove') {
      cardA.classList.add('rejected');
      cardB.classList.add('rejected');
    }
  }

  // Update Stats
  let approved = 0, removed = 0;
  for (const k in state.decisions) {
    const d = state.decisions[k];
    if (d.action === 'select_a' || d.action === 'select_b' || d.action === 'edit') approved++;
    if (d.action === 'remove') removed++;
  }
  document.getElementById('stat-approved').textContent = approved;
  document.getElementById('stat-removed').textContent = removed;
  document.getElementById('stat-remaining').textContent = Math.max(0, candidates.length - approved - removed);
}

function renderBadges(containerId, badges) {
  const container = document.getElementById(containerId);
  container.innerHTML = badges.map(b => 
    \`<span class="badge \${b.type}">\${b.text}</span>\`
  ).join('');
}

async function choose(action, customText = null) {
  const item = candidates[state.currentIndex];
  if (!item) return;

  const nextIdx = Math.min(candidates.length - 1, state.currentIndex + 1);

  const res = await fetch('/api/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: item.id,
      action,
      text: customText,
      nextIndex: nextIdx
    })
  });
  const data = await res.json();
  if (data.ok) {
    state = data.state;
    renderCurrent();
  }
}

function prevItem() {
  if (state.currentIndex > 0) {
    state.currentIndex--;
    renderCurrent();
  }
}

function nextItem() {
  if (state.currentIndex < candidates.length - 1) {
    state.currentIndex++;
    renderCurrent();
  }
}

function openEditModal() {
  const item = candidates[state.currentIndex];
  if (!item) return;
  document.getElementById('modal-textarea').value = item.candidate_a.text;
  document.getElementById('edit-modal').style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('edit-modal').style.display = 'none';
}

function saveCustomEdit() {
  const text = document.getElementById('modal-textarea').value;
  closeEditModal();
  choose('edit', text);
}

async function generateMore() {
  const res = await fetch('/api/generate', { method: 'POST' });
  const data = await res.json();
  if (data.ok) {
    candidates = data.candidates;
    state = data.state;
    renderCurrent();
    alert('Generated ' + data.count + ' pairs!');
  }
}

async function rebuildDataset() {
  const res = await fetch('/api/rebuild', { method: 'POST' });
  const data = await res.json();
  if (data.ok) {
    alert('Training datasets rebuilt and 0-leakage verified!\\n\\n' + data.output);
  } else {
    alert('Error rebuilding dataset:\\n' + data.output);
  }
}

// Global Keyboard Handler
window.addEventListener('keydown', (e) => {
  if (document.getElementById('edit-modal').style.display === 'flex') return;
  const key = e.key.toLowerCase();
  if (key === 'a' || key === '1') choose('select_a');
  else if (key === 'b' || key === '2') choose('select_b');
  else if (key === 'r' || key === 'x' || key === 'delete') choose('remove');
  else if (key === 'j' || key === 'arrowleft') prevItem();
  else if (key === 'k' || key === 'arrowright') nextItem();
  else if (key === 'e') openEditModal();
});

init();
</script>
</body>
</html>
`;

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[✓] Synthetic Voice Dataset Studio running at http://127.0.0.1:${PORT}`);
});

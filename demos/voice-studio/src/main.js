import { EVAL_PROMPTS, TRAINING_RUNS } from './evalData.js';
import { analyzeVoiceMetrics } from './metrics.js';

// State
let currentPromptIndex = 0;
let isRevealed = false;
let modelMapping = { A: "baseModel", B: "round1Model" };
let userVotes = {};

// DOM Elements
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

// Tab Navigation
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    tabPanels.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const panelId = `${btn.dataset.tab}-panel`;
    const targetPanel = document.getElementById(panelId);
    if (targetPanel) targetPanel.classList.add('active');
  });
});

// Arena Implementation
function setupArena() {
  const promptSelect = document.getElementById('prompt-select');
  if (!promptSelect) return;

  promptSelect.innerHTML = '';
  EVAL_PROMPTS.forEach((p, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = `[${p.task}] ${p.prompt.slice(0, 60)}...`;
    promptSelect.appendChild(opt);
  });

  promptSelect.addEventListener('change', (e) => {
    currentPromptIndex = parseInt(e.target.value, 10);
    renderArenaPrompt();
  });

  document.getElementById('btn-reveal')?.addEventListener('click', revealArena);
  document.getElementById('btn-next-prompt')?.addEventListener('click', nextArenaPrompt);

  document.getElementById('vote-a')?.addEventListener('click', () => recordVote('A'));
  document.getElementById('vote-b')?.addEventListener('click', () => recordVote('B'));

  renderArenaPrompt();
}

function renderArenaPrompt() {
  isRevealed = false;
  const item = EVAL_PROMPTS[currentPromptIndex];
  if (!item) return;

  // Shuffle A / B
  const flip = Math.random() > 0.5;
  modelMapping = {
    A: flip ? "round1Model" : "baseModel",
    B: flip ? "baseModel" : "round1Model"
  };

  // Update prompt box
  const taskTag = document.getElementById('current-task-tag');
  const promptText = document.getElementById('current-prompt-text');
  if (taskTag) taskTag.textContent = item.task;
  if (promptText) promptText.textContent = item.prompt;

  // Model A Output & Metrics
  const textA = item[modelMapping.A];
  const metricsA = analyzeVoiceMetrics(textA);
  renderModelCard('a', textA, metricsA, 'Model Alpha');

  // Model B Output & Metrics
  const textB = item[modelMapping.B];
  const metricsB = analyzeVoiceMetrics(textB);
  renderModelCard('b', textB, metricsB, 'Model Beta');

  // Reset Reveal State
  const cardA = document.getElementById('card-a');
  const cardB = document.getElementById('card-b');
  cardA?.classList.remove('revealed', 'winner');
  cardB?.classList.remove('revealed', 'winner');
  document.getElementById('revealed-name-a').textContent = "Blind Evaluation";
  document.getElementById('revealed-name-b').textContent = "Blind Evaluation";

  // Reset Vote Buttons
  document.getElementById('vote-a')?.classList.remove('selected');
  document.getElementById('vote-b')?.classList.remove('selected');
  document.getElementById('arena-verdict-box').style.display = 'none';
}

function renderModelCard(slot, text, metrics, defaultLabel) {
  const outputEl = document.getElementById(`output-${slot}`);
  if (outputEl) outputEl.textContent = text;

  const stdevEl = document.getElementById(`stdev-${slot}`);
  if (stdevEl) stdevEl.textContent = metrics.sentenceLengthStdev;

  const emDashEl = document.getElementById(`emdash-${slot}`);
  if (emDashEl) {
    emDashEl.textContent = metrics.emDashCount;
    emDashEl.className = `metric-val ${metrics.emDashCount === 0 ? 'metric-good' : 'metric-alert'}`;
  }

  const buzzEl = document.getElementById(`buzzwords-${slot}`);
  if (buzzEl) {
    buzzEl.textContent = metrics.buzzwords.length;
    buzzEl.className = `metric-val ${metrics.buzzwords.length === 0 ? 'metric-good' : 'metric-alert'}`;
  }
}

function recordVote(slot) {
  userVotes[currentPromptIndex] = slot;
  document.getElementById('vote-a')?.classList.toggle('selected', slot === 'A');
  document.getElementById('vote-b')?.classList.toggle('selected', slot === 'B');
  revealArena();
}

function revealArena() {
  if (isRevealed) return;
  isRevealed = true;

  const item = EVAL_PROMPTS[currentPromptIndex];
  const nameA = modelMapping.A === "round1Model" ? "Gemma 4 26B (LoRA Tuned)" : "Gemma 4 26B (Base Model)";
  const nameB = modelMapping.B === "round1Model" ? "Gemma 4 26B (LoRA Tuned)" : "Gemma 4 26B (Base Model)";

  document.getElementById('revealed-name-a').textContent = nameA;
  document.getElementById('revealed-name-b').textContent = nameB;

  const cardA = document.getElementById('card-a');
  const cardB = document.getElementById('card-b');
  cardA?.classList.add('revealed');
  cardB?.classList.add('revealed');

  const tunedSlot = modelMapping.A === "round1Model" ? cardA : cardB;
  tunedSlot?.classList.add('winner');

  const verdictBox = document.getElementById('arena-verdict-box');
  if (verdictBox) {
    verdictBox.style.display = 'block';
    verdictBox.innerHTML = `
      <strong>Ground Truth Reference (Ryan):</strong><br>
      <span style="color: #cbd5e1;">"${item.groundTruth}"</span>
    `;
  }
}

function nextArenaPrompt() {
  currentPromptIndex = (currentPromptIndex + 1) % EVAL_PROMPTS.length;
  const select = document.getElementById('prompt-select');
  if (select) select.value = currentPromptIndex;
  renderArenaPrompt();
}

// Scrubber Implementation
function setupScrubber() {
  const inputEl = document.getElementById('scrubber-input');
  const outputEl = document.getElementById('scrubber-output');
  const btnClean = document.getElementById('btn-scrub');
  const btnExport = document.getElementById('btn-export-pair');

  // Quick templates
  document.querySelectorAll('.template-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      if (inputEl) {
        inputEl.value = chip.dataset.sample;
        updateScrubberMetrics();
      }
    });
  });

  inputEl?.addEventListener('input', updateScrubberMetrics);
  outputEl?.addEventListener('input', updateScrubberMetrics);

  btnClean?.addEventListener('click', () => {
    if (!inputEl || !outputEl) return;
    const raw = inputEl.value;
    // Simple local transformation simulation
    let cleaned = raw
      .replace(/\bWe are pleased to announce\b/gi, "We shipped")
      .replace(/\bWe are thrilled to announce\b/gi, "We launched")
      .replace(/\bIn today's fast-paced digital world,\s*/gi, "")
      .replace(/\bseamlessly\b/gi, "directly")
      .replace(/\bleverage\b/gi, "use")
      .replace(/—/g, ": ")
      .replace(/--/g, ": ");
    
    outputEl.value = cleaned;
    updateScrubberMetrics();
  });

  btnExport?.addEventListener('click', () => {
    const inputVal = inputEl?.value.trim();
    const outputVal = outputEl?.value.trim();
    if (!inputVal || !outputVal) {
      alert("Please provide both an input and an edited output before exporting.");
      return;
    }

    const pair = {
      messages: [
        {
          role: "system",
          content: "You are Ryan Baumann's writing voice and editorial agent. You draft, edit, rewrite, critique, and present in his style: first person, active, direct. Growth-backwards framing (lead with the result, what shipped, then the lesson). Conversational but evidence-led. Use contractions. No em-dashes. No passive voice for your own work. When editing, preserve the author's intent while shifting register and structure to match Ryan's patterns."
        },
        {
          role: "user",
          content: `[Task: Edit]\nRewrite this draft in Ryan's voice:\n${inputVal}`
        },
        {
          role: "assistant",
          content: outputVal
        }
      ]
    };

    const blob = new Blob([JSON.stringify(pair) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voice_pair_${Date.now()}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  });

  updateScrubberMetrics();
}

function updateScrubberMetrics() {
  const outputText = document.getElementById('scrubber-output')?.value || "";
  const metrics = analyzeVoiceMetrics(outputText);

  document.getElementById('scrub-words').textContent = metrics.wordCount;
  document.getElementById('scrub-stdev').textContent = metrics.sentenceLengthStdev;
  document.getElementById('scrub-emdashes').textContent = metrics.emDashCount;
  document.getElementById('scrub-buzzwords').textContent = metrics.buzzwords.length;

  // Render Rhythm Bar Chart
  const barsContainer = document.getElementById('rhythm-bars');
  if (barsContainer) {
    barsContainer.innerHTML = '';
    const maxLen = Math.max(...metrics.sentenceLengths, 20);
    metrics.sentenceLengths.forEach(len => {
      const bar = document.createElement('div');
      bar.className = 'sentence-bar';
      const heightPercent = Math.min(100, Math.round((len / maxLen) * 100));
      bar.style.height = `${heightPercent}%`;
      bar.title = `${len} words`;
      barsContainer.appendChild(bar);
    });
  }
}

// Analytics Table
function setupAnalytics() {
  const tbody = document.getElementById('training-runs-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  TRAINING_RUNS.forEach(run => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight: 700; color: #38bdf8;">${run.round}</td>
      <td>${run.model}</td>
      <td>${run.lossStart} → <span style="color: #34d399; font-weight: 700;">${run.lossEnd}</span></td>
      <td>${run.peakMemory}</td>
      <td style="color: #94a3b8; font-family: inherit; font-size: 0.85rem;">${run.notes}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
  setupArena();
  setupScrubber();
  setupAnalytics();
});

#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// GEAR / TONIDOBOT — TUI Dashboard
// A professional-grade CLI dashboard powered by blessed.
// ─────────────────────────────────────────────────────────────────────────────

import blessed from 'blessed';
import { config } from 'dotenv';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

// ─── Load Environment ───────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '..', '.env') });

if (!process.env.BASE_URL) {
  console.error(
    'ERROR: Missing BASE_URL in .env file.\n' +
    'Copy .env.example to .env and set BASE_URL to your endpoint.\n' +
    'Example: BASE_URL=http://localhost:11434'
  );
  process.exit(1);
}

// ─── QueryEngine (dual-mode: OpenAI-compatible + Ollama native) ─────────────

const QueryEngine = {
  metrics: { count: 0, successes: 0, failures: 0, totalTime: 0 },

  async run(input) {
    const start = Date.now();
    this.metrics.count++;
    const mode = (process.env.ENDPOINT_MODE || 'openai').toLowerCase();

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (process.env.API_KEY) {
        headers['Authorization'] = `Bearer ${process.env.API_KEY}`;
      }

      let url;
      let body;

      if (mode === 'ollama') {
        // Ollama native endpoint: POST /api/generate
        url = `${process.env.BASE_URL}/api/generate`;
        body = JSON.stringify({
          model: process.env.MODEL || 'llama3',
          prompt: input,
          stream: false
        });
      } else {
        // OpenAI-compatible endpoint: POST /v1/chat/completions
        url = `${process.env.BASE_URL}/v1/chat/completions`;
        body = JSON.stringify({
          model: process.env.MODEL || 'default',
          messages: [{ role: 'user', content: input }]
        });
      }

      const res = await fetch(url, { method: 'POST', headers, body });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const data = await res.json();

      // Parse response based on mode
      let text;
      if (mode === 'ollama') {
        text = data.response || JSON.stringify(data);
      } else {
        text = data.choices?.[0]?.message?.content || JSON.stringify(data);
      }

      this.metrics.successes++;
      this.metrics.totalTime += Date.now() - start;
      return text;
    } catch (err) {
      this.metrics.failures++;
      this.metrics.totalTime += Date.now() - start;
      return `[Error: ${err.message}]`;
    }
  }
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}

function timestamp() {
  return new Date().toISOString().replace('T', ' ').split('.')[0];
}

// ─── Screen ─────────────────────────────────────────────────────────────────

const screen = blessed.screen({
  smartCSR: true,
  title: 'GEAR / TONIDOBOT Dashboard',
  cursor: { artificial: true, shape: 'line', blink: true, color: 'cyan' }
});

// ─── Header ─────────────────────────────────────────────────────────────────

// ============================================================================
// PASTE YOUR TONIDOBOT / GEAR ASCII ART BELOW (between the backticks).
// Replace the placeholder text with your own art. Keep it within ~5 lines
// so it fits in the 7-row header box.
// ============================================================================
const LOGO_ART =
  '{bold}{green-fg}' +
  '   ██████╗ ███████╗ █████╗ ██████╗    ╱  ╔╦╗╔═╗╔╗╔╦╔╦╗╔═╗╔╗ ╔═╗╔╦╗\n' +
  '  ██╔════╝ ██╔════╝██╔══██╗██╔══██╗  ╱   ║ ║ ║║║║║║║║║ ║╠╩╗║ ║ ║\n' +
  '  ██║  ███╗█████╗  ███████║██████╔╝ ╱    ║ ║ ║║║║║║║║║ ║╠═╗║ ║ ║\n' +
  '  ██║   ██║██╔══╝  ██╔══██║██╔══██╗╱     ║ ╚═╝╝╚╝╝╩╚═╝╝╚═╝╚═╝ ╩\n' +
  '   ██████╔╝███████╗██║  ██║██║  ██║      ╩  COMMAND ENGINE v1.0\n' +
  '{/green-fg}{/bold}';

blessed.box({
  parent: screen,
  top: 0,
  left: 0,
  width: '100%',
  height: 7,
  tags: true,
  content: LOGO_ART,
  style: {
    fg: 'white',
    bg: 'black',
    border: { fg: 'cyan' }
  },
  border: { type: 'line' }
});

// ─── System Status (left middle) ───────────────────────────────────────────

const statusBox = blessed.box({
  parent: screen,
  top: 7,
  left: 0,
  width: '50%',
  height: 9,
  label: ' {cyan-fg}System Status{/cyan-fg} ',
  tags: true,
  style: {
    fg: 'white',
    bg: 'black',
    border: { fg: 'cyan' },
    label: { fg: 'cyan' }
  },
  border: { type: 'line' }
});

// ─── Keypress Debug ─────────────────────────────────────────────────────────

let lastKey = '(none)';

screen.on('keypress', (ch, key) => {
  lastKey = key.full || key.name || ch || '?';
  updateSystemStatus();
  screen.render();
});

function updateSystemStatus() {
  const used = Math.round((os.totalmem() - os.freemem()) / 1048576);
  const total = Math.round(os.totalmem() / 1048576);
  const mode = (process.env.ENDPOINT_MODE || 'openai').toLowerCase();
  statusBox.setContent(
    '{bold}{white-fg}' +
    `  Uptime:    {green-fg}${formatUptime(os.uptime())}{/green-fg}\n` +
    `  Node:      {green-fg}${process.version}{/green-fg}\n` +
    `  Platform:  {green-fg}${os.platform()} ${os.arch()}{/green-fg}\n` +
    `  Memory:    {green-fg}${used}MB / ${total}MB{/green-fg}\n` +
    `  Endpoint:  {yellow-fg}${mode}{/yellow-fg}\n` +
    `  Last Key:  {cyan-fg}${lastKey}{/cyan-fg}` +
    '{/white-fg}{/bold}'
  );
}

// ─── Metrics (right middle) ─────────────────────────────────────────────────

const metricsBox = blessed.box({
  parent: screen,
  top: 7,
  left: '50%',
  width: '50%',
  height: 9,
  label: ' {cyan-fg}Metrics{/cyan-fg} ',
  tags: true,
  style: {
    fg: 'white',
    bg: 'black',
    border: { fg: 'cyan' },
    label: { fg: 'cyan' }
  },
  border: { type: 'line' }
});

function updateMetrics() {
  const { count, successes, failures, totalTime } = QueryEngine.metrics;
  const rate = count > 0 ? ((successes / count) * 100).toFixed(1) : '0.0';
  const avg = count > 0 ? Math.round(totalTime / count) : 0;

  const rateColor = parseFloat(rate) >= 80 ? 'green' : parseFloat(rate) >= 50 ? 'yellow' : 'red';

  metricsBox.setContent(
    '{bold}{white-fg}' +
    `  Commands:      {green-fg}${count}{/green-fg}\n` +
    `  Success:       {green-fg}${successes}{/green-fg}\n` +
    `  Failures:      {red-fg}${failures}{/red-fg}\n` +
    `  Success Rate:  {${rateColor}-fg}${rate}%{/${rateColor}-fg}\n` +
    `  Avg Response:  {green-fg}${avg}ms{/green-fg}` +
    '{/white-fg}{/bold}'
  );
}

// ─── Tool Execution Log (blessed.box + manual buffer, NOT blessed.log) ──────
//
// blessed.log with tags:true has a _pcontent cache bug in v0.1.81 where
// pushLine/insertLine calls don't invalidate the tag-parsed render cache.
// Using a plain box with setContent() forces a full re-parse every time.

const logLines = [];
const MAX_LOG_LINES = 500;

const logBox = blessed.box({
  parent: screen,
  top: 16,
  left: 0,
  width: '100%',
  bottom: 3,
  label: ' {cyan-fg}Tool Execution Log{/cyan-fg} ',
  tags: true,
  scrollable: true,
  alwaysScroll: true,
  scrollbar: {
    ch: '|',
    style: { fg: 'cyan' }
  },
  mouse: true,
  // NO keys: true — prevents log from stealing keyboard events
  // NO vi: true   — prevents j/k intercepting during focus transitions
  style: {
    fg: 'green',
    bg: 'black',
    border: { fg: 'cyan' },
    label: { fg: 'cyan' },
    scrollbar: { fg: 'cyan' }
  },
  border: { type: 'line' }
});

function appendLog(text) {
  logLines.push(`{white-fg}[${timestamp()}]{/white-fg} ${text}`);
  if (logLines.length > MAX_LOG_LINES) logLines.shift();
  // setContent() forces full parseContent() → _parseTags() → _pcontent rebuild.
  // This sidesteps the blessed.log cache bug entirely.
  logBox.setContent(logLines.join('\n'));
  logBox.setScrollPerc(100);
  screen.render();
}

// ─── Command Input (footer) ─────────────────────────────────────────────────

const commandBox = blessed.box({
  parent: screen,
  bottom: 0,
  left: 0,
  width: '100%',
  height: 3,
  label: ' {bold}{cyan-fg}COMMAND{/cyan-fg}{/bold} ',
  tags: true,
  style: {
    fg: 'white',
    bg: 'black',
    border: { fg: 'cyan' },
    label: { fg: 'cyan', bold: true }
  },
  border: { type: 'line' }
});

const commandInput = blessed.textbox({
  parent: commandBox,
  top: 0,
  left: 1,
  right: 1,
  height: 1,
  inputOnFocus: true,
  keys: true,
  mouse: true,
  style: {
    fg: 'white',
    bg: 'black',
    focus: { fg: 'white', bg: '#1a1a2e' }
  }
});

// ─── Z-Index: bring log and command bar to front ────────────────────────────

logBox.setFront();
commandBox.setFront();

// ─── Focus Management & Key Bindings ────────────────────────────────────────

let inputFocused = false;

commandInput.on('focus', () => {
  inputFocused = true;
});

commandInput.on('blur', () => {
  inputFocused = false;
});

// Global 'q' — quit only when input is NOT focused
screen.key(['q'], () => {
  if (!inputFocused) cleanup();
});

// Global 'r' — refresh only when input is NOT focused
screen.key(['r'], () => {
  if (!inputFocused) {
    updateSystemStatus();
    updateMetrics();
    screen.render();
    appendLog('{yellow-fg}Manual refresh triggered.{/yellow-fg}');
  }
});

// Escape — quit only when input is NOT focused
screen.key(['escape'], () => {
  if (!inputFocused) cleanup();
});

// Ctrl+C — always quit
screen.key(['C-c'], () => {
  cleanup();
});

function cleanup() {
  appendLog('{yellow-fg}Shutting down...{/yellow-fg}');
  screen.render();
  setTimeout(() => {
    screen.destroy();
    process.exit(0);
  }, 100);
}

// ─── Command Submission ─────────────────────────────────────────────────────

commandInput.on('submit', (value) => {
  const input = (value || '').trim();
  commandInput.clearValue();

  // ── INSTANT FEEDBACK: log the raw input FIRST, before ANY logic ──
  if (input) {
    appendLog(`{bold}{white-fg}> ${blessed.escape(input)}{/white-fg}{/bold}`);
  }

  // Re-enter reading mode on next tick (after blessed's internal _done cleanup)
  process.nextTick(() => {
    commandInput.readInput();
    screen.render();
  });

  if (!input) return;

  // Built-in commands
  if (input === '/quit' || input === '/exit') {
    cleanup();
    return;
  }

  if (input === '/clear') {
    logLines.length = 0;
    logBox.setContent('');
    appendLog('{yellow-fg}Log cleared.{/yellow-fg}');
    screen.render();
    return;
  }

  if (input === '/help') {
    appendLog('{cyan-fg}──── Available Commands ────{/cyan-fg}');
    appendLog('{white-fg}  /clear   — Clear the execution log{/white-fg}');
    appendLog('{white-fg}  /help    — Show this help message{/white-fg}');
    appendLog('{white-fg}  /quit    — Exit the dashboard{/white-fg}');
    appendLog('{white-fg}  <text>   — Send to QueryEngine endpoint{/white-fg}');
    appendLog('{cyan-fg}────────────────────────────{/cyan-fg}');
    screen.render();
    return;
  }

  // Send to QueryEngine
  appendLog('{yellow-fg}Processing...{/yellow-fg}');
  screen.render();

  QueryEngine.run(input).then((response) => {
    const lines = response.split('\n');
    for (const line of lines) {
      appendLog(`{green-fg}  ${blessed.escape(line)}{/green-fg}`);
    }
    updateMetrics();
    screen.render();
  });
});

// Re-focus input when cancel (e.g., pressing Escape inside textbox)
commandInput.on('cancel', () => {
  process.nextTick(() => {
    commandInput.readInput();
    screen.render();
  });
});

// ─── Resize Handling ────────────────────────────────────────────────────────

screen.on('resize', () => {
  screen.render();
});

// ─── Initialize ─────────────────────────────────────────────────────────────

updateSystemStatus();
updateMetrics();

// Refresh system status every 5 seconds
setInterval(() => {
  updateSystemStatus();
  screen.render();
}, 5000);

// Welcome messages
const mode = (process.env.ENDPOINT_MODE || 'openai').toLowerCase();
appendLog('{bold}{cyan-fg}╔══════════════════════════════════════════════════╗{/cyan-fg}{/bold}');
appendLog('{bold}{cyan-fg}║  GEAR / TONIDOBOT Dashboard v1.0                ║{/cyan-fg}{/bold}');
appendLog('{bold}{cyan-fg}║  Type a command and press Enter to execute.      ║{/cyan-fg}{/bold}');
appendLog('{bold}{cyan-fg}║  Type /help for available commands.              ║{/cyan-fg}{/bold}');
appendLog('{bold}{cyan-fg}╚══════════════════════════════════════════════════╝{/cyan-fg}{/bold}');
appendLog(`{white-fg}Endpoint: {yellow-fg}${process.env.BASE_URL}{/yellow-fg} (mode: {cyan-fg}${mode}{/cyan-fg}){/white-fg}`);

// Focus the command input and enter reading mode
commandInput.focus();
commandInput.readInput();
screen.render();

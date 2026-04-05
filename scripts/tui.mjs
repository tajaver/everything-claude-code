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

// ─── QueryEngine ────────────────────────────────────────────────────────────

const QueryEngine = {
  metrics: { count: 0, successes: 0, failures: 0, totalTime: 0 },

  async run(input) {
    const start = Date.now();
    this.metrics.count++;

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (process.env.API_KEY) {
        headers['Authorization'] = `Bearer ${process.env.API_KEY}`;
      }

      const res = await fetch(`${process.env.BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: process.env.MODEL || 'default',
          messages: [{ role: 'user', content: input }]
        })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || JSON.stringify(data);

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

function updateSystemStatus() {
  const used = Math.round((os.totalmem() - os.freemem()) / 1048576);
  const total = Math.round(os.totalmem() / 1048576);
  statusBox.setContent(
    '{bold}{white-fg}' +
    `  Uptime:    {green-fg}${formatUptime(os.uptime())}{/green-fg}\n` +
    `  Node:      {green-fg}${process.version}{/green-fg}\n` +
    `  Platform:  {green-fg}${os.platform()} ${os.arch()}{/green-fg}\n` +
    `  Memory:    {green-fg}${used}MB / ${total}MB{/green-fg}\n` +
    `  Load Avg:  {green-fg}${os.loadavg().map(n => n.toFixed(2)).join(', ')}{/green-fg}\n` +
    `  CPUs:      {green-fg}${os.cpus().length}{/green-fg}` +
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

// ─── Tool Execution Log ─────────────────────────────────────────────────────

const log = blessed.log({
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
  keys: true,
  vi: true,
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
  log.log(`{white-fg}[${timestamp()}]{/white-fg} ${text}`);
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
  if (!inputFocused) {
    cleanup();
  }
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

// Escape — quit only when input is NOT focused (so typing Escape doesn't kill the app)
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
    log.setContent('');
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
  appendLog(`{bold}{white-fg}> ${blessed.escape(input)}{/white-fg}{/bold}`);
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
appendLog('{bold}{cyan-fg}╔══════════════════════════════════════════════════╗{/cyan-fg}{/bold}');
appendLog('{bold}{cyan-fg}║  GEAR / TONIDOBOT Dashboard v1.0                ║{/cyan-fg}{/bold}');
appendLog('{bold}{cyan-fg}║  Type a command and press Enter to execute.      ║{/cyan-fg}{/bold}');
appendLog('{bold}{cyan-fg}║  Type /help for available commands.              ║{/cyan-fg}{/bold}');
appendLog('{bold}{cyan-fg}╚══════════════════════════════════════════════════╝{/cyan-fg}{/bold}');

// Focus the command input and enter reading mode
commandInput.focus();
commandInput.readInput();
screen.render();

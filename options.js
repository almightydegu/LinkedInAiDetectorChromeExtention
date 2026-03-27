// options.js

// ── API Key ───────────────────────────────────────────────────────────────────

const apiKeyInput = document.getElementById('apiKey');
const toggleBtn   = document.getElementById('toggleBtn');
const saveBtn     = document.getElementById('saveBtn');
const statusEl    = document.getElementById('status');

chrome.storage.sync.get(['claudeApiKey'], ({ claudeApiKey }) => {
  if (claudeApiKey) apiKeyInput.value = claudeApiKey;
});

toggleBtn.addEventListener('click', () => {
  const isHidden = apiKeyInput.type === 'password';
  apiKeyInput.type = isHidden ? 'text' : 'password';
  toggleBtn.textContent = isHidden ? 'Hide' : 'Show';
});

saveBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (!key) { showStatus(statusEl, 'Please enter an API key.', 'err'); return; }
  if (!key.startsWith('sk-ant-')) { showStatus(statusEl, 'Key should start with "sk-ant-" — double-check it.', 'err'); return; }
  chrome.storage.sync.set({ claudeApiKey: key }, () => showStatus(statusEl, 'API key saved!', 'ok'));
});

// ── Display Settings ──────────────────────────────────────────────────────────

const showPercentageToggle = document.getElementById('showPercentage');
const pctToggleLabel       = document.getElementById('pctToggleLabel');
const saveDisplayBtn       = document.getElementById('saveDisplayBtn');
const displayStatusEl      = document.getElementById('displayStatus');

// Load saved display settings
chrome.storage.sync.get(['colorMode', 'showPercentage'], (result) => {
  const mode = result.colorMode || 'sentiment';
  document.querySelector(`input[name="colorMode"][value="${mode}"]`).checked = true;

  const showPct = result.showPercentage !== undefined ? result.showPercentage : true;
  showPercentageToggle.checked = showPct;
  updatePctLabel(showPct);
});

showPercentageToggle.addEventListener('change', () => {
  updatePctLabel(showPercentageToggle.checked);
});

saveDisplayBtn.addEventListener('click', () => {
  const colorMode      = document.querySelector('input[name="colorMode"]:checked')?.value || 'sentiment';
  const showPercentage = showPercentageToggle.checked;
  chrome.storage.sync.set({ colorMode, showPercentage }, () => {
    showStatus(displayStatusEl, 'Display settings saved!', 'ok');
  });
});

function updatePctLabel(checked) {
  pctToggleLabel.textContent = checked ? 'Show percentage' : 'Hide percentage';
}

// ── Shared ────────────────────────────────────────────────────────────────────

function showStatus(el, msg, type) {
  el.textContent = msg;
  el.className = `status ${type}`;
  if (type === 'ok') setTimeout(() => { el.textContent = ''; el.className = 'status'; }, 3000);
}

// options.js

const apiKeyInput      = document.getElementById('apiKey');
const toggleBtn        = document.getElementById('toggleBtn');
const saveBtn          = document.getElementById('saveBtn');
const statusEl         = document.getElementById('status');

const showPctToggle       = document.getElementById('showPercentage');
const pctToggleLabel      = document.getElementById('pctToggleLabel');
const analyzeCommentsToggle = document.getElementById('analyzeComments');
const commentsToggleLabel = document.getElementById('commentsToggleLabel');
const saveDisplayBtn      = document.getElementById('saveDisplayBtn');
const displayStatusEl     = document.getElementById('displayStatus');

// ── Load all settings in one batched read ─────────────────────────────────────

chrome.storage.sync.get(['claudeApiKey', 'colorMode', 'showPercentage', 'analyzeComments'], (result) => {
  // API key
  if (result.claudeApiKey) apiKeyInput.value = result.claudeApiKey;

  // Colour mode — default to 'sentiment'
  const mode = result.colorMode || 'sentiment';
  const modeRadio = document.querySelector(`input[name="colorMode"][value="${mode}"]`);
  if (modeRadio) modeRadio.checked = true;

  // Show percentage — default to true
  const showPct = result.showPercentage !== undefined ? result.showPercentage : true;
  showPctToggle.checked = showPct;
  updatePctLabel(showPct);

  // Analyse comments — default to false
  const analyzeComments = result.analyzeComments !== undefined ? result.analyzeComments : false;
  analyzeCommentsToggle.checked = analyzeComments;
  updateCommentsLabel(analyzeComments);
});

// ── API key ───────────────────────────────────────────────────────────────────

toggleBtn.addEventListener('click', () => {
  const hidden = apiKeyInput.type === 'password';
  apiKeyInput.type = hidden ? 'text' : 'password';
  toggleBtn.textContent = hidden ? 'Hide' : 'Show';
});

saveBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    showStatus(statusEl, 'Please enter an API key.', 'err');
    return;
  }
  if (!key.startsWith('sk-ant-')) {
    showStatus(statusEl, 'Key should start with "sk-ant-" — double-check it.', 'err');
    return;
  }
  chrome.storage.sync.set({ claudeApiKey: key }, () => {
    showStatus(statusEl, 'API key saved!', 'ok');
  });
});

// ── Display settings ──────────────────────────────────────────────────────────

showPctToggle.addEventListener('change', () => updatePctLabel(showPctToggle.checked));
analyzeCommentsToggle.addEventListener('change', () => updateCommentsLabel(analyzeCommentsToggle.checked));

saveDisplayBtn.addEventListener('click', () => {
  const colorMode       = document.querySelector('input[name="colorMode"]:checked')?.value || 'sentiment';
  const showPercentage  = showPctToggle.checked;
  const analyzeComments = analyzeCommentsToggle.checked;
  chrome.storage.sync.set({ colorMode, showPercentage, analyzeComments }, () => {
    showStatus(displayStatusEl, 'Display settings saved!', 'ok');
  });
});

// ── Shared helpers ────────────────────────────────────────────────────────────

function updatePctLabel(checked) {
  pctToggleLabel.textContent = checked ? 'Show percentage' : 'Hide percentage';
}

function updateCommentsLabel(checked) {
  commentsToggleLabel.textContent = checked ? 'Comment analysis on' : 'Comment analysis off';
}

function showStatus(el, msg, type) {
  el.textContent = msg;
  el.className = `status ${type}`;
  if (type === 'ok') {
    setTimeout(() => { el.textContent = ''; el.className = 'status'; }, 3000);
  }
}

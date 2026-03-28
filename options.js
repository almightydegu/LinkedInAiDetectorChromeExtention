// options.js

const apiKeyInput      = document.getElementById('apiKey');
const toggleBtn        = document.getElementById('toggleBtn');
const saveBtn          = document.getElementById('saveBtn');
const statusEl         = document.getElementById('status');

const showPctToggle         = document.getElementById('showPercentage');
const pctToggleLabel        = document.getElementById('pctToggleLabel');
const minPostLengthInput    = document.getElementById('minPostLength');
const minCommentLengthInput = document.getElementById('minCommentLength');
const saveDisplayBtn        = document.getElementById('saveDisplayBtn');
const displayStatusEl       = document.getElementById('displayStatus');

// ── Load all settings in one batched read ─────────────────────────────────────

chrome.storage.sync.get(['claudeApiKey', 'colorMode', 'showPercentage', 'postMode', 'commentMode', 'minPostLength', 'minCommentLength'], (result) => {
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

  // Posts mode — default to 'auto'
  const postMode = result.postMode || 'auto';
  const postModeRadio = document.querySelector(`input[name="postMode"][value="${postMode}"]`);
  if (postModeRadio) postModeRadio.checked = true;

  // Comments mode — default to 'off'
  const commentMode = result.commentMode || 'off';
  const commentModeRadio = document.querySelector(`input[name="commentMode"][value="${commentMode}"]`);
  if (commentModeRadio) commentModeRadio.checked = true;

  // Min lengths — defaults match content.js constants
  minPostLengthInput.value    = result.minPostLength    ?? 80;
  minCommentLengthInput.value = result.minCommentLength ?? 100;
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

saveDisplayBtn.addEventListener('click', () => {
  const colorMode        = document.querySelector('input[name="colorMode"]:checked')?.value || 'sentiment';
  const showPercentage   = showPctToggle.checked;
  const postMode         = document.querySelector('input[name="postMode"]:checked')?.value || 'auto';
  const commentMode      = document.querySelector('input[name="commentMode"]:checked')?.value || 'off';
  const minPostLength    = Math.max(10, parseInt(minPostLengthInput.value, 10)    || 80);
  const minCommentLength = Math.max(10, parseInt(minCommentLengthInput.value, 10) || 100);
  // Reflect clamped values back to the inputs
  minPostLengthInput.value    = minPostLength;
  minCommentLengthInput.value = minCommentLength;
  chrome.storage.sync.set({ colorMode, showPercentage, postMode, commentMode, minPostLength, minCommentLength }, () => {
    showStatus(displayStatusEl, 'Display settings saved!', 'ok');
  });
});

// ── Shared helpers ────────────────────────────────────────────────────────────

function updatePctLabel(checked) {
  pctToggleLabel.textContent = checked ? 'Show percentage' : 'Hide percentage';
}

function showStatus(el, msg, type) {
  el.textContent = msg;
  el.className = `status ${type}`;
  if (type === 'ok') {
    setTimeout(() => { el.textContent = ''; el.className = 'status'; }, 3000);
  }
}

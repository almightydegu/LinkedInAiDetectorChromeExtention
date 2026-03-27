// options.js

const apiKeyInput = document.getElementById('apiKey');
const toggleBtn   = document.getElementById('toggleBtn');
const saveBtn     = document.getElementById('saveBtn');
const statusEl    = document.getElementById('status');

// Load saved key on open
chrome.storage.sync.get(['claudeApiKey'], ({ claudeApiKey }) => {
  if (claudeApiKey) {
    apiKeyInput.value = claudeApiKey;
  }
});

// Show / hide toggle
toggleBtn.addEventListener('click', () => {
  const isHidden = apiKeyInput.type === 'password';
  apiKeyInput.type = isHidden ? 'text' : 'password';
  toggleBtn.textContent = isHidden ? 'Hide' : 'Show';
});

// Save
saveBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();

  if (!key) {
    showStatus('Please enter an API key.', 'err');
    return;
  }

  if (!key.startsWith('sk-ant-')) {
    showStatus('Key should start with "sk-ant-" — double-check it.', 'err');
    return;
  }

  chrome.storage.sync.set({ claudeApiKey: key }, () => {
    showStatus('API key saved!', 'ok');
  });
});

function showStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = `status ${type}`;
  if (type === 'ok') {
    setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'status'; }, 3000);
  }
}

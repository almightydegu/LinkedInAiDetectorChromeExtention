// popup.js

const statusRow  = document.getElementById('statusRow');
const statusText = document.getElementById('statusText');
const settingsBtn = document.getElementById('settingsBtn');

settingsBtn.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

chrome.storage.sync.get(['claudeApiKey'], ({ claudeApiKey }) => {
  if (claudeApiKey) {
    statusRow.className = 'status-row ok';
    statusRow.querySelector('.dot').className = 'dot green';
    statusText.textContent = 'API key configured — detection active';
  } else {
    statusRow.className = 'status-row warn';
    statusRow.querySelector('.dot').className = 'dot yellow';
    statusText.textContent = 'No API key — open Settings to add one';
  }
});

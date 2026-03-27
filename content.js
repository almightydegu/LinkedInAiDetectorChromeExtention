// content.js — Injected into LinkedIn pages

const PROCESSED_ATTR = 'data-ai-detector-done';
const BADGE_CLASS = 'ai-detector-badge';

// ── SVG Icons ────────────────────────────────────────────────────────────────

const ROBOT_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
  <rect x="7" y="11" width="10" height="9" rx="2"/>
  <rect x="9" y="6.5" width="6" height="5" rx="1"/>
  <circle cx="10" cy="15.5" r="1.2"/>
  <circle cx="14" cy="15.5" r="1.2"/>
  <rect x="10.5" y="18" width="3" height="1" rx="0.5"/>
  <line x1="12" y1="6.5" x2="12" y2="4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="12" cy="3.8" r="1"/>
  <rect x="5" y="13" width="2" height="4" rx="1"/>
  <rect x="17" y="13" width="2" height="4" rx="1"/>
</svg>`;

const HUMAN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
  <circle cx="12" cy="7" r="4"/>
  <path d="M4 21v-1a8 8 0 0 1 16 0v1" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
</svg>`;

const LOADING_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" class="ai-spin" aria-label="Analysing…">
  <circle cx="12" cy="12" r="9" stroke-opacity="0.25"/>
  <path d="M12 3a9 9 0 0 1 9 9" stroke-linecap="round"/>
</svg>`;

// ── Score mapping ─────────────────────────────────────────────────────────────

function scoreLevel(score) {
  if (score <= 20) return { robots: 0, color: '#16a34a', label: 'Human written' };
  if (score <= 40) return { robots: 1, color: '#65a30d', label: 'Likely human' };
  if (score <= 60) return { robots: 2, color: '#d97706', label: 'Uncertain' };
  if (score <= 80) return { robots: 3, color: '#ea580c', label: 'Likely AI' };
  if (score <= 90) return { robots: 4, color: '#dc2626', label: 'Mostly AI' };
  return                { robots: 5, color: '#b91c1c', label: 'AI written' };
}

function buildIcons(score) {
  const { robots, color } = scoreLevel(score);
  const humans = 5 - robots;
  let html = '';
  for (let i = 0; i < robots; i++) {
    html += `<span class="ai-icon" style="color:${color}" title="AI indicator">${ROBOT_SVG}</span>`;
  }
  for (let i = 0; i < humans; i++) {
    html += `<span class="ai-icon ai-icon-human" title="Human indicator">${HUMAN_SVG}</span>`;
  }
  return html;
}

// ── Badge factory ─────────────────────────────────────────────────────────────

function makeBadge(state, data = {}) {
  const wrap = document.createElement('div');
  wrap.className = BADGE_CLASS;

  switch (state) {
    case 'loading':
      wrap.innerHTML = `
        <div class="aid-inner aid-loading">
          <span class="aid-spinner">${LOADING_SVG}</span>
          <span class="aid-text">Analysing post…</span>
        </div>`;
      break;

    case 'score': {
      const { score, reason } = data;
      const { label, color } = scoreLevel(score);
      wrap.innerHTML = `
        <div class="aid-inner" title="${score}% AI probability — ${reason}">
          <div class="aid-icons">${buildIcons(score)}</div>
          <span class="aid-text" style="color:${color}">${label} <span class="aid-pct">(${score}%)</span></span>
        </div>`;
      break;
    }

    case 'no-key':
      wrap.innerHTML = `
        <div class="aid-inner aid-warn">
          <span class="aid-text">⚠ Add your Claude API key in extension settings to enable AI detection</span>
        </div>`;
      break;

    case 'short':
      // Silent — don't clutter UI for very short posts
      return null;

    case 'error':
      wrap.innerHTML = `
        <div class="aid-inner aid-err">
          <span class="aid-text">⚠ ${data.message || 'Analysis failed'}</span>
        </div>`;
      break;
  }

  return wrap;
}

// ── Post text extraction ──────────────────────────────────────────────────────

function extractText(post) {
  const candidates = [
    '.feed-shared-text .break-words',
    '.feed-shared-text',
    '.update-components-text .break-words',
    '.update-components-text',
    '.feed-shared-text-view',
    '[data-test-id="main-feed-activity-card__commentary"]',
    '.attributed-text-segment-list__content',
  ];

  for (const sel of candidates) {
    const nodes = post.querySelectorAll(sel);
    if (!nodes.length) continue;
    const text = Array.from(nodes).map(n => n.textContent).join(' ').trim();
    if (text.length > 0) return text;
  }
  return null;
}

// ── Insertion point ───────────────────────────────────────────────────────────

function insertionPoint(post) {
  const slots = [
    '.update-components-actor__meta-link',
    '.update-components-actor',
    '.feed-shared-actor',
    '.feed-shared-update-v2__description-wrapper',
  ];
  for (const sel of slots) {
    const el = post.querySelector(sel);
    if (el) return el;
  }
  return post;
}

// ── Core processing ───────────────────────────────────────────────────────────

async function processPost(post) {
  if (post.hasAttribute(PROCESSED_ATTR)) return;
  post.setAttribute(PROCESSED_ATTR, 'true');

  const text = extractText(post);

  // Skip posts with no meaningful text
  if (!text || text.length < 80) return;

  const anchor = insertionPoint(post);
  const loading = makeBadge('loading');
  anchor.insertAdjacentElement('afterend', loading);

  try {
    const result = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'analyzePost', text }, (response) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        if (!response) return reject(new Error('No response'));
        if (!response.success) return reject(new Error(response.error || 'Unknown error'));
        resolve(response);
      });
    });

    const badge = makeBadge('score', result);
    loading.replaceWith(badge);
  } catch (err) {
    let badge;
    if (err.message === 'NO_API_KEY') {
      badge = makeBadge('no-key');
    } else {
      badge = makeBadge('error', { message: err.message });
    }
    loading.replaceWith(badge);
  }
}

// ── Observers ─────────────────────────────────────────────────────────────────

const POST_SELECTORS = [
  '.feed-shared-update-v2',
  '.occludable-update',
];

const visibilityObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      visibilityObserver.unobserve(entry.target);
      processPost(entry.target);
    }
  }
}, { threshold: 0.1 });

function schedulePost(el) {
  if (!el.hasAttribute(PROCESSED_ATTR)) {
    visibilityObserver.observe(el);
  }
}

function scanForPosts(root = document) {
  for (const sel of POST_SELECTORS) {
    root.querySelectorAll(sel).forEach(schedulePost);
  }
}

const domObserver = new MutationObserver((mutations) => {
  for (const mut of mutations) {
    for (const node of mut.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      for (const sel of POST_SELECTORS) {
        if (node.matches?.(sel)) schedulePost(node);
        node.querySelectorAll?.(sel).forEach(schedulePost);
      }
    }
  }
});

function init() {
  scanForPosts();
  domObserver.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

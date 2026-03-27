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

// ── Post detection ────────────────────────────────────────────────────────────
// LinkedIn now uses hashed CSS class names that change with every deploy.
// The only stable hooks are data-testid="mainFeed" (the feed wrapper) and
// the aria-label on the per-post control-menu button.

function getFeedPosts() {
  const feed = document.querySelector('[data-testid="mainFeed"]');
  if (!feed) return [];
  return Array.from(feed.children).filter(child =>
    child.querySelector('[aria-label*="control menu for post"]') ||
    child.querySelector('[aria-label*="menu for post"]')
  );
}

// ── Post text extraction ──────────────────────────────────────────────────────
// Class names are hashed, so we find the element with the most direct text
// content — that's reliably the post body.

function extractText(post) {
  let bestText = '';
  post.querySelectorAll('span, p, div').forEach(el => {
    // Only count text that belongs directly to this element (not children)
    const directText = Array.from(el.childNodes)
      .filter(n => n.nodeType === Node.TEXT_NODE)
      .map(n => n.textContent.trim())
      .join(' ')
      .trim();
    if (directText.length > bestText.length) {
      bestText = directText;
    }
  });
  return bestText.length >= 80 ? bestText : null;
}

// ── Insertion point ───────────────────────────────────────────────────────────
// Walk up 3 levels from the control-menu button to clear the author header,
// then insert the badge after that ancestor element.

function insertionAnchor(post) {
  const btn = post.querySelector('[aria-label*="control menu for post"]') ||
              post.querySelector('[aria-label*="menu for post"]');
  if (btn) {
    let el = btn;
    for (let i = 0; i < 3; i++) {
      if (!el.parentElement || el.parentElement === post) break;
      el = el.parentElement;
    }
    return el;
  }
  // Fallback: insert at the top of the post container
  return post.firstElementChild || post;
}

// ── Core processing ───────────────────────────────────────────────────────────

async function processPost(post) {
  if (post.hasAttribute(PROCESSED_ATTR)) return;
  post.setAttribute(PROCESSED_ATTR, 'true');

  const text = extractText(post);
  if (!text) return; // too short or no text found

  const anchor = insertionAnchor(post);
  const loading = makeBadge('loading');
  anchor.insertAdjacentElement('afterend', loading);

  try {
    const result = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'analyzePost', text }, (response) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        if (!response) return reject(new Error('No response from background'));
        if (!response.success) return reject(new Error(response.error || 'Unknown error'));
        resolve(response);
      });
    });

    loading.replaceWith(makeBadge('score', result));
  } catch (err) {
    loading.replaceWith(
      err.message === 'NO_API_KEY'
        ? makeBadge('no-key')
        : makeBadge('error', { message: err.message })
    );
  }
}

// ── Observers ─────────────────────────────────────────────────────────────────
// Note: IntersectionObserver cannot be used here because LinkedIn's post
// containers have display:contents (data-display-contents="true"), which means
// they have no layout box and intersection events never fire on them.
// Posts are added to the DOM as the user scrolls, so processing on discovery
// is equivalent to processing on visibility.

function schedulePost(el) {
  if (!el.hasAttribute(PROCESSED_ATTR)) {
    processPost(el);
  }
}

// Watch for new posts added to the feed as the user scrolls
const domObserver = new MutationObserver(() => {
  getFeedPosts().forEach(schedulePost);
});

function init() {
  console.log('[AI Detector] v1.0.4 loaded');
  getFeedPosts().forEach(schedulePost);
  domObserver.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// content.js — Injected into LinkedIn pages

const PROCESSED_ATTR         = 'data-ai-detector-done';
const COMMENT_PROCESSED_ATTR = 'data-ai-comment-done';
const BADGE_CLASS            = 'ai-detector-badge';
const MIN_TEXT_LENGTH        = 80;
const MIN_COMMENT_LENGTH     = 100;

// ── Analysis cache ────────────────────────────────────────────────────────────
// LinkedIn re-renders its post/comment containers, stripping any injected DOM
// attributes. The cache lets us re-inject badges instantly from a stored result
// without making a repeat API call, and prevents duplicate in-flight requests.

const analysisCache = new Map(); // textKey → cached result object
const pendingKeys   = new Set(); // textKeys currently awaiting an API response

function textKey(text) {
  // First 100 chars + total length is a fast, collision-resistant key
  return `${text.length}:${text.slice(0, 100)}`;
}

// Selector for the per-post options button — the only stable DOM anchor
// LinkedIn exposes after switching to hashed class names.
const MENU_BTN_SELECTOR         = '[aria-label*="control menu for post"], [aria-label*="menu for post"]';
const COMMENT_MENU_BTN_SELECTOR = '[aria-label*="View more options for"][aria-label*="comment"]';

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

// ── Settings (loaded before any posts are processed) ──────────────────────────

const settings = { colorMode: 'sentiment', showPercentage: true, analyzeComments: false };

// ── Helpers ───────────────────────────────────────────────────────────────────

// Prevent XSS when inserting API-sourced strings into HTML attributes or text.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Score mapping ─────────────────────────────────────────────────────────────

const NEUTRAL_COLOR = '#94a3b8'; // slate-400
const HUMAN_COLOR   = '#16a34a'; // green-600

const SCORE_LEVELS = [
  { max: 20,  robots: 0, color: '#16a34a', label: 'Human written' },
  { max: 40,  robots: 1, color: '#65a30d', label: 'Likely human'  },
  { max: 60,  robots: 2, color: '#d97706', label: 'Uncertain'     },
  { max: 80,  robots: 3, color: '#ea580c', label: 'Likely AI'     },
  { max: 90,  robots: 4, color: '#dc2626', label: 'Mostly AI'     },
  { max: 100, robots: 5, color: '#b91c1c', label: 'AI written'    },
];

function scoreLevel(score) {
  return SCORE_LEVELS.find(l => score <= l.max) ?? SCORE_LEVELS.at(-1);
}

function buildIcons(score) {
  const { robots, color: sentimentColor } = scoreLevel(score);
  const neutral    = settings.colorMode === 'neutral';
  const robotColor = neutral ? NEUTRAL_COLOR : sentimentColor;
  const humanColor = neutral ? NEUTRAL_COLOR : HUMAN_COLOR;
  const humans     = 5 - robots;

  const robotIcons = Array.from({ length: robots }, () =>
    `<span class="ai-icon" style="color:${robotColor}" title="AI indicator">${ROBOT_SVG}</span>`
  ).join('');

  const humanIcons = Array.from({ length: humans }, () =>
    `<span class="ai-icon" style="color:${humanColor}" title="Human indicator">${HUMAN_SVG}</span>`
  ).join('');

  return robotIcons + humanIcons;
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
      const { label, color }  = scoreLevel(score);
      const neutral    = settings.colorMode === 'neutral';
      const labelColor = neutral ? '#64748b' : color;
      const pct        = settings.showPercentage
        ? ` <span class="aid-pct">(${score}%)</span>`
        : '';
      // escapeHtml guards against any special chars in the API-sourced reason string
      wrap.innerHTML = `
        <div class="aid-inner" title="${score}% AI probability — ${escapeHtml(reason)}">
          <div class="aid-icons">${buildIcons(score)}</div>
          <span class="aid-text" style="color:${labelColor}">${label}${pct}</span>
        </div>`;
      break;
    }

    case 'no-key':
      wrap.innerHTML = `
        <div class="aid-inner aid-warn">
          <span class="aid-text">⚠ Add your Claude API key in extension settings to enable AI detection</span>
        </div>`;
      break;

    case 'error':
      wrap.innerHTML = `
        <div class="aid-inner aid-err">
          <span class="aid-text">⚠ ${escapeHtml(data.message || 'Analysis failed')}</span>
        </div>`;
      break;
  }

  return wrap;
}

// ── Post detection ────────────────────────────────────────────────────────────
// LinkedIn uses hashed CSS class names that change with every deploy.
// We identify posts as direct children of [data-testid="mainFeed"] that
// contain the per-post options button (the only stable aria-label available).

function getFeedPosts() {
  const feed = document.querySelector('[data-testid="mainFeed"]');
  if (!feed) return [];
  return Array.from(feed.children).filter(child =>
    child.querySelector(MENU_BTN_SELECTOR)
  );
}

// ── Comment detection ─────────────────────────────────────────────────────────
// Each individual comment container has a data-testid containing "commentList".
// The options button (three-dot menu) is rendered lazily on hover, so we cannot
// rely on it for discovery. The Like | Reply action bar is always in the DOM
// as soon as the comment renders, so we use the reply button as the primary
// anchor. The options button is kept as a secondary check.

const COMMENT_REPLY_SELECTOR = '[aria-label*="Reply to"], [aria-label*="reply to"]';

function getComments() {
  const seen    = new Set();
  const results = [];

  function walkToCommentList(startEl) {
    let el = startEl;
    while (el.parentElement) {
      el = el.parentElement;
      const testid = el.getAttribute('data-testid');
      if (testid && testid.includes('commentList')) {
        if (!seen.has(el)) { seen.add(el); results.push(el); }
        break;
      }
    }
  }

  // Primary: reply buttons — always present once a comment is rendered
  document.querySelectorAll(COMMENT_REPLY_SELECTOR).forEach(walkToCommentList);
  // Secondary: options buttons — present for eagerly rendered comments
  document.querySelectorAll(COMMENT_MENU_BTN_SELECTOR).forEach(walkToCommentList);

  return results;
}

// ── Post text extraction ──────────────────────────────────────────────────────
// Class names are hashed so we find the element whose direct text nodes
// contain the most content — that's reliably the post body.

function extractText(post) {
  let bestText = '';
  post.querySelectorAll('span, p, div').forEach(el => {
    const directText = Array.from(el.childNodes)
      .filter(n => n.nodeType === Node.TEXT_NODE)
      .map(n => n.textContent.trim())
      .join(' ')
      .trim();
    if (directText.length > bestText.length) bestText = directText;
  });
  return bestText.length >= MIN_TEXT_LENGTH ? bestText : null;
}

// ── Insertion points ──────────────────────────────────────────────────────────
// Posts: walk 3 levels up from the options button to clear the author header,
//        insert after that ancestor element.
// Comments: the first direct child is always the author header block —
//           insert after it so the badge sits between author info and text.

function insertionAnchor(post) {
  const btn = post.querySelector(MENU_BTN_SELECTOR);
  if (!btn) return post.firstElementChild ?? post;

  let el = btn;
  for (let i = 0; i < 3; i++) {
    if (!el.parentElement || el.parentElement === post) break;
    el = el.parentElement;
  }
  return el;
}

function commentInsertionAnchor(comment) {
  // Preferred: locate the Like | Reply action bar via the reply button and
  // return it so the badge is inserted right after it — visually adjacent to
  // the reaction/reply controls, not above the comment text.
  const replyBtn = comment.querySelector('[aria-label*="Reply to"], [aria-label*="reply to"]');
  if (replyBtn) {
    let el = replyBtn;
    while (el.parentElement && el.parentElement !== comment) el = el.parentElement;
    return el; // direct child = action bar row; badge goes after it
  }

  // Fallback: walk up from options button to a direct child of the container
  const btn = comment.querySelector(COMMENT_MENU_BTN_SELECTOR);
  if (!btn) return comment.firstElementChild ?? comment;
  let el = btn;
  while (el.parentElement && el.parentElement !== comment) el = el.parentElement;
  return el;
}

// ── Core processing ───────────────────────────────────────────────────────────
// processItem handles both posts and comments. The analysisCache means:
//   - Re-rendered elements get their badge re-injected instantly from cache
//   - Two elements with identical text don't trigger duplicate API calls

async function processItem(element, processedAttr, anchorFn, minLength) {
  if (element.hasAttribute(processedAttr)) return;
  element.setAttribute(processedAttr, 'true');

  const text = extractText(element);
  if (!text || text.length < minLength) return;

  const key    = textKey(text);
  const anchor = anchorFn(element);

  // Re-render hit: inject from cache immediately, no API call needed
  if (analysisCache.has(key)) {
    const cached = analysisCache.get(key);
    anchor.insertAdjacentElement('afterend', badgeFromCached(cached));
    return;
  }

  // Duplicate in-flight: another element with the same text is already being
  // analysed — skip rather than fire a second identical API request
  if (pendingKeys.has(key)) return;
  pendingKeys.add(key);

  const loading = makeBadge('loading');
  anchor.insertAdjacentElement('afterend', loading);

  try {
    const result = await sendToBackground(text);
    analysisCache.set(key, { ok: true, score: result.score, reason: result.reason });
    loading.replaceWith(makeBadge('score', result));
  } catch (err) {
    analysisCache.set(key, { ok: false, message: err.message });
    loading.replaceWith(
      err.message === 'NO_API_KEY'
        ? makeBadge('no-key')
        : makeBadge('error', { message: err.message })
    );
  } finally {
    pendingKeys.delete(key);
  }
}

function badgeFromCached(cached) {
  if (!cached.ok) {
    return cached.message === 'NO_API_KEY'
      ? makeBadge('no-key')
      : makeBadge('error', { message: cached.message });
  }
  return makeBadge('score', { score: cached.score, reason: cached.reason });
}

function processPost(post) {
  return processItem(post, PROCESSED_ATTR, insertionAnchor, MIN_TEXT_LENGTH);
}

function processComment(comment) {
  return processItem(comment, COMMENT_PROCESSED_ATTR, commentInsertionAnchor, MIN_COMMENT_LENGTH);
}

function sendToBackground(text) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'analyzePost', text }, (response) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      if (!response)          return reject(new Error('No response from background'));
      if (!response.success)  return reject(new Error(response.error || 'Unknown error'));
      resolve(response);
    });
  });
}

// ── Observers ─────────────────────────────────────────────────────────────────
// IntersectionObserver cannot be used: LinkedIn's post containers have
// display:contents so they have no layout box and visibility events never fire.
// Posts are added to the DOM as the user scrolls, so processing on discovery
// is equivalent to processing on visibility.
//
// The MutationObserver is debounced to avoid hammering getFeedPosts on every
// small DOM change (LinkedIn mutates the DOM constantly, including when the
// extension itself inserts badges).

let mutationDebounceTimer = null;
let lateDebounceTimer     = null;

function scanAll() {
  getFeedPosts().forEach(post => {
    if (!post.hasAttribute(PROCESSED_ATTR)) processPost(post);
  });
  if (settings.analyzeComments) {
    getComments().forEach(comment => {
      if (!comment.hasAttribute(COMMENT_PROCESSED_ATTR)) processComment(comment);
    });
  }
}

const domObserver = new MutationObserver(() => {
  // Fast scan: runs 150 ms after the last DOM mutation
  clearTimeout(mutationDebounceTimer);
  mutationDebounceTimer = setTimeout(scanAll, 150);

  // Late scan: runs once, ~800 ms after the first mutation in a burst.
  // Catches comments whose Like|Reply bar was not yet in the DOM when the
  // fast scan fired (e.g. "Load more comments" with slow network/render).
  if (!lateDebounceTimer) {
    lateDebounceTimer = setTimeout(() => {
      lateDebounceTimer = null;
      scanAll();
    }, 800);
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────
// Settings must be loaded before processing begins so the first batch of posts
// renders with the correct colour mode and percentage preference.

function init() {
  console.log('[AI Detector] v1.0.9 loaded');
  chrome.storage.sync.get(['colorMode', 'showPercentage', 'analyzeComments'], (result) => {
    if (result.colorMode !== undefined)       settings.colorMode       = result.colorMode;
    if (result.showPercentage !== undefined)  settings.showPercentage  = result.showPercentage;
    if (result.analyzeComments !== undefined) settings.analyzeComments = result.analyzeComments;

    scanAll();

    // Start observing only after settings are applied
    domObserver.observe(document.body, { childList: true, subtree: true });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

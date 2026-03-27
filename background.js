// background.js — Service worker that handles Claude API calls

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL   = 'claude-haiku-4-5-20251001';
const MAX_TEXT_CHARS = 2500;

// ── API key cache ─────────────────────────────────────────────────────────────
// Fetching from storage on every request adds latency. Cache it and keep in
// sync via the storage.onChanged listener.

let cachedApiKey = null;

chrome.storage.sync.get(['claudeApiKey'], ({ claudeApiKey }) => {
  cachedApiKey = claudeApiKey || null;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.claudeApiKey) {
    cachedApiKey = changes.claudeApiKey.newValue || null;
  }
});

// ── Message handler ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzePost') {
    analyzeWithClaude(request.text)
      .then(result => sendResponse({ success: true, ...result }))
      .catch(err  => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async response
  }
});

// ── Claude API call ───────────────────────────────────────────────────────────

async function analyzeWithClaude(text) {
  if (!cachedApiKey) throw new Error('NO_API_KEY');

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': cachedApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 150,
      messages: [{ role: 'user', content: buildPrompt(text) }],
    }),
  });

  if (!response.ok) {
    let msg = `API error ${response.status}`;
    try { msg = (await response.json()).error?.message || msg; } catch (_) {}
    throw new Error(msg);
  }

  const data = await response.json();
  const raw  = data.content?.[0]?.text?.trim();
  if (!raw) throw new Error('Empty response from Claude');

  return parseClaudeResponse(raw);
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(text) {
  const truncated = text.slice(0, MAX_TEXT_CHARS);
  return `Analyze the following LinkedIn post and determine the likelihood (0–100) that it was written by an AI language model rather than a human.

Focus ONLY on how the post was written (style, tone, structure), NOT on what it is about.

AI writing signals to look for:
- Formulaic openers ("In today's fast-paced world", "It's important to note", "Let's dive in")
- Excessive numbered lists or bullet points with forced parallel structure
- Generic motivational platitudes without personal context
- Perfect grammar with no natural conversational quirks
- Lack of personal anecdotes, specific names, or real experiences
- Overuse of em dashes — like this — or parenthetical asides
- Repetitive sentence structures throughout
- Hollow calls to action ("Drop a comment below!", "What do you think?")
- Overly balanced "on one hand / on the other hand" framing

Human writing signals:
- Personal stories with specific details
- Casual language, contractions, or light informal phrasing
- Genuine emotion or frustration
- Occasional typos or minor grammar quirks
- A distinctive voice or sense of humour
- References to specific events, colleagues, or places

Respond with ONLY a valid JSON object — no markdown, no explanation outside it:
{"score": <integer 0-100>, "reason": "<one concise sentence>"}

score = 0 → definitely human-written
score = 100 → definitely AI-written

LinkedIn post:
"""
${truncated}
"""`;
}

// ── Response parser ───────────────────────────────────────────────────────────

function parseClaudeResponse(raw) {
  let parsed;
  try {
    const clean = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim();
    parsed = JSON.parse(clean);
  } catch (_) {
    throw new Error('Could not parse Claude response');
  }

  const rawScore = Number(parsed.score);
  if (!Number.isFinite(rawScore)) throw new Error('Invalid score in Claude response');

  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  return { score, reason: parsed.reason || '' };
}

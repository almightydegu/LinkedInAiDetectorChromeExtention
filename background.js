// background.js — Service worker that handles Claude API calls

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzePost') {
    analyzeWithClaude(request.text)
      .then(result => sendResponse({ success: true, ...result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async response
  }
});

async function analyzeWithClaude(text) {
  const { claudeApiKey } = await chrome.storage.sync.get(['claudeApiKey']);

  if (!claudeApiKey) {
    throw new Error('NO_API_KEY');
  }

  // Limit to 2500 chars to keep costs low
  const truncated = text.slice(0, 2500);

  const prompt = `Analyze the following LinkedIn post and determine the likelihood (0–100) that it was written by an AI language model rather than a human.

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

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': claudeApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    let msg = `API error ${response.status}`;
    try {
      const err = await response.json();
      msg = err.error?.message || msg;
    } catch (_) {}
    throw new Error(msg);
  }

  const data = await response.json();
  const raw = data.content?.[0]?.text?.trim();

  if (!raw) throw new Error('Empty response from Claude');

  let parsed;
  try {
    // Strip any accidental markdown fences
    const clean = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim();
    parsed = JSON.parse(clean);
  } catch (_) {
    throw new Error('Could not parse Claude response');
  }

  const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score))));
  return { score, reason: parsed.reason || '' };
}

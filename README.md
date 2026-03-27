# LinkedIn AI Detector — Chrome Extension

Analyses LinkedIn posts and scores them on how likely they were **written by an AI** rather than a human.

A row of five icons appears next to each post author:

| Score | Icons | Meaning |
|---|---|---|
| 0–20% | 👤👤👤👤👤 | Human written |
| 21–40% | 🤖👤👤👤👤 | Likely human |
| 41–60% | 🤖🤖👤👤👤 | Uncertain |
| 61–80% | 🤖🤖🤖👤👤 | Likely AI |
| 81–90% | 🤖🤖🤖🤖👤 | Mostly AI |
| 91–100% | 🤖🤖🤖🤖🤖 | AI written |

A spinning loader is shown while the score is being fetched. Hover over the icons to see the exact percentage and a brief reason.

> **Note:** The extension analyses **writing style only**, not the topic. It tells you _how_ the post was written, not _what_ it is about.

---

## Prerequisites

- **Google Chrome** (version 88 or later — Manifest V3 support)
- **Node.js** (version 14 or later) — only needed once, to generate the icons
- A **Claude API key** from Anthropic (free to sign up, very cheap per request)

---

## Installation (local / developer mode)

### Step 1 — Clone the repository

```bash
git clone https://github.com/almightydegu/linkedinaidetectorchromeextention.git
cd linkedinaidetectorchromeextention
```

### Step 2 — Generate the extension icons

The icons are created by a pure-Node.js script (no `npm install` needed):

```bash
node setup.js
```

You should see:

```
Created /path/to/icons/icon16.png
Created /path/to/icons/icon48.png
Created /path/to/icons/icon128.png

All icons generated. You can now load the extension in Chrome.
```

### Step 3 — Load the extension in Chrome

1. Open Chrome and navigate to **chrome://extensions**
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the repository folder (the one containing `manifest.json`)

The extension will appear in your toolbar. If you don't see the icon, click the puzzle-piece icon (Extensions menu) and pin **LinkedIn AI Detector**.

### Step 4 — Add your Claude API key

You need a Claude API key so the extension can call the AI analysis service.

#### Getting a key

1. Visit [console.anthropic.com](https://console.anthropic.com) and create a free account (or sign in).
2. In the left sidebar, click **API Keys**.
3. Click **Create Key**, give it a name like `LinkedIn Detector`, and copy the key (it starts with `sk-ant-`).

#### Saving the key in the extension

1. Click the **LinkedIn AI Detector** icon in your Chrome toolbar.
2. Click **Open Settings**.
3. Paste your API key into the field and click **Save Key**.

You'll see a confirmation message. The key is stored using Chrome's encrypted sync storage — it never leaves your browser except to call Anthropic's API directly.

### Step 5 — Start browsing LinkedIn

Navigate to [linkedin.com/feed](https://www.linkedin.com/feed/).

As posts scroll into view, a loading spinner will appear briefly next to the author's name, followed by the five-icon score.

---

## How it works

1. **Content script** (`content.js`) watches the LinkedIn feed for new posts using a `MutationObserver`. When a post scrolls into view, it extracts the post text.
2. The text is sent to the **background service worker** (`background.js`) via Chrome's messaging API.
3. The background worker calls the **Claude Haiku API** with a carefully crafted prompt asking for an AI-likelihood score (0–100) and a one-sentence reason.
4. The score is returned to the content script, which replaces the loading spinner with the five-icon badge.
5. Results are **not cached between page loads** — each session analyses posts fresh.

### Why Claude Haiku?

Haiku is Anthropic's fastest and cheapest model. It is more than capable of detecting AI writing patterns and keeps the cost per post at roughly **$0.0001** (one hundredth of a cent). A full day of browsing LinkedIn is unlikely to cost more than a few cents.

---

## Privacy

- Your API key is stored locally in Chrome's `storage.sync` (encrypted).
- Post text is sent directly from your browser to `api.anthropic.com` — it does not pass through any third-party server.
- The extension does not collect, log, or transmit any data beyond what is needed for the single API call.

---

## Project structure

```
├── manifest.json      Chrome extension manifest (MV3)
├── background.js      Service worker — handles Claude API calls
├── content.js         Content script — injects score badges into LinkedIn
├── styles.css         CSS for the injected badge UI
├── options.html       Settings page (API key entry + instructions)
├── options.js         Settings page logic
├── popup.html         Toolbar popup
├── popup.js           Popup logic
├── setup.js           One-time icon generator (pure Node.js, no deps)
└── icons/             Generated PNG icons (created by setup.js)
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| No badges appear on posts | Make sure Developer mode is on and the extension is enabled. Check the console (F12 → Console) on a LinkedIn page for errors. |
| "Add your Claude API key" warning | Open the extension popup → Settings and save a valid key. |
| API error in the badge | Your key may be invalid or your Anthropic account may have no credits. Check [console.anthropic.com](https://console.anthropic.com). |
| Score shows on wrong element | LinkedIn updates its HTML frequently. Open a GitHub issue with a screenshot. |
| Icons don't appear in Chrome | Re-run `node setup.js` and reload the extension in chrome://extensions. |

---

## Updating the extension after code changes

1. Edit the source files.
2. Go to **chrome://extensions**.
3. Click the **refresh** icon on the LinkedIn AI Detector card.
4. Reload any open LinkedIn tabs.

---

## Contributing

Pull requests are welcome. Please open an issue first to discuss significant changes.

---

## Licence

MIT

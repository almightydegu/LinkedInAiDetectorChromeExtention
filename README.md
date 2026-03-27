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

## Publishing to browser stores

The extension can be published to three major stores. All three use the same
codebase — no code changes are needed for Chrome or Edge. Firefox requires one
small additional file.

> **Important:** Users must supply their own Claude API key after installing.
> Make this prominent in your store description to avoid confusion and bad reviews.

---

### Preparing the zip file

Before submitting to any store, generate a clean zip from the project root.
Do **not** include `.git`, `setup.js`, or `node_modules` (there are none, but
good habit):

```bash
node setup.js   # regenerate icons if needed

cd ..
zip -r linkedin-ai-detector.zip LinkedInAiDetectorChromeExtention \
  --exclude "*.git*" \
  --exclude "*/setup.js" \
  --exclude "*/.DS_Store" \
  --exclude "*/Thumbs.db"
```

The zip should contain `manifest.json` at its root level when unzipped inside
the project folder. Verify with:

```bash
unzip -l linkedin-ai-detector.zip | head -20
```

---

### Privacy policy (required for all stores)

All three stores require a privacy policy URL because the extension handles an
API key and sends data to a third-party service. Create a simple page (GitHub
Pages, Notion, Google Docs "publish to web") containing at minimum:

```
LinkedIn AI Detector — Privacy Policy

Data collected: None. The extension does not collect or store any personal data.

API key: Stored locally in your browser using Chrome's encrypted storage.
It is only sent directly to api.anthropic.com to analyse post text.
It is never sent to any other server.

Post content: LinkedIn post text is sent to api.anthropic.com for analysis.
It is not logged or stored by this extension.

Third parties: Anthropic's privacy policy applies to data sent to their API:
https://www.anthropic.com/privacy
```

Keep the URL handy — you will need it for all three store submissions.

---

### Chrome Web Store

**One-time setup**

1. Pay the **$5 USD** developer registration fee at
   [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole)
   and complete identity verification.

**Store assets to prepare**

| Asset | Size | Notes |
|---|---|---|
| Extension zip | — | Prepared above |
| Screenshot(s) | 1280×800 or 640×400 | At least one required. Show the badge on a LinkedIn post. |
| Small promo tile | 440×280 px | Optional but strongly recommended |
| Store icon | 128×128 px | Can reuse `icons/icon128.png` |
| Short description | Max 132 chars | One sentence explaining what it does |
| Long description | — | See suggested text below |
| Privacy policy URL | — | Your hosted policy page |

**Suggested short description**
```
Scores LinkedIn posts 1–5 on AI likelihood using Claude. Robots = AI, humans = human. Requires your own Claude API key.
```

**Submission steps**

1. Go to [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole)
2. Click **New Item** and upload the zip file
3. Under **Store listing** fill in the description, screenshots, and promo images
4. Under **Privacy** enter your privacy policy URL and answer the data use questions:
   - *Does your extension collect user data?* → No
   - Justify host permissions: explain that `linkedin.com` is needed to inject
     the badge UI and `api.anthropic.com` is needed to call the Claude API
5. Under **Distribution** set visibility to **Public**
6. Click **Submit for review**

**Review time:** typically 1–3 business days for new items, faster for updates.

**Likely reviewer question:** The header `anthropic-dangerous-direct-browser-access`
sounds alarming. If asked, explain: this is a required header for browser-based
calls to the Anthropic API when end-users supply their own key. Without it the
API rejects browser requests. No user data is collected — the call is made
directly from the user's browser to Anthropic.

---

### Microsoft Edge Add-ons

Edge supports Chrome extensions natively, so **the same zip works unchanged**.

1. Register at [partner.microsoft.com/dashboard](https://partner.microsoft.com/dashboard)
   (free — no registration fee)
2. Click **Extensions** → **Create new extension**
3. Upload the same zip you prepared for Chrome
4. Fill in the store listing (you can reuse the Chrome descriptions)
5. Enter your privacy policy URL
6. Submit — Microsoft review typically takes 1–7 business days

Once approved it will be listed at
`microsoftedge.microsoft.com/addons` and installable by Edge users with one click.

---

### Firefox (Mozilla Add-ons)

Firefox uses **Manifest V3** support that is still maturing, but this extension
works with a small addition. You need to add a `browser_specific_settings` key
to `manifest.json` and submit source code alongside the zip.

**Step 1 — Get a Firefox extension ID**

1. Register at [addons.mozilla.org/developers](https://addons.mozilla.org/en-US/developers/)
   (free)
2. You will be assigned an extension ID like `{xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx}`

**Step 2 — Add Firefox settings to manifest.json**

Open `manifest.json` and add the following block (replace the ID with your own):

```json
"browser_specific_settings": {
  "gecko": {
    "id": "{your-extension-id-here}",
    "strict_min_version": "109.0"
  }
}
```

The full `manifest.json` will look like:

```json
{
  "manifest_version": 3,
  "name": "LinkedIn AI Detector",
  "version": "1.0.5",
  ...
  "browser_specific_settings": {
    "gecko": {
      "id": "{your-extension-id-here}",
      "strict_min_version": "109.0"
    }
  }
}
```

**Step 3 — Create a Firefox-specific zip**

```bash
cd ..
zip -r linkedin-ai-detector-firefox.zip LinkedInAiDetectorChromeExtention \
  --exclude "*.git*" \
  --exclude "*/setup.js"
```

**Step 4 — Create a source code zip (required by Mozilla)**

Mozilla requires you to submit your source code separately so reviewers can
verify the build. Since this extension has no build step the source zip is
identical to the extension zip:

```bash
cp linkedin-ai-detector-firefox.zip linkedin-ai-detector-firefox-source.zip
```

**Step 5 — Submit**

1. Go to [addons.mozilla.org/developers](https://addons.mozilla.org/en-US/developers/)
2. Click **Submit a New Add-on**
3. Choose **On this site** (listed publicly)
4. Upload `linkedin-ai-detector-firefox.zip`
5. When asked for source code, upload `linkedin-ai-detector-firefox-source.zip`
   and add a note: *"No build step — source is identical to the extension package."*
6. Fill in the store listing and privacy policy URL
7. Submit for review

**Review time:** Mozilla review is manual and can take anywhere from a few days
to a few weeks for new submissions.

**Note on Firefox compatibility:** Firefox's implementation of the
`anthropic-dangerous-direct-browser-access` fetch header and service workers
is slightly behind Chrome. If the extension doesn't work in Firefox after
approval, open an issue — a Firefox-specific fetch workaround can be added.

---

### After publishing — keeping stores updated

When you push code changes:

1. Bump the version number in `manifest.json` (e.g. `1.0.5` → `1.0.6`)
2. Regenerate the zip: `zip -r linkedin-ai-detector.zip ...`
3. **Chrome:** Developer Console → your extension → **Package** tab → Upload new package
4. **Edge:** Partner Dashboard → your extension → **Update** → upload new zip
5. **Firefox:** Add-on Developer Hub → your extension → **Upload New Version**

Chrome and Edge updates go live within hours. Firefox updates go through the
same manual review queue (usually faster for updates than initial submissions).

---

## Contributing

Pull requests are welcome. Please open an issue first to discuss significant changes.

---

## Licence

MIT

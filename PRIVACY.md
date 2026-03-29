# LinkedIn AI Detector — Privacy Policy

**Last updated: March 2026**

## Overview

LinkedIn AI Detector is a Chrome extension that analyses LinkedIn posts and comments for AI-generated content. This policy explains what data is handled and how.

## Data collected

**None.** This extension does not collect, store, transmit, or share any personal data with the extension developer or any third party controlled by the developer.

## API key

Your Claude API key is entered by you and stored locally in your own browser using Chrome's encrypted `storage.sync`. It is:

- Never sent to any server controlled by this extension's developer
- Only ever sent directly from your browser to `api.anthropic.com` to perform analysis
- Never logged or shared with any third party other than Anthropic

## LinkedIn post and comment content

Text from LinkedIn posts and comments is sent directly from your browser to `api.anthropic.com` for AI analysis. It is:

- Not logged, stored, or retained by this extension
- Not sent to any server other than Anthropic's API
- Processed solely for the purpose of returning an AI-likelihood score

## Third parties

The only third-party service used is Anthropic's Claude API (`api.anthropic.com`). Anthropic's own privacy policy applies to any data sent to their API:
[https://www.anthropic.com/privacy](https://www.anthropic.com/privacy)

## Permissions used

| Permission | Reason |
|---|---|
| `storage` | Stores your API key and display preferences locally in your browser |
| `linkedin.com` host access | Required to inject the scoring badge UI into the LinkedIn feed |
| `api.anthropic.com` host access | Required to send post text to the Claude API for analysis |

## Contact

Found an issue? Open a GitHub issue at:
[https://github.com/almightydegu/linkedinaidetectorchromeextention/issues](https://github.com/almightydegu/linkedinaidetectorchromeextention/issues)

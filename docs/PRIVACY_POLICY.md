# Privacy Policy for TabSweep AI

**Last Updated:** September 2026

**TabSweep AI** is a browser extension driven by natural language rules and Large Language Models (LLMs) for smart tab cleanup and grouping. We are committed to protecting your privacy.

---

## 1. Data Collection & Processing

- **Local Processing Only**: TabSweep AI reads open tab titles and URLs solely when you actively trigger tab grouping, cleanup review, or AI chat commands.
- **No Central Servers**: We do **not** own or operate any backend servers. We do **not** collect, store, track, share, or sell your browsing history, personal information, or usage analytics.

## 2. AI API Communication

- **Bring Your Own Key (BYOK) & Local LLM**: TabSweep AI connects directly from your browser to the AI provider endpoint you configure (e.g., DeepSeek, Qwen, Moonshot, Zhipu, OpenAI, Anthropic, Google Gemini, or your local Ollama / vLLM instance).
- **Direct Transmission**: Tab titles and URLs are sent directly to your chosen AI endpoint only when you actively request AI organization or chat. No third-party or developer server intercepts or proxies these requests.

## 3. Data Storage

- Your API keys, model preferences, and custom natural language policies are stored strictly on your local device via the browser's `chrome.storage.local` API.
- Uninstalling the extension immediately removes all locally stored data.

## 4. Permissions Justification

| Permission | Purpose |
| :--- | :--- |
| `tabs` | Read open tab titles and URLs in the current window to group or close redundant tabs upon user confirmation |
| `tabGroups` | Create, name, color-code, and manage native browser tab groups |
| `storage` | Save user settings, API keys, and custom natural language policies locally |

## 5. Contact

If you have any questions regarding this Privacy Policy, please open an issue on our GitHub repository:
https://github.com/worrrr/TabSweep/issues

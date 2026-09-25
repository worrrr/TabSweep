<p align="center">
  <img src="public/icons/icon-128.png" width="80" height="80" alt="TabSweep AI logo" />
</p>

<h1 align="center">TabSweep AI</h1>

<p align="center">
  <strong>A browser tab cleanup & grouping extension driven purely by natural language rules and LLMs.</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/manifest-v3-green.svg" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/browser-Edge%20%7C%20Chrome-0078D7.svg" alt="Chrome / Edge Extension" />
  <img src="https://img.shields.io/badge/vue-3-brightgreen.svg" alt="Vue 3" />
  <img src="https://img.shields.io/badge/typescript-5-blue.svg" alt="TypeScript" />
</p>

<p align="center">
  <strong>🇺🇸 English</strong> · <a href="README.zh-CN.md">🇨🇳 简体中文</a>
</p>

---

## 💡 What is TabSweep AI?

**TabSweep AI** is a **browser tab cleanup and grouping extension driven purely by natural language rules and Large Language Models (LLMs)**.

Unlike traditional tab managers that rely on rigid, hardcoded domain or keyword matching rules, TabSweep AI lets you express your organization habits in **plain natural language policies**. Powered by LLMs, it understands the context of your open tabs and automatically decides **which cluttered tabs should be closed and how the rest should be grouped**.

### 🎯 Who is it for & Use Cases

- **For "Tab Hoarders" who rarely close tabs**: If you constantly keep dozens or hundreds of tabs open and find it exhausting to manually sort or close them one by one.
- **Fast batch-closing of similar & redundant tabs**: Instantly detect and close one-off search result pages, duplicate tabs from the same site/console, or leftover login/redirect intermediate pages.
- **Complex personal workflows requiring natural language rules**: When static rules fall short, you can write custom rules in plain language (e.g., *"Keep at most 1 most useful tab per website"*, *"Close all search result pages, keep only video playback pages on YouTube/Bilibili"*, *"Group all Tencent Cloud and Cloudflare tabs into a 'Domains' group"*).

### 💰 Ultra-Low Cost per Call

Worried about LLM token costs? With high-efficiency models like **DeepSeek V4.1 Flash**, **a single cleanup call costs only ~¥0.0049 RMB (< $0.0007 USD)**! That means pennies can power dozens of smart tab sweeps. Plus, you can connect local models via Ollama or vLLM for 100% free offline usage.

---

## 📸 Screenshots

| Main View & Multi-Window Groups | AI Cleanup & Grouping Review | AI Chat & Rule Customization |
| :---: | :---: | :---: |
| <img src="docs/screenshots/main-groups.png" width="260" alt="Main View" /> | <img src="docs/screenshots/cleanup-review.png" width="260" alt="Cleanup Review" /> | <img src="docs/screenshots/agent-chat.png" width="260" alt="AI Chat" /> |
| Clear overview of window groups & tabs | Explicit close reasons & group suggestions with checkbox confirmation | Conversational tab control & natural language policy updates |

---

## 🌟 Key Features

- 🧹 **AI Cleanup Review Flow (AI Sweep)**: Analyzes all tabs in your current window via native LLM Tool Calling, generating a checklist of "Tabs to Close (with specific reasons)" and "Suggested Groups". **Review and confirm before execution**, with built-in protection so your active tab is never accidentally closed.
- ⚡ **One-Click Fast Grouping (Group Tabs)**: Instantly organize tabs in the current window according to your natural language policies without confirmation popups or cross-window drift.
- 💬 **Conversational Tab Agent (AI Chat)**: Multi-turn chat with autonomous tool calling (`list_tabs`, `close_tabs`, `group_tabs`, `update_policies`) and a 5-turn sliding window memory. Simply tell the AI: *"Close all shopping tabs"* or *"Always put documentation tabs into the Dev group"*.
- 🧠 **Pure Natural Language Policies**: Built-in plain-text policy editor in Settings with one-click `.txt` import/export to back up or refine your custom rules anytime.
- 🌐 **Multi-Provider Ecosystem (BYOK & Local)**: Built-in presets for DeepSeek, Qwen, Kimi (Moonshot), Zhipu (GLM), MiniMax, OpenAI, Claude, and Gemini, plus full support for any OpenAI-compatible endpoint or local LLM (Ollama / vLLM / LM Studio).
- 🔒 **100% Privacy First**: Zero developer backend servers. Your API keys and policies are stored strictly in local browser storage (`chrome.storage.local`), requiring only minimal permissions (`tabs`, `tabGroups`, `storage`). See our [Privacy Policy](docs/PRIVACY_POLICY.md).

---

## 🚀 Quick Start

### Option 1: Install from Releases (Recommended)

1. Go to the **[Releases](https://github.com/worrrr/TabSweep/releases)** page, download the latest `tabsweep-ai-v1.0.0.zip`, and unzip it to a local folder.
2. Open your browser's extension management page:
   - **Edge**: `edge://extensions/`
   - **Chrome**: `chrome://extensions/`
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the unzipped folder.

### Option 2: Build from Source

```bash
# Clone the repository
git clone https://github.com/worrrr/TabSweep.git
cd TabSweep

# Install dependencies
pnpm install

# Build for production (outputs to dist/)
pnpm build
```

Then load the `dist` directory via **Load unpacked** in `edge://extensions/` or `chrome://extensions/`.

---

## ⚙️ AI Configuration

Click the ⚙️ icon in the top-right of the popup to configure your preferred provider:

| Provider | Model Example | Notes & Cost |
|---|---|---|
| **DeepSeek** | `deepseek-chat` / `deepseek-v4.1-flash` | **Highly Recommended**. Fast & ~**¥0.0049 RMB** per call |
| **Qwen** | `qwen-turbo` / `qwen-plus` | Alibaba Cloud DashScope API |
| **Kimi (Moonshot)** | `moonshot-v1-8k` | Moonshot AI Open Platform |
| **Zhipu (GLM)** | `glm-4-flash` | BigModel Open Platform |
| **Local LLM (Custom)** | `http://localhost:11434/v1` | Connect Ollama / vLLM, no API key required, 100% free & offline |

---

## 🛠️ Development & Testing

```bash
pnpm dev          # Start dev server with HMR
pnpm test         # Run unit tests (Vitest)
pnpm typecheck    # Run TypeScript type checking
pnpm build        # Production build
```

---

## 📄 License & Acknowledgements

- Based on the open-source project [TabPilot](https://github.com/florianlanx/tabpilot) by Florian.
- Licensed under the **[MIT License](LICENSE)**. Original copyright notice is retained in `LICENSE` (Copyright (c) 2025-present Florian).

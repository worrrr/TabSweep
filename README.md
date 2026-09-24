<p align="center">
  <img src="public/icons/icon-128.png" width="80" height="80" alt="TabSweep AI logo" />
</p>

<h1 align="center">TabSweep AI</h1>

<p align="center">
  <strong>Smart Tab Grouping & Cleanup Assistant with Natural Language Policies & Tool Calling.</strong><br/>
  智能标签页分组整理助手 · 自然语言策略 · 原生 Tool Calling · 完整中英双语 · 100% 隐私安全
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/manifest-v3-green.svg" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/chrome-extension-yellow.svg" alt="Chrome / Edge Extension" />
  <img src="https://img.shields.io/badge/vue-3-brightgreen.svg" alt="Vue 3" />
  <img src="https://img.shields.io/badge/typescript-5-blue.svg" alt="TypeScript" />
  <img src="https://img.shields.io/badge/i18n-en%20%7C%20zh_CN-purple.svg" alt="i18n Support" />
</p>

---

## 🌟 核心特性 / Features

- 🧹 **AI 整理（AI Sweep）**：基于大模型原生 Tool Calling 智能分析当前窗口标签，识别同站冗余、一次性搜索页和待归档内容，提供可视化审核弹窗，一键完成安全关闭与规整分组。
- ⚡ **快速智能分组（Group Tabs）**：卡片一键快速分组，零弹窗即时生效（~0.4s），深度对齐用户自定义策略，严格锁定所属窗口，杜绝跨窗口漂移。
- 💬 **AI 对话助手（Agent Chat）**：支持多轮对话与自主工具调用（`list_tabs`、`close_tabs`、`group_tabs`、`update_policies`），内置对话滑动窗口与上下文自动压缩总结。
- 🧠 **长期记忆策略（Custom Policies）**：设置页提供自然语言整理与分组规则编辑器，对话中可直接说「以后…都帮我归到工作组」持久化保存。
- 🌐 **多模型生态（Multi-Provider）**：内置 DeepSeek、通义千问 (Qwen)、月之暗面 (Kimi)、智谱 (GLM)、MiniMax、OpenAI、Claude、Gemini 以及本地模型（Ollama / vLLM / LM Studio）。
- 🌍 **全量中英双语（Full i18n）**：界面 UI、系统提示词（System Prompt）、工具 Schema（Tool Calling Schema）及上下文压缩均自动根据浏览器系统语言无缝切换；英文环境下提示词纯英文化。

---

## 🚀 快速上手 / Quick Start

### 1. 构建扩展 / Build

```bash
# 克隆仓库
git clone https://github.com/worrrr/TabSweep.git
cd TabSweep

# 安装依赖
pnpm install

# 生产环境构建
pnpm build
```

构建完成后，产物将生成在 `dist` 目录下。

### 2. 加载到浏览器 / Load Extension

1. 打开浏览器扩展管理页面：
   - **Chrome**: `chrome://extensions/`
   - **Edge**: `edge://extensions/`
2. 开启右上角的 **「开发者模式」 (Developer mode)**；
3. 点击 **「加载已解压的扩展程序」 (Load unpacked)**；
4. 选择并加载工程中的 **`dist`** 目录；
5. 将 TabSweep AI 图标固定在浏览器工具栏即可开始使用。

---

## ⚙️ 模型配置 / AI Configuration

在扩展右上角点击 ⚙️ 进入设置页：

| 配置项 | 推荐配置示例 | 说明 |
|---|---|---|
| **DeepSeek** | `deepseek-chat` | 官方原生支持，性价比高，响应极速 |
| **通义千问** | `qwen-turbo` / `qwen-plus` | 阿里云百炼 API |
| **Kimi** | `moonshot-v1-8k` | 月之暗面开放平台 |
| **智谱 AI** | `glm-4-flash` | BigModel 平台 |
| **本地模型** | `http://localhost:11434/v1` (Ollama) | 纯本地离线运行，保护数据隐私 |

---

## 🛠️ 开发与测试 / Development & Testing

```bash
# 启动开发服务器（热更新）
pnpm dev

# 运行全量单元测试（Vitest）
pnpm test

# 运行 TypeScript 类型检查
pnpm typecheck

# 生产环境打包构建
pnpm build
```

---

## 📄 开源许可与致谢 / License & Acknowledgements

- 本项目基于开源项目 [TabPilot](https://github.com/florianlanx/tabpilot)（作者 Florian）二次深度开发。
- 本项目遵循 **[MIT License](LICENSE)** 开源许可证。
  - 原作者版权声明保留于 `LICENSE` 文件中（Copyright (c) 2025-present Florian）。
  - 新增功能与重构代码保留开源共享精神。

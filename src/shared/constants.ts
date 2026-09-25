import type { GroupCategory, GroupDefinition, ExtensionSettings, AIProvider } from './types'

export const GROUP_DEFINITIONS: Record<GroupCategory, GroupDefinition> = {
  work:   { color: 'blue',   labelKey: 'groupWork' },
  dev:    { color: 'green',  labelKey: 'groupDev' },
  learn:  { color: 'purple', labelKey: 'groupLearn' },
  social: { color: 'cyan',   labelKey: 'groupSocial' },
  media:  { color: 'red',    labelKey: 'groupMedia' },
  shop:   { color: 'yellow', labelKey: 'groupShop' },
  docs:   { color: 'pink',   labelKey: 'groupDocs' },
  other:  { color: 'grey',   labelKey: 'groupOther' },
}

export const ALL_CATEGORIES: GroupCategory[] = [
  'work', 'dev', 'learn', 'social', 'media', 'shop', 'docs', 'other',
]

export const DEFAULT_POLICIES_ZH = `# 标签页整理策略
- 广告、弹窗、跳转残留、登录中间页：建议关闭
- 搜索结果页、一次性查询/下载确认：建议关闭
- 同一网站只保留最有用的 1 个（优先：当前正在看的 > 固定 > 最近）
- 工作相关（飞书/钉钉/文档/邮箱/会议）尽量保留，并分到「工作」组
- 开发相关（GitHub/文档/StackOverflow）分到「开发」组
- 固定标签页（pinned）与当前正在浏览的标签：不要关闭`

export const DEFAULT_POLICIES_EN = `# Tab Cleanup Policies
- Ads, popups, redirects, intermediate login pages: Recommend closing
- Search results, one-off queries, download confirmations: Recommend closing
- Keep only 1 most useful tab per domain (Priority: currently active > pinned > recent)
- Work-related tabs (Slack/Teams/Docs/Email/Meetings): Keep and group into "Work"
- Development-related tabs (GitHub/Docs/StackOverflow): Group into "Dev"
- Pinned tabs and currently active tab: Never close`

export function getDefaultPolicies(): string {
  try {
    const lang = chrome?.i18n?.getUILanguage?.() || ''
    if (lang && !lang.toLowerCase().startsWith('zh')) {
      return DEFAULT_POLICIES_EN
    }
  } catch {
    // fallback
  }
  return DEFAULT_POLICIES_ZH
}

export const DEFAULT_POLICIES = getDefaultPolicies()

export interface ProviderPreset {
  id: AIProvider
  name: string
  endpoint: string
  defaultModel: string
  models: string[]
  isLockedEndpoint: boolean
  apiKeyPlaceholder: string
}

export const PROVIDER_PRESETS: Record<AIProvider, ProviderPreset> = {
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek (深度求索)',
    endpoint: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-flash', 'deepseek-reasoner'],
    isLockedEndpoint: true,
    apiKeyPlaceholder: '输入 DeepSeek API Key (sk-...)',
  },
  qwen: {
    id: 'qwen',
    name: '通义千问 (Qwen)',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-turbo',
    models: ['qwen-turbo', 'qwen-flash', 'qwen-plus', 'qwen-max'],
    isLockedEndpoint: true,
    apiKeyPlaceholder: '输入 DashScope API Key (sk-...)',
  },
  kimi: {
    id: 'kimi',
    name: '月之暗面 (Kimi)',
    endpoint: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'kimi-latest'],
    isLockedEndpoint: true,
    apiKeyPlaceholder: '输入 Moonshot API Key (sk-...)',
  },
  zhipu: {
    id: 'zhipu',
    name: '智谱 (GLM)',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    models: ['glm-4-flash', 'glm-4-plus', 'glm-4-air'],
    isLockedEndpoint: true,
    apiKeyPlaceholder: '输入智谱 API Key',
  },
  minimax: {
    id: 'minimax',
    name: 'MiniMax',
    endpoint: 'https://api.minimax.chat/v1',
    defaultModel: 'abab6.5s-chat',
    models: ['abab6.5s-chat', 'MiniMax-Text-01'],
    isLockedEndpoint: true,
    apiKeyPlaceholder: '输入 MiniMax API Key',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o'],
    isLockedEndpoint: true,
    apiKeyPlaceholder: '输入 OpenAI API Key (sk-...)',
  },
  claude: {
    id: 'claude',
    name: 'Claude',
    endpoint: 'https://api.anthropic.com',
    defaultModel: 'claude-3-5-haiku-20241022',
    models: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022'],
    isLockedEndpoint: true,
    apiKeyPlaceholder: '输入 Anthropic API Key (sk-ant-...)',
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    endpoint: 'https://generativelanguage.googleapis.com',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-1.5-flash'],
    isLockedEndpoint: true,
    apiKeyPlaceholder: '输入 Google Gemini API Key (AIza...)',
  },
  custom: {
    id: 'custom',
    name: '自定义 (本地模型 / 兼容接口)',
    endpoint: 'http://localhost:11434/v1',
    defaultModel: 'qwen2.5:7b',
    models: ['qwen2.5:7b', 'llama3:8b'],
    isLockedEndpoint: false,
    apiKeyPlaceholder: '无需密钥时可留空（如 Ollama / vLLM）',
  },
}

export const DEFAULT_CUSTOM_AI = {
  endpoint: 'http://localhost:11434/v1',
  model: 'qwen2.5:7b',
} as const

/** Retained alias for backwards compatibility */
export const LOCAL_QWEN = DEFAULT_CUSTOM_AI

export const DEFAULT_SETTINGS: ExtensionSettings = {
  ai: {
    enabled: true,
    provider: 'deepseek',
    apiKey: '',
    endpoint: PROVIDER_PRESETS.deepseek.endpoint,
    model: PROVIDER_PRESETS.deepseek.defaultModel,
  },
  policies: DEFAULT_POLICIES,
  language: 'auto',
  groupOnStartup: false,
  groupIndicatorStyle: 'header',
  theme: 'system',
}

export const STORAGE_KEYS = {
  SETTINGS: 'settings',
} as const

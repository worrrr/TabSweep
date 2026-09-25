export interface TabInfo {
  id: number
  url: string
  title: string
  favIconUrl?: string
  windowId: number
  index: number
  active: boolean
  pinned: boolean
}

export interface ClassifyResult {
  category: GroupCategory
  confidence: number
  method: 'domain' | 'keyword' | 'ai' | 'default'
}

export type GroupCategory = 'work' | 'dev' | 'learn' | 'social' | 'media' | 'shop' | 'docs' | 'other'

export type ChromeTabGroupColor = 'grey' | 'blue' | 'red' | 'yellow' | 'green' | 'pink' | 'purple' | 'cyan'

export interface GroupDefinition {
  color: ChromeTabGroupColor
  labelKey: string
}

export interface GroupedTabs {
  category: GroupCategory
  tabs: TabInfo[]
  groupName?: string
  groupColor?: ChromeTabGroupColor
}

export interface AIGroupResult {
  name: string
  tabIndices: number[]
  color?: ChromeTabGroupColor
}

export type AIProvider =
  | 'deepseek'
  | 'qwen'
  | 'kimi'
  | 'zhipu'
  | 'minimax'
  | 'openai'
  | 'claude'
  | 'gemini'
  | 'custom'

export interface AIConfig {
  enabled: boolean
  provider: AIProvider
  apiKey: string
  endpoint?: string
  model?: string
}

export type GroupIndicatorStyle = 'header' | 'bar'

export type ThemeMode = 'light' | 'dark' | 'system'

export interface ExtensionSettings {
  ai: AIConfig
  /** Natural-language tab cleanup policies sent to the LLM */
  policies?: string
  language: 'auto' | 'en' | 'zh_CN'
  groupOnStartup: boolean
  searchShortcut?: string
  groupIndicatorStyle: GroupIndicatorStyle
  theme: ThemeMode
}

export interface CleanupCloseItem {
  index: number
  tabId: number
  title: string
  url: string
  reason?: string
  selected?: boolean
}

export interface CleanupGroupItem {
  name: string
  color: ChromeTabGroupColor
  indices: number[]
  tabs: { tabId: number; title: string; url: string }[]
  selected?: boolean
}

export interface CleanupKeepItem {
  index: number
  tabId: number
  title: string
  url: string
  reason?: string
}

export interface CleanupPlan {
  windowId: number
  close: CleanupCloseItem[]
  groups: CleanupGroupItem[]
  keep: CleanupKeepItem[]
  raw?: string
}

export interface CleanupExecutePayload {
  closeTabIds: number[]
  groups: { name: string; color: ChromeTabGroupColor; tabIds: number[] }[]
}

export interface ToolCallLogItem {
  id: string
  name: string
  arguments: Record<string, unknown>
  result: Record<string, unknown>
  ok: boolean
  durationMs?: number
  /** One-line human summary, e.g. 成功：已关闭 3 个标签 */
  summary?: string
}

export interface WindowGroupsInfo {
  windowId: number
  tabCount: number
  focused: boolean
  groups: GroupedTabs[]
  hasGroups: boolean
  titlesHidden: boolean
}

export type MessageAction =
  | 'GROUP_TABS'
  | 'UNGROUP_ALL'
  | 'CLOSE_GROUP'
  | 'CLASSIFY_NEW_TABS'
  | 'EXPAND_ALL_GROUPS'
  | 'COLLAPSE_ALL_GROUPS'
  | 'TOGGLE_GROUP_TITLES'
  | 'GET_GROUPS_PREVIEW'
  | 'REFRESH_GROUPS_PREVIEW'
  | 'GET_ALL_WINDOWS_PREVIEW'
  | 'GET_SETTINGS'
  | 'SAVE_SETTINGS'
  | 'SWITCH_TAB'
  | 'OPEN_URL'
  | 'AI_CLEANUP_PLAN'
  | 'AI_CLEANUP_EXECUTE'
  | 'AI_CHAT'

export interface ExtensionMessage {
  action: MessageAction
  payload?: unknown
}

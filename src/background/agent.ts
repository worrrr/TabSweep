import { AIClient } from '../shared/ai-client'
import { DEFAULT_POLICIES, DEFAULT_SETTINGS, STORAGE_KEYS } from '../shared/constants'
import { isZhLanguage } from '../shared/i18n'
import type { ChromeTabGroupColor, ExtensionSettings, ToolCallLogItem } from '../shared/types'
import { buildLLMMessages, naiveSummarize, windowChatHistory, type ChatTurn } from '../shared/chat-window'
import { summarizeToolResult, fallbackAgentReply } from '../shared/tool-summary'

const RESTRICTED_PREFIXES = ['chrome://', 'chrome-extension://', 'edge://', 'about:']

/**
 * Internal browser pages cannot run content scripts.
 * They CAN be listed and closed via chrome.tabs.* (Chromium/Edge allow tabs.remove).
 */
export function isInternalUrl(url: string | undefined): boolean {
  if (!url) return true
  return RESTRICTED_PREFIXES.some((p) => url.startsWith(p))
}

/** Legacy name used by cleanup path — treat as internal (still closeable). */
export function isRestricted(url: string | undefined): boolean {
  return isInternalUrl(url)
}

export function isContentScriptBlocked(url: string | undefined): boolean {
  return isInternalUrl(url)
}

async function getSettings(): Promise<ExtensionSettings> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS)
  const saved = (data[STORAGE_KEYS.SETTINGS] ?? {}) as Partial<ExtensionSettings>
  const settings = { ...DEFAULT_SETTINGS, ...saved, ai: { ...DEFAULT_SETTINGS.ai, ...(saved.ai || {}) } }
  if (settings.policies) {
    settings.policies = settings.policies.replace(/\n?只输出 JSON：[\s\S]*$/, '').trimEnd()
  }
  return settings
}

export interface AgentChatResult {
  reply: string
  toolCalls: ToolCallLogItem[]
  indexToTabId: Record<number, number>
  /** Updated session summary (older turns folded). */
  summary: string
  /** Turns that were folded into summary this round (for UI). */
  summarizedCount: number
}

type Json = Record<string, unknown>

const KEEP_TURNS = 5

export function getAgentTools(isZh = isZhLanguage()) {
  return [
    {
      type: 'function',
      function: {
        name: 'list_tabs',
        description: isZh
          ? '列出当前窗口全部标签，包括 edge://、chrome:// 等浏览器内部页（设置/扩展页）。只读。'
          : 'List all tabs in the current window, including internal pages like edge:// or chrome:// (Settings/Extensions). Read-only.',
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'close_tabs',
        description: isZh
          ? '关闭指定标签。tabIds 必须是 list_tabs 返回的真实 id。可关 edge:// 内部页与 pinned；**当前正在使用的标签（active）会跳过**。'
          : 'Close specified tabs. tabIds must be real IDs returned by list_tabs. Can close internal pages and pinned tabs; **the currently active tab is always skipped**.',
        parameters: {
          type: 'object',
          properties: {
            tabIds: {
              type: 'array',
              items: { type: 'integer' },
              description: isZh ? '要关闭的 tabId 列表' : 'List of tab IDs to close',
            },
            reason: {
              type: 'string',
              description: isZh ? '关闭原因（给用户看）' : 'Reason for closing (shown to user)',
            },
          },
          required: ['tabIds'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'group_tabs',
        description: isZh
          ? '把标签加入/创建 Chrome 标签组。tabIds 为真实 id。内部页通常也能分组。'
          : 'Add tabs to or create a Chrome tab group. tabIds must be real IDs. Internal pages can also be grouped.',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: isZh ? '组名' : 'Group name',
            },
            color: {
              type: 'string',
              enum: ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'],
            },
            tabIds: { type: 'array', items: { type: 'integer' } },
          },
          required: ['name', 'tabIds'],
          additionalProperties: false,
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'update_policies',
        description: isZh
          ? '更新用户整理策略（长期记忆）。当用户表达分类、分组或清理偏好时默认调用此工具进行沉淀。mode=append 追加一行/一段；mode=replace 整段替换策略正文。'
          : 'Update user organization policies (long-term memory). Proactively called when user specifies grouping or cleanup preferences. mode=append adds text; mode=replace replaces policy body.',
        parameters: {
          type: 'object',
          properties: {
            mode: { type: 'string', enum: ['append', 'replace'] },
            text: {
              type: 'string',
              description: isZh ? '策略文本' : 'Policy text',
            },
            note: {
              type: 'string',
              description: isZh ? '本次修改说明' : 'Description of this change',
            },
          },
          required: ['mode', 'text'],
          additionalProperties: false,
        },
      },
    },
  ] as const
}

export const AGENT_TOOLS = getAgentTools(true)

async function execListTabs(windowId: number): Promise<{ content: string; data: Json }> {
  const tabs = await chrome.tabs.query({ windowId, windowType: 'normal' })
  // Include internal pages (edge://, chrome://) — they are closeable via tabs.remove
  const usable = tabs.filter((t) => t.id !== undefined)
  const data = usable.map((t, i) => ({
    index: i + 1,
    id: t.id,
    title: t.title || '',
    url: t.url || '',
    pinned: !!t.pinned,
    active: !!t.active,
    internal: isInternalUrl(t.url),
  }))
  return { content: JSON.stringify({ tabs: data }), data: { tabs: data } as Json }
}

async function execCloseTabs(args: Json): Promise<{ content: string; data: Json }> {
  const ids = Array.isArray(args.tabIds) ? (args.tabIds as number[]).filter((n) => Number.isInteger(n) && n > 0) : []
  const unique = [...new Set(ids)]
  const closed: number[] = []
  const skipped: { id: number; reason: string }[] = []
  for (const id of unique) {
    try {
      const tab = await chrome.tabs.get(id)
      // Only restriction: never close the tab the user is currently on
      if (tab.active) {
        skipped.push({ id, reason: 'active-current' })
        continue
      }
      await chrome.tabs.remove(id)
      closed.push(id)
    } catch (err) {
      skipped.push({ id, reason: (err as Error).message || 'not-found' })
    }
  }
  const data = { closed, closedCount: closed.length, skipped, reason: args.reason || '' }
  return { content: JSON.stringify(data), data: data as Json }
}

async function execGroupTabs(args: Json): Promise<{ content: string; data: Json }> {
  const name = String(args.name || '').slice(0, 40)
  const color = (args.color || 'grey') as ChromeTabGroupColor
  const ids = Array.isArray(args.tabIds) ? (args.tabIds as number[]).filter((n) => Number.isInteger(n) && n > 0) : []
  const live: number[] = []
  let targetWinId: number | undefined
  for (const id of [...new Set(ids)]) {
    try {
      const tab = await chrome.tabs.get(id)
      if (tab.id !== undefined) {
        live.push(tab.id)
        if (!targetWinId && tab.windowId) targetWinId = tab.windowId
      }
    } catch {
      // gone
    }
  }
  if (!name) return { content: JSON.stringify({ ok: false, error: 'name required' }), data: { ok: false, error: 'name required' } }
  if (live.length === 0) {
    return { content: JSON.stringify({ ok: false, error: 'no valid tabIds' }), data: { ok: false, error: 'no valid tabIds' } }
  }
  try {
    const groupId = await chrome.tabs.group({
      tabIds: live as [number, ...number[]],
      ...(targetWinId ? { createProperties: { windowId: targetWinId } } : {}),
    })
    await chrome.tabGroups.update(groupId, { title: name, color })
    const data = { ok: true, groupId, name, tabIds: live, color }
    return { content: JSON.stringify(data), data: data as Json }
  } catch (err) {
    const data = { ok: false, error: (err as Error).message, tabIds: live }
    return { content: JSON.stringify(data), data: data as Json }
  }
}

async function execUpdatePolicies(args: Json): Promise<{ content: string; data: Json }> {
  const mode = args.mode === 'replace' ? 'replace' : 'append'
  const text = String(args.text || '')
  if (!text.trim()) {
    return { content: JSON.stringify({ ok: false, error: 'text is empty' }), data: { ok: false, error: 'text is empty' } }
  }
  const settings = await getSettings()
  const prev = settings.policies || DEFAULT_POLICIES
  const next = mode === 'replace' ? text.trim() + '\n' : prev.trimEnd() + '\n- ' + text.trim() + '\n'
  settings.policies = next
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings })
  const data = {
    ok: true,
    mode,
    savedTo: 'chrome.storage.local settings.policies',
    projectFile: isZhLanguage()
      ? 'data/policies.md（请手动同步）'
      : 'data/policies.md (Please sync manually)',
    length: next.length,
    note: args.note || '',
  }
  return { content: JSON.stringify(data), data: data as Json }
}

async function runTool(name: string, args: Json, windowId: number): Promise<{ content: string; data: Json; ok: boolean }> {
  try {
    if (name === 'list_tabs') {
      const r = await execListTabs(windowId)
      return { ...r, ok: true }
    }
    if (name === 'close_tabs') {
      const r = await execCloseTabs(args)
      const ok = r.data.ok !== false && (r.data.error === undefined)
      return { ...r, ok }
    }
    if (name === 'group_tabs') {
      const r = await execGroupTabs(args)
      return { ...r, ok: r.data.ok === true }
    }
    if (name === 'update_policies') {
      const r = await execUpdatePolicies(args)
      return { ...r, ok: r.data.ok === true }
    }
    return {
      content: JSON.stringify({ ok: false, error: `unknown tool: ${name}` }),
      data: { ok: false, error: `unknown tool: ${name}` },
      ok: false,
    }
  } catch (err) {
    const data = { ok: false, error: (err as Error).message }
    return { content: JSON.stringify(data), data, ok: false }
  }
}

/**
 * Compress older turns into a running summary (best-effort LLM, fallback naive).
 */
async function foldSummary(
  client: AIClient,
  prevSummary: string,
  older: ChatTurn[],
  isZh = isZhLanguage(),
): Promise<string> {
  if (older.length === 0) return prevSummary
  const naive = naiveSummarize(older, prevSummary, isZh)
  try {
    const prompt = isZh
      ? `把下面「旧摘要」和「更早对话」压成一份简短中文摘要（不超过 300 字），保留用户偏好、已做操作、未完成事项。只输出摘要正文。

# 旧摘要
${prevSummary || '（无）'}

# 更早对话
${older.map((m) => `${m.role}: ${m.content}`).join('\n')}`
      : `Compress the following "Previous Summary" and "Earlier Conversation" into a concise English summary (under 200 words), preserving user preferences, actions taken, and pending tasks. Output the summary body only.

# Previous Summary
${prevSummary || '(None)'}

# Earlier Conversation
${older.map((m) => `${m.role}: ${m.content}`).join('\n')}`
    const out = await client.chat(prompt)
    const text = (out || '').trim()
    return text ? text.slice(0, 2000) : naive
  } catch {
    return naive
  }
}

/**
 * Real tool-calling loop: every tool_call is executed locally and the result
 * is returned to the model so it can continue (e.g. write policies after close).
 * LLM context: running summary + last KEEP_TURNS turns only.
 */
export async function runChatAgent(
  history: { role: 'user' | 'assistant'; content: string }[],
  windowId?: number,
  prevSummary = '',
): Promise<AgentChatResult> {
  const settings = await getSettings()
  if (!settings.ai.enabled) throw new Error('AI is disabled in settings')
  if (!settings.ai.endpoint && settings.ai.provider === 'custom') {
    throw new Error('AI endpoint is empty')
  }

  const isZh = isZhLanguage()

  const winId =
    windowId ??
    (await chrome.windows.getLastFocused({ windowTypes: ['normal'] })).id ??
    -1

  const chromeTabs = await chrome.tabs.query({ windowId: winId, windowType: 'normal' })
  const usable = chromeTabs.filter((t) => t.id !== undefined)
  const indexToTabId: Record<number, number> = {}
  usable.forEach((t, i) => {
    indexToTabId[i + 1] = t.id!
  })

  const list = usable
    .map((t, i) => {
      const flags = [t.pinned ? 'pinned' : '', t.active ? 'active' : '', isInternalUrl(t.url) ? 'internal' : '']
        .filter(Boolean)
        .join(',')
      return `${i + 1}#id=${t.id}# ${t.title || ''} | ${t.url || ''}${flags ? ` | ${flags}` : ''}`
    })
    .join('\n')

  const baseSystem = isZh
    ? `你是浏览器标签页助手（可用工具执行操作）。用中文简洁回答。
当前窗口标签（序号#id=真实tabId# 标题 | URL | 标记）：
${list || '(无)'}

## 用户策略
${settings.policies || DEFAULT_POLICIES}

## 工具
- list_tabs：拿最新 id（含 edge://、chrome:// 设置等内部页）
- close_tabs：关闭标签；可关 edge:// 内部页与 pinned；**active（当前页）会跳过**
- group_tabs：分组
- update_policies：将用户的偏好、分类归类习惯或自定义规则写入长期策略（append/replace）

## 规则
1. 要整理/关闭/分组时：先 list_tabs（如需），再 close_tabs / group_tabs
2. 内部页（设置/扩展）若用户要关，就用 close_tabs，不要说「关不掉」
3. **每个工具调用结束后，你必须用普通用户能看懂的中文汇报结果**，例如：
   - 「已成功关闭 3 个标签（搜索页、淘宝确认页…）」
   - 「已将标签归入「比赛」组，并已自动将该分类偏好保存为长期策略；如无需长期生效，随时告诉我取消即可」
   - 「有 1 个是当前标签，没有关闭」
   不要只贴 JSON；不要在工具成功后沉默
4. **主动学习并默认沉淀规则**：
   - 当用户提出明确的归类要求、分组意图或清理偏好时（如「把XX和YY放在ZZ组」、「XX类型网页都关掉」等），**默认直接调用 update_policies 将其保存为长期规则**，严禁反复反问用户「要不要写进规则」；
   - 在汇报时，明确告知用户已执行操作，并附带提醒说明：「该规则已自动记入长期策略，如果无需长期保留，随时告诉我取消即可」；
   - 若用户表示「取消规则」、「撤销刚才的策略」或「删除某条规则」，调用 update_policies 进行清理并向用户确认。
5. 不要编造 tabId；以 list_tabs 为准
6. **唯一保护：当前 active 标签不关**；pinned 和 edge:// 都可以关`
    : `You are a browser tab assistant (with tools to perform actions). Respond concisely in English.
Tabs in the current window (Index#id=realTabId# Title | URL | Flags):
${list || '(None)'}

## User Policies
${settings.policies || DEFAULT_POLICIES}

## Tools
- list_tabs: Get the latest tab IDs (including internal pages like chrome://, edge://)
- close_tabs: Close tabs; can close edge:// internal pages and pinned tabs; **active (current) tab will be skipped**
- group_tabs: Group tabs
- update_policies: Save user preferences, classification habits, or custom rules into long-term policies (append/replace)

## Rules
1. When organizing/closing/grouping: call list_tabs first (if needed), then close_tabs / group_tabs.
2. If the user wants to close internal pages (settings/extensions), use close_tabs; never say you cannot close them.
3. **After each tool call finishes, you must clearly report the result in plain English**, for example:
   - "Successfully closed 3 tabs (search page, store checkout...)"
   - "Grouped tabs into 'Competition' and automatically saved this preference to your long-term policies; if you don't need this permanently, let me know anytime to cancel it."
   - "1 tab is currently active and was kept open."
   Never just paste raw JSON; never stay silent after tool execution.
4. **Proactive Policy Learning (Default to Saving)**:
   - When the user specifies grouping preferences, classification intents, or cleanup criteria (e.g. 'put XX and YY into ZZ', 'close all XX types'), **proactively call update_policies by default to save it into long-term policies** without repeatedly asking for permission;
   - In your reply, confirm the action and mention: "This rule has been automatically saved to your long-term policies. If you don't want this permanently, let me know anytime to cancel/undo it.";
   - If the user asks to undo, cancel, or delete a rule, call update_policies to remove it and confirm to the user.
5. Never hallucinate tab IDs; always rely on list_tabs.
6. **The only protected tab: currently active tab is never closed**; pinned tabs and edge:// or chrome:// pages can be closed.`

  const client = new AIClient(settings.ai)
  const win = windowChatHistory(history || [], KEEP_TURNS)
  const summary = await foldSummary(client, prevSummary, win.older, isZh)

  const built = buildLLMMessages(baseSystem, history || [], summary, KEEP_TURNS, isZh)
  const messages: Json[] = built.messages.map((m) =>
    m.role === 'system'
      ? { role: 'system', content: m.content }
      : { role: m.role, content: m.content },
  )

  const toolCalls: ToolCallLogItem[] = []
  const agentTools = getAgentTools(isZh)

  for (let turn = 0; turn < 8; turn++) {
    const raw = await client.chatWithTools(
      messages,
      agentTools as unknown as Record<string, unknown>[],
    )

    if (raw.toolCalls && raw.toolCalls.length > 0) {
      // push assistant tool_use message
      messages.push({
        role: 'assistant',
        content: raw.content || '',
        tool_calls: raw.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: tc.arguments },
        })),
      })

      for (const tc of raw.toolCalls) {
        let args: Json = {}
        try {
          args = tc.arguments ? JSON.parse(tc.arguments) : {}
        } catch {
          args = {}
        }
        const started = Date.now()
        const result = await runTool(tc.name, args, winId)
        const summary = summarizeToolResult(tc.name, result.data, result.ok)
        toolCalls.push({
          id: tc.id,
          name: tc.name,
          arguments: args,
          result: result.data,
          ok: result.ok,
          durationMs: Date.now() - started,
          summary,
        })
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          name: tc.name,
          // Plain-language first so the model reports success clearly
          content: JSON.stringify({ summary, ok: result.ok, ...result.data }),
        })
      }
      continue
    }

    const reply = (raw.content || '').trim() || fallbackAgentReply(toolCalls)
    return {
      reply,
      toolCalls,
      indexToTabId,
      summary,
      summarizedCount: win.older.length,
    }
  }

  return {
    reply: fallbackAgentReply(toolCalls) + (isZh ? '\n（已达到最大工具调用轮数）' : '\n(Max tool calling turns reached)'),
    toolCalls,
    indexToTabId,
    summary,
    summarizedCount: win.older.length,
  }
}

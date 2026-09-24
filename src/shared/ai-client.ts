import type {
  AIConfig,
  AIGroupResult,
  ChromeTabGroupColor,
  GroupCategory,
} from './types'
import { DEFAULT_POLICIES, PROVIDER_PRESETS } from './constants'
import { isZhLanguage } from './i18n'

export interface GeneratedCleanupPlan {
  close: { index: number; reason?: string }[]
  groups: { name: string; color?: string; indices: number[] }[]
  keep: { index: number; reason?: string }[]
  raw: string
}

const SYSTEM_PROMPT = 'You are a helpful assistant that classifies browser tabs into categories. Be concise.'

export function getCleanupSystemPrompt(isZh = isZhLanguage()): string {
  return isZh
    ? '你是浏览器标签页整理助手。请根据用户策略对当前窗口标签进行分析，并调用 submit_cleanup_plan 提交整理方案。'
    : 'You are a browser tab organization assistant. Analyze the tabs in the current window according to user policies and call submit_cleanup_plan to submit an organization plan.'
}

export function getSubmitCleanupPlanTool(isZh = isZhLanguage()) {
  return {
    type: 'function' as const,
    function: {
      name: 'submit_cleanup_plan',
      description: isZh
        ? '提交经过规则分析后的浏览器标签页整理方案（包含建议关闭、建议分组及保留标签）'
        : 'Submit the browser tab cleanup plan after policy analysis (including suggested closes, groups, and kept tabs)',
      parameters: {
        type: 'object',
        properties: {
          close: {
            type: 'array',
            description: isZh
              ? '建议关闭的冗余/广告/一次性/搜索页等标签'
              : 'Tabs recommended to close, such as duplicates, ads, one-time queries, search pages, etc.',
            items: {
              type: 'object',
              properties: {
                index: {
                  type: 'integer',
                  description: isZh ? '标签列表序号（从 1 开始）' : 'Tab index from the list (1-based)',
                },
                reason: {
                  type: 'string',
                  description: isZh
                    ? '简明关闭理由，如“同站重复”、“一次性搜索”'
                    : 'Brief reason for closing, e.g. "Duplicate domain", "Search results"',
                },
              },
              required: ['index', 'reason'],
            },
          },
          groups: {
            type: 'array',
            description: isZh
              ? '建议的逻辑分组，组名采用中文短词'
              : 'Logical tab groups. Group names should be concise categories in English',
            items: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: isZh
                    ? '分组名称（中文短词，如“工作”、“开发”、“资料”）'
                    : 'Group name (short category in English like "Work", "Dev", "Reading")',
                },
                color: {
                  type: 'string',
                  enum: ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'],
                  description: isZh ? '分组颜色' : 'Group color',
                },
                indices: {
                  type: 'array',
                  items: { type: 'integer' },
                  description: isZh ? '属于该组的标签序号列表' : 'List of tab indices belonging to this group',
                },
              },
              required: ['name', 'color', 'indices'],
            },
          },
          keep: {
            type: 'array',
            description: isZh ? '明确保留且不必进组的标签' : 'Tabs explicitly kept without grouping',
            items: {
              type: 'object',
              properties: {
                index: {
                  type: 'integer',
                  description: isZh ? '标签列表序号' : 'Tab index from the list',
                },
                reason: {
                  type: 'string',
                  description: isZh ? '保留理由' : 'Reason for keeping',
                },
              },
              required: ['index'],
            },
          },
        },
        required: ['close', 'groups', 'keep'],
      },
    },
  }
}

export const SUBMIT_CLEANUP_PLAN_TOOL = getSubmitCleanupPlanTool(true)

export function getSubmitTabGroupsTool(isZh = isZhLanguage()) {
  return {
    type: 'function' as const,
    function: {
      name: 'submit_tab_groups',
      description: isZh ? '提交标签页的分组方案' : 'Submit tab grouping plan',
      parameters: {
        type: 'object',
        properties: {
          groups: {
            type: 'array',
            description: isZh ? '标签分组列表（2-8个组）' : 'List of tab groups (2-8 groups)',
            items: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: isZh
                    ? '中文简短组名（2-4字，如学习、开发、工作、资料）'
                    : 'Concise English group name (e.g. Work, Dev, Study, Reading, Media, Tools)',
                },
                color: {
                  type: 'string',
                  enum: ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'],
                  description: isZh ? '分组颜色' : 'Group color',
                },
                indices: {
                  type: 'array',
                  items: { type: 'integer' },
                  description: isZh
                    ? '属于该组的标签序号（从 1 开始）'
                    : 'Tab indices belonging to this group (1-based)',
                },
              },
              required: ['name', 'color', 'indices'],
            },
          },
        },
        required: ['groups'],
      },
    },
  } as const
}

export const SUBMIT_TAB_GROUPS_TOOL = getSubmitTabGroupsTool(true)

export function getTabGroupsSystemPrompt(isZh = isZhLanguage()): string {
  return isZh
    ? `你是浏览器标签页整理助手。根据用户的整理策略与当前标签列表，为标签页提供合理的主题分组方案。本次仅做标签分类归组，不要关闭任何标签页。请调用 submit_tab_groups 工具提交分组方案。`
    : `You are a browser tab organization assistant. Group the browser tabs logically into topic categories based on user policies and the tab list. This operation is ONLY for classifying and grouping tabs; do NOT close any tabs. Submit the grouping plan using the submit_tab_groups tool.`
}

const DEFAULT_MODELS: Record<AIConfig['provider'], string> = {
  deepseek: 'deepseek-chat',
  qwen: 'qwen-turbo',
  kimi: 'moonshot-v1-8k',
  zhipu: 'glm-4-flash',
  minimax: 'abab6.5s-chat',
  openai: 'gpt-4o-mini',
  claude: 'claude-3-5-haiku-20241022',
  gemini: 'gemini-2.0-flash',
  custom: 'qwen2.5:7b',
}

const VALID_COLORS: ChromeTabGroupColor[] = [
  'grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan',
]

const MAX_GROUP_NAME_LENGTH = 40

const BATCH_SIZE = 20

/**
 * Unified AI client that supports OpenAI, Claude, Gemini, and custom endpoints.
 */
export class AIClient {
  private config: AIConfig

  constructor(config: AIConfig) {
    this.config = config
  }

  /**
   * Test the connection with a simple request.
   */
  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      const response = await this.chat('Reply with exactly: OK')
      const text = `${response}`.trim()
      // Reasoning models may put tokens in reasoning and leave content empty
      return { ok: text.length === 0 || /OK/i.test(text) }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  }

  /**
   * Ask the model to produce a cleanup plan for the given tabs.
   * `tabs` are 1-indexed in the prompt; the extension maps indices back to tabIds.
   */
  async generateCleanupPlan(
    tabs: { id: number; title: string; url: string; pinned?: boolean; active?: boolean }[],
    policies?: string,
  ): Promise<GeneratedCleanupPlan> {
    const list = tabs
      .map((t, i) => {
        const flags = [t.pinned ? 'pinned' : '', t.active ? 'active' : ''].filter(Boolean).join(',')
        let host = ''
        try {
          host = new URL(t.url).hostname.replace(/^www\./, '')
        } catch {
          host = t.url
        }
        const title = t.title || ''
        return `${i + 1}. ${title} | ${host}${flags ? ` | ${flags}` : ''} | ${t.url}`
      })
      .join('\n')

    const isZh = isZhLanguage()
    const policyText = policies || DEFAULT_POLICIES
    const prompt = isZh
      ? `根据用户策略，分析当前窗口的标签页并提交整理方案。

## 策略
${policyText}

## 当前标签（index | 标题 | 域名 | 标记 | URL）
${list}

## 要求
- pinned 与 active 标签不要放进 close
- close：广告/弹窗/搜索结果/一次性/冗余重复页等建议关闭的标签（附带简要理由，如"同站重复"/"搜索结果"/"临时确认"等）
- groups：对标签进行逻辑分组；组名用中文短词；color ∈ grey,blue,red,yellow,green,pink,purple,cyan
- 关键规则：被建议 close 的候选标签（如同站重复页、搜索页等），若属于某个主题，也应同时列入对应的 groups（当用户选择不关闭时，可直接规整进该组）
- keep：明确保留且不必进组的标签`
      : `Analyze the tabs in the current window according to user policies and submit a cleanup plan.

## Policies
${policyText}

## Current Tabs (index | title | domain | flags | URL)
${list}

## Requirements
- Do NOT put pinned or active tabs into close
- close: Tabs recommended to close (ads, popups, search results, one-time queries, redundant duplicates, with a brief reason like "Duplicate domain", "Search results", "Temporary")
- groups: Group tabs logically with concise English names (e.g. Work, Dev, Research); color ∈ grey,blue,red,yellow,green,pink,purple,cyan
- Key rule: Candidate tabs suggested for close (like duplicate pages, search pages) should also be listed in their corresponding topic group if they fit one (so if the user unchecks closing them, they will be organized into that group)
- keep: Tabs explicitly kept without grouping`

    const systemPrompt = getCleanupSystemPrompt(isZh)
    const cleanupTool = getSubmitCleanupPlanTool(isZh)
    const res = await this.chatForCleanupWithTool(prompt, systemPrompt, cleanupTool)
    if (res.args && typeof res.args === 'object') {
      return this.normalizeCleanupPlan(res.args, tabs.length, res.raw)
    }
    return this.parseCleanupPlan(res.content || res.raw, tabs.length)
  }

  private normalizeCleanupPlan(
    parsed: any,
    tabCount: number,
    raw: string,
  ): GeneratedCleanupPlan {
    const toNum = (n: unknown): number => (typeof n === 'number' ? n : Number(n))
    const valid = (n: unknown): boolean => {
      const num = toNum(n)
      return Number.isInteger(num) && num >= 1 && num <= tabCount
    }
    const close = (parsed.close || [])
      .filter((x: any) => valid(x?.index))
      .map((x: any) => ({ index: toNum(x.index), reason: x.reason ? String(x.reason) : undefined }))
    const keep = (parsed.keep || [])
      .filter((x: any) => valid(x?.index))
      .map((x: any) => ({ index: toNum(x.index), reason: x.reason ? String(x.reason) : undefined }))
    const colors: ChromeTabGroupColor[] = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan']
    const groups = (parsed.groups || [])
      .map((g: any, i: number) => ({
        name: String(g?.name || `Group ${i + 1}`).slice(0, MAX_GROUP_NAME_LENGTH),
        color: (colors.includes(g?.color as ChromeTabGroupColor) ? g.color : colors[i % colors.length]) as string,
        indices: (g?.indices || []).filter(valid).map(toNum),
      }))
      .filter((g: any) => g.indices.length > 0)

    return { close, groups, keep, raw }
  }

  private async chatForTool(
    userMessage: string,
    systemPrompt: string,
    tool: any,
  ): Promise<{ args?: any; content?: string; raw: string }> {
    const { provider } = this.config
    if (provider === 'claude') {
      return this.chatClaudeSingleTool(userMessage, systemPrompt, tool)
    }
    if (provider === 'gemini') {
      return this.chatGeminiSingleTool(userMessage, systemPrompt, tool)
    }
    return this.chatOpenAISingleTool(userMessage, systemPrompt, tool)
  }

  private async chatForCleanupWithTool(
    userMessage: string,
    systemPrompt = getCleanupSystemPrompt(),
    tool: any = getSubmitCleanupPlanTool(),
  ): Promise<{ args?: any; content?: string; raw: string }> {
    return this.chatForTool(userMessage, systemPrompt, tool)
  }

  private async chatOpenAISingleTool(
    userMessage: string,
    systemPrompt: string,
    tool: any,
  ): Promise<{ args?: any; content?: string; raw: string }> {
    const toolName = tool.function?.name || 'tool'
    const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: this.config.model || this.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        tools: [tool],
        tool_choice: {
          type: 'function',
          function: { name: toolName },
        },
        temperature: 0.1,
        max_tokens: 8192,
        ...this.extraBody,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`API error ${response.status}: ${err}`)
    }

    const data = await response.json()
    const msg = data.choices?.[0]?.message
    const toolCalls = msg?.tool_calls
    const call = toolCalls?.find((tc: any) => tc.function?.name === toolName) || toolCalls?.[0]

    if (call?.function?.arguments) {
      let args = call.function.arguments
      if (typeof args === 'string') {
        try {
          args = JSON.parse(args)
        } catch {
          try {
            args = JSON.parse(args.replace(/,\s*([}\]])/g, '$1'))
          } catch {
            return { content: args, raw: JSON.stringify(data) }
          }
        }
      }
      return { args, raw: JSON.stringify(data) }
    }

    const content = msg?.content || ''
    const reasoning = msg?.reasoning_content || msg?.reasoning || ''
    return { content: content || reasoning || '', raw: JSON.stringify(data) }
  }

  private async chatClaudeSingleTool(
    userMessage: string,
    systemPrompt: string,
    tool: any,
  ): Promise<{ args?: any; content?: string; raw: string }> {
    const toolName = tool.function?.name || 'tool'
    const baseUrl = (this.config.endpoint || 'https://api.anthropic.com').replace(/\/+$/, '')
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: this.config.model || this.defaultModel,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        tools: [
          {
            name: toolName,
            description: tool.function.description,
            input_schema: tool.function.parameters,
          },
        ],
        tool_choice: {
          type: 'tool',
          name: toolName,
        },
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`API error ${response.status}: ${err}`)
    }

    const data = await response.json()
    const contentBlocks = data.content || []
    const toolUse = contentBlocks.find((b: any) => b.type === 'tool_use' && b.name === toolName)
      || contentBlocks.find((b: any) => b.type === 'tool_use')

    if (toolUse?.input) {
      return { args: toolUse.input, raw: JSON.stringify(data) }
    }

    const textBlock = contentBlocks.find((b: any) => b.type === 'text')
    return { content: textBlock?.text || '', raw: JSON.stringify(data) }
  }

  private async chatGeminiSingleTool(
    userMessage: string,
    systemPrompt: string,
    tool: any,
  ): Promise<{ args?: any; content?: string; raw: string }> {
    const toolName = tool.function?.name || 'tool'
    const baseUrl = (this.config.endpoint || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '')
    const model = this.config.model || this.defaultModel
    const isThinkingModel = model.toLowerCase().includes('thinking')
    const response = await fetch(
      `${baseUrl}/v1beta/models/${model}:generateContent?key=${this.config.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userMessage }] }],
          tools: [
            {
              functionDeclarations: [
                {
                  name: toolName,
                  description: tool.function.description,
                  parameters: tool.function.parameters,
                },
              ],
            },
          ],
          toolConfig: {
            functionCallingConfig: {
              mode: 'ANY',
              allowedFunctionNames: [toolName],
            },
          },
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
            ...(isThinkingModel && { thinkingConfig: { thinkingBudget: 0 } }),
          },
        }),
      },
    )

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`API error ${response.status}: ${err}`)
    }

    const data = await response.json()
    const parts = data.candidates?.[0]?.content?.parts || []
    const functionCallPart = parts.find((p: any) => p.functionCall?.name === toolName)
      || parts.find((p: any) => p.functionCall)

    if (functionCallPart?.functionCall?.args) {
      return { args: functionCallPart.functionCall.args, raw: JSON.stringify(data) }
    }

    const textPart = parts.find((p: any) => p.text)
    return { content: textPart?.text || '', raw: JSON.stringify(data) }
  }

  private parseCleanupPlan(
    raw: string,
    tabCount: number,
  ): GeneratedCleanupPlan {
    let text = (raw || '').trim()
    const fence = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
    if (fence) text = fence[1].trim()
    const start = text.indexOf('{')
    if (start >= 0) text = text.slice(start)

    let parsed: {
      close?: { index: number; reason?: string }[]
      groups?: { name: string; color?: string; indices: number[] }[]
      keep?: { index: number; reason?: string }[]
    } | null = null

    // 1. Direct parse attempt
    try {
      parsed = JSON.parse(text)
    } catch {}

    // 2. Trailing comma cleanup attempt
    if (!parsed) {
      try {
        parsed = JSON.parse(text.replace(/,\s*([}\]])/g, '$1'))
      } catch {}
    }

    // 3. Truncated output repair attempt: find last complete object/array boundary & auto-balance brackets
    if (!parsed) {
      const lastBrace = text.lastIndexOf('}')
      const lastBracket = text.lastIndexOf(']')
      const cut = Math.max(lastBrace, lastBracket)
      if (cut > 0) {
        let candidate = text.slice(0, cut + 1).replace(/,\s*$/, '')
        let openBrackets = 0
        let openBraces = 0
        let inString = false
        let escape = false

        for (let i = 0; i < candidate.length; i++) {
          const ch = candidate[i]
          if (escape) {
            escape = false
            continue
          }
          if (ch === '\\') {
            escape = true
            continue
          }
          if (ch === '"') {
            inString = !inString
            continue
          }
          if (!inString) {
            if (ch === '[') openBrackets++
            else if (ch === ']') openBrackets--
            else if (ch === '{') openBraces++
            else if (ch === '}') openBraces--
          }
        }

        for (let i = 0; i < openBrackets; i++) candidate += ']'
        for (let i = 0; i < openBraces; i++) candidate += '}'
        candidate = candidate.replace(/,\s*([}\]])/g, '$1')

        try {
          parsed = JSON.parse(candidate)
        } catch {}
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error(`AI plan is not JSON: ${raw.slice(0, 200)}`)
    }

    return this.normalizeCleanupPlan(parsed, tabCount, raw)
  }

  /**
   * Multi-turn chat about the user's tabs. Tab list + policies are injected as context.
   * If the model wants a concrete cleanup, it should emit a ```plan_json block.
   */
  async chatAboutTabs(
    history: { role: 'user' | 'assistant'; content: string }[],
    tabs: { id: number; title: string; url: string; pinned?: boolean; active?: boolean }[],
    policies?: string,
  ): Promise<string> {
    const list = tabs
      .map((t, i) => {
        const flags = [t.pinned ? 'pinned' : '', t.active ? 'active' : ''].filter(Boolean).join(',')
        let host = ''
        try {
          host = new URL(t.url).hostname.replace(/^www\./, '')
        } catch {
          host = t.url.slice(0, 40)
        }
        return `${i + 1}#id=${t.id}# ${t.title || ''} | ${host}${flags ? ` | ${flags}` : ''}`
      })
      .join('\n')

    const isZh = isZhLanguage()
    const policyText = policies || DEFAULT_POLICIES
    const system = isZh
      ? `你是浏览器标签页助手。用中文简洁回答。
当前窗口标签（格式：序号#id=真实tabId# 标题 | 域名 | 标记）：
${list || '(无)'}

## 用户策略
${policyText}

## 能力
1. 根据策略分析该关哪些、怎么分组，并解释理由
2. 若用户要求整理/关闭，优先输出 plan_json 代码块（index 为标签序号）：

\`\`\`plan_json
{"close":[{"index":2,"reason":"广告"}],"groups":[{"name":"工作","color":"blue","indices":[3,4]}],"keep":[{"index":1,"reason":"固定"}]}
\`\`\`

也可用真实 tabId：

\`\`\`plan_json
{"closeTabIds":[12,15],"groups":[{"name":"工作","color":"blue","tabIds":[13,14]}]}
\`\`\`

- index 对应标签列表序号；tabId 对应 #id=数字
- pinned、active 不要放进 close
- color ∈ grey,blue,red,yellow,green,pink,purple,cyan
- 只有用户明确要整理/关闭时才输出 plan_json；纯提问则只聊天
- 若输出了计划，不要在同一回复里再嵌套另一份 JSON`
      : `You are a browser tab assistant. Reply concisely in English.
Current window tabs (format: index#id=realTabId# Title | Domain | Flags):
${list || '(None)'}

## User Policies
${policyText}

## Capabilities
1. Analyze which tabs to close and how to group them based on policies, explaining reasons
2. If the user asks to organize/close, prefer outputting a plan_json codeblock (index is tab index):

\`\`\`plan_json
{"close":[{"index":2,"reason":"Ads"}],"groups":[{"name":"Work","color":"blue","indices":[3,4]}],"keep":[{"index":1,"reason":"Pinned"}]}
\`\`\`

You can also use real tabId:

\`\`\`plan_json
{"closeTabIds":[12,15],"groups":[{"name":"Work","color":"blue","tabIds":[13,14]}]}
\`\`\`

- index corresponds to tab list index; tabId corresponds to #id=number
- pinned and active tabs must NOT be put into close
- color ∈ grey,blue,red,yellow,green,pink,purple,cyan
- Only output plan_json when the user explicitly requests cleanup/organization; otherwise chat normally
- Do not nest duplicate JSON if a plan is output`

    const userTurns = history.filter((m) => m.role === 'user' || m.role === 'assistant').slice(-12)
    const raw = await this.chatWithSystemHistory(system, userTurns)
    return raw
  }

  private async chatWithSystemHistory(
    system: string,
    history: { role: string; content: string }[],
  ): Promise<string> {
    const isZh = isZhLanguage()
    const provider = this.config.provider
    const messages = [
      { role: 'system', content: system },
      ...history.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    ]
    if (provider === 'claude' || provider === 'gemini') {
      // Reuse OpenAI-compatible path for custom; for others flatten history into one user message
      const flat = history.map((m) => `${m.role}: ${m.content}`).join('\n')
      const replyInstruction = isZh ? '请以助手身份回复最后一条用户消息。' : 'Please reply to the latest user message as an assistant.'
      return this.chat(`${system}\n\n---\n${flat}\n\n${replyInstruction}`)
    }
    const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: this.config.model || this.defaultModel,
        messages,
        temperature: 0.3,
        max_tokens: 8192,
        ...this.extraBody,
      }),
    })
    if (!response.ok) {
      const err = await response.text()
      throw new Error(`API error ${response.status}: ${err}`)
    }
    const data = await response.json()
    const msg = data.choices?.[0]?.message
    const content = msg?.content || ''
    const reasoning = msg?.reasoning_content || msg.reasoning || ''
    if (content && content.trim()) return content
    if (reasoning) {
      const m = String(reasoning).match(/\{[\s\S]*\}/)
      return m ? m[0] : String(reasoning).slice(0, 2000)
    }
    return ''
  }

  /**
   * One chat.completions call that may return tool_calls (OpenAI-compatible).
   * `tools` must already be OpenAI format: { type: 'function', function: { name, description, parameters } }.
   * Do NOT wrap again — llama.cpp/vLLM errors with "key 'name' not found" if function.name is missing.
   */
  async chatWithTools(
    messages: Record<string, unknown>[],
    tools: Record<string, unknown>[],
  ): Promise<{
    content: string
    toolCalls: { id: string; name: string; arguments: string }[]
  }> {
    const openaiTools = tools.map((t) => {
      // Accept either OpenAI nested or flat { name, description, parameters }
      if (t && typeof t === 'object' && t.function && typeof t.function === 'object') {
        return t
      }
      return {
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters || { type: 'object', properties: {} },
        },
      }
    })
    const body = {
      model: this.config.model || this.defaultModel,
      messages,
      tools: openaiTools,
      tool_choice: 'auto',
      temperature: 0.2,
      max_tokens: 8192,
      ...this.extraBody,
    }
    const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const err = await response.text()
      throw new Error(`API error ${response.status}: ${err}`)
    }
    const data = await response.json()
    const msg = data.choices?.[0]?.message || {}
    const toolCalls = (msg.tool_calls || []).map((tc: { id?: string; function?: { name?: string; arguments?: string } }, i: number) => ({
      id: tc.id || `call_${i}`,
      name: tc.function?.name || '',
      arguments: tc.function?.arguments || '{}',
    }))
    return { content: msg.content || '', toolCalls }
  }

  /**
   * Classify tabs that the rule engine couldn't confidently categorize.
   */
  async classifyTabs(
    tabs: { url: string; title: string }[],
    categories: GroupCategory[],
  ): Promise<Map<string, GroupCategory>> {
    if (tabs.length === 0) return new Map()

    const tabDescriptions = tabs
      .map((t, i) => `${i + 1}. [${t.title}] ${t.url}`)
      .join('\n')

    const prompt = `Classify each browser tab into one of these categories: ${categories.join(', ')}.

Tabs:
${tabDescriptions}

Respond with a JSON array where each element has "index" (1-based) and "category". Example:
[{"index": 1, "category": "dev"}, {"index": 2, "category": "media"}]

Only output the JSON array, no other text.`

    const response = await this.chat(prompt)

    // Parse response
    const result = new Map<string, GroupCategory>()
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { index: number; category: string }[]
        for (const item of parsed) {
          const tab = tabs[item.index - 1]
          if (tab && categories.includes(item.category as GroupCategory)) {
            result.set(tab.url, item.category as GroupCategory)
          }
        }
      }
    } catch {
      console.error('[TabSweep] Failed to parse AI response:', response)
    }

    return result
  }

  /**
   * Fast tab grouping using tool calling (submit_tab_groups).
   * Pure grouping, never closes any tabs, zero-modal, aligns with user policies.
   */
  async fastGroupTabs(
    tabs: { id: number; title: string; url: string }[],
    policies?: string,
  ): Promise<{ name: string; color: ChromeTabGroupColor; tabIds: number[] }[]> {
    if (tabs.length === 0) return []

    const list = tabs
      .map((t, i) => {
        let host = ''
        try {
          host = new URL(t.url).hostname.replace(/^www\./, '')
        } catch {
          host = t.url
        }
        const title = t.title || host || ''
        return `${i + 1}. ${title} | ${host} | ${t.url}`
      })
      .join('\n')

    const isZh = isZhLanguage()
    const policyText = policies || DEFAULT_POLICIES
    const prompt = isZh
      ? `根据用户策略，为当前窗口的标签页进行分类分组。

## 策略
${policyText}

## 当前标签（序号. 标题 | 域名 | URL）
${list}

## 要求
- 本次仅进行【归类分组】，不要关闭任何标签页，请将所有有效标签全部合理规整到对应的主题组中
- 组名采用简洁的中文短词（2-4字，如学习、开发、工作、资料等）
- 每组必须包含属于该组的标签序号（从 1 开始）
- 必须调用 submit_tab_groups 提交方案`
      : `Group the tabs in the current window into categories based on user policies.

## Policies
${policyText}

## Current Tabs (Index. Title | Domain | URL)
${list}

## Requirements
- This task is ONLY for categorization and grouping. Do NOT close any tabs. Place all tabs into appropriate topic groups.
- Group names should be concise English words (e.g. Work, Dev, Study, Reading, Media, Tools).
- Each group must include a list of valid tab indices (1-based).
- You must call submit_tab_groups to submit the grouping plan.`

    const systemPrompt = getTabGroupsSystemPrompt(isZh)
    const tool = getSubmitTabGroupsTool(isZh)
    const res = await this.chatForTool(prompt, systemPrompt, tool)

    let parsedGroups: { name: string; color: ChromeTabGroupColor; indices: number[] }[] = []

    if (res.args && typeof res.args === 'object') {
      const rawGroups = (res.args as { groups?: unknown[] }).groups
      if (Array.isArray(rawGroups)) {
        parsedGroups = rawGroups as typeof parsedGroups
      }
    } else if (res.content) {
      try {
        const cleaned = res.content.trim()
        const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
        const jsonText = fenceMatch ? fenceMatch[1].trim() : cleaned
        const parsed = JSON.parse(jsonText)
        if (Array.isArray(parsed)) {
          parsedGroups = parsed
        } else if (parsed && Array.isArray(parsed.groups)) {
          parsedGroups = parsed.groups
        }
      } catch {
        // parsing fallback failed
      }
    }

    const colors: ChromeTabGroupColor[] = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan']
    const result: { name: string; color: ChromeTabGroupColor; tabIds: number[] }[] = []
    const assignedTabIds = new Set<number>()

    for (let i = 0; i < parsedGroups.length; i++) {
      const g = parsedGroups[i]
      if (!g || !g.name || !Array.isArray(g.indices)) continue
      const name = String(g.name).slice(0, MAX_GROUP_NAME_LENGTH)
      const color: ChromeTabGroupColor = colors.includes(g.color) ? g.color : colors[i % colors.length]
      const tabIds: number[] = []

      for (const idx of g.indices) {
        const num = Number(idx)
        if (Number.isInteger(num) && num >= 1 && num <= tabs.length) {
          const tab = tabs[num - 1]
          if (tab && !assignedTabIds.has(tab.id)) {
            assignedTabIds.add(tab.id)
            tabIds.push(tab.id)
          }
        }
      }

      if (tabIds.length > 0) {
        result.push({ name, color, tabIds })
      }
    }

    // Collect unassigned tabs into an "Other" / "其它" fallback group
    const unassigned = tabs.filter((t) => !assignedTabIds.has(t.id))
    if (unassigned.length > 0) {
      const fallbackName = isZh ? '其它' : 'Other'
      const existingOther = result.find(
        (g) => g.name === fallbackName || g.name.toLowerCase() === 'other' || g.name === '其它',
      )
      if (existingOther) {
        existingOther.tabIds.push(...unassigned.map((t) => t.id))
      } else {
        result.push({
          name: fallbackName,
          color: 'grey',
          tabIds: unassigned.map((t) => t.id),
        })
      }
    }

    if (result.length === 0) {
      throw new Error('AI returned no valid tab groups')
    }

    return result
  }

  /**
   * Let AI freely group tabs into dynamic groups with custom names and colors.
   * Splits into batches when tab count exceeds BATCH_SIZE.
   */
  async groupTabsFreely(
    tabs: { url: string; title: string }[],
    policies?: string,
  ): Promise<AIGroupResult[]> {
    if (tabs.length === 0) return []

    try {
      const groups = await this.fastGroupTabs(
        tabs.map((t, i) => ({ id: i + 1, title: t.title, url: t.url })),
        policies,
      )
      return groups.map((g) => ({
        name: g.name,
        color: g.color,
        tabIndices: g.tabIds,
      }))
    } catch {
      if (tabs.length <= BATCH_SIZE) {
        return this.groupTabsBatch(tabs, 0)
      }

      const allResults: AIGroupResult[] = []
      for (let i = 0; i < tabs.length; i += BATCH_SIZE) {
        const batch = tabs.slice(i, i + BATCH_SIZE)
        const batchResults = await this.groupTabsBatch(batch, i)
        allResults.push(...batchResults)
      }
      return allResults
    }
  }

  private formatTabForPrompt(tab: { url: string; title: string }, index: number): string {
    const domain = new URL(tab.url).hostname.replace(/^www\./, '')
    const title = tab.title || ''
    return `${index}. ${title} (${domain})`
  }

  private async groupTabsBatch(
    tabs: { url: string; title: string }[],
    offset: number,
  ): Promise<AIGroupResult[]> {
    const tabDescriptions = tabs
      .map((t, i) => this.formatTabForPrompt(t, offset + i + 1))
      .join('\n')

    const prompt = `Organize these browser tabs into groups.
Create 2-8 groups. Each needs a short name (2-4 words, same language as tab titles).
Colors: grey,blue,red,yellow,green,pink,purple,cyan

Tabs:
${tabDescriptions}

JSON format: [{"name":"...","color":"...","tabIndices":[1,2]}]`

    const response = await this.chat(prompt, true)
    return this.parseFreeGroupResponse(response, offset + tabs.length, offset + 1)
  }

  private parseFreeGroupResponse(response: string, maxIndex: number, minIndex = 1): AIGroupResult[] {
    // Strip markdown code fences if present
    let cleaned = response.trim()
    const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
    if (fenceMatch) {
      cleaned = fenceMatch[1].trim()
    }

    try {
      const parsedObj = JSON.parse(cleaned)
      if (parsedObj && Array.isArray(parsedObj.groups)) {
        cleaned = JSON.stringify(parsedObj.groups)
      }
    } catch {
      // not direct JSON object
    }

    // Find the start of the JSON array
    const startIdx = cleaned.indexOf('[')
    const endIdx = cleaned.lastIndexOf(']')
    if (startIdx === -1) {
      throw new Error(`No JSON array found in AI response: ${response.slice(0, 200)}`)
    }

    let jsonStr = endIdx > startIdx ? cleaned.slice(startIdx, endIdx + 1) : cleaned.slice(startIdx)

    // Clean trailing commas before ] or } (common LLM mistake)
    jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1')

    // Try to parse directly first
    let parsed: { name: string; tabIndices: number[]; color?: string }[]
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      // Likely truncated. Repair: find the last complete object and close the array.
      const lastCompleteObj = jsonStr.lastIndexOf('}')
      if (lastCompleteObj <= 0) {
        throw new Error(`Truncated AI response with no complete objects: ${response.slice(0, 200)}`)
      }
      jsonStr = jsonStr.slice(0, lastCompleteObj + 1) + ']'
      jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1')
      try {
        parsed = JSON.parse(jsonStr)
      } catch {
        throw new Error(`Failed to parse AI JSON: ${jsonStr.slice(0, 300)}`)
      }
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('AI returned empty or invalid groups')
    }

    const assignedIndices = new Set<number>()
    const results: AIGroupResult[] = []

    for (let gi = 0; gi < parsed.length; gi++) {
      const group = parsed[gi]
      if (!group.name || !Array.isArray(group.tabIndices)) continue

      const validIndices: number[] = []
      for (const idx of group.tabIndices) {
        if (idx >= minIndex && idx <= maxIndex && !assignedIndices.has(idx)) {
          assignedIndices.add(idx)
          validIndices.push(idx)
        }
      }

      if (validIndices.length === 0) continue

      const color: ChromeTabGroupColor = VALID_COLORS.includes(group.color as ChromeTabGroupColor)
        ? (group.color as ChromeTabGroupColor)
        : VALID_COLORS[gi % VALID_COLORS.length]

      results.push({
        name: group.name.slice(0, MAX_GROUP_NAME_LENGTH),
        tabIndices: validIndices,
        color,
      })
    }

    // Collect unassigned tabs into an "Other" group
    const unassigned: number[] = []
    for (let i = minIndex; i <= maxIndex; i++) {
      if (!assignedIndices.has(i)) unassigned.push(i)
    }
    if (unassigned.length > 0) {
      results.push({ name: 'Other', tabIndices: unassigned, color: 'grey' })
    }

    return results
  }

  /**
   * Classify new tabs into existing groups by name.
   * Returns a map of tab index (0-based) to target group name,
   * or a new group descriptor if no existing group fits.
   */
  async classifyNewTabsIntoGroups(
    tabs: { url: string; title: string }[],
    existingGroupNames: string[],
  ): Promise<{ index: number; group: string; newGroupName?: string; newGroupColor?: string }[]> {
    if (tabs.length === 0) return []

    const tabDescriptions = tabs
      .map((t, i) => this.formatTabForPrompt(t, i + 1))
      .join('\n')

    const prompt = `I have these existing tab groups: ${existingGroupNames.map((n) => `"${n}"`).join(', ')}.

New tabs to classify:
${tabDescriptions}

For each tab, decide which existing group it belongs to. If none fit, use "NEW" and suggest a name and color.
Colors: grey,blue,red,yellow,green,pink,purple,cyan

JSON format: [{"index":1,"group":"existing group name"}] or [{"index":2,"group":"NEW","newGroupName":"...","newGroupColor":"blue"}]
Only output the JSON array.`

    const response = await this.chat(prompt, true)

    try {
      const cleaned = response.trim()
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/)
      if (!jsonMatch) return this.fallbackAllToNew(tabs)

      let jsonStr = jsonMatch[0].replace(/,\s*([}\]])/g, '$1')
      const parsed = JSON.parse(jsonStr) as {
        index: number
        group: string
        newGroupName?: string
        newGroupColor?: string
      }[]

      const validGroupNames = new Set(existingGroupNames)
      return parsed
        .filter((item) => item.index >= 1 && item.index <= tabs.length)
        .map((item) => ({
          index: item.index - 1,
          group: item.group === 'NEW' ? 'NEW' : (validGroupNames.has(item.group) ? item.group : 'NEW'),
          newGroupName: item.newGroupName?.slice(0, MAX_GROUP_NAME_LENGTH),
          newGroupColor: VALID_COLORS.includes(item.newGroupColor as ChromeTabGroupColor)
            ? item.newGroupColor
            : undefined,
        }))
    } catch {
      console.error('[TabSweep] Failed to parse classify-new-tabs response:', response)
      return this.fallbackAllToNew(tabs)
    }
  }

  private fallbackAllToNew(tabs: { url: string; title: string }[]): { index: number; group: string }[] {
    return tabs.map((_, i) => ({ index: i, group: 'NEW', newGroupName: 'Uncategorized', newGroupColor: 'grey' }))
  }

  /**
   * Send a chat completion request.
   */
  async chat(userMessage: string, jsonMode?: boolean): Promise<string> {
    const { provider } = this.config

    if (provider === 'claude') {
      return this.chatClaude(userMessage, jsonMode)
    }

    if (provider === 'gemini') {
      return this.chatGemini(userMessage, jsonMode)
    }

    // OpenAI / Custom (OpenAI-compatible)
    return this.chatOpenAI(userMessage, jsonMode)
  }

  private get defaultModel(): string {
    return DEFAULT_MODELS[this.config.provider]
  }

  private async chatOpenAI(userMessage: string, jsonMode?: boolean): Promise<string> {
    const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: this.config.model || this.defaultModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0,
        max_tokens: 8192,
        ...this.extraBody,
        ...(jsonMode && { response_format: { type: 'json_object' } }),
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`API error ${response.status}: ${err}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content || ''
  }

  private async chatClaude(userMessage: string, jsonMode?: boolean): Promise<string> {
    const baseUrl = (this.config.endpoint || 'https://api.anthropic.com').replace(/\/+$/, '')
    const messages: { role: string; content: string }[] = [
      { role: 'user', content: userMessage },
      ...(jsonMode ? [{ role: 'assistant', content: '[' }] : []),
    ]
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: this.config.model || this.defaultModel,
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`API error ${response.status}: ${err}`)
    }

    const data = await response.json()
    const text = data.content[0]?.text || ''
    return jsonMode ? '[' + text : text
  }

  private async chatGemini(userMessage: string, jsonMode?: boolean): Promise<string> {
    const baseUrl = (this.config.endpoint || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '')
    const model = this.config.model || this.defaultModel
    const isThinkingModel = model.toLowerCase().includes('thinking')
    const response = await fetch(
      `${baseUrl}/v1beta/models/${model}:generateContent?key=${this.config.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }],
          },
          contents: [
            { role: 'user', parts: [{ text: userMessage }] },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 8192,
            ...(jsonMode && { responseMimeType: 'application/json' }),
            ...(isThinkingModel && { thinkingConfig: { thinkingBudget: 0 } }),
          },
        }),
      },
    )

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`API error ${response.status}: ${err}`)
    }

    const data = await response.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }

  private getBaseUrl(): string {
    const preset = PROVIDER_PRESETS[this.config.provider]
    let base = ''
    if (preset?.isLockedEndpoint) {
      base = preset.endpoint
    } else {
      base = this.config.endpoint || preset?.endpoint || 'https://api.openai.com/v1'
    }
    return base.replace(/\/chat\/completions\/?$/, '').replace(/\/+$/, '')
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    // Local OpenAI-compatible servers often accept empty/missing keys
    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`
    }
    return headers
  }

  /**
   * Disable thinking/reasoning across providers to maximize response speed for quick tab operations.
   */
  private get extraBody(): Record<string, unknown> {
    const { provider } = this.config
    switch (provider) {
      case 'deepseek':
        // Explicitly disable thinking for DeepSeek official API
        return {
          thinking: { type: 'disabled' },
        }
      case 'qwen':
        // Disable thinking for DashScope and local Qwen models
        return {
          enable_thinking: false,
          chat_template_kwargs: { enable_thinking: false },
        }
      case 'kimi':
        // Kimi 官方接口不接受 thinking 字段，返回空对象防止 400 (Unrecognized argument)
        return {}
      case 'zhipu':
        // 智谱 API 白名单拦截未知字段，返回空对象防止 400 (错误码 1214)
        return {}
      case 'minimax':
        return {}
      case 'openai':
        return {}
      case 'custom':
      default:
        // Local vLLM/Ollama Qwen/DeepSeek and gateway proxies
        return {
          enable_thinking: false,
          chat_template_kwargs: { enable_thinking: false },
        }
    }
  }

  private async chatOpenAIWithSystem(userMessage: string, system: string, jsonMode?: boolean): Promise<string> {
    const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: this.config.model || this.defaultModel,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userMessage },
        ],
        temperature: 0,
        max_tokens: 8192,
        ...this.extraBody,
        ...(jsonMode && { response_format: { type: 'json_object' } }),
      }),
    })
    if (!response.ok) {
      const err = await response.text()
      throw new Error(`API error ${response.status}: ${err}`)
    }
    const data = await response.json()
    const msg = data.choices?.[0]?.message
    const content = msg?.content || ''
    const reasoning = msg?.reasoning_content || msg?.reasoning || ''
    // Local reasoning models may spend all tokens on reasoning; try to salvage JSON
    if (content && content.trim()) return content
    if (reasoning && /{[\s\S]*}/.test(reasoning)) {
      const m = reasoning.match(/\{[\s\S]*\}/)
      return m ? m[0] : reasoning
    }
    return content || reasoning || ''
  }

  private async chatClaudeWithSystem(userMessage: string, system: string): Promise<string> {
    const baseUrl = (this.config.endpoint || 'https://api.anthropic.com').replace(/\/+$/, '')
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: this.config.model || this.defaultModel,
        max_tokens: 8192,
        system,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })
    if (!response.ok) {
      const err = await response.text()
      throw new Error(`API error ${response.status}: ${err}`)
    }
    const data = await response.json()
    return data.content?.[0]?.text || ''
  }

  private async chatGeminiWithSystem(userMessage: string, system: string, jsonMode?: boolean): Promise<string> {
    const baseUrl = (this.config.endpoint || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '')
    const model = this.config.model || this.defaultModel
    const isThinkingModel = model.toLowerCase().includes('thinking')
    const response = await fetch(
      `${baseUrl}/v1beta/models/${model}:generateContent?key=${this.config.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: userMessage }] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 8192,
            ...(jsonMode && { responseMimeType: 'application/json' }),
            ...(isThinkingModel && { thinkingConfig: { thinkingBudget: 0 } }),
          },
        }),
      },
    )
    if (!response.ok) {
      const err = await response.text()
      throw new Error(`API error ${response.status}: ${err}`)
    }
    const data = await response.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }
}

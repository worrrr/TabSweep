/**
 * Pure chat-history windowing (no chrome APIs) — unit-testable.
 * LLM input keeps only the last N turns; older turns are summarized.
 */

import { isZhLanguage } from './i18n'

export interface ChatTurn {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface WindowResult {
  /** Messages to send to the LLM (excluding system). */
  recent: ChatTurn[]
  /** Messages that should be folded into the summary. */
  older: ChatTurn[]
  /** True when older.length > 0. */
  truncated: boolean
}

/**
 * Split history into older (for summary) and recent (verbatim).
 * A "turn" is one user message + the assistant reply after it.
 * Keeps the last `keepTurns` user-initiated turns in `recent`.
 */
export function windowChatHistory(history: ChatTurn[], keepTurns = 5): WindowResult {
  const items = history.filter((m) => m.role === 'user' || m.role === 'assistant')
  if (keepTurns < 1) keepTurns = 1

  // Find indices of user messages
  const userIdxs: number[] = []
  items.forEach((m, i) => {
    if (m.role === 'user') userIdxs.push(i)
  })

  if (userIdxs.length <= keepTurns) {
    return { recent: items.slice(), older: [], truncated: false }
  }

  // Start of the Nth-from-last user turn
  const cut = userIdxs[userIdxs.length - keepTurns]
  return {
    older: items.slice(0, cut),
    recent: items.slice(cut),
    truncated: true,
  }
}

/**
 * Cheap summary without an LLM: list user asks + last assistant snippet.
 * Used as fallback when summarize API fails or for tests.
 */
export function naiveSummarize(older: ChatTurn[], prevSummary = '', isZh = isZhLanguage()): string {
  const lines: string[] = []
  if (prevSummary.trim()) lines.push(prevSummary.trim())
  for (const m of older) {
    const text = m.content.replace(/\s+/g, ' ').trim().slice(0, 120)
    if (!text) continue
    const roleLabel = m.role === 'user' ? (isZh ? '用户' : 'User') : (isZh ? '助手' : 'Assistant')
    const sep = isZh ? '：' : ': '
    lines.push(`${roleLabel}${sep}${text}`)
  }
  return lines.join('\n').slice(0, 2000)
}

/**
 * Build the messages array sent to the LLM (system + optional summary + recent).
 */
export function buildLLMMessages(
  system: string,
  history: ChatTurn[],
  summary: string,
  keepTurns = 5,
  isZh = isZhLanguage(),
): { messages: ChatTurn[]; window: WindowResult; nextSummaryInput: ChatTurn[] } {
  const win = windowChatHistory(history, keepTurns)
  const out: { role: 'user' | 'assistant' | 'system'; content: string }[] = []
  out.push({ role: 'system', content: system })
  const summaryText = summary.trim() || (win.truncated ? naiveSummarize(win.older, '', isZh) : '')
  if (summaryText) {
    const summaryHeader = isZh
      ? `# 此前对话摘要（更早轮次已压缩）`
      : `# Previous conversation summary (earlier turns compressed)`
    out[0] = {
      role: 'system',
      content: `${system}\n\n${summaryHeader}\n${summaryText}`,
    }
  }
  for (const m of win.recent) {
    out.push({ role: m.role, content: m.content })
  }
  return {
    messages: out as ChatTurn[],
    window: win,
    nextSummaryInput: win.older,
  }
}

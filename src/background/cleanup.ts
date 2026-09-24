import { AIClient } from '../shared/ai-client'
import { DEFAULT_POLICIES, DEFAULT_SETTINGS, STORAGE_KEYS } from '../shared/constants'
import type {
  CleanupExecutePayload,
  CleanupPlan,
  ChromeTabGroupColor,
  ExtensionSettings,
} from '../shared/types'

const RESTRICTED_PREFIXES = ['chrome://', 'chrome-extension://', 'edge://', 'about:']

/** Internal pages are listed/closeable; content scripts cannot run on them. */
function isRestricted(url: string | undefined): boolean {
  if (!url) return false
  return RESTRICTED_PREFIXES.some((p) => url.startsWith(p))
}

function isContentScriptBlocked(url: string | undefined): boolean {
  return isRestricted(url)
}
export { isRestricted, isContentScriptBlocked }

async function getSettings(): Promise<ExtensionSettings> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS)
  const saved = (data[STORAGE_KEYS.SETTINGS] ?? {}) as Partial<ExtensionSettings>
  const settings = { ...DEFAULT_SETTINGS, ...saved, ai: { ...DEFAULT_SETTINGS.ai, ...(saved.ai || {}) } }
  if (settings.policies) {
    settings.policies = settings.policies.replace(/\n?只输出 JSON：[\s\S]*$/, '').trimEnd()
  }
  return settings
}

/**
 * Collect current window tabs and ask the local/remote LLM for a cleanup plan.
 * Does NOT close or group anything.
 */
export async function buildCleanupPlan(windowId?: number): Promise<CleanupPlan> {
  const settings = await getSettings()
  if (!settings.ai.enabled) {
    throw new Error('AI is disabled in settings')
  }
  if (!settings.ai.endpoint && settings.ai.provider === 'custom') {
    throw new Error('AI endpoint is empty')
  }

  const winId =
    windowId ??
    (await chrome.windows.getLastFocused({ windowTypes: ['normal'] })).id ??
    -1

  const chromeTabs = await chrome.tabs.query({ windowId: winId, windowType: 'normal' })
  const usable = chromeTabs.filter((t) => t.id !== undefined)

  if (usable.length === 0) {
    return { windowId: winId, close: [], groups: [], keep: [] }
  }

  const client = new AIClient(settings.ai)
  const policies = settings.policies || DEFAULT_POLICIES
  const result = await client.generateCleanupPlan(
    usable.map((t) => ({
      id: t.id!,
      title: t.title || '',
      url: t.url || '',
      pinned: !!t.pinned,
      active: !!t.active,
    })),
    policies,
  )

  const byIndex = new Map(usable.map((t, i) => [i + 1, t]))

  const close = result.close
    .map((c) => {
      const tab = byIndex.get(c.index)
      if (!tab?.id) return null
      // Only restriction: never close the current tab
      if (tab.active) return null
      return {
        index: c.index,
        tabId: tab.id,
        title: tab.title || tab.url || '',
        url: tab.url || '',
        reason: c.reason,
        selected: true,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const closeIds = new Set(close.map((c) => c.tabId))

  const groups = result.groups
    .map((g) => {
      const tabs = g.indices
        .map((idx) => {
          const tab = byIndex.get(idx)
          // Pinned tabs never go into groups; close-candidate tabs are retained in groups as fallback
          if (!tab?.id || tab.pinned) return null
          return { tabId: tab.id, title: tab.title || '', url: tab.url || '' }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
      if (tabs.length === 0) return null
      return {
        name: g.name,
        color: (g.color || 'grey') as ChromeTabGroupColor,
        indices: g.indices,
        tabs,
        selected: true,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const groupedIds = new Set(groups.flatMap((g) => g.tabs.map((t) => t.tabId)))

  const keep = result.keep
    .map((k) => {
      const tab = byIndex.get(k.index)
      if (!tab?.id) return null
      return {
        index: k.index,
        tabId: tab.id,
        title: tab.title || '',
        url: tab.url || '',
        reason: k.reason,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null && !closeIds.has(x.tabId) && !groupedIds.has(x.tabId))

  return {
    windowId: winId,
    close,
    groups,
    keep,
    raw: result.raw,
  }
}

/**
 * Chat with the LLM about current window tabs (no side effects).
 * Also returns index→tabId map so popup can convert model "index" plans.
 */
export async function chatAboutTabs(
  history: { role: 'user' | 'assistant'; content: string }[],
  windowId?: number,
): Promise<{ reply: string; indexToTabId: Record<number, number> }> {
  const settings = await getSettings()
  if (!settings.ai.enabled) throw new Error('AI is disabled in settings')
  if (!settings.ai.endpoint && settings.ai.provider === 'custom') {
    throw new Error('AI endpoint is empty')
  }

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

  const client = new AIClient(settings.ai)
  const reply = await client.chatAboutTabs(
    history || [],
    usable.map((t) => ({
      id: t.id!,
      title: t.title || '',
      url: t.url || '',
      pinned: !!t.pinned,
      active: !!t.active,
    })),
    settings.policies || DEFAULT_POLICIES,
  )
  return { reply, indexToTabId }
}

/**
 * Execute a confirmed cleanup plan. Re-checks pinned/active/restricted.
 */
export async function executeCleanupPlan(payload: CleanupExecutePayload): Promise<{ closed: number; groups: number }> {
  const closeIds = [...new Set(payload.closeTabIds || [])].filter((id) => Number.isInteger(id) && id > 0)
  let closed = 0
  if (closeIds.length > 0) {
    const tabs = await Promise.all(
      closeIds.map(async (id) => {
        try {
          return await chrome.tabs.get(id)
        } catch {
          return null
        }
      }),
    )
    const safeIds = tabs
      .filter((t): t is chrome.tabs.Tab => !!t && t.id !== undefined)
      .filter((t) => !t.active)
      .map((t) => t.id!)
    if (safeIds.length > 0) {
      await chrome.tabs.remove(safeIds)
      closed = safeIds.length
    }
  }

  let groupCount = 0
  const colors: ChromeTabGroupColor[] = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan']
  for (const g of payload.groups || []) {
    const ids = [...new Set(g.tabIds || [])]
    if (ids.length === 0 || !g.name) continue
    const live: number[] = []
    let targetWinId: number | undefined
    for (const id of ids) {
      try {
        const tab = await chrome.tabs.get(id)
        if (tab.id !== undefined) {
          live.push(tab.id)
          if (!targetWinId && tab.windowId) targetWinId = tab.windowId
        }
      } catch {
        // already closed
      }
    }
    if (live.length === 0) continue
    const color = colors.includes(g.color) ? g.color : 'grey'
    try {
      const groupId = await chrome.tabs.group({
        tabIds: live as [number, ...number[]],
        ...(targetWinId ? { createProperties: { windowId: targetWinId } } : {}),
      })
      await chrome.tabGroups.update(groupId, { title: g.name.slice(0, 40), color })
      groupCount += 1
    } catch (err) {
      console.error('[TabSweep] group failed', g.name, err)
    }
  }

  return { closed, groups: groupCount }
}

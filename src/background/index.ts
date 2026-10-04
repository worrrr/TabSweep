import {
  groupAllTabs,
  ungroupAllTabs,
  closeGroupTabs,
  classifyNewTabs,
  autoGroupNewTab,
  expandAllGroups,
  collapseAllGroups,
  toggleGroupTitles,
  areGroupTitlesHidden,
  getGroupsPreview,
  invalidatePreviewCache,
  cacheAddTab,
  cacheRemoveTab,
  cacheUpdateTab,
  debouncedCacheRebuild,
  handleTabGroupUpdated,
  handleTabGroupRemoved,
} from './tab-manager'
import { buildCleanupPlan, executeCleanupPlan } from './cleanup'
import { runChatAgent } from './agent'
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '../shared/constants'
import type {
  ExtensionMessage,
  TabInfo,
  ExtensionSettings,
  WindowGroupsInfo,
  CleanupExecutePayload,
} from '../shared/types'

console.log('[TabSweep] Service worker started')

chrome.runtime.onInstalled.addListener(() => {
  console.log('[TabSweep] Extension installed')
})

// --- Tab cache updates ---
chrome.tabs.onCreated.addListener((tab) => {
  cacheAddTab(tab)
  if (tab.windowId !== undefined) debouncedCacheRebuild(tab.windowId)
})

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.title) {
    cacheUpdateTab(tab)
    autoGroupNewTab(tab).catch((err) =>
      console.error('[TabSweep] autoGroupNewTab failed:', err),
    )
  } else if (changeInfo.url) {
    cacheUpdateTab(tab)
  }
  if (tab.windowId !== undefined) debouncedCacheRebuild(tab.windowId)
})

chrome.tabs.onRemoved.addListener((tabId) => {
  cacheRemoveTab(tabId)
})

// --- Smart group title: toggle title on collapse/expand ---
chrome.tabGroups.onUpdated.addListener((group) => {
  handleTabGroupUpdated(group)
})

chrome.tabGroups.onRemoved.addListener((group) => {
  handleTabGroupRemoved(group.id)
})


// --- Message handler ---
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    handleMessage(message).then(sendResponse).catch((err) => {
      console.error('[TabSweep] Error:', err)
      sendResponse({ error: err.message })
    })
    return true
  },
)

/** Resolve window ID from message payload or last focused window (for popup context). */
async function resolveWindowId(payload: unknown): Promise<number> {
  const windowId = (payload as { windowId?: number })?.windowId
  if (windowId !== undefined && Number.isInteger(windowId)) return windowId
  const win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] })
  return win.id ?? -1
}

async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  switch (message.action) {
    case 'GROUP_TABS': {
      const windowId = await resolveWindowId(message.payload)
      await groupAllTabs(windowId)
      return { ok: true }
    }

    case 'UNGROUP_ALL': {
      const windowId = await resolveWindowId(message.payload)
      await ungroupAllTabs(windowId)
      invalidatePreviewCache(windowId)
      return { ok: true }
    }

    case 'CLOSE_GROUP': {
      const tabIds = (message.payload as { tabIds: number[] })?.tabIds || []
      await closeGroupTabs(tabIds)
      return { ok: true }
    }

    case 'CLASSIFY_NEW_TABS': {
      const windowId = await resolveWindowId(message.payload)
      await classifyNewTabs(windowId)
      return { ok: true }
    }

    case 'EXPAND_ALL_GROUPS': {
      const windowId = await resolveWindowId(message.payload)
      await expandAllGroups(windowId)
      return { ok: true }
    }

    case 'COLLAPSE_ALL_GROUPS': {
      const windowId = await resolveWindowId(message.payload)
      await collapseAllGroups(windowId)
      return { ok: true }
    }

    case 'TOGGLE_GROUP_TITLES': {
      const windowId = await resolveWindowId(message.payload)
      const hidden = await toggleGroupTitles(windowId)
      return { ok: true, hidden }
    }

    case 'GET_GROUPS_PREVIEW': {
      const windowId = await resolveWindowId(message.payload)
      return await getGroupsPreview(windowId)
    }

    case 'REFRESH_GROUPS_PREVIEW': {
      const windowId = await resolveWindowId(message.payload)
      return await getGroupsPreview(windowId, true)
    }

    case 'GET_ALL_WINDOWS_PREVIEW': {
      const windows = await chrome.windows.getAll({ windowTypes: ['normal'] })
      const lastFocused = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => null)
      const activeWinId = lastFocused?.id

      const items = await Promise.all(
        windows.map(async (win): Promise<WindowGroupsInfo | null> => {
          const wid = win.id!
          // 1. Filter out hidden internal windows with zero dimensions (e.g. Edge Startup Boost / Game Assist)
          if ((win.width !== undefined && win.width <= 0) || (win.height !== undefined && win.height <= 0)) {
            return null
          }

          const tabs = await chrome.tabs.query({ windowId: wid })
          // 2. Filter out empty shell windows with 0 tabs
          if (tabs.length === 0) {
            return null
          }

          // 3. Filter out unfocused background windows that only hold a single internal blank New Tab
          const isCurrentWin = win.focused || wid === activeWinId
          if (!isCurrentWin && tabs.length === 1) {
            const onlyTab = tabs[0]
            const url = (onlyTab.url || onlyTab.pendingUrl || '').toLowerCase()
            const title = (onlyTab.title || '').trim()
            const isBlankNewTab =
              !url ||
              url === 'about:blank' ||
              url.startsWith('edge://newtab') ||
              url.startsWith('chrome://newtab') ||
              title === 'New tab'
            if (isBlankNewTab) {
              return null
            }
          }

          const groups = await getGroupsPreview(wid)
          const hasGroups = tabs.some(
            (t) => t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE,
          )
          return {
            windowId: wid,
            tabCount: tabs.length,
            focused: !!win.focused,
            groups,
            hasGroups,
            titlesHidden: areGroupTitlesHidden(wid),
          }
        }),
      )

      return items.filter((w): w is WindowGroupsInfo => w !== null)
    }

    case 'GET_SETTINGS': {
      const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS)
      const saved = (data[STORAGE_KEYS.SETTINGS] ?? {}) as Partial<ExtensionSettings>
      return { ...DEFAULT_SETTINGS, ...saved }
    }

    case 'SAVE_SETTINGS': {
      const newSettings = message.payload as ExtensionSettings
      await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: newSettings })
      invalidatePreviewCache()
      return { ok: true }
    }

    case 'SWITCH_TAB': {
      const tabId = (message.payload as { tabId: number })?.tabId
      if (tabId) {
        await chrome.tabs.update(tabId, { active: true })
      }
      return { ok: true }
    }

    case 'OPEN_URL': {
      const url = (message.payload as { url: string })?.url
      if (url) {
        await chrome.tabs.create({ url })
      }
      return { ok: true }
    }

    case 'AI_CLEANUP_PLAN': {
      const windowId = await resolveWindowId(message.payload)
      try {
        const plan = await buildCleanupPlan(windowId)
        return { ok: true, plan }
      } catch (err) {
        return { ok: false, error: (err as Error).message }
      }
    }

    case 'AI_CLEANUP_EXECUTE': {
      const payload = (message.payload || {}) as CleanupExecutePayload
      try {
        const result = await executeCleanupPlan(payload)
        return { ok: true, ...result }
      } catch (err) {
        return { ok: false, error: (err as Error).message }
      }
    }

    case 'AI_CHAT': {
      const payload = (message.payload || {}) as {
        messages?: { role: 'user' | 'assistant'; content: string }[]
        windowId?: number
        summary?: string
      }
      try {
        const result = await runChatAgent(payload.messages || [], payload.windowId, payload.summary || '')
        return {
          ok: true,
          reply: result.reply,
          toolCalls: result.toolCalls,
          indexToTabId: result.indexToTabId,
          summary: result.summary,
          summarizedCount: result.summarizedCount,
        }
      } catch (err) {
        return { ok: false, error: (err as Error).message }
      }
    }

    default:
      return { error: 'Unknown action' }
  }
}

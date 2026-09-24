<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted } from 'vue'
import { getMessage } from '../shared/i18n'
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '../shared/constants'
import type { ExtensionSettings, GroupIndicatorStyle, ThemeMode, WindowGroupsInfo, CleanupPlan } from '../shared/types'
import GroupList from './components/GroupList.vue'
import SettingsView from './components/SettingsView.vue'
import ChatView from './components/ChatView.vue'

const currentView = ref<'main' | 'settings' | 'chat'>('main')
const allWindows = ref<WindowGroupsInfo[]>([])
const loading = ref(true)
const groupingWindowId = ref<number | null>(null)
const classifyingWindowId = ref<number | null>(null)
const currentWindowId = ref<number | null>(null)
const indicatorStyle = ref<GroupIndicatorStyle>(DEFAULT_SETTINGS.groupIndicatorStyle)

// AI cleanup (local Qwen / OpenAI-compatible)
const aiLoading = ref(false)
const closeLoading = ref(false)
const groupLoading = ref(false)
const aiError = ref('')
const cleanupPlan = ref<CleanupPlan | null>(null)
const showCleanupConfirm = ref(false)
const aiStatus = ref('')
const hasClosedExecuted = ref(false)
const hasGroupExecuted = ref(false)
const closedCountTotal = ref(0)
const groupedCountTotal = ref(0)
const reviewTip = ref('')

// ─── Theme System ───

const themeMode = ref<ThemeMode>('system')
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

function applyTheme(mode: ThemeMode) {
  const isDark = mode === 'dark' || (mode === 'system' && mediaQuery.matches)
  document.documentElement.classList.toggle('dark', isDark)
}

function toggleTheme() {
  const currentlyDark = document.documentElement.classList.contains('dark')
  themeMode.value = currentlyDark ? 'light' : 'dark'
  applyTheme(themeMode.value)
  localStorage.setItem('atm_theme', themeMode.value)
  chrome.storage.local.get(STORAGE_KEYS.SETTINGS).then((data) => {
    const s = (data[STORAGE_KEYS.SETTINGS] as Partial<ExtensionSettings> | undefined) || { ...DEFAULT_SETTINGS }
    ;(s as ExtensionSettings).theme = themeMode.value
    chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: s })
  })
}

function onSystemThemeChange() {
  if (themeMode.value === 'system') applyTheme('system')
}

watch(themeMode, (mode) => applyTheme(mode))

// ─── Data Loading ───

onMounted(async () => {
  const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS)
  const stored = data[STORAGE_KEYS.SETTINGS] as Partial<ExtensionSettings> | undefined
  indicatorStyle.value = 'header'
  if (stored?.theme) {
    themeMode.value = stored.theme
  } else {
    const saved = localStorage.getItem('atm_theme') as ThemeMode | null
    if (saved) themeMode.value = saved
  }
  applyTheme(themeMode.value)
  mediaQuery.addEventListener('change', onSystemThemeChange)

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
  currentWindowId.value = activeTab?.windowId ?? null
  await loadAllPreviews()
})

onUnmounted(() => {
  mediaQuery.removeEventListener('change', onSystemThemeChange)
})

const totalTabs = computed(() =>
  allWindows.value.reduce((sum, w) => sum + w.tabCount, 0),
)

const isDarkActive = computed(() => document.documentElement.classList.contains('dark'))

async function loadAllPreviews() {
  loading.value = true
  try {
    const result = await chrome.runtime.sendMessage({ action: 'GET_ALL_WINDOWS_PREVIEW' })
    if (Array.isArray(result)) {
      const sorted = (result as WindowGroupsInfo[]).sort((a, b) => {
        if (a.windowId === currentWindowId.value) return -1
        if (b.windowId === currentWindowId.value) return 1
        return 0
      })
      allWindows.value = sorted
      const titlesState: Record<number, boolean> = {}
      for (const w of sorted) {
        titlesState[w.windowId] = w.titlesHidden
      }
      windowTitlesHidden.value = titlesState
    }
  } catch (err) {
    console.error('Failed to load preview:', err)
  } finally {
    loading.value = false
  }
}

function windowLabel(w: WindowGroupsInfo, idx: number): string {
  const isCurrent = w.windowId === currentWindowId.value
  const label = isCurrent ? getMessage('currentWindow') : `${getMessage('windowLabel')} ${idx + 1}`
  return label
}

function newTabsCount(w: WindowGroupsInfo): number {
  const group = w.groups.find((g) => g.groupName === 'New Tabs')
  return group ? group.tabs.length : 0
}

async function handleClassifyNew(windowId: number) {
  classifyingWindowId.value = windowId
  try {
    await chrome.runtime.sendMessage({ action: 'CLASSIFY_NEW_TABS', payload: { windowId } })
    await loadAllPreviews()
  } finally {
    classifyingWindowId.value = null
  }
}

async function handleGroup(windowId: number) {
  groupingWindowId.value = windowId
  try {
    await chrome.runtime.sendMessage({ action: 'GROUP_TABS', payload: { windowId } })
    await loadAllPreviews()
  } finally {
    groupingWindowId.value = null
  }
}

async function handleUngroup(windowId: number) {
  await chrome.runtime.sendMessage({ action: 'UNGROUP_ALL', payload: { windowId } })
  await loadAllPreviews()
}

async function handleSettingsBack() {
  currentView.value = 'main'
  const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS)
  const stored = data[STORAGE_KEYS.SETTINGS] as Partial<ExtensionSettings> | undefined
  indicatorStyle.value = 'header'
  if (stored?.theme) {
    themeMode.value = stored.theme
    applyTheme(themeMode.value)
  }
}

const expandTriggers = ref<Record<number, number>>({})
const collapseTriggers = ref<Record<number, number>>({})
const windowCollapsedState = ref<Record<number, boolean>>({})

function isWindowCollapsed(windowId: number): boolean {
  return windowCollapsedState.value[windowId] ?? (indicatorStyle.value === 'header')
}

async function handleToggleAllGroups(windowId: number) {
  const collapsed = isWindowCollapsed(windowId)
  if (collapsed) {
    expandTriggers.value = { ...expandTriggers.value, [windowId]: (expandTriggers.value[windowId] || 0) + 1 }
    await chrome.runtime.sendMessage({ action: 'EXPAND_ALL_GROUPS', payload: { windowId } })
  } else {
    collapseTriggers.value = { ...collapseTriggers.value, [windowId]: (collapseTriggers.value[windowId] || 0) + 1 }
    await chrome.runtime.sendMessage({ action: 'COLLAPSE_ALL_GROUPS', payload: { windowId } })
  }
  windowCollapsedState.value = { ...windowCollapsedState.value, [windowId]: !collapsed }
}

const windowSectionCollapsed = ref<Record<number, boolean>>({})

function isWindowSectionCollapsed(windowId: number): boolean {
  return windowSectionCollapsed.value[windowId] ?? false
}

function toggleWindowSection(windowId: number) {
  windowSectionCollapsed.value = {
    ...windowSectionCollapsed.value,
    [windowId]: !isWindowSectionCollapsed(windowId),
  }
}

const windowTitlesHidden = ref<Record<number, boolean>>({})

function isTitlesHidden(windowId: number): boolean {
  return windowTitlesHidden.value[windowId] ?? false
}

async function handleToggleGroupTitles(windowId: number) {
  const result = await chrome.runtime.sendMessage({ action: 'TOGGLE_GROUP_TITLES', payload: { windowId } })
  if (result?.hidden !== undefined) {
    windowTitlesHidden.value = { ...windowTitlesHidden.value, [windowId]: result.hidden }
  }
}

const showFirstTimeIntro = ref(false)
const chatInitialPrompt = ref('')

async function handleAiCleanupClick() {
  const data = await chrome.storage.local.get('hasSeenCleanupIntro')
  if (!data.hasSeenCleanupIntro) {
    showFirstTimeIntro.value = true
  } else {
    await handleAiCleanup()
  }
}

async function handleStartWithDefaults() {
  showFirstTimeIntro.value = false
  await chrome.storage.local.set({ hasSeenCleanupIntro: true })
  await handleAiCleanup()
}

async function handleGoToChatRules() {
  showFirstTimeIntro.value = false
  await chrome.storage.local.set({ hasSeenCleanupIntro: true })
  chatInitialPrompt.value = getMessage('chatInitialPrompt')
  currentView.value = 'chat'
}

async function handleAiCleanup() {
  aiError.value = ''
  aiStatus.value = getMessage('cleaningStatus')
  aiLoading.value = true
  hasClosedExecuted.value = false
  hasGroupExecuted.value = false
  closedCountTotal.value = 0
  groupedCountTotal.value = 0
  reviewTip.value = ''
  try {
    const result = await chrome.runtime.sendMessage({
      action: 'AI_CLEANUP_PLAN',
      payload: { windowId: currentWindowId.value ?? undefined },
    })
    if (!result?.ok) {
      aiError.value = result?.error || getMessage('cleanupFailed')
      aiStatus.value = ''
      return
    }
    const plan = result.plan as CleanupPlan
    if (!plan || (plan.close.length === 0 && plan.groups.length === 0)) {
      aiStatus.value = getMessage('noPlanSuggested')
      cleanupPlan.value = plan
      showCleanupConfirm.value = true
      return
    }
    cleanupPlan.value = plan
    showCleanupConfirm.value = true
    aiStatus.value = ''
  } catch (err) {
    aiError.value = (err as Error).message
    aiStatus.value = ''
  } finally {
    aiLoading.value = false
  }
}

function toggleCloseItem(index: number) {
  const plan = cleanupPlan.value
  if (!plan) return
  const item = plan.close.find((c) => c.index === index)
  if (item) item.selected = !item.selected
}

function toggleGroupItem(name: string) {
  const plan = cleanupPlan.value
  if (!plan) return
  const item = plan.groups.find((g) => g.name === name)
  if (item) item.selected = !item.selected
}

function cancelCleanup() {
  showCleanupConfirm.value = false
  cleanupPlan.value = null
  if (closedCountTotal.value > 0 || groupedCountTotal.value > 0) {
    aiStatus.value = getMessage('completedTip', [String(closedCountTotal.value), String(groupedCountTotal.value)])
  } else {
    aiStatus.value = ''
  }
}

const cleanupSummary = computed(() => {
  const plan = cleanupPlan.value
  if (!plan) return { close: 0, groups: 0 }
  return {
    close: hasClosedExecuted.value ? 0 : plan.close.filter((c) => c.selected !== false).length,
    groups: hasGroupExecuted.value ? 0 : plan.groups.filter((g) => g.selected !== false).length,
  }
})

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url.slice(0, 24)
  }
}

async function confirmCleanupCloseOnly() {
  const plan = cleanupPlan.value
  if (!plan || hasClosedExecuted.value) return
  const closeTabIds = plan.close.filter((c) => c.selected !== false).map((c) => c.tabId)
  if (closeTabIds.length === 0) return

  closeLoading.value = true
  aiError.value = ''
  reviewTip.value = ''
  try {
    const result = await chrome.runtime.sendMessage({
      action: 'AI_CLEANUP_EXECUTE',
      payload: { closeTabIds, groups: [] },
    })
    if (!result?.ok) {
      aiError.value = result?.error || getMessage('closeFailed')
      return
    }

    const count = result.closed ?? closeTabIds.length
    hasClosedExecuted.value = true
    closedCountTotal.value += count

    // Remove closed tabs from plan.close
    const closedSet = new Set(closeTabIds)
    plan.close = plan.close.filter((c) => !closedSet.has(c.tabId))

    // Also remove closed tabs from pending groups if any
    for (const g of plan.groups) {
      g.tabs = g.tabs.filter((t) => !closedSet.has(t.tabId))
    }
    plan.groups = plan.groups.filter((g) => g.tabs.length > 0)

    // Reload tab previews in the background
    await loadAllPreviews()

    // Auto exit only if groups were ALREADY executed or there are 0 groups left
    const remainingGroupCount = plan.groups.filter((g) => g.selected !== false).length
    if (hasGroupExecuted.value || remainingGroupCount === 0) {
      showCleanupConfirm.value = false
      cleanupPlan.value = null
      aiStatus.value = getMessage('cleanupStatusTip', [String(closedCountTotal.value), String(groupedCountTotal.value)])
    } else {
      reviewTip.value = getMessage('closedCountTip', [String(count)])
    }
  } catch (err) {
    aiError.value = (err as Error).message
  } finally {
    closeLoading.value = false
  }
}

async function confirmCleanupGroupOnly() {
  const plan = cleanupPlan.value
  if (!plan || hasGroupExecuted.value) return
  const groups = plan.groups
    .filter((g) => g.selected !== false)
    .map((g) => ({ name: g.name, color: g.color, tabIds: g.tabs.map((t) => t.tabId) }))
  if (groups.length === 0) return

  groupLoading.value = true
  aiError.value = ''
  reviewTip.value = ''
  try {
    const result = await chrome.runtime.sendMessage({
      action: 'AI_CLEANUP_EXECUTE',
      payload: { closeTabIds: [], groups },
    })
    if (!result?.ok) {
      aiError.value = result?.error || getMessage('groupFailed')
      return
    }

    const count = result.groups ?? groups.length
    hasGroupExecuted.value = true
    groupedCountTotal.value += count

    // Clear executed groups
    plan.groups = plan.groups.filter((g) => g.selected === false)

    // Reload previews in the background
    await loadAllPreviews()

    // Auto exit only if close was ALREADY executed or there are 0 tabs left to close
    const remainingCloseCount = plan.close.filter((c) => c.selected !== false).length
    if (hasClosedExecuted.value || remainingCloseCount === 0) {
      showCleanupConfirm.value = false
      cleanupPlan.value = null
      aiStatus.value = getMessage('cleanupStatusTip', [String(closedCountTotal.value), String(groupedCountTotal.value)])
    } else {
      reviewTip.value = getMessage('groupedCountTip', [String(count)])
    }
  } catch (err) {
    aiError.value = (err as Error).message
  } finally {
    groupLoading.value = false
  }
}
</script>

<template>
  <!-- Main Container: Strictly Fixed 385px × 580px -->
  <div
    class="relative flex flex-col w-[385px] h-[580px] max-h-[580px] overflow-hidden select-none"
    style="background: var(--bg-primary); color: var(--text-primary);"
  >
    <!-- Sub-views -->
    <SettingsView v-if="currentView === 'settings'" @back="handleSettingsBack" />

    <ChatView
      v-else-if="currentView === 'chat'"
      :initial-prompt="chatInitialPrompt"
      @back="currentView = 'main'; chatInitialPrompt = ''; loadAllPreviews()"
    />

    <!-- Main View -->
    <div v-else class="flex flex-col h-full overflow-hidden">
      <!-- Top Header (Fixed Height 44px) -->
      <header
        class="shrink-0 h-[44px] px-3 flex items-center justify-between border-b"
        style="border-color: var(--border); background: var(--bg-primary);"
      >
        <!-- Logo & Title -->
        <div class="flex items-center gap-1.5 min-w-0">
          <img src="/icons/icon-32.png" alt="" class="w-4 h-4 shrink-0 rounded" />
          <span class="text-[13.5px] font-semibold tracking-tight" style="color: var(--text-primary);">TabSweep</span>
          <span
            class="text-[10px] tabular-nums px-1.5 py-0.2 rounded-full font-medium"
            style="color: var(--text-tertiary); background: var(--bg-secondary);"
          >
            {{ totalTabs }}
          </span>
        </div>

        <!-- Action Tools & Core Buttons -->
        <div class="flex items-center gap-1">
          <!-- Chat Button -->
          <button
            @click="currentView = 'chat'"
            class="h-6 px-2 flex items-center gap-1 rounded-full text-[11px] font-medium transition-all hover:bg-[var(--hover)] active:scale-95"
            style="background: var(--bg-secondary); color: var(--text-primary); border: 0.5px solid var(--border);"
            :title="getMessage('titleChat')"
          >
            <span>{{ getMessage('btnChat') }}</span>
          </button>

          <!-- AI Cleanup Plan Button -->
          <button
            @click="handleAiCleanupClick"
            :disabled="aiLoading || totalTabs === 0"
            class="h-6 px-2 flex items-center gap-1 rounded-full text-[11px] font-medium transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
            style="background: var(--accent); color: #fff;"
            :title="getMessage('titleSweep')"
          >
            <span v-if="aiLoading" class="animate-spin w-2.5 h-2.5 border border-white border-t-transparent rounded-full mr-0.5" />
            <span>{{ aiLoading ? getMessage('btnSweeping') : getMessage('btnSweep') }}</span>
          </button>

          <!-- Theme Toggle -->
          <button
            @click="toggleTheme"
            class="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[var(--hover)]"
            style="color: var(--text-secondary);"
            :title="themeMode === 'dark' ? getMessage('themeDark') : getMessage('themeLight')"
          >
            <svg v-if="themeMode === 'dark' || (themeMode === 'system' && isDarkActive)" class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.06l1.06-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.06 1.06a.75.75 0 001.06 1.06l1.06-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 15.657a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.06zM5.404 6.464a.75.75 0 001.06-1.06l-1.06-1.06a.75.75 0 10-1.06 1.06l1.06 1.06z" />
            </svg>
            <svg v-else class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 116.647 1.921a.75.75 0 01.808.083z" clip-rule="evenodd" />
            </svg>
          </button>

          <!-- Settings -->
          <button
            class="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[var(--hover)]"
            style="color: var(--text-secondary);"
            @click="currentView = 'settings'"
            :title="getMessage('settings')"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </header>

      <!-- Loading State -->
      <div v-if="!showCleanupConfirm && loading" class="flex-1 flex items-center justify-center">
        <div class="flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full animate-pulse" style="background: var(--accent);" />
          <span class="w-1.5 h-1.5 rounded-full animate-pulse" style="background: var(--accent); animation-delay: 150ms;" />
          <span class="w-1.5 h-1.5 rounded-full animate-pulse" style="background: var(--accent); animation-delay: 300ms;" />
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="!showCleanupConfirm && totalTabs === 0" class="flex-1 flex items-center justify-center p-6 text-center">
        <div>
          <div class="w-8 h-8 mx-auto mb-2 rounded-xl flex items-center justify-center bg-[var(--bg-secondary)]">
            <svg class="w-4 h-4" style="color: var(--text-tertiary);" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" />
            </svg>
          </div>
          <p class="text-xs" style="color: var(--text-tertiary);">{{ getMessage('emptyTabs') }}</p>
        </div>
      </div>

      <!-- Main Body List (The ONLY scrollable region) -->
      <div
        v-else-if="!showCleanupConfirm"
        class="flex-1 overflow-y-auto px-2.5 py-2 space-y-2 min-h-0 overscroll-contain"
        style="background: var(--bg-primary);"
      >
        <div
          v-for="(w, idx) in allWindows"
          :key="w.windowId"
          class="rounded-xl overflow-hidden border shadow-sm transition-all"
          style="background: var(--bg-secondary); border-color: var(--border);"
        >
          <!-- Window Header (Clickable Accordion) -->
          <div
            class="flex items-center gap-1.5 px-3 py-2 cursor-pointer hover:bg-[var(--hover)] transition-colors select-none"
            @click="toggleWindowSection(w.windowId)"
          >
            <svg
              class="w-3 h-3 shrink-0 transition-transform duration-200"
              :class="isWindowSectionCollapsed(w.windowId) ? '' : 'rotate-90'"
              style="color: var(--text-tertiary);"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
            </svg>
            <span
              class="text-[12px] font-semibold truncate flex-1"
              :style="{ color: w.windowId === currentWindowId ? 'var(--accent)' : 'var(--text-primary)' }"
            >
              {{ windowLabel(w, idx) }}
            </span>
            <span class="text-[10px] tabular-nums" style="color: var(--text-tertiary);">
              {{ getMessage('tabsCount', [String(w.tabCount)]) }}
            </span>
            <span v-if="w.hasGroups" class="w-1.5 h-1.5 rounded-full" style="background: var(--group-green);" :title="getMessage('hasGroups')" />
          </div>

          <!-- Collapsible Content -->
          <template v-if="!isWindowSectionCollapsed(w.windowId)">
            <!-- Micro Toolbar (Slim Actions) -->
            <div
              class="flex items-center justify-between px-3 py-1.5 border-t border-b text-[11px]"
              style="border-color: var(--border); background: var(--bg-primary);"
            >
              <div class="flex items-center gap-1">
                <!-- Free AI Grouping Button -->
                <button
                  class="px-2 py-0.5 rounded text-[11px] font-medium transition-all hover:opacity-90 disabled:opacity-40"
                  style="background: var(--accent-soft); color: var(--accent);"
                  :disabled="groupingWindowId === w.windowId"
                  @click="handleGroup(w.windowId)"
                  :title="getMessage('titleGroupTabs')"
                >
                  <span v-if="groupingWindowId === w.windowId" class="inline-flex items-center gap-1">
                    <span class="animate-spin w-2 h-2 border border-current border-t-transparent rounded-full" />
                    {{ getMessage('grouping') }}
                  </span>
                  <span v-else>{{ getMessage('groupTabs') }}</span>
                </button>

                <!-- Ungroup -->
                <button
                  class="px-2 py-0.5 rounded text-[11px] transition-all hover:bg-[var(--hover)]"
                  style="color: var(--text-secondary);"
                  @click="handleUngroup(w.windowId)"
                  :title="getMessage('titleUngroup')"
                >
                  {{ getMessage('ungroupAll') }}
                </button>

                <!-- Classify New Tabs -->
                <button
                  v-if="newTabsCount(w) > 0"
                  class="px-1.5 py-0.5 rounded text-[10px] font-medium"
                  style="background: var(--hover); color: var(--accent);"
                  :disabled="classifyingWindowId === w.windowId"
                  @click="handleClassifyNew(w.windowId)"
                >
                  {{ getMessage('classifyNewTabs') }} ({{ newTabsCount(w) }})
                </button>
              </div>

              <!-- Toolbar Tools (Hide title, collapse all) -->
              <div v-if="w.hasGroups" class="flex items-center gap-0.5">
                <button
                  class="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--hover)]"
                  :style="{ color: isTitlesHidden(w.windowId) ? 'var(--accent)' : 'var(--text-tertiary)' }"
                  :title="isTitlesHidden(w.windowId) ? getMessage('showGroupTitles') : getMessage('hideGroupTitles')"
                  @click="handleToggleGroupTitles(w.windowId)"
                >
                  <svg class="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M2.5 2a.5.5 0 00-.5.5v3.5a.5.5 0 00.146.354l5.5 5.5a.5.5 0 00.708 0l3.5-3.5a.5.5 0 000-.708l-5.5-5.5A.5.5 0 006 2H2.5zm1.5 2a1 1 0 110 2 1 1 0 010-2z" />
                  </svg>
                </button>
                <button
                  class="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--hover)]"
                  style="color: var(--text-tertiary);"
                  :title="isWindowCollapsed(w.windowId) ? getMessage('expandAll') : getMessage('collapseAll')"
                  @click="handleToggleAllGroups(w.windowId)"
                >
                  <svg v-if="isWindowCollapsed(w.windowId)" class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 3.5l4 4 4-4" />
                    <path d="M4 8.5l4 4 4-4" />
                  </svg>
                  <svg v-else class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 7l4-4 4 4" />
                    <path d="M4 12.5l4-4 4 4" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Group List for this window -->
            <div style="background: var(--bg-primary);">
              <GroupList
                :groups="w.groups"
                :indicator-style="indicatorStyle"
                :expand-trigger="expandTriggers[w.windowId] || 0"
                :collapse-trigger="collapseTriggers[w.windowId] || 0"
                @close-group="loadAllPreviews"
              />
            </div>
          </template>
        </div>
      </div>

      <!-- Bottom Status Bar (When aiStatus or aiError exists) -->
      <div
        v-if="!showCleanupConfirm && (aiStatus || aiError)"
        class="shrink-0 px-3 py-1.5 text-[11px] border-t flex items-center justify-between"
        style="border-color: var(--border); background: var(--bg-secondary);"
      >
        <span v-if="aiError" style="color: var(--group-red);">{{ aiError }}</span>
        <span v-else style="color: var(--text-secondary);">{{ aiStatus }}</span>
        <button class="text-[10px] text-[var(--text-tertiary)] hover:underline" @click="aiStatus = ''; aiError = ''">{{ getMessage('closeNotice') }}</button>
      </div>
    </div>

    <!-- AI Cleanup Review Modal (Absolute overlay, strictly pinned inside 385×580) -->
    <div
      v-if="showCleanupConfirm && cleanupPlan"
      class="absolute inset-0 z-50 flex flex-col h-full overflow-hidden"
      style="background: var(--bg-primary);"
    >
      <!-- Review Header (Fixed flex-none) -->
      <div
        class="shrink-0 px-3.5 py-2.5 flex items-center justify-between border-b"
        style="border-color: var(--border); background: var(--bg-primary);"
      >
        <div class="min-w-0 flex-1">
          <div class="text-[13px] font-semibold flex items-center gap-1.5" style="color: var(--text-primary);">
            <span>{{ getMessage('aiReviewTitle') }}</span>
            <span
              v-if="hasClosedExecuted || hasGroupExecuted"
              class="text-[10px] px-1.5 py-0.2 rounded font-normal"
              style="background: var(--accent-soft); color: var(--accent);"
            >
              {{ hasClosedExecuted && hasGroupExecuted ? getMessage('statusAllDone') : (hasClosedExecuted ? getMessage('statusTabsClosed') : getMessage('statusGroupsDone')) }}
            </span>
          </div>
          <div class="text-[11px] mt-0.5 truncate" style="color: var(--text-tertiary);">
            <template v-if="reviewTip">
              <span style="color: var(--accent);">{{ reviewTip }}</span>
            </template>
            <template v-else>
              <span v-if="hasClosedExecuted">{{ getMessage('reviewClosed') }} <b style="color: var(--text-secondary);">{{ closedCountTotal }}</b></span>
              <span v-else>{{ getMessage('reviewSuggestClose') }} <b style="color: var(--group-red);">{{ cleanupSummary.close }}</b></span>
              ·
              <span v-if="hasGroupExecuted">{{ getMessage('reviewGrouped') }} <b style="color: var(--text-secondary);">{{ groupedCountTotal }}</b></span>
              <span v-else>{{ getMessage('reviewSuggestGroup') }} <b style="color: var(--group-green);">{{ cleanupSummary.groups }}</b></span>
            </template>
          </div>
        </div>
        <button
          class="text-[11px] px-2.5 py-1 rounded transition-colors hover:bg-[var(--hover)] font-medium"
          :style="{ color: (hasClosedExecuted || hasGroupExecuted) ? 'var(--accent)' : 'var(--text-secondary)' }"
          @click="cancelCleanup"
        >
          {{ (hasClosedExecuted || hasGroupExecuted) ? getMessage('done') : getMessage('btnCancel') }}
        </button>
      </div>

      <!-- ONLY this list scrolls (No outer scrollbars) -->
      <div
        class="review-scroll flex-1 overflow-y-auto px-2.5 py-2 space-y-2.5 min-h-0 overscroll-contain"
        style="background: var(--bg-secondary);"
      >
        <div v-if="cleanupPlan.close.length === 0 && cleanupPlan.groups.length === 0 && !hasClosedExecuted && !hasGroupExecuted" class="text-[12px] py-12 text-center" style="color: var(--text-tertiary);">
          {{ getMessage('noPlanSuggested') }}
        </div>

        <!-- Section: Tabs to Close -->
        <div v-if="cleanupPlan.close.length || hasClosedExecuted" class="rounded-xl overflow-hidden border" style="border-color: var(--border); background: var(--bg-primary);">
          <div
            class="sticky top-0 z-10 px-3 py-1.5 text-[11px] font-semibold flex items-center justify-between border-b"
            style="background: var(--bg-secondary); border-color: var(--border);"
          >
            <span :style="{ color: hasClosedExecuted ? 'var(--text-secondary)' : 'var(--group-red)' }">
              {{ hasClosedExecuted ? getMessage('tabsClosed') : getMessage('pendingClose', [String(cleanupPlan.close.length)]) }}
            </span>
            <span class="text-[10px]" :style="{ color: hasClosedExecuted ? 'var(--group-green)' : 'var(--text-tertiary)' }">
              {{ hasClosedExecuted ? getMessage('closedSuccess', [String(closedCountTotal)]) : getMessage('uncheckToKeep') }}
            </span>
          </div>

          <div v-if="!hasClosedExecuted" class="divide-y" style="border-color: var(--border);">
            <label
              v-for="item in cleanupPlan.close"
              :key="'c-' + item.index"
              class="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-[var(--hover)] transition-colors"
            >
              <input
                type="checkbox"
                class="shrink-0 accent-[var(--accent)]"
                :checked="item.selected !== false"
                @change="toggleCloseItem(item.index)"
              />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <span class="text-[12px] truncate" style="color: var(--text-primary);">
                    {{ item.title || item.url }}
                  </span>
                  <span
                    v-if="item.reason"
                    class="text-[9.5px] px-1.5 py-0.2 rounded shrink-0"
                    style="background: var(--accent-soft); color: var(--group-red);"
                  >
                    {{ item.reason }}
                  </span>
                </div>
                <div class="text-[10px] truncate opacity-60" style="color: var(--text-tertiary);">
                  {{ extractDomain(item.url) }} · {{ item.url }}
                </div>
              </div>
            </label>
          </div>
        </div>

        <!-- Section: Groups to Create -->
        <div v-if="cleanupPlan.groups.length || hasGroupExecuted" class="rounded-xl overflow-hidden border" style="border-color: var(--border); background: var(--bg-primary);">
          <div
            class="sticky top-0 z-10 px-3 py-1.5 text-[11px] font-semibold flex items-center justify-between border-b"
            style="background: var(--bg-secondary); border-color: var(--border);"
          >
            <span :style="{ color: hasGroupExecuted ? 'var(--text-secondary)' : 'var(--group-green)' }">
              {{ hasGroupExecuted ? getMessage('groupsCreated') : getMessage('pendingGroup', [String(cleanupPlan.groups.length)]) }}
            </span>
            <span class="text-[10px]" :style="{ color: hasGroupExecuted ? 'var(--group-green)' : 'var(--text-tertiary)' }">
              {{ hasGroupExecuted ? getMessage('groupedSuccess', [String(groupedCountTotal)]) : getMessage('uncheckToSkipGroup') }}
            </span>
          </div>

          <div v-if="!hasGroupExecuted" class="divide-y" style="border-color: var(--border);">
            <div
              v-for="g in cleanupPlan.groups"
              :key="'g-' + g.name"
              class="p-2.5"
            >
              <label class="flex items-center gap-2 cursor-pointer mb-1">
                <input
                  type="checkbox"
                  class="shrink-0 accent-[var(--accent)]"
                  :checked="g.selected !== false"
                  @change="toggleGroupItem(g.name)"
                />
                <span
                  class="w-2 h-2 rounded-full shrink-0"
                  :style="{ background: `var(--group-${g.color})` }"
                />
                <span class="text-[12px] font-semibold" :style="{ color: `var(--group-${g.color})` }">
                  {{ g.name }}
                </span>
                <span class="text-[10px] tabular-nums" style="color: var(--text-tertiary);">
                  {{ getMessage('itemCount', [String(g.tabs.length)]) }}
                </span>
              </label>
              <div class="pl-5 space-y-0.5">
                <div
                  v-for="t in g.tabs"
                  :key="t.tabId"
                  class="text-[11px] truncate py-0.2"
                  style="color: var(--text-secondary);"
                >
                  {{ t.title || t.url }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Pinned Firmly at Bottom (Never pushed away) -->
      <div
        class="shrink-0 px-3.5 py-2.5 flex items-center gap-2 border-t"
        style="border-color: var(--border); background: var(--bg-primary);"
      >
        <button
          class="py-2 px-3 text-[11px] rounded-lg transition-colors hover:bg-[var(--hover)] font-medium shrink-0"
          style="background: var(--bg-secondary); color: var(--text-secondary);"
          @click="cancelCleanup"
        >
          {{ (hasClosedExecuted || hasGroupExecuted) ? getMessage('doneAndReturn') : getMessage('btnCancel') }}
        </button>
        <button
          class="flex-1 py-2 text-[11px] font-semibold rounded-lg transition-all hover:opacity-90 disabled:opacity-40"
          :style="{
            background: hasClosedExecuted ? 'var(--hover)' : 'var(--group-red)',
            color: hasClosedExecuted ? 'var(--text-tertiary)' : 'white',
          }"
          :disabled="closeLoading || groupLoading || hasClosedExecuted || cleanupSummary.close === 0"
          @click="confirmCleanupCloseOnly"
        >
          <span v-if="hasClosedExecuted">{{ getMessage('btnClosed') }}</span>
          <span v-else-if="closeLoading">{{ getMessage('btnClosing') }}</span>
          <span v-else>{{ getMessage('btnConfirmClose') }} ({{ cleanupSummary.close }})</span>
        </button>
        <button
          class="flex-1 py-2 text-[11px] font-semibold rounded-lg transition-all hover:opacity-90 disabled:opacity-40"
          :style="{
            background: hasGroupExecuted ? 'var(--hover)' : 'var(--group-green)',
            color: hasGroupExecuted ? 'var(--text-tertiary)' : 'white',
          }"
          :disabled="closeLoading || groupLoading || hasGroupExecuted || cleanupSummary.groups === 0"
          @click="confirmCleanupGroupOnly"
        >
          <span v-if="hasGroupExecuted">{{ getMessage('btnGrouped') }}</span>
          <span v-else-if="groupLoading">{{ getMessage('grouping') }}</span>
          <span v-else>{{ getMessage('btnConfirmGroup') }} ({{ cleanupSummary.groups }})</span>
        </button>
      </div>
    </div>

    <!-- First Time Guidance Modal -->
    <div
      v-if="showFirstTimeIntro"
      class="absolute inset-0 z-50 flex items-center justify-center p-4"
      style="background: rgba(0, 0, 0, 0.48); backdrop-filter: blur(4px);"
    >
      <div
        class="w-full max-w-[340px] rounded-2xl border shadow-2xl overflow-hidden flex flex-col p-4 animate-in fade-in zoom-in-95 duration-150"
        style="background: var(--bg-primary); border-color: var(--border);"
      >
        <!-- Header -->
        <div class="flex items-center gap-2.5 mb-3">
          <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style="background: var(--accent-soft); color: var(--accent);">
            <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 1a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 1zm0 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 16zM3.404 3.404a.75.75 0 011.06 0l1.061 1.06a.75.75 0 01-1.06 1.061l-1.061-1.06a.75.75 0 010-1.06zm12.132 12.132a.75.75 0 011.06 0l1.061 1.06a.75.75 0 01-1.06 1.061l-1.061-1.06a.75.75 0 010-1.061zM1 10a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 011 10zm15 0a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 0116 10zm-12.596 5.536a.75.75 0 010-1.06l1.06-1.061a.75.75 0 111.061 1.06l-1.06 1.061a.75.75 0 01-1.061 0zm12.132-12.132a.75.75 0 010-1.06l1.06-1.061a.75.75 0 111.061 1.06l-1.06 1.061a.75.75 0 01-1.061 0zM10 5a5 5 0 100 10 5 5 0 000-10z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-semibold" style="color: var(--text-primary);">{{ getMessage('introTitle') }}</h3>
            <p class="text-[11px]" style="color: var(--text-tertiary);">{{ getMessage('introSubtitle') }}</p>
          </div>
          <button
            @click="showFirstTimeIntro = false"
            class="w-6 h-6 rounded-full flex items-center justify-center hover:bg-[var(--hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            ✕
          </button>
        </div>

        <!-- Content Details -->
        <div class="space-y-2 text-[11px] mb-4" style="color: var(--text-secondary);">
          <div class="p-2.5 rounded-xl border flex flex-col gap-1.5" style="background: var(--bg-secondary); border-color: var(--border);">
            <div class="flex items-start gap-1.5">
              <span class="text-[12px]">✨</span>
              <span class="leading-snug font-medium text-[var(--text-primary)]">{{ getMessage('introRule1Title') }}</span>
            </div>
            <p class="text-[10.5px] leading-relaxed text-[var(--text-tertiary)] pl-5">
              {{ getMessage('introRule1Desc') }}
            </p>
          </div>

          <div class="p-2.5 rounded-xl border flex flex-col gap-1.5" style="background: var(--bg-secondary); border-color: var(--border);">
            <div class="flex items-start gap-1.5">
              <span class="text-[12px]">💬</span>
              <span class="leading-snug font-medium text-[var(--text-primary)]">{{ getMessage('introRule2Title') }}</span>
            </div>
            <p class="text-[10.5px] leading-relaxed text-[var(--text-tertiary)] pl-5">
              {{ getMessage('introRule2Desc') }}
            </p>
          </div>
        </div>

        <!-- Buttons -->
        <div class="flex flex-col gap-2">
          <button
            @click="handleStartWithDefaults"
            class="w-full py-2 px-3 text-[12px] font-semibold rounded-xl transition-all hover:opacity-90 active:scale-98"
            style="background: var(--accent); color: white;"
          >
            {{ getMessage('btnStartDefault') }}
          </button>
          <button
            @click="handleGoToChatRules"
            class="w-full py-2 px-3 text-[12px] font-medium rounded-xl border transition-all hover:bg-[var(--hover)] active:scale-98"
            style="background: var(--bg-primary); border-color: var(--border); color: var(--text-primary);"
          >
            {{ getMessage('btnCustomizeRules') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.review-scroll {
  overscroll-behavior: contain;
}
</style>

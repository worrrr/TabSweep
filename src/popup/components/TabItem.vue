<script setup lang="ts">
import { getMessage } from '../../shared/i18n'
import type { TabInfo } from '../../shared/types'

const props = defineProps<{
  tab: TabInfo
}>()

const emit = defineEmits<{
  'tab-closed': [id: number]
}>()

function switchToTab(tabId: number) {
  chrome.tabs.update(tabId, { active: true })
}

async function closeTab(e: MouseEvent, tabId: number) {
  e.stopPropagation()
  await chrome.tabs.remove(tabId)
  emit('tab-closed', tabId)
}

function getFaviconUrl(tab: TabInfo): string {
  if (tab.favIconUrl) return tab.favIconUrl
  try {
    const url = new URL(tab.url)
    return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url.href)}&size=16`
  } catch {
    return ''
  }
}
</script>

<template>
  <div
    class="tab-row w-full flex items-center gap-2 px-2 py-1 rounded-md text-left cursor-pointer group transition-colors hover:bg-[var(--hover)]"
    @click="switchToTab(tab.id)"
    :title="tab.title + '\n' + tab.url"
  >
    <!-- Favicon -->
    <div class="w-3.5 h-3.5 shrink-0 rounded flex items-center justify-center overflow-hidden bg-[var(--bg-secondary)]">
      <img
        v-if="getFaviconUrl(tab)"
        :src="getFaviconUrl(tab)"
        alt=""
        class="w-3 h-3 object-contain"
        @error="($event.target as HTMLImageElement).style.display = 'none'"
      />
      <span v-else class="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)]" />
    </div>

    <!-- Title -->
    <span
      class="text-[11.5px] truncate flex-1 select-none"
      :style="{
        color: tab.active ? 'var(--accent)' : 'var(--text-primary)',
        fontWeight: tab.active ? '600' : 'normal'
      }"
    >
      {{ tab.title || tab.url || getMessage('untitledTab') }}
    </span>

    <!-- Pinned indicator -->
    <span v-if="tab.pinned" class="text-[9px] px-1 py-0.2 rounded bg-[var(--hover)] text-[var(--text-tertiary)] shrink-0">
      {{ getMessage('tabPinned') }}
    </span>

    <!-- Close button on hover -->
    <button
      v-if="!tab.active"
      class="w-4 h-4 shrink-0 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-[var(--hover)] transition-opacity"
      style="color: var(--text-tertiary);"
      :title="getMessage('closeTab')"
      @click="closeTab($event, tab.id)"
    >
      <svg class="w-2.5 h-2.5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
      </svg>
    </button>
  </div>
</template>

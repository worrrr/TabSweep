<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { GROUP_DEFINITIONS } from '../../shared/constants'
import { getMessage } from '../../shared/i18n'
import type { GroupedTabs, GroupIndicatorStyle } from '../../shared/types'
import TabItem from './TabItem.vue'

const props = withDefaults(defineProps<{
  group: GroupedTabs
  mode: GroupIndicatorStyle
  expandTrigger: number
  collapseTrigger: number
}>(), {
  mode: 'header',
  expandTrigger: 0,
  collapseTrigger: 0,
})

const emit = defineEmits<{
  'close-group': []
}>()

const collapsed = ref(true)

watch(() => props.expandTrigger, () => { collapsed.value = false })
watch(() => props.collapseTrigger, () => { collapsed.value = true })

const def = GROUP_DEFINITIONS[props.group.category]

const displayColor = computed(() => props.group.groupColor || def?.color || 'grey')
const displayLabel = computed(() => props.group.groupName || (def ? getMessage(def.labelKey) : getMessage('groupOther')))

const groupColorVar = computed(() => `var(--group-${displayColor.value})`)

const tabPreviewText = computed(() => {
  if (!props.group.tabs || props.group.tabs.length === 0) return ''
  return props.group.tabs
    .slice(0, 2)
    .map((t) => t.title || t.url || getMessage('untitledTab'))
    .join(' · ')
})

async function handleCloseGroup() {
  const tabIds = props.group.tabs.map((t) => t.id)
  await chrome.runtime.sendMessage({ action: 'CLOSE_GROUP', payload: { tabIds } })
  emit('close-group')
}
</script>

<template>
  <div class="group/item border-b last:border-b-0" style="border-color: var(--border);">
    <!-- Collapsed state -->
    <template v-if="collapsed">
      <div
        class="w-full flex flex-col px-3 py-2 cursor-pointer transition-colors group/row hover:bg-[var(--hover)]"
        @click="collapsed = false"
      >
        <div class="flex items-center gap-2">
          <!-- Subtle glowing color dot -->
          <span
            class="w-2 h-2 rounded-full shrink-0 shadow-sm"
            :style="{ background: groupColorVar, boxShadow: `0 0 5px ${groupColorVar}` }"
          />
          <span class="text-[12px] font-medium flex-1 truncate" style="color: var(--text-primary);">
            {{ displayLabel }}
          </span>
          <span
            class="text-[10px] tabular-nums px-1.5 py-0.2 rounded-full"
            style="color: var(--text-tertiary); background: var(--bg-primary);"
          >
            {{ group.tabs.length }}
          </span>
          <button
            class="p-1 rounded opacity-0 group-hover/row:opacity-100 transition-opacity hover:bg-[var(--hover)]"
            style="color: var(--text-tertiary);"
            :title="getMessage('closeGroup')"
            @click.stop="handleCloseGroup"
          >
            <svg class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
          <svg class="w-3 h-3 transition-transform" style="color: var(--text-tertiary);" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
          </svg>
        </div>
        <!-- Group contents preview row -->
        <div v-if="tabPreviewText" class="text-[11px] truncate mt-0.5 pl-4 opacity-75" style="color: var(--text-secondary);">
          {{ tabPreviewText }}
        </div>
      </div>
    </template>

    <!-- Header mode: expanded -->
    <template v-else>
      <div
        class="w-full flex items-center gap-2 px-3 py-2 cursor-pointer group/row hover:bg-[var(--hover)]"
        @click="collapsed = true"
      >
        <span
          class="w-2 h-2 rounded-full shrink-0 shadow-sm"
          :style="{ background: groupColorVar, boxShadow: `0 0 5px ${groupColorVar}` }"
        />
        <span class="text-[12px] font-medium flex-1 truncate" style="color: var(--text-primary);">
          {{ displayLabel }}
        </span>
        <span
          class="text-[10px] tabular-nums px-1.5 py-0.2 rounded-full"
          style="color: var(--text-tertiary); background: var(--bg-primary);"
        >
          {{ group.tabs.length }}
        </span>
        <button
          class="p-1 rounded opacity-0 group-hover/row:opacity-100 transition-opacity hover:bg-[var(--hover)]"
          style="color: var(--text-tertiary);"
          :title="getMessage('closeGroup')"
          @click.stop="handleCloseGroup"
        >
          <svg class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
        <svg class="w-3 h-3 rotate-90" style="color: var(--text-tertiary);" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
        </svg>
      </div>
      <div class="pl-4 pr-1 pb-1.5 space-y-0.5">
        <TabItem v-for="tab in group.tabs" :key="tab.id" :tab="tab" />
      </div>
    </template>
  </div>
</template>

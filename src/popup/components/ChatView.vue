<script setup lang="ts">
import { ref, watch, nextTick, onMounted, computed } from 'vue'
import { getMessage } from '../../shared/i18n'
import type { ToolCallLogItem } from '../../shared/types'

const props = defineProps<{
  initialPrompt?: string
}>()

const emit = defineEmits<{
  back: []
}>()

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCallLogItem[]
}

const messages = ref<ChatMessage[]>([])
const input = ref('')
const busy = ref(false)
const error = ref('')
const listRef = ref<HTMLElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const expanded = ref<Record<string, boolean>>({})
const sessionSummary = ref('')
const summaryNote = ref('')
const showHelp = ref(false)

function adjustTextareaHeight() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  // Auto-grow up to max 3 lines (around 74px)
  const maxHeight = 74
  const targetHeight = Math.min(el.scrollHeight, maxHeight)
  el.style.height = `${Math.max(36, targetHeight)}px`
  el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
}

watch(input, () => {
  nextTick(adjustTextareaHeight)
})

const canSend = computed(() => input.value.trim().length > 0 && !busy.value)

async function loadSession() {
  try {
    const data = await chrome.storage.local.get('chatSession')
    const s = data.chatSession as
      | { messages?: ChatMessage[]; summary?: string; updatedAt?: number }
      | undefined
    if (s?.messages?.length) {
      messages.value = s.messages
      sessionSummary.value = s.summary || ''
    }
  } catch {
    // ignore
  }
}

async function saveSession() {
  try {
    await chrome.storage.local.set({
      chatSession: {
        messages: messages.value.slice(-80),
        summary: sessionSummary.value,
        updatedAt: Date.now(),
      },
    })
  } catch {
    // ignore
  }
}

async function scrollBottom() {
  await nextTick()
  if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight
}

function toggleTool(id: string) {
  expanded.value = { ...expanded.value, [id]: !expanded.value[id] }
}

function pretty(v: unknown) {
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}

async function newSession() {
  messages.value = []
  sessionSummary.value = ''
  summaryNote.value = ''
  expanded.value = {}
  error.value = ''
  input.value = ''
  showHelp.value = false
  messages.value.push({
    role: 'assistant',
    content: getMessage('chatNewSessionStarted'),
  })
  await saveSession()
  await scrollBottom()
}

async function send() {
  const text = input.value.trim()
  if (!text || busy.value) return
  messages.value.push({ role: 'user', content: text })
  input.value = ''
  busy.value = true
  error.value = ''
  await scrollBottom()
  try {
    const result = await chrome.runtime.sendMessage({
      action: 'AI_CHAT',
      payload: {
        messages: messages.value.map((m) => ({ role: m.role, content: m.content })),
        summary: sessionSummary.value,
      },
    })
    if (!result?.ok) {
      error.value = result?.error || getMessage('failed')
      messages.value.push({ role: 'assistant', content: `${getMessage('chatErrorPrefix')}${error.value}` })
      await saveSession()
      return
    }
    if (result.summary) sessionSummary.value = String(result.summary)
    if (result.summarizedCount) {
      summaryNote.value = getMessage('chatSummarizedNotice', [result.summarizedCount.toString()])
    }
    if (result.toolCalls && Array.isArray(result.toolCalls)) {
      const toolCalls = result.toolCalls as ToolCallLogItem[]
      // Default tool calls collapsed to keep view clean, user can expand
      for (const tc of toolCalls) {
        if (expanded.value[tc.id] === undefined) {
          expanded.value[tc.id] = false
        }
      }
      const reply = String(result.reply || '').trim()
      messages.value.push({
        role: 'assistant',
        content: reply || (toolCalls.length ? getMessage('chatActionExecuted') : getMessage('chatEmptyReply')),
        toolCalls: toolCalls.length ? toolCalls : undefined,
      })
    } else {
      messages.value.push({ role: 'assistant', content: String(result.reply || '').trim() || getMessage('chatEmptyReply') })
    }
    await saveSession()
  } catch (err) {
    error.value = (err as Error).message
    messages.value.push({ role: 'assistant', content: `${getMessage('chatErrorPrefix')}${error.value}` })
  } finally {
    busy.value = false
    await scrollBottom()
  }
}

onMounted(async () => {
  await loadSession()
  if (props.initialPrompt && !input.value) {
    input.value = props.initialPrompt
  }
  if (messages.value.length === 0) {
    messages.value.push({
      role: 'assistant',
      content: getMessage('chatWelcome'),
    })
    await saveSession()
  }
  await scrollBottom()
})
</script>

<template>
  <div class="w-full h-full flex flex-col overflow-hidden" style="background: var(--bg-primary);">
    <!-- Header (Fixed 44px) -->
    <header
      class="shrink-0 h-[44px] px-3 flex items-center justify-between border-b"
      style="border-color: var(--border); background: var(--bg-primary);"
    >
      <div class="flex items-center gap-1.5 min-w-0">
        <button
          class="w-6 h-6 -ml-1 flex items-center justify-center rounded-full hover:bg-[var(--hover)] transition-colors"
          style="color: var(--accent);"
          @click="emit('back')"
          :title="getMessage('backHome')"
        >
          <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clip-rule="evenodd" />
          </svg>
        </button>
        <span class="text-[13.5px] font-semibold" style="color: var(--text-primary);">{{ getMessage('aiChatTitle') }}</span>
        <span class="text-[9.5px] px-1.5 py-0.2 rounded-full font-medium" style="background: var(--bg-secondary); color: var(--text-tertiary);">
          {{ getMessage('slideMemory') }}
        </span>
      </div>

      <div class="flex items-center gap-1">
        <button
          class="h-6 px-2 text-[11px] rounded-full hover:bg-[var(--hover)] transition-colors"
          style="color: var(--text-secondary);"
          @click="showHelp = !showHelp"
        >
          {{ showHelp ? getMessage('collapseHelp') : getMessage('help') }}
        </button>
        <button
          class="h-6 px-2 text-[11px] font-medium rounded-full transition-all hover:bg-[var(--hover)] active:scale-95"
          style="background: var(--bg-secondary); color: var(--text-primary); border: 0.5px solid var(--border);"
          :title="getMessage('titleNewSession')"
          @click="newSession"
        >
          {{ getMessage('btnNewSession') }}
        </button>
      </div>
    </header>

    <!-- Help Banner -->
    <div
      v-if="showHelp"
      class="px-3 py-1.5 text-[11px] leading-relaxed border-b shrink-0"
      style="background: var(--bg-secondary); color: var(--text-secondary); border-color: var(--border);"
    >
      {{ getMessage('chatHelpContent') }}
    </div>

    <!-- Summary note banner -->
    <div
      v-if="summaryNote"
      class="px-3 py-1 text-[10px] border-b shrink-0"
      style="background: var(--bg-secondary); color: var(--text-tertiary); border-color: var(--border);"
    >
      {{ summaryNote }}
    </div>

    <!-- Message List (Only scrollable area) -->
    <div
      ref="listRef"
      class="chat-scroll flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0 overscroll-contain"
      style="background: var(--bg-secondary);"
    >
      <template v-for="(m, i) in messages" :key="i">
        <!-- Text Bubble -->
        <div
          class="max-w-[92%] rounded-xl px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap break-words"
          :style="
            m.role === 'user'
              ? { background: 'var(--accent)', color: '#fff', marginLeft: 'auto', borderBottomRightRadius: '3px' }
              : { background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '0.5px solid var(--border)', borderBottomLeftRadius: '3px' }
          "
        >
          {{ m.content }}
        </div>

        <!-- Tool Calls Section (Compact Capsule List) -->
        <div v-if="m.toolCalls?.length" class="space-y-1.5 w-full my-1">
          <div
            v-for="tc in m.toolCalls"
            :key="tc.id"
            class="rounded-lg overflow-hidden border text-[11px] transition-all"
            style="background: var(--bg-primary); border-color: var(--border);"
          >
            <!-- Header Capsule: One-line summary -->
            <button
              class="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left hover:bg-[var(--hover)] transition-colors"
              @click="toggleTool(tc.id)"
            >
              <span
                class="w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold text-[9px] shrink-0"
                :style="tc.ok
                  ? { background: 'var(--group-green)', color: '#fff' }
                  : { background: 'var(--group-red)', color: '#fff' }"
              >
                {{ tc.ok ? '✓' : '✗' }}
              </span>
              <span class="font-semibold font-mono text-[10.5px]" style="color: var(--accent);">
                {{ tc.name }}
              </span>
              <span
                class="flex-1 truncate text-[11px]"
                :style="{ color: tc.ok ? 'var(--text-primary)' : 'var(--group-red)' }"
              >
                {{ tc.summary || (tc.ok ? getMessage('executedSuccess') : getMessage('executedFailed')) }}
              </span>
              <span v-if="tc.durationMs" class="text-[9.5px] tabular-nums text-[var(--text-tertiary)]">
                {{ tc.durationMs }}ms
              </span>
              <svg
                class="w-3 h-3 text-[var(--text-tertiary)] transition-transform duration-200"
                :class="expanded[tc.id] ? 'rotate-180' : ''"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
              </svg>
            </button>

            <!-- Collapsible Detail: Formatted arguments & results in a neat code box -->
            <div
              v-if="expanded[tc.id]"
              class="px-2.5 py-2 space-y-1.5 border-t text-[10px]"
              style="border-color: var(--border); background: var(--bg-secondary);"
            >
              <div>
                <span class="font-semibold text-[var(--text-tertiary)] uppercase">{{ getMessage('toolArguments') }}</span>
                <pre class="max-h-[80px] overflow-y-auto mt-0.5 p-1.5 rounded font-mono text-[10px] whitespace-pre-wrap break-all bg-[var(--bg-primary)] border border-[var(--border)]">{{ pretty(tc.arguments) }}</pre>
              </div>
              <div>
                <span class="font-semibold text-[var(--text-tertiary)] uppercase">{{ getMessage('toolResult') }}</span>
                <pre class="max-h-[100px] overflow-y-auto mt-0.5 p-1.5 rounded font-mono text-[10px] whitespace-pre-wrap break-all bg-[var(--bg-primary)] border border-[var(--border)]">{{ pretty(tc.result) }}</pre>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Busy Indicator -->
      <div v-if="busy" class="flex items-center gap-1.5 text-[11px] py-1 text-[var(--text-tertiary)]">
        <span class="animate-spin w-2.5 h-2.5 border border-current border-t-transparent rounded-full" />
        <span>{{ getMessage('aiThinking') }}</span>
      </div>
    </div>

    <!-- Input Bar (Fixed flex-none bottom) -->
    <div
      class="shrink-0 p-2.5 flex items-end gap-1.5 border-t"
      style="border-color: var(--border); background: var(--bg-primary);"
    >
      <textarea
        ref="textareaRef"
        v-model="input"
        rows="1"
        class="flex-1 text-[12px] leading-[18px] rounded-lg border px-2.5 py-2 resize-none outline-none transition-[border-color,background-color] overscroll-contain"
        style="background: var(--bg-secondary); color: var(--text-primary); border-color: var(--border); min-height: 36px; max-height: 74px; box-sizing: border-box;"
        :placeholder="getMessage('chatPlaceholder')"
        @input="adjustTextareaHeight"
        @keydown.enter.exact.prevent="send"
      />
      <button
        class="h-[36px] px-3 text-[11.5px] font-medium rounded-lg transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 shrink-0"
        style="background: var(--accent); color: #fff;"
        :disabled="!canSend"
        @click="send"
      >
        {{ busy ? '…' : getMessage('btnSend') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-scroll {
  overscroll-behavior: contain;
}
</style>

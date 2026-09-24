<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { getMessage } from '../../shared/i18n'
import { DEFAULT_SETTINGS, STORAGE_KEYS, DEFAULT_POLICIES, PROVIDER_PRESETS, type ProviderPreset } from '../../shared/constants'
import type { ExtensionSettings } from '../../shared/types'
import { AIClient } from '../../shared/ai-client'

const emit = defineEmits<{
  back: []
}>()

const settings = ref<ExtensionSettings>({ ...DEFAULT_SETTINGS })
const saved = ref(false)
const testing = ref(false)
const testResult = ref<{ ok: boolean; error?: string } | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const importSuccessMsg = ref('')

const activePreset = computed<ProviderPreset>(() => {
  return PROVIDER_PRESETS[settings.value.ai.provider] || PROVIDER_PRESETS.custom
})

function getProviderDisplayName(preset: ProviderPreset): string {
  const key = `provider_${preset.id}`
  const msg = getMessage(key)
  return msg && msg !== key ? msg : preset.name
}

function exportPolicies() {
  const content = settings.value.policies || DEFAULT_POLICIES
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'tabsweep-rules.txt'
  a.click()
  URL.revokeObjectURL(url)
}

function triggerImport() {
  fileInputRef.value?.click()
}

function handleImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    const text = reader.result as string
    if (text && text.trim()) {
      settings.value.policies = text
      importSuccessMsg.value = getMessage('ruleImportSuccess')
      setTimeout(() => {
        importSuccessMsg.value = ''
      }, 2500)
    }
  }
  reader.readAsText(file, 'utf-8')
  input.value = ''
}

watch(() => settings.value.ai.provider, (newProvider) => {
  const preset = PROVIDER_PRESETS[newProvider]
  if (preset) {
    if (preset.isLockedEndpoint) {
      settings.value.ai.endpoint = preset.endpoint
      settings.value.ai.model = preset.defaultModel
    } else {
      if (!settings.value.ai.endpoint || Object.values(PROVIDER_PRESETS).some((p) => p.isLockedEndpoint && p.endpoint === settings.value.ai.endpoint)) {
        settings.value.ai.endpoint = preset.endpoint
      }
      if (!settings.value.ai.model || Object.values(PROVIDER_PRESETS).some((p) => p.isLockedEndpoint && p.defaultModel === settings.value.ai.model)) {
        settings.value.ai.model = preset.defaultModel
      }
    }
  }
})

onMounted(async () => {
  const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS)
  const stored = data[STORAGE_KEYS.SETTINGS] as Partial<ExtensionSettings> | undefined
  if (stored) {
    settings.value = {
      ...DEFAULT_SETTINGS,
      ...stored,
      ai: { ...DEFAULT_SETTINGS.ai, ...(stored.ai || {}) },
      policies: stored.policies
        ? stored.policies.replace(/\n?只输出 JSON：[\s\S]*$/, '').trimEnd()
        : DEFAULT_POLICIES,
    }
  }

  const preset = PROVIDER_PRESETS[settings.value.ai.provider] || PROVIDER_PRESETS.custom
  if (preset.isLockedEndpoint) {
    settings.value.ai.endpoint = preset.endpoint
    if (!settings.value.ai.model) {
      settings.value.ai.model = preset.defaultModel
    }
  } else {
    if (!settings.value.ai.endpoint) {
      settings.value.ai.endpoint = preset.endpoint
    }
    if (!settings.value.ai.model) {
      settings.value.ai.model = preset.defaultModel
    }
  }

  if (!settings.value.ai.enabled) {
    settings.value.ai.enabled = true
  }
  settings.value.groupIndicatorStyle = 'header'
})

async function saveSettings() {
  const preset = PROVIDER_PRESETS[settings.value.ai.provider] || PROVIDER_PRESETS.custom
  if (preset.isLockedEndpoint) {
    settings.value.ai.endpoint = preset.endpoint
    if (!settings.value.ai.model) {
      settings.value.ai.model = preset.defaultModel
    }
  }
  await chrome.runtime.sendMessage({ action: 'SAVE_SETTINGS', payload: settings.value })
  saved.value = true
  setTimeout(() => { emit('back') }, 500)
}

async function testConnection() {
  testing.value = true
  testResult.value = null
  try {
    const preset = PROVIDER_PRESETS[settings.value.ai.provider] || PROVIDER_PRESETS.custom
    const configToTest = {
      ...settings.value.ai,
      endpoint: preset.isLockedEndpoint ? preset.endpoint : settings.value.ai.endpoint,
      model: settings.value.ai.model || preset.defaultModel,
    }
    const client = new AIClient(configToTest)
    testResult.value = await client.testConnection()
  } catch (err) {
    testResult.value = { ok: false, error: (err as Error).message }
  } finally {
    testing.value = false
  }
}
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
          @click="emit('back')"
          class="w-6 h-6 -ml-1 flex items-center justify-center rounded-full hover:bg-[var(--hover)] transition-colors"
          style="color: var(--accent);"
          :title="getMessage('backHome')"
        >
          <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clip-rule="evenodd" />
          </svg>
        </button>
        <span class="text-[13.5px] font-semibold" style="color: var(--text-primary);">{{ getMessage('settings') }}</span>
      </div>

      <button
        @click="saveSettings"
        class="h-6 px-3 text-[11px] font-medium rounded-full transition-all active:scale-95"
        style="background: var(--accent); color: #fff;"
      >
        <span v-if="saved">{{ getMessage('btnSaved') }}</span>
        <span v-else>{{ getMessage('btnSave') }}</span>
      </button>
    </header>

    <!-- Scrollable content area -->
    <div
      class="flex-1 overflow-y-auto px-3 py-2.5 space-y-3 min-h-0 overscroll-contain"
      style="background: var(--bg-secondary);"
    >
      <!-- Section 1: AI Configuration -->
      <div>
        <h2 class="text-[10px] font-semibold uppercase tracking-wider px-1 mb-1" style="color: var(--text-secondary);">
          {{ getMessage('aiConfig') }}
        </h2>
        <div class="rounded-xl overflow-hidden border shadow-sm" style="background: var(--bg-primary); border-color: var(--border);">
          <!-- Enable Toggle -->
          <label class="flex items-center justify-between px-3 py-2 cursor-pointer border-b hover:bg-[var(--hover)] transition-colors" style="border-color: var(--border);">
            <span class="text-xs" style="color: var(--text-primary);">{{ getMessage('enableAI') }}</span>
            <input type="checkbox" v-model="settings.ai.enabled" class="accent-[var(--accent)]" />
          </label>

          <template v-if="settings.ai.enabled">
            <!-- Provider -->
            <div class="px-3 py-2 border-b" style="border-color: var(--border);">
              <label class="block text-[10px] font-medium mb-1 text-[var(--text-secondary)]">{{ getMessage('provider') }}</label>
              <select
                v-model="settings.ai.provider"
                class="w-full text-xs rounded-lg p-1.5 outline-none border font-medium"
                style="background: var(--bg-secondary); color: var(--text-primary); border-color: var(--border);"
              >
                <option
                  v-for="preset in Object.values(PROVIDER_PRESETS)"
                  :key="preset.id"
                  :value="preset.id"
                >
                  {{ getProviderDisplayName(preset) }}
                </option>
              </select>
            </div>

            <!-- API Key -->
            <div class="px-3 py-2 border-b" style="border-color: var(--border);">
              <label class="block text-[10px] font-medium mb-1 text-[var(--text-secondary)]">{{ getMessage('apiKey') }}</label>
              <input
                type="password"
                v-model="settings.ai.apiKey"
                :placeholder="activePreset.apiKeyPlaceholder"
                class="w-full text-xs rounded-lg p-1.5 outline-none border"
                style="background: var(--bg-secondary); color: var(--text-primary); border-color: var(--border);"
              />
            </div>

            <!-- Endpoint -->
            <div class="px-3 py-2 border-b" style="border-color: var(--border);">
              <div class="flex items-center justify-between mb-1">
                <label class="block text-[10px] font-medium text-[var(--text-secondary)]">{{ getMessage('endpoint') }}</label>
                <span
                  v-if="activePreset.isLockedEndpoint"
                  class="text-[9px] px-1.5 py-0.2 rounded font-medium flex items-center gap-0.5"
                  style="background: var(--accent-soft); color: var(--accent);"
                >
                  <svg class="w-2.5 h-2.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd" />
                  </svg>
                  {{ getMessage('endpointLocked') }}
                </span>
              </div>
              <input
                type="url"
                v-model="settings.ai.endpoint"
                :readonly="activePreset.isLockedEndpoint"
                :placeholder="activePreset.endpoint"
                class="w-full text-xs rounded-lg p-1.5 outline-none border font-mono transition-all"
                :class="activePreset.isLockedEndpoint ? 'opacity-65 cursor-not-allowed select-none' : ''"
                style="background: var(--bg-secondary); color: var(--text-primary); border-color: var(--border);"
              />
            </div>

            <!-- Model -->
            <div class="px-3 py-2 border-b" style="border-color: var(--border);">
              <div class="flex items-center justify-between mb-1">
                <label class="block text-[10px] font-medium text-[var(--text-secondary)]">{{ getMessage('model') }}</label>
                <span class="text-[9px] font-medium" style="color: var(--group-green);">
                  {{ getMessage('disableThinkingNote') }}
                </span>
              </div>
              <input
                type="text"
                v-model="settings.ai.model"
                :placeholder="activePreset.defaultModel"
                list="preset-models-list"
                class="w-full text-xs rounded-lg p-1.5 outline-none border font-mono"
                style="background: var(--bg-secondary); color: var(--text-primary); border-color: var(--border);"
              />
              <datalist id="preset-models-list">
                <option v-for="m in activePreset.models" :key="m" :value="m" />
              </datalist>
            </div>

            <!-- Test Connection Button -->
            <div class="flex items-center gap-2 px-3 py-2">
              <button
                @click="testConnection"
                :disabled="testing || !settings.ai.endpoint"
                class="px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all hover:bg-[var(--hover)] disabled:opacity-40"
                style="border-color: var(--border); background: var(--bg-secondary); color: var(--text-primary);"
              >
                {{ testing ? getMessage('testing') : getMessage('testConnection') }}
              </button>
              <span v-if="testResult?.ok" class="text-[11px] font-medium" style="color: var(--group-green);">✓ {{ getMessage('connected') }}</span>
              <span v-else-if="testResult" class="text-[11px] truncate flex-1" style="color: var(--group-red);">✗ {{ testResult.error || getMessage('failed') }}</span>
            </div>
          </template>
        </div>
      </div>

      <!-- Section 2: Policies / Memory -->
      <div>
        <div class="flex items-center justify-between px-1 mb-1">
          <h2 class="text-[10px] font-semibold uppercase tracking-wider" style="color: var(--text-secondary);">
            {{ getMessage('policiesSectionTitle') }}
          </h2>
          <span class="text-[9.5px] tabular-nums text-[var(--text-tertiary)]">
            {{ (settings.policies || '').length }} {{ getMessage('charsCount') }}
          </span>
        </div>
        <div class="rounded-xl overflow-hidden border shadow-sm p-2.5" style="background: var(--bg-primary); border-color: var(--border);">
          <p class="text-[10px] leading-relaxed mb-1.5 text-[var(--text-tertiary)]">
            {{ getMessage('policiesDesc') }}
          </p>
          <textarea
            v-model="settings.policies"
            rows="7"
            class="w-full text-[11px] leading-relaxed rounded-lg border p-2 font-mono outline-none"
            style="background: var(--bg-secondary); color: var(--text-primary); border-color: var(--border);"
            :placeholder="DEFAULT_POLICIES"
          />

          <!-- Hidden file input for import -->
          <input
            ref="fileInputRef"
            type="file"
            accept=".txt,.json,.md"
            class="hidden"
            @change="handleImportFile"
          />

          <div class="flex items-center justify-between mt-2 pt-1 border-t" style="border-color: var(--border);">
            <div class="flex items-center gap-1.5">
              <button
                class="px-2 py-1 text-[10px] rounded border transition-colors hover:bg-[var(--hover)] font-medium"
                style="border-color: var(--border); color: var(--text-primary); background: var(--bg-secondary);"
                @click="exportPolicies"
                :title="getMessage('titleExportRules')"
              >
                {{ getMessage('btnExportRules') }}
              </button>
              <button
                class="px-2 py-1 text-[10px] rounded border transition-colors hover:bg-[var(--hover)] font-medium"
                style="border-color: var(--border); color: var(--text-primary); background: var(--bg-secondary);"
                @click="triggerImport"
                :title="getMessage('titleImportRules')"
              >
                {{ getMessage('btnImportRules') }}
              </button>
              <span v-if="importSuccessMsg" class="text-[10px] ml-1" style="color: var(--group-green);">{{ importSuccessMsg }}</span>
            </div>

            <button
              class="text-[10px] px-2 py-1 rounded hover:bg-[var(--hover)]"
              style="color: var(--text-tertiary);"
              @click="settings.policies = DEFAULT_POLICIES"
              :title="getMessage('titleRestoreDefault')"
            >
              {{ getMessage('btnRestoreDefault') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Section 3: Display Settings -->
      <div>
        <h2 class="text-[10px] font-semibold uppercase tracking-wider px-1 mb-1" style="color: var(--text-secondary);">
          {{ getMessage('displaySettings') }}
        </h2>
        <div class="rounded-xl overflow-hidden border shadow-sm p-3" style="background: var(--bg-primary); border-color: var(--border);">


          <!-- Smart group title toggle -->
          <label class="flex items-center justify-between cursor-pointer">
            <div>
              <span class="text-xs block" style="color: var(--text-primary);">{{ getMessage('smartGroupTitle') }}</span>
              <p class="text-[10px] text-[var(--text-tertiary)]">{{ getMessage('smartGroupTitleDesc') }}</p>
            </div>
            <input type="checkbox" v-model="settings.smartGroupTitle" class="accent-[var(--accent)] shrink-0 ml-2" />
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

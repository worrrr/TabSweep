import { getMessage } from './i18n'

/**
 * Human-readable one-line summary of a tool result (for UI badges + AI fallback).
 */
export function summarizeToolResult(
  name: string,
  result: Record<string, unknown>,
  ok: boolean,
): string {
  if (!ok) {
    const err = result?.error || result?.skipped || getMessage('executedFailed')
    const errText = typeof err === 'string' ? err : JSON.stringify(err).slice(0, 80)
    return getMessage('toolSummaryFailed', [errText])
  }
  switch (name) {
    case 'list_tabs': {
      const tabs = (result.tabs as unknown[]) || []
      return getMessage('toolSummaryListTabs', [tabs.length.toString()])
    }
    case 'close_tabs': {
      const n = Number(result.closedCount ?? (result.closed as number[])?.length ?? 0)
      const skipped = (result.skipped as unknown[])?.length || 0
      return skipped
        ? getMessage('toolSummaryCloseTabsSkipped', [n.toString(), skipped.toString()])
        : getMessage('toolSummaryCloseTabs', [n.toString()])
    }
    case 'group_tabs': {
      const ids = (result.tabIds as number[]) || []
      const groupName = String(result.name || '')
      return getMessage('toolSummaryGroupTabs', [groupName, ids.length.toString()])
    }
    case 'update_policies': {
      const mode = result.mode === 'replace' ? getMessage('modeReplace') : getMessage('modeAppend')
      return getMessage('toolSummaryUpdatePolicies', [mode])
    }
    default:
      return getMessage('success')
  }
}

/**
 * If the model returns empty content after tools, build a plain-language recap.
 */
export function fallbackAgentReply(toolCalls: { name: string; ok: boolean; result: Record<string, unknown> }[]): string {
  if (!toolCalls.length) return getMessage('chatEmptyReply')
  const separator = (typeof chrome !== 'undefined' && chrome?.i18n?.getUILanguage?.()?.startsWith('zh')) ? '；' : '; '
  return toolCalls.map((tc) => summarizeToolResult(tc.name, tc.result, tc.ok)).join(separator)
}

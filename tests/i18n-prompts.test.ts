import { describe, it, expect } from 'vitest'
import {
  getCleanupSystemPrompt,
  getSubmitCleanupPlanTool,
  getSubmitTabGroupsTool,
  getTabGroupsSystemPrompt,
} from '../src/shared/ai-client'
import { getAgentTools } from '../src/background/agent'
import { DEFAULT_POLICIES_EN, DEFAULT_POLICIES_ZH } from '../src/shared/constants'
import { naiveSummarize, buildLLMMessages } from '../src/shared/chat-window'

const ZH_REGEX = /[\u4e00-\u9fa5]/

describe('i18n prompts and schemas', () => {
  it('ensures English cleanup system prompt contains zero Chinese characters', () => {
    const promptEn = getCleanupSystemPrompt(false)
    expect(ZH_REGEX.test(promptEn)).toBe(false)

    const promptZh = getCleanupSystemPrompt(true)
    expect(ZH_REGEX.test(promptZh)).toBe(true)
  })

  it('ensures English submit_cleanup_plan tool schema contains zero Chinese characters', () => {
    const toolEn = getSubmitCleanupPlanTool(false)
    const jsonEn = JSON.stringify(toolEn)
    expect(ZH_REGEX.test(jsonEn)).toBe(false)

    const toolZh = getSubmitCleanupPlanTool(true)
    const jsonZh = JSON.stringify(toolZh)
    expect(ZH_REGEX.test(jsonZh)).toBe(true)
  })

  it('ensures English agent tools schema contains zero Chinese characters', () => {
    const toolsEn = getAgentTools(false)
    const jsonEn = JSON.stringify(toolsEn)
    expect(ZH_REGEX.test(jsonEn)).toBe(false)

    const toolsZh = getAgentTools(true)
    const jsonZh = JSON.stringify(toolsZh)
    expect(ZH_REGEX.test(jsonZh)).toBe(true)
  })

  it('ensures English default policies contain zero Chinese characters', () => {
    expect(ZH_REGEX.test(DEFAULT_POLICIES_EN)).toBe(false)
    expect(ZH_REGEX.test(DEFAULT_POLICIES_ZH)).toBe(true)
  })

  it('ensures English submit_tab_groups tool schema contains zero Chinese characters', () => {
    const toolEn = getSubmitTabGroupsTool(false)
    const jsonEn = JSON.stringify(toolEn)
    expect(ZH_REGEX.test(jsonEn)).toBe(false)

    const toolZh = getSubmitTabGroupsTool(true)
    const jsonZh = JSON.stringify(toolZh)
    expect(ZH_REGEX.test(jsonZh)).toBe(true)
  })

  it('ensures English tab groups system prompt contains zero Chinese characters', () => {
    const promptEn = getTabGroupsSystemPrompt(false)
    expect(ZH_REGEX.test(promptEn)).toBe(false)

    const promptZh = getTabGroupsSystemPrompt(true)
    expect(ZH_REGEX.test(promptZh)).toBe(true)
  })

  it('ensures chat-window helpers format in English without Chinese when isZh=false', () => {
    const turns = [
      { role: 'user' as const, content: 'Hello' },
      { role: 'assistant' as const, content: 'Hi there' },
    ]
    const summaryEn = naiveSummarize(turns, '', false)
    expect(ZH_REGEX.test(summaryEn)).toBe(false)
    expect(summaryEn).toContain('User:')
    expect(summaryEn).toContain('Assistant:')

    const msgsEn = buildLLMMessages('System prompt', turns, 'Previous summary', 5, false)
    const sysMsg = msgsEn.messages.find((m) => m.role === 'system')?.content || ''
    expect(ZH_REGEX.test(sysMsg)).toBe(false)
    expect(sysMsg).toContain('Previous conversation summary')
  })
})

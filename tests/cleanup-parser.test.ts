import { describe, it, expect } from 'vitest'
import { AIClient } from '../src/shared/ai-client'

describe('AIClient.parseCleanupPlan', () => {
  const client = new AIClient({
    enabled: true,
    provider: 'deepseek',
    endpoint: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    apiKey: 'sk-test',
  })

  it('parses valid complete JSON', () => {
    const raw = JSON.stringify({
      close: [{ index: 1, reason: '广告' }],
      groups: [{ name: '工作', color: 'blue', indices: [2, 3] }],
      keep: [{ index: 4, reason: '正在看' }],
    })
    // @ts-expect-error accessing private method for testing
    const plan = client.parseCleanupPlan(raw, 5)
    expect(plan.close).toHaveLength(1)
    expect(plan.close[0].index).toBe(1)
    expect(plan.groups).toHaveLength(1)
    expect(plan.groups[0].indices).toEqual([2, 3])
  })

  it('parses JSON with markdown fences', () => {
    const raw = '```json\n{"close":[{"index":1,"reason":"重复"}],"groups":[],"keep":[]}\n```'
    // @ts-expect-error accessing private method for testing
    const plan = client.parseCleanupPlan(raw, 5)
    expect(plan.close[0].index).toBe(1)
  })

  it('repairs truncated JSON from the actual user screenshot', () => {
    const truncated = `{"close":[{"index":1,"reason":"与当前标签重复的B站首页，同站只保留最有用的1个（当前活动页 index 3）"},
{"index":2,"reason":"与当前标签重复的B站首页，同站只保留最有用的1个"},
{"index":4,"reason":"Bing搜索结果页，属于一次性查询，建议关闭"},
{"index":7,"reason":"edge://exten`
    // @ts-expect-error accessing private method for testing
    const plan = client.parseCleanupPlan(truncated, 10)
    expect(plan.close).toHaveLength(3)
    expect(plan.close.map((c) => c.index)).toEqual([1, 2, 4])
  })

  it('repairs truncated JSON in groups', () => {
    const truncated = `{"close":[{"index":1,"reason":"广告"}],"groups":[{"name":"开发","color":"green","indices":[2,3]},{"name":"娱乐","color":"red","indices":[4`
    // @ts-expect-error accessing private method for testing
    const plan = client.parseCleanupPlan(truncated, 10)
    expect(plan.close).toHaveLength(1)
    expect(plan.groups).toHaveLength(1)
    expect(plan.groups[0].name).toBe('开发')
  })
})

/**
 * 灵感火花（/ideas）可选项词汇表 —— 单一数据来源
 * 被三处复用：
 *   1. 页面（/ideas）
 *   2. content.config.ts 的 zod 枚举（type / status 可选项）
 *   3. scripts/new-todo.ts 命令（生成新任务时列出可选项）
 *
 * 任务本体是内容集合 src/content/quest/*.md（每条一个 frontmatter），
 * 这里只放「可选项」的词汇：类型、状态及其展示文案。
 */

export const TYPE_IDS = ['main', 'side'] as const
export type QuestType = (typeof TYPE_IDS)[number]

export const STATUS_IDS = ['todo', 'active', 'done'] as const
export type QuestStatus = (typeof STATUS_IDS)[number]

export const TYPE: Record<QuestType, { name: string; en: string }> = {
  main: { name: '主线', en: 'MAIN' },
  side: { name: '支线', en: 'SIDE' }
}

export const STATUS: Record<QuestStatus, { name: string; en: string }> = {
  todo: { name: '未开始', en: 'TODO' },
  active: { name: '进行中', en: 'ACTIVE' },
  done: { name: '已完成', en: 'DONE' }
}

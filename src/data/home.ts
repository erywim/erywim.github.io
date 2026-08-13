/**
 * 首页数据：存档（每个阶段的角色）—— 请替换为你的经历
 * （首页「道具袋」已改为展示 src/content/treasure 里的收藏，见 treasure.ts / 宝箱页）
 */

export interface PartyMember {
  title: string
  class: string
  desc: string
  period: string
  /** warrior | mage —— 对应组件里内置的像素头像 */
  avatar: 'warrior' | 'mage'
  /** 关键技能 / 标签（存档卡片上与道具袋的标签对齐） */
  chips: string[]
}

export const party: PartyMember[] = [
  {
    title: 'AI 全栈',
    class: '法师 MAGE',
    desc: '快速落地想法的感觉真不戳～',
    period: '2025 - NOW',
    avatar: 'mage',
    chips: ['Agent', 'LLM', 'RAG', '全栈']
  },
  {
    title: 'Javaer',
    class: '战士 WARRIOR',
    desc: '重铸java荣光，吾辈义不容辞',
    period: '2019 - 2025',
    avatar: 'warrior',
    chips: ['Java', 'Spring', 'Netty', '项目管理']
  }
]

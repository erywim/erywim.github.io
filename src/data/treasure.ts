/**
 * 道具宝箱（收集的资料）词汇表 —— 单一数据来源
 * 被三处复用：
 *   1. 页面（首页道具袋 + /treasure 宝箱页）
 *   2. content.config.ts 的 zod 枚举（icon/rarity/chest/tags 可选项）
 *   3. scripts/new-item.ts 命令（生成新道具时列出可选项）
 *
 * 道具本体是内容集合 src/content/treasure/*.md（每条一个 frontmatter），
 * 这里只放「可选项」的词汇：图标、稀有度、主题宝箱、标签及其分类。
 */

export type TagCategory = 'domain' | 'type' | 'scene' | 'state'

export const CATEGORIES: Record<TagCategory, { name: string; en: string }> = {
  domain: { name: '领域', en: 'DOMAIN' },
  type: { name: '形态', en: 'TYPE' },
  scene: { name: '场景', en: 'SCENE' },
  state: { name: '状态', en: 'STATE' }
}

/** 9 个像素图标（<symbol id="it-*">，定义在 FamicomLayout.astro 的 defs 里） */
export const ICONS = [
  'it-scroll',
  'it-book',
  'it-paper',
  'it-video',
  'it-gear',
  'it-crystal',
  'it-chip',
  'it-graph',
  'it-box'
] as const
export type IconId = (typeof ICONS)[number]

/** 稀有度 */
export const RARITIES = ['S', 'A', 'B'] as const
export type Rarity = (typeof RARITIES)[number]

/** 主题宝箱 id（不含「全部 all」，all 只作为 UI 虚拟 tab） */
export const CHEST_IDS = [
  'java',
  'python',
  'agent',
  'deep-learning',
  'rag',
  'system-design',
  'frontend'
] as const
export type ChestId = (typeof CHEST_IDS)[number]

/** 标签 id（四类共 26 个） */
export const TAG_IDS = [
  'java',
  'python',
  'frontend',
  'agent',
  'llm',
  'rag',
  'deeplearning',
  'database',
  'system-design',
  'article',
  'paper',
  'video',
  'tutorial',
  'tool',
  'repo',
  'asset',
  'dataset',
  'interview',
  'practice',
  'performance',
  'architecture',
  'principle',
  'todo',
  'read',
  'verified',
  'inspiration'
] as const
export type TagId = (typeof TAG_IDS)[number]

export interface TreasureTag {
  id: TagId
  name: string
  en: string
  cat: TagCategory
}

export const TAGS: TreasureTag[] = [
  { id: 'java', name: 'Java', en: 'JAVA', cat: 'domain' },
  { id: 'python', name: 'Python', en: 'PY', cat: 'domain' },
  { id: 'frontend', name: '前端', en: 'FE', cat: 'domain' },
  { id: 'agent', name: 'Agent', en: 'AGENT', cat: 'domain' },
  { id: 'llm', name: '大模型', en: 'LLM', cat: 'domain' },
  { id: 'rag', name: 'RAG', en: 'RAG', cat: 'domain' },
  { id: 'deeplearning', name: '深度学习', en: 'DL', cat: 'domain' },
  { id: 'article', name: '文章', en: 'ARTICLE', cat: 'type' },
  { id: 'paper', name: '论文', en: 'PAPER', cat: 'type' },
  { id: 'video', name: '视频', en: 'VIDEO', cat: 'type' },
  { id: 'tutorial', name: '教程', en: 'TUTORIAL', cat: 'type' },
  { id: 'asset', name: '素材', en: 'ASSET', cat: 'type' },
  { id: 'interview', name: '面试', en: 'INTERVIEW', cat: 'scene' },
  { id: 'principle', name: '原理', en: 'PRINCIPLE', cat: 'scene' },
  { id: 'read', name: '精读', en: 'READ', cat: 'state' },
  { id: 'inspiration', name: '灵感', en: 'SPARK', cat: 'state' }
]

/** id → 标签（渲染与命令共用） */
export const tagById: Record<TagId, TreasureTag> = Object.fromEntries(
  TAGS.map((t) => [t.id, t])
) as Record<TagId, TreasureTag>

export interface TreasureChest {
  /** 'all' 为 UI 专用「全部」tab，不是道具可用的 chest 值 */
  id: ChestId | 'all'
  name: string
  en: string
  icon: IconId
}

export const CHESTS: TreasureChest[] = [
  { id: 'all', name: '全部', en: 'ALL', icon: 'it-box' },
  { id: 'java', name: 'Java', en: 'JAVA', icon: 'it-scroll' },
  { id: 'python', name: 'Python', en: 'PYTHON', icon: 'it-book' },
  { id: 'agent', name: 'Agent', en: 'AGENT', icon: 'it-chip' },
  { id: 'deep-learning', name: '深度学习', en: 'DEEP LEARNING', icon: 'it-crystal' },
  { id: 'rag', name: 'RAG', en: 'RAG', icon: 'it-graph' },
  { id: 'system-design', name: '系统设计', en: 'SYSTEM', icon: 'it-gear' },
  { id: 'frontend', name: '前端', en: 'FRONTEND', icon: 'it-video' }
]

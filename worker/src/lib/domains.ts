/**
 * 内容域注册表：九个内容域的字段/校验/文件布局单一事实源。
 * - 字段约束镜像 src/content.config.ts 的 zod schema（构建期 zod 仍是最终兜底）
 * - fileKind 决定发布产物：collection → 单条 md；json-array → 整文件数组；json-single → 单对象
 * - fields 顺序即 frontmatter 渲染顺序（round-trip 兼容用，勿随意调整）
 */

export type FieldType = 'string' | 'text' | 'int' | 'bool' | 'date' | 'json'

export interface FieldDef {
  /** API/frontmatter 字段名（camelCase） */
  key: string
  /** D1 列名（snake_case） */
  col: string
  type: FieldType
  required: boolean
  maxLength?: number
  min?: number
  max?: number
  enum?: readonly string[]
  /** json 字符串数组的元素枚举（treasure.tags） */
  itemsEnum?: readonly string[]
  /** json 值的形状校验 */
  shape?: 'strings' | 'objectives' | 'skills' | 'heroTimeline' | 'buffs' | 'contacts' | 'stats'
  /** 新建缺省值（API 端） */
  fallback?: unknown
}

export type FileKind = 'collection' | 'json-array' | 'json-single'

export interface DomainDef {
  key: string
  table: string
  /** 列表页中文标签 */
  label: string
  fields: FieldDef[]
  fileKind: FileKind
  /** collection：仓库 md 路径（不含 data/json 域）；json 域：整文件路径 */
  repoPath: (id: string) => string
  /** collection：仓库内容目录（同步列目录用） */
  repoDir: string
  /** 列表排序 SQL 片段 */
  listOrder: string
  /** id 规则：hero 固定 default；其余为 slug */
  fixedId?: string
}

/* —— 词汇表（镜像 src/data/treasure.ts / quest.ts，修改那边时同步这里） —— */
const ICONS = [
  'it-scroll', 'it-book', 'it-paper', 'it-video', 'it-gear',
  'it-crystal', 'it-chip', 'it-graph', 'it-box'
] as const
const CHEST_IDS = [
  'java', 'python', 'agent', 'deep-learning', 'rag', 'system-design', 'frontend'
] as const
const TAG_IDS = [
  'java', 'python', 'frontend', 'agent', 'llm', 'rag', 'deeplearning', 'database',
  'system-design', 'article', 'paper', 'video', 'tutorial', 'tool', 'repo', 'asset',
  'dataset', 'interview', 'practice', 'performance', 'architecture', 'principle',
  'todo', 'read', 'verified', 'inspiration'
] as const

export const DOMAINS: Record<string, DomainDef> = {
  blog: {
    key: 'blog', table: 'content_blog', label: '冒险记录',
    fields: [
      { key: 'title', col: 'title', type: 'string', required: true, maxLength: 60 },
      { key: 'description', col: 'description', type: 'string', required: true, maxLength: 160 },
      { key: 'publishDate', col: 'publish_date', type: 'date', required: true },
      { key: 'updatedDate', col: 'updated_date', type: 'date', required: false },
      { key: 'heroImage', col: 'hero_image', type: 'json', required: false },
      { key: 'tags', col: 'tags', type: 'json', required: false, shape: 'strings', fallback: [] },
      { key: 'language', col: 'language', type: 'string', required: false },
      { key: 'draft', col: 'draft', type: 'bool', required: false, fallback: false },
      { key: 'comment', col: 'comment', type: 'bool', required: false, fallback: true },
      { key: 'rank', col: 'rank', type: 'string', required: false, enum: ['S', 'A', 'B', 'C'], fallback: 'B' },
      { key: 'category', col: 'category', type: 'string', required: false, fallback: '技术' },
      { key: 'gold', col: 'gold', type: 'int', required: true, min: 1, max: 19 },
      { key: 'exp', col: 'exp', type: 'int', required: true, min: 1, max: 99 },
      { key: 'bodyMd', col: 'body_md', type: 'text', required: false, fallback: '' },
    ],
    fileKind: 'collection',
    repoPath: (id) => `src/content/blog/${id}/index.md`,
    repoDir: 'src/content/blog',
    listOrder: 'publish_date DESC',
  },
  logs: {
    key: 'logs', table: 'content_logs', label: '旅行日志',
    fields: [
      { key: 'title', col: 'title', type: 'string', required: true, maxLength: 60 },
      { key: 'description', col: 'description', type: 'string', required: true, maxLength: 160 },
      { key: 'publishDate', col: 'publish_date', type: 'date', required: true },
      { key: 'week', col: 'week', type: 'int', required: true, min: 1, max: 200 },
      { key: 'updatedDate', col: 'updated_date', type: 'date', required: false },
      { key: 'tags', col: 'tags', type: 'json', required: false, shape: 'strings', fallback: [] },
      { key: 'draft', col: 'draft', type: 'bool', required: false, fallback: false },
      { key: 'bodyMd', col: 'body_md', type: 'text', required: false, fallback: '' },
    ],
    fileKind: 'collection',
    repoPath: (id) => `src/content/logs/${id}.md`,
    repoDir: 'src/content/logs',
    listOrder: 'publish_date DESC',
  },
  chatter: {
    key: 'chatter', table: 'content_chatter', label: '篝火手记',
    fields: [
      { key: 'title', col: 'title', type: 'string', required: true, maxLength: 120 },
      { key: 'description', col: 'description', type: 'string', required: false, maxLength: 240, fallback: '' },
      { key: 'publishDate', col: 'publish_date', type: 'date', required: true },
      { key: 'tags', col: 'tags', type: 'json', required: false, shape: 'strings', fallback: [] },
      { key: 'draft', col: 'draft', type: 'bool', required: false, fallback: false },
      { key: 'bodyMd', col: 'body_md', type: 'text', required: false, fallback: '' },
    ],
    fileKind: 'collection',
    repoPath: (id) => `src/content/chatter/${id}.md`,
    repoDir: 'src/content/chatter',
    listOrder: 'publish_date DESC',
  },
  treasure: {
    key: 'treasure', table: 'content_treasure', label: '道具宝箱',
    fields: [
      { key: 'icon', col: 'icon', type: 'string', required: true, enum: ICONS },
      { key: 'rarity', col: 'rarity', type: 'string', required: false, enum: ['S', 'A', 'B'], fallback: 'B' },
      { key: 'chest', col: 'chest', type: 'string', required: true, enum: CHEST_IDS },
      { key: 'title', col: 'title', type: 'string', required: true, maxLength: 120 },
      { key: 'desc', col: 'description', type: 'string', required: false, fallback: '' },
      { key: 'tags', col: 'tags', type: 'json', required: false, shape: 'strings', itemsEnum: TAG_IDS, fallback: [] },
      { key: 'href', col: 'href', type: 'string', required: false, fallback: '' },
    ],
    fileKind: 'collection',
    repoPath: (id) => `src/content/treasure/${id}.md`,
    repoDir: 'src/content/treasure',
    listOrder: 'title ASC',
  },
  quest: {
    key: 'quest', table: 'content_quest', label: '灵感火花',
    fields: [
      { key: 'title', col: 'title', type: 'string', required: true, maxLength: 120 },
      { key: 'desc', col: 'description', type: 'string', required: false, fallback: '' },
      { key: 'type', col: 'type', type: 'string', required: false, enum: ['main', 'side'], fallback: 'side' },
      { key: 'status', col: 'status', type: 'string', required: false, enum: ['todo', 'active', 'done'], fallback: 'todo' },
      { key: 'diff', col: 'diff', type: 'int', required: false, min: 1, max: 3, fallback: 2 },
      { key: 'objectives', col: 'objectives', type: 'json', required: false, shape: 'objectives', fallback: [] },
      { key: 'exp', col: 'exp', type: 'int', required: true, min: 0, max: 10000 },
      { key: 'gold', col: 'gold', type: 'int', required: true, min: 0, max: 100000 },
    ],
    fileKind: 'collection',
    repoPath: (id) => `src/content/quest/${id}.md`,
    repoDir: 'src/content/quest',
    listOrder: 'updated_at DESC',
  },
  friends: {
    key: 'friends', table: 'content_friends', label: '伙伴酒馆',
    fields: [
      { key: 'name', col: 'name', type: 'string', required: true, maxLength: 60 },
      { key: 'role', col: 'role', type: 'string', required: false, fallback: '' },
      { key: 'intro', col: 'intro', type: 'string', required: false, fallback: '' },
      { key: 'link', col: 'link', type: 'string', required: false, fallback: '' },
      { key: 'avatar', col: 'avatar', type: 'string', required: false, fallback: '' },
      { key: 'sortOrder', col: 'sort_order', type: 'int', required: false, fallback: 0 },
    ],
    fileKind: 'json-array',
    repoPath: () => 'src/data/friends.json',
    repoDir: '',
    listOrder: 'sort_order ASC, id ASC',
  },
  timeline: {
    key: 'timeline', table: 'content_timeline', label: '旅程大事记',
    fields: [
      { key: 'date', col: 'date', type: 'string', required: true, maxLength: 20 },
      { key: 'title', col: 'title', type: 'string', required: true, maxLength: 60 },
      { key: 'desc', col: 'description', type: 'string', required: false, fallback: '' },
      { key: 'link', col: 'link', type: 'string', required: false, fallback: '' },
    ],
    fileKind: 'json-array',
    repoPath: () => 'src/data/timeline.json',
    repoDir: '',
    // 大事记有天然顺序：日期倒序（最新在前），同日按 id 稳定排序；sort_order 列弃用
    listOrder: 'date DESC, id ASC',
  },
  party: {
    key: 'party', table: 'content_party', label: '首页存档',
    fields: [
      { key: 'title', col: 'title', type: 'string', required: true, maxLength: 60 },
      { key: 'class', col: 'class', type: 'string', required: false, fallback: '' },
      { key: 'desc', col: 'description', type: 'string', required: false, fallback: '' },
      { key: 'period', col: 'period', type: 'string', required: false, fallback: '' },
      { key: 'avatar', col: 'avatar', type: 'string', required: false, enum: ['warrior', 'mage'], fallback: 'mage' },
      { key: 'chips', col: 'chips', type: 'json', required: false, shape: 'strings', fallback: [] },
      { key: 'sortOrder', col: 'sort_order', type: 'int', required: false, fallback: 0 },
    ],
    fileKind: 'json-array',
    repoPath: () => 'src/data/home.json',
    repoDir: '',
    listOrder: 'sort_order ASC, id ASC',
  },
  hero: {
    key: 'hero', table: 'content_hero', label: '勇者档案',
    fields: [
      { key: 'name', col: 'name', type: 'string', required: true, maxLength: 60 },
      { key: 'class', col: 'class', type: 'string', required: false, fallback: '' },
      { key: 'bio', col: 'bio', type: 'text', required: false, fallback: '' },
      { key: 'location', col: 'location', type: 'string', required: false, fallback: '' },
      { key: 'status', col: 'status', type: 'string', required: false, fallback: '' },
      { key: 'stats', col: 'stats', type: 'json', required: false, shape: 'stats', fallback: {} },
      { key: 'skills', col: 'skills', type: 'json', required: false, shape: 'skills', fallback: [] },
      { key: 'timeline', col: 'timeline', type: 'json', required: false, shape: 'heroTimeline', fallback: [] },
      { key: 'buffs', col: 'buffs', type: 'json', required: false, shape: 'buffs', fallback: [] },
      { key: 'contacts', col: 'contacts', type: 'json', required: false, shape: 'contacts', fallback: [] },
    ],
    fileKind: 'json-single',
    repoPath: () => 'src/data/hero.json',
    repoDir: '',
    listOrder: 'id ASC',
    fixedId: 'default',
  },
}

export const DOMAIN_KEYS = Object.keys(DOMAINS)

export function getDomain(key: string): DomainDef | null {
  return DOMAINS[key] ?? null
}

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,80}$/

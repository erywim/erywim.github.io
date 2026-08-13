/**
 * 新建道具（收集的资料）脚手架
 * 用法：
 *   bun run item "道具标题"
 *   bun run item "道具标题" my-item-slug    # 指定 slug（推荐用语义化 id，如 spring-docs）
 *
 * 生成 src/content/treasure/<slug>.md（frontmatter 顶部用注释列出所有可选项），
 * 保存后 /treasure 宝箱页与首页道具袋自动生效。icon/rarity/chest/tags 写错会在
 * astro check / build 时由 zod 枚举校验报错。
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { CATEGORIES, CHEST_IDS, ICONS, RARITIES, TAGS } from '../src/data/treasure'

const args = process.argv.slice(2)
const title = args[0] ?? '未命名道具'
const customSlug = args[1]

const today = new Date()
const dateStamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(
  today.getDate()
).padStart(2, '0')}`

function pickSlug(): string {
  if (customSlug) return customSlug
  let slug = `item-${dateStamp}`
  let i = 2
  while (existsSync(join('src', 'content', 'treasure', `${slug}.md`))) {
    slug = `item-${dateStamp}-${i}`
    i += 1
  }
  return slug
}

const slug = pickSlug()

// 标签按分类分组，便于生成可选项注释
const tagsByCat = (Object.keys(CATEGORIES) as (keyof typeof CATEGORIES)[]).map((cat) => ({
  cat,
  ids: TAGS.filter((t) => t.cat === cat).map((t) => t.id)
}))

const tagCommentLines = tagsByCat
  .map((g) => `# tags·${CATEGORIES[g.cat].name}: ${g.ids.join(' | ')}`)
  .join('\n')

// YAML 单引号字符串内转义单引号
const yamlTitle = title.replace(/'/g, "''")

const frontmatter = `---
# ============ 可选项速查 ============
# icon（图标）: ${ICONS.join(' | ')}
# rarity（稀有度）: ${RARITIES.join(' | ')}
# chest（主题宝箱）: ${CHEST_IDS.join(' | ')}
${tagCommentLines}
# ================================
icon: it-book
rarity: B
chest: java
from: ''
title: '${yamlTitle}'
desc: '（一句话简介）'
tags: []
href: ''
---
`

const dir = join('src', 'content', 'treasure')
mkdirSync(dir, { recursive: true })
const file = join(dir, `${slug}.md`)
writeFileSync(file, frontmatter)

console.log(`✓ 已创建：${file}`)
console.log(`  标题：${title}`)
console.log(`  slug：${slug}`)
console.log('')
console.log(`  icon 可选：${ICONS.join(' / ')}`)
console.log(`  rarity 可选：${RARITIES.join(' / ')}`)
console.log(`  chest 可选：${CHEST_IDS.join(' / ')}`)
for (const g of tagsByCat) {
  console.log(`  tags·${CATEGORIES[g.cat].name}：${g.ids.join(' / ')}`)
}
console.log('')
console.log('  保存后即生效；href 留空则渲染为「待读」不可点。')

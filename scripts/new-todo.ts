/**
 * 新建灵感火花（idea / todo 任务）脚手架
 * 用法：
 *   bun run todo "任务标题"
 *   bun run todo "任务标题" my-task-slug    # 指定 slug（推荐语义化 id）
 *
 * 生成 src/content/quest/<slug>.md（frontmatter 顶部用注释列出所有可选项），
 * 保存后 /ideas 页自动生效。type/status/diff 写错会在
 * astro check / build 时由 zod 枚举校验报错。
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { STATUS_IDS, TYPE_IDS } from '../src/data/quest'

const args = process.argv.slice(2)
const title = args[0] ?? '未命名火花'
const customSlug = args[1]

const today = new Date()
const dateStamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(
  today.getDate()
).padStart(2, '0')}`

function pickSlug(): string {
  if (customSlug) return customSlug
  let slug = `spark-${dateStamp}`
  let i = 2
  while (existsSync(join('src', 'content', 'quest', `${slug}.md`))) {
    slug = `spark-${dateStamp}-${i}`
    i += 1
  }
  return slug
}

const slug = pickSlug()

// YAML 单引号字符串内转义单引号
const yamlTitle = title.replace(/'/g, "''")

// RPG 掉落：金币 <150、经验 <200，随机生成，任务完成后计入全局等级
const gold = 1 + Math.floor(Math.random() * 149)
const exp = 1 + Math.floor(Math.random() * 199)

const frontmatter = `---
# ============ 可选项速查 ============
# type（类型）: ${TYPE_IDS.join(' | ')}
# status（状态）: ${STATUS_IDS.join(' | ')}
# diff（难度）: 1（轻松） | 2（适中） | 3（硬核）
# desc（描述）：单行可写 '一句话'；要换行/分段时改用块标量 `desc: |`，空行分段
# objectives（目标清单）：每行一项，done: true 表示已完成
# exp / gold：任务完成后的掉落（已随机生成，可手改）
# ================================
title: '${yamlTitle}'
desc: '（一句话描述）'
type: side
status: todo
diff: 2
objectives:
  - { t: '目标 1', done: false }
  - { t: '目标 2', done: false }
exp: ${exp}
gold: ${gold}
---
`

const dir = join('src', 'content', 'quest')
mkdirSync(dir, { recursive: true })
const file = join(dir, `${slug}.md`)
writeFileSync(file, frontmatter)

console.log(`✓ 已创建：${file}`)
console.log(`  标题：${title}`)
console.log(`  slug：${slug}`)
console.log(`  exp：${exp}（<200）  gold：${gold}（<150）`)
console.log('')
console.log(`  type 可选：${TYPE_IDS.join(' / ')}`)
console.log(`  status 可选：${STATUS_IDS.join(' / ')}`)
console.log(`  diff 可选：1（轻松） / 2（适中） / 3（硬核）`)
console.log('')
console.log('  保存后即生效；改 status / objectives[].done 即可更新完成状态。')

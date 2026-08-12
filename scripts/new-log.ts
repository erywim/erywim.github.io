/**
 * 新建周报脚手架
 * 用法：
 *   bun run new-log "第34周：xxx"
 *   bun run new-log "第34周：xxx" 34       # 指定周数（可选）
 *
 * 不指定周数时自动取现有周报最大周数 +1（无周报时取当前 ISO 周）。
 * 生成 src/content/logs/<year>-week-<n>.md，保存即生效并计入统计。
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const title = args[0] ?? '本周小结'
const weekArg = args[1] ? Number(args[1]) : null

const logsDir = join('src', 'content', 'logs')

function maxWeek(): number {
  if (!existsSync(logsDir)) return 0
  let max = 0
  for (const f of readdirSync(logsDir)) {
    if (!/\.md$/.test(f)) continue
    const m = readFileSync(join(logsDir, f), 'utf-8').match(/^week:\s*(\d+)/m)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return max
}

/** ISO 8601 周数 */
function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

const existing = maxWeek()
const week = weekArg ?? (existing > 0 ? existing + 1 : isoWeek(new Date()))
const today = new Date()
const slug = `${today.getFullYear()}-week-${week}`

mkdirSync(logsDir, { recursive: true })
const file = join(logsDir, `${slug}.md`)
writeFileSync(
  file,
  `---
title: '${title.replace(/'/g, "''")}'
description: '……'
publishDate: ${today.toISOString().slice(0, 10)}
week: ${week}
---
`
)

console.log(`✓ 已创建：${file}`)
console.log(`  标题：${title}`)
console.log(`  周数：第 ${week} 周 · 日期 ${today.toISOString().slice(0, 10)}`)
console.log('  保存即生效，/logs 与各项统计会自动更新。')

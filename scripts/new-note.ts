/**
 * 新建篝火手记脚手架
 * 用法：
 *   bun run note "手记标题"
 *   bun run note "手记标题" sdd-reflection    # 指定 URL slug（可选）
 *
 * 生成 src/content/chatter/<slug>.md，默认 draft: true。
 * 写完正文并将 draft 改为 false 后，手记才会出现在「篝火手记」时间线中。
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const title = args[0] ?? '未命名手记'
const customSlug = args[1]

const today = new Date()
const dateStamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
  today.getDate()
).padStart(2, '0')}`
const chatterDir = join('src', 'content', 'chatter')

function pickSlug(): string {
  const base = customSlug || `note-${dateStamp.replaceAll('-', '')}`
  if (customSlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(customSlug)) {
    throw new Error('slug 只支持字母、数字和短横线，例如 sdd-reflection')
  }

  let slug = base
  let suffix = 2
  while (
    existsSync(join(chatterDir, `${slug}.md`)) ||
    existsSync(join(chatterDir, `${slug}.mdx`))
  ) {
    slug = `${base}-${suffix}`
    suffix += 1
  }
  return slug
}

const slug = pickSlug()
const yamlTitle = title.replace(/'/g, "''")
const frontmatter = `---
# ============ 篝火手记 Frontmatter 速查 ============
# title（必填）：手记标题，最长 120 个字符。
# description（可选）：时间线摘要，最长 240 个字符；需要换行时可写成 description: |。
# publishDate（必填）：发布日期，格式 YYYY-MM-DD；脚手架默认填今天。
# tags（可选）：字符串数组，例如 [开发, SDD]；保存时会自动去重并转为小写。
# draft（可选）：只能填写 true / false；新建默认 true，改成 false 后才会发布。
# 发布流程：写正文 → 填摘要和标签 → 将 draft 改为 false → 保存并重新构建。
# =====================================================
title: '${yamlTitle}'
description: '（填写时间线摘要，不超过 240 字）'
publishDate: ${dateStamp}
tags: []
draft: true
---

## ▍手记正文

（在这里写下今天想留下的几句话……）
`

mkdirSync(chatterDir, { recursive: true })
const file = join(chatterDir, `${slug}.md`)
writeFileSync(file, frontmatter, 'utf8')

console.log(`✓ 已创建：${file}`)
console.log(`  标题：${title}`)
console.log(`  地址：/chatter/${slug}`)
console.log(`  日期：${dateStamp}`)
console.log('  默认 draft:true；写完正文后改为 false 才会发布。')

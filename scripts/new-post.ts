/**
 * 新建博客文章脚手架
 * 用法：
 *   bun run new-post "文章标题"
 *   bun run new-post "文章标题" my-slug      # 指定 URL slug（可选）
 *
 * 生成 src/content/blog/<slug>/index.md，默认 draft: true（设为 false 后才会发布）。
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const title = args[0] ?? '未命名文章'
const customSlug = args[1]

const today = new Date()
const dateStamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(
  today.getDate()
).padStart(2, '0')}`

function pickSlug(): string {
  if (customSlug) return customSlug
  // 默认 post-YYYYMMDD，若已存在则追加序号
  let slug = `post-${dateStamp}`
  let i = 2
  while (existsSync(join('src', 'content', 'blog', slug))) {
    slug = `post-${dateStamp}-${i}`
    i += 1
  }
  return slug
}

const slug = pickSlug()
const dir = join('src', 'content', 'blog', slug)

// YAML 单引号字符串内转义单引号
const yamlTitle = title.replace(/'/g, "''")

const frontmatter = `---
title: '${yamlTitle}'
description: '（在这里填写文章摘要，不超过 160 字）'
publishDate: ${today.toISOString().slice(0, 10)}
rank: B
category: 技术
tags: []
draft: true
---

## ▍任务摘要

（在这里写下文章的开头……）

## ▍第一章 · 待填写

（章节内容……）
`

mkdirSync(dir, { recursive: true })
const file = join(dir, 'index.md')
writeFileSync(file, frontmatter)

console.log(`✓ 已创建：${file}`)
console.log(`  标题：${title}`)
console.log(`  地址：/blog/${slug}`)
console.log('  注意：默认 draft:true，写完把 frontmatter 里 draft 改为 false 即可发布。')

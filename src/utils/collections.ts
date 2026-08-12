import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { getCollection, type CollectionEntry } from 'astro:content'

/**
 * 集合目录下是否存在 .md/.mdx 文件。
 * Astro 对「未注册的空集合」调用 getCollection 会打印警告；
 * 目录为空时直接返回 []，避免噪音，也不依赖占位内容。
 */
function collectionHasFiles(base: string): boolean {
  if (!existsSync(base)) return false
  const stack: string[] = [base]
  while (stack.length) {
    const dir = stack.pop() as string
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      const p = join(dir, e.name)
      if (e.isDirectory()) stack.push(p)
      else if (/\.(md|mdx)$/.test(e.name)) return true
    }
  }
  return false
}

/** 已发布文章，按日期倒序（首页冒险记录用） */
export async function getPublishedBlog(): Promise<CollectionEntry<'blog'>[]> {
  if (!collectionHasFiles('src/content/blog')) return []
  const posts = await getCollection('blog', ({ data }) => !data.draft)
  return posts.sort((a, b) => b.data.publishDate.getTime() - a.data.publishDate.getTime())
}

/** 已发布周报，按日期倒序 */
export async function getPublishedLogs(): Promise<CollectionEntry<'logs'>[]> {
  if (!collectionHasFiles('src/content/logs')) return []
  const logs = await getCollection('logs', ({ data }) => !data.draft)
  return logs.sort((a, b) => b.data.publishDate.getTime() - a.data.publishDate.getTime())
}

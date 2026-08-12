import { getCollection, type CollectionEntry } from 'astro:content'

const RANK_ORDER: Record<string, number> = { S: 0, A: 1, B: 2, C: 3 }

/** 已发布文章，按日期倒序（首页冒险记录用） */
export async function getPublishedBlog(): Promise<CollectionEntry<'blog'>[]> {
  const posts = await getCollection('blog', ({ data }) => !data.draft)
  return posts.sort((a, b) => b.data.publishDate.getTime() - a.data.publishDate.getTime())
}

/** 冒险记录：按难度 S→C，同级按日期倒序 */
export async function getBlogByRank(): Promise<CollectionEntry<'blog'>[]> {
  const posts = await getPublishedBlog()
  return posts.sort((a, b) => {
    const diff = (RANK_ORDER[a.data.rank] ?? 2) - (RANK_ORDER[b.data.rank] ?? 2)
    if (diff !== 0) return diff
    return b.data.publishDate.getTime() - a.data.publishDate.getTime()
  })
}

/** 已发布周报，按日期倒序 */
export async function getPublishedLogs(): Promise<CollectionEntry<'logs'>[]> {
  const logs = await getCollection('logs', ({ data }) => !data.draft)
  return logs.sort((a, b) => b.data.publishDate.getTime() - a.data.publishDate.getTime())
}

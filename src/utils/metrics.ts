import { getPublishedBlog, getPublishedLogs } from './collections'

/**
 * 站点内容统计（实时计算，供 HUD / 状态面板 / 冒险档案共用，保证一致）
 * - essays：非「笔记」分类的文章数
 * - notes：分类为「笔记」的文章数
 * - logs：周报数
 * - total：文章 + 周报 = 文章总数
 */
export async function getMetrics() {
  const [posts, logs] = await Promise.all([getPublishedBlog(), getPublishedLogs()])
  const essays = posts.filter((p) => p.data.category !== '笔记').length
  const notes = posts.length - essays
  return {
    total: posts.length + logs.length,
    essays,
    notes,
    logs: logs.length
  }
}

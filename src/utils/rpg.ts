import type { CollectionEntry } from 'astro:content'

/**
 * RPG 掉落统计（金币/经验）
 * - 每篇已发布文章在创建时随机掉落 gold（1~19）与 exp（1~99），存在 frontmatter。
 * - 本站为纯静态站，构建期把每篇文章的 {id, gold, exp} 内嵌进页面，
 *   由客户端异步求和并回显（HUD / 状态面板 / 天空频道）。
 * - quests 只含求和所需的最小字段，控制内嵌体积。
 */

export interface RpgQuest {
  id: string
  gold: number
  exp: number
}

export interface RpgStats {
  /** 金币合计（所有已发布文章 gold 之和） */
  gold: number
  /** 经验合计（所有已发布文章 exp 之和） */
  exp: number
  /** 等级 = 每 100 经验升一级，上限 100、下限 1（称号设计到 100 级） */
  level: number
  /** 供客户端异步求和的紧凑数据 */
  quests: RpgQuest[]
}

export function getRpgStats(posts: CollectionEntry<'blog'>[]): RpgStats {
  const gold = posts.reduce((s, p) => s + p.data.gold, 0)
  const exp = posts.reduce((s, p) => s + p.data.exp, 0)
  return {
    gold,
    exp,
    level: Math.min(100, Math.max(1, Math.floor(exp / 100) + 1)),
    quests: posts.map((p) => ({ id: p.id, gold: p.data.gold, exp: p.data.exp }))
  }
}

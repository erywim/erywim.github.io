import { Hono } from 'hono'

import type { AdminEnv } from '../env'

/** GET /admin/dict —— 字典表（下拉框选项，按 category 分组） */
export const dict = new Hono<AdminEnv>()

dict.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT category, value, label FROM dict_options ORDER BY category, sort_order, id'
  ).all<{ category: string; value: string; label: string }>()

  const categories: Record<string, { value: string; label: string }[]> = {}
  for (const row of results ?? []) {
    ;(categories[row.category] ??= []).push({ value: row.value, label: row.label })
  }
  return c.json({ categories })
})

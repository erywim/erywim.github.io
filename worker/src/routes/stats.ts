import { Hono } from 'hono'

import type { AdminEnv } from '../env'

/** /admin/stats —— 访问统计聚合（visits 表；登录后可用）。
 *  时间口径统一北京时间（visited_at 为 UTC，查询时 +8h 转换）；?from/to=YYYY-MM-DD 为闭区间，可只填一边 */
export const stats = new Hono<AdminEnv>()

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

interface Range {
  /** WHERE 子句（日期条件，可空） */
  cond: string
  binds: string[]
}

function parseRange(fromRaw: string | undefined, toRaw: string | undefined): Range {
  const where: string[] = []
  const binds: string[] = []
  const from = DATE_RE.test(fromRaw ?? '') ? (fromRaw as string) : ''
  const to = DATE_RE.test(toRaw ?? '') ? (toRaw as string) : ''
  if (from) {
    where.push("datetime(visited_at, '+8 hours') >= ?")
    binds.push(`${from} 00:00:00`)
  }
  if (to) {
    where.push("datetime(visited_at, '+8 hours') < datetime(?, '+1 day')")
    binds.push(`${to} 00:00:00`)
  }
  return { cond: where.length > 0 ? `WHERE ${where.join(' AND ')}` : '', binds }
}

interface VisitRow {
  id: number
  ip: string
  path: string
  user_agent: string | null
  referer: string | null
  country: string | null
  visited_at: string
}

/** GET /admin/stats/visits —— 概览 + 每日趋势 + 访客排行 + 热门页面 + 最新流水（一次 batch） */
stats.get('/visits', async (c) => {
  const { cond, binds } = parseRange(c.req.query('from'), c.req.query('to'))
  const today = "substr(datetime(visited_at, '+8 hours'), 1, 10) = substr(datetime('now', '+8 hours'), 1, 10)"

  const batch = await c.env.DB.batch([
    c.env.DB.prepare(`SELECT COUNT(*) AS pv, COUNT(DISTINCT ip) AS uv FROM visits ${cond}`).bind(...binds),
    c.env.DB.prepare(`SELECT COUNT(*) AS pv, COUNT(DISTINCT ip) AS uv FROM visits WHERE ${today}`),
    c.env.DB.prepare(
      `SELECT substr(datetime(visited_at, '+8 hours'), 1, 10) AS day, COUNT(*) AS pv, COUNT(DISTINCT ip) AS uv
       FROM visits ${cond} GROUP BY day ORDER BY day DESC LIMIT 90`
    ).bind(...binds),
    c.env.DB.prepare(
      `SELECT ip, COUNT(*) AS hits, COUNT(DISTINCT path) AS paths, MIN(visited_at) AS first_at, MAX(visited_at) AS last_at, MAX(country) AS country
       FROM visits ${cond} GROUP BY ip ORDER BY hits DESC LIMIT 50`
    ).bind(...binds),
    c.env.DB.prepare(
      `SELECT path, COUNT(*) AS pv, COUNT(DISTINCT ip) AS uv
       FROM visits ${cond} GROUP BY path ORDER BY uv DESC, pv DESC LIMIT 50`
    ).bind(...binds),
    c.env.DB.prepare(
      `SELECT id, ip, path, user_agent, referer, country, visited_at
       FROM visits ${cond} ORDER BY id DESC LIMIT 50`
    ).bind(...binds),
  ])

  const [rangeRow, todayRow, dailyRaw, topIps, topPaths, recent] = batch as unknown as [
    { results: { pv: number; uv: number }[] },
    { results: { pv: number; uv: number }[] },
    { results: { day: string; pv: number; uv: number }[] },
    { results: { ip: string; hits: number; paths: number; first_at: string; last_at: string; country: string | null }[] },
    { results: { path: string; pv: number; uv: number }[] },
    { results: VisitRow[] }
  ]

  return c.json({
    overview: {
      range: rangeRow.results[0] ?? { pv: 0, uv: 0 },
      today: todayRow.results[0] ?? { pv: 0, uv: 0 },
    },
    daily: dailyRaw.results.slice().reverse(), // 反转为升序，前端直接画趋势
    topIps: topIps.results,
    topPaths: topPaths.results,
    recent: recent.results,
  })
})

/** GET /admin/stats/visits/recent —— 流水翻页：?before=<本页最小 id>（+ 同样的 from/to 过滤） */
stats.get('/visits/recent', async (c) => {
  const { cond, binds } = parseRange(c.req.query('from'), c.req.query('to'))
  const before = Number(c.req.query('before') ?? '')
  const hasBefore = Number.isInteger(before) && before > 0

  // 拼接两段过滤：before 条件在前（其绑定参数先于日期参数出现）
  const where: string[] = []
  const allBinds: (string | number)[] = []
  if (hasBefore) {
    where.push('id < ?')
    allBinds.push(before)
  }
  if (cond) {
    where.push(cond.replace(/^WHERE /, ''))
    allBinds.push(...binds)
  }
  const sql = `SELECT id, ip, path, user_agent, referer, country, visited_at
    FROM visits ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC LIMIT 50`

  const { results } = await c.env.DB.prepare(sql)
    .bind(...allBinds)
    .all<VisitRow>()
  return c.json({ recent: results ?? [] })
})

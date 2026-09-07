import { Hono } from 'hono'

import type { Env } from '../env'
import { plusSeconds } from '../lib/db'

/** POST /visit —— 公开埋点：记录一次页面访问（PV）。防滥用：Origin 白名单（全局 cors）+ 每 IP 每分钟限频 */
export const visit = new Hono<{ Bindings: Env }>()

/** 同 IP 60 秒内最多记录条数，超出静默丢弃（正常浏览远达不到） */
const RATE_PER_MINUTE = 30

visit.post('/', async (c) => {
  let body: { path?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_json' }, 400)
  }
  // 只收站内路径并限长；垃圾数据一律记作根路径
  const raw = typeof body.path === 'string' ? body.path.trim() : ''
  const path = raw.startsWith('/') && raw.length <= 200 ? raw : '/'

  const ip = c.req.header('CF-Connecting-IP') ?? '0.0.0.0'
  const ua = c.req.header('User-Agent')?.slice(0, 300) ?? null
  const referer = c.req.header('Referer')?.slice(0, 300) ?? null
  const country = c.req.header('CF-IPCountry') ?? null

  try {
    // 限频：近 60 秒同 IP 计数（本地 wrangler dev 固定 0.0.0.0，不影响联调）
    const recent = await c.env.DB.prepare(
      'SELECT COUNT(*) AS n FROM visits WHERE ip = ? AND visited_at >= ?'
    )
      .bind(ip, plusSeconds(new Date(), -60))
      .first<{ n: number }>()
    if ((recent?.n ?? 0) >= RATE_PER_MINUTE) {
      return c.json({ ok: true, skipped: true })
    }

    await c.env.DB.prepare(
      'INSERT INTO visits (ip, path, user_agent, referer, country) VALUES (?, ?, ?, ?, ?)'
    )
      .bind(ip, path, ua, referer, country)
      .run()
    return c.json({ ok: true })
  } catch (e) {
    console.error('visit_insert_failed', { message: e instanceof Error ? e.message : String(e) })
    return c.json({ error: 'd1_unavailable' }, 503)
  }
})

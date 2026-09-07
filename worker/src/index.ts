/**
 * erywim-blog-api — Cloudflare TypeScript Worker（hono 骨架）
 *
 * 路由分层：
 *   /health, /api/hello   公开探针（只读）
 *   /admin/*              后台 API（权限系统 + 内容管理，随 openspec change 逐步上线）
 */
import { Hono } from 'hono'

import type { Env } from './env'
import { cors } from './middleware/cors'
import { admin } from './routes/admin'
import { probe } from './routes/probe'

const app = new Hono<{ Bindings: Env }>()

// 公开探针走全局 CORS；/admin/* 由 adminGuard 处理（credentials 版）
app.use('*', async (c, next) => {
  if (c.req.path.startsWith('/admin')) return next()
  return cors(c, next)
})
app.route('/', probe)
app.route('/admin', admin)

app.notFound((c) => c.json({ error: 'not_found' }, 404))
app.onError((err, c) => {
  console.error('unhandled_error', {
    path: c.req.path,
    method: c.req.method,
    message: err instanceof Error ? err.message : String(err),
  })
  return c.json({ error: 'internal_error' }, 500)
})

export default app

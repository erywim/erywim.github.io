import type { Context, MiddlewareHandler } from 'hono'
import type { Env } from '../env'

const DEFAULT_ALLOWED_ORIGINS = new Set([
  'https://erywim.github.io',
  'http://localhost:4321',
  'http://127.0.0.1:4321',
])

export function allowedOrigins(c: Context): Set<string> {
  const configured = c.env?.ALLOWED_ORIGINS ?? ''
  const origins = configured
    .split(',')
    .map((o: string) => o.trim())
    .filter(Boolean)
  return origins.length > 0 ? new Set(origins) : DEFAULT_ALLOWED_ORIGINS
}

/**
 * 与旧 Python Worker 对等的 CORS 策略：
 * 带 Origin 且不在白名单 → 403 origin_not_allowed；
 * OPTIONS → 204 短路；其余响应回显允许头。
 * （admin 路由后续在此基础上叠 credentials / 更多方法，见 openspec 设计 D5）
 */
export const cors: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const origin = c.req.header('Origin')
  let headers: Record<string, string> = {}

  if (origin) {
    if (!allowedOrigins(c).has(origin)) {
      return c.json({ error: 'origin_not_allowed' }, 403, { 'Cache-Control': 'no-store' })
    }
    headers = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Accept, Content-Type',
      Vary: 'Origin',
    }
  }

  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204, headers)
  }

  await next()
  for (const [k, v] of Object.entries(headers)) c.header(k, v, { append: false })
}

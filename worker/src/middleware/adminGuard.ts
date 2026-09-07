import type { MiddlewareHandler } from 'hono'

import type { AdminEnv, Env } from '../env'
import { allowedOrigins } from './cors'
import { findSession, readSessionCookie, touchSession } from '../lib/session'

/**
 * /admin/* 的守卫（设计 D5）：
 * 1. 跨站 Cookie：仅允许白名单来源，回显 Allow-Credentials（ SameSite=None 的对端要求）
 * 2. 写接口强制 application/json —— 非简单请求触发预检，预检不过浏览器直接拦截（CSRF 收敛）
 * 3. 会话校验（登录接口本身除外，由路由单独豁免）
 */

const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
const ALLOWED_HEADERS = 'Accept, Content-Type'

export const adminCors: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const origin = c.req.header('Origin')
  if (origin && !allowedOrigins(c).has(origin)) {
    return c.json({ error: 'origin_not_allowed' }, 403)
  }
  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204, {
      ...(origin
        ? {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Methods': ALLOWED_METHODS,
            'Access-Control-Allow-Headers': ALLOWED_HEADERS,
            Vary: 'Origin',
          }
        : {}),
    })
  }
  await next()
  if (origin) {
    c.header('Access-Control-Allow-Origin', origin, { append: false })
    c.header('Access-Control-Allow-Credentials', 'true', { append: false })
    c.header('Access-Control-Allow-Methods', ALLOWED_METHODS, { append: false })
    c.header('Access-Control-Allow-Headers', ALLOWED_HEADERS, { append: false })
    c.header('Vary', 'Origin', { append: false })
  }
}

/** 非安全方法必须 JSON（预检强化 + 服务端兜底）；/admin/upload 走 multipart，改要求自定义头强制预检 */
export const jsonOnly: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const method = c.req.method.toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') {
    if (c.req.path === '/admin/upload') {
      if (c.req.header('X-Admin-Upload') !== '1') {
        return c.json({ error: 'missing_upload_header' }, 400)
      }
      await next()
      return
    }
    const contentType = c.req.header('Content-Type') ?? ''
    if (!contentType.startsWith('application/json')) {
      return c.json({ error: 'content_type_required', message: '写接口仅接受 application/json。' }, 415)
    }
  }
  await next()
}

export const requireAuth: MiddlewareHandler<AdminEnv> = async (c, next) => {
  const token = readSessionCookie(c.req.header('Cookie'))
  const session = token ? await findSession(c.env, token) : null
  if (!session) {
    return c.json({ error: 'unauthorized' }, 401)
  }
  c.set('adminSession', session)
  await touchSession(c.env, session)
  await next()
}

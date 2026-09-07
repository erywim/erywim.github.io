import { Hono } from 'hono'

import type { AdminEnv, Env } from '../env'
import { writeAudit } from '../lib/audit'
import { nowStr } from '../lib/db'
import { burnDummyPassword, verifyPassword } from '../lib/password'
import {
  clearSessionCookie,
  createSession,
  revokeSession,
  sessionCookie,
} from '../lib/session'
import { checkLocked, recordFailure, resetFails } from '../lib/throttle'
import { adminCors, jsonOnly, requireAuth } from '../middleware/adminGuard'
import { content } from './content'
import { dict } from './dict'
import { publishRoutes } from './publish'
import { stats } from './stats'
import { upload } from './upload'

/** /admin/* —— 后台 API（规格 admin-auth） */
export const admin = new Hono<AdminEnv>()

admin.use('*', adminCors)

/** 登录：限流 + PBKDF2 校验 + 建会话（豁免 requireAuth，但仍走 jsonOnly） */
admin.use('/login', jsonOnly)
admin.post('/login', async (c) => {
  let body: { username?: unknown; password?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid_json' }, 400)
  }
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!username || !password) {
    return c.json({ error: 'invalid_credentials' }, 401)
  }

  // 限流：锁定期内即使凭据正确也拒绝（规格场景「连续失败触发锁定」）
  const throttle = await checkLocked(c.env, username)
  if (throttle.locked) {
    return c.json(
      { error: 'locked', message: '尝试次数过多，请 15 分钟后再试。', retry_after: throttle.retryAfterSeconds },
      429,
      { 'Retry-After': String(throttle.retryAfterSeconds) }
    )
  }

  const fail = async () => {
    await burnDummyPassword(password)
    await recordFailure(c.env, username)
    return c.json({ error: 'invalid_credentials', message: '账号或密码不正确。' }, 401)
  }

  const user = await c.env.DB.prepare('SELECT id, password_hash FROM admin_users WHERE username = ?')
    .bind(username)
    .first<{ id: number; password_hash: string }>()
  if (!user) return fail()

  const ok = await verifyPassword(password, user.password_hash)
  if (!ok) return fail()

  await resetFails(c.env, username)
  await c.env.DB.prepare('UPDATE admin_users SET last_login_at = ?, updated_at = ? WHERE id = ?')
    .bind(nowStr(), nowStr(), user.id)
    .run()

  const ua = c.req.header('User-Agent') ?? null
  const ip = c.req.header('CF-Connecting-IP') ?? null
  const { token } = await createSession(c.env, user.id, ua, ip)
  await writeAudit(c.env, user.id, 'login', `user/${username}`, ip ?? undefined)

  return c.json({ ok: true, username }, 200, { 'Set-Cookie': sessionCookie(token) })
})

/** 以下全部需要会话 */
admin.use('*', jsonOnly)
admin.use('*', requireAuth)

/** 内容工作区 CRUD（登录后可用） */
admin.route('/content', content)

/** 发布与同步 */
admin.route('/publish', publishRoutes)

/** 图片上传（multipart，走 /admin/upload） */
admin.route('/upload', upload)

/** 字典表（下拉框选项） */
admin.route('/dict', dict)

/** 访问统计（visits 聚合） */
admin.route('/stats', stats)

admin.get('/me', async (c) => {
  const session = c.get('adminSession')
  const user = await c.env.DB.prepare(
    'SELECT username, last_login_at FROM admin_users WHERE id = ?'
  )
    .bind(session.userId)
    .first<{ username: string; last_login_at: string | null }>()
  if (!user) return c.json({ error: 'unauthorized' }, 401)
  return c.json({ username: user.username, lastLoginAt: user.last_login_at, expiresAt: session.expiresAt })
})

admin.post('/logout', async (c) => {
  const session = c.get('adminSession')
  const token = (c.req.header('Cookie') ?? '').match(/erywim_admin_session=([^;]+)/)?.[1] ?? ''
  await revokeSession(c.env, token)
  await writeAudit(c.env, session.userId, 'logout')
  return c.json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() })
})

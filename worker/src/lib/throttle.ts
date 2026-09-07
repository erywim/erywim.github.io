import type { Context } from 'hono'

import type { Env } from '../env'
import { isExpired, nowStr, plusSeconds } from './db'

/** 登录限流（规格 admin-auth「登录限流」）：同 key 连败 5 次锁 15 分钟 */
const MAX_FAILS = 5
const LOCK_SECONDS = 15 * 60

export interface ThrottleState {
  locked: boolean
  retryAfterSeconds: number
}

export async function checkLocked(env: Env, key: string): Promise<ThrottleState> {
  const row = await env.DB.prepare(
    'SELECT locked_until FROM login_attempts WHERE key = ?'
  )
    .bind(key)
    .first<{ locked_until: string | null }>()
  if (row?.locked_until && !isExpired(row.locked_until)) {
    const remain = Math.max(1, Math.ceil((Date.parse(row.locked_until.replace(' ', 'T') + 'Z') - Date.now()) / 1000))
    return { locked: true, retryAfterSeconds: remain }
  }
  return { locked: false, retryAfterSeconds: 0 }
}

export async function recordFailure(env: Env, key: string): Promise<void> {
  const now = new Date()
  await env.DB.prepare(
    `INSERT INTO login_attempts (key, fail_count, last_attempt_at) VALUES (?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET
       fail_count = CASE WHEN locked_until IS NOT NULL AND locked_until > ? THEN 0 ELSE fail_count + 1 END,
       locked_until = CASE WHEN fail_count + 1 >= ? THEN ? ELSE locked_until END,
       last_attempt_at = ?`
  )
    .bind(key, nowStr(), nowStr(), MAX_FAILS, plusSeconds(now, LOCK_SECONDS), nowStr())
    .run()
}

export async function resetFails(env: Env, key: string): Promise<void> {
  await env.DB.prepare('DELETE FROM login_attempts WHERE key = ?').bind(key).run()
}

/** 供测试/调试查看状态 */
export async function throttleInfo(c: Context<{ Bindings: Env }>, key: string) {
  return c.env.DB.prepare('SELECT fail_count, locked_until, last_attempt_at FROM login_attempts WHERE key = ?')
    .bind(key)
    .first()
}

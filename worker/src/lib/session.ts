import type { Env } from '../env'
import { b64url, nowStr, plusSeconds, sha256Hex } from './db'

/**
 * 服务端会话（规格 admin-auth「会话生命周期」）：
 * - token：256bit 随机，明文只在 Cookie；库存 sha256(token) hex
 * - 策略（2026-09-08 起）：完全不做会话保持——Cookie 为浏览器会话级（关浏览器即失效），
 *   每次打开后台都要重新登录；服务端 12 小时上限兜底 + 滑动续期（距上次活跃 >10 分钟才写库）
 * - 登出即删行，Cookie 随之失效
 */

export const SESSION_COOKIE = 'erywim_admin_session'
const SESSION_TTL_SECONDS = 12 * 3600
const RENEW_WRITE_THRESHOLD_SECONDS = 600

export interface SessionInfo {
  id: string
  userId: number
  expiresAt: string
}

export function newToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return b64url(bytes)
}

export async function createSession(
  env: Env,
  userId: number,
  ua: string | null,
  ip: string | null
): Promise<{ token: string; expiresAt: string }> {
  const token = newToken()
  const id = await sha256Hex(token)
  const expiresAt = plusSeconds(new Date(), SESSION_TTL_SECONDS)
  await env.DB.prepare(
    'INSERT INTO admin_sessions (id, user_id, expires_at, last_seen_at, ua, ip) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(id, userId, expiresAt, nowStr(), ua, ip)
    .run()
  // 顺手清扫过期会话（免登录频率升高后表膨胀）
  await env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(nowStr()).run()
  return { token, expiresAt }
}

export async function findSession(env: Env, token: string): Promise<SessionInfo | null> {
  if (!token) return null
  const id = await sha256Hex(token)
  const row = await env.DB.prepare(
    'SELECT id, user_id, expires_at FROM admin_sessions WHERE id = ?'
  )
    .bind(id)
    .first<{ id: string; user_id: number; expires_at: string }>()
  if (!row) return null
  if (row.expires_at <= nowStr()) {
    await env.DB.prepare('DELETE FROM admin_sessions WHERE id = ?').bind(id).run()
    return null
  }
  return { id: row.id, userId: row.user_id, expiresAt: row.expires_at }
}

/** 滑动续期：超过阈值未活跃才写库 */
export async function touchSession(env: Env, session: SessionInfo): Promise<void> {
  const row = await env.DB.prepare('SELECT last_seen_at FROM admin_sessions WHERE id = ?')
    .bind(session.id)
    .first<{ last_seen_at: string | null }>()
  const lastSeen = row?.last_seen_at
  const stale =
    !lastSeen ||
    (Date.now() - Date.parse(lastSeen.replace(' ', 'T') + 'Z')) / 1000 > RENEW_WRITE_THRESHOLD_SECONDS
  if (!stale) return
  await env.DB.prepare(
    'UPDATE admin_sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?'
  )
    .bind(nowStr(), plusSeconds(new Date(), SESSION_TTL_SECONDS), session.id)
    .run()
}

export async function revokeSession(env: Env, token: string): Promise<void> {
  const id = await sha256Hex(token)
  await env.DB.prepare('DELETE FROM admin_sessions WHERE id = ?').bind(id).run()
}

/** 浏览器会话级 Cookie：不设 Max-Age，关闭浏览器即失效（应用内 12h 上限由服务端兜底） */
export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=None`
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0`
}

export function readSessionCookie(header: string | null | undefined): string {
  if (!header) return ''
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === SESSION_COOKIE) return v.join('=')
  }
  return ''
}

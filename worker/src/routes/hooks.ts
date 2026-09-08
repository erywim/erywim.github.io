/**
 * /hooks/* —— CI 回调（无会话，令牌鉴权）。
 *   POST /hooks/sync  GitHub Actions 部署完成后调用：仓库 → D1 安全同步（skipDirty，
 *                     不覆盖后台未发布修改），让后台之外的仓库改动（IDE/网页/删除）自动对齐进 D1。
 */

import { Hono } from 'hono'

import type { Env } from '../env'
import { writeAudit } from '../lib/audit'
import { syncAll } from '../lib/sync'

export const hooks = new Hono<{ Bindings: Env }>()

/** 常数时间令牌比较（先各自 SHA-256 再逐字节异或，避免时序侧信道） */
async function tokenMatches(expected: string, provided: string): Promise<boolean> {
  const enc = new TextEncoder()
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
    crypto.subtle.digest('SHA-256', enc.encode(provided)),
  ])
  const va = new Uint8Array(a)
  const vb = new Uint8Array(b)
  let diff = 0
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i]
  return diff === 0
}

hooks.post('/sync', async (c) => {
  const expected = c.env.CI_SYNC_TOKEN
  if (!expected) return c.json({ error: 'not_found' }, 404) // 未配置令牌 = 端点关闭
  const provided = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!provided || !(await tokenMatches(expected, provided))) {
    return c.json({ error: 'unauthorized' }, 401)
  }
  const report = await syncAll(c.env, { skipDirty: true })
  await writeAudit(c.env, null, 'ci-sync', '*', JSON.stringify(report).slice(0, 500))
  return c.json({ ok: true, report })
})

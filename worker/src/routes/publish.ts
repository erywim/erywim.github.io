import { Hono } from 'hono'

import type { AdminEnv } from '../env'
import { writeAudit } from '../lib/audit'
import { getDomain } from '../lib/domains'
import { getFile, GithubError } from '../lib/github'
import { publishAll, publishItem, PublishError } from '../lib/publish'
import { syncAll, syncSingle } from '../lib/sync'

/** /admin/publish/* —— 发布与同步（规格 content-management）；静态路由先于参数路由 */
export const publishRoutes = new Hono<AdminEnv>()

function errorStatus(err: unknown): { status: number; body: Record<string, unknown> } {
  if (err instanceof PublishError) {
    return {
      status: err.kind === 'not_found' ? 404 : err.kind === 'conflict' ? 409 : 400,
      body: { error: 'publish_failed', message: err.message, kind: err.kind },
    }
  }
  if (err instanceof GithubError) {
    const status = err.status === 401 ? 503 : err.kind === 'sha_mismatch' ? 409 : 400
    const kind = err.kind === 'sha_mismatch' ? 'conflict' : err.kind
    return { status, body: { error: 'publish_failed', message: err.message, kind } }
  }
  console.error('publish_error', { message: err instanceof Error ? err.message : String(err) })
  return { status: 500, body: { error: 'internal_error' } }
}

/** 全部发布（失败即停，报告明细） */
publishRoutes.post('/all', async (c) => {
  try {
    const report = await publishAll(c.env, c.get('adminSession').userId)
    return c.json({ ok: report.failed.length === 0, report })
  } catch (err) {
    const { status, body } = errorStatus(err)
    return c.json(body, status as 400 | 404 | 409 | 500 | 503)
  }
})

/** 从仓库同步（Git → D1，含首次播种） */
publishRoutes.post('/sync', async (c) => {
  try {
    const report = await syncAll(c.env)
    await writeAudit(c.env, c.get('adminSession').userId, 'sync', '*', JSON.stringify(report).slice(0, 500))
    return c.json({ ok: true, report })
  } catch (err) {
    const { status, body } = errorStatus(err)
    return c.json(body, status as 400 | 404 | 409 | 500 | 503)
  }
})

/** 单条拉取（冲突处理：以仓库覆盖本地；removed=仓库已删该文件、本地行随之移除） */
publishRoutes.post('/sync-item/:domain/:id', async (c) => {
  const domain = getDomain(c.req.param('domain'))
  if (!domain) return c.json({ error: 'unknown_domain' }, 404)
  try {
    const result = await syncSingle(c.env, domain.key, c.req.param('id'))
    await writeAudit(c.env, c.get('adminSession').userId, 'sync-item', `${domain.key}/${c.req.param('id')}`)
    return c.json({ ok: true, ...result })
  } catch (err) {
    const { status, body } = errorStatus(err)
    return c.json(body, status as 400 | 404 | 409 | 500 | 503)
  }
})

/** 冲突检测：仓库当前 sha vs 上次已知 sha */
publishRoutes.get('/conflict/:domain/:id', async (c) => {
  const domain = getDomain(c.req.param('domain'))
  if (!domain) return c.json({ error: 'unknown_domain' }, 404)
  const id = c.req.param('id')
  const primary = (c.env.DB as unknown as { withSession: (c2: string) => D1Database }).withSession('first-primary')

  const row = await primary.prepare(`SELECT repo_path, repo_sha FROM ${domain.table} WHERE id = ?`)
    .bind(id)
    .first<{ repo_path: string; repo_sha: string | null }>()
  if (!row) return c.json({ error: 'not_found' }, 404)
  if (!row.repo_sha) {
    return c.json({ known: false, conflict: false, message: '尚未发布过，无基线可比。' })
  }

  try {
    const file = await getFile(c.env, row.repo_path)
    const repoSha = file?.sha ?? null
    const conflict = repoSha !== row.repo_sha
    return c.json({
      known: true,
      repoSha,
      knownSha: row.repo_sha,
      conflict,
      missing: repoSha === null,
      message: conflict
        ? repoSha === null
          ? '仓库文件已被删除（后台之外的操作）。'
          : '仓库文件有后台之外的修改。'
        : null,
    })
  } catch (err) {
    const { status, body } = errorStatus(err)
    return c.json(body, status as 400 | 404 | 409 | 500 | 503)
  }
})

/** 条目发布（D1 → Git）；?force=1 强制覆盖仓库手改 */
publishRoutes.post('/:domain/:id', async (c) => {
  const domain = getDomain(c.req.param('domain'))
  if (!domain) return c.json({ error: 'unknown_domain' }, 404)
  const force = c.req.query('force') === '1'
  try {
    const result = await publishItem(c.env, c.get('adminSession').userId, domain.key, c.req.param('id'), { force })
    return c.json({ ok: true, result })
  } catch (err) {
    const { status, body } = errorStatus(err)
    return c.json(body, status as 400 | 404 | 409 | 500 | 503)
  }
})

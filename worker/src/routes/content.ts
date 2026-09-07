import { Hono } from 'hono'

import type { AdminEnv } from '../env'
import { writeAudit } from '../lib/audit'
import { DOMAINS, DOMAIN_KEYS, getDomain, SLUG_RE, type DomainDef } from '../lib/domains'
import { nowStr } from '../lib/db'
import { validateDomainFields } from '../lib/validate'

/** /admin/content/* —— 九域通用 CRUD（规格 content-management「九个内容域的工作区」） */
export const content = new Hono<AdminEnv>()

const TAIL_COLS = ['repo_path', 'repo_sha', 'dirty', 'deleted', 'created_at', 'updated_at'] as const

function jsonCols(domain: DomainDef): Set<string> {
  return new Set(domain.fields.filter((f) => f.type === 'json').map((f) => f.col))
}

/** D1 行 → API JSON（camelCase + json 列解析 + 布尔化） */
function serialize(domain: DomainDef, row: Record<string, unknown>) {
  const out: Record<string, unknown> = { id: row.id }
  for (const f of domain.fields) {
    const v = row[f.col]
    if (f.type === 'json') {
      if (v === null || v === undefined) {
        out[f.key] = f.fallback ?? null
      } else {
        try {
          out[f.key] = JSON.parse(String(v))
        } catch {
          out[f.key] = null
        }
      }
    } else if (f.type === 'bool') {
      out[f.key] = v === 1 || v === true
    } else {
      out[f.key] = v ?? null
    }
  }
  out.repoPath = row.repo_path
  out.repoSha = row.repo_sha ?? null
  out.dirty = row.dirty === 1
  out.deleted = row.deleted === 1
  out.createdAt = row.created_at
  out.updatedAt = row.updated_at
  return out
}

function domainOr404(key: string, c: any) {
  const domain = getDomain(key)
  if (!domain) {
    return { domain: null, response: c.json({ error: 'unknown_domain', available: DOMAIN_KEYS }, 404) }
  }
  return { domain, response: null }
}

/** 顶栏汇总：各域 total/dirty/deleted + 全局待发布数 */
content.get('/', async (c) => {
  const summary: Record<string, { total: number; dirty: number; deleted: number }> = {}
  let dirtyTotal = 0
  for (const key of DOMAIN_KEYS) {
    const domain = DOMAINS[key]
    const row = await c.env.DB.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN dirty = 1 AND deleted = 0 THEN 1 ELSE 0 END) AS dirty,
              SUM(CASE WHEN deleted = 1 THEN 1 ELSE 0 END) AS deleted
       FROM ${domain.table}`
    ).first<{ total: number; dirty: number | null; deleted: number | null }>()
    const d = {
      total: row?.total ?? 0,
      dirty: row?.dirty ?? 0,
      deleted: row?.deleted ?? 0,
    }
    summary[key] = d
    dirtyTotal += d.dirty + d.deleted
  }
  return c.json({ domains: summary, dirtyTotal })
})

content.get('/:domain', async (c) => {
  const { domain, response } = domainOr404(c.req.param('domain'), c)
  if (!domain) return response
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM ${domain.table} ORDER BY ${domain.listOrder}`
  ).all<Record<string, unknown>>()
  return c.json((results ?? []).map((row) => serialize(domain, row)))
})

content.get('/:domain/:id', async (c) => {
  const { domain, response } = domainOr404(c.req.param('domain'), c)
  if (!domain) return response
  const row = await c.env.DB.prepare(`SELECT * FROM ${domain.table} WHERE id = ?`)
    .bind(c.req.param('id'))
    .first<Record<string, unknown>>()
  if (!row) return c.json({ error: 'not_found' }, 404)
  return c.json(serialize(domain, row))
})

content.post('/:domain', async (c) => {
  const { domain, response } = domainOr404(c.req.param('domain'), c)
  if (!domain) return response

  let body: Record<string, unknown>
  try {
    body = (await c.req.json()) as Record<string, unknown>
  } catch {
    return c.json({ error: 'invalid_json' }, 400)
  }

  // id：hero 固定；其余校验 slug；已存在则 409
  const id = domain.fixedId ?? String(body.id ?? '')
  if (!domain.fixedId && !SLUG_RE.test(id)) {
    return c.json({ error: 'invalid_id', message: 'id 需为小写字母/数字/连字符的 slug。' }, 400)
  }
  const exists = await c.env.DB.prepare(`SELECT 1 FROM ${domain.table} WHERE id = ?`).bind(id).first()
  if (exists) return c.json({ error: 'already_exists', message: `id「${id}」已存在。` }, 409)

  const validated = validateDomainFields(domain, body, 'create')
  if (!validated.ok) return c.json({ error: 'validation_failed', fields: validated.errors }, 422)

  // 补齐未出现的列：优先用字段缺省值（需满足 NOT NULL），否则 NULL
  const cols: string[] = ['id']
  const binds: (string | number | null)[] = [id]
  for (const f of domain.fields) {
    cols.push(f.col)
    if (f.col in validated.values) {
      binds.push(validated.values[f.col])
    } else if (f.fallback !== undefined) {
      binds.push(
        f.type === 'bool' ? (f.fallback ? 1 : 0) : f.type === 'json' ? JSON.stringify(f.fallback) : (f.fallback as string | number)
      )
    } else {
      binds.push(null)
    }
  }
  cols.push('repo_path', 'dirty', 'deleted')
  binds.push(domain.repoPath(id), 1, 0)

  await c.env.DB.prepare(
    `INSERT INTO ${domain.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
  )
    .bind(...binds)
    .run()

  await writeAudit(c.env, c.get('adminSession').userId, 'create', `${domain.key}/${id}`)
  const row = await c.env.DB.prepare(`SELECT * FROM ${domain.table} WHERE id = ?`).bind(id).first()
  return c.json(serialize(domain, row!), 201)
})

content.put('/:domain/:id', async (c) => {
  const { domain, response } = domainOr404(c.req.param('domain'), c)
  if (!domain) return response
  const id = c.req.param('id')

  const exists = await c.env.DB.prepare(`SELECT 1 FROM ${domain.table} WHERE id = ?`).bind(id).first()
  if (!exists) return c.json({ error: 'not_found' }, 404)

  let body: Record<string, unknown>
  try {
    body = (await c.req.json()) as Record<string, unknown>
  } catch {
    return c.json({ error: 'invalid_json' }, 400)
  }

  const validated = validateDomainFields(domain, body, 'update')
  if (!validated.ok) return c.json({ error: 'validation_failed', fields: validated.errors }, 422)
  if (Object.keys(validated.values).length === 0) {
    return c.json({ error: 'no_fields', message: '没有可更新的字段。' }, 400)
  }

  const sets = [...Object.keys(validated.values).map((col) => `${col} = ?`), 'dirty = 1', 'updated_at = ?']
  const binds = [...Object.values(validated.values), nowStr(), id]
  await c.env.DB.prepare(`UPDATE ${domain.table} SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run()

  await writeAudit(c.env, c.get('adminSession').userId, 'update', `${domain.key}/${id}`)
  const row = await c.env.DB.prepare(`SELECT * FROM ${domain.table} WHERE id = ?`).bind(id).first()
  return c.json(serialize(domain, row!))
})

content.delete('/:domain/:id', async (c) => {
  const { domain, response } = domainOr404(c.req.param('domain'), c)
  if (!domain) return response
  const id = c.req.param('id')

  const result = await c.env.DB.prepare(
    `UPDATE ${domain.table} SET deleted = 1, dirty = 1, updated_at = ? WHERE id = ? AND deleted = 0`
  )
    .bind(nowStr(), id)
    .run()
  if (!result.meta.changes) return c.json({ error: 'not_found' }, 404)

  await writeAudit(c.env, c.get('adminSession').userId, 'delete', `${domain.key}/${id}`)
  return c.json({ ok: true, deleted: true })
})

content.post('/:domain/:id/restore', async (c) => {
  const { domain, response } = domainOr404(c.req.param('domain'), c)
  if (!domain) return response
  const id = c.req.param('id')

  const result = await c.env.DB.prepare(
    `UPDATE ${domain.table} SET deleted = 0, dirty = 1, updated_at = ? WHERE id = ? AND deleted = 1`
  )
    .bind(nowStr(), id)
    .run()
  if (!result.meta.changes) return c.json({ error: 'not_found' }, 404)

  await writeAudit(c.env, c.get('adminSession').userId, 'restore', `${domain.key}/${id}`)
  return c.json({ ok: true, deleted: false })
})

/**
 * 同步引擎（Git → D1，任务 6.2）：仓库现状导入/覆盖工作区。
 * 解析 md frontmatter / json 数据文件 → upsert 内容表（清 dirty、写 repo_sha）。
 * 仓库里已消失的集合条目 → 标记 deleted=1（与仓库一致）。
 */

import type { Env } from '../env'
import { DOMAINS, DOMAIN_KEYS, type DomainDef } from './domains'
import { parseMarkdown } from './frontmatter'
import { getFile, listDir } from './github'
import { sha256Hex } from './db'

/** frontmatter key → D1 列 */
function fmToRow(domain: DomainDef, data: Record<string, unknown>): Record<string, string | number | null> {
  const row: Record<string, string | number | null> = {}
  for (const f of domain.fields) {
    const v = data[f.key]
    if (v === undefined) {
      row[f.col] =
        f.fallback !== undefined
          ? f.type === 'bool'
            ? f.fallback
              ? 1
              : 0
            : f.type === 'json'
              ? JSON.stringify(f.fallback)
              : (f.fallback as string | number)
          : null
    } else if (f.type === 'bool') {
      row[f.col] = v ? 1 : 0
    } else if (f.type === 'json') {
      row[f.col] = JSON.stringify(v)
    } else if (f.type === 'date') {
      row[f.col] = String(v).slice(0, 10)
    } else {
      row[f.col] = v as string | number
    }
  }
  return row
}

async function upsertRow(
  env: Env,
  domain: DomainDef,
  id: string,
  row: Record<string, string | number | null>,
  repoPath: string,
  repoSha: string,
  fmHeader: string | null
): Promise<void> {
  const cols = ['id', ...Object.keys(row), 'repo_path', 'repo_sha', 'dirty', 'deleted', 'fm_header', 'updated_at']
  const binds: (string | number | null)[] = [
    id,
    ...Object.values(row),
    repoPath,
    repoSha,
    0,
    0,
    fmHeader,
    new Date().toISOString().slice(0, 19).replace('T', ' '),
  ]
  const placeholders = cols.map(() => '?').join(', ')
  const updates = [...Object.keys(row), 'repo_path', 'repo_sha', 'dirty', 'deleted', 'fm_header', 'updated_at']
    .map((c) => `${c} = excluded.${c}`)
    .join(', ')
  await env.DB.prepare(
    `INSERT INTO ${domain.table} (${cols.join(', ')}) VALUES (${placeholders})
     ON CONFLICT(id) DO UPDATE SET ${updates}`
  )
    .bind(...binds)
    .run()
}

async function syncCollection(env: Env, domain: DomainDef): Promise<{ imported: number; vanished: number }> {
  const entries = await listDir(env, domain.repoDir)
  const seen = new Set<string>()
  let imported = 0

  for (const entry of entries) {
    let path: string
    let id: string
    if (domain.key === 'blog') {
      if (entry.type !== 'dir') continue
      path = `${entry.path}/index.md`
      id = entry.name
    } else {
      if (entry.type !== 'file' || !entry.name.endsWith('.md')) continue
      path = entry.path
      id = entry.name.replace(/\.md$/, '')
    }
    const file = await getFile(env, path)
    if (!file) continue
    const parsed = parseMarkdown(file.content)
    if (!parsed) continue
    await upsertRow(env, domain, id, fmToRow(domain, parsed.data), path, file.sha, parsed.headerText)
    seen.add(id)
    imported += 1
  }

  // 仓库中已消失：与仓库保持一致 → 标记 deleted（不动从未发布的草稿行）
  const rows = await env.DB.prepare(`SELECT id FROM ${domain.table}`).all<{ id: string }>()
  let vanished = 0
  for (const r of rows.results ?? []) {
    if (!seen.has(r.id)) {
      await env.DB.prepare(
        `UPDATE ${domain.table} SET deleted = 1, dirty = 0 WHERE id = ? AND repo_sha IS NOT NULL`
      )
        .bind(r.id)
        .run()
      vanished += 1
    }
  }
  return { imported, vanished }
}

/** json 域：数组对象的公开键 → 列 */
function jsonObjToRow(domain: DomainDef, obj: Record<string, unknown>): Record<string, string | number | null> {
  const row: Record<string, string | number | null> = {}
  for (const f of domain.fields) {
    const key = ['description'].includes(f.key) ? (domain.key === 'hero' ? 'bio' : 'desc') : f.key
    const v = obj[key] ?? obj[f.key]
    if (f.type === 'json') row[f.col] = v === undefined ? JSON.stringify(f.fallback ?? null) : JSON.stringify(v)
    else if (f.type === 'bool') row[f.col] = v ? 1 : 0
    else row[f.col] = (v ?? null) as string | number | null
  }
  return row
}

async function syncJsonArray(env: Env, domain: DomainDef): Promise<{ imported: number }> {
  const path = domain.repoPath('')
  const file = await getFile(env, path)
  if (!file) return { imported: 0 }
  const arr = JSON.parse(file.content) as Record<string, unknown>[]
  await env.DB.prepare(`DELETE FROM ${domain.table}`).run()
  for (let i = 0; i < arr.length; i++) {
    const obj = arr[i]
    // 稳定 id：内容哈希（重排不漂移）
    const id = `row-${(await sha256Hex(JSON.stringify([domain.key, obj.title ?? obj.name ?? obj.date ?? i]))).slice(0, 10)}`
    const row = jsonObjToRow(domain, obj)
    row.sort_order = i
    await upsertRow(env, domain, id, row, path, file.sha, null)
  }
  return { imported: arr.length }
}

async function syncHero(env: Env, domain: DomainDef): Promise<{ imported: number }> {
  const path = domain.repoPath('')
  const file = await getFile(env, path)
  if (!file) return { imported: 0 }
  const obj = JSON.parse(file.content) as Record<string, unknown>
  await upsertRow(env, domain, 'default', jsonObjToRow(domain, obj), path, file.sha, null)
  return { imported: 1 }
}

export interface SyncReport {
  [domain: string]: { imported: number; vanished?: number }
}

export async function syncAll(env: Env): Promise<SyncReport> {
  const report: SyncReport = {}
  for (const key of DOMAIN_KEYS) {
    const domain = DOMAINS[key]
    if (domain.fileKind === 'collection') {
      report[key] = await syncCollection(env, domain)
    } else if (domain.fileKind === 'json-array') {
      report[key] = await syncJsonArray(env, domain)
    } else {
      report[key] = await syncHero(env, domain)
    }
  }
  return report
}

/**
 * 单条拉取（冲突处理「以仓库覆盖本地」）：
 * 集合域 → 重读该文件 upsert 单行；json 域 → 重新同步整文件（丢弃该域本地修改）。
 */
export async function syncSingle(env: Env, domainKey: string, id: string): Promise<void> {
  const domain = DOMAINS[domainKey]
  if (!domain) throw new Error('未知内容域')
  const primary = (env.DB as unknown as { withSession: (c: string) => D1Database }).withSession('first-primary')
  if (domain.fileKind === 'collection') {
    const row = await primary.prepare(`SELECT repo_path FROM ${domain.table} WHERE id = ?`)
      .bind(id)
      .first<{ repo_path: string }>()
    if (!row) throw new Error('条目不存在')
    const file = await getFile(env, row.repo_path)
    if (!file) throw new Error('仓库中已不存在该文件')
    const parsed = parseMarkdown(file.content)
    if (!parsed) throw new Error('文件解析失败')
    await upsertRow(env, domain, id, fmToRow(domain, parsed.data), row.repo_path, file.sha, parsed.headerText)
    return
  }
  if (domain.fileKind === 'json-array') {
    await syncJsonArray(env, domain)
    return
  }
  await syncHero(env, domain)
}

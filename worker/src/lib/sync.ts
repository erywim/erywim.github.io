/**
 * 同步引擎（Git → D1，任务 6.2）：仓库现状导入/覆盖工作区。
 * 解析 md frontmatter / json 数据文件 → upsert 内容表（清 dirty、写 repo_sha）。
 * 仓库里已消失的集合条目 → 直接移除该行（与仓库一致）。
 */

import type { Env } from '../env'
import { DOMAINS, DOMAIN_KEYS, type DomainDef } from './domains'
import { parseMarkdown, type ParsedFile } from './frontmatter'
import { getFile, listDir } from './github'
import { sha256Hex } from './db'
import { PublishError } from './publish'

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

/** frontmatter 行 + md 正文 → 完整行。
 *  正文在 frontmatter 定界线之外，fmToRow 覆盖不到，必须单独灌入 body_md
 *  （否则同步后编辑器正文为空、再发布会把仓库正文清掉）；null = 空正文无尾换行（round-trip 契约） */
export function fmRowWithBody(domain: DomainDef, parsed: ParsedFile): Record<string, string | number | null> {
  const row = fmToRow(domain, parsed.data)
  const bodyCol = domain.fields.find((f) => f.key === 'bodyMd')?.col
  if (bodyCol) row[bodyCol] = parsed.bodyMd
  return row
}

/** skipDirty（CI 安全模式）：已存在且 dirty=1 的行不覆盖，保留给后台人工处理冲突 */
async function upsertRow(
  env: Env,
  domain: DomainDef,
  id: string,
  row: Record<string, string | number | null>,
  repoPath: string,
  repoSha: string,
  fmHeader: string | null,
  opts: { skipDirty?: boolean } = {}
): Promise<number> {
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
  // upsert WHERE 门：dirty 行保持原样（repo_sha 停留在旧基线 → 后台冲突横幅可见）
  const guard = opts.skipDirty ? ` WHERE ${domain.table}.dirty = 0` : ''
  const r = await env.DB.prepare(
    `INSERT INTO ${domain.table} (${cols.join(', ')}) VALUES (${placeholders})
     ON CONFLICT(id) DO UPDATE SET ${updates}${guard}`
  )
    .bind(...binds)
    .run()
  return r.meta.changes ?? 1
}

async function syncCollection(
  env: Env,
  domain: DomainDef,
  opts: { skipDirty?: boolean } = {}
): Promise<{ imported: number; skipped: number; vanished: number }> {
  const entries = await listDir(env, domain.repoDir)
  const seen = new Set<string>()
  let imported = 0
  let skipped = 0

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
    const changes = await upsertRow(env, domain, id, fmRowWithBody(domain, parsed), path, file.sha, parsed.headerText, opts)
    if (changes > 0) imported += 1
    else skipped += 1
    seen.add(id)
  }

  // 仓库中已消失：与仓库保持一致 → 移除该行（不标记 deleted——那会计入待发布数，
  // 且「全部发布」会去删仓库里已不存在的文件而 409/404 中断）。
  // 从未发布的草稿行 repo_sha 为空天然不受影响；安全模式保留 dirty 行待人工处理。
  const rows = await env.DB.prepare(`SELECT id FROM ${domain.table}`).all<{ id: string }>()
  let vanished = 0
  for (const r of rows.results ?? []) {
    if (!seen.has(r.id)) {
      const guard = opts.skipDirty ? ' AND dirty = 0' : ''
      const res = await env.DB.prepare(
        `DELETE FROM ${domain.table} WHERE id = ? AND repo_sha IS NOT NULL${guard}`
      )
        .bind(r.id)
        .run()
      vanished += res.meta.changes ?? 0
    }
  }
  return { imported, skipped, vanished }
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

async function syncJsonArray(
  env: Env,
  domain: DomainDef,
  opts: { skipDirty?: boolean } = {}
): Promise<{ imported: number; skipped?: boolean }> {
  const path = domain.repoPath('')
  // json 域同步 = 整文件重灌，粒度做不到按行保留 → 安全模式下域内有任何未发布改动就整域跳过
  if (opts.skipDirty) {
    const pend = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM ${domain.table} WHERE dirty = 1 OR deleted = 1`
    ).first<{ n: number }>()
    if ((pend?.n ?? 0) > 0) return { imported: 0, skipped: true }
  }
  const file = await getFile(env, path)
  if (!file) return { imported: 0 }
  const arr = JSON.parse(file.content) as Record<string, unknown>[]
  await env.DB.prepare(`DELETE FROM ${domain.table}`).run()
  for (let i = 0; i < arr.length; i++) {
    const obj = arr[i]
    // 稳定 id：内容哈希（重排不漂移）
    const id = `row-${(await sha256Hex(JSON.stringify([domain.key, obj.title ?? obj.name ?? obj.date ?? i]))).slice(0, 10)}`
    const row = jsonObjToRow(domain, obj)
    // 仅仍声明 sortOrder 字段的域（friends/party）保留数组顺序；timeline 按 date 排序，无需 sort_order
    if (domain.fields.some((f) => f.key === 'sortOrder')) row.sort_order = i
    await upsertRow(env, domain, id, row, path, file.sha, null)
  }
  return { imported: arr.length }
}

async function syncHero(
  env: Env,
  domain: DomainDef,
  opts: { skipDirty?: boolean } = {}
): Promise<{ imported: number; skipped?: boolean }> {
  const path = domain.repoPath('')
  if (opts.skipDirty) {
    const pend = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM ${domain.table} WHERE dirty = 1 OR deleted = 1`
    ).first<{ n: number }>()
    if ((pend?.n ?? 0) > 0) return { imported: 0, skipped: true }
  }
  const file = await getFile(env, path)
  if (!file) return { imported: 0 }
  const obj = JSON.parse(file.content) as Record<string, unknown>
  await upsertRow(env, domain, 'default', jsonObjToRow(domain, obj), path, file.sha, null)
  return { imported: 1 }
}

export interface SyncDomainReport {
  imported: number
  /** 仓库中已消失、从工作区移除的条数 */
  vanished?: number
  /** 安全模式下被跳过：collection 为条数，json 域为 true（整域） */
  skipped?: number | boolean
}

export interface SyncReport {
  [domain: string]: SyncDomainReport
}

/**
 * 全量同步（Git → D1）。
 * 手动「从仓库同步」：强制覆盖工作区（含 dirty 行，用户明确意图）。
 * CI 回调（/hooks/sync）：skipDirty 安全模式，只对齐已同步行、清理仓库已删行，不动后台草稿。
 */
export async function syncAll(env: Env, opts: { skipDirty?: boolean } = {}): Promise<SyncReport> {
  const report: SyncReport = {}
  for (const key of DOMAIN_KEYS) {
    const domain = DOMAINS[key]
    if (domain.fileKind === 'collection') {
      report[key] = await syncCollection(env, domain, opts)
    } else if (domain.fileKind === 'json-array') {
      report[key] = await syncJsonArray(env, domain, opts)
    } else {
      report[key] = await syncHero(env, domain, opts)
    }
  }
  return report
}

/**
 * 单条拉取（冲突处理「以仓库覆盖本地」）：
 * 集合域 → 重读该文件 upsert 单行；json 域 → 重新同步整文件（丢弃该域本地修改）。
 * 仓库文件已不存在时 → removed: true（本地行随之移除，与仓库一致），不再抛错。
 */
export async function syncSingle(env: Env, domainKey: string, id: string): Promise<{ removed: boolean }> {
  const domain = DOMAINS[domainKey]
  if (!domain) throw new PublishError('未知内容域', 'other')
  const primary = (env.DB as unknown as { withSession: (c: string) => D1Database }).withSession('first-primary')
  if (domain.fileKind === 'collection') {
    const row = await primary.prepare(`SELECT repo_path FROM ${domain.table} WHERE id = ?`)
      .bind(id)
      .first<{ repo_path: string }>()
    if (!row) throw new PublishError('条目不存在', 'not_found')
    const file = await getFile(env, row.repo_path)
    if (!file) {
      // 仓库已删该文件：「以仓库覆盖本地」= 移除本地行（想找回走 git 历史或「强制发布覆盖仓库」重建）
      await primary
        .prepare(`DELETE FROM ${domain.table} WHERE id = ? AND repo_sha IS NOT NULL`)
        .bind(id)
        .run()
      return { removed: true }
    }
    const parsed = parseMarkdown(file.content)
    if (!parsed) throw new PublishError('文件解析失败', 'other')
    await upsertRow(env, domain, id, fmRowWithBody(domain, parsed), row.repo_path, file.sha, parsed.headerText)
    return { removed: false }
  }
  if (domain.fileKind === 'json-array') {
    await syncJsonArray(env, domain)
    return { removed: false }
  }
  await syncHero(env, domain)
  return { removed: false }
}

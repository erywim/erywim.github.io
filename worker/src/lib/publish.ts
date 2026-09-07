/**
 * 发布引擎（D1 → Git，任务 6.3/6.4/6.5）。
 * - collection：单条 md 渲染 + Contents API PUT/DELETE（sha 乐观锁）
 * - json-single（hero）：整对象渲染单文件
 * - json-array（friends/timeline/party）：全部行渲染整文件（发布任一条 = 发布该域）
 */

import type { Env } from '../env'
import { DOMAINS, type DomainDef } from './domains'
import { renderCollectionFile, renderJsonFile } from './frontmatter'
import { deleteFile, getFile, putFile } from './github'
import { writeAudit } from './audit'

type Row = Record<string, unknown>

/** D1 行 → 渲染用的 API 形态 */
function rowToItem(domain: DomainDef, row: Row): Record<string, unknown> {
  const item: Record<string, unknown> = {}
  for (const f of domain.fields) {
    const v = row[f.col]
    if (f.type === 'json') {
      try {
        item[f.key] = v === null || v === undefined ? (f.fallback ?? null) : JSON.parse(String(v))
      } catch {
        item[f.key] = f.fallback ?? null
      }
    } else if (f.type === 'bool') {
      item[f.key] = v === 1 || v === true
    } else {
      item[f.key] = v ?? null
    }
  }
  return item
}

export class PublishError extends Error {
  constructor(
    message: string,
    readonly kind: 'conflict' | 'not_found' | 'other'
  ) {
    super(message)
  }
}

export interface PublishResult {
  domain: string
  id: string
  action: 'update' | 'create' | 'delete'
  commitPath: string
}

/** json-array 域：整文件发布（含全部删除后的空数组场景） */
async function publishJsonArrayFile(
  env: Env,
  userId: number,
  domainKey: string,
  force = false
): Promise<PublishResult> {
  const domain = DOMAINS[domainKey]
  const repoPath = domain.repoPath('')

  const { results } = await env.DB.prepare(
    `SELECT * FROM ${domain.table} WHERE deleted = 0 ORDER BY sort_order ASC, id ASC`
  ).all<Row>()
  const known = await env.DB.prepare(
    `SELECT repo_sha FROM ${domain.table} WHERE repo_sha IS NOT NULL LIMIT 1`
  ).first<{ repo_sha: string }>()
  const current = await getFile(env, repoPath)
  if (!force && known && current && known.repo_sha !== current.sha) {
    throw new PublishError('仓库文件有后台之外的改动，请先「从仓库同步」或强制处理冲突。', 'conflict')
  }
  const sha = current?.sha ?? null

  const publicKeys = domain.fields
    .filter((f) => f.key !== 'sortOrder')
    .map((f) => (f.key === 'description' ? 'desc' : f.key))
  const arr = (results ?? []).map((r) => {
    const item = rowToItem(domain, r)
    const out: Record<string, unknown> = {}
    for (const k of publicKeys) if (item[k] !== null && item[k] !== undefined) out[k] = item[k]
    return out
  })
  const content = renderJsonFile(arr)
  const title = arr.length > 0 ? String(arr[0].name ?? arr[0].title ?? domain.label) : domain.label
  const newSha = await putFile(env, repoPath, content, sha, `admin: 发布${domain.label}「${title}」`)

  await env.DB.prepare(
    `UPDATE ${domain.table} SET repo_sha = ?, dirty = 0, updated_at = datetime('now') WHERE deleted = 0`
  )
    .bind(newSha)
    .run()
  await env.DB.prepare(`DELETE FROM ${domain.table} WHERE deleted = 1`).run()

  await writeAudit(env, userId, 'publish', `${domainKey}/*`)
  return { domain: domainKey, id: '*', action: sha ? 'update' : 'create', commitPath: repoPath }
}

export async function publishItem(
  env: Env,
  userId: number,
  domainKey: string,
  id: string,
  opts: { force?: boolean } = {}
): Promise<PublishResult> {
  const domain = DOMAINS[domainKey]
  if (!domain) throw new PublishError('未知内容域', 'other')

  const row = await env.DB.prepare(`SELECT * FROM ${domain.table} WHERE id = ?`).bind(id).first<Row>()
  if (!row) throw new PublishError('条目不存在', 'not_found')

  const title = String(row.title ?? row.name ?? id)
  const label = domain.label
  const repoPath = String(row.repo_path)

  /* —— 删除发布：移除仓库文件，条目从工作区清除 —— */
  if (row.deleted === 1) {
    let delSha = row.repo_sha ? String(row.repo_sha) : null
    if (!delSha) {
      const cur = await getFile(env, repoPath)
      delSha = cur?.sha ?? null
    }
    if (delSha) {
      await deleteFile(env, repoPath, delSha, `admin: 删除${label}「${title}」`)
    }
    await env.DB.prepare(`DELETE FROM ${domain.table} WHERE id = ?`).bind(id).run()
    await writeAudit(env, userId, 'publish-delete', `${domainKey}/${id}`)
    return { domain: domainKey, id, action: 'delete', commitPath: repoPath }
  }

  if (domain.fileKind === 'json-array') {
    return publishJsonArrayFile(env, userId, domainKey, opts.force)
  }

  let content: string
  if (domain.fileKind === 'collection') {
    const item = rowToItem(domain, row)
    content = renderCollectionFile(domain, {
      item,
      bodyMd: row.body_md === null || row.body_md === undefined ? null : String(row.body_md),
      fmHeader: row.fm_header === null || row.fm_header === undefined ? null : String(row.fm_header),
    })
  } else {
    content = renderJsonFile(rowToItem(domain, row))
  }

  let sha = row.repo_sha ? String(row.repo_sha) : null
  if (opts.force) {
    // 强制发布：以仓库当前版本为基线覆盖（丢弃仓库侧手改）
    const cur = await getFile(env, repoPath)
    sha = cur?.sha ?? null
  }
  const newSha = await putFile(env, repoPath, content, sha, `admin: 发布${label}「${title}」`)

  await env.DB.prepare(
    `UPDATE ${domain.table} SET repo_sha = ?, dirty = 0, updated_at = datetime('now') WHERE id = ?`
  )
    .bind(newSha, id)
    .run()

  await writeAudit(env, userId, 'publish', `${domainKey}/${id}`, `${content.length}B`)
  return { domain: domainKey, id, action: sha ? 'update' : 'create', commitPath: repoPath }
}

export interface PublishAllReport {
  published: PublishResult[]
  failed: { domain: string; id: string; error: string }[]
  /** 失败即停后未执行的待发布条目 */
  skipped: { domain: string; id: string }[]
}

/** 全部发布：逐条顺序执行，失败即停（不回滚已成功项） */
export async function publishAll(env: Env, userId: number): Promise<PublishAllReport> {
  const report: PublishAllReport = { published: [], failed: [], skipped: [] }

  for (const key of Object.keys(DOMAINS)) {
    const domain = DOMAINS[key]

    if (domain.fileKind === 'json-array') {
      const dirty = await env.DB.prepare(
        `SELECT COUNT(*) AS n FROM ${domain.table} WHERE dirty = 1 OR deleted = 1`
      ).first<{ n: number }>()
      if ((dirty?.n ?? 0) === 0) continue
      const first = await env.DB.prepare(
        `SELECT id FROM ${domain.table} WHERE deleted = 0 ORDER BY sort_order ASC LIMIT 1`
      ).first<{ id: string }>()
      try {
        report.published.push(
          first ? await publishItem(env, userId, key, first.id) : await publishJsonArrayFile(env, userId, key)
        )
      } catch (e) {
        report.failed.push({ domain: key, id: '*', error: e instanceof Error ? e.message : String(e) })
        return report
      }
      continue
    }

    const { results } = await env.DB.prepare(
      `SELECT id FROM ${domain.table} WHERE dirty = 1 OR deleted = 1 ORDER BY updated_at ASC`
    ).all<{ id: string }>()
    for (const r of results ?? []) {
      try {
        report.published.push(await publishItem(env, userId, key, r.id))
      } catch (e) {
        report.failed.push({ domain: key, id: r.id, error: e instanceof Error ? e.message : String(e) })
        // 失败即停：余下记为 skipped
        const idx = (results ?? []).findIndex((x) => x.id === r.id)
        for (const rest of (results ?? []).slice(idx + 1)) {
          report.skipped.push({ domain: key, id: rest.id })
        }
        return report
      }
    }
  }

  return report
}

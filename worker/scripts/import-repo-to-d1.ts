/**
 * 仓库 → 生产 D1 全量入库（一次性运维脚本，输出 SQL 到 stdout）。
 *
 * 与 src/lib/sync.ts 的 syncAll 行为一致（frontmatter + 正文 + repo_sha + fm_header），
 * 区别是不经 Worker/登录态：直接生成 SQL，用
 *   node node_modules/wrangler/bin/wrangler.js d1 execute erywim --remote --file <file>
 * 应用。适用于修表/换表后把仓库现状一次性灌回 D1 草稿区。
 *
 * 用法：bun scripts/import-repo-to-d1.ts > import.sql
 * （读 worker/.dev.vars 的 GH_TOKEN 提高限额；无 token 走匿名读，公开仓库可用）
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DOMAINS, DOMAIN_KEYS, type DomainDef } from '../src/lib/domains'
import { parseMarkdown } from '../src/lib/frontmatter'
import { fmRowWithBody } from '../src/lib/sync'
import { getFile, listDir } from '../src/lib/github'
import { sha256Hex } from '../src/lib/db'
import type { Env } from '../src/env'

const here = dirname(fileURLToPath(import.meta.url))

// .dev.vars 可选：有 GH_TOKEN 则免匿名限流
function loadEnv(): Env {
  const env: Env = { DB: null as unknown as Env['DB'] }
  try {
    for (const line of readFileSync(resolve(here, '../.dev.vars'), 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)\s*=\s*(.*)$/)
      if (m) (env as Record<string, string>)[m[1]] = m[2].trim()
    }
  } catch {
    /* 无 .dev.vars → 匿名读 */
  }
  return env
}

/** 值 → SQL 字面量（SQLite：仅单引号需转义，换行可原样） */
function lit(v: string | number | null): string {
  if (v === null) return 'NULL'
  if (typeof v === 'number') return String(v)
  return `'${v.replace(/'/g, "''")}'`
}

function upsertSql(
  domain: DomainDef,
  id: string,
  row: Record<string, string | number | null>,
  repoPath: string,
  repoSha: string,
  fmHeader: string | null
): string {
  const cols = ['id', ...Object.keys(row), 'repo_path', 'repo_sha', 'dirty', 'deleted', 'fm_header', 'updated_at']
  const vals = [
    lit(id),
    ...Object.values(row).map(lit),
    lit(repoPath),
    lit(repoSha),
    '0',
    '0',
    lit(fmHeader),
    lit(new Date().toISOString().slice(0, 19).replace('T', ' ')),
  ]
  const updates = [...Object.keys(row), 'repo_path', 'repo_sha', 'dirty', 'deleted', 'fm_header', 'updated_at']
    .map((c) => `${c} = excluded.${c}`)
    .join(', ')
  return `INSERT INTO ${domain.table} (${cols.join(', ')}) VALUES (${vals.join(', ')})\nON CONFLICT(id) DO UPDATE SET ${updates};`
}

const env = loadEnv()
const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
console.log(`-- 仓库 → D1 全量入库（生成于 ${now}，与 syncAll 同构）`)

const stats: Record<string, { imported: number; vanished?: number }> = {}

for (const key of DOMAIN_KEYS) {
  const domain = DOMAINS[key]
  if (domain.fileKind === 'collection') {
    const entries = await listDir(env, domain.repoDir)
    const seen: string[] = []
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
      console.log(`\n-- ${key}/${id}`)
      console.log(upsertSql(domain, id, fmRowWithBody(domain, parsed), path, file.sha, parsed.headerText))
      seen.push(id)
      imported += 1
    }
    // 仓库已消失 → 标记 deleted（不动从未发布的本地草稿行）
    console.log(`\n-- ${key}: vanished 标记`)
    console.log(
      `UPDATE ${domain.table} SET deleted = 1, dirty = 0 WHERE repo_sha IS NOT NULL AND id NOT IN (${seen.map(lit).join(', ') || "''"});`
    )
    stats[key] = { imported, vanished: undefined }
  } else if (domain.fileKind === 'json-array') {
    const path = domain.repoPath('')
    const file = await getFile(env, path)
    if (!file) {
      stats[key] = { imported: 0 }
      continue
    }
    const arr = JSON.parse(file.content) as Record<string, unknown>[]
    console.log(`\n-- ${key}: 整文件重灌（${arr.length} 行）`)
    console.log(`DELETE FROM ${domain.table};`)
    for (let i = 0; i < arr.length; i++) {
      const obj = arr[i]
      const id = `row-${(await sha256Hex(JSON.stringify([domain.key, obj.title ?? obj.name ?? obj.date ?? i]))).slice(0, 10)}`
      const row: Record<string, string | number | null> = {}
      for (const f of domain.fields) {
        const jk = ['description'].includes(f.key) ? (domain.key === 'hero' ? 'bio' : 'desc') : f.key
        const v = obj[jk] ?? obj[f.key]
        if (f.type === 'json') row[f.col] = v === undefined ? JSON.stringify(f.fallback ?? null) : JSON.stringify(v)
        else if (f.type === 'bool') row[f.col] = v ? 1 : 0
        else row[f.col] = (v ?? null) as string | number | null
      }
      row.sort_order = i
      console.log(upsertSql(domain, id, row, path, file.sha, null))
    }
    stats[key] = { imported: arr.length }
  } else {
    // json-single（hero）
    const path = domain.repoPath('')
    const file = await getFile(env, path)
    if (!file) {
      stats[key] = { imported: 0 }
      continue
    }
    const obj = JSON.parse(file.content) as Record<string, unknown>
    const row: Record<string, string | number | null> = {}
    for (const f of domain.fields) {
      const jk = ['description'].includes(f.key) ? (domain.key === 'hero' ? 'bio' : 'desc') : f.key
      const v = obj[jk] ?? obj[f.key]
      if (f.type === 'json') row[f.col] = v === undefined ? JSON.stringify(f.fallback ?? null) : JSON.stringify(v)
      else if (f.type === 'bool') row[f.col] = v ? 1 : 0
      else row[f.col] = (v ?? null) as string | number | null
    }
    console.log(`\n-- hero: 单对象`)
    console.log(upsertSql(domain, domain.fixedId ?? 'default', row, path, file.sha, null))
    stats[key] = { imported: 1 }
  }
}

console.error(`已完成生成：${JSON.stringify(stats)}`)

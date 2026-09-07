/**
 * GitHub Contents API 客户端。
 * 读：公开仓库可匿名（限流 60/h）；写：必须 GH_TOKEN（fine-grained PAT，仅本仓库 Contents 读写）。
 * 仓库常量与 owner 固定——这是 erywim 的个人博客发布区。
 */

import type { Env } from '../env'

export const GH_OWNER = 'erywim'
export const GH_REPO = 'erywim.github.io'
export const GH_BRANCH = 'master'

const API = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}`

export class GithubError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly kind: 'not_found' | 'sha_mismatch' | 'rate_limited' | 'auth' | 'other'
  ) {
    super(message)
  }
}

function headers(env: Env, extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'erywim-blog-admin',
    ...extra,
  }
  if (env.GH_TOKEN) h.Authorization = `Bearer ${env.GH_TOKEN}`
  return h
}

function toBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\n/g, ''))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

async function request(env: Env, path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: headers(env, (init?.headers as Record<string, string>) ?? {}),
  })
  if (res.status === 401 || res.status === 403) {
    const remaining = res.headers.get('X-RateLimit-Remaining')
    throw new GithubError(
      remaining === '0' ? 'GitHub API 限流，请稍后重试。' : 'GitHub 凭据无效或权限不足。',
      res.status,
      remaining === '0' ? 'rate_limited' : 'auth'
    )
  }
  return res
}

export interface GhFile {
  content: string
  sha: string
}

export async function getFile(env: Env, path: string): Promise<GhFile | null> {
  const res = await request(env, `/contents/${encodeURI(path)}?ref=${GH_BRANCH}`)
  if (res.status === 404) return null
  if (!res.ok) throw new GithubError(`读取 ${path} 失败（HTTP ${res.status}）`, res.status, 'other')
  const data = (await res.json()) as { content: string; encoding: string; sha: string }
  if (data.encoding !== 'base64') throw new GithubError('不支持的编码', 500, 'other')
  const bytes = toBytes(data.content)
  return { content: new TextDecoder().decode(bytes), sha: data.sha }
}

export interface GhEntry {
  name: string
  path: string
  type: 'file' | 'dir'
  sha: string
}

export async function listDir(env: Env, dir: string): Promise<GhEntry[]> {
  const res = await request(env, `/contents/${encodeURI(dir)}?ref=${GH_BRANCH}`)
  if (res.status === 404) return []
  if (!res.ok) throw new GithubError(`列目录 ${dir} 失败（HTTP ${res.status}）`, res.status, 'other')
  return (await res.json()) as GhEntry[]
}

async function putContents(
  env: Env,
  path: string,
  body: Record<string, unknown>,
  sha: string | null
): Promise<string> {
  if (!env.GH_TOKEN) {
    throw new GithubError('未配置 GH_TOKEN，无法写入仓库。', 401, 'auth')
  }
  const res = await request(env, `/contents/${encodeURI(path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, sha: sha ?? undefined, branch: GH_BRANCH }),
  })
  if (res.status === 409 || res.status === 422) {
    throw new GithubError('仓库文件已变化（sha 不匹配），请先「从仓库同步」或强制处理冲突。', res.status, 'sha_mismatch')
  }
  if (!res.ok) throw new GithubError(`写入 ${path} 失败（HTTP ${res.status}）`, res.status, 'other')
  const data = (await res.json()) as { content: { sha: string } }
  return data.content.sha
}

export async function putFile(
  env: Env,
  path: string,
  content: string,
  sha: string | null,
  message: string
): Promise<string> {
  return putContents(env, path, { message, content: toBase64(content) }, sha)
}

/** 二进制直传（调用方已 base64） */
export async function putFileBase64(
  env: Env,
  path: string,
  base64: string,
  sha: string | null,
  message: string
): Promise<string> {
  return putContents(env, path, { message, content: base64 }, sha)
}

export async function deleteFile(
  env: Env,
  path: string,
  sha: string,
  message: string
): Promise<void> {
  if (!env.GH_TOKEN) {
    throw new GithubError('未配置 GH_TOKEN，无法删除仓库文件。', 401, 'auth')
  }
  const res = await request(env, `/contents/${encodeURI(path)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sha, branch: GH_BRANCH }),
  })
  if (res.status === 409) {
    throw new GithubError('仓库文件已变化（sha 不匹配），请先同步。', res.status, 'sha_mismatch')
  }
  if (!res.ok) throw new GithubError(`删除 ${path} 失败（HTTP ${res.status}）`, res.status, 'other')
}

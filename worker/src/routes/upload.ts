import { Hono } from 'hono'

import type { AdminEnv } from '../env'
import { writeAudit } from '../lib/audit'
import { sha256HexBytes } from '../lib/db'
import { getFile, GithubError, putFileBase64 } from '../lib/github'

/** POST /admin/upload —— 图片直传进仓库（设计 D7：PNG/JPG/WebP ≤2MB，hash 命名去重） */
export const upload = new Hono<AdminEnv>()

const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}
const MAX_BYTES = 2 * 1024 * 1024

upload.post('/', async (c) => {
  let form: FormData
  try {
    form = await c.req.formData()
  } catch {
    return c.json({ error: 'invalid_form', message: '请以 multipart/form-data 上传。' }, 400)
  }
  const file = form.get('file')
  if (!(file instanceof File)) {
    return c.json({ error: 'file_required', message: '缺少 file 字段。' }, 400)
  }
  const ext = ALLOWED_TYPES[file.type]
  if (!ext) {
    return c.json({ error: 'unsupported_type', message: '仅支持 PNG / JPG / WebP。' }, 422)
  }
  if (file.size > MAX_BYTES) {
    return c.json({ error: 'too_large', message: '图片不能超过 2MB。' }, 422)
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const hash = await sha256HexBytes(bytes)
  const short = hash.slice(0, 12)
  const year = new Date().getFullYear()
  const repoPath = `src/assets/uploads/${year}/${short}.${ext}`

  // base64（UTF-8 安全：按字节编码）
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  const content = btoa(bin)

  try {
    // 内容寻址去重：同内容已存在则直接复用
    const existing = await getFile(c.env, repoPath)
    if (existing) {
      return c.json({ ok: true, path: repoPath, deduplicated: true })
    }
    await putFileBase64(c.env, repoPath, content, null, `admin: 上传图片 ${file.name || `${short}.${ext}`}`)
    await writeAudit(c.env, c.get('adminSession').userId, 'upload', repoPath, `${bytes.length}B`)
    return c.json({ ok: true, path: repoPath })
  } catch (err) {
    if (err instanceof GithubError) {
      return c.json({ error: 'github_error', message: err.message, kind: err.kind }, 502)
    }
    console.error('upload_failed', { message: err instanceof Error ? err.message : String(err) })
    return c.json({ error: 'internal_error' }, 500)
  }
})

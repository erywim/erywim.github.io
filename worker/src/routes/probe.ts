import { Hono } from 'hono'
import type { Env } from '../env'

/** 旧 Python Worker 的两个只读探针接口（行为等价迁移） */
export const probe = new Hono<{ Bindings: Env }>()

probe.get('/health', (c) =>
  c.json({ status: 'ok', runtime: 'cloudflare-typescript-worker' })
)

probe.get('/api/hello', async (c) => {
  let message: string | null = null
  try {
    const row = await c.env.DB.prepare('SELECT message FROM greetings WHERE key = ? LIMIT 1')
      .bind('hello')
      .first<{ message: string }>()
    message = row?.message ?? null
  } catch {
    return c.json({ error: 'd1_unavailable', message: 'D1 数据库暂不可用。' }, 503)
  }

  if (message === null) {
    return c.json({ error: 'hello_row_missing', message: 'D1 尚未初始化 hello 数据。' }, 503)
  }

  return c.json({ message, source: 'cloudflare-d1' })
})

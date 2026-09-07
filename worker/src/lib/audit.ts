import type { Env } from '../env'

/** 审计日志：仅追加（规格 admin-auth「操作审计」） */
export async function writeAudit(
  env: Env,
  userId: number | null,
  action: string,
  target?: string,
  detail?: string
): Promise<void> {
  try {
    await env.DB.prepare('INSERT INTO audit_log (user_id, action, target, detail) VALUES (?, ?, ?, ?)')
      .bind(userId, action, target ?? null, detail ?? null)
      .run()
  } catch (err) {
    // 审计失败不阻断主流程，但要让日志可见
    console.error('audit_write_failed', { action, target, message: err instanceof Error ? err.message : String(err) })
  }
}

/** Worker 绑定与环境变量 */
export interface Env {
  DB: D1Database
  /** 逗号分隔的允许来源；未配置时用内置默认 */
  ALLOWED_ORIGINS?: string
  /** GitHub fine-grained PAT（仅本仓库 Contents 读写），写入仓库必需；读取可匿名 */
  GH_TOKEN?: string
}

/** /admin 路由的上下文变量（requireAuth 注入） */
export interface AdminSession {
  id: string
  userId: number
  expiresAt: string
}

export type AdminEnv = {
  Bindings: Env
  Variables: { adminSession: AdminSession }
}


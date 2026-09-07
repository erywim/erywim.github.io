/**
 * 播种管理员账号（erywimond）：
 *   bun scripts/seed-admin.ts --local    # 本地 D1
 *   bun scripts/seed-admin.ts --remote   # 线上 D1（默认）
 * 密码来源：交互输入，或环境变量 ADMIN_SEED_PASSWORD（CI 用）。
 * 只写入加盐哈希（pbkdf2$<iter>$<salt_b64>$<hash_b64>），与 Worker 端 Web Crypto 校验同算法（PBKDF2-SHA256）。
 */
import { pbkdf2Sync, randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import readline from 'node:readline/promises'

const USERNAME = 'erywimond'
const ITERATIONS = 100_000
const SALT_BYTES = 16
const HASH_BYTES = 32

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

function b64(buf: Buffer): string {
  return buf.toString('base64')
}

function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES)
  const hash = pbkdf2Sync(password, salt, ITERATIONS, HASH_BYTES, 'sha256')
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(hash)}`
}

async function readPassword(): Promise<string> {
  if (process.env.ADMIN_SEED_PASSWORD) return process.env.ADMIN_SEED_PASSWORD
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr })
  const password = await rl.question('设置管理员密码: ')
  rl.close()
  if (!password) throw new Error('密码不能为空')
  return password
}

const scope = process.argv.includes('--remote')
  ? 'remote'
  : process.argv.includes('--local')
    ? 'local'
    : 'remote'

const password = await readPassword()
const passwordHash = hashPassword(password)
const sql = `INSERT INTO admin_users (username, password_hash) VALUES ('${USERNAME}', '${passwordHash}')
ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash, updated_at = datetime('now');`

console.error(`[seed] 已生成 ${USERNAME} 的密码哈希（${scope}）`)
if (hasFlag('--print-only')) {
  console.log(sql)
} else {
  const tmp = `/tmp/seed-admin-${Date.now()}.sql`
  await Bun.write(tmp, sql)
  const res = spawnSync('bunx', ['wrangler', 'd1', 'execute', 'erywim', `--${scope}`, '--file', tmp], {
    stdio: 'inherit',
  })
  process.exit(res.status ?? 1)
}

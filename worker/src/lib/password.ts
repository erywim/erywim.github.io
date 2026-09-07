/**
 * 密码哈希（与 scripts/seed-admin.ts 同格式）：
 *   pbkdf2$<iterations>$<salt_b64>$<hash_b64>   （PBKDF2-SHA256，32 字节派生）
 * Worker 端用 Web Crypto 校验；明文不落任何存储。
 */

const DUMMY_HASH =
  'pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$mBQ0FTXKu0OSIAqyN6IN0FdLbfce1BPcHPPaIy1YS/M='

export function parsePasswordHash(
  stored: string
): { iterations: number; salt: Uint8Array; hash: Uint8Array } | null {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return null
  const iterations = Number(parts[1])
  if (!Number.isInteger(iterations) || iterations < 1) return null
  try {
    const salt = Uint8Array.from(atob(parts[2]), (c) => c.charCodeAt(0))
    const hash = Uint8Array.from(atob(parts[3]), (c) => c.charCodeAt(0))
    return { iterations, salt, hash }
  } catch {
    return null
  }
}

async function derive(password: string, iterations: number, salt: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256
  )
  return new Uint8Array(bits)
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parsePasswordHash(stored)
  if (!parsed) return false
  const derived = await derive(password, parsed.iterations, parsed.salt)
  return timingSafeEqual(derived, parsed.hash)
}

/** 用户名不存在时也走一次等价开销的派生，避免时序侧信道区分「账号不存在/密码错误」 */
export async function burnDummyPassword(password: string): Promise<void> {
  const parsed = parsePasswordHash(DUMMY_HASH)
  if (parsed) await derive(password, parsed.iterations, parsed.salt)
}

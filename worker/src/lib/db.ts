/** D1/时间相关的小工具：TEXT UTC 时间（YYYY-MM-DD HH:MM:SS，与 datetime('now') 同格式可字符串比较） */

export function nowStr(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

export function plusSeconds(base: Date, seconds: number): string {
  return new Date(base.getTime() + seconds * 1000).toISOString().slice(0, 19).replace('T', ' ')
}

export function isExpired(text: string | null | undefined): boolean {
  if (!text) return false
  return text <= nowStr()
}

export function b64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input)
  )
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function sha256HexBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

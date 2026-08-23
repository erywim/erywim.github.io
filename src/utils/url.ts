/** 从链接提取展示用域名（道具宝箱 from 自动派生）；解析失败返回空串 */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

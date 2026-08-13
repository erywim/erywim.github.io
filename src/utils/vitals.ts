/**
 * 主角体力（HP/MP）随时间递减：
 * - 6:00 满 100 → 24:00 线性降到 end（HP 剩 10，MP 剩 30，曲线不同）
 * - 凌晨 0:00-6:00 维持 end（清晨“睡醒满状态”）
 * 服务端构建期取值做静态兜底，客户端按本地时间实时刷新并平滑滚动。
 */

export function staminaAt(d: Date, start = 100, end = 10): number {
  const mins = d.getHours() * 60 + d.getMinutes()
  if (mins < 360) return end
  const span = 1440 - 360 // 6:00 → 24:00 共 1080 分钟
  const elapsed = mins - 360
  return Math.round(start - ((start - end) * elapsed) / span)
}

/** HP：身体体力，深夜剩 10 */
export const hpAt = (d: Date): number => staminaAt(d, 100, 10)

/** MP：魔力/精神，更耐久，深夜剩 30 */
export const mpAt = (d: Date): number => staminaAt(d, 100, 30)

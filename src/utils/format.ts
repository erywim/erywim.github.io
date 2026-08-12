/** 格式化任务日期：31 Jul, 2026 */
export function formatQuestDate(date: Date): string {
  const month = date.toLocaleDateString('en-US', { month: 'short' })
  return `${date.getDate()} ${month}, ${date.getFullYear()}`
}

/** 格式化日志日期：2026/8/9 */
export function formatLogDate(date: Date): string {
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

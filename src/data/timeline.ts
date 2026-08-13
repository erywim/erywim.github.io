/**
 * 旅程大事记（首页时间线）数据
 * 最新在上：以后新增大事记直接往数组最前面插一条即可。
 *   date  —— 日期，如 '2026-08-12'
 *   title —— 事件标题，如 '博客上线'
 *   desc  —— 事件内容描述
 *   link  —— 可选跳转链接（如 '/blog'），不填则不跳转
 */

export interface TimelineItem {
  date: string
  title: string
  desc: string
  link?: string
}

export const timeline: TimelineItem[] = [
  {
    date: '2026-08-12',
    title: '博客上线',
    desc: 'ERYWIM’S BLOG 正式对外发布，冒险之旅就此启程！',
    link: '/blog'
  },
]

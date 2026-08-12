/**
 * 首页数据：道具袋（项目）、队伍（职业历程）—— 请替换为你的项目与经历
 * repo/demo 的 href 填 '#' 时首页会渲染为不可点击的按钮。
 */

export interface HomeItem {
  icon: string
  rarity: string
  title: string
  desc: string
  repo: { label: string; href: string }
  demo: { label: string; href: string }
}

export const items: HomeItem[] = [
  {
    icon: '？',
    rarity: '……',
    title: '……',
    desc: '……',
    repo: { label: 'Repo 📦', href: '#' },
    demo: { label: 'Demo 🌐', href: '#' }
  },
  {
    icon: '？',
    rarity: '……',
    title: '……',
    desc: '……',
    repo: { label: 'Repo 📦', href: '#' },
    demo: { label: 'Demo 🌐', href: '#' }
  }
]

export interface PartyMember {
  title: string
  class: string
  desc: string
  period: string
  /** warrior | mage —— 对应组件里内置的像素头像 */
  avatar: 'warrior' | 'mage'
}

export const party: PartyMember[] = [
  {
    title: '……',
    class: '……',
    desc: '……',
    period: '20XX - 20XX',
    avatar: 'warrior'
  },
  {
    title: '……',
    class: '……',
    desc: '……',
    period: '20XX -',
    avatar: 'mage'
  }
]

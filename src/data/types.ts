/**
 * 数据域公共类型（hero / friends / timeline / home 四个 JSON 数据文件的形状）
 * 数据本体在同名 .json 文件中，由后台「发布」生成——不要再往这里加数据。
 */

export interface HeroTimelineItem {
  date: string
  title: string
  desc: string
}

export interface HeroBuff {
  icon: 'coffee' | 'moon' | 'wrench'
  name: string
  /** good 绿 / bad 橙 / doing 青 */
  kind: 'good' | 'bad' | 'doing'
  width: number
  val: string
}

export interface HeroContact {
  icon: 'github' | 'mail' | 'rss' | 'mug'
  label: string
  value: string
  href: string
}

export interface Hero {
  name: string
  class: string
  stats: {
    hp: { value: number; max: number }
    mp: { value: number; max: number }
    exp: { value: number; max: number }
  }
  bio: string
  location: string
  status: string
  skills: { title: string; chips: string[] }[]
  timeline: HeroTimelineItem[]
  buffs: HeroBuff[]
  contacts: HeroContact[]
}

export interface Friend {
  name: string
  /** 职业/头衔，如 贤者 · SCI-ML */
  role: string
  intro: string
  link: string
  avatar: string
}

export interface TimelineItem {
  date: string
  title: string
  desc: string
  /** 可选跳转链接（如 '/blog'），不填则不跳转 */
  link?: string
}

export interface PartyMember {
  title: string
  class: string
  desc: string
  period: string
  /** warrior | mage —— 对应组件里内置的像素头像 */
  avatar: 'warrior' | 'mage'
  /** 关键技能 / 标签（存档卡片上与道具袋的标签对齐） */
  chips: string[]
}

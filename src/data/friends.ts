/**
 * 伙伴酒馆（友链）数据
 * 当前为空，等你有想展示的伙伴后再添加：
 *   { name, role, intro, link, avatar }
 * avatar 为占位字头；link 填真实地址后跳转即生效。
 */

export interface Friend {
  name: string
  /** 职业/头衔，如 贤者 · SCI-ML */
  role: string
  intro: string
  link: string
  avatar: string
}

export const friends: Friend[] = []

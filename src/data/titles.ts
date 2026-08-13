/**
 * 等级称号：每 5 级一个称号，Lv1 为基础称号，Lv5~100 每 5 级解锁，共 21 个。
 * 风格为 RPG 递进 + 动漫梗 + 恶搞混搭。
 * 等级 = 每 100 经验升 1 级（见 src/utils/rpg.ts），合计经验来自所有已发布文章的 exp。
 */

export interface LevelTitle {
  /** 解锁所需等级 */
  level: number
  title: string
}

export const TITLES: LevelTitle[] = [
  { level: 1, title: '见习冒险家' },
  { level: 5, title: '青涩的勇者' },
  { level: 10, title: '路过的村民A' },
  { level: 15, title: '魔导书收藏家' },
  { level: 20, title: '被选召的孩子' },
  { level: 25, title: '卡卡罗特的朋友' },
  { level: 30, title: '四天王之一' },
  { level: 35, title: '火影候补生' },
  { level: 40, title: '海贼王的船员' },
  { level: 45, title: '穿梭于世界线的人' },
  { level: 50, title: '传说中的勇者' },
  { level: 55, title: '龙骑士团长' },
  { level: 60, title: '等价交换的炼金术师' },
  { level: 65, title: '星辰破碎者' },
  { level: 70, title: '特级咒术师' },
  { level: 75, title: '万事屋搭档' },
  { level: 80, title: '柱级剑士' },
  { level: 85, title: '调查兵团精英' },
  { level: 90, title: '世界树的守护者' },
  { level: 95, title: '时空管理局局长' },
  { level: 100, title: '全栈开发者·创世神' }
]

/** 取当前等级能解锁的最高称号（Lv1 兜底返回基础称号） */
export function getTitleForLevel(level: number): string {
  let t = TITLES[0].title
  for (const item of TITLES) {
    if (level >= item.level) t = item.title
  }
  return t
}

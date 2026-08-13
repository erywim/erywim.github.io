/**
 * 红白机 RPG 主题品牌文案
 * 所有页面级品牌文字集中在此，改一处全局生效。
 */
export const site = {
  /** 游戏标题（标题屏大标题） */
  gameTitle: "ERYWIM'S BLOG",
  /** 标题屏双色：红色部分 */
  gameTitleR: "ERYWIM'S",
  /** 标题屏双色：金色部分 */
  gameTitleG: ' BLOG',
  /** 顶栏 HUD 标题（FAMICOM RPG · 之后的部分） */
  hudTitle: "ERYWIM'S BLOG",
  /** 勇者名（状态面板 / 勇者档案 / 对话框说话人） */
  heroName: 'erywim',
  /** 标题屏副标语 */
  tagline: '全栈 Agent 开发工程师',
  /** GitHub 主页 */
  github: 'https://github.com/erywim',
  /** 页脚署名 */
  copyright: `© ${new Date().getFullYear()} Erywim`,
  /** 构建框架署名（Powered by Astro，MIT 协议礼貌性致谢） */
  poweredBy: 'https://astro.build',
  /** 今日天气：IP 定位全部失败时兜底显示的城市（open-meteo 地理编码用） */
  weatherCity: '北京',
  /** 留言板配置（giscus · 后端为 GitHub Discussions，零部署零密钥） */
  giscus: {
    /** 仓库（已按本仓库填好） */
    repo: 'erywim/erywim.github.io',
    /** 仓库 ID（在 giscus.app 配置后生成，填入即可启用留言板） */
    repoId: 'R_kgDOT12JSw',
    /** Discussions 分类名（默认 General，可自建「留言板」分类后改这里） */
    category: 'General',
    /** 分类 ID（在 giscus.app 配置后生成） */
    categoryId: 'DIC_kwDOT12JS84DDR3l'
  }
}

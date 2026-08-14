# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概况

部署在 GitHub Pages 的个人博客，基于 **Astro**（`bun` 管理依赖），主题为自研的**红白机 RPG 像素风**（「ERYWIM'S BLOG」）。仓库 `erywim/erywim.github.io` 是 user site，`https://erywim.github.io/` 从根路径发布。

保留的 astro-pure 集成仅作为基础设施（pagefind 站内搜索、sitemap、unocss、mdx）；页面视觉全部由 `src/components/famicom/` 自写组件 + `src/assets/styles/famicom.css` 实现。

## 常用命令（包管理器用 bun）

```sh
bun install                # 安装依赖（node_modules 不入库）
bun run dev                # 本地开发服务器
bun run build              # 构建：astro-pure check && astro check && astro build，产物在 dist/
bun run preview            # 本地预览构建产物
bun run post "标题"        # 新建文章（自动生成带 frontmatter 的草稿，draft:true）
bun run log "标题" [周]     # 新建周报（不指定周数自动取最大周+1）
bun run clean              # 清缓存：rm -rf .astro .vercel dist
```

**缓存坑**：`bun run clean` 不会清 `node_modules/.astro` 的内容缓存。删除/重命名内容文件后若构建结果仍是旧内容，执行 `rm -rf .astro dist node_modules/.astro && bun run build`。

## 部署方式

- **GitHub Actions 自动部署**：`.github/workflows/deploy.yml`，push 到 `master` 时构建并把 `dist/` 发布到 GitHub Pages。
- 前提：仓库 Settings → Pages → Source 必须选 **"GitHub Actions"**（不是 "Deploy from a branch"）。
- `astro.config.ts` 已配置 `output: 'static'`、`site: 'https://erywim.github.io'`（无 base，user site 从根路径发布）。不要改回 server/vercel 模式。

## 页面结构（红白机 RPG 主题）

| 路由 | 对应原型 | 数据来源 |
|---|---|---|
| `/` | 标题屏 + 状态/占卜/冒险记录/道具/存档/冒险档案 | 内容集合 + `src/data/home.ts` |
| `/blog` | 冒险记录（文章列表，按时间倒序，S/A/B/C 难度徽章） | `src/content/blog/` |
| `/blog/[id]` | 任务详情（文章正文卷轴 + 上/下一任务） | `src/content/blog/` |
| `/about` | 勇者档案（角色面板 + 技能 + 冒险历程） | `src/data/hero.ts` |
| `/logs` | 旅行日志（周报） | `src/content/logs/` |
| `/links` | 伙伴酒馆（友链） | `src/data/friends.ts` |
| `/ideas` | 灵感火花（idea/todo 的 RPG 火花看板：主线/支线、难度星级、目标清单、EXP/金币，只读·分页） | `src/content/quest/` |
| `/guestbook` | 留言板（giscus · GitHub Discussions 后端，未配置 `repoId`/`categoryId` 时显示占位） | `src/data/site.ts` |
| `/search` | 站内搜索（pagefind） | 构建时自动索引 |
| `/404` | 迷路页 | — |

## 内容与数据

- **博客文章** `src/content/blog/<slug>/index.md`：frontmatter 含 title / description / publishDate / gold(1~19) / exp(1~99) / rank(S·A·B·C) / category(技术·产品·生活·笔记) / tags / draft。`draft: true` 不发布。gold/exp 为必填，由 `bun run post "标题"` 自动随机生成；用 `bun run post` 自动生成模板。
- **周报** `src/content/logs/`：title / description / publishDate / week。
- **勇者档案** `src/data/hero.ts`：名字/职业/属性/简介/技能/冒险历程。
- **伙伴酒馆** `src/data/friends.ts`：友链列表（name/role/intro/link/avatar）。link 为 '#' 时渲染为不可点击。
- **灵感火花（任务）** `src/content/quest/*.md`：idea/todo 的 RPG 任务，每条一个 md（frontmatter 含 type 主线·支线/status 未开始·进行中·已完成/diff 难度 1~3/objectives 目标清单/exp/gold）。纯前端只读页——任务创建（`bun run todo "标题"`，随机生成金币 <150 / 经验 <200）与完成/勾选都靠改对应 md 文件（改 `status` 或 `objectives[].done`），随构建发布。可选项词汇在 `src/data/quest.ts`。
- **首页道具/存档** `src/data/home.ts`：项目与职业历程；repo/demo href 为 '#' 时渲染为不可点击按钮。
- **品牌文案** `src/data/site.ts`：游戏标题、勇者名、副标语、GitHub、版权、天气兜底城市（`weatherCity`）、留言板配置（`giscus`）。改一处全局生效。
- **频道语料** `src/data/sayings.ts`：天空/深海频道随机展示的像素游戏·动漫短句，每次加载随机抽 9 条，每 3 条语料重播一次天气，语料间以像素图标分隔。
- **统一统计** `src/utils/metrics.ts`：文章总数/长文/笔记/日志（构建期实时计算，冒险档案等共用）。
- **RPG 掉落统计** `src/utils/rpg.ts`：每篇已发布文章 + 已完成任务（`status: done`）的 gold/exp 合计与等级（每 100 经验升 1 级，上限 100）。`FamicomLayout` 构建期内嵌 `{quests, titles}` JSON，客户端异步求和、按日缓存（localStorage 键 `erywim-rpg-stats`）并滚动回显到 HUD/状态面板/天空频道（`[data-stat]` 标记）。新增文章/完成任务后合计自动变化，无需手改。
- **等级称号** `src/data/titles.ts`：每 5 级一个称号（Lv1 基础 + Lv5~100，共 21 个，RPG/动漫梗混搭），`getTitleForLevel(level)` 取当前等级最高称号。回显到首页状态面板、勇者档案 hero-card、文章正文奖励行（`[data-rpg-title]` 标记，客户端随经验统计更新并闪烁揭示）。文章页「任务奖励 EXP/G」直接用该文章 frontmatter 真实值。
- **体力/经验实时值** `src/utils/vitals.ts`：首页状态面板与勇者档案的 HP/MP 随本地时间递减（6:00 满 100 → 24:00 线性降，HP 剩 10、MP 剩 30，凌晨 0-6 点维持各自底值），客户端每 30s + 回前台时刷新（`[data-live-hp]` / `[data-live-mp]` 标记，平滑滚动）。两处 EXP 显示改用真实经验合计（`data-stat='exp'` 滚动回显），EXP 条为距下一级进度（`exp % 100`）。`src/data/hero.ts` 的 stats 仅保留数据定义，不再直接展示。
- **命令菜单** `src/components/famicom/CmdMenu.astro`：智能导航——首页点击平滑滚动到对应模块锚点，子页面点击跳转到对应页面。

## 注意事项

- 站点已配置 `locale: zh-CN`。
- 友链不再用 `public/links.json`（数据在 `src/data/friends.ts`）。
- 文章评论系统未集成（astro-pure 的 waline 集成保持关闭）；`/guestbook` 留言板用 giscus（后端=本仓库 GitHub Discussions，零部署零密钥），配置在 `site.giscus`，`repoId`/`categoryId` 未填时显示「尚未开放」占位。
- 新增文章/周报后 `bun run dev` 自动刷新；统计数值会自动更新。

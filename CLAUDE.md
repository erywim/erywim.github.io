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
| `/` | 标题屏 + 状态/占卜/冒险记录/道具/队伍/冒险档案 | 内容集合 + `src/data/home.ts` |
| `/blog` | 冒险记录（文章列表，S/A/B/C 难度） | `src/content/blog/` |
| `/blog/[id]` | 任务详情（文章正文卷轴 + 上/下一任务） | `src/content/blog/` |
| `/about` | 勇者档案（角色面板 + 技能 + 冒险历程） | `src/data/hero.ts` |
| `/logs` | 旅行日志（周报） | `src/content/logs/` |
| `/links` | 伙伴酒馆（友链） | `src/data/friends.ts` |
| `/search` | 站内搜索（pagefind） | 构建时自动索引 |
| `/404` | 迷路页 | — |

## 内容与数据

- **博客文章** `src/content/blog/<slug>/index.md`：frontmatter 含 title / description / publishDate / rank(S·A·B·C) / category(技术·产品·生活·笔记) / tags / draft。`draft: true` 不发布。用 `bun run post "标题"` 自动生成模板。
- **周报** `src/content/logs/`：title / description / publishDate / week。
- **勇者档案** `src/data/hero.ts`：名字/职业/属性/简介/技能/冒险历程。
- **伙伴酒馆** `src/data/friends.ts`：友链列表（name/role/intro/link/avatar）。link 为 '#' 时渲染为不可点击。
- **首页道具/队伍** `src/data/home.ts`：项目与职业历程；repo/demo href 为 '#' 时渲染为不可点击按钮。
- **品牌文案** `src/data/site.ts`：游戏标题、勇者名、副标语、GitHub、版权、天气兜底城市（`weatherCity`）。改一处全局生效。
- **频道语料** `src/data/sayings.ts`：天空/深海频道随机展示的像素游戏·动漫短句，每次加载随机抽 9 条，每 3 条语料重播一次天气，语料间以像素图标分隔。
- **统一统计** `src/utils/metrics.ts`：文章总数/长文/笔记/日志，HUD 金币等级、状态面板、冒险档案三处共用，实时计算保持一致。
- **命令菜单** `src/components/famicom/CmdMenu.astro`：智能导航——首页点击平滑滚动到对应模块锚点，子页面点击跳转到对应页面。

## 注意事项

- 站点已配置 `locale: zh-CN`。
- 友链不再用 `public/links.json`（数据在 `src/data/friends.ts`）。
- 评论系统未集成（waline 配置保持关闭）。
- 新增文章/周报后 `bun run dev` 自动刷新；统计数值会自动更新。

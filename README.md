<div align="center">

```
┌─────────────────────────────────────────┐
│ ▓▓▓   E R Y W I M ' S   B L O G   ▓▓▓  │
│                                         │
│         ▶  P R E S S   S T A R T        │
│                                         │
│    一款红白机 RPG 像素风 · 个人博客      │
└─────────────────────────────────────────┘
```

[![Deploy](https://github.com/erywim/erywim.github.io/actions/workflows/deploy.yml/badge.svg)](https://github.com/erywim/erywim.github.io/actions/workflows/deploy.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)
[![Made with Astro](https://img.shields.io/badge/made%20with-Astro-ff5d01.svg)](https://astro.build)

[开始冒险](https://erywim.github.io) · [冒险记录](https://erywim.github.io/blog) · [勇者档案](https://erywim.github.io/about) · [灵感火花](https://erywim.github.io/ideas) · [留言板](https://erywim.github.io/guestbook)

</div>


这是一座跑在 **GitHub Pages** 上的像素王国：由 **Astro** 静态生成、**bun** 驱动，视觉层完全自研为**红白机 RPG 主题**（`src/components/famicom/`）。在这里，每一篇文章都是一张任务卡——写作就是打怪升级，发得越多、经验越高、称号越响。

---

## 🗺️ 世界地图

| 区域 | 原型 | 内容 |
|---|---|---|
| [`/`](https://erywim.github.io) | 标题屏 | 状态面板 · 今日占卜 · 道具 / 存档 · 冒险档案 |
| [`/blog`](https://erywim.github.io/blog) | 冒险记录 | 文章列表，按时间倒序，S/A/B/C 难度徽章 |
| `/blog/[id]` | 任务详情 | 文章正文卷轴 + 上 / 下一任务 |
| [`/about`](https://erywim.github.io/about) | 勇者档案 | 角色面板 · 技能 · 冒险历程 |
| [`/logs`](https://erywim.github.io/logs) | 旅行日志 | 周报 |
| [`/links`](https://erywim.github.io/links) | 伙伴酒馆 | 友链 |
| [`/ideas`](https://erywim.github.io/ideas) | 灵感火花 | idea / todo 的 RPG 火花看板（主线 / 支线 · 难度星级 · EXP / 金币） |
| [`/guestbook`](https://erywim.github.io/guestbook) | 留言板 | giscus · GitHub Discussions 后端 |
| [`/search`](https://erywim.github.io/search) | 大图书馆 | pagefind 站内搜索 |
| `/404` | 迷路页 | 「勇者迷失在了迷宫深处……」 |

## 🎮 游戏系统

- **⚔️ RPG 掉落系统** —— 每篇文章自带 `gold` / `exp` 奖励，完成任务也掉经验；每 100 经验升 1 级，每 5 级解锁一个新称号（Lv1 见习勇者 → Lv100 传说），全站统计随构建自动结算
- **❤️ 体力条** —— 首页 HP / MP 随现实时间递减（早六点满血，深夜只剩底力），勇者也要休息
- **🔮 今日占卜** —— 天气 + 频道语料随机轮播，像素游戏 · 动漫短句夹 pixel 图标
- **🔍 站内搜索** —— pagefind 构建期索引，零后端
- **💬 留言板** —— giscus，后端就是本仓库的 GitHub Discussions，零部署零密钥
- **📡 云端信标** —— Cloudflare Worker + D1 探针，首页「开发接口」点亮 `ONLINE`
- **📦 纯静态** —— `output: 'static'`，push 到 `master` 自动构建发布

## 🧰 装备栏

| 槽位 | 装备 |
|---|---|
| 框架 | [Astro](https://astro.build) 6（`static` 模式） |
| 包管理 | [bun](https://bun.sh) |
| 主题 | 自研红白机 RPG 像素风（`src/components/famicom/` + `src/assets/styles/famicom.css`） |
| 基础设施 | [astro-theme-pure](https://github.com/cworld1/astro-theme-pure) 集成（pagefind / sitemap / UnoCSS / MDX） |
| 托管 | GitHub Pages（user site，根路径发布） |
| CI/CD | GitHub Actions（`.github/workflows/deploy.yml`） |
| 信标 | Cloudflare Python Worker + D1（[`worker/`](./worker/)） |

## ▶ 开始游戏

环境要求：[Node.js](https://nodejs.org/) 18+ 与 [bun](https://bun.sh)。

```sh
git clone https://github.com/erywim/erywim.github.io.git
cd erywim.github.io
bun install   # 补给：装入背包
bun run dev   # START：本地开荒 http://localhost:4321
```

### 秘籍（其余指令）

```sh
bun run post "标题"     # 发布新任务（自动生成草稿 + 随机 gold/exp）
bun run log  "标题"     # 写旅行日志（周报）
bun run todo "标题"     # 在灵感火花板上钉一张新卡片
bun run build           # 通关存档（构建到 dist/）
bun run preview         # 读取存档（本地预览）
bun run clean           # 迷宫重置（清缓存）
```

## ✒️ 任务发布所

**冒险记录（博客文章）** —— `src/content/blog/<slug>/index.md`：

```yaml
---
title: 击败缓存恶龙
description: 一场关于 CDN 的遭遇战
publishDate: 2026-01-01
gold: 12      # 1~19 金币
exp: 88       # 1~99 经验
rank: S       # 难度徽章 S·A·B·C
category: 技术 # 技术·产品·生活·笔记
tags: [cdn, cache]
draft: true   # 草稿，不发布；去掉即出兵
---
```

- **旅行日志（周报）** —— `src/content/logs/`：`title / description / publishDate / week`
- **灵感火花（任务）** —— `src/content/quest/*.md`：`type 主线/支线`、`status`、`diff 难度 1~3`、`objectives 目标清单`、`exp / gold`；完成只改 frontmatter，构建后自动结算
- **角色数据** —— 勇者档案 `src/data/hero.ts`、伙伴酒馆 `src/data/friends.ts`、品牌文案 `src/data/site.ts`，改一处全局生效

## ⚠️ 隐藏陷阱

删除 / 重命名内容文件后构建结果仍是旧内容？`bun run clean` 清不掉 `node_modules/.astro` 的内容缓存，需要：

```sh
rm -rf .astro dist node_modules/.astro && bun run build
```

## 📡 云端信标

[`worker/`](./worker/) 内是一个极简 Cloudflare Python Worker + D1 后端。首页「开发接口」按钮调用 `/api/hello`，从 D1 读到 `hello world` 才点亮 `ONLINE`。首次部署见 [`worker/README.md`](./worker/README.md)；替换默认 Worker 端点时设置构建变量 `PUBLIC_API_BASE_URL`。

## 🚀 上线（出海远征）

push 到 `master` → GitHub Actions 自动构建并把 `dist/` 发布到 GitHub Pages。
前提：仓库 Settings → Pages → Source 选择 **"GitHub Actions"**。

## 🙏 制作人员

- [Astro](https://astro.build) —— 引擎
- [astro-theme-pure](https://github.com/cworld1/astro-theme-pure) —— 本项目由其二次开发而来，保留了 pagefind / sitemap / UnoCSS / MDX 等集成基础设施
- [astro-theme-pure 的前辈们](https://github.com/cworld1/astro-theme-pure#thanks) —— Astro Cactus · Astro Resume · Starlight
- [pagefind](https://pagefind.app/) / [giscus](https://giscus.app/) —— 搜索与留言

## 📄 许可证

本项目基于 [Apache License 2.0](./LICENSE)（继承自 astro-theme-pure）开源。

> `▶ CONTINUE?  YES / NO`
>
> 欢迎来[伙伴酒馆](https://erywim.github.io/links)交换友链，或在[留言板](https://erywim.github.io/guestbook)留下你的名字。

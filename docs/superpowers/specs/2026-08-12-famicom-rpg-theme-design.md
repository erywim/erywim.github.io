# Erywim's Blog · 红白机 RPG 主题重做设计

日期：2026-08-12
状态：已确认（用户逐节批准）

## 背景与目标

当前仓库 `erywim/erywim.github.io` 是跑通的 Astro + astro-theme-pure 博客 MVP，部署于 GitHub Pages。用户有视觉原型 `~/Documents/临时素材/blog素材/famicom-rpg/`（「COOING QUEST」红白机 RPG 像素风站点，含 6 个页面）。

目标：**保留 Astro 框架与 GitHub Pages 部署，把站点主题完全重做为原型的红白机 RPG 像素风**（深海军蓝 + 红白机红 + 金色，CRT 扫描线，Press Start 2P + Fusion Pixel 字体），内容数据化、可维护，所有跳转正确。**原型风格不变，仅按用户要求替换品牌文案。**

## 关键决策（用户已确认）

1. **架构**：保留 Astro，弃用 astro-pure 主题组件，手写红白机风格组件 + 全局样式。内容全部数据驱动。
2. **品牌**：由 COOING QUEST 改为 **Erywim's Blog**（从 site config 读取，全局生效）。
3. **文章正文**：先占位（用原型摘要 + 章节结构起草），后续用户补真实正文。
4. **页面范围**：精简，只要原型对应页面 + 搜索 + 404。
5. **周报**：做成独立内容集合，可维护。
6. **评论**：Waline 需服务器，**不集成评论**。
7. **搜索**：保留 pagefind 站内搜索。
8. **RSS**：移除。

## 页面映射与导航

| Astro 路由 | 原型 | 内容 |
|---|---|---|
| `/` | index.html | 标题屏 + 命令菜单 + 状态/道具/队伍/占卜 + 冒险记录(最近) + 成就档案 |
| `/blog` | quest-log.html | 冒险记录：全部任务，按日期倒序，S/A/B/C 难度徽章 |
| `/blog/[id]` | quest-detail.html | 任务详情：正文卷轴 + 上/下一任务 + 对话框 |
| `/about` | hero-profile.html | 勇者档案：角色面板 + 技能呪文 + 冒险历程 |
| `/logs` | travel-log.html | 旅行日志：周报列表 |
| `/links` | guild.html | 伙伴酒馆：友链伙伴卡 |
| `/search` | 新增 | 站内搜索（pagefind，红白机面板样式） |
| `/404` | 新增 | 红白机风格迷路页 |

**导航规则**（保证跳转正确）：
- 首页命令菜单：状态→`/#status`、道具→`/#items`、队伍→`/#party`、占卜→`/#fortune`（锚点）、冒险→`/blog`。
- 子页命令菜单：冒险高亮跳 `/blog`，其余锚点回首页对应区块。
- 页脚导航：返回标题`/`、冒险记录`/blog`、勇者档案`/about`、旅行日志`/logs`、伙伴酒馆`/links`、GitHub 主页（`https://github.com/erywim`，数据可配）。
- 任务详情：面包屑 `首页 › 冒险记录 › 文章标题`；上/下一篇按日期串联；无前一篇或后一篇时，对应按钮隐藏，另一个占满一行。
- 冒险记录列表项：标题 → `/blog/[id]`，「查看任务 →」同指向。

## 数据模型

### 博客文章 `src/content/blog/*.md`
沿用现有 schema（title / description / publishDate / updatedDate / tags / draft …），**新增可选字段**：
- `rank: 'S' | 'A' | 'B' | 'C'`（任务难度；缺省 B）
- `category: string`（地图「技术 / 产品 / 生活 / 笔记」；缺省 '技术'）

导入原型 5 篇真实文章为占位内容（正文按摘要 + 章节结构起草）：
1. `mvp` 代码能跑之后，工程才刚开始：从MVP开始的规范化交付 — 31 Jul 2026 / 技术 / B / DevOps, Release Engineering, CI/CD
2. `agent` Agent 的核心并非 Tool 数量：企业营销 AI 平台的工程实践 — 29 Jul 2026 / 产品 / A / Agent, MCP, RAG
3. `nl2bi` 从一句话到一张可信图表：NL2BI Agent 的工程架构与生产实践 — 25 Jul 2026 / 产品 / S / Agent, Evals
4. `rag` RAG 不是魔法，是一条工程流水线 — 8 Jun 2026 / 技术 / B / RAG, 向量数据库, Agent, KB
5. `note` Cervical Cancer Cell Dataset — 23 May 2025 / 笔记 / B / dataset

删除现有 demo 文章（3d-rendering、improve-concentration、markdown、markdown-zh、music-journey、using-mdx、draft）。

### 周报内容集合 `src/content/logs/*.md`
新建集合，schema：`date`(日期) / `week`(第N周) / `title` / `description` / `draft`。导入原型 5 条（第 28–32 周，2026/7/16 – 2026/8/9）。

### 数据文件
- `src/data/hero.ts`：勇者名`erywim`、职业、HP/MP/EXP、简介、技能 4 组（语言/框架/AI/基建 chips）、冒险历程 2 条（2024-2025 医工交叉与CV；2025- Agent 享受者）。
- `src/data/friends.ts`：伙伴列表（name / role 职业 / intro / link / avatar 字头），导入原型 4 位（Andrew Zhang、Cxin Blog、Joshua Chen、Joye Personal Blog）。
- `src/data/home.ts`：道具袋（MORTIS 圣剑、WDCNet 圣盾：icon / rarity / title / desc / repo / demo）、队伍 2 条（战士 医工交叉与CV头号黑子 2024-2025；法师 Agent 享受者 2025-）、成就数字（文章总数/长文/笔记/日志，自动统计 + 可覆盖）。
- `src/site.config.ts`：title=`Erywim's Blog`、author=`erywim`、branding（HERO_NAME、TAGLINE、HUD 文案）、GitHub 链接、header/footer 菜单改为新路由；移除 waline 配置。

## 视觉与资源

- **字体**：`Press Start 2P`（e3t4euO8T…woff2）与 `Fusion Pixel 12px`（fusion-pixel-…woff2）复制到 `public/fonts/`，全局 `@font-face` 注册。
- **全局样式** `src/assets/styles/famicom.css`：提取原型 CSS 变量（`--bg/--red/--gold/--cyan/--ps2/--pix` 等）、CRT 扫描线 `body::before`、HUD 栏、命令菜单、`px` 面板、对话框、页脚、工具类；响应式断点同原型。
- **组件** `src/components/famicom/`：
  - `BaseLayout.astro`：`<head>`（meta + 字体 + 全局样式）+ HUD 顶栏 + 页脚容器。
  - `CmdMenu.astro`：命令菜单（active 态）。
  - `Panel.astro`（px 面板 + 标题栏）、`Dialogue.astro`（说话人 + 文本）、`QuestItem.astro`、`Breadcrumb.astro`。
- **首页占卜抽签**：保留原型 JS（摇签/大吉/中吉/小吉/末吉），迁为内联 `<script>`。

## 清理清单

删除：`src/pages/docs/`、`src/pages/projects/`、`src/pages/tags/`、`src/pages/archives/`、`src/pages/terms/`、`src/pages/rss.xml.ts`、`src/content/docs/`、`src/components/about/`、`src/components/projects/`、`src/components/links/`、`src/components/home/`、`src/components/waline/`、demo 博客文章、`src/content.config.ts` 中 docs 集合。
保留：`src/pages/robots.txt.ts`、`public/avatar.png`、`.github/workflows/deploy.yml`、字体。

## 测试与验收

1. `bun run build`（astro-pure check && astro check && astro build）通过。
2. `bun run dev` / `preview` 逐页点检：8 个页面全部可访问，无 404/死链；命令菜单、面包屑、上/下一篇、页脚全部跳转正确。
3. 内容验证：`/blog` 列表与详情一致；`/about`、`/logs`、`/links` 数据渲染正确；首页占卜可摇签。
4. 搜索页可检索文章。
5. 移动端（≤520px）布局正常。

## 里程碑

1. 数据落地：字体、内容集合（blog/logs）、数据文件（hero/friends/home）、site config 品牌化。
2. 全局样式与基础组件（BaseLayout / CmdMenu / Panel / Dialogue / 首页占卜 JS）。
3. 页面实现：`/`、`/blog`、`/blog/[id]`、`/about`、`/logs`、`/links`、`/search`、`/404`。
4. 清理旧页面与 demo 内容。
5. 构建 + 点检 + 提交。

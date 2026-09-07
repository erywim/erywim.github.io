# Design: add-admin-backend

## Context

站点为 Astro 静态站（GitHub Pages，push 到 master 触发 Actions 构建），全部内容现为 `src/content/**` 的 md 文件与 `src/data/*.ts` 数据文件。后端为 Cloudflare Worker + D1（库名 `erywim`），现役实现是 Python Worker（`worker/src/entry.py`，仅 `/health` 与 `/api/hello` 两个只读接口），依赖 uv/pywrangler 工作流。构建期 zod schema（`src/content.config.ts`）是内容合法性的既有权威。仓库已有明确的密钥纪律（README：secret 走 `wrangler secret put`，不入 wrangler.toml/源码）。

本设计基于探索阶段已拍板的结论：C 架构（D1 草稿区 + Git 发布区）、Worker 重写为 TypeScript、9 个内容域入库、图片提交进仓库、后台长在 Astro 站点内复用像素组件。动机见 proposal.md。

## Goals / Non-Goals

**Goals:**

- 一套可撤销会话 + 限流 + 审计的单账号鉴权，保护 Worker 上新增的全部写接口
- 内容编辑的「草稿→发布」两段式：D1 永远可写可回滚，仓库永远是发布态
- 手改 md（本地编辑/CLI 脚本）与后台编辑共存，冲突显式可见、由人裁决
- 发布产物与现有仓库格式逐字节兼容（frontmatter 字段顺序稳定），diff 干净、可 `git revert`

**Non-Goals:**

- 多账号/角色权限（表结构单表起步即可，不为 RBAC 过度设计）
- 留言板（giscus）管理、sayings 频道语料入库（v2）
- 构建流程改造（继续用既有 push 构建，不引入 webhook/预览环境）
- 富文本/WYSIWYG 编辑器（Markdown 文本域 + 预览即可）
- 管理数据的公开读接口（站点构建仍从文件读取，D1 不对公网暴露内容）

## Decisions

### D1. Worker 用 TypeScript 重写，而非继续 Python

后端将长成有规模的代码（鉴权中间件、9 域 CRUD、GitHub API 发布器、YAML 序列化），TS 是 Cloudflare 一等公民：类型、路由库（hono）、`js-yaml`、示例生态都更成熟；`Web Crypto PBKDF2` 原生可用。既有两个只读接口行为原样迁移（前端探针无感）。代价是丢弃 pywrangler 工作流，但它只服务过几十行探针代码，沉没成本可忽略。
*备选*：继续 Python（Pyodide）——生态与示例偏少，长代码维护性差，被否。

### D2. C 架构的同步协议：`repo_sha` 双向对账

每条内容携带同步尾巴：`repo_path`（仓库文件路径）、`repo_sha`（上次已知的 GitHub 文件 sha）、`dirty`、`deleted`。

- **发布**（D1→Git）：读条目 → 校验（镜像 zod 约束）→ 渲染文件 → Contents API PUT（携带 `repo_sha` 做乐观锁，GitHub 端 sha 不符即 409，天然防覆盖手改）→ 回写新 sha、清 dirty
- **同步**（Git→D1）：列仓库目录 → 逐文件解析 → upsert（覆盖本地、清 dirty、写 sha）
- **冲突判定**：打开条目时取仓库当前 sha 与存量 `repo_sha` 比对，不等即提示

用 GitHub 文件 sha 而非 git 对象模型做对账，避免引入分支/引用管理；单文件单 commit 简单可靠，多文件聚合 commit（Git Data API）留作优化。

### D3. 文件渲染格式与既有仓库逐字节兼容

- 内容集合（blog/logs/chatter/treasure/quest）：frontmatter **固定字段顺序** + 稳定的 YAML 风格（日期 `YYYY-MM-DD`、列表逐行、中文原样不转义），正文接 `body_md`。序列化器自带 round-trip 测试：拉取→解析→重渲染 与原文件 diff 为空
- 数据域（hero/friends/timeline/party）：`.ts` 先迁 `.json`（一次性机械迁移，Astro 侧 `import + satisfies` 保类型，构建零变化），发布器从 D1 全量生成整文件（2 空格缩进 + 尾换行）

*备选*：程序化生成 TS 源码——脆且丑，被否。

### D4. 表结构：auth 4 张 + 内容 9 张（typed-per-domain，不用泛化 JSON 表）

每个域一张表、字段镜像各自 zod schema（枚举加 CHECK 约束），共用同步尾巴列。相对「一张 content_items 泛表 + JSON 列」：SQL 可排序过滤（按日期、按 draft）、写入即约束、后台表单直连列；代价是 DDL 多一点，但 schema 已稳定、可控。
嵌套结构（quest 的 objectives、hero 的 skills/timeline/buffs/contacts、tags）存 JSON 文本列，由 worker 侧校验兜住形状。

`admin_users.password_hash` 格式 `pbkdf2$<iter>$<salt_b64>$<hash_b64>`（Web Crypto PBKDF2-SHA256，≥100k 迭代）；种子脚本在部署时生成（密码来自 `wrangler secret put ADMIN_SEED_PASSWORD` 或一次性脚本参数，不落文件）。

### D5. 会话与跨站 Cookie 方案

后台页（`erywim.github.io`）→ Worker（`*.workers.dev`）为跨站。采用 **HttpOnly Cookie + `SameSite=None; Secure` + CORS `Allow-Credentials`（仅允许既定来源）**；写接口强制 `Content-Type: application/json` 触发预检，CSRF 面收敛到预检 + 来源白名单。token 为 256bit 随机值，库存 sha-256 哈希（泄露库不泄露可用会话），7 天过期 + 滑动续期。
*备选*：Bearer + localStorage——免 CORS 折腾但暴露给 XSS，静态后台页无第三方脚本时风险低；作为降级方案保留，不默认。

### D6. 发布触发与状态反馈闭环

Contents API 提交即触发既有 push 构建，**deploy.yml 零改动**。后台「发布中」状态通过 GitHub Actions API 查询最新 run 状态展示（只读、可失败降级为不显示）。

### D7. 图片入库

上传 → 类型/大小校验（PNG/JPG/WebP，≤2MB）→ base64 经 Contents API 提交到 `src/assets/uploads/<yyyy>/<hash>.<ext>` → 返回路径供头图字段引用。不引入 R2：仓库已是发布态事实源，图片与构建资产同源，无额外生命周期。
*备选*：R2 + 自定义域——多一套存储与 URL 稳定性问题，对个人博客收益为负。

### D8. 后台页面结构（Astro 内）

`src/pages/eeeeerywim.astro` 为唯一入口（noindex + sitemap 过滤），纯静态壳 + 客户端模块：登录屏 → 工作台（域导航 + 列表 + 编辑器）复用 `Panel.astro`/famicom.css 词汇，少量后台专属样式追加进 famicom.css。无框架、无构建改动，与站点现有 vanilla TS 交互模式一致。
彩蛋绑定首页天空容器（事件委托 + `target` 过滤交互元素），3 秒滑动窗口计数，7 次起像素问号提示，10 次传送动画（尊重 `prefers-reduced-motion`）。

## Risks / Trade-offs

- [GH_TOKEN 泄露即整仓库可写] → fine-grained PAT 仅本仓库 Contents 读写；secret 存储；审计所有发布；泄漏时 GitHub 侧一键吊销 + 重新生成
- [发布与手改竞态覆盖] → Contents API 的 sha 乐观锁（409 拒绝）+ 打开条目时的冲突提示，双保险；不做自动合并
- [D1 与仓库长期漂移] → 「从仓库同步」一键对账；audit_log 记录每次方向性操作，漂移可追因
- [坏数据撑爆构建] → worker 侧校验前置（镜像 zod），构建失败兜底模式为「站点保持旧版」而非故障；round-trip 测试防渲染器回归
- [仓库体积随图片增长] → 2MB 上限 + hash 去重命名；个人博客量级可接受，真到量级再迁 R2
- [跨站 Cookie 被浏览器策略收紧] → 现代浏览器 `SameSite=None; Secure` 可用；若某环境失效，D5 的 Bearer 降级方案是现成退路
- [TS 重写引入回归] → `/health`、`/api/hello` 行为用既有 README 验收标准（200 + message/source 字段）做等价验证；探针面板即为线上冒烟测试

## Migration Plan

1. **数据文件迁移先行**（独立可验证）：`hero/friends/timeline/home` `.ts`→`.json`，构建产物 diff 仅限数据文件引用，一次 commit
2. **Worker TS 重写**：迁移 `/health` + `/api/hello`，部署后用探针面板验证线上等价；Python 工具链退役
3. **migration SQL**：auth 4 表 + 内容 9 表 + 种子脚本（`erywimond` 哈希）经 `wrangler d1 migrations apply erywim --remote` 上库
4. **后台与 API 灰度上线**：先 auth + 同步（播种），验证 D1 与仓库一致后，再逐域开放 CRUD + 发布
5. **回滚**：任意阶段回滚 = Worker 回退上一版本（`wrangler rollback`）；D1 新表独立于 `greetings`，不回滚也不影响探针；数据文件迁移回滚 = `git revert`

## Open Questions

- 种子密码的交付方式细节（一次性脚本参数 vs 临时 secret）——实现时定，不影响表结构与流程
- Actions 状态查询是否 v1 就做——可后补，纯增量
- quest `objectives` / hero 嵌套字段的表单交互细节（拖拽排序 vs 上下移按钮）——实现时按工作量取舍

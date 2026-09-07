# Proposal: add-admin-backend

## Why

博客内容目前以 md 文件 + ts 数据文件形式维护，只能在本地用编辑器和 `bun run post` 脚本管理；站点已接入 Cloudflare Worker + D1 后端（探针已上线），具备把「凡会变动的内容」收敛到数据库、通过网页后台动态管理的基础。需要一套带权限的像素风后台，让内容管理不依赖本地环境，同时保持 GitHub 仓库作为发布态数据的可靠归宿。

## What Changes

- 新增隐藏后台入口 `/eeeeerywim`（Astro 静态页，noindex、移出 sitemap），复用 famicom 像素组件体系，含像素风登录界面（RPG 密码界面）。
- 新增首页天空彩蛋：3 秒窗口内连点 10 次背景传送至 `/eeeeerywim`（第 7 次起出现提示，超时重置计数）。
- Worker 从 Python 重写为 **TypeScript**：保留 `/health` 与 `/api/hello` 行为不变；退役 uv / pywrangler / python_modules 工具链。
- 新增后台鉴权体系（D1 四张表）：单账号 `erywimond`，密码只存 PBKDF2 哈希；HttpOnly 跨站 Cookie 会话（可撤销）、登录失败限流（5 次锁 15 分钟）、全操作审计日志。
- 新增内容管理工作区（**C 架构：D1 草稿区 + Git 发布区**）：9 个内容域的表结构与 CRUD API；条目级「发布」/「全部发布」通过 GitHub Contents API 提交文件并触发既有 Actions 构建；「从仓库同步」把仓库现状拉回 D1，以 `repo_sha` 检测手改冲突。
- 数据文件迁移：`hero.ts` / `friends.ts` / `timeline.ts` / `home.ts` 迁为 JSON（类型保持），使其可被发布器稳定生成。
- 新增图片上传：后台直传图片到仓库（Contents API 提交二进制），与博客头图等资产共用仓库存储。
- 首次播种复用「从仓库同步」逻辑：扫描仓库存量内容写入 D1（`dirty=0`）。
- 范围外（明确不做）：留言板管理（giscus 维持现状，待后续组件接入）；sayings 频道语料入库（v2）；词汇表 / 等级称号 / 品牌文案等开发配置仍留在代码。

## Capabilities

### New Capabilities

- `admin-auth`: 后台鉴权——登录/登出、会话生命周期与撤销、登录限流、审计日志、凭据初始化（erywimond，仅存哈希）。
- `content-management`: 内容工作区——9 个内容域的 D1 表结构、CRUD API、发布（D1→Git）、同步（Git→D1）、冲突检测、图片上传、首次播种。
- `admin-ui`: `/eeeeerywim` 像素后台界面——登录页、域导航、列表/编辑视图、发布状态反馈、noindex 与 sitemap 排除。
- `easter-egg`: 首页天空彩蛋——点击计数、超时重置、提示与传送动画。

### Modified Capabilities

（无——本仓库此前无 OpenSpec 规格，本次全部为新增能力。）

## Impact

- **Worker（`worker/`）**：`entry.py` → `index.ts` 重写；`wrangler.toml` 的 `main` 与 `python_workers` flag 变更；新增 `GH_TOKEN` secret（fine-grained PAT，仅本仓库 Contents 读写）；新增 auth/内容 migration SQL；`worker/README.md` 更新部署流程。
- **D1（`erywim`）**：新增 13 张表（auth 4 张 + 内容 9 张）；`greetings` 等既有表不动。
- **前端（`src/`）**：新增 `pages/eeeeerywim.astro` 及后台子组件；首页天空彩蛋交互；`hero/friends/timeline/home` 数据文件 `.ts` → `.json`（构建行为零变化）；sitemap 配置排除后台路由。
- **CI（`.github/workflows/deploy.yml`）**：无需改动（发布走 Contents API 提交即触发既有 push 构建）；后台页需确认不被 sitemap 收录。
- **依赖**：Worker 侧新增 TypeScript 工具链（wrangler 标准 TS 项目）；前端无新增运行时依赖。
- **安全面**：Worker 从只读探针变为带写接口的服务——鉴权中间件、跨站 Cookie（`SameSite=None; Secure` + `Allow-Credentials` + JSON Content-Type 预检）、限流、审计为必选项；坏数据兜底依赖构建期 zod 校验（失败模式为「未更新」而非「站点故障」）。

# Erywim Blog API

博客的 Cloudflare 后端：**TypeScript Worker + D1**。提供线上探针只读接口（`/health`、`/api/hello`）、公开访问埋点（`POST /visit`）与 `/eeeeerywim` 后台 API（鉴权 + 九域内容 CRUD + 发布/同步 + 访问统计）。设计详见仓库根 `openspec/changes/add-admin-backend/`。

> 2026-09：Worker 已从 Python 迁移到 TypeScript（行为等价，`/health` 的 `runtime` 字段如实变更）。

## 开发与部署

前置条件：已安装 bun；已 `wrangler login`。

```bash
cd worker
bun install

# 本地开发（本地 D1 模拟，沿用 .wrangler/state）
bun run dev            # => http://127.0.0.1:8787

# 类型检查
bun run check

# 远程 migration（表结构变更时）
bunx wrangler d1 migrations apply erywim --remote

# 播种管理员（交互输入密码；或 ADMIN_SEED_PASSWORD 环境变量）
bun scripts/seed-admin.ts --remote

# 部署 Worker
bun run deploy
```

本地联调后台页面：仓库根 `PUBLIC_API_BASE_URL=http://127.0.0.1:8787 bun run dev`（CORS 白名单已含 localhost:4321）。

## GH_TOKEN（发布功能必需）

后台「发布」通过 GitHub Contents API 把 D1 内容提交进本仓库，需要 fine-grained PAT：

1. GitHub → Settings → Developer settings → Fine-grained tokens → Generate
2. Repository access：仅 `erywim/erywim.github.io`；Permissions：**Contents: Read and write**（其余不勾）
3. `cd worker && bunx wrangler secret put GH_TOKEN`（粘贴 token；本地开发则写入 `worker/.dev.vars`，已被 gitignore）
4. 泄漏处置：GitHub 侧吊销 → 重新生成 → 重新 `secret put`；`bunx wrangler rollback` 可回退 Worker

发布采用 sha 乐观锁：仓库文件被后台之外修改时发布返回 409，后台界面提示「拉取仓库覆盖 / 强制发布覆盖」二选一，绝不静默合并。仓库文件已被删除时，「拉取仓库覆盖本地」会移除本地工作区行（与仓库一致），不再报错。

## CI 自动同步（CI_SYNC_TOKEN）

D1 工作区是草稿区、仓库是发布区；在后台之外（IDE、GitHub 网页）直接改仓库后 D1 不会自动感知。部署工作流（`.github/workflows/deploy.yml`）在每次 push 部署完成后回调 `POST /hooks/sync`，按**安全模式**把仓库现状对齐进 D1：只更新已同步行、移除仓库中已删除的行；有未发布修改（dirty）的条目/整域一律跳过，绝不覆盖后台草稿（这类行打开编辑器时仍会走冲突横幅人工二选一）。

1. 生成随机令牌：`openssl rand -hex 24`
2. `cd worker && bunx wrangler secret put CI_SYNC_TOKEN`（本地联调写 `worker/.dev.vars`）
3. 仓库 Settings → Secrets and variables → Actions → New repository secret：同名 `CI_SYNC_TOKEN`，同值
4. 两边任一处未配置时端点返回 404（关闭），工作流中该步骤自动跳过；同步结果记入审计 `ci-sync`

## 验证（探针接口）

```bash
curl -i https://erywim-blog-api.okunoda.workers.dev/health
curl -i https://erywim-blog-api.okunoda.workers.dev/api/hello
```

`/api/hello` 必须返回 HTTP 200，并且 JSON 中包含 `"message": "hello world"` 与 `"source": "cloudflare-d1"`。如果返回 `d1_unavailable` 或 `hello_row_missing`，不要把它当作成功：检查 D1 ID、远程 migration 和 Worker binding。

## 访问统计（visits）

- **采集**：前端 `FamicomLayout` 每次页面加载 POST `/visit`（body `{path}`；后台 `/eeeeerywim` 自身不上报）。Worker 记录 IP（`CF-Connecting-IP`）、UA、Referer、国家（`CF-IPCountry`）到 D1 `visits` 表（0007 迁移）。
- **防滥用**：公开 CORS 白名单（扩展支持 POST）+ 同 IP 每分钟最多 30 条，超出静默丢弃（`{ok:true,skipped:true}`）；path 仅收 `/` 开头且 ≤200 字符，否则记 `/`。
- **查看**：后台「访问统计」tab（`GET /admin/stats/visits?from=&to=`，日期为北京时间闭区间）返回概览 PV/UV、每日趋势（近 90 天）、热门页面（按 IP 去重人数排序）、访客排行、最新流水（`/admin/stats/visits/recent?before=<id>` 翻页）。数据永久保留。

`/api/hello` 必须返回 HTTP 200，并且 JSON 中包含 `"message": "hello world"` 与 `"source": "cloudflare-d1"`。如果返回 `d1_unavailable` 或 `hello_row_missing`，不要把它当作成功：检查 D1 ID、远程 migration 和 Worker binding。

## 接入博客前端

项目已经内置当前 Worker 地址；如果以后更换 Worker，可在项目根目录覆盖公开构建变量：

```bash
cp .env.example .env.local
# 按需将 PUBLIC_API_BASE_URL 改成新的 Worker 地址
```

GitHub Pages 工作流默认使用当前 Worker 地址；如果更换地址，可在仓库设置中增加同名 Repository variable：`PUBLIC_API_BASE_URL` 覆盖默认值。（首页探针面板已移除；可直接 curl 验证。）

## 密钥与开源仓库

- `database_id`、Worker 地址和 `ALLOWED_ORIGINS` 是公开配置/标识，不是 Cloudflare 登录凭据。
- 不要把 `CLOUDFLARE_API_TOKEN`、`GH_TOKEN`、API key、密码或其他第三方凭据写进 `wrangler.toml`、源码或任何 `PUBLIC_*` 变量；运行时密钥一律 `wrangler secret put <KEY>`。
- 本地密钥放在 `.dev.vars*` 或 `.env*` 文件中；这些文件已加入根目录 `.gitignore`，不要提交到 Git。
- 后台写接口上线后：鉴权（会话 Cookie）+ 登录限流 + 审计是必选项；CORS 只是浏览器策略，不是 API 认证。

## 回滚

`bunx wrangler rollback` 回到上一版本；D1 的 `greetings` 等表不受 Worker 回滚影响。

# Erywim Blog API

这是博客的免费 Cloudflare 后端探针：Python Worker 只提供两个只读接口，`/health` 用于健康检查，`/api/hello` 从 D1 读取 `hello world`。

## 首次部署

前置条件：已安装 Node、Wrangler 和 uv，并在当前机器完成 `wrangler login`。

```bash
cd worker

# 已绑定现有 D1 数据库 erywim；首次部署先执行远程 migration
wrangler d1 migrations apply erywim --remote

# 本地开发（使用本地 D1 模拟）
uv run pywrangler dev

# 部署 Worker；命令末尾会输出 workers.dev 地址
uv run pywrangler deploy
```

部署后先验证：

```bash
curl -i https://<你的-worker-地址>/health
curl -i https://<你的-worker-地址>/api/hello
```

`/api/hello` 必须返回 HTTP 200，并且 JSON 中包含 `"message": "hello world"` 与 `"source": "cloudflare-d1"`。如果返回 `d1_unavailable` 或 `hello_row_missing`，不要把它当作成功：检查 D1 ID、远程 migration 和 Worker binding。

## 接入博客前端

项目已经内置当前 Worker 地址；如果以后更换 Worker，可在项目根目录覆盖公开构建变量：

```bash
cp .env.example .env.local
# 按需将 PUBLIC_API_BASE_URL 改成新的 Worker 地址
```

GitHub Pages 工作流默认使用当前 Worker 地址；如果更换地址，可在仓库设置中增加同名 Repository variable：`PUBLIC_API_BASE_URL` 覆盖默认值。首页「开发接口」面板会调用线上 Worker。

## 密钥与开源仓库

- `database_id`、Worker 地址和 `ALLOWED_ORIGINS` 是公开配置/标识，不是 Cloudflare 登录凭据。
- 不要把 `CLOUDFLARE_API_TOKEN`、API key、密码或其他第三方凭据写进 `wrangler.toml`、源码或任何 `PUBLIC_*` 变量；需要运行时密钥时使用 `wrangler secret put <KEY>`。
- 本地密钥放在 `.dev.vars*` 或 `.env*` 文件中；这些文件已加入根目录 `.gitignore`，不要提交到 Git。
- 当前探针只有只读接口；CORS 只是浏览器策略，不是 API 认证。以后增加写接口或私有数据时，必须另加认证和限流。

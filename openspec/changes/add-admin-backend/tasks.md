# Tasks: add-admin-backend

依赖顺序执行；每组末尾尽量带可观测验证。参考 specs/（行为契约）与 design.md（技术决策 D1~D8）。

## 1. 数据文件迁移（.ts → .json）

- [x] 1.1 将 `src/data/hero.ts`、`friends.ts`、`timeline.ts`、`home.ts` 迁为同名 `.json`，Astro 侧以 `import + satisfies` 保持全部既有 TS 类型，删除原 `.ts`；验证 `bun run build` 成功且产物页面（/、/about、/links）内容与迁移前一致
- [x] 1.2 清理迁移后未再引用的类型/导出残留，`bunx astro check` 0 错误

## 2. Worker TS 重写（行为等价）

- [x] 2.1 新建 `worker/src/index.ts`，迁移 `/health` 与 `/api/hello`（含 CORS 白名单、错误分支 `d1_unavailable`/`hello_row_missing`），`wrangler.toml` 改 `main` 并移除 `python_workers` flag；`wrangler dev` 本地 curl 两接口与 Python 版响应逐字段一致
- [x] 2.2 退役 uv/pyproject/python_modules/pywrangler 工作流并更新 `worker/README.md`；`wrangler deploy` 后用首页探针面板线上验证 `/api/hello` 返回 message + source
- [x] 2.3 引入 hono（或等价路由）与 js-yaml，搭建路由/中间件骨架（请求日志、统一 JSON 错误响应），现有两接口挂到新骨架，回归 2.1 验证

## 3. D1 表结构与种子

- [x] 3.1 编写 migration：auth 四表（`admin_users`/`admin_sessions`/`login_attempts`/`audit_log`，见 design D4），本地 apply 后 `wrangler d1 execute erywim --local` 检查表结构
- [x] 3.2 编写 migration：内容九表（`content_blog/logs/chatter/treasure/quest/friends/timeline/party/hero`），各域列镜像 `src/content.config.ts` 的 zod schema 并带 CHECK 约束，统一同步尾巴列（`repo_path`/`repo_sha`/`dirty`/`deleted`）
- [x] 3.3 实现种子脚本：生成 `erywimond` 的 PBKDF2 哈希（`pbkdf2$iter$salt$hash` 格式，Web Crypto，≥100k 迭代）写入 `admin_users`；本地验证查询只有哈希、无明文
- [x] 3.4 远程 apply 全部 migration 并播种，`wrangler d1 execute erywim --remote --command "SELECT username FROM admin_users"` 确认账号就位

## 4. 鉴权（spec: admin-auth）

- [x] 4.1 实现 `POST /admin/login`：统一错误信息、PBKDF2 校验、成功建会话（256bit token，库存 sha-256）+ Set-Cookie（HttpOnly/Secure/SameSite=None）+ 审计；curl 验证正确/错误密码两分支
- [x] 4.2 实现会话中间件：校验 Cookie→查会话→过期/撤销拒绝、滑动续期；`GET /admin/me` 与 `POST /admin/logout`（服务端撤销）；curl 验证登录→访问→登出→401 全链路
- [x] 4.3 实现登录限流：同账号连败 5 次锁 15 分钟、成功清零；curl 连打 6 次验证第 6 次正确密码仍被拒、（本地改库时间）过期后恢复
- [x] 4.4 实现 CORS/预检收紧：写接口要求 `Content-Type: application/json` 且来源在白名单（`Allow-Credentials`）；用白名单外 Origin 的预检请求验证被拒
- [x] 4.5 实现审计写入：登录/登出/内容操作统一落 `audit_log`；操作后查库验证记录存在

## 5. 内容工作区 CRUD（spec: content-management）

- [x] 5.1 实现九域通用 CRUD 骨架（路由 + 每域校验器，校验规则镜像 zod：rank/gold/exp/枚举/长度），`POST/PUT` 传违规数据返回字段级错误；本地 curl 对 blog 与 quest 各验一条
- [x] 5.2 实现九域校验器全覆盖（含 quest objectives、treasure 枚举、hero 嵌套 JSON 形状），对每域一条合法 + 一条违规数据 curl 冒烟
- [x] 5.3 实现软删除（`deleted=1`）与恢复、列表接口（按时间倒序、含 dirty/deleted 标识、顶栏待发布计数）

## 6. 发布与同步（spec: content-management，design D2/D3/D6）

- [x] 6.1 实现 frontmatter 序列化器（固定字段顺序、稳定 YAML 风格）+ round-trip 测试：对仓库现存全部 md 拉取→解析→重渲染与原文件逐字节 diff 为空
- [x] 6.2 实现「从仓库同步」：列目录→解析→upsert D1（清 dirty、写 sha）；对真实仓库跑一次空库播种，D1 行数与文件数一致、抽样字段一致
- [x] 6.3 实现条目发布：校验→渲染→Contents API PUT（带 `repo_sha` 乐观锁）→回写 sha/清 dirty→审计；改一条 treasure 后发布，仓库出现对应 commit、CI 构建通过、站点更新
- [x] 6.4 实现软删除发布（Contents API DELETE）与整文件 JSON 域发布（hero/friends/timeline/party 全量重生成、保序）；删除一条友链发布后 `friends.json` 与 D1 一致
- [x] 6.5 实现「全部发布」（顺序发布所有 dirty 条目、失败即停并报告明细）与冲突检测接口（打开条目时返回仓库 sha 与已知 sha 的比对结果）
- [x] 6.6 冲突路径端到端验证：手改一条 md → 后台打开同条目返回冲突 → 分别验证「拉取覆盖」与「强制发布」两条出路行为正确

## 7. 图片上传（design D7）

- [x] 7.1 实现 `POST /admin/upload`：类型/大小校验（PNG/JPG/WebP ≤2MB）→ base64 提交至 `src/assets/uploads/<yyyy>/<hash>.<ext>` → 返回路径 + 审计；curl 上传合法图与超限/错误类型各验一次
- [x] 7.2 上传的图片在博客头图字段引用后构建渲染正常（挑一篇测试文验证）

## 8. 后台界面（spec: admin-ui，design D8）

- [x] 8.1 创建 `src/pages/eeeeerywim.astro`：noindex meta、sitemap 过滤、像素登录屏（登录前零管理请求）；未登录打开页面网络面板无 admin API 调用
- [x] 8.2 实现登录/登出/401 回登录态的客户端会话管理；错误密码界面内提示不跳转
- [x] 8.3 实现工作台骨架：九域导航 + 通用列表（时间倒序、待发布/待删除标识、待发布总数）
- [x] 8.4 实现各域编辑表单：字段与 schema 对应（枚举选择器、tags/objectives 可增删排序、hero 单记录表单）；保存→重开数据一致
- [x] 8.5 实现发布控制条目级按钮 +「全部发布（N）」+「从仓库同步」，结果反馈（成功/字段级失败/未执行明细）
- [x] 8.6 实现冲突处理 UI（两选项、未处理禁保存）与图片上传控件（进度/失败提示）
- [x] 8.7 移动端与深色偏好下后台可用性自查（famicom 体系内适配，无横向滚动）

## 9. 首页彩蛋（spec: easter-egg）

- [x] 9.1 实现天空点击计数（3 秒滑动窗口、交互元素 target 过滤、超时归零）与 7 次起像素问号提示
- [x] 9.2 实现 10 连击传送动画 → `/eeeeerywim`（`prefers-reduced-motion` 直接跳转）；手动验证十连击/超时重置/子页面无效/减少动效四个场景

## 10. 收尾与文档

- [x] 10.1 端到端演练：登录→改文章→发布→CI→站点更新→同步对账全流程走通并记录耗时
- [x] 10.2 更新 `worker/README.md`（TS 部署流程、GH_TOKEN secret 配置、种子说明）与根 `CLAUDE.md`（后台路由、发布模型一句话说明）
- [x] 10.3 安全自查清单过一遍：未认证 401、白名单外预检拒绝、审计可查、仓库无任何凭据、`wrangler secret list` 仅预期项

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概况

部署在 GitHub Pages 的个人博客，基于 **Astro + astro-theme-pure**（`bun` 管理依赖）。仓库 `erywim/erywim.github.io` 是 user site，`https://erywim.github.io/` 从根路径发布。

## 常用命令（包管理器用 bun）

```sh
bun install            # 安装依赖（node_modules 不入库）
bun run dev            # 本地开发服务器
bun run build          # 构建：astro-pure check && astro check && astro build，产物在 dist/
bun run preview        # 本地预览构建产物
bun pure new           # 新建一篇文章
bun run clean          # 清缓存：rm -rf .astro .vercel dist
```

注意：构建若报图片缓存损坏，先 `rm -rf .astro dist node_modules/.astro` 再重新 build。

## 部署方式

- **GitHub Actions 自动部署**：`.github/workflows/deploy.yml`，push 到 `master` 时构建并把 `dist/` 发布到 GitHub Pages。
- 前提：仓库 Settings → Pages → Source 必须选 **"GitHub Actions"**（不是 "Deploy from a branch"）。
- `astro.config.ts` 已配置 `output: 'static'`、`site: 'https://erywim.github.io'`（无 base，user site 从根路径发布）。不要改回 server/vercel 模式。

## 配置与内容

- `src/site.config.ts`：站点配置（title、author、header/footer 菜单、友链、评论等）。评论系统 waline 当前 `enable: false`。
- `astro.config.ts`：Astro 构建配置。
- `src/content/blog/`：博客文章（每篇一个目录，内含 `index.md`/`index.mdx` + 资源）。`src/content/docs/`：文档站内容。
- `public/links.json`：友链数据。**友链头像必须是本地路径**——远程图片 URL 会在构建时被 astro:assets fetch 并优化，若源站证书失效（如 `cdn.arthals.ink` 的证书在 2026-08-11 过期）会导致构建失败。本地占位图在 `public/avatar.png`。

## 注意事项

- 默认 locale 是 `en-US`，做中文站需改 `site.config.ts` 的 `locale`。
- demo 内容是主题自带的示例（blog/docs 都是占位），上线后按需替换。
- 主题默认样式是演示样式，博客 UI 的定制属后续工作。

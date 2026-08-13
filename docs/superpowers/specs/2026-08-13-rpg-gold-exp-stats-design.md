# 红白机 RPG：文章金币/经验掉落 + 每日异步统计回显

日期：2026-08-13
状态：设计已确认，待实现

## 背景与目标

本博客是纯静态站（Astro 构建 → GitHub Pages，无后端）。在现有红白机 RPG 主题中，
HUD 顶栏的「金币 G{total}」「等级 LV.{total}」目前是用**文章总数**充当，语义不贴合 RPG 世界观。

本次需求让每篇任务文章在创建时随机掉落金币（gold）和经验（exp），进入博客时由客户端**异步统计合计**并回显到 HUD / 状态面板 / 天空频道，带每日浏览器缓存与数值滚动动画。

目标：
1. 每篇已发布文章拥有 `gold`（1~19）与 `exp`（1~99）字段，创建时自动生成。
2. 客户端进入博客时异步统计所有已发布文章的金币/经验合计。
3. 浏览器缓存：**当天首次进入才统计**，当天后续进入直接用缓存。
4. 回显数值带滚动动画（从 0 缓动滚到目标值）。

## 决策记录（已确认）

- **HUD / 状态面板的金币、等级替换为真实合计**（不再是文章数）。
- **存量文章回填随机 gold/exp**，schema 设为必填，保证统计口径一致。
- **数据来源：构建期内嵌 JSON**（方案 A）——FamicomLayout 把已发布文章的 `{id,gold,exp}`
  序列化为 `<script type="application/json">`，客户端读取后异步求和。
- 金币取值范围 `1~19`（从 1 起，保证每篇有正向贡献），经验 `1~99`。
- 等级公式：`LV = min(99, max(1, floor(经验合计 / 100) + 1))`，每 100 经验升一级。

## 数据模型

### blog 集合 schema（`src/content/config.ts`）

```ts
/** 每篇任务可获金币（1~19） */
gold: z.number().int().min(1).max(19),
/** 每篇任务可获经验（1~99） */
exp: z.number().int().min(1).max(99),
```

必填字段。存量两篇文章（`post-20260812-2`、`post-20260813`）回填随机值。

### 新建文章脚本（`scripts/new-post.ts`）

frontmatter 新增 `gold` / `exp`，用 `Math.random()` 生成：

```yaml
title: '...'
publishDate: 2026-08-13
gold: 13
exp: 67
rank: B
category: 技术
tags: []
draft: true
```

- `gold = 1 + Math.floor(Math.random() * 19)` → 1~19
- `exp = 1 + Math.floor(Math.random() * 99)` → 1~99
- `draft: true` 草稿照常生成字段，但**统计只算已发布**（与现有 metrics 口径一致）。

## 统计工具（`src/utils/rpg.ts`，新增）

构建期函数，输入已发布文章，输出合计与内嵌数据：

```ts
export interface RpgQuest { id: string; gold: number; exp: number }
export interface RpgStats { gold: number; exp: number; level: number; quests: RpgQuest[] }

export function getRpgStats(posts: CollectionEntry<'blog'>[]): RpgStats {
  const gold = posts.reduce((s, p) => s + p.data.gold, 0)
  const exp = posts.reduce((s, p) => s + p.data.exp, 0)
  return {
    gold,
    exp,
    level: Math.min(99, Math.max(1, Math.floor(exp / 100) + 1)),
    quests: posts.map((p) => ({ id: p.id, gold: p.data.gold, exp: p.data.exp }))
  }
}
```

`quests` 是给客户端异步求和用的紧凑数据（只含 id/gold/exp，体积小）。

## 展示位更新

| 位置 | 现在 | 改成 |
|---|---|---|
| HUD 顶栏金币 | `G {total}`（文章数） | `G {gold合计}` 4 位补零，`data-stat="gold"` |
| HUD 顶栏等级 | `LV.{total}` | `LV.{exp→等级}`，`data-stat="level"` |
| 首页状态面板 | `金币 G{total}` | `金币 G{gold合计}`（`data-stat="gold" data-lite`）+ 新增 `经验 {exp合计}`（`data-stat="exp"`） |
| 天空频道 ticker | `{level} · {gold}` | 两处各包 `data-stat="level"` / `data-stat="gold"` span |
| 冒险档案 | essay/note/文章/日志数（构建期，不动） | 不变，仍走原有 `data-count` 滚动 |

- 服务端用构建期真实合计渲染（无 JS / 统计失败时兜底正确值）。
- 客户端脚本在首绘前把 `[data-stat]` 元素归 0，再滚到计算/缓存值 → 无闪跳。

### `data-stat` 取值与格式

| data-stat | 格式 | 示例 |
|---|---|---|
| `gold`（默认） | `G ` + 4 位补零 | `G 0137` |
| `gold` + `data-lite` | `G` + 数值 | `G137` |
| `exp` | 裸数值（标签在外部） | `471` |
| `level` | `LV.` + 数值 | `LV.5` |

## 客户端异步统计 + 每日缓存（`FamicomLayout` 内）

```ts
const DATA_KEY = 'erywim-rpg-stats'

// 本地日期（不用 toISOString，避免 UTC 日期偏移）
const d = new Date()
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

async function computeStats() {
  const node = document.getElementById('rpg-quest-data')
  const quests = JSON.parse(node.textContent) as { gold: number; exp: number }[]
  await new Promise((r) => setTimeout(r, 0)) // 让出主线程，不阻塞渲染
  let gold = 0, exp = 0
  for (const q of quests) { gold += q.gold; exp += q.exp }
  return { gold, exp }
}

async function loadRpgStats() {
  const node = document.getElementById('rpg-quest-data')
  if (!node) return // 无数据 → 保留服务端兜底值
  let quests: unknown
  try { quests = JSON.parse(node.textContent) } catch { return }
  const els = Array.from(document.querySelectorAll('[data-stat]'))
  // 首绘前同步归 0
  for (const el of els) el.textContent = fmt(el, 0)

  let target: { gold: number; exp: number }
  let cached = null
  try { cached = JSON.parse(localStorage.getItem(DATA_KEY) ?? 'null') } catch {}
  if (cached && cached.date === today) {
    target = cached // 当天已统计过 → 直接用缓存
  } else {
    target = await computeStats() // 当天首次 → 才真正统计
    try { localStorage.setItem(DATA_KEY, JSON.stringify({ date: today, ...target })) } catch {}
  }
  for (const el of els) rollTo(el, statValue(el, target))
}
```

- 缓存键带日期 → 跨天自动失效，当天内多次进入（含切页）不重复统计。
- 统计失败 / 解析失败 → 静默保留服务端兜底值，不报错。
- `setTimeout(0)` 让出主线程 → 满足「异步、不阻塞」。
- localStorage 全程 try/catch（隐私模式 / 被禁用时降级为每次统计）。

## 滚动动画

通用缓动函数（ease-out cubic，复用现有 `index.astro` 的 `data-count` 动画思路）：

```ts
function fmt(el: HTMLElement, v: number): string {
  const stat = el.dataset.stat
  if (stat === 'gold') return el.dataset.lite ? `G${v}` : `G ${String(v).padStart(4, '0')}`
  if (stat === 'exp') return String(v)
  if (stat === 'level') return `LV.${v}`
  return String(v)
}

function rollTo(el: HTMLElement, to: number, dur = 1100) {
  const from = Number((el.textContent || '').replace(/\D/g, '')) || 0
  const t0 = performance.now()
  function step(ts: number) {
    const p = Math.min((ts - t0) / dur, 1)
    const v = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)))
    el.textContent = fmt(el, v)
    if (p < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

function statValue(el: HTMLElement, s: { gold: number; exp: number; level: number }): number {
  if (el.dataset.stat === 'gold') return s.gold
  if (el.dataset.stat === 'exp') return s.exp
  return s.level
}
```

- 尊重 `prefers-reduced-motion`：命中时跳过动画，直接写终值。
- 滚动发生在 ticker 语料重建（同步）之后 → `data-stat` span 能正常命中。

## 涉及文件

| 文件 | 改动 |
|---|---|
| `src/content.config.ts` | blog schema 加 `gold` / `exp` 必填字段 |
| `scripts/new-post.ts` | frontmatter 生成随机 `gold` / `exp` |
| `src/content/blog/post-20260812-2/index.md` | 回填随机 gold/exp |
| `src/content/blog/post-20260813/index.md` | 回填随机 gold/exp |
| `src/utils/rpg.ts` | 新增 `getRpgStats`（构建期合计 + 内嵌数据） |
| `src/components/famicom/FamicomLayout.astro` | HUD 金币/等级用真实合计；内嵌 JSON；ticker 打标；新增客户端脚本（统计+缓存+滚动）；移除对 `getMetrics` 的依赖 |
| `src/pages/index.astro` | 状态面板金币用真实合计 + 新增经验展示（`data-stat` 打标） |

## 不做的事（YAGNI）

- 不给每篇任务条目（QuestItem）单独展示金币/经验掉落（本次只做合计回显）。
- 不引入后端 / 不改动部署方式。
- 不改冒险档案的文章数/笔记数统计（沿用构建期 metrics）。

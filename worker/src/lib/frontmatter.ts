/**
 * frontmatter 解析 / 渲染（任务 6.1）。
 * 渲染格式与 scripts/new-*.ts 生成器及现存文件逐字节兼容（round-trip 测试保障）。
 *
 * 兼容性契约：
 *   - 文件头（frontmatter 顶部的 `#` 注释块）逐文件不同 → 解析时捕获原文，存 fm_header 列，发布原样回放
 *   - 正文：body_md 为 NULL 表示「空正文且结束定界线无尾换行」，'' 表示「空正文且有尾换行」
 *   - 行内数组分隔：blog 用 `,`（无空格），其余域用 `, `（与现存文件一致）
 */

import { load } from 'js-yaml'

import type { DomainDef } from './domains'

export interface ParsedFile {
  data: Record<string, unknown>
  /** frontmatter 顶部注释头原文（无注释头为 null） */
  headerText: string | null
  /** 正文（不含定界线后的第一个换行）；null = 文件以 `---` 结尾且无尾换行 */
  bodyMd: string | null
}

export function parseMarkdown(raw: string): ParsedFile | null {
  if (!raw.startsWith('---\n')) return null
  const i = raw.indexOf('\n---', 4)
  if (i < 0) return null
  const afterDashes = i + 4
  const hadNl = raw[afterDashes] === '\n'
  const fmText = raw.slice(4, i + 1) // 不含结尾 \n

  // 顶部连续 # 注释行 = 文件头
  const lines = fmText.split('\n')
  let headerEnd = 0
  while (headerEnd < lines.length && lines[headerEnd].startsWith('#')) headerEnd += 1
  const headerText = headerEnd > 0 ? lines.slice(0, headerEnd).join('\n') : null
  const yamlText = lines.slice(headerEnd).join('\n')

  let bodyMd: string | null
  if (hadNl) {
    // rest = 终止换行之后的全部（正文若以空行开头，保留该空行）
    bodyMd = raw.slice(afterDashes + 1)
  } else {
    bodyMd = null
  }

  try {
    const data = load(yamlText) as Record<string, unknown>
    return { data: data ?? {}, headerText, bodyMd }
  } catch {
    return null
  }
}

/** YAML 单引号风格字符串 */
export function sq(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

const PLAIN_SAFE_RE = /^[A-Za-z0-9一-鿿　-〿＀-￯][A-Za-z0-9一-鿿　-〿＀-￯._/~:+\-()（）·、]*$/

function inlineItem(value: string): string {
  return PLAIN_SAFE_RE.test(value) && !value.includes(': ') ? value : sq(value)
}

function inlineArray(domainKey: string, items: string[]): string {
  if (items.length === 0) return '[]'
  // 行内分隔统一无空格（与 blog 及最新生成物一致；老文件首次发布时归一）
  const sep = ', '
  return `[${items.map((s) => inlineItem(String(s))).join(domainKey === 'blog' ? ',' : sep)}]`
}

/** desc：单行 → 引号；含换行 → 块标量（值保真：结尾无换行用 |- strip） */
function renderDesc(desc: string): string[] {
  if (!desc.includes('\n')) return [`desc: ${sq(desc)}`]
  const indented = desc
    .split('\n')
    .map((line) => (line === '' ? '' : `  ${line}`))
    .join('\n')
  return [`desc: |${desc.endsWith('\n') ? '' : '-'}`, indented]
}

export interface RenderCtx {
  /** 值映射（API camelCase key → 值） */
  item: Record<string, unknown>
  /** 正文；null = 空正文无尾换行 */
  bodyMd: string | null
  /** 文件注释头原文；undefined = 无 */
  fmHeader?: string | null
}

/** 各域 frontmatter 行渲染：key 顺序与缺省省略规则即 round-trip 契约 */
function renderLines(domain: DomainDef, ctx: RenderCtx): string {
  const v = ctx.item
  const lines: string[] = []
  const tagsOf = () => ((v.tags as string[]) ?? []).map(String)

  switch (domain.key) {
    case 'blog': {
      lines.push(`title: ${sq(String(v.title ?? ''))}`)
      lines.push(`description: ${sq(String(v.description ?? ''))}`)
      lines.push(`publishDate: ${v.publishDate}`)
      if (v.updatedDate) lines.push(`updatedDate: ${v.updatedDate}`)
      if (v.heroImage && typeof v.heroImage === 'object') {
        lines.push(`heroImage: ${JSON.stringify(v.heroImage)}`)
      }
      lines.push(`gold: ${v.gold}`)
      lines.push(`exp: ${v.exp}`)
      lines.push(`rank: ${v.rank ?? 'B'}`)
      lines.push(`category: ${v.category ?? '技术'}`)
      lines.push(`tags: ${inlineArray(domain.key, tagsOf())}`)
      lines.push(`draft: ${v.draft ? 'true' : 'false'}`)
      if (v.comment === false) lines.push('comment: false')
      if (v.language) lines.push(`language: ${String(v.language)}`)
      break
    }
    case 'logs': {
      lines.push(`title: ${sq(String(v.title ?? ''))}`)
      lines.push(`description: ${sq(String(v.description ?? ''))}`)
      lines.push(`publishDate: ${v.publishDate}`)
      lines.push(`week: ${v.week}`)
      if (v.updatedDate) lines.push(`updatedDate: ${v.updatedDate}`)
      const tags = tagsOf()
      if (tags.length > 0) lines.push(`tags: ${inlineArray(domain.key, tags)}`)
      if (v.draft) lines.push('draft: true')
      break
    }
    case 'chatter': {
      lines.push(`title: ${sq(String(v.title ?? ''))}`)
      lines.push(`description: ${sq(String(v.description ?? ''))}`)
      lines.push(`publishDate: ${v.publishDate}`)
      const tags = tagsOf()
      if (tags.length > 0) lines.push(`tags: ${inlineArray(domain.key, tags)}`)
      lines.push(`draft: ${v.draft ? 'true' : 'false'}`)
      break
    }
    case 'treasure': {
      lines.push(`icon: ${v.icon}`)
      lines.push(`rarity: ${v.rarity ?? 'B'}`)
      lines.push(`chest: ${v.chest}`)
      lines.push(`title: ${sq(String(v.title ?? ''))}`)
      lines.push(...renderDesc(String(v.desc ?? '')))
      lines.push(`tags: ${inlineArray(domain.key, tagsOf())}`)
      lines.push(`href: ${v.href == null || v.href === '' ? "''" : sq(String(v.href))}`)
      break
    }
    case 'quest': {
      lines.push(`title: ${sq(String(v.title ?? ''))}`)
      lines.push(...renderDesc(String(v.desc ?? '')))
      lines.push(`type: ${v.type ?? 'side'}`)
      lines.push(`status: ${v.status ?? 'todo'}`)
      lines.push(`diff: ${v.diff ?? 2}`)
      const objectives = (v.objectives as { t: string; done?: boolean }[]) ?? []
      if (objectives.length > 0) {
        lines.push('objectives:')
        for (const o of objectives) {
          lines.push(`  - { t: ${sq(String(o.t))}, done: ${o.done ? 'true' : 'false'} }`)
        }
      }
      lines.push(`exp: ${v.exp ?? 0}`)
      lines.push(`gold: ${v.gold ?? 0}`)
      break
    }
    default:
      throw new Error(`renderLines: 非集合域 ${domain.key}`)
  }

  if (ctx.fmHeader) lines.unshift(ctx.fmHeader)
  return lines.join('\n')
}

/** 集合域：D1 行（API 形态）→ md 文件全文（逐字节可回放） */
export function renderCollectionFile(domain: DomainDef, ctx: RenderCtx): string {
  const fm = renderLines(domain, ctx)
  const tail = ctx.bodyMd == null ? '' : `\n${ctx.bodyMd}`
  return `---\n${fm}\n---${tail}`
}

/** JSON 域：值 → 整文件（2 空格缩进 + 尾换行，与仓库现存文件一致） */
export function renderJsonFile(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

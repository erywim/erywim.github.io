/**
 * 任务 6.1 验证：对仓库全部集合域 md 文件跑解析 → 重渲染。
 * 判据：
 *   1. 值等价：render 的 frontmatter 数据与原文解析数据 deep-equal，正文逐字节一致
 *   2. 幂等：render(parse(file)) === render(parse(render(parse(file)))) —— 发布循环字节稳定
 *   3. 报告（不判失败）与原文件的排版差异：老风格文件首次发布时归一（值不变）
 * 运行：cd worker && bun scripts/roundtrip.ts
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { getDomain } from '../src/lib/domains'
import { parseMarkdown, renderCollectionFile } from '../src/lib/frontmatter'

const ROOT = join(import.meta.dir, '..', '..')
let pass = 0
let fail = 0
let normalized = 0
const failures: { file: string; why: string }[] = []

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b))
}
function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys)
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .sort(([x], [y]) => (x < y ? -1 : 1))
        .map(([k, val]) => [k, sortKeys(val)])
    )
  }
  return v
}

function check(domainKey: string, fileRel: string) {
  const domain = getDomain(domainKey)!
  const raw = readFileSync(join(ROOT, fileRel), 'utf8')
  const parsed = parseMarkdown(raw)
  if (!parsed) {
    fail += 1
    failures.push({ file: fileRel, why: 'parse failed' })
    return
  }
  const r1 = renderCollectionFile(domain, {
    item: { ...parsed.data },
    bodyMd: parsed.bodyMd,
    fmHeader: parsed.headerText,
  })
  const reparsed = parseMarkdown(r1)
  const r2 = renderCollectionFile(domain, {
    item: { ...reparsed!.data },
    bodyMd: reparsed!.bodyMd,
    fmHeader: reparsed!.headerText,
  })

  const valueOk = deepEqual(parsed.data, reparsed!.data) && parsed.bodyMd === reparsed!.bodyMd
  const idempotent = r1 === r2
  if (valueOk && idempotent) {
    pass += 1
    if (r1 !== raw) normalized += 1
  } else {
    fail += 1
    let i = 0
    while (i < Math.min(r1.length, r2.length) && r1[i] === r2[i]) i += 1
    failures.push({
      file: fileRel,
      why: `${valueOk ? '' : '值不等价 '}${idempotent ? '' : '不幂等 '}r1/r2 diff@${i}`,
    })
  }
}

function walk(domainKey: string, dir: string) {
  const base = join(ROOT, dir)
  for (const name of readdirSync(base)) {
    const full = join(base, name)
    if (statSync(full).isDirectory()) {
      const index = join(full, 'index.md')
      try {
        readFileSync(index)
        check(domainKey, `${dir}/${name}/index.md`)
      } catch {
        /* 非文章目录 */
      }
    } else if (name.endsWith('.md')) {
      check(domainKey, `${dir}/${name}`)
    }
  }
}

walk('blog', 'src/content/blog')
walk('logs', 'src/content/logs')
walk('chatter', 'src/content/chatter')
walk('quest', 'src/content/quest')
walk('treasure', 'src/content/treasure')

console.log(`round-trip: ${pass} 通过, ${fail} 失败（另 ${normalized} 个文件将首次发布时风格归一，值不变）`)
for (const f of failures.slice(0, 8)) console.log(`  ✗ ${f.file}\n    ${f.why}`)
process.exit(fail > 0 ? 1 : 0)

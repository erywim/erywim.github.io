/**
 * /eeeeerywim 后台客户端（规格 admin-ui）。
 * 纯 vanilla TS：登录 → 工作台（九域导航 / 列表 / 编辑器 / 发布 / 同步 / 冲突处理）。
 * 服务端为唯一校验权威，本文件只驱动 UI 并回显字段级错误。
 */

import { marked } from 'marked'
import DOMPurify from 'dompurify'

// 与构建期 remark-gfm 对齐：表格/删除线/任务列表开，硬换行关
marked.setOptions({ gfm: true, breaks: false })

/* —— 域 UI 配置（由页面注入，见 eeeeerywim.astro） —— */
interface FieldUI {
  key: string
  label: string
  input: string
  required?: boolean
  maxLength?: number
  min?: number
  max?: number
  rows?: number
  options?: string[]
  /** 字典类别（GET /admin/dict），优先于 options */
  dict?: string
  mono?: boolean
}
interface DomainUI {
  key: string
  label: string
  fileKind: 'collection' | 'json-array' | 'json-single'
  titleKey: string
  fields: FieldUI[]
}
interface Item {
  id: string
  [key: string]: unknown
}

interface AdminState {
  apiBase: string
  domains: DomainUI[]
  dict: Record<string, { value: string; label: string }[]>
  current: string
  items: Item[]
  editing: { domain: string; id: string | null; conflict: boolean } | null
  loggedIn: boolean
}

const S: AdminState = {
  apiBase: '',
  domains: [],
  dict: {},
  current: '',
  items: [],
  editing: null,
  loggedIn: false,
}

/** 字段可选项：字典优先，options 兜底 */
function fieldOptions(f: FieldUI): { value: string; label: string }[] {
  if (f.dict && S.dict[f.dict]?.length) return S.dict[f.dict]
  return (f.options ?? []).map((v) => ({ value: v, label: v }))
}

const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | ((e: Event) => void)> = {},
  ...children: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') node.addEventListener(k.replace(/^on/, ''), v as (e: Event) => void)
    else if (typeof v === 'boolean') {
      if (v) node.setAttribute(k, '')
    } else node.setAttribute(k, v)
  }
  for (const c of children) if (c != null) node.append(typeof c === 'string' ? document.createTextNode(c) : c)
  return node
}

/* —— API 封装：跨站 Cookie + 401 一律回登录并清 DOM —— */
async function api(path: string, init: RequestInit = {}): Promise<any> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const method = (init.method ?? 'GET').toUpperCase()
  if (init.body || (method !== 'GET' && method !== 'HEAD')) {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(`${S.apiBase}${path}`, { ...init, headers, credentials: 'include' })
  let data: any = null
  try {
    data = await res.json()
  } catch {
    /* 空响应体 */
  }
  if (res.status === 401 && S.loggedIn) {
    toLogin('会话已过期，请重新登录。')
    throw new Error('unauthorized')
  }
  if (!res.ok) {
    const err = new Error(data?.message ?? data?.error ?? `HTTP ${res.status}`) as Error & {
      payload?: any
      status?: number
    }
    err.payload = data
    err.status = res.status
    throw err
  }
  return data
}

/* —— 日志控制台 —— */
function log(line: string, kind: 'info' | 'ok' | 'err' = 'info'): void {
  const box = $('admLog')
  box.hidden = false
  const time = new Date().toTimeString().slice(0, 8)
  const cls = kind === 'ok' ? 'ok' : kind === 'err' ? 'err' : ''
  box.append(el('div', { class: `adm-log-line ${cls}` }, `[${time}] ${line}`))
  box.scrollTop = box.scrollHeight
}

/* —— 登录 / 会话 —— */
function toLogin(message?: string): void {
  S.loggedIn = false
  // 清 DOM，不残留任何已加载的管理数据（规格 admin-ui「会话状态与登出」）
  $('admNav').replaceChildren()
  $('admList').replaceChildren()
  $('admEditor').replaceChildren()
  $('admLog').replaceChildren()
  $('admLog').hidden = true
  $('admApp').hidden = true
  $('admLogin').hidden = false
  const errBox = $('admLoginError')
  if (message) {
    errBox.textContent = message
    errBox.hidden = false
  } else {
    errBox.hidden = true
  }
  ;($('admLoginBtn') as HTMLButtonElement).disabled = false
}

function enterApp(username: string): void {
  S.loggedIn = true
  $('admLogin').hidden = true
  $('admApp').hidden = false
  log(`欢迎回来，${username}。`)
  void (async () => {
    try {
      const d = await api('/admin/dict')
      S.dict = d.categories ?? {}
    } catch (e) {
      log(`字典加载失败（下拉框将退回原始值）：${e instanceof Error ? e.message : e}`, 'err')
    }
    await refreshSummary()
    const first = S.domains[0]?.key ?? ''
    if (first) void selectDomain(first)
  })()
}

/* —— 汇总与导航 —— */
let summaryCache: { domains: Record<string, { total: number; dirty: number; deleted: number }>; dirtyTotal: number } | null =
  null

async function refreshSummary(): Promise<void> {
  summaryCache = await api('/admin/content')
  renderNav()
}

function renderNav(): void {
  const nav = $('admNav')
  nav.replaceChildren()
  for (const d of S.domains) {
    const stat = summaryCache?.domains[d.key]
    const dirtyN = (stat?.dirty ?? 0) + (stat?.deleted ?? 0)
    const btn = el(
      'button',
      {
        class: `adm-nav-btn${d.key === S.current ? ' active' : ''}`,
        type: 'button',
        onclick: () => void selectDomain(d.key)
      },
      d.label,
      stat ? el('span', { class: 'adm-nav-cnt' }, ` ${stat.total}`) : null,
      dirtyN > 0 ? el('span', { class: 'adm-nav-dirty' }, ` ●${dirtyN}`) : null
    )
    nav.append(btn)
  }
  const dirtyTotal = summaryCache?.dirtyTotal ?? 0
  const badge = $('admDirtyCount')
  badge.textContent = `待发布 ${dirtyTotal}`
  badge.hidden = dirtyTotal === 0
  $('admPublishAll').textContent = dirtyTotal > 0 ? `全部发布（${dirtyTotal}）` : '全部发布'

  // 访问统计（非内容域，走独立视图 openStats）
  nav.append(
    el(
      'button',
      {
        class: `adm-nav-btn${S.current === STATS_KEY ? ' active' : ''}`,
        type: 'button',
        onclick: () => void openStats()
      },
      '访问统计'
    )
  )
}

/* —— 列表 —— */
async function selectDomain(key: string): Promise<void> {
  const d = S.domains.find((x) => x.key === key)
  if (!d) return
  S.current = key
  $('admEditor').hidden = true
  const list = $('admList')
  list.hidden = false

  if (d.fileKind === 'json-single') {
    // 单记录域：直接进编辑器
    await openEditor(key, 'default')
    return
  }

  list.replaceChildren(el('div', { class: 'adm-loading' }, '读取中…'))
  renderNav()
  try {
    S.items = (await api(`/admin/content/${key}`)) as Item[]
  } catch (e) {
    list.replaceChildren(errBox(e))
    return
  }

  list.replaceChildren()
  const head = el(
    'div',
    { class: 'adm-list-head' },
    el('span', { class: 'adm-list-title' }, `${d.label} · ${S.items.length}`),
    el(
      'button',
      { class: 'px-refresh', type: 'button', onclick: () => void openEditor(key, null) },
      '＋ 新建'
    )
  )
  list.append(head)

  if (S.items.length === 0) {
    list.append(el('p', { class: 'adm-empty' }, '暂无内容。'))
    return
  }

  const rows = el('div', { class: 'adm-rows' })
  for (const item of S.items) {
    const title = String(item[d.titleKey] ?? item.id)
    const dateKey = item.publishDate ? 'publishDate' : item.date ? 'date' : null
    const meta = [dateKey ? String(item[dateKey]) : null, item.week ? `第${item.week}周` : null]
      .filter(Boolean)
      .join(' · ')
    const badges: Node[] = []
    if (item.deleted) badges.push(el('span', { class: 'adm-badge del' }, '待删除'))
    else if (item.dirty) badges.push(el('span', { class: 'adm-badge dirty' }, '待发布'))
    else badges.push(el('span', { class: 'adm-badge clean' }, '已同步'))
    if (item.draft) badges.push(el('span', { class: 'adm-badge draft' }, '草稿'))

    const row = el(
      'div',
      { class: `adm-row${item.deleted ? ' is-deleted' : ''}` },
      el(
        'div',
        { class: 'adm-row-main', onclick: () => void openEditor(key, String(item.id)) },
        el('div', { class: 'adm-row-title' }, title),
        el('div', { class: 'adm-row-meta' }, meta || `id: ${item.id}`)
      ),
      el('div', { class: 'adm-row-badges' }, ...badges),
      el(
        'div',
        { class: 'adm-row-actions' },
        !item.repoSha
          ? null
          : el(
              'button',
              { class: 'px-refresh', type: 'button', onclick: () => void publishOne(key, String(item.id)) },
              '发布'
            ),
        item.deleted
          ? el(
              'button',
              {
                class: 'px-refresh',
                type: 'button',
                onclick: () => void restoreItem(key, String(item.id))
              },
              '恢复'
            )
          : el(
              'button',
              {
                class: 'px-refresh danger',
                type: 'button',
                onclick: () => void deleteItem(key, String(item.id), String(item[d.titleKey] ?? item.id))
              },
              '删除'
            )
      )
    )
    rows.append(row)
  }
  list.append(rows)
}

function errBox(e: unknown): HTMLElement {
  return el('div', { class: 'adm-error' }, e instanceof Error ? e.message : String(e))
}

/* —— 访问统计（/admin/stats，非内容域：日期范围 + 概览 + 趋势 + 排行 + 流水） —— */
const STATS_KEY = '__stats__'
/** 默认范围：近 30 天（含今天）；快捷键「全部」看全量 */
const vaRange = { from: bjDay(29), to: bjDay() }
/** 流水翻页游标：本页最小 id（0 = 无更多） */
let vaFlowOldest = 0

interface VaDaily {
  day: string
  pv: number
  uv: number
}
interface VaIp {
  ip: string
  hits: number
  paths: number
  first_at: string
  last_at: string
  country: string | null
}
interface VaPath {
  path: string
  pv: number
  uv: number
}
interface VaVisit {
  id: number
  ip: string
  path: string
  user_agent: string | null
  referer: string | null
  country: string | null
  visited_at: string
}
interface VaStats {
  overview: { range: { pv: number; uv: number }; today: { pv: number; uv: number } }
  daily: VaDaily[]
  topIps: VaIp[]
  topPaths: VaPath[]
  recent: VaVisit[]
}

/** 北京时间（站点口径）的今天 / N 天前，YYYY-MM-DD */
function bjDay(offsetDays = 0): string {
  return new Date(Date.now() + (8 * 3600 - offsetDays * 86400) * 1000).toISOString().slice(0, 10)
}
/** 库内 UTC 文本 → 北京时间 MM-DD HH:MM */
function bjTime(utc: string): string {
  return new Date(Date.parse(`${utc.slice(0, 19).replace(' ', 'T')}Z`) + 8 * 3600 * 1000)
    .toISOString()
    .slice(5, 16)
    .replace('T', ' ')
}
/** ISO 国家代码 → 中文名（CF-IPCountry；解析失败回退原码） */
function regionName(code: string | null): string {
  if (!code) return ''
  try {
    return new Intl.DisplayNames(['zh-CN'], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}
/** UA → 浏览器/客户端简称（展示用，顺序即优先级） */
function uaShort(ua: string | null): string {
  if (!ua) return '—'
  if (/bot|crawl|spider|slurp|bingpreview|lighthouse|headless/i.test(ua)) return '爬虫'
  if (/MicroMessenger/i.test(ua)) return '微信'
  if (/Edg\//.test(ua)) return 'Edge'
  if (/Firefox\//i.test(ua)) return 'Firefox'
  if (/Chrome\//.test(ua)) return 'Chrome'
  if (/Safari\//.test(ua)) return 'Safari'
  if (/curl|wget|python|Go-http|node/i.test(ua)) return '脚本'
  return '其他'
}

function statsParams(before?: number): string {
  const p = new URLSearchParams()
  if (before && before > 0) p.set('before', String(before))
  if (vaRange.from) p.set('from', vaRange.from)
  if (vaRange.to) p.set('to', vaRange.to)
  const s = p.toString()
  return s ? `?${s}` : ''
}

async function openStats(): Promise<void> {
  S.current = STATS_KEY
  $('admEditor').hidden = true
  const list = $('admList')
  list.hidden = false
  renderNav()
  await loadStats()
}

async function loadStats(): Promise<void> {
  const list = $('admList')
  list.replaceChildren(el('div', { class: 'adm-loading' }, '读取中…'))
  try {
    renderStats((await api(`/admin/stats/visits${statsParams()}`)) as VaStats)
  } catch (e) {
    list.replaceChildren(errBox(e))
  }
}

function statsToolbar(): HTMLElement {
  const fromInput = el('input', { type: 'date', value: vaRange.from }) as HTMLInputElement
  const toInput = el('input', { type: 'date', value: vaRange.to }) as HTMLInputElement
  const apply = el('button', {
    class: 'px-refresh',
    type: 'button',
    onclick: () => {
      vaRange.from = fromInput.value
      vaRange.to = toInput.value
      void loadStats()
    }
  }, '查询')
  const quick = (label: string, from: string, to: string) =>
    el('button', {
      class: 'px-refresh',
      type: 'button',
      onclick: () => {
        vaRange.from = from
        vaRange.to = to
        void loadStats()
      }
    }, label)
  return el(
    'div',
    { class: 'adm-va-toolbar' },
    el('span', { class: 'adm-va-toolbar-k' }, '日期'),
    fromInput,
    el('span', { class: 'adm-va-sep' }, '至'),
    toInput,
    apply,
    el('span', { class: 'adm-va-sep' }, '·'),
    quick('今天', bjDay(), bjDay()),
    quick('近 7 天', bjDay(6), bjDay()),
    quick('近 30 天', bjDay(29), bjDay()),
    quick('全部', '', '')
  )
}

function vaCard(label: string, value: number, sub: string): HTMLElement {
  return el(
    'div',
    { class: 'adm-va-card' },
    el('span', { class: 'k' }, label),
    el('span', { class: 'v' }, String(value)),
    el('span', { class: 'sub' }, sub)
  )
}

/** 每日趋势：PV/UV 成对柱（同轴，均为计数）+ 图例 + 悬停读数 + 折叠数据表 */
function vaChartSection(daily: VaDaily[]): HTMLElement {
  const sec = el('div', { class: 'adm-va-sec' })
  const readout = el('span', { class: 'adm-va-readout' })
  sec.append(
    el(
      'div',
      { class: 'adm-va-sec-title' },
      '每日趋势（近 90 天）',
      el(
        'span',
        { class: 'adm-va-legend' },
        el('span', {}, el('i', { class: 'adm-va-dot pv' }), 'PV 次数'),
        el('span', {}, el('i', { class: 'adm-va-dot uv' }), 'UV 人数')
      ),
      readout
    )
  )
  if (daily.length === 0) {
    sec.append(el('p', { class: 'adm-empty' }, '该范围内还没有访问记录。'))
    return sec
  }

  const max = Math.max(...daily.map((x) => x.pv), 1)
  const setReadout = (x: VaDaily) => {
    readout.textContent = `${x.day.slice(5)} · PV ${x.pv} · UV ${x.uv}`
  }
  const chart = el('div', { class: 'adm-va-chart' })
  for (const x of daily) {
    chart.append(
      el(
        'div',
        {
          class: 'adm-va-day',
          title: `${x.day} · PV ${x.pv} · UV ${x.uv}`,
          onmouseenter: () => setReadout(x)
        },
        el('div', { class: 'adm-va-bar pv', style: `height:${Math.max(2, Math.round((x.pv / max) * 100))}%` }),
        el('div', { class: 'adm-va-bar uv', style: `height:${Math.max(2, Math.round((x.uv / max) * 100))}%` })
      )
    )
  }
  setReadout(daily[daily.length - 1])
  sec.append(chart)
  sec.append(
    el('div', { class: 'adm-va-axis' },
      el('span', {}, daily[0].day.slice(5)),
      el('span', {}, daily[daily.length - 1].day.slice(5))
    )
  )

  // 精确读数兜底：折叠的按日数据表
  const table = el('table')
  table.append(
    el('tr', {}, el('th', {}, '日期'), el('th', {}, 'PV'), el('th', {}, 'UV'))
  )
  for (const x of daily) {
    table.append(el('tr', {}, el('td', {}, x.day), el('td', {}, String(x.pv)), el('td', {}, String(x.uv))))
  }
  sec.append(el('details', { class: 'adm-va-table' }, el('summary', {}, '按日数据表'), table))
  return sec
}

function vaRankRow(rank: number, main: HTMLElement, num: string, sub?: string): HTMLElement {
  const row = el(
    'div',
    { class: 'adm-va-row' },
    el('span', { class: 'adm-va-rank' }, String(rank)),
    el('div', { class: 'adm-va-main' }, main)
  )
  if (sub) row.append(el('span', { class: 'adm-va-num' }, num, el('span', { class: 'u' }, ` · ${sub}`)))
  else row.append(el('span', { class: 'adm-va-num' }, num))
  return row
}

function vaSection(title: string, rows: HTMLElement[], emptyText: string): HTMLElement {
  const sec = el('div', { class: 'adm-va-sec' })
  sec.append(el('div', { class: 'adm-va-sec-title' }, title))
  if (rows.length === 0) sec.append(el('p', { class: 'adm-empty' }, emptyText))
  else sec.append(el('div', { class: 'adm-va-rows' }, ...rows))
  return sec
}

function renderStats(d: VaStats): void {
  const list = $('admList')
  list.replaceChildren(statsToolbar())

  const rangeLabel =
    vaRange.from || vaRange.to ? `${vaRange.from || '最初'} ~ ${vaRange.to || '今天'}` : '全部时间'
  list.append(
    el(
      'div',
      { class: 'adm-va-cards' },
      vaCard('浏览量 PV', d.overview.range.pv, rangeLabel),
      vaCard('访客数 UV', d.overview.range.uv, `${rangeLabel} · 按 IP 去重`),
      vaCard('今日 PV', d.overview.today.pv, bjDay()),
      vaCard('今日 UV', d.overview.today.uv, `${bjDay()} · 按 IP 去重`)
    )
  )
  list.append(vaChartSection(d.daily))

  // 热门页面（按访问人数排序）+ 访客排行：双列
  const maxUv = Math.max(...d.topPaths.map((p) => p.uv), 1)
  const pathRows = d.topPaths.map((p, i) =>
    vaRankRow(
      i + 1,
      el(
        'div',
        { class: 'adm-va-path' },
        el('div', { class: 'adm-va-title', title: p.path }, p.path),
        el('div', { class: 'adm-va-meter' }, el('i', { style: `width:${Math.max(2, Math.round((p.uv / maxUv) * 100))}%` }))
      ),
      `${p.uv} 人`,
      `${p.pv} 次`
    )
  )
  const ipRows = d.topIps.map((v, i) =>
    vaRankRow(
      i + 1,
      el(
        'div',
        { class: 'adm-va-path' },
        el(
          'div',
          { class: 'adm-va-title' },
          v.ip,
          v.country ? el('span', { class: 'adm-va-geo' }, ` ${regionName(v.country)}`) : null
        ),
        el(
          'div',
          { class: 'adm-va-meta' },
          `首次 ${v.first_at.slice(0, 10)} · 最近 ${v.last_at.slice(0, 10)} · 看过 ${v.paths} 个页面`
        )
      ),
      `${v.hits} 次`
    )
  )
  list.append(
    el(
      'div',
      { class: 'adm-va-cols' },
      vaSection('热门页面（人数排序）', pathRows, '该范围内还没有页面访问。'),
      vaSection('访客排行（IP）', ipRows, '该范围内还没有访客。')
    )
  )

  // 最新访问流水
  const flow = el('div', { class: 'adm-va-flow', id: 'admVaFlow' })
  appendFlowRows(flow, d.recent)
  const flowSec = el('div', { class: 'adm-va-sec' })
  flowSec.append(el('div', { class: 'adm-va-sec-title' }, '最新访问'))
  if (d.recent.length === 0) {
    flowSec.append(el('p', { class: 'adm-empty' }, '还没有访问记录。'))
  } else {
    flowSec.append(flow)
    vaFlowOldest = d.recent[d.recent.length - 1].id
    if (d.recent.length >= 50) {
      flowSec.append(
        el('button', {
          class: 'px-refresh adm-va-more',
          type: 'button',
          onclick: () => void loadMoreFlow()
        }, '加载更多')
      )
    }
  }
  list.append(flowSec)
}

function appendFlowRows(wrap: HTMLElement, visits: VaVisit[]): void {
  for (const v of visits) {
    wrap.append(
      el(
        'div',
        { class: 'adm-va-flow-row' },
        el('span', { class: 'adm-va-flow-time' }, bjTime(v.visited_at)),
        el('span', { class: 'adm-va-flow-ip' }, v.ip),
        el('span', { class: 'adm-va-flow-path', title: v.path }, v.path),
        el('span', { class: 'adm-va-flow-ua' }, uaShort(v.user_agent)),
        v.country ? el('span', { class: 'adm-va-flow-geo' }, regionName(v.country)) : null
      )
    )
  }
}

async function loadMoreFlow(): Promise<void> {
  if (!vaFlowOldest) return
  const btn = document.querySelector<HTMLButtonElement>('.adm-va-more')
  if (btn) btn.disabled = true
  try {
    const d = (await api(`/admin/stats/visits/recent${statsParams(vaFlowOldest)}`)) as { recent: VaVisit[] }
    const wrap = $('admVaFlow')
    appendFlowRows(wrap, d.recent)
    if (d.recent.length > 0) vaFlowOldest = d.recent[d.recent.length - 1].id
    if (d.recent.length < 50 && btn) {
      btn.textContent = '没有更多了'
      btn.disabled = true
    } else if (btn) {
      btn.disabled = false
    }
  } catch (e) {
    log(`流水加载失败：${e instanceof Error ? e.message : e}`, 'err')
    if (btn) btn.disabled = false
  }
}

/* —— 编辑器 —— */
async function openEditor(domainKey: string, id: string | null): Promise<void> {
  const d = S.domains.find((x) => x.key === domainKey)
  if (!d) return
  const editor = $('admEditor')
  const list = $('admList')
  list.hidden = true
  editor.hidden = false
  editor.replaceChildren(el('div', { class: 'adm-loading' }, '读取中…'))

  let item: Item | null = null
  if (id) {
    try {
      item = (await api(`/admin/content/${domainKey}/${id}`)) as Item
    } catch (e) {
      if ((e as { status?: number }).status === 404 && domainKey === 'hero') {
        item = null // 档案未初始化 → 走新建
      } else {
        editor.replaceChildren(errBox(e))
        return
      }
    }
  }

  // 冲突检测：仓库 sha vs 已知 sha（未发布过的条目跳过）
  let conflict = false
  let conflictMsg = ''
  if (item?.repoSha) {
    try {
      const c = await api(`/admin/publish/conflict/${domainKey}/${id}`)
      conflict = !!c.conflict
      conflictMsg = c.message ?? ''
    } catch {
      /* 检测失败不阻塞编辑，发布时乐观锁兜底 */
    }
  }

  S.editing = { domain: domainKey, id: item ? String(item.id) : null, conflict }
  renderEditor(d, item, conflict, conflictMsg)
}

function renderEditor(d: DomainUI, item: Item | null, conflict: boolean, conflictMsg: string): void {
  const editor = $('admEditor')
  editor.replaceChildren()

  const isCreate = !item
  const head = el(
    'div',
    { class: 'adm-edit-head' },
    el(
      'button',
      { class: 'px-refresh', type: 'button', onclick: () => void selectDomain(S.current) },
      '← 返回'
    ),
    el('span', { class: 'adm-edit-title' }, `${isCreate ? '新建' : '编辑'} · ${d.label}`),
    isCreate || d.fileKind === 'json-single'
      ? null
      : el(
          'button',
          {
            class: 'px-refresh',
            type: 'button',
            onclick: () => void publishOne(d.key, String(item!.id))
          },
          '发布'
        )
  )
  editor.append(head)

  const form = el('form', { class: 'adm-form', id: 'admForm' }) as HTMLFormElement

  // 冲突横幅（新建不填 id：worker 按域自动生成——英文题名 slug / 日期兜底，见 worker genUniqueId）
  if (conflict) {
    const banner = el(
      'div',
      { class: 'adm-conflict' },
      el('div', { class: 'adm-conflict-msg' }, `⚠ ${conflictMsg || '仓库文件有后台之外的修改。'}`),
      el('div', { class: 'adm-conflict-actions' },
        el('button', {
          class: 'px-refresh',
          type: 'button',
          onclick: async () => {
            try {
              await api(`/admin/publish/sync-item/${d.key}/${String(item!.id)}`, { method: 'POST' })
              log('已拉取仓库版本覆盖本地。', 'ok')
              await openEditor(d.key, String(item!.id))
            } catch (e) {
              log(`拉取失败：${e instanceof Error ? e.message : e}`, 'err')
            }
          }
        }, '拉取仓库覆盖本地'),
        el('button', {
          class: 'px-refresh danger',
          type: 'button',
          onclick: async () => {
            try {
              await api(`/admin/publish/${d.key}/${String(item!.id)}?force=1`, { method: 'POST' })
              log('已强制发布覆盖仓库。', 'ok')
              await refreshSummary()
              await openEditor(d.key, String(item!.id))
            } catch (e) {
              log(`强制发布失败：${e instanceof Error ? e.message : e}`, 'err')
            }
          }
        }, '强制发布覆盖仓库')
      )
    )
    form.append(banner)
  }

  // 字段
  for (const f of d.fields) {
    const value = item ? item[f.key] : undefined
    form.append(fieldBlock(f, value, item))
  }

  // 底部操作
  const actions = el(
    'div',
    { class: 'adm-form-actions' },
    el(
      'button',
      { class: 'px-refresh adm-save', type: 'submit', disabled: conflict },
      conflict ? '处理冲突后可保存' : '保存'
    )
  )
  form.append(actions)
  form.addEventListener('submit', (ev) => {
    ev.preventDefault()
    if (S.editing?.conflict) return
    void saveItem(d, item)
  })
  editor.append(form)
}

/** bodyMd 字段：编辑 ⇄ 预览切换。预览容器复用 .scroll.read-body（与线上文章页同一套排版，所见即所得）；
 *  marked 渲染 + DOMPurify 过滤（仓库同步回来的内容也过一道，防预览即执行） */
function mdEditorBox(ta: HTMLTextAreaElement): HTMLElement {
  const taWrap = el('div', { class: 'adm-md-edit' }, ta)
  const preview = el('div', { class: 'adm-md-preview scroll read-body' })
  preview.hidden = true

  const btnEdit = el('button', { class: 'px-refresh adm-md-btn active', type: 'button' }, '编辑')
  const btnPreview = el('button', { class: 'px-refresh adm-md-btn', type: 'button' }, '预览')
  const show = (previewMode: boolean) => {
    btnEdit.classList.toggle('active', !previewMode)
    btnPreview.classList.toggle('active', previewMode)
    taWrap.hidden = previewMode
    if (previewMode) {
      preview.innerHTML = DOMPurify.sanitize(marked.parse(ta.value) as string)
      preview.hidden = false
    } else {
      preview.hidden = true
      preview.replaceChildren() // 清掉渲染 DOM，编辑器不背常驻大节点
    }
  }
  btnEdit.addEventListener('click', () => show(false))
  btnPreview.addEventListener('click', () => show(true))

  return el('div', { class: 'adm-md' }, el('div', { class: 'adm-md-bar' }, btnEdit, btnPreview), taWrap, preview)
}

function fieldWrap(key: string, label: string, control: HTMLElement, hint?: string): HTMLElement {
  const wrap = el('div', { class: 'adm-field', 'data-field': key })
  wrap.append(el('label', { class: 'k' }, label))
  wrap.append(control)
  if (hint) wrap.append(el('div', { class: 'adm-field-hint' }, hint))
  wrap.append(el('div', { class: 'adm-field-err', hidden: true }))
  return wrap
}

function fieldBlock(f: FieldUI, value: unknown, item: Item | null): HTMLElement {
  const label = f.required ? `${f.label} *` : f.label

  switch (f.input) {
    case 'text': {
      const input = el('input', {
        type: 'text',
        name: f.key,
        value: value == null ? '' : String(value)
      }) as HTMLInputElement
      if (f.maxLength) input.maxLength = f.maxLength
      return fieldWrap(f.key, label, input)
    }
    case 'number': {
      const input = el('input', {
        type: 'number',
        name: f.key,
        value: value == null ? '' : String(value)
      }) as HTMLInputElement
      if (f.min !== undefined) input.min = String(f.min)
      if (f.max !== undefined) input.max = String(f.max)
      return fieldWrap(f.key, label, input)
    }
    case 'date': {
      const input = el('input', {
        type: 'date',
        name: f.key,
        value: value == null ? '' : String(value).slice(0, 10)
      })
      return fieldWrap(f.key, label, input)
    }
    case 'checkbox': {
      const box = el('input', { type: 'checkbox', name: f.key }) as HTMLInputElement
      box.checked = value === true || value === undefined && (f.key === 'comment' && !!item)
      const wrap = el('label', { class: 'adm-field adm-check', 'data-field': f.key })
      wrap.append(box, el('span', { class: 'k' }, label))
      wrap.append(el('div', { class: 'adm-field-err', hidden: true }))
      return wrap
    }
    case 'select': {
      const sel = el('select', { name: f.key, class: 'adm-select' }) as HTMLSelectElement
      const current = value == null ? '' : String(value)
      const opts = [...fieldOptions(f)]
      if (current && !opts.some((o) => o.value === current)) opts.unshift({ value: current, label: `${current}（未知值）` })
      if (!f.required && !opts.some((o) => o.value === '')) opts.unshift({ value: '', label: '（未设置）' })
      for (const opt of opts) {
        const o = el('option', { value: opt.value }, opt.label) as HTMLOptionElement
        if (opt.value === current || (!current && opt.value === '')) o.selected = true
        sel.append(o)
      }
      return fieldWrap(f.key, label, sel)
    }
    case 'textarea':
    case 'json': {
      const text = f.input === 'json'
        ? value == null ? '' : JSON.stringify(value, null, 2)
        : value == null ? '' : String(value)
      const ta = el('textarea', { name: f.key, class: f.mono || f.input === 'json' ? 'mono' : '' }) as HTMLTextAreaElement
      ta.value = text
      if (f.rows) ta.rows = f.rows
      if (f.maxLength) ta.maxLength = f.maxLength
      // md 正文：加大编辑框 + 编辑/预览切换
      if (f.input === 'textarea' && f.key === 'bodyMd') {
        return fieldWrap(f.key, label, mdEditorBox(ta))
      }
      return fieldWrap(f.key, label, ta, f.input === 'json' ? 'JSON 格式，保存时会校验' : undefined)
    }
    case 'tags': {
      const arr = Array.isArray(value) ? (value as string[]) : []
      const input = el('input', { type: 'text', name: f.key, value: arr.join(', ') }) as HTMLInputElement
      return fieldWrap(f.key, label, input)
    }
    case 'tags-enum': {
      const arr = Array.isArray(value) ? (value as string[]) : []
      const box = el('div', { class: 'adm-chips' })
      const chipList = el('div', { class: 'adm-chip-list' })
      const optsAll = fieldOptions(f)
      const labelOf = (v: string) => optsAll.find((o) => o.value === v)?.label ?? v

      const picker = el('select', { class: 'adm-select adm-chip-add' }) as HTMLSelectElement
      const rebuildPicker = () => {
        picker.replaceChildren(el('option', { value: '' }, '＋ 选择标签…'))
        for (const o of optsAll) {
          if (!arr.includes(o.value)) picker.append(el('option', { value: o.value }, o.label))
        }
      }

      const renderChips = () => {
        chipList.replaceChildren()
        for (const v of arr) {
          const chip = el('span', { class: 'adm-chip' })
          chip.append(document.createTextNode(labelOf(v)))
          const x = el('button', { class: 'adm-chip-x', type: 'button', 'aria-label': `移除 ${labelOf(v)}` }, '×')
          x.addEventListener('click', () => {
            const i = arr.indexOf(v)
            if (i >= 0) arr.splice(i, 1)
            rebuildPicker()
            renderChips()
          })
          chip.append(x)
          chipList.append(chip)
        }
        box.dataset.values = JSON.stringify(arr)
      }

      picker.addEventListener('change', () => {
        const v = picker.value
        if (v && !arr.includes(v)) arr.push(v)
        picker.value = ''
        rebuildPicker()
        renderChips()
      })

      rebuildPicker()
      renderChips()
      box.append(chipList, picker)

      const wrap = el('div', { class: 'adm-field', 'data-field': f.key })
      wrap.append(el('label', { class: 'k' }, label), box, el('div', { class: 'adm-field-err', hidden: true }))
      return wrap
    }
    case 'objectives': {
      const box = el('div', { class: 'adm-objectives', 'data-field': f.key })
      const list = el('div', { class: 'adm-objectives-list' })
      const arr = Array.isArray(value) ? (value as { t: string; done?: boolean }[]) : []
      const addRow = (t = '', done = false) => {
        const row = el('div', { class: 'adm-obj-row' })
        const cb = el('input', { type: 'checkbox' }) as HTMLInputElement
        cb.checked = done
        const input = el('input', { type: 'text', value: t, placeholder: '目标内容' }) as HTMLInputElement
        const del = el('button', { class: 'px-refresh danger', type: 'button' }, '删')
        del.addEventListener('click', () => row.remove())
        row.append(cb, input, del)
        list.append(row)
      }
      for (const o of arr) addRow(o.t, !!o.done)
      if (arr.length === 0) addRow()
      box.append(list)
      box.append(
        el('button', { class: 'px-refresh', type: 'button', onclick: () => addRow() }, '＋ 添加目标')
      )
      const wrap = el('div', { class: 'adm-field', 'data-field': f.key })
      wrap.append(el('label', { class: 'k' }, label), box, el('div', { class: 'adm-field-err', hidden: true }))
      return wrap
    }
    case 'stats': {
      const stats = (value ?? {}) as Record<string, { value: number; max: number }>
      const box = el('div', { class: 'adm-stats', 'data-field': f.key })
      for (const k of ['hp', 'mp', 'exp']) {
        const cell = stats[k] ?? { value: 0, max: 100 }
        const group = el('div', { class: 'adm-stats-cell' })
        group.append(el('span', { class: 'k' }, k.toUpperCase()))
        const v = el('input', { type: 'number', 'data-adm-stat': `${k}.value`, value: String(cell.value) }) as HTMLInputElement
        const m = el('input', { type: 'number', 'data-adm-stat': `${k}.max`, value: String(cell.max) }) as HTMLInputElement
        v.min = m.min = '0'
        group.append(v, el('span', { class: 'adm-stats-slash' }, '/'), m)
        box.append(group)
      }
      const wrap = el('div', { class: 'adm-field', 'data-field': f.key })
      wrap.append(el('label', { class: 'k' }, label), box, el('div', { class: 'adm-field-err', hidden: true }))
      return wrap
    }
    case 'upload-image': {
      const box = el('div', { class: 'adm-upload', 'data-field': f.key })
      const img = (value ?? null) as { src?: string; alt?: string } | null
      const cur = el('div', { class: 'adm-upload-cur' }, img?.src ? `当前：${img.src}` : '未设置头图')
      const file = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp' }) as HTMLInputElement
      const btn = el('button', { class: 'px-refresh', type: 'button' }, '上传到仓库')
      const clear = el('button', { class: 'px-refresh danger', type: 'button' }, '清除')
      const status = el('span', { class: 'adm-upload-status' }, '')
      btn.addEventListener('click', async () => {
        const f2 = file.files?.[0]
        if (!f2) {
          status.textContent = '请先选择文件（≤2MB）'
          return
        }
        btn.disabled = true
        status.textContent = '上传中…'
        try {
          const fd = new FormData()
          fd.append('file', f2)
          const res = await fetch(`${S.apiBase}/admin/upload`, {
            method: 'POST',
            headers: { 'X-Admin-Upload': '1' },
            body: fd,
            credentials: 'include'
          })
          const data = await res.json()
          if (res.status === 401 && S.loggedIn) return toLogin('会话已过期，请重新登录。')
          if (!res.ok) throw new Error(data?.message ?? '上传失败')
          // 仓库绝对路径 → 相对 md 文件的路径（blog：src/content/blog/<id>/index.md 下三层）
          const rel = `../../../${String(data.path).replace(/^src\//, '')}`
          file.dataset.result = JSON.stringify({ src: rel, alt: img?.alt ?? '' })
          cur.textContent = `已上传：${rel}（保存后生效）`
          status.textContent = ''
          log(`图片已提交：${data.path}${data.deduplicated ? '（内容相同，复用既有文件）' : ''}`, 'ok')
        } catch (e) {
          status.textContent = e instanceof Error ? e.message : '上传失败'
        } finally {
          btn.disabled = false
        }
      })
      clear.addEventListener('click', () => {
        file.dataset.result = ''
        cur.textContent = '未设置头图'
      })
      box.append(cur, el('div', { class: 'adm-upload-row' }, file, btn, clear, status))
      const wrap = el('div', { class: 'adm-field', 'data-field': f.key })
      wrap.append(el('label', { class: 'k' }, label), box, el('div', { class: 'adm-field-err', hidden: true }))
      return wrap
    }
    default:
      return fieldWrap(f.key, label, el('input', { type: 'text', name: f.key, value: '' }))
  }
}

function showFieldErrors(form: HTMLFormElement, errors: Record<string, string>): void {
  form.querySelectorAll<HTMLElement>('.adm-field-err').forEach((n) => (n.hidden = true))
  for (const [key, msg] of Object.entries(errors)) {
    const wrap = form.querySelector(`[data-field="${key}"]`)
    const errEl = wrap?.querySelector<HTMLElement>('.adm-field-err')
    if (errEl) {
      errEl.textContent = msg
      errEl.hidden = false
    } else {
      log(`${key}: ${msg}`, 'err')
    }
  }
}

async function saveItem(d: DomainUI, existing: Item | null): Promise<void> {
  const form = $('admForm') as HTMLFormElement
  const body: Record<string, unknown> = {}

  for (const f of d.fields) {
    const wrap = form.querySelector(`[data-field="${f.key}"]`)
    if (!wrap) continue
    switch (f.input) {
      case 'checkbox': {
        const input = wrap.querySelector('input') as HTMLInputElement
        body[f.key] = input.checked
        break
      }
      case 'select': {
        const sel = wrap.querySelector('select') as HTMLSelectElement
        body[f.key] = sel.value
        break
      }
      case 'number':
      case 'date':
      case 'text': {
        const input = wrap.querySelector('input') as HTMLInputElement
        if (input.value !== '') body[f.key] = f.input === 'number' ? Number(input.value) : input.value
        break
      }
      case 'textarea': {
        const ta = wrap.querySelector('textarea') as HTMLTextAreaElement
        body[f.key] = ta.value
        break
      }
      case 'json': {
        const ta = wrap.querySelector('textarea') as HTMLTextAreaElement
        if (ta.value.trim() === '') {
          body[f.key] = f.key === 'stats' ? {} : f.key === 'heroImage' ? null : []
        } else {
          try {
            body[f.key] = JSON.parse(ta.value)
          } catch {
            showFieldErrors(form, { [f.key]: 'JSON 格式不正确' })
            return
          }
        }
        break
      }
      case 'tags': {
        const input = wrap.querySelector('input') as HTMLInputElement
        body[f.key] = input.value
          .split(/[,，]/)
          .map((s) => s.trim())
          .filter(Boolean)
        break
      }
      case 'tags-enum': {
        try {
          body[f.key] = JSON.parse((wrap.querySelector('.adm-chips') as HTMLElement | null)?.dataset.values ?? '[]')
        } catch {
          body[f.key] = []
        }
        break
      }
      case 'objectives': {
        const rows = wrap.querySelectorAll('.adm-obj-row')
        const objectives: { t: string; done: boolean }[] = []
        rows.forEach((row) => {
          const cb = row.querySelector('input[type=checkbox]') as HTMLInputElement
          const input = row.querySelector('input[type=text]') as HTMLInputElement
          if (input.value.trim()) objectives.push({ t: input.value.trim(), done: cb.checked })
        })
        body[f.key] = objectives
        break
      }
      case 'stats': {
        const stats: Record<string, { value: number; max: number }> = {}
        for (const k of ['hp', 'mp', 'exp']) {
          const v = wrap.querySelector(`[data-adm-stat="${k}.value"]`) as HTMLInputElement
          const m = wrap.querySelector(`[data-adm-stat="${k}.max"]`) as HTMLInputElement
          stats[k] = { value: Number(v.value || 0), max: Number(m.value || 100) }
        }
        body[f.key] = stats
        break
      }
      case 'upload-image': {
        const file = wrap.querySelector('input[type=file]') as HTMLInputElement
        if (file.dataset.result === '') {
          body[f.key] = null
        } else if (file.dataset.result) {
          body[f.key] = JSON.parse(file.dataset.result)
        } else if (existing) {
          body[f.key] = (existing[f.key] as unknown) ?? null
        }
        break
      }
    }
  }

  try {
    if (existing) {
      await api(`/admin/content/${d.key}/${existing.id}`, { method: 'PUT', body: JSON.stringify(body) })
      log(`已保存：${String(existing[d.titleKey] ?? existing.id)}`, 'ok')
    } else {
      const created = await api(`/admin/content/${d.key}`, { method: 'POST', body: JSON.stringify(body) })
      log(`已创建：${String(created[d.titleKey] ?? created.id)}`, 'ok')
      S.editing = { domain: d.key, id: String(created.id), conflict: false }
    }
    await refreshSummary()
    await selectDomain(S.current)
    if (d.fileKind === 'json-single') await openEditor(d.key, 'default')
  } catch (e) {
    const payload = (e as { payload?: { fields?: Record<string, string> } }).payload
    if (payload?.fields) {
      showFieldErrors(form, payload.fields)
      log('保存失败：字段校验未通过。', 'err')
    } else {
      log(`保存失败：${e instanceof Error ? e.message : e}`, 'err')
    }
  }
}

/* —— 删除 / 恢复 / 发布 —— */
async function deleteItem(domainKey: string, id: string, title: string): Promise<void> {
  if (!window.confirm(`软删除「${title}」？发布后才会从仓库移除。`)) return
  try {
    await api(`/admin/content/${domainKey}/${id}`, { method: 'DELETE' })
    log(`已标记删除：${title}（发布时生效）`, 'ok')
    await refreshSummary()
    await selectDomain(S.current)
  } catch (e) {
    log(`删除失败：${e instanceof Error ? e.message : e}`, 'err')
  }
}

async function restoreItem(domainKey: string, id: string): Promise<void> {
  try {
    await api(`/admin/content/${domainKey}/${id}/restore`, { method: 'POST' })
    log('已恢复（内容如有改动需重新发布）。', 'ok')
    await refreshSummary()
    await selectDomain(S.current)
  } catch (e) {
    log(`恢复失败：${e instanceof Error ? e.message : e}`, 'err')
  }
}

async function publishOne(domainKey: string, id: string, force = false): Promise<void> {
  try {
    const r = await api(`/admin/publish/${domainKey}/${id}${force ? '?force=1' : ''}`, { method: 'POST' })
    const label = r.result.action === 'delete' ? '删除已提交' : r.result.action === 'create' ? '新文件已提交' : '已更新'
    log(`发布 ${label}：${r.result.commitPath}`, 'ok')
    await refreshSummary()
    await selectDomain(S.current)
    if (S.editing && S.editing.domain === domainKey && S.editing.id === id) {
      S.editing.conflict = false
      if (S.domains.find((x) => x.key === domainKey)?.fileKind === 'json-single') {
        await openEditor(domainKey, id)
      }
    }
  } catch (e) {
    const payload = (e as { payload?: { kind?: string } }).payload
    if (payload?.kind === 'conflict') {
      log(`发布冲突：${e instanceof Error ? e.message : e}（打开条目处理冲突）`, 'err')
      await openEditor(domainKey, id)
    } else {
      log(`发布失败：${e instanceof Error ? e.message : e}`, 'err')
    }
  }
}

/* —— 全部发布 / 同步 —— */
async function publishAllAction(): Promise<void> {
  const btn = $('admPublishAll') as HTMLButtonElement
  btn.disabled = true
  btn.textContent = '发布中…'
  try {
    const { report } = await api('/admin/publish/all', { method: 'POST' })
    for (const p of report.published) log(`✓ 已发布 ${p.domain}/${p.id} → ${p.commitPath}`, 'ok')
    for (const f of report.failed) log(`✗ 失败 ${f.domain}/${f.id}：${f.error}`, 'err')
    for (const s of report.skipped) log(`– 未执行 ${s.domain}/${s.id}（前序失败）`)
    const n = report.published.length
    log(report.failed.length === 0 ? `全部发布完成（${n} 项），CI 构建已触发。` : `发布中断：成功 ${n}，失败 1，余 ${report.skipped.length} 项未执行。`, report.failed.length === 0 ? 'ok' : 'err')
    await refreshSummary()
    await selectDomain(S.current)
  } catch (e) {
    log(`全部发布失败：${e instanceof Error ? e.message : e}`, 'err')
  } finally {
    btn.disabled = false
    await refreshSummary()
  }
}

async function syncAllAction(): Promise<void> {
  const btn = $('admSync') as HTMLButtonElement
  btn.disabled = true
  btn.textContent = '同步中…'
  try {
    const { report } = await api('/admin/publish/sync', { method: 'POST' })
    const parts = Object.entries(report).map(([k, v]) => `${k}:${(v as { imported: number }).imported}`)
    log(`同步完成（仓库 → 工作区）。导入：${parts.join(' · ')}`, 'ok')
    await refreshSummary()
    await selectDomain(S.current)
  } catch (e) {
    log(`同步失败：${e instanceof Error ? e.message : e}`, 'err')
  } finally {
    btn.disabled = false
    btn.textContent = '从仓库同步'
  }
}

/* —— 启动 —— */
function boot(): void {
  const root = document.querySelector<HTMLElement>('[data-admin]')
  if (!root) return
  S.apiBase = root.dataset.apiBase?.trim() ?? ''
  try {
    S.domains = JSON.parse(root.dataset.domains ?? '[]') as DomainUI[]
  } catch {
    S.domains = []
  }

  $('admLoginForm').addEventListener('submit', async (ev) => {
    ev.preventDefault()
    const form = ev.currentTarget as HTMLFormElement
    const btn = $('admLoginBtn') as HTMLButtonElement
    const errBox = $('admLoginError')
    btn.disabled = true
    errBox.hidden = true
    try {
      const fd = new FormData(form)
      const res = await fetch(`${S.apiBase}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: String(fd.get('username') ?? ''), password: String(fd.get('password') ?? '') })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message ?? '登录失败。')
      form.reset()
      enterApp(data.username)
    } catch (e) {
      errBox.textContent = e instanceof Error ? e.message : '登录失败。'
      errBox.hidden = false
      btn.disabled = false
    }
  })

  $('admLogout').addEventListener('click', async () => {
    try {
      await api('/admin/logout', { method: 'POST' })
    } catch {
      /* 会话失效也照常回登录 */
    }
    toLogin('已登出。')
  })
  $('admPublishAll').addEventListener('click', () => void publishAllAction())
  $('admSync').addEventListener('click', () => void syncAllAction())

  // 会话保持（浏览器会话级）：浏览器开着期间免重复登录；关闭浏览器 Cookie 即失效
  toLogin()
  void (async () => {
    try {
      const me = await api('/admin/me')
      enterApp(me.username)
    } catch {
      /* 浏览器会话已结束（或未登录），停在登录屏 */
    }
  })()
}

document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot()

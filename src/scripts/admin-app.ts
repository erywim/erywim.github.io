/**
 * /eeeeerywim 后台客户端（规格 admin-ui）。
 * 纯 vanilla TS：登录 → 工作台（九域导航 / 列表 / 编辑器 / 发布 / 同步 / 冲突处理）。
 * 服务端为唯一校验权威，本文件只驱动 UI 并回显字段级错误。
 */

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

  // id / 冲突横幅
  if (isCreate && d.key !== 'hero') {
    form.append(
      fieldWrap(
        'id',
        '标识 slug（小写字母/数字/连字符，即文件名）',
        el('input', { type: 'text', name: '__id', value: '', required: true, pattern: '[a-z0-9][a-z0-9-]{1,80}' })
      )
    )
  }
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

  const idInput = form.querySelector<HTMLInputElement>('input[name="__id"]')
  if (idInput) body.id = idInput.value.trim()

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
      if (d.key === 'hero') delete body.id
      const created = await api(`/admin/content/${d.key}`, { method: 'POST', body: JSON.stringify(body) })
      log(`已创建：${String(created.id)}`, 'ok')
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

  // 登录前零管理请求：先展示登录屏，me 探测只用于「已登录」免输场景
  toLogin()
  void (async () => {
    try {
      const me = await api('/admin/me')
      enterApp(me.username)
    } catch {
      /* 未登录，停在登录屏 */
    }
  })()
}

document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot()

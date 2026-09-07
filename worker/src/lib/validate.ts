/**
 * 域校验（任务 5.1/5.2）：把请求体按 DomainDef 规则校验并归一化。
 * 返回 D1 列名 → 存储值 的映射（json 列 stringify、bool 列 0/1、日期归一 YYYY-MM-DD）。
 */

import type { DomainDef, FieldDef } from './domains'

export interface ValidationResult {
  ok: boolean
  /** 字段级错误：API 字段名 → 中文错误信息 */
  errors: Record<string, string>
  /** D1 列名 → 存储值 */
  values: Record<string, string | number | null>
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function fail(errors: Record<string, string>, key: string, message: string): false {
  errors[key] = message
  return false
}

function checkScalar(field: FieldDef, raw: unknown, errors: Record<string, string>): boolean {
  const { key, type } = field

  if (raw === undefined || raw === null || raw === '') {
    if (field.required) return fail(errors, key, '此项为必填')
    return true
  }

  switch (type) {
    case 'string':
    case 'text': {
      if (typeof raw !== 'string') return fail(errors, key, '必须是字符串')
      if (field.maxLength && raw.length > field.maxLength)
        return fail(errors, key, `长度不能超过 ${field.maxLength}`)
      return true
    }
    case 'int': {
      const n = typeof raw === 'number' ? raw : Number(raw)
      if (!Number.isInteger(n)) return fail(errors, key, '必须是整数')
      if (field.min !== undefined && n < field.min) return fail(errors, key, `不能小于 ${field.min}`)
      if (field.max !== undefined && n > field.max) return fail(errors, key, `不能大于 ${field.max}`)
      return true
    }
    case 'bool':
      if (typeof raw !== 'boolean') return fail(errors, key, '必须是布尔值')
      return true
    case 'date':
      if (typeof raw !== 'string' || !DATE_RE.test(raw.slice(0, 10)))
        return fail(errors, key, '日期格式应为 YYYY-MM-DD')
      return true
    default:
      return true
  }
}

function checkJson(field: FieldDef, raw: unknown, errors: Record<string, string>): boolean {
  const { key, shape } = field
  if (raw === undefined || raw === null) {
    if (field.required) return fail(errors, key, '此项为必填')
    return true
  }
  const err = (m: string) => fail(errors, key, m)

  if (shape === 'strings' || shape === undefined) {
    if (shape === 'strings') {
      if (!Array.isArray(raw)) return err('必须是数组')
      for (const item of raw) {
        if (typeof item !== 'string') return err('数组元素必须是字符串')
        if (field.itemsEnum && !field.itemsEnum.includes(item))
          return err(`含不可用值：${item}`)
      }
      return true
    }
    return true // 任意 json（hero_image 等），形状宽松
  }

  if (!Array.isArray(raw)) return err('必须是数组')

  switch (shape) {
    case 'objectives':
      for (const o of raw) {
        if (typeof o !== 'object' || o === null) return err('目标项必须是对象')
        const obj = o as Record<string, unknown>
        if (typeof obj.t !== 'string' || !obj.t) return err('目标项缺少 t（内容）')
        if (obj.done !== undefined && typeof obj.done !== 'boolean') return err('目标 done 必须是布尔值')
      }
      return true
    case 'skills':
      for (const s of raw) {
        if (typeof s !== 'object' || s === null) return err('技能项必须是对象')
        const obj = s as Record<string, unknown>
        if (typeof obj.title !== 'string' || !obj.title) return err('技能项缺少 title')
        if (!Array.isArray(obj.chips) || obj.chips.some((c) => typeof c !== 'string'))
          return err('技能 chips 必须是字符串数组')
      }
      return true
    case 'heroTimeline':
      for (const t of raw) {
        if (typeof t !== 'object' || t === null) return err('历程项必须是对象')
        const obj = t as Record<string, unknown>
        if (typeof obj.date !== 'string' || typeof obj.title !== 'string' || typeof obj.desc !== 'string')
          return err('历程项需含 date/title/desc')
      }
      return true
    case 'buffs':
      for (const b of raw) {
        if (typeof b !== 'object' || b === null) return err('增益项必须是对象')
        const obj = b as Record<string, unknown>
        if (!['coffee', 'moon', 'wrench'].includes(String(obj.icon))) return err('增益 icon 不在可选值内')
        if (!['good', 'bad', 'doing'].includes(String(obj.kind))) return err('增益 kind 不在可选值内')
        const w = Number(obj.width)
        if (!Number.isFinite(w) || w < 0 || w > 100) return err('增益 width 需在 0~100')
        if (typeof obj.name !== 'string' || typeof obj.val !== 'string') return err('增益项需含 name/val')
      }
      return true
    case 'contacts':
      for (const c of raw) {
        if (typeof c !== 'object' || c === null) return err('联系方式必须是对象')
        const obj = c as Record<string, unknown>
        if (!['github', 'mail', 'rss', 'mug'].includes(String(obj.icon))) return err('联系方式 icon 不在可选值内')
        if (typeof obj.label !== 'string' || typeof obj.value !== 'string' || typeof obj.href !== 'string')
          return err('联系方式需含 label/value/href')
      }
      return true
    default:
      return true
  }
}

function checkStats(raw: unknown, errors: Record<string, string>): boolean {
  if (typeof raw !== 'object' || raw === null) {
    errors.stats = 'stats 必须是对象'
    return false
  }
  const stats = raw as Record<string, unknown>
  for (const k of ['hp', 'mp', 'exp']) {
    const cell = stats[k] as Record<string, unknown> | undefined
    if (!cell || typeof cell !== 'object') {
      errors.stats = `stats.${k} 需为 { value, max }`
      return false
    }
    const v = Number(cell.value)
    const m = Number(cell.max)
    if (!Number.isInteger(v) || !Number.isInteger(m) || v < 0 || m < 1 || v > m) {
      errors.stats = `stats.${k}.value/max 数值不合法`
      return false
    }
  }
  return true
}

function toStorage(field: FieldDef, raw: unknown): string | number | null {
  if (raw === undefined || raw === null) {
    return field.type === 'json' && field.shape
      ? JSON.stringify(field.fallback ?? null)
      : null
  }
  switch (field.type) {
    case 'bool':
      return raw ? 1 : 0
    case 'date':
      // 空串视为「未填」→ NULL；string/text 的空串是合法值，存 ''
      return raw === '' ? null : String(raw).slice(0, 10)
    case 'json':
      return JSON.stringify(raw)
    default:
      return raw as string | number
  }
}

/**
 * mode='create'：必填必须给齐（缺省 fallback 补齐）；mode='update'：只校验出现的字段。
 */
export function validateDomainFields(
  domain: DomainDef,
  body: Record<string, unknown>,
  mode: 'create' | 'update'
): ValidationResult {
  const errors: Record<string, string> = {}
  const values: Record<string, string | number | null> = {}

  for (const field of domain.fields) {
    const raw = body[field.key]
    const present = raw !== undefined

    if (mode === 'create' && !present && field.fallback !== undefined && field.required) {
      // 必填且有缺省（如 draft/rank）→ 用缺省
      values[field.col] = toStorage(field, field.fallback)
      continue
    }
    if (mode === 'create' && !present && field.fallback !== undefined && !field.required) {
      values[field.col] = toStorage(field, field.fallback)
      continue
    }
    if (!present) {
      if (mode === 'create' && field.required) {
        fail(errors, field.key, '此项为必填')
      }
      continue
    }

    if (field.key === 'stats' && field.shape === 'stats') {
      if (present && checkStats(raw, errors)) values[field.col] = JSON.stringify(raw)
      continue
    }

    if (field.type === 'json') {
      if (checkJson(field, raw, errors)) values[field.col] = toStorage(field, raw)
      continue
    }

    if (field.enum && raw !== '' && raw !== null) {
      if (typeof raw !== 'string' || !field.enum.includes(raw)) {
        fail(errors, field.key, `可选值：${field.enum.join(' / ')}`)
        continue
      }
    }

    if (checkScalar(field, raw, errors)) values[field.col] = toStorage(field, raw)
  }

  return { ok: Object.keys(errors).length === 0, errors, values }
}

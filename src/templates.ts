import type { Template } from './types'

const KEY = 'il-fleet-planner:templates'
const LEGACY_KEY = 'il-fleet-planner:custom-templates'

function readKey(key: string): Template[] | null {
  const raw = localStorage.getItem(key)
  if (raw === null) return null
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? (v as Template[]) : null
  } catch {
    return null
  }
}

function mergeByKey(a: Template[], b: Template[]): Template[] {
  const m = new Map<string, Template>()
  for (const t of a) m.set(t.key, t)
  for (const t of b) m.set(t.key, t)
  return [...m.values()]
}

// Seed-once model: reference templates seed localStorage on first load, then
// the local list is the single source of truth (uniform edit/delete).
export function loadTemplates(seed: Template[]): Template[] {
  const existing = readKey(KEY)
  if (existing) return existing
  const legacy = readKey(LEGACY_KEY) ?? []
  const list = mergeByKey(seed, legacy)
  saveTemplates(list)
  return list
}

export function saveTemplates(list: Template[]): void {
  localStorage.setItem(KEY, JSON.stringify(list))
}

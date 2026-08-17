import type { Ship, Module, Template } from './types'

const SHIP_KEY = 'il-fleet-planner:ships'
const MODULE_KEY = 'il-fleet-planner:modules'
const TPL_KEY = 'il-fleet-planner:templates'
const LEGACY_TPL_KEY = 'il-fleet-planner:custom-templates'

function read<T>(key: string): T[] | null {
  const raw = localStorage.getItem(key)
  if (raw === null) return null
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? (v as T[]) : null
  } catch {
    return null
  }
}

function write<T>(key: string, list: T[]): void {
  localStorage.setItem(key, JSON.stringify(list))
}

// Seed-once: return the stored list if present, otherwise seed from the JSON
// reference and return it. The local list is then the single source of truth.
function loadCollection<T>(key: string, seed: T[]): T[] {
  const existing = read<T>(key)
  if (existing) return existing
  write(key, seed)
  return seed
}

export const loadShips = (seed: Ship[]) => loadCollection(SHIP_KEY, seed)
export const saveShips = (ships: Ship[]) => write(SHIP_KEY, ships)

export const loadModules = (seed: Module[]) => loadCollection(MODULE_KEY, seed)
export const saveModules = (modules: Module[]) => write(MODULE_KEY, modules)

export function loadTemplates(seed: Template[]): Template[] {
  const existing = read<Template>(TPL_KEY)
  if (existing) return existing
  const legacy = read<Template>(LEGACY_TPL_KEY) ?? []
  const m = new Map<string, Template>()
  for (const t of seed) m.set(t.key, t)
  for (const t of legacy) m.set(t.key, t)
  const list = [...m.values()]
  write(TPL_KEY, list)
  return list
}

export const saveTemplates = (templates: Template[]) => write(TPL_KEY, templates)

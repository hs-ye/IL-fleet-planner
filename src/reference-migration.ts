import type { Module, Ship, Template } from './types'

export interface ReferenceLists {
  ships: Ship[]
  modules: Module[]
  templates: Template[]
}

/** Bump when public/reference-data needs a one-time merge into stored data. */
export const CURRENT_REFERENCE_VERSION = 2

/**
 * Merge the refreshed bundled data into a user's stored copy.
 *
 * - Values that still match the old seed are updated (Carillion A's CP, the
 *   Mergrez -> Megrez rename); edited values are left alone.
 * - New bundled ships/modules are appended when missing.
 * - Known old placeholder modules are removed only when no template uses them.
 */
export function migrateReferenceData(stored: ReferenceLists, bundled: ReferenceLists): ReferenceLists {
  const alreadyMegrez = stored.ships.some((s) => s.key === 'Megrez:A')
  const alreadyMegrezModules = stored.modules.some((m) => m.shipKey === 'Megrez:A')
  const alreadyMegrezTemplate = stored.templates.some((t) => t.key === 'Megrez - Default')

  let ships = stored.ships.map((s) =>
    s.base === 'Mergrez' && !alreadyMegrez
      ? { ...s, key: 'Megrez:A', base: 'Megrez', name: 'Megrez' }
      : s,
  )
  ships = ships.map((s) => (s.key === 'Carillion:A' && s.cpCost === 5 ? { ...s, cpCost: 4 } : s))

  const templates = stored.templates.map((t) => {
    const slots = { ...t.slots }
    if (t.baseShipKey === 'Dubhe:A') {
      for (const [slot, name] of Object.entries(slots)) {
        if (name === 'DUB - M3') slots[slot] = 'DUB - A3'
      }
    }
    return {
      ...t,
      baseShipKey: t.baseShipKey === 'Mergrez:A' ? 'Megrez:A' : t.baseShipKey,
      key: !alreadyMegrezTemplate && t.key === 'Mergrez - Default' ? 'Megrez - Default' : t.key,
      name: !alreadyMegrezTemplate && t.name === 'Mergrez - Default' ? 'Megrez - Default' : t.name,
      slots,
    }
  })

  let modules = stored.modules.map((m) => {
    if (m.shipKey === 'Mergrez:A' && !alreadyMegrezModules) return { ...m, shipKey: 'Megrez:A' }
    if (m.shipKey === 'Dubhe:A' && m.slot === 'M' && m.name === 'DUB - M3') {
      return { ...m, slot: 'A', name: 'DUB - A3' }
    }
    return m
  })

  const templateSlotNames = (base: string) =>
    new Set(
      templates.filter((t) => t.baseShipKey === base).flatMap((t) => Object.values(t.slots)),
    )

  if (!templateSlotNames('CV3000:A').has('CV3000 B3')) {
    modules = modules.filter((m) => !(m.shipKey === 'CV3000:A' && m.name === 'CV3000 B3'))
  }
  if (!templateSlotNames('Dubhe:A').has('DUB - C3')) {
    modules = modules.filter((m) => !(m.shipKey === 'Dubhe:A' && m.name === 'DUB - C3'))
  }

  const shipKeys = new Set(ships.map((s) => s.key))
  for (const s of bundled.ships) {
    if (!shipKeys.has(s.key)) ships.push({ ...s })
  }

  const moduleKey = (m: Module) => `${m.shipKey}|${m.slot ?? ''}|${m.name}`
  const moduleKeys = new Set(modules.map(moduleKey))
  for (const m of bundled.modules) {
    if (!moduleKeys.has(moduleKey(m))) modules.push({ ...m })
  }

  return { ships, modules, templates }
}

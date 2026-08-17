import type {
  ReferenceData,
  Ship,
  Module,
  Template,
  Hangar,
  FleetPlan,
  FleetUnit,
  ValidationIssue,
  Size,
} from './types'

export async function loadReferenceData(): Promise<ReferenceData> {
  const fetchJson = async (name: string): Promise<unknown> => {
    const r = await fetch(`/reference-data/${name}.json`)
    if (!r.ok) throw new Error(`${name} HTTP ${r.status}`)
    return r.json()
  }
  const [ships, modules, templates] = await Promise.all([
    fetchJson('ships'),
    fetchJson('modules'),
    fetchJson('templates'),
  ])
  return {
    version: 1,
    generated: '',
    ships: ships as Ship[],
    modules: modules as Module[],
    templates: templates as Template[],
  }
}

export class Reference {
  ships: Ship[]
  modules: Module[]
  templates: Template[]
  shipByKey: Map<string, Ship>
  templateByKey: Map<string, Template>
  moduleByName: Map<string, Module>

  constructor(data: ReferenceData, templates?: Template[]) {
    this.ships = data.ships
    this.modules = data.modules
    this.templates = templates ?? data.templates
    this.shipByKey = new Map(data.ships.map((s) => [s.key, s]))
    this.moduleByName = new Map(data.modules.map((m) => [m.name, m]))
    this.templateByKey = new Map(this.templates.map((t) => [t.key, t]))
  }

  private static SLOT_ORDER = ['M', 'A', 'B', 'C', 'D', 'E', 'F']

  slotsForShip(shipKey: string): string[] {
    const slots = new Set(
      this.modules
        .filter((m) => m.shipKey === shipKey)
        .map((m) => m.slot)
        .filter((s): s is string => !!s),
    )
    return Reference.SLOT_ORDER.filter((s) => slots.has(s))
  }

  modulesForSlot(shipKey: string, slot: string): Module[] {
    return this.modules.filter((m) => m.shipKey === shipKey && m.slot === slot)
  }

  templateableShips(): Ship[] {
    const withModules = new Set(this.modules.map((m) => m.shipKey))
    return this.ships.filter((s) => withModules.has(s.key))
  }

  unitList(): { key: string; label: string; kind: 'ship' | 'template' }[] {
    const nameCount = new Map<string, number>()
    for (const s of this.ships) nameCount.set(s.name, (nameCount.get(s.name) ?? 0) + 1)
    const ships = this.ships.map((s) => {
      const dup = (nameCount.get(s.name) ?? 0) > 1
      return {
        key: s.key,
        label: dup && s.variant ? `${s.name} [${s.variant}]` : s.name,
        kind: 'ship' as const,
      }
    })
    const templates = this.templates.map((t) => ({ key: t.key, label: t.name, kind: 'template' as const }))
    return [...ships, ...templates]
  }

  lookupUnit(key: string): { kind: 'ship' | 'template'; ship?: Ship; template?: Template } | null {
    const ship = this.shipByKey.get(key)
    if (ship) return { kind: 'ship', ship }
    const template = this.templateByKey.get(key)
    if (template) return { kind: 'template', template }
    return null
  }

  unitCp(key: string): number | null {
    const u = this.lookupUnit(key)
    if (!u) return null
    if (u.kind === 'ship') return u.ship!.cpCost
    return this.shipByKey.get(u.template!.baseShipKey)?.cpCost ?? null
  }

  unitClass(key: string): string | null {
    const u = this.lookupUnit(key)
    if (!u) return null
    if (u.kind === 'ship') return u.ship!.class
    return this.shipByKey.get(u.template!.baseShipKey)?.class ?? null
  }

  unitDefaultRow(key: string): string | null {
    const u = this.lookupUnit(key)
    if (!u) return null
    if (u.kind === 'ship') return u.ship!.defaultRow
    return this.shipByKey.get(u.template!.baseShipKey)?.defaultRow ?? null
  }

  aircraft(): Ship[] {
    return this.ships.filter((s) => s.class === 'Fighter' || s.class === 'Corvette')
  }

  carrierHangars(key: string, kind: 'ship' | 'template'): Hangar[] {
    if (kind === 'ship') {
      const ship = this.shipByKey.get(key)
      if (!ship) return []
      const hs: Hangar[] = []
      if ((ship.fixedCorvSlots ?? 0) > 0) {
        hs.push({
          ref: 'corvette-dock',
          kind: 'corvette',
          corvCapacity: ship.fixedCorvSlots!,
          fighterCapacity: 0,
          size: null,
          label: 'Corvette dock',
        })
      }
      if ((ship.fixedFighterSlots ?? 0) > 0) {
        hs.push({
          ref: 'fighter-hangar',
          kind: 'fighter',
          corvCapacity: 0,
          fighterCapacity: ship.fixedFighterSlots!,
          size: ship.size,
          label: `Fighter hangar${ship.size ? ` (${ship.size})` : ''}`,
        })
      }
      return hs
    }
    const tpl = this.templateByKey.get(key)
    if (!tpl) return []
    const hs: Hangar[] = []
    for (const [slot, modName] of Object.entries(tpl.slots)) {
      const mod = this.moduleByName.get(modName)
      if (!mod) continue
      if (mod.corvCapacity > 0 || mod.fighterCapacity > 0) {
        const kind =
          mod.corvCapacity > 0 && mod.fighterCapacity > 0
            ? 'mixed'
            : mod.corvCapacity > 0
              ? 'corvette'
              : 'fighter'
        hs.push({
          ref: slot,
          kind,
          corvCapacity: mod.corvCapacity,
          fighterCapacity: mod.fighterCapacity,
          size: mod.hangarSize,
          label: `Slot ${slot} — ${modName}`,
        })
      }
    }
    return hs
  }

  isCarrier(key: string, kind: 'ship' | 'template'): boolean {
    return this.carrierHangars(key, kind).length > 0
  }

  carriersInPlan(plan: FleetPlan): { key: string; kind: 'ship' | 'template'; hangars: Hangar[] }[] {
    const seen = new Map<string, { key: string; kind: 'ship' | 'template' }>()
    for (const u of plan.units) {
      if (this.isCarrier(u.unitKey, u.unitKind)) {
        seen.set(`${u.unitKey}|${u.unitKind}`, { key: u.unitKey, kind: u.unitKind })
      }
    }
    return [...seen.values()].map((c) => ({ ...c, hangars: this.carrierHangars(c.key, c.kind) }))
  }
}

const SIZE_ORDER: Record<Size, number> = { Small: 0, Medium: 1, Large: 2 }

export function validatePlan(ref: Reference, plan: FleetPlan): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  const mainUnits = plan.units.filter((u) => u.side === 'Main')
  const rfUnits = plan.units.filter((u) => u.side === 'RF')

  const sumCp = (units: FleetUnit[]) =>
    units.reduce((acc, u) => acc + (ref.unitCp(u.unitKey) ?? 0) * u.count, 0)

  const mainCp = sumCp(mainUnits)
  const rfCp = sumCp(rfUnits)
  if (mainCp > plan.mainMaxCp)
    issues.push({ level: 'error', message: `Main fleet CP ${mainCp} exceeds budget ${plan.mainMaxCp}` })
  if (rfCp > plan.rfMaxCp)
    issues.push({ level: 'error', message: `RF CP ${rfCp} exceeds budget ${plan.rfMaxCp}` })

  const rfTypes = new Set(rfUnits.map((u) => u.unitKey))
  if (rfTypes.size > plan.rfMaxShips)
    issues.push({ level: 'error', message: `RF has ${rfTypes.size} ship types (limit ${plan.rfMaxShips})` })

  const fleetCount = (key: string) =>
    plan.units.filter((u) => u.unitKey === key).reduce((a, u) => a + u.count, 0)

  const groups = new Map<
    string,
    {
      carrierKey: string
      carrierKind: 'ship' | 'template'
      hangarRef: string
      entries: { aircraftKey: string; count: number }[]
    }
  >()
  for (const a of plan.aircraft) {
    const gkey = `${a.carrierKey}|${a.carrierKind}|${a.hangarRef}`
    if (!groups.has(gkey)) {
      groups.set(gkey, { carrierKey: a.carrierKey, carrierKind: a.carrierKind, hangarRef: a.hangarRef, entries: [] })
    }
    groups.get(gkey)!.entries.push({ aircraftKey: a.aircraftKey, count: a.count })
  }

  for (const g of groups.values()) {
    const inFleet = plan.units.some((u) => u.unitKey === g.carrierKey && u.unitKind === g.carrierKind)
    if (!inFleet) {
      issues.push({ level: 'warning', message: `Aircraft assigned to "${g.carrierKey}" which isn't fielded in the fleet` })
      continue
    }
    const hangar = ref.carrierHangars(g.carrierKey, g.carrierKind).find((h) => h.ref === g.hangarRef)
    if (!hangar) {
      issues.push({ level: 'error', message: `Hangar "${g.hangarRef}" not found on "${g.carrierKey}"` })
      continue
    }
    const copies = fleetCount(g.carrierKey)
    let corvAssigned = 0
    let fighterAssigned = 0
    for (const e of g.entries) {
      const ac = ref.shipByKey.get(e.aircraftKey)
      if (!ac) continue
      if (ac.class === 'Corvette') {
        corvAssigned += e.count
        if (hangar.corvCapacity <= 0)
          issues.push({ level: 'error', message: `Corvette "${ac.name}" assigned to a non-corvette hangar on "${g.carrierKey}"` })
      } else if (ac.class === 'Fighter') {
        fighterAssigned += e.count
        if (hangar.fighterCapacity <= 0) {
          issues.push({ level: 'error', message: `Fighter "${ac.name}" assigned to a non-fighter hangar on "${g.carrierKey}"` })
        } else if (hangar.size && ac.size && SIZE_ORDER[ac.size] > SIZE_ORDER[hangar.size]) {
          issues.push({
            level: 'error',
            message: `Fighter "${ac.name}" (${ac.size}) too large for ${hangar.size} hangar "${g.hangarRef}" on "${g.carrierKey}"`,
          })
        }
      }
    }
    const corvCap = hangar.corvCapacity * copies
    const ftrCap = hangar.fighterCapacity * copies
    if (corvAssigned > corvCap)
      issues.push({ level: 'error', message: `Hangar "${g.hangarRef}" on "${g.carrierKey}": ${corvAssigned} corvettes over capacity ${corvCap}` })
    if (fighterAssigned > ftrCap)
      issues.push({ level: 'error', message: `Hangar "${g.hangarRef}" on "${g.carrierKey}": ${fighterAssigned} fighters over capacity ${ftrCap}` })
  }

  return issues
}

import type { Row, ShipClass, Side } from './types'

export type Delivery = 'direct' | 'missile'

/** A fielded unit (copies > 0) with its resolved class, as the analysis sees it. */
export interface IncomingUnit {
  key: string
  name: string
  class: ShipClass
  row: Row
  count: number
  side: Side
}

export interface IncomingProfile {
  delivery: Delivery
  /** Classes the weapon is meant for. Ships outside this set are never analysed. */
  targetClasses: ShipClass[]
  includeRF: boolean
}

export interface IncomingTarget {
  key: string
  name: string
  class: ShipClass
  row: Row
  ships: number
}

export interface FocusTier {
  min: number
  max: number
  ships: number
}

export interface IncomingResult {
  delivery: Delivery
  /** Row that direct fire is currently working on (null for missile/air). */
  engagedRow: Row | null
  /** Ships the weapon can select now, one entry per ship or template. */
  targets: IncomingTarget[]
  validShips: number
  /** Copies the damage is split across at this target count (0 with no targets). */
  locks: number
  /** True when no preferred class was in reach and the fallback set is shown. */
  usingFallback: boolean
}

/**
 * Focus fire: at these selectable-target counts the weapon attacks more than
 * one copy at once. Below 5 everything is focused on a single ship.
 */
export const FOCUS_TIERS: FocusTier[] = [
  { min: 5, max: 7, ships: 2 },
  { min: 8, max: 9, ships: 3 },
  { min: 10, max: 12, ships: 4 },
  { min: 13, max: 14, ships: 5 },
  { min: 15, max: Infinity, ships: 6 },
]

const ROWS: Row[] = ['Front', 'Mid', 'Back']
const CLASS_ORDER: ShipClass[] = [
  'Frigate',
  'Destroyer',
  'Cruiser',
  'Battlecruiser',
  'Carrier',
  'Auxiliary',
  'Battleship',
]

export function focusTier(ships: number): FocusTier | null {
  if (ships < 5) return null
  return FOCUS_TIERS.find((t) => ships >= t.min && ships <= t.max) ?? null
}

export function damageLocks(ships: number): number {
  if (ships <= 0) return 0
  return focusTier(ships)?.ships ?? 1
}

function aggregate(units: IncomingUnit[]): IncomingTarget[] {
  const byUnitRow = new Map<string, IncomingTarget>()
  for (const u of units) {
    const key = `${u.key}|${u.row}`
    const cur = byUnitRow.get(key)
    if (cur) cur.ships += u.count
    else byUnitRow.set(key, { key: u.key, name: u.name, class: u.class, row: u.row, ships: u.count })
  }
  return [...byUnitRow.values()].sort(
    (a, b) =>
      CLASS_ORDER.indexOf(a.class) - CLASS_ORDER.indexOf(b.class) ||
      ROWS.indexOf(a.row) - ROWS.indexOf(b.row) ||
      a.name.localeCompare(b.name),
  )
}

const shipCount = (targets: IncomingTarget[]) => targets.reduce((s, t) => s + t.ships, 0)

/**
 * What an incoming weapon can select right now, for one fire type.
 *
 * Preferred classes are selected first. If none of them are in reach, the
 * fallback set is everything in reach: the engaged row for direct fire, or the
 * whole fleet for missile/air. Direct fire reaches only the frontmost non-empty
 * row; missile/air reaches any row. The selected-target count then decides how many
 * copies the damage is split across.
 */
export function analyzeIncomingFire(units: IncomingUnit[], profile: IncomingProfile): IncomingResult {
  const fleet = units.filter((u) => u.count > 0 && (profile.includeRF || u.side === 'Main'))
  const preferred = fleet.filter((u) => profile.targetClasses.includes(u.class))

  let engagedRow: Row | null = null
  let reachable = preferred
  let usingFallback = false
  if (profile.delivery === 'direct') {
    // Any ship screens the rows behind it, selected class or not.
    engagedRow = ROWS.find((row) => fleet.some((u) => u.row === row)) ?? null
    const preferredInRow = engagedRow ? preferred.filter((u) => u.row === engagedRow) : []
    if (preferredInRow.length > 0) {
      reachable = preferredInRow
    } else {
      reachable = engagedRow ? fleet.filter((u) => u.row === engagedRow) : []
      usingFallback = reachable.length > 0
    }
  } else if (preferred.length === 0) {
    reachable = fleet
    usingFallback = fleet.length > 0
  }

  const targets = aggregate(reachable)
  const validShips = shipCount(targets)

  return {
    delivery: profile.delivery,
    engagedRow,
    targets,
    validShips,
    locks: damageLocks(validShips),
    usingFallback,
  }
}

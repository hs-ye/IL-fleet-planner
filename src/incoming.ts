import type { Row, ShipClass, Side } from './types'

export type Delivery = 'direct' | 'missile'

/** A fielded unit (copies > 0) with its resolved class, as the analysis sees it. */
export interface IncomingUnit {
  id: string
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
  /** Row that direct fire is currently working on (null for missiles). */
  engagedRow: Row | null
  /** Preferred-class ships the weapon can select now. */
  targets: IncomingTarget[]
  validShips: number
  /** Copies the damage is split across at this target count (0 with no targets). */
  locks: number
  /** Direct fire only: preferred-class ships behind the engaged row. */
  screened: IncomingTarget[]
  screenedShips: number
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

/** Smallest tier above the current count, for the "how many more" hint. */
export function nextFocusTier(ships: number): FocusTier | null {
  return FOCUS_TIERS.find((t) => t.min > ships) ?? null
}

function aggregate(units: IncomingUnit[]): IncomingTarget[] {
  const byClassRow = new Map<string, IncomingTarget>()
  for (const u of units) {
    const key = `${u.class}|${u.row}`
    const cur = byClassRow.get(key)
    if (cur) cur.ships += u.count
    else byClassRow.set(key, { class: u.class, row: u.row, ships: u.count })
  }
  return [...byClassRow.values()].sort(
    (a, b) =>
      CLASS_ORDER.indexOf(a.class) - CLASS_ORDER.indexOf(b.class) ||
      ROWS.indexOf(a.row) - ROWS.indexOf(b.row),
  )
}

const shipCount = (targets: IncomingTarget[]) => targets.reduce((s, t) => s + t.ships, 0)

/**
 * What an incoming weapon can select right now, for one fire type.
 *
 * Only the weapon's preferred classes are considered — fallback fire at other
 * classes is deliberately ignored because that is the weapon performing badly.
 * Direct fire reaches only the frontmost non-empty row; missiles reach any row.
 * The selected-target count then decides how many copies are attacked at once.
 */
export function analyzeIncomingFire(units: IncomingUnit[], profile: IncomingProfile): IncomingResult {
  const fleet = units.filter((u) => u.count > 0 && (profile.includeRF || u.side === 'Main'))
  const preferred = fleet.filter((u) => profile.targetClasses.includes(u.class))

  let engagedRow: Row | null = null
  let reachable = preferred
  if (profile.delivery === 'direct') {
    // Any ship screens the rows behind it, selected class or not.
    engagedRow = ROWS.find((row) => fleet.some((u) => u.row === row)) ?? null
    reachable = engagedRow ? preferred.filter((u) => u.row === engagedRow) : []
  }

  const screenedUnits = engagedRow ? preferred.filter((u) => u.row !== engagedRow) : []
  const targets = aggregate(reachable)
  const validShips = shipCount(targets)

  return {
    delivery: profile.delivery,
    engagedRow,
    targets,
    validShips,
    locks: damageLocks(validShips),
    screened: aggregate(screenedUnits),
    screenedShips: shipCount(aggregate(screenedUnits)),
  }
}

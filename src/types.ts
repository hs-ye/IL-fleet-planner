export type ShipClass =
  | 'Fighter'
  | 'Corvette'
  | 'Frigate'
  | 'Destroyer'
  | 'Cruiser'
  | 'Battlecruiser'
  | 'Carrier'
  | 'Auxiliary'
  | 'Battleship'

export type Row = 'Front' | 'Mid' | 'Back'
export type Size = 'Small' | 'Medium' | 'Large'
export type Side = 'Main' | 'RF'
export type UnitKind = 'ship' | 'template'

export interface Ship {
  key: string
  name: string
  base: string | null
  variant: string | null
  class: ShipClass
  cpCost: number | null
  defaultRow: Row | null
  fixedCorvSlots: number | null
  fixedFighterSlots: number | null
  size: Size | null
  notes: string | null
}

export interface Module {
  shipKey: string
  slot: string | null
  name: string
  corvCapacity: number
  fighterCapacity: number
  hangarSize: Size | null
  effect: string | null
}

export interface Template {
  key: string
  name: string
  baseShipKey: string
  slots: Record<string, string>
  corvSlots: number
  fighterSlots: number
}

export interface ReferenceData {
  version: number
  generated: string
  ships: Ship[]
  modules: Module[]
  templates: Template[]
}

export interface FleetUnit {
  id: string
  side: Side
  unitKey: string
  unitKind: UnitKind
  row: Row
  count: number
}

export interface AircraftAssignment {
  id: string
  aircraftKey: string
  carrierKey: string
  carrierKind: UnitKind
  hangarRef: string
  count: number
}

export interface FleetPlan {
  version: number
  id: string
  name: string
  server: string
  mainMaxCp: number
  rfMaxCp: number
  rfMaxShips: number
  units: FleetUnit[]
  aircraft: AircraftAssignment[]
}

export interface Hangar {
  ref: string
  kind: 'corvette' | 'fighter' | 'mixed'
  corvCapacity: number
  fighterCapacity: number
  size: Size | null
  label: string
}

export interface ValidationIssue {
  level: 'error' | 'warning'
  message: string
}

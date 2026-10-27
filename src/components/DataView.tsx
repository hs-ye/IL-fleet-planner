import { useState } from 'react'
import type { Reference } from '../reference'
import type { Ship, Module, ShipClass, Row, Size } from '../types'
import EditableTable, { type Column } from './EditableTable'
import { uid } from '../serialize'

interface Props {
  reference: Reference
  onShipsChange: (ships: Ship[]) => void
  onModulesChange: (modules: Module[]) => void
  onResetShips: () => void
  onResetModules: () => void
}

const computeKey = (s: Ship): string => (s.base && s.variant ? `${s.base}:${s.variant}` : (s.base || s.name || ''))
const withKey = (s: Ship): Ship => ({ ...s, key: computeKey(s) })

const shipColumns: Column<Ship>[] = [
  { key: 'name', label: 'Name', width: '150px', read: (s) => s.name, write: (s, v) => withKey({ ...s, name: v }) },
  { key: 'base', label: 'Base', read: (s) => s.base ?? '', write: (s, v) => withKey({ ...s, base: v || null }) },
  { key: 'variant', label: 'Variant', width: '70px', read: (s) => s.variant ?? '', write: (s, v) => withKey({ ...s, variant: v || null }) },
  { key: 'class', label: 'Class', width: '105px', read: (s) => s.class, write: (s, v) => ({ ...s, class: v as ShipClass }) },
  { key: 'cpCost', label: 'CP', num: true, type: 'number', read: (s) => s.cpCost ?? '', write: (s, v) => ({ ...s, cpCost: v === '' ? null : Number(v) || 0 }) },
  { key: 'defaultRow', label: 'Row', width: '60px', read: (s) => s.defaultRow ?? '', write: (s, v) => ({ ...s, defaultRow: (v || null) as Row | null }) },
  { key: 'fixedCorvSlots', label: 'Corv', num: true, type: 'number', read: (s) => s.fixedCorvSlots ?? '', write: (s, v) => ({ ...s, fixedCorvSlots: v === '' ? null : Number(v) || 0 }) },
  { key: 'fixedFighterSlots', label: 'Fighter', num: true, type: 'number', read: (s) => s.fixedFighterSlots ?? '', write: (s, v) => ({ ...s, fixedFighterSlots: v === '' ? null : Number(v) || 0 }) },
  { key: 'size', label: 'Size', width: '70px', read: (s) => s.size ?? '', write: (s, v) => ({ ...s, size: (v || null) as Size | null }) },
  { key: 'notes', label: 'Notes', read: (s) => s.notes ?? '', write: (s, v) => ({ ...s, notes: v || null }) },
]

const moduleColumns: Column<Module>[] = [
  { key: 'shipKey', label: 'Ship', width: '150px', read: (m) => m.shipKey, write: (m, v) => ({ ...m, shipKey: v }) },
  { key: 'slot', label: 'Slot', width: '50px', read: (m) => m.slot ?? '', write: (m, v) => ({ ...m, slot: v || null }) },
  { key: 'name', label: 'Name', read: (m) => m.name, write: (m, v) => ({ ...m, name: v }) },
  { key: 'corvCapacity', label: 'Corv', num: true, type: 'number', read: (m) => m.corvCapacity || '', write: (m, v) => ({ ...m, corvCapacity: v === '' ? 0 : Number(v) || 0 }) },
  { key: 'fighterCapacity', label: 'Fighter', num: true, type: 'number', read: (m) => m.fighterCapacity || '', write: (m, v) => ({ ...m, fighterCapacity: v === '' ? 0 : Number(v) || 0 }) },
  { key: 'hangarSize', label: 'Hangar', width: '70px', read: (m) => m.hangarSize ?? '', write: (m, v) => ({ ...m, hangarSize: (v || null) as Size | null }) },
  { key: 'effect', label: 'Effect', read: (m) => m.effect ?? '', write: (m, v) => ({ ...m, effect: v || null }) },
]

export default function DataView({ reference, onShipsChange, onModulesChange, onResetShips, onResetModules }: Props) {
  const [which, setWhich] = useState<'ships' | 'modules'>('ships')
  const [filter, setFilter] = useState<'all' | 'visible' | 'hidden'>('all')

  const hiddenShips = reference.ships.filter((s) => s.hidden).length
  const hiddenModules = reference.modules.filter((m) => m.hidden).length
  const hiddenCount = which === 'ships' ? hiddenShips : hiddenModules
  const totalCount = which === 'ships' ? reference.ships.length : reference.modules.length

  const toggleShip = (i: number) =>
    onShipsChange(reference.ships.map((s, j) => (j === i ? { ...s, hidden: !s.hidden } : s)))
  const toggleModule = (i: number) =>
    onModulesChange(reference.modules.map((m, j) => (j === i ? { ...m, hidden: !m.hidden } : m)))

  const rowClass = (row: { hidden?: boolean }): string => {
    const filteredOut =
      (filter === 'visible' && row.hidden) || (filter === 'hidden' && !row.hidden)
    return `${row.hidden ? 'row-hidden' : ''}${filteredOut ? ' row-filtered-out' : ''}`
  }

  const visibilityButton = (hidden: boolean | undefined, onToggle: () => void) => (
    <button
      className="small"
      onClick={onToggle}
      title={hidden ? 'Show this in the planner and templates' : 'Hide this from the planner and templates'}
    >
      {hidden ? 'Show' : 'Hide'}
    </button>
  )

  const addShip = () =>
    onShipsChange([
      ...reference.ships,
      { key: uid(), name: '', base: '', variant: '', class: 'Frigate', cpCost: null, defaultRow: null, fixedCorvSlots: null, fixedFighterSlots: null, size: null, notes: null },
    ])

  const addModule = () =>
    onModulesChange([
      ...reference.modules,
      { shipKey: '', slot: '', name: '', corvCapacity: 0, fighterCapacity: 0, hangarSize: null, effect: null },
    ])

  const download = (filename: string, data: unknown) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="toolbar">
        <button className={which === 'ships' ? 'primary' : ''} onClick={() => setWhich('ships')}>Ships ({reference.ships.length})</button>
        <button className={which === 'modules' ? 'primary' : ''} onClick={() => setWhich('modules')}>Modules ({reference.modules.length})</button>
        <span style={{ flexGrow: 1 }} />
        <span className="muted" style={{ fontSize: 12 }}>Show:</span>
        <div className="segmented">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All ({totalCount})</button>
          <button className={filter === 'visible' ? 'active' : ''} onClick={() => setFilter('visible')}>
            Visible ({totalCount - hiddenCount})
          </button>
          <button className={filter === 'hidden' ? 'active' : ''} onClick={() => setFilter('hidden')}>
            Hidden ({hiddenCount})
          </button>
        </div>
        {which === 'ships' ? (
          <>
            <button className="small" onClick={() => download('ships.json', reference.ships)}>Export ships</button>
            <button className="small" onClick={onResetShips}>Reset ships</button>
          </>
        ) : (
          <>
            <button className="small" onClick={() => download('modules.json', reference.modules)}>Export modules</button>
            <button className="small" onClick={onResetModules}>Reset modules</button>
          </>
        )}
      </div>

      <p className="muted" style={{ fontSize: 12, margin: '0 0 4px' }}>
        <b>Hide</b> keeps a ship or module out of the planner pickers and the template editor; it stays in your
        reference data (and in plans/templates that already use it). Hidden rows are dimmed.
      </p>

      <div className="panel data-table">
        {which === 'ships' && (
          <EditableTable
            columns={shipColumns}
            rows={reference.ships}
            onChange={onShipsChange}
            onAdd={addShip}
            addLabel="Add ship"
            rowClassName={rowClass}
            rowActions={(row, i) => visibilityButton(row.hidden, () => toggleShip(i))}
          />
        )}
        {which === 'modules' && (
          <EditableTable
            columns={moduleColumns}
            rows={reference.modules}
            onChange={onModulesChange}
            onAdd={addModule}
            addLabel="Add module"
            rowClassName={rowClass}
            rowActions={(row, i) => visibilityButton(row.hidden, () => toggleModule(i))}
          />
        )}
      </div>
    </div>
  )
}

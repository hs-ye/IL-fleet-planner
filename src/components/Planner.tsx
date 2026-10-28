import { useState, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { FleetPlan, FleetUnit, AircraftAssignment, Side, Row, ShipClass } from '../types'
import type { Reference } from '../reference'
import { validatePlan } from '../reference'
import {
  analyzeIncomingFire,
  FOCUS_TIERS,
  focusTier,
  nextFocusTier,
  type FocusTier,
  type IncomingResult,
  type IncomingTarget,
  type IncomingUnit,
} from '../incoming'
import ShipIcon from './ShipIcon'
import { uid } from '../serialize'

const ROWS: Row[] = ['Front', 'Mid', 'Back']

const TARGET_CLASSES: ShipClass[] = [
  'Frigate',
  'Destroyer',
  'Cruiser',
  'Battlecruiser',
  'Carrier',
  'Auxiliary',
  'Battleship',
]

// The app's existing supercap set — the usual anti-capital weapon target.
const CAPITAL_CLASSES: ShipClass[] = ['Battlecruiser', 'Carrier', 'Auxiliary', 'Battleship']

interface Props {
  reference: Reference
  plan: FleetPlan
  setPlan: Dispatch<SetStateAction<FleetPlan>>
}

export default function Planner({ reference, plan, setPlan }: Props) {
  const issues = validatePlan(reference, plan)
  const carriers = reference.carriersInPlan(plan)
  const carrierName = (key: string, kind: 'ship' | 'template'): string =>
    kind === 'template'
      ? (reference.templateByKey.get(key)?.name ?? key)
      : (reference.shipByKey.get(key)?.name ?? key)
  const orphanAircraft = plan.aircraft.filter(
    (a) =>
      !carriers.some(
        (c) => c.key === a.carrierKey && c.kind === a.carrierKind && c.hangars.some((h) => h.ref === a.hangarRef),
      ),
  )

  // Build-limit counter: total copies per base:variant (ships + templates via their
  // base ship, aircraft from hangar assignments). Display only — no validation.
  const countMap = new Map<string, { key: string; name: string; class: string; count: number }>()
  const bumpCount = (key: string, name: string, cls: string, n: number) => {
    const cur = countMap.get(key)
    if (cur) cur.count += n
    else countMap.set(key, { key, name, class: cls, count: n })
  }
  for (const u of plan.units) {
    if (!u.unitKey) continue
    const tpl = u.unitKind === 'template' ? reference.templateByKey.get(u.unitKey) : undefined
    const key = tpl ? tpl.baseShipKey : u.unitKey
    const ship = reference.shipByKey.get(key)
    bumpCount(key, ship?.name ?? tpl?.name ?? u.unitKey, ship?.class ?? '—', u.count)
  }
  for (const a of plan.aircraft) {
    if (!a.aircraftKey) continue
    const ship = reference.shipByKey.get(a.aircraftKey)
    bumpCount(a.aircraftKey, ship?.name ?? a.aircraftKey, ship?.class ?? '—', a.count)
  }
  const buildCounts = [...countMap.values()]
  const [sort, setSort] = useState<{ col: 'name' | 'key' | 'class' | 'count'; dir: 1 | -1 }>({ col: 'name', dir: 1 })
  const toggleSort = (col: 'name' | 'key' | 'class' | 'count') =>
    setSort((s) => (s.col === col ? { col, dir: s.dir === 1 ? -1 : 1 } : { col, dir: 1 }))
  const sortArrow = (col: 'name' | 'key' | 'class' | 'count') => (sort.col === col ? (sort.dir === 1 ? ' ▲' : ' ▼') : '')
  const sortedCounts = [...buildCounts].sort((a, b) => {
    const va = a[sort.col]
    const vb = b[sort.col]
    const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number)
    return cmp * sort.dir
  })

  const [incomingClasses, setIncomingClasses] = useState<ShipClass[]>(CAPITAL_CLASSES)
  const [incomingIncludeRF, setIncomingIncludeRF] = useState(true)
  const toggleIncomingClass = (cls: ShipClass) =>
    setIncomingClasses((list) => (list.includes(cls) ? list.filter((c) => c !== cls) : [...list, cls]))

  // Incoming fire: only the weapon's preferred classes count, and direct fire
  // and missiles reach different rows — so each fire type is analysed separately.
  const incomingUnits: IncomingUnit[] = plan.units.flatMap((u) => {
    if (!u.unitKey || u.count <= 0) return []
    const cls = reference.unitClass(u.unitKey)
    if (!cls || cls === 'Fighter' || cls === 'Corvette') return []
    return [{ id: u.id, class: cls as ShipClass, row: u.row, count: u.count, side: u.side }]
  })
  const directFire = analyzeIncomingFire(incomingUnits, {
    delivery: 'direct',
    targetClasses: incomingClasses,
    includeRF: incomingIncludeRF,
  })
  const missileFire = analyzeIncomingFire(incomingUnits, {
    delivery: 'missile',
    targetClasses: incomingClasses,
    includeRF: incomingIncludeRF,
  })

  const targetLabel = (targets: IncomingTarget[]) =>
    targets.map((t) => `${t.ships}× ${t.class} (${t.row})`).join(' · ')

  const nextTierLabel = (res: IncomingResult) => {
    const next = nextFocusTier(res.validShips)
    if (!next) return res.validShips > 0 ? 'Max split' : '—'
    if (res.validShips === 0) return `${next.min} targets → ${next.ships} ships`
    return `${next.min - res.validShips} more (${next.min}) → ${next.ships} ships`
  }

  const tierMarkers = (tier: FocusTier | 'low') => {
    const names: string[] = []
    const inTier = (res: IncomingResult) =>
      tier === 'low'
        ? res.validShips > 0 && res.validShips < 5
        : focusTier(res.validShips)?.min === tier.min
    if (inTier(directFire)) names.push('Direct')
    if (inTier(missileFire)) names.push('Missile')
    return names.map((n) => <span key={n} className="tag">{n}</span>)
  }

  const splitCell = (res: IncomingResult) =>
    res.validShips === 0 ? (
      <span className="muted">—</span>
    ) : (
      <>
        <b className={res.locks > 1 ? 'ok' : 'warn'}>
          {res.locks} ship{res.locks === 1 ? '' : 's'}
        </b>
        {res.locks === 1 && <span className="warn"> (focus fire)</span>}
      </>
    )

  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  const showToast = (msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 4000)
  }
  const unitLabel = (key: string) =>
    reference.shipByKey.get(key)?.name ?? reference.templateByKey.get(key)?.name ?? key
  const aircraftFor = (key: string, kind: 'ship' | 'template') =>
    plan.aircraft.filter((a) => a.carrierKey === key && a.carrierKind === kind)
  const copiesOf = (key: string, kind: 'ship' | 'template') =>
    plan.units.filter((u) => u.unitKey === key && u.unitKind === kind).reduce((s, u) => s + u.count, 0)
  // Aircraft can only be loaded into carriers that actually have copies fielded.
  const fieldedCarriers = carriers.filter((c) => copiesOf(c.key, c.kind) > 0)

  // Aggregate hangar usage across the whole fleet (corvettes and fighters separately).
  const aircraftByHangar = new Map<string, AircraftAssignment[]>()
  for (const a of plan.aircraft) {
    const gkey = `${a.carrierKey}|${a.carrierKind}|${a.hangarRef}`
    const list = aircraftByHangar.get(gkey) ?? []
    list.push(a)
    aircraftByHangar.set(gkey, list)
  }
  let corvCap = 0
  let ftrCap = 0
  let corvAssigned = 0
  let ftrAssigned = 0
  for (const c of carriers) {
    const copies = plan.units
      .filter((u) => u.unitKey === c.key && u.unitKind === c.kind)
      .reduce((s, u) => s + u.count, 0)
    for (const h of c.hangars) {
      corvCap += h.corvCapacity * copies
      ftrCap += h.fighterCapacity * copies
      for (const e of aircraftByHangar.get(`${c.key}|${c.kind}|${h.ref}`) ?? []) {
        const ac = reference.shipByKey.get(e.aircraftKey)
        if (ac?.class === 'Corvette') corvAssigned += e.count
        else if (ac?.class === 'Fighter') ftrAssigned += e.count
      }
    }
  }

  const updateUnit = (id: string, patch: Partial<FleetUnit>) =>
    setPlan((p) => ({ ...p, units: p.units.map((u) => (u.id === id ? { ...u, ...patch } : u)) }))
  const onCountChange = (id: string, value: number) => {
    const count = Math.max(0, value)
    const u = plan.units.find((x) => x.id === id)
    updateUnit(id, { count })
    // 0 copies = the ship isn't fielded: clear its hangars too.
    if (u && count === 0 && u.count > 0) {
      const removed = aircraftFor(u.unitKey, u.unitKind)
      if (removed.length > 0) {
        setPlan((p) => ({
          ...p,
          aircraft: p.aircraft.filter((a) => !(a.carrierKey === u.unitKey && a.carrierKind === u.unitKind)),
        }))
        showToast(
          `Set ${unitLabel(u.unitKey)} to 0 copies — cleared ${removed.length} aircraft from its hangar${removed.length > 1 ? 's' : ''}`,
        )
      }
    }
  }
  const addUnit = (side: Side) =>
    setPlan((p) => ({
      ...p,
      units: [...p.units, { id: uid(), side, unitKey: '', unitKind: 'ship', row: 'Mid', count: 1 }],
    }))
  const removeUnit = (id: string) => {
    const u = plan.units.find((x) => x.id === id)
    if (!u) return
    // Removing a ship also clears every aircraft assigned to its hangars.
    const removed = aircraftFor(u.unitKey, u.unitKind)
    setPlan({
      ...plan,
      units: plan.units.filter((x) => x.id !== id),
      aircraft: plan.aircraft.filter((a) => !(a.carrierKey === u.unitKey && a.carrierKind === u.unitKind)),
    })
    if (removed.length > 0) {
      showToast(
        `Removed ${unitLabel(u.unitKey)} — cleared ${removed.length} aircraft from its hangar${removed.length > 1 ? 's' : ''}`,
      )
    }
  }

  const updateAircraft = (id: string, patch: Partial<AircraftAssignment>) =>
    setPlan((p) => {
      const a = p.aircraft.find((x) => x.id === id)
      if (!a || patch.aircraftKey === undefined || patch.aircraftKey === a.aircraftKey) {
        return { ...p, aircraft: p.aircraft.map((x) => (x.id === id ? { ...x, ...patch } : x)) }
      }
      // Same model already in this hangar → merge counts instead of duplicating.
      const dup = p.aircraft.find(
        (x) =>
          x.id !== id &&
          x.aircraftKey === patch.aircraftKey &&
          x.carrierKey === a.carrierKey &&
          x.carrierKind === a.carrierKind &&
          x.hangarRef === a.hangarRef,
      )
      if (dup) {
        return {
          ...p,
          aircraft: p.aircraft
            .filter((x) => x.id !== dup.id)
            .map((x) => (x.id === id ? { ...x, aircraftKey: patch.aircraftKey as string, count: x.count + dup.count } : x)),
        }
      }
      return { ...p, aircraft: p.aircraft.map((x) => (x.id === id ? { ...x, ...patch } : x)) }
    })
  const addAircraftToHangar = (carrierKey: string, carrierKind: 'ship' | 'template', hangarRef: string) =>
    setPlan((p) => {
      const pending = p.aircraft.some(
        (a) =>
          !a.aircraftKey && a.carrierKey === carrierKey && a.carrierKind === carrierKind && a.hangarRef === hangarRef,
      )
      if (pending) return p
      return {
        ...p,
        aircraft: [...p.aircraft, { id: uid(), aircraftKey: '', carrierKey, carrierKind, hangarRef, count: 1 }],
      }
    })
  const removeAircraft = (id: string) =>
    setPlan((p) => ({ ...p, aircraft: p.aircraft.filter((a) => a.id !== id) }))

  const onUnitChange = (id: string, key: string) => {
    const u = reference.lookupUnit(key)
    if (!u) return
    const patch: Partial<FleetUnit> = { unitKey: key, unitKind: u.kind }
    const drow = reference.unitDefaultRow(key)
    if (drow) patch.row = drow as Row
    // Swapping the ship clears aircraft from the replaced ship's hangars.
    const prev = plan.units.find((x) => x.id === id)
    const removed = prev && prev.unitKey && prev.unitKey !== key ? aircraftFor(prev.unitKey, prev.unitKind) : []
    setPlan({
      ...plan,
      units: plan.units.map((x) => (x.id === id ? { ...x, ...patch } : x)),
      aircraft:
        removed.length > 0 && prev
          ? plan.aircraft.filter((a) => !(a.carrierKey === prev.unitKey && a.carrierKind === prev.unitKind))
          : plan.aircraft,
    })
    if (removed.length > 0 && prev) {
      showToast(
        `Changed ${unitLabel(prev.unitKey)} — cleared ${removed.length} aircraft from its hangar${removed.length > 1 ? 's' : ''}`,
      )
    }
  }

  const mainUnits = plan.units.filter((u) => u.side === 'Main')
  const rfUnits = plan.units.filter((u) => u.side === 'RF')
  const mainCp = mainUnits.reduce((a, u) => a + (reference.unitCp(u.unitKey) ?? 0) * u.count, 0)
  const rfCp = rfUnits.reduce((a, u) => a + (reference.unitCp(u.unitKey) ?? 0) * u.count, 0)
  const rfCopies = rfUnits.reduce((s, u) => s + u.count, 0)
  const combinedCp = mainCp + rfCp

  const setConfig = (patch: Partial<FleetPlan>) => setPlan((p) => ({ ...p, ...patch }))

  // Hidden reference items stay selectable on rows that already use them, so a
  // curated-out ship never turns into a blank dropdown in an existing plan.
  const unitOptions = reference.unitList()

  const renderFleet = (side: Side, units: FleetUnit[], totalCp: number) => (
    <div className="panel">
      <h3>{side === 'Main' ? 'Main Fleet' : 'Reinforcement (RF)'}</h3>
      <table>
        <thead>
          <tr>
            <th>Unit</th><th>Class</th><th className="num">CP</th><th>Row</th>
            <th className="num">Count</th><th className="num">Total CP</th><th></th>
          </tr>
        </thead>
        <tbody>
          {units.map((u) => {
            const cp = reference.unitCp(u.unitKey)
            return (
              <tr key={u.id}>
                <td>
                  <ShipIcon
                    shipKey={
                      u.unitKind === 'template'
                        ? reference.templateByKey.get(u.unitKey)?.baseShipKey ?? u.unitKey
                        : u.unitKey
                    }
                    classFallback={
                      u.unitKind === 'template'
                        ? reference.shipByKey.get(reference.templateByKey.get(u.unitKey)?.baseShipKey ?? '')?.class ?? null
                        : reference.shipByKey.get(u.unitKey)?.class ?? null
                    }
                  />
                  <select
                    className="wide"
                    value={u.unitKey}
                    onChange={(e) => onUnitChange(u.id, e.target.value)}
                  >
                    <option value="">— select —</option>
                    {unitOptions.map((x) => (
                      <option key={x.key} value={x.key}>{x.label}</option>
                    ))}
                    {u.unitKey && !unitOptions.some((x) => x.key === u.unitKey) && (
                      <option value={u.unitKey}>
                        {unitLabel(u.unitKey)}
                        {reference.isUnitHidden(u.unitKey) ? ' (hidden)' : ' (not in list)'}
                      </option>
                    )}
                  </select>
                </td>
                <td className="muted">{reference.unitClass(u.unitKey) ?? ''}</td>
                <td className="num">{cp ?? ''}</td>
                <td>
                  <select
                    value={u.row}
                    onChange={(e) => updateUnit(u.id, { row: e.target.value as Row })}
                  >
                    {ROWS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={u.count}
                    onChange={(e) => onCountChange(u.id, Number(e.target.value) || 0)}
                  />
                </td>
                <td className="num">{cp != null ? cp * u.count : ''}</td>
                <td><button className="small danger" onClick={() => removeUnit(u.id)}>×</button></td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <button className="small" onClick={() => addUnit(side)}>+ Add ship / template</button>
      <div className="totals" style={{ marginTop: 8 }}>
        <span>CP: <b className={totalCp > plan.fleetMaxCp ? 'over' : 'ok'}>{totalCp}</b> / {plan.fleetMaxCp}</span>
        {side === 'RF' && <span>Ship instances: <b className={rfCopies > plan.rfMaxShips ? 'over' : 'ok'}>{rfCopies}</b> / {plan.rfMaxShips}</span>}
      </div>
    </div>
  )

  return (
    <div>
      <div className="panel">
        <h3>Plan settings</h3>
        <div className="config-grid">
          <label>Plan name
            <input type="text" value={plan.name} onChange={(e) => setConfig({ name: e.target.value })} />
          </label>
          <label>Fleet max CP
            <input type="number" min={10} step={10} value={plan.fleetMaxCp} onChange={(e) => setConfig({ fleetMaxCp: Number(e.target.value) || 0 })} />
          </label>
          <label>RF max ship instances (1–9)
            <input type="number" min={1} max={9} value={plan.rfMaxShips} onChange={(e) => setConfig({ rfMaxShips: Math.min(9, Math.max(1, Number(e.target.value) || 1)) })} />
          </label>
        </div>
        <div className="totals" style={{ marginTop: 10 }}>
          <span>Combined CP: <b>{combinedCp}</b></span>
          <span>Main: <b>{mainCp}</b></span>
          <span>RF: <b>{rfCp}</b></span>
        </div>
      </div>

      <div className="fleet-grid">
        {renderFleet('Main', mainUnits, mainCp)}
        {renderFleet('RF', rfUnits, rfCp)}
      </div>

      <div className="plan-cols">
        <div className="panel">
          <h3>Aircraft assignment</h3>
          {fieldedCarriers.length === 0 ? (
          <p className="muted">Field a carrier (ship or template with hangars) in the fleet to assign aircraft.</p>
        ) : (
          <div>
            {fieldedCarriers.map((c) => {
              const copies = copiesOf(c.key, c.kind)
              return (
                <div key={`${c.key}|${c.kind}`} style={{ marginBottom: 14 }}>
                  <div style={{ marginBottom: 6 }}>
                    <strong>{carrierName(c.key, c.kind)}</strong>
                    {copies > 1 && <span className="muted"> ×{copies}</span>}
                  </div>
                  {c.hangars.map((h) => {
                    const entries = plan.aircraft.filter(
                      (a) => a.carrierKey === c.key && a.carrierKind === c.kind && a.hangarRef === h.ref,
                    )
                    const corvAssigned = entries
                      .filter((e) => reference.shipByKey.get(e.aircraftKey)?.class === 'Corvette')
                      .reduce((s, e) => s + e.count, 0)
                    const ftrAssigned = entries
                      .filter((e) => reference.shipByKey.get(e.aircraftKey)?.class === 'Fighter')
                      .reduce((s, e) => s + e.count, 0)
                    const corvCap = h.corvCapacity * copies
                    const ftrCap = h.fighterCapacity * copies
                    const pending = entries.some((e) => !e.aircraftKey)
                    const aircraftOptions = reference.aircraftForHangar(h)
                    return (
                      <div key={h.ref} className="hangar-box">
                        <div className="hangar-head">
                          <span>{h.label}</span>
                          <span className="hangar-counter">
                            {corvCap > 0 && (
                              <span className={corvAssigned > corvCap ? 'over' : ''}>
                                {corvAssigned}/{corvCap} corvettes
                              </span>
                            )}
                            {corvCap > 0 && ftrCap > 0 && <span className="muted"> · </span>}
                            {ftrCap > 0 && (
                              <span className={ftrAssigned > ftrCap ? 'over' : ''}>
                                {ftrAssigned}/{ftrCap} fighters{h.size ? ` (${h.size})` : ''}
                              </span>
                            )}
                          </span>
                        </div>
                        {entries.map((e) => (
                          <div key={e.id} className="hangar-entry">
                            <select
                              value={e.aircraftKey}
                              onChange={(ev) => updateAircraft(e.id, { aircraftKey: ev.target.value })}
                            >
                              <option value="">— aircraft —</option>
                              {aircraftOptions.map((s) => (
                                <option key={s.key} value={s.key}>{s.name}</option>
                              ))}
                              {e.aircraftKey && !aircraftOptions.some((s) => s.key === e.aircraftKey) && (
                                <option value={e.aircraftKey}>
                                  {reference.shipByKey.get(e.aircraftKey)?.name ?? e.aircraftKey}
                                  {reference.shipByKey.get(e.aircraftKey)?.hidden ? ' (hidden)' : ' (not offered)'}
                                </option>
                              )}
                            </select>
                            <input
                              type="number"
                              min={1}
                              value={e.count}
                              style={{ maxWidth: 64 }}
                              onChange={(ev) => updateAircraft(e.id, { count: Math.max(1, Number(ev.target.value) || 1) })}
                            />
                            <button className="small danger" onClick={() => removeAircraft(e.id)}>×</button>
                          </div>
                        ))}
                        <button
                          className="small"
                          onClick={() => addAircraftToHangar(c.key, c.kind, h.ref)}
                          disabled={pending}
                        >
                          + Add aircraft
                        </button>
                      </div>
                    )
                  })}
                </div>
              )
            })}
            {orphanAircraft.length > 0 && (
              <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                <div>Assignments for carriers/hangars no longer in the fleet:</div>
                {orphanAircraft.map((a) => (
                  <span key={a.id} style={{ marginRight: 8 }}>
                    {reference.shipByKey.get(a.aircraftKey)?.name ?? a.aircraftKey} ×{a.count}
                    <button className="small danger" onClick={() => removeAircraft(a.id)}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="panel">
        <h3>Validation</h3>
        {issues.length === 0 ? (
          <p className="ok">✓ All checks pass</p>
        ) : (
          <div className="issues">
            {issues.map((iss, i) => (
              <div key={i} className={`issue ${iss.level}`}>{iss.message}</div>
            ))}
          </div>
        )}
        <h4 style={{ marginTop: 16, marginBottom: 6 }}>
          Hangar usage{' '}
          <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>
            — filled / total slots across all carriers
          </span>
        </h4>
        {carriers.length === 0 ? (
          <p className="muted">No carriers in the fleet.</p>
        ) : (
          <div className="totals" style={{ margin: '6px 0 0' }}>
            <span>Corvettes: <b className={corvAssigned > corvCap ? 'over' : ''}>{corvAssigned}/{corvCap}</b></span>
            <span>Fighters: <b className={ftrAssigned > ftrCap ? 'over' : ''}>{ftrAssigned}/{ftrCap}</b></span>
          </div>
        )}

        <h4 style={{ marginTop: 16, marginBottom: 6 }}>
          Incoming fire{' '}
          <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>
            — focus fire against the selected classes; direct fire and missiles reach different ships
          </span>
        </h4>
        <div className="toolbar">
          <label className="inline-check">
            <input
              type="checkbox"
              checked={incomingIncludeRF}
              onChange={(e) => setIncomingIncludeRF(e.target.checked)}
            />
            Include RF
          </label>
        </div>
        <div className="class-toggles">
          {TARGET_CLASSES.map((cls) => {
            const on = incomingClasses.includes(cls)
            return (
              <button
                key={cls}
                className={`small ${on ? 'pressed' : ''}`}
                aria-pressed={on}
                onClick={() => toggleIncomingClass(cls)}
              >
                {cls}
              </button>
            )
          })}
        </div>
        <p className="muted" style={{ fontSize: 12, margin: '2px 0 6px' }}>
          Only the selected classes count. Direct fire can only select the frontmost occupied row;
          missiles can select any row.
        </p>

        {incomingClasses.length === 0 ? (
          <p className="muted">Select at least one target class.</p>
        ) : (
          <table className="incoming-results">
            <thead>
              <tr><th></th><th>Direct fire</th><th>Missile</th></tr>
            </thead>
            <tbody>
              <tr>
                <td className="muted">Targets</td>
                <td>{targetLabel(directFire.targets) || '—'}</td>
                <td>{targetLabel(missileFire.targets) || '—'}</td>
              </tr>
              <tr>
                <td className="muted">Valid targets</td>
                <td><b>{directFire.validShips}</b></td>
                <td><b>{missileFire.validShips}</b></td>
              </tr>
              <tr>
                <td className="muted">Damage split</td>
                <td>{splitCell(directFire)}</td>
                <td>{splitCell(missileFire)}</td>
              </tr>
              <tr>
                <td className="muted">Next threshold</td>
                <td>{nextTierLabel(directFire)}</td>
                <td>{nextTierLabel(missileFire)}</td>
              </tr>
              <tr>
                <td className="muted">Screened</td>
                <td>{targetLabel(directFire.screened) || '—'}</td>
                <td className="muted">—</td>
              </tr>
            </tbody>
          </table>
        )}

        <p className="muted" style={{ fontSize: 12, margin: '2px 0' }}>
          {directFire.engagedRow
            ? `Direct fire is engaging the ${directFire.engagedRow.toLowerCase()} row.`
            : 'No ships fielded.'}
        </p>

        <h4 style={{ marginTop: 16, marginBottom: 6 }}>
          Focus fire thresholds{' '}
          <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>
            — copies attacked at once
          </span>
        </h4>
        <table>
          <thead>
            <tr><th>Valid targets</th><th className="num">Ships attacked</th><th>Your fleet</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>1–4</td>
              <td className="num">1</td>
              <td>{tierMarkers('low')}</td>
            </tr>
            {FOCUS_TIERS.map((tier) => (
              <tr key={tier.min}>
                <td>{tier.max === Infinity ? `${tier.min}+` : `${tier.min}–${tier.max}`}</td>
                <td className="num">{tier.ships}</td>
                <td>{tierMarkers(tier)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h4 style={{ marginTop: 16, marginBottom: 6 }}>
          Build counts{' '}
          <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>
            — total copies per base:variant; check against in-game build limits
          </span>
        </h4>
        {buildCounts.length === 0 ? (
          <p className="muted">No units or aircraft in the fleet yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th><button className="sort-btn" onClick={() => toggleSort('name')}>Unit{sortArrow('name')}</button></th>
                <th><button className="sort-btn" onClick={() => toggleSort('key')}>Key{sortArrow('key')}</button></th>
                <th><button className="sort-btn" onClick={() => toggleSort('class')}>Class{sortArrow('class')}</button></th>
                <th className="num"><button className="sort-btn" onClick={() => toggleSort('count')}>Copies{sortArrow('count')}</button></th>
              </tr>
            </thead>
            <tbody>
              {sortedCounts.map((c) => (
                <tr key={c.key}>
                  <td>
                    <ShipIcon shipKey={c.key} classFallback={c.class} />
                    {c.name}
                  </td>
                  <td className="muted">{c.key}</td>
                  <td>{c.class}</td>
                  <td className="num">{c.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

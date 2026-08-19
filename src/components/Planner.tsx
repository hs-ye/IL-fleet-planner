import type { Dispatch, SetStateAction } from 'react'
import type { FleetPlan, FleetUnit, AircraftAssignment, Side, Row } from '../types'
import type { Reference } from '../reference'
import { validatePlan } from '../reference'
import { uid } from '../serialize'

const ROWS: Row[] = ['Front', 'Mid', 'Back']

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

  const updateUnit = (id: string, patch: Partial<FleetUnit>) =>
    setPlan((p) => ({ ...p, units: p.units.map((u) => (u.id === id ? { ...u, ...patch } : u)) }))
  const addUnit = (side: Side) =>
    setPlan((p) => ({
      ...p,
      units: [...p.units, { id: uid(), side, unitKey: '', unitKind: 'ship', row: 'Mid', count: 1 }],
    }))
  const removeUnit = (id: string) =>
    setPlan((p) => ({ ...p, units: p.units.filter((u) => u.id !== id) }))

  const updateAircraft = (id: string, patch: Partial<AircraftAssignment>) =>
    setPlan((p) => ({ ...p, aircraft: p.aircraft.map((a) => (a.id === id ? { ...a, ...patch } : a)) }))
  const addAircraft = () =>
    setPlan((p) => ({
      ...p,
      aircraft: [
        ...p.aircraft,
        { id: uid(), aircraftKey: '', carrierKey: '', carrierKind: 'ship', hangarRef: '', count: 1 },
      ],
    }))
  const removeAircraft = (id: string) =>
    setPlan((p) => ({ ...p, aircraft: p.aircraft.filter((a) => a.id !== id) }))

  const onUnitChange = (id: string, key: string) => {
    const u = reference.lookupUnit(key)
    if (!u) return
    const patch: Partial<FleetUnit> = { unitKey: key, unitKind: u.kind }
    const drow = reference.unitDefaultRow(key)
    if (drow) patch.row = drow as Row
    updateUnit(id, patch)
  }

  const mainUnits = plan.units.filter((u) => u.side === 'Main')
  const rfUnits = plan.units.filter((u) => u.side === 'RF')
  const mainCp = mainUnits.reduce((a, u) => a + (reference.unitCp(u.unitKey) ?? 0) * u.count, 0)
  const rfCp = rfUnits.reduce((a, u) => a + (reference.unitCp(u.unitKey) ?? 0) * u.count, 0)
  const rfTypes = new Set(rfUnits.map((u) => u.unitKey)).size
  const combinedCp = mainCp + rfCp

  const setConfig = (patch: Partial<FleetPlan>) => setPlan((p) => ({ ...p, ...patch }))

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
                  <select
                    className="wide"
                    value={u.unitKey}
                    onChange={(e) => onUnitChange(u.id, e.target.value)}
                  >
                    <option value="">— select —</option>
                    {reference.unitList().map((x) => (
                      <option key={x.key} value={x.key}>{x.label}</option>
                    ))}
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
                    min={1}
                    value={u.count}
                    onChange={(e) => updateUnit(u.id, { count: Math.max(1, Number(e.target.value) || 1) })}
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
        <span>CP: <b className={side === 'Main' ? (totalCp > plan.mainMaxCp ? 'over' : 'ok') : totalCp > plan.rfMaxCp ? 'over' : 'ok'}>{totalCp}</b> / {side === 'Main' ? plan.mainMaxCp : plan.rfMaxCp}</span>
        {side === 'RF' && <span>Ship types: <b className={rfTypes > plan.rfMaxShips ? 'over' : 'ok'}>{rfTypes}</b> / {plan.rfMaxShips}</span>}
      </div>
    </div>
  )

  return (
    <div>
      <div className="panel">
        <h3>Plan settings</h3>
        <div className="config-grid">
          <label>Server
            <input type="text" value={plan.server} onChange={(e) => setConfig({ server: e.target.value })} />
          </label>
          <label>Main max CP
            <input type="number" min={10} step={10} value={plan.mainMaxCp} onChange={(e) => setConfig({ mainMaxCp: Number(e.target.value) || 0 })} />
          </label>
          <label>RF max CP
            <input type="number" min={10} step={10} value={plan.rfMaxCp} onChange={(e) => setConfig({ rfMaxCp: Number(e.target.value) || 0 })} />
          </label>
          <label>RF max ships (1–9)
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

      <div className="panel">
        <h3>Aircraft assignment</h3>
        {carriers.length === 0 ? (
          <p className="muted">Field a carrier (ship or template with hangars) in the fleet to assign aircraft.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Aircraft</th><th>Carrier</th><th>Hangar</th><th className="num">Count</th><th></th></tr>
            </thead>
            <tbody>
              {plan.aircraft.map((a) => {
                const carrier = carriers.find((c) => c.key === a.carrierKey && c.kind === a.carrierKind)
                return (
                  <tr key={a.id}>
                    <td>
                      <select className="wide" value={a.aircraftKey} onChange={(e) => updateAircraft(a.id, { aircraftKey: e.target.value })}>
                        <option value="">— aircraft —</option>
                        {reference.aircraft().map((s) => (
                          <option key={s.key} value={s.key}>{s.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select className="wide" value={a.carrierKey} onChange={(e) => {
                        const c = carriers.find((x) => x.key === e.target.value)
                        updateAircraft(a.id, {
                          carrierKey: e.target.value,
                          carrierKind: c?.kind ?? 'ship',
                          hangarRef: c && c.hangars.length > 0 ? c.hangars[0].ref : '',
                        })
                      }}>
                        <option value="">— carrier —</option>
                        {carriers.map((c) => (
                          <option key={`${c.key}|${c.kind}`} value={c.key}>{carrierName(c.key, c.kind)}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select value={a.hangarRef} onChange={(e) => updateAircraft(a.id, { hangarRef: e.target.value })}>
                        <option value="">— hangar —</option>
                        {(carrier?.hangars ?? []).map((h) => (
                          <option key={h.ref} value={h.ref}>{h.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input type="number" min={1} value={a.count} onChange={(e) => updateAircraft(a.id, { count: Math.max(1, Number(e.target.value) || 1) })} />
                    </td>
                    <td><button className="small danger" onClick={() => removeAircraft(a.id)}>×</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <button className="small" style={{ marginTop: 6 }} onClick={addAircraft} disabled={carriers.length === 0}>+ Add aircraft</button>

        {carriers.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {carriers.map((c) => (
              <div key={`${c.key}|${c.kind}`} style={{ margin: '4px 0' }}>
                <span className="muted">{carrierName(c.key, c.kind)}:</span>{' '}
                {c.hangars.map((h) => (
                  <span key={h.ref} className="carry-cap" style={{ marginRight: 12 }}>
                    {h.ref} → {h.corvCapacity > 0 ? `${h.corvCapacity} corv` : ''}{h.corvCapacity > 0 && h.fighterCapacity > 0 ? ' + ' : ''}{h.fighterCapacity > 0 ? `${h.fighterCapacity} fighter${h.size ? ` (${h.size})` : ''}` : ''}
                  </span>
                ))}
              </div>
            ))}
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
      </div>
    </div>
  )
}

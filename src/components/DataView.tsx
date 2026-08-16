import { useState } from 'react'
import type { Reference } from '../reference'

type Which = 'ships' | 'modules' | 'templates'

export default function DataView({ reference }: { reference: Reference }) {
  const [which, setWhich] = useState<Which>('ships')
  const [filter, setFilter] = useState('')
  const f = filter.trim().toLowerCase()

  const match = (s: string) => s.toLowerCase().includes(f)

  return (
    <div>
      <div className="toolbar">
        <button className={which === 'ships' ? 'primary' : ''} onClick={() => setWhich('ships')}>Ships ({reference.ships.length})</button>
        <button className={which === 'modules' ? 'primary' : ''} onClick={() => setWhich('modules')}>Modules ({reference.modules.length})</button>
        <button className={which === 'templates' ? 'primary' : ''} onClick={() => setWhich('templates')}>Templates ({reference.templates.length})</button>
        <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter…" style={{ maxWidth: 180, marginLeft: 'auto' }} />
      </div>

      <div className="panel data-table">
        {which === 'ships' && (
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Base</th><th>Variant</th><th>Class</th><th className="num">CP</th>
                <th>Default row</th><th className="num">Corv</th><th className="num">Fighter</th><th>Size</th>
              </tr>
            </thead>
            <tbody>
              {reference.ships
                .filter((s) => !f || match(s.name) || (s.base && match(s.base)) || (s.class && match(s.class)))
                .map((s) => (
                  <tr key={s.key}>
                    <td>{s.name}</td>
                    <td className="muted">{s.base ?? ''}</td>
                    <td className="muted">{s.variant ?? ''}</td>
                    <td>{s.class}</td>
                    <td className="num">{s.cpCost ?? ''}</td>
                    <td>{s.defaultRow ?? ''}</td>
                    <td className="num">{s.fixedCorvSlots ?? ''}</td>
                    <td className="num">{s.fixedFighterSlots ?? ''}</td>
                    <td className="muted">{s.size ?? ''}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
        {which === 'modules' && (
          <table>
            <thead>
              <tr><th>Ship</th><th>Slot</th><th>Name</th><th className="num">Corv</th><th className="num">Fighter</th><th>Hangar size</th></tr>
            </thead>
            <tbody>
              {reference.modules
                .filter((m) => !f || match(m.name) || match(m.shipKey) || (m.slot && match(m.slot)))
                .map((m) => (
                  <tr key={`${m.shipKey}|${m.slot}|${m.name}`}>
                    <td className="muted">{m.shipKey}</td>
                    <td className="muted">{m.slot ?? ''}</td>
                    <td>{m.name}</td>
                    <td className="num">{m.corvCapacity || ''}</td>
                    <td className="num">{m.fighterCapacity || ''}</td>
                    <td className="muted">{m.hangarSize ?? ''}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
        {which === 'templates' && (
          <table>
            <thead>
              <tr><th>Name</th><th>Base ship</th><th className="num">Corv</th><th className="num">Fighter</th><th>Slots</th></tr>
            </thead>
            <tbody>
              {reference.templates
                .filter((t) => !f || match(t.name) || match(t.baseShipKey))
                .map((t) => (
                  <tr key={t.key}>
                    <td>{t.name}</td>
                    <td className="muted">{t.baseShipKey}</td>
                    <td className="num">{t.corvSlots || ''}</td>
                    <td className="num">{t.fighterSlots || ''}</td>
                    <td className="muted">
                      {Object.entries(t.slots).map(([slot, mod]) => `${slot}: ${mod}`).join(' · ') || '—'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

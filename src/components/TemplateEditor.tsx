import { useState } from 'react'
import type { Template } from '../types'
import type { Reference } from '../reference'
import { uid } from '../serialize'

interface Props {
  reference: Reference
  customTemplates: Template[]
  onCustomTemplatesChange: (list: Template[]) => void
}

export default function TemplateEditor({ reference, customTemplates, onCustomTemplatesChange }: Props) {
  const [name, setName] = useState('')
  const [baseShipKey, setBaseShipKey] = useState('')
  const [slots, setSlots] = useState<Record<string, string>>({})

  const templateable = reference.templateableShips()
  const slotLetters = baseShipKey ? reference.slotsForShip(baseShipKey) : []

  const corvSlots = slotLetters.reduce((acc, s) => acc + (reference.moduleByName.get(slots[s] ?? '')?.corvCapacity ?? 0), 0)
  const fighterSlots = slotLetters.reduce((acc, s) => acc + (reference.moduleByName.get(slots[s] ?? '')?.fighterCapacity ?? 0), 0)

  const reset = () => {
    setName('')
    setBaseShipKey('')
    setSlots({})
  }

  const handleSave = () => {
    const trimmed = name.trim()
    if (!trimmed || !baseShipKey) return
    if (reference.templates.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())) {
      alert('A template with this name already exists.')
      return
    }
    const tpl: Template = {
      key: uid(),
      name: trimmed,
      baseShipKey,
      slots: Object.fromEntries(Object.entries(slots).filter(([, v]) => v)),
      corvSlots,
      fighterSlots,
    }
    onCustomTemplatesChange([...customTemplates, tpl])
    reset()
  }

  const handleDelete = (key: string) => {
    onCustomTemplatesChange(customTemplates.filter((t) => t.key !== key))
  }

  return (
    <div>
      <div className="panel">
        <h3>New template</h3>
        <div className="config-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <label>Template name
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CV3000 - Corv Focus" />
          </label>
          <label>Base ship
            <select
              className="wide"
              value={baseShipKey}
              onChange={(e) => { setBaseShipKey(e.target.value); setSlots({}) }}
            >
              <option value="">— select —</option>
              {templateable.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
            </select>
          </label>
        </div>

        {baseShipKey && (
          <div className="config-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginTop: 10 }}>
            {slotLetters.map((slot) => (
              <label key={slot}>Slot {slot}
                <select
                  value={slots[slot] ?? ''}
                  onChange={(e) => setSlots({ ...slots, [slot]: e.target.value })}
                >
                  <option value="">— none —</option>
                  {reference.modulesForSlot(baseShipKey, slot).map((m) => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}

        {baseShipKey && (
          <div className="totals" style={{ marginTop: 10 }}>
            <span>Corv slots: <b>{corvSlots}</b></span>
            <span>Fighter slots: <b>{fighterSlots}</b></span>
          </div>
        )}

        <div className="toolbar" style={{ marginTop: 10 }}>
          <button className="primary" onClick={handleSave} disabled={!name.trim() || !baseShipKey}>Save template</button>
          <button onClick={reset}>Clear</button>
        </div>
      </div>

      <div className="panel">
        <h3>All templates ({reference.templates.length})</h3>
        <table>
          <thead>
            <tr><th>Name</th><th>Base ship</th><th className="num">Corv</th><th className="num">Fighter</th><th>Slots</th><th></th></tr>
          </thead>
          <tbody>
            {reference.templates.map((t) => {
              const isCustom = customTemplates.some((c) => c.key === t.key)
              return (
                <tr key={t.key}>
                  <td>{t.name}</td>
                  <td className="muted">{reference.shipByKey.get(t.baseShipKey)?.name ?? t.baseShipKey}</td>
                  <td className="num">{t.corvSlots}</td>
                  <td className="num">{t.fighterSlots}</td>
                  <td className="muted">{Object.entries(t.slots).map(([s, m]) => `${s}: ${m}`).join(' · ') || '—'}</td>
                  <td>{isCustom && <button className="small danger" onClick={() => handleDelete(t.key)}>×</button>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

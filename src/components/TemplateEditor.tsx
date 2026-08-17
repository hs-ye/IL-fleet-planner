import { useState, useRef, type ChangeEvent } from 'react'
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
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleExport = () => {
    const data = JSON.stringify(reference.templates, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'templates.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImportFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const arr = JSON.parse(String(reader.result)) as unknown
        if (!Array.isArray(arr)) throw new Error('not an array')
        const refKeys = new Set(reference.refTemplates.map((t) => t.key))
        const imported = (arr as Template[]).filter((t) => t && typeof t === 'object' && !refKeys.has(t.key))
        onCustomTemplatesChange(imported)
      } catch {
        alert('Invalid templates file (expected a JSON array of templates).')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div>
      <div className="panel">
        <h3>New template</h3>
        <div className="config-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <label>Template name
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CV3000 - Default" />
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
        <div className="toolbar">
          <h3 style={{ margin: 0, flexGrow: 1 }}>All templates ({reference.templates.length})</h3>
          <button className="small" onClick={handleExport}>Export templates</button>
          <button className="small" onClick={() => fileInputRef.current?.click()}>Import templates</button>
          <input ref={fileInputRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={handleImportFile} />
        </div>
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

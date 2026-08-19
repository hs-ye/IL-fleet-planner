import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { FleetPlan } from '../types'
import {
  uid,
  newPlan,
  listSavedPlans,
  savePlanToStorage,
  loadPlanFromStorage,
  deletePlanFromStorage,
  serializePlan,
  deserializePlan,
} from '../serialize'

interface Props {
  plan: FleetPlan
  setPlan: Dispatch<SetStateAction<FleetPlan>>
}

export default function PlanBar({ plan, setPlan }: Props) {
  const [saved, setSaved] = useState(() => listSavedPlans())
  const [shareOpen, setShareOpen] = useState(false)
  const [shareText, setShareText] = useState('')

  const refreshSaved = () => setSaved(listSavedPlans())
  const handleSave = () => {
    savePlanToStorage(plan)
    refreshSaved()
  }
  const handleLoad = (id: string) => {
    const p = loadPlanFromStorage(id)
    if (p) setPlan(p)
  }
  const handleNew = () => setPlan(newPlan())
  const handleSaveAs = () => {
    const name = prompt('Save plan as:', plan.name)
    if (!name || !name.trim()) return
    // Clone the current plan under a new id + name, then keep editing the clone.
    const clone: FleetPlan = { ...plan, id: uid(), name: name.trim() }
    savePlanToStorage(clone)
    refreshSaved()
    setPlan(clone)
  }
  const handleDelete = () => {
    deletePlanFromStorage(plan.id)
    refreshSaved()
  }
  const handleShare = () => {
    setShareText(serializePlan(plan))
    setShareOpen(true)
  }
  const handleCopy = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(shareText)
  }
  const handleImport = () => {
    try {
      setPlan(deserializePlan(shareText))
      setShareOpen(false)
    } catch {
      alert('Invalid share string.')
    }
  }

  return (
    <div className="panel">
      <div className="toolbar">
        <span className="muted">Plans:</span>
        <select value="" onChange={(e) => e.target.value && handleLoad(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">Load saved…</option>
          {saved.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <button onClick={handleNew}>New</button>
        <button className="primary" onClick={handleSave}>Save</button>
        <button onClick={handleSaveAs}>Save as</button>
        <button className="small danger" onClick={handleDelete} disabled={!saved.some((s) => s.id === plan.id)}>
          Delete saved
        </button>
        <span style={{ flexGrow: 1 }} />
        <button onClick={handleShare}>Share</button>
        <button onClick={() => setShareOpen(!shareOpen)}>{shareOpen ? 'Hide' : 'Import'}</button>
      </div>
      {shareOpen && (
        <div style={{ marginTop: 8 }}>
          <textarea
            value={shareText}
            onChange={(e) => setShareText(e.target.value)}
            rows={3}
            placeholder="Paste a share string here to import a plan"
            style={{ width: '100%', background: 'var(--panel2)', color: 'var(--text)', fontFamily: 'monospace', fontSize: 12 }}
          />
          <div className="toolbar" style={{ marginTop: 6 }}>
            <button onClick={handleCopy}>Copy</button>
            <button className="primary" onClick={handleImport}>Import</button>
          </div>
        </div>
      )}
    </div>
  )
}

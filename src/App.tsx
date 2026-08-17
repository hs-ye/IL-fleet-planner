import { useEffect, useMemo, useState } from 'react'
import type { ReferenceData, FleetPlan, Template } from './types'
import { Reference, loadReferenceData } from './reference'
import {
  uid,
  serializePlan,
  deserializePlan,
  listSavedPlans,
  savePlanToStorage,
  loadPlanFromStorage,
  deletePlanFromStorage,
} from './serialize'
import { loadTemplates, saveTemplates } from './templates'
import Planner from './components/Planner'
import DataView from './components/DataView'
import TemplateEditor from './components/TemplateEditor'

function newPlan(): FleetPlan {
  return {
    version: 1,
    id: uid(),
    name: 'New Plan',
    server: 'Generic',
    mainMaxCp: 300,
    rfMaxCp: 300,
    rfMaxShips: 5,
    units: [],
    aircraft: [],
  }
}

type Tab = 'planner' | 'data' | 'templates'

export default function App() {
  const [rawData, setRawData] = useState<ReferenceData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('planner')
  const [plan, setPlan] = useState<FleetPlan>(() => newPlan())
  const [saved, setSaved] = useState(() => listSavedPlans())
  const [templates, setTemplates] = useState<Template[]>([])
  const [shareOpen, setShareOpen] = useState(false)
  const [shareText, setShareText] = useState('')

  const reference = useMemo(
    () => (rawData ? new Reference(rawData, templates) : null),
    [rawData, templates],
  )

  useEffect(() => {
    loadReferenceData()
      .then((d) => {
        setRawData(d)
        setTemplates(loadTemplates(d.templates))
      })
      .catch((e) => setLoadError(String(e)))
  }, [])

  const handleTemplatesChange = (list: Template[]) => {
    setTemplates(list)
    saveTemplates(list)
  }

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
  const handleDeleteSaved = () => {
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

  if (loadError) {
    return (
      <div className="app">
        <h1>IL Fleet Planner</h1>
        <p className="over">Failed to load reference data: {loadError}</p>
      </div>
    )
  }
  if (!reference) {
    return (
      <div className="app">
        <h1>IL Fleet Planner</h1>
        <p className="muted">Loading reference data…</p>
      </div>
    )
  }

  return (
    <div className="app">
      <h1>IL Fleet Planner</h1>
      <div className="toolbar">
        <input
          type="text"
          value={plan.name}
          onChange={(e) => setPlan({ ...plan, name: e.target.value })}
          style={{ maxWidth: 200 }}
          placeholder="Plan name"
        />
        <button onClick={handleNew}>New</button>
        <button className="primary" onClick={handleSave}>Save</button>
        <select value="" onChange={(e) => e.target.value && handleLoad(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="">Load saved…</option>
          {saved.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <button className="small danger" onClick={handleDeleteSaved}>Delete saved</button>
        <button onClick={handleShare}>Share</button>
        <button onClick={() => setShareOpen(!shareOpen)}>{shareOpen ? 'Hide' : 'Import'}</button>
      </div>

      {shareOpen && (
        <div className="panel">
          <h3>Share / Import</h3>
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

      <div className="tabs">
        <button className={tab === 'planner' ? 'active' : ''} onClick={() => setTab('planner')}>Planner</button>
        <button className={tab === 'data' ? 'active' : ''} onClick={() => setTab('data')}>Reference Data</button>
        <button className={tab === 'templates' ? 'active' : ''} onClick={() => setTab('templates')}>Templates</button>
      </div>

      {tab === 'planner' && <Planner reference={reference} plan={plan} setPlan={setPlan} />}
      {tab === 'data' && <DataView reference={reference} />}
      {tab === 'templates' && <TemplateEditor reference={reference} onTemplatesChange={handleTemplatesChange} />}
    </div>
  )
}

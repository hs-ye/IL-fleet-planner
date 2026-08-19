import { useEffect, useMemo, useState } from 'react'
import type { ReferenceData, FleetPlan, Ship, Module, Template } from './types'
import { Reference, loadReferenceData } from './reference'
import { newPlan } from './serialize'
import { loadShips, saveShips, loadModules, saveModules, loadTemplates, saveTemplates } from './storage'
import PlanBar from './components/PlanBar'
import Planner from './components/Planner'
import DataView from './components/DataView'
import TemplateEditor from './components/TemplateEditor'

type Tab = 'planner' | 'data' | 'templates'

export default function App() {
  const [rawData, setRawData] = useState<ReferenceData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('planner')
  const [plan, setPlan] = useState<FleetPlan>(() => newPlan())
  const [ships, setShips] = useState<Ship[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [templates, setTemplates] = useState<Template[]>([])

  const reference = useMemo(
    () => (rawData ? new Reference({ version: 1, generated: '', ships, modules, templates }) : null),
    [rawData, ships, modules, templates],
  )

  useEffect(() => {
    loadReferenceData()
      .then((d) => {
        setRawData(d)
        setShips(loadShips(d.ships))
        setModules(loadModules(d.modules))
        setTemplates(loadTemplates(d.templates))
      })
      .catch((e) => setLoadError(String(e)))
  }, [])

  const handleShipsChange = (list: Ship[]) => { setShips(list); saveShips(list) }
  const handleModulesChange = (list: Module[]) => {
    // Recompute template totals from the (possibly changed) modules so the
    // Templates page and exports stay in sync with the planner.
    const byName = new Map(list.map((m) => [m.name, m]))
    const newTemplates = templates.map((t) => {
      let corv = 0
      let ftr = 0
      for (const modName of Object.values(t.slots)) {
        const mod = byName.get(modName)
        if (mod) {
          corv += mod.corvCapacity
          ftr += mod.fighterCapacity
        }
      }
      return t.corvSlots === corv && t.fighterSlots === ftr ? t : { ...t, corvSlots: corv, fighterSlots: ftr }
    })
    setModules(list)
    saveModules(list)
    if (newTemplates.some((t, i) => t !== templates[i])) {
      setTemplates(newTemplates)
      saveTemplates(newTemplates)
    }
  }
  const handleTemplatesChange = (list: Template[]) => { setTemplates(list); saveTemplates(list) }
  const resetShips = () => { if (rawData) { setShips(rawData.ships); saveShips(rawData.ships) } }
  const resetModules = () => { if (rawData) { setModules(rawData.modules); saveModules(rawData.modules) } }
  const resetTemplates = () => { if (rawData) { setTemplates(rawData.templates); saveTemplates(rawData.templates) } }

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

      <div className="tabs">
        <button className={tab === 'planner' ? 'active' : ''} onClick={() => setTab('planner')}>Planner</button>
        <button className={tab === 'data' ? 'active' : ''} onClick={() => setTab('data')}>Reference Data</button>
        <button className={tab === 'templates' ? 'active' : ''} onClick={() => setTab('templates')}>Templates</button>
      </div>

      {tab === 'planner' && (
        <>
          <PlanBar plan={plan} setPlan={setPlan} />
          <Planner reference={reference} plan={plan} setPlan={setPlan} />
        </>
      )}
      {tab === 'data' && (
        <DataView
          reference={reference}
          onShipsChange={handleShipsChange}
          onModulesChange={handleModulesChange}
          onResetShips={resetShips}
          onResetModules={resetModules}
        />
      )}
      {tab === 'templates' && (
        <TemplateEditor reference={reference} onTemplatesChange={handleTemplatesChange} onResetTemplates={resetTemplates} />
      )}
    </div>
  )
}

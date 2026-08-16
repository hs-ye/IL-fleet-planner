import type { FleetPlan } from './types'

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function serializePlan(plan: FleetPlan): string {
  const bytes = new TextEncoder().encode(JSON.stringify(plan))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

export function deserializePlan(s: string): FleetPlan {
  const bin = atob(s.trim())
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes)) as FleetPlan
}

const STORAGE_KEY = 'il-fleet-planner:plans'
const planKey = (id: string) => `${STORAGE_KEY}:${id}`

interface SavedMeta {
  id: string
  name: string
}

export function listSavedPlans(): SavedMeta[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as SavedMeta[]
  } catch {
    return []
  }
}

export function savePlanToStorage(plan: FleetPlan): void {
  const metas = listSavedPlans().filter((p) => p.id !== plan.id)
  metas.push({ id: plan.id, name: plan.name })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(metas))
  localStorage.setItem(planKey(plan.id), JSON.stringify(plan))
}

export function loadPlanFromStorage(id: string): FleetPlan | null {
  const raw = localStorage.getItem(planKey(id))
  if (!raw) return null
  try {
    return JSON.parse(raw) as FleetPlan
  } catch {
    return null
  }
}

export function deletePlanFromStorage(id: string): void {
  const metas = listSavedPlans().filter((p) => p.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(metas))
  localStorage.removeItem(planKey(id))
}

import type { Template } from './types'

const KEY = 'il-fleet-planner:custom-templates'

export function loadCustomTemplates(): Template[] {
  const raw = localStorage.getItem(KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as Template[]
  } catch {
    return []
  }
}

export function saveCustomTemplates(list: Template[]): void {
  localStorage.setItem(KEY, JSON.stringify(list))
}

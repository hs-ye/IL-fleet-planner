# Infinite Lagrange Fleet Planner — Design Notes

> **Purpose:** a condensed record of the key goals and design choices that shaped the fleet
> planner. This is the *why* — detailed requirements live in the Web App Spec
> (`IL Fleet Planner - Web App Spec.md`, in `~/Dropbox/Analysis/`).

---

## 1. Goals

- Plan a **Main fleet + Reinforcement (RF) fleet** for *Infinite Lagrange* under the game's
  Command Point (CP) and ship-count limits.
- **Assign aircraft** (fighters/corvettes) to carriers within hangar capacity — corvette docks
  and fighter hangars, size-capped for fighters.
- **Validate in real time** against the game's rules, with human-readable messages (no raw
  keys/UUIDs ever shown).
- **Curatable reference data** — ships, modules, templates are edited in-app and exported;
  the web app is the source of truth (the Excel workbook is deprecated).
- **Multi-plan workflow** — save/load/swap/share several fleet designs in the browser.

## 2. Architecture

- **Stack:** React 18 + TypeScript + Vite. Fully client-side — no backend, no build-time
  data pipeline. `npm run build` = `tsc && vite build`.
- **Persistence:** browser `localStorage` only, two namespaces:
  - reference data: `il-fleet-planner:ships|modules|templates` (seed-once + Reset buttons)
  - plans: `il-fleet-planner:plans` (meta index) + `il-fleet-planner:plan:<id>`
- **Modules:**
  | File | Responsibility |
  |---|---|
  | `App.tsx` | tabs, plan state, reference-data seeding/change wiring |
  | `components/Planner.tsx` | fleet editor: units, CP, hangar-first aircraft assignment, validation UI, build counts |
  | `components/PlanBar.tsx` | plan management: load/new/save/save-as/delete/share/import |
  | `components/DataView.tsx` + `EditableTable.tsx` | Excel-style inline grids for ships/modules |
  | `components/TemplateEditor.tsx` | template editor with live totals + missing-module warnings |
  | `reference.ts` | Reference class: lookups, `carriersInPlan`, `validatePlan` |
  | `serialize.ts` | plan new/serialize/deserialize + storage |
  | `storage.ts` | reference-data read/write |
  | `types.ts` | all shared types |

## 3. Data model (essentials)

- **Ship** — `key = "base:variant"` (stable identity, e.g. `Jaeger:A`); `name` is a mutable
  nickname; `class` (Frigate … Carrier), `cpCost`, `size`, fixed hangar slots.
- **Module** — `shipKey`, `slot` (M/A/…), `name`, `corvCapacity`, `fighterCapacity`,
  `hangarSize`. Supercapitals have no built-in hangar; capacity comes from modules.
- **Template** — `baseShipKey`, `slots {slot → moduleName}`, computed totals. Resolves to a
  concrete ship+modules config. Default templates follow an **M1 + A1** rule
  (`scripts/generate_default_templates.py`).
- **FleetPlan** — `id`, `name`, `fleetMaxCp` (shared budget, §5.4), `rfMaxShips` (1–9,
  default 5), `units[]`, `aircraft[]`.
- **FleetUnit** — `side` (Main/RF), `unitKey`, `unitKind` (`ship`|`template`), `row`
  (Front/Mid/Back), `count` (may be 0, §5.9).
- **AircraftAssignment** — `aircraftKey`, `carrierKey`, `carrierKind`, `hangarRef`, `count`.

## 4. Reference data flow

```
curate in-app (editable grids)  →  Export buttons  →  public/reference-data/*.json  →  git
        ↓ seed-once on first load              ↑ Reset buttons re-seed from JSON
   localStorage (user edits live here)
```

- Modules→templates flow through **by name**: template totals are recomputed live from the
  current module list, and the planner reads hangar capacities live by name — no snapshots.
- `scripts/export_reference.py` was **deleted** — Excel sync is deprecated (spec §8).

## 5. Key design decisions

### 5.1 `base:variant` is the identity everywhere
In-game build limits, hangar capacities and CP all key on `(base, variant)`. Names get
renamed by the game, so the composite key is the stable identity; the name is display-only.
Build counts, validation grouping and aircraft lookup all use it.

### 5.2 Supercaps via templates only; aircraft hangar-only
- Raw supercapitals are **filtered out** of the fleet-unit dropdown (use a template instead);
  legacy plans get a warning, not a hard error.
- Fighters/corvettes are **filtered out** of the fleet-unit dropdown (hangar-only); legacy
  plans get a warning. Aircraft don't consume CP for fleet-composition purposes.

### 5.3 Hangar-first aircraft assignment
Original UX (pick aircraft → carrier → hangar per row) was replaced by **auto-populated
hangar boxes** for every fielded carrier (Main + RF combined):
- users **add aircraft into each hangar**, mixing different models freely (same-model adds
  **merge counts** instead of duplicating rows);
- per-hangar **live counters** `loaded/capacity` (× fleet copies) for corvettes and fighters,
  red when over;
- dropdowns are **filtered by hangar kind/size** (corvette dock → corvettes only; fighter
  hangar → fighters ≤ size; mixed/Large → everything);
- stale assignments (carrier removed) surface in a removable orphan list.

### 5.4 One shared fleet CP budget
`mainMaxCp`/`rfMaxCp` were merged into a single **`fleetMaxCp`** (default 300): the game's
fleet CP applies to both Main and RF, so one setting drives both counters and both
validation checks. Legacy plans migrate by deriving `fleetMaxCp` from the old main budget.

### 5.5 RF limit counts instances, not types
The RF ship limit (default 5, up to 9) caps **total copies** (`Σ unit.count`), not distinct
types — matching the game. 6 copies of one ship now correctly trips the limit.

### 5.6 Build counts table
Validation panel shows total copies **per `base:variant`** across ships, templates (via their
base ship) and aircraft, with a **ship class column** and **sortable columns**
(Unit/Key/Class/Copies). Display-only — no limit enforcement yet (future feature; the
in-game rule is roughly 10 copies regular, 5–6 supercaps).

### 5.7 Aggregate hangar usage
Validation panel also shows fleet-wide `filled/total` counters for **corvettes and fighters
separately** (fighters treated uniformly across all hangars), red when over.

### 5.8 Plan management lives on the Planner tab
Plan name moved into **Plan settings**; a `PlanBar` owns the multi-plan workflow:
**Load saved…** dropdown, **New**, **Save**, **Save as** (clone under a new name + switch to
it), **Delete saved** (disabled until the current plan is actually saved), and **Share /
Import** (base64 strings; imported plans can be saved into the dropdown). No plan UI leaks
onto the Reference/Templates tabs; the `server` field from the Excel era was removed.

### 5.9 Auto-cleanup with toasts
Removing a ship, **swapping** a unit to a different ship, or setting a carrier's copies to
**0** clears every aircraft assigned to its hangars — no orphaned "isn't fielded" errors —
with a toast: *"Removed Jaeger Air — cleared 2 aircraft from its hangars"* (4s auto-dismiss).
The heuristic is deliberately simple: clear *all* aircraft for the removed carrier rather
than guessing.

### 5.10 0 copies is a valid count
Count inputs accept **0** (mix/match comparison without deleting rows): the ship stays in
Build counts at `×0`, contributes 0 CP, its hangar boxes hide, and its aircraft are cleared
(§5.9).

### 5.11 Human-readable names everywhere
Validation messages resolve carrier display names + hangar labels (e.g.
`Hangar "Corvette dock" on "Jaeger Air": 1 fighters over capacity 0`) — never raw keys or
template UUIDs.

### 5.12 Responsive layout
One CSS breakpoint at **860px** (shared by the Main/RF fleet grid): wide/landscape screens
get the Aircraft assignment + Validation panels **side-by-side**; narrow/portrait stacks them
vertically. Pure CSS grid, no JS.

### 5.13 Migration path
`normalizePlan()` in `serialize.ts` fills missing fields on load *and* import (e.g. legacy
`mainMaxCp`/`rfMaxCp` → `fleetMaxCp`), so old saved plans and shared strings keep working.

## 6. Validation rules (current)

| Rule | Level | Message example |
|---|---|---|
| Main fleet CP over budget | error | `Main fleet CP 420 exceeds budget 300` |
| RF CP over budget | error | `RF CP 150 exceeds budget 300` |
| RF instances over limit | error | `RF has 6 ship instances (limit 5)` |
| Raw supercap as unit (legacy) | warning | `Supercap "CV3000" should be used via a template, not as a raw ship` |
| Aircraft as fleet unit (legacy) | warning | `Aircraft "Strix A100" should be loaded into a hangar, not fielded as a fleet unit` |
| Aircraft for unfielded carrier | warning | `Aircraft assigned to "Jaeger Air" which isn't fielded in the fleet` |
| Hangar ref missing on carrier | error | `Hangar "Slot M — …" not found on "CV3000"` |
| Corvette in non-corvette hangar | error | `Corvette "CV-T800" assigned to a non-corvette hangar on "Jaeger Air"` |
| Fighter in non-fighter hangar / too large | error | `Fighter "Strix A100" assigned to a non-fighter hangar on "…"` |
| Hangar over capacity | error | `Hangar "Corvette dock" on "Jaeger Air": 3 corvettes over capacity 2` |

## 7. Notable non-goals / future

- **Build-limit enforcement** (10× regular / 5–6× supercap per `base:variant`) — the counter
  exists (§5.6); enforcing it is a later feature.
- **Excel round-trip** — explicitly deprecated; reference data lives in the web app + JSON.
- No accounts/cloud sync — single-browser localStorage by design.

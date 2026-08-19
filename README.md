# Infinite Lagrange Fleet Planner

Plan Main + Reinforcement fleets for *Infinite Lagrange* — CP budgets, hangar-loaded
aircraft, and real-time validation — entirely in your browser.

**▶ Live app:** https://hs-ye.github.io/IL-fleet-planner/

Everything is stored in **your browser's localStorage** — no account, no server, no data
leaves your machine (except what you explicitly share/export).

---

## Quick start

1. Open the **Planner** tab.
2. In **Plan settings**, set your **Fleet max CP** (e.g. 420) and **RF max ship instances**
   (5 base, up to 9 upgraded). Both fleets share the same CP budget.
3. Under **Main Fleet** / **Reinforcement (RF)**, click **+ Add ship / template** and pick a
   ship. Set **Row** (Front/Mid/Back) and **Count** — 0 is allowed, handy for comparing
   designs.
4. Field a carrier, then load aircraft into it:
   - the **Aircraft assignment** panel auto-lists every hangar in your fleet;
   - click **+ Add aircraft** in a hangar and pick a model (the list only shows what fits
     that hangar — corvettes for docks, size-capped fighters for hangars);
   - you can **mix different models** in one hangar; adding the same model again merges its
     count.
5. Watch the **Validation** panel: rule errors, fleet-wide **hangar usage**
   (corvettes/fighters), and **build counts** per `base:variant` (sortable, includes ship
   class).

## Plans — save, load, share

The **Plans** bar on the Planner tab:

| Button | What it does |
|---|---|
| **Load saved…** | dropdown of saved plans — pick one to switch |
| **New** | start a blank plan |
| **Save** | save the current plan (replaces the saved copy of the same name) |
| **Save as…** | clone the current plan under a new name and switch to the clone |
| **Delete saved** | delete the current plan (disabled until it's saved) |
| **Share** | show the current plan as a share string |
| **Import** | paste a share string to load that plan, then **Save** to keep it |

**Export/import between browsers:** *Share* → copy the string → on the other machine
*Import* → paste → *Save*. The imported plan then appears in **Load saved…** like any other.

Plan name, CP budget and RF limit live in **Plan settings** (Planner tab only).

## Templates (supercap configs)

Supercapitals (Battlecruiser/Carrier/Auxiliary/Battleship) have **module slots** (M/A/…)
that decide their hangar capacity — you field them via a **template**, never as a raw ship.

- The app ships with a **"<Ship> - Default"** template for every supercap (basic M1 + A1
  modules).
- In the **Templates** tab you can:
  - **edit** a template's slots (choose which module fills each slot) — hangar totals
    recompute live;
  - **delete** templates, **Reset** to the bundled defaults;
  - **Export** the current template set as JSON.
- A ⚠ on a template means it references a module that's missing/renamed in your data —
  re-pick the slot from the dropdown.
- Changing module hangar capacity (Reference Data tab) flows through to templates and the
  planner automatically.

## Reference data — ships & modules

The **Reference Data** tab has editable Ships and Modules tables (every cell is an inline
input; Tab moves across cells).

- Data is **seeded once** from the bundled JSON into your browser. **Reset ships/modules**
  re-seeds from the bundled copy.
- **Export ships / Export modules** downloads the current (edited) data as JSON — useful to
  back up your curation or hand it to someone.
- The app's bundled data lives in `public/reference-data/*.json` in the repo — you can edit
  there and the Reset buttons pick it up.

**Workflow for curators:** edit in-app → Export → update the JSON files → commit → everyone
who hits Reset gets the new data.

## Validation & counters

- **Errors** (red): CP over budget, RF instance limit, wrong hangar type, fighter too large,
  hangar over capacity.
- **Warnings** (amber): legacy plans that field supercaps raw or aircraft as fleet units.
- **Hangar usage**: filled/total slots across the whole fleet, corvettes and fighters
  separately.
- **Build counts**: total copies per `base:variant` — check against in-game build limits
  (~10 regular ships, 5–6 supercaps). Enforcement is a planned feature.
- Removing a ship (or setting its count to 0) **auto-clears its hangar's aircraft** with a
  toast — no orphaned assignments.

---

## Running locally

```bash
git clone git@github.com:hs-ye/IL-fleet-planner.git
cd IL-fleet-planner
npm install
npm run dev        # dev server with hot reload → http://localhost:5173
```

Production build:

```bash
npm run build      # type-check + bundle → dist/
npm run preview    # serve the built app locally
```

Notes:
- localStorage is **per origin** — data saved on `localhost:5173` is separate from the
  github.io deployment (and vice versa). Nothing is shared automatically.
- A `docs/design.md` in the repo explains the architecture and design decisions behind the
  app.
- Ship and class icons are from [Gravity Assist](https://github.com/kennething/gravity-assist)
  (MIT, © Kenneth Ng) — see `public/ships/LICENSE.md`.

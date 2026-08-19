"""Generate default supercap templates (M1 + A1) into templates.json.

Rule: every supercap comes with its M1 and A1 modules unlocked by default;
all other modules must be unlocked. A default template = base ship + M1 in
slot M + A1 in slot A.

Aux ships (FSV830 / Ediacaran) have no M/A slots in their base config, so
they use an explicit override of the modules the game ships them with.

Run:  uv run python scripts/generate_default_templates.py
"""
import json
import os
import re

REF = r"C:\GitRepos\IL-fleet-planner\public\reference-data"

with open(os.path.join(REF, "ships.json"), encoding="utf-8") as f:
    ships = json.load(f)
with open(os.path.join(REF, "modules.json"), encoding="utf-8") as f:
    modules = json.load(f)

name_by_key = {s["key"]: s["name"] for s in ships}

by_ship = {}
for m in modules:
    by_ship.setdefault(m["shipKey"], []).append(m)


def slot_id(name: str, slot: str):
    m = re.search(re.escape(slot) + r"(\d+)", name or "")
    return int(m.group(1)) if m else None


# Ships whose default loadout isn't M1+A1 (Aux ships with different base modules).
BASE_OVERRIDES = {
    "FSV830:A": [("B", 1), ("D", 1)],
    "Ediacaran:A": [("M", 1), ("B", 1), ("D", 1)],
}

templates = []
missing = []
for key, mods in by_ship.items():
    slots, corv, ftr, missed = {}, 0, 0, []
    override = BASE_OVERRIDES.get(key)
    picks = override or [("M", 1), ("A", 1)]
    for slot, idx in picks:
        mod = next((m for m in mods if m["slot"] == slot and slot_id(m["name"], slot) == idx), None)
        if mod:
            slots[slot] = mod["name"]
            corv += mod["corvCapacity"]
            ftr += mod["fighterCapacity"]
        else:
            missed.append(f"{slot}{idx}")

    display = name_by_key.get(key, key)
    templates.append({
        "key": f"{display} - Default",
        "name": f"{display} - Default",
        "baseShipKey": key,
        "slots": slots,
        "corvSlots": corv,
        "fighterSlots": ftr,
    })
    if missed:
        missing.append((display, missed))

templates.sort(key=lambda t: t["name"])

with open(os.path.join(REF, "templates.json"), "w", encoding="utf-8") as f:
    json.dump(templates, f, ensure_ascii=False, indent=2)

print(f"Wrote {len(templates)} default templates")
for display, missed in missing:
    print(f"  PARTIAL {display}: missing {', '.join(missed)}")

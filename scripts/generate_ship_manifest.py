"""Generate src/ship-images.json: map our ship keys to vendored ship PNGs.

Heuristic: key "Base:V" -> slug(base) + "_" + V.lower() + ".png" against
public/ships/. Ships whose filename differs from the slug go in OVERRIDES.
Ships with no image are simply absent from the manifest (UI falls back to
the class SVG icon). Prints coverage + gaps.

Run:  python scripts/generate_ship_manifest.py
"""
import json
import os
import re

ROOT = r"C:\GitRepos\IL-fleet-planner"
SHIPS = os.path.join(ROOT, "public", "reference-data", "ships.json")
IMG_DIR = os.path.join(ROOT, "public", "ships")
OUT = os.path.join(ROOT, "src", "ship-images.json")

# Filenames in the gravity-assist set that don't match slug(base)_v.png.
OVERRIDES = {
    "Hale-Bopp:A": "haleBopp_a.png",
    "Hale-Bopp:B": "haleBopp_b.png",
    "Newland B192:A": "b192_newland_a.png",
    "S-Levy 9:A": "slevy_9_a.png",
    "Levy:A": "slevy_9_a.png",
    "Hayreddin's Loyals:A": "hayreddins_loyal_a.png",
    "Carillion:A": "carilion_a.png",
    "Carillion:B": "carilion_b.png",
    "Carillion:C": "carilion_c.png",
    "KCCPV2.0:A": "kccpv20_a.png",
    "KCCPV2.0:B": "kccpv20_b.png",
    "KCCPV2.0:C": "kccpv20_c.png",
    "KCCPV2.0:D": "kccpv20_d.png",
    "NOMA 330:A": "noma_m470_a.png",
    "NOMA 330:B": "noma_m470_b.png",
    "NOMA 330:C": "noma_m470_c.png",
    "AC721:C": "ac721_d.png",
    "CV-T800:A": "cvt800_a.png",
    "CV-M011:A": "cvm011_a.png",
    "CV-M011:B": "cvm011_b.png",
    "CV-M011:C": "cvm011_c.png",
    "CV-II003:A": "cvii003_a.png",
    "RedBeast 7-13:A": "redbeast_713_a.png",
    "RedBeast 7-13:B": "redbeast_713_b.png",
    "Tempel:A": "tempel_i_a.png",
    "Tempel:B": "tempel_i_b.png",
}


def slug(base: str) -> str:
    s = base.lower()
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
    return s


def main() -> None:
    with open(SHIPS, encoding="utf-8") as f:
        ships = json.load(f)
    files = {f for f in os.listdir(IMG_DIR) if f.endswith(".png")}

    manifest, unmatched = {}, []
    for s in ships:
        key, base, variant = s["key"], s["base"], s["variant"]
        candidate = f"{slug(base)}_{variant.lower()}.png"
        if candidate in files:
            manifest[key] = candidate
        elif key in OVERRIDES and OVERRIDES[key] in files:
            manifest[key] = OVERRIDES[key]
        else:
            unmatched.append(f"{key}  (name: {s['name']})")

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2, sort_keys=True)

    print(f"Manifest: {len(manifest)}/{len(ships)} ships have icons "
          f"({len(files)} image files available)")
    if unmatched:
        print("\nNo image found for:")
        for u in unmatched:
            print("  ", u)


if __name__ == "__main__":
    main()

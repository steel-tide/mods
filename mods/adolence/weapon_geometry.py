"""Measured firing geometry for Adolence's up-facing vehicle art.

Coordinates are source-image pixels (x right, y down), before fw/fh scaling.
Barrel boxes exclude fixed mantlets, sights and coaxial guns. Reference frame
sizes retain the measurements when symmetric transparent padding changes;
changes to the artwork itself need new measurements.
"""
from pathlib import Path
from PIL import Image

DISPLAY = 1.5625

# suffix: (reference frame size, exposed barrel boxes, weapon geometry)
# weapon id: (muzzle points, recoil stroke in art pixels)
TURRETS = {
    "light-tank-lmg": ((27, 84), [(10, 1, 16, 24)], {"main": ([(13.5, 1)], 0.6)}),
    "light-tank-mg": ((27, 84), [(10, 1, 16, 24)], {"main": ([(13.5, 1)], 0.7)}),
    "light-tank": ((22, 83), [(9, 4, 14, 24)], {"main": ([(11.5, 4)], 1.2)}),
    "light-tank-missile": ((27, 31), [], {"1": ([(6.5, 1), (20.5, 1)], 0)}),
    "light-tank-flame": ((17, 64), [], {"1": ([(8.5, 1)], 0)}),
    "light-tank-sniper": ((16, 60), [(5, 1, 11, 20)], {"main": ([(8, 1)], 1.8)}),
    "heavy-tank": ((29, 93), [(10, 1, 19, 29)], {"1": ([(14.5, 1)], 2.2)}),
    "m1128": ((127, 141), [(62, 11, 66, 59)], {
        "gun": ([(64, 11)], 1.8), "coax": ([(60, 67.5)], 0),
    }),
    "m1a2": ((94, 152), [(44, 2, 49, 48)], {
        "gun": ([(46.5, 2)], 2), "coax": ([(50, 40)], 0),
    }),
    "m1a2-tusk": ((57, 152), [(25, 2, 30, 48)], {
        "gun": ([(27.5, 2)], 2), "coax": ([(31, 40)], 0),
    }),
    "m1a2-sepv3": ((94, 152), [(44, 2, 49, 48)], {
        "gun": ([(46.5, 2)], 2), "coax": ([(50, 40)], 0),
    }),
    "m1a1-clickbait": ((67, 152), [(30, 2, 35, 48)], {
        "gun": ([(32.5, 2)], 2), "coax": ([(36, 40)], 0),
    }),
    "light-ifv": ((13, 32), [(5, 1, 8, 10)], {"1": ([(6.5, 1)], 0.4)}),
    "heavy-ifv": ((13, 32), [(5, 1, 8, 10)], {"1": ([(6.5, 1)], 0.4)}),
    "extremism": ((35, 114), [(12, 1, 23, 36)], {"1": ([(17.5, 1)], 2.4)}),
}


def apply_weapon_geometry(manifest, asset_dir):
    """Use the actual saved sheets, including their rounded, per-axis sizes."""
    sheets = {s["key"]: s for s in manifest["sprites"]}
    for definition in manifest["defs"]:
        suffix = definition["id"].removeprefix("adolence-")
        if suffix not in TURRETS:
            continue
        reference, barrels, weapons = TURRETS[suffix]
        sheet = sheets[definition["turretSprite"]]
        with Image.open(Path(asset_dir) / sheet["file"]) as image:
            width, height = image.size
        if sheet.get("frames", 1) != 1 or height != reference[1]:
            raise ValueError(f"{suffix}: changed turret art needs new muzzle measurements")
        dx = (width - reference[0]) // 2  # whole-pixel symmetric padding
        px, py = sheet.get("pivotX", 0.5) * width, sheet.get("pivotY", 0.5) * height
        sx, sy = sheet["fw"] / width * DISPLAY, sheet["fh"] / height * DISPLAY
        if barrels:
            sheet["barrels"] = [
                [round((left + dx) / width, 8), round(top / height, 8),
                 round((right + dx) / width, 8), round(bottom / height, 8)]
                for left, top, right, bottom in barrels
            ]
        for weapon_id, (points, recoil) in weapons.items():
            weapon = next(w for w in definition["weapons"] if w["id"] == weapon_id)
            weapon["muzzlePoints"] = [
                {"forward": round((py - y) * sy, 4), "lateral": round((x + dx - px) * sx, 4)}
                for x, y in points
            ]
            for legacy in ("muzzleOffset", "bores", "boreSpacing", "recoil"):
                weapon.pop(legacy, None)
            if recoil:
                weapon["recoil"] = recoil

        if suffix == "extremism":
            # Secondary guns are painted on the hull, behind its ring. Native
            # shots use that ring as their origin, even for hull guns.
            hull = sheets[definition["sprite"]]
            with Image.open(Path(asset_dir) / hull["file"]) as image:
                width, height = image.size
            if (width, height) != (64, 87):
                raise ValueError("extremism: changed hull art needs new muzzle measurements")
            mx, my = hull["mount"]
            secondary = next(w for w in definition["weapons"] if w["id"] == "4")
            secondary["turret"] = False
            secondary["muzzlePoints"] = [
                {"forward": round((my - 64 / height) * hull["fh"] * DISPLAY, 4),
                 "lateral": round((x / width - mx) * hull["fw"] * DISPLAY, 4)}
                for x in (21, 43)
            ]
            for legacy in ("muzzleOffset", "bores", "boreSpacing"):
                secondary.pop(legacy, None)
            # The original invisible anti-air launcher sits at the hull centre.
            launcher = next(w for w in definition["weapons"] if w["id"] == "2")
            launcher.update(turret=False, vertical=True, muzzlePoints=[{
                "forward": round((my - 0.5) * hull["fh"] * DISPLAY, 4), "lateral": 0,
            }])
            launcher.pop("muzzleOffset", None)

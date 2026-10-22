#!/usr/bin/env python3
"""Write the mod's map, `maps/proving-ground.steel-tide-map`: the whole of the League on one field.

A map a mod carries (`maps` in mod.json) is a file the Map Editor could have exported —
terrain, deposits, spawns, props and the pieces standing before the whistle — and it may
stand the mod's own units. This one is drawn here rather than in the editor so it follows
the roster: every building and every unit in `mod.json` stands on it. Seat 0 opens in the
west on a League base built out to the top — the command, the factories and their second
levels, the three ore mines, the turret line, the labs and the superweapons — with the
army formed up on the plain, the heroes in their ranks, the air wing over the base and the
fleet in the bay. Seat 1 opens in the east with a Steel Tide army dug in across the plain.

Tiles are 32 world px; a building sits on its top-left tile; a unit's `a` is its facing in
degrees clockwise from east. Pieces that would overlap, stand on the wrong ground or leave a
def out fail the run, since the game drops an overlapping piece without a word.

  python3 mods/fg-rusted-league/make-map.py
"""
import base64
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "maps", "proving-ground.steel-tide-map")
MOD = json.load(open(os.path.join(HERE, "mod.json"), encoding="utf-8"))
DEFS = {d["id"]: d for d in MOD["defs"]}
P = "fg-rusted-league-"

# the game's terrain codes (game/core/src/core/types.ts)
DEEP, WATER, SAND, GRASS, FOREST, MOUNTAIN, ROAD, MUD, MARSH, SNOW, RUBBLE = range(11)

W, H = 96, 72
t = [[GRASS] * W for _ in range(H)]


def fill(x0, y0, x1, y1, v):
    for y in range(max(0, y0), min(H, y1)):
        for x in range(max(0, x0), min(W, x1)):
            t[y][x] = v


# ---- the ground: a bay along the south, a road across the plain, rough ground between the armies
fill(0, 0, W, 2, FOREST)
fill(0, 0, 2, 56, FOREST)
fill(94, 0, 96, 56, FOREST)
fill(0, 55, W, 58, SAND)
fill(0, 58, W, H, WATER)
fill(0, 64, W, H, DEEP)
fill(64, 56, 96, 58, SAND)
fill(2, 46, 60, 48, ROAD)        # the road from the base to the front
fill(44, 2, 46, 55, ROAD)


def lcg(seed):
    """a small deterministic generator, so the file is the same every run"""
    s = seed
    while True:
        s = (s * 1103515245 + 12345) % (1 << 31)
        yield s / (1 << 31)


rnd = lcg(20260927)


def blob(cx, cy, rx, ry, v, keep=(GRASS,)):
    """an irregular patch: an ellipse whose edge wanders, laid only on the ground it may cover"""
    bumps = [0.75 + 0.5 * next(rnd) for _ in range(12)]
    for y in range(int(cy - ry - 2), int(cy + ry + 3)):
        for x in range(int(cx - rx - 2), int(cx + rx + 3)):
            if not (0 <= x < W and 0 <= y < H) or t[y][x] not in keep:
                continue
            dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            ang = (math.atan2(dy, dx) / (2 * math.pi)) % 1 * 12
            i = int(ang)
            f = ang - i
            edge = bumps[i] * (1 - f) + bumps[(i + 1) % 12] * f
            if dx * dx + dy * dy <= edge * edge:
                t[y][x] = v


# the rough ground between the armies: two ridges, a churned field, the ruins by the shore, a wood
blob(52, 13, 3.5, 4.5, MOUNTAIN)
blob(58, 39, 3, 4, MOUNTAIN)
blob(56, 25, 6, 5, MUD)
blob(64, 49, 6, 4, RUBBLE)
blob(65, 8, 4, 5, FOREST)
blob(30, 52, 5, 2.2, FOREST)
blob(78, 50, 5, 3, FOREST)


def rle(rows):
    flat = [v for row in rows for v in row]
    out = bytearray()
    i = 0
    while i < len(flat):
        v = flat[i]
        run = 1
        while i + run < len(flat) and flat[i + run] == v and run < 255:
            run += 1
        out += bytes((run, v))
        i += run
    return base64.b64encode(bytes(out)).decode("ascii")


# ---- the seats: the League opens in the south-west, the Steel Tide army in the east
spawns = [{"x": 9, "y": 50}, {"x": 88, "y": 28}]
deposits = [{"x": 4, "y": 21}, {"x": 7, "y": 21}, {"x": 10, "y": 21},       # under the three ore mines
            {"x": 22, "y": 50}, {"x": 30, "y": 50},                        # free ones near the League's start
            {"x": 84, "y": 14}, {"x": 84, "y": 40}, {"x": 90, "y": 44},    # the east's
            {"x": 48, "y": 24}, {"x": 48, "y": 40}]                        # the middle's

decor = [
    {"kind": "hangar", "x": 34, "y": 4}, {"kind": "tent", "x": 40, "y": 50}, {"kind": "tent", "x": 36, "y": 50},
    {"kind": "tower", "x": 46, "y": 20}, {"kind": "tower", "x": 46, "y": 34},
    {"kind": "bunker", "x": 66, "y": 20}, {"kind": "bunker", "x": 66, "y": 34}, {"kind": "derrick", "x": 90, "y": 50},
    {"kind": "freighter2", "x": 70, "y": 66}, {"kind": "freighter", "x": 6, "y": 63},
]

units = []
taken = {}


def rect(id_, x, y):
    d = DEFS.get(id_)
    if d and d["kind"] == "building":
        return x, y, d.get("fw", 2), d.get("fh", 2)
    if id_ in ("factory", "navyard"):
        return x, y, 3, 3
    if id_ == "airbase":
        return x, y, 4, 4
    if id_ in ("power", "extractor"):
        return x, y, 2, 2
    if id_ in ("cannonturret", "aaturret", "mgturret"):
        return x, y, 1, 1
    return x, y, 1, 1


def put(id_, owner, x, y, a=None):
    rx, ry, rw, rh = rect(id_, x, y)
    assert 0 <= rx and 0 <= ry and rx + rw <= W and ry + rh <= H, f"{id_} off the map at {x},{y}"
    for yy in range(ry, ry + rh):
        for xx in range(rx, rx + rw):
            assert (xx, yy) not in taken, f"{id_} at {x},{y} overlaps {taken[(xx, yy)]}"
            taken[(xx, yy)] = id_
    piece = {"id": id_, "owner": owner, "x": x, "y": y}
    if a is not None and not (id_ in DEFS and DEFS[id_]["kind"] == "building") and id_ not in ("factory", "navyard", "airbase", "power", "extractor", "cannonturret", "aaturret", "mgturret"):
        piece["a"] = a
    units.append(piece)


def sky(suffix, x, y, a=0):
    put(P + suffix, 0, x, y, a)


def ground_of(id_):
    d = DEFS[id_]
    if d["kind"] == "building":
        return "yard" if any(DEFS[u].get("domain") == "ship" for u in d.get("produces", []) if u in DEFS) else "land"
    return {"ship": "water", "air": "any", "amphibious": "any"}.get(d.get("domain"), "land")


# the spawns keep their ground for the opening headquarters (4x3 about the spawn tile)
for s in spawns:
    for yy in range(s["y"] - 3, s["y"] + 4):
        for xx in range(s["x"] - 4, s["x"] + 5):
            taken[(xx, yy)] = "the opening HQ"

# ================================================================ the League, seat 0
# the base, from the north edge down: labs and command, the factories, the big guns, the mines
for suffix, x, y in (("battle-lab", 3, 3), ("command", 7, 3), ("reactor", 11, 3), ("hero-tower", 15, 3),
                     ("hero-barracks", 19, 3), ("nuke-silo", 22, 3), ("repair-depot", 25, 3),
                     ("army-base", 3, 8), ("army-base-2", 7, 8), ("air-base", 11, 8), ("air-base-2", 15, 8),
                     ("t3-factory", 19, 8), ("black-tech-factory", 23, 8), ("airfield", 28, 8),
                     ("proton-cannon", 3, 14), ("colossus-gun", 9, 14), ("floating-array", 13, 14),
                     ("mine", 4, 21), ("mine-2", 7, 21), ("mine-3", 10, 21)):
    sky(suffix, x, y)
# the turret line along the base's east edge: guns in front, air defence behind
for suffix, x, y in (("sentry", 36, 10), ("sentry-2", 36, 12), ("sentry-3", 36, 14), ("flame-turret", 36, 16),
                     ("artillery-emplacement", 34, 12), ("prism-tower", 34, 15), ("prism-tower-2", 34, 18),
                     ("patriot", 38, 10), ("patriot-2", 38, 12), ("absolute-domain", 38, 14), ("flak", 38, 16),
                     ("sentry", 36, 19), ("patriot", 38, 19)):
    sky(suffix, x, y)
# the yards in the bay
sky("naval-base", 10, 58)
sky("naval-base-2", 16, 58)

# the army on the plain, heavy in the middle, facing east
ARMY = ["grizzly", "hover-tank", "artillery", "hover-transport", "tank-destroyer", "heavy-tank", "heavy-hover-tank",
        "prism-tank", "tesla-tank", "rocket-truck", "apocalypse", "mirage-tank", "v3-launcher", "pacifier",
        "siege-tank", "rocket-launcher", "minelayer", "tank-killer", "flame-tank", "missile-tank", "striker-vx",
        "tengu-mech", "builder", "silencer", "siege-tank-deployed", "rocket-launcher-fixed"]
for k, suffix in enumerate(ARMY):
    sky(suffix, 22 + (k // 6) * 4, 24 + (k % 6) * 3)
sky("experimental-tank", 43, 20)
sky("star-warship", 39, 33)
sky("land-cruiser", 39, 40)
for y in (24, 26, 28, 30, 32, 34, 36, 38):
    sky("grizzly", 42, y)
# the heroes by rank: the tank, its three Lv2 lines, the nine Lv3s, the nine MAX forms
heroes = [d["id"][len(P):] for d in MOD["defs"] if d["id"].startswith(P + "hero-") and d["kind"] == "unit"]
for k, suffix in enumerate(heroes):
    sky(suffix, 4 + (k % 5) * 3, 27 + (k // 5) * 3)
# what is on the map as another unit: the Mirage's tree, the carrier's levels, and the planes a
# carrier makes itself (`wing`), which fly from their decks and not from the map
WING_PLANES = {d["wing"]["unit"] for d in MOD["defs"] if d.get("wing")}
CARRIER_LEVELS = {P + f"aircraft-carrier-{n}" for n in range(2, 6)}
SELF_FORMS = {P + "mirage-disguised", P + "floating-array-landed", P + "battle-carrier-deployed", P + "widow-mine"} | WING_PLANES | CARRIER_LEVELS
# the air wing over the north-east of the base
air = [d["id"][len(P):] for d in MOD["defs"] if d.get("domain") == "air" and d["id"] != P + "aircraft-carrier" and d["id"] not in SELF_FORMS]
for k, suffix in enumerate(air):
    sky(suffix, 47 + (k % 5) * 3, 3 + (k // 5) * 3)
# the fleet in the bay
fleet = [d["id"][len(P):] for d in MOD["defs"] if d.get("domain") == "ship" and d["id"] not in SELF_FORMS] + ["aircraft-carrier"]
for k, suffix in enumerate(fleet):
    sky(suffix, 24 + (k % 9) * 4, 60 + (k // 9) * 5)

# ================================================================ Steel Tide, seat 1
for id_, x, y in (("factory", 80, 16), ("airbase", 80, 34), ("power", 86, 36), ("power", 86, 40),
                  ("extractor", 84, 14), ("extractor", 84, 40), ("navyard", 80, 58)):
    put(id_, 1, x, y)
for x, y in ((72, 18), (72, 22), (72, 32), (72, 36)):
    put("cannonturret", 1, x, y)
for x, y in ((74, 20), (74, 34)):
    put("aaturret", 1, x, y)
for k, id_ in enumerate(["mbt"] * 8 + ["htank"] * 3 + ["td"] * 2 + ["flak", "sam", "arty", "arty", "mlrs"]):
    put(id_, 1, 64 + (k // 7) * 3, 20 + (k % 7) * 3, 180)
for k, id_ in enumerate(["heli", "heli", "jet", "jet", "fighter"]):
    put(id_, 1, 76 + k * 3, 8, 180)
for k, id_ in enumerate(["gunboat", "gunboat", "destroyer", "frigate", "sub"]):
    put(id_, 1, 66 + k * 4, 61, 180)

# ================================================================ checks
tile = lambda x, y: t[y][x]
for u in units:
    if u["id"] not in DEFS:
        continue
    rx, ry, rw, rh = rect(u["id"], u["x"], u["y"])
    tiles = [tile(xx, yy) for yy in range(ry, ry + rh) for xx in range(rx, rx + rw)]
    need = ground_of(u["id"])
    if need == "land":
        assert all(v not in (DEEP, WATER) for v in tiles), f"{u['id']} stands in the water at {u['x']},{u['y']}"
    elif need == "water":
        assert all(v in (DEEP, WATER) for v in tiles), f"{u['id']} stands ashore at {u['x']},{u['y']}"
    elif need == "yard":
        assert all(v in (DEEP, WATER) for v in tiles), f"{u['id']} is not on the water at {u['x']},{u['y']}"
        ring = [tile(xx, yy) for yy in range(ry - 1, ry + rh + 1) for xx in range(rx - 1, rx + rw + 1)
                if 0 <= xx < W and 0 <= yy < H and not (rx <= xx < rx + rw and ry <= yy < ry + rh)]
        assert any(v not in (DEEP, WATER) for v in ring), f"{u['id']} has no shore at {u['x']},{u['y']}"
for d in MOD["defs"]:
    if d.get("needsDeposit"):
        for u in units:
            if u["id"] == d["id"]:
                assert any(u["x"] <= p["x"] < u["x"] + d["fw"] and u["y"] <= p["y"] < u["y"] + d["fh"] for p in deposits), f"{d['id']} is off its deposit"
missing = sorted(set(DEFS) - {u["id"] for u in units} - SELF_FORMS)
assert not missing, f"not on the map: {missing}"
assert len(units) <= 400, len(units)

data = {
    "format": "steel-tide-map",
    "v": 1,
    "name": "Proving Ground",
    "description": "All of FG Rusted League on one field: every building of the base, the army formed up on the plain, the heroes in their ranks, the air wing over the base and the fleet in the bay, facing a Steel Tide army across the rough ground.",
    "translations": {
        "zh": {"name": "试验场", "description": "整个 FG 铁锈联盟摆在一片战场上：基地的每一座建筑，平原上列阵的陆军、按等级排好的英雄、基地上空的空军和海湾里的舰队，对面是隔着荒地据守的钢铁浪潮军队。"},
    },
    "w": W,
    "h": H,
    "terrain": rle(t),
    "deposits": deposits,
    "spawns": spawns,
    "decor": decor,
    "units": units,
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
open(OUT, "w", encoding="utf-8").write(text + "\n")
sky_n = sum(1 for u in units if u["owner"] == 0)
print(f"wrote {os.path.relpath(OUT)}: {W}x{H}, {len(units)} pieces ({sky_n} of the League, every def of the mod), {len(decor)} props, {len(text) / 1024:.0f} KB")

#!/usr/bin/env python3
"""Write the mod's map, `maps/city-of-sin.steel-tide-map`: the edge of Adolon.

A map a mod carries (`maps` in mod.json) is a file the Map Editor could have
exported — terrain, deposits, spawns, props and the pieces standing before the
whistle — and it may stand the mod's own units. This one is drawn here rather
than in the editor so it can be regenerated with the roster: a city grid on
the west bank, the police dug in around the Joint Precinct, and across the
avenue the dead, bred from two nests in the rubble.
Every definition in mod.json is represented, including upgraded buildings and
the faction builders; the reserves fill out the roster behind each front.

Seat 0 opens on the west spawn and gets the police; seat 1 opens on the east
spawn and gets the dead. Tiles are 32 world px; a building sits on its
top-left tile; a unit's `a` is its facing in degrees clockwise from east.

  python3 mods/adolence/make-map.py
"""
import base64
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "maps", "city-of-sin.steel-tide-map")
with open(os.path.join(HERE, "mod.json"), encoding="utf-8") as manifest:
    mod = json.load(manifest)
defs = {d["id"]: d for d in mod["defs"]}
rosters = [set(next(f["roster"] for f in mod["factions"] if f["id"] == id_))
           for id_ in ("adolence-city", "adolence-infected")]

# the game's terrain codes (game/core/src/core/types.ts)
DEEP, WATER, SAND, GRASS, FOREST, MOUNTAIN, ROAD, MUD, MARSH, SNOW, RUBBLE = range(11)
CITY = 16

W, H = 104, 76
t = [[GRASS] * W for _ in range(H)]


def fill(x0, y0, x1, y1, v):
    for y in range(max(0, y0), min(H, y1)):
        for x in range(max(0, x0), min(W, x1)):
            t[y][x] = v


# ---- Adolon's west bank: the police quarter, ruined front and dense downtown
fill(0, 0, W, 2, FOREST)
fill(0, 2, 3, 68, FOREST)
fill(33, 3, 62, 50, RUBBLE)
fill(33, 12, 46, 38, MUD)

# Actual City terrain draws houses and apartment blocks and blocks movement.
# Leave avenues and alleys between blocks so the fight stays in the streets.
for x0, y0, x1, y1 in (
    (10, 13, 14, 21), (16, 40, 28, 47),
    (34, 3, 43, 9), (34, 13, 38, 18), (40, 18, 45, 23),
    (34, 28, 38, 34), (40, 33, 45, 37),
    (50, 3, 54, 9), (52, 18, 58, 23), (52, 31, 56, 37),
    (50, 42, 54, 48),
):
    fill(x0, y0, x1, y1, CITY)
for x0, x1 in ((66, 76), (82, 92)):
    for y0, y1 in ((3, 10), (14, 23), (28, 37), (42, 49), (54, 63)):
        fill(x0, y0, x1, y1, CITY)
# Bombed-out corners and a public square break up the occupied downtown.
fill(66, 28, 70, 33, RUBBLE)
fill(87, 42, 92, 46, RUBBLE)
fill(70, 17, 76, 23, ROAD)
fill(74, 23, 78, 25, ROAD)

# Broad through streets connect the precinct, the city and the waterfront.
for y in (10, 24, 38, 50, 64):
    fill(4, y, 96, y + 3, ROAD)
for x in (14, 30, 46, 62, 78, 94):
    fill(x, 2, min(x + 3, 96), 67, ROAD)
# The southern motor pool and airfield have room for the whole vehicle roster.
fill(4, 48, 58, 64, ROAD)
fill(4, 43, 13, 48, ROAD)

# A continuous river and southern channel, with the coast guard in a harbour.
fill(94, 2, 96, H, SAND)
fill(96, 0, W, H, WATER)
fill(99, 0, W, H, DEEP)
fill(0, 66, 96, 68, SAND)
fill(0, 68, W, H, WATER)
fill(0, 71, W, H, DEEP)
fill(3, 59, 19, 68, SAND)
fill(4, 60, 18, 71, WATER)
fill(7, 63, 15, 71, DEEP)


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


# ---- what the map offers: metal for both sides
deposits = [{"x": 8, "y": 6}, {"x": 8, "y": 42}, {"x": 22, "y": 20}, {"x": 22, "y": 30},
            {"x": 56, "y": 6}, {"x": 56, "y": 42}, {"x": 40, "y": 27}, {"x": 60, "y": 46},
            {"x": 74, "y": 18}, {"x": 88, "y": 44}]
# Foundations remain usable even where the surrounding city has collapsed.
for deposit in deposits:
    fill(deposit["x"], deposit["y"], deposit["x"] + 2, deposit["y"] + 2, GRASS)
# the police open on the west, the dead on the east
spawns = [{"x": 8, "y": 24}, {"x": 58, "y": 24}]

# ---- props: the city that was
decor = [
    {"kind": "tower", "x": 5, "y": 4}, {"kind": "pole", "x": 13, "y": 9}, {"kind": "pole", "x": 29, "y": 9}, {"kind": "pole", "x": 45, "y": 9},
    {"kind": "pole", "x": 13, "y": 23}, {"kind": "pole", "x": 29, "y": 25}, {"kind": "pole", "x": 13, "y": 37}, {"kind": "pole", "x": 29, "y": 37},
    {"kind": "hangar", "x": 5, "y": 40}, {"kind": "tent", "x": 18, "y": 4}, {"kind": "tent", "x": 22, "y": 4},
    {"kind": "bunker", "x": 50, "y": 14}, {"kind": "bunker", "x": 50, "y": 30}, {"kind": "hangar", "x": 52, "y": 4},
    {"kind": "tower", "x": 92, "y": 12}, {"kind": "tower", "x": 92, "y": 52},
    {"kind": "hangar", "x": 10, "y": 44},
]
decor += [{"kind": "pole", "x": x, "y": y} for x in (61, 77, 93) for y in (9, 23, 37, 49, 63)]

# Props block movement and building placement just like structures do.
decor_sizes = {"pole": (1, 1), "tower": (1, 1), "tent": (2, 2), "hangar": (3, 2), "bunker": (2, 2)}
decor_tiles = {(x, y) for prop in decor
               for y in range(prop["y"], prop["y"] + decor_sizes[prop["kind"]][1])
               for x in range(prop["x"], prop["x"] + decor_sizes[prop["kind"]][0])}

# ---- the pieces
units = []


def b(id_, owner, x, y):
    units.append({"id": f"adolence-{id_}", "owner": owner, "x": x, "y": y})


def u(id_, owner, x, y, a=None):
    units.append({"id": f"adolence-{id_}", "owner": owner, "x": x, "y": y, **({"a": a} if a is not None else {})})


# the police, seat 0: the precinct and its yards behind the west avenue, the line on the middle avenue
b("precinct", 0, 16, 14)
b("outpost", 0, 16, 18)
b("garage", 0, 21, 14)
b("helipad", 0, 21, 18)
b("solar", 0, 5, 14)
b("solar-2", 0, 5, 18)
b("supply-cache", 0, 8, 6)
b("supply-cache-2", 0, 8, 42)
b("precinct-2", 0, 16, 29)
b("arsenal", 0, 21, 29)
b("airfield", 0, 5, 44)
# The naval yard opens south into a harbour connected to the river.
b("coast-guard-base", 0, 7, 60)
assert all(t[y][x] in (WATER, DEEP) for y in range(60, 63) for x in range(7, 10)) and t[59][8] == SAND
for y in (13, 16, 19, 22, 27, 30, 33):
    b("mg-tower", 0, 27, y)
for y in range(12, 36, 1):
    if y % 3 != 1:
        b("barricade", 0, 29, y)
# the cruisers on the avenue, the officers two deep behind the barricades, the armour in the yard
for i, y in enumerate((13, 15, 17, 19, 27, 29, 31, 33)):
    u("cruiser" if i % 2 == 0 else "armoured-car", 0, 25, y, 0)
LINE = ("officer-rifle", "armed-police-rifle", "taskforce-rifleman", "guard-gunner", "swat-field", "taskforce-shotgunner",
        "officer-pistol", "traffic-officer", "military-police", "taskforce-rocketeer", "guard-rifleman", "army-marksman")
for y in range(12, 36):
    # Towers occupy two columns and two rows; infantry must stand behind them.
    tower = any(top <= y < top + 2 for top in (13, 16, 19, 22, 27, 30, 33))
    if y % 3 != 1:
        u(LINE[y % len(LINE)], 0, 26 if tower else 28, y, 0)
    if y % 2 == 0 and not (24 <= y <= 25):
        u(LINE[(y + 5) % len(LINE)], 0, 24 if tower and y % 3 != 1 else 26, y, 0)
u("light-tank", 0, 24, 21, 0)
u("light-tank-flame", 0, 24, 23, 0)
u("heavy-tank", 0, 23, 22, 0)
u("mortar", 0, 20, 22, 0)
u("mortar", 0, 20, 24, 0)
u("heavy-mg", 0, 26, 21, 0)
u("heavy-mg", 0, 26, 25, 0)
u("m1a2", 0, 18, 22, 0)
u("m1128", 0, 17, 26, 0)
u("heavy-gunship", 0, 22, 8, 0)
u("police-heli", 0, 22, 12, 0)
u("command-van", 0, 20, 26, 0)
u("scout-boat", 0, 8, 66, 0)

# the dead, seat 1: two nests in the rubble and the horde already on the avenue
b("sloth-nest", 1, 56, 6)
b("sloth-nest", 1, 56, 42)
b("spk-colony", 1, 58, 30)
fill(58, 30, 61, 33, GRASS)
horde = ["zombie"] * 5 + ["brute", "zombie", "rager", "zombie", "bloater", "zombie", "burster", "prisoner", "zombie", "imploder"]


def lcg(seed):
    """a small deterministic generator, so the file is the same every run"""
    s = seed
    while True:
        s = (s * 1103515245 + 12345) % (1 << 31)
        yield s / (1 << 31)


for x, y in ((50, 10), (50, 20), (50, 34), (52, 16), (52, 28)):
    u("gorilla", 1, x, y, 180)
u("no-longer-human", 1, 48, 24, 180)
u("sin-of-wrath", 1, 54, 24, 180)
u("sin-of-gluttony", 1, 52, 10, 180)
u("road-rage", 1, 44, 26, 180)
u("road-rage", 1, 48, 22, 180)
u("acid-mass", 1, 46, 14, 180)
u("acid-mass", 1, 46, 34, 180)
for x, y in ((40, 6), (44, 10), (42, 40), (38, 42)):
    u("flying-husk", 1, x, y, 180)
for x, y in ((98, 20), (98, 40), (84, 70)):
    u("gloater", 1, x, y, 180)
for x, y in ((56, 12), (58, 36), (60, 18)):
    u("turned-officer", 1, x, y, 180)

rnd = lcg(20260920)
taken = {(x, y) for piece in units
         for y in range(piece["y"], piece["y"] + defs[piece["id"]].get("fh", 1))
         for x in range(piece["x"], piece["x"] + defs[piece["id"]].get("fw", 1))}
taken.update(decor_tiles)
# Loose knots fill the ruined front and the streets between the city blocks.
knots = [(35, 16, 4), (36, 31, 4), (38, 22, 5), (40, 14, 4), (40, 34, 4), (43, 19, 4), (43, 28, 4), (37, 40, 3), (45, 8, 3),
         (64, 24, 3), (78, 38, 3), (64, 50, 3), (80, 12, 3), (90, 50, 3)]
k = 0
for cx, cy, r in knots:
    for _ in range(14):
        x = int(cx + (next(rnd) - 0.5) * 2 * r)
        y = int(cy + (next(rnd) - 0.5) * 2 * r)
        if not (33 <= x <= 93 and 3 <= y <= 63) or t[y][x] not in (GRASS, ROAD, MUD, RUBBLE) or (x, y) in taken:
            continue
        taken.add((x, y))
        u(horde[k % len(horde)], 1, x, y, 180 + int((next(rnd) - 0.5) * 60))
        k += 1

# ---- the reserves: every roster entry not already on the front
def reserve(owner, domain, slots, infantry=None):
    present = {piece["id"] for piece in units}
    missing = [d for d in mod["defs"]
               if d["id"] in rosters[owner] and d["id"] not in present
               and d["kind"] == "unit" and d.get("domain", "ground") in domain
               and (infantry is None or (d.get("radius", 9) <= 9) == infantry)]
    assert len(missing) <= len(slots), f"Add showcase spaces for {[d['id'] for d in missing]}"
    for d, (x, y) in zip(missing, slots):
        u(d["id"].removeprefix("adolence-"), owner, x, y, 180 if owner else 0)


# Infantry behind the precinct; spaced vehicle ranks on the southern apron.
reserve(0, ("ground",), [(x, y) for y in (28, 31, 34, 37) for x in (5, 8, 11)]
        + [(11, 40)], infantry=True)
reserve(0, ("ground", "amphibious"),
        [(x, y) for y in (54, 59) for x in (22, 28, 34, 40, 46, 52)]
        + [(x, 64) for x in (22, 28, 34, 40, 46, 52)]
        + [(x, 54) for x in (6, 10, 14, 18)] + [(22, 48), (28, 48)], infantry=False)
# Aircraft on the apron by the airfield; the carrier alongside in the harbour.
reserve(0, ("air",), [(x, 48) for x in (5, 10, 15, 35, 42)])
reserve(0, ("ship",), [(13, 67)])
reserve(1, ("ground",), [(58, 16), (58, 34)])

# The reader silently drops overlapping pieces. Catch those, missing defs,
# wrong factions and unsuitable terrain before writing the showcase.
assert set(defs) == {piece["id"] for piece in units}, sorted(set(defs) - {piece["id"] for piece in units})
taken = set(decor_tiles)
for piece in units:
    d = defs[piece["id"]]
    assert piece["id"] in rosters[piece["owner"]], piece
    footprint = [(x, y) for y in range(piece["y"], piece["y"] + d.get("fh", 1))
                 for x in range(piece["x"], piece["x"] + d.get("fw", 1))]
    for x, y in footprint:
        assert 0 <= x < W and 0 <= y < H, piece
        assert (x, y) not in taken, f"Overlapping showcase piece: {piece}"
        taken.add((x, y))
        if d["kind"] == "building":
            water = d["id"] == "adolence-coast-guard-base"
            assert t[y][x] in ((WATER, DEEP) if water else (GRASS, SAND, ROAD)), piece
        elif d.get("domain", "ground") in ("ground", "ship"):
            assert t[y][x] in ((WATER, DEEP) if d.get("domain") == "ship" else (GRASS, SAND, ROAD, MUD, RUBBLE)), piece
    if d.get("needsDeposit"):
        assert any((deposit["x"], deposit["y"]) in footprint for deposit in deposits), piece

assert len(units) <= 400, len(units)
data = {
    "format": "steel-tide-map",
    "v": 1,
    "name": "City of Sin",
    "description": "Adolon's riverfront: a fortified police precinct, armoured columns and aircraft by the harbour, apartment blocks cut by broad avenues, and zombie hordes pouring through the ruined streets.",
    "translations": {
        "zh": {"name": "罪恶之都", "description": "阿多隆滨河城区：严阵以待的警署、港区集结的装甲纵队与飞机、宽阔大道分隔的公寓街区，以及涌入残破街道的丧尸群。"},
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
print(f"wrote {os.path.relpath(OUT)}: {W}x{H}, {len(units)} pieces, {len(decor)} props, {len(text) / 1024:.0f} KB")

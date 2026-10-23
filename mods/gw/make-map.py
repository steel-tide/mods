#!/usr/bin/env python3
"""Write the mod's showcase map, `maps/odessa-coast.steel-tide-map`.

A new two-seat map, not one of the source's 22: every definition in mod.json
stands on it before the whistle, so the whole port can be looked over and
tried in one match. The Federation holds the west, Zeon the east. Each side
has its headquarters, factories, refinery, supply depot, radar and institute
in a row along the north edge, its Mega Factory below them, turrets and walls on the highway out of its base, its
ground forces on a paved parade ground, its aircraft over the apron and its
fleet off its own harbour on the southern coast. Between them a highway runs
through a ruined town. No piece of one side stands within 32 tiles of the
other's, beyond the longest gun's reach, so neither opens fire at the start.

Seat one opens on the west spawn and gets the Federation's pieces, seat two
on the east and gets Zeon's; choose EFSF[0079] and ZEON[0079] for those seats
to match the forces with their own opening headquarters. Shared buildings
stand in both bases. The map is drawn here rather than in the Map Editor, so
it follows the roster: run it after port.py. It checks coverage, faction
ownership, terrain, the sea room each hull needs and overlaps before writing.
Tiles are 32 world px; a building sits on its top-left tile; a unit's `a` is
its facing in degrees clockwise from east.

  python3 mods/gw/make-map.py               # write the map
  python3 mods/gw/make-map.py --check-only  # the saved map matches mod.json
"""
from collections import Counter, deque
from pathlib import Path
import base64
import json
import math
import sys

HERE = Path(__file__).resolve().parent
OUT = HERE / 'maps' / 'odessa-coast.steel-tide-map'
TILE = 32
# the game's terrain codes (game/core/src/core/types.ts)
DEEP, WATER, SAND, GRASS, FOREST, MOUNTAIN, ROAD, MUD = range(8)
RUBBLE, CITY = 10, 16
BUILDABLE = (GRASS, SAND, ROAD)
LAND = (GRASS, SAND, ROAD, MUD, RUBBLE)
SEA = (WATER, DEEP)
DECOR_SIZE = {'tower': (1, 1), 'tent': (2, 2), 'hangar': (3, 2), 'bunker': (2, 2)}
APART = 32  # tiles between the two sides: the U-type's missiles reach 28

W, H = 128, 96
mod = json.loads((HERE / 'mod.json').read_text())
defs = {d['id']: d for d in mod['defs']}
factions = mod['factions']
assert [f['id'] for f in factions] == ['gw-efsf-0079', 'gw-zeon-0079'], 'one faction a seat, west then east'

t = [[GRASS] * W for _ in range(H)]


def fill(x0, y0, x1, y1, v):
    for y in range(max(0, y0), min(H, y1)):
        for x in range(max(0, x0), min(W, x1)):
            t[y][x] = v


def both(x0, y0, x1, y1, v):
    """a west-side fill and its mirror on the east"""
    fill(x0, y0, x1, y1, v)
    fill(W - x1, y0, W - x0, y1, v)


# ---- the ground: a coast on the south, forest along the other edges
fill(0, 0, W, 2, FOREST)
both(0, 2, 2, 64, FOREST)
fill(0, 64, W, 66, SAND)
fill(0, 66, W, H, WATER)
fill(0, 70, W, H, DEEP)
# a headland between the two harbours; the sea stays open beyond it
fill(56, 62, 72, 72, SAND)
fill(58, 62, 70, 70, GRASS)

# each base: a paved apron below the building row, a parade ground behind the
# defences, a road down to the harbour
both(3, 8, 31, 11, ROAD)
both(20, 11, 37, 31, ROAD)
both(12, 29, 14, 64, ROAD)
both(22, 46, 34, 56, FOREST)
both(46, 6, 53, 13, FOREST)
both(46, 52, 53, 58, FOREST)

# between them: a highway through a ruined town, mud on the open fields
fill(52, 24, 76, 46, RUBBLE)
both(54, 26, 59, 31, CITY)
both(54, 38, 59, 43, CITY)
fill(56, 12, 72, 18, MUD)
fill(56, 52, 72, 58, MUD)
fill(2, 33, W - 2, 36, ROAD)
fill(63, 24, 65, 46, ROAD)

# ---- spawns, and the ground the opening headquarters and engineers take
spawns = [{'x': 12, 'y': 24}, {'x': W - 1 - 12, 'y': 24}]
taken = {}


def hold(label, x, y, w=1, h=1):
    assert 0 <= x and x + w <= W and 0 <= y and y + h <= H, f'{label} lies off the map'
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            assert (xx, yy) not in taken, f'{label} overlaps {taken[(xx, yy)]} at {xx},{yy}'
            taken[(xx, yy)] = label


for seat, sp in enumerate(spawns):
    hold(f'opening base {seat}', sp['x'] - 5, sp['y'] - 4, 11, 9)

# metal for a seat that plays the game's own faction here; GW's needs none
deposits = []
for x, y in [(4, 20), (4, 27), (19, 20), (19, 28)]:
    for dx in (x, W - 1 - x):
        hold('deposit', dx, y)
        deposits.append({'x': dx, 'y': y})

# ---- the pieces
units = []


def put(id_, owner, x, y):
    """a piece at a west-side position, mirrored for the east"""
    d = defs[id_]
    building = d['kind'] == 'building'
    w, h = (d.get('fw', 2), d.get('fh', 2)) if building else (1, 1)
    if owner == 1:
        x = W - x - w
    hold(id_, x, y, w, h)
    piece = {'id': id_, 'owner': owner, 'x': x, 'y': y}
    if not building:
        piece['a'] = 0 if owner == 0 else 180
    units.append(piece)


def yard(d):
    return any(defs[p].get('domain') == 'ship' for p in d.get('produces', []))


BUILDINGS = {  # west-side top-left tiles
    'hq': (3, 3), 'land': (9, 3), 'air': (13, 3), 'gw-supply-depot-t1': (18, 3),
    'gw-refinery-t1': (22, 3), 'gw-turret-radar-a': (27, 3), 'gw-institute-t1': (29, 3), 'aqua': (6, 66),
    'mega': (3, 38),
    'gw-wall-t1-a': (40, 23), 'gw-turret-mg-a': (40, 26), 'gw-wall-t1-b': (43, 28),
    'gw-turret-cn-a': (40, 29), 'gw-turret-ms-a': (40, 38), 'gw-turret-aa-a': (40, 41),
}
PARADE = [(x, y) for y in (12, 15, 18, 21, 24, 27, 30) for x in (21, 24, 27, 30, 33, 36)]
# the apron below the building row, and a second line on the grass above it
APRON = [(x, 9) for x in range(4, 31, 3)] + [(x, 6) for x in (8, 14, 20, 26)]
FLEET = [(x, y) for y in (76, 86) for x in (10, 22, 34, 46)]

for owner, faction in enumerate(factions):
    roster = faction['roster']
    for id_ in roster:
        d = defs[id_]
        if d['kind'] != 'building':
            continue
        role = 'hq' if id_ == faction['headquarters'] else id_.rsplit('-', 1)[1] if id_.startswith('gw-factory-') else id_
        assert role in BUILDINGS, f'no place in the base for {id_}'
        put(id_, owner, *BUILDINGS[role])
    parade = list(PARADE)
    slots = {'ground': parade, 'amphibious': parade, 'air': list(APRON), 'ship': list(FLEET)}
    for id_ in [d['id'] for d in mod['defs'] if d['id'] in roster and d['kind'] == 'unit']:
        free = slots[defs[id_].get('domain', 'ground')]
        assert free, f'no showcase place left for {id_}'
        put(id_, owner, *free.pop(0))

# ---- props: the bases' outbuildings, kept off every piece and spawn
decor = []
for kind, x, y in [('hangar', 31, 3), ('hangar', 31, 6), ('tent', 4, 30), ('tent', 7, 30),
                   ('tower', 38, 32), ('tower', 38, 36), ('bunker', 16, 60), ('bunker', 30, 60)]:
    w, h = DECOR_SIZE[kind]
    for owner in (0, 1):
        px = x if owner == 0 else W - x - w
        hold(kind, px, y, w, h)
        assert all(t[yy][xx] in (GRASS, SAND) for yy in range(y, y + h) for xx in range(px, px + w)), f'{kind} off open ground'
        decor.append({'kind': kind, 'x': px, 'y': y})


# ---- checks: what the game's reader would drop or the match would move
def hull(piece):
    """the rectangle a hull facing east or west takes up, world px"""
    d = defs[piece['id']]
    body = d.get('body') or {'r': d.get('radius', 9), 'len': 0}
    half_len, half_beam = body['len'] / 2 + body['r'], body['r']
    cx, cy = (piece['x'] + 0.5) * TILE, (piece['y'] + 0.5) * TILE
    return cx - half_len, cy - half_beam, cx + half_len, cy + half_beam


counts = Counter(p['id'] for p in units)
assert set(counts) == set(defs), f'not on the map: {sorted(set(defs) - set(counts))}'
for id_, n in counts.items():
    shared = all(id_ in f['roster'] for f in factions)
    assert n == (2 if shared and defs[id_]['kind'] == 'building' else 1), f'{id_} stands {n} times'
ships = []
for p in units:
    d = defs[p['id']]
    assert p['id'] in factions[p['owner']]['roster'], f"{p['id']} is not {factions[p['owner']]['id']}'s"
    if d['kind'] == 'building':
        w, h = d.get('fw', 2), d.get('fh', 2)
        ground = [t[y][x] for y in range(p['y'], p['y'] + h) for x in range(p['x'], p['x'] + w)]
        if yard(d):
            ring = [t[y][x] for y in range(p['y'] - 1, p['y'] + h + 1) for x in range(p['x'] - 1, p['x'] + w + 1)
                    if 0 <= x < W and 0 <= y < H]
            assert all(v in SEA for v in ground) and any(v in BUILDABLE for v in ring), f"{p['id']} needs water by a shore"
        else:
            assert all(v in BUILDABLE for v in ground), f"{p['id']} off buildable ground"
    elif d.get('domain') == 'ship':
        x0, y0, x1, y1 = hull(p)
        # the hull and a tile of sea room round it
        for ty in range(math.floor(y0 / TILE) - 1, math.ceil(y1 / TILE) + 1):
            for tx in range(math.floor(x0 / TILE) - 1, math.ceil(x1 / TILE) + 1):
                assert t[ty][tx] in SEA, f"{p['id']} runs aground at {tx},{ty}"
        assert not d.get('underwater') or t[p['y']][p['x']] == DEEP, f"{p['id']} dives in deep water"
        ships.append(p)
    elif d.get('domain') != 'air':
        assert t[p['y']][p['x']] in LAND, f"{p['id']} off passable ground"
for i, a in enumerate(ships):
    for b in ships[i + 1:]:
        ax0, ay0, ax1, ay1 = hull(a)
        bx0, by0, bx1, by1 = hull(b)
        assert ax1 + TILE <= bx0 or bx1 + TILE <= ax0 or ay1 + TILE <= by0 or by1 + TILE <= ay0, f"{a['id']} crowds {b['id']}"


def centre(p):
    d = defs[p['id']]
    w, h = (d.get('fw', 2), d.get('fh', 2)) if d['kind'] == 'building' else (1, 1)
    return p['x'] + w / 2, p['y'] + h / 2


west = [centre(p) for p in units if p['owner'] == 0]
east = [centre(p) for p in units if p['owner'] == 1]
gap = min(math.dist(a, b) for a in west for b in east)
assert gap >= APART, f'the two sides stand {gap:.1f} tiles apart'

# a ground route between the opening bases
start, goal = (spawns[0]['x'], spawns[0]['y']), (spawns[1]['x'], spawns[1]['y'])
seen, queue = {start}, deque([start])
while queue:
    x, y = queue.popleft()
    for nxt in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
        if 0 <= nxt[0] < W and 0 <= nxt[1] < H and nxt not in seen and t[nxt[1]][nxt[0]] in LAND:
            seen.add(nxt)
            queue.append(nxt)
assert goal in seen, 'no ground route between the bases'
assert len(units) <= 400


def rle(rows):
    flat = [v for row in rows for v in row]
    out = bytearray()
    i = 0
    while i < len(flat):
        run = 1
        while i + run < len(flat) and flat[i + run] == flat[i] and run < 255:
            run += 1
        out += bytes((run, flat[i]))
        i += run
    return base64.b64encode(bytes(out)).decode('ascii')


data = {
    'format': 'steel-tide-map', 'v': 1,
    'name': 'Odessa Coast',
    'description': "The Federation's base on the west and Zeon's on the east, their forces on parade, a highway through a ruined town between them, and a harbour for each fleet on the southern coast.",
    'translations': {
        'zh': {'name': '敖德萨海岸', 'description': '联邦军基地在西，吉翁军基地在东，两军部队列阵以待；一条公路穿过两者之间的废墟小镇，南岸各有一座停泊舰队的港口。'},
        'ko': {'name': '오데사 해안', 'description': '서쪽에는 연방군 기지, 동쪽에는 지온군 기지가 있고 양군의 부대가 열병 대형으로 늘어서 있습니다. 두 기지 사이로 폐허가 된 마을을 지나는 고속도로가 이어지고, 남쪽 해안에는 각 함대의 항구가 있습니다.'},
    },
    'w': W, 'h': H, 'terrain': rle(t),
    'deposits': deposits, 'spawns': spawns, 'decor': decor, 'units': units,
}
text = json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n'
assert len(text.encode()) < 512 * 1024
if '--check-only' in sys.argv:
    assert OUT.read_text() == text, f'{OUT.name} differs from the roster; run make-map.py'
else:
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(text)
print(f"{'verified' if '--check-only' in sys.argv else 'wrote'} {OUT.relative_to(HERE)}: {W}x{H}, "
      f'{len(units)} pieces covering all {len(defs)} defs, {len(decor)} props, sides {gap:.0f} tiles apart')

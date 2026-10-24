#!/usr/bin/env python3
"""Write the mod's showcase maps, `maps/showcase-*.steel-tide-map`.

New maps, not the source's: every definition a faction fields stands on one
of them before the whistle, so the whole port can be looked over and tried.
A map holds 400 pieces, so the factions share five maps: each 0079 and the
AEUG on their own, the Titans with Neo Zeon, OMNI with ZAFT.

Each faction holds a block of the map: its buildings in rows along the north
edge on a paved apron, its ground forces on a parade ground below them, its
aircraft on an airfield beside it and its fleet off its own stretch of the
southern coast, the naval factories in the water by the shore. A faction alone
on its map faces an open seat on the far east. No piece of one side stands
within reach of another's guns, so nothing opens fire at the start.

Seat N opens on the Nth spawn and gets that faction's pieces; pick the
factions in that order to match the forces with their own headquarters. The
maps follow the roster: run this after port.py. It checks coverage, faction
ownership, terrain, the sea room each hull needs and overlaps before writing.
Tiles are 32 world px; a building sits on its top-left tile; a unit's `a` is
its facing in degrees clockwise from east.

  python3 mods/gw/make-map.py               # write the maps
  python3 mods/gw/make-map.py --check-only  # the saved maps match mod.json
"""
from collections import Counter, deque
from pathlib import Path
import base64
import json
import math
import sys

HERE = Path(__file__).resolve().parent
TILE = 32
CAP = 'gw.battle-v1'
# the game's terrain codes (game/core/src/core/types.ts)
DEEP, WATER, SAND, GRASS, FOREST, MOUNTAIN, ROAD, MUD = range(8)
BUILDABLE = (GRASS, SAND, ROAD)
LAND = (GRASS, SAND, ROAD, MUD)
SEA = (WATER, DEEP)
MAX_PIECES = 400

SHOWCASES = [
    ('showcase-efsf-0079', ['gw-efsf-0079'], ('Showcase: EFSF [0079]', '展示：EFSF[0079]', '전시: EFSF [0079]')),
    ('showcase-zeon-0079', ['gw-zeon-0079'], ('Showcase: ZEON [0079]', '展示：ZEON[0079]', '전시: ZEON [0079]')),
    ('showcase-aeug-0087', ['gw-aeug-0087'], ('Showcase: AEUG [0087]', '展示：AEUG[0087]', '전시: AEUG [0087]')),
    ('showcase-titans-neo-zeon-0087', ['gw-titans-0087', 'gw-neo-zeon-0087'],
     ('Showcase: TITANS and NEO ZEON [0087]', '展示：TITANS与NEO ZEON[0087]', '전시: TITANS와 NEO ZEON [0087]')),
    ('showcase-omni-zaft-ce71', ['gw-omni-ce71', 'gw-zaft-ce71'], ('Showcase: OMNI and ZAFT [CE71]', '展示：OMNI与ZAFT[CE71]', '전시: OMNI와 ZAFT [CE71]')),
]
LINES = ("Every unit and building of the factions named stands here before the whistle, each on its own ground, out of reach of the others.",
         '所列阵营的全部单位与建筑在开局前已各就各位，彼此不在射程之内。',
         '표기된 진영의 모든 유닛과 건물이 개전 전에 각자의 자리에 서 있으며, 서로의 사정거리 밖에 있습니다.')

mod = json.loads((HERE / 'mod.json').read_text())
defs = {d['id']: d for d in mod['defs']}
factions = {f['id']: f for f in mod['factions']}
kind = lambda d: d.get('kind') or ('building' if d.get('extends') == 'landmine' else 'unit')
gw_conf = lambda d: d.get('extensions', {}).get(CAP, {})
# what only a skill puts down: the drones and mines a unit launches
spawned = {i for i, d in defs.items() if d.get('extends') == 'landmine' or gw_conf(d).get('drone')}
# the longest gun that fires on its own, in tiles
REACH = max((w['range'] for d in defs.values() for w in d.get('weapons', []) if not w.get('extensions', {}).get(CAP, {}).get('skill')), default=0)
APART = math.ceil(REACH) + 4


def foot(d):
    """tiles a piece takes: a building's footprint, a unit's body and a tile round it"""
    if kind(d) == 'building':
        return d.get('fw', 2), d.get('fh', 2)
    body = d.get('body') or {'r': d.get('radius', 9), 'len': 0}
    side = max(1, math.ceil((body['len'] + 2 * body['r']) / TILE)) + 1
    return side, side if d.get('domain') == 'ship' else side


def shelf(items, x0, y0, width, gap=0):
    """items packed left to right in rows within `width` tiles: [(id, x, y)] and the rows' depth"""
    out, x, y, row = [], x0, y0, 0
    for id_, (w, h) in items:
        if x + w > x0 + width and x > x0:
            x, y, row = x0, y + row + gap, 0
        out.append((id_, x, y))
        x += w + gap
        row = max(row, h)
    return out, y + row - y0


def block(fid, origin):
    """one faction's ground: buildings, parade ground, airfield and harbour, from `origin` (west edge)"""
    f = factions[fid]
    roster = [i for i in f['roster'] if i not in spawned]
    buildings = [i for i in roster if kind(defs[i]) == 'building' and not defs[i].get('upgradeOf')]
    upgrades = [i for i in roster if kind(defs[i]) == 'building' and defs[i].get('upgradeOf')]
    naval = [i for i in buildings if any(defs[p].get('domain') == 'ship' for p in defs[i].get('produces', []))]
    land_b = [i for i in buildings if i not in naval] + upgrades
    units = [i for i in roster if kind(defs[i]) == 'unit']
    ships = [i for i in units if defs[i].get('domain') == 'ship']
    air = [i for i in units if defs[i].get('domain') == 'air']
    ground = [i for i in units if i not in ships and i not in air]
    width = 64
    out = {'buildings': [], 'ground': [], 'air': [], 'ships': [], 'naval': []}
    rows, depth = shelf([(i, foot(defs[i])) for i in land_b], origin + 2, 4, width - 4, gap=1)
    out['buildings'] = rows
    y = 4 + depth + 2
    rows, depth_g = shelf([(i, foot(defs[i])) for i in ground], origin + 2, y, 40)
    out['ground'] = rows
    rows, depth_a = shelf([(i, foot(defs[i])) for i in air], origin + 44, y, width - 46)
    out['air'] = rows
    # the opening base: a clearing below the parade ground, before the shore
    clearing = y + max(depth_g, depth_a) + 1
    out['spawn'] = {'x': origin + 30, 'y': clearing + 5}
    land_end = clearing + 11
    out['naval'] = naval
    out['ships'] = ships
    return out, land_end, width


def build(name, fids, text):
    blocks, land_end, x = [], 0, 0
    for i, fid in enumerate(fids):
        if i:
            x += APART
        b, end, width = block(fid, x)
        blocks.append((fid, x, b))
        land_end = max(land_end, end)
        x += width
    open_seat = len(fids) == 1
    W = x + APART + 24 if open_seat else x
    # the harbour: a shore under the land, then the sea the fleets lie in
    ship_rows = {}
    sea_depth = 0
    for fid, x0, b in blocks:
        rows, depth = shelf([(i, foot(defs[i])) for i in b['ships']], x0 + 2, 0, 60)
        ship_rows[fid] = rows
        sea_depth = max(sea_depth, depth)
    shore = land_end + 1
    H = shore + 6 + sea_depth + 6
    assert W <= 512 and H <= 512, f'{name} is {W}x{H}'
    t = [[GRASS] * W for _ in range(H)]

    def fill(x0, y0, x1, y1, v):
        for yy in range(max(0, y0), min(H, y1)):
            for xx in range(max(0, x0), min(W, x1)):
                t[yy][xx] = v
    fill(0, 0, W, 2, FOREST)
    fill(0, 2, 2, shore, FOREST)
    fill(W - 2, 2, W, shore, FOREST)
    fill(0, shore, W, shore + 2, SAND)
    fill(0, shore + 2, W, H, WATER)
    fill(0, shore + 5, W, H, DEEP)
    taken = {}

    def hold(label, x0, y0, w=1, h=1):
        assert 0 <= x0 and x0 + w <= W and 0 <= y0 and y0 + h <= H, f'{label} lies off {name}'
        for yy in range(y0, y0 + h):
            for xx in range(x0, x0 + w):
                assert (xx, yy) not in taken, f'{label} overlaps {taken[(xx, yy)]} at {xx},{yy} on {name}'
                taken[(xx, yy)] = label

    units, spawns = [], []
    for seat, (fid, x0, b) in enumerate(blocks):
        sp = b['spawn']
        spawns.append(sp)
        fill(x0 + 2, 3, x0 + 62, 4 + 1, ROAD)
        hold(f'opening base {seat}', sp['x'] - 5, sp['y'] - 4, 11, 9)

        def put(id_, px, py):
            d = defs[id_]
            w, h = foot(d) if kind(d) == 'building' else (1, 1)
            if kind(d) == 'unit':
                fw, fh = foot(d)
                px, py = px + fw // 2, py + fh // 2
            hold(id_, px, py, w, h)
            piece = {'id': id_, 'owner': seat, 'x': px, 'y': py}
            if kind(d) == 'unit':
                piece['a'] = 90
            units.append(piece)
        for id_, px, py in b['buildings']:
            put(id_, px, py)
            fill(px, py + foot(defs[id_])[1], px + foot(defs[id_])[0], py + foot(defs[id_])[1] + 1, ROAD)
        for id_, px, py in b['ground']:
            put(id_, px, py)
        for id_, px, py in b['air']:
            put(id_, px, py)
        # naval factories stand in the shallows by the shore
        nx = x0 + 4
        for id_ in b['naval']:
            w, h = foot(defs[id_])
            for yy in range(shore + 2, shore + 2 + h):
                for xx in range(nx, nx + w):
                    t[yy][xx] = WATER
            put(id_, nx, shore + 2)
            nx += w + 2
        for id_, px, py in ship_rows[fid]:
            put(id_, px, py + shore + 6)
        # the parade ground and the airfield: open ground, a road between
        fill(x0 + 42, 4, x0 + 44, land_end, ROAD)
    if open_seat:
        sp = {'x': W - 14, 'y': blocks[0][2]['spawn']['y']}
        spawns.append(sp)
        hold('open seat', sp['x'] - 5, sp['y'] - 4, 11, 9)
    return W, H, t, units, spawns


def check(name, fids, W, H, t, units, spawns):
    counts = Counter(p['id'] for p in units)
    want = Counter(i for fid in fids for i in factions[fid]['roster'] if i not in spawned)
    assert counts == want, f'{name}: missing {sorted(set(want) - set(counts))}, extra {sorted(set(counts) - set(want))}'
    for p in units:
        d = defs[p['id']]
        assert p['id'] in factions[fids[p['owner']]]['roster'], f"{p['id']} is not {fids[p['owner']]}'s"
        if kind(d) == 'building':
            w, h = foot(d)
            ground = [t[y][x] for y in range(p['y'], p['y'] + h) for x in range(p['x'], p['x'] + w)]
            if any(defs[q].get('domain') == 'ship' for q in d.get('produces', [])):
                ring = [t[y][x] for y in range(p['y'] - 1, p['y'] + h + 1) for x in range(p['x'] - 1, p['x'] + w + 1) if 0 <= x < W and 0 <= y < H]
                assert all(v in SEA for v in ground) and any(v in BUILDABLE for v in ring), f"{p['id']} needs water by a shore"
            elif d.get('extends') != 'landmine':
                assert all(v in BUILDABLE for v in ground), f"{p['id']} off buildable ground on {name}"
        elif d.get('domain') == 'ship':
            body = d.get('body') or {'r': d.get('radius', 9), 'len': 0}
            half = math.ceil((body['len'] / 2 + body['r']) / TILE) + 1
            for ty in range(p['y'] - half, p['y'] + half + 1):
                for tx in range(p['x'] - half, p['x'] + half + 1):
                    assert 0 <= tx < W and 0 <= ty < H and t[ty][tx] in SEA, f"{p['id']} runs aground on {name}"
            assert not d.get('underwater') or t[p['y']][p['x']] == DEEP, f"{p['id']} dives in deep water"
        elif d.get('domain') != 'air':
            assert t[p['y']][p['x']] in LAND, f"{p['id']} off passable ground on {name}"
    sides = [[(p['x'], p['y']) for p in units if p['owner'] == s] for s in range(len(fids))]
    gap = min((math.dist(a, b) for i in range(len(sides)) for j in range(i + 1, len(sides)) for a in sides[i] for b in sides[j]), default=math.inf)
    assert gap >= REACH + 2, f'{name}: the sides stand {gap:.1f} tiles apart'
    # a ground route between every pair of opening bases
    start = (spawns[0]['x'], spawns[0]['y'])
    seen, queue = {start}, deque([start])
    while queue:
        x, y = queue.popleft()
        for nxt in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nxt[0] < W and 0 <= nxt[1] < H and nxt not in seen and t[nxt[1]][nxt[0]] in LAND:
                seen.add(nxt)
                queue.append(nxt)
    assert all((s['x'], s['y']) in seen for s in spawns), f'{name}: no ground route between the bases'
    assert len(units) <= MAX_PIECES, f'{name}: {len(units)} pieces'
    return gap


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


placed = set()
for name, fids, title in SHOWCASES:
    W, H, t, units, spawns = build(name, fids, title)
    gap = check(name, fids, W, H, t, units, spawns)
    placed |= {p['id'] for p in units}
    data = {
        'format': 'steel-tide-map', 'v': 1, 'name': title[0], 'description': LINES[0],
        'translations': {'zh': {'name': title[1], 'description': LINES[1]}, 'ko': {'name': title[2], 'description': LINES[2]}},
        'w': W, 'h': H, 'terrain': rle(t), 'deposits': [], 'spawns': spawns, 'units': units,
    }
    text = json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n'
    assert len(text.encode()) < 512 * 1024
    out = HERE / 'maps' / f'{name}.steel-tide-map'
    if '--check-only' in sys.argv:
        assert out.read_text() == text, f'{out.name} differs from the roster; run make-map.py'
    else:
        out.parent.mkdir(exist_ok=True)
        out.write_text(text)
    print(f"{'verified' if '--check-only' in sys.argv else 'wrote'} {out.relative_to(HERE)}: {W}x{H}, {len(units)} pieces, "
          f"{len(spawns)} seats" + (f', sides {gap:.0f} tiles apart' if gap != math.inf else ''))
missing = set(defs) - placed - spawned
assert not missing, f'on no showcase map: {sorted(missing)}'

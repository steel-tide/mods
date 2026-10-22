#!/usr/bin/env python3
"""Build the new Crossroads Exercise showcase from the actual manifest.

This is an original Steel Tide map, not a conversion of a source 5v5 TMX.
All selected combat definitions and their explicit forms appear once. The normal
Conquest opening keeps an unobstructed reservation at each spawn; additional
HQ examples and the support vehicles are laid in the rear staging areas.
"""

import argparse
import base64
import json
from collections import Counter, deque
from pathlib import Path

HERE = Path(__file__).resolve().parent
W, H = 96, 200
DEEP, WATER, SAND, GRASS, FOREST, MOUNTAIN, ROAD, MUD = range(8)
RUBBLE, BRIDGE = 10, 19


def rle(rows):
    flat = [v for row in rows for v in row]
    encoded = bytearray()
    i = 0
    while i < len(flat):
        count = 1
        while i + count < len(flat) and flat[i + count] == flat[i] and count < 255:
            count += 1
        encoded.extend((count, flat[i]))
        i += count
    return base64.b64encode(encoded).decode('ascii')


def build():
    from profile_pack import expand_profiles
    manifest = expand_profiles(json.loads((HERE / 'mod.json').read_text()), HERE)
    selection = json.loads((HERE / 'mvp-roster.json').read_text())
    source = {e['rwName']: e for e in json.loads((HERE / 'selected.json').read_text())}
    defs = {d['id']: d for d in manifest['defs']}
    combat_names = [n for group in selection['nations'].values() for n in group] + selection['shared']
    combat_ids = {source[n]['id'] for n in combat_names}
    assert len(combat_names) == len(combat_ids), 'duplicate combat selection'
    assert combat_ids <= defs.keys(), f'manifest is missing selected units: {combat_ids - defs.keys()}'
    terrain = [[GRASS] * W for _ in range(H)]
    overlays = [[0] * W for _ in range(H)]

    def fill(x0, y0, x1, y1, value, grid=terrain):
        for y in range(y0, y1):
            for x in range(x0, x1):
                grid[y][x] = value

    # Broad staging ground on either bank; paved approaches meet steel bridges.
    fill(0, 0, W, 2, FOREST)
    fill(0, H - 2, W, H, FOREST)
    fill(0, 2, 2, H - 2, FOREST)
    fill(W - 2, 2, W, H - 2, FOREST)
    fill(45, 2, 51, H - 2, SAND)
    fill(46, 2, 50, H - 2, WATER)
    for y in (31, 52):
        fill(4, y, 46, y + 3, ROAD)
        fill(50, y, W - 4, y + 3, ROAD)
        fill(46, y, 50, y + 3, BRIDGE, overlays)
    fill(21, 7, 23, H - 5, ROAD)
    fill(73, 7, 75, H - 5, ROAD)
    for x0, y0, x1, y1, value in [
        (36, 5, 42, 11, FOREST), (54, 5, 60, 11, FOREST),
        (37, 20, 42, 25, MUD), (54, 20, 59, 25, MUD),
        (38, 61, 42, 67, RUBBLE), (54, 61, 58, 67, RUBBLE),
        (36, 71, 42, 76, FOREST), (54, 71, 60, 76, FOREST),
    ]:
        fill(x0, y0, x1, y1, value)

    spawns = [{'x': 12, 'y': 40}, {'x': 83, 'y': 40}]
    deposits = [{'x': x, 'y': y} for x, y in [
        (6, 29), (11, 29), (16, 29), (79, 29), (84, 29), (89, 29),
        (8, 50), (16, 50), (79, 50), (87, 50), (41, 39), (54, 39),
    ]]
    occupied = {}
    units = []
    decor = []

    def reserve(label, x, y, width=1, height=1):
        assert 0 <= x < x + width <= W and 0 <= y < y + height <= H, f'{label} off map'
        for yy in range(y, y + height):
            for xx in range(x, x + width):
                assert (xx, yy) not in occupied, f'{label} overlaps {occupied.get((xx, yy))} at {xx},{yy}'
                occupied[(xx, yy)] = label

    for seat, sp in enumerate(spawns):
        reserve(f'opening base {seat}', sp['x'] - 5, sp['y'] - 4, 11, 9)

    def put(id_, owner, x, y):
        definition = defs[id_]
        building = definition['kind'] == 'building'
        width, height = (definition.get('fw', 2), definition.get('fh', 2)) if building else (1, 1)
        reserve(id_, x, y, width, height)
        for yy in range(y, y + height):
            for xx in range(x, x + width):
                if definition.get('domain') != 'air':
                    assert terrain[yy][xx] not in (DEEP, WATER, MOUNTAIN), f'{id_} on impassable ground'
        if definition.get('needsDeposit'):
            assert any(x <= p['x'] < x + width and y <= p['y'] < y + height for p in deposits), f'{id_} requires deposit'
        piece = {'id': id_, 'owner': owner, 'x': x, 'y': y}
        if not building:
            piece['a'] = 0 if owner == 0 else 180
        units.append(piece)

    # National rows are for visual inspection, not source-deck or alliance rules.
    # The base game assigns the two opposing owners and their chosen factions.
    zones = {
        'ru': (0, 24, 5, 8, 13),
        'cn': (0, 24, 68, 8, 90),
        'kp': (0, 24, 148, 8, 160),
        'us': (1, 55, 5, 78, 13),
        'eu': (1, 55, 52, 78, 68),
        'kr': (1, 55, 118, 78, 134),
        'jp': (1, 55, 158, 84, 162),
    }
    for nation, names in selection['nations'].items():
        owner, gx, gy, ax, ay = zones[nation]
        ground = [n for n in names if defs[source[n]['id']].get('domain') != 'air']
        air = [n for n in names if defs[source[n]['id']].get('domain') == 'air']
        for i, name in enumerate(ground):
            put(source[name]['id'], owner, gx + (i % 5) * 4, gy + (i // 5) * 4)
        for i, name in enumerate(air):
            put(source[name]['id'], owner, ax + (i % 3) * 4, ay + (i // 3) * 4)
    for i, name in enumerate(selection['shared']):
        put(source[name]['id'], 0, 33 + i * 4, 8)

    # Rules and capability deployments expose explicit source forms. Show each form
    # beside its nation's force without treating it as another recruitable unit.
    forms = set()
    # Each side's form exhibits fill its rear river-bank strip, column by column.
    spare_by_owner = {0: [(x, y) for y in range(100, H - 6, 4) for x in (26, 30, 34, 38)],
                      1: [(x, y) for y in range(140, H - 6, 4) for x in (56, 60, 64, 68)]}
    for piece in list(units):
        definition = defs[piece['id']]
        targets = [rule.get('do', {}).get('morph') for rule in definition.get('rules', [])]
        targets += [action.get('to') for action in definition.get('extensions', {}).get('articulation-v1', {}).get('deployments', [])]
        for target_id in targets:
            if not target_id or target_id in combat_ids or target_id in forms:
                continue
            assert target_id in defs, f'unknown morph target {target_id}'
            owner = piece['owner']
            free = [p for p in spare_by_owner[owner] if (p[0], p[1]) not in occupied]
            assert free, 'no spare form exhibit position'
            x, y = free[0]; spare_by_owner[owner].remove(free[0])
            put(target_id, owner, x, y)
            forms.add(target_id)

    # Builder IDs can be distinct integration defs instead of the source hull ID.
    # Resolve by the source art, with source ID as a fallback.
    for nation, position in {'ru': (0, 9, 24), 'cn': (0, 17, 24), 'us': (1, 79, 24), 'eu': (1, 87, 24)}.items():
        original = source[selection['builders'][nation]]['id']
        candidates = [d for d in defs.values() if d.get('builds') and (d.get('sprite') == 'u.' + original or d['id'] == original)]
        if not candidates:
            candidates = [d for d in defs.values() if d.get('builds') and nation in d['id'].split('-')]
        assert candidates, f'cannot resolve {nation} builder in manifest'
        put(candidates[0]['id'], *position)

    factions = manifest.get('factions', [])
    for nation, owner, x, y in [('ru', 0, 9, 7), ('us', 1, 82, 7)]:
        faction = next((f for f in factions if nation in f['id'].split('-')), None)
        assert faction, f'cannot resolve {nation} faction for HQ exhibit'
        put(faction['headquarters'], owner, x, y)
    for nation, owner, x in [('ru', 0, 4), ('us', 1, 76)]:
        put(f'usgr-re-{nation}-recruitment', owner, x, 4)
        put(f'usgr-re-{nation}-airfield', owner, x + 12, 4)

    # Props stay outside force tiles and the clear opening reservations.
    for kind, x, y, fw, fh in [
        ('hangar', 8, 19, 3, 2), ('hangar', 15, 19, 3, 2),
        ('hangar', 79, 19, 3, 2), ('hangar', 86, 19, 3, 2),
        ('tent', 5, 62, 2, 2), ('tent', 18, 62, 2, 2),
        ('tent', 77, 68, 2, 2), ('tent', 88, 68, 2, 2),
        ('tower', 42, 29, 1, 1), ('tower', 53, 29, 1, 1),
        ('tower', 42, 56, 1, 1), ('tower', 53, 56, 1, 1),
    ]:
        if any((xx, yy) in occupied for xx in range(x, x+fw) for yy in range(y, y+fh)):
            continue
        reserve(kind, x, y, fw, fh)
        decor.append({'kind': kind, 'x': x, 'y': y})

    counts = Counter(u['id'] for u in units)
    assert all(counts[id_] == 1 for id_ in combat_ids | forms), 'combat/form coverage is not exactly once'
    assert all(p['owner'] in (0, 1) for p in units)
    assert len(units) <= 400
    assert all((p['x'], p['y']) not in occupied for p in deposits), 'a deposit overlaps a display piece'

    # Check that a ground route links the clear starting areas over a crossing.
    start = (spawns[0]['x'], spawns[0]['y'])
    target = (spawns[1]['x'], spawns[1]['y'])
    seen, queue = {start}, deque([start])
    while queue:
        x, y = queue.popleft()
        for xx, yy in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if not (0 <= xx < W and 0 <= yy < H) or (xx, yy) in seen:
                continue
            if terrain[yy][xx] in (DEEP, WATER, MOUNTAIN) and overlays[yy][xx] != BRIDGE:
                continue
            seen.add((xx, yy)); queue.append((xx, yy))
    assert target in seen, 'starting areas disconnected for ground units'

    data = {
        'format': 'steel-tide-map', 'v': 1,
        'name': 'Crossroads Exercise',
        'description': 'A river valley with bridges, paved approaches and motor pools on both banks. Aircraft gather above the rear fields.',
        'translations': {
            'zh': {'name': '十字路口演习', 'description': '河谷两岸分布着车场与铺装道路，桥梁跨过河道，飞机集结在后方空地上。'},
            'ko': {'name': '교차로 훈련', 'description': '다리와 포장도로가 이어지는 강 계곡. 양쪽 강둑에는 차량 집결지가 있고 후방에는 항공기가 모여 있습니다.'},
        },
        'w': W, 'h': H, 'terrain': rle(terrain), 'overlays': rle(overlays),
        'spawns': spawns, 'deposits': deposits, 'decor': decor, 'units': units,
    }
    encoded = json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n'
    assert len(encoded.encode()) < 512 * 1024
    return data, encoded, len(combat_ids)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check-only', action='store_true', help='validate reproducibility without writing')
    args = parser.parse_args()
    data, encoded, covered = build()
    path = HERE / 'maps' / 'crossroads-exercise.steel-tide-map'
    if args.check_only:
        assert path.read_text() == encoded, 'saved map differs from regenerated map'
    else:
        path.parent.mkdir(exist_ok=True)
        path.write_text(encoded)
    print(f'{"verified" if args.check_only else "wrote"} {path.name}: {W}x{H}, {len(data["units"])} pieces, all {covered} selected combat units, {len(data["decor"])} props')

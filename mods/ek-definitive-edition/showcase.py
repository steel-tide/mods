#!/usr/bin/env python3
"""Deterministic test range; source units and gameplay definitions stay intact."""
import base64
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
MAP_PATH = 'maps/complete-showcase.steel-tide-map'
NAME = 'EK Complete Showcase'
W, H = 384, 448
# x, y, columns, spacing. Coordinates are tile origins, as in the map editor.
SECTORS = {
    'buildings': (12, 224, 12, 12),
    'ground': (12, 32, 12, 12),
    'amphibious': (172, 264, 8, 12),
    'naval': (284, 264, 7, 14),
    'air': (172, 32, 10, 18),
    'helpers': (12, 348, 18, 14),
}

def signature(units):
    value = json.dumps([[u['id'], u['owner'], u['x'], u['y'], u.get('a', 0)] for u in units], separators=(',', ':'))
    n = 2166136261
    for c in value:
        n = ((n ^ ord(c)) * 16777619) & 0xffffffff
    return n

def build(defs, inventory):
    sources = {e['id']: e for e in inventory}
    groups = {k: [] for k in SECTORS}
    for d in defs:
        c = sources[d['id']]['ini']['core']
        helper = c.get('isUnselectable', '').lower() in ('1', 'true') or float(c.get('maxHp', 1)) <= 1
        sector = ('naval' if d.get('domain') == 'ship' or d.get('offshore') else
                  'helpers' if helper else 'buildings' if d['kind'] == 'building' else d['domain'])
        groups[sector].append(d)
    placements, index = [], []
    terrain = bytearray([3] * (W * H))
    def rect(x, y, w, h, tile):
        for yy in range(y, min(H, y + h)):
            for xx in range(x, min(W, x + w)):
                terrain[yy * W + xx] = tile
    # A connected fleet basin, beach, paved aisles and an empty southern range.
    rect(278, 254, 106, 194, 2)
    rect(282, 258, 102, 190, 1)
    for y in (22, 214, 338, 438): rect(4, y, 270, 3, 6)
    rect(158, 4, 3, 432, 6)
    rect(4, 4, 3, 432, 6)
    for sector, group in groups.items():
        x0, y0, cols, step = SECTORS[sector]
        for i, d in enumerate(sorted(group, key=lambda d: d['id'])):
            x, y = x0 + i % cols * step, y0 + i // cols * step
            u = {'id': d['id'], 'owner': 0, 'x': x, 'y': y}
            if d['kind'] == 'unit': u['a'] = 270
            placements.append(u)
            index.append(dict(u, sector=sector, name=d['name'], source=sources[d['id']]['source']))
    # Keep the map under the host's 400-piece cap. The mod bootstraps the rest.
    targets = [
        {'id': 'mbt', 'owner': 1, 'x': 274, 'y': 408, 'a': 180},
        {'id': 'htank', 'owner': 1, 'x': 274, 'y': 420, 'a': 180},
        {'id': 'fighter', 'owner': 1, 'x': 306, 'y': 408, 'a': 180},
        {'id': 'destroyer', 'owner': 1, 'x': 330, 'y': 420, 'a': 180},
    ]
    static = placements[:396] + targets
    overflow = placements[396:]
    # Deposits under every extractor, plus open fields for construction testing.
    deposits = [{'x': 32 + i * 8, 'y': 14} for i in range(10)]
    byid = {d['id']: d for d in defs}
    for u in placements:
        d = byid[u['id']]
        if d.get('needsDeposit'):
            deposits.append({'x': u['x'] + d.get('fw', 1) // 2, 'y': u['y'] + d.get('fh', 1) // 2})
    runs = bytearray()
    i = 0
    while i < len(terrain):
        count = 1
        while count < 255 and i + count < len(terrain) and terrain[i + count] == terrain[i]: count += 1
        runs.extend((count, terrain[i])); i += count
    data = {
        'format': 'steel-tide-map', 'v': 1, 'name': NAME,
        'description': 'All 573 EK definitions, including alternate forms and helpers. Use seat 1 and disable fog. Specimens wait until you start a test, give an order or use an action. Land, air and naval ranges; passive targets; 1M metal and 100K research.',
        'translations': {
            'zh': {'name': 'EK 全单位展示测试场', 'description': '包含全部573个EK定义、变体及辅助单位。使用1号席位并关闭迷雾。单位保持暂停，直至启动测试、下达指令或使用单位动作。设有陆海空区域和被动靶标；提供100万金属、10万实验科技。'},
            'ko': {'name': 'EK 전체 유닛 시험장', 'description': '변형과 보조 유닛을 포함한 EK 정의 573개를 배치합니다. 1번 자리에서 안개를 끄세요. 표본은 시험 시작, 명령 또는 유닛 행동을 선택할 때까지 정지합니다. 육해공 구역과 수동 표적, 금속 100만과 실험 기술 10만을 제공합니다.'},
        },
        'w': W, 'h': H, 'terrain': base64.b64encode(runs).decode(),
        'deposits': deposits, 'spawns': [{'x': 16, 'y': 12}, {'x': 268, 'y': 432}], 'units': static,
    }
    layout = {'name': NAME, 'w': W, 'h': H, 'signature': signature(static),
              'overflow': [[u['id'], u['x'], u['y'], u.get('a', 0)] for u in overflow]}
    for path, value in [(MAP_PATH, data), ('maps/showcase-index.json', index), ('extensions/ek-systems/showcase-layout.json', layout)]:
        target = HERE / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    assert len(placements) == len(defs) == len({u['id'] for u in placements})
    assert len(static) <= 400
    return MAP_PATH

if __name__ == '__main__':
    build(json.loads((HERE/'mod.json').read_text())['defs'], json.loads((HERE/'source-inventory.json').read_text()))

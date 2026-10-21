#!/usr/bin/env python3
"""Port the bundled RW TMX layouts to native Steel Tide skirmish maps.

Requires Pillow (also used by port-rw.py). Run from any directory. Original
TMX files are read only; no game source or generated engine tools are edited.
See MAPS.md for the source inventory and deliberate gameplay adaptations.
"""
from __future__ import annotations

import argparse
import base64
import bisect
import io
import hashlib
import json
import math
import struct
import xml.etree.ElementTree as ET
import zlib
from collections import Counter, defaultdict, deque
from pathlib import Path

from PIL import Image, ImageStat

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
STOCK = ROOT / 'rusted-warfare-mods/fg-rusted-league/assets/tilesets'
# The stock TSX files are already preserved in this repository. They supply
# metadata for external references, especially team IDs and resource markers.
SOURCES = [
    ('(10P)危险的市区.tmx', 'dangerous-downtown', 'Dangerous Downtown', '危险的市区'),
    ('(10P)洛杉矶郊区之战等待陆战一师马奇空军基地支援 .tmx', 'los-angeles-outskirts', 'Los Angeles Outskirts', '洛杉矶郊区之战'),
    ('(1v2)绿色生活-城镇住宅小区.tmx', 'green-life', 'Green Life: Residential District', '绿色生活：城镇住宅小区'),
    ('(4p)港口城镇-沙漏倒计.tmx', 'harbour-town', 'Harbour Town: Hourglass', '港口城镇：沙漏倒计'),
    ('(4p)灰色城市-铁路网络.tmx', 'railway-network', 'Grey City: Railway Network', '灰色城市：铁路网络'),
    ('(4p)遗失文明-断桥商业街.tmx', 'broken-bridge', 'Lost Civilization: Broken Bridge', '遗失文明：断桥商业街'),
    ('10P沙漠公路.tmx', 'desert-highway', 'Desert Highway', '沙漠公路'),
    ('4p长桥久战.tmx', 'long-bridge', 'The Long Bridge', '长桥久战'),
    ('8p_industrial_zone_mini_bySeCtAnT_ft.Teoshebo.tmx', 'industrial-zone', 'Industrial Zone Mini', '工业区 Mini'),
    ('大城市平原战争超大地图.tmx', 'great-city-plains', 'Great City: War on the Plains', '大城市：平原战争'),
    ('好多入😍😍😍.tmx', 'crowded-city', 'Crowded City (Skirmish)', '好多入（遭遇战）'),
    ('尸城.tmx', 'dead-city', 'Dead City (Skirmish)', '尸城（遭遇战）'),
    ('森林湖郊区[8p].tmx', 'forest-lake', 'Forest Lake Suburbs', '森林湖郊区'),
    ('森林湖郊区官方重置版.tmx', 'forest-lake-remastered', 'Forest Lake: Remastered', '森林湖郊区：官方重置版'),
    ('隔岸.tmx', 'opposite-bank', 'The Opposite Bank', '隔岸'),
]
WATER, SAND, GRASS, FOREST, MOUNTAIN, ROAD, MUD, SNOW, RUBBLE, LAVA, CITY, BRIDGE = 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 16, 19
DRIVABLE = {SAND, GRASS, ROAD, MUD, 8, SNOW, RUBBLE, 17, 18, BRIDGE}
COLORS = ['#153d59', '#2e7594', '#b8a476', '#6a8152', '#314e39', '#626466', '#58595c', '#776958', '#617b70', '#cad4d5', '#80746c', '#c05028', '#646567', '#646567', '#646567', '#646567', '#a1a1a5', '#75a3a8', '#a1c7d3', '#b19f82']


def properties(element):
    return {p.get('name'): p.get('value', p.text or '') for p in element.findall('./properties/property')}


def layer_data(layer):
    data = layer.find('data')
    if data.get('encoding') == 'csv':
        values = [int(v) for v in data.text.replace('\n', '').split(',') if v.strip()]
    elif data.get('encoding') == 'base64':
        raw = base64.b64decode(data.text)
        compression = data.get('compression')
        if compression in ('gzip', 'zlib'):
            raw = zlib.decompress(raw, 31 if compression == 'gzip' else 15)
        elif compression:
            raise ValueError(f'Unsupported TMX compression: {compression}')
        values = struct.unpack(f'<{len(raw) // 4}I', raw)
    else:
        raise ValueError('Expected finite CSV or base64 TMX layer')
    assert len(values) == int(layer.get('width')) * int(layer.get('height'))
    # Flips affect the source drawing, not its terrain or unit metadata.
    return [v & 0x0fffffff for v in values]


class SourceMap:
    def __init__(self, path, stock):
        self.path = path
        self.stock = stock
        self.invalid_tiles = set()
        self.root = ET.parse(path).getroot()
        assert self.root.get('orientation') == 'orthogonal'
        assert self.root.get('infinite', '0') == '0'
        self.w, self.h = int(self.root.get('width')), int(self.root.get('height'))
        self.tw, self.th = int(self.root.get('tilewidth')), int(self.root.get('tileheight'))
        self.sets, self.firstgids, self.images, self.tiles = [], [], {}, {}
        for entry in self.root.findall('tileset'):
            self.firstgids.append(int(entry.get('firstgid')))
            source = entry.get('source')
            directory = path.parent
            if source:
                external = path.parent / source
                if not external.is_file():
                    external = stock / source.split('tilesets/')[-1]
                directory = external.parent
                entry = ET.parse(external).getroot()
            self.sets.append((entry, directory))

    def image(self, i):
        if i not in self.images:
            entry, directory = self.sets[i]
            embedded = properties(entry).get('embedded_png')
            if not embedded:
                node = entry.find('.//property[@name="embedded_png"]')
                embedded = node.get('value', node.text or '') if node is not None else None
            if embedded:
                image = Image.open(io.BytesIO(base64.b64decode(embedded)))
            elif entry.find('image') is not None:
                image_path = directory / entry.find('image').get('source')
                if not image_path.is_file():
                    image_path = self.stock / 'bitmaps' / Path(entry.find('image').get('source')).name
                if image_path.is_file():
                    image = Image.open(image_path)
                else:
                    # Some originals refer to the author's Windows desktop.
                    # Recover that same atlas from another bundled TMX.
                    image = None
                    for sibling in sorted(self.path.parent.glob('*.tmx')):
                        for other in ET.parse(sibling).getroot().findall('tileset'):
                            png = properties(other).get('embedded_png')
                            if png and other.get('name') == entry.get('name') and other.get('columns') == entry.get('columns'):
                                image = Image.open(io.BytesIO(base64.b64decode(png)))
                                break
                        if image is not None:
                            break
                    if image is None:
                        raise ValueError(f'{self.path.name}: missing atlas {entry.get("name")}')
            else:
                raise ValueError(f'{self.path.name}: missing image for {entry.get("name")}')
            self.images[i] = image.convert('RGBA')
        return self.images[i]

    def tile(self, gid):
        if gid not in self.tiles:
            i = bisect.bisect_right(self.firstgids, gid) - 1
            if i < 0:
                raise ValueError(f'Unresolved tile {gid}')
            entry, _ = self.sets[i]
            local = gid - self.firstgids[i]
            node = entry.find(f"tile[@id='{local}']")
            props = properties(node) if node is not None else {}
            if 'unit' in props or 'res_pool' in props:
                self.tiles[gid] = (entry.get('name', '').lower(), props, (0, 0, 0), True)
                return self.tiles[gid]
            image = self.image(i)
            tw, th = int(entry.get('tilewidth')), int(entry.get('tileheight'))
            spacing, margin = int(entry.get('spacing', '0')), int(entry.get('margin', '0'))
            columns = int(entry.get('columns', '0')) or (image.width - 2 * margin + spacing) // (tw + spacing)
            x, y = margin + local % columns * (tw + spacing), margin + local // columns * (th + spacing)
            if x + tw > image.width or y + th > image.height:
                # Some sources contain orphaned GIDs in atlas gaps.
                # Keep any authored metadata, but do not invent a visual tile.
                self.invalid_tiles.add(gid)
                self.tiles[gid] = (entry.get('name', '').lower(), props, (0, 0, 0), False)
                return self.tiles[gid]
            tile = image.crop((x, y, x + tw, y + th))
            alpha = tile.getchannel('A')
            rgb = ImageStat.Stat(tile.convert('RGB'), alpha).mean if alpha.getbbox() else (0, 0, 0)
            self.tiles[gid] = (entry.get('name', '').lower(), props, rgb, bool(alpha.getbbox()))
        return self.tiles[gid]


def terrain_for(name, props, rgb, visible, *, ground):
    """Translate semantics first, then palette for RW's mixed export atlases.

    Urban authors use lava/large-cliff tags to block buildings. Their grey
    roofs become City, not molten rock; genuinely red lava stays Lava.
    Transparent detail tiles and unit/resource markers keep the floor below.
    """
    unit = props.get('unit', '')
    if unit == 'tree' or 'trees' in props:
        return FOREST
    if unit or 'res_pool' in props or not visible:
        return None
    r, g, b = rgb
    if 'water-bridge' in props:
        return BRIDGE
    if 'water' in props or 'water-cliff' in props:
        return WATER
    built = any(word in name for word in ('building', 'foundry', 'tilecity', 'light', 'heavy', 'entrance', '城市', 'pack1', 'pack2', 'pack3'))
    blocked = any(key in props for key in ('large-cliff', 'large_rock', 'lava-cliff', 'cliff', 'lager-cilff'))
    if 'lava' in props:
        return LAVA if r > g * 1.6 and r > b * 1.5 else CITY
    if 'building' in name or 'foundry' in name or (blocked and built):
        return CITY
    if blocked:
        return CITY if max(rgb) - min(rgb) < 30 else MOUNTAIN
    # Signs, window decals, lamps and foliage must not erase a road or river.
    if not ground and any(word in name for word in ('detail', 'decoration', 'sign', 'items', 'misc')):
        return None
    if 'bridge' in name:
        return BRIDGE
    if any(word in name for word in ('road', '交通', '直路')):
        return ROAD
    if any(word in name for word in ('tilecity', 'light', 'heavy', 'entrance', '城市', '001型', 'pack1', 'pack2', 'pack3')):
        return GRASS if g > r * 1.2 and g > b * 1.2 else ROAD
    if 'lava' in name and r > g * 1.6 and r > b * 1.5:
        return LAVA
    if b > r * 1.18 and b > g * 1.06:
        return WATER
    if g > r * 1.12 and g > b * 1.15:
        return GRASS
    if 'snow' in name and min(rgb) > 140:
        return SNOW
    if 'ice' in name:
        return 18
    if r > g * 1.12 and r > b * 1.2:
        return SAND if r > 115 else MUD
    if 'mountain' in name:
        return MOUNTAIN
    if 'grass' in name or 'farm' in name:
        return GRASS
    if 'concrete' in name or 'tile' in name or 'ground1' in name or 'ground2' in name:
        return ROAD
    return RUBBLE if ground else None


def rle(values):
    out = bytearray()
    previous, run = values[0], 0
    for value in values:
        if value != previous or run == 255:
            out.extend((run, previous))
            previous, run = value, 0
        run += 1
    out.extend((run, previous))
    return base64.b64encode(out).decode('ascii')


def component_labels(terrain, w, h):
    labels, sizes = [-1] * len(terrain), []
    for start, value in enumerate(terrain):
        if value not in DRIVABLE or labels[start] >= 0:
            continue
        label = len(sizes)
        queue = deque([start])
        labels[start], count = label, 0
        while queue:
            at = queue.popleft()
            count += 1
            x, y = at % w, at // w
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                to = ny * w + nx
                if 0 <= nx < w and 0 <= ny < h and labels[to] < 0 and terrain[to] in DRIVABLE:
                    labels[to] = label
                    queue.append(to)
        sizes.append(count)
    return labels, sizes


def convert(source, slug, english, chinese, output, companion):
    # Keep whole source tiles at a uniform integer scale. Only the 1000-square
    # layout needs reduction (2:1); there is no cropping of its outer districts.
    scale = math.ceil(max(source.w, source.h) / 512)
    w, h = math.ceil(source.w / scale), math.ceil(source.h / scale)
    terrain = [GRASS] * (source.w * source.h)
    hqs, pools, unit_counts = defaultdict(set), set(), Counter()
    for layer in source.root.findall('layer'):
        if layer.get('visible', '1') == '0':
            continue
        lw, lh = int(layer.get('width')), int(layer.get('height'))
        ox = int(layer.get('x', 0)) + round(float(layer.get('offsetx', 0)) / source.tw)
        oy = int(layer.get('y', 0)) + round(float(layer.get('offsety', 0)) / source.th)
        ground = layer.get('name', '').lower() == 'ground'
        for index, gid in enumerate(layer_data(layer)):
            if not gid:
                continue
            x, y = index % lw + ox, index // lw + oy
            if not (0 <= x < source.w and 0 <= y < source.h):
                continue
            name, props, rgb, visible = source.tile(gid)
            unit = props.get('unit')
            if unit:
                unit_counts[unit] += 1
                if unit.lower() == 'commandcenter':
                    team = int(props['team'])
                    if team >= 0:
                        hqs[team].add((x // scale, y // scale))
            if 'res_pool' in props:
                pools.add((x // scale, y // scale))
            value = terrain_for(name, props, rgb, visible, ground=ground)
            if value is not None:
                at = y * source.w + x
                # Road decks laid in an upper layer retain the river below.
                terrain[at] = BRIDGE if not ground and value == ROAD and terrain[at] in (WATER, BRIDGE) else value
    object_units = Counter()
    for obj in source.root.findall('.//object'):
        props = properties(obj)
        if 'unit' in props:
            object_units[props['unit']] += 1
    if scale > 1:
        small = []
        for y in range(h):
            for x in range(w):
                cells = [terrain[sy * source.w + sx] for sy in range(y * scale, min((y + 1) * scale, source.h)) for sx in range(x * scale, min((x + 1) * scale, source.w))]
                # Preserve narrow crossings/streets when reducing, then use
                # the majority material (stable row-major tie breaking).
                small.append(BRIDGE if BRIDGE in cells else ROAD if ROAD in cells else Counter(cells).most_common(1)[0][0])
        terrain = small
    # RW allows bases on its bridge terrain; native foundations need land.
    # Make the two bridgeheads into abutments and small pads under its ore.
    if slug == 'long-bridge':
        for y in range(h):
            for x in range(w):
                if terrain[y*w+x] == BRIDGE and (x < 18 or x >= w-18):
                    terrain[y*w+x] = ROAD
        for px, py in pools:
            for y in range(py, min(py+2,h)):
                for x in range(px, min(px+2,w)):
                    if terrain[y*w+x] == BRIDGE:
                        terrain[y*w+x] = ROAD
    for px, py in pools:
        if 0 <= px < w-1 and 0 <= py < h-1:
            footprint = [(py+dy)*w+px+dx for dy in (0,1) for dx in (0,1)]
            if all(terrain[at] in DRIVABLE and terrain[at] != BRIDGE for at in footprint):
                for at in footprint:
                    if terrain[at] not in (SAND, GRASS, ROAD, SNOW):
                        terrain[at] = ROAD
    labels, sizes = component_labels(terrain, w, h)
    largest = max(range(len(sizes)), key=sizes.__getitem__)
    teams = sorted(hqs)[:8]
    targets = []
    for team in teams:
        points = sorted(hqs[team])
        # Several original maps have more than one HQ marker per team. One
        # native seat is one team; use the medoid instead of duplicating it.
        targets.append(min(points, key=lambda p: sum((p[0]-q[0])**2 + (p[1]-q[1])**2 for q in points)))
    adapted = len(targets) < 2
    if adapted:
        targets = [(w // 4, h // 2), (3 * w // 4, h // 2)]
    spawns, repairs = [], []
    for tx, ty in targets:
        candidates = []
        for y in range(max(4, ty - 24), min(h - 4, ty + 25)):
            for x in range(max(4, tx - 24), min(w - 4, tx + 25)):
                if terrain[y*w+x] not in DRIVABLE or (adapted and labels[y*w+x] != largest):
                    continue
                if any((x-s['x'])**2+(y-s['y'])**2 < 100 for s in spawns):
                    continue
                cells = [terrain[yy*w+xx] for yy in range(y-4, y+5) for xx in range(x-4, x+5)]
                if any(t in (WATER, LAVA, BRIDGE) for t in cells):
                    continue
                blocked = sum(t not in DRIVABLE for t in cells)
                candidates.append((blocked * 8 + (x-tx)**2 + (y-ty)**2, y, x))
        if not candidates:
            raise ValueError(f'{slug}: no dry starting area near {(tx, ty)}')
        _, y, x = min(candidates)
        changed = 0
        for yy in range(y-4, y+5):
            for xx in range(x-4, x+5):
                at = yy*w+xx
                if terrain[at] not in (GRASS, ROAD, SAND, SNOW):
                    changed += 1
                    terrain[at] = ROAD
        spawns.append({'x': x, 'y': y})
        repairs.append({'source': [tx, ty], 'spawn': [x, y], 'clearedTiles': changed})
    # Deposits are native metal sources. Keep authored positions where a 2x2
    # extractor fits; move at most 24 tiles to avoid impassable roofs/trees.
    deposits, relocated = [], 0
    def deposit_ok(x, y):
        return (0 <= x < w-1 and 0 <= y < h-1
                and (all(terrain[yy*w+xx] in (SAND, GRASS, ROAD, SNOW) for yy in (y, y+1) for xx in (x, x+1))
                     or all(terrain[yy*w+xx] == WATER for yy in (y, y+1) for xx in (x, x+1)))
                and all(max(abs(x-s['x']), abs(y-s['y'])) > 6 for s in spawns)
                and all(max(abs(x-d['x']), abs(y-d['y'])) >= 2 for d in deposits))
    offsets = sorted((abs(dx)+abs(dy), dy, dx) for dy in range(-24,25) for dx in range(-24,25))
    for px, py in sorted(pools, key=lambda p: (p[1], p[0])):
        source_sea = terrain[py*w+px] == WATER
        candidate = next(((py+dy, px+dx) for _, dy, dx in offsets
                          if deposit_ok(px+dx, py+dy) and (terrain[(py+dy)*w+px+dx] == WATER) == source_sea), None)
        if candidate:
            y, x = candidate
            relocated += (x, y) != (px, py)
            deposits.append({'x': x, 'y': y})
    # Survival layouts have no resource markers. Give each adapted starting
    # district two nearby sources so they can be played as ordinary skirmishes.
    added = 0
    if adapted:
        for spawn in spawns:
            for _ in range(2):
                candidates = [((x-spawn['x'])**2+(y-spawn['y'])**2, y, x) for y in range(max(1,spawn['y']-18),min(h-2,spawn['y']+19)) for x in range(max(1,spawn['x']-18),min(w-2,spawn['x']+19)) if deposit_ok(x,y) and labels[y*w+x] == largest]
                if not candidates:
                    raise ValueError(f'{slug}: no space for starting resources')
                _, y, x = min(candidates)
                deposits.append({'x':x, 'y':y})
                added += 1
    assert len(deposits) <= 400
    description = f'Adolence original map, adapted for {len(spawns)}-player skirmish.'
    zh_description = f'Adolence 原版地图，移植为 {len(spawns)} 人遭遇战。'
    if adapted:
        description += ' Terrain port only: RW survival waves and placed crowds are not included.'
        zh_description += '仅移植地形；不含铁锈战争的生存波次与预置人群。'
    if scale > 1:
        description += f' Entire {source.w}×{source.h} layout reduced {scale}:1.'
        zh_description += f'完整 {source.w}×{source.h} 布局按 {scale}:1 缩小。'
    data = {'format':'steel-tide-map', 'v':1, 'name':english, 'description':description,
            'translations':{'zh':{'name':chinese, 'description':zh_description}},
            'w':w, 'h':h, 'terrain':rle([WATER if t == BRIDGE else t for t in terrain]),
            'deposits':deposits, 'spawns':spawns}
    if BRIDGE in terrain:
        data['overlays'] = rle([BRIDGE if t == BRIDGE else 0 for t in terrain])
    if companion:
        data['terrainVariants'] = {'city':'adolence-maps-urban'}
    output.parent.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n'
    assert len(raw.encode()) <= 512 * 1024
    output.write_text(raw)
    labels, sizes = component_labels(terrain, w, h)
    return data, terrain, {'source':source.path.name, 'sourceSha256':hashlib.sha256(source.path.read_bytes()).hexdigest(), 'map':output.name, 'pack':output.parent.parent.name,
        'sourceSize':[source.w,source.h], 'size':[w,h], 'sourceTeams':sorted(hqs), 'retainedTeams':teams, 'omittedTeams':sorted(hqs)[8:],
        'players':len(spawns), 'spawnAdjustments':repairs, 'spawnGroundComponents':[labels[s['y']*w+s['x']] for s in spawns],
        'sourceDeposits':len(pools), 'deposits':len(deposits), 'relocatedDeposits':relocated,
        'omittedDeposits':len(pools)-(len(deposits)-added), 'addedDeposits':added,
        'invalidSourceTileIds':sorted(source.invalid_tiles), 'sourceTileUnits':dict(unit_counts), 'sourceObjectUnits':dict(object_units), 'survivalAdaptation':adapted}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT / 'rusted-warfare-mods/adolence/maps')
    parser.add_argument('--tilesets', type=Path, default=STOCK)
    parser.add_argument('--output-root', type=Path, default=HERE.parent)
    parser.add_argument('--preview', type=Path, help='optional directory for terrain overview PNGs')
    args = parser.parse_args()
    expected = {row[0] for row in SOURCES}
    found = {p.name for p in args.source.glob('*.tmx')}
    if expected != found:
        raise ValueError(f'TMX inventory changed: missing={expected-found}, unlisted={found-expected}')
    reports, packs = [], defaultdict(list)
    for index, (filename, slug, en, zh) in enumerate(SOURCES):
        companion = index >= 7
        pack = 'adolence-maps' if companion else 'adolence'
        relative = f'maps/{slug}.steel-tide-map'
        data, terrain, report = convert(SourceMap(args.source / filename, args.tilesets), slug, en, zh, args.output_root / pack / relative, companion)
        reports.append(report)
        packs[pack].append(relative)
        if args.preview:
            args.preview.mkdir(parents=True, exist_ok=True)
            image = Image.new('RGB', (data['w'],data['h']))
            palette = [tuple(bytes.fromhex(c[1:])) for c in COLORS]
            image.putdata([palette[t] for t in terrain])
            from PIL import ImageDraw
            draw = ImageDraw.Draw(image)
            for p in data['deposits']:
                draw.rectangle((p['x'],p['y'],p['x']+1,p['y']+1),fill='#e5b43a')
            for n,p in enumerate(data['spawns']):
                x,y=p['x'],p['y'];draw.ellipse((x-3,y-3,x+3,y+3),fill='#ed625c');draw.text((x+3,y-5),str(n+1),fill='white')
            image.resize((data['w']*2,data['h']*2),Image.Resampling.NEAREST).save(args.preview / f'{slug}.png')
        print(f'{pack}/{relative}: {data["w"]}x{data["h"]}, {len(data["spawns"])} players, {len(data["deposits"])} deposits')
    for pack, maps in packs.items():
        manifest = args.output_root / pack / 'mod.json'
        if manifest.exists():
            data = json.loads(manifest.read_text())
            data['maps'] = (['maps/city-of-sin.steel-tide-map'] if pack == 'adolence' else []) + maps
            manifest.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    (args.output_root / 'adolence/map-port-report.json').write_text(json.dumps(reports, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    main()

"""Put native shots on the source weapon's bore or aircraft hardpoint.

The media exporter keeps RW coordinates in its cropped art and scales them by
ART_SCALE. Native muzzlePoints are world coordinates from the firing ring, so
they additionally include the game's unit display scale. No image-based guess
or collision-radius stand-in is used for an unresolved source mount.
"""
import math
import re
from functools import lru_cache
from PIL import Image

from media import ART_SCALE, UNIT_DISPLAY_SCALE, source_path
from articulation_port import _id as mount_id, _media_reports
from weapons import INITIAL_AA_ACTIONS
from rw import HERE

BARREL_SUPERSAMPLE = 4


class SourceMismatch(ValueError):
    pass


def literal(data, name, default=None):
    value = data.get(name, default)
    if value is None:
        raise SourceMismatch(f'missing {name}')
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise SourceMismatch(f'nonliteral {name}: {value!r}') from None
    if not math.isfinite(number):
        raise SourceMismatch(f'nonfinite {name}')
    return number


def turret_position(ini, name, stop=None, seen=()):
    if name == stop:
        return (0, 0)
    if name in seen or 'turret_' + name not in ini:
        raise SourceMismatch(f'unresolved/cyclic turret {name}')
    fields = ini['turret_' + name]
    x, y = literal(fields, 'x'), literal(fields, 'y')
    parent = fields.get('attachedTo')
    if parent:
        px, py = turret_position(ini, parent, stop, (*seen, name))
        return x + px, y + py
    if stop:
        raise SourceMismatch(f'{name} is not beneath firing ring {stop}')
    return x, y


def attached_hardpoints(entry, ini, missile):
    """Follow only the converter's already audited initial attachment setup."""
    occupied = {}
    for section, data in ini.items():
        if not section.startswith('attachment_'):
            continue
        initial = data.get('onCreateSpawnUnitOf', '')
        if initial and re.fullmatch(r'[\w-]+', initial):
            occupied[section[11:]] = initial
    for action in INITIAL_AA_ACTIONS.get(entry['rwName'], ()):
        fields = ini.get(action, {})
        slots = [name.strip() for name in fields.get('attachments_onlyOnSlots', '').split(',') if name.strip()]
        spawns = []
        for value in fields.get('attachments_addNewUnits', '').split(','):
            match = re.fullmatch(r'([\w-]+)(?:\*(\d+))?', value.strip())
            if not match:
                raise SourceMismatch(f'{action}: unresolved initial attachment list')
            spawns.extend([match[1]] * int(match[2] or 1))
        if not slots or len(spawns) != len(slots):
            raise SourceMismatch(f'{action}: attachment slots do not match initial missile count')
        for slot, name in zip(slots, spawns):
            occupied[slot] = name
    result = []
    for slot, name in occupied.items():
        if name != missile:
            continue
        fields = ini.get('attachment_' + slot, {})
        result.append({'slot': slot, 'x': literal(fields, 'x'), 'y': literal(fields, 'y')})
    if not result or len(result) > 8:
        raise SourceMismatch(f'{missile}: no bounded unambiguous source hardpoints')
    return result


def exposed_barrel(entry, ini, name, ring):
    """The exported barrel rectangle must belong to this gun, not a roof MG.

    Alternate ammunition can share the exact visible bore art and anchor.
    This does not allow a different gun to animate a composite sheet's cannon.
    """
    layers = _media_reports().get(entry['id'], {}).get('layers', [])
    visible = next((layer for layer in layers if layer.get('target') == 'turret'
                    and ('炮管' in layer['section'] or 'barrel' in layer['section'].lower())
                    and (not ring or layer.get('mount', ring) == ring)), None)
    if not visible:
        return None
    shown = ini.get(visible['section'], {})
    anchor = shown.get('basePositionFromTurret')
    if not anchor or turret_position(ini, anchor) != turret_position(ini, name):
        return None
    source_entry = {**entry, 'ini': ini}
    for section, fields in ini.items():
        if not section.startswith('decal_') or fields.get('basePositionFromTurret') != name:
            continue
        path = source_path(source_entry, section, 'image')
        if not path or not path.as_posix().endswith('/' + visible['source']):
            continue
        if all(fields.get(key, default) == shown.get(key, default) for key, default in
               [('imageScale', '1'), ('imageScaleX', ''), ('imageScaleY', ''),
                ('dirOffset', '0'), ('xOffsetRelative', '0'), ('yOffsetRelative', '0'),
                ('xOffsetAbsolute', '0'), ('yOffsetAbsolute', '0')]):
            return {'section': section, 'visibleSection': visible['section'], 'source': visible['source']}
    return None


@lru_cache(None)
def _barrel_front(file, fw, fh, rect):
    """Read the first opaque row after native area-average atlas quantization."""
    im = Image.open(HERE / file).convert('RGBA')
    alpha = im.getchannel('A')
    sw, sh = im.size
    ss = BARREL_SUPERSAMPLE
    dw, dh = fw * ss, fh * ss
    xr, yr = sw / dw, sh / dh
    left, top, right, bottom = rect
    for dy in range(max(0, math.floor(top * dh)), min(dh, math.ceil(bottom * dh))):
        sy0, sy1 = dy * yr, (dy + 1) * yr
        occupied = []
        for dx in range(max(0, math.floor(left * dw)), min(dw, math.ceil(right * dw))):
            sx0, sx1 = dx * xr, (dx + 1) * xr
            total = 0
            for y in range(math.floor(sy0), min(sh, math.ceil(sy1))):
                wy = min(sy1, y + 1) - max(sy0, y)
                for x in range(math.floor(sx0), min(sw, math.ceil(sx1))):
                    wx = min(sx1, x + 1) - max(sx0, x)
                    total += alpha.getpixel((x, y)) * wx * wy
            if math.floor(total / (xr * yr) + .5):
                occupied.append(dx)
        if occupied:
            return ((occupied[0] + occupied[-1] + 1) / 2, dy), [sw, sh]
    raise SourceMismatch('verified barrel rectangle has no visible pixels')


def visible_muzzle(sheet, display_scale):
    if sheet.get('frames') != 1 or len(sheet.get('barrels', [])) != 1:
        raise SourceMismatch('visible muzzle needs one static verified barrel')
    fw, fh = sheet['fw'], sheet['fh']
    # Pin the current native bake resolution so the pixel witness remains
    # deterministic if future host heuristics choose a different atlas size.
    sheet['ss'] = BARREL_SUPERSAMPLE
    (x, y), source_size = _barrel_front(sheet['file'], fw, fh, tuple(sheet['barrels'][0]))
    ss = BARREL_SUPERSAMPLE
    point = {'forward': ((sheet.get('pivotY', .5) * fh) - y / ss) * display_scale,
             'lateral': (x / ss - fw / 2) * display_scale}
    evidence = {'sprite': sheet['key'], 'file': sheet['file'], 'sourceSize': source_size,
                'displaySize': [fw, fh], 'pivot': [sheet.get('pivotX', .5), sheet.get('pivotY', .5)],
                'barrelRegion': sheet['barrels'][0], 'supersample': ss,
                'bakedPixelTip': [x, y], 'rule': 'first opaque barrel row, centered on its visible span; unrecoiled'}
    return point, evidence


def augment_muzzles(entry, ini, definition, scale=ART_SCALE, sprites=()):
    records, notes = [], []
    world_scale = scale * (UNIT_DISPLAY_SCALE if definition.get('kind') == 'unit' else 1)
    mounts = definition.get('extensions', {}).get('articulation-v1', {}).get('mounts', [])
    sheets = {sprite['key']: sprite for sprite in sprites}
    native = definition.get('turretMounts', [])
    if len(native) > 1:
        return [], ['Source muzzle geometry omitted: native multi-ring layout needs explicit weapon ownership.']
    # Native fireShot uses the single ring as origin even for a hull weapon.
    pivot = (native[0]['x'] / scale, -native[0]['y'] / scale) if native else (0, 0)
    mixed_air = (any(w.get('targets') == ['air'] for w in definition['weapons']) and
                 any(w.get('targets') != ['air'] for w in definition['weapons']))
    for weapon in definition['weapons']:
        source = weapon.get('_source', {})
        try:
            mount = next((mount for mount in mounts if weapon['id'] in mount['weapons']), None)
            own_air = mixed_air and weapon.get('targets') == ['air'] and not mount
            source_pivot = (0, 0) if own_air else pivot
            aircraft = entry.get('movement') == 'AIR' and not mount
            fields = ini.get(source.get('turret', ''), {})
            fixed = (str(ini.get('attack', {}).get('isFixedFiring', '')).lower() == 'true' or
                     str(fields.get('turnSpeed', '')) in ('0', '0.0'))
            hull_frame = aircraft and (fixed or bool(source.get('attachedMissile')))
            independent_bore = aircraft and not hull_frame
            if source.get('attachedMissile'):
                slots = attached_hardpoints(entry, ini, source['attachedMissile'])
                points = [{'forward': (slot['y'] - source_pivot[1]) * world_scale,
                           'lateral': (slot['x'] - source_pivot[0]) * world_scale} for slot in slots]
                evidence = {'hardpoints': slots, 'origin': 'hull' if own_air else 'native ring', 'sourcePivot': list(source_pivot)}
            else:
                section = source.get('turret', '')
                if not section.startswith('turret_'):
                    raise SourceMismatch('no source firing turret')
                name, fields = section[7:], ini.get(section, {})
                ring = None
                if mount:
                    candidate, seen = name, set()
                    while candidate and candidate not in seen:
                        if mount_id(candidate) == mount['id']:
                            ring = candidate
                            break
                        seen.add(candidate)
                        candidate = ini.get('turret_' + candidate, {}).get('attachedTo')
                    if ring is None:
                        raise SourceMismatch('authored mount has no source ancestor')
                x, y = turret_position(ini, name, ring)
                if not ring:
                    x, y = x - source_pivot[0], y - source_pivot[1]
                # RW barrelY is the explicit alias/override for turret size;
                # absent turret size inherits attack.turretSize (default 1)
                # multiplied by core.globalScale (default 1). Pinned RW 1.15
                # class_436 ea / class_397 X; explicit barrelY/size replaces it.
                inherited_size = literal(ini.get('attack', {}), 'turretSize', 1) * literal(ini.get('core', {}), 'globalScale', 1)
                barrel_y = literal(fields, 'barrelY', fields.get('size', inherited_size))
                barrel_x = literal(fields, 'barrelX', 0)
                alternate = literal(fields, 'barrelOffsetX_onOddShots', 0)
                points = [{'forward': (y + barrel_y) * world_scale,
                           'lateral': (x + barrel_x) * world_scale}]
                if alternate:
                    points.append({'forward': points[0]['forward'],
                                   'lateral': points[0]['lateral'] + alternate * world_scale})
                if independent_bore:
                    # Keep the source mount on the airframe while its bore aims.
                    weapon['turret'] = True
                    weapon.setdefault('extensions', {}).setdefault('articulation-v1', {}).update(
                        muzzleFrame='bore', muzzleAnchor={'forward': y * world_scale, 'lateral': x * world_scale})
                    points = [{'forward': barrel_y * world_scale, 'lateral': (barrel_x + (alternate if i else 0)) * world_scale}
                              for i in range(2 if alternate else 1)]
                evidence = {'section': section, 'origin': 'articulated ring ' + ring if ring else 'hull' if own_air else 'native ring',
                            'sourcePivot': [0, 0] if ring else list(source_pivot),
                            'relativeTurret': [x, y], 'barrelX': barrel_x, 'barrelY': barrel_y,
                            'barrelOffsetX_onOddShots': alternate}
                recoil = -literal(fields, 'recoilOffset', 0) * scale
                sheet = sheets.get(mount.get('sprite') if mount else definition.get('turretSprite'), {})
                barrel = exposed_barrel(entry, ini, name, ring) if sheet.get('barrels') else None
                if barrel:
                    visual_point, visual_evidence = visible_muzzle(sheet, world_scale / scale)
                    evidence['sourceMuzzlePoints'] = points
                    evidence['visualTip'] = {**visual_evidence, **barrel}
                    points = [visual_point]
                if 0 < recoil <= 10 and sheet.get('barrels') and barrel:
                    weapon['recoil'] = round(recoil, 6)
                    evidence['recoil'] = {'sourceOffset': fields['recoilOffset'], 'artPixels': weapon['recoil'],
                                          'sprite': sheet['key'], 'barrels': sheet['barrels'], **barrel}
                elif recoil:
                    notes.append(f'{weapon["id"]}: source recoil omitted: no verified exposed-barrel region or stroke exceeds native bound; no whole-turret substitute.')
            if any(abs(point[key]) > 200 for point in points for key in ('forward', 'lateral')):
                raise SourceMismatch('muzzle exceeds native coordinate bounds')
            if hull_frame:
                weapon['turret'] = False
                weapon.setdefault('extensions', {}).setdefault('articulation-v1', {})['muzzleFrame'] = 'hull'
            weapon['muzzlePoints'] = [{key: round(value, 6) for key, value in point.items()} for point in points]
            # Do not retain competing defaults or guessed barrel spacing.
            for key in ('muzzleOffset', 'bores', 'boreSpacing'):
                weapon.pop(key, None)
            records.append({'weapon': weapon['id'], 'source': entry['source'], **evidence,
                            **({'muzzleFrame': 'hull'} if hull_frame else {'muzzleFrame': 'bore', 'muzzleAnchor': weapon['extensions']['articulation-v1']['muzzleAnchor']} if independent_bore else {}),
                            'artScale': scale, 'worldScale': world_scale,
                            'muzzlePoints': weapon['muzzlePoints']})
        except SourceMismatch as error:
            notes.append(f'{weapon["id"]}: source muzzle omitted: {error}; no fabricated geometry.')
    return records, notes

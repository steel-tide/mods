"""Assemble original UCGR pixels into Steel Tide sheets, without repainting.

Run through port.py. `build_media(entries, out)` accepts merged rw.Ini entries.
All output is deterministic; source coordinates, layer order and asset paths
are retained in media-report.json so approximation is reviewable.
"""
from pathlib import Path
from functools import lru_cache
from copy import deepcopy
import hashlib
import json
import math
import re
import subprocess
from PIL import Image, ImageDraw, ImageFont
from rw import RW, resolve, num, load_unit

ART_SCALE = 0.4
# Direct world-space assets include the same native display scale as unit art.
UNIT_DISPLAY_SCALE = 1.5625


def field(fields, key, default=''):
    """RW keys in this pack occasionally differ only by case."""
    return fields.get(key, next((v for k, v in fields.items() if k.lower() == key.lower()), default))


def source_path(entry, section, key, value=None):
    ini = entry['ini']
    value = value if value is not None else field(ini.get(section, {}), key)
    origin = getattr(ini, 'origins', {}).get(section, {}).get(key)
    source = RW / entry['source']
    # Inherited relative art is resolved from the declaring config. Some source
    # templates intentionally take the importing unit's directory instead.
    for directory in dict.fromkeys([Path(origin).parent if origin else source.parent, source.parent]):
        path = resolve(value, directory)
        if path:
            return path
    return None


@lru_cache(None)
def image_file(path):
    return Image.open(path).convert('RGBA')


def default_visible(expression, tags='', unknown=False):
    """Evaluate the pack's static appearance at spawn; never execute RW code."""
    expression = str(expression).strip().removeprefix('if ').strip()
    if not expression:
        return True
    expression = re.sub(r'self\.hasFlag\(id\s*=\s*\d+\)', 'False', expression, flags=re.I)
    expression = re.sub(r'self\.tags\(includes\s*=\s*[\"\']([^\"\']+)[\"\']\)',
                        lambda m: str(m[1] in tags.split(',')), expression, flags=re.I)
    expression = re.sub(r'self\.hp\s*==\s*0', 'False', expression, flags=re.I)
    expression = re.sub(r'\btrue\b', 'True', expression, flags=re.I)
    expression = re.sub(r'\bfalse\b', 'False', expression, flags=re.I)
    if re.fullmatch(r'[\s()TrueFalsandort]+', expression):
        try:
            return bool(eval(expression, {'__builtins__': {}}, {}))
        except (SyntaxError, NameError):
            pass
    # Numeric health/resource displays and selection indicators are interface,
    # not physical parts of the unit. Their expressions cannot be baked.
    if any(x in expression for x in ('memory.', 'self.resource.', 'self.globalTeamTags', 'self.isSelected', 'self.isControlled')):
        return False
    return unknown


def dynamic_art_fields(data):
    keys = ('frame', 'imageScale', 'imageScaleX', 'imageScaleY', 'alpha', 'dirOffset',
            'xOffsetRelative', 'yOffsetRelative', 'xOffsetAbsolute', 'yOffsetAbsolute')
    return [k for k in keys if field(data, k) and not re.fullmatch(r'[+-]?(?:\d+(?:\.\d*)?|\.\d+)', field(data, k))]


def physical_decal(name, data, tags):
    if field(data, 'layer', 'onTop').lower() not in ('afterbody', 'beforebody'):
        return False
    if field(data, 'onlyWhileAlive').lower() == 'false' or field(data, 'onlyInPreview').lower() == 'true':
        return False
    if any(field(data, k).lower() == 'true' for k in ('onlyWhenSelectedByAnyPlayer', 'onlyWhenSelectedByOwnPlayer')):
        return False
    if str(field(data, 'image')).upper().startswith('SHADOW:'):
        return False
    if dynamic_art_fields(data):
        return False
    return default_visible(field(data, 'isVisible'), tags)


def split_frames(im, count=1):
    count = min(64, max(1, int(count)))
    width = max(1, im.width // count)
    return [im.crop((i * width, 0, (i + 1) * width, im.height)) for i in range(count)]


def initial_equipment_tags(ini):
    """Recognize source-created equipment selection without simulating actions.

    UCGR infantry start as a blank carrier, then a created action raises an
    equipment flag. Its corresponding exact flag trigger selects the visual.
    Only that declarative chain is followed, never arbitrary source logic.
    """
    flags = set()
    for data in ini.values():
        if field(data, 'autoTriggerOnEvent').lower() == 'created':
            flags.update(re.findall(r'(?<!un)setFlag\s*=\s*(\d+)', field(data, 'addResources')))
    tags, seen = set(), set()

    def follow(data):
        tags.difference_update(x.strip() for x in field(data, 'temporarilyRemoveTags').split(','))
        tags.update(x.strip() for x in field(data, 'temporarilyAddTags').split(',') if x.strip())
        for action in field(data, 'alsoTriggerAction').split(','):
            action = action.strip()
            if not action or action in seen:
                continue
            seen.add(action)
            child = ini.get('hiddenAction_' + action, ini.get('action_' + action, {}))
            follow(child)
    for data in ini.values():
        match = re.fullmatch(r'if\s+self\.hasFlag\(id\s*=\s*(\d+)\)', field(data, 'autoTrigger'))
        if match and match[1] in flags:
            follow(data)
    return sorted(tags)


def asset_frames(entry, section, key='image', scale=1, count=1, angle=0, sx=None, sy=None):
    path = source_path(entry, section, key)
    if not path or path.suffix.lower() not in ('.png', '.jpg', '.jpeg', '.webp') or scale <= 0:
        return [], path
    frames = split_frames(image_file(path), count)
    out = []
    for im in frames:
        if not im.getbbox():
            continue
        size = (max(1, round(im.width * (sx if sx is not None else scale))),
                max(1, round(im.height * (sy if sy is not None else scale))))
        if size != im.size:
            im = im.resize(size, Image.Resampling.NEAREST)
        if angle:
            im = im.rotate(-angle, Image.Resampling.NEAREST, expand=True)
        out.append(im)
    return out, path


def assemble(parts, centered_x=False):
    """Return cropped strip frames and its pivot, preserving transparent margins."""
    if not parts:
        return [], (0, 0), []
    # Source coordinates are x right, y screen-down; place origins at centers.
    extents = []
    for part in parts:
        for frame in part['frames']:
            bbox = frame.getbbox()
            if bbox:
                left = round(part['x'] - frame.width / 2)
                top = round(part['y'] - frame.height / 2)
                extents.append((left + bbox[0], top + bbox[1], left + bbox[2], top + bbox[3]))
    if not extents:
        return [], (0, 0), []
    # Include the origin, since an off-centre turret pivot must remain inside.
    left = min(0, *(b[0] for b in extents)) - 2
    top = min(0, *(b[1] for b in extents)) - 2
    right = max(0, *(b[2] for b in extents)) + 2
    bottom = max(0, *(b[3] for b in extents)) + 2
    width, height = right - left, bottom - top
    count = min(64, max(len(p['frames']) for p in parts))
    frames = []
    for i in range(count):
        canvas = Image.new('RGBA', (width, height))
        for part in sorted(parts, key=lambda p: p['order']):
            im = part['frames'][i % len(part['frames'])]
            alpha = part.get('alpha', 1)
            if alpha < 1:
                im = im.copy()
                im.putalpha(im.getchannel('A').point(lambda a: round(a * alpha)))
            canvas.alpha_composite(im, (round(part['x'] - im.width / 2 - left), round(part['y'] - im.height / 2 - top)))
        frames.append(canvas)
    original_left = left
    if centered_x:
        # Live rotation needs a centred horizontal pivot; asymmetric crops
        # select the game's 24-heading bake. Pad the completed composite so
        # half-pixel layer placement keeps its original rounding as well.
        half_width = max(-left, right)
        padded = []
        for frame in frames:
            canvas = Image.new('RGBA', (2 * half_width, height))
            canvas.alpha_composite(frame, (left + half_width, 0))
            padded.append(canvas)
        frames = padded
        left, right = -half_width, half_width
        width = right - left
    # Exposed-barrel metadata must use the same integer placement as the PNG,
    # including its original pre-padding rounding. A half-pixel formula can
    # otherwise leave a stationary fringe outside the native recoil mask.
    for part in parts:
        im = part['frames'][0]
        part['_imageOffset'] = (round(part['x'] - im.width / 2 - original_left) + original_left - left,
                                round(part['y'] - im.height / 2 - top))
    return frames, (-left / width, -top / height), [left, top, right, bottom]


def write_sheet(out, key, frames, scale, rotated=True, pivot=(.5, .5), **extra):
    if not frames:
        return None
    if rotated:
        assert pivot[0] == .5, f'{key}: pad the frame around its horizontal rotation pivot'
    width, height = frames[0].size
    # The host image loader rejects images narrower than 4 px (a guard against
    # dev-server HTML fallbacks). Pad tiny frames, such as the source's
    # transparent squad proxy, with transparent pixels about the same pivot.
    if width < 4 or height < 4:
        # Symmetric padding keeps a centred pivot centred; pixel scale is unchanged.
        nw = width if width >= 4 else width + 2 * -(-(4 - width) // 2)
        nh = height if height >= 4 else height + 2 * -(-(4 - height) // 2)
        px, py = (nw - width) // 2, (nh - height) // 2
        padded = []
        for im in frames:
            canvas = Image.new('RGBA', (nw, nh))
            canvas.alpha_composite(im.convert('RGBA'), (px, py))
            padded.append(canvas)
        pivot = ((pivot[0] * width + px) / nw, (pivot[1] * height + py) / nh)
        frames, width, height = padded, nw, nh
    strip = Image.new('RGBA', (width * len(frames), height))
    for i, im in enumerate(frames):
        strip.alpha_composite(im, (i * width, 0))
    rel = f'sprites/{key}.png'
    (out / 'sprites').mkdir(exist_ok=True)
    strip.save(out / rel, optimize=True)
    sheet = {'key': key, 'file': rel, 'frames': len(frames),
             'fw': min(512, max(4, round(width * scale))), 'fh': min(512, max(4, round(height * scale))),
             'teams': False, 'stripBg': False, 'stabilize': False, 'artifactCleanup': False}
    if rotated:
        sheet.update(rotated=True, pivotX=round(pivot[0], 6), pivotY=round(pivot[1], 6))
    sheet.update(extra)
    return sheet


def build_unit(entry, out):
    ini = entry['ini']
    graphics = ini.get('graphics', {})
    core = ini.get('core', {})
    tags = field(core, 'tags').replace(' ', '')
    initial_tags = initial_equipment_tags(ini)
    tags += ',' + ','.join(initial_tags)
    if entry.get('artTags'):
        tags += ',' + ','.join(entry['artTags'])
    scale = entry.get('artScale', ART_SCALE)
    turrets = {k[7:]: v for k, v in ini.items() if k.startswith('turret_')}
    notes = []
    parts, turret_parts, rotors, sources = [], [], [], []
    def root_of(anchor):
        seen = set()
        while anchor in turrets and field(turrets[anchor], 'slave').lower() == 'true':
            if anchor in seen: return None
            seen.add(anchor); anchor = field(turrets[anchor], 'attachedTo')
        return anchor if anchor in turrets else None
    from weapons import convert_weapons
    converted, _ = convert_weapons(entry, ini) if entry.get('rwName') else ([], [])
    if entry.get('rwName'):
        from barrage_port import append_barrage_weapons
        append_barrage_weapons(entry, ini, {'weapons': converted})
    roots = list(dict.fromkeys(root_of(w.get('_source', {}).get('turret', '')[7:]) for w in converted))
    roots = [name for name in roots if name is not None]
    for name in list(roots):
        parent = field(turrets[name], 'attachedTo'); seen = {name}
        while parent in turrets and parent not in seen:
            seen.add(parent)
            if parent not in roots: roots.append(parent)
            parent = field(turrets[parent], 'attachedTo')

    def pos(name, seen=()):
        if name in seen or name not in turrets:
            return (0, 0)
        data = turrets[name]
        x, y = num(field(data, 'x')), -num(field(data, 'y'))
        parent = field(data, 'attachedTo')
        if parent:
            px, py = pos(parent, (*seen, name))
            x, y = x + px, y + py
        return x, y

    squad_controller = '班组' in tags.split(',') and int(num(field(core, 'maxTransportingUnits'))) in (3, 5)
    ground_layers = [(k, v) for k, v in ini.items() if (squad_controller or entry.get('_groundOnly')) and k.startswith('decal_')
                     and field(v, 'layer').lower() == 'shadow' and field(v, 'onlyTeam', 'any') == 'any'
                     and field(v, 'alwaysStartDirAtZero') == 'true' and not dynamic_art_fields(v)
                     and default_visible(field(v, 'isVisible'), tags) and field(v, 'image')
                     and not field(v, 'image').upper().startswith('SHADOW:')]
    physical = ([] if entry.get('_groundOnly') else [(k, v) for k, v in ini.items() if k.startswith('decal_') and physical_decal(k, v, tags)]) + ground_layers
    conditions = [{'section': k, 'condition': field(v, 'isVisible'),
                   'selectedForPreview': any(k == n for n, _ in physical)}
                  for k, v in ini.items() if k.startswith('decal_')
                  and field(v, 'layer').lower() in ('beforebody', 'afterbody')
                  and field(v, 'onlyWhileAlive').lower() != 'false' and field(v, 'isVisible')]
    anchored = [root_of(field(v, 'basePositionFromTurret')) for _, v in physical if field(v, 'basePositionFromTurret')]
    # Prefer the articulated tank ring; otherwise retain the principal visible
    # firing turret. A helicopter rotor is animated independently of aiming.
    main = entry.get('_visualMain') or ('MAIN' if 'MAIN' in turrets and any(x for x in anchored) else None)
    if main is None:
        # A non-firing parent still carries an independently aimed child gun.
        main = next((name for name in roots if not field(turrets[name], 'attachedTo') and (source_path(entry, 'turret_' + name, 'image', field(turrets[name], 'image', field(graphics, 'image_turret'))) is not None or name in anchored)), None)
    if main is None:
        for name, data in turrets.items():
            if num(field(data, 'idleSpin')) or field(data, 'invisible').lower() == 'true':
                continue
            ref = field(data, 'image', field(graphics, 'image_turret'))
            path = source_path(entry, 'turret_' + name, 'image', ref)
            if path and image_file(path).getbbox() and field(data, 'canShoot', 'true').lower() != 'false':
                main = name
                break
    if main is None and anchored:
        main = anchored[0]
    mx, my = pos(main) if main else (0, 0)
    # Opt-in export of source turret assemblies. A slave belongs to its
    # parent's ring; an independent child gets its own original-pixel sheet.
    # A visible independently turning child is its own source assembly. Resolve
    # slave barrels back to their parent ring, then split every real assembly
    # from its authored pixels; this is structural and applies to new tanks too.
    # An explicit empty list is retained for source-comparison tests.
    split_names = entry.get('splitTurrets')
    if split_names is None:
        literal = lambda v: bool(re.fullmatch(r'[+-]?(?:\d+(?:\.\d*)?|\.\d+)', v))
        split_names = roots if 1 < len(roots) <= 8 and main in roots and all(
            literal(field(turrets[name], axis)) for name in roots for axis in ('x', 'y')) else []
        if split_names:
            from articulation_port import augment_articulation
            preflight = {'id': entry['id'], 'weapons': converted, 'turretSprite': 'source-pivot'}
            candidate = {**entry, '_articulation_art': {'scale': scale, 'sprites': {name: 'source-' + str(index) for index, name in enumerate(roots)}}}
            reasons = augment_articulation(candidate, ini, preflight)
            if not preflight.get('extensions', {}).get('articulation-v1', {}).get('mounts'):
                split_names = []
                notes.extend(reasons)
    groups = {name: [] for name in split_names} if main in split_names else {}

    def group_for(anchor):
        seen = set()
        while anchor and anchor not in seen:
            if anchor in groups:
                return anchor
            seen.add(anchor)
            data = turrets.get(anchor, {})
            if field(data, 'slave').lower() != 'true':
                break
            anchor = field(data, 'attachedTo')
        return main

    def destination(anchor):
        group = group_for(anchor)
        if groups and group in groups:
            return groups[group], pos(group), group
        return turret_parts, (mx, my), main

    def add(dest, frames, x=0, y=0, order=0, source=None, section='', alpha=1):
        if not frames:
            return
        dest.append({'frames': frames, 'x': x, 'y': y, 'order': order, 'alpha': alpha})
        if source:
            sources.append({'section': section, 'source': source.relative_to(RW).as_posix(),
                            'x': round(x, 3), 'y': round(y, 3), 'order': order,
                            'target': 'turret' if dest is turret_parts or any(dest is g for g in groups.values()) else 'hull',
                            **({'mount': name} if groups and (name := next((n for n, g in groups.items() if dest is g), None)) else {})})

    frames, path = asset_frames(entry, 'graphics', scale=num(field(graphics, 'imageScale'), 1),
                                count=num(field(graphics, 'total_frames'), 1))
    add(parts, frames, num(field(graphics, 'image_offsetX')), num(field(graphics, 'image_offsetY')),
        source=path, section='graphics')
    # Visible turret images coexist with decals in RW. Avoid duplicate images
    # only where a decal replaces that exact image at the same anchor.
    for name, data in turrets.items():
        if default_visible(field(data, 'invisible', 'false'), tags, unknown=True):
            continue
        key = 'image' if field(data, 'image') else 'image_turret'
        section = 'turret_' + name if key == 'image' else 'graphics'
        frames, path = asset_frames(entry, section, key, num(field(graphics, 'turretImageScale'), 1))
        if not frames:
            continue
        x, y = pos(name)
        x += num(field(data, 'image_drawOffsetX'))
        y += num(field(data, 'image_drawOffsetY'))
        spin = num(field(data, 'idleSpin'))
        if spin:
            rotors.append({'name': name, 'image': frames[0], 'x': x, 'y': y, 'spin': spin,
                           'phase': num(field(data, 'idleDir')), 'source': path})
            continue
        duplicates = [v for k, v in physical if field(v, 'basePositionFromTurret') == name
                      and source_path(entry, k, 'image') == path]
        if duplicates:
            continue
        dest, (ox, oy), _ = destination(name) if main else (parts, (0, 0), None)
        add(dest, frames, x - ox, y - oy, .25, path, 'turret_' + name)
    for section, data in physical:
        count = num(field(data, 'total_frames'), 1)
        sc = num(field(data, 'imageScale'), 1)
        frames, path = asset_frames(entry, section, scale=sc, count=count,
                                    angle=num(field(data, 'dirOffset')),
                                    sx=num(field(data, 'imageScaleX'), sc), sy=num(field(data, 'imageScaleY'), sc))
        if not frames:
            continue
        # Source frame expressions represent tactical state, not animation. A
        # literal frame is retained; dynamic frames use the unmodified state.
        if count > 1:
            f = max(0, min(len(frames) - 1, int(num(field(data, 'frame')))))
            frames = [frames[f]]
        x = num(field(data, 'xOffsetRelative')) + num(field(data, 'xOffsetAbsolute'))
        y = -num(field(data, 'yOffsetRelative')) + num(field(data, 'yOffsetAbsolute'))
        anchor = field(data, 'basePositionFromTurret')
        dest = parts
        if anchor:
            tx, ty = pos(anchor)
            dest, (ox, oy), _ = destination(anchor)
            x += tx - ox
            y += ty - oy
        order = num(field(data, 'order')) + (-100 if field(data, 'layer').lower() == 'beforebody' else 1)
        add(dest, frames, x, y, order, path, section, min(1, max(0, num(field(data, 'alpha'), 1))))
    if groups:
        turret_parts = groups[main]
    if main and not turret_parts and not groups:
        main = None
    # Most units already contain their feet. Arms/legs are uncommon source
    # assemblies; preserve the standing pose when supplied separately.
    for section, data in ini.items():
        if not section.startswith(('arm_', 'leg_')) or field(data, 'hidden').lower() == 'true':
            continue
        for key in ('image_leg', 'image_end'):
            frames, path = asset_frames(entry, section, key)
            add(parts, frames, num(field(data, 'x')), -num(field(data, 'y')), -.5, path, section)
    fixed_ground = bool(ground_layers)
    hull, hpivot, hb = assemble(parts, centered_x=entry.get('kind') != 'building')
    if fixed_ground and hull:
        half_height = max(-hb[1], hb[3])
        centered = []
        for frame in hull:
            canvas = Image.new('RGBA', (frame.width, 2 * half_height))
            canvas.alpha_composite(frame, (0, hb[1] + half_height))
            centered.append(canvas)
        hull, hpivot, hb = centered, (.5, .5), [hb[0], -half_height, hb[2], half_height]
    if squad_controller and not hull:
        source = source_path(entry, 'graphics', 'image')
        if source and not image_file(source).getbbox():
            hull = [image_file(source).copy()]
            hpivot, hb = (.5, .5), [-hull[0].width / 2, -hull[0].height / 2, hull[0].width / 2, hull[0].height / 2]
            sources.append({'section': 'graphics', 'source': source.relative_to(RW).as_posix(), 'target': 'invisible squad controller', 'x': 0, 'y': 0, 'order': 0})
            notes.append('Original transparent source pixels retained for the invisible squad controller.')
    turret, tpivot, tb = assemble(turret_parts, centered_x=True)
    if groups and main and not turret:
        data = turrets[main]
        ref = field(data, 'image', field(graphics, 'image_turret'))
        source = source_path(entry, 'turret_' + main, 'image', ref)
        if source and image_file(source).getbbox() and not default_visible(field(data, 'invisible', 'false'), tags, unknown=True):
            raise ValueError(f'{entry["id"]}: visible parent ring lost its original art')
        turret, tpivot, tb = [Image.new('RGBA', (4, 4))], (.5, .5), [-2, -2, 2, 2]
        notes.append('Source-invisible parent ring retained as a transparent pivot for its independent child assemblies.')
    if not hull and turret:
        # Emplacements and infantry sometimes consist entirely of a rotating
        # piece. Keep a transparent pivot body rather than duplicating the art.
        hull = [Image.new('RGBA', (4, 4))]
        hpivot, hb = (.5, .5), [-2, -2, 2, 2]
        notes.append('The source has no static hull: a transparent 4x4 pivot carrier supports its visible rotating turret assembly.')
    sprites, patch = [], ({'shadow': False} if squad_controller else {})
    if not hull:
        notes.append('No visible source body or physical decal found; original source may be a marker/control unit.')
    else:
        key = 'u.' + entry['id']
        extra = {}
        if len(hull) > 1:
            anims = {}
            for state in ('moving', 'idle', 'firing'):
                rwstate = 'attack' if state == 'firing' else state
                first = field(graphics, 'animation_' + rwstate + '_start')
                last = field(graphics, 'animation_' + rwstate + '_end')
                speed = num(field(graphics, 'animation_' + rwstate + '_speed'), 6)
                if first and last:
                    anims[state] = [max(0, min(len(hull)-1, int(num(first)))), max(0, min(len(hull)-1, int(num(last)))), min(60, 60 / max(1, speed))]
            if anims:
                extra['anims'] = anims
        sheet = write_sheet(out, key, hull, scale, entry.get('kind') != 'building' and not fixed_ground, hpivot, **extra)
        sprites.append(sheet)
        patch['sprite'] = key
    if turret:
        key = 'tur.' + entry['id']
        sheet = write_sheet(out, key, turret, scale, True, tpivot)
        sprites.append(sheet)
        patch['turretSprite'] = key
        patch['turretMounts'] = [{'x': round(mx * scale, 3), 'y': round(my * scale, 3)}]
        # Identify exposed bore pixels for cosmetic recoil without moving the
        # mantlet. The main gun's RW recoil already specifies its travel.
        barrel_parts = [s for s in sources if s['target'] == 'turret' and ('炮管' in s['section'] or 'barrel' in s['section'].lower())]
        if barrel_parts:
            for part in turret_parts:
                if any(abs(part['x']-b['x']) < .01 and abs(part['y']-b['y']) < .01 for b in barrel_parts):
                    im = part['frames'][0]
                    bb = im.getbbox()
                    if bb and tb:
                        px, py = part['_imageOffset']
                        box = [px+bb[0], py+bb[1], px+bb[2], py+bb[3]]
                        w, h = turret[0].size
                        box = [max(0, min(1, box[i]/(w if i%2==0 else h))) for i in range(4)]
                        if box[2] > box[0] and box[3] > box[1]:
                            sheet['barrels'] = [[round(x, 6) for x in box]]
                            break
        secondary = [name for name in set(anchored) if name != main and not field(turrets.get(name, {}), 'slave').lower() == 'true']
        if secondary:
            if not groups:
                notes.append('Secondary visible guns share the principal turret aim: ' + ', '.join(sorted(secondary)))
    if groups:
        mount_sprites = {main: patch['turretSprite']}
        for name, group_parts in groups.items():
            if name == main:
                continue
            frames, pivot, bounds = assemble(group_parts, centered_x=True)
            if not frames:
                ref = field(turrets[name], 'image', field(graphics, 'image_turret'))
                path = source_path(entry, 'turret_' + name, 'image', ref)
                transparent = path and not image_file(path).getbbox()
                if field(turrets[name], 'invisible').lower() != 'true' and not transparent and field(graphics, 'turretImageScale') != '0':
                    raise ValueError(f'{entry["id"]}: no visible source art for mount {name}')
                # A source-invisible launcher still turns and aims. Its empty
                # pivot carries that geometry without inventing visible art.
                frames, pivot = [Image.new('RGBA', (4, 4))], (.5, .5)
            suffix = name.lower() if re.fullmatch(r'[a-zA-Z0-9_.-]+', name) else hashlib.sha256(name.encode()).hexdigest()[:12]
            key = f'tur.{entry["id"]}-{suffix}'
            sprites.append(write_sheet(out, key, frames, scale, True, pivot))
            mount_sprites[name] = key
        patch['_articulation_art'] = {'scale': scale, 'sprites': mount_sprites}
        notes.append('Source turret layers exported independently: ' + ', '.join(sorted(mount_sprites)))
    if rotors:
        patch['decals'] = []
        groups = {}
        for rotor in rotors:
            groups.setdefault((rotor['x'], rotor['y'], rotor['spin']), []).append(rotor)
        for i, rotor_group in enumerate(list(groups.values())[:12]):
            rotor = rotor_group[0]
            side = max(math.ceil(math.hypot(r['image'].width, r['image'].height)) for r in rotor_group) + 4
            base = Image.new('RGBA', (side, side))
            for blade in rotor_group:
                im = blade['image']
                centered = Image.new('RGBA', (side, side))
                centered.alpha_composite(im, ((side-im.width)//2, (side-im.height)//2))
                base.alpha_composite(centered.rotate(-blade['phase'], Image.Resampling.NEAREST))
            rotor_frames = [base.rotate((-1 if rotor['spin'] < 0 else 1)*j*30, Image.Resampling.NEAREST) for j in range(12)]
            key = f"dec.{entry['id']}-rotor-{i+1}"
            sprites.append(write_sheet(out, key, rotor_frames, scale, False, fps=min(60, max(12, abs(rotor['spin'])*2))))
            patch['decals'].append({'sprite': key, 'on': 'hull', 'layer': 'over',
                                    'x': round(rotor['x']*scale, 3), 'y': round(rotor['y']*scale, 3)})
            for blade in rotor_group:
                sources.append({'section': 'turret_'+blade['name'], 'source': blade['source'].relative_to(RW).as_posix(),
                                'target': 'animated rotor', 'phase': blade['phase'], 'x': blade['x'], 'y': blade['y']})
    if fixed_ground:
        notes.append('Original fixed-direction trench ground art is drawn below all units by the squad presentation; hOffset stays in its public pose.')
    if conditions:
        notes.append('Physical appearance conditions are previewed at the initial tags/flags; dynamic condition changes are retained in this report, not simulated by the baked sheets.')
    dynamic = [{'section': k, 'fields': {f: field(v, f) for f in dynamic_art_fields(v)}}
               for k, v in ini.items() if k.startswith('decal_') and field(v, 'layer').lower() in ('beforebody', 'afterbody')
               and dynamic_art_fields(v)]
    if dynamic:
        notes.append('Omitted dynamic geometry/frame overlays: ' + ', '.join(d['section'] for d in dynamic))
    if entry.get('artTags'):
        notes.append('Preview explicitly uses equipment tags: ' + ', '.join(entry['artTags']) + '. ' + entry.get('artTagsReason', ''))
    return sprites, patch, {'id': entry['id'], 'source': entry['source'], 'layers': sources, 'notes': notes,
                             'bodyBounds': hb, 'turretBounds': tb, 'artScale': scale,
                             'initialEquipmentTags': initial_tags, 'appearanceConditions': conditions,
                             'omittedDynamicOverlays': dynamic}


def build_deployment_art(entry, out):
    """Export the audited battery's discrete original physical states.

    No animation is baked from its radar's spin. Articulation retains that
    source clock; these sheets contain only the selected original pixels.
    """
    from radar_battery_port import PROVIDERS, LAUNCHERS
    from logistics_port import stock_id
    from articulation_port import _id
    name = entry.get('rwName')
    operator = name in {'EUFPVSQUAD', 'PLAFPVSQUAD', 'RUSFPVSQUAD', 'USFPVSQUAD'}
    if name not in PROVIDERS and name not in LAUNCHERS and not operator:
        return None
    original = entry['ini']
    add_tags = set(original.get('action_部署', {}).get('temporarilyAddTags', '').split(','))
    remove_tags = set(original.get('action_撤离' if operator else 'action_取消部署', {}).get('temporarilyRemoveTags', '').split(','))
    if '部署' not in add_tags or '部署' not in remove_tags:
        raise ValueError(f'{name}: original deployment appearance predicate changed')
    resources = set()
    for section, data in original.items():
        if section.startswith('decal_') and field(data, 'layer').lower() in ('afterbody', 'beforebody') and field(data, 'onlyWhenSelectedByAnyPlayer') != 'true':
            resources.update(re.findall(r'self\.resource\(type="([^"]+)"\)>=\d+', field(data, 'isVisible')))
    if len(resources) > 1:
        raise ValueError(f'{name}: appearance requires multiple uncompiled ammunition counters')
    resource = next(iter(resources), None)
    variant_modulo = 3 if operator and name == 'RUSFPVSQUAD' else None
    maximum = variant_modulo - 1 if variant_modulo else 0
    if resource:
        for section, data in original.items():
            for count in re.findall(r'self\.resource\(type="' + re.escape(resource) + r'"\)>=(\d+)', field(data, 'isVisible')):
                maximum = max(maximum, int(count))
        if not 1 <= maximum <= 16:
            raise ValueError(f'{name}: invalid original visible magazine bounds')
    sheets, states, records = [], [], []
    for deployed in (False, True):
        for count in range(maximum + 1):
            ini = deepcopy(original)
            tags = {tag.strip() for tag in field(ini.get('core', {}), 'tags').split(',')}
            tags.discard('部署'); tags.discard('OFF'); tags.add('部署' if deployed else 'OFF')
            ini['core']['tags'] = ','.join(sorted(tags))
            for section, data in ini.items():
                if variant_modulo and section in ('decal_车', 'decal_车_部署'):
                    if field(data, 'stack_indexStart') != 'self.id%3' or field(data, 'stack_indexCount') != '1':
                        raise ValueError(f'{name}: source per-entity variant expression changed')
                    alternatives = field(data, 'imageStack').split(',')
                    if len(alternatives) != variant_modulo: raise ValueError(f'{name}: source vehicle variant count changed')
                    data['image'] = alternatives[count]
                    for key in ['imageStack', 'stack_indexStart', 'stack_indexCount']: data.pop(key, None)
                if section.startswith('turret_'):
                    # A static original-pixel ring; the runtime owns its angle.
                    data['idleSpin'] = '0'
                if section.startswith('decal_') and 'isVisible' in data and resource:
                    data['isVisible'] = re.sub(r'self\.resource\(type="' + re.escape(resource) + r'"\)>=(\d+)', lambda m: 'true' if count >= int(m[1]) else 'false', data['isVisible'])
            source_mount = None if operator else 'r' if deployed else 'r_1'
            if name in LAUNCHERS:
                source_mount = 'MAIN' if 'turret_MAIN' in ini else None
            synthetic = {**entry, 'id': entry['id'] + ('-deployed' if deployed else '-travel') + str(count),
                         'ini': ini, 'splitTurrets': [], '_visualMain': source_mount}
            exported, patch, report = build_unit(synthetic, out)
            if not patch.get('sprite'):
                raise ValueError(f'{name}: original deployment body is absent')
            sheets.extend(exported)
            mounts = {}
            if patch.get('turretSprite'):
                mount = 'r' if name in PROVIDERS else source_mount
                if mount: mounts[_id(mount)] = patch['turretSprite']
            state = {'deployed': deployed, 'minimum': count, 'body': patch['sprite'], 'mounts': mounts}
            if name in PROVIDERS and mounts:
                original_mount = original['turret_' + source_mount]
                state['radar'] = {'sprite': mounts.pop('mount-r'), 'x': float(original_mount['x']) * ART_SCALE, 'y': -float(original_mount['y']) * ART_SCALE, 'active': deployed}
            if operator and deployed:
                if field(original.get('decal_车_部署', {}), 'alwaysStartDirAtZero') != 'true':
                    raise ValueError(f'{name}: deployed vehicle must keep its source fixed direction')
                ground, ground_patch, ground_report = build_unit({**synthetic, 'id': synthetic['id'] + '-ground', '_groundOnly': True}, out)
                if not ground_patch.get('sprite') or not any(layer['section'] == 'decal_操作员' for layer in ground_report['layers']):
                    raise ValueError(f'{name}: original operator and trench ground artwork is absent')
                sheets.extend(ground); state.update(ground=ground_patch['sprite'], fixedDirection=True)
                report['layers'].extend([{**layer, 'target': 'ground'} for layer in ground_report['layers'] if layer['section'] != 'graphics'])
            states.append(state)
            records.append({'deployed': deployed, 'minimum': count, 'layers': report['layers']})
    return sheets, {'states': states, **({'stock': stock_id(resource)} if resource else {}), **({'variantModulo': variant_modulo} if variant_modulo else {})}, records


def build_media(entries, out):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    sprites, patches, report, sound_defs = [], {}, [], []
    articulation_art, deployment_art = {}, {}
    sounds, projectiles, projectile_cache = {}, {}, {}
    for entry in entries:
        if 'ini' not in entry:
            entry = {**entry, 'ini': load_unit(RW / entry['source'])}
        sheets, patch, item = build_unit(entry, out)
        if '_articulation_art' in patch:
            articulation_art[entry['id']] = patch.pop('_articulation_art')
        sprites.extend(sheets)
        deployment = build_deployment_art(entry, out)
        if deployment:
            extra, appearance, witnesses = deployment
            sprites.extend(extra); deployment_art[entry['id']] = appearance
            initial = appearance['states'][0 if appearance.get('variantModulo') else sum(not state['deployed'] for state in appearance['states']) - 1]
            patch['sprite'] = initial['body']
            if initial['mounts']: patch['turretSprite'] = next(iter(initial['mounts'].values()))
            patch.pop('decals', None)
            item['deploymentStates'] = witnesses
            item['notes'].append('Original travel/deployed body and ring sheets switch with source deployment and visible magazine state; radar headings remain runtime articulation.')
        patches[entry['id']] = patch
        report.append(item)
        projectiles[entry['id']] = {}
        for section, data in entry['ini'].items():
            if section.startswith('turret_'):
                value = field(data, 'shoot_sound')
                # The source accepts comma-separated alternatives. All are
                # preserved on disk; its first recording is the default.
                for ref in value.split(','):
                    path = source_path(entry, section, 'shoot_sound', ref)
                    if not path or path.suffix.lower() not in ('.ogg', '.wav', '.mp3'):
                        continue
                    if str(path) in sounds:
                        continue
                    digest = hashlib.sha256(path.relative_to(RW).as_posix().encode()).hexdigest()[:12]
                    key = 'ucgr-shot-' + digest
                    rel = 'sounds/' + key + '.mp3'
                    (out / 'sounds').mkdir(exist_ok=True)
                    if not (out / rel).exists():
                        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(path),
                                        '-map_metadata', '-1', '-ac', '1', '-ar', '44100', '-codec:a', 'libmp3lame', '-q:a', '4', str(out / rel)], check=True)
                    sounds[str(path)] = key
                    sounds[path.relative_to(RW).as_posix()] = key
                    sound_defs.append({'key': key, 'file': rel})
            elif entry.get('exportProjectiles', False) and section.startswith('projectile_'):
                path = source_path(entry, section, 'image')
                if not path or path.suffix.lower() not in ('.png', '.jpg', '.jpeg', '.webp'):
                    continue
                im = image_file(path)
                if not im.getbbox():
                    continue
                draw_scale = num(field(data, 'drawSize'), 1)
                cache_key = (str(path), draw_scale)
                if cache_key not in projectile_cache:
                    digest = hashlib.sha256((path.relative_to(RW).as_posix() + ':' + str(draw_scale)).encode()).hexdigest()[:12]
                    key = 'prj.usgr-re-' + digest
                    sheet = write_sheet(out, key, [im], max(.01, ART_SCALE * draw_scale), True)
                    sprites.append(sheet)
                    projectile_cache[cache_key] = key
                projectiles[entry['id']][section[11:]] = projectile_cache[cache_key]
    # Several countries share the same airframe or chassis. The registry cap
    # counts sheets, so keep one original image and explicit references from
    # every def instead of consuming slots with copies of identical pixels.
    unique, canonical, aliases, keys = [], {}, {}, set()
    for sheet in sprites:
        # A source unit can serve multiple roster roles; repeated keys already
        # name the same exported file and must never unlink their canonical.
        if sheet['key'] in keys: continue
        keys.add(sheet['key'])
        metadata = {k: v for k, v in sheet.items() if k not in ('key', 'file')}
        digest = hashlib.sha256((out / sheet['file']).read_bytes() + json.dumps(metadata, sort_keys=True).encode()).hexdigest()
        if digest in canonical:
            aliases[sheet['key']] = canonical[digest]
            (out / sheet['file']).unlink(missing_ok=True)
        else:
            canonical[digest] = sheet['key']
            unique.append(sheet)
    for patch in patches.values():
        for key in ('sprite', 'turretSprite'):
            if key in patch:
                patch[key] = aliases.get(patch[key], patch[key])
        for decal in patch.get('decals', []):
            decal['sprite'] = aliases.get(decal['sprite'], decal['sprite'])
    for by_section in projectiles.values():
        for section, key in by_section.items():
            by_section[section] = aliases.get(key, key)
    for item in articulation_art.values():
        item['sprites'] = {name: aliases.get(key, key) for name, key in item['sprites'].items()}
    for appearance in deployment_art.values():
        for state in appearance['states']:
            state['body'] = aliases.get(state['body'], state['body'])
            state['mounts'] = {name: aliases.get(key, key) for name, key in state['mounts'].items()}
            if state.get('ground'): state['ground'] = aliases.get(state['ground'], state['ground'])
            if state.get('radar'): state['radar']['sprite'] = aliases.get(state['radar']['sprite'], state['radar']['sprite'])
    sprites = unique
    notes = [{'id': item['id'], 'notes': item['notes']} for item in report if item['notes']]
    result = {'sprites': sprites, 'defPatches': patches, 'sounds': sounds, 'soundDefs': sound_defs,
              'projectiles': projectiles, 'notes': notes, 'articulationArt': articulation_art, 'deploymentArt': deployment_art}
    (out / 'media-report.json').write_text(json.dumps({'policy': 'Original source pixels, composited at native layer coordinates; no generated replacement art.',
                                                     'defaultArtScale': ART_SCALE, 'entries': report,
                                                     'sounds': sound_defs, 'sheetAliases': aliases}, ensure_ascii=False, indent=2) + '\n')
    return result


def contact_sheet(entries, media, out, filename='samples/source-art-preview.png'):
    """Review actual exported hull/turret/rotor alignments at their pivots."""
    out = Path(out)
    count = len(entries)
    cols, cw, ch = min(5, count), 300, 330
    rows = math.ceil(count / cols)
    canvas = Image.new('RGB', (cols * cw, rows * ch + 80), '#172327')
    draw = ImageDraw.Draw(canvas)
    font_path = '/System/Library/Fonts/Menlo.ttc'
    try:
        title_font = ImageFont.truetype(font_path, 21)
        font = ImageFont.truetype(font_path, 15)
        small = ImageFont.truetype(font_path, 11)
    except OSError:
        title_font = font = small = ImageFont.load_default()
    draw.text((20, 14), 'UCGR-RE | original source art', fill='#e8ebdd', font=title_font)
    draw.text((20, 47), 'Exported hulls, articulated turrets and animated rotor assemblies. Preview, not a gameplay screenshot.', fill='#9baeb0', font=small)
    sheets = {s['key']: s for s in media['sprites']}
    factor = 3

    def layer(stage, key, point, phase=0):
        s = sheets[key]
        raw = Image.open(out / s['file']).convert('RGBA')
        width = raw.width // s.get('frames', 1)
        im = raw.crop((phase * width, 0, (phase + 1) * width, raw.height))
        im = im.resize((s['fw'] * factor, s['fh'] * factor), Image.Resampling.NEAREST)
        stage.alpha_composite(im, (round(point[0] - s.get('pivotX', .5) * im.width),
                                   round(point[1] - s.get('pivotY', .5) * im.height)))

    for index, entry in enumerate(entries):
        col, row = index % cols, index // cols
        x, y = col * cw, 80 + row * ch
        draw.rounded_rectangle((x+8, y+8, x+cw-8, y+ch-8), radius=8, fill='#223337', outline='#3c5154')
        stage = Image.new('RGBA', (800, 800))
        pivot = (400, 400)
        patch = media['defPatches'].get(entry['id'], {})
        if patch.get('sprite'):
            layer(stage, patch['sprite'], pivot)
        if patch.get('turretSprite'):
            mount = patch.get('turretMounts', [{}])[0]
            layer(stage, patch['turretSprite'], (pivot[0]+mount.get('x', 0)*factor, pivot[1]+mount.get('y', 0)*factor))
        for decal in patch.get('decals', []):
            layer(stage, decal['sprite'], (pivot[0]+decal.get('x', 0)*factor, pivot[1]+decal.get('y', 0)*factor))
        bbox = stage.getbbox()
        if bbox:
            stage = stage.crop(bbox)
            fit = min(1, (cw-30)/stage.width, (ch-80)/stage.height)
            if fit < 1:
                stage = stage.resize((round(stage.width*fit), round(stage.height*fit)), Image.Resampling.NEAREST)
            canvas.paste(stage, (x + (cw-stage.width)//2, y+20+(ch-80-stage.height)//2), stage)
        name = entry.get('rwName', entry['id']).encode('ascii', 'replace').decode()
        draw.text((x+18, y+ch-48), name[:27], fill='#e8ebdd', font=font)
        draw.text((x+18, y+ch-26), 'body / turret' if patch.get('turretSprite') else ('body / rotor' if patch.get('decals') else 'original body'), fill='#9baeb0', font=small)
    (out / filename).parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out / filename)
    return out / filename


if __name__ == '__main__':
    here = Path(__file__).resolve().parent
    inventory = json.loads((here / 'inventory.json').read_text())
    entries = [e for e in inventory['entries'] if e.get('include') or e.get('included')]
    if not entries:
        raise SystemExit('Import build_media from the porter with the selected playable roster.')
    result = build_media(entries, here)
    (here / 'media-data.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(f"{len(result['sprites'])} sheets, {len(result['soundDefs'])} weapon recordings")

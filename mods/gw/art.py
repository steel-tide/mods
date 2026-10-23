"""Compose GW's part-built pictures into one up-facing sheet.

GW draws a unit as decals hung on RW arm/leg ends and turrets: a mobile suit
is a crotch, a body, two arms, shoulders, a head, legs and feet, with the
weapon in its hand. A sheet is the rest pose (every idle keyframe at zero),
with each decal's `isVisible` evaluated against a fixed state: standing, alive,
first weapon in hand, the loadout's equipment index, nothing broken, no parent.
Source pixels are kept; only placement, rotation and the source scale apply.
"""
import math
import re
from PIL import Image
import gw

LAYERS = {'beforeBody': 1, '': 2, 'afterBody': 2}
# A round draws itself over everything, under the interface.
ROUND_LAYERS = {**LAYERS, 'beforeUI': 3}
# Health bars, rings and markers are interface, not hull; burning, stun and
# low-health overlays are states the game draws its own way.
SKIP_IMAGES = ('SHARED:', 'Resource/Image/Ring/', 'Resource/Image/Units/Hud/',
               'Resource/Image/Icon/Tips_', 'Resource/Image/Icon/MapMode_')
SKIP_SECTIONS = ('decal_Shadow', 'decal_Burned', 'decal_Stun', 'decal_LowHp', 'decal_Marker')


class State:
    def __init__(self, memory=None, resources=None, tags=(), height=1, moving=False, frame=0):
        self.memory = {'close': False, 'buildDone': True, 'nowWeaponIndex': 0, 'styleIndex': 0, 'captured': False,
                       'hideUI': 1, 'HideGraphics': 0, 'moveMode': 1 if moving else 0, **(memory or {})}
        self.resources = {'TileMode': 0, 'EquipmentIndex': 0, 'EquipmentIndex2': 0, 'ForceHideUI': 1, **(resources or {})}
        self.tags = set(tags)
        self.height = height
        self.moving = moving
        self.frame = frame


_CALL = r'distanceBetween\((?:[^()]|\([^()]*\))*\)'


def _py(expr, state):
    e = ' '.join((expr or '').split())
    e = re.sub(r'^if\s+', '', e)
    if not e:
        return 'True'
    # The boost flame compares a step ahead with the unit's own distance to its
    # waypoint: moving forward, the step ahead is the nearer.
    e = re.sub(_CALL + r'\s*(<=|<|>=|>)\s*' + _CALL, lambda m: str(m[1] in ('<=', '<')), e)
    subs = [
        (r'memory\.battleUnitCore\.readUnitMemory\([^)]*\)', '0'),
        (r'memory\.battleUnitCore\.timeAlive', '1'),
        (r'self\.readUnitMemory\(\s*name\s*=\s*"(\w+)"[^)]*\)', lambda m: f'M.get("{m[1]}",0)'),
        (r'self\.(?:resource|Resource)(?:\(\))?\.(\w+)', lambda m: f'R.get("{m[1]}",0)'),
        (r'memory\.(\w+)', lambda m: f'M.get("{m[1]}",0)'),
        (r'self\.tags\(\s*includes\s*=\s*\'(\w+)\'\s*\)', lambda m: str(m[1] in state.tags)),
        (r'self\.hasTags\(\s*includes\s*=\s*\'(\w+)\'\s*\)', lambda m: str(m[1] in state.tags)),
        (r'(?:self\.)?parent\.(?:hasTags|tags)\([^)]*\)', 'False'),
        (r'parent\.hp', '0'), (r'self\.parent\.hp', '0'),
        (r'self\.maxHp', '1'), (r'self\.hp', '1'), (r'self\.shield', '0'), (r'self\.speed', '1' if state.moving else '0'),
        (r'self\.height', str(state.height)), (r'self\.teamId', '0'), (r'self\.queueSize\(\)', '0'),
        (r'self\.transportingCount', '0'), (r'self\.timeAlive', '10'),
        (r'\btrue\b', 'True'), (r'\bfalse\b', 'False'),
    ]
    for pat, rep in subs:
        e = re.sub(pat, rep, e)
    return e


def visible(expr, state):
    code = _py(expr, state)
    if re.search(r'[A-Za-z_]\w*\(', code.replace('M.get(', '').replace('R.get(', '')):
        return False
    try:
        return bool(eval(code, {'__builtins__': {}}, {'M': state.memory, 'R': state.resources}))
    except Exception:
        return False


def _number(value, default):
    v = gw.num(value)
    return default if v is None else v


def pose(ini, animation):
    """First keyframe of each part in an `[animation_*]` section: {arm2: (x, y, dir)}."""
    out = {}
    sec = ini.get('animation_' + animation, {})
    for key, value in sec.items():
        m = re.match(r'((?:arm|leg)\d+)_([\d.]+)s$', key)
        if not m or float(m[2]) != 0:
            continue
        frame = {k: float(v) for k, v in re.findall(r'(\w+)\s*:\s*(-?[\d.]+)', value)}
        out[m[1]] = (frame.get('x', 0), frame.get('y', 0), frame.get('dir', 0))
    return out


def anchors(ini, offsets=None):
    out = {}
    for s, f in ini.items():
        if s.startswith(('arm_', 'leg_')):
            name = s.replace('_', '')
            dx, dy, _ = (offsets or {}).get(name, (0, 0, 0))
            out[name] = (_number(f.get('x'), 0) + dx, _number(f.get('y'), 0) + dy)
    return out


def turret_pos(ini, name):
    f = ini.get('turret_' + name, {})
    return _number(f.get('x'), 0), _number(f.get('y'), 0)


def decals(path, ini, state, turret=None, animation=None, layers=LAYERS):
    """Visible picture decals: on the hull, or (with `turret`) the ones that turn with that turret."""
    offsets = pose(ini, animation) if animation else {}
    arms = anchors(ini, offsets)
    out = []
    for s, f in ini.items():
        if not s.startswith('decal_') or s in SKIP_SECTIONS:
            continue
        layer = f.get('layer', '')
        if layer not in layers:
            continue
        ref = f.get('image', '')
        if not ref or any(k in ref.replace('\\', '/') for k in SKIP_IMAGES):
            continue
        if f.get('onlyTeam') or f.get('drawLineTo') or f.get('onlyWhenSelectedByAnyPlayer'):
            continue
        on_turret = f.get('basePositionFromTurret', '').strip()
        if (turret is None) == bool(on_turret) or (turret and on_turret != turret):
            continue
        if not visible(f.get('isVisible', 'true'), state):
            continue
        origin = ini.origins.get(s, {}).get('image') or path
        img = gw.resolve_ref(ref, origin)
        if not img:
            continue
        anchor = f.get('basePositionFromLegEnd', '').strip()
        if on_turret:
            ax, ay = 0, 0
        else:
            ax, ay = arms.get(anchor, (0, 0))
        turn = offsets.get(anchor, (0, 0, 0))[2]
        x = ax + _number(f.get('xOffsetRelative'), 0) + _number(f.get('xOffsetAbsolute'), 0)
        y = ay + _number(f.get('yOffsetRelative'), 0) - _number(f.get('yOffsetAbsolute'), 0)
        scale = _number(f.get('imageScale'), 1)
        frames = int(_number(f.get('total_frames'), 1))
        out.append(dict(section=s, layer=layers[layer], order=_number(f.get('order'), 0), image=img,
                        x=x, y=y, dir=_number(f.get('dirOffset'), 0) + turn, scale=scale, frame=state.frame % max(1, frames),
                        sx=scale * _number(f.get('imageScaleX'), 1), sy=scale * _number(f.get('imageScaleY'), 1),
                        alpha=min(1, max(0, _number(f.get('alpha'), 1))), frames=frames,
                        team=f.get('teamColors', '').strip().lower() == 'true'))
    out.sort(key=lambda d: (d['layer'], d['order']))
    return out


def whole(path, ini, state):
    """A unit's hull with every turret at rest: how an attached unit looks on its slot."""
    parts = decals(path, ini, state)
    for t in [s[7:] for s in ini if s.startswith('turret_')]:
        parts += place(decals(path, ini, state, turret=t), *turret_pos(ini, t))
    parts.sort(key=lambda d: (d['layer'], d['order']))
    return parts


def place(parts, x, y, dir=0):
    """Another unit's parts moved onto a slot of this one (an attachment)."""
    out = []
    for p in parts:
        q = dict(p)
        q['x'], q['y'], q['dir'] = x + p['x'], y + p['y'], p['dir'] + dir
        out.append(q)
    return out


def _pictures(parts, k):
    pics = []
    for p in parts:
        im = Image.open(p['image']).convert('RGBA')
        if p['frames'] > 1:
            w = im.width // p['frames']
            im = im.crop((w * p['frame'], 0, w * (p['frame'] + 1), im.height))
        w, h = max(1, round(im.width * abs(p['sx']) * k)), max(1, round(im.height * abs(p['sy']) * k))
        same = abs(w - im.width) <= 0 and abs(h - im.height) <= 0
        im = im if same else im.resize((w, h), Image.NEAREST if w >= im.width else Image.LANCZOS)
        if p['dir']:
            im = im.rotate(-p['dir'], expand=True, resample=Image.NEAREST)
        if p['alpha'] < 1:
            a = im.getchannel('A').point(lambda v: round(v * p['alpha']))
            im.putalpha(a)
        cx, cy = p['x'] * k, -p['y'] * k
        pics.append((im, cx - im.width / 2, cy - im.height / 2))
    return pics


def render(parts, k, centre=False):
    """Parts on a canvas at `k` canvas px per RW px; returns the image and the pivot in it."""
    images, pivot = render_frames([parts], k, centre)
    return (images[0] if images else None), pivot


def render_frames(frames, k, centre=False):
    """Several poses on one shared canvas, so every frame keeps the same pivot.

    `centre` widens the crop so the pivot is the middle column: the game turns
    a hull or turret sheet live only when its pivotX is 0.5, and bakes any
    other into 24 headings that step 15° at a time.
    """
    pictures = [_pictures(parts, k) for parts in frames if parts]
    if not pictures:
        return [], (0, 0)
    flat = [p for pics in pictures for p in pics]
    left = math.floor(min(x for _, x, _ in flat))
    top = math.floor(min(y for _, _, y in flat))
    right = math.ceil(max(x + im.width for im, x, _ in flat))
    bottom = math.ceil(max(y + im.height for im, _, y in flat))
    canvases = []
    for pics in pictures:
        canvas = Image.new('RGBA', (right - left, bottom - top))
        for im, x, y in pics:
            canvas.alpha_composite(im, (round(x - left), round(y - top)))
        canvases.append(canvas)
    box = None
    for c in canvases:
        b = c.getbbox()
        if b:
            box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    if not box:
        return [], (0, 0)
    if centre:
        # transparent columns beyond the canvas pad the short side
        half = max(-left - box[0], box[2] + left)
        box = (-left - half, box[1], -left + half, box[3])
    return [c.crop(box) for c in canvases], (-left - box[0], -top - box[1])


def strip(images):
    """Frames side by side, left to right."""
    w, h = images[0].size
    out = Image.new('RGBA', (w * len(images), h))
    for i, im in enumerate(images):
        out.alpha_composite(im, (i * w, 0))
    return out


def canvas_scale(parts):
    """Canvas px per RW px: the main picture keeps its own pixels."""
    if not parts:
        return 1
    def area(p):
        with Image.open(p['image']) as im:
            return im.size[0] * im.size[1] / max(1, p['frames']) * p['scale'] ** 2
    main = max(parts, key=area)
    return max(1, min(4, 1 / max(0.05, main['scale'])))

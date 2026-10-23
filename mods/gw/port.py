#!/usr/bin/env python3
"""Port GW BattleUniverse (高达战争_战争宇宙) V159 into this Steel Tide mod.

  python3 mods/gw/port.py              # sheets, sounds, mod.json, conversion-report.json
  python3 mods/gw/port.py --no-media   # mod.json and the report only

The source is the four RW packages in ../../rusted-warfare-mods/gw (git-ignored),
read as data and never executed. It covers the UC0079 base tech (what the EFSF
and Zeon `BaseTech` nodes unlock at the start of a ground match) and the first
development plan of each tree, researched at the faction's headquarters.

Conversion (see README):
  lengths   0.75 world px per RW px (art, radii, ranges, speeds, offsets)
  sight     RW tiles of 20 px, at the same length scale
  time      60 RW ticks a second; `Xs` is seconds
  metal     Money + Resource: both have the same base income and refinery
            yield, and the HQ trades them symmetrically
  HP, damage, defences, EN: unscaled, resolved by GW's own formula in the
            mod's `gw.battle` package
"""
from pathlib import Path
import hashlib
import json
import math
import re
import subprocess
import sys

import art
import gw
import weapons as W

HERE = Path(__file__).resolve().parent
MEDIA = '--no-media' not in sys.argv
CAP = 'gw.battle-v1'
WORLD = 0.75
DISPLAY = 1.5625
TICKS = 60
# A flame strip steps once each UpdateSub, which the source sends every 8 ticks.
FLAME_FPS = TICKS / 8
RW_TILE = 20
TILE = 32
# Buildings are drawn 1.5× their units' scale: GW's are barely larger than a
# mobile suit, and a footprint is whole tiles (the HQ comes to the vanilla 4×3).
BUILDING = 1.5
ALL_TARGETS = ['ground', 'ship', 'sub', 'air']

PKG_0079 = gw.SOURCE / 'GW_BattleUniverse_DLC_0079'
SIDES = {
    'EFSF_0079': dict(id='gw-efsf-0079', hq='HQ_EFSF_0079'),
    'ZEON_0079': dict(id='gw-zeon-0079', hq='HQ_ZEON_0079'),
}
# The factories a ground match can raise: Space factories need a space map.
FACTORY_KINDS = ['Land', 'Air', 'Aqua', 'Mega']
COMMON_BUILDINGS = ['Refinery_Common_T1', 'SupplyDepot_Common_T1', 'Institute_Common_T1', 'Turret_MG_A', 'Turret_AA_A',
                    'Turret_CN_A', 'Turret_MS_A', 'Turret_Radar_A', 'Wall_T1_A', 'Wall_T1_B']
# The development plans ported, in tree order: each faction's first after its
# base tech. The plan's file lists what it unlocks; the faction's TechList
# prices it in Money, Resource, TechPoint and seconds.
TECH_PLANS = {
    'EFSF_0079': ['Tech_EFSF_0079_AntiMSPlan', 'Tech_EFSF_0079_EarlyTypeMSDevelopmentPlan'],
    'ZEON_0079': ['Tech_ZEON_0079_GroundTypeZakuDevelopmentPlan', 'Tech_ZEON_0079_GroundTypeMSDevelopmentPlan'],
}
# TechPoint a second (HQ_Faction `Gen_TechPoint`): each headquarters 7.5, each
# T1 Institute 0.75 more; a computer side's is the package's to scale.
HQ_TECH_POINT = 7.5
INSTITUTE_TECH_POINT = 0.75
# Base-tech entries this pass leaves out, and why (conversion-report.json).
LEFT_OUT = {
    'Factory_{side}_Space': 'Space theatre: only a space map (TileMode 1) raises it.',
    'Factory_{side}_Space_Mega': 'Space theatre: only a space map (TileMode 1) raises it.',
    'Academy_Common_T1': 'Trains pilots, which are a later batch.',
    'Beacon_ACE_0079': 'Calls named ACE units, a later batch and a host option in the source.',
    'HLV_0079_Build': 'Launches HLVs between ground and space maps (AutoTileMode).',
}
# Forms a unit switches to from its card, with the buttons' labels both ways.
FORMS = {
    'U_Type_Submarine': {'U_Type_Submarine_StyleB': (['Submerged', '下潜', '잠항'], ['Surface', '上浮', '부상'])},
    'U_Type_Submarine_ZEON': {'U_Type_Submarine_ZEON_StyleB': (['Submerged', '下潜', '잠항'], ['Surface', '上浮', '부상'])},
}
# Unit text the source gives as "MG Squad" etc.: the loadout label for a variant.
VARIANT = {
    'MG': ['MG', '机枪', '기관총'], 'BZ': ['Bazooka', '火箭筒', '바주카'], 'Cannon': ['Cannon', '加农炮', '캐논'],
    'BR': ['Beam Rifle', '光束步枪', '빔 라이플'], 'CN': ['CN', '加农炮', '캐논'], 'BigGun': ['BigGun', '大枪', '빅 건'],
    '180mmCannon': ['180mmCannon', '加农炮', '180mm 캐논'], 'MSL': ['MSL', '导弹发射器', '미사일 런처'],
    '4XMSL': ['4XMSL', '简易对舰导弹发射器', '간이 대함 미사일 런처'],
}


# --------------------------------------------------------------- utilities

def slug(name):
    s = re.sub(r'(?<=[a-z])(?=[A-Z])', '_', name)
    s = re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
    s = s.replace('-common-', '-').replace('-n-g-a', '')
    return 'gw-' + s


def rnd(x, places=2):
    return round(float(x), places)


# A text the format holds, in each language.
TEXT_MAX = 400


def fit(text, key):
    """A description past the format's length loses its closing quote, the last
    paragraph, and then, while still too long, its last lines, marked with an ellipsis."""
    if len(text) <= TEXT_MAX:
        return text
    cut = text.rsplit('\n\n', 1)[0]
    dropped = 0
    if len(cut) > TEXT_MAX:
        while len(cut) + 2 > TEXT_MAX:
            cut = cut.rsplit('\n', 1)[0]
            dropped += 1
        cut += '\n…'
    note = f'{key}: runs past the format\'s {TEXT_MAX} characters; its closing line is dropped' + (
        (f', and its last {dropped} lines' if dropped > 1 else ', and its last line') if dropped else '')
    if note not in REPORT['adaptations']:
        REPORT['adaptations'].append(note)
    return cut


def text3(en, zh, key=None):
    """[en, zh, ko]: the source's two languages, Korean from localization.json."""
    en, zh = gw.text(en), gw.text(zh)
    ko = LOCAL.get(key or en)
    if ko is None:
        MISSING.add(key or en)
        ko = en
    return [fit(en, key or en), fit(zh or en, key or en), fit(ko, key or en)]


LOCAL_PATH = HERE / 'localization.json'
LOCAL = json.loads(LOCAL_PATH.read_text()) if LOCAL_PATH.exists() else {}
MISSING = set()
REPORT = {'units': {}, 'buildings': {}, 'tech': {}, 'leftOut': {}, 'adaptations': [], 'media': {}}


def price(value):
    """`Money=500,Resource=1500` or a bare number → metal."""
    total = 0.0
    for part in str(value or '').split(','):
        k, _, v = part.partition('=')
        n = gw.num(v if _ else k)
        if n is not None and (not _ or k.strip() in ('Money', 'Resource')):
            total += n
    return total


def mem(ini):
    out = {}
    for sec in ('hiddenAction_InitializeCommonStatsBefore', 'hiddenAction_InitializeStats'):
        out.update(gw.memory_block(ini.get(sec, {}).get('setUnitMemory', '')))
    return out


def mp_of(ini):
    m = re.search(r'Mp\s*=\s*(-?[\d.]+)', ini['core'].get('borrowResourcesWhileAlive', ''))
    return abs(float(m[1])) if m else 0


def tags_of(ini):
    return [t.strip() for t in ini['core'].get('tags', '').split(',') if t.strip()]


# --------------------------------------------------------------- media

class Media:
    def __init__(self):
        self.sprites, self.sounds, self.cache, self.sound_cache = [], [], {}, {}
        (HERE / 'sprites').mkdir(exist_ok=True)
        (HERE / 'sounds').mkdir(exist_ok=True)

    def sheet(self, key, image, k, frames=1, rotated=True, pivot=None, extra=None):
        """`image` is drawn at `k` px per RW px; the sheet's world size follows WORLD."""
        digest = hashlib.sha256(image.tobytes() + repr((image.size, frames, k, rotated, pivot)).encode()).hexdigest()[:16]
        if digest in self.cache:
            return self.cache[digest]
        fw_px = image.width / frames
        factor = WORLD / k / (DISPLAY if rotated else 1)
        fw, fh = max(4, round(fw_px * factor)), max(4, round(image.height * factor))
        sheet = {'key': key, 'file': f'sprites/{key}.png', 'frames': frames, 'fw': min(512, fw), 'fh': min(512, fh),
                 'rotated': rotated, 'teams': False, 'stripBg': False, 'stabilize': False}
        if pivot and rotated:
            # pivotX 0.5 is what lets the game turn a hull or gun smoothly (art.render_frames)
            assert key.startswith('prj.') or pivot[0] * 2 == fw_px, f'{key} turns about an off-centre pivot'
            sheet['pivotX'] = rnd(min(1, max(0, pivot[0] / fw_px)), 4)
            sheet['pivotY'] = rnd(min(1, max(0, pivot[1] / image.height)), 4)
        if extra:
            sheet.update(extra)
        if MEDIA:
            image.save(HERE / sheet['file'], optimize=True)
        self.sprites.append(sheet)
        self.cache[digest] = key
        return key

    def sound(self, ref, origin):
        if not ref:
            return None
        path = gw.resolve_ref(ref, origin)
        if not path:
            return None
        key = 'gw-' + re.sub(r'[^a-z0-9]+', '-', path.stem.lower()).strip('-')
        if key in self.sound_cache:
            return key
        file = f'sounds/{key}.mp3'
        if MEDIA:
            # Mono one-shots under a second, as the format asks.
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(path), '-t', '1.0', '-ac', '1', '-ar', '44100',
                            '-b:a', '96k', str(HERE / file)], check=True)
        self.sounds.append({'key': key, 'file': file})
        self.sound_cache[key] = path.relative_to(gw.SOURCE).as_posix()
        REPORT['media'][key] = self.sound_cache[key]
        return key


MEDIA_OUT = None


# --------------------------------------------------------------- orders

def orders(kinds=FACTORY_KINDS):
    """What each faction's factories sell: unit, loadout, price and batch (source unit lists)."""
    out = {}
    for side in SIDES:
        for kind in kinds:
            lp = PKG_0079 / f'Units/Buildings/Factory/UnitList/{side}/{side}_UnitList_{kind}.ini'
            ini = gw.load(lp)
            for sec, f in ini.items():
                if not sec.startswith('action_Produce_'):
                    continue
                unit = f.get('@define UnitID')
                subs = [s.strip() for s in f.get('alsoQueueAction', '').split(',') if s.strip()]
                made = []
                for s in subs:
                    for m in re.finditer(r'(\w+)\*(\d+)\(([^)]*)\)', ' '.join(ini.get('hiddenAction_' + s, {}).get('produceUnits', '').split())):
                        res = dict(re.findall(r'(\w+):([\d.]+)', m[3]))
                        made.append((m[1], int(m[2]), int(float(res.get('EquipmentIndex', 0))), int(float(res.get('EquipmentIndex2', 0)))))
                if not made:
                    continue
                count = sum(n for _, n, _, _ in made)
                out.setdefault((side, unit), []).append(dict(
                    kind=kind, section=sec, metal=gw.num(f.get('@define Money'), 0) + gw.num(f.get('@define Resource'), 0),
                    moral=gw.num(f.get('@define MoralPoint'), 0), time=gw.num(f.get('buildSpeed'), 30), count=count,
                    eq=made[0][2], eq2=made[0][3], text=gw.text(f.get('text', '')), text_zh=gw.text(f.get('text_zh', ''))))
    return out


def base_tech(side):
    path = PKG_0079 / f'Units/TechTree/Tech/Faction/{side}/Common/Tech_{side}_BaseTech.ini'
    ini = gw.load(path)
    return [v.get('@define UnitID') for k, v in ini.items() if k.startswith('action_UnlockInfo_')]


def node_id(name):
    """`Tech_ZEON_0079_GroundTypeZakuDevelopmentPlan` → `gw-zeon-0079-ground-type-zaku-dev-plan`."""
    s = re.sub(r'(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])', '_', name.replace('Tech_', '', 1))
    nid = 'gw-' + re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-').replace('development', 'dev')
    assert len(nid) <= 40, nid
    return nid


def tech_plan(side, name):
    """A development plan: its text, the plans it waits on, what it unlocks, and its price."""
    folder = PKG_0079 / f'Units/TechTree/Tech/Faction/{side}'
    path = folder / f'Common/{name}.ini'
    if not path.exists():
        path = folder / f'Common/{name}.ini.ini'  # one Zeon plan's file is named so in the source
    ini = gw.load(path)
    core = ini['core']
    after = re.findall(r"includes='(\w+)'", core.get('@global Unlocked', ''))
    unlocks = [v.get('@define UnitID') for k, v in ini.items() if k.startswith('action_UnlockInfo_')]
    awake = gw.load(folder / f'TechList_{side}.ini').get(f'hiddenAction_{name}_Awake', {})
    fig = {k: float(v) for k, v in re.findall(r'_(Time|Money|Resource|TechPoint)=([\d.]+)', awake.get('setUnitMemory', ''))}
    REPORT['tech'][node_id(name)] = {'source': name, 'file': path.relative_to(gw.SOURCE).as_posix(), 'after': after, 'price': fig}
    return {'name': text3(core.get('displayText', name), core.get('displayText_zh', '')),
            'desc': text3(core.get('displayDescription', ''), core.get('displayDescription_zh', ''), key='desc:' + name),
            'after': after, 'unlocks': unlocks, 'metal': fig.get('Money', 0) + fig.get('Resource', 0),
            'time': fig.get('Time', 30), 'techPoint': fig.get('TechPoint', 0)}


# --------------------------------------------------------------- weapons

def target_set(stats, kind):
    mode = int(gw.num(stats.get('attackTargetMode'), 0) or 0)
    if mode == 1:
        return ['ground', 'ship', 'sub']
    if mode == 2:
        return ['air']
    return ['ground', 'ship', 'sub', 'air']


def native_weapon(w, unit_range, targets, *, hull, prefix='', own_reach=False):
    """One GW turret as a Steel Tide weapon, with GW's own payload for the package."""
    f = w['figures']
    proj_path, proj = gw.unit(w['projectileUnit'])
    template = ''
    if proj_path:
        template = gw.core(gw.parse(proj_path)).get('copyFrom', '').split(',')[0].strip().rsplit('/', 1)[-1]
    beam = any(f.get(k) for k in ('BeamDamage', 'BeamAPDamage'))
    cqb = any(f.get(k) for k in ('CqbDamage', 'CqbShellDamage', 'CqbBeamDamage', 'CqbAPDamage'))
    shell = f.get('ShellDamage', 0) + f.get('ShellAPDamage', 0)
    nominal = sum(f.get(k, 0) or 0 for k in ('ShellDamage', 'ShellAPDamage', 'BeamDamage', 'BeamAPDamage', 'CqbDamage',
                                                'CqbShellDamage', 'CqbBeamDamage', 'CqbAPDamage'))
    trig = w.get('trigger') or {}
    melee = trig.get('melee')
    kind = 'cqb' if cqb else 'beam' if beam else 'shell'
    explosive = 'Explosion' in template or 'Mortar' in template or 'Bomb' in template or 'Area' in template
    if cqb:
        cls, projectile = 'at', 'bullet'
    elif beam:
        cls, projectile = 'at', 'bullet'
    elif 'Missile' in w['projectileUnit'] or w['projectileUnit'].startswith('Projectile_MS'):
        cls, projectile = 'rocket', 'missile'
    elif 'Mortar' in template:
        cls, projectile = 'he', 'shell'
    elif 'Bomb' in template or 'Bomb' in w['projectileUnit']:
        cls, projectile = 'he', 'bomb'
    elif explosive or shell >= 1000:
        cls, projectile = 'cannon', 'shell'
    else:
        cls, projectile = 'mg', 'bullet'
    if 'air' in targets and targets == ['air']:
        cls = 'aa'
    # Cadence. A triggered weapon starts its cooldown when the sequence starts;
    # a magazine turret empties at its `delay`, then waits its cooldown.
    if 'shots' in w:
        burst = max(1, len(w['shots']))
        gaps = w['gaps'] or [0]
        delay = max(1 / 30, sum(gaps) / max(1, len(gaps))) if burst > 1 else 0
        reload = max(w['cd'], w['windup'] + sum(w['gaps']), 0.05)
        en_burst, en_shot = w['en'], 0
    else:
        burst = max(1, w['magazine'])
        delay = max(1 / 30, w['delay']) if burst > 1 else 0
        reload = max(0.05, (burst - 1) * delay + (w['cd'] if w['cd'] else max(w['delay'], 1 / 30)))
        en_burst, en_shot = 0, w['enPerShot']
    reach = gw.num(w['turret'].get('limitingRange'))
    rng = melee if melee is not None else reach if own_reach and reach else unit_range
    if w['button']:
        rng = reach or unit_range
        trig = {'min': gw.num(w['turret'].get('limitingMinRange'))}
    out = {
        'id': prefix + w['id'],
        'cls': cls,
        'dmg': rnd(nominal),
        'reload': rnd(reload, 3),
        'range': rnd(max(0.5, rng * WORLD / TILE)),
        'projectile': projectile,
        'targets': targets,
        'turret': not hull,
    }
    if trig.get('min'):
        out['minRange'] = rnd(trig['min'] * WORLD / TILE)
    if burst > 1:
        out['burst'] = min(32, burst)
        out['burstDelay'] = rnd(min(5, delay), 3)
    speed = f.get('ProjectileSpeed') or 0
    if melee is not None or not speed:
        out['speed'] = 2000
    else:
        # A GW round steps `ProjectileSpeed × 0.1 × 1.25` px a tick.
        out['speed'] = rnd(min(5000, max(1, speed * 0.1 * 1.25 * TICKS * WORLD)))
    if explosive and f.get('ProjectileExplosionRange'):
        out['splash'] = rnd(min(500, f['ProjectileExplosionRange'] * WORLD))
    spread = f.get('ProjectileSpread')
    if spread and melee is None:
        out['spread'] = rnd(min(200, math.tan(math.radians(spread)) * rng * WORLD))
    if 'Mortar' in template:
        out['arc'] = True
    if projectile == 'missile' and 'Target' in w['projectileUnit']:
        out['homing'] = True
    if w['barrelY']:
        out['muzzleOffset'] = rnd(min(200, abs(w['barrelY']) * WORLD))
    snd = MEDIA_OUT.sound(w['sound'], w['soundOrigin'] or proj_path)
    if snd:
        out['sound'] = snd
    if melee is not None:
        out['look'] = {'muzzle': 'none', 'impact': 'fx.spark', 'impactScale': 1.5}
    elif proj_path:
        # The round as the source draws it: its picture, and a bazooka's trail.
        key = 'prj.' + slug(w['projectileUnit'])[3:]
        if len(key) > 44:
            key = key.replace('prj.projectile-', 'prj.', 1)
        assert len(key) <= 44, key
        if not any(s['key'] == key for s in MEDIA_OUT.sprites):
            parts = art.decals(proj_path, proj, art.State(), layers=art.ROUND_LAYERS)
            if parts:
                image, pivot = art.render(parts, 2)
                MEDIA_OUT.sheet(key, image, 2)
        if any(s['key'] == key for s in MEDIA_OUT.sprites):
            out['look'] = {'sprite': key}
    payload = {
        'kind': kind,
        'shell': f.get('ShellDamage', 0), 'shellAp': f.get('ShellAPDamage', 0),
        'beam': f.get('BeamDamage', 0), 'beamAp': f.get('BeamAPDamage', 0),
        'cqb': f.get('CqbDamage', 0), 'cqbAp': f.get('CqbAPDamage', 0),
        'cqbShell': f.get('CqbShellDamage', 0), 'cqbBeam': f.get('CqbBeamDamage', 0),
        'dp': f.get('DpDamage', 0), 'accuracy': f.get('WeaponAccuracy', 100),
        'cantDodge': bool(f.get('CantDodge', 0)),
        'anti': {'land': f.get('AntiLand', 1), 'air': f.get('AntiAir', 1), 'aqua': f.get('AntiAqua', 1),
                 'building': f.get('AntiBuilding', 1)},
        'size': {'large': f.get('AntiSizeLargeDamage', 1), 'small': f.get('AntiSizeSmallDamage', 1),
                 'largeAccuracy': f.get('AntiSizeLargeAccuracy', 1), 'smallAccuracy': f.get('AntiSizeSmallAccuracy', 1)},
        'blast': rnd((f.get('ProjectileExplosionRange') or 0) * WORLD) if explosive else 0,
        'en': en_burst, 'enShot': en_shot,
    }
    if w['button']:
        # One shot a life: the source's cooldown outlasts any match.
        out['reload'] = rnd(min(600, max(w['cd'], 1)), 3)
        out['arc'] = True
        out['targets'] = [t for t in targets if t != 'air'] or ['ground']
        out.pop('burst', None)
        out.pop('burstDelay', None)
        payload['en'] = w['en']
        payload['once'] = w['cd'] >= 600
        REPORT['adaptations'].append(f"{w['id']}: the player's targeted action fires on its own, once a life, at its source range")
    out['extensions'] = {CAP: {k: v for k, v in payload.items() if v not in (0, False, None) or k in ('kind', 'accuracy')}}
    return out


def weapon_id(source, seen):
    """The source turret name, within the 32 characters a weapon id may have."""
    s = re.sub(r'^Army_Squad_[A-Z]+_\d+_[A-Z]_[A-Z]_', '', source)
    s = re.sub(r'[^A-Za-z0-9_-]', '', s)
    if len(s) > 32:
        s = s[:23] + '-' + hashlib.sha256(source.encode()).hexdigest()[:8]
    base, n = s, 2
    while s in seen:
        s = f'{base[:29]}-{n}'
        n += 1
    seen.add(s)
    return s


# --------------------------------------------------------------- art

def frames_for(path, ini, eq=0, eq2=0, moving_pose=None):
    """A sheet's poses, and the `anims` that play them."""
    tags = tags_of(ini)
    height = gw.num(mem(ini).get('baseHeight'), 1) or 1
    st = lambda **kw: art.State(resources={'EquipmentIndex': eq, 'EquipmentIndex2': eq2}, tags=tags, height=height, **kw)
    rest = art.decals(path, ini, st())
    if moving_pose:
        return [rest] + [art.decals(path, ini, st(moving=True, frame=i), animation=moving_pose) for i in range(3)], \
            {'idle': [0, 0], 'moving': [1, 3, 12]}
    # A flame strip runs at the source's pace: an aircraft's is always lit, a
    # submarine's only under way.
    n = max((p['frames'] for p in rest), default=1)
    if n > 1:
        return [art.decals(path, ini, st(frame=i)) for i in range(n)], {'idle': [0, n - 1, FLAME_FPS]}
    n = max((p['frames'] for p in art.decals(path, ini, st(moving=True))), default=1)
    if n > 1:
        return [rest] + [art.decals(path, ini, st(moving=True, frame=i)) for i in range(n)], \
            {'idle': [0, 0], 'moving': [1, n, FLAME_FPS]}
    return [rest], None


def attached_parts(ini, slots_filter):
    """Parts of attached units (squad members, ship turrets) placed on their slots."""
    out = []
    for sec, f in ini.items():
        v = f.get('attachments_addNewUnits') or ''
        slot = f.get('attachments_onlyOnSlots', '').strip()
        m = re.match(r'\s*(\w+)', v)
        if not m or not slot or not slots_filter(m[1]):
            continue
        a = ini.get('attachment_' + slot, {})
        p2, u2 = gw.unit(m[1])
        if not u2:
            continue
        out.append((slot, m[1], gw.num(a.get('x'), 0), gw.num(a.get('y'), 0), p2, u2))
    return out


# --------------------------------------------------------------- units

def unit_def(side, name, order_list, variant_of=None, form=False):
    path, ini = gw.unit(name)
    core = ini['core']
    stats = mem(ini)
    tags = tags_of(ini)
    first = order_list[0]
    eq, eq2 = first['eq'], first['eq2']
    mv = ini.get('movement', {})
    mtype = mv.get('movementType', 'LAND').strip()
    fly = mtype == 'AIR' or int(gw.num(stats.get('flyUnit'), 0) or 0) == 1
    # A submarine is under water in the form that sits below the surface.
    sub = (gw.num(stats.get('baseHeight'), 1) or 0) < 1 and mtype == 'WATER'
    if fly:
        domain, adapt = 'air', stats.get('skyAdaptability', 100)
    elif mtype == 'WATER':
        domain, adapt = 'ship', stats.get('waterAdaptability', 100)
    elif mtype == 'OVER_CLIFF_WATER':
        domain, adapt = 'amphibious', stats.get('groundAdaptability', 100)
    else:
        domain, adapt = 'ground', stats.get('groundAdaptability', 100)
    adapt = (gw.num(adapt, 100) or 100) / 100
    boost = gw.num(stats.get('boostMoveSpeed'), gw.num(mv.get('moveSpeed'), 0.5))
    turn = gw.num(stats.get('baseTurnSpeed'), gw.num(mv.get('maxTurnSpeed'), 1))
    sight = gw.num(stats.get('baseFogOfWarSightRange'), 10)
    rng = gw.num(stats.get('baseAttackRange'), 400)
    variants = sorted({(o['eq'], o['eq2']) for o in order_list})
    label = None
    if variant_of:
        label = variant_of
    did = (slug(name) if not form else slug(name.rsplit('_Style', 1)[0])) + (('-' + re.sub(r'[^a-z0-9]+', '-', label[0].lower())) if label else '')
    count = first['count']
    cost = first['metal'] / count
    build = first['time'] / count
    if 'Human' in tags:
        armor, trail = 'light', 'none'
    elif fly:
        armor, trail = 'air', None
    elif sub:
        armor, trail = 'sub', None
    elif domain == 'ship':
        armor, trail = 'ship', None
    elif 'MS' in tags:
        armor, trail = 'medium', 'none'
    else:
        armor, trail = 'heavy', 'tread'
    name_en, name_zh = core.get('displayText', name), core.get('displayText_zh', '')
    names = text3(name_en, name_zh)
    if label:
        names = [f'{names[0]} ({label[0]})', f'{names[1]}（{label[1]}）', f'{names[2]} ({label[2]})']
    d = {
        'id': did,
        'name': names,
        'desc': text3(core.get('displayDescription', ''), core.get('displayDescription_zh', ''), key='desc:' + name),
        'kind': 'unit',
        'domain': 'ship' if sub else domain,
        'tier': 1,
        'cost': rnd(cost),
        'buildTime': rnd(build),
        'hp': gw.num(core.get('maxHp'), 1000),
        'pop': int(mp_of(ini)) or 1,
        'armor': armor,
        'speed': rnd(min(1000, boost * TICKS * WORLD * adapt)),
        'turnRate': rnd(min(50, turn * adapt * TICKS * math.pi / 180), 3),
        'vision': rnd(min(64, sight * RW_TILE * WORLD / TILE)),
        'radius': rnd(max(4, gw.num(core.get('radius'), 15) * WORLD)),
        'aiWeight': 2,
    }
    if trail:
        d['trail'] = trail
    if sub:
        d['underwater'] = True
    if fly:
        d['altitude'] = rnd(min(64, max(8, gw.num(stats.get('baseHeight'), 20) * WORLD)))
        if 'Heli' in name:
            d['hovers'] = True
            d['lowFlying'] = True
    targets = target_set(stats, d['domain'])
    hull_fire = 'MS' in tags or 'Human' in tags or fly
    ws, dropped = W.used(W.turret_weapons(ini), eq, eq2)
    d['weapons'] = [native_weapon(w, rng, targets, hull=hull_fire) for w in ws]
    # Squad members and ship turrets are attached units that shoot for the hull.
    members = attached_parts(ini, lambda u: 'Member' in u or '_Turret_' in u)
    by_type = {}
    for slot, uname, x, y, p2, u2 in members:
        by_type.setdefault(uname, []).append((slot, x, y, p2, u2))
    for uname, places in by_type.items():
        p2, u2 = places[0][3], places[0][4]
        for w in W.used(W.turret_weapons(u2))[0]:
            # Attached turrets and soldiers choose their own targets: GW leaves
            # air and ground to each, and the payload's Anti* factors decide.
            nw = native_weapon(w, rng, ALL_TARGETS, hull=True, own_reach=True)
            n = len(places)
            if n > 1:
                nw['burst'] = min(32, nw.get('burst', 1) * n)
                nw['burstDelay'] = rnd(max(1 / 30, nw.get('burstDelay', 0.1) / n), 3)
            if '_Turret_' in uname:
                nw['vertical'] = True
                nw['muzzleOffset'] = rnd(min(200, abs(places[0][2]) * WORLD))
            d['weapons'].append(nw)
    seen = set()
    for w in d['weapons']:
        w['id'] = weapon_id(w['id'], seen)
    if len(d['weapons']) > 8:
        REPORT['adaptations'].append(f'{name}: {len(d["weapons"])} weapons, first eight kept')
        d['weapons'] = d['weapons'][:8]
    # Hangars: weight budgets; a mobile suit takes two places, everything else one.
    cap = 0
    human_only = True
    for slot, uname, x, y, p2, u2 in attached_parts(ini, lambda u: u.startswith(('Hangar', 'SFS')) or 'Hangar' in u):
        c = int(gw.num(u2['core'].get('maxTransportingUnits'), 0) or 0)
        req = u2['core'].get('transportUnitsRequireTag', '')
        if 'CanLoadIntoAir' in req and 'CanLoadInto,' not in req + ',' and 'CanLoadIntoSpace' not in req:
            REPORT['adaptations'].append(f'{name}: {uname} carries the player\'s aircraft, which native holds cannot (ground passengers only)')
            continue
        cap += c
        human_only = human_only and 'Human' in req
    if cap:
        d['transportCap'] = min(50, cap)
        if human_only:
            d['transportMaxWeight'] = 1
    d['cargoWeight'] = int(gw.num(core.get('transportSlotsNeeded'), 1) or 1)
    # GW's own state for the package: defences, levels, EN, size and stance.
    size = 'large' if 'LargeUnit' in tags else 'small' if 'SmallUnit' in tags else None
    stance = 'air' if fly else 'aqua' if sub else 'land'
    conf = {
        'level': {k: gw.num(stats.get('base' + k.capitalize() + 'Level'), 100) for k in ('shoot', 'cqb', 'accuracy', 'reaction')},
        'def': {k: gw.num(stats.get('base' + k.capitalize() + 'Def'), 0) for k in ('beam', 'shell', 'cqb', 'dp')},
        'plus': {k: gw.num(stats.get('base' + k.capitalize() + 'DefPlus'), 0) for k in ('beam', 'shell', 'cqb', 'dp')},
        'stance': stance,
        'en': {'max': gw.num(stats.get('enMax'), 0), 'move': rnd(gw.num(stats.get('moveHightSpeedModeUseEN'), 0.1) * 2 * 1.5 * 4, 3)},
        'mp': d['pop'],
    }
    if size:
        conf['size'] = size
    d['extensions'] = {CAP: conf}
    # Art: rest pose, the boost pose a mobile suit flies on, and engine flames.
    moving = 'OnMoving' if 'MS' in tags else None
    poses, anims = frames_for(path, ini, eq, eq2, moving)
    body_parts = poses[0]
    k = art.canvas_scale(body_parts) if body_parts else 1
    member_slots = [m for m in members if 'Member' in m[1]]
    turret_groups = sorted(((u, pl) for u, pl in by_type.items() if '_Turret_' in u), key=lambda g: -len(g[1]))
    main_turret = turret_groups[0] if turret_groups else None
    extra = []
    for slot, uname, x, y, p2, u2 in member_slots:
        extra += art.place(art.whole(p2, u2, art.State(tags=tags_of(u2))), x, y)
    for uname, places in turret_groups:
        for slot, x, y, p2, u2 in places:
            if main_turret and uname == main_turret[0]:
                parts = art.decals(p2, u2, art.State(tags=tags_of(u2)))  # the ring stays; its gun turns
            else:
                parts = art.whole(p2, u2, art.State(tags=tags_of(u2)))
            extra += art.place(parts, x, y)
    poses = [p + extra for p in poses]
    images, pivot = art.render_frames(poses, k, centre=True)
    if images:
        if len(images) != len(poses):
            anims = None
        key = MEDIA_OUT.sheet('u.' + did, art.strip(images), k, frames=len(images), pivot=pivot,
                              extra={'anims': anims} if anims else None)
        d['sprite'] = key
        sheet = next(s for s in MEDIA_OUT.sprites if s['key'] == key)
        # Several guns of one kind: one turret sheet and a ring for each.
        own_turrets = [s[7:] for s in ini if s.startswith('turret_')]
        tur_parts = []
        for t in own_turrets:
            tur_parts = art.decals(path, ini, art.State(tags=tags), turret=t)
            if tur_parts:
                tx, ty = art.turret_pos(ini, t)
                timg, tpiv = art.render(tur_parts, k, centre=True)
                d['turretSprite'] = MEDIA_OUT.sheet('tur.' + did, timg, k, pivot=tpiv)
                sheet['mount'] = [rnd((pivot[0] + tx * k) / (images[0].width), 4), rnd((pivot[1] - ty * k) / images[0].height, 4)]
                for w in d['weapons']:
                    if w['id'] in own_turrets:
                        w['turret'] = True
                break
        if not tur_parts and main_turret:
            uname, places = main_turret
            p2, u2 = places[0][3], places[0][4]
            tparts = []
            for t in [s[7:] for s in u2 if s.startswith('turret_')]:
                tparts = art.decals(p2, u2, art.State(tags=tags_of(u2)), turret=t)
                if tparts:
                    break
            if tparts and len(places) <= 8:
                timg, tpiv = art.render(tparts, k, centre=True)
                d['turretSprite'] = MEDIA_OUT.sheet('tur.' + did, timg, k, pivot=tpiv)
                unit_px = WORLD / DISPLAY
                d['turretMounts'] = [{'x': rnd(x * unit_px), 'y': rnd(-y * unit_px)} for _, x, y, _, _ in places]
                for w in d['weapons']:
                    if w['id'] in [s[7:] for s in u2 if s.startswith('turret_')]:
                        w['turret'] = True
                        w.pop('vertical', None)
                        w['burst'] = max(w.get('burst', 1), len(places))
        if d['domain'] in ('ship',) and images:
            # the art itself, not the columns that centre its pivot
            box = images[0].getbbox()
            length = (box[3] - box[1]) / k * WORLD
            width = (box[2] - box[0]) / k * WORLD
            d['body'] = {'r': rnd(max(4, width / 2 * 0.8)), 'len': rnd(max(0, length * 0.85 - width * 0.8))}
    REPORT['units'][did] = {'source': name, 'file': path.relative_to(gw.SOURCE).as_posix(), 'loadout': [eq, eq2],
                            'orders': [{k: o[k] for k in ('kind', 'section', 'metal', 'count', 'time', 'moral')} for o in order_list],
                            'weaponsLeftOut': dropped}
    if first['moral']:
        REPORT['adaptations'].append(f'{name}: the source also asks {first["moral"]:g} MoralPoint per order; MoralPoint is not ported')
    return d


# --------------------------------------------------------------- buildings

def footprint(width_world, height_world, least=1):
    return max(least, min(8, round(width_world / TILE))), max(least, min(8, round(height_world / TILE)))


def building_def(name, side=None):
    path, ini = gw.unit(name)
    core = ini['core']
    g = {k[8:].strip(): v for k, v in core.items() if k.startswith('@global ')}
    did = slug(name)
    stats = mem(ini)
    cost = price(core.get('price')) or price(f"Money={g.get('Money', 0)},Resource={g.get('Resource', 0)}")
    d = {
        'id': did,
        'name': text3(core.get('displayText', name), core.get('displayText_zh', '')),
        'desc': text3(core.get('displayDescription', ''), core.get('displayDescription_zh', ''), key='desc:' + name),
        'kind': 'building',
        'cost': rnd(cost),
        'buildTime': rnd(gw.num(g.get('buildTime'), 60)),
        'hp': gw.num(core.get('maxHp'), 1000),
        'vision': rnd(min(64, gw.num(core.get('fogOfWarSightRange'), 10) * RW_TILE * WORLD / TILE)),
        'power': 0,
    }
    st = art.State(tags=tags_of(ini), memory={'supplyPointActive': False})
    parts = art.decals(path, ini, st)
    k = art.canvas_scale(parts) if parts else 1
    image, pivot = art.render(parts, k)
    if image:
        wpx, hpx = image.width / k * WORLD * BUILDING, image.height / k * WORLD * BUILDING
        d['fw'], d['fh'] = footprint(wpx, hpx)
        key = MEDIA_OUT.sheet('u.' + did, image, k / BUILDING, rotated=False)
        d['sprite'] = key
        sheet = next(s for s in MEDIA_OUT.sprites if s['key'] == key)
        sheet['fitFootprint'] = False
        sheet['anchorY'] = round(sheet['fh'] * (pivot[1] / image.height))
    turrets = [s[7:] for s in ini if s.startswith('turret_')]
    for t in turrets:
        tparts = art.decals(path, ini, st, turret=t)
        if tparts and image:
            timg, tpiv = art.render(tparts, k, centre=True)
            d['turretSprite'] = MEDIA_OUT.sheet('tur.' + did, timg, k / BUILDING, pivot=tpiv)
            tx, ty = art.turret_pos(ini, t)
            sheet['mount'] = [rnd((pivot[0] + tx * k) / image.width, 4), rnd((pivot[1] - ty * k) / image.height, 4)]
            break
    targets = ['ground', 'ship', 'sub', 'air']
    rng = gw.num(stats.get('baseAttackRange'), gw.num(ini.get('attack', {}).get('maxAttackRange'), 400))
    ws = W.used(W.turret_weapons(ini))[0]
    d['weapons'] = [native_weapon(w, rng, targets, hull=False, own_reach=True) for w in ws]
    conf = {'building': True,
            'def': {k2: gw.num(stats.get('final' + k2.capitalize() + 'Def'), gw.num(stats.get('base' + k2.capitalize() + 'Def'), 0)) for k2 in ('beam', 'shell', 'cqb')}}
    d['extensions'] = {CAP: conf}
    REPORT['buildings'][did] = {'source': name, 'file': path.relative_to(gw.SOURCE).as_posix()}
    return d, ini, g


# --------------------------------------------------------------- build

def main():
    global MEDIA_OUT
    MEDIA_OUT = Media()
    sell = orders()
    defs, factions, rosters = [], [], {}
    unit_ids = {}
    tech_nodes, tech_points = [], {}
    for side, conf in SIDES.items():
        roster = []
        rosters[side] = roster
        # The base tech is open from the start; each plan's units wait on it.
        stages = [(base_tech(side), None)]
        tech_points[side] = {}
        for plan in TECH_PLANS.get(side, []):
            t = tech_plan(side, plan)
            nid = node_id(plan)
            base = f'Tech_{side}_BaseTech'
            assert all(a == base or a in TECH_PLANS[side] for a in t['after']), f'{plan} waits on a plan not ported'
            node = {'id': nid, 'name': t['name'], 'desc': t['desc'], 'lab': slug(conf['hq']), 'cost': rnd(t['metal']),
                    'time': rnd(t['time']), 'factions': [conf['id']]}
            after = [node_id(a) for a in t['after'] if a != base]
            if after:
                node['requires'] = after
            tech_nodes.append(node)
            tech_points[side][nid] = t['techPoint']
            stages.append((t['unlocks'], nid))
        for names, need in stages:
            for name in names:
                if name.startswith(('Factory_', 'Refinery', 'Institute', 'SupplyDepot', 'Academy', 'Beacon', 'HLV', 'Turret', 'Wall')):
                    continue
                if name.startswith('Pilot_'):
                    REPORT['leftOut'][name] = 'A named pilot (ACE), which is a later batch.'
                    continue
                entries = sell.get((side, name))
                if not entries:
                    REPORT['leftOut'][name] = 'Sold only by Space or Space Mega factories: a space map unit.'
                    continue
                loadouts = {}
                for o in entries:
                    loadouts.setdefault((o['eq'], o['eq2']), []).append(o)
                path, ini = gw.unit(name)
                eq_text = {}
                for s, f in ini.items():
                    m = re.match(r'action_Set_Equipment(\d)$', s)
                    if m:
                        t = gw.text(f.get('text', '')).replace('Equipment ', '').strip()
                        eq_text[int(m[1])] = VARIANT.get(t, [t, gw.text(f.get('text_zh', '')).replace('装备 ', ''), t])
                for i, (lo, olist) in enumerate(sorted(loadouts.items())):
                    key = (name, lo)
                    if key not in unit_ids:
                        label = eq_text.get(lo[0]) if i > 0 else None
                        if i > 0 and not label:
                            t = olist[0]['text'] or f'Loadout {lo[0]}'
                            label = [t, olist[0]['text_zh'] or t, LOCAL.get(t, t)]
                        d = unit_def(side, name, olist, variant_of=label)
                        if need:
                            d['requires'] = [need]
                        unit_ids[key] = d['id']
                        d['producedBy'] = []
                        d['_variants'] = []
                        defs.append(d)
                    did = unit_ids[key]
                    d = next(x for x in defs if x['id'] == did)
                    for o in olist:
                        fid = slug(f'Factory_{side}_{o["kind"]}')
                        if fid not in d['producedBy']:
                            d['producedBy'].append(fid)
                    roster.append(did)
                # Equipment switches: GW's paid change of loadout at a supply point.
                ids = [unit_ids[(name, lo)] for lo in sorted(loadouts)]
                if len(ids) > 1:
                    for lo, did in zip(sorted(loadouts), ids):
                        d = next(x for x in defs if x['id'] == did)
                        for lo2, other in zip(sorted(loadouts), ids):
                            if other == did:
                                continue
                            sec = ini.get(f'action_Set_Equipment{lo2[0]}', {})
                            cost = gw.num(sec.get('@define Money'), 0) + gw.num(sec.get('@define Resource'), 0)
                            d['_variants'].append({'button': {'cost': cost, 'time': gw.num(sec.get('buildSpeed'), 3)},
                                                   'if': {'near': {'units': supply_points(), 'side': 'friend', 'within': rnd(300 * WORLD / TILE)}},
                                                   'do': {'morph': other}})
                # Forms a unit changes into on its own card (a submarine's dive).
                for form, (label, back) in FORMS.get(name, {}).items():
                    base = next(x for x in defs if x['id'] == ids[0])
                    f = unit_def(side, form, loadouts[sorted(loadouts)[0]], variant_of=label, form=True)
                    f['producedBy'] = []
                    f['_variants'] = [{'button': {'name': back}, 'do': {'morph': base['id']}}]
                    base['_variants'].append({'button': {'name': label}, 'do': {'morph': f['id']}})
                    defs.append(f)
                    roster.append(f['id'])
    for d in defs:
        if d.get('_variants'):
            d['rules'] = d['_variants'][:24]
        d.pop('_variants', None)
        # The game reads a yard selling any aircraft as an airfield, and its AI
        # then never raises a ground line: an aircraft a land factory also
        # sells stays with the airport alone.
        air_yards = [f for f in d['producedBy'] if f.endswith('-air')]
        if d['domain'] == 'air' and air_yards and any(f.endswith('-land') for f in d['producedBy']):
            d['producedBy'] = [f for f in d['producedBy'] if not f.endswith('-land')]
            REPORT['adaptations'].append(f"{d['id']}: sold by the airport only (the source's land factory also lists it)")
        d['producedBy'] = sorted(d['producedBy'])
    # Buildings: the factories each faction sells from, then the shared ones.
    buildings = {}
    for side in SIDES:
        for kind in FACTORY_KINDS:
            name = f'Factory_{side}_{kind}'
            d, ini, g = building_def(name, side)
            d['produces'] = sorted(x['id'] for x in defs if d['id'] in x['producedBy'])
            d['extensions'][CAP]['upkeep'] = 1
            if kind == 'Aqua':
                d['extensions'][CAP]['supply'] = supply_of(g, 200)
            buildings[d['id']] = d
            rosters[side].append(d['id'])
    for name in COMMON_BUILDINGS:
        d, ini, g = building_def(name)
        conf = d['extensions'][CAP]
        if name.startswith('Refinery'):
            d['metalRate'] = 6
        if name.startswith('SupplyDepot'):
            d['power'] = 9
            conf['supply'] = supply_of(g, 200)
            conf['upkeep'] = 1
        if name.startswith('Institute'):
            # 2 Money and 4 Resource a second to keep, 0.75 TechPoint a second earned
            conf['upkeep'] = 6
            conf['techPoint'] = INSTITUTE_TECH_POINT
        if name.startswith('Turret'):
            conf['upkeep'] = 0.5
        if name.startswith('Turret_Radar'):
            # GW's radar finds what hides (`baseDetectRange`); its own sight stays short.
            d['radar'] = True
            d['detect'] = rnd(min(64, gw.num(mem(ini).get('baseDetectRange'), 500) * WORLD / TILE))
        buildings[d['id']] = d
        for side in SIDES:
            rosters[side].append(d['id'])
    for side in SIDES:
        for tmpl, why in LEFT_OUT.items():
            REPORT['leftOut'][tmpl.format(side=side)] = why
    # Headquarters and the builders that raise every building.
    for side, conf in SIDES.items():
        hq, ini, g = building_def(conf['hq'], side)
        hq['isHQ'] = True
        hq['power'] = 60                     # MpMax at the host's default start
        hq['metalRate'] = 120                # 60 Money + 60 Resource a second
        hq['cost'] = 5000
        hq['buildTime'] = 60
        hq['extensions'][CAP]['supply'] = supply_of(g, 200)
        hq['extensions'][CAP]['hq'] = True
        # GW's tech tree is the headquarters' own page: its plans are researched
        # here, each also asking the TechPoint the package keeps.
        hq['extensions'][CAP]['techPoint'] = HQ_TECH_POINT
        if tech_points[side]:
            hq['extensions'][CAP]['research'] = tech_points[side]
        builder = builder_def(side)
        hq['produces'] = [builder['id']]
        own = [b for b in rosters[side] if b in buildings]
        builder['builds'] = sorted(set(own)) + [hq['id']]
        for b in own:
            buildings[b].setdefault('builtBy', [])
            if builder['id'] not in buildings[b]['builtBy']:
                buildings[b]['builtBy'].append(builder['id'])
        hq['builtBy'] = [builder['id']]
        buildings[hq['id']] = hq
        defs.append(builder)
        rosters[side] += [hq['id'], builder['id']]
        factions.append({'id': conf['id'], 'name': faction_name(side), 'headquarters': hq['id'], 'builder': builder['id'],
                         'roster': sorted(set(rosters[side]))})
    defs = list(buildings.values()) + defs
    manifest = {
        'format': 'steel-tide-mod', 'v': 4, 'capacity': 'large',
        'id': 'gw', 'name': ['GW BattleUniverse', '高达战争_战争宇宙', 'GW 배틀 유니버스'],
        'version': '0.0.5', 'author': '恐龙再健身房',
        'description': [
            "The One Year War, on your terms. Lead the Earth Federation's Type 61 tanks, GMs, Ground Type Gundams and the Big Tray, or Zeon's Zakus, Gouf Custom, Gogg and the Dabude. Research your side's next development plan, rearm mobile suits with bazookas, beam rifles or 180mm cannons, and dive submarines beneath the enemy fleet.",
            '一年战争，由你主宰。率领地球联邦军的61式坦克、吉姆、陆战型高达与大托盘级，或吉翁公国军的扎古、老虎特装型、战蟹与达布德级。研究己方的下一项开发计划，为机动战士换装火箭筒、光束步枪或180mm加农炮，再让潜艇潜入敌方舰队之下。',
            '1년 전쟁, 당신의 방식으로. 지구연방군의 61식 전차, 짐, 육전형 건담, 빅 트레이급, 또는 지온 공국군의 자쿠, 구프 커스텀, 고그, 다부데급을 이끌어라. 진영의 다음 개발 계획을 연구하고, 모빌슈트를 바주카, 빔 라이플, 180mm 캐논으로 재무장시키고, 잠수함을 적 함대 아래로 잠항시켜라.'],
        'license': 'LicenseRef-GW-BattleUniverse-Upstream',
        'hideFromListing': True,
        'requiredCapabilities': [CAP],
        'factions': factions,
        'tech': tech_nodes,
        'defs': defs,
        'sprites': MEDIA_OUT.sprites,
        'sounds': MEDIA_OUT.sounds,
        # make-map.py draws it from this manifest's defs
        'maps': ['maps/odessa-coast.steel-tide-map'],
    }
    ext = HERE / 'extensions/gw-battle/extension.json'
    if ext.exists():
        manifest['extensionPackages'] = [json.loads(ext.read_text())]
    shots = sorted(p.relative_to(HERE).as_posix() for p in (HERE / 'screenshots').glob('*') if p.suffix.lower() in ('.png', '.jpg', '.webp')) if (HERE / 'screenshots').exists() else []
    if shots:
        manifest['screenshots'] = shots
    (HERE / 'mod.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    if MEDIA:
        # Sheets and recordings the manifest no longer names are stale output.
        used = {x['file'] for x in MEDIA_OUT.sprites + MEDIA_OUT.sounds}
        for folder in ('sprites', 'sounds'):
            for f in (HERE / folder).iterdir():
                if f'{folder}/{f.name}' not in used:
                    f.unlink()
    REPORT['missingKorean'] = sorted(MISSING)
    (HERE / 'conversion-report.json').write_text(json.dumps(REPORT, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(defs)} defs, {len(MEDIA_OUT.sprites)} sheets, {len(MEDIA_OUT.sounds)} sounds, {len(MISSING)} strings without Korean')


def supply_points():
    """The buildings that supply units (GW's `SupplyPoint` skill): HQs, depots, naval factories."""
    return sorted({slug(c['hq']) for c in SIDES.values()} | {'gw-supply-depot-t1'} | {slug(f'Factory_{s}_Aqua') for s in SIDES})


def supply_of(g, base):
    return {'range': rnd((base + (gw.num(g.get('supplyPointRangeExtra'), 0) or 0)) * WORLD),
            'hp': rnd(0.01 * (gw.num(g.get('supplyPointHpExtra'), 1) or 0), 4),
            'en': rnd(0.02 * (gw.num(g.get('supplyPointEnExtra'), 1) or 0), 4)}


def faction_name(side):
    path = PKG_0079 / f'Units/Buildings/Factory/UnitList/{side}/{side}_UnitList_Rule.ini'
    ini = gw.load(path)
    sec = next(f for s, f in ini.items() if s.endswith('_DontShow_ON'))
    en = gw.text(sec.get('text', '')).replace('Show ', '')
    zh = gw.text(sec.get('text_zh', '')).replace('显示 ', '').strip()
    return text3(en, zh)


def builder_def(side):
    """GW raises buildings from the HQ itself; a native faction needs a builder unit.

    This one is the faction's own infantry — the squad's officer and two of its
    soldiers — with the squad's movement, hit points and price.
    """
    name = f'Army_Squad_{side}_N_G_A'
    path, ini = gw.unit(name)
    stats = mem(ini)
    did = f'gw-engineer-{side.lower().replace("_", "-")}'
    team = [m for m in attached_parts(ini, lambda u: 'Member' in u) if m[0] in ('Member_M1', 'Member_M2', 'Member_M3')]
    parts = []
    for slot, uname, x, y, p2, u2 in team:
        parts += art.place(art.whole(p2, u2, art.State(tags=tags_of(u2))), x, y)
    image, pivot = art.render(parts, 1, centre=True)
    key = MEDIA_OUT.sheet('u.' + did, image, 1, pivot=pivot)
    sq = ini['core']
    return {
        'id': did,
        'name': [f'Engineer Team [{side.split("_")[0]}][0079]', '工兵队' + ('[EFSF][0079]' if side.startswith('EFSF') else '[ZEON][0079]'),
                 f'공병대 [{side.split("_")[0]}][0079]'],
        'desc': ['Raises the base the GW headquarters builds in the original.', '建造原作中由总部直接建造的建筑。',
                 '원작에서 사령부가 직접 짓는 건물을 세운다.'],
        'kind': 'unit', 'domain': 'ground', 'tier': 1,
        'cost': 300, 'buildTime': 15, 'hp': gw.num(sq.get('maxHp'), 1500), 'pop': 1, 'armor': 'light', 'trail': 'none',
        'speed': rnd(gw.num(stats.get('boostMoveSpeed'), 0.65) * TICKS * WORLD),
        'turnRate': rnd(gw.num(stats.get('baseTurnSpeed'), 2) * TICKS * math.pi / 180, 3),
        'vision': rnd(gw.num(stats.get('baseFogOfWarSightRange'), 18) * RW_TILE * WORLD / TILE),
        'radius': rnd(gw.num(sq.get('radius'), 15) * WORLD), 'weapons': [],
        'buildRate': 1, 'reach': 96, 'aiWeight': 1, 'sprite': key,
        'extensions': {CAP: {'level': {'shoot': 100, 'cqb': 100, 'accuracy': 100, 'reaction': 100},
                             'def': {'beam': 5, 'shell': 5, 'cqb': 5, 'dp': 5}, 'plus': {}, 'stance': 'land', 'size': 'small', 'mp': 1}},
    }


if __name__ == '__main__':
    main()

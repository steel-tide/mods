#!/usr/bin/env python3
"""Port GW BattleUniverse (高达战争_战争宇宙) V159 into this Steel Tide mod.

  python3 mods/gw/port.py              # sheets, sounds, mod.json, conversion-report.json
  python3 mods/gw/port.py --no-media   # mod.json and the report only

The source is the four RW packages in ../../rusted-warfare-mods/gw (git-ignored),
read as data and never executed. It covers the ground game of every faction of
UC0079, UC0087 and C.E.71: each one's base tech and its whole tech tree,
researched at the faction's headquarters, with the systems GW runs in its
`gw.battle` package (DOCS.md).

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
import copy
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

# Each era is its own package: its factions, factories, unit lists and trees.
ERAS = {
    '0079': gw.SOURCE / 'GW_BattleUniverse_DLC_0079',
    '0087': gw.SOURCE / 'GW_BattleUniverse_DLC_0087',
    'CE71': gw.SOURCE / 'GW_BattleUniverse_DLC_SEED',
}
SIDES = {
    'EFSF_0079': dict(id='gw-efsf-0079', era='0079'),
    'ZEON_0079': dict(id='gw-zeon-0079', era='0079'),
    'AEUG_0087': dict(id='gw-aeug-0087', era='0087'),
    'TITANS_0087': dict(id='gw-titans-0087', era='0087'),
    'NEO_ZEON_0087': dict(id='gw-neo-zeon-0087', era='0087'),
    'OMNI_CE71': dict(id='gw-omni-ce71', era='CE71'),
    'ZAFT_CE71': dict(id='gw-zaft-ce71', era='CE71'),
}
for _side, _conf in SIDES.items():
    _conf['hq'] = f'HQ_{_side}'
    _conf['pkg'] = ERAS[_conf['era']]
# The factories a ground match can raise: Space factories need a space map.
FACTORY_KINDS = ['Land', 'Air', 'Aqua', 'Mega']


def factory_kinds(side):
    return [k for k in FACTORY_KINDS if gw.unit(f'Factory_{side}_{k}')[0]]


def tech_folder(side):
    return SIDES[side]['pkg'] / f'Units/TechTree/Tech/Faction/{side}'


def tech_plans(side):
    """Every development plan of a tree, each after the plans it needs, in the
    order the faction's TechList names them (the computer climbs them so)."""
    folder = tech_folder(side) / 'Common'
    plans = {}
    for f in sorted(folder.glob(f'Tech_{side}_*.ini*')):
        name = f.name.split('.ini')[0]
        if name == f'Tech_{side}_BaseTech':
            continue
        core = gw.load(f)['core']
        plans[name] = re.findall(r"includes='(\w+)'", core.get('@global Unlocked', ''))
    listed = gw.load(tech_folder(side) / f'TechList_{side}.ini')
    order = [s[len('hiddenAction_'):-len('_Awake')] for s in listed if s.startswith('hiddenAction_') and s.endswith('_Awake')]
    rank = {n: i for i, n in enumerate(order)}
    out, done = [], {f'Tech_{side}_BaseTech'}
    pending = sorted(plans, key=lambda n: rank.get(n, len(rank)))
    while pending:
        ready = next(n for n in pending if all(a in done for a in plans[n]))
        out.append(ready)
        done.add(ready)
        pending.remove(ready)
    return out


TECH_PLANS = {side: tech_plans(side) for side in SIDES}
# TechPoint a second (HQ_Faction `Gen_TechPoint`): each headquarters 7.5, each
# T1 Institute 0.75 more; a computer side's is the package's to scale.
HQ_TECH_POINT = 7.5
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
        MISSING[key or en] = {'en': en, 'zh': zh}
        ko = en
    return [fit(en, key or en), fit(zh or en, key or en), fit(ko, key or en)]


def korean(en, zh=''):
    """Korean for a short label (a loadout, a pilot's name), recorded when the table lacks it."""
    ko = LOCAL.get(en)
    if ko is None:
        MISSING[en] = {'en': en, 'zh': zh}
    return ko or en


LOCAL_PATH = HERE / 'localization.json'
LOCAL = json.loads(LOCAL_PATH.read_text()) if LOCAL_PATH.exists() else {}
MISSING = {}
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

def orders():
    """What each faction's factories sell: unit, loadout, price and batch.

    A factory lists every unit list of its era, its own faction's last; a unit
    is offered once its tree unlocks it, at its own faction's price.
    """
    out = {}
    for side in SIDES:
        for kind in factory_kinds(side):
            path, ini = gw.unit(f'Factory_{side}_{kind}')
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
    ini = gw.load(tech_folder(side) / f'Common/Tech_{side}_BaseTech.ini')
    return [v.get('@define UnitID') for k, v in ini.items() if k.startswith('action_UnlockInfo_')]


# Plan words shortened, in this order, while a node id runs past 40 characters.
NODE_SHORT = [('-project', '-proj'), ('technology', 'tech'), ('recovery', 'rec'), ('underwater', 'uw'),
              ('next-generation', 'next-gen'), ('mainstay', 'main'), ('full-armor', 'fa'), ('blueprint', 'bp')]


def node_id(name):
    """`Tech_ZEON_0079_GroundTypeZakuDevelopmentPlan` → `gw-zeon-0079-ground-type-zaku-dev-plan`."""
    s = re.sub(r'(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])', '_', name.replace('Tech_', '', 1))
    nid = 'gw-' + re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-').replace('development', 'dev')
    if len(nid) > 40:
        nid = nid.removesuffix('-plan')
    for long, abbr in NODE_SHORT:
        if len(nid) > 40:
            nid = nid.replace(long, abbr)
    assert len(nid) <= 40, nid
    return nid


def tech_plan(side, name):
    """A development plan: its text, the plans it waits on, what it unlocks, and its price."""
    folder = tech_folder(side)
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
        out['spread'] = rnd(min(200, math.tan(math.radians(min(spread, 80))) * rng * WORLD))
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
        if len(key) > 44:
            key = key[:35] + '-' + hashlib.sha256(key.encode()).hexdigest()[:8]
        if not any(s['key'] == key for s in MEDIA_OUT.sprites):
            parts = art.decals(proj_path, proj, art.State(), layers=art.ROUND_LAYERS)
            image = art.render(parts, 2)[0] if parts else None
            if image:
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
        # factors of one are the package's default
        'anti': {k: v for k, v in {'land': f.get('AntiLand', 1), 'air': f.get('AntiAir', 1), 'aqua': f.get('AntiAqua', 1),
                                   'building': f.get('AntiBuilding', 1)}.items() if v != 1},
        'size': {k: v for k, v in {'large': f.get('AntiSizeLargeDamage', 1), 'small': f.get('AntiSizeSmallDamage', 1),
                                   'largeAccuracy': f.get('AntiSizeLargeAccuracy', 1), 'smallAccuracy': f.get('AntiSizeSmallAccuracy', 1)}.items() if v != 1},
        'blast': rnd((f.get('ProjectileExplosionRange') or 0) * WORLD) if explosive else 0,
        'en': en_burst, 'enShot': en_shot,
        # what a hit does past the hull: parts, cockpit and pilot, stun and fire, the blast round a bazooka round
        'partBreak': f.get('PartBreakModifier', 1), 'cockpit': f.get('CockpitBreakModifier', 1),
        'pilotDmg': f.get('PilotDamageModifier', 1), 'pilotTrue': f.get('PilotTrueDamage', 0),
        'stun': f.get('StunDamage', 0), 'burn': f.get('BurnedDamage', 0),
        'blastRange': rnd((f.get('ProjectileBlastRange') or 0) * WORLD), 'blastMul': f.get('ProjectileBlastDamageModifier', 0),
        'blastDp': f.get('ProjectileBlastDpModifier', 0),
        'pierce': int(f.get('ProjectileAttackTimes', 1) or 1), 'pierceMul': f.get('ProjectileAttackTimesDamageModifier', 1),
        'hand': bool((w.get('trigger') or {}).get('hand')),
    }
    if w['button']:
        # A player's skill, from the unit's card: aimed at a point or fired at
        # once, paid in EN, on its own cooldown. It never fires by itself.
        sk = w['skill']
        out['reload'] = rnd(min(600, max(w['cd'], 1)), 3)
        if sk['aim'] == 'ground':
            out['targets'] = [t for t in targets if t != 'air'] or ['ground']
        out.pop('burst', None)
        out.pop('burstDelay', None)
        label = re.sub(r'\s*%\{.*$', '', gw.text(sk['text'])).strip()
        label_zh = re.sub(r'\s*%\{.*$', '', gw.text(sk['text_zh'])).strip()
        payload['skill'] = {'label': text3(label, label_zh), 'aim': sk['aim'], 'en': w['en'], 'cd': w['cd'],
                            'shots': max(1, sk['shots']), 'windup': rnd(sk['windup'], 3),
                            'gap': rnd(sum(sk['gaps']) / len(sk['gaps']), 3) if sk['gaps'] else 0,
                            'min': rnd((gw.num(w['turret'].get('limitingMinRange')) or 0) * WORLD / TILE)}
        payload['skill'].update(skill_kind(w, out))
        needs = [part for part, key in (('head', 'headBreaked'), ('armR', 'armRBreaked'), ('armL', 'armLBreaked')) if key in sk['locked']]
        if 'pilotAwakening' in sk['locked'] or 'Awakening' in sk['visible']:
            needs.append('awakening')
        if needs:
            payload['skill']['needs'] = needs
        if sk['ai']:
            payload['skill']['ai'] = True
    defaults = {'partBreak': 1, 'cockpit': 1, 'pilotDmg': 1, 'pierce': 1, 'pierceMul': 1}
    out['extensions'] = {CAP: {k: v for k, v in payload.items()
                               if (v not in (0, False, None) or k in ('kind', 'accuracy')) and defaults.get(k) != v}}
    if payload.get('skill', {}).get('kind') == 'mines':
        mine = copy.deepcopy(out)
        mine['extensions'][CAP].pop('skill')
        payload['skill']['spawn'] = spawned_def(w['projectileUnit'], 'mine', mine)
    return out


# Defs a skill makes on the field: drones, mines. Made once, by source name.
SPAWNED = {}


def skill_kind(w, weapon):
    """What a skill does beyond a shot: launch drones, lay mines, raise a cloud, a pulse round itself."""
    unit, f = w['projectileUnit'], w['figures']
    # clouds a skill raises (`Sp/Unit/*Area*`): smoke, Minovsky particles, a detection sweep
    if 'DetectA' in unit:
        return {'kind': 'area', 'area': 'detect', 'radius': 900, 'life': 1}
    if 'Minovsky' in unit:
        return {'kind': 'area', 'area': 'minovsky', 'radius': f.get('ProjectileExplosionRange', 450), 'life': f.get('ProjectileLife', 30)}
    if 'Smoking' in unit:
        return {'kind': 'area', 'area': 'smoke', 'radius': 100, 'life': 20}
    if w.get('spawned'):
        return {'kind': 'drone', 'spawn': spawned_def(unit, 'drone'), 'life': 15}
    if 'Mine' in unit:
        return {'kind': 'mines'}
    if 'EMP' in unit:
        return {'kind': 'emp', 'radius': 175}
    return {'kind': 'shot'}


def spawned_def(name, kind, weapon=None):
    """A drone a funnel skill launches, or a mine a launcher lays, as a def nothing builds."""
    if name in SPAWNED:
        return SPAWNED[name]['id']
    path, ini = gw.unit(name)
    if kind == 'mine':
        # the vanilla mine's arming and trigger, with GW's payload
        did = fit_id(slug(name).replace('gw-projectile-', 'gw-'))
        d = {'id': did, 'name': text3('Mine', '地雷', key='Mine'), 'extends': 'landmine', 'builtBy': [], 'cost': 0, 'hp': 1000,
             'weapons': [dict(weapon, id='mineblast', range=0.65, turret=False, targets=['ground', 'ship'])]}
        d['weapons'][0].pop('look', None)
        parts = art.decals(path, ini, art.State(tags=tags_of(ini))) if ini else []
        image = art.render(parts, 2)[0] if parts else None
        if image:
            d['sprite'] = MEDIA_OUT.sheet('u.' + did, image, 2, rotated=False)
        SPAWNED[name] = d
        return did
    order = [{'kind': 'Land', 'metal': 0, 'time': 1, 'count': 1, 'eq': 0, 'eq2': 0, 'moral': 0, 'section': '', 'text': '', 'text_zh': ''}]
    d = unit_def(None, name, order)
    d.update({'producedBy': [], 'pop': 0, 'aiWeight': 0, 'cost': 0, 'buildTime': 1})
    d['extensions'][CAP].update({'drone': True, 'pilot': 'none', 'mp': 0})
    SPAWNED[name] = d
    return d['id']


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

def globals_of(ini):
    return {k[8:].strip(): v for k, v in ini.get('core', {}).items() if k.startswith('@global ')}


def pilot_type(ini):
    """The pilot a unit is made with (`InitializeAddPilot_Default`): N, O or CNT; None if it needs none."""
    m = mem(ini)
    if str(m.get('noNeedPilot', '')).strip().lower() == 'true':
        return None
    add = ini.get('hiddenAction_InitializeAddPilot_Default', {}).get('addUnitsIntoTransport', '')
    if not add:
        return None
    if '_CNT' in add:
        return 'CNT'
    if re.search(r'_O_[A-Z]_', add):
        return 'O'
    return 'N'


def unit_systems(path, ini, stats, tags):
    """GW's battle systems a unit takes part in, for the package: its pilot,
    parts, DP, shield, field, detection, boost and command aura."""
    out = {}
    g = globals_of(ini)
    out['unitLevel'] = gw.num(stats.get('unitLevel'), 100)
    pilot = pilot_type(ini)
    out['pilot'] = pilot or 'none'
    safety = gw.num(stats.get('cockpitSafety'), 100)
    if safety != 100:
        out['safety'] = safety
    if 'MS' in tags and copies(path, 'Framework_MS'):
        out['parts'] = gw.num(stats.get('partStructuralStrength'), 100)
    dp = gw.num(stats.get('dpMax'))
    if dp:
        out['dp'] = dp
    shield_hp = gw.num(ini['core'].get('maxShield'), 0)
    size = gw.num(stats.get('finalShieldSize'), 0)
    if shield_hp > 0 and size > 0:
        out['shield'] = {'hp': shield_hp, 'block': gw.num(stats.get('finalShieldBlockPR'), 0.4), 'size': size,
                         'speed': gw.num(stats.get('shieldSpeed'), 1),
                         'def': {k: gw.num(stats.get(f'shield{k.capitalize()}Def'), 0) for k in ('beam', 'shell', 'cqb', 'dp')},
                         'plus': {k: gw.num(stats.get(f'shield{k.capitalize()}DefPlus'), 0) for k in ('beam', 'shell', 'cqb', 'dp')}}
    for kind, tmpl, hp_key, level_key, hp0, level0 in (('ifield', 'I_Field.gw', 'I_FieldHpMax', 'I_FieldLevel', 60000, 0.9),
                                                         ('psa', 'PSA.gw', 'PSAHpMax', 'PSALevel', 15000, 0.8),
                                                         ('abc', 'ABC.gw', 'ABCHpMax', 'ABCLevel', 15000, 0.6)):
        if copies(path, tmpl):
            field = {'kind': kind, 'hp': gw.num(g.get(hp_key), hp0), 'level': gw.num(g.get(level_key), level0)}
            if kind == 'ifield':
                # recovered each source tick
                field['regen'] = gw.num(g.get('I_FieldRecoverSpeed'), 500) * TICKS
            out['field'] = field
            break
    detect, anti = gw.num(stats.get('baseDetectRange'), 0) or 0, gw.num(stats.get('baseAntiDetectRange'), 0) or 0
    if detect or anti:
        out['detect'] = {'range': rnd(detect * WORLD), 'anti': rnd(anti * WORLD)}
    for tmpl, speed, reaction, burn in (('Common_OverBoost', 1.5, 1.5, True), ('Common_FullBoost', 1.2, 1.15, False)):
        if copies(path, tmpl):
            out['boost'] = {'en': 100, 'time': 12, 'cd': 90, 'speed': speed, 'reaction': reaction}
            if burn:
                out['boost']['burn'] = True
            break
    if copies(path, 'OpticalCamouflage'):
        # about one EN each check, and the anti-detect range it adds (`OpticalCamouflage.gw`)
        out['camo'] = {'en': 4, 'anti': 200}
    slots = 2 if copies(path, 'SFS_2X') else 1 if copies(path, 'SFS.gw') else 0
    if slots:
        out['sfs'] = {'slots': slots, 'fire': not copies(path, 'SFS_CantAttack')}
    if 'CmdUnit' in tags:
        out['leads'] = True
    for tmpl, kind in (('CmdCom', 'com'), ('CmdAtk', 'atk'), ('CmdDef', 'def')):
        if copies(path, tmpl + '.gw'):
            out['cmd'] = {'kind': kind, 'extra': rnd(gw.num(g.get('cmdComRangeExtra'), 0) * WORLD)}
            break
    return out


# Words a def id drops or shortens, in order, while it runs past 40 characters.
ID_SHORT = [('-deploy-state', '-deployed'), ('-connected-armored-vehicle', '-cav'), ('-with-backpack', '-wb'), ('-commander', '-cmd'),
            ('-beam-rifle', '-br'), ('-bazooka', '-bz')]


def fit_id(did):
    for long, abbr in ID_SHORT:
        if len(did) > 40:
            did = did.replace(long, abbr)
    if len(did) > 40:
        did = did[:31] + '-' + hashlib.sha256(did.encode()).hexdigest()[:8]
    return did


def unit_def(side, name, order_list, variant_of=None, form=False, tail=''):
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
    did = (slug(name) if not form else slug(name.rsplit('_Style', 1)[0])) + (('-' + re.sub(r'[^a-z0-9]+', '-', label[0].lower())) if label else '') + tail
    did = fit_id(did)
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
    # Hangars: weight budgets; a mobile suit takes two places, everything else
    # one. A hold carries ground units or aircraft, so a hull with both keeps the larger.
    caps, human_only = {'ground': 0, 'air': 0}, True
    for slot, uname, x, y, p2, u2 in attached_parts(ini, lambda u: u.startswith('Hangar') or 'Hangar' in u):
        c = int(gw.num(u2['core'].get('maxTransportingUnits'), 0) or 0)
        req = u2['core'].get('transportUnitsRequireTag', '')
        air = 'CanLoadIntoAir' in req and 'CanLoadInto,' not in req + ',' and 'CanLoadIntoSpace' not in req
        caps['air' if air else 'ground'] += c
        if not air:
            human_only = human_only and 'Human' in req
    hold = 'ground' if caps['ground'] >= caps['air'] else 'air'
    if caps[hold]:
        d['transportCap'] = min(50, caps[hold])
        if hold == 'air':
            d['transportDomain'] = 'air'
        elif human_only:
            d['transportMaxWeight'] = 1
        other = 'air' if hold == 'ground' else 'ground'
        if caps[other]:
            REPORT['adaptations'].append(f'{name}: its {other} hangars ({caps[other]}) are left out; a hold carries one kind, and its {hold} hangars are larger')
    # Sub-flight systems: a slot a mobile suit rides in, firing from it.
    slots = 2 if copies(path, 'SFS_2X') else 1 if copies(path, 'SFS.gw') else 0
    if slots and not d.get('transportCap'):
        d['transportCap'] = slots * 2
        d['transportMaxWeight'] = 2
    d['cargoWeight'] = min(50, int(gw.num(core.get('transportSlotsNeeded'), 1) or 1))
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
    conf.update(unit_systems(path, ini, stats, tags))
    if first['moral']:
        conf['moral'] = first['moral']
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


def building_def(name, side=None, tail=''):
    path, ini = gw.unit(name)
    core = ini['core']
    g = {k[8:].strip(): v for k, v in core.items() if k.startswith('@global ')}
    did = slug(name) + tail
    assert len(did) <= 40, did
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
    det, anti = gw.num(stats.get('baseDetectRange'), 0) or 0, gw.num(stats.get('baseAntiDetectRange'), 0) or 0
    if det or anti:
        conf['detect'] = {'range': rnd(det * WORLD), 'anti': rnd(anti * WORLD)}
    d['extensions'] = {CAP: conf}
    REPORT['buildings'][did] = {'source': name, 'file': path.relative_to(gw.SOURCE).as_posix()}
    return d, ini, g


# --------------------------------------------------------------- build

def copies(path, fragment, _seen=None):
    """Whether a unit file, through its copyFrom chain, copies a template whose name holds `fragment`."""
    seen = _seen if _seen is not None else set()
    path = Path(path).resolve()
    if path in seen:
        return False
    seen.add(path)
    for ref in re.split(r'[,\n]', gw.parse(path).get('core', {}).get('copyFrom', '')):
        base = gw.resolve_ref(ref, path) if ref.strip() else None
        if base and (fragment in base.name or copies(base, fragment, seen)):
            return True
    return False


# A faction's code in the id of a def only it fields.
SHORT = {'EFSF_0079': 'efsf', 'ZEON_0079': 'zeon', 'AEUG_0087': 'aeug', 'TITANS_0087': 'titans', 'NEO_ZEON_0087': 'neo',
         'OMNI_CE71': 'omni', 'ZAFT_CE71': 'zaft'}


def short(side):
    return SHORT[side]


def suffix(group, holders):
    """The id suffix of one of a source def's per-faction copies: the era when
    the copy is the whole era's, else the faction."""
    eras = {SIDES[s]['era'] for s in group}
    if len(group) > 1 and len(eras) == 1:
        return '-' + next(iter(eras)).lower()
    return '-' + '-'.join(short(s) for s in sorted(group, key=list(SIDES).index))


def split(holders):
    """Factions that share one def: those whose terms for it are the same. A
    def that every holder takes alike keeps its plain id."""
    groups = {}
    for side, terms in holders.items():
        groups.setdefault(json.dumps(terms, sort_keys=True), []).append(side)
    order = sorted(groups.values(), key=lambda g: min(list(SIDES).index(x) for x in g))
    # the earliest faction's copy keeps the plain id, so a def keeps its id as factions join
    return [(g, '' if i == 0 else suffix(g, holders)) for i, g in enumerate(order)]


# Buildings a tree unlocks that a ground match cannot raise, and why.
def building_left_out(name):
    if 'Space' in name:
        return 'Space theatre: only a space map (TileMode 1) raises it.'
    if name.startswith('HLV_'):
        return 'Launches HLVs between ground and space maps (AutoTileMode).'
    if name.startswith('Beacon_ACE_') and not ace_list(name):
        return "The source's ACE list for this era is empty: the beacon calls nobody."
    return None


# Building upgrades: the next level converts in place (`action_UpgardeTo…`).
UPGRADES = {'Refinery_Common_T2': 'Refinery_Common_T1', 'Refinery_Common_T3': 'Refinery_Common_T2',
            'Refinery_Common_T4': 'Refinery_Common_T3', 'Academy_Common_T2': 'Academy_Common_T1',
            'Institute_Common_T2': 'Institute_Common_T1'}
BUILDING_PREFIXES = ('Factory_', 'Refinery', 'Institute', 'SupplyDepot', 'Academy', 'Beacon', 'HLV', 'Turret', 'Wall')
# HQ_Faction: income, upkeep and TechPoint by the tags a building carries,
# Money + Resource a second.
YIELD = {'Refinery_T1': 6, 'Refinery_T2': 9, 'Refinery_T3': 12, 'Refinery_T4': 17, 'Refinery_T5': 22, 'Refinery_T6': 30, 'Refinery_T7': 40}
UPKEEP = {'Factory_T1': 1, 'BuildingTurret_T1': 0.5, 'BuildingTurret_T2': 1, 'SupplyDepot_T1': 1, 'Institute_T1': 6,
          'Institute_T2': 9, 'Academy_T1': 2, 'Academy_T2': 4}
TECH_POINTS = {'Institute_T1': 0.75, 'Institute_T2': 1}
MP_UP = {'SupplyDepot_T1': 9}
ACE_LISTS = {}
# Ids of the defs that supply units (GW's `SupplyPoint` skill), filled as defs are made.
SUPPLY = []
# The flag the package raises on a unit supplied within two seconds (`canSupply`):
# what a loadout switch or a custom unit's conversion waits on.
SUPPLIED = 'gw-supplied'


def building_tags(ini):
    """A building's tags once it stands: its own, and what `Building_GetDone` adds."""
    added = ini.get('hiddenAction_Building_GetDone', {}).get('temporarilyAddTags', '')
    return tags_of(ini) + [t.strip() for t in added.split(',') if t.strip()]


def upgrade_price(base_ini, target):
    for sec, f in base_ini.items():
        if sec.startswith('action_') and f.get('convertTo', '').strip() == target:
            return price(f.get('price')), gw.num(f.get('buildSpeed'), 15)
    return None, None


def action_effects(ini, sec):
    """What an action does through the actions it triggers and queues: the forms
    it converts to and the units it spawns, in order."""
    out = {'convert': [], 'spawn': []}
    stack, seen = [sec], set()
    while stack:
        name = stack.pop(0)
        if name in seen:
            continue
        seen.add(name)
        f = ini.get(name) or ini.get('hiddenAction_' + name) or ini.get('action_' + name) or {}
        conv = f.get('convertTo', '').strip()
        if conv and not conv.endswith(('_CloseState', '_OverLine')):
            out['convert'].append(conv)
        for m in re.finditer(r'(\w+)\s*\*\s*\d+', ' '.join(f.get('spawnUnits', '').split())):
            out['spawn'].append(m[1])
        for k in ('alsoTriggerAction', 'alsoQueueAction'):
            stack += [x.strip() for x in re.split(r'[,\n]', f.get(k, '')) if x.strip()]
    return out


# Buttons that turn a unit into another of its forms, by the source action's name.
TOGGLES = ('action_Transform_LandFly', 'action_FlyStyle', 'action_Transform_LandLand_Tank')
TIMED_SYSTEMS = {'action_EXAM': 'exam', 'action_HADES': 'hades', 'action_ALICE': 'alice'}
# A system's run (EXAM, HADES, ALICE): its seconds, the cooldown after, and the stun it ends in.
SYSTEM_RUN = {'exam': (30, 90, 3), 'hades': (30, 90, 3), 'alice': (30, 90, 1)}


def form_buttons(path, ini):
    """The form changes on a unit's card: (kind, target, spawns, section)."""
    out = []
    for sec, f in ini.items():
        if not sec.startswith('action_') or 'ReEntry' in sec:
            continue
        kind = None
        if sec.startswith(TOGGLES):
            kind = 'toggle'
        elif sec in ('action_EnterDeployMode', 'action_ExitDeployMode', 'action_UnloadEquipment'):
            kind = 'deploy'
        elif sec.startswith('action_CustomUnit_PilotCustomUnit_'):
            kind = 'ace'
        elif sec.startswith('action_CustomUnit_'):
            kind = 'custom'
        elif sec in TIMED_SYSTEMS:
            kind = 'system'
        elif sec == 'action_ExitUnit':
            kind = 'exit'
        if not kind:
            continue
        eff = action_effects(ini, sec)
        target = eff['convert'][0] if eff['convert'] else None
        if kind == 'exit' and not target:
            # an armor purge converts on a message its button sends, not a trigger
            target = ini.get('hiddenAction_ExitUnit_Step2', {}).get('convertTo', '').strip() or None
        out.append(dict(kind=kind, section=sec, target=target, spawns=eff['spawn'], f=f))
    return out


def add_forms(defs, unit_ids, made, stages, rosters):
    """The forms each unit turns into from its card, made on the way as defs no
    factory sells: a mobile suit's flight form, a deployed mode, a custom unit,
    a system's run; and the buttons both ways."""
    by_id = {d['id']: d for d in defs}
    unlocked = {side: {} for side in SIDES}
    for side in SIDES:
        for names, need in stages[side]:
            for n in names:
                unlocked[side].setdefault(n, need)

    def resolve(target, base):
        """The def a button makes: the unit as sold to this faction in this loadout, else a new form."""
        m = made[base['id']]
        same = [(l, did) for (n, l, t), did in unit_ids.items() if n == target and set(m['group']) <= set(made[did]['group'])]
        for lo, did in sorted(same, key=lambda x: (x[0] != m['lo'], x[0] != (0, 0), x[0])):
            return did
        path, ini = gw.unit(target)
        if not ini:
            return None
        # a form of one faction's unit may share its name with another faction's def
        tail = m['tail']
        for t in (m['tail'], suffix(m['group'], None), '-' + '-'.join(short(x) for x in m['group'])):
            tail = t
            if fit_id(slug(target) + (('-' + re.sub(r'[^a-z0-9]+', '-', m['label'][0].lower())) if m['label'] else '') + t) not in by_id:
                break
        f = unit_def(m['group'][0], target, m['orders'], variant_of=m['label'], tail=tail)
        assert f['id'] not in by_id, f['id']
        f['producedBy'] = []
        f['_variants'] = []
        defs.append(f)
        by_id[f['id']] = f
        unit_ids[(target, m['lo'], m['tail'])] = f['id']
        made[f['id']] = dict(m, name=target)
        for side in m['group']:
            rosters[side].append(f['id'])
        queue.append(f['id'])
        return f['id']

    queue = list(made)
    while queue:
        did = queue.pop(0)
        d, m = by_id[did], made[did]
        path, ini = gw.unit(m['name'])
        for b in form_buttons(path, ini):
            f, target = b['f'], b['target']
            label = lambda: text3(f.get('text', ''), f.get('text_zh', ''))
            if target == m['name']:
                continue
            if b['kind'] == 'ace':
                # a custom unit for one named ACE aboard: the package raises the ACE's flag
                codes = sorted(set(re.findall(r"_ACE_(\w+?)'", ' '.join(f.get(k, '') for k in ('isVisible', 'autoTrigger')))))
                tid = resolve(target, d) if target and codes else None
                if not tid:
                    continue
                d['_variants'].append({'button': {'cost': rnd(price(f.get('price'))), 'time': gw.num(f.get('buildSpeed'), 20)},
                                       'if': {'flag': SUPPLIED, 'any': [{'flag': 'gw-ace-' + c.lower()} for c in codes]},
                                       'do': {'morph': tid}})
                continue
            if b['kind'] == 'exit' and not target:
                # The Core Fighter leaves the suit, and the suit is gone.
                fighter = resolve(b['spawns'][0], d) if b['spawns'] else None
                if fighter:
                    d['_variants'].append({'button': {'name': label()}, 'do': [{'spawn': {'unit': fighter}}, {'remove': True}]})
                continue
            if not target or target == m['name']:
                continue
            need = unlocked[m['group'][0]].get(target, 'never')
            if b['kind'] == 'custom' and need == 'never':
                REPORT['adaptations'].append(f"{d['id']}: its conversion to {target} is left out; that tree never unlocks it")
                continue
            tid = resolve(target, d)
            if not tid:
                continue
            if b['kind'] == 'toggle':
                d['_variants'].append({'button': {'name': label()}, 'cooldown': 3, 'if': {'noFlag': 'gw-cant-transform'}, 'do': {'morph': tid}})
            elif b['kind'] == 'deploy':
                d['_variants'].append({'button': {'name': label(), 'time': gw.num(f.get('buildSpeed'), 3)}, 'do': {'morph': tid}})
            elif b['kind'] == 'custom':
                button = {'cost': rnd(price(f.get('price'))), 'time': gw.num(f.get('buildSpeed'), 20)}
                if need:
                    button['requires'] = [need]
                d['_variants'].append({'button': button, 'if': {'flag': SUPPLIED},
                                       'do': {'morph': tid}})
            elif b['kind'] == 'system':
                system = TIMED_SYSTEMS[b['section']]
                run, cd, stun = SYSTEM_RUN[system]
                flag = f'gw-{system}-cd'
                cond = {'noFlag': flag}
                if system != 'alice':
                    cond['hpAbove'] = 0.35
                d['_variants'].append({'button': {'name': label()}, 'if': cond, 'do': {'morph': tid}})
                d['_variants'].append({'every': cd, 'if': {'flag': flag}, 'do': {'unflag': flag}})
                form = by_id[tid]
                # EXAM and HADES wear the hull half a percent a check; ALICE burns EN, and ends when it is out
                form['extensions'][CAP]['drain'] = {'en': 4 / (8 / TICKS), 'back': did} if system == 'alice' else {'hp': 0.005 / (8 / TICKS)}
                if not any(r.get('every') == run for r in form['_variants']):
                    form['_variants'].append({'every': run, 'do': [{'flag': flag}, {'buff': {'speed': 0.05, 'reload': 20, 'for': stun}}, {'morph': did}]})
            elif b['kind'] == 'exit':
                # Armor purge: the armour blows off as a charge where it stood.
                do = [{'explode': {'dmg': 3500, 'radius': rnd(60 * WORLD), 'cls': 'he'}}] if b['spawns'] else []
                d['_variants'].append({'button': {'name': label()}, 'do': do + [{'morph': tid}]})


# The Academy's pilots (`Academy_Common_T1/T2`): a faction's pilot for 100
# Money in 3 s, and at T2 its Cyber Newtype for 1200 Money and 600 Resource in 20 s.
ACADEMY_PILOTS = {'N': (100, 3), 'CNT': (1800, 20)}
# ACE active skills (`Template/Unit/Skill_Pilot/Pilot_*Up.gw`), by template name.
ACE_SKILLS = {'Pilot_AccuracyUp': 'accuracy', 'Pilot_ReactionUp': 'reaction', 'Pilot_AwakeningUp': 'awakening',
              'Pilot_ExpUp': 'exp', 'Pilot_LeadershipUp': 'leadership', 'Pilot_ShootUp': 'shoot', 'Pilot_CqbUp': 'cqb',
              'Pilot_DefUp': 'def', 'Pilot_SpeedUp': 'speed', 'Pilot_AtkUp': 'atk'}


def ace_list(beacon):
    """The ACEs a beacon calls: (side, pilot unit, host unit, loadout, metal, seconds), from its unit list."""
    era = beacon.rsplit('_', 1)[-1]
    pkg = ERAS.get(era)
    out = []
    if not pkg:
        return out
    for side, conf in SIDES.items():
        if conf['era'] != era:
            continue
        for f in sorted((pkg / f'Units/Buildings/Beacon_ACE/UnitList/{side}/Units/ACE').glob('*.gw')):
            ini = gw.load(f)
            pilot = f.stem
            made = ini.get(f'hiddenAction_{pilot}_Produce_T_G', {}).get('produceUnits', '')
            m = re.search(r'(\w+)\s*\*\s*\d+\s*\(([^)]*)\)', ' '.join(made.split()))
            sw = ini.get(f'action_{pilot}_Produce_Switch_G', {})
            if not m:
                continue
            eq = int(float(dict(re.findall(r'(\w+):([\d.]+)', m[2])).get('EquipmentIndex', 0)))
            out.append((side, pilot, m[1], eq, gw.num(sw.get('@define Money'), 0) + gw.num(sw.get('@define Resource'), 0), gw.num(sw.get('@define Time'), 30)))
    return out


def pilot_unit(side, kind, src):
    """A faction's pilot on foot, trained at its Academy: boards a unit without one, or waits in the Academy."""
    order = [{'kind': 'Land', 'metal': ACADEMY_PILOTS[kind][0], 'time': ACADEMY_PILOTS[kind][1], 'count': 1, 'eq': 0, 'eq2': 0,
              'moral': 0, 'section': '', 'text': '', 'text_zh': ''}]
    d = unit_def(side, src, order)
    old = d['id']
    d['id'] = f"gw-pilot-{'cnt-' if kind == 'CNT' else ''}{SIDES[side]['id'][3:]}"
    REPORT['units'][d['id']] = REPORT['units'].pop(old)
    d.update({'producedBy': [], 'pop': 0, 'aiWeight': 0})
    d['extensions'][CAP].update({'pilotUnit': kind, 'pilot': 'none', 'mp': 0})
    return d


def ace_pilot(pilot):
    """An ACE's fixed skills and the active skills it carries."""
    path, ini = gw.unit(pilot)
    m = gw.memory_block(ini.get('hiddenAction_InitializeStats_PilotSkills', {}).get('setUnitMemory', ''))
    num = lambda k, default: gw.num(m.get(k), default)
    skills = {k: num(f'pilot{k.capitalize()}Skill', 100) for k in ('shoot', 'cqb', 'def', 'speed', 'accuracy', 'reaction', 'leadership', 'awakening')}
    active = [v for k, v in ACE_SKILLS.items() if copies(path, k)]
    out = {'code': pilot.rsplit('_ACE_', 1)[1], 'skills': skills, 'comprehension': num('pilotComprehensionSkill', 110),
           'need': num('pilotLevelUpExpNeed', 6000), 'returnCd': num('deadReturnCD', 180)}
    if active:
        out['active'] = active
    return out, ini['core']


def pilots_and_aces(defs, buildings, group_of, stages, rosters):
    """Pilots, the Academy that trains them, and the beacon that calls the named ACEs."""
    unlocked = {side: {} for side in SIDES}
    for side in SIDES:
        for names, need in stages[side]:
            for n in names:
                unlocked[side].setdefault(n, need)
    for side in SIDES:
        for kind, src in (('N', f'Pilot_{side}_N_C_A'), ('CNT', f'Pilot_{side}_N_C_CNT')):
            if gw.unit(src)[1]:
                d = pilot_unit(side, kind, src)
                defs.append(d)
                rosters[side].append(d['id'])
    for did, b in buildings.items():
        src = REPORT['buildings'][did]['source']
        conf = b['extensions'][CAP]
        if src.startswith('Academy_Common_'):
            level = int(src[-1])
            conf['academy'] = {'level': level, 'pilots': {k: list(v) for k, v in ACADEMY_PILOTS.items() if k == 'N' or level >= 2}}
        if src.startswith('Beacon_ACE_'):
            aces = []
            for side, pilot, host, eq, metal, time in ace_list(src):
                if side not in group_of[did] or pilot not in unlocked[side]:
                    continue
                need = unlocked[side][pilot]
                order = [{'kind': 'Land', 'metal': metal, 'time': time, 'count': 1, 'eq': eq, 'eq2': 0, 'moral': 0, 'section': '', 'text': '', 'text_zh': ''}]
                ace, core = ace_pilot(pilot)
                who = [re.sub(r'\[[^\]]*\]', '', x).strip() for x in (gw.text(core.get('displayText', pilot)), gw.text(core.get('displayText_zh', '')))]
                d = unit_def(side, host, order, variant_of=[who[0], who[1] or who[0], korean(who[0], who[1])])
                old = d['id']
                d['id'] = 'gw-ace-' + ace['code'].lower()
                REPORT['units'][d['id']] = REPORT['units'].pop(old)
                d.update({'producedBy': [], 'limit': 1, 'aiWeight': 1})
                if need:
                    d['requires'] = [need]
                d['extensions'][CAP]['ace'] = ace
                defs.append(d)
                rosters[side].append(d['id'])
                aces.append(d['id'])
                REPORT['leftOut'].pop(pilot, None)
            conf['beacon'] = sorted(aces)


# Track names the source writes in Chinese, as ids.
TRACK_NAMES = {'SDGO_大厅A_Remix': 'sdgo-lobby-a', 'SDGO_大厅B_Remix': 'sdgo-lobby-b', 'SDGO_头顶上的恶魔_Remix': 'sdgo-devil-overhead',
               'SDGO_荣光的扎夫特_Remix': 'sdgo-glorious-zaft', 'SDGO_都市_Remix': 'sdgo-city', 'SDGO_高达尖兵_Remix': 'sdgo-gundam-vanguard'}
# The HQ operator's lines (`CV_HQ_EFSF_0079_NOE`), by the call the package makes.
NOEL_CALLS = {'GameStart': 'gameStart', 'Win': 'win', 'Lose': 'lose', 'BaseUnderAttack': 'baseUnderAttack', 'AllyACE_Step2': 'allyACE',
              'EnemyACE_Step2': 'enemyACE', 'AllySupplyUnit_Step2': 'allySupplyUnit', 'EnemySupplyUnit_Step2': 'enemySupplyUnit'}
# The voice a faction is picked with (`HQ_VS_GE_*`); the C.E. 71 ones are commented out in the source.
PICK_VOICES = {'EFSF_0079': 'EF_REVIL/REVIL_Pick.ogg', 'ZEON_0079': 'ZN_GIHREN/GIHREN_Pick.ogg', 'AEUG_0087': 'AEUG_BKS/AEUG_BKS_Pick.ogg',
               'TITANS_0087': 'TITANS_JMTF_Pick/TITANS_JMTF_Pick.ogg', 'NEO_ZEON_0087': 'NEO_ZEON_HAM/NEO_ZEON_HAM_Pick.ogg'}


def encode(src, out, music=False):
    """A recording as MP3, once: the source's music is 32 kbps Vorbis, kept at 48 kbps; delete a file to cut it again."""
    if MEDIA and not (HERE / out).exists():
        (HERE / out).parent.mkdir(exist_ok=True)
        args = ['-ac', '2', '-ar', '32000', '-b:a', '48k'] if music else ['-ac', '1', '-ar', '44100', '-b:a', '64k']
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(src), *args, str(HERE / out)], check=True)


def audio():
    """The soundtrack, each era's queue, and the voices the package plays."""
    tracks, seen, eras = [], {}, {}
    for pkg, era in (('GW_BattleUniverse_Main', None), ('GW_BattleUniverse_DLC_0079', '0079'), ('GW_BattleUniverse_DLC_0087', '0087'),
                     ('GW_BattleUniverse_DLC_SEED', 'ce71')):
        for f in sorted((gw.SOURCE / pkg / 'Resource/Music').glob('*.ogg')):
            digest = hashlib.sha256(f.read_bytes()).hexdigest()
            if digest not in seen:
                tid = 'gw-' + TRACK_NAMES.get(f.stem, re.sub(r'[^a-z0-9]+', '-', f.stem.lower()).strip('-'))
                seen[digest] = tid
                tracks.append({'id': tid, 'file': f'music/{tid}.mp3'})
                encode(f, f'music/{tid}.mp3', music=True)
            eras.setdefault(era or 'main', []).append(seen[digest])
    # no queue of its own: a GW faction's era plays while it is in play (the package's feedback)
    music = {'tracks': tracks}
    voice_dir = gw.SOURCE / 'GW_BattleUniverse_Main/Resource/Sound/VC'
    assets, lines, picked = {}, {}, {}
    def asset(path):
        aid = 'vc-' + re.sub(r'[^a-z0-9]+', '-', path.stem.lower()).strip('-')
        if aid not in assets:
            assets[aid] = f'voice/{aid}.mp3'
            encode(path, assets[aid])
        return aid
    path, ini = gw.unit('CV_HQ_EFSF_0079_NOE')
    for sec, call in NOEL_CALLS.items():
        refs = ini.get('hiddenAction_Get_Play_' + sec, {}).get('playSoundToPlayer', '')
        for ref in re.findall(r'ROOT:([^,\n]+?\.ogg)', refs):
            src = gw.resolve_ref('ROOT:' + ref, path)
            if src:
                lines.setdefault(call, []).append(asset(src))
    for side, ref in PICK_VOICES.items():
        src = voice_dir / ref
        if src.exists():
            picked[SIDES[side]['id']] = [asset(src)]
    REPORT['media']['music'] = len(tracks)
    return music, {'era': {k: v for k, v in eras.items() if k != 'main'}, 'lines': lines, 'picked': picked, 'assets': assets}


def main():
    global MEDIA_OUT
    MEDIA_OUT = Media()
    sell = orders()
    defs, factions, rosters = [], [], {side: [] for side in SIDES}
    tech_nodes, tech_points, stages = [], {}, {}
    # The base tech is open from the start; each plan's units wait on it.
    for side, conf in SIDES.items():
        stages[side] = [(base_tech(side), None)]
        tech_points[side] = {}
        for plan in TECH_PLANS[side]:
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
            stages[side].append((t['unlocks'], nid))
    # What each faction may field, from its earliest unlock: a unit's loadouts,
    # each offered at its own faction's price.
    offers = {}
    for side in SIDES:
        for names, need in stages[side]:
            for name in names:
                if name.startswith(BUILDING_PREFIXES):
                    continue
                if name.startswith('Pilot_'):
                    REPORT['leftOut'][name] = 'A named pilot (ACE), which is a later batch.'
                    continue
                entries = sell.get((side, name))
                if not entries:
                    REPORT['leftOut'].setdefault(name, 'Sold only by Space or Space Mega factories: a space map unit.')
                    continue
                for o in entries:
                    offers.setdefault(name, {}).setdefault(side, {'need': need, 'orders': []})
                    if o not in offers[name][side]['orders']:
                        offers[name][side]['orders'].append(o)
    unit_ids, made = {}, {}
    for name, holders in offers.items():
        REPORT['leftOut'].pop(name, None)
        path, ini = gw.unit(name)
        eq_text = {}
        for s_, f in ini.items():
            m = re.match(r'action_Set_Equipment(\d)$', s_)
            if m:
                t = gw.text(f.get('text', '')).replace('Equipment ', '').strip()
                zh = gw.text(f.get('text_zh', '')).replace('装备 ', '')
                eq_text[int(m[1])] = VARIANT.get(t) or [t, zh or t, korean(t, zh)]
        loadouts = sorted({(o['eq'], o['eq2']) for h in holders.values() for o in h['orders']})
        # Factions share a unit's defs when they open it alike and pay alike.
        terms = {side: {'need': h['need'], 'price': sorted({(o['eq'], o['eq2'], o['metal'], o['time'], o['count']) for o in h['orders']})}
                 for side, h in holders.items()}
        for group, tail in split(terms):
            ids = []
            for i, lo in enumerate(loadouts):
                olist = [o for side in group for o in holders[side]['orders'] if (o['eq'], o['eq2']) == lo]
                if not olist:
                    continue
                label = eq_text.get(lo[0]) if i > 0 else None
                if i > 0 and not label:
                    t = olist[0]['text'] or f'Loadout {lo[0]}'
                    label = [t, olist[0]['text_zh'] or t, korean(t, olist[0]['text_zh'])]
                d = unit_def(group[0], name, olist, variant_of=label, tail=tail)
                need = holders[group[0]]['need']
                if need:
                    d['requires'] = [need]
                d['producedBy'] = sorted({slug(f'Factory_{side}_{o["kind"]}') for side in group for o in holders[side]['orders']
                                          if (o['eq'], o['eq2']) == lo})
                d['_variants'] = []
                defs.append(d)
                unit_ids[(name, lo, tail)] = d['id']
                made[d['id']] = dict(name=name, lo=lo, tail=tail, group=group, orders=olist, label=label)
                ids.append((lo, d))
                for side in group:
                    rosters[side].append(d['id'])
            # Equipment switches: GW's paid change of loadout at a supply point.
            if len(ids) > 1:
                for lo, d in ids:
                    for lo2, other in ids:
                        if other is d:
                            continue
                        sec = ini.get(f'action_Set_Equipment{lo2[0]}', {})
                        cost = gw.num(sec.get('@define Money'), 0) + gw.num(sec.get('@define Resource'), 0)
                        d['_variants'].append({'button': {'cost': cost, 'time': gw.num(sec.get('buildSpeed'), 3)},
                                               'if': {'flag': SUPPLIED},
                                               'do': {'morph': other['id']}})
            # Forms a unit changes into on its own card (a submarine's dive).
            for form, (label, back) in FORMS.get(name, {}).items():
                base = ids[0][1]
                first = [o for side in group for o in holders[side]['orders'] if (o['eq'], o['eq2']) == ids[0][0]]
                f = unit_def(group[0], form, first, variant_of=label, form=True, tail=tail)
                f['producedBy'] = []
                f['_variants'] = [{'button': {'name': back}, 'do': {'morph': base['id']}}]
                base['_variants'].append({'button': {'name': label}, 'do': {'morph': f['id']}})
                defs.append(f)
                for side in group:
                    rosters[side].append(f['id'])
    add_forms(defs, unit_ids, made, stages, rosters)
    for d in defs:
        if d.get('_variants'):
            if len(d['_variants']) > 24:
                REPORT['adaptations'].append(f"{d['id']}: {len(d['_variants'])} buttons, first 24 kept")
            d['rules'] = d['_variants'][:24]
        d.pop('_variants', None)
        # The game reads a yard selling any aircraft as an airfield, and its AI
        # then never raises a ground line: an aircraft a land factory also
        # sells stays with the airport alone.
        air_yards = [f for f in d['producedBy'] if f.endswith('-air')]
        if d['domain'] == 'air' and air_yards and any(f.endswith('-land') for f in d['producedBy']):
            d['producedBy'] = [f for f in d['producedBy'] if not f.endswith('-land')]
            REPORT['adaptations'].append(f"{d['id']}: sold by the airport only (the source's land factory also lists it)")
        # a faction with no airport sells the land factory's aircraft at its Mega Factory instead
        elif d['domain'] == 'air' and any(f.endswith('-land') for f in d['producedBy']) and all(
                'Mega' in factory_kinds(side) for side in SIDES if slug(f'Factory_{side}_Land') in d['producedBy']):
            moved = [f[:-len('-land')] + '-mega' for f in d['producedBy'] if f.endswith('-land')]
            d['producedBy'] = sorted({f for f in d['producedBy'] if not f.endswith('-land')} | set(moved))
            REPORT['adaptations'].append(f"{d['id']}: sold by the Mega Factory (the source's land factory lists it, and the faction has no airport)")
        if gw.unit(REPORT['units'][d['id']]['source'])[0] and copies(gw.unit(REPORT['units'][d['id']]['source'])[0], 'SupplyPoint'):
            SUPPLY.append(d['id'])
    # Buildings: each faction's factories, then what its tree opens, shared by
    # the factions that open it alike.
    buildings = {}
    for side in SIDES:
        for kind in factory_kinds(side):
            name = f'Factory_{side}_{kind}'
            fid = slug(name)
            sold = sorted(x['id'] for x in defs if fid in x['producedBy'])
            if not sold:
                REPORT['leftOut'][name] = "Sells nothing its faction's tree opens on a ground map."
                continue
            d, ini, g = building_def(name, side)
            d['produces'] = sold
            buildings[d['id']] = d
            rosters[side].append(d['id'])
    holders = {}
    for side in SIDES:
        for names, need in stages[side]:
            for name in names:
                if not name.startswith(BUILDING_PREFIXES) or name.startswith('Factory_'):
                    continue
                why = building_left_out(name)
                if why:
                    REPORT['leftOut'][name] = why
                    continue
                holders.setdefault(name, {}).setdefault(side, need)
    def line(side, name):
        """The upgrade line a building stands in for a faction: (building, unlock) from its first level."""
        chain = [name]
        while UPGRADES.get(chain[0]) in holders and side in holders[UPGRADES[chain[0]]]:
            chain.insert(0, UPGRADES[chain[0]])
        nxt = {v: k for k, v in UPGRADES.items()}
        while nxt.get(chain[-1]) in holders and side in holders[nxt[chain[-1]]]:
            chain.append(nxt[chain[-1]])
        return [(b, holders[b][side]) for b in chain]
    building_ids, group_of = {}, {}
    for name, by_side in holders.items():
        for group, tail in split({side: line(side, name) for side in by_side}):
            d, ini, g = building_def(name, tail=tail)
            need = by_side[group[0]]
            if need:
                d['requires'] = [need]
            base = UPGRADES.get(name)
            if base in holders and group[0] in holders[base]:
                d['_upgradeOf'] = (base, tail)
                cost, time = upgrade_price(gw.unit(base)[1], name)
                if cost is not None:
                    d['upgradeCost'] = rnd(cost)
                    d['upgradeTime'] = rnd(time)
            tags = building_tags(ini)
            conf = d['extensions'][CAP]
            if any(t in YIELD for t in tags):
                d['metalRate'] = sum(YIELD.get(t, 0) for t in tags)
            if any(t in MP_UP for t in tags):
                d['power'] = sum(MP_UP.get(t, 0) for t in tags)
            if any(t in TECH_POINTS for t in tags):
                conf['techPoint'] = sum(TECH_POINTS.get(t, 0) for t in tags)
            if name.startswith('Turret_Radar'):
                # GW's radar finds what hides (`baseDetectRange`); its own sight stays short.
                d['radar'] = True
                d['detect'] = rnd(min(64, gw.num(mem(ini).get('baseDetectRange'), 500) * WORLD / TILE))
            buildings[d['id']] = d
            building_ids[(name, tail)] = d['id']
            group_of[d['id']] = group
            for side in group:
                rosters[side].append(d['id'])
    for d in buildings.values():
        up = d.pop('_upgradeOf', None)
        if up:
            d['upgradeOf'] = building_ids[up]
    pilots_and_aces(defs, buildings, group_of, stages, rosters)
    for d in SPAWNED.values():
        defs.append(d)
        for side in SIDES:
            rosters[side].append(d['id'])
    # Headquarters and the builders that raise every building.
    for side, conf in SIDES.items():
        hq, ini, g = building_def(conf['hq'], side)
        hq['isHQ'] = True
        hq['power'] = 60                     # MpMax at the host's default start
        # 60 Money + 60 Resource a second, and an era's HQ_ResGenLv2 15 + 15 more
        lv2 = conf['era'] == '0087'
        hq['metalRate'] = 120 + (30 if lv2 else 0)
        hq['cost'] = 5000
        hq['buildTime'] = 60
        hq['extensions'][CAP]['hq'] = True
        # GW's tech tree is the headquarters' own page: its plans are researched
        # here, each also asking the TechPoint the package keeps.
        hq['extensions'][CAP]['techPoint'] = HQ_TECH_POINT + (1 if lv2 else 0)
        if tech_points[side]:
            hq['extensions'][CAP]['research'] = tech_points[side]
        builder = builder_def(side)
        hq['produces'] = [builder['id']]
        own = [b for b in rosters[side] if b in buildings and not buildings[b].get('upgradeOf')]
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
    # Supply points and upkeep, read off the source for every building.
    for d in buildings.values():
        src = REPORT['buildings'][d['id']]['source']
        path, ini = gw.unit(src)
        conf = d['extensions'][CAP]
        if copies(path, 'SupplyPoint'):
            g = {k[8:].strip(): v for k, v in ini['core'].items() if k.startswith('@global ')}
            conf['supply'] = supply_of(g, 200)
            SUPPLY.append(d['id'])
        upkeep = sum(UPKEEP.get(t, 0) for t in building_tags(ini))
        if upkeep:
            conf['upkeep'] = upkeep
    SUPPLY.sort()
    defs = list(buildings.values()) + defs
    manifest = {
        'format': 'steel-tide-mod', 'v': 4, 'capacity': 'large',
        'id': 'gw', 'name': ['GW BattleUniverse', '高达战争_战争宇宙', 'GW 배틀 유니버스'],
        'version': '0.1.0', 'author': '恐龙再健身房',
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
        # the showcases (make-map.py, from this manifest's defs), then the source's ground maps (source-maps.ts)
        'maps': [f'maps/{p.name}' for p in sorted((HERE / 'maps').glob('showcase-*.steel-tide-map'))]
                + [f'maps/{p.name}' for p in sorted((HERE / 'maps').glob('*.steel-tide-map')) if not p.name.startswith('showcase-')],
    }
    music, voices = audio()
    manifest['music'] = music
    (HERE / 'extensions/gw-battle/audio.json').write_text(json.dumps(voices, ensure_ascii=False, indent=1) + '\n')
    subprocess.run(['node', str(HERE / 'extensions/gw-battle/build.mjs')], check=True)
    ext = HERE / 'extensions/gw-battle/extension.json'
    if ext.exists():
        manifest['extensionPackages'] = [json.loads(ext.read_text())]
    shots = sorted(p.relative_to(HERE).as_posix() for p in (HERE / 'screenshots').glob('*') if p.suffix.lower() in ('.png', '.jpg', '.webp')) if (HERE / 'screenshots').exists() else []
    if shots:
        manifest['screenshots'] = shots
    (HERE / 'mod.json').write_text(json.dumps(compact(manifest), ensure_ascii=False, indent=2) + '\n')
    if MEDIA:
        # Sheets and recordings the manifest no longer names are stale output.
        used = {x['file'] for x in MEDIA_OUT.sprites + MEDIA_OUT.sounds + music['tracks']} | {f for f in voices['assets'].values()}
        for folder in ('sprites', 'sounds', 'music', 'voice'):
            if not (HERE / folder).exists():
                continue
            for f in (HERE / folder).iterdir():
                if f'{folder}/{f.name}' not in used:
                    f.unlink()
    REPORT['missingKorean'] = sorted(MISSING)
    (HERE / '.missing-korean.json').write_text(json.dumps(MISSING, ensure_ascii=False, indent=1) + '\n')
    (HERE / 'conversion-report.json').write_text(json.dumps(REPORT, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(defs)} defs, {len(MEDIA_OUT.sprites)} sheets, {len(MEDIA_OUT.sounds)} sounds, {len(MISSING)} strings without Korean')


def compact(value):
    """Whole numbers written as integers: the manifest's metadata budget counts every character."""
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, dict):
        return {k: compact(v) for k, v in value.items()}
    if isinstance(value, list):
        return [compact(v) for v in value]
    return value


def supply_of(g, base):
    return {'range': rnd((base + (gw.num(g.get('supplyPointRangeExtra'), 0) or 0)) * WORLD),
            'hp': rnd(0.01 * (gw.num(g.get('supplyPointHpExtra'), 1) or 0), 4),
            'en': rnd(0.02 * (gw.num(g.get('supplyPointEnExtra'), 1) or 0), 4)}


def faction_name(side):
    path = SIDES[side]['pkg'] / f'Units/Buildings/Factory/UnitList/{side}/{side}_UnitList_Rule.ini'
    ini = gw.load(path)
    sec = next(f for s, f in ini.items() if s.endswith('_DontShow_ON'))
    en = gw.text(sec.get('text', '')).replace('Show ', '')
    zh = gw.text(sec.get('text_zh', '')).replace('显示 ', '').strip()
    return text3(en, zh)


def builder_def(side):
    """GW raises buildings from the HQ itself; a native faction needs a builder unit.

    This one is the faction's own infantry — the squad's officer and two of its
    soldiers — with the squad's movement, hit points and price. An era with no
    infantry (UC0087) sends three of its pilots, on the same three places.
    """
    name = f'Army_Squad_{side}_N_G_A'
    path, ini = gw.unit(name)
    pilot = None
    if not ini:
        pilot = gw.unit(f'Pilot_{side}_N_C_A')
        path, ini = gw.unit('Army_Squad_EFSF_0079_N_G_A')
    stats = mem(ini)
    did = f'gw-engineer-{side.lower().replace("_", "-")}'
    team = [m for m in attached_parts(ini, lambda u: 'Member' in u) if m[0] in ('Member_M1', 'Member_M2', 'Member_M3')]
    parts = []
    for slot, uname, x, y, p2, u2 in team:
        p2, u2 = pilot or (p2, u2)
        parts += art.place(art.whole(p2, u2, art.State(tags=tags_of(u2))), x, y)
    image, pivot = art.render(parts, 1, centre=True)
    key = MEDIA_OUT.sheet('u.' + did, image, 1, pivot=pivot)
    sq = ini['core']
    faction, era = side.rsplit('_', 1)
    zh_faction = {'EFSF': 'EFSF', 'ZEON': 'ZEON', 'AEUG': 'AEUG', 'TITANS': 'TITANS', 'NEO_ZEON': 'NEO_ZEON', 'OMNI': 'OMNI', 'ZAFT': 'ZAFT'}[faction]
    return {
        'id': did,
        'name': [f'Engineer Team [{faction}][{era}]', f'工兵队[{zh_faction}][{era}]', f'공병대 [{faction}][{era}]'],
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

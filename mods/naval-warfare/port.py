#!/usr/bin/env python3
"""Rebuild NW 0.10.1J from the supplied RW folder; never execute RW code.

python3 mods/naval-warfare/port.py [--no-media]
Source units: 20 px/tile, 60 ticks/s. A .5 world-px/RW-px coordinate
conversion keeps ships usable; compact buildings use native-sized footprints.
Credits/oil/steel are explicitly exchanged into native metal (see README).
All firing mounts, not just the eight HUD weapons, go into this mod's package.
"""
from pathlib import Path
from collections import Counter
from copy import deepcopy
import hashlib
import json
import math
import re
import subprocess
import sys
from PIL import Image
from rw import HERE, RW, load_unit, resolve, num, slug

CAP = 'naval-warfare.systems-v1'
WORLD = .5
DISPLAY = 1.5625
CREDIT = .01
OIL = 90000 / 1400
STEEL = 40000 / 1300
EXCLUDED = {
    'CVADPEscort': 'Unrecruited alien scenario unit; space/population scripts and animated attachments are outside this conventional-war port.',
    'Dlongsword': 'Helper of the omitted alien mothership.',
    '[BlobMob30002]': 'Scenario enemy helper, not a conventional roster unit.',
    '[BlobMob3000]': 'Scenario enemy helper, not a conventional roster unit.',
    'Tripod': 'Unrecruited cinematic tripod; procedural legs, attack/light animations and enemy-controller scripts are not compiled.',
    'TripodAttacking': 'Form of the omitted cinematic tripod.',
    'TripodHunting': 'Form of the omitted cinematic tripod.',
    'tripodh': 'Helper of the omitted cinematic tripod.',
    '33': 'Sandbox cheat that explicitly attempts to break the original game.',
    'Steelexjtractor': 'Sandbox cheat whose description explicitly promises a game crash.',
    'cloudEmiter': 'Visual smoke helper; source particle emitters are recorded but not simulated.',
    'Radiation': 'Source persistent radiation propagation is not compiled; immediate nuclear damage is retained.',
    'RadiationCore': 'Source persistent radiation propagation is not compiled; immediate nuclear damage is retained.',
    '987668': 'Unused nuclear aircraft helper with no producer; launcher uses its actual source projectile instead.',
    'OT_factionSelector': 'Replaced by five additive native setup factions; vanilla commandCenter replacement is forbidden.',
}
NATIONS = {
    'us': ('USA', 'USHQ', 'USF', ['United States', '美国', '미국']),
    'ru': ('Russia', 'RUHQ', 'RuF', ['Russia', '俄罗斯', '러시아']),
    'jp': ('JAPAN', 'JPHQ', 'JSDFF', ['Japan', '日本', '일본']),
    'cn': ('China', 'CHHQ', 'PLAF', ['China', '中国', '중국']),
    'ph': ('PHILIPPINES', 'REPUBLIC OF PHILIPPINES', 'AFPF', ['Philippines', '菲律宾', '필리핀']),
}

def building_size(entry, definition, width, height):
    """Enlarge compact structures without changing mobile units or huge bases.

    Dimensions are the source body's world size, before sheet rounding. Scale
    every attached part by the same factor and preserve the source aspect.
    """
    name = entry['rwName']
    major = {name for _, hq, factory, _ in NATIONS.values() for name in (hq, factory)}
    major.update(('CHDCK', 'JPDCK', 'AFPD', 'RUDCK', 'USDCK'))
    if name in major:
        definition.update(fw=3, fh=3)
        target, extent = 96, width
    elif 'crane' in name.lower():
        definition.update(fw=2, fh=2)
        target, extent = 48, width
    elif name.startswith('Helipad'):
        definition.update(fw=2, fh=2)
        target, extent = 64, width
    elif name == 'nukeLauncher':
        definition.update(fw=2, fh=3)
        target, extent = 64, width
    elif name.startswith(('Nuclear_factory', 'Wall ')) or name.endswith('Air Base'):
        return 1
    elif yes(entry['ini'].get('attack', {}).get('canAttack')):
        # Narrow launchers/towers should remain narrow, with a readable silhouette.
        target, extent = 32, max(width, height)
    else:
        target, extent = definition['fw'] * 32, width
    return max(1, min(target / max(.001, extent), 512 / max(width, height, .001)))

def write(file, value):
    (HERE / file).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

def round_stats(values, fields):
    """Keep authored gameplay stats readable without quantizing internal coefficients."""
    for field in fields:
        if field in values:
            value = round(values[field], 2)
            values[field] = int(value) if value == int(value) else value

def round_weapon_stats(weapon):
    round_stats(weapon, ('dmg', 'reload', 'range', 'minRange', 'speed', 'splash'))
    if 'minRange' in weapon:
        weapon['minRange'] = min(weapon['minRange'], round(weapon['range'] - .01, 2))

def round_definition_stats(definition):
    round_stats(definition, ('cost', 'hp', 'buildTime', 'vision', 'speed', 'turnRate',
                            'radius', 'repairRange', 'repairRate', 'buildRate', 'reach',
                            'cargoWeight', 'altitude', 'sonar', 'metalRate'))
    if 'shield' in definition:
        round_stats(definition['shield'], ('hp', 'regen', 'delay'))
    for weapon in definition['weapons']:
        round_weapon_stats(weapon)
    config = definition['extensions'][CAP]
    for gun in config['guns']:
        round_stats(gun, ('range', 'minRange', 'reload', 'warmup', 'direct', 'area',
                         'radius', 'targetSpeed'))
        round_weapon_stats(gun['weapon'])
    for action in config['actions']:
        round_stats(action, ('time', 'cost', 'cooldown', 'gain'))
    for rule in definition.get('rules', []):
        if 'button' in rule:
            round_stats(rule['button'], ('time', 'cost'))

def yes(value, default=False):
    return str(value).strip().lower() == 'true' if value is not None else default

def seconds(value, default=0, rate=False):
    value = str(value or '').strip().lower()
    if not value:
        return default
    if value.endswith('s'):
        return num(value[:-1], default)
    number = num(value, default)
    # RW buildSpeed is a fraction of one item per tick, not a tick duration.
    return 1 / (number * 60) if rate and number > 0 else number / 60

def resource(value):
    value = str(value or '').strip()
    if not value:
        return {}
    if re.fullmatch(r'-?[\d.]+', value):
        return {'credits': float(value)}
    out = {}
    for term in value.split(','):
        m = re.match(r'\s*([\w]+)\s*[=:]\s*(-?[\d.]+)', term)
        if m:
            out[m[1].lower()] = float(m[2])
    return out

def metal(resources):
    return round(CREDIT * (resources.get('credits', 0) + OIL * resources.get('oil', 0) + STEEL * resources.get('steel', 0)), 4)

def strings(value):
    return value.replace('\\\\n', '\n').replace('\\n', '\n').strip()

def load():
    entries = []
    for path in sorted(p for p in RW.rglob('*') if p.is_file() and p.suffix.lower()=='.ini'):
        ini = deepcopy(load_unit(path))
        core = ini.get('core', {})
        if not core.get('name'):
            continue
        # Older RW syntax stores action/build blocks inside [core].
        for key, value in list(core.items()):
            match = re.fullmatch(r'(action|canBuild)_(\d+)_(.+)', key)
            if match:
                ini.setdefault(match[1] + '_' + match[2], {})[match[3]] = value
        name = core['name']
        entries.append({'source': path.relative_to(RW).as_posix(), 'rwName': name, 'id': slug(name), 'ini': ini,
                        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'warnings': ini.warnings})
    assert len({e['id'] for e in entries}) == len(entries), 'source names must map to unique IDs'
    return entries

def split_units(text, lookup):
    out = []
    for term in text.split(','):
        term = term.strip()
        if not term:
            continue
        match = re.match(r'^(.*?)(?:\*(\d+))?(?:\(.*\))?$', term)
        name, count = match[1].strip(), int(match[2] or 1)
        if name in lookup:
            out.append({'unit': lookup[name], 'count': count})
    return out

class Media:
    def __init__(self, enabled=True):
        self.enabled, self.sprites, self.sounds, self.issues = enabled, [], [], []
        self.images, self.audio = {}, {}
        self.sheet_cache = {}
        self.music=[]

    def path(self, entry, section, key):
        # Resolve inherited relative paths at their defining file.
        ini = entry['ini']
        origin = ini.origins.get(section, {}).get(key) or str(RW / entry['source'])
        return resolve(ini.get(section, {}).get(key), Path(origin).parent)

    def sheet(self, entry, section, key, sheet_key, scale, frames=1, rotated=True, fps=0):
        if len(sheet_key.split('.')[-1])>40 or not re.fullmatch(r'[a-z]+\.[a-z0-9_-]+',sheet_key):
            sheet_key=sheet_key.split('.')[0]+'.naval-warfare-'+hashlib.sha256(sheet_key.encode()).hexdigest()[:18]
        path = self.path(entry, section, key)
        ref = entry['ini'].get(section, {}).get(key, '')
        if not path:
            if ref and ref.lower() not in ('none', 'auto') and not ref.upper().startswith('SHADOW:'):
                self.issues.append({'unit': entry['rwName'], 'field': section + '.' + key, 'source': ref, 'issue': 'Missing source image'})
            return None
        im = Image.open(path).convert('RGBA')
        frames = max(1, min(64, frames))
        frame_w = im.width // frames
        frame_h = im.height
        if frame_w * frames != im.width:
            frames = 1
            frame_w = im.width
        # Keep original pixels; only the declared world size changes. Do not
        # regenerate or replace source artwork, or remove its transparency.
        factor = scale * WORLD / (DISPLAY if rotated else 1)
        width, height = frame_w * factor, frame_h * factor
        correction = max(1, 4 / max(.001, width), 4 / max(.001, height))
        correction = min(correction, 512 / max(width, height, .001))
        fw, fh = max(4, round(width * correction)), max(4, round(height * correction))
        fw, fh = min(512, fw), min(512, fh)
        identity=(hashlib.sha256(im.tobytes()).hexdigest(), im.size, frames, fw, fh, rotated, fps)
        if identity in self.sheet_cache:
            return self.sheet_cache[identity]
        self.sheet_cache[identity]=sheet_key
        file = 'sprites/' + sheet_key + '.png'
        sheet = {'key': sheet_key, 'file': file, 'frames': frames, 'fw': fw, 'fh': fh, 'rotated': rotated,
                 'teams': False, 'stripBg': False, 'stabilize': False}
        if fps:
            sheet['fps'] = min(60, fps)
        if self.enabled:
            im.save(HERE / file, optimize=True)
        self.sprites.append(sheet)
        self.images[sheet_key] = {'source': path.relative_to(RW).as_posix(), 'scale': scale, 'sourceFrame': [frame_w, frame_h],
                                  'displayFrame': [fw, fh], 'minimumSizeFactor': round(correction, 5)}
        return sheet_key

    def sound(self, entry, section, key):
        ref = entry['ini'].get(section, {}).get(key, '')
        if not ref:
            return None
        # Several source sound fields include a gain suffix.
        plain = re.sub(r':[-\d.]+$', '', ref)
        origin = entry['ini'].origins.get(section, {}).get(key) or str(RW / entry['source'])
        path = resolve(plain, Path(origin).parent)
        if not path:
            return None  # RW built-in sounds use the corresponding native class.
        digest = hashlib.sha256(path.read_bytes()).hexdigest()[:14]
        name = 'naval-warfare-' + digest
        if name not in self.audio:
            file = 'sounds/' + name + '.mp3'
            if self.enabled:
                subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(path), '-ac', '1', '-ar', '44100', '-b:a', '96k', str(HERE / file)], check=True)
            self.sounds.append({'key': name, 'file': file})
            self.audio[name] = path.relative_to(RW).as_posix()
        return name

    def body(self, entry, definition):
        g = entry['ini'].get('graphics', {})
        frames = int(num(g.get('total_frames'), 1))
        path = self.path(entry, 'graphics', 'image')
        scale = num(g.get('imageScale'), 1)
        if path and g.get('scaleImagesTo'):
            scale = num(g['scaleImagesTo']) / max(1, Image.open(path).width / frames)
        building = definition['kind'] == 'building'
        building_factor = 1
        if building and path:
            with Image.open(path) as im:
                building_factor = building_size(entry, definition, im.width / frames * scale * WORLD, im.height * scale * WORLD)
            scale *= building_factor
        key = self.sheet(entry, 'graphics', 'image', 'u.' + entry['id'], scale, frames, not building,
                         60 / max(1, num(g.get('animation_idle_speed'), 10)) if frames > 1 else 0)
        if key:
            definition['sprite'] = key
            if building:
                # Explicit anchor keeps the source artwork centered on its footprint.
                sheet=next(s for s in self.sprites if s['key']==key)
                sheet['anchorY'] = round(sheet['fh'] / 2)
                # Preserve source coordinates for turrets and arms; automatic
                # content fitting would move/resize the body independently.
                if building_factor > 1:
                    sheet['fitFootprint'] = False
                self.images[key]['buildingScaleFactor'] = round(building_factor, 5)
        return scale, building_factor

    def music_tracks(self):
        # The source explicitly chooses -MUSIC-; do not import unrelated audio.
        folder=HERE/'music'
        if self.enabled:folder.mkdir(exist_ok=True)
        for i,path in enumerate(sorted((RW/'-MUSIC-').iterdir())):
            if path.suffix.lower() not in ('.mp3','.ogg','.wav'):continue
            track='naval-warfare-track-'+str(i+1)
            file='music/'+track+'.mp3'
            if self.enabled:subprocess.run(['ffmpeg','-v','error','-y','-i',str(path),'-ar','44100','-b:a','128k',str(HERE/file)],check=True)
            self.music.append({'id':track,'file':file})

def weapon(entry, sec, turret, media):
    ini = entry['ini']; attack = ini.get('attack', {})
    projectile = ini.get('projectile_' + turret.get('projectile', '1'))
    if not projectile or yes(turret.get('canShoot')) is False and turret.get('canShoot') is not None:
        return None
    if not yes(attack.get('canAttack'), True):
        return None
    p = projectile
    targets = []
    if yes(turret.get('canAttackFlyingUnits', attack.get('canAttackFlyingUnits')), True):
        targets.append('air')
    if yes(turret.get('canAttackLandUnits', attack.get('canAttackLandUnits')), True):
        targets += ['ground', 'ship']
    if yes(turret.get('canAttackUnderwaterUnits', attack.get('canAttackUnderwaterUnits'))):
        targets.append('sub')
    if not yes(turret.get('canAttackNotTouchingWaterUnits', attack.get('canAttackNotTouchingWaterUnits')), True):
        targets = [t for t in targets if t not in ('ground', 'air')]
    if not targets:
        return None
    pr = turret.get('projectile', '1')
    tag = (sec + ' ' + str(p.get('tags', '')) + ' ' + str(p.get('image', ''))).lower()
    missile = any(s in tag for s in ('missile', 'rim-', 'atgm', 'rocket', 'harpoon')) or yes(p.get('trailEffect'))
    torpedo = 'torp' in tag or targets == ['sub']
    bomb = 'bomb' in tag and not missile
    cls = 'torpedo' if torpedo else 'aa' if targets == ['air'] else 'rocket' if missile else 'he' if num(p.get('areaRadius')) > 30 else 'cannon'
    kind = 'torpedo' if torpedo else 'bomb' if bomb else 'missile' if missile else 'shell'
    range_ = num(turret.get('limitingRange', attack.get('maxAttackRange')), 150) * WORLD / 32
    if range_ > 2000:
        range_ = 2000  # source silo's effectively global 99,999,999 range
    reload_ = seconds(turret.get('delay', attack.get('shootDelay')), 1)
    direct, area = num(p.get('directDamage')), num(p.get('areaDamage'))
    native = {'id': sec.removeprefix('turret_'), 'cls': cls, 'projectile': kind, 'dmg': min(100000, direct if direct else area),
              'reload': min(600, max(.05, reload_)), 'range': min(64, max(.5, range_)), 'targets': targets,
              'speed': min(5000, max(1, num(p.get('speed'), 5) * 60 * WORLD)),
              'turret': True, 'homing': not yes(p.get('targetGround')) and not bomb,
              'arc': yes(p.get('ballistic')), 'interceptable': num(p.get('deflectionPower'), 1) >= 0,
              'splash': min(500, num(p.get('areaRadius')) * WORLD),
              'mult': {a: 1 for a in ('light', 'medium', 'heavy', 'ship', 'sub', 'air', 'structure')}}
    if turret.get('limitingMinRange'):
        native['minRange'] = min(native['range']-.001, num(turret['limitingMinRange']) * WORLD / 32)
    sound = media.sound(entry, sec, 'shoot_sound')
    if sound:
        native['sound'] = sound
    look = {'trail': 'none' if str(p.get('trailEffect', '')).lower() in ('false', '', 'none') else 'smoke'}
    if str(turret.get('shoot_flame', '')).lower() == 'none':
        look['muzzle'] = 'none'
    if not yes(p.get('invisible')):
        image = media.path(entry, 'projectile_' + pr, 'image')
        if image:
            key = 'prj.' + entry['id'] + '-' + native['id']
            key = media.sheet(entry, 'projectile_' + pr, 'image', key, num(p.get('drawSize'), 1), rotated=True)
            if key:
                look['sprite'] = key
    if yes(p.get('laserEffect')) or yes(p.get('lightingEffect')):
        look['beam'] = {'color': '#ff4545', 'width': 1.5, 'style': 'lightning' if yes(p.get('lightingEffect')) else 'laser', 'life': .15}
    native['look'] = look
    costs = resource(turret.get('resourceUsage'))
    if turret.get('energyUsage'):
        costs['energy'] = num(turret['energyUsage'])
    mutators = []
    for key, value in p.items():
        if key.endswith('_ifUnitWithTags'):
            prefix = key.removesuffix('_ifUnitWithTags')
            mutators.append({'tags': [t.strip() for t in value.split(',') if t.strip()],
                             'direct': num(p.get(prefix + '_directDamageMultiplier'), 1), 'area': num(p.get(prefix + '_areaDamageMultiplier'), 1)})
    return {'id': native['id'], 'mount': native['id'], 'weapon': native,
            'range': range_, 'minRange':num(turret.get('limitingMinRange'))*WORLD/32, 'reload': max(1 / 60, reload_), 'warmup': seconds(turret.get('warmup')),
            'costs': costs, 'direct': direct * num(attack.get('shootDamageMultiplier'), 1),
            'area': area * num(attack.get('shootDamageMultiplier'), 1), 'radius': num(p.get('areaRadius')) * WORLD,
            'ignoreArmor': num(p.get('armourIgnoreAmount')), 'buildingMult': num(p.get('buildingDamageMultiplier'), 1),
            'shieldMult': num(p.get('shieldDamageMultiplier'), 1), 'mutators': mutators,
            'life': seconds(p.get('life'), 10), 'targetSpeed': num(p.get('targetSpeed', p.get('speed')), 5) * 60 * WORLD,
            'acceleration': num(p.get('targetSpeedAcceleration')) * 3600 * WORLD,
            'turnSpeed': num(p.get('turnSpeed'), 180) * math.pi / 3,
            'spread': num(p.get('targetGroundSpread')) * WORLD, 'intercept': [t.strip() for t in turret.get('interceptProjectiles_withTags', '').split(',') if t.strip()],
            'tags': [t.strip() for t in p.get('tags', '').split(',') if t.strip()],
            'nuclear': yes(p.get('nukeWeapon')), 'friendlyFire': yes(p.get('friendlyFire')), 'bothLayers': yes(p.get('areaHitAirAndLandAtSameTime')),
            'noFalloff': yes(p.get('areaDamageNoFalloff')), 'linked': turret.get('linkDelayWithTurret', ''),
            'muzzle': max(0, num(turret.get('barrelY', turret.get('size', attack.get('turretSize'))))) * WORLD,
            'lateral': num(turret.get('barrelX')) * WORLD,
            'manual': not yes(turret.get('canShoot'), True),
            'requiredTags':[t.strip() for t in turret.get('canOnlyAttackUnitsWithTags','').split(',') if t.strip()],
            'condition': turret.get('canAttackCondition', '')}

def config(entry, definition, scale, media, lookup, building_factor=1):
    ini = entry['ini']; core = ini['core']; g = ini.get('graphics', {})
    geometry = WORLD * building_factor
    mounts, guns, actions, notes = [], [], [], []
    for sec, turret in ini.items():
        if not sec.startswith('turret_'):
            continue
        mount_id = sec.removeprefix('turret_')
        mount = {'id': mount_id, 'x': num(turret.get('x')) * geometry, 'y': -num(turret.get('y')) * geometry,
                 'parent': turret.get('attachedTo', ''), 'slave': yes(turret.get('slave')),
                 'rest': num(turret.get('idleDir')) * math.pi / 180, 'arc': num(turret.get('limitingAngle'), 180) * math.pi / 180,
                 'turn': num(turret.get('turnSpeed', ini.get('attack', {}).get('turretTurnSpeed')), 4) * math.pi / 3,
                 'spin': num(turret.get('idleSpin')) * math.pi / 3,
                 'recoil':num(turret.get('recoilOffset'))*geometry,'recoilOut':seconds(turret.get('recoilOutTime')),
                 'recoilReturn':seconds(turret.get('recoilReturnTime'),.2)}
        if not yes(turret.get('invisible')):
            image_key = 'image' if turret.get('image') else 'image_turret'
            section = sec if turret.get('image') else 'graphics'
            path = media.path(entry, section, image_key)
            if path:
                turret_scale = num(g.get('turretImageScale', g.get('imageScale')), 1)
                if g.get('scaleTurretImagesTo'):
                    turret_scale = num(g['scaleTurretImagesTo']) / max(1, Image.open(path).width)
                sprite = media.sheet(entry, section, image_key, 'dec.' + entry['id'] + '-mount-' + mount_id, turret_scale * building_factor)
                if sprite:
                    mount['sprite'] = sprite
        mounts.append(mount)
        gun = weapon(entry, sec, turret, media)
        if gun:
            guns.append(gun)
    # Authored arms include rotor disks, spinning radar dishes and fixed gear.
    # Their source pixels and offsets survive; walking IK remains uncompiled.
    for sec,arm in ini.items():
        if not sec.startswith('arm_') or not arm.get('image_end'):continue
        sprite=media.sheet(entry,sec,'image_end','dec.'+entry['id']+'-'+sec.replace('_','-'),scale)
        if sprite:
            mounts.append({'id':sec,'x':num(arm.get('x'))*geometry,'y':-num(arm.get('y'))*geometry,
                           'parent':'','slave':False,'rest':num(arm.get('drawDirOffset'))*math.pi/180,'arc':math.pi,
                           'turn':0,'spin':num(arm.get('spinRate'))*math.pi/3,'sprite':sprite,'recoil':0,'recoilOut':0,'recoilReturn':0})
    # Manual silos/ICBM turrets have canShoot:false: compile them explicitly.
    for sec, action in ini.items():
        if not sec.startswith(('action_', 'hiddenAction_')):
            continue
        if sec.startswith('hiddenAction_'):
            continue
        text = action.get('text', sec.removeprefix('action_'))
        a = {'id': sec, 'name': [text, text, text], 'time': seconds(action.get('buildSpeed'), 0, True),
             'cost': max(0, metal(resource(action.get('price')))), 'cooldown': seconds(action.get('addActionCooldownTime')),
             'canCancel':yes(action.get('canPlayerCancel'),True), 'queue':yes(action.get('allowMultipleInQueue'))}
        if action.get('convertTo') in lookup:
            # Native rules preserve selection, health share, orders and cooldowns.
            target = lookup[action['convertTo']]
            label = action.get('text', 'Change form')
            if target!=definition['id']:
                definition.setdefault('rules', []).append({'button': {'name': [label, label, label], 'time': min(3600, a['time'])}, 'do': {'morph': target}})
            elif core['name'].startswith('Nuclear_factory'):
                a['coolReactor']=True
                actions.append(a)
        elif action.get('addUnitsIntoTransport'):
            batch = split_units(action['addUnitsIntoTransport'], lookup)
            if batch:
                auto_unload=action.get('alsoTriggerAction')=='unloadAuto' or any(yes(v.get('forceUnloadTransportNow')) and v.get('autoTrigger')=='true' for v in ini.values())
                a.update(spawns=batch, into=not auto_unload)
                actions.append(a)
        elif action.get('fireTurretXAtGround'):
            tur_name = action['fireTurretXAtGround']
            sec_t = 'turret_' + tur_name
            turret = ini.get(sec_t)
            if not turret:
                sec_t = next((s for s in ini if s.lower() == sec_t.lower()), sec_t)
                turret = ini.get(sec_t)
            if turret:
                manual = deepcopy(turret); manual['canShoot'] = 'true'
                gun = weapon(entry, sec_t, manual, media)
                if gun:
                    gun['manual'] = True
                    if not any(w['id'] == gun['id'] for w in guns):
                        guns.append(gun)
                    a.update(gun=gun['id'], stocks=resource(action.get('price')))
                    a['stocks'] = {k:v for k,v in a['stocks'].items() if k not in ('credits','oil','steel')}
                    actions.append(a)
        elif action.get('addResources'):
            delta = resource(action['addResources'])
            a.update(gain=metal(delta), stocks={k:v for k,v in resource(action.get('price')).items() if k not in ('credits','oil','steel')},
                     addStocks={k:v for k,v in delta.items() if k not in ('credits','oil','steel')})
            actions.append(a)
        elif action.get('clearActiveWaypoint'):
            a['clearOrders'] = True; actions.append(a)
        if action.get('isVisible') == 'false':
            actions = [a2 for a2 in actions if a2['id'] != sec]
    initial, rearm, start_cargo = {}, [], []
    for sec, act in ini.items():
        if not sec.startswith(('action_', 'hiddenAction_')):
            continue
        if act.get('autoTriggerOnEvent', '').lower() == 'created':
            for k, v in resource(act.get('addResources')).items():
                if k not in ('credits','oil','steel'):
                    initial[k] = initial.get(k, 0) + v
            if act.get('resourceAmount') and act.get('resourceAmount_setValue'):
                initial[act['resourceAmount'].lower()]=num(act['resourceAmount_setValue'])
            start_cargo += split_units(act.get('addUnitsIntoTransport',''), lookup)
        if act.get('resourceAmount') and act.get('resourceAmount_setValue'):
            condition = act.get('autoTrigger', '')
            tag = re.search(r'withTag=[\'"]([^\'"]+)', condition)
            distance = re.search(r'withinRange=([\d.]+)', condition)
            if tag and distance:
                rearm.append({'stock': act['resourceAmount'].lower(), 'amount': num(act['resourceAmount_setValue']), 'tag': tag[1], 'range': num(distance[1]) * WORLD})
    cfg = {'tags': [t.strip() for t in core.get('tags', '').split(',') if t.strip()],
           'armor': num(core.get('armour')), 'minDamage': num(core.get('armourMinDamageToKeep'), 1),
           'mounts': mounts, 'guns': guns, 'actions': actions, 'initial': initial, 'rearm': rearm,
           'energyMax': num(core.get('energyMax')), 'energyRegen': num(core.get('energyRegen')) * 60,
           'energyStart': min(1, max(0, num(core.get('energyStartingPercentage'), 1))),
           'fullRecharge': yes(core.get('energyNeedsToRechargeToFull')),
           'startCargo': start_cargo, 'airCargo': 'AIR' in core.get('transportUnitsRequireMovementType','').upper(),
           'capacity':num(core.get('maxTransportingUnits')), 'dieOnZeroEnergy':yes(core.get('dieOnZeroEnergy')),
           'cargoHeal': num(core.get('transportUnitsHealBy')) * 60,
           'regen': num(core.get('selfRegenRate')) * 60}
    for gun in guns:
        gun['muzzle'] *= building_factor
        gun['lateral'] *= building_factor
    cfg['attachments']=[{'x':num(a.get('x'))*geometry,'y':-num(a.get('y'))*geometry,'angle':num(a.get('idleDir'))*math.pi/180}
                        for s,a in ini.items() if s.startswith('attachment_') and yes(a.get('addTransportedUnits')) and yes(a.get('isVisible'),True)]
    wreck=media.sheet(entry,'graphics','image_wreak','dec.'+entry['id']+'-wreck',scale,rotated=False)
    if wreck:cfg['wreck']=wreck
    if core.get('energyRegenWhenRecharging'):
        cfg['rechargingRegen'] = num(core['energyRegenWhenRecharging']) * 60
    if yes(core.get('nukeOnDeath')):
        cfg['deathBlast'] = {'damage': num(core.get('nukeOnDeathDamage')), 'radius': num(core.get('nukeOnDeathRange')) * WORLD}
    if core.get('name','').startswith('Nuclear_factory'):
        cfg['reactor'] = True
        cfg['reactorForms'] = [lookup['Nuclear_factory'+suffix] for suffix in ('','1','2','3')]
        cfg['cooling'] = core['name'].startswith('Nuclear_factoryC')
        cfg['transitions']=[]
        for s, a in ini.items():
            if not s.startswith('hiddenAction_') or a.get('convertTo') not in lookup:continue
            match=re.fullmatch(r'if self.energy\((lessThan|greaterThan)=([\d.]+)\)',a.get('autoTrigger',''),flags=re.I)
            if match:cfg['transitions'].append({'above':match[1].lower()=='greaterthan','threshold':num(match[2]),'to':lookup[a['convertTo']]})
        for a in actions:
            original=ini.get(a['id'],{})
            if original.get('whenBuilding_temporarilyConvertTo') in lookup:
                a['temporaryMorph']=lookup[original['whenBuilding_temporarilyConvertTo']]
                a['returnMorph']=lookup[original['convertTo']]
    return cfg

def main():
    entries = load()
    write('source-inventory.json', entries)
    selected = [e for e in entries if e['rwName'] not in EXCLUDED and not yes(e['ini']['core'].get('dont_load'))]
    lookup = {e['rwName']: e['id'] for e in selected}
    media = Media('--no-media' not in sys.argv)
    localization = json.loads((HERE / 'localization.json').read_text())
    defs, records = [], []
    for e in selected:
        ini, name = e['ini'], e['rwName']; c, mv = ini['core'], ini.get('movement', {})
        building = yes(c.get('isBuilding'))
        domain = {'AIR':'air','WATER':'ship','HOVER':'amphibious','OVER_CLIFF_WATER':'amphibious'}.get(mv.get('movementType','').upper(), 'ground')
        title = c.get('displayText') or localization['names'].get(name, {}).get('en') or name
        name_text = localization['names'].get(name, {'en':title,'zh':title,'ko':title})
        original_desc = strings(c.get('displayDescription',''))
        desc = localization['descriptions'][c.get('displayDescription','')]
        d = {'id': e['id'], 'name': [name_text['en'],name_text['zh'],name_text['ko']], 'desc': desc,
             'kind': 'building' if building else 'unit', 'cost': max(0, min(99999, metal(resource(c.get('price'))))),
             'hp': num(c.get('maxHp'), 100), 'buildTime': min(3600, max(0, seconds(c.get('buildSpeed'), 10, True))),
             'power': 0, 'pop': 0 if building else 1, 'tier': min(3, max(1, int(num(c.get('techLevel'), 1)))),
             'vision': min(64, max(1, num(c.get('fogOfWarSightRange'), 15) * 20 * WORLD / 32)), 'weapons': []}
        if building:
            f = [num(v) for v in c.get('footprint','-1,-1,1,1').split(',')]
            d.update(fw=min(8,max(1,math.ceil((f[2]-f[0]+1)*20*WORLD/32))), fh=min(8,max(1,math.ceil((f[3]-f[1]+1)*20*WORLD/32))), builtBy=[])
            d['needsDeposit'] = yes(c.get('placeOnlyOnResPool'))
            if mv.get('movementType','').upper() == 'WATER':
                d['offshore'] = True
            if name.startswith('Nuclear_factory'):
                d.update(fw=4,fh=3)
            if yes(c.get('isBuilder')):
                d.update(repairRange=num(c.get('nanoRange'),100)*WORLD/32,repairRate=60*num(c.get('nanoBuildSpeed'),1),repairTargets=1)
        else:
            d.update(domain=domain, speed=min(1000,num(mv.get('moveSpeed'))*60*WORLD),
                     turnRate=min(50,num(mv.get('maxTurnSpeed'), 3)*math.pi/3), radius=max(1,min(200,num(c.get('radius'),10)*WORLD)),
                     trail='none' if domain in ('air','amphibious') else 'wake' if domain=='ship' else 'tread',
                     producedBy=[], aiWeight=1, cargoWeight=max(1,min(50,num(c.get('transportSlotsNeeded'),1))))
            if yes(c.get('isBuilder')):
                d.update(builds=[],buildRate=60*num(c.get('nanoBuildSpeed'),1),reach=min(256,num(c.get('nanoRange'),100)*WORLD))
            if domain == 'air':
                heli = 'heli' in e['source'].lower() or name in ('Z-8','ka-29A','Ka-50','Ka-52','UH-60','AW-159','T129','AH1ZPH','Mi-17','Mi-24')
                d.update(hovers=heli, lowFlying=heli, altitude=min(64,max(0,num(mv.get('targetHeight'),20)*WORLD)))
            if num(mv.get('targetHeight')) < -1:
                d.update(underwater=True, shadow=False, armor='sub')
            cap = int(num(c.get('maxTransportingUnits')))
            if cap:
                d.update(transportCap=min(50,cap), transportMaxWeight=min(50,cap))
                if domain=='air':
                    d['landsForCargo'] = True
        if num(c.get('maxShield')) > 0:
            d['shield'] = {'hp': num(c['maxShield']), 'regen': max(0,num(c.get('shieldRegen'))*60), 'delay':0}
        scale, building_factor = media.body(e,d)
        cfg = config(e,d,scale,media,lookup,building_factor)
        if any('sub' in w['weapon']['targets'] for w in cfg['guns']):
            # Source has no independent sonar mechanic; submarine hunters must see their targets.
            if not building:
                d['sonar'] = min(64,max(1,max(w['range'] for w in cfg['guns'] if 'sub' in w['weapon']['targets'])))
        d['weapons'] = [deepcopy(w['weapon']) for w in cfg['guns'] if not w['manual']][:8]
        if cfg.get('airCargo'):
            for a in cfg['actions']:
                if a.get('spawns'):
                    a['name'] = localization['actions'].get(a['name'][0], a['name'])
        for a in cfg['actions']:
            a['name'] = localization['actions'].get(a['name'][0], a['name'])
        for rule in d.get('rules',[]):
            rule['button']['name'] = localization['actions'].get(rule['button']['name'][0],rule['button']['name'])
        # Persistent income is converted at exactly the same exchange rates as costs.
        income = resource(c.get('generation_resources'))
        if c.get('generation_credits'):
            income['credits'] = num(c['generation_credits'])
        if income:
            d['metalRate'] = max(0,min(1000,metal(income) / max(1/60,seconds(c.get('generation_delay'), 1))))
        d['extensions'] = {CAP: cfg}
        round_definition_stats(d)
        if not original_desc:
            d['desc']=''
        defs.append(d)
        records.append({'source':e['source'], 'rwName':name, 'id':d['id'], 'status':'ported', 'sourcePrice':resource(c.get('price')),
                        'metalPrice':d['cost'], 'sourceVision':num(c.get('fogOfWarSightRange'),15), 'vision':d['vision'],
                        'guns':len(cfg['guns']), 'nativeHudWeapons':len(d['weapons']), 'mounts':len(cfg['mounts']),
                        'sourceActions':[{'id':s,'fields':a} for s,a in ini.items() if s.startswith(('action_','hiddenAction_'))]})
    by_id = {d['id']:d for d in defs}
    for d in defs:
        for a in d['extensions'][CAP]['actions']:
            if a.get('spawns'):a['spawnNames']=[by_id[s['unit']]['name'] for s in a['spawns']]
    # Retain all explicit source production edges, including cross-national aircraft.
    edges = set()
    for e in selected:
        for sec, value in e['ini'].items():
            if sec.startswith('canBuild_'):
                for u in split_units(value.get('name',''),lookup):
                    child=by_id[u['unit']]
                    if child['kind']=='unit': edges.add((e['id'],u['unit']))
                    elif yes(e['ini']['core'].get('isBuilder')):
                        parent=by_id[e['id']]
                        if parent['kind']=='unit':
                            parent['builds']=sorted(set(parent.get('builds',[])+[child['id']]))
                            child['builtBy']=sorted(set(child.get('builtBy',[])+[parent['id']]))
                            cfg=parent['extensions'][CAP]
                            cfg.setdefault('construction',[]).append({'unit':child['id'],'name':child['name'],'cost':child['cost'],'time':child['buildTime']})
                            cfg.update(buildRange=num(e['ini']['core'].get('nanoRange'),100)*WORLD,mobileBuilder=True)
                        else:
                            cfg=parent['extensions'][CAP]
                            work={'unit':child['id'],'name':child['name'],'cost':child['cost'],'time':child['buildTime']/max(.001,num(e['ini']['core'].get('nanoBuildSpeed'),1))}
                            round_stats(work, ('cost', 'time'))
                            cfg.setdefault('construction',[]).append(work)
                            cfg['buildRange']=num(e['ini']['core'].get('nanoRange'),100)*WORLD
    # Recruitment into a hangar stays a timed batch action. Native queues are
    # only added for explicit canBuild relations, never guessed vanilla factories.
    for parent, child in sorted(edges):
        c = by_id[child]
        if c['kind']=='unit' and by_id[parent]['kind']=='building':
            c['producedBy'] = sorted(set(c.get('producedBy',[])+[parent]))
            by_id[parent]['produces'] = sorted(set(by_id[parent].get('produces',[])+[child]))
    factions=[]
    common = {e['id'] for e in selected if not e['source'].startswith('Factions/') or e['source'].startswith('Factions/units/')}
    # Attach neutral helipads only to their own national roster.
    pads={'us':'Helipad  US','ru':'Helipad RU','jp':'Helipad JSDF','cn':'Helipad PLA','ph':'Helipad  AFP'}
    all_pads={lookup[x] for x in pads.values()}
    common -= all_pads
    for code,(folder,hq,factory,title) in NATIONS.items():
        national={e['id'] for e in selected if e['source'].startswith('Factions/'+folder+'/')}
        national |= common | {lookup[pads[code]]}
        # Explicit source build/spawn/morph dependencies close the roster.
        for _ in range(10):
            before=len(national)
            for id_ in list(national):
                d=by_id[id_]
                national.update(d.get('produces',[]))
                national.update(d.get('builds',[]))
                national.update(a['unit'] for a in d['extensions'][CAP].get('construction',[]))
                for a in d['extensions'][CAP]['actions']:
                    national.update(s['unit'] for s in a.get('spawns',[]))
                for r in d.get('rules',[]): national.add(r['do']['morph'])
            if len(national)==before:break
        bid=lookup['Excavator '+{'us':'US','ru':'RU','jp':'JP','cn':'CH','ph':'AFP'}[code]]
        b=by_id[bid]
        # Setup factions require the starting builder to reconstruct their HQ.
        # This one native integration edge supplements the original build lists.
        b['builds']=sorted(set(b.get('builds',[])+[lookup[hq]]))
        by_id[lookup[hq]]['builtBy']=sorted(set(by_id[lookup[hq]].get('builtBy',[])+[bid]))
        for p in (hq,factory):
            by_id[lookup[p]]['produces']=sorted(set(by_id[lookup[p]].get('produces',[])+[bid]))
        by_id[lookup[hq]]['isHQ']=True
        national.add(bid)
        factions.append({'id':'naval-warfare-'+code,'name':['Naval Warfare — '+title[0],'海战 — '+title[1],'해전 — '+title[2]],
                         'headquarters':lookup[hq],'builder':bid,'roster':sorted(national)})
    # Source factories also contain native batch recruitment actions, so their
    # land roster is reachable without adding invented build lists.
    for e in entries:
        if e['rwName'] not in lookup:
            records.append({'source':e['source'],'rwName':e['rwName'],'id':e['id'],'status':'omitted','reason':EXCLUDED.get(e['rwName'],'Source dont_load template')})
    spawned={s['unit'] for d in defs for a in d.get('extensions',{}).get(CAP,{}).get('actions',[]) for s in a.get('spawns',[])}
    spawned|={s['unit'] for d in defs for s in d.get('extensions',{}).get(CAP,{}).get('startCargo',[])}
    forms={r['do']['morph'] for d in defs for r in d.get('rules',[])}
    forms|={f for d in defs for f in d.get('extensions',{}).get(CAP,{}).get('reactorForms',[])}
    for r in records:
        if r['status']!='ported':continue
        d=by_id[r['id']]
        r['availability']='building' if d['kind']=='building' else 'native production' if d.get('producedBy') else 'package recruitment' if d['id'] in spawned else 'alternate form' if d['id'] in forms else 'sandbox only (no source roster producer)'
    package=json.loads((HERE/'extensions/naval-systems/extension.json').read_text())
    media.music_tracks()
    manifest={'format':'steel-tide-mod','v':4,'capacity':'large','id':'naval-warfare',
              'name':'Naval Warfare',
              'version':'0.1.2','author':'Naval Warfare original creators',
              'description':localization['modDescription'], 'license':'LicenseRef-Naval-Warfare-Upstream', 'minGame':'0.8.16',
              'requiredCapabilities':[CAP],'extensionPackages':[package],'defs':defs,'factions':factions,
              'sprites':media.sprites,'sounds':media.sounds,
              'screenshots':['screenshots/cover.png','screenshots/carrier-operations.jpg','screenshots/fleet.jpg','screenshots/construction.jpg',
                             'screenshots/naval-engagement.jpg','screenshots/harbor-base.jpg'],
              'music':{'tracks':media.music,'battle':[t['id'] for t in media.music]},
              'maps':['maps/naval-review.steel-tide-map']}
    write('mod.json',manifest)
    write('conversion-report.json',{'sourceTitle':'NW (NAVAL WARFARE)0.10.1J(UNBalance)The conventional version',
          'coordinateScale':WORLD,'exchange':{'creditMetal':CREDIT,'oilCredits':OIL,'steelCredits':STEEL},
          'entries':records,'mediaIssues':media.issues,'images':media.images,'sounds':media.audio,
          'summary':{'sourceUnits':len(entries),'portedSourceUnits':len(selected),'adaptedBuilders':0,'defs':len(defs),'factions':len(factions),'guns':sum(len(d.get('extensions',{}).get(CAP,{}).get('guns',[])) for d in defs)}})
    print(json.dumps({'defs':len(defs),'sprites':len(media.sprites),'sounds':len(media.sounds),'mediaIssues':len(media.issues)}))

if __name__=='__main__':
    main()

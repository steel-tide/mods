#!/usr/bin/env python3
"""Deterministic local conversion of EK Definitive Edition 2026h50.
RW configuration is read as data. All executable behavior lives in this mod.
"""
from pathlib import Path
from collections import Counter
from copy import deepcopy
import hashlib
import json
import math
import re
import sys
import subprocess
from PIL import Image
from rw import HERE, RW, load_unit, parse, resolve, num, slug
from logic import compile_expr, Unsupported, split_list

CAP = 'ek-definitive-edition.systems-v1'
WORLD = .75
DISPLAY = 1.5625
CREDIT = .1

def write(file, value):
    (HERE / file).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

def building_size(entry, definition, width, height):
    # Keep source aspect/geometry; raise compact buildings to their footprint.
    return max(1, min(definition['fw'] * 32 / max(1, width), 512 / max(1, width, height)))

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
    round_stats(definition, ('cost','hp','buildTime','vision','speed','turnRate','radius','repairRange','repairRate','buildRate','reach','cargoWeight','altitude','sonar'))
    for weapon in definition['weapons']:round_weapon_stats(weapon)

def yes(value, default=False):
    return str(value).strip().lower() in ('true', '1') if value is not None else default

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
    for term in split_list(value):
        m = re.match(r'\s*([\w]+)\s*[=:]\s*(-?[\d.]+)', term)
        if m:
            out[m[1].lower()] = float(m[2])
        elif re.fullmatch(r'-?[\d.]+',term.strip()):
            out['credits'] = out.get('credits', 0) + float(term)
    return out

def metal(resources):
    return round(CREDIT * resources.get('credits', 0), 4)

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
        entries.append({'source': str(path.relative_to(RW)) if path.is_relative_to(RW) else str(path.relative_to(HERE)), 'rwName': name, 'id': slug(name), 'ini': ini,
                        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'warnings': ini.warnings})
    assert len({e['id'] for e in entries}) == len(entries), 'source names must map to unique IDs'
    return entries

def split_units(text, lookup):
    out = []
    for term in split_list(text):
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
            sheet_key=sheet_key.split('.')[0]+'.ek-definitive-edition-'+hashlib.sha256(sheet_key.encode()).hexdigest()[:18]
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
        identity=(sheet_key.split('.')[0],hashlib.sha256(im.tobytes()).hexdigest(), im.size, frames, fw, fh, rotated, fps)
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
        self.images[sheet_key] = {'source': str(path.relative_to(RW)) if path.is_relative_to(RW) else str(path.relative_to(HERE)), 'scale': scale, 'sourceFrame': [frame_w, frame_h],
                                  'displayFrame': [fw, fh], 'minimumSizeFactor': round(correction, 5)}
        return sheet_key

    def sound(self, entry, section, key):
        ref=entry['ini'].get(section,{}).get(key,'').split(':')[0]
        source=HERE/'source-assets'/'sounds'/(ref+'.ogg')
        if not source.is_file():return None
        name='ek-definitive-edition-'+ref.replace('_','-')
        if name in self.audio:return name
        file='sounds/'+name+'.mp3'
        if self.enabled:
            (HERE/'sounds').mkdir(exist_ok=True)
            subprocess.run(['ffmpeg','-v','error','-y','-i',str(source),'-ac','1','-ar','44100','-b:a','96k',str(HERE/file)],check=True)
        self.sounds.append({'key':name,'file':file});self.audio[name]=str(source.relative_to(HERE));return name

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
            if not building and frames>1:
                sheet=next(s for s in self.sprites if s['key']==key)
                animations={}
                for source,target in [('moving','moving'),('idle','idle'),('attack','firing')]:
                    start=int(num(g.get('animation_'+source+'_start'),0));end=int(num(g.get('animation_'+source+'_end'),0))
                    if 0<=start<=end<frames and 'animation_'+source+'_end' in g:
                        animations[target]=[start,end,min(60,60/max(.01,num(g.get('animation_'+source+'_speed'),10)))]
                if animations:sheet['anims']=animations

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

def weapon(entry, sec, turret, media):
    ini = entry['ini']; attack = ini.get('attack', {})
    projectile = ini.get('projectile_' + turret.get('projectile', '1'))
    if not projectile:
        return None
    p = projectile
    targets = []
    if yes(turret.get('canAttackFlyingUnits', attack.get('canAttackFlyingUnits')), True) or str(turret.get('canAttackFlyingUnits',attack.get('canAttackFlyingUnits',''))).startswith('if '):
        targets.append('air')
    if yes(turret.get('canAttackLandUnits', attack.get('canAttackLandUnits')), True) or str(turret.get('canAttackLandUnits',attack.get('canAttackLandUnits',''))).startswith('if '):
        targets += ['ground', 'ship']
    if yes(turret.get('canAttackUnderwaterUnits', attack.get('canAttackUnderwaterUnits'))) or str(turret.get('canAttackUnderwaterUnits',attack.get('canAttackUnderwaterUnits',''))).startswith('if '):
        targets.append('sub')
    if not yes(turret.get('canAttackNotTouchingWaterUnits', attack.get('canAttackNotTouchingWaterUnits')), True):
        targets = [t for t in targets if t not in ('ground', 'air')]
    if not targets:
        targets = ['ground','ship']
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
            key = 'prj.' + entry['id'] + '-' + pr
            key = media.sheet(entry, 'projectile_' + pr, 'image', key, num(p.get('drawSize'), 1), rotated=True)
            if key:
                look['sprite'] = key
    if yes(p.get('instant')) or yes(p.get('laserEffect')) or yes(p.get('lightingEffect')) or p.get('beamImage'):
        look['beam'] = {'color': '#' + p.get('color', p.get('lightColor', '#ff4545')).lstrip('#')[-6:], 'width': 1.5, 'style': 'lightning' if yes(p.get('lightingEffect')) else 'laser', 'life': .15}
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
    return {'id': native['id'], 'mount': native['id'], 'projectileRef':pr, 'weapon': native,
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


GLOBAL_RESOURCES = {'experimental','msite','esite','eksef'}
REPORT = {'issues':[], 'entries':[], 'adaptations':[]}
LOCAL = {}
LOCAL_ZH = {}

def issue(entry, field, reason, category='port-gap'):
    REPORT['issues'].append({'source':entry['source'], 'unit':entry['rwName'], 'field':field, 'category':category, 'reason':reason})

def expression(entry, field, value, default=True):
    if value is None:return ['lit',default]
    try:return compile_expr(value)
    except Unsupported as ex:
        issue(entry,field,str(ex));return ['lit',False]

def texts(en,zh='',key=None):
    en,zh=strings(str(en)),strings(str(zh))
    return [en,zh or LOCAL_ZH.get(key or en,en),LOCAL.get(key or en,en)]

def resources(value):
    out=resource(value)
    # Flags are bit sets, not numerical stocks. Ranges such as 10-12 are inclusive.
    for key in ('setflag','unsetflag'):
        matches=re.findall(r'(?<!\w)'+key+r'\s*=\s*(\d+)(?:-(\d+))?',str(value or ''),re.I)
        if matches:out[key]=[v for a,b in matches for v in range(int(a),int(b or a)+1)]
    return out

def refs(entry,field,value,lookup):
    out=[]
    for term in split_list(value or ''):
        m=re.fullmatch(r'(.*?)(?:\*(\d+))?(?:\((.*)\))?',term)
        if not m:issue(entry,field,'Unparsed unit reference '+term);continue
        name=m[1].strip(); target=lookup.get(name)
        if not target:
            issue(entry,field,'Missing definition in supplied pack: '+name,'source-dependency');continue
        item={'unit':target,'count':int(m[2] or 1)}
        if m[3]:
            for option in split_list(m[3]):
                k,sep,v=option.partition('=')
                k=k.strip();v=v.strip()
                if k in ('offsetX','offsetY','offsetDir','offsetRandomX','offsetRandomY','offsetRandomDir'):
                    item[k]=num(v)*(WORLD if k!='offsetDir' else math.pi/180)
                    if k=='offsetRandomDir':item[k]=num(v)*math.pi/180
                elif k=='addResources':item['resources']=resources(v)
                elif k in ('spawnChance','maxSpawnLimit','transportedUnitsToTransfer'):item[k]=num(v)
                elif k.lower() in ('alwaysstartdiratzero','alwaystartdiratzero','gridalign','skipifoverlapping'):item[k.lower()]=yes(v)
                elif k=='spawnSource' and v=='self':pass
                elif k=='offsetHeight' and num(v)==0:pass
                else:
                    issue(entry,field,'Spawn parameter not compiled: '+option)
        out.append(item)
    return out

COSMETIC_ACTION = {'pos','displayType','iconImage','iconExtraImage','iconExtraColor','iconExtraIsVisible','isGuiBlinking','extraLagHidingInUI',
 'isAlsoViewableByAllies','textPostFix','textAddUnitName','text','text_zh','description','description_zh','descriptionAddFromUnit','descriptionAddUnitStats',
 'unitShownInUI','displayRemainingStockpile','showQuickWarLogToPlayer','showQuickWarLogToPlayer_zh','showMessageToAllPlayers','showMessageToAllPlayers_zh',
 'playSoundToPlayer','playSoundAtUnit','spawnEffects','playAnimation','stopLastAnimation','whenBuilding_playAnimation','whenBuilding_rotateTo',
 'whenBuilding_rotateTo_aimAtActionTarget','whenBuilding_rotateTo_waitTillRotated','isLockedMessage','isLockedMessage_zh','isLockedAltMessage','isLockedAltMessage_zh'}
ACTION_KEYS = {'price','buildSpeed','convertTo','addResources','addEnergy','resourceAmount','resourceAmount_setValue','resourceAmount_addOtherResource',
 'setResourcesWithLogic','clearAllWaypoints','clearActiveWaypoint','deleteSelf','produceUnits','spawnUnits','addUnitsIntoTransport','autoTrigger','autoTriggerOnEvent',
 'requireConditional','isVisible','isActive','isLocked','isLockedAlt','isLockedAlt2','canPlayerCancel','allowMultipleInQueue','alwaysSinglePress','onlyOneUnitAtATime',
 'highPriorityQueue','ai_isHighPriority','ai_isDisabled','whenBuilding_cannotMove','addActionCooldownTime','addActionCooldownApplyToActions','clearAllActionCooldowns',
 'temporarilyAddTags','temporarilyRemoveTags','alsoTriggerAction','alsoQueueAction','alsoTriggerOrQueueActionConditional','resetCustomTimer','fireTurretXAtGround',
 'fireTurretXAtGround_withProjectile','fireTurretXAtGround_withOffset','fireTurretXAtGround_onlyOverPassableTileOf','tags','startUnloadingTransport','setBuilt',
 'takeResources','takeResources_includeParent','takeResources_discardCollected','setUnitMemory','setBodyRotation','disconnectFromParent',
 'sendMessageTo','sendMessageWithTags','addWaypoint_maxTime','addWaypoint_type','addWaypoint_target_fromReference',
 'addWaypoint_target_nearestUnit_tagged','addWaypoint_target_nearestUnit_team','addWaypoint_position_randomOffsetFromSelf',
 'addWaypoint_position_relativeOffsetFromSelf','addWaypoint_prepend','attachments_addNewUnits','attachments_onlyOnSlots','whenBuilding_triggerAction',
 'takeResources_includeReference','takeResources_includeUnitsInTransport','takeResources_includeUnitsWithinRange','takeResources_includeUnitsWithinRange_team',
 'takeResources_excludeUnitsWithoutTags','takeResources_excludeUnitsWithTheseResources','takeResources_maxUnits'}

def action_config(entry, sec, a, cfg, definition, media, lookup):
    # Common EMP scripts have a single equivalent package implementation.
    if sec.startswith('hiddenAction_EMP_'):
        if sec!='hiddenAction_EMP_activate' or not a.get('addResources'):return None
        a={k:v for k,v in a.items() if k in ('addResources','autoTrigger')}
    rawname=a.get('text')
    target=a.get('convertTo')
    reference=a.get('textAddUnitName',a.get('descriptionAddFromUnit',a.get('unitShownInUI',target or '')))
    if not rawname and reference in SOURCE_BY_NAME:rawname=SOURCE_BY_NAME[reference]['ini']['core'].get('displayText',reference)
    rawname=rawname or sec.split('_',1)[1]
    zh=a.get('text_zh') or (SOURCE_BY_NAME.get(reference,{}).get('ini',{}).get('core',{}).get('displayText_zh',''))
    result={'id':sec,'name':texts(rawname,zh),'desc':texts(a.get('description',''),a.get('description_zh','')),
       'time':max(0,seconds(a.get('buildSpeed'),0,True)), 'cost':max(0,metal(resources(a.get('price')))),
       'stocks':{k:v for k,v in resources(a.get('price')).items() if k!='credits'},
       'cooldown':seconds(a.get('addActionCooldownTime')), 'canCancel':yes(a.get('canPlayerCancel'),True),
       'queue':yes(a.get('allowMultipleInQueue'),True) and not yes(a.get('alwaysSinglePress')),
       'lock':yes(a.get('whenBuilding_cannotMove')), 'ai':not yes(a.get('ai_isDisabled')), 'tag':a.get('tags','')}
    if a.get('whenBuilding_triggerAction'):result['onStart']=[v.strip() for v in a['whenBuilding_triggerAction'].split(',')]
    if a.get('fireTurretXAtGround_onlyOverPassableTileOf'):result['targetDomain']={'LAND':'ground','AIR':'air','WATER':'ship','HOVER':'amphibious','OVER_CLIFF':'ground'}.get(a['fireTurretXAtGround_onlyOverPassableTileOf'],'ground')
    for key in ('isVisible','isActive','isLocked','isLockedAlt','isLockedAlt2','requireConditional'):
        if key in a:result[key]=expression(entry,sec+'.'+key,a[key])
    if a.get('autoTrigger'):
        result['trigger']=expression(entry,sec+'.autoTrigger',a['autoTrigger'])
    if a.get('autoTriggerOnEvent'):
        event=a['autoTriggerOnEvent']
        match=re.fullmatch(r"(newMessage|queueItemAdded|queueItemCancelled)\(with(?:Action)?Tag='([^']+)'\)",event)
        if match:event=match[1];result['eventTag']=match[2]
        if event in ('created','destroyed','killedAnyUnit','tookDamage','teleported','enteredTransport','newWaypointGivenByPlayer','newMessage','queueItemAdded','queueItemCancelled'):
            result['event']=event
            if event=='newWaypointGivenByPlayer':issue(entry,sec+'.autoTriggerOnEvent','Native player-waypoint events do not reach this package action.','port-gap')
        else:issue(entry,sec+'.autoTriggerOnEvent','Uncompiled event: '+event);result['event']='unsupported'
    result['hidden']=sec.startswith('hiddenAction_')
    effects=[]
    delta=resources(a.get('addResources'))
    if a.get('addEnergy'):delta['energy']=num(a['addEnergy'])
    if delta:effects.append({'add':delta})
    if a.get('resourceAmount'):
        effects.append({'set':{a['resourceAmount'].lower():num(a.get('resourceAmount_setValue'))}})
    if a.get('setResourcesWithLogic'):
        values={}
        for assignment in split_list(a['setResourcesWithLogic']):
            k,_,v=assignment.partition('=');values[k.lower()]=expression(entry,sec+'.setResourcesWithLogic',v)
        effects.append({'logic':values})
    if a.get('setUnitMemory'):
        values={}
        for assignment in split_list(a['setUnitMemory']):
            k,_,v=assignment.partition('=');values[k.lower()]=expression(entry,sec+'.setUnitMemory',v)
        effects.append({'memory':values})
    for key,effect in [('clearAllWaypoints','clearOrders'),('clearActiveWaypoint','clearWaypoint'),('resetCustomTimer','resetTimer'),('clearAllActionCooldowns','clearCooldowns')]:
        if yes(a.get(key)):effects.append({effect:True})
    for key,effect in [('temporarilyAddTags','addTags'),('temporarilyRemoveTags','removeTags')]:
        if a.get(key):effects.append({effect:[s.strip() for s in a[key].split(',')]})
    for key in ('spawnUnits','produceUnits','addUnitsIntoTransport'):
        if a.get(key):
            batch=refs(entry,sec+'.'+key,a[key],lookup)
            if batch:effects.append({'spawn':batch,'into':key=='addUnitsIntoTransport' or key=='produceUnits' and yes(entry['ini']['core'].get('transportUnitsKeepBuiltUnits'))})
    if a.get('fireTurretXAtGround'):
        tid=a['fireTurretXAtGround'];ts='turret_'+tid;t=deepcopy(entry['ini'].get(ts,{}))
        if not t:issue(entry,sec,'Missing action turret '+tid)
        else:
            if a.get('fireTurretXAtGround_withProjectile'):t['projectile']=a['fireTurretXAtGround_withProjectile']
            gunid=tid if not a.get('fireTurretXAtGround_withProjectile') else tid+'@'+t['projectile']
            gun=next((g for g in cfg['guns'] if g['id']==gunid),None)
            if not gun:
                gun=weapon(entry,ts,t,media)
                if gun:
                    gun['id']=gunid;gun['weapon']['id']=gunid;gun['mount']=tid;gun['manual']=True
                    cfg['guns'].append(gun)
            if gun:
                effect={'fire':gunid}
                if a.get('fireTurretXAtGround_withOffset'):
                    effect['offset']=[num(v)*WORLD for v in a['fireTurretXAtGround_withOffset'].split(',')]
                else:result['target']='ground'
                effects.append(effect)
    for key,mode in [('alsoTriggerAction','triggerActions'),('alsoQueueAction','queueActions')]:
        if a.get(key):effects.append({mode:[v.strip() for v in a[key].split(',')], 'condition':expression(entry,sec+'.alsoTriggerOrQueueActionConditional',a.get('alsoTriggerOrQueueActionConditional'))})
    if a.get('takeResources'):
        take={'resources':resources(a['takeResources']),'parent':yes(a.get('takeResources_includeParent')),
          'cargo':yes(a.get('takeResources_includeUnitsInTransport')),'range':num(a.get('takeResources_includeUnitsWithinRange'))*WORLD,
          'team':a.get('takeResources_includeUnitsWithinRange_team','own'),'tag':a.get('takeResources_excludeUnitsWithoutTags'),
          'exclude':resources(a.get('takeResources_excludeUnitsWithTheseResources')),'limit':int(num(a.get('takeResources_maxUnits'),1)),
          'discard':yes(a.get('takeResources_discardCollected'))}
        if a.get('takeResources_includeReference'):take['reference']=expression(entry,sec+'.takeResources_includeReference',a['takeResources_includeReference'])
        effects.append({'take':take})
    if a.get('addActionCooldownApplyToActions'):effects.append({'cooldowns':{v.strip():seconds(a.get('addActionCooldownTime')) for v in a['addActionCooldownApplyToActions'].split(',')}})
    if yes(a.get('startUnloadingTransport')):effects.append({'unload':True})
    if a.get('setBodyRotation'):effects.append({'rotation':num(a['setBodyRotation'])*math.pi/180})
    if yes(a.get('disconnectFromParent')):effects.append({'detach':True})
    if a.get('sendMessageTo'):
        effects.append({'message':expression(entry,sec+'.sendMessageTo',a['sendMessageTo']),'tag':a.get('sendMessageWithTags','')})
    if a.get('addWaypoint_type'):
        waypoint={'kind':a['addWaypoint_type'],'time':seconds(a.get('addWaypoint_maxTime'),0),'prepend':yes(a.get('addWaypoint_prepend'))}
        if a.get('addWaypoint_target_fromReference'):waypoint['reference']=expression(entry,sec+'.addWaypoint_target_fromReference',a['addWaypoint_target_fromReference'])
        if a.get('addWaypoint_target_nearestUnit_tagged'):waypoint.update(tag=a['addWaypoint_target_nearestUnit_tagged'],team=a.get('addWaypoint_target_nearestUnit_team','own'))
        for field,key in [('addWaypoint_position_randomOffsetFromSelf','random'),('addWaypoint_position_relativeOffsetFromSelf','offset')]:
            if a.get(field):waypoint[key]=[num(v)*WORLD for v in a[field].split(',')]
        effects.append({'waypoint':waypoint})
    if a.get('attachments_addNewUnits'):
        effects.append({'attach':refs(entry,sec+'.attachments_addNewUnits',a['attachments_addNewUnits'],lookup),'slots':a.get('attachments_onlyOnSlots','').split(',')})
    if a.get('setBuilt'):effects.append({'built':num(a['setBuilt'])})
    # Morph comes last: preserve resource/flag side effects on the old form first.
    if target and target.lower()!='none':
        if target in lookup:effects.append({'morph':lookup[target]})
        else:issue(entry,sec+'.convertTo','Missing form '+target,'source-dependency');result['blocked']=True
    if yes(a.get('deleteSelf')):effects.append({'remove':True})
    unknown=[k for k in a if not k.startswith('@') and k not in ACTION_KEYS|COSMETIC_ACTION]
    if unknown:
        issue(entry,sec,'Action effects not compiled; action disabled: '+', '.join(unknown));result['blocked']=True
    # Unsupported dynamic guards are false; unknown effect sets never charge the player.
    result['effects']=effects
    if not effects:return None
    return result


def config(entry, definition, scale, media, lookup, building_factor=1):
    ini=entry['ini'];core=ini['core'];graphics=ini.get('graphics',{});geometry=WORLD*building_factor
    cfg={'tags':[t.strip() for t in core.get('tags','').split(',') if t.strip()],
       'armor':max(0,num(core.get('armour'))),'minDamage':max(0,num(core.get('armourMinDamageToKeep'),1)),
       'mounts':[],'guns':[],'actions':[],'initial':{},'rearm':[],'startCargo':[],
       'energyMax':num(core.get('energyMax')),'energyRegen':num(core.get('energyRegen'))*60,
       'energyStart':num(core.get('energyStartingPercentage'),1),'fullRecharge':yes(core.get('energyNeedsToRechargeToFull')),
       'capacity':num(core.get('maxTransportingUnits')),'airCargo':'AIR' in core.get('transportUnitsRequireMovementType',''),
       'cargoHeal':num(core.get('transportUnitsHealBy'))*60,'regen':num(core.get('selfRegenRate'))*60,
       'dieOnZeroEnergy':yes(core.get('dieOnZeroEnergy')),'immortal':yes(core.get('canNotBeDamaged')),
       'zeroHpAlive':yes(core.get('disableDeathOnZeroHp')),'triggerInterval':max(1/60,seconds(core.get('autoTriggerCooldownTime'),1)),
       'shared':sorted(GLOBAL_RESOURCES),'sourceCost':resources(core.get('price')),'sourceName':entry['rwName'],
       'singleSlot':yes(core.get('transportUnitsEachUnitAlwaysUsesSingleSlot')),'cargoTags':[t.strip() for t in core.get('transportUnitsRequireTag','').split(',') if t.strip()],
       'unloadCondition':expression(entry,'core.transportUnitsCanUnloadUnits',core.get('transportUnitsCanUnloadUnits'))}
    cfg['suicide']=yes(ini.get('attack',{}).get('dieOnAttack'))
    cfg['passive']=not yes(ini.get('attack',{}).get('disablePassiveTargeting'))
    if graphics.get('isVisible'):cfg['visible']=expression(entry,'graphics.isVisible',graphics['isVisible'])
    if core.get('fireTurretXAtSelfOnDeath'):cfg['deathGun']=core['fireTurretXAtSelfOnDeath']
    if core.get('unitsSpawnedOnDeath'):cfg['deathSpawn']=refs(entry,'core.unitsSpawnedOnDeath',core['unitsSpawnedOnDeath'],lookup)
    if 'energyRegenWhenRecharging' in core:cfg['rechargingRegen']=num(core['energyRegenWhenRecharging'])*60
    if core.get('selfBuildRate'):cfg['selfBuildTime']=seconds(core['selfBuildRate'],0,True)
    if yes(core.get('nukeOnDeath')):cfg['deathBlast']={'damage':num(core.get('nukeOnDeathDamage')),'radius':num(core.get('nukeOnDeathRange'))*WORLD}
    for sec,t in ini.items():
        if not sec.startswith('turret_'):continue
        mid=sec[7:]
        mount={'id':mid,'x':num(t.get('x'))*geometry,'y':-num(t.get('y'))*geometry,'parent':t.get('attachedTo',''),
          'slave':yes(t.get('slave')),'rest':num(t.get('idleDir'))*math.pi/180,'arc':num(t.get('limitingAngle'),180)*math.pi/180,
          'turn':num(t.get('turnSpeed',ini.get('attack',{}).get('turretTurnSpeed')),4)*math.pi/3,'spin':num(t.get('idleSpin'))*math.pi/3,
          'recoil':num(t.get('recoilOffset'))*geometry,'recoilOut':seconds(t.get('recoilOutTime')),'recoilReturn':seconds(t.get('recoilReturnTime'),.2)}
        if not yes(t.get('invisible')):
            ik='image' if t.get('image') else 'image_turret';section=sec if t.get('image') else 'graphics'
            sprite=media.sheet(entry,section,ik,'dec.'+entry['id']+'-'+mid,num(graphics.get('turretImageScale',graphics.get('imageScale')),1)*building_factor)
            if sprite:mount['sprite']=sprite
        cfg['mounts'].append(mount)
        if t.get('projectile') or ini.get('projectile_1'):
            gun=weapon(entry,sec,t,media)
            if gun:
                gun['manual']=not yes(t.get('canShoot'),True) or not yes(ini.get('attack',{}).get('canAttack'),True)
                gun['predicate']=expression(entry,sec+'.canAttackCondition',t.get('canAttackCondition'))
                gun['onShoot']=[v.strip() for v in t.get('onShoot_triggerActions','').split(',') if v.strip()]
                gun['oddOffset']=num(t.get('barrelOffsetX_onOddShots'))*geometry
                cfg['guns'].append(gun)
        if t.get('laserDefenceEnergyUse'):
            cfg.setdefault('defence',[]).append({'range':num(t.get('limitingRange',ini.get('attack',{}).get('maxAttackRange')),100)*WORLD,'energy':num(t['laserDefenceEnergyUse']),'mount':mid})
    # Arms and legs retain the source pixels and rest positions. RW's spring/IK
    # animation remains a presentation gap, never presented as fully simulated.
    for sec,part in ini.items():
        if not sec.startswith(('arm_','leg_')):continue
        is_leg=sec.startswith('leg_')
        keys=('image_leg','image_foot') if is_leg else ('image_end',)
        for key in keys:
            if not part.get(key):continue
            sprite=media.sheet(entry,sec,key,'dec.'+entry['id']+'-'+sec+'-'+key,scale)
            if not sprite:continue
            cfg['mounts'].append({'id':sec+'-'+key,'x':num(part.get('x'))*geometry,'y':-num(part.get('y'))*geometry,
              'parent':'','slave':False,'rest':num(part.get('drawDirOffset',part.get('endDirOffset')))*math.pi/180,
              'arc':math.pi,'turn':0,'spin':num(part.get('spinRate'))*math.pi/3,'sprite':sprite,
              'recoil':0,'recoilOut':0,'recoilReturn':0,'hidden':expression(entry,sec+'.hidden',part.get('hidden'),False),
              'leg':is_leg,'under':is_leg or not yes(part.get('drawOverBody'),True)})
        if is_leg and sec=='leg_1':issue(entry,sec,'Source leg sprites/rest positions retained; RW spring/IK walking animation is not reproduced.','approximation')
    cfg['attachments']=[]
    for sec,a in ini.items():
        if not sec.startswith('attachment_'):continue
        cfg['attachments'].append({'id':sec,'x':num(a.get('x'))*geometry,'y':-num(a.get('y'))*geometry,
          'angle':num(a.get('idleDir'))*math.pi/180,'keep':yes(a.get('keepAliveWhenParentDies')),
          'draw':expression(entry,sec+'.isVisible',a.get('isVisible')),'attack':yes(a.get('canAttack'),True),
          'damageable':yes(a.get('canBeAttackedAndDamaged'),True),'redirect':yes(a.get('redirectDamageToParent')),
          'actions':expression(entry,sec+'.showAllActionsFrom',a.get('showAllActionsFrom'),False),
          'cargo':yes(a.get('addTransportedUnits')),'spawn':refs(entry,sec+'.onCreateSpawnUnitOf',a.get('onCreateSpawnUnitOf',''),lookup)})
    for sec,a in ini.items():
        if sec.startswith(('action_','hiddenAction_')):
            compiled=action_config(entry,sec,a,cfg,definition,media,lookup)
            if compiled:cfg['actions'].append(compiled)
    income=resources(core.get('generation_resources'))
    if core.get('generation_credits'):income['credits']=num(core['generation_credits'])
    if income:cfg['income']={'resources':income,'every':max(1/60,seconds(core.get('generation_delay'),40/60)),
      'condition':expression(entry,'core.generation_active',core.get('generation_active'))}
    cfg['targetTags']=[x.strip() for x in core.get('canOnlyBeAttackedByUnitsWithTags','').split(',') if x.strip()]
    for gun in cfg['guns']:
        gun['muzzle']*=building_factor;gun['lateral']*=building_factor
        tid=gun['mount'];t=ini.get('turret_'+tid,{});p=ini.get('projectile_'+gun['projectileRef'],{})
        gun['predicate']=gun.get('predicate',expression(entry,'turret_'+tid+'.canAttackCondition',t.get('canAttackCondition')))
        gun['onShoot']=gun.get('onShoot',[])
        gun['targetPredicates']={}
        for field,domains in [('canAttackFlyingUnits',['air']),('canAttackLandUnits',['ground','ship']),('canAttackUnderwaterUnits',['sub'])]:
            value=t.get(field,ini.get('attack',{}).get(field,''))
            if value.startswith('if '):
                for domain in domains:gun['targetPredicates'][domain]=expression(entry,'turret_'+tid+'.'+field,value)

        gun['explodeEnd']=yes(p.get('explodeOnEndOfLife'))
        gun['instant']=yes(p.get('instant'))
        gun['hullMult']=num(p.get('hullDamageMultiplier'),1)
        gun['underwaterArea']=yes(p.get('areaHitUnderwaterAlways'))
        gun['retargetRange']=num(p.get('retargetingInFlightSearchRange'))*WORLD if yes(p.get('retargetingInFlight')) else 0
        gun['retargetDeadRange']=num(p.get('autoTargetingOnDeadTargetRange'),500)*WORLD if yes(p.get('autoTargetingOnDeadTarget')) else 0
        gun['retargetDelay']=seconds(p.get('retargetingInFlightSearchDelay'),.5)
        if t.get('altProjectile') and gun['id']==tid:
            alt=deepcopy(t);alt['projectile']=t['altProjectile'];altgun=weapon(entry,'turret_'+tid,alt,media)
            if altgun:
                altgun.update(id=tid+'@alt',mount=tid,manual=True);altgun['weapon']['id']=altgun['id'];cfg['guns'].append(altgun)
                gun['alt']=altgun['id'];gun['altCondition']=expression(entry,'turret_'+tid+'.altProjectileCondition',t.get('altProjectileCondition'))
        gun['invisible']=yes(p.get('invisible')) or p.get('image')=='SHARED:blank.png'
        gun['cascade']={}
        for key,phase in [('spawnProjectilesOnCreate','created'),('spawnProjectilesOnEndOfLife','expired'),('spawnProjectilesOnExplode','impact')]:
            for term in split_list(p.get(key,'')):
                if term.upper()=='NONE':continue
                match=re.fullmatch(r'([^(*]+)(?:\*(\d+))?(?:\((.*)\))?',term)
                if not match:issue(entry,'projectile_'+gun['projectileRef']+'.'+key,'Unknown cascade '+term);continue
                child=match[1];cid='cascade@'+child
                if 'projectile_'+child not in ini:issue(entry,key,'Missing cascade projectile '+child,'source-dependency');continue
                # Omit source chains that explicitly request effectively infinite
                # replication, instead of silently imposing a new damage profile.
                options={}
                for option in split_list(match[3] or ''):
                    k,_,v=option.partition('=');options[k.lower()]=num(v)
                if options.get('recursionlimit',3)>64:
                    issue(entry,'projectile_'+gun['projectileRef']+'.'+key,'Source cascade recursion '+str(options['recursionlimit'])+' exceeds the bounded 64 generations.','port-gap');continue
                if not any(g['id']==cid for g in cfg['guns']):
                    child_t=deepcopy(t);child_t['projectile']=child;child_t.pop('resourceUsage',None);child_t.pop('energyUsage',None)
                    child_g=weapon(entry,'turret_'+tid,child_t,media)
                    if child_g:
                        child_g.update(id=cid,mount=tid,manual=True,costs={},muzzle=0,lateral=0,predicate=['lit',True])
                        child_g['weapon']['id']=cid;cfg['guns'].append(child_g)
                gun['cascade'].setdefault(phase,[]).append({'gun':cid,'count':int(match[2] or 1),'options':options})
        if p.get('spawnUnit'):gun['spawn']=refs(entry,'projectile_'+t.get('projectile','1')+'.spawnUnit',p['spawnUnit'],lookup)
        if yes(p.get('teleportSource')):gun['teleport']=True
        for m in gun['mutators']:
            prefix=next((k[:-len('_ifUnitWithTags')] for k,v in p.items() if k.endswith('_ifUnitWithTags') and v.split(',')==m['tags']),None)
            if prefix and p.get(prefix+'_addResourcesAreaHit'):m['add']=resources(p[prefix+'_addResourcesAreaHit'])
    wreck=media.sheet(entry,'graphics','image_wreak','dec.'+entry['id']+'-wreck',scale,rotated=False)
    if wreck:cfg['wreck']=wreck
    if ini.get('graphics',{}).get('image_back'):
        back=media.sheet(entry,'graphics','image_back','dec.'+entry['id']+'-back',scale,rotated=False)
        if back:cfg['back']=back
    if any(k.startswith('decal_') for k in ini):issue(entry,'decal_*','HUD status overlays / conditional source decals not yet compiled.','presentation-gap')
    return cfg

VANILLA={
 'builder':['engineer'],'combatEngineer':['engineer'],'mechEngineer':['engineer'],'experimentalSpider':['engineer'],
 'landFactory':['factory','factory2','factory3'],'airFactory':['airbase','airbase2','airbase3'],'seaFactory':['navyard','navyard2','navyard3'],
 'experimentalLandFactory':['factory3'],'mechFactory':['factory2'],'mechFactoryT2':['factory3'],
 'extractor':['extractor'],'extractorT2':['extractor2'],'extractorT3':['extractor3'],'repairBay':['repairtower'],
 'turret':['cannonturret'],'antiAirTurret':['aaturret'],'laserDefence':['interceptor'],'fabricator':['power'],
 'nukeLauncher':['nukesilo'],'antiNukeLauncher':['interceptor2'],'wall_v':['sandbag'],'commandCenter':['hq'],'c_turret_t1':['cannonturret'],'c_antiAirTurret':['aaturret'],'fabricatorT1':['power'],'nukeLauncherC':['nukesilo'],'antiNukeLauncherC':['interceptor2'],'outpostT1':['radar']}

def main():
    global LOCAL,LOCAL_ZH,SOURCE_BY_NAME
    LOCAL=json.loads((HERE/'localization.json').read_text()) if (HERE/'localization.json').exists() else {}
    LOCAL_ZH=json.loads((HERE/'localization-zh.json').read_text()) if (HERE/'localization-zh.json').exists() else {}
    entries=load();SOURCE_BY_NAME={e['rwName']:e for e in entries}
    all_paths=sorted(RW.rglob('*.ini'))
    lookup={e['rwName']:e['id'] for e in entries}
    write('source-inventory.json',entries)
    media=Media('--no-media' not in sys.argv);defs=[]
    for e in entries:
        c=e['ini']['core'];mv=e['ini'].get('movement',{});building=yes(c.get('isBuilding'))
        domain={'AIR':'air','WATER':'ship','HOVER':'amphibious','OVER_CLIFF_WATER':'amphibious'}.get(mv.get('movementType','').upper(),'ground')
        title=c.get('displayText',e['rwName']);zh=c.get('displayText_zh','')
        d={'id':e['id'],'name':texts(title,zh),'desc':texts(c.get('displayDescription',''),c.get('displayDescription_zh','')),
          'kind':'building' if building else 'unit','cost':min(99999,max(0,metal(resources(c.get('price'))))),
          'hp':min(100000000,max(1,num(c.get('maxHp'),1))),'buildTime':min(3600,max(0,seconds(c.get('buildSpeed'),10,True))),
          'power':0,'pop':0,'tier':min(3,max(1,int(num(c.get('techLevel'),1)))),
          'vision':min(64,max(0,num(c.get('fogOfWarSightRange'),15)*20*WORLD/32)),'weapons':[]}
        if building:
            f=[num(v) for v in c.get('footprint','-1,-1,1,1').split(',')]
            d.update(fw=min(8,max(1,math.ceil((f[2]-f[0]+1)*20*WORLD/32))),fh=min(8,max(1,math.ceil((f[3]-f[1]+1)*20*WORLD/32))),builtBy=[])
            if yes(c.get('placeOnlyOnResPool')):d['needsDeposit']=True
            if domain=='ship':d['offshore']=True
        else:
            d.update(domain=domain,speed=min(1000,max(0,num(mv.get('moveSpeed'))*60*WORLD)),
              turnRate=min(50,max(0,num(mv.get('maxTurnSpeed'),3)*math.pi/3)),radius=min(200,max(1,num(c.get('radius'),10)*WORLD)),
              producedBy=[],aiWeight=0 if yes(c.get('isUnselectable')) else 1,
              trail='none' if domain in ('air','amphibious') or yes(c.get('isBio')) else 'wake' if domain=='ship' else 'tread',
              cargoWeight=min(50,max(0,num(c.get('transportSlotsNeeded'),1))))
            if domain=='air':d.update(hovers=True,altitude=min(64,max(0,num(mv.get('targetHeight'),20)*WORLD)))
            if domain=='ship' and num(mv.get('targetHeight'))<-1:d.update(underwater=True,armor='sub',shadow=False)
            if num(c.get('maxTransportingUnits'))>0:d.update(transportCap=min(50,int(num(c['maxTransportingUnits']))),transportMaxWeight=min(50,int(num(c['maxTransportingUnits']))))
            if yes(c.get('isBuilder')) or any(s.startswith('canBuild_') for s in e['ini']):
                d.update(builds=[],buildRate=min(10000,num(c.get('nanoBuildSpeed'),1)*60),reach=min(256,num(c.get('nanoRange'),100)*WORLD))
        if yes(c.get('canRepairUnits')) or yes(c.get('canRepairBuildings')):
            d.update(repairRange=min(64,num(c.get('nanoRange'),100)*WORLD/32),repairRate=min(10000,num(c.get('nanoRepairSpeed'),.2)*60),repairTargets=1)
        if num(c.get('maxShield'))>0:d['shield']={'hp':min(1000000,num(c['maxShield'])),'regen':min(100000,max(0,num(c.get('shieldRegen'))*60)),'delay':0}
        if yes(c.get('canNotBeDirectlyAttacked')) or yes(c.get('isUnselectableAsTarget')):d['untargetable']=True
        scale,factor=media.body(e,d)
        cfg=config(e,d,scale,media,lookup,factor)
        d['extensions']={CAP:cfg};d['weapons']=[deepcopy(g['weapon']) for g in cfg['guns'] if not g['manual']][:8]
        if not building and any('sub' in g['weapon']['targets'] for g in cfg['guns']):d['sonar']=min(64,max(g['range'] for g in cfg['guns'] if 'sub' in g['weapon']['targets']))
        if c.get('overrideAndReplace'):issue(e,'core.overrideAndReplace','Additive mod API cannot replace '+c['overrideAndReplace']+'; separate EK definition retained.','engine-limit')
        if c.get('onNewMapSpawn') or c.get('createOnAggressiveTeam'):issue(e,'core.onNewMapSpawn','Source global/map controller hook is not a native pack spawn hook.','engine-limit')
        if mv.get('movementType') in ('OVER_CLIFF','OVER_CLIFF_WATER'):issue(e,'movement.movementType','Cliff traversal needs a mod-owned pathfinder; native ground/amphibious pathing is retained.','port-gap')
        defs.append(d)
        REPORT['entries'].append({'source':e['source'],'rwName':e['rwName'],'id':d['id'],'status':'converted','guns':len(cfg['guns']),
          'actions':len(cfg['actions']),'price':resources(c.get('price')),'sha256':e['sha256']})
    byid={d['id']:d for d in defs}
    for e in entries:
        parent=byid[e['id']];c=e['ini']['core']
        for key,value in c.items():
            if re.fullmatch(r'builtFrom_\d+_name',key):
                for rwparent in value.split(','):
                    ids=[lookup[rwparent]] if rwparent in lookup else VANILLA.get(rwparent,[])
                    if not ids and rwparent.upper()!='NONE':issue(e,'core.'+key,'Missing producer '+rwparent,'source-dependency')
                    if parent['kind']=='unit':
                        if len(ids)==3:ids=ids[parent['tier']-1:]
                        parent['producedBy']+=[pid for pid in ids if pid!='engineer']
                        for pid in ids:
                            if pid in byid:byid[pid].setdefault('produces',[]).append(parent['id'])
                    else:parent['builtBy']+=ids
        for sec,v in e['ini'].items():
            if not sec.startswith('canBuild_'):continue
            for ref in v.get('name','').split(','):
                if ref in ('setRally','reclaim','repair','NONE'):continue
                cid=lookup.get(ref)
                if not cid:
                    # Building references to vanilla are explicit documented adapters.
                    for native in VANILLA.get(ref,[]):
                        if parent['kind']=='unit' and native!='engineer':parent.setdefault('builds',[]).append(native)
                    if ref not in VANILLA:issue(e,sec+'.name','Missing build-list unit '+ref,'source-dependency')
                    continue
                child=byid[cid]
                if child['kind']=='unit':
                    parent.setdefault('produces',[]).append(cid);child['producedBy'].append(parent['id'])
                elif parent['kind']=='unit':
                    parent.setdefault('builds',[]).append(cid);child['builtBy'].append(parent['id'])
                else:issue(e,sec,'Stationary construction list requires a location-targeted package builder.','port-gap')
    for d in defs:
        for cid in list(d.get('produces',[])):
            child=byid.get(cid)
            if not child:continue
            costs=child['extensions'][CAP]['sourceCost']
            extra={k:v for k,v in costs.items() if k!='credits'}
            if not extra:continue
            d['produces'].remove(cid)
            child['producedBy']=[pid for pid in child['producedBy'] if pid!=d['id']]
            d['extensions'][CAP]['actions'].append({'id':'recruit-'+cid,'name':child['name'],'desc':child['desc'],
              'cost':metal(costs),'stocks':extra,'time':child['buildTime'],'cooldown':0,'canCancel':True,'queue':True,'ai':True,
              'effects':[{'spawn':[{'unit':cid,'count':1}],'into':False}]})
    for d in defs:
        costs=d['extensions'][CAP]['sourceCost']
        if d['kind']=='unit' and any(k!='credits' for k in costs):
            native=[pid for pid in d['producedBy'] if pid not in byid]
            if native:
                d['extensions'][CAP]['nativeProducers']=native
                d['extensions'][CAP]['recruitName']=d['name']
                d['producedBy']=[pid for pid in d['producedBy'] if pid in byid]
        for key in ('produces','producedBy','builds','builtBy'):
            if key in d:d[key]=sorted(set(d[key]))
        round_definition_stats(d)
        if isinstance(d['desc'],list) and any(len(t)>400 for t in d['desc']):d['desc']=dict(zip(('en','zh','ko'),d['desc']))
    for e in entries:
        d=byid[e['id']];c=e['ini']['core'];mv=e['ini'].get('movement',{})
        expected={'cost':max(0,metal(resources(c.get('price')))),'hp':num(c.get('maxHp'),1),
          'buildTime':seconds(c.get('buildSpeed'),10,True),'vision':num(c.get('fogOfWarSightRange'),15)*20*WORLD/32}
        if d['kind']=='unit':expected.update(speed=num(mv.get('moveSpeed'))*60*WORLD,turnRate=num(mv.get('maxTurnSpeed'),3)*math.pi/3,radius=num(c.get('radius'),10)*WORLD,cargoWeight=num(c.get('transportSlotsNeeded'),1))
        for field,value in expected.items():
            if not math.isclose(d[field],value,rel_tol=1e-4,abs_tol=.01):REPORT['adaptations'].append({'unit':e['rwName'],'field':field,'sourceScaled':value,'native':d[field],'reason':'Native field bound or integer normalization'})
        for a in d['extensions'][CAP]['actions']:
            for f in a['effects']:
                if f.get('morph'):
                    target=byid[f['morph']]
                    if d['kind']!=target['kind'] or d['kind']=='building' and (d['fw'],d['fh'])!=(target['fw'],target['fh']):
                        issue(e,a['id']+'.convertTo','Kind/footprint-changing conversion requires a placement transaction; action disabled.');a['blocked']=True
        if 'sprite' not in d and yes(c.get('isUnselectable')):
            blank=next((key for key,image in media.images.items() if key.startswith('u.') and image['source'].endswith('shared/blank.png')),None)
            if blank:d['sprite']=blank
    from showcase import build as build_showcase
    import subprocess
    showcase_path=build_showcase(defs,entries)
    subprocess.run(['node',str(HERE/'extensions/ek-systems/build.mjs')],check=True)
    package=json.loads((HERE/'extensions/ek-systems/extension.json').read_text())
    original=strings(parse(RW/'mod-info.txt')['mod']['description'])
    manifest={'format':'steel-tide-mod','v':4,'capacity':'large','id':'ek-definitive-edition',
      'name':['EK Definitive Edition 2026h50','EK 决定版 2026h50','EK 결정판 2026h50'],'version':'0.0.1','author':'ice-v5 and EK contributors',
      'description':texts(original,'“以雷霆之力，我挥锤终结审判”\nCopyright © 2021-2026 ice-v5. All Rights Reserved.'),
      'license':'CC-BY-NC-ND-4.0','hideFromListing':True,
      'requiredCapabilities':[CAP],'extensionPackages':[package],'defs':defs,'sprites':media.sprites,'sounds':media.sounds,
      'maps':[showcase_path],
      'screenshots':['screenshots/cover.jpeg','screenshots/ground-forces.jpg','screenshots/air-fleet.jpg']}
    # Omit schema defaults and duplicated native armor tables, preserving exact
    # small simulation coefficients. Expanded at the owning schema boundary.
    for d in defs:
        for w in d['weapons']:w.pop('mult',None)
        c=d['extensions'][CAP]
        for g in c['guns']:
            g.pop('condition',None);g['weapon'].pop('mult',None)
            for k in list(g):
                if k not in ('id','mount','weapon','range','reload','life','targetSpeed','turnSpeed','buildingMult','shieldMult','hullMult') and (g[k] in (False,0,'',None) or g[k] in ([],{}) or k in ('predicate',) and g[k]==['lit',True]):g.pop(k)
        for m in c['mounts']:
            for k in list(m):
                if k not in ('id','arc') and (m[k] in (False,0,'',None) or k=='hidden' and m[k]==['lit',False]):m.pop(k)
        for a in c['actions']:
            for k in list(a):
                if k not in ('id','name','effects','ai','queue','canCancel') and (a[k] in (False,0,'',None) or a[k] in ([],{}) or k=='desc' and a[k]==['','','']):a.pop(k)
    (HERE/'mod.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n')
    REPORT.update(sourceTitle='EK_Definitive_Edition_2026h50',coordinateScale=WORLD,creditMetal=CREDIT,
      templates=[p.relative_to(RW).as_posix() for p in all_paths if not parse(p).get('core',{}).get('name')],
      mediaIssues=media.issues,images=media.images,summary={'sourceFiles':len(all_paths),'defs':len(defs),'sprites':len(media.sprites),
      'guns':sum(len(d['extensions'][CAP]['guns']) for d in defs),'actions':sum(len(d['extensions'][CAP]['actions']) for d in defs)})
    write('conversion-report.json',REPORT)
    print(json.dumps(REPORT['summary']|{'issues':len(REPORT['issues']),'mediaIssues':len(media.issues)}))

if __name__=='__main__':main()

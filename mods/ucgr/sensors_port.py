"""Audited, pack-local UCGR signal authoring.

The first source witness is MIG29's RADAR_AIR controller.  Its radio contacts
are independent of the R73 infrared missile; attaching a radar-guidance policy
to that weapon would invent behavior.  These functions only emit data after
checking the source clauses they translate.  They never execute RW actions.
"""
import hashlib
import json
import math
import re

import rw
from weapons import RANGE_SCALE, seconds, source_index

CAPABILITY = 'sensors-v1'
RADAR_CHANNEL = 'usgr-re-radar'
RADAR_LABEL = ['Air-search radar contacts', '空中搜索雷达接触', '공중 수색 레이더 접촉']
RW_TICK_SECONDS = 1 / 60
WORLD_SCALE = RANGE_SCALE * 32


class SourceMismatch(ValueError):
    """A source clause exceeds the explicitly reviewed data policy."""


def _number(raw, name, low, high):
    try:
        value = float(str(raw).strip())
    except (ValueError, TypeError):
        raise SourceMismatch(f'{name}: requires a literal number') from None
    if not math.isfinite(value) or not low <= value <= high:
        raise SourceMismatch(f'{name}: outside reviewed bounds {low:g}..{high:g}')
    return value


def _same(ini, section, key, expected):
    value = ini.get(section, {}).get(key)
    if value != expected:
        raise SourceMismatch(f'[{section}] {key}: unsupported source clause {value!r}')
    return value


def _literal_field(path, section, key):
    """RW accepts equals as well as colons; the common reader only reads ':' ."""
    current = None
    found = []
    for raw in path.read_text(encoding='utf-8-sig').splitlines():
        line = raw.strip()
        if not line or line.startswith(('#', ';', '//')):
            continue
        match = re.fullmatch(r'\[([^]]+)\]', line)
        if match:
            current = match[1]
        elif current == section:
            field = re.fullmatch(re.escape(key) + r'\s*[:=]\s*(.*?)\s*', line)
            if field:
                found.append(field[1])
    if len(found) != 1:
        raise SourceMismatch(f'{path.name} [{section}] {key}: not one literal field')
    return found[0]


def _unit(name):
    entry = source_index()[name]
    return entry, rw.load_unit(rw.RW / entry['source'])


def stable_radar_signature(entry, ini):
    """Only an invariant fixed-wing RADAR resource is presently representable.

    Helicopters alter RADAR on landing, takeoff and unload.  A constant copied
    from their initial resource would falsely reveal a landed aircraft, so it
    is deliberately not emitted.  No source signature means no invented one.
    """
    core = ini.get('core', {})
    borrow = core.get('borrowResourcesWhileAlive', '')
    match = re.fullmatch(r'RADAR\s*=\s*-([\d.]+)', borrow)
    if not match:
        return None, 'no literal source radar signature'
    changes = []
    for name, fields in ini.items():
        for key in ('addResources', 'addResourcesWithLogic', 'setResourcesWithLogic', 'takeResources'):
            if re.search(r'\bRADAR\s*=', fields.get(key, ''), re.I):
                changes.append(f'[{name}] {key}')
    if changes:
        return None, 'dynamic radar signature omitted: ' + ', '.join(changes)
    if '固定翼' not in core.get('tags', '').split(','):
        return None, 'only the audited fixed-wing signature profile is supported'
    # The source controller filters targets at height >10.  Every emitted
    # fixed-wing profile has a constant cruise height above it.  Cargo, low
    # altitude and landing workflows are not inferred from a label or a tag.
    height = _number(ini.get('movement', {}).get('targetHeight'), 'targetHeight', 0, 1000)
    if height <= 10:
        return None, 'source aircraft is below the radar controller height filter'
    strength = _number(match[1], 'RADAR', 1, 1000)
    return {'channel': RADAR_CHANNEL, 'strength': strength}, None


def radar_air_profile(entry, ini, controller=None):
    """Compile the reviewed default MIG29 search controller, or reject drift.

    This is a contact receiver, not an illumination source and not a weapon
    lock.  The source scan takes up to 100 signature-bearing enemies before its
    cone filter.  Contact positions refresh only at the source check cadence.
    """
    if ini.get('hiddenAction_preset', {}).get('attachments_addNewUnits') != 'RADAR_AIR':
        return None
    if '无雷达' in ini.get('core', {}).get('tags', '').split(','):
        return None
    controller_entry, actual_controller = _unit('RADAR_AIR')
    controller = actual_controller if controller is None else controller
    core = ini.get('core', {})
    radius = _number(core.get('@global radar'), 'radar', 1, 20480)
    if radius not in (1200, 1800, 2400, 3000, 4800, 6000, 8000, 10000):
        raise SourceMismatch('radar range has no reviewed controller search section')
    _same(ini, 'hiddenAction_preset', 'attachments_addNewUnits', 'RADAR_AIR')
    _same(ini, 'hiddenAction_preset', 'attachments_onlyOnSlots', 'RADAR')
    _same(ini, 'action_雷达显示', 'isVisible', 'false')
    _same(ini, 'action_雷达显示2', 'isVisible', 'false')
    _same(ini, 'action_雷达显示2', 'autoTriggerOnEvent', 'created')
    _same(ini, 'attachment_RADAR', 'rotateWithParent', 'true')
    _same(ini, 'attachment_RADAR', 'idleDir', '0')
    scan = f'hiddenAction_搜索_{radius:g}'
    for key, expected in {
        'autoTriggerCheckRate': 'every4Frames',
        'autoTrigger': f'if memory.RADAR_RANGE=={radius:g} and not parent.tags(includes="OFF")',
        'takeResources': 'RADAR=1',
        'takeResources_includeUnitsWithinRange': f'{radius:g}',
        'takeResources_includeUnitsWithinRange_team': 'enemy',
        'takeResources_includeParent': 'false',
        'setUnitMemory': 'ENELIST = null',
    }.items():
        _same(controller, scan, key, expected)
    for key in ('takeResources_discardCollected', 'takeResources_keepResourcesOnTarget'):
        if _literal_field(rw.RW / controller_entry['source'], 'hiddenAction_搜索_1200', key) != 'true':
            raise SourceMismatch(f'{key}: source radar must leave target signature resources untouched')
    _same(controller, 'hiddenAction_标记', 'requireConditional',
          'if (max(directionBetween(self,thisActionTarget)-self.dir,-(directionBetween(self,thisActionTarget)-self.dir))<=35 or max(directionBetween(self,thisActionTarget)-self.dir,-(directionBetween(self,thisActionTarget)-self.dir))>=325) and thisActionTarget.height>10')
    max_units = _number(_literal_field(rw.RW / controller_entry['source'], 'hiddenAction_搜索_1200',
                                      'takeResources_maxUnits'), 'takeResources_maxUnits', 1, 256)
    if int(max_units) != max_units:
        raise SourceMismatch('source radar scan limit must be integral')
    check_interval = 4 * RW_TICK_SECONDS
    cooldown = seconds(controller.get('core', {}).get('autoTriggerCooldownTime'))
    if cooldown != .1:
        raise SourceMismatch('source radar cooldown changed')
    # Source trigger evaluation occurs every four frames; the .1s cooldown
    # therefore permits a scan on every second evaluation (eight frames).
    interval = math.ceil((cooldown - 1e-12) / check_interval) * check_interval
    x = _number(ini['attachment_RADAR'].get('x'), 'radar attachment x', -640, 640)
    y = _number(ini['attachment_RADAR'].get('y'), 'radar attachment y', -640, 640)
    return {'id': 'air-search', 'label': RADAR_LABEL.copy(), 'channel': RADAR_CHANNEL,
            'mode': 'signature', 'minimumSignature': 1, 'reveal': 'contact',
            'range': radius * RANGE_SCALE, 'cone': math.radians(35),
            'basis': 'body', 'x': x * WORLD_SCALE, 'y': -y * WORLD_SCALE,
            'interval': interval, 'scanLimit': int(max_units), 'maxTracks': int(max_units),
            'targets': ['air'], 'acquire': 0, 'retain': 0, 'forest': False, 'smoke': False}


def source_sensor_candidate(entry, ini, definition):
    """Return staged extension data and notes without mutating a manifest.

    Engine signature/scan policies must be validated before the caller installs
    this result.  No guidance configuration is attached to any native weapon.
    """
    notes = []
    signature, why = stable_radar_signature(entry, ini)
    if why and 'dynamic' in why:
        notes.append(why + '; no permanent airborne substitute.')
    sensor = radar_air_profile(entry, ini)
    data = {}
    tags=[tag.strip() for tag in ini.get('core',{}).get('tags','').split(',')]
    for tag,key in [('固定翼','fixedWing'),('制空','airSuperiority'),('电子战吊舱','electronicWarfare')]:
        if tag in tags:data[key]=True
    if '低空' in tags:data['altitude']='low'
    elif '高空' in tags:data['altitude']='high'
    try:
        controls = source_flight_controls(ini, definition)
        if controls:
            data['flightControls'] = controls
            notes.append('Source fixed-wing high/low altitude actions, additive afterburner/speed-brake controls and persistent movement damage flags.')
    except SourceMismatch as error:
        notes.append(f'Flight controls omitted: {error}.')
    try:
        radar_control = source_radar_control(ini, definition)
        if radar_control:
            data['radarControl'] = radar_control
            notes.append('Source radar power action, emitted state, half-second queue, ten-second shared cooldown and optical/radar engagement envelopes; automatic AA/ground mode where source authored.')
    except SourceMismatch as error:
        notes.append(f'Radar controls omitted: {error}.')
    memory=ini.get('hiddenAction_生成热诱',{}).get('setUnitMemory','')
    match=re.search(r'(?:^|,)ECM=([0-9.]+)(?:,|$)',memory)
    if match:data['ecm']=float(match[1])
    countermeasures = source_countermeasures(ini)
    if countermeasures:
        data['countermeasures'] = countermeasures
        notes.append('Source finite automatic countermeasure rounds, half-second ready-round refill, traveling area energy pulses; no probability-based decoy substitution.')
    if 'HELI' in ini.get('core', {}).get('tags', '').split(','):
        data['helicopter'] = True
    if 'UAV' in ini.get('core', {}).get('tags', '').split(','):
        data['unmanned'] = True
    if signature:
        data['signatures'] = [signature]
        notes.append(f'Source RADAR resource {signature["strength"]:g} retained as a passive signature; this does not emit radar or reveal the entity.')
    if sensor:
        data['sensors'] = [sensor]
        notes.append('RADAR_AIR: source range/35-degree search, RADAR>=1 threshold, 100 pre-cone candidates and sampled private contacts. Radar forwarding, warning display and radio-guided seekers are separate source systems; contacts do not reveal entities.')
    return data or None, notes


def augment_sensors(entry, ini, definition):
    """Install the validated contact/signature slice in the actual pack def.

    Root authoring runs this only with the corresponding engine schema.  The
    first candidate is built atomically; an unknown source clause changes no
    definition, and no weapon receives unsupported infrared guidance.
    """
    if CAPABILITY in definition.get('extensions', {}):
        raise ValueError('sensor conversion must run exactly once per source definition')
    try:
        data, notes = source_sensor_candidate(entry, ini, definition)
    except SourceMismatch as error:
        return [f'Sensors omitted: {error}.']
    if data:
        definition.setdefault('extensions', {})[CAPABILITY] = data
    for weapon in definition.get('weapons', []):
        try:
            flight = source_infrared_profile(ini, weapon) or source_radar_profile(ini, weapon)
        except SourceMismatch as error:
            notes.append(f'Seeker helper omitted: {error}.')
            continue
        if flight:
            weapon.setdefault('extensions', {})[CAPABILITY] = flight
            notes.append(f'{weapon["id"]}: source {"radar" if flight["sourceFlight"].get("radar") else "infrared"} helper lifecycle with original launch, movement, resistance, fuse and expiry data.')
    return notes


def infrared_gap(entry, ini, definition):
    """Machine-readable audit of the actual retained R73, not a fake policy."""
    if entry.get('rwName') != 'MIG29':
        return None
    weapon = next((w for w in definition.get('weapons', [])
                   if w.get('_source', {}).get('attachedMissile') == 'R73'), None)
    if weapon is None:
        raise SourceMismatch('the retained default R73 weapon is absent')
    helper_entry, helper = _unit('R73')
    if weapon.get('_source', {}).get('helper', {}).get('source') != helper_entry['source']:
        raise SourceMismatch('R73 payload provenance does not match the selected source helper')
    return {
        'weapon': weapon['id'], 'status': 'implemented-source-helper',
        'radarDependency': False, 'illuminationDependency': False, 'ecmDependency': False,
        'source': {
            'helper': helper_entry['source'], 'template': '模板/红外弹模板.key',
            'launchArcDegrees': _number(ini['turret_LOCK_R73']['limitingAngle'], 'launch arc', 0, 180),
            'launchRangePixels': _number(ini['turret_LOCK_R73']['limitingRange'], 'launch range', 0, 20480),
            'reloadSeconds': seconds(ini['turret_LOCK_R73']['delay']),
            'seekerConeDegrees': _number(helper['core']['@global FOV'], 'FOV', 0, 180),
            'fovLossStartsSeconds': 2, 'reacquire': False,
            'launchLegPixels': _number(helper['core']['@global initial_X'], 'initial_X', 0, 1000),
            'launchLegMaxSeconds': seconds(helper['hiddenAction_脱离路径点']['addWaypoint_maxTime']),
            'steeringCheckFrames': 8, 'steering': 'target velocity lead',
            'speed': _number(helper['movement']['moveSpeed'], 'moveSpeed', 0, 100),
            'speedInheritance': .25, 'turnDegreesPerTick': _number(helper['movement']['maxTurnSpeed'], 'turn', 0, 100),
            'accelerationPerTick': _number(helper['movement']['moveAccelerationSpeed'], 'acceleration', 0, 100),
            'turnAccelerationPerTick': _number(helper['movement']['turnAcceleration'], 'turn acceleration', 0, 100),
            'actualLifetimeSeconds': 5,
            'unusedFuelTimeGlobal': _number(helper['core']['@global fuel_time'], 'fuel_time', 0, 100),
            'countermeasureResistance': _number(helper['core']['energyMax'], 'energyMax', 0, 10000),
            'proximityRadiusPixels': _number(helper['attack']['maxAttackRange'], 'proximity', 0, 1000),
        },
        'missingContracts': [],
        'implementedPolicy': source_infrared_profile(ini, weapon),
    }


def write_source_audit(path=None):
    """Regenerate reviewable evidence only; mod.json is never touched."""
    from weapons import convert_weapons
    entry, ini = _unit('MIG29')
    converted, _ = convert_weapons(entry, ini)
    candidate, notes = source_sensor_candidate(entry, ini, {'weapons': converted})
    from sead_port import augment_sead
    source_definition={'weapons':converted,'extensions':{'sensors-v1':candidate}}
    augment_sead(entry,ini,source_definition)
    paths = [entry['source'], source_index()['RADAR_AIR']['source'], source_index()['R73']['source'],
             '模板/空战雷达模板.key', '模板/红外弹模板.key', '模板/固定翼模板.key', 'tem/干扰物.ini']
    audit = {'format': 'ucgr-source-sensor-audit', 'v': 1, 'unit': entry['id'],
             'status': 'source radar ranges, fixed signatures, infrared helper flight and finite countermeasure energy pulses',
             'candidate': candidate, 'notes': notes, 'infrared': infrared_gap(entry, ini, {'weapons': converted}),
             'sourceFiles': [{'path': p, 'sha256': hashlib.sha256((rw.RW / p).read_bytes()).hexdigest()} for p in paths]}
    destination = path or rw.HERE / 'sensors-source-data.json'
    destination.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n')
    return audit




def source_infrared_profile(ini, weapon):
    """Compile the original moving infrared helper, never native homing."""
    attached = weapon.get('_source', {}).get('attachedMissile')
    if not attached or attached not in source_index():
        return None
    _, helper = _unit(attached)
    if '红外弹' not in helper.get('core', {}).get('tags', '').split(','):
        return None
    if helper.origins.get(('hiddenAction_移动', 'addWaypoint_target_fromReference')):
        pass
    for section, key, expected in [
        ('hiddenAction_发射', 'setUnitStats', 'targetHeight=eventData(name="目标",type="unit").height,moveSpeed+=self.customTarget1.maxMoveSpeed()/4'),
        ('hiddenAction_移动', 'autoTriggerCheckRate', 'every8Frames'),
        ('hiddenAction_移动', 'addWaypoint_target_fromReference', 'memory.TRACK.getOffsetRelative(x=0,y=memory.TRACK.maxMoveSpeed*memory.TRACK.speed()*((distanceBetween(memory.TRACK,self)/self.maxMoveSpeed())))'),
        ('hiddenAction_自爆', 'autoTrigger', 'if self.customTimer>5 and self.parent==null and self.tags(includes="FOX1")'),
        ('hiddenAction_脱离路径点', 'addWaypoint_maxTime', '0.25s'),
        ('attack', 'canOnlyAttackUnitsWithoutTags', 'UAV'),
    ]:
        _same(helper, section, key, expected)
    turret = ini.get(weapon['_source']['turret'], {})
    c, m, attack = helper['core'], helper['movement'], helper['attack']
    n=lambda fields,key,maximum=10000:_number(fields.get(key),key,0,maximum)
    fov=n(c,'@global FOV',180)
    _same(helper,'hiddenAction_脱锁','autoTrigger',f'if (max((self.dir-directionBetween(self,memory.TRACK)),-(self.dir-directionBetween(self,memory.TRACK)))>{fov:g} or memory.TRACK==null) and parent==null and not self.tags(includes="脱锁") and self.customTimer>2')
    return {'mode':'self','channel':'usgr-re-infrared','range':weapon['range'],
        'cone':math.radians(fov),'launchArc':math.radians(min(180,n(turret,'limitingAngle',360))),
        'turnRate':math.radians(n(m,'maxTurnSpeed'))*60,'maxLife':5,
        'sourceFlight':{'speed':n(m,'moveSpeed')*60*WORLD_SCALE,
            'heightRate':n(m,'heightChangeRate')*60*WORLD_SCALE,
            'acceleration':n(m,'moveAccelerationSpeed')*3600*WORLD_SCALE,
            'turnRate':math.radians(n(m,'maxTurnSpeed'))*60,
            'turnAcceleration':math.radians(n(m,'turnAcceleration'))*3600,
            'inheritSpeed':.25,'launchLeg':n(c,'@global initial_X')*WORLD_SCALE,
            'launchTime':.25,'sample':8/60,'lossDelay':2,'fovDegrees':fov,
            'life':5,'resistance':n(c,'energyMax'),'proximity':n(attack,'maxAttackRange')*WORLD_SCALE,
            'blastRadius':n(helper['projectile_红外弹'],'areaRadius')*WORLD_SCALE}}


def source_countermeasures(ini):
    slot=ini.get('attachment_干扰物',{})
    if slot.get('onCreateSpawnUnitOf')!='干扰物':return None
    created=ini.get('hiddenAction_生成热诱',{})
    match=re.fullmatch(r'热诱\s*=\s*([0-9]+)',created.get('addResources',''))
    if not match or int(match[1])==0:return None
    _, helper=_unit('干扰物')
    _same(helper,'projectile_热诱弹','mutator1_addResourcesAreaHit','energy=-60')
    _same(helper,'hiddenAction_装填干扰物','buildSpeed','0.5s')
    _same(helper,'turret_热诱弹','canAttackLandUnits','false')
    turret, projectile=helper['turret_热诱弹'],helper['projectile_热诱弹']
    return {'charges':int(match[1]),'reload':.5,'range':float(helper['attack']['maxAttackRange'])*WORLD_SCALE,
        'x':float(turret['x'])*WORLD_SCALE,'y':-float(turret['y'])*WORLD_SCALE,
        'life':seconds(projectile['life']),'speed':float(projectile['speed'])*60*WORLD_SCALE,
        'radius':float(projectile['areaRadius'])*WORLD_SCALE,'energy':60}


def source_radar_profile(ini, weapon):
    attached=weapon.get('_source',{}).get('attachedMissile')
    helper_path=weapon.get('_source',{}).get('helper',{}).get('source')
    if attached and attached in source_index():
        _,helper=_unit(attached)
    elif helper_path:
        helper=rw.load_unit(rw.RW/helper_path)
    else:return None
    c=helper.get('core',{});tags=c.get('tags','').split(',')
    semi='半主动雷达弹' in tags
    if not semi and '雷达弹' not in tags:return None
    required='hiddenAction_锁定'
    if required not in helper:return None
    n=lambda fields,key,maximum=10000:_number(fields.get(key),key,0,maximum)
    m=helper['movement'];t=ini.get(weapon['_source']['turret'],{})
    life=n(c,'@global fuel_time')
    _same(helper,'hiddenAction_自爆','autoTrigger',f'if self.customTimer>{life:g} and self.parent==null and self.tags(includes="导弹")'+('' if semi else ' and not self.tags(includes="命中")'))
    _same(helper,'hiddenAction_锁定','buildSpeed','0.1s')
    _same(helper,'turret_LEAD','delay','10')
    # These template families have distinct loss and reacquisition policies.
    if semi:
        _same(helper,'hiddenAction_脱锁','requireConditional',f'if self.resource.脱锁次数<{n(c,"@global RL_time"):g}')
        _same(helper,'hiddenAction_复锁尝试','setUnitMemory','TRACK=self.customTarget1.attacking')
    else:
        _same(helper,'action_SPEED_SET','setUnitStats','movespeed=self.maxMoveSpeed-3')
        _same(helper,'action_SPEED_UP','setUnitStats','movespeed=self.maxMoveSpeed+0.15')
        _same(helper,'action_SPEED_DOWN','setUnitStats','movespeed=self.maxMoveSpeed-0.025')
        _same(helper,'hiddenAction_锁定','setUnitStats','targetHeight=memory.TRACK.height,moveSpeed+=self.customTarget1.maxMoveSpeed()/2')
        _same(helper,'hiddenAction_数据链复锁','setResourcesWithLogic','脱锁次数=0')
    fov=180 if semi else n(c,'@global FOV',180)
    projectile=helper['projectile_MISSLE' if semi else 'projectile_AIM120']
    launch=helper['hiddenAction_脱离路径点']
    leg=_number(launch['addWaypoint_position_relativeOffsetFromSelf'].split(',')[-1],'launch offset',0,1000)
    flight={'speed':n(m,'moveSpeed')*60*WORLD_SCALE,
        'heightRate':n(m,'heightChangeRate')*60*WORLD_SCALE,
        'acceleration':n(m,'moveAccelerationSpeed')*3600*WORLD_SCALE,
        'turnRate':math.radians(n(m,'maxTurnSpeed'))*60,
        'turnAcceleration':math.radians(n(m,'turnAcceleration'))*3600,
        'inheritSpeed':0 if semi else .5,'launchLeg':leg*WORLD_SCALE,
        'launchTime':seconds(launch['addWaypoint_maxTime']),'sample':10/60,
        'lossDelay':2.1,'fovDegrees':fov,'life':life+.1,
        'resistance':n(c,'energyMax'),'proximity':n(c,'@global Radius')*WORLD_SCALE,
        'blastRadius':n(projectile,'areaRadius')*WORLD_SCALE,
        'radar':{'semiActive':semi,'range':n(c,'@global Radar_range')*WORLD_SCALE,
            'ecmX':n(c,'@global ECM_X')*WORLD_SCALE,'ecmY':n(c,'@global ECM_Y'),
            'lowPenalty':n(c,'@global ECM_LAT'),'lostChecks':n(c,'@global RL_time')*(1 if semi else 5),
            'canLose':c.get('@global RL')=='true','lockDelay':.1,
            'scriptInterval':.1 if semi else 8/60,'seekerInterval':10/60,
            'speedDrop':0 if semi else 3*60*WORLD_SCALE,
            'speedUp':0 if semi else .15*60*WORLD_SCALE,
            'speedDown':0 if semi else .025*60*WORLD_SCALE,
            'speedFloor':n(c,'@global initial_speed')*.75*60*WORLD_SCALE}}
    return {'mode':'self','channel':RADAR_CHANNEL,'range':weapon['range'],
        'cone':math.radians(fov),'launchArc':math.radians(min(180,_number(t.get('limitingAngle','180'),'launch arc',0,360))),
        'turnRate':flight['turnRate'],'maxLife':flight['life'],'sourceFlight':flight}


def source_radar_control(ini, definition):
    created = ini.get('hiddenAction_SETRADAR', {})
    if created.get('temporarilyAddTags') != '雷达工作中,等待指示':
        return None
    _same(ini, 'hiddenAction_SETRADAR', 'autoTriggerOnEvent', 'created')
    for name, added, removed in (('action_雷达显示','OFF','雷达工作中,等待指示'), ('action_雷达显示2','雷达工作中,等待指示','OFF')):
        for key,value in {'temporarilyAddTags':added,'temporarilyRemoveTags':removed,'buildSpeed':'0.5s','addActionCooldownTime':'10s','addActionCooldownApplyToActions':'雷达显示,雷达显示2','isLocked':'false'}.items():
            _same(ini,name,key,value)
    memory=re.fullmatch(r'radar=([\d.]+),radars=([\d.]+)',created.get('setUnitMemory',''))
    if not memory:raise SourceMismatch('radar memory requires literal detection range and capacity')
    values=[];ground=None
    for name in ('action_雷达显示2','action_雷达显示'):
        raw=ini[name].get('setUnitStats','')
        direct=re.fullmatch(r'maxAttackRange=([\d.]+)',raw)
        conditional=re.fullmatch(r'maxAttackRange=select\(self.hasFlag\(id=1\),([\d.]+),([\d.]+)\)',raw)
        if direct:values.append(float(direct[1]))
        elif conditional:
            if ground is not None and ground!=float(conditional[1]):raise SourceMismatch('radar ground mode range changes between power states')
            ground=float(conditional[1]);values.append(float(conditional[2]))
        else:raise SourceMismatch('unreviewed radar engagement range expression')
    out={'range':float(memory[1])*RANGE_SCALE,'rangeOn':values[0]*RANGE_SCALE,'rangeOff':values[1]*RANGE_SCALE,'switchTime':.5,'cooldown':10,'interval':.1,'weapons':[]}
    if ground is not None:
        _same(ini,'action_AA','autoTrigger',f'if not self.hasFlag(id=1) and (distanceBetween(self,self.attacking)<{ground:g} and attacking.height<10)')
        _same(ini,'action_AT','autoTrigger','if self.hasFlag(id=1) and (self.attacking==null or self.attacking.height>10)')
        for name,flag in (('action_AA','setFlag=1'),('action_AT','unsetFlag=1')):
            _same(ini,name,'buildSpeed','0.05s');_same(ini,name,'addResources',flag)
        _same(ini,'action_AA','setUnitStats',f'maxAttackRange={ground:g}')
        # autoTrigger executes effects directly; buildSpeed applies only to a
        # player queue. These info-only, locked actions never enter that queue.
        out.update(groundRange=ground*RANGE_SCALE,groundTime=0)
        for weapon in definition.get('weapons',[]):
            turret=ini.get(weapon.get('_source',{}).get('turret'),{})
            chain=[turret]
            while chain[-1].get('attachedTo'):
                parent=ini.get('turret_'+chain[-1]['attachedTo'],{})
                if parent in chain:break
                chain.append(parent)
            condition=turret.get('canAttackCondition','')
            if re.search(r'not\s+self.hasFlag\(id=1\)',condition):mode='air'
            elif re.search(r'self.hasFlag\(id=1\)',condition):mode='ground'
            else:
                flying=next((t.get('canAttackFlyingUnits','') for t in chain if 'self.hasFlag(id=1)' in t.get('canAttackFlyingUnits','')),'')
                land=next((t.get('canAttackLandUnits','') for t in chain if 'self.hasFlag(id=1)' in t.get('canAttackLandUnits','')),'')
                if 'not self.hasFlag(id=1)' in flying and 'self.hasFlag(id=1)' in land and 'not self.hasFlag(id=1)' not in land:
                    out['weapons'].append({'id':weapon['id'],'mode':'target'});continue
                domains=weapon.get('targets',[])
                clause=turret.get('canAttackFlyingUnits' if domains==['air'] else 'canAttackLandUnits','')
                if 'self.hasFlag(id=1)' not in clause:continue
                mode='air' if 'not self.hasFlag(id=1)' in clause else 'ground'
            out['weapons'].append({'id':weapon['id'],'mode':mode})
    return out


def source_flight_controls(ini, definition=None):
    """Fixed-wing template actions, gated on literal source clauses, not names."""
    if 'action_加力' not in ini or '固定翼' not in ini.get('core', {}).get('tags', '').split(','):
        return None
    m = ini['movement']
    speed = m['moveSpeed']
    ranged = ini.get('action_上高', {}).get('setUnitStats') == 'targetHeight=200,maxAttackRange+=400'
    for name, values in {
        'action_上高': {'temporarilyAddTags': '高空', 'temporarilyRemoveTags': '低空', 'setUnitMemory': 'Stats[1]=200+rnd(-20,20)', 'setUnitStats': 'targetHeight=memory.Stats[1]', 'buildSpeed': '0.1s', 'addActionCooldownTime': '5s', 'addActionCooldownApplyToActions': '上高,下高'},
        'action_下高': {'temporarilyAddTags': '低空', 'temporarilyRemoveTags': '高空', 'setUnitMemory': 'Stats[1]=100+rnd(-20,20)', 'setUnitStats': 'targetHeight=memory.Stats[1]', 'buildSpeed': '0.1s', 'addActionCooldownTime': '5s', 'addActionCooldownApplyToActions': '上高,下高'},
        'action_加力': {'setUnitMemory': f'Stats[0]=memory.Stats[0]+0.2*{speed}', 'addActionCooldownTime': '20s', 'resetCustomTimer': 'true'},
        'hiddenAction_加力2': {'autoTrigger': 'if self.tags(Includes="加力") and self.customTimer>15', 'setUnitMemory': f'Stats[0]=memory.Stats[0]-0.2*{speed}'},
        'action_减速板': {'setUnitMemory': f'Stats[0]=memory.Stats[0]-0.2*{speed},Stats[2]=memory.Stats[2]+0.4'},
        'action_减速板2': {'setUnitMemory': f'Stats[0]=memory.Stats[0]+.2*{speed},Stats[2]=memory.Stats[2]-0.4'},
    }.items():
        for key, value in values.items():
            if ranged and key == 'setUnitStats' and name in ('action_上高', 'action_下高'):
                value = 'targetHeight=200,maxAttackRange+=400' if name == 'action_上高' else 'targetHeight=100,maxAttackRange-=400'
            _same(ini, name, key, value)
    for suffix in ('1', '3', '5'):
        _same(ini, 'hiddenAction_受损'+suffix, 'setUnitMemory', f'Stats[0]=memory.Stats[0]-0.05*{speed}')
        _same(ini, 'hiddenAction_受损'+suffix, 'requireConditional', 'if self.isMoving()')
    tags = ini['core']['tags'].split(',')
    height_weapons=[]
    for weapon in (definition or {}).get('weapons', []):
        turret=ini.get(weapon.get('_source', {}).get('turret'), {})
        conditions=' '.join(turret.get(k,'') for k in ('canAttackCondition','canAttackFlyingUnits','canAttackLandUnits'))
        gates=re.findall(r'self\.height\s*([<>])\s*([\d.]+)',conditions)
        if gates:
            height_weapons.append({'id':weapon['id'],**{('below' if sign=='<' else 'above'):float(value)*WORLD_SCALE for sign,value in gates}})
    return {'initial': 'low' if '低空' in tags else 'high' if '高空' in tags else 'normal',
        'initialHeight': _number(m.get('targetHeight'), 'targetHeight', 0, 10000)*WORLD_SCALE,
        'lowHeight': 100*WORLD_SCALE, 'highHeight': 200*WORLD_SCALE, 'heightSpread': 0 if ranged else 20*WORLD_SCALE,
        'heightRate': _number(m.get('heightChangeRate'), 'heightChangeRate', .01, 10000)*60*WORLD_SCALE,
        'altitudeTime': .1, 'altitudeCooldown': 5,
        'thrust': .2, 'thrustDuration': 15, 'thrustCooldown': 20,
        'brake': .2, 'brakeTurn': math.radians(.4)*60,
        'damageThresholds': [.75, .5, .25], 'damageSpeed': .05,
        **({'heightWeapons':height_weapons} if height_weapons else {}),
        **({'highRangeBonus': 400*RANGE_SCALE, 'rangeWeapons': [w['id'] for w in (definition or {}).get('weapons', []) if 'limitingRange' not in ini.get(w.get('_source', {}).get('turret'), {})]} if ranged else {})}


if __name__ == "__main__":
    write_source_audit()

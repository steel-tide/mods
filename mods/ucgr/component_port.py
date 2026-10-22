"""Compile source-backed UCGR component, armor and ordnance policies.

Shared template families are selected by field provenance, not vehicle names.
Unknown supply/crew/action contracts remain omitted instead of approximated.
"""
import json
import math
from pathlib import Path
from logistics_port import tank_stocks, vehicle_supply, initial_display_stock, paid_vehicle_initial, aps_policy, MAIN_STOCKS
from weapons import seconds, source_index, helper_payload
import re

import rw
from movement_port import source_movement
from achievement_port import source_achievements


CAPABILITY = 'components-v1'

# These are source field names, not invented engine channels or reserve seats.
SOURCE_GLOBALS = (
    'top', 'frontA', 'sideA', 'backA', 'frontAH', 'sideAH', 'backAH',
    'frontAEA', 'sideAEA', 'backAEA', 'frontAEH', 'sideAEH', 'backAEH',
    'AmDir', 'front', 'side', 'back', 'c1', 'c2', 'c3', 'c4',
    'amRa', 'tra', 'dri', 'eng', 'gun', 'crewR', 'time', 'time1',
)


def _relative(path):
    """Keep generated evidence portable and free of local absolute paths."""
    if not path:
        return None
    try:
        return Path(path).resolve().relative_to(rw.RW.resolve()).as_posix()
    except ValueError:
        return None


def _evidence(ini, section, field, fallback):
    value = ini.get(section, {}).get(field)
    if value is None:
        return None
    return {
        'source': _relative(getattr(ini, 'origins', {}).get(section, {}).get(field)) or fallback,
        'section': section,
        'field': field,
        'value': value,
    }


def _find(ini, field, pattern, source):
    """Locate source text only; never evaluate a condition or infer its result."""
    return [
        _evidence(ini, section, field, source)
        for section, fields in ini.items()
        if section.startswith(('action_', 'hiddenAction_'))
        and re.search(pattern, fields.get(field, ''))
    ]


def _number(value):
    try:
        out = float(value)
        return out if math.isfinite(out) else None
    except (ValueError, TypeError):
        return None


def audit_components(entry, ini, definition):
    """Return source-backed evidence; no source or definition is mutated.

    A detected source loop is deliberately all-or-nothing. Absence of a known
    blocker is not permission to compile an unreviewed script into extensions.
    Incoming helper payloads are discovered from each converted weapon's
    retained ``_source.helper`` metadata, supplied by weapons.py.
    """
    source = entry['source']
    report = {
        'capability': CAPABILITY,
        'source': source,
        'rwName': entry.get('rwName'),
        'definition': definition.get('id', entry.get('id')),
        'status': 'not-applicable',
        'bindings': [],
        'sourceValues': {},
        'gaps': [],
    }
    hits = _find(ini, 'setUnitMemory', r'eventData\(name=["\']amRa1["\']', source)
    if not hits:
        return report

    report['status'] = 'omitted'
    for name in SOURCE_GLOBALS:
        record = _evidence(ini, 'core', '@global ' + name, source)
        if record:
            report['sourceValues'][name] = record

    def gap(code, reason, records):
        records = [record for record in records if record]
        if records:
            report['gaps'].append({'code': code, 'reason': reason, 'evidence': records})

    gap('stock-dependent-rack-failure',
        'Rack failure compares accumulated damage with base durability plus the '
        'empty-rack allowance. This needs an audited stockThreshold mapping, not a fixed part HP.',
        _find(ini, 'autoTrigger', r'memory\.amRa\s*>[^\n]*memory\.空弹药架', source))
    gap('reserve-crew-pool',
        'Reserve crew have pooled health with integer/conditional arithmetic; crew loss, '
        'replacement and vehicle destruction depend on that pool. The reserve policy must be '
        'audited for this template before activation.',
        _find(ini, 'setResourcesWithLogic', r'crewRhp=int\(', source)
        + _find(ini, 'autoTrigger', r'memory\.dri[^\n]*memory\.gun[^\n]*crewR==0', source))
    gap('shared-quantized-repair-clock',
        'Component repair uses one shared timer, including floor(0.5 * progress) after '
        'a component hit and source action ordering when several parts qualify. This template '
        'requires an audited repairGroup policy.',
        _find(ini, 'setResourcesWithLogic', r'time=int\(0\.5\*self\.resource\.time\)', source)
        + [_evidence(ini, 'hiddenAction_crewTra', 'autoTrigger', source),
           _evidence(ini, 'hiddenAction_crewEng', 'autoTrigger', source)])
    gap('coupled-mobility-formula',
        'Source turn speed includes an additive term after the shared movement modifier. '
        'This requires an audited turnFromSpeed policy with matching wound effects.',
        _find(ini, 'setUnitStats', r'maxTurnSpeed=self\.resource\.speed_modifer\*[^,\n]*\+', source))

    # Source protection and incoming payloads are a coupled contract. It would
    # be misleading to publish a protection card with no compatible projectiles.
    if 'hiddenAction_fain' in ini or 'hiddenAction_ammoRacDes' in ini:
        gap('component-only-kill-chain',
            'The source routes armored damage into component events and component-dependent '
            'kill actions. Do not attach zero-hull AP while omitting its kill conditions, '
            'or fabricate hull damage to compensate for those missing conditions.',
            hits + [_evidence(ini, 'core', 'armour', source),
                    _evidence(ini, 'core', 'armourMinDamageToKeep', source),
                    _evidence(ini, 'hiddenAction_fain', 'autoTrigger', source),
                    _evidence(ini, 'hiddenAction_ammoRacDes', 'autoTrigger', source)])

    seen_helpers = set()
    for weapon in definition.get('weapons', []):
        meta = weapon.get('_source', {})
        helper_meta = meta.get('helper', {}) if isinstance(meta, dict) else {}
        helper_source = helper_meta.get('source') if isinstance(helper_meta, dict) else None
        if not helper_source or helper_source in seen_helpers:
            continue
        seen_helpers.add(helper_source)
        path = (rw.RW / helper_source).resolve()
        # Even provenance is data. Restrict the optional audit read to the supplied pack.
        if not path.is_relative_to(rw.RW.resolve()) or not path.is_file():
            gap('unresolved-projectile-provenance',
                'The projectile helper cannot be verified inside the supplied RW pack.',
                [{'source': source, 'section': meta.get('turret', ''),
                  'field': '_source.helper.source', 'value': helper_source}])
            continue
        helper = rw.load_unit(path)
        if '@global apCoe' not in helper.get('core', {}):
            continue
        gap('projectile-current-source-range',
            'AP penetration samples distance to the current firing unit and includes '
            'source experience modifiers. An audited rangeOrigin=source polynomial covers '
            'initial rank; source experience remains outside this mapping.',
            _find(helper, 'setUnitMemory', r'distanceBetweenSquared\(self,customTarget1\)', helper_source))
        if helper.get('hiddenAction_bERA', {}).get('sendMessageWithTags') == 'sERA':
            gap('rear-hit-side-layer-routing',
                'The supplied AP script sends rear-hit layer wear to the side layer. '
                'An audited wearFaces mapping preserves this source behavior rather '
                'than silently correcting it.',
                [_evidence(helper, 'hiddenAction_bERA', field, helper_source)
                 for field in ('requireConditional', 'sendMessageWithTags', 'sendMessageWithData')])
        gap('helper-impact-target-selection',
            'The helper selects a nearby armored enemy and tests its source radius. '
            'v1 routes the payload to the projectile impact target; it has no equivalent '
            'authored post-impact recipient-selection policy.',
            _find(helper, 'setUnitMemory', r'eneTank=self\.nearestUnit\(', helper_source)
            + [_evidence(helper, 'hiddenAction_getParameters',
                         'alsoTriggerOrQueueActionConditional', helper_source)])

        payload_section = helper_meta.get('projectile')
        payload = helper.get(payload_section, {})
        armor = _number(ini.get('core', {}).get('armour'))
        minimum = _number(ini.get('core', {}).get('armourMinDamageToKeep'))
        ignore = _number(payload.get('armourIgnoreAmount'))
        damage = _number(payload.get('areaDamage'))
        multiplier = _number(payload.get('mutator2_areaDamageMultiplier'))
        if (armor is not None and minimum == 0 and ignore is not None and damage is not None
                and multiplier is not None and payload.get('mutator2_ifUnitWithTags') == '装甲'
                and armor - ignore > damage * multiplier):
            gap('native-hull-payload-is-not-parity',
                'The ordinary AP blast is below this source vehicle armor even after '
                'its armor-ignore amount and armored-target multiplier. The existing '
                'MVP HP weapon must not be presented as a source-faithful component payload.',
                [_evidence(ini, 'core', field, source)
                 for field in ('armour', 'armourMinDamageToKeep')]
                + [_evidence(helper, payload_section, field, helper_source)
                   for field in ('areaDamage', 'armourIgnoreAmount',
                                 'mutator2_ifUnitWithTags', 'mutator2_areaDamageMultiplier')])

    # Keep a fail-closed result even if a future source revision changes the
    # recognized expressions: recognition alone never authorizes activation.
    if not report['gaps']:
        gap('unreviewed-component-loop',
            'A source component damage handler exists, but this revision has no '
            'verified complete components-v1 mapping. No partial binding is emitted.', hits)
    return report


def fixed_rack_template(ini):
    """The shared vehicle template has no finite main inventory or rack increment.

    Its ordinary weapon magazines remain independent: the source never counts
    these magazines as empty main-round rack space.
    """
    if any(k in ini.get('core', {}) for k in ('@global APShellAmount', '@global HEShellAmount', '@global HEATShellAmount', '@global ATGMamount')):
        return False
    if any('空弹药架=' in a.get('setUnitMemory', '').replace(' ', '') for a in ini.values()):
        return False
    if vehicle_supply(ini) or initial_display_stock(ini) or paid_vehicle_initial(ini) or aps_policy(ini):
        return True
    service = ini.get('action_弹药补给', {})
    return (seconds(service.get('buildSpeed')) == 10 and service.get('whenBuilding_cannotMove') == 'true'
            and not any(service.get(k) for k in ('price', 'takeResources', 'alsoTriggerAction', 'alsoQueueAction', 'setResourcesWithLogic')))


def supports_components(entry, ini=None):
    """Recognize the reviewed shared tank policies, independently of vehicle name.

    A different supply action, open-compartment pressure rule, or overridden
    damage/repair action is a separate contract and remains fail-closed.
    """
    if ini is None:
        source = entry.get('source')
        if not source:
            return entry.get('rwName') == 'T90M'
        ini = rw.load_unit(rw.RW / source)
    if not fixed_rack_template(ini) and tank_stocks(ini) is None:
        return False
    if _number(ini.get('core', {}).get('@global opeBatR')) is None:
        return False
    policies = ('hiddenAction_hit', 'hiddenAction_HEhit', 'hiddenAction_fain',
                'hiddenAction_ammoRacDes', 'hiddenAction_modReCount',
                'hiddenAction_crewTra', 'hiddenAction_crewEng', 'hiddenAction_crewDri',
                'hiddenAction_crewGun', 'hiddenAction_crewGun_suppMemb', 'hiddenAction_crewDri_suppMemb')
    for section in policies:
        fields = ini.get(section, {})
        origins = getattr(ini, 'origins', {}).get(section, {})
        if not fields:
            return False
        for key in ('autoTrigger', 'autoTriggerOnEvent', 'setUnitMemory', 'setResourcesWithLogic'):
            if key in fields and _relative(origins.get(key)) not in ('tem/tank.key', '模板/坦克模板.key'):
                return False
    return all(_number(ini.get('core', {}).get('@global ' + key)) is not None for key in SOURCE_GLOBALS) and _global(ini, 'crewR') >= 0


def _global(ini, name):
    value = _number(ini.get('core', {}).get('@global ' + name))
    if value is None:
        raise ValueError(f'non-numeric source global {name}')
    return value


def _helper(weapon):
    meta = weapon.get('_source', {}).get('helper', {})
    path = (rw.RW / meta.get('source', '')).resolve()
    if not path.is_relative_to(rw.RW.resolve()) or not path.is_file():
        raise ValueError('unresolved projectile helper')
    return rw.load_unit(path), meta


def incoming_projectile(ini, section):
    p = ini.get(section, {})
    tags = [t.strip() for t in p.get('tags', '').split(',') if t.strip()]
    if not set(tags) & {'ATGM', 'ATGM2'}:
        return None
    out = {'tags': tags, 'end': p.get('explodeOnEndOfLife') == 'true'}
    chain = p.get('spawnProjectilesOnEndOfLife', 'IGNORE')
    if chain.upper() not in ('NONE', 'IGNORE', ''):
        match = re.fullmatch(r'([^()]+)\(spawnChance=([\d.]+),offsetRandomDir=([\d.]+)\)', chain)
        if not match:
            return None
        child = ini.get('projectile_' + match[1], {})
        if not child or child.get('spawnUnit') != p.get('spawnUnit') or child.get('spawnProjectilesOnEndOfLife', 'IGNORE').upper() not in ('NONE', 'IGNORE', ''):
            return None
        allowed = {'life', 'speed', 'tags', 'spawnProjectilesOnEndOfLife', '@copyFromSection'}
        if any(p.get(k) != v for k, v in child.items() if k not in allowed):
            return None
        out['child'] = {'chance': float(match[2]), 'angle': float(match[3])*math.pi/180,
                        'life': seconds(child['life']), 'speed': float(child['speed'])*24,
                        'tags': [t.strip() for t in child.get('tags', '').split(',') if t.strip()]}
    return out


def hp_phase(projectile):
    """Constant direct and area HP branches stay additive and keep own mutators."""
    if not projectile:
        return None
    numeric = {k: _number(projectile.get(k, 0)) for k in ('directDamage', 'areaDamage', 'areaRadius', 'armourIgnoreAmount')}
    if any(v is None or v < 0 for v in numeric.values()):
        return None
    if numeric['directDamage'] == numeric['areaDamage'] == 0:
        return {}
    mutators = []
    prefixes = {k.split('_',1)[0] for k in projectile if k.startswith('mutator')}
    for prefix in sorted(prefixes):
        direct, area = projectile.get(prefix+'_directDamageMultiplier', '1'), projectile.get(prefix+'_areaDamageMultiplier', '1')
        if _number(direct) is None or _number(area) is None:
            return None
        mutators.append({'with': [x.strip() for x in projectile.get(prefix+'_ifUnitWithTags', '').split(',') if x.strip()],
                         'without': [x.strip() for x in projectile.get(prefix+'_ifUnitWithoutTags', '').split(',') if x.strip()],
                         'direct': float(direct), 'area': float(area)})
    expand = seconds(projectile.get('areaExpandTime', '0'))
    if expand < 0 or expand > 60:
        return None
    return {'direct': numeric['directDamage']*.6, 'area': numeric['areaDamage']*.6, 'radius': numeric['areaRadius']*.4,
            'ignore': numeric['armourIgnoreAmount']*.6, 'fromEdge': projectile.get('areaRadiusFromEdge') == 'true',
            'noFalloff': projectile.get('areaDamageNoFalloff') == 'true', 'friendly': projectile.get('friendlyFire') == 'true',
            'targetGround': projectile.get('targetGround') == 'true', 'mutators': mutators,
            **({'expand': expand} if expand else {})}


def spawned_payloads(projectile):
    """Reviewed simultaneous AP/HE/HEAT/TAM helpers, with source world offsets.

    OffsetX/Y in RW unit spawn lists are world axes, not the firing turret's
    local frame. A nonconstant or unknown clause rejects the whole chain.
    """
    text = projectile.get('spawnUnit', '')
    entries = re.split(r',\s*(?![^()]*\))', text)
    if len(entries) < 2 or len(entries) > 64:
        return None
    out = []
    for raw in entries:
        m = re.fullmatch(r'\s*([^()*]+)(?:\*([1-9]\d*))?(?:\(([^()]*)\))?\s*', raw)
        if not m or m[1].strip() not in source_index():
            return None
        opts = {}
        for opt in (m[3] or '').split(','):
            if not opt.strip():
                continue
            pair = opt.strip().split('=')
            if len(pair) != 2 or pair[0] not in ('offsetX', 'offsetY') or _number(pair[1]) is None:
                return None
            opts[pair[0]] = float(pair[1])*.4
        entry = source_index()[m[1].strip()]
        h = rw.load_unit(rw.RW / entry['source'])
        hp = helper_payload(h)
        if not hp:
            return None
        fake = {'id': 'spawn', '_source': {'helper': {'source': entry['source'], 'projectile': hp[0]}}}
        payload = compile_component_payloads({'weapons': [fake]}, {}).get('spawn')
        if not payload or not payload.get('sourceHelper') or 'hpPhases' not in payload:
            return None
        # HE forest selection changes only this helper's HP phase. The parent
        # and other helpers do not inherit its infantry multiplier.
        out.extend({'x': opts.get('offsetX', 0), 'y': opts.get('offsetY', 0), 'payload': payload}
                   for _ in range(int(m[2] or 1)))
        if len(out) > 64:
            return None
    return out


def projectile_motion(projectile, turret=None):
    """RW non-ballistic projectile motion, including its independent z drift.

    Traveling missile helper *units* remain owned by sensors. This policy is
    only the actual projectile: no fabricated tracking or projectile health.
    """
    if not any(_number(projectile.get(k, 0)) for k in ('gravity','trueGravity','initialUnguidedSpeedHeight','targetSpeed','targetSpeedAcceleration','turnSpeed')):
        return None
    if any(projectile.get(k, 'false') != 'false' for k in ('ballistic','instant','autoTargetingOnDeadTarget','retargetingInFlight','sweepSpeed')):
        return None
    keys = ('life','speed','speedSpread','targetGroundSpread','initialUnguidedSpeedHeight','initialUnguidedSpeedX','initialUnguidedSpeedY','gravity','trueGravity','targetGroundHeightOffset','targetSpeed','targetSpeedAcceleration')
    defaults={'speed':5,'targetSpeed':0,'targetSpeedAcceleration':.1}
    values = {k:_number(projectile.get(k, defaults.get(k,0))) for k in keys}
    if any(v is None for v in values.values()) or values['life']<=0 or values['speed']<0:
        return None
    turn=_number(projectile.get('turnSpeed',-1));near=_number(projectile.get('turnSpeedWhenNear',-1))
    if turn is None or near is None:
        return None
    return {'life':values['life']/60,'speed':values['speed']*24,'speedSpread':values['speedSpread']*24,
            'spread':values['targetGroundSpread']*.4,'vx':values['initialUnguidedSpeedX']*24,
            'vy':values['initialUnguidedSpeedY']*24,'vz':values['initialUnguidedSpeedHeight']*24,
            'gravity':values['gravity']*24,'trueGravity':values['trueGravity']*1440,
            'targetHeight':values['targetGroundHeightOffset']*.4,'height':float((turret or {}).get('barrelHeight',0))*.4,
            'targetSpeed':values['targetSpeed']*24,'acceleration':values['targetSpeedAcceleration']*1440,
            'turn':turn*math.pi/3,'nearTurn':near*math.pi/3,
            'delay':seconds(projectile.get('delayedStartTimer',0)),
            'ground':projectile.get('targetGround')=='true','includeHeight':projectile.get('targetGround_includeTargetHeight')=='true',
            'noLead':projectile.get('disableLeadTargeting')=='true','end':projectile.get('explodeOnEndOfLife')=='true'}


def source_fragments(helper, origin):
    if origin not in ('tem/ap.key','tem/heat.key','tem/tam.key'):
        return None
    actions=[helper.get('hiddenAction_jud1',{}),helper.get('hiddenAction_jud2',{})]
    if any(a.get('fireTurretXAtGround_withProjectile')!='碎片' or a.get('fireTurretXAtGround_withOffset')!='0,5' for a in actions):
        return None
    counts=[_number(a.get('fireTurretXAtGround_count')) for a in actions]
    if any(n is None or n<0 or n>32 or n!=int(n) for n in counts):
        return None
    rounds=[]
    for name in ['碎片','碎片1']+(['rico'] if origin=='tem/ap.key' else []):
        p=helper.get('projectile_'+name,{});motion=projectile_motion(p);hp=hp_phase(p)
        if not motion or hp is None or p.get('spawnProjectilesOnCreate','') != ('碎片1' if name=='碎片' else ''):
            return None
        rounds.append({'motion':motion,'hpPhases':[hp] if hp else []})
    result={'penetrated':int(counts[0]),'blocked':int(counts[1]),'offset':2,'rounds':rounds}
    if origin=='tem/ap.key':
        a=helper.get('hiddenAction_ricochet',{})
        if a.get('fireTurretXAtGround_withProjectile')!='rico' or a.get('fireTurretXAtGround_withOffset')!='0,220' or a.get('fireTurretXAtGround_count')!='1':
            return None
        result['ricochet']=88
    return result


def compile_component_payloads(definition, ini=None):
    """Compile the actual AP/HE/HEAT helper, using its inherited numeric globals."""
    out = {}
    for weapon in definition.get('weapons', []):
        if not weapon.get('_source', {}).get('helper'):
            projectile = (ini or {}).get(weapon.get('_source', {}).get('projectile'), {})
            tags = projectile.get('tags', '').split(',')
            kind = 'mg' if 'mgp' in tags else 'lmg' if 'lmgp' in tags else None
            if kind and all(_number(ini.get('core', {}).get('@global '+kind+k)) is not None for k in ('Pene', 'Md', 'DmP')):
                channel = {'strong': [.9, 2], 'weak': [0, 0]}
                out[weapon['id']] = {'family': 'kinetic', 'penetration': _global(ini, kind+'Pene'),
                    'strength': _global(ini, kind+'Md'), 'diameter': _global(ini, kind+'DmP'), 'hullDamage': 0,
                    'channels': {'rack': channel, 'crew': channel, 'drive': channel},
                    'layerScale': {'front': 0, 'side': 0, 'rear': 0, 'top': 0},
                    'collateralHullDamage': 0, 'interruptRepair': False, 'bearingOrigin': 'source'}
            continue
        h, meta = _helper(weapon)
        core = h.get('core', {})
        origin = _relative(getattr(h, 'origins', {}).get('hiddenAction_fJ', {}).get('sendMessageWithData'))
        if origin in ('tem/ap.key', 'tem/heat.key'):
            d, strength = _global(h, 'diameCoe'), _global(h, 'modDa')
            ap = origin == 'tem/ap.key'
            if ap:
                channel = lambda a, b=None: {'strong': [a, a if b is None else b], 'weak': [d * .5, d * .5]}
                channels = {'rack': channel(d * 1.5), 'crew': channel(d * 1.5), 'drive': channel(d * 1.75),
                            'reserve': {**channel(d), 'faces': {face: channel(d * .8, d * 1.6) for face in ('side', 'rear')}}}
                decay = _global(h, 'decayCoe')
                payload = {'family': 'kinetic', 'strength': strength * _global(h, 'apCoe'), 'channels': channels,
                           'wear': d * strength / 180, 'jitter': [.95, 1.1],
                           'rangeAdjustment': [decay * 2.5, decay * .25, -decay * .00625],
                           'sourceWeak': {'roll': 50, 'multiplier': .25, 'helperParity': True},
                           'rangeOrigin': 'source', 'ricochet': {'cosine': .9, 'requiresNominalBlock': True}}
            else:
                channel = lambda weak: {'strong': [.75, 1], 'weak': [weak, weak]}
                decay = _global(h, 'decCoe')
                payload = {'family': 'chemical', 'friendlyFire': False, 'strength': strength, 'sourceWeak': {'roll': 80, 'multiplier': .25},
                           'channels': {'rack': channel(0), 'crew': channel(.25), 'drive': channel(.5), 'reserve': channel(.25)},
                           'channelScale': {'engine': _global(h, 'engSp'), 'track': _global(h, 'traSp')},
                           'wear': (d / 2) % 1, 'layerScale': {'front': 1-decay*.2, 'side': 1-decay*.3, 'rear': 1-decay*.3, 'top': 1},
                           'residual': {'base': .5, 'scale': 1, 'max': 1},
                           'blast': {'yield': _global(h, 'wP'), 'radius': int(_global(h, 'exRadi')*1.25)*.4, 'poolCountOffset': 1, 'combined': True}}
            payload.update(positiveArmor=True, penetration=_global(h, 'pene'), hullDamage=0, diameter=d,
                           wearFaces={'rear': 'side'}, collateralHullDamage=0, experience=True,
                           recipient={'range': 40, 'radiusSquared': 1.5})
            out[weapon['id']] = payload
        elif origin == 'tem/tam.key':
            strength, diameter = _global(h, 'modDa'), _global(h, 'diameCoe')
            channel = lambda weak, scale=1: {'strong': [.5*scale, scale], 'weak': [weak*scale, weak*scale]}
            out[weapon['id']] = {'family': 'chemical', 'penetration': _global(h, 'pene'), 'hullDamage': 0,
                'strength': strength, 'diameter': diameter, 'top': True, 'positiveArmor': True, 'exposureFace': 'front',
                'channels': {'rack': channel(.1), 'crew': channel(.1),
                             'engine': channel(.5, _global(h, 'engSp')), 'track': channel(.5, _global(h, 'traSp')),
                             'reserve': {'strong': [1,1], 'weak': [1,1]}},
                'recipient': {'range': 32, 'radiusSquared': 1.5}, 'collateralHullDamage': 0}
        elif _relative(getattr(h, 'origins', {}).get('hiddenAction_created', {}).get('alsoTriggerAction')) == 'tem/he.key':
            out[weapon['id']] = {'family': 'kinetic', 'penetration': 0, 'hullDamage': 0,
                'strength': _global(h, 'norDam') / 4, 'diameter': 1, 'channels': {}, 'collateralHullDamage': 0,
                'friendlyFire': True,
                'blast': {'yield': _global(h, 'wP'), 'radius': int(_global(h, 'exRadi')) * .4, 'poolCountOffset': 1,
                          'forest': {'search': 48, 'radius': int(_global(h, 'exRadi')*.5)*.4, 'infantry': .5}}}
    for payload in out.values():
        if payload.get('recipient') or payload.get('blast'):
            payload['sourceHelper'] = True
    for weapon in definition.get('weapons', []):
        if weapon.get('_source', {}).get('helper') and weapon['id'] in out:
            helper,_=_helper(weapon)
            origin=_relative(getattr(helper,'origins',{}).get('hiddenAction_fJ',{}).get('sendMessageWithData'))
            fragments=source_fragments(helper,origin)
            if fragments:
                out[weapon['id']]['fragments']=fragments
    # HP collateral and ordinary rounds use the source flat-armor contract.
    # This is separate from zero-hull component penetration above.
    for weapon in definition.get('weapons', []):
        meta = weapon.get('_source', {})
        source = (ini or {}).get(meta.get('projectile'), {})
        if meta.get('helper'):
            h, hm = _helper(weapon)
            if weapon['id'] in out or meta.get('attachedMissile') or not max(float(source.get('directDamage', 0)), float(source.get('areaDamage', 0))):
                source = h.get(hm.get('projectile'), {})
        ignore = _number(source.get('armourIgnoreAmount', 0))
        if ignore is None:
            continue
        policy = {'ignore': ignore * .6, 'multipliers': []}
        kind = 'area' if float(source.get('areaDamage', 0)) >= float(source.get('directDamage', 0)) else 'direct'
        for key, value in source.items():
            m = re.fullmatch(r'(mutator\d+)_' + kind + r'DamageMultiplier', key)
            if not m or _number(value) is None:
                continue
            tag, without = source.get(m[1]+'_ifUnitWithTags'), source.get(m[1]+'_ifUnitWithoutTags')
            # Only the source's single-tag predicates are compiled here.
            if tag and ',' not in tag and not without:
                policy['multipliers'].append({'tag': tag, 'value': float(value)})
        out.setdefault(weapon['id'], {'family': 'ordinary', 'penetration': 0})['ordinary'] = policy
        original = (ini or {}).get(meta.get('projectile'), {})
        phases = [hp_phase(original) if original else {}]
        if meta.get('helper'):
            helper, hm = _helper(weapon)
            phase = hp_phase(helper.get(hm.get('projectile'), {}))
            if phase and out[weapon['id']].get('blast', {}).get('forest'):
                phase['forest'] = True
            phases.append(phase)
        if phases and all(p is not None for p in phases):
            out[weapon['id']]['hpPhases'] = [p for p in phases if p]
        incoming = incoming_projectile(ini or {}, meta.get('projectile'))
        if incoming:
            out[weapon['id']]['incoming'] = incoming
        spawned = spawned_payloads(original)
        if spawned is not None:
            primary = hp_phase(original)
            if primary is not None:
                out[weapon['id']] = {'family': 'ordinary', 'penetration': 0,
                    'hpPhases': [primary] if primary else [], 'spawned': spawned,
                    **({'incoming': incoming} if incoming else {})}
        motion = projectile_motion(original, (ini or {}).get(meta.get('turret'), {}))
        if motion:
            out[weapon['id']]['motion'] = motion
        turret = (ini or {}).get(meta.get('turret'), {})
        warmup = seconds(turret.get('warmup'))
        if warmup > 0 and turret.get('warmupNoReset', 'false').lower() == 'false' and _number(turret.get('warmupShootDelayTransfer', 0)) == 0:
            decay = _number(turret.get('warmupCallDownRate', 4))
            delay = seconds(turret.get('delay', (ini or {}).get('attack', {}).get('shootDelay')), .5)
            if decay is not None and decay >= 0 and delay > 0:
                out[weapon['id']]['warmup'] = {'seconds': warmup, 'decay': decay}
    return out


def source_armor(ini):
    core = ini.get('core', {})
    return {'armor': float(core.get('armour', 0))*.6,
            'minimum': float(core.get('armourMinDamageToKeep', 1 if float(core.get('armour', 0)) else 0))*.6,
            'tags': [tag.strip() for tag in core.get('tags', '').split(',') if tag.strip()]}


def compile_t90_components(ini, definition):
    """Compile the bounded, reviewed source template; no expression execution.

    Payload helpers, resolved globals and source action constants jointly form
    this mapping. It deliberately does not opt arbitrary tank scripts in.
    """
    fixed_rack = fixed_rack_template(ini)
    stocks = definition.get('extensions', {}).get('logistics-v1', {}).get('stocks', [])
    stock_ids = [s['id'] for s in stocks if s['id'] in {v[0] for v in MAIN_STOCKS.values()}]
    expected = {sid: _global(ini, key) for sid, key in [('shell-ap', 'APShellAmount'), ('shell-he', 'HEShellAmount'), ('shell-heat', 'HEATShellAmount'), ('missile-atgm', 'ATGMamount')] if not fixed_rack and _global(ini, key) > 0}
    if {s['id']: s['capacity'] for s in stocks if s['id'] in expected} != expected:
        raise ValueError('source main-round inventory must be bound first')
    payloads = compile_component_payloads(definition, ini)
    # Source display classes are not projectile families: DTP-105 is carried
    # as 高爆弹 but inherits the HEAT helper. Validate each actual stock binding.
    from logistics_port import resource_values
    for resource, sid in [('穿甲弹', 'shell-ap'), ('高爆弹', 'shell-he'), ('破甲弹', 'shell-heat')]:
        if sid not in expected or resource == '高爆弹' and 'AM3' in ini['core'].get('tags', '').split(','):
            continue
        matching = [w for w in definition['weapons'] if resource in (resource_values(ini.get(w.get('_source', {}).get('turret'), {}).get('resourceUsage')) or {})]
        if not matching or any(w['id'] not in payloads or payloads[w['id']]['family'] == 'ordinary' for w in matching):
            raise ValueError('source ' + resource + ' helper is required')
    main_ids = [w['id'] for w in definition['weapons'] if w.get('extensions', {}).get('logistics-v1', {}).get('feed') == 'main-gun']
    if not main_ids and not fixed_rack:
        raise ValueError('main feed not bound')
    coax_ids = [w['id'] for w in definition['weapons'] if w.get('_source', {}).get('turret') == 'turret_PKT']
    def source_conditions(w):
        fields = ini.get(w.get('_source', {}).get('turret'), {})
        return ' '.join(v for k, v in fields.items() if k.startswith('canAttack'))
    gunner_ids = [w['id'] for w in definition['weapons'] if 'memory.gun' in source_conditions(w)]
    driver_ids = [w['id'] for w in definition['weapons'] if 'memory.dri' in source_conditions(w)]
    roof_ids = [w['id'] for w in definition['weapons'] if 'self.resource.crewR' in source_conditions(w)]
    gunner_ids = list(dict.fromkeys(main_ids + coax_ids + gunner_ids))
    def face_values(front, side, rear, top=0):
        return dict(zip(('front', 'side', 'rear', 'top'), (front, side, rear, top)))
    def armor(suffix, top=0):
        return face_values(*[_global(ini, face + suffix) for face in ('front', 'side', 'back')], top)
    layouts = {face: int(_global(ini, key)) for face, key in (('front', 'front'), ('side', 'side'), ('rear', 'back'))}
    def layout(value):
        return {'rack': value // 1000000, 'track': value // 100000 % 10,
                'driver': value // 10000 % 10, 'engine': value // 100 % 100, 'gunner': value % 100}
    decoded = {face: layout(value) for face, value in layouts.items()}
    def exposure(part):
        return {**{face: values[part] / 9 * (2 if part == 'track' else 1) for face, values in decoded.items()}, 'top': 0}
    def band(above, lo, hi=None, scale='part'):
        return {'above': above, 'damage': [lo, lo if hi is None else hi], 'scale': scale}
    labels = {'rack': ['Ammunition rack', '弹药架', '탄약고'], 'track': ['Tracks', '履带', '궤도'],
              'driver': ['Driver', '驾驶员', '조종수'], 'engine': ['Engine', '发动机', '엔진'],
              'gunner': ['Gunner', '炮手', '포수']}
    globals_for = {'rack': 'amRa', 'track': 'tra', 'driver': 'dri', 'engine': 'eng', 'gunner': 'gun'}
    parts = []
    for part in ('rack', 'track', 'driver', 'engine', 'gunner'):
        p = {'id': part, 'label': labels[part], 'hp': _global(ini, globals_for[part]), 'damageLimit': 1e6,
             'channel': 'rack' if part == 'rack' else 'crew' if part in ('driver', 'gunner') else 'drive',
             'exposure': exposure(part), 'damagedAt': .65, 'damagedBelow': 1, 'repairs': []}
        if part in ('track', 'engine', 'driver'):
            p.update(damaged={'speed': .5 if part == 'driver' else .8}, destroyed={'speed': 0, 'turn': 0})
        elif part == 'gunner':
            p.update(damaged={'reloadAdd': .1}, destroyed={'disableWeapons': gunner_ids})
        else:
            p.update(damaged={'reloadAdd': .5}, latchDamaged=True, failure={'destroy': True, 'hullRange': [60, 600]},
                     stockThreshold={'stocks': stock_ids, 'perMissing': p['hp'] / sum(expected.values()) if expected else 0, 'strict': True, 'rebaseOnRefill': True})
        if part == 'driver' and driver_ids:
            p['destroyed']['disableWeapons'] = driver_ids
        if part == 'rack' and fixed_rack:
            p.pop('stockThreshold')
            p['strict'] = True
        if part in ('driver', 'gunner'):
            p['crew'] = True
            p['blast'] = [band(.15, 5), band(.05, .95, 1.2)]
        elif part == 'track':
            p['blast'] = [band(.02, .25, .75), band(0, 1, scale='yield-pressure-part')]
        else:
            p['blast'] = [band(.07, .8, 1)]
        if part in ('track', 'engine'):
            p['repairs'].append({'seconds': _global(ini, 'time'), 'fromDamage': 1, 'startAbove': 1, 'toDamage': .65, 'auto': True})
        manual = {'seconds': _global(ini, 'time') * 1.3, 'fromDamage': .65, 'untilDamage': 1, 'toDamage': 0}
        if part == 'rack' and not fixed_rack:
            manual['accrueToStockThreshold'] = True
        if part in ('rack', 'driver', 'gunner'):
            manual.update(provider='maintenance', range=96)
        p['repairs'].append(manual)
        parts.append(p)
    cfg = {'sourceArmor': source_armor(ini), 'sourceRadius': float(ini['core']['radius']) * .4,
           'experience': {'kind': 'armor', 'value': _global(ini, 'killt')},
           'sourceCombat': {'label': ['Morale', '士气', '사기'], 'initial': 60, 'interval': .1,
                            'baseAccuracy': _global(ini, 'Accuracy'), 'movingAccuracy': _global(ini, 'Accuracy_SP'),
                            'range': float(ini['attack']['maxAttackRange']) * .4}, 'protection': {'frontHalfAngle': _global(ini, 'AmDir'), 'rearHalfAngle': _global(ini, 'AmDir'), 'incidence': True,
                         'families': {'kinetic': armor('A', _global(ini, 'top')), 'chemical': armor('AH', _global(ini, 'top'))},
                         'layers': {'kinetic': armor('AEA'), 'chemical': armor('AEH')}},
           'abandon': {'label': ['Abandon vehicle', '弃车', '차량 포기'], 'seconds': 5}, 'parts': parts, 'repairHitRetention': .5, 'turnFromSpeed': [.5, .5], 'failureDelay': 3.5, 'clearOrdersWhenImmobile': True,
           'crew': {'priority': ['gunner', 'driver'], 'replacements': [{'from': 'driver', 'to': 'gunner'}, {'from': 'gunner', 'to': 'driver'}],
                    'seconds': _global(ini, 'time1'), 'automatic': False, 'destroyWhenEmpty': True, 'requiresEmptyReserve': True, 'vacatedExtra': 10},
           'reserve': {'label': ['Reserve crew', '后备乘员', '예비 승무원'], 'capacity': int(_global(ini, 'crewR')),
                       'hpPerMember': 100, 'damageHp': _global(ini, 'dri'), 'channel': 'reserve',
                       'exposure': {**{face: (values['driver'] + values['gunner']) / 18 for face, values in decoded.items()}, 'top': 0},
                       'seconds': _global(ini, 'time1'), 'priority': ['gunner', 'driver'], 'roundHealth': True,
                       'refillCosts': {'gunner': 0, 'driver': 1}, 'empty': {'disableWeapons': roof_ids},
                       'blast': [band(.05, 4, 8, 'pressure-part')]},
           'repairGroup': {'interval': .1, 'provider': 'maintenance', 'range': 96, 'floorOnHit': True, 'finishBelow': .65, 'refillProtection': True, 'beginRefill': 'tank-crew',
                           'priority': ['track/0', 'engine/0', 'track/1', 'engine/1', 'driver/0', 'gunner/0', 'rack/0']},
           'blast': {'family': 'kinetic', 'base': 12, 'armorScale': 2, 'coefficient': 240.8 * .4 ** 2, 'minimumDistance': float(ini['core']['radius']) * .4 if _global(ini, 'opeBatR') == 1 else 0}}
    achievements = source_achievements(ini)
    if achievements:
        cfg['achievements'] = achievements
    if cfg['reserve']['capacity'] == 0:
        cfg['reserve']['refillCount'] = 1
    if 'Autoloader' not in ini['core'].get('tags', '').split(','):
        cfg['reserve']['empty']['reloadAdd'] = .5
    commander = re.fullmatch(r'fogOfWarSightRange-=([\d.]+)', ini.get('hiddenAction_fain_commander', {}).get('setUnitStats', ''))
    if commander:
        cfg['commander'] = {'visionPenalty': float(commander[1]) * .25,
                            'reserveThreshold': 0 if 'Autoloader' in ini['core'].get('tags', '').split(',') else 1}
        if cfg['reserve']['capacity'] == 0:
            cfg['commander']['seat'] = 'gunner'
    duration = seconds(ini.get('action_suppMemb', {}).get('buildSpeed'))
    definition.setdefault('extensions', {}).setdefault('logistics-v1', {}).setdefault('serviceSeconds', {})['tank-crew'] = duration
    aps = aps_policy(ini)
    if aps:
        cfg['aps'] = aps
        definition.setdefault('extensions', {}).setdefault('logistics-v1', {}).setdefault('serviceSeconds', {})['tank-resupply'] = 20
    return cfg, payloads


def bind_source_reload(ini, weapon, payload):
    if not payload.get('warmup'):
        return
    turret = ini.get(weapon.get('_source', {}).get('turret'), {})
    delay = seconds(turret.get('delay', ini.get('attack', {}).get('shootDelay')), .5)
    regen = rw.num(ini.get('core', {}).get('energyRegen'))
    if regen > 0:
        delay = max(delay, rw.num(turret.get('energyUsage')) / regen / 60)
    gate = re.search(r'timeAlive\(\)-memory\.[\w]+\s*>=\s*([0-9.]+)', turret.get('canAttackCondition', ''))
    if gate:
        delay = max(delay, float(gate[1]))
    weapon['reload'] = max(.05, delay)


def augment_components(entry, ini, definition):
    """Bind reviewed source component families and independent projectile policies."""
    if supports_components(entry, ini):
        try:
            config, payloads = compile_t90_components(ini, definition)
        except (ValueError, KeyError, TypeError) as error:
            return [f'components-v1 omitted: shared tank component preflight failed ({error}). Existing HP combat remains.']
        definition.setdefault('extensions', {})[CAPABILITY] = config
        for weapon in definition['weapons']:
            if weapon['id'] in payloads:
                weapon.setdefault('extensions', {})[CAPABILITY] = payloads[weapon['id']]
                bind_source_reload(ini, weapon, payloads[weapon['id']])
        return ['components-v1 binds the source shared tank AP/HE/HEAT, rack, crew, protection and repair loop. '
                'Morale/rank, source accuracy, helper-identity weak shots, fragments, additive HP phases, finite APS, warmup and repair policies use reviewed source data. Unrecognized source actions remain omitted; see COMPONENT-GAPS.md.']
    for weapon in definition.get('weapons', []):
        payload = compile_component_payloads({'weapons': [weapon]}, ini).get(weapon['id'])
        if payload:
            weapon.setdefault('extensions', {})[CAPABILITY] = payload
            bind_source_reload(ini, weapon, payload)
    movement = source_movement(ini)
    if movement:
        definition.setdefault('extensions', {}).setdefault(CAPABILITY, {'parts': []})['sourceMovement'] = movement
    achievements = source_achievements(ini)
    if achievements:
        definition.setdefault('extensions', {}).setdefault(CAPABILITY, {'parts': []})['achievements'] = achievements
    award = None
    if ini.get('hiddenAction_fain', {}).get('sendMessageWithTags') == 'kill' and _number(ini.get('core', {}).get('@global killt')) is not None:
        award = {'kind': 'armor', 'value': _global(ini, 'killt')}
    death = ini.get('hiddenAction_击杀', {})
    if death.get('autoTriggerOnEvent') == 'destroyed' and death.get('sendMessageWithTags') == 'killA' and death.get('sendMessageWithData') == 'killA=1':
        award = {'kind': 'air', 'value': 1}
    if 'hiddenAction_hit' not in ini:
        definition.setdefault('extensions', {}).setdefault(CAPABILITY, {'parts': []})['sourceArmor'] = source_armor(ini)
    if 'soldiers' in ini.get('core', {}).get('tags', '').split(','):
        definition.setdefault('extensions', {}).setdefault(CAPABILITY, {'parts': []})['sourceInfantry'] = True
    if award:
        definition.setdefault('extensions', {}).setdefault(CAPABILITY, {'parts': []})['experience'] = award
    report = audit_components(entry, ini, definition)
    if report['status'] == 'not-applicable':
        return []
    return ['components-v1 omitted for this unaudited source armored-component loop; existing HP combat remains. See COMPONENT-GAPS.md.']


def selected_roster_audit():
    """Reproduce evidence for the actual selected roster, not synthetic fixtures."""
    from weapons import convert_weapons, source_index
    selection = json.loads((rw.HERE / 'mvp-roster.json').read_text())
    names = [name for group in selection['nations'].values() for name in group]
    names += selection.get('shared', [])
    names += list(selection.get('builders', {}).values())
    result = []
    for name in dict.fromkeys(names):
        entry = source_index()[name]
        ini = rw.load_unit(rw.RW / entry['source'])
        converted, _ = convert_weapons(entry, ini)
        report = audit_components(entry, ini, {'id': entry['id'], 'weapons': converted})
        if report['status'] != 'not-applicable':
            result.append(report)
    return result


if __name__ == '__main__':
    print(json.dumps(selected_roster_audit(), ensure_ascii=False, indent=2))


def tested_supported_component_names():
    """Re-run compilation to return usable source names and explicit exclusions."""
    from weapons import source_index, convert_weapons, append_main_rounds
    from logistics_port import augment_logistics
    report = {'supported': [], 'excluded': [], 'unreviewed': []}
    for name, entry in source_index().items():
        ini = rw.load_unit(rw.RW / entry['source'])
        if not supports_components(entry, ini):
            if 'hiddenAction_hit' in ini:
                report['unreviewed'].append({'name': name, 'source': entry['source'], 'reason': 'Source crew, inventory, resupply or critical action provenance differs from the reviewed shared policies.'})
            continue
        weapons, _ = convert_weapons(entry, ini)
        definition = {'id': entry['id'], 'weapons': weapons}
        try:
            append_main_rounds(entry, ini, definition, resources=('高爆弹', '破甲弹'))
            augment_logistics(entry, ini, definition)
            compile_t90_components(ini, definition)
            report['supported'].append(name)
        except (ValueError, KeyError, TypeError) as error:
            report['excluded'].append({'name': name, 'source': entry['source'], 'reason': str(error)})
    return report

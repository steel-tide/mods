"""Author only source-resolved mount geometry into the real UCGR pack.

Independent source rings require separately exported original-pixel sheets.
The exporter supplies entry['_articulation_art'] = {'scale': .4, 'sprites':
{'MAIN': 'tur.…-main', 'NSVT': 'tur.…-nsvt'}}. Each sheet is pivoted at that
source turret, and excludes layers belonging to another independent ring.
No game files, images, definitions of other units, or source scripts are edited.
"""
from copy import deepcopy
from functools import lru_cache
import hashlib
import json
import math
import re

from rw import HERE, RW, load_unit


def _number(value, default=None):
    """Expressions and booleans cannot silently become a geometry fallback."""
    if value is None:
        return default
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def _id(name):
    safe = re.sub('[^a-zA-Z0-9_.-]', '-', name).strip('-').lower()
    return 'mount-' + (safe[:48] if safe else hashlib.sha256(name.encode()).hexdigest()[:12])


@lru_cache(None)
def _media_reports():
    path = HERE / 'media-report.json'
    if not path.is_file():
        return {}
    return {entry['id']: entry for entry in json.loads(path.read_text())['entries']}


def augment_articulation(entry, ini, definition):
    """Mutate one definition atomically; return source-specific audit notes."""
    weapons = definition.get('weapons', [])
    if not weapons or not (definition.get('turretSprite') or entry.get('_articulation_art')):
        return []
    attack = ini.get('attack', {})
    if str(attack.get('isFixedFiring', '')).lower() == 'true':
        return ['Articulation omitted: source fixed-firing/form-dependent weapon behavior is retained through the existing native forms.']
    turrets = {key[7:]: value for key, value in ini.items() if key.startswith('turret_')}
    groups = {}
    weapon_turrets = {}
    for weapon in weapons:
        source = weapon.get('_source', {})
        section = source.get('turret', '')
        if not section.startswith('turret_') or section[7:] not in turrets:
            return [f'Articulation omitted: {weapon["id"]} has no unambiguous source turret metadata.']
        original = section[7:]
        name, seen = original, set()
        while str(turrets[name].get('slave', '')).lower() == 'true':
            if name in seen or turrets[name].get('attachedTo') not in turrets:
                return [f'Articulation omitted: {section} has an unresolved or cyclic slave chain.']
            seen.add(name)
            name = turrets[name]['attachedTo']
        groups.setdefault(name, []).append(weapon['id'])
        weapon_turrets[weapon['id']] = original
    # Non-firing parent rings still carry visible art and aim their slave guns.
    for name in list(groups):
        parent, seen = turrets[name].get('attachedTo'), {name}
        while parent:
            if parent not in turrets or parent in seen:
                return [f'Articulation omitted: {name} has an unresolved or cyclic parent ring.']
            seen.add(parent)
            groups.setdefault(parent, [])
            parent = turrets[parent].get('attachedTo')
    def depth(name):
        n = 0
        while turrets[name].get('attachedTo'):
            n += 1; name = turrets[name]['attachedTo']
        return n
    groups = dict(sorted(groups.items(), key=lambda item: depth(item[0])))
    if len(groups) > 8:
        return ['Articulation omitted: more than eight source rings are required.']
    if len({_id(name) for name in groups}) != len(groups):
        return ['Articulation omitted: source ring identifiers collide after normalization.']
    for name in groups:
        chain, parent = {name}, turrets[name].get('attachedTo')
        while parent:
            if parent not in groups or parent in chain or len(chain) >= 3:
                return [f'Articulation omitted: {name} has an unresolved, cyclic, or overly deep parent hierarchy.']
            chain.add(parent)
            parent = turrets[parent].get('attachedTo')
    art = entry.get('_articulation_art')
    separate = isinstance(art, dict) and isinstance(art.get('sprites'), dict)
    if len(groups) > 1 and not separate:
        return ['Independent mounts omitted: original visible rings are composited into one sheet; separate source-pixel sheets are required (' + ', '.join(groups) + ').']
    report = _media_reports().get(entry['id'], {})
    scale = _number(art.get('scale') if separate else report.get('artScale'))
    if scale is None or scale <= 0:
        return ['Articulation omitted: the exported source-art coordinate scale is unavailable.']
    prepared, notes = [], []
    for index, (name, assigned) in enumerate(groups.items()):
        turret = turrets[name]
        parent = turret.get('attachedTo')
        if parent and parent not in groups:
            return [f'Articulation omitted: independent {name} depends on a non-firing parent ring without an authored mount.']
        x, y = _number(turret.get('x')), _number(turret.get('y'))
        rest = _number(turret.get('idleDir'), 0)
        arc = _number(turret.get('limitingAngle'), 180)
        rate = _number(turret.get('turnSpeed', attack.get('turretTurnSpeed')))
        tolerance = _number(turret.get('canAttackMaxAngle'))
        if any(value is None for value in (x, y, rest, arc, rate)) or ('canAttackMaxAngle' in turret and tolerance is None):
            return [f'Articulation omitted: {name} has unresolved source geometry or turn/firing limits.']
        dynamics={key:_number(turret.get(key),0) for key in ('idleSpin','turnSpeedAcceleration','turnSpeedDeceleration')}
        if any(value is None for value in dynamics.values()):
            return [f'Articulation omitted: {name} has unresolved turn dynamics.']
        if not (-512 <= x * scale <= 512 and -512 <= -y * scale <= 512 and -180 <= rest <= 180
                and .01 <= math.radians(arc) <= math.pi and .01 <= rate * math.pi / 3 <= 100
                and (tolerance is None or .001 <= math.radians(tolerance) <= 1)):
            return [f'Articulation omitted: {name} source geometry or limits exceed v1 bounds; values were not clamped.']
        weapon_limits = {}
        for weapon_id in assigned:
            source_turret = turrets[weapon_turrets[weapon_id]]
            child_arc = _number(source_turret.get('limitingAngle'), 180)
            if weapon_turrets[weapon_id] != name:
                # Angles at least180 cover the complete signed bearing domain.
                # The source permits HAWK slave launches before its visual rack aligns.
                if child_arc is None or child_arc < 180:
                    return [f'Articulation omitted: {weapon_id} has an unresolved restricted slave-barrel firing arc.']
                child_tolerance = _number(source_turret.get('canAttackMaxAngle'), tolerance if tolerance is not None else 5)
                if child_tolerance is None or not 0 < child_tolerance <= 360:
                    return [f'Articulation omitted: {weapon_id} has unresolved slave firing alignment.']
                if 'canAttackMaxAngle' in source_turret:
                    weapon_limits[weapon_id] = math.radians(child_tolerance)
        sprite = art['sprites'].get(name) if separate else definition['turretSprite']
        if not isinstance(sprite, str) or not sprite:
            return [f'Articulation omitted: {name} has no separately exported original sheet.']
        if not separate:
            pivots = definition.get('turretMounts', [])
            if len(pivots) != 1 or any(abs(pivots[0].get(axis, 0) - value) > .002 for axis, value in [('x', x * scale), ('y', -y * scale)]):
                return [f'Articulation omitted: {name} does not match the existing exported sheet pivot.']
        mount = {'id': _id(name), 'label': [f'Mount {index + 1}', f'炮塔 {index + 1}', f'포탑 {index + 1}'],
                 'sprite': sprite, 'x': round(x * scale, 6), 'y': round(-y * scale, 6),
                 'rest': math.radians(rest), 'arc': math.radians(arc), 'turnRate': rate * math.pi / 3,
                 'weapons': assigned,
                 'targeting': 'independent' if str(attack.get('turretMultiTargeting', '')).lower() == 'true' else 'shared'}
        mount.update(acceleration=math.radians(dynamics['turnSpeedAcceleration'])*3600,
                     deceleration=math.radians(dynamics['turnSpeedDeceleration'])*3600,
                     idleSpin=math.radians(dynamics['idleSpin'])*60)
        if weapon_limits:
            mount['weaponTolerances'] = weapon_limits
        if parent:
            mount['parent'] = _id(parent)
        if tolerance is not None:
            mount['tolerance'] = math.radians(tolerance)
        prepared.append(mount)
        notes.append(f'Articulation: turret_{name}, source x={x:g}, y={y:g}, {rate:g}°/tick and {arc:g}° arc; original sheet {sprite}; weapons {", ".join(assigned)}. Source script conditions remain separately reported; no invented firing gate added.')
    extension = deepcopy(definition.get('extensions', {}).get('articulation-v1', {}))
    extension['mounts'] = prepared
    definition.setdefault('extensions', {})['articulation-v1'] = extension
    for weapon in weapons:
        weapon['turret'] = True
    return notes


def configure_deployment(mobile, deployed, texts):
    """Author the HJ-8 source forms and its real attached PLA rifleman."""
    from weapons import source_index
    source = RW / '阵营单位/2.中华人民共和国/1.步兵/PLA/HJ8架设小队.ini'
    ini = load_unit(source)
    def duration(section):
        raw = ini[section]['buildSpeed'].strip()
        seconds = _number(raw[:-1]) if raw.endswith('s') else None
        if seconds is None or not 0 <= seconds <= 600:
            raise ValueError(f'{section}: unresolved deployment time {raw!r}')
        return seconds
    source_slot = ini['attachment_95']
    if (source_slot.get('onCreateSpawnUnitOf') != 'PLAINF' or
            source_slot.get('keepAliveWhenParentDies') != 'false' or
            source_slot.get('canBeAttackedAndDamaged') != 'true'):
        raise ValueError('HJ-8 attachment source differs from the audited member')
    scale = _media_reports()[mobile['id']]['artScale']
    slot = {'id': 'rifleman', 'label': ['Rifleman', '步枪手', '소총수'],
            'unit': source_index()['PLAINF']['id'],
            'x': float(source_slot['x']) * scale,
            'y': -float(source_slot['y']) * scale,
            'rest': math.radians(float(source_slot['idleDir'])),
            'rotation': 'independent', 'fire': 'independent',
            'select': 'parent', 'onParentDeath': 'kill'}
    # Both forms retain the real launcher and its state. The carrying form
    # disables that weapon explicitly; it is never replaced with a dummy gun.
    mobile['weapons'] = deepcopy(deployed['weapons'])
    for definition, target, action, trigger in (
            (mobile, deployed, 'deploy', 'idle'),
            (deployed, mobile, 'pack-up', 'move')):
        definition.pop('rules', None)
        definition.setdefault('extensions', {})['articulation-v1'] = {
            'transportTogether': True,
            **({'enteredTransport':action} if action=='pack-up' else {}),
            'attachments': [deepcopy(slot)],
            'disabledWeapons': [w['id'] for w in definition['weapons']] if action == 'deploy' else [],
            'deployments': [{'id': action, 'label': texts['adaptation-' + action]['name'],
                'to': target['id'], 'time': duration('action_部署' if action == 'deploy' else 'action_撤离'),
                'automatic': trigger, 'orders': 'retain', 'cancelable': False, 'lockWeapons': action == 'deploy'}]}
    return [
        'HJ-8 uses source two-second deployment and pack-up transactions, automatic idle deployment and movement-order pack-up. Carrying disables the real launcher; forms retain its reload and ammunition state.',
        'HJ-8 attachment_95 is the real PLAINF rifleman, independently damageable and firing, at the source offset and relative idle bearing35°. Selecting the member selects the team; parent death kills the member.',
        'HJ-8 boards and leaves transport atomically with its real rifleman. The deployed form queues its original two-second enteredTransport pack-up; member identity, damage, ammunition and shared carrier death survive.',
    ]


def configure_recovery(definitions, entries):
    """Source recovery vehicles attach a real immobilized tank, not hidden cargo."""
    notes = []
    by_id = {e['id']: e for e in entries.values()}
    for definition in definitions:
        entry = by_id.get(definition['id'])
        if not entry:
            continue
        ini = load_unit(RW / entry['source'])
        slot = ini.get('attachment_Tank', {})
        action = ini.get('action_牵引', {})
        if not slot or not action:
            continue
        expected = {'keepAliveWhenParentDies': 'true', 'canBeAttackedAndDamaged': 'true',
                    'canAttack': 'false', 'addTransportedUnits': 'true', 'unloadInCurrentPosition': 'true',
                    'deattachIfWantingToMove': 'true', 'rotateWithParent': 'false'}
        if any(slot.get(k) != value for k, value in expected.items()) or action.get('addWaypoint_type') != 'loadup' or action.get('addWaypoint_target_nearestUnit_tagged') != '瘫痪' or action.get('addWaypoint_target_nearestUnit_team') != 'own':
            raise ValueError(f'{entry["rwName"]}: unreviewed recovery attachment policy')
        maximum = float(ini['core']['maxTransportingUnits'])
        accepts = []
        for target in definitions:
            source = by_id.get(target['id'])
            if not source or target['id'] == definition['id']:
                continue
            target_ini = load_unit(RW / source['source'])
            core = target_ini['core']
            if ('装甲' in core.get('tags', '').split(',') and
                    float(core.get('transportSlotsNeeded', 1)) <= maximum and
                    target.get('domain') != 'air' and target.get('extensions', {}).get('components-v1', {}).get('parts')):
                accepts.append(target['id'])
        x, y = float(slot['x']) * .4, -float(slot['y']) * .4
        definition.update(transportCap=maximum, transportMaxWeight=maximum)
        definition.setdefault('extensions', {}).setdefault('articulation-v1', {})['tow'] = {
            'accepts': accepts, 'range': float(action['addWaypoint_target_nearestUnit_maxRange']) * .4 / 32,
            'length': math.hypot(x, y), 'speed': 1, 'maxWeight': maximum, 'detachOnMove': True,
            'sourceAttachment': {'x': x, 'y': y, 'rest': math.radians(float(slot['idleDir'])),
                                 'searchRange': float(action['addWaypoint_target_nearestUnit_maxRange']) * .4}}
        notes.append({'unit': entry['rwName'], 'note': 'Source recovery action seeks the nearest own immobilized armored unit within200RW pixels, approaches through native pickup and keeps the real tank damageable at attachment_Tank. Movement detaches it; tractor death leaves it alive. No invented towing slowdown.'})
    return notes

"""Read source weapons before the pack's reviewed policy compilers bind them.

This stage does not evaluate arbitrary RW expressions. Component, magazine,
guidance, targeting and presentation compilers enrich its provenance afterwards.
Markers and remote controllers are not invented ordinary weapons.
"""
from functools import lru_cache
from pathlib import Path
import json
import re
import rw

RANGE_SCALE = .0125
DAMAGE_SCALE = .6

# These two source aircraft install their default missiles through automatic
# actions instead of onCreateSpawnUnitOf. Audited for a fresh source unit:
# F-2 starts with 空载 and no flag 1; MIG29 starts with R27ER resource 0 and
# neither loadout tag. Include only those actions and their explicit follow-up.
# This is not a general evaluator for selectable/purchased loadout conditions.
INITIAL_AA_ACTIONS = {
    'F-2': ('action_AIM120', 'hiddenAction_AIM9Mx2'),
    'MIG29': ('action_挂载R27T', 'hiddenAction_挂载R73'),
}


def seconds(value, default=0):
    text = str(value or '').strip().lower()
    if text.endswith('s'):
        return rw.num(text[:-1], default)
    return rw.num(text, default * 60) / 60


def bounded(value, low, high):
    return round(max(low, min(high, value)), 4)


@lru_cache(None)
def source_index():
    return {e['rwName']: e for e in json.loads((rw.HERE / 'inventory.json').read_text())['entries']}


def helper_for(name):
    name = re.split(r'[(*,]', str(name or ''))[0].strip()
    entry = source_index().get(name)
    return (rw.load_unit(rw.RW / entry['source']), entry) if entry else (None, None)


def damaging_value(projectile):
    # Source ground-targeted rounds often put their real damage in areaDamage.
    # Do not add direct+area and invent an unverified double-hit conversion.
    return max(rw.num(projectile.get('directDamage')), rw.num(projectile.get('areaDamage')))


def helper_payload(ini):
    if not ini:
        return None
    candidates = [(key, p) for key, p in ini.items() if key.startswith('projectile_')
                  and not any(t in key.lower() for t in ('rico', '碎片', '闪光', '标记', 'smoke'))
                  and damaging_value(p) > 0]
    if not candidates:
        return None
    # AP helper's actual HP blast is distinct from its component-damage messages.
    for preferred in ('projectile_空', 'projectile_b', 'projectile_MISSLE', 'projectile_红外弹', 'projectile_AIM120'):
        match = next(((k, p) for k, p in candidates if k == preferred), None)
        if match:
            return match
    return max(candidates, key=lambda pair: damaging_value(pair[1]))


def payload_for(projectile):
    """Return damage payload, its source label and optional AP helper flag."""
    helper, entry = helper_for(projectile.get('spawnUnit'))
    hp = helper_payload(helper)
    # AP carrier's huge damage is blocked by the source's 100000 vehicle armour.
    # Taking that carrier number would make tanks die in one hit. Its helper has
    # the real HP blast, alongside the unsupported penetration/module scripts.
    kinetic = bool(helper and '@global apCoe' in helper.get('core', {}))
    if kinetic and hp:
        return hp[1], f"{entry['source']} [{hp[0]}]", True
    if damaging_value(projectile) > 0:
        return projectile, 'direct source projectile', False
    if hp:
        return hp[1], f"{entry['source']} [{hp[0]}]", kinetic
    return None, None, False


def enabled(value, default=False):
    if value is None:
        return default
    return str(value).strip().lower() not in ('false', '0', 'none', '')


def target_domains(attack, turret):
    domains = []
    if enabled(turret.get('canAttackLandUnits', attack.get('canAttackLandUnits')), True):
        domains += ['ground', 'ship']
    if enabled(turret.get('canAttackFlyingUnits', attack.get('canAttackFlyingUnits'))):
        domains.append('air')
    if enabled(turret.get('canAttackUnderwaterUnits', attack.get('canAttackUnderwaterUnits'))):
        domains.append('sub')
    return domains


def kind_for(entry, turret_name, turret, projectile, payload, kinetic, targets, reload):
    text = ' '.join((turret_name, turret.get('projectile', ''), projectile.get('tags', ''),
                     turret.get('resourceUsage', ''), projectile.get('image', ''), projectile.get('spawnUnit', ''))).lower()
    missile = any(s in text for s in ('atgm', 'missle', 'missile', '9m', 'fim', '导弹', '毒刺', '针=', '箭-1', 'pl12', 'aim'))
    if targets == ['air']:
        return 'aa', 'missile' if missile or projectile.get('spawnUnit') and not kinetic else ('flak' if 'ahead' in text else 'bullet')
    if kinetic:
        return ('autocannon', 'bullet') if reload < 1 else ('cannon', 'shell')
    if any(s in text for s in ('rpg', 'pf89', 'pf98', 'mk153', '铁拳3')):
        return 'at', 'rocket'
    if any(s in text for s in ('火箭', 's13', 's8', 's-8', 'hydra', 'sneb', 'rocket=', 'roc=')):
        return 'rocket', 'rocket'
    if entry.get('movement') == 'AIR' and '固定翼' in entry.get('tags', '') and 'ground' in targets and any(s in text for s in ('fab', 'gb1000', 'gbu', 'mk82')):
        return 'he', 'bomb'
    if missile:
        return 'at', 'missile'
    if any(s in text for s in ('ags', 'mk19', 'gdp-30')):
        return 'he', 'shell'
    if any(s in text for s in ('pkt', 'nsvt', 'qjt', 'm2hb', 'm240', 'mg3', 'kord', '子弹', '机枪')):
        return 'mg', 'bullet'
    if 'soldiers' in entry.get('tags', '') and damaging_value(payload) <= 50:
        return 'mg', 'bullet'
    if reload < .8:
        return 'autocannon', 'bullet'
    if enabled(projectile.get('ballistic')) or damaging_value(payload) >= 100:
        return 'he', 'shell'
    return 'cannon', 'shell'


def resolved_range(ini, attack, turret, choice=None):
    value = rw.num(turret.get('limitingRange'), rw.num(attack.get('maxAttackRange')))
    if value > 0:
        return value
    for name, action in ini.items():
        if not name.startswith(('action_', 'hiddenAction_')):
            continue
        tags = action.get('temporarilyAddTags', '').split(',')
        if choice in tags or name == 'action_部署':
            match = re.search(r'\bmaxAttackRange\s*=\s*([0-9.]+)', action.get('setUnitStats', ''))
            if match:
                return float(match[1])
    return None


def _source_sound(entry, ini, turret_name, turret):
    ref = turret.get('shoot_sound')
    if not ref:
        return None
    origin = ini.origins.get(turret_name, {}).get('shoot_sound')
    p = rw.resolve(ref, Path(origin).parent if origin else (rw.RW / entry['source']).parent)
    return str(p) if p else None


def source_metadata(entry, turret_name, projectile_name, projectile):
    """Private conversion provenance; removed before serializing the manifest."""
    out = {'source': entry['source'], 'turret': turret_name,
           'projectile': 'projectile_' + projectile_name}
    helper, helper_entry = helper_for(projectile.get('spawnUnit'))
    payload = helper_payload(helper)
    if helper_entry and payload:
        out['helper'] = {'source': helper_entry['source'], 'projectile': payload[0]}
    return out


def convert_weapons(entry, ini):
    attack = ini.get('attack', {})
    notes = []
    if not enabled(attack.get('canAttack'), True):
        return [], ['Source canAttack=false: no weapon.']
    if any(s in entry.get('source', '') for s in ('/FPV/', '/无人机与架设/大型无人机/')):
        return [], ['Remote FPV/operator/target-forwarding weapon omitted; no fabricated autonomous substitute.']
    turrets = [(k, v) for k, v in ini.items() if k.startswith('turret_')]
    has_main_ap = any(k.startswith('turret_APFSDS') for k, v in turrets)
    infantry = 'soldiers' in entry.get('tags', '')
    infantry_choice = None
    if infantry:
        initial_tags = set(ini.get('core', {}).get('tags', '').split(','))
        for name, turret in turrets:
            match = re.search(r'self\.tags\(includes=["\']([^"\']+)', turret.get('canAttackCondition', ''), re.I)
            if match and match[1] in initial_tags:
                infantry_choice = match[1]
                break
    results = []
    identities = set()
    alternate_ifv = set()
    helicopter_at = False
    for name, turret in turrets:
        if not enabled(turret.get('canShoot'), True) or not turret.get('projectile'):
            continue
        pn = turret['projectile']
        projectile = ini.get('projectile_' + pn, {})
        if any(s in (pn + ' ' + projectile.get('tags', '')).lower() for s in ('blank', 'laser', '烟雾', 'smoke', '拦截', '标记')):
            continue
        if has_main_ap and name.startswith(('turret_ATGM_', 'turret_HEAT_', 'turret_HE_')):
            notes.append(f'{name}/{pn}: alternate main-gun ammunition omitted; AP is the fixed initial round.')
            continue
        if '固定翼' in entry.get('tags', '') and any(t in turret.get('canAttackCondition', '') for t in ('includes="A1"', 'includes="A2"')):
            notes.append(f'{name}/{pn}: optional purchased airstrike loadout omitted with its unsupported strike-target workflow.')
            continue
        # A single IFV gun that selects HE or tube-launched ATGM is not two guns.
        alternate = re.match(r'(turret_\d+)_(HE|AT)$', name)
        if alternate:
            group = alternate[1]
            if group in alternate_ifv:
                notes.append(f'{name}/{pn}: alternate round on shared barrel omitted.')
                continue
            alternate_ifv.add(group)
        targets = target_domains(attack, turret)
        if not targets:
            continue
        payload, source, kinetic = payload_for(projectile)
        if payload is None:
            notes.append(f'{name}/{pn}: no real damaging payload resolved; omitted.')
            continue
        # Weapon-switch UI selects exactly one infantry loadout. Keep its first
        # source turret rather than simultaneously enabling every alternate gun.
        if infantry:
            condition = turret.get('canAttackCondition', '')
            match = re.search(r'self\.tags\(includes=["\']([^"\']+)', condition, re.I)
            choice = match[1] if match else None
            if infantry_choice is not None and choice != infantry_choice:
                notes.append(f'{name}/{pn}: alternate infantry loadout omitted.')
                continue
            if infantry_choice is None:
                infantry_choice = choice or '__initial__'
        reload = max(seconds(turret.get('delay', attack.get('shootDelay')), .5), seconds(turret.get('warmup')))
        energy_regen = rw.num(ini.get('core', {}).get('energyRegen'))
        if energy_regen > 0:
            reload = max(reload, rw.num(turret.get('energyUsage')) / energy_regen / 60)
        reload = max(.05, reload)
        cls, visual = kind_for(entry, name, turret, projectile, payload, kinetic, targets, reload)
        if visual in ('missile', 'rocket', 'bomb') and reload < .5:
            notes.append(f'{name}/{pn}: {reload:g}s is a finite resource/salvo cadence, with no supported sustainable reload; weapon omitted rather than turned into an infinite launcher.')
            continue
        if 'HELI' in entry.get('tags', '') and cls == 'at' and visual == 'missile':
            if helicopter_at:
                notes.append(f'{name}/{pn}: additional selectable helicopter AT missile family omitted; initial source AT family retained.')
                continue
            helicopter_at = True
        # Ground MG/autocannon already reaches native lowFlying aircraft. Do not
        # promote a source low-altitude-only gun into full high-altitude AA.
        exclusions = turret.get('canOnlyAttackUnitsWithoutTags', attack.get('canOnlyAttackUnitsWithoutTags', ''))
        if cls in ('mg', 'autocannon') and 'ground' in targets and any(t in exclusions for t in ('高空', '固定翼')):
            targets = [d for d in targets if d != 'air']
        resource = turret.get('resourceUsage', '').split('=')[0]
        # Matching ammunition is not evidence of a duplicate barrel. Preserve
        # distinct mount positions and source altitude/target gates (for example
        # UH-1's two guns and HQ-17's three launch policies).
        payload_identity = projectile.get('spawnUnit') if not damaging_value(projectile) else None
        identity = (payload_identity or pn, resource, 'surface' if 'ground' in targets else tuple(targets))
        if name in ('turret_AP_H', 'turret_AP_L') or entry['rwName'] in ('UH1', 'HQ17'):
            identity += tuple(turret.get(k, '') for k in ('x', 'y', 'attachedTo', 'canAttackCondition',
                              'canOnlyAttackUnitsWithTags', 'canOnlyAttackUnitsWithoutTags', 'delay', 'warmup', 'limitingRange'))
        if identity in identities:
            notes.append(f'{name}/{pn}: additional same-payload barrel/variant remains omitted pending its source firing policy.')
            continue
        identities.add(identity)
        radius = resolved_range(ini, attack, turret, infantry_choice)
        if radius is None:
            notes.append(f'{name}/{pn}: source range is zero and no fixed initial/deployed range resolves; omitted.')
            continue
        value = damaging_value(payload)
        weapon = {
            'id': f'w{len(results) + 1}', 'cls': cls, 'projectile': visual,
            'dmg': round(value * DAMAGE_SCALE, 4), 'reload': bounded(reload, .05, 600),
            'range': bounded(radius * RANGE_SCALE, .5, 64),
            'targets': targets, 'turret': entry.get('movement') != 'AIR' and not infantry,
            '_projectile': pn,
            '_source': source_metadata(entry, name, pn, projectile),
        }
        small_grenade = any(token in (pn + ' ' + projectile.get('spawnUnit', '')).upper()
                            for token in ('AGS', 'GDP-30', 'MK19', 'M203'))
        if cls == 'mg' or cls == 'autocannon' and not kinetic or small_grenade:
            # Source vehicles block ordinary small arms with 100000 armour.
            # Removing their module scripts must not make a coaxial MG kill
            # tanks faster than the retained main cannon.
            weapon['mult'] = {'light': 1, 'medium': 0, 'heavy': 0, 'ship': 0,
                              'sub': 0, 'structure': 0, 'air': 1}
            notes.append(f'{name}: ordinary non-penetrating small arms cannot damage native medium/heavy/ship/sub/structure armour; source armoured vehicles block these conventional HP hits.')
        speed = rw.num(projectile.get('targetSpeed'), rw.num(projectile.get('speed')))
        if speed > 0:
            weapon['speed'] = bounded(speed * 24, 1, 5000)
        # Small-arms RW spread spheres stand in for collision, not a grenade.
        if cls not in ('mg', 'autocannon', 'cannon'):
            radius = rw.num(payload.get('areaRadius'))
            if radius > 0:
                weapon['splash'] = bounded(radius * .4, 0, 500)
        minimum = rw.num(turret.get('limitingMinRange')) * RANGE_SCALE
        if minimum > 0 and minimum < weapon['range']:
            weapon['minRange'] = round(minimum, 4)
        sound = _source_sound(entry, ini, name, turret)
        if sound:
            weapon['_sound'] = sound
        results.append(weapon)
        notes.append(f'{name}/{pn}: {source}; baseline HP conversion {value:g}×0.6={weapon["dmg"]:g}, reload {weapon["reload"]:g}s. This native payload does not execute source armor/crew/morale scripts; audited component bindings, where present, override it later.')
        if turret.get('canAttackCondition') or any(str(v).startswith('if ') for k, v in turret.items() if k.startswith('canAttack')):
            notes.append(f'{name}: base conversion retains source domains; targeting/sensor/component compilers bind reviewed conditions. Other source expressions remain unaudited.')
    # Initial aircraft loadouts include physical spawn attachments and the two
    # audited automatic initialization sequences above. Carried missile counts
    # describe ammunition, never simultaneous barrels or a native burst.
    if entry.get('movement') == 'AIR' and not infantry:
        missiles = {}
        initial_spawns = [attachment['onCreateSpawnUnitOf'] for name, attachment in ini.items()
                          if name.startswith('attachment_') and attachment.get('onCreateSpawnUnitOf')]
        for name in INITIAL_AA_ACTIONS.get(entry.get('rwName'), ()):
            action = ini.get(name, {})
            spawns = action.get('attachments_addNewUnits', '')
            if spawns:
                initial_spawns.extend(spawns.split(','))
                notes.append(f'{name}: audited automatic initial loadout {spawns}; each missile family maps to one launcher. Carried counts, alternate loadouts and purchase/rearm actions omitted.')
        for spawn in initial_spawns:
            unit = re.split(r'[(*]', spawn)[0].strip()
            helper, helper_entry = helper_for(unit)
            if not helper_entry or not ('捣蛋/' in helper_entry['source'] or '导弹' in helper_entry['source']):
                continue
            hp = helper_payload(helper)
            if hp:
                missiles.setdefault(unit, (helper, helper_entry, hp))
        for unit, (helper, helper_entry, hp) in missiles.items():
            if len(results) >= 8:
                notes.append(f'{unit}: beyond host eight-weapon limit; omitted.')
                continue
            action_names = [name.split('_', 1)[1] for name, a in ini.items()
                            if name.startswith(('action_', 'hiddenAction_'))
                            and re.search(r'withTag=["\']' + re.escape(unit) + r'["\']', a.get('sendMessageTo', ''))]
            lock_name, lock = next(((name, t) for name, t in turrets if any(a in t.get('onShoot_triggerActions', '').split(',') for a in action_names)), ('', {}))
            source_range = rw.num(lock.get('limitingRange'), rw.num(attack.get('maxAttackRange'), 900))
            gate = re.search(r'timeAlive\(\)-memory\.[\w]+\s*>=\s*([0-9.]+)', lock.get('canAttackCondition', ''))
            missile_reload = max(seconds(lock.get('delay'), 4), seconds(lock.get('warmup')), float(gate[1]) if gate else 0)
            missile_weapon = {
                'id': f'w{len(results) + 1}', 'cls': 'aa', 'projectile': 'missile',
                'dmg': round(damaging_value(hp[1]) * DAMAGE_SCALE, 4),
                'reload': bounded(missile_reload, .05, 600),
                'range': bounded(source_range * RANGE_SCALE, .5, 64),
                'targets': ['air'], 'turret': False, '_projectile': unit,
                '_source': {'source': entry['source'], 'turret': lock_name,
                            'projectile': 'projectile_' + lock['projectile'] if lock.get('projectile') else '',
                            'helper': {'source': helper_entry['source'], 'projectile': hp[0]},
                            'attachedMissile': unit},
            }
            speed = rw.num(helper.get('movement', {}).get('moveSpeed'))
            if speed > 0:
                missile_weapon['speed'] = bounded(speed * 24, 1, 5000)
            results.append(missile_weapon)
            notes.append(f'{unit}: initial attached missile from {helper_entry["source"]}/{hp[0]} as ordinary native AA missile; HP damage×0.6. Radar/IR/datalink/seeker logic, altitude gates, finite carried rounds and reload UI omitted.')
    if len(results) > 8:
        notes.append(f'Only first eight independent source weapons retained; {len(results)-8} later weapons omitted.')
        results = results[:8]
    if results:
        notes.append('Ranges use0.0125 tiles per RW pixel; flight speed uses24 (60 source frames ×0.4 world scale). Subsequent pack policy compilers supply reviewed ammunition, component, sensor and targeting behavior; see manifest capability bindings.')
    return results, notes


def append_main_rounds(entry, ini, definition, resources=('高爆弹',)):
    """Append audited selectable rounds without renumbering existing barrels.

    The caller must bind these to one shared feed before publishing. Each
    payload still goes through the ordinary source resolver; a zero-capacity
    round is never made available just because its template has a turret.
    """
    from logistics_port import resource_values
    capacities = resource_values(ini.get('action_弹药补给', {}).get('setResourcesWithLogic'))
    if not capacities:
        return []
    notes = []
    for name, turret in sorted(ini.items(), key=lambda item: next((i for i, r in enumerate(resources) if (resource_values(item[1].get("resourceUsage")) or {}).get(r)), len(resources))):
        if not name.startswith(('turret_HE_', 'turret_HEAT_', 'turret_ATGM_')):
            continue
        usage = resource_values(turret.get('resourceUsage'))
        if not usage or len(usage) != 1:
            continue
        resource = next(iter(usage))
        if resource not in resources or capacities.get(resource, 0) <= 0:
            continue
        # AM3's source loadout is APFSDS + HEAT. Its inherited HE stock still
        # affects rack safety, but HEname:blank is not a shootable HE payload.
        if resource == '高爆弹' and 'AM3' in {tag.strip() for tag in ini.get('core', {}).get('tags', '').split(',')}:
            notes.append(f'{name}: AM3 has no active HE barrel; its inherited HE stock remains in the rack inventory.')
            continue
        source = rw.Ini()
        source.update({k: v for k, v in ini.items() if not k.startswith('turret_') or k == name})
        source.origins = ini.origins
        converted, _ = convert_weapons(entry, source)
        if len(converted) != 1:
            raise ValueError(f'{entry["rwName"]}/{name}: selected round has no unique real payload')
        weapon = converted[0]
        weapon['id'] = f'w{len(definition["weapons"]) + 1}'
        definition['weapons'].append(weapon)
        notes.append(f'{name}: original selectable {resource} payload retained on the shared main-gun feed; stock {capacities[resource]:g}.')
    return notes

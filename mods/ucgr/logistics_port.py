"""Source-backed UCGR magazine conversion, without executing RW scripts.

Constant source magazines, carried tank inventory and finite initial aircraft
stocks are compiled separately. Paid/landing rearm is never turned into a free
provider, and unresolved initial stock never grants an unlimited weapon.
"""
import hashlib
import math
import re

import rw
from weapons import seconds, INITIAL_AA_ACTIONS

CAPABILITY = 'logistics-v1'
MAIN_STOCKS = {
    '穿甲弹': ('shell-ap', ['APFSDS', '尾翼稳定脱壳穿甲弹', '날개안정분리철갑탄']),
    '高爆弹': ('shell-he', ['High-explosive shells', '高爆弹', '고폭탄']),
    '破甲弹': ('shell-heat', ['HEAT shells', '破甲弹', '성형작약탄']),
    'ATGM': ('missile-atgm', ['Guided missiles', '炮射导弹', '포발사 유도탄']),
}


def aps_policy(ini):
    """Two source APS attachments with independent finite launchers."""
    action = ini.get('action_弹药补给', {})
    if action.get('alsoTriggerAction') != '初始化APS_1,初始化APS_2' or seconds(action.get('buildSpeed')) != 20:
        return None
    launchers = []
    for slot in ('APS_1', 'APS_2'):
        attachment, init = ini.get('attachment_' + slot, {}), ini.get('hiddenAction_初始化' + slot, {})
        values = resource_values(init.get('sendMessageWithData'))
        if (attachment.get('onCreateSpawnUnitOf') != 'APS' or init.get('sendMessageTo') != f'attachment(slot="{slot}")'
                or init.get('sendMessageWithTags') != 'APS初始化' or init.get('autoTriggerOnEvent') != 'created'
                or not values or set(values) != {'弹药量', '有效性'}):
            return None
        count, reload = values['弹药量'], values['有效性']
        if count < 0 or int(count) != count or count > 1000 or not 0 <= reload <= 3600:
            return None
        launchers.append({'x': float(attachment['x'])*.4, 'y': -float(attachment['y'])*.4, 'capacity': count, 'reload': reload})
    original = rw.load_unit(rw.RW / '模板/APS.ini')
    expected = {'life': '20', 'speed': '10', 'targetSpeed': '12', 'targetSpeedAcceleration': '0.1', 'speedSpread': '4', 'turnSpeed': '99', 'areaDamage': '1', 'areaRadius': '10', 'areaExpandTime': '75', 'interceptProjectile_removeTargetLifeOnly': 'true', 'explodeOnEndOfLife': 'true'}
    if any(original.get('projectile_antiNukeProjectile', {}).get(k) != v for k, v in expected.items()):
        return None
    turret = original.get('turret_silo', {})
    if turret.get('interceptProjectiles_withTags') != 'ATGM,ATGM2' or turret.get('interceptProjectiles_andUnderDistance') != '120' or turret.get('resourceUsage') != 'APS=1' or original['attack']['shootDelay'] != '90':
        return None
    return {'launchers': launchers, 'range': 48, 'cadence': 1.5, 'life': 1/3, 'speed': 240, 'targetSpeed': 288, 'acceleration': 144, 'spread': 96, 'turn': 99*60*math.pi/180, 'contact': 2.4}


def tank_stocks(ini):
    """Exact constant inventory in the shared tank refill action.

    This deliberately accepts only the audited free ten-second service. It
    does not infer aircraft purchases, other resource economies or scripts.
    """
    action = ini.get('action_弹药补给', {})
    gate = "if not (self.hasUnitInTeam(withTag='维修',withinRange=240) or self.numberOfUnitsInAllyNotOwnTeam(withTag=\"维修\",withinRange=240,greaterThan=0)) and numberOfUnitsInTeam(withTag='作弊')==0"
    values = resource_values(action.get('setResourcesWithLogic'))
    aps = aps_policy(ini)
    if (not values or set(values) != set(MAIN_STOCKS) or
            seconds(action.get('buildSpeed')) != (20 if aps else 10) or
            action.get('whenBuilding_cannotMove') != 'true' or
            any(action.get(k) for k in ('price', 'takeResources', 'whenBuilding_cannotAttack', 'alsoQueueAction')) or
            bool(action.get('alsoTriggerAction')) and not aps or
            action.get('isLocked') != gate):
        return None
    if any(v < 0 or v > 100000 or int(v) != v for v in values.values()):
        return None
    for resource, count in values.items():
        if count > 0 and _initial_count(ini, resource, '', '') != count:
            return None
    return values


def vehicle_supply(ini):
    """Free source artillery/SAM service, with its own stocks and duration.

    These constant inventories never contribute empty main-shell rack space.
    Source paid services and APS initialization remain separate policies.
    """
    action = ini.get('action_弹药补给', {})
    gate = "if not (self.hasUnitInTeam(withTag='维修',withinRange=240) or self.numberOfUnitsInAllyNotOwnTeam(withTag=\"维修\",withinRange=240,greaterThan=0))"
    values = resource_values(action.get('setResourcesWithLogic'))
    memory = resource_values(action.get('setUnitMemory'))
    era = {'frontAEA', 'sideAEA', 'backAEA', 'frontAEH', 'sideAEH', 'backAEH'}
    ranges = {'ATT_RANGE_A', 'ATT_RANGE_L', 'ATT_RANGE_H'}
    if (not values or set(values) & set(MAIN_STOCKS) or not memory or
            not (set(memory) == era and all(v == 0 for v in memory.values()) or set(memory) == ranges) or
            action.get('autoTriggerOnEvent') != 'created' or action.get('isLocked') != gate or
            action.get('whenBuilding_cannotMove') != 'true' or
            any(action.get(k) for k in ('price', 'takeResources', 'whenBuilding_cannotAttack', 'alsoTriggerAction', 'alsoQueueAction', 'requireConditional'))):
        return None
    duration = seconds(action.get('buildSpeed'))
    if not .1 <= duration <= 3600 or any(not 1 <= v <= 100000 or int(v) != v for v in values.values()):
        return None
    return {'stocks': values, 'seconds': duration}


def paid_vehicle_initial(ini):
    """Created-event inventory is independent of the omitted paid rearm action."""
    action = ini.get('action_弹药补给', {})
    if not action.get('price') or action.get('autoTriggerOnEvent') != 'created':
        return None
    copy = dict(ini)
    copy['action_弹药补给'] = {k: v for k, v in action.items() if k != 'price'}
    policy = vehicle_supply(copy)
    return policy['stocks'] if policy else None


def initial_display_stock(ini):
    """The shared SAM info-only action initializes a finite reloadable magazine."""
    action = ini.get('action_弹药补给', {})
    values = resource_values(action.get('setResourcesWithLogic'))
    memory = resource_values(action.get('setUnitMemory'))
    return bool(values and memory and set(memory) == {'ATT_RANGE_A', 'ATT_RANGE_L', 'ATT_RANGE_H'}
        and action.get('displayType') == 'infoOnly' and action.get('isLocked') == 'true'
        and action.get('autoTriggerOnEvent') == 'created' and seconds(action.get('buildSpeed')) == 0
        and not any(action.get(k) for k in ('price', 'takeResources', 'alsoTriggerAction', 'alsoQueueAction', 'requireConditional')))


def bind_tank_inventory(ini, definition):
    """Bind the audited tank inventory and one shared selectable main feed."""
    values = tank_stocks(ini)
    if values is None:
        raise ValueError(f'{definition["id"]}: tank service differs from the audited source')
    module = definition.setdefault('extensions', {}).setdefault(CAPABILITY, {})
    stocks = module.setdefault('stocks', [])
    for resource, count in values.items():
        if count > 0:
            sid, label = MAIN_STOCKS[resource]
            stocks.append({'id': sid, 'label': label, 'capacity': count, 'initial': count})
    feed = []
    for weapon in definition['weapons']:
        turret = ini.get(weapon.get('_source', {}).get('turret'), {})
        usage = resource_values(turret.get('resourceUsage'))
        if not usage or len(usage) != 1:
            continue
        resource, cost = next(iter(usage.items()))
        if resource not in MAIN_STOCKS:
            continue
        if cost <= 0 or cost > values[resource]:
            raise ValueError(f'{definition["id"]}: main round has invalid source stock/cost')
        weapon.setdefault('extensions', {})[CAPABILITY] = {
            'stock': MAIN_STOCKS[resource][0], 'cost': cost, 'feed': 'main-gun'}
        feed.append(weapon['id'])
    if not feed:
        raise ValueError(f'{definition["id"]}: no retained main barrel')
    if aps_policy(ini):
        module.setdefault('serviceSeconds', {})['tank-resupply'] = 20
    module['feeds'] = [{'id': 'main-gun', 'label': ['Main gun', '主炮', '주포'],
                        'weapons': feed, 'selected': feed[0]}]
    return [f'Finite main inventory and shared reload follow action_弹药补给. The source {seconds(ini["action_弹药补给"]["buildSpeed"]):g}-second allied service locks movement and permits firing; AP is selected initially. Unported round families remain carried inventory, never extra firing barrels.']


def resource_values(raw):
    """Read constant resource assignments only; expressions are not evaluated."""
    out = {}
    for part in str(raw or '').split(','):
        match = re.fullmatch(r'\s*([^=\s,]+)\s*=\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*', part)
        if not match:
            return None
        value = float(match[2])
        if not math.isfinite(value) or match[1] in out:
            return None
        out[match[1]] = value
    return out


def stock_id(resource):
    slug = re.sub('[^a-z0-9_-]', '-', resource.lower()).strip('-')
    if not re.fullmatch('[a-z0-9_-]+', resource.lower()):
        slug = slug[:16] + '-' + hashlib.sha256(resource.encode()).hexdigest()[:10]
    return 'magazine-' + slug.strip('-')[:30]


# Source resource variables named in Chinese are translated, never shown raw.
NAMED_RESOURCES = {
    # 针 is a shared helicopter-AAM variable (Mi-28NM, Mi-35M, AH-64D, AH-1Z).
    '针': ['Helicopter air-to-air missiles', '直升机空空导弹', '헬리콥터 공대공 미사일'],
    '毒刺': ['Stinger missiles', '“毒刺”导弹', '스팅어 미사일'],
    '西北风': ['Mistral missiles', '“西北风”导弹', '미스트랄 미사일'],
    '魔术2': ['Magic 2 missiles', '“魔术2”导弹', '매직 2 미사일'],
    '机枪': ['Machine-gun ammunition', '机枪弹药', '기관총 탄약'],
    '火箭弹': ['Rockets', '火箭弹', '로켓'],
}


def _ascii_resource(resource):
    if not re.fullmatch(r'[\x20-\x7e]+', resource):
        raise ValueError(f'untranslated source resource name {resource!r}: add it to NAMED_RESOURCES')
    return resource


def stock_label(resource):
    if resource in NAMED_RESOURCES:
        return list(NAMED_RESOURCES[resource])
    if resource == '机炮':
        return ['Aircraft cannon ammunition', '航炮弹药', '항공 기관포 탄약']
    if resource == 'HAM':
        return ['Helicopter guided missiles', '直升机导弹', '헬리콥터 유도 미사일']
    if resource == '子弹':
        return ['Small-arms ammunition', '轻武器弹药', '소화기 탄약']
    if resource == 'PKT航向':
        return ['Hull-gun ammunition', '航向机枪弹药', '차체 기관총 탄약']
    # Shared RW resource names are aliases: PKT also feeds NATO coaxials,
    # NSVT feeds the T-90M's grenade launcher, and 2A42 can feed a 25mm gun.
    # Do not mislabel those real weapons using their internal variable name.
    if resource == 'PKT':
        return ['Coaxial ammunition', '同轴武器弹药', '동축 무장 탄약']
    if resource == 'NSVT':
        return ['Secondary-weapon ammunition', '副武器弹药', '보조 무장 탄약']
    if resource in ('2A42', '25MM', '35MM'):
        return ['Autocannon ammunition', '机关炮弹药', '기관포 탄약']
    resource = _ascii_resource(resource)
    return [f'{resource} ammunition', f'{resource} 弹药', f'{resource} 탄약']


def _only_tag_clause(text, allowed):
    """The retained loadout makes its own source tag predicate constant true."""
    text = text.strip()
    if not text:
        return True
    match = re.fullmatch(r'and self\.tags\(includes=["\']([^"\']+)["\']\)', text, re.I)
    if match:
        return match[1] in allowed
    # A source rifle shared by two exclusive loadout tags still has the same
    # magazine when the already-selected, retained loadout satisfies the OR.
    outer = re.fullmatch(r'and\s*\((.*)\)', text, re.I)
    if not outer:
        return False
    parts = re.split(r'\bor\b', outer[1], flags=re.I)
    matches = [re.fullmatch(r'self\.tags\(includes=["\']([^"\']+)["\']\)', part.strip(), re.I)
               for part in parts]
    return bool(matches and all(matches) and any(m[1] in allowed for m in matches))


def _empty_gate(text, resource, tags, capacity):
    text = re.sub(r'^if\s+', '', text.strip(), flags=re.I)
    r = re.escape(resource)
    pattern = rf'(?:self\.resource\(type=["\']{r}["\'],\s*lessThan=1\)|self\.resource\.{r}\s*<\s*1)'
    match = re.match(pattern, text, re.I)
    if not match:
        return False
    tail = text[match.end():].strip()
    if _only_tag_clause(tail, tags):
        return True
    zero_guard = re.fullmatch(r'and not \(\s*([\d.]+)\s*==\s*0\s*\)', tail)
    return bool(zero_guard and float(zero_guard[1]) == capacity and capacity > 0)


def _initial_count(ini, resource, refill_name, retained_tag):
    counts, assignments = [], []
    for name, action in ini.items():
        if not name.startswith(('action_', 'hiddenAction_')):
            continue
        if action.get('autoTriggerOnEvent', '').lower() == 'created' and not action.get('requireConditional'):
            values = resource_values(action.get('addResources'))
            if values and resource in values:
                counts.append(values[resource])
            values = resource_values(action.get('setResourcesWithLogic'))
            if values and resource in values:
                assignments.append(values[resource])
        # Infantry's selected default weapon invokes its refill directly when
        # its source switching action installs that exact tag.
        tags = action.get('temporarilyAddTags', '').split(',')
        triggers = action.get('alsoTriggerAction', '').split(',')
        if retained_tag and retained_tag in tags and refill_name.split('_', 1)[1] in triggers:
            return 'refill'
    # The ordering of mixed set/add created actions is not guessed.
    if assignments:
        return assignments[0] if len(assignments) == 1 and not counts else None
    return sum(counts) if counts else None


def queued_magazine_policy(ini, resource):
    """A source action queues a constant refill; the created event fills instantly.

    No movement/fire lock is invented: these source actions permit firing the
    remaining rounds while the queued reload runs.
    """
    actions = [(n, a) for n, a in ini.items() if n.startswith(('action_', 'hiddenAction_'))]
    prohibited = ('price', 'takeResources', 'requireConditional', 'alsoTriggerAction', 'setUnitMemory',
                  'addResourcesWithLogic', 'whenBuilding_cannotMove', 'whenBuilding_cannotAttack')
    for name, refill in actions:
        values = resource_values(refill.get('setResourcesWithLogic'))
        if not values or set(values) != {resource} or refill.get('autoTriggerOnEvent') != 'created' or any(refill.get(k) for k in prohibited):
            continue
        capacity, duration = values[resource], seconds(refill.get('buildSpeed'))
        if not 1 <= capacity <= 100000 or not .1 <= duration <= 3600:
            continue
        target = name.split('_', 1)[1]
        gates = [(n, a) for n, a in actions if a.get('alsoQueueAction') == target and not any(a.get(k) for k in prohibited)]
        empty = next((n for n, a in gates if a.get('autoTrigger') == f'if self.resource.{resource}<1 and self.queueSize(lessThan=1)'), None)
        idle = next((n for n, a in gates if a.get('autoTrigger') == f'if self.resource.{resource}<{capacity:g} and self.queueSize(lessThan=1) and not self.isAttacking() and not self.hasActiveWaypoint()'), None)
        if empty and idle:
            return {'capacity': capacity, 'initial': capacity, 'refillAfter': duration, 'queuedReload': True,
                    'refill': name, 'timer': empty, 'idle': idle}
    return None

def magazine_policy(ini, resource, projectile):
    """Return a proven constant empty-magazine policy, or an omission reason."""
    cooldown_raw = ini.get('core', {}).get('autoTriggerCooldownTime')
    if cooldown_raw is None:
        return None, 'no explicit source auto-trigger interval'
    cooldown = seconds(cooldown_raw)
    if cooldown <= 0:
        return None, 'non-positive source auto-trigger interval'
    actions = [(s, a) for s, a in ini.items() if s.startswith(('action_', 'hiddenAction_'))]
    candidates = []
    for name, action in actions:
        additions = resource_values(action.get('addResources'))
        if not additions or set(additions) != {resource} or additions[resource] <= 0:
            continue
        reset = resource_values(action.get('setResourcesWithLogic'))
        if not reset or len(reset) != 1:
            continue
        timer, value = next(iter(reset.items()))
        if value != 0 or any(action.get(k) for k in ('price', 'takeResources', 'alsoTriggerAction', 'requireConditional', 'alsoQueueAction', 'setUnitMemory', 'addResourcesWithLogic')):
            continue
        match = re.fullmatch(r'if self\.resource\.' + re.escape(timer) +
                             r'\s*>=\s*([\d.]+)(.*)', action.get('autoTrigger', ''), re.I)
        if not match or not _only_tag_clause(match[2], {projectile}):
            continue
        capacity = additions[resource]
        for tick_name, tick in actions:
            increment = resource_values(tick.get('addResources'))
            if not increment or set(increment) != {timer} or increment[timer] <= 0:
                continue
            if not _empty_gate(tick.get('autoTrigger', ''), resource, {projectile, '弹匣'}, capacity):
                continue
            conditional = tick.get('requireConditional', '')
            tag_only = re.fullmatch(r'if self\.tags\(includes=["\']弹匣["\']\)', conditional, re.I)
            if conditional and not tag_only and not _empty_gate(conditional, resource, {projectile, '弹匣'}, capacity):
                continue
            if any(tick.get(k) for k in ('price', 'takeResources', 'alsoTriggerAction', 'alsoQueueAction', 'setResourcesWithLogic', 'setUnitMemory', 'addResourcesWithLogic')):
                continue
            initial = _initial_count(ini, resource, name, projectile)
            if initial == 'refill':
                initial = capacity
            if initial != capacity:
                continue
            # RW accumulates one constant step per core interval. Require an
            # integral number of intervals so rounding cannot invent a cadence.
            ticks = float(match[1]) / increment[timer]
            if abs(ticks - round(ticks)) > 1e-8:
                continue
            duration = round(round(ticks) * cooldown, 6)
            if not (1 <= capacity <= 100000 and .1 <= duration <= 3600):
                continue
            candidates.append({'capacity': capacity, 'initial': initial, 'refillAfter': duration,
                               'refill': name, 'timer': tick_name})
    if not candidates:
        queued = queued_magazine_policy(ini, resource)
        if queued:
            return queued, None
    if len(candidates) != 1:
        return None, 'no unique constant, free empty-magazine refill with proven initial stock'
    return candidates[0], None


def idle_reload_policy(ini, resource, tag):
    """Source partial magazines discard only after the shot-reset timer expires."""
    action = ini.get('hiddenAction_装填重置', {})
    pattern = (r'if self\.resource\.time==0 and self\.tags\(includes="弹匣"\) and '
               r'self\.customTimer>([\d.]+) and self\.resource\.' + re.escape(resource) + r'<([\d.]+)')
    match = re.fullmatch(pattern, action.get('autoTrigger', ''))
    if not match or resource_values(action.get('setResourcesWithLogic')) != {resource: 0}:
        return None
    if set(action) != {'autoTrigger', 'setResourcesWithLogic'}:
        return None
    relevant = [t for n, t in ini.items() if n.startswith('turret_')
                and resource_values(t.get('resourceUsage')) == {resource: 1}
                and (tag in t.get('canAttackCondition', '') or not t.get('canAttackCondition'))]
    if not relevant or any(t.get('onShoot_triggerActions') != 'RESET' for t in relevant):
        return None
    if ini.get('hiddenAction_RESET') != {'resetCustomTimer': 'true'}:
        return None
    return {'after': float(match[1]), 'below': float(match[2])}

def attached_aircraft_stock(ini, name, source_name):
    """Count authored default missile attachments and constant purchase batches."""
    mounts = {section[len('attachment_'):]: a.get('onCreateSpawnUnitOf') for section, a in ini.items() if section.startswith('attachment_')}
    def batch(text):
        out = []
        for item in text.split(','):
            m = re.fullmatch(r'([^*,()]+)(?:\*(\d+))?', item.strip())
            if not m: return []
            out.extend([m[1]] * int(m[2] or 1))
        return out
    # This whitelist is the same independently audited fresh-unit loadout used
    # by weapons.py. Slots replace occupancy; a follow-up cannot duplicate an
    # already attached wing-tip missile.
    for section in INITIAL_AA_ACTIONS.get(source_name, ()):
        a = ini.get(section, {})
        slots = [slot.strip() for slot in a.get('attachments_onlyOnSlots', '').split(',') if slot.strip()]
        if a.get('attachments_deleteNumUnits'):
            for slot in slots[:int(a['attachments_deleteNumUnits'])]: mounts[slot] = None
        available = [slot for slot in slots if not mounts.get(slot)]
        for slot, missile in zip(available, batch(a.get('attachments_addNewUnits', ''))): mounts[slot] = missile
    initial = sum(unit == name for unit in mounts.values())
    capacities = [initial]
    for section, action in ini.items():
        count = batch(action.get('attachments_addNewUnits', '')).count(name)
        if not section.startswith(('action_', 'hiddenAction_')) or not count:
            continue
        slots = [slot.strip() for slot in action.get('attachments_onlyOnSlots', '').split(',') if slot.strip()]
        if slots:
            capacities.append(min(count, len(slots)))
    capacity = max(capacities)
    if capacity < 1:
        return None
    return {'id': 'air-' + stock_id(name)[9:], 'label': list(NAMED_RESOURCES[name]) if name in NAMED_RESOURCES else [_ascii_resource(name) + ' missiles', name + ' 导弹', name + ' 미사일'], 'capacity': capacity, 'initial': initial}


def augment_logistics(entry, ini, definition):
    """Mutate a converted real roster definition; return source audit notes."""
    notes, stocks = [], {}
    supplied = vehicle_supply(ini)
    initial_paid = paid_vehicle_initial(ini)
    if supplied:
        stocks = {stock_id(resource): {'id': stock_id(resource), 'label': stock_label(resource), 'capacity': count, 'initial': count} for resource, count in supplied['stocks'].items()}
    if initial_paid:
        stocks.update({stock_id(resource): {'id': stock_id(resource), 'label': stock_label(resource), 'capacity': count, 'initial': count} for resource, count in initial_paid.items() if resource != 'energy'})
    module = definition.get('extensions', {}).get(CAPABILITY)
    if module:
        raise ValueError('logistics conversion must run exactly once per source definition')
    for weapon in definition.get('weapons', []):
        provenance = weapon.get('_source', {})
        turret = ini.get(provenance.get('turret'), {})
        usage = turret.get('resourceUsage')
        if not usage:
            if provenance.get('attachedMissile'):
                stock = attached_aircraft_stock(ini, provenance['attachedMissile'], entry.get('rwName'))
                if stock:
                    stocks[stock['id']] = stock
                    weapon.setdefault('extensions', {}).setdefault(CAPABILITY, {}).update(stock=stock['id'], cost=1)
                    notes.append(f'{weapon["id"]}: source default attached missile inventory {stock["initial"]:g}; paid rearm remains unavailable.')
                else:
                    # An unresolved default is no permission for infinite missiles.
                    weapon.setdefault('extensions', {}).setdefault(CAPABILITY, {})['disabled'] = True
                    notes.append(f'{weapon["id"]}: attached inventory unavailable; firing omitted.')
            continue
        cost = resource_values(usage)
        if not cost or len(cost) != 1 or next(iter(cost.values())) <= 0:
            notes.append(f'{provenance.get("turret")}: compound/dynamic resource usage {usage!r} omitted.')
            continue
        resource, amount = next(iter(cost.items()))
        if entry.get('movement') == 'AIR':
            initial = _initial_count(ini, resource, '', '')
            if isinstance(initial, (int, float)) and initial >= 1 and amount <= initial:
                sid = 'air-' + stock_id(resource)[9:]
                stocks[sid] = {'id': sid, 'label': stock_label(resource), 'capacity': initial, 'initial': initial}
                weapon.setdefault('extensions', {}).setdefault(CAPABILITY, {}).update(stock=sid, cost=amount)
                notes.append(f'{provenance.get("turret")}/{resource}: source finite initial aircraft stock {initial:g}; paid rearm remains unavailable.')
            else:
                weapon.setdefault('extensions', {}).setdefault(CAPABILITY, {})['disabled'] = True
                notes.append(f'{provenance.get("turret")}/{resource}: source initial aircraft inventory unresolved; firing omitted.')
            continue
        if initial_paid and resource in initial_paid and amount <= initial_paid[resource]:
            sid = stock_id(resource)
            energy = float(turret.get('energyUsage', 0))
            if energy and (initial_paid.get('energy') != initial_paid[resource] / amount * energy or ini.get('core', {}).get('energyRegen') != '0'):
                weapon.setdefault('extensions', {}).setdefault(CAPABILITY, {})['disabled'] = True
                notes.append(f'{weapon["id"]}: unreviewed independent energy/ammunition gating; firing omitted.')
            else:
                weapon.setdefault('extensions', {}).setdefault(CAPABILITY, {}).update(stock=sid, cost=amount)
                notes.append(f'{weapon["id"]}: exact finite created inventory retained; source paid rearm is unavailable.')
            continue
        if supplied and resource in supplied['stocks']:
            initial = supplied['stocks'][resource]
            if amount > initial:
                raise ValueError(f'{entry["rwName"]}: shot cost exceeds source vehicle stock')
            sid = stock_id(resource)
            stocks[sid] = {'id': sid, 'label': stock_label(resource), 'capacity': initial, 'initial': initial}
            weapon.setdefault('extensions', {}).setdefault(CAPABILITY, {}).update(stock=sid, cost=amount)
            notes.append(f'{provenance.get("turret")}/{resource}: finite source inventory {initial:g}, allied provider service {supplied["seconds"]:g}s with movement locked and firing permitted.')
            continue
        if tank_stocks(ini) is not None and resource in MAIN_STOCKS:
            continue  # The complete finite inventory and shared feed are bound below.
        selected_tag = re.search(r'self\.tags\(includes=["\']([^"\']+)["\']\)', turret.get('canAttackCondition', ''), re.I)
        selected = selected_tag[1] if selected_tag else weapon.get('_projectile', '')
        policy, reason = magazine_policy(ini, resource, selected)
        if not policy:
            if resource in ('穿甲弹', '高爆弹', '破甲弹', 'ATGM'):
                reason = ('finite tank inventory has an unreviewed source resupply/initial-stock contract; the ordinary ten-second tank service is not substituted')
            elif entry.get('movement') == 'AIR':
                reason = 'finite aircraft inventory needs source paid/landing/rearm actions'
            notes.append(f'{provenance.get("turret")}/{resource}: ammunition omitted: {reason}; no artificial stock or refill.')
            continue
        if amount > policy['capacity']:
            notes.append(f'{provenance.get("turret")}/{resource}: source shot cost exceeds magazine capacity; omitted.')
            continue
        sid = stock_id(resource)
        stock = {'id': sid, 'label': stock_label(resource),
                 **{k: policy[k] for k in ('capacity', 'initial', 'refillAfter')}}
        if policy.get('queuedReload'):
            stock['queuedReload'] = True
        idle = idle_reload_policy(ini, resource, selected)
        if idle:
            stock['idleReload'] = idle
        # Resource aliases shared by separate genuine barrels share one stock.
        if sid in stocks and stocks[sid] != stock:
            raise ValueError(f'{entry["rwName"]}: inconsistent source magazine {resource}')
        stocks[sid] = stock
        weapon.setdefault('extensions', {}).setdefault(CAPABILITY, {}).update(stock=sid, cost=amount)
        notes.append(f'{provenance.get("turret")}/{resource}: source magazine {policy["capacity"]:g}, cost {amount:g}/shot; empty refill {policy["refillAfter"]:g}s from {policy["timer"]} + {policy["refill"]}. Source explicitly supplies unlimited replacement magazines.')
    if stocks:
        definition.setdefault('extensions', {})[CAPABILITY] = {'stocks': list(stocks.values())}
    if supplied and stocks:
        service_stocks = [stock_id(resource) for resource in supplied['stocks'] if stock_id(resource) in stocks]
        if service_stocks:
            definition['extensions'][CAPABILITY].update(serviceSeconds={'tank-resupply': supplied['seconds']}, serviceStocks={'tank-resupply': service_stocks})
    if tank_stocks(ini) is not None and any(resource_values(ini.get(w.get('_source', {}).get('turret'), {}).get('resourceUsage')) and set(resource_values(ini.get(w.get('_source', {}).get('turret'), {}).get('resourceUsage'))) & set(MAIN_STOCKS) for w in definition.get('weapons', [])):
        notes.extend(bind_tank_inventory(ini, definition))
    elif any(s.startswith('turret_HE_') for s in ini) and any(s.startswith('turret_APFSDS_') for s in ini):
        notes.append('Main-gun alternate ammunition remains omitted on this unaudited vehicle. The reviewed shared-tank service and feed mapping is not assumed to cover this different source contract.')
    if 'hiddenAction_装填重置' in ini and stocks:
        notes.append('Source idle partial-magazine reload is retained where its exact timer, shot reset and stock threshold are compiled.')
    return notes


def augment_supply_provider(definition, tank_ini):
    """Map the source supply-center tag to the existing pack-owned depot."""
    crew = tank_ini.get('action_suppMemb', {})
    needs = '(self.resource.crewR<1 or memory.dri >= 100 or memory.gun >=100 )'
    nearby = "(self.hasUnitInTeam(withTag='维修',withinRange=240) or self.numberOfUnitsInAllyNotOwnTeam(withTag=\"维修\",withinRange=240,greaterThan=0))"
    if (seconds(crew.get('buildSpeed')) != 18 or crew.get('whenBuilding_cannotMove') != 'true'
            or any(crew.get(k) for k in ('price', 'takeResources', 'whenBuilding_cannotAttack'))
            or crew.get('isLocked') != 'if not ' + needs
            or crew.get('isLockedAlt') != 'if not ' + nearby
            or crew.get('requireConditional') != 'if ' + needs + ' and ' + nearby
            or crew.get('setResourcesWithLogic') != 'crewR=select(1==0,1,1),crewRhp=100'):
        raise ValueError('T90M crew supply differs from the audited source')
    definition.setdefault('extensions', {})[CAPABILITY] = {'services': [{
        'id': 'tank-resupply', 'label': ['Resupply ammunition & ERA', '补给弹药与反应装甲', '탄약 및 반응장갑 보급'],
        'mode': 'refill', 'range': 240 * .4,
        'stocks': [value[0] for value in MAIN_STOCKS.values()],
        'seconds': 10, 'stationary': False, 'lockMovement': True,
        'lockWeapons': False, 'providerStationary': False, 'components': ['protection']}, {
        'id': 'tank-crew', 'label': ['Replenish crew', '补充车组成员', '승무원 보충'],
        'mode': 'refill', 'range': 240 * .4, 'stocks': [], 'seconds': 18,
        'stationary': False, 'lockMovement': True, 'lockWeapons': False,
        'providerStationary': False, 'components': ['crew']}] }
    definition['extensions']['components-v1'] = {'services': ['maintenance'], 'parts': []}
    return ['The existing native-economy supply depot provides the source BASEF repair-tag service: allied recipient within 240 RW (96 world pixels), 10s ammunition/ERA or 18s crew service, movement locked and firing permitted. It restores carried rounds and ERA with the source spent-rack adjustment, or replenishes the crew pool. Paid aircraft rearm remains omitted.']

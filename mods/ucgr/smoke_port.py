"""Source tank-template smoke: grenade launchers, engine smoke and smokeG markers.

Shared by 模板/坦克模板.key and 模板/步战车模板.key. Every field is checked
against the audited template; any other variant raises and is reported, never
approximated. RW 1.15 evidence:

- class_113 fires an action turret through the projectile spawner: the round
  starts at its launcher and aims at the unit position plus the offset rotated
  by the unit heading (forward = offset y, lateral = offset x).
- Projectile life counts down to 0 and explodeOnEndOfLife bursts at 0, so a
  life-0 smoke round bursts on its first update at its launcher.
- autoTrigger is checked every frame and waits its default 60-frame trigger
  cooldown after firing; smokeG uses the default 50-frame shootDelay and starts
  at full energy (energyStartingPercentage 1).
"""
import re
import rw
from sensors_port import SourceMismatch
from articulation_port import _id
from weapons import seconds

MARKER = '中立及通用单位/烟雾弹/烟雾弹.ini'
KOREAN = {'Deploy Smoke': '연막탄 발사', 'Engine Smoke': '엔진 연막 방출'}
RW_TO_WORLD = .4


def _expect(ini, section, values):
    data = ini.get(section)
    if data is None:
        raise SourceMismatch(f'missing [{section}]')
    for key, value in values.items():
        if data.get(key) != value:
            raise SourceMismatch(f'[{section}] {key}={data.get(key)!r}, expected {value!r}')
    return data


def source_marker():
    ini = rw.load_unit(rw.RW / MARKER)
    _expect(ini, 'core', {'name': 'smokeG', 'energyMax': '2', 'energyRegen': '0.015', 'tags': '烟雾', 'isUnselectable': 'true'})
    if 'shootDelay' in ini.get('attack', {}) or 'energyStartingPercentage' in ini['core'] or 'startEnergyAtZero' in ini['core']:
        raise SourceMismatch('smokeG firing or energy defaults changed')
    _expect(ini, 'action_death', {'autoTrigger': 'if self.timeAlive(laterThanSeconds=5)', 'deleteSelf': 'true'})
    _expect(ini, 'turret_烟雾弹拦截', {'energyUsage': '1', 'interceptProjectiles_withTags': 'ATGM',
                                   'interceptProjectiles_andUnderDistance': '100', 'projectile': 'KAZProjectile'})
    _expect(ini, 'projectile_KAZProjectile', {'directDamage': '0', 'areaDamage': '0', 'speed': '99',
                                            'interceptProjectile_removeTargetLifeOnly': 'true'})
    return ini, {'life': 5, 'range': 100 * RW_TO_WORLD, 'energy': 2, 'regen': .015 * 60, 'usage': 1,
                 'reload': 50 / 60, 'tags': ['ATGM']}


def _gate(ini, section, memory, parts, part):
    condition = ini[section].get('isActive', '')
    match = re.fullmatch(r'if memory\.' + memory + r'<(\d+) and not self\.hasFlag\(id=19\)', condition)
    hp = next((p.get('hp') for p in parts if p['id'] == part), None)
    if not match or hp is None or abs(float(match[1]) - hp) > 1e-6:
        raise SourceMismatch(f'[{section}] gate does not match the component {part} threshold')
    return match


def _point(definition, turret):
    x, y = float(turret.get('x', 0)), float(turret.get('y', 0))
    point = {'x': x * RW_TO_WORLD, 'y': -y * RW_TO_WORLD}
    parent = turret.get('attachedTo')
    if parent:
        if turret.get('slave') != 'true':
            raise SourceMismatch('smoke launcher attached without slave')
        mount = _id(parent)
        mounts = {m['id'] for m in definition.get('extensions', {}).get('articulation-v1', {}).get('mounts', [])}
        if mount not in mounts:
            raise SourceMismatch(f'smoke launcher rides unported turret {parent}')
        point['mount'] = mount
    return point


def augment_smoke(entry, ini, definition):
    a = ini.get('action_烟雾弹')
    if not a:
        return []
    if '无烟' in [t.strip() for t in ini.get('core', {}).get('tags', '').split(',')]:
        return ['Source smoke actions hidden by the 无烟 tag.']
    parts = definition.get('extensions', {}).get('components-v1', {}).get('parts', [])
    try:
        _, marker = source_marker()
        smoke = {'marker': marker}
        _expect(ini, 'action_烟雾弹', {'text': '[Deploy Smoke]', 'text_zh': '[投掷烟雾弹]', 'buildSpeed': '0s',
            'addActionCooldownTime': '30s', 'addActionCooldownApplyToActions': '尾烟,烟雾弹', 'alsoTriggerAction': '烟雾弹2,烟雾弹3,烟雾弹4',
            'fireTurretXAtGround': 'smoke1', 'fireTurretXAtGround_withProjectile': '烟雾弹', 'fireTurretXAtGround_count': '1',
            'isVisible': 'if not self.tags(includes="无烟")', 'highPriorityQueue': 'true'})
        if a.get('requireConditional') != a.get('isActive'):
            raise SourceMismatch('smoke action gate and condition differ')
        _gate(ini, 'action_烟雾弹', 'gun', parts, 'gunner')
        launchers, aim = [], []
        for i, section in enumerate(['action_烟雾弹', 'action_烟雾弹2', 'action_烟雾弹3', 'action_烟雾弹4']):
            data = _expect(ini, section, {'buildSpeed': '0s', 'fireTurretXAtGround': f'smoke{i + 1}',
                                          'fireTurretXAtGround_withProjectile': '烟雾弹', 'fireTurretXAtGround_count': '1'})
            if i and data.get('isVisible') != 'false':
                raise SourceMismatch(f'[{section}] is a visible action')
            ox, oy = (float(v) for v in data['fireTurretXAtGround_withOffset'].split(','))
            aim.append({'forward': oy * RW_TO_WORLD, 'lateral': ox * RW_TO_WORLD})
            turret = _expect(ini, f'turret_smoke{i + 1}', {'projectile': '烟雾弹', 'canShoot': 'false', 'invisible': 'true'})
            launchers.append(_point(definition, turret))
        projectile = _expect(ini, 'projectile_烟雾弹', {'spawnUnit': 'smokeG', 'targetGround': 'true', 'directDamage': '0'})
        grenades = {'label': ['Deploy Smoke', '投掷烟雾弹', KOREAN['Deploy Smoke']], 'cooldown': 30.0, 'launchers': launchers, 'aim': aim}
        if projectile.get('life') == '0' and projectile.get('explodeOnEndOfLife') == 'true':
            pass  # bursts on its first update at the launcher
        elif projectile.get('life') == '999' and 'explodeOnEndOfLife' not in projectile and not any(k in projectile for k in ('gravity', 'targetSpeed', 'turnSpeed')):
            smoke['flight'] = {'speed': float(projectile['speed']) * 24, 'spread': float(projectile['targetGroundSpread']) * RW_TO_WORLD}
        else:
            raise SourceMismatch('unreviewed smoke round life/motion')
        smoke['grenades'] = grenades
        b = ini.get('action_尾烟')
        if b:
            _expect(ini, 'action_尾烟', {'text': '[Engine Smoke]', 'text_zh': '[释放引擎烟]', 'buildSpeed': '0s',
                'temporarilyAddTags': '释放引擎烟', 'setUnitMemory': 'smoke_back_timer=self.timeAlive()',
                'isVisible': 'if not self.tags(includes="无烟")'})
            _gate(ini, 'action_尾烟', 'dri', parts, 'driver')
            shared = b.get('addActionCooldownApplyToActions')
            if shared not in (None, '尾烟,烟雾弹'):
                raise SourceMismatch('engine smoke cooldown sharing changed')
            _expect(ini, 'hiddenAction_尾烟释放', {
                'autoTrigger': 'if self.tags(includes="释放引擎烟") and self.timeAlive()-memory.smoke_back_timer<10 and int(self.timeAlive()*10)%10==0',
                'fireTurretXAtGround': '尾烟', 'fireTurretXAtGround_withProjectile': '烟雾弹', 'fireTurretXAtGround_withOffset': '0,0', 'fireTurretXAtGround_count': '1'})
            _expect(ini, 'hiddenAction_尾烟释放结束', {'autoTrigger': 'if self.tags(includes="释放引擎烟") and self.timeAlive()-memory.smoke_back_timer>10',
                                                  'temporarilyRemoveTags': '释放引擎烟'})
            if any(k in ini['hiddenAction_尾烟释放'] for k in ('autoTriggerCooldownTime', 'autoTriggerCheckRate')):
                raise SourceMismatch('engine smoke trigger cadence changed')
            turret = _expect(ini, 'turret_尾烟', {'projectile': '烟雾弹', 'invisible': 'true'})
            smoke['engine'] = {'label': ['Engine Smoke', '释放引擎烟', KOREAN['Engine Smoke']], 'cooldown': seconds(b['addActionCooldownTime']),
                               'shared': shared is not None, 'duration': 10.0, 'point': _point(definition, turret), 'aim': {'forward': 0.0, 'lateral': 0.0}}
    except SourceMismatch as error:
        return [f'Source smoke omitted: {error}']
    definition.setdefault('extensions', {}).setdefault('components-v1', {})['smoke'] = smoke
    notes = ['Source smoke: Deploy Smoke drops four 5 s smokeG markers at its launchers' + (' after their flight to the rotated aim points' if 'flight' in smoke else '') +
             '; each removes the life of one enemy ATGM-tagged round within 40 px (energy 2, +0.9/s, 1 per round, 0.83 s reload); 30 s cooldown shared with engine smoke.']
    if 'engine' in smoke:
        notes.append(f'Source engine smoke: one marker per whole second of age for 10 s at the hull rear; {smoke["engine"]["cooldown"]:g} s cooldown' +
                     (' shared with Deploy Smoke.' if smoke['engine']['shared'] else ' on itself only.'))
    notes.append('Not represented: DynamicLoS target nudges from smoke, smokeG soft collision and enemy auto-targeting of the invulnerable marker unit.')
    if 'flight' in smoke:
        notes.append('The flying smoke round (烟雾榴弹.png) is not drawn; its marker and cloud appear on landing.')
    return notes


def smoke_feedback(feedback, entry, ini):
    """Action sound and the marker's own cloud/sound, compiled by the feedback exporter."""
    marker_ini, _ = source_marker()
    marker_entry = {'rwName': 'smokeG', 'source': MARKER, 'id': 'usgr-re-smokeg'}
    _expect(marker_ini, 'action_烟雾效果', {'autoTriggerOnEvent': 'created', 'spawnEffects': '烟雾弹'})
    sound = _expect(marker_ini, 'hiddenAction_烟雾弹音效播放', {'autoTriggerOnEvent': 'created'})['playSoundAtUnit']
    cloud = feedback.effects(marker_entry, marker_ini, '烟雾弹')
    if not cloud or 'picture' not in cloud[0]:
        raise SourceMismatch('smokeG cloud effect did not compile')
    marker_cue = feedback.voice(sound.replace('\\', '/'), marker_entry, marker_ini, 'hiddenAction_烟雾弹音效播放', 'playSoundAtUnit', 'audio')
    action_cue = feedback.voice(ini['action_烟雾弹']['playSoundAtUnit'], entry, ini, 'action_烟雾弹', 'playSoundAtUnit', 'audio')
    if ini.get('action_尾烟') and ini['action_尾烟'].get('playSoundAtUnit') != ini['action_烟雾弹']['playSoundAtUnit']:
        raise SourceMismatch('engine smoke plays a different action sound')
    node = {'chance': 1.0, 'land': True, 'water': True}
    return {'smoke': [{**node, 'cue': action_cue}], 'smoke-marker': [*cloud, {**node, 'cue': marker_cue}]}

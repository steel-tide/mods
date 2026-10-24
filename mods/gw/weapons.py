"""GW weapons as data: what each turret fires, when, how often, and its payload.

A GW turret fires a dummy round that spawns a projectile *unit*; that unit's
`addResources` carry the real figures (ShellDamage, BeamDamage, CqbDamage, their
AP parts, DP, accuracy, the Anti* terrain factors, size factors, speed, spread,
life and blast). Two firing styles exist:

* `canShoot:true` — the RW turret shoots on its own, `resourceUsage` takes one
  round of a `<W>_Shoot` magazine (and `en=N` EN) per shot, and an empty
  magazine waits `<W>_CD` seconds before refilling.
* `canShoot:false` — an `Attack` message runs `<W>_Trigger` → `<W>_Fire`, which
  spends `<W>_EN` EN, starts a `<W>_CD` cooldown and queues a fire sequence:
  wind-up steps, then shots spaced by the turret's `delay`.

Which weapon fires is decided in `_Trigger`: the loadout (`EquipmentIndex`),
the distance band (melee inside 60 RW px, guns beyond), and fallbacks for a
broken arm or a skilled pilot.
"""
import re
import gw

MELEE_RANGE = 60  # RW px: GW's `distanceBetween(self, self.attacking) <= 60`


def payload(spawn):
    """`Projectile_MG*1(addResources=ShellDamage:575|DpDamage:30|…)` → name, figures."""
    text = ' '.join((spawn or '').split())
    m = re.match(r'\s*(\w+)\s*\*\s*\d+\s*\((.*)\)\s*$', text)
    if not m:
        return None, {}
    name, body = m[1], m[2]
    body = re.sub(r'^\s*addResources\s*=\s*', '', body)
    out = {}
    for item in body.split('|'):
        k, _, v = item.replace('=', ':', 1).partition(':')
        k, v = k.strip(), v.strip()
        if k:
            # a stray word after the figure (`0.75 0`) leaves its leading number
            lead = re.match(r'-?\d+(?:\.\d+)?', v)
            out[k] = gw.num(v, gw.num(lead[0]) if lead else v)
    return name, out


def _globals(ini):
    return {k[8:].strip(): v for k, v in ini.get('core', {}).items() if k.startswith('@global ')}


def _list(value):
    return [x.strip() for x in re.split(r'[,\n]', value or '') if x.strip()]


def _seconds(value, default=0.0):
    v = gw.num(str(value or '').strip().rstrip('s'))
    return default if v is None else v


def _fires(ini, action):
    sec = ini.get('hiddenAction_' + action) or ini.get('action_' + action) or {}
    return sec.get('fireTurretXAtGround', '').strip(), _seconds(sec.get('buildSpeed'), 0)


def sequence(ini, weapon, start=None):
    """Shots and their spacing from `<W>_Fire`'s queued steps (or another
    action's, `start`): (turrets fired, wind-up, gaps)."""
    fire = (ini.get(start) if start else None) or ini.get('hiddenAction_' + weapon + '_Fire') or ini.get('action_' + weapon + '_Fire') or {}
    queue = []
    stack = _list(fire.get('alsoTriggerAction')) + _list(fire.get('alsoQueueAction'))
    seen = set()
    while stack:
        name = stack.pop(0)
        if name in seen:
            continue
        seen.add(name)
        sec = ini.get('hiddenAction_' + name) or ini.get('action_' + name) or {}
        queued = _list(sec.get('alsoQueueAction'))
        if queued:
            queue.extend(queued)
        elif sec.get('fireTurretXAtGround'):
            queue.append(name)
    shots, gaps, windup, elapsed, first = [], [], 0.0, 0.0, True
    for name in queue:
        turret, delay = _fires(ini, name)
        elapsed += delay
        if turret:
            if first:
                windup, first = elapsed, False
            else:
                gaps.append(elapsed)
            shots.append(turret)
            elapsed = 0.0
    return shots, windup, gaps


def classify(cond):
    """Read a `_Trigger` condition: loadout, distance band, and whether the port fires it."""
    c = ' '.join((cond or '').split())
    out = {'eq': None, 'eq2': None, 'melee': None, 'min': None, 'skip': None, 'hand': False}
    if 'armRBreaked==true' in c or 'armLBreaked==true' in c:
        out['skip'] = 'fallback for a broken arm'
    # fired from the right hand: a broken right arm holds it
    out['hand'] = 'armRBreaked==false' in c
    if 'pilotUnit' in c or 'pilot' in c.lower() and 'Skill' in c:
        out['skip'] = out['skip'] or 'needs a skilled pilot'
    m = re.search(r'EquipmentIndex==(\d+)', c)
    out['eq'] = int(m[1]) if m else None
    m = re.search(r'EquipmentIndex2==(\d+)', c)
    out['eq2'] = int(m[1]) if m else None
    m = re.search(r'distanceBetween\(self,\s*self\.attacking\)\s*<=\s*(\d+(?:\.\d+)?)', c)
    lo = re.search(r'distanceBetween\(self,\s*self\.attacking\)\s*>=?\s*(\d+(?:\.\d+)?)', c)
    if lo:
        out['min'] = float(lo[1])
    elif m:
        out['melee'] = float(m[1])
    return out


def turret_weapons(ini):
    """Every armed turret: its trigger, cadence and payload (no loadout filtering)."""
    g = _globals(ini)
    out = []
    for sec, t in ini.items():
        if not sec.startswith('turret_'):
            continue
        w = sec[7:]
        proj = ini.get('projectile_' + t.get('projectile', ''), {})
        unit, figures = payload(proj.get('spawnUnit'))
        spawned = None
        if not unit:
            # a turret that launches a unit of its own (a funnel, an incom) carries no payload
            m = re.match(r'\s*(\w+)\s*\*\s*(\d+)\s*$', ' '.join((proj.get('spawnUnit') or '').split()))
            if not m or not gw.unit(m[1])[1]:
                continue
            unit, spawned = m[1], m[1]
        trig_sec = 'hiddenAction_' + w + '_Trigger'
        action_sec = 'action_' + w + '_Trigger'
        trigger = ini.get(trig_sec)
        rec = dict(id=w, turret=t, projectileUnit=unit, figures=figures, canShoot=t.get('canShoot', '').strip().lower() == 'true',
                   cd=_seconds(g.get(w + '_CD'), 0), en=_seconds(g.get(w + '_EN'), 0), magazine=int(_seconds(g.get(w + '_Shoot'), 1) or 1),
                   delay=_seconds(t.get('delay'), 0), barrelY=_seconds(t.get('barrelY'), 0), barrelX=_seconds(t.get('barrelX'), 0),
                   x=_seconds(t.get('x'), 0), y=_seconds(t.get('y'), 0), sound=t.get('shoot_sound', ''), soundOrigin=ini.origins.get(sec, {}).get('shoot_sound'),
                   flame=t.get('shoot_flame', ''), maxAngle=_seconds(t.get('canAttackMaxAngle'), 180), button=action_sec in ini,
                   spawned=spawned)
        use = t.get('resourceUsage', '')
        m = re.search(r'\ben\s*=\s*([\d.]+)', use)
        rec['enPerShot'] = float(m[1]) if m else 0.0
        if trigger is not None:
            rec['trigger'] = classify(trigger.get('requireConditional'))
            shots, windup, gaps = sequence(ini, w)
            rec['shots'], rec['windup'], rec['gaps'] = shots, windup, gaps
        if rec['button']:
            # a player's skill: what its button says and asks, and the shots it queues
            act = ini[action_sec]
            locked = ' '.join(' '.join(v.split()) for k, v in act.items() if k.startswith('isLocked'))
            rec['skill'] = dict(text=act.get('text', ''), text_zh=act.get('text_zh', ''), visible=' '.join(act.get('isVisible', '').split()), locked=locked,
                                aim='ground' if act.get('fireTurretXAtGround_count', '').strip() == '0' else 'self',
                                ai=('hiddenAction_' + w + '_Trigger_ByAI') in ini)
            shots, windup, gaps = sequence(ini, w, action_sec)
            rec['skill']['shots'], rec['skill']['windup'], rec['skill']['gaps'] = len(shots), windup, gaps
        out.append(rec)
    return out


def used(weapons, eq=0, eq2=0):
    """The weapons a loadout fires on its own, and why the rest are left out."""
    shooters = {s for w in weapons for s in w.get('shots', [])}
    keep, dropped = [], []
    for w in weapons:
        if w.get('spawned') and not w['button']:
            dropped.append((w['id'], 'launches a unit on its own'))
            continue
        if w['button']:
            # A player's skill, offered on the unit's card for the loadouts that show it.
            m = re.search(r'EquipmentIndex==(\d+)', w['skill']['visible'])
            if m and int(m[1]) != eq:
                dropped.append((w['id'], f'another loadout (EquipmentIndex {m[1]})'))
                continue
            keep.append(w)
            continue
        trig = w.get('trigger')
        if trig is None:
            if w['canShoot']:
                keep.append(w)
            elif w['id'] not in shooters:
                dropped.append((w['id'], 'never fired'))
            continue
        if trig['skip']:
            dropped.append((w['id'], trig['skip']))
            continue
        if trig['eq'] is not None and trig['eq'] != eq or trig['eq2'] is not None and trig['eq2'] != eq2:
            dropped.append((w['id'], f'another loadout (EquipmentIndex {trig["eq"]}/{trig["eq2"]})'))
            continue
        keep.append(w)
    return keep, dropped

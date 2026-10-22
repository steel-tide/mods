"""Retain source target-tag restrictions across acquisition, tracking and firing.

Only literal source tags are represented here. Dynamic concealment, sensors and
equipment state are separate policies; this does not evaluate RW expressions.
"""
import re
from weapons import seconds

CAPABILITY = 'usgr-re.targeting-v1'


def infantry_concealment(ini, source_tags, definition=None):
    """Literal MAS1/2/3 detection tables, with independent trench actions."""
    ranks = [n for n in (1, 2, 3) if f'MAS{n}' in source_tags]
    if len(ranks) != 1:return None
    rank = ranks[0]
    out = {}
    compact=lambda value:re.sub(r'\s+', '', value)
    for trench in (False,True):
        policies={}
        names = ((f'hiddenAction_trigger_mas_{rank}',f'hiddenAction_trigger_mas2_{rank}') if not trench else
                 (('hiddenAction_trigger_mas_1战壕','hiddenAction_trigger_mas1战壕解除') if rank==1 else
                  (f'hiddenAction_trigger_mas{rank}战壕',f'hiddenAction_trigger_mas{rank}战壕解除')))
        for mode,name in zip(('enter','leave'),names):
            action=ini.get(name,{});expr=action.get('autoTrigger','')
            pairs=re.findall(r'numberOfUnitsInEnemyTeam\(withinRange=(\d+),withTag="([^"]+)",\s*greaterThan=0\)',expr)
            if len(pairs)!=4 or set(tag for _,tag in pairs)!={'装甲','soldiers','UAV','HELI'}:return None
            checks=[f'numberOfUnitsInEnemyTeam(withinRange={distance},withTag="{tag}",greaterThan=0)' for distance,tag in pairs]
            parent=('' if trench else 'not ')+"self.parent.tags(includes='战壕')"
            if mode=='enter':
                expected='if ('+' and '.join('not '+c for c in checks)+" and not self.tags(includes='隐蔽') and not self.isMoving())"+f' and self.tags(includes="MAS{rank}") and '+parent
                if rank==3:expected+=' and self.energy(full=true)'
            elif rank==3:
                expected='if ('+' or '.join(checks)+' or not self.energy(full=true))'+f' and self.tags(includes="MAS{rank}") and '+parent+" and self.tags(includes='隐蔽')"
            else:
                expected='if ('+' or '.join(checks)+f') and self.tags(includes=\'隐蔽\') and self.tags(includes="MAS{rank}") and '+parent
            effect='temporarilyAddTags' if mode=='enter' else 'temporarilyRemoveTags'
            if compact(expr)!=compact(expected) or action.get(effect)!='隐蔽' or set(action)!={'autoTrigger',effect,'buildSpeed','isVisible'}:return None
            policies[mode]=[{'tag':tag,'range':int(distance)*.4} for distance,tag in pairs]
        if trench:out['trench']=policies
        else:out.update(policies)
    core=ini['core'];rate=re.fullmatch(r'every(\d+)Frames',core.get('autoTriggerCheckRate',''))
    if not rate or not core.get('autoTriggerCooldownTime'):return None
    out.update(interval=int(rate[1])/60,cooldown=seconds(core['autoTriggerCooldownTime']))
    if rank==3:
        try:maximum=float(core['energyMax']);regen=float(core['energyRegen'])*60
        except (ValueError,KeyError):return None
        if maximum<=0 or regen<0 or definition is None:return None
        costs=[]
        for weapon in definition.get('weapons',[]):
            raw=ini.get(weapon.get('_source',{}).get('turret'),{}).get('energyUsage','0')
            try:amount=float(raw)
            except ValueError:return None
            if amount:costs.append({'id':weapon['id'],'amount':amount})
        for name,fields in ini.items():
            if name.startswith(('action_','hiddenAction_')) and any(key in fields for key in ['addEnergy','setEnergy']) or 'energy=' in fields.get('setUnitStats','') or 'energyMax=' in fields.get('setUnitStats',''):return None
        out['energy']={'max':maximum,'regen':regen,'costs':costs}
    return out


def tags(value):
    result = list(dict.fromkeys(s.strip() for s in str(value or '').split(',') if s.strip()))
    if len(result) > 128 or any(len(s) > 100 or any(c in s for c in '()=\n') for s in result):
        raise ValueError(f'nonliteral source tags: {value!r}')
    return result


def augment_targeting(entry, ini, definition):
    source_tags = tags(ini.get('core', {}).get('tags'))
    if 'soldiers' in source_tags:
        from media import initial_equipment_tags
        source_tags = list(dict.fromkeys(source_tags + initial_equipment_tags(ini)))
    config = {'tags': source_tags}
    concealment = infantry_concealment(ini, source_tags, definition)
    if concealment:
        config['concealment'] = concealment
    definition.setdefault('extensions', {})[CAPABILITY] = config
    attack = ini.get('attack', {})
    for weapon in definition['weapons']:
        turret = ini.get(weapon.get('_source', {}).get('turret'), {})
        rules = {}
        for source, dest in [('canOnlyAttackUnitsWithTags', 'withTags'), ('canOnlyAttackUnitsWithoutTags', 'withoutTags')]:
            # A turret's explicit field overrides the general attack field.
            value = tags(turret.get(source, attack.get(source)))
            if value:
                rules[dest] = value
        self_tag = re.fullmatch(r'if self\.tags\(includes=["\']([^"\']+)["\']\)', turret.get('canAttackCondition', '').strip(), re.I)
        if self_tag:
            rules['selfWithTags'] = tags(self_tag[1])
        if rules:
            weapon.setdefault('extensions', {})[CAPABILITY] = rules
    return []

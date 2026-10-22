"""Literal anti-radiation controller/missile compilation; no source code executes.

The aircraft's sandbox action equips a finite controller magazine. The invisible
controller is virtual; its released, attackable missile bodies remain entities.
The return value explicitly lists those extra original-art definitions for port.py.
"""
from copy import deepcopy
import math
import re

import rw
from weapons import source_index, seconds
from sensors_port import SourceMismatch, _same, _number
from source_stats import unit_stats
from component_port import compile_component_payloads

CAPABILITY = 'sensors-v1'
FAMILIES = ('AGM88', 'KH31P', 'YJ91')

def _unit(name):
    entry = source_index()[name]
    return deepcopy(entry), rw.load_unit(rw.RW / entry['source'])

def _n(ini, section, key, lo=0, hi=100000):
    return _number(ini[section].get(key), section+'.'+key, lo, hi)

def source_sead_family(family):
    if family not in FAMILIES:
        raise SourceMismatch('Unrecognized anti-radiation family')
    ce, c = _unit(family+'导引头')
    me, m = _unit(family+'反辐射弹药')
    pe, p = _unit(family)
    search = next(k for k in c if k.startswith('hiddenAction_搜索_'))
    for section, key, expected in [
        ('core', 'maxTransportingUnits', '4'),
        ('core', 'transportUnitsKillOnDeath', 'true'),
        (search, 'autoTrigger', f'if not self.hasActiveWaypoint() and self.resource.{family}>0 and parent.energy>0'),
        (search, 'takeResources_includeUnitsWithinRange_team', 'enemy'),
        (search, 'takeResources_excludeUnitsWithoutTags', '雷达工作中'),
        (search, 'takeResources_searchOnly', 'true'),
        (search, 'alsoQueueAction', '发射'),
        ('hiddenAction_标记', '@define CON1', 'max(self.dir-directionBetween(self,thisActionTarget.getAsMarker),-(self.dir-directionBetween(self,thisActionTarget.getAsMarker)))<=60'),
        ('hiddenAction_标记', '@define CON2', 'select(self.resource.优先级设置==0,true,select(self.resource.优先级设置==1,thisActionTarget.tags(includes="中价值") or thisActionTarget.tags(includes="高价值"),thisActionTarget.tags(includes="高价值")))'),
        ('hiddenAction_打击', 'addWaypoint_type', 'attack'),
        ('hiddenAction_打击', 'requireConditional', 'if distanceBetween(self,memory.Target_List[index])<=2500 and index<self.transportingCount()'),
        ('hiddenAction_发射完成1', 'temporarilyAddTags', '发射完成1'),
        ('hiddenAction_发射完成2', 'temporarilyRemoveTags', '发射完成2' if family=='AGM88' else '发射完成1'),
        ('turret_1', 'unloadUpToXUnitsAndGiveAttackOrder', '1'),
        ('turret_1', 'resourceUsage', family+'=1'),
        ('turret_2', 'resourceUsage', family+'=1'),
    ]:
        _same(c, section, key, expected)
    for section, key, expected in [
        ('core', 'canOnlyBeAttackedByUnitsWithTags', '雷达工作中'),
        ('core', 'disableDeathOnZeroHp', 'true'),
        ('core', 'tags', '反辐射,'+family),
        ('core', 'energyRegen', '0'),
        ('movement', 'moveDecelerationSpeed', '0'),
        ('hiddenAction_脱锁', 'clearAllWaypoints', 'true'),
        ('hiddenAction_脱锁', 'temporarilyAddTags', '脱锁'),
        ('hiddenAction_自爆', 'autoTrigger', 'if not self.hasActiveWaypoint'),
        ('hiddenAction_自爆', 'addEnergy', '-50'),
        ('action_设置高度', 'setHeight', 'customTarget1.height'),
        ('action_设置高度', 'setUnitStats', 'targetHeight=activeWaypointTarget.height,moveSpeed+=self.customTarget1.customTarget1.maxMoveSpeed()/3'),
        ('projectile_'+family, 'instant', 'true'),
        ('projectile_'+family, 'spawnUnit', family),
        ('hiddenAction_拦截', 'requireConditional', 'if eventSource.tags(includes="弹药拦截")'),
        ('hiddenAction_AHEAD拦截', 'autoTriggerOnEvent', 'tookDamage(withTag="AHEAD")'),
    ]:
        _same(m, section, key, expected)
    primary = 'projectile_'+family
    weapons = []
    for wid, meta, damage in [
        ('primary', {'projectile': primary}, _n(m,primary,'directDamage')*.6),
        ('payload', {'helper': {'source': pe['source'], 'projectile': 'projectile_b'}}, _n(p,'projectile_b','areaDamage')*.6),
    ]:
        weapons.append({'id':wid, 'cls':'cannon', 'range':1, 'dmg':damage, 'reload':20, 'projectile':'missile',
                        'targets':['ground','ship'], '_source':meta})
    definition = {'id':me['id'], 'weapons':weapons}
    payloads = compile_component_payloads(definition, m)
    for weapon in weapons:
        weapon['extensions'] = {'components-v1':payloads[weapon['id']]}
        del weapon['_source']
    profile = {
        'family':family, 'speed':_n(m,'movement','moveSpeed')*24,
        'acceleration':_n(m,'movement','moveAccelerationSpeed')*1440,
        'turnRate':_n(m,'movement','maxTurnSpeed')*math.pi/3,
        'turnAcceleration':_n(m,'movement','turnAcceleration')*math.pi*20,
        'inheritSpeed':1/3, 'heightRate':_n(m,'movement','heightChangeRate')*24,
        'initialHeight':_n(m,'movement','targetHeight')*.4,
        'energy':_n(m,'core','energyMax'), 'interval':seconds(m['core']['autoTriggerCooldownTime']),
        'lostDrain':50, 'proximity':_n(m,'turret_自爆','limitingRange')*.4,
        'primaryDamage':_n(m,primary,'areaDamage')*.6, 'primaryRadius':_n(m,primary,'areaRadius')*.4,
        'payloadDamage':_n(p,'projectile_b','areaDamage')*.6, 'payloadRadius':_n(p,'projectile_b','areaRadius')*.4,
        'payloadExpand':seconds(p['projectile_b']['areaExpandTime']),
        # TAM's own default eight-frame automatic action observes .1s cooldown.
        'payloadDelay':8/60,
        'primaryWeapon':'primary', 'payloadWeapon':'payload',
        'interceptionRange':_n(m,'turret_拦截','interceptProjectiles_andUnderDistance')*.4,
    }
    carrier = {'family':family, 'helper':me['id'], 'rounds':4,
               'range':_n(c,search,'takeResources_includeUnitsWithinRange')*.4,
               'scanLimit':int(_n(c,search,'takeResources_maxUnits')),
               'scanInterval':seconds(c['core']['autoTriggerCooldownTime']),
               'scanCone':math.pi/3, 'queueTime':seconds(c['hiddenAction_发射']['buildSpeed']),
               'waypointTime':seconds(c['hiddenAction_打击']['addWaypoint_maxTime']),
               'warmup':seconds(c['turret_1']['warmup']), 'reload':seconds(c['turret_1']['delay']),
               'launchCone':_n(c,'turret_1','limitingAngle')*math.pi/180,
               'lateral':[_n(c,'turret_'+str(i),'x',-100,100)*.4 for i in (1,2)],
               'alternate':family!='AGM88'}
    helper = {
        'id':me['id'], 'kind':'unit','domain':'air','tier':1,'cost':0,'buildTime':1,
        # Source disables HP death; the host's minimum HP is a noncombat
        # sentinel. Actual interception energy and death belong to sead.ts.
        'hp':1,'speed':profile['speed'],'turnRate':profile['turnRate'],
        'radius':_n(m,'core','radius')*.4,'vision':0,
        'armor':'air', 'power':0,'pop':0,'trail':'none',
        'producedBy':[], 'aiWeight':0, 'hovers':True, 'altitude':profile['initialHeight'],
        'name':[family+' anti-radiation missile',family+'反辐射导弹',family+' 대레이더 미사일'],
        'desc':['Radar-seeking missile.','追踪雷达辐射源的导弹。','레이더 방사원을 추적하는 미사일.'],
        'weapons':weapons, 'extensions':{CAPABILITY:{'seadMissile':profile,'ecm':_n(m,'core','@global ECM')},
                                        'usgr-re.targeting-v1':{'tags':['反辐射',family]}}}
    return carrier, helper, me

def source_sead_carrier(entry, ini):
    """A positive return is a fully checked source sandbox loadout action."""
    actions = [(f,ini.get('action_'+f)) for f in FAMILIES if ini.get('action_'+f)]
    if not actions:
        return None
    if len(actions)!=1:
        raise SourceMismatch('Multiple anti-radiation families on one carrier')
    family, action = actions[0]
    # Non-M5 deployment uses exactly the author's explicit sandbox action.
    _same(ini,'action_'+family,'isVisible','if globalSearchForFirstUnit(withTag="计时器").tags(includes="沙盒模式")')
    _same(ini,'action_'+family,'setResourcesWithLogic',family+'=4')
    _same(ini,'action_'+family,'attachments_addNewUnits',family+'导引头')
    slot = action['attachments_onlyOnSlots']
    _same(ini,'attachment_'+slot,'rotateWithParent','true')
    _same(ini,'attachment_'+slot,'keepAliveWhenParentDies','false')
    if action.get('alsoTriggerAction'):
        raise SourceMismatch('SEAD loadout also changes another attachment magazine: '+action['alsoTriggerAction'])
    carrier, _, _ = source_sead_family(family)
    carrier['energy'] = _n(ini,'core','energyMax')
    carrier['energyRegen'] = _n(ini,'core','energyRegen',-1000,1000)*60
    carrier['severeDamage'] = .5
    _same(ini,'action_大破保护','setUnitStats','energy=0')
    reset = action.get('setUnitMemory')
    if reset:
        base = _n(ini,'movement','moveSpeed')
        if reset != f'Stats[0]={base:g}-0.05*{base:g}':
            raise SourceMismatch('Unrecognized SEAD aircraft speed reset: '+reset)
        carrier['speedReset'] = -.05
    return carrier

def augment_sead(entry, ini, definition):
    hits=[]
    for w in definition.get('weapons',[]):
        meta=w.get('_source',{}); projectile=ini.get(meta.get('projectile'),{})
        if meta.get('helper'):
            helper=rw.load_unit(rw.RW/meta['helper']['source'])
            projectile=helper.get(meta['helper'].get('projectile'),{})
        tags=projectile.get('tags','').split(',')
        energy=0
        for key,value in projectile.items():
            if key.endswith('_ifUnitWithTags') and value=='反辐射':
                match=re.fullmatch(r'energy=-(\d+(?:\.\d+)?)',projectile.get(key.replace('_ifUnitWithTags','_addResourcesAreaHit'),'').strip())
                if match:energy+=float(match[1])
        if 'missle' in tags or 'AHEAD' in tags or energy:
            hits.append({'id':w['id'],'missile':'missle' in tags,'ahead':'AHEAD' in tags,'energy':energy})
    if hits:
        definition.setdefault('extensions',{}).setdefault(CAPABILITY,{})['seadHits']=hits
    try:
        carrier = source_sead_carrier(entry,ini)
    except SourceMismatch as exc:
        return ['Anti-radiation loadout omitted: '+str(exc)]
    if not carrier:
        return []
    definition.setdefault('extensions',{}).setdefault(CAPABILITY,{})['seadCarrier']=carrier
    return ['Source finite '+carrier['family']+' controller, radar shutdown lock loss and separate TAM payload. Sandbox equip action retains ordinary empty start.']

def sead_helpers(definitions):
    """Return (definition, original inventory entry) pairs needed by carriers."""
    families = sorted({d['extensions'][CAPABILITY]['seadCarrier']['family'] for d in definitions
                       if d.get('extensions',{}).get(CAPABILITY,{}).get('seadCarrier')})
    return [(source_sead_family(f)[1],source_sead_family(f)[2]) for f in families]

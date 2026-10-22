"""Finite frontline FPV controllers and their original three drone bodies.

Only the carried non-M5 inventory is enabled. SUP purchases and rear FOB mission
requests remain outside this compiler. No arbitrary source expressions execute.
"""
from copy import deepcopy
import math
import re
import rw
from weapons import source_index, seconds, helper_payload
from component_port import compile_component_payloads, source_movement
from sensors_port import SourceMismatch, _same, _number

OPERATORS=('USFPVSQUAD','EUFPVSQUAD','PLAFPVSQUAD','RUSFPVSQUAD')
DRONES=('FPV','FPVPG7V','FPVRPOM')
def unit(name):
    e=source_index()[name]
    return deepcopy(e),rw.load_unit(rw.RW/e['source'])
def num(ini,s,k,lo=0,hi=100000):return _number(ini[s].get(k),s+'.'+k,lo,hi)

def fpv_operator_profile(entry,ini):
    if entry['rwName'] not in OPERATORS:return None
    checks=[('action_部署','buildSpeed','2s'),('action_部署','whenBuilding_cannotMove','true'),('action_部署','temporarilyAddTags','部署,soldiers'),('action_部署','setUnitStats','moveSpeed=0,maxAttackRange=1500'),('action_撤离','buildSpeed','2s'),('action_撤离','temporarilyRemoveTags','部署,soldiers,隐蔽'),('action_撤离','resetUnitStats','true'),('hiddenAction_设置FPV','setResourcesWithLogic','FPV=10'),('hiddenAction_侦察','spawnUnits','FPV'),('hiddenAction_侦察','autoTrigger','if self.tags(includes="部署") and not self.tags(includes="侦察升空") and self.resource.FPV!=0 and self.timeAlive()-memory.FPV_timer[1]>5 and memory.FPV_LIST.size<=3'),('hiddenAction_FPV_ATT','requireConditional','if self.tags(includes="部署") and self.resource.优先级设置!=2 and self.resource.FPV>=1 and self.timeAlive()-memory.FPV_timer[2]>10 and memory.FPV_LIST.size<=2'),('hiddenAction_FPV_ATT_DEPLOY1','spawnUnits','FPVRPOM'),('hiddenAction_FPV_ATT_DEPLOY2','spawnUnits','FPVPG7V'),('hiddenAction_返回','addResourcesWithLogic','FPV=1'),('hiddenAction_断线','shrinkArrays','FPV_List'),('hiddenAction_侦察FPV断线','temporarilyRemoveTags','侦察升空'),('attack','disablePassiveTargeting','true'),('core','autoTriggerCheckRate','every8Frames')]
    for s,k,v in checks:_same(ini,s,k,v)
    return {'drones':[source_index()[n]['id'] for n in DRONES],'stock':int(num(ini,'core','@global FPV_AM')),'range':600,'deployTime':2,'check':8/60,'cooldown':seconds(ini['core']['autoTriggerCooldownTime']),'reconDelay':5,'attackDelay':10}

def fpv_drone_definition(name):
    entry,ini=unit(name)
    if name not in DRONES:raise SourceMismatch('Unknown FPV body')
    recon=name=='FPV'
    checks=[('core','canNotBeGivenOrdersByPlayer','true'),('movement','moveSlidingMode','true'),('movement','moveIgnoringBody','true'),('movement','joinsGroupFormations','false'),('core','disableAllUnitCollisions','true'),('hiddenAction_断线2','autoTrigger','if not self.customTarget1.tags(includes="部署") or self.customTarget1==null'),('hiddenAction_断线2','setResourcesWithLogic','hp=0'),('hiddenAction_返航触发2','autoTrigger','if (self.energy(empty=true) or self.tags(includes="返回基地")) and distanceBetween(self,self.customTarget1)<=50'),('hiddenAction_返航触发2','deleteSelf','true'),('hiddenAction_返航触发2','sendMessageWithTags','FPV返回'),('action_巡逻','addWaypoint_position_relativeOffsetFromSelf','150,0'),('hiddenAction_击杀','buildSpeed','0.05s'),('hiddenAction_超低空模式启动','setUnitStats','targetHeight=25'),('hiddenAction_超低空模式完成','setUnitStats','targetHeight=50')]
    for s,k,v in checks:_same(ini,s,k,v)
    for key in ('heightChangeRate','targetHeightDrift','startingHeightOffset'):
        if key in ini['movement']:raise SourceMismatch('FPV native default changed: '+key)
    if 'autoTriggerCooldownTime' in ini['core'] or 'autoTriggerCheckRate' in ini['core']:raise SourceMismatch('FPV automatic clock changed')
    weapons=[];payloads=[]
    def weapon(wid,meta,source):
        w={'id':wid,'cls':'cannon','range':140/32 if recon else .5,'dmg':0,'reload':3 if recon else 20,'projectile':'bullet','targets':['ground','ship'],'_source':meta}
        data=compile_component_payloads({'id':entry['id'],'weapons':[w]},source)
        if wid in data:w['extensions']={'components-v1':data[wid]}
        weapons.append(w)
    if recon:
        _same(ini,'turret_laser','onShoot_triggerActions','引导');_same(ini,'projectile_3','directDamage','0')
        weapon('mark',{'turret':'turret_laser','projectile':'projectile_3'},ini)
    else:
        _same(ini,'projectile_弹药','instant','true')
        weapon('primary',{'turret':'turret_自爆','projectile':'projectile_弹药'},ini)
        spawn=ini['projectile_弹药']['spawnUnit']
        for i,(helper,chance) in enumerate(re.findall(r'([^,()]+)\(spawnChance=([\d.]+)\)',spawn)):
            he,h=unit(helper);hp=helper_payload(h)
            if not hp:raise SourceMismatch('Missing FPV helper payload: '+helper)
            wid='payload-'+str(i);weapon(wid,{'helper':{'source':he['source'],'projectile':hp[0]}},ini)
            if 'extensions' not in weapons[-1]:raise SourceMismatch('Uncompiled FPV helper: '+helper)
            payloads.append({'weapon':wid,'chance':float(chance),'delay':8/60})
        if len(payloads)!=2:raise SourceMismatch('Unreviewed FPV helper tree')
    cfg={'role':'recon' if recon else 'attack','energy':num(ini,'core','energyMax'),'regen':num(ini,'core','energyRegen',-100,0)*60,'linkDrain':100 if recon else 50,'speed':num(ini,'movement','moveSpeed')*24,'acceleration':num(ini,'movement','moveAccelerationSpeed')*1440*1.41,'deceleration':num(ini,'movement','moveDecelerationSpeed')*1440*1.41,'turnRate':num(ini,'movement','maxTurnSpeed')*math.pi/3,'turnAcceleration':num(ini,'movement','turnAcceleration')*math.pi*20,'height':num(ini,'movement','targetHeight')*.4,'range':140 if recon else 10,'reload':3 if recon else 20,'payloads':payloads}
    d={'id':entry['id'],'kind':'unit','domain':'air','tier':1,'cost':0,'buildTime':1,'hp':num(ini,'core','maxHp')*.6,'speed':cfg['speed'],'turnRate':cfg['turnRate'],'radius':num(ini,'core','radius')*.4,'vision':num(ini,'core','fogOfWarSightRange')*.25,'armor':'air','power':0,'pop':0,'trail':'none','producedBy':[],'aiWeight':0,'hovers':True,'altitude':cfg['height'],'name':[ini['core']['displayText'],ini['core']['displayText_zh'],{'FPV':'FPV 정찰 드론','FPVPG7V':'FPV 성형작약 드론','FPVRPOM':'FPV 열압력 드론'}[name]],'desc':['FPV','FPV','FPV'],'weapons':weapons,'extensions':{'components-v1':{'parts':[],'sourceMovement':source_movement(ini)},'sensors-v1':{'fpvDrone':cfg,'unmanned':True},'usgr-re.targeting-v1':{'tags':ini['core']['tags'].split(',')}}}
    return d,entry

def augment_fpv(entry,ini,definition):
    try:cfg=fpv_operator_profile(entry,ini)
    except SourceMismatch as exc:return ['FPV controller omitted: '+str(exc)]
    if cfg:definition.setdefault('extensions',{}).setdefault('sensors-v1',{})['fpvOperator']=cfg
    return ['Original finite frontline FPV controller, recon and separate helper warheads; paid SUP and rear-FOB mode omitted.'] if cfg else []


def write_fpv_evidence():
    import json
    entry,ini=unit(OPERATORS[0])
    out={'operator':fpv_operator_profile(entry,ini),'drones':[fpv_drone_definition(n)[0] for n in DRONES]}
    (rw.HERE/'fpv-source-data.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
    return out

if __name__=='__main__':write_fpv_evidence()

"""Literal source manual fire missions; no automatic artillery substitute."""
from copy import deepcopy
import re
import rw
from weapons import convert_weapons, seconds
from sensors_port import SourceMismatch, _same

SOURCES = {'2S35':'152mm炮弹覆盖触发', 'M109A7':'155mm炮弹覆盖触发',
           'PCL181':'155mm炮弹覆盖触发', 'PLZ05':'155mm炮弹覆盖触发', 'Pzh2000':'155mm炮弹覆盖触发', '凯撒':'155mm炮弹覆盖触发', '2S23':'迫击炮覆盖触发',
           'TOS1A':'火箭弹覆盖触发'}
# TOS-1A never attacks on its own ([attack] canAttack:false); its only fire is
# the deployed rocket barrage. These are the exact authored gates it carries.
TOS_GATES = {
    ('attack', 'canAttack'): 'false',
    ('turret_开火', 'canAttackFlyingUnits'): 'false',
    ('turret_开火', 'canAttackUnderwaterUnits'): 'false',
    ('turret_开火', 'canAttackLandUnits'): 'if memory.gun <100 and not self.hasFlag(id=19) and not self.hasFlag(id=23)',
    ('turret_开火', 'canAttackCondition'): 'if self.tags(includes="部署") and self.resource.火箭弹计数==0',
    ('turret_开火', 'slave'): 'true', ('turret_开火', 'attachedTo'): 'MAIN',
    ('turret_MAIN', 'canShoot'): 'false',
    ('turret_MAIN', 'invisible'): 'if self.hasFlag(id=24) or self.tags(includes="部署")',
    ('action_火箭弹覆盖触发', 'isVisible'): 'if self.tags(includes="部署")',
    ('action_火箭弹覆盖触发', 'isLocked'): 'if self.resource.火箭弹<6',
    ('action_火箭弹覆盖触发', 'addResources'): '火箭弹=-1',
    ('hiddenAction_火箭弹覆盖', 'addResources'): '火箭弹计数=-1,火箭弹=-1',
    ('hiddenAction_火箭弹覆盖', 'requireConditional'): 'if self.resource(type="火箭弹计数",greaterThan=0)',
    ('action_部署_1', 'temporarilyAddTags'): '部署', ('action_部署_1', 'setUnitStats'): 'moveSpeed=0,maxTurnSpeed=0',
    ('action_部署_1', 'alsoTriggerAction'): 'clearway',
    ('action_部署_2', 'temporarilyRemoveTags'): '部署',
    ('hiddenAction_clearway', 'autoTriggerOnEvent'): 'newWaypointGivenByPlayer',
    ('hiddenAction_clearway', 'clearActiveWaypoint'): 'true',
    ('hiddenAction_clearway', 'requireConditional'): 'if self.tags(includes="部署") and not self.hasActiveWaypoint(type="attack")',
}



def append_barrage_weapons(entry, ini, definition):
    name=entry['rwName']
    if name.endswith('未架设') and name[:-3] in SOURCES:
        from weapons import source_index
        deployed=source_index()[name[:-3]];active_ini=rw.load_unit(rw.RW/deployed['source'])
        active,_=convert_weapons(deployed,active_ini);append_barrage_weapons(deployed,active_ini,{'weapons':active})
        old={w['_source']['turret']:w for w in definition['weapons']}
        ordered=[]
        for original in active:
            turret=original['_source']['turret']
            if turret=='turret_2':
                source_turret=ini[turret]
                if source_turret.get('canAttackLandUnits')!='false' and float(source_turret.get('energyUsage',0))<=float(ini['core'].get('energyMax',0)):
                    raise SourceMismatch('Mobile artillery can fire its main barrel; needs a distinct reviewed policy: '+name)
                weapon=deepcopy(original)
            else:
                weapon=old[turret];weapon['id']=original['id']
            ordered.append(weapon)
        definition['weapons'][:]=ordered
        return ['Disabled source main barrel retained across the mobile/deployed conversion; mobile firing is impossible by its explicit domains or energy cost above energyMax.']
    if name not in SOURCES:
        return []
    action=ini['action_'+SOURCES[entry['rwName']]]
    turret='turret_'+action['fireTurretXAtGround']
    if any(w.get('_source',{}).get('turret')==turret for w in definition['weapons']):
        return []
    original=ini[turret]
    if name=='TOS1A':
        for (section,key),value in TOS_GATES.items():_same(ini,section,key,value)
    elif any(original.get(key)!='false' for key in ('canAttackFlyingUnits','canAttackLandUnits','canAttackUnderwaterUnits')):
        raise SourceMismatch('Manual artillery domain changed: '+entry['rwName'])
    # The ordinary payload compiler is reused, but this barrel is then bound to
    # disabledWeapons. Only its original explicit action may emit its shots.
    source=rw.Ini();source.update({k:deepcopy(v) for k,v in ini.items() if not k.startswith('turret_') or k==turret});source.origins=ini.origins
    source[turret]['canAttackLandUnits']='true'
    if name=='TOS1A':source['attack']=dict(source['attack'],canAttack='true')
    weapons,issues=convert_weapons(entry,source)
    if len(weapons)!=1:raise SourceMismatch('Manual barrel has no unique payload: '+entry['rwName'])
    weapon=weapons[0];weapon['id']='w'+str(len(definition['weapons'])+1)
    definition['weapons'].append(weapon)
    return issues


def augment_barrages(entry,ini,definition):
    name=entry['rwName']
    if name.endswith('未架设') and name[:-3] in SOURCES:
        definition.setdefault('extensions',{}).setdefault('articulation-v1',{}).setdefault('disabledWeapons',[]).extend(w['id'] for w in definition['weapons'] if w.get('_source',{}).get('turret')=='turret_2')
        return []
    if name not in SOURCES:return []
    key='action_'+SOURCES[name];a=ini[key];follow='hiddenAction_'+a['alsoQueueAction'];b=ini[follow]
    for section in (key,follow):
        for field,value in [('whenBuilding_cannotMove','true'),('whenBuilding_rotateTo_aimAtActionTarget','true'),('whenBuilding_rotateTo_waitTillRotated','true'),('allowMultipleInQueue','false'),('alwaysSinglePress','true')]:
            _same(ini,section,field,value)
    turret='turret_'+a['fireTurretXAtGround']
    weapon=next(w for w in definition['weapons'] if w.get('_source',{}).get('turret')==turret)
    cfg=definition.setdefault('extensions',{}).setdefault('articulation-v1',{})
    mount=next((m['id'] for m in cfg.get('mounts',[]) if weapon['id'] in m['weapons']),None)
    if mount is None:raise SourceMismatch('Manual barrage lacks source mount: '+name)
    count=re.fullmatch(r'([^=]+)=(\d+)',a['setResourcesWithLogic'])
    if not count:raise SourceMismatch('Unknown barrage counter')
    _same(ini,follow,'alsoQueueAction',a['alsoQueueAction'])
    _same(ini,follow,'fireTurretXAtGround',a['fireTurretXAtGround'])
    _same(ini,follow,'fireTurretXAtGround_withTarget','createMarker(x=memory.路径点x,y=memory.路径点y)')
    korean={'2S23':'박격포 일제 사격','TOS1A':'로켓 일제 사격'}.get(name,'포격 지점 지정')
    spec={'id':'barrage','label':[a.get('text','').strip().strip('[]'),a.get('text_zh','').strip().strip('[]'),korean],
          'weapon':weapon['id'],'mount':mount,'shots':int(count[2])+1,'first':seconds(a['buildSpeed']),
          'interval':seconds(b['buildSpeed']),'cooldown':seconds(a['addActionCooldownTime']),
          'componentGate':name not in ('2S23','TOS1A')}
    if name=='TOS1A':
        # Action-fired turrets skip their own energyUsage/resourceUsage (RW 1.15
        # class_113 fires through the projectile spawner, not the paid attack
        # path): each rocket costs exactly the action's 火箭弹=-1.
        stock=weapon.get('extensions',{}).get('logistics-v1',{}).get('stock')
        if not stock:raise SourceMismatch('Missing original rocket stock')
        lock=re.fullmatch(r'if self\.resource\.火箭弹<(\d+)',a['isLocked'])
        spec.update(stock=stock,minimumStock=int(lock[1]))
        cfg.setdefault('disabledWeapons',[]).append(weapon['id'])
    elif name!='2S23':
        _same(ini,key,'isLocked','if memory.gun >100 or memory.士气<20 or self.hasFlag(id=19) or self.hasFlag(id=23)')
        usage=re.fullmatch(r'([^=]+)=-1,energy=-(\d+)',a['addResourcesWithLogic'])
        if not usage:raise SourceMismatch('Unknown artillery stock payment')
        stock=weapon.get('extensions',{}).get('logistics-v1',{}).get('stock')
        if not stock:raise SourceMismatch('Missing original artillery stock')
        spec['stock']=stock
        spec['energyCost']=int(usage[2])
        cfg.setdefault('disabledWeapons',[]).append(weapon['id'])
    cfg['barrages']=[spec]
    return ['Source manual barrage queue: first shot '+str(spec['first'])+'s, '+str(spec['shots'])+' rounds, original forced-shot action; no automatic main-gun fire.']


# Korean follows each source English label, not the direction of conversion.
KOREAN_SPADES={'Deploy Spades':'주퇴 지지대 전개','Retract Spades':'주퇴 지지대 접기','Deploy':'전개','Move':'이동'}


def configure_artillery_forms(definitions, entries):
    table={d['id']:d for d in definitions}
    notes=[]
    for name in (key for key in SOURCES if key not in ('2S23','TOS1A')):
        if entries[name]['id'] not in table:continue
        active=table[entries[name]['id']];mobile=table[entries[name+'未架设']['id']]
        # The hidden mobile barrel exists solely to keep ammunition and reload
        # identity across the source conversion. It can never fire in this form.
        for gun in mobile['weapons']:
            match=next(w for w in active['weapons'] if w['id']==gun['id'])
            if gun['id'] in mobile['extensions']['articulation-v1']['disabledWeapons']:
                gun['extensions']=deepcopy(match.get('extensions',{}))
        for cap in ('components-v1','logistics-v1','sensors-v1'):
            if cap in active.get('extensions',{}):mobile['extensions'][cap]=deepcopy(active['extensions'][cap])
        mobile['extensions']['articulation-v1']['barrages']=[{**deepcopy(b),'disabled':True} for b in active['extensions']['articulation-v1']['barrages']]
        for source,action in [(name,'action_收炮'),(name+'未架设','action_放炮')]:
            entry=entries[source];ini=rw.load_unit(rw.RW/entry['source']);a=ini[action]
            definition=table[entry['id']];target=entries[a['convertTo']]['id']
            if target not in table:raise SourceMismatch('Missing artillery counterpart '+a['convertTo'])
            cfg=definition.setdefault('extensions',{}).setdefault('articulation-v1',{})
            cfg.setdefault('mounts',[]);cfg.setdefault('attachments',[])
            cfg['sourceEnergy']={'max':float(ini['core']['energyMax']),'regen':float(ini['core']['energyRegen'])*60}
            english=a['text'].strip('[]')
            if english not in KOREAN_SPADES:raise SourceMismatch('Untranslated artillery conversion label '+english)
            cfg.setdefault('deployments',[]).append({'id':'spades','label':[english,a['text_zh'].strip('[]'),KOREAN_SPADES[english]],
                'to':target,'time':seconds(a['buildSpeed']),'metal':0,'cancelable':True,'health':'absolute','cargo':'retain','orders':'retain',
                'lockMovement':a.get('whenBuilding_cannotMove')=='true','lockWeapons':False})
            notes.append({'unit':source,'note':'Source spade conversion retains its counterpart and authored '+a['buildSpeed']+' action; no alternate body is recruited directly.'})
    return notes


def configure_tos_forms(definitions, media):
    """TOS-1A deploys by tag: one unit, a travelling and a deployed form.

    The deployed form is immobile (setUnitStats moveSpeed=0,maxTurnSpeed=0)
    and the only one that can order the rocket barrage; both keep the same
    rocket stock, mounts and barrage cooldown through the conversion.
    """
    from weapons import source_index
    entry=source_index()['TOS1A'];table={d['id']:d for d in definitions}
    mobile=table.get(entry['id'])
    if not mobile:return []
    ini=rw.load_unit(rw.RW/entry['source'])
    for (section,key),value in TOS_GATES.items():_same(ini,section,key,value)
    deployed=deepcopy(mobile);deployed['id']=mobile['id']+'-deployed'
    patch=deepcopy(media['defPatches'][deployed['id']])
    mounts=deployed['extensions']['articulation-v1']['mounts']
    if len(mounts)!=1 or patch.get('turretSprite') is None:raise SourceMismatch('TOS-1A deployed launcher art changed')
    mounts[0]['sprite']=patch.pop('turretSprite')
    deployed.update(patch)
    deployed.update(speed=0,turnRate=0,producedBy=[],aiWeight=0)
    deployed['extensions']['articulation-v1']['clearMoveOrders']=True
    deployed['name']=[mobile['name'][0]+' (Deployed)',mobile['name'][1]+'（已部署）',mobile['name'][2]+' (배치됨)']
    mobile['extensions']['articulation-v1']['barrages']=[{**deepcopy(b),'disabled':True} for b in mobile['extensions']['articulation-v1']['barrages']]
    labels={'action_部署_1':['Deploy','部署','배치'],'action_部署_2':['UnDeploy','解除部署','배치 해제']}
    for definition,target,action in ((mobile,deployed,'action_部署_1'),(deployed,mobile,'action_部署_2')):
        a=ini[action];label=labels[action]
        if [a['text'].strip('[]'),a['text_zh'].strip('[]')]!=label[:2]:raise SourceMismatch('TOS-1A deployment label changed')
        definition['extensions']['articulation-v1']['deployments']=[{'id':'deploy' if action=='action_部署_1' else 'pack-up','label':label,
            'to':target['id'],'time':seconds(a['buildSpeed']),'metal':0,'cancelable':True,'health':'absolute','cargo':'retain',
            'orders':'clear' if action=='action_部署_1' else 'retain','lockMovement':False,'lockWeapons':False}]
    definitions.append(deployed)
    return [{'unit':'TOS1A','note':'Source tag deployment: 1 s Deploy/UnDeploy forms; deployed form immobile and the only one able to order the 6-rocket barrage (0.5 s spacing, 20 s cooldown, locked below 6 of 24 created rockets; paid SUP rearm unavailable).'},
            {'unit':'TOS1A','note':'Deploying clears the current non-attack orders (source hiddenAction_clearway); while deployed, later move orders cannot move the immobile form.'}]

"""Reviewed split radar/launcher scripts. Source quirks are retained literally."""
import re
import math
import rw
from weapons import source_index, seconds, RANGE_SCALE
from sensors_port import SourceMismatch, _same, _number, _literal_field

PROVIDERS={'9S18M3':2,'HAWK雷达车':3,'IRIS-T SLM_RADAR':5}
LAUNCHERS={'HAWK发射车':'MIM23B','IRIS-T SLM':'IRIST'}

def radar_battery_profile(entry,ini,definition):
    name=entry['rwName']
    if name not in PROVIDERS and name not in LAUNCHERS:return None
    for section,key,value in [('action_部署','setUnitStats','moveSpeed=0'),('action_部署','temporarilyAddTags','部署'),('action_取消部署','resetUnitStats','true'),('action_取消部署','temporarilyRemoveTags','部署')]:_same(ini,section,key,value)
    out={'interval':max(8/60,seconds(ini['core']['autoTriggerCooldownTime'])),'linkRange':200}
    if name in PROVIDERS:
        _same(ini,'hiddenAction_SETRADAR','autoTriggerOnEvent','IGNORE')
        collect=ini['hiddenAction_编入防空车列表1']
        for key,value in {'takeResources':'hp=1','takeResources_excludeUnitsWithoutTags':'发射车就位','takeResources_includeUnitsWithinRange':'500','takeResources_includeUnitsWithinRange_team':'ally','takeResources_includeUnitsInTransport':'false','takeResources_triggerActionForEach':'编入防空车列表2'}.items():_same(ini,'hiddenAction_编入防空车列表1',key,value)
        for key in ['takeResources_maxUnits','takeResources_searchOnly','takeResources_keepResourcesOnTarget','takeResources_discardCollected']:
            if key in collect:raise SourceMismatch('Launcher binding changed RW default: '+key)
        _same(ini,'hiddenAction_编入防空车列表2','requireConditional',f'if (thisActionTarget.customTarget2.id==self.id or thisActionTarget.customTarget2==null) and memory.LAUNCHER_LIST.size<{PROVIDERS[name]}')
        _same(ini,'hiddenAction_接受雷达目标','requireConditional','if distanceBetween(eventData(name="目标",type="unit"),self)<3200')
        _same(ini,'hiddenAction_雷达目标计时器','alsoTriggerAction','遍历发送雷达目标' if name=='HAWK雷达车' else '遍历发送雷达目标,遍历发送雷达目标1')
        radius=_number(ini['core']['@global radar'],'radar',1,10000)
        for action,added,removed in [('action_雷达显示','OFF','雷达工作中,等待指示'),('action_雷达显示2','雷达工作中,等待指示','OFF')]:
            for key,value in [('temporarilyAddTags',added),('temporarilyRemoveTags',removed),('buildSpeed','0.5s'),('addActionCooldownTime','10s')]:_same(ini,action,key,value)
        reentry=source_index()['RADAR'];radar=rw.load_unit(rw.RW/reentry['source']);section=f'hiddenAction_搜索_{radius:g}'
        _same(radar,section,'takeResources','RADAR=1');_same(radar,section,'takeResources_includeUnitsWithinRange_team','enemy')
        origin=rw.RW/reentry['source']
        for key,value in [('takeResources_maxUnits','100'),('takeResources_discardCollected','true'),('takeResources_keepResourcesOnTarget','true')]:
            # These inherited clauses use '=' in the original file.
            if _literal_field(origin,'hiddenAction_搜索_1200',key)!=value:raise SourceMismatch('Source radar scan changed '+key)
        return {**out,'role':'provider','range':radius*.4,'acceptRange':1280,'scanInterval':.2,'scanLimit':100,'lateral':40,'indexDistance':name!='HAWK雷达车','listCap':PROVIDERS[name],'hpTransfer':.6,'spin':_number(ini['turret_r']['idleSpin'],'radar idleSpin',0,360)*math.pi/3}
    resource=LAUNCHERS[name]
    _same(ini,'attack','disablePassiveTargeting','true')
    _same(ini,'hiddenAction_接受雷达目标','addWaypoint_type','attack')
    _same(ini,'hiddenAction_接受雷达目标','addWaypoint_target_fromReference','eventData(name="目标",type="unit")')
    _same(ini,'hiddenAction_接受雷达目标结束','autoTriggerOnEvent','newMessage(withTag="离架")')
    initial=ini['action_弹药补给']['setUnitMemory']
    ranges=re.fullmatch(r'ATT_RANGE_A=(\d+),ATT_RANGE_L=(\d+),ATT_RANGE_H=(\d+)',initial)
    if not ranges:raise SourceMismatch('Source launcher ranges are not literal')
    stocks=definition.get('extensions',{}).get('logistics-v1',{}).get('stocks',[])
    stock=next((s['id'] for s in stocks if s['id']=='magazine-'+resource.lower()),None)
    if stock is None:
        stock=next((w.get('extensions',{}).get('logistics-v1',{}).get('stock') for w in definition.get('weapons',[]) if resource in str(w.get('_source',{}))),None)
    if stock is None:raise SourceMismatch('Source launcher magazine unavailable: '+resource)
    return {**out,'role':'launcher','stock':stock,'high':int(ranges[1])*.4,'low':int(ranges[2])*.4,'helicopter':int(ranges[3])*.4,'waypointTime':seconds(ini['hiddenAction_接受雷达目标']['addWaypoint_maxTime'])}

def augment_radar_battery(entry,ini,definition):
    try:cfg=radar_battery_profile(entry,ini,definition)
    except SourceMismatch as error:return ['Split radar battery omitted: '+str(error)]
    if not cfg:return []
    sensor=definition.setdefault('extensions',{}).setdefault('sensors-v1',{})
    sensor['radarBattery']=cfg
    if cfg['role']=='provider':
        sensor['radarControl']={'initial':False,'range':cfg['range']/32,'rangeOn':cfg['range']/32,'rangeOff':0,'switchTime':.5,'cooldown':10,'interval':cfg['interval'],'weapons':[]}
    return ['Source split radar binding, deployment and finite launcher target queue; source one-recipient HP-transfer quirk retained.']

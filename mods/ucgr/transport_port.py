"""Source cargo weight, tag restrictions and unload cadence.

RW1.15 class_436 lines2272-2300 defaults; the source time value is in60Hz
frames. A source unit heavier than the native50-slot format retains its real
weight in the extension and cannot pass the ordinary native carrier gate.
"""
from weapons import seconds


def augment_transport(entry, ini, definition):
    core=ini.get('core',{})
    weight=float(core.get('transportSlotsNeeded',1))
    if weight<0 or weight>1000000:raise ValueError('Invalid source cargo weight')
    definition['cargoWeight']=min(50,weight)
    capacity=definition.get('transportCap',0)
    if not capacity and weight<=50:return []
    defaults={'transportUnitsEachUnitAlwaysUsesSingleSlot':'false','transportUnitsBlockAirAndWaterUnits':'true',
              'transportUnitsKillOnDeath':'true','transportUnitsKeepWaypoints':'false','transportUnitsHealBy':'0'}
    for key,value in defaults.items():
        if capacity and core.get(key,value).lower()!=value:
            raise ValueError(entry['rwName']+': unreviewed source transport setting '+key)
    if capacity and core.get('transportUnitsRequireMovementType'):
        raise ValueError(entry['rwName']+': unreviewed source passenger movement types')
    if capacity:definition['transportMaxWeight']=capacity
    definition.setdefault('extensions',{}).setdefault('articulation-v1',{})['sourceTransport']={
        'weight':weight,'capacity':capacity,'tags':[v.strip() for v in core.get('transportUnitsRequireTag','').split(',') if v.strip()],
        'blockTransports':core.get('transportUnitsBlockOtherTransports','true').lower()=='true',
        'unload':seconds(core.get('transportUnitsUnloadDelayBetweenEachUnit','30'))}
    return ['Source transport slots, required passenger tags and unload cadence retained.']

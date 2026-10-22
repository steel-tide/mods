"""Source three/five-person controllers assemble existing infantry identities."""
from copy import deepcopy
import math
import re
from rw import RW, load_unit
from weapons import source_index, seconds

CAPABILITY='usgr-re.squads-v1'
FORMS=('三人班组','五人班组','战壕三人班组','战壕五人班组')


def squad_art_entries():
    return [deepcopy(source_index()[name]) for name in FORMS]


def augment_squads(entry,ini,definition):
    tags=set(ini.get('core',{}).get('tags','').split(','))
    if 'soldiers' in tags and '架设' not in tags and 'hiddenAction_班组创建_五人' in ini:
        name='三人班组' if '特种' in tags else '五人班组'
        definition.setdefault('extensions',{})[CAPABILITY]={'member':{'controller':source_index()[name]['id'],'special':'特战' in tags}}
    for weapon in definition['weapons']:
        source=weapon.get('_source',{})
        projectile=ini.get(source.get('projectile'),{})
        loss=sum(amount for tag,amount in [('ap',1),('lmgp',2),('mgp',5),('he',10)] if tag in projectile.get('tags','').split(','))
        if loss:weapon.setdefault('extensions',{})[CAPABILITY]={'moraleLoss':loss}
    return []


def squad_definitions(texts,media):
    defs=[]
    for name in FORMS:
        entry=source_index()[name];ini=load_unit(RW/entry['source']);core=ini['core'];n=int(core['maxTransportingUnits'])
        trench=name.startswith('战壕');mobile='三人班组' if n==3 else '五人班组';fixed='战壕'+mobile
        slots=[ini[f'attachment_{i+1}'] for i in range(n)]
        if any(s.get('addTransportedUnits')!='true' or s.get('canBeAttackedAndDamaged')!='true' or s.get('isUnselectable')!='true' or s.get('rotateWithParent')!='true' for s in slots):
            raise ValueError(f'{name}: unknown source squad attachment behavior')
        d={'id':entry['id'],'name':texts[name]['name'],'desc':texts[name]['desc'],
           'kind':'unit','domain':'ground','cost':0,'buildTime':0,'hp':1,'armor':'light','speed':0 if trench else 18,
           'turnRate':0 if trench else math.pi/3,'radius':float(core['radius'])*.4,'vision':0,'power':0,'pop':0,
           'cargoWeight':50,'trail':'none','producedBy':[],'aiWeight':0,'weapons':[],
           'extensions':{CAPABILITY:{'controller':{'capacity':n,'positions':[{'x':float(s['x'])*.4,'y':-float(s['y'])*.4} for s in slots],
             'mobile':source_index()[mobile]['id'],'trench':source_index()[fixed]['id'],'entrenched':trench,
             'groundOffset':-float(ini.get('decal_架设坑',{}).get('hOffset',0))*.4,
             'digTime':seconds(ini['action_挖掘战壕']['buildSpeed']),'exitTime':seconds(ini['action_退出战壕']['buildSpeed'])}},
             'usgr-re.targeting-v1':{'tags':core['tags'].split(',')},'usgr-re.feedback-v1':{'voices':{}}}}
        if trench:d.update(transportCap=n,transportMaxWeight=1)
        d.update(deepcopy(media['defPatches'][d['id']]))
        defs.append(d)
    return defs

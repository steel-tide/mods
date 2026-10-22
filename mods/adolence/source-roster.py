"""Additional authored playable units omitted by the initial curated port.

Do not include UI icon entities, attachment bookkeeping, target dummies, or
wreck helpers as trainable units. Names below refer to core.name in Q3.6.0.
"""
from copy import deepcopy

INFANTRY = [
 ('卫警-步枪','guard-rifle','Guard Rifleman'),
 ('中州反坦克','zhongzhou-at','Zhongzhou Anti-Tank'),
 ('中州武装机枪','zhongzhou-mg','Zhongzhou Machine Gunner'),
 ('中州特战反坦克','zhongzhou-special-at','Zhongzhou Special Anti-Tank'),
 ('中州特战机枪','zhongzhou-special-mg','Zhongzhou Special Machine Gunner'),
 ('中州特战步兵','zhongzhou-special','Zhongzhou Special Forces'),
 ('民兵-步枪2','guard-armored','Armored National Guard'),
 ('沙漠部队-手枪','desert-pistol','Desert Pistol Trooper'),
 ('防化部队-手枪','hazmat-pistol','Hazmat Pistol Trooper'),
 ('防化部队-步枪','hazmat-rifle','Hazmat Rifleman'),
 ('防化部队-红-步枪','hazmat-red','Red Hazmat Rifleman'),
 ('防化部队-绿-步枪','hazmat-green','Green Hazmat Rifleman'),
 ('陆战队-侦察兵','marine-scout','Marine Scout'),
 ('士兵-步枪A','soldier-a','Rifle Soldier A'),
 ('士兵-步枪B','soldier-b','Rifle Soldier B'),
 ('平民-手枪','civilian-pistol','Armed Civilian'),
 ('平民-手枪2','civilian-pistol-2','Civilian Pistol II'),
 ('平民-步枪','civilian-rifle','Civilian Rifleman'),
 ('平民-步枪2','civilian-rifle-2','Civilian Rifleman II'),
 ('平民-步枪3','civilian-rifle-3','Civilian Rifleman III'),
 ('平民-步枪4','civilian-rifle-4','Civilian Rifleman IV'),
 ('平民-步枪5','raincoat','Raincoat Rifleman'),
]
VEHICLES = [
 ('军用冲锋车','military-assault-car','Military Assault Car'),
 ('国民冲锋车','guard-assault-car','National Guard Assault Car'),
 ('多用途轻型车辆-A','utility-a','Light Utility Vehicle A'),
 ('多用途轻型车辆-B','utility-b','Light Utility Vehicle B'),
 ('警用指挥车-A0','command-car-0','Police Command Car A0'),
 ('警用指挥车-A1','command-car-1','Police Command Car A1'),
 ('警用指挥车-A2','command-car-2','Police Command Car A2'),
 ('警车-D1','cruiser-d1','Police Cruiser D1'),
 ('轿车-(X0rX)','sedan-x0rx','X0rX Sedan'),
 ('轿车-白色','sedan-white','White Sedan'),
 ('轿车-白钢A','white-steel-a','White Steel Sedan A'),
 ('轿车-白钢B','white-steel-b','White Steel Sedan B'),
 ('轿车-黄色','sedan-yellow','Yellow Sedan'),
 ('轿车-黑-低高光','sedan-black-matte','Matte Black Sedan'),
]
AIRCRAFT = [
 ('武装无人机','armed-drone','Armed Recon Drone'),
 ('武装攻击机','attack-drone','Attack Drone'),
 ('K-4968','k4968','K-4968'),
 ('鹰击-A3','eagle-a3','Eagle A3'),
 ('鹰击-A4','eagle-a4','Eagle A4'),
 ('领航员','navigator','Navigator Transport'),
]
BUILDINGS = [
 ('警用卫所','guard-post','Police Guard Post'),
 ('警用油所','fuel-depot','Police Fuel Depot'),
]

def extend(port):
    for group,home,options in [
        (INFANTRY,'outpost',dict(kind=port.U,armor='light',trail='none')),
        (VEHICLES,'arsenal',dict(kind=port.U,trail='tire')),
        (AIRCRAFT,'airfield',dict(kind=port.U,domain='air')),
        (BUILDINGS,None,dict(kind=port.B)),
    ]:
        for source,suffix,name in group:
            port.ROSTER.append((source,suffix,name,'Original Adolence roster unit.',dict(options)))
            if home:port.EXTRA_PRODUCES.setdefault(home,[]).append(suffix)

    # This authored Abrams variant uses the same 120 mm/coaxial installation.
    base=next(r for r in port.ROSTER if r[1]=='m1a2-tusk')
    options=deepcopy(base[4]);options['turret_from']='M1A2 SEPV2 T'
    port.ROSTER.append(('M1A2 SEPV2','m1a2-sepv2','M1A2 SEPv2',
        'Abrams with the SEP urban protection package and a 120 mm gun.',options))
    port.EXTRA_PRODUCES.setdefault('arsenal',[]).append('m1a2-sepv2')

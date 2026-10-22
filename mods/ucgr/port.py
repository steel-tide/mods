#!/usr/bin/env python3
"""Build the UCGR port using the existing content and capability APIs.

Original scripts are never executed. Unsupported systems are deliberately
omitted; conversion-report.json records native mappings and omissions.
Run: python3 mods/ucgr/port.py [--media]
"""
from pathlib import Path
from copy import deepcopy
import json
import math
import re
import sys
import subprocess
from rw import RW, HERE, load_unit, num, resolve
from source_stats import unit_stats

MOD_ID = 'ucgr'
# Stable unit and sprite IDs are retained for authored maps and extension references.
PREFIX = 'usgr-re-'
# The source's 12 phased decks are omitted. These seven native factions are
# explicitly the MVP's national roster grouping, not replicas of those decks.
DECKS = [
    ('ru', 'RUGUARD_C', 'ru', ['Russia', '俄罗斯', '러시아']),
    ('cn', 'CNHEAVY_C', 'cn', ['China', '中国', '중국']),
    ('us', 'USARMOUR_C', 'us', ['United States', '美国', '미국']),
    ('eu', 'EU装甲_C', 'eu', ['European Union', '欧盟', '유럽연합']),
    ('kp', '全频段阻塞干扰指挥车_红龙', 'cn', ['North Korea', '朝鲜', '북한']),
    ('kr', '北约蓝龙指挥车', 'us', ['South Korea', '韩国', '대한민국']),
    ('jp', '北约蓝龙指挥车', 'us', ['Japan', '日本', '일본']),
]

def clamp(v, lo, hi):
    return min(hi, max(lo, v))

def write(name, value):
    (HERE / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

def source_number(fields, name, default):
    return num(fields.get(name), default)

def main():
    from weapons import convert_weapons, append_main_rounds
    from barrage_port import append_barrage_weapons, augment_barrages
    from component_port import augment_components, supports_components
    from logistics_port import augment_logistics, augment_supply_provider
    from articulation_port import augment_articulation, configure_deployment, configure_recovery
    from sensors_port import augment_sensors
    from radar_battery_port import augment_radar_battery
    from transport_port import augment_transport
    from fpv_port import augment_fpv, fpv_drone_definition, DRONES as FPV_DRONES
    from sead_port import augment_sead, source_sead_carrier, source_sead_family, sead_helpers
    from sensors_port import SourceMismatch
    from feedback_port import FeedbackExport, CAPABILITY as FEEDBACK_CAPABILITY
    from muzzle_port import augment_muzzles
    from targeting_port import augment_targeting
    from squads_port import augment_squads, squad_art_entries, squad_definitions
    from smoke_port import augment_smoke, smoke_feedback
    feedback = FeedbackExport(HERE)
    source = json.loads((HERE/'inventory.json').read_text())['entries']
    entries = {e['rwName']: e for e in source}
    selection = json.loads((HERE/'mvp-roster.json').read_text())
    texts = json.loads((HERE/'localization.json').read_text())
    if 'entries' in texts:
        texts = texts['entries']
    chosen = [n for names in selection['nations'].values() for n in names] + selection['shared'] + selection.get('forms', [])
    selected = [deepcopy(entries[n]) for n in chosen + list(selection['builders'].values()) + list(selection['commandArt'].values())]
    selected += squad_art_entries()
    fpv_helpers=[fpv_drone_definition(name) for name in FPV_DRONES]
    selected += [entry for _,entry in fpv_helpers]
    # Only verified explicit sandbox loadouts may create missile helper units.
    # Include their original art before exporting, without adding them to recruitment.
    sead_families = set()
    for name in chosen:
        try:
            carrier = source_sead_carrier(entries[name], load_unit(RW / entries[name]['source']))
            if carrier:
                sead_families.add(carrier['family'])
        except SourceMismatch:
            pass  # augment_sead records the precise omitted source contract below.
    selected += [source_sead_family(family)[2] for family in sorted(sead_families)]
    write('selected.json', selected)
    if '--media' in sys.argv:
        from media import build_media
        command_names = set(selection['commandArt'].values())
        for entry in selected:
            entry['ini'] = deepcopy(load_unit(RW / entry['source']))
            if entry['rwName'] in command_names:
                entry['kind'] = 'building'
        supply_art = deepcopy(entries['BASE'])
        supply_art.update(id=PREFIX+'supply-depot', kind='building', ini={
            'graphics': {'image': 'ROOT:中立及通用单位/据点/补给中心.png', 'imageScale': '1', 'total_frames': '1'},
            'core': {'isBuilding': 'true'}})
        hj_art = deepcopy(next(e for e in selected if e['rwName'] == 'PLAHJ8TEAM'))
        hj_art.update(id=hj_art['id']+'-deployed', artTags=['部署'],
                      artTagsReason='The deployed form displays the source launcher rather than the carrying pose.')
        art_extra = [supply_art, hj_art]
        tos = next((e for e in selected if e['rwName'] == 'TOS1A'), None)
        if tos:
            tos_art = deepcopy(tos)
            tos_art.update(id=tos_art['id']+'-deployed', artTags=['部署'],
                           artTagsReason='The deployed form shows the raised source launcher (decal_炮管) in place of the stowed turret.')
            art_extra.append(tos_art)
        write('media-data.json', build_media(selected+art_extra, HERE))
    # Media export can consult the previous geometry report during a rebuild.
    from articulation_port import _media_reports
    _media_reports.cache_clear()
    media = json.loads((HERE/'media-data.json').read_text())
    notes, defs, records, muzzle_records = [], [], [], []
    ids = {n: entries[n]['id'] for n in chosen}
    for name in chosen:
        entry = entries[name]
        if entry['id'] in media.get('articulationArt', {}):
            entry = {**entry, '_articulation_art': media['articulationArt'][entry['id']]}
        if entry['id'] in media.get('deploymentArt', {}):
            entry = {**entry, '_deployment_art': media['deploymentArt'][entry['id']]}
            if name == 'HAWK发射车':
                deployed_art = next((state for state in entry['_deployment_art']['states'] if state.get('deployed')), None)
                if deployed_art and deployed_art.get('mounts'):
                    entry = {**entry, '_articulation_art': {'scale': .4, 'sprites': {'MAIN': deployed_art['mounts']['mount-main']}}}
        ini = load_unit(RW / entry['source'])
        core, move = ini.get('core', {}), ini.get('movement', {})
        text = texts[name]
        cat = entry['category']
        air = move.get('movementType', '').upper() == 'AIR'
        infantry = cat.startswith('1.')
        helicopter = cat.startswith('5.')
        tank = cat.startswith('3.')
        weapons, issues = convert_weapons(entry, ini)
        if supports_components(entry, ini):
            issues = [issue for issue in issues if not issue.startswith('turret_HE_')]
            issues.extend(append_main_rounds(entry, ini, {'weapons': weapons}, resources=('高爆弹', '破甲弹', 'ATGM')))
        issues.extend(append_barrage_weapons(entry, ini, {'weapons': weapons}))
        notes.extend({'unit': name, 'note': s} for s in issues)
        for weapon in weapons:
            # Match a source recording to the media export, when one exists.
            sound = weapon.pop('_sound', None)
            if sound:
                resolved = resolve(sound, (RW/entry['source']).parent)
                key = media['sounds'].get(str(resolved)) or media['sounds'].get(sound)
                if key:
                    weapon['sound'] = key
            weapon.pop('ammo', None)  # source magazines use the typed capability
        physical = unit_stats(ini)
        hp = physical['hp']
        # SUP/SPP have no common exchange rate. These are declared MVP metal
        # prices, based on native roles; they do not pretend to convert them.
        role_cost = 80 if infantry else 360 if tank else 240
        if air:
            role_cost = 340 if helicopter else 480
        if name == 'UAV':
            role_cost = 100
        d = {'id': entry['id'], 'name': text['name'], 'desc': text['desc'],
             'kind': 'unit', 'domain': 'air' if air else 'ground', 'tier': 1,
             'cost': role_cost, 'buildTime': round(role_cost/14, 2),
             **physical, 'armor': 'air' if air else 'light' if infantry else 'heavy' if tank else 'medium',
             'power': 0, 'pop': 1 if infantry or name=='UAV' else 2 if not air else 3,
             'trail': 'none' if infantry or air else 'tread' if tank else 'tire',
             'producedBy': [], 'aiWeight': 2 if infantry else 1,
             'weapons': weapons}
        if not infantry and not air:
            d['body'] = {'r': 10, 'len': 20 if tank else 16}
        if helicopter or name=='UAV':
            d.update(hovers=True, lowFlying=True, altitude=12)
        elif air:
            d['altitude'] = 25
        cap = int(source_number(core,'maxTransportingUnits',0))
        # RW also uses cargo holds as missile magazines, launched by a turret.
        # Those slots must not become passenger seats. Real troop helicopters
        # can hide the default unload button and supply their own action.
        passengers = not any(t.get('unloadUpToXUnitsAndGiveAttackOrder')
                             for k, t in ini.items() if k.startswith('turret_'))
        if cap > 0 and cap <= 50 and passengers:
            d.update(transportCap=cap, transportMaxWeight=1)
        elif cap > 0:
            notes.append({'unit': name, 'note': 'Scripted payload cargo omitted; no passenger transport added.'})
        if infantry:
            d['cargoWeight'] = 1
        else:
            d['cargoWeight'] = 8
        # Source amphibious capability is explicit, not inferred from looks.
        swimming = move.get('movementType','').upper() in ('HOVER','OVER_CLIFF_WATER','WATER')
        if swimming and not air:
            d['domain'] = 'amphibious'
        d.update(deepcopy(media['defPatches'][entry['id']]))
        # Drawing pivot and muzzle geometry share the converter's art scale.
        for weapon in d['weapons']:
            weapon['turret'] = bool(d.get('turretSprite'))
        for augment in (augment_logistics, augment_components, augment_sensors, augment_radar_battery, augment_sead, augment_fpv, augment_articulation, augment_barrages, augment_targeting, augment_squads, augment_transport, augment_smoke):
            notes.extend({'unit': name, 'note': s} for s in augment(entry, ini, d))
        geometry, geometry_notes = augment_muzzles(entry, ini, d, sprites=media['sprites'])
        muzzle_records.append({'rwName': name, 'id': d['id'], 'weapons': geometry, 'omissions': geometry_notes})
        notes.extend({'unit': name, 'note': s} for s in geometry_notes)
        feedback.augment(entry, ini, d)
        if d.get('extensions', {}).get('components-v1', {}).get('smoke'):
            d['extensions'][FEEDBACK_CAPABILITY]['actions'] = smoke_feedback(feedback, entry, ini)
        if '_articulation_art' in entry:
            mounted = {m.get('sprite') for m in d.get('extensions', {}).get('articulation-v1', {}).get('mounts', [])}
            expected = set(entry['_articulation_art']['sprites'].values())
            assert mounted == expected, f'{name}: split source art needs every exported mount, got {mounted}, expected {expected}'
        # Source references are build-time evidence, never executable manifest data.
        for weapon in d['weapons']:
            for key in list(weapon):
                if key.startswith('_'):
                    del weapon[key]
        defs.append(d)
        records.append({'rwName':name,'id':d['id'],'source':entry['source'],
                        'hp':{'source':source_number(core,'maxHp',400),'mapped':hp},
                        'sourceMappedStats': physical,
                        'cost':{'mvpMetal':role_cost,'reason':'native role price; SUP/SPP omitted'},
                        'weapons':len(weapons),
                        'capabilities': sorted(set(d.get('extensions', {})) |
                            {cap for w in weapons for cap in w.get('extensions', {})})})

    # One real launcher/member assembly retains its state across both forms.
    hj = next(d for d in defs if d['id'] == ids['PLAHJ8TEAM'])
    deployed = deepcopy(hj)
    deployed['id'] += '-deployed'
    deployed.update(deepcopy(media['defPatches'].get(deployed['id'], {})))
    deployed.update(speed=0, producedBy=[], aiWeight=0)
    deployed['name'] = [hj['name'][0]+' (Deployed)', hj['name'][1]+'（已架设）', hj['name'][2]+' (배치됨)']
    deployed['rules'] = [{'button': {'name': texts['adaptation-pack-up']['name'], 'time': 2}, 'do': {'morph': hj['id']}}]
    hj['weapons'] = []
    hj['rules'] = [{'button': {'name': texts['adaptation-deploy']['name'], 'time': 2, 'ai': True}, 'do': {'morph': deployed['id']}}]
    notes.extend({'unit': 'PLAHJ8TEAM', 'note': s} for s in configure_deployment(hj, deployed, texts))
    defs.append(deployed)
    hj_record = next(record for record in records if record['id'] == hj['id'])
    hj_record['capabilities'] = sorted(set(hj.get('extensions', {})) |
        {cap for weapon in hj['weapons'] for cap in weapon.get('extensions', {})})
    hj_record['weapons'] = len(hj['weapons'])

    missile_helpers = sead_helpers(defs)
    for helper, entry in missile_helpers:
        helper.update(deepcopy(media['defPatches'][entry['id']]))
        defs.append(helper)
    for helper, entry in fpv_helpers:
        helper.update(deepcopy(media['defPatches'][entry['id']]))
        feedback.augment(entry, load_unit(RW/entry['source']), helper)
        for weapon in helper['weapons']:
            for key in list(weapon):
                if key.startswith('_'):del weapon[key]
        defs.append(helper)
    from barrage_port import configure_artillery_forms, configure_tos_forms
    notes.extend(configure_artillery_forms(defs, entries))
    notes.extend(configure_tos_forms(defs, media))
    notes.extend(configure_recovery(defs, entries))
    squad_defs = squad_definitions(texts, media)
    defs.extend(squad_defs)

    # Native headquarters/builder cycle. Original mobile command/deck scripts
    # are absent. The command vehicle artwork is reused in a fixed land HQ.
    builders = {}
    for nation, name in selection['builders'].items():
        entry = entries[name]
        d = {'id':PREFIX+nation+'-engineer',
             'name': [f'{texts[name]["name"][i]} — {texts["adaptation-combat-engineer"]["name"][i]}' for i in range(3)],
             'desc':['Construction and repair crew aboard a support vehicle.', '搭乘保障车辆的建造与维修班组。', '지원 차량에 탑승한 건설 및 수리 분대.'],
             'kind':'unit','domain':'ground','cost':150,'buildTime':12,'hp':400,'armor':'light',
             'speed':60,'turnRate':3,'radius':9,'body':{'r':9,'len':16},'vision':8,
             'pop':1,'power':0,'trail':'tire','weapons':[],'buildRate':65,'reach':64,
             'builds':[PREFIX+k+suffix for k,_,n,_ in DECKS if n==nation for suffix in ('-hq','-recruitment','-airfield')]+[PREFIX+'supply-depot'],
             'producedBy':[],'aiWeight':0}
        d.update(deepcopy(media['defPatches'][entry['id']]))
        builders[nation]=d['id'];defs.append(d)
    factions=[]
    for key, source_name, nation, faction_name in DECKS:
        hqid=PREFIX+key+'-hq'
        members=selection['nations'][key]+selection['shared']
        roster=[ids[n] for n in members]+[hqid,builders[nation],PREFIX+'supply-depot']+[d['id'] for d in squad_defs]+[d['id'] for d, _ in missile_helpers]+[ids[n] for n in selection.get('forms', [])]
        if 'PLAHJ8TEAM' in members:
            roster.append(deployed['id'])
        if 'TOS1A' in members:
            roster.append(ids['TOS1A']+'-deployed')
        hq={'id':hqid,'name':[f'{name} Command Post' if i==0 else f'{name}指挥所' if i==1 else f'{name} 지휘소' for i,name in enumerate(faction_name)],
            'desc':['Deployed command post. Recruits the selected force.', '展开的指挥所，招募所选部队。', '배치된 지휘소. 선택한 부대를 모집한다.'],
            'kind':'building','isHQ':True,'cost':1000,'buildTime':60,'hp':2000,'armor':'structure',
            'fw':3,'fh':3,'vision':12,'power':0,'metalRate':1.4,'weapons':[],
            'builtBy':[builders[nation]],'produces':[builders[nation]]+[ids[n] for n in members]}
        artid=entries[selection['commandArt'][nation]]['id']
        hq.update(deepcopy(media['defPatches'][artid]))
        hq['extensions']={'usgr-re.squads-v1':{'settings':True}}
        defs.append(hq)
        # Native AI recognizes separate production lines by their products;
        # headquarters are deliberately not treated as factories by the game.
        for air, suffix, labels in [(False, '-recruitment', ['Recruitment Post', '招募站', '모집소']),
                                    (True, '-airfield', ['Forward Airfield', '前线机场', '전방 비행장'])]:
            line_id = PREFIX+key+suffix
            products = [ids[n] for n in members if (next(d for d in defs if d['id']==ids[n])['domain']=='air') == air]
            line = {'id': line_id, 'name': [faction_name[i]+' '+labels[i] for i in range(3)],
                    'desc': ['A forward station for deploying reinforcements.', '部署增援部队的前线集结站。', '증원 부대를 배치하는 전방 집결소.'],
                    'kind':'building','cost':380 if air else 320,'buildTime':28 if air else 24,
                    'hp':1200,'fw':3,'fh':3,'power':0,'vision':8,'weapons':[],
                    'builtBy':[builders[nation]],'produces':products,
                    **deepcopy(media['defPatches'][artid])}
            defs.append(line)
            roster.append(line_id)
            for d in defs:
                if d['id'] in products:
                    d['producedBy'].append(line_id)
        for d in defs:
            if d['id'] in hq['produces']:
                d['producedBy'].append(hqid)
        factions.append({'id':MOD_ID+'-'+key,'name':['UCGR · '+t for t in faction_name],
                         'headquarters':hqid,'builder':builders[nation],'roster':roster})
    supply={'id':PREFIX+'supply-depot','name':texts['adaptation-field-supply-depot']['name'],
            'desc':['A field depot that gathers metal from a deposit.', '从矿点收集金属的前线补给站。', '광맥에서 금속을 수집하는 야전 보급소.'],
            'kind':'building','cost':120,'buildTime':18,'hp':800,'fw':2,'fh':2,'power':0,
            'needsDeposit':True,'metalRate':1.4,'vision':6,'builtBy':list(builders.values()),'weapons':[]}
    supply.update(deepcopy(media['defPatches'][PREFIX+'supply-depot']))
    notes.extend({'unit': 'BASE', 'note': s} for s in augment_supply_provider(supply, load_unit(RW / entries['T90M']['source'])))
    defs.append(supply)
    # Authored adaptation buildings and builders have no source voice binding.
    # Their explicit empty map suppresses the game's unrelated native replies.
    for definition in defs:
        definition.setdefault('extensions', {}).setdefault(FEEDBACK_CAPABILITY, {'voices': {}})
    feedback.finish()
    from profile_pack import pack_profiles
    packed_defs, profile_stats = pack_profiles(defs, HERE)
    subprocess.run(['node', str(HERE/'extensions/combined-arms-v1/build.mjs')], check=True)
    package = json.loads((HERE/'extensions/combined-arms-v1/extension.json').read_text())
    package['assets'] = feedback.assets
    # No unsupported mechanics are represented by approximate rule programs.
    capabilities = sorted({cap for d in defs for cap in d.get('extensions', {})} |
                          {cap for d in defs for w in d['weapons'] for cap in w.get('extensions', {})})
    manifest={'format':'steel-tide-mod','v':4,'capacity':'large','id':MOD_ID,'version':'0.0.1','minGame':'0.8.15',
              'requiredCapabilities': capabilities,
              'extensionPackages': [package],
              'name':['UCGR','UCGR','UCGR'],
              'author':'GY Studio (GY工作室); Steel Tide port',
              'description':['A playable selection from UCGR-RE: seven national rosters, original artwork and source-derived combat systems. Unsupported source mechanics and scenarios remain omitted.',
                             'UCGR-RE可玩精选：七国兵种、原版美术与依据原版数据移植的战斗系统。尚不支持的原版机制与场景仍予省略。',
                             'UCGR-RE의 플레이 가능한 선별판. 7개국 병종, 원본 그래픽, 원본 데이터에 기반한 전투 체계를 제공한다. 지원하지 않는 원본 메커니즘과 시나리오는 제외된다.'],
              'license':'LicenseRef-UCGR-RE','defs':packed_defs,'factions':factions,
              'sprites':media['sprites'],'sounds':media['soundDefs'],
              'screenshots':['screenshots/cover.jpg','screenshots/armored-roster.jpg','screenshots/aircraft-roster.jpg','screenshots/combined-arms.jpg'],
              'maps':['maps/crossroads-exercise.steel-tide-map']}
    if (HERE/'mod.json').exists():
        old=json.loads((HERE/'mod.json').read_text())
        manifest['screenshots']=old.get('screenshots') or manifest['screenshots']
        if (HERE/'screenshots/radar-contacts.jpg').exists() and 'screenshots/radar-contacts.jpg' not in manifest['screenshots']:
            manifest['screenshots'].append('screenshots/radar-contacts.jpg')
        manifest['maps']=old.get('maps') or manifest['maps']
    assert len(defs)<=1024 and len(manifest['sprites'])<=2048 and len(manifest['sounds'])<=512
    assert all(len(d['name']) == 3 and all(d['name']) and len(d['desc']) == 3 for d in defs)
    write('mod.json',manifest)
    write('literal-profile-report.json', profile_stats)
    write('muzzle-source-data.json', {'source': json.loads((HERE/'inventory.json').read_text())['source'],
          'policy': 'Original turret pivots, bore lengths and aircraft hardpoints mapped to native muzzlePoints. For certified visible barrels, actual opaque front pixels override the original off-barrel spawn; both coordinates are retained. No collision-radius estimate.',
          'units': muzzle_records})
    write('conversion-report.json',{'source':json.loads((HERE/'inventory.json').read_text())['source'],
          'scope':'Source-derived capability integration, not full parity', 'units':records,'notes':notes,
          'requiredCapabilities':capabilities,
          'capabilityCoverage':{cap: [d['id'] for d in defs if cap in d.get('extensions', {}) or
              any(cap in w.get('extensions', {}) for w in d['weapons'])] for cap in capabilities},
          'remainingNonM5': __import__('status').remaining(),
          'omittedSystems':['source modes/decks, SUP/SPP, score victory, phases and platoon call-ins',
          'source 5v5 TMX scenarios', 'full-spectrum soundtrack (skipped M5 mode)',
          'See remainingNonM5 and non-m5-status.json for incomplete pack policies'],
          'nativeIntegration':['fixed land HQ and construction unit per force','single-metal economy',
          'individual unit production through HQ, recruitment post and airfield',
          'native damage against targets without the reviewed source combat policies'],
          'factions':[{'id':f['id'],'rosterDefinitions':len(f['roster'])} for f in factions]})
    print(f'Built {len(defs)} definitions, {len(factions)} factions, {len(manifest["sprites"])} sheets, {len(manifest["sounds"])} sounds')

if __name__=='__main__':
    main()

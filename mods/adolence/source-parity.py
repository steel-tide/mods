"""Source-derived fidelity pass; invoked by the owning mod's converter.

Only literal, validated source features are translated. The audit retains
unsupported action names instead of silently treating RW expressions as true.
"""
import hashlib
import json
import re
import subprocess
from pathlib import Path
from PIL import Image


def animations(port, gfx, frames):
    result = {}
    for old,new in [('idle','idle'),('moving','moving'),('attack','firing')]:
        a,b=(port.num(gfx.get('animation_'+old+'_'+k)) for k in ['start','end'])
        if a is None or b is None or not 0 <= a <= b < frames: continue
        speed=port.num(gfx.get('animation_'+old+'_speed'))
        result[new]=[int(a),int(b),round(min(60,60/speed),4) if speed and speed>0 else 8]
    return result


def apply(port, manifest):
    root=Path(port.REPO); folder=Path(port.HERE); out=Path(port.OUT)
    source_root=Path(getattr(port,'RW',getattr(port,'SKY','')))
    index=port.index_units(); defs={d['id']:d for d in manifest['defs']}
    cap=port.MOD_ID+'.source-v1'; sheets={s['key']:s for s in manifest['sprites']}
    assets={}; entries=[]; source_to_id={r[0]:port.MOD_ID+'-'+r[1] for r in port.ROSTER}
    resources={}
    def recording(ref,directory):
        ref=re.sub(r':[\d.]+$','',(ref or '').split(',')[0].strip())
        src=port.resolve(ref,str(directory))
        if not src or not re.search(r'\.(wav|ogg|mp3|m4a)$',src,re.I):return None
        digest=hashlib.sha256(Path(src).read_bytes()).hexdigest()[:16]
        key='recording-'+digest;dest='audio/'+key+'.mp3';assets[key]=dest
        if key not in resources:
            resources[key]=str(Path(src).relative_to(source_root))
            if not port.DRY and (not port.NO_MEDIA or not (out/dest).exists()):
                (out/'audio').mkdir(exist_ok=True,parents=True)
                subprocess.run(['ffmpeg','-loglevel','error','-y','-i',src,'-ac','1','-ar','44100','-b:a','96k',str(out/dest)],check=True)
        return key
    for source,suffix,en,desc,override in port.ROSTER:
        did=port.MOD_ID+'-'+suffix;d=defs.get(did)
        if not d:continue
        path=index.get(source)
        if source.startswith('core:'):
            ini=port.synth_ini(source[5:],override);directory=Path(port.RES);source_file='rw-core.json#'+source[5:]
        elif path:
            ini=port.load_unit(path);directory=Path(path).parent;source_file=str(Path(path).relative_to(source_root))
        else:continue
        core=ini.get('core',{});gfx=ini.get('graphics',{});cfg={};features=[]
        sheet=sheets.get(d.get('sprite','u.'+did));frames=sheet.get('frames',1) if sheet else 1
        if sheet:
            anim=animations(port,gfx,frames)
            if anim:
                sheet['anims']=anim;features.append('animation states')
                if d.get('domain')=='air':d.setdefault('extensions',{})[cap]=cfg
        selection=recording(core.get('soundOnNewSelection'),directory)
        if selection:cfg['selectSound']=selection;features.append('selection audio')
        energy_max=port.num(core.get('energyMax')) or 0;usage={}
        # A weapon ID is the source projectile identifier in both converters.
        for w in d.get('weapons',[]):
            candidates=[]
            for section,kv in ini.items():
                if not section.startswith('turret_') or kv.get('canShoot','true').lower()=='false':continue
                projectile=kv.get('projectile',section[7:])
                wid=re.sub(r'[^a-z0-9_-]','',projectile.lower())
                if port.MOD_ID=='fg-rusted-league' and wid and wid[0].isdigit():wid='w'+wid
                if wid and wid==w['id']:candidates.append(kv)
            costs=[port.num(t.get('energyUsage')) or 0 for t in candidates]
            if costs and max(costs)>0 and max(costs)<=energy_max:usage[w['id']]=max(costs)
        if energy_max>0 and usage:
            regen=port.num(core.get('energyRegen')) or 0
            recharge=port.num(core.get('energyRegenWhenRecharging'))
            start=port.num(core.get('energyStartingPercentage'))
            cfg['energy']={'max':energy_max,'start':1 if start is None else max(0,min(1,start)),
                'regen':max(0,regen*60),'recharge':max(0,(regen if recharge is None else recharge)*60),
                'full':port.boolish(core.get('energyNeedsToRechargeToFull')),'usage':usage}
            for section,action in ini.items():
                if section.startswith('action_') and '更换弹夹' in section:
                    t=port.build_seconds(action.get('buildSpeed'))
                    if t and t>0:cfg['reloadTime']=round(min(3600,t),6)
            for section,action in ini.items():
                if section.startswith('hiddenAction_') and '装填' in section and action.get('playSoundAtUnit'):
                    sound=recording(action['playSoundAtUnit'],directory)
                    if sound:cfg['reloadSound']=sound
            features.append('energy magazine'+(' / manual reload' if cfg.get('reloadTime') else ''))
        mend=port.num(core.get('selfRegenRate')) or 0
        if mend<0:
            cfg['decay']=round(-mend*60*d['hp']/max(1,port.num(core.get('maxHp')) or 1),6);features.append('source hull decay')
        # Preserve source wrecks independently of ordinary hull/turret baking.
        wreck=port.resolve(gfx.get('image_wreak',''),str(directory))
        if wreck and sheet and not (hasattr(port,'is_stock_art') and port.is_stock_art(wreck)):
            im=port.clean_alpha(Image.open(wreck));key='dec.'+port.MOD_ID+'-wreck-'+hashlib.sha256(did.encode()).hexdigest()[:8];file='sprites/'+key+'.png'
            # No color adaptation: source wreck pigments are intentional.
            fw=sheet.get('fw',d.get('fw',2)*32);fh=sheet.get('fh',round(fw*im.height/im.width))
            entry={'key':key,'file':file,'frames':1,'fw':max(4,min(512,fw)),'fh':max(4,min(512,fh)), 'teams':False,'stripBg':False,'stabilize':False}
            if key not in sheets:manifest['sprites'].append(entry);sheets[key]=entry
            if not port.DRY and (not port.NO_MEDIA or not (out/file).exists()):
                (out/'sprites').mkdir(exist_ok=True,parents=True);im.save(out/file)
            cfg['wreck']=key;features.append('source wreck')
        if cfg:d.setdefault('extensions',{})[cap]=cfg
        # Explicit player transformations absent from the initial Adolence pass.
        actions=port.rw_actions(ini)
        for a in actions:
            target=source_to_id.get(a.get('convertTo'));other=defs.get(target)
            if not other or other is d or other['kind']!=d['kind'] or a.get('autoTrigger') or a.get('_hidden') or a.get('autoTriggerOnEvent'):continue
            if other.get('upgradeOf')==did:continue
            if d['kind']=='building' and (d.get('fw',2),d.get('fh',2))!=(other.get('fw',2),other.get('fh',2)):continue
            if any(isinstance(r.get('do'),dict) and r['do'].get('morph')==target for r in d.get('rules',[])):continue
            # Complex price/lock expressions stay in the ledger for a dedicated implementation.
            price=port.num(a.get('price','0'))
            if price is None or a.get('isLocked','false')!='false' or a.get('isActive','true')=='false' or a.get('isVisible','true')=='false':continue
            cost=port.cost_of(price) if port.MOD_ID=='fg-rusted-league' and price else port.unit_cost(price) if price else 0
            d.setdefault('rules',[]).append({'button':{'name':other['name'],'cost':int(cost),'time':round(min(3600,port.build_seconds(a.get('buildSpeed')) or 0),6),'ai':False},'do':{'morph':target}})
            features.append('source transformation')
        if port.MOD_ID=='adolence':
            if suffix in ['fuel-depot','guard-post']:
                period=(port.num(core.get('generation_delay')) or 60)/60
                d['metalRate']=round(port.folded_price(core.get('generation_resources','0'))/period*.025,4)
                features.append('folded source resource income')
            for a in actions:
                if not a.get('_id','').startswith('action_') or not a.get('spawnUnits') or 'price' not in a or a.get('autoTrigger'):continue
                # Preserve only this source's simple garage prerequisite, not arbitrary expressions.
                visible=a.get('isVisible','true')
                if visible not in ['true', "if  self.numberOfUnitsInTeam(withTag='警用车库',greaterThan=0)"]:continue
                spawns=[]
                for name,count,chance,killer in port.spawn_list(a['spawnUnits']):
                    target=source_to_id.get(name)
                    if target not in defs or chance!=1 or killer or count>16:break
                    spawns.append({'spawn':{'unit':target,'count':count}})
                else:
                    if spawns and len(spawns)<=8:
                        name={'action_国民行动小组':['National Guard squad','国民行动小组'], 'action_中州特别支援':['Zhongzhou support squad','中州特别支援小队']}.get(a['_id'])
                        if name:
                            button={'name':name,'cost':port.unit_cost(port.folded_price(a['price'])),'time':port.build_seconds(a.get('buildSpeed')) or 0,'ai':True}
                            if visible!='true':button['requires']=['adolence-garage']
                            d.setdefault('rules',[]).append({'button':button,'do':spawns});features.append('source reinforcement squad')
        unresolved=[]
        for a in actions:
            target=source_to_id.get(a.get('convertTo'))
            if a.get('convertTo') and target not in defs and a.get('convertTo','').upper()!='NONE':unresolved.append({'action':a.get('_id',a.get('_section','?')),'target':a['convertTo'],
                'status':'disabled in original' if a.get('isLocked')=='true' or a.get('isActive')=='false' or a.get('isVisible')=='false' else 'requires integration'})
        entries.append({'source':source,'file':source_file,'definition':did,'restored':features,'unresolvedTransforms':unresolved,
            'sourceFeatures':{prefix:sum(k.startswith(prefix+'_') for k in ini) for prefix in ['turret','projectile','effect','decal','animation','action','hiddenAction','attachment','arm','leg']}})
    descriptor={'id':port.MOD_ID+'.source','version':'1.0.1','api':2,'capabilities':[cap],'assets':assets}
    for part in ['schema','runtime','presentation']:
        code=(folder/'extensions/source'/(part+'.mjs')).read_text()
        descriptor[part]={'source':code,'sha256':hashlib.sha256(code.encode()).hexdigest()}
    manifest.update(v=4,capacity='large',requiredCapabilities=[cap],extensionPackages=[descriptor])
    represented=set(source_to_id)
    omissions=[]
    for name,path in sorted(index.items()):
        if name in represented:continue
        ini=port.load_unit(path);c=ini.get('core',{});rel=str(Path(path).relative_to(source_root))
        if c.get('dont_load','').lower()=='true':reason='source template / disabled definition'
        elif '图标' in rel:reason='source UI icon helper'
        elif any(k in rel for k in ['装饰','伤害测量','/测试/']):reason='scenery / developer helper'
        elif port.MOD_ID=='fg-rusted-league' and not rel.startswith('assets/units/ GF/'):
            reason='base-game content or hard-coded counterpart; no new stock art shipped'
        else:reason='not represented as a standalone playable definition; requires source-specific integration'
        omissions.append({'source':name,'file':rel,'reason':reason})
    inventory=[{'file':str(p.relative_to(source_root)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
        for p in sorted(source_root.rglob('*')) if p.suffix.lower() in ['.ini','.template','.key','.tmx']]
    report={'original':str(source_root.relative_to(root)),'sourceInventory':inventory,'definitions':entries,'unrepresented':omissions,'recordings':resources,
        'scope':'Source-derived fidelity improvements; not a claim of full RW script emulation. See PARITY.md for remaining behavior gaps.'}
    if not port.DRY:
        (out/'source-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
        (out/'extensions/source').mkdir(parents=True,exist_ok=True)
        (out/'extensions/source/extension.json').write_text(json.dumps(descriptor,ensure_ascii=False,indent=2)+'\n')

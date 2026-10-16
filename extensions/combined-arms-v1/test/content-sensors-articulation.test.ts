import extensionPackage from '../extension.json';
import { afterEach, describe, expect, test } from 'bun:test';
import { Terrain, TILE, type UnitDef } from '../../../../steel-tide/game/core/src/core/types';
import { DEFS, getDef } from '../../../../steel-tide/game/core/src/game/defs';
import { canSee, kill } from '../../../../steel-tide/game/core/src/game/combat';
import { newEnt } from '../../../../steel-tide/game/core/src/game/state';
import { cmdMove, cmdBoard, cmdPickup, cmdAttack } from '../../../../steel-tide/game/core/src/game/orders';
import { applyGameCommand } from '../../../../steel-tide/game/core/src/game/commands';
import { applyContent } from '../../../../steel-tide/game/core/src/game/content';
import { prepareContentSchema } from '../../../../steel-tide/game/core/src/game/contentSchema';
import { prepareContentCapabilities } from '../../../../steel-tide/game/core/src/game/contentCapabilities';
import { parseDefinitionPack } from '../../../../steel-tide/game/core/src/game/contentDefs';
import { createContentGame, contentRuntime, disposeContentGame } from '../../../../steel-tide/game/core/src/game/contentGame';
import { arena } from '../../../../steel-tide/game/core/server/testkit/game';
import { createRuntimeGame } from '../../../../steel-tide/game/core/src/game/extensions/runtime';
import { createSensorsModule } from '../src/sensors';
import { createArticulationModule, type ArticulationVisual } from '../src/articulation';
import { readSensorsDef, readGuidanceDef } from '../src/sensorsSpec';
import { readArticulationDef, validateArticulationReferences } from '../src/articulationSpec';
import type { ContentIssue } from '../../../../steel-tide/game/core/src/game/contentDefs';
const ids: string[] = [];
afterEach(() => { for (const id of ids.splice(0)) delete DEFS[id]; });
function define(id: string, changes: Partial<UnitDef>): UnitDef { const def = { ...getDef('ltank'), id, ...changes }; DEFS[id] = def; ids.push(id); return def; }
const sensor = (v: unknown) => { const e: ContentIssue[] = []; const v1 = readSensorsDef(v, 'sensor', e); expect(e).toEqual([]); return v1; };
const guide = (v: unknown) => { const e: ContentIssue[] = []; const v1 = readGuidanceDef(v, 'guide', e); expect(e).toEqual([]); return v1; };
const art = (v: unknown) => { const e: ContentIssue[] = []; const v1 = readArticulationDef(v, 'art', e); expect(e).toEqual([]); return v1; };
function match(fog = false) { const base = arena({ mode: 'campaign', dayNight: false, fog }); return createRuntimeGame(base.st.cfg, base.st.map, true, [{id:'sensors-v1',create:createSensorsModule},{id:'articulation-v1',create:createArticulationModule}]); }
function ticks(game: ReturnType<typeof match>['game'], n: number) { for (let i = 0; i < n; i++) game.step(); }

describe('optional sensors and physical articulation', () => {
  test('boarding and pickup refuse coupled passengers before mutations and inside never means parent death', async () => {
    const labels=['Fixture','测试','시험'];
    const pack={format:'steel-tide-mod',v:3,id:'ext-transport-test',version:'1',name:labels,requiredCapabilities:['articulation-v1'],defs:[
      {id:'ext-carrier',extends:'engineer',name:labels,weapons:[],builds:[],transportCap:50,transportDomain:'ground'},
      {id:'ext-person',extends:'engineer',name:labels,weapons:[],builds:[]},
      {id:'ext-assembly',extends:'engineer',name:labels,weapons:[],builds:[],extensions:{'articulation-v1':{squad:true,attachments:[{id:'crew',unit:'ext-person',x:0,y:0,onParentDeath:'kill'}]}}},
      {id:'ext-trailer-test',extends:'engineer',name:labels,weapons:[],builds:[]},
      {id:'ext-tractor-test',extends:'engineer',name:labels,weapons:[],builds:[],extensions:{'articulation-v1':{tow:{accepts:['ext-trailer-test'],range:4,length:60}}}},
    ]};
    pack.v=4; (pack as any).extensionPackages=[extensionPackage]; await prepareContentSchema(pack,true);const parsed=parseDefinitionPack(pack);if(!parsed.ok)throw new Error(JSON.stringify(parsed.errors));
    await prepareContentCapabilities([parsed.pack]);expect(applyContent([parsed.pack]).rejected).toEqual([]);
    const base=arena({mode:'campaign',dayNight:false,fog:false}),game=createContentGame(base.st.cfg,base.st.map,true),runtime=contentRuntime(game)!;
    try {
      const parent=newEnt(game.st,'ext-assembly',0,400,400),carrier=newEnt(game.st,'ext-carrier',0,480,400);
      cmdBoard(game,[parent.id],carrier.id);expect(parent.orders).toEqual([]);game.step();
      const module=runtime.module('articulation-v1')!, member=game.st.ents.get((module.render!(parent) as ArticulationVisual).attachments[0].childId)!;
      cmdPickup(game,[carrier.id],parent.id);expect(carrier.orders).toEqual([]);expect(parent.orders).toEqual([]);
      cmdBoard(game,[member.id],carrier.id);cmdPickup(game,[carrier.id],member.id);expect(member.orders).toEqual([]);expect(carrier.orders).toEqual([]);
      expect(applyGameCommand(game,0,{kind:'board',ids:[parent.id,member.id],transportId:carrier.id,queue:false})).toBe(false);
      expect(applyGameCommand(game,0,{kind:'pickup',ids:[carrier.id],targetId:parent.id,queue:false})).toBe(false);
      const tractor=newEnt(game.st,'ext-tractor-test',0,700,400),trailer=newEnt(game.st,'ext-trailer-test',0,640,400);
      expect(runtime.order('articulation-v1',{owner:0,ids:[tractor.id],action:'tow',targetId:trailer.id})).toBe(true);
      cmdBoard(game,[tractor.id,trailer.id],carrier.id);cmdPickup(game,[carrier.id],trailer.id);expect(tractor.orders).toEqual([]);expect(trailer.orders).toEqual([]);expect(carrier.orders).toEqual([]);
      const ordinary=newEnt(game.st,'ext-person',0,500,400);cmdBoard(game,[ordinary.id],carrier.id);expect(ordinary.orders[0]?.kind).toBe('board');
      parent.inside=carrier.id;module.afterStep!(1/30);expect(parent.dead).toBeFalsy();expect(member.dead).toBeFalsy();
      expect((module.render!(parent) as ArticulationVisual).attachments[0].childId).toBe(member.id);
      expect(()=>module.restore(module.snapshot())).toThrow('Transported assemblies are unsupported');
      parent.inside=undefined;member.inside=carrier.id;module.afterStep!(1/30);expect(parent.dead).toBeFalsy();expect(()=>module.restore(module.snapshot())).toThrow('Invalid attachment reference');
      member.inside=undefined;module.beforeStep!(1/30);expect((module.render!(parent) as ArticulationVisual).attachments[0].childId).toBe(member.id);expect([...game.st.ents.values()].filter(e=>e.defId==='ext-person')).toHaveLength(2);
    } finally {disposeContentGame(game);applyContent([]);}
  });
  test('deployment rejects missing or changed mount and sensor configurations before persistent state can diverge', () => {
    const gun={...getDef('ltank').weapons[0],id:'gun'}, mounts=[{id:'turret',weapons:['gun']}], signals=sensor({decoys:[{id:'flare',channels:['heat'],charges:2}]});
    const from=define('ext-from',{weapons:[gun],extensions:{'articulation-v1':art({mounts,deployments:[{id:'deploy',to:'ext-to'}]}),'sensors-v1':signals}});
    const to=define('ext-to',{weapons:[gun],extensions:{'articulation-v1':art({mounts}),'sensors-v1':signals}});
    const validate=()=>{const errors:ContentIssue[]=[];validateArticulationReferences(from,DEFS,'from',errors);return errors;};
    expect(validate()).toEqual([]);
    to.extensions={'sensors-v1':signals};expect(validate().some(e=>e.message.includes('identical mount layouts'))).toBe(true);
    to.extensions={'articulation-v1':art({}),'sensors-v1':signals};expect(validate().some(e=>e.message.includes('identical mount layouts'))).toBe(true);
    to.extensions={'articulation-v1':art({mounts:[{...mounts[0],id:'renamed'}]}),'sensors-v1':signals};expect(validate().some(e=>e.message.includes('identical mount layouts'))).toBe(true);
    to.extensions={'articulation-v1':art({mounts})};expect(validate().some(e=>e.message.includes('sensors-v1 must remain identical'))).toBe(true);
    to.extensions={'articulation-v1':art({mounts}),'sensors-v1':sensor({decoys:[{id:'flare',channels:['heat'],charges:1}]})};expect(validate().some(e=>e.message.includes('sensors-v1 must remain identical'))).toBe(true);
    to.extensions={'articulation-v1':art({mounts}),'sensors-v1':signals};
    define('ext-added-crew',{weapons:[]});to.extensions={'articulation-v1':art({mounts,attachments:[{id:'crew',unit:'ext-added-crew'}]}),'sensors-v1':signals};expect(validate().some(e=>e.message.includes('retain every member slot'))).toBe(true);
    to.extensions={'articulation-v1':art({mounts}),'sensors-v1':signals};
    to.weapons=[{...gun,extensions:{'sensors-v1':guide({channel:'heat'})}}];expect(validate().some(e=>e.message.includes('weapon guidance'))).toBe(true);
  });
  test('typed acquisition gates launch, emitter loss removes live homing references, and reacquisition is authored', () => {
    const gun = { ...getDef('ltank').weapons[0], id:'guided', reload:100, projectile:'missile' as const, speed:30, homing:true, range:20,
      extensions:{'sensors-v1':guide({mode:'emitter',channel:'search',range:20,cone:Math.PI,acquire:.2,reacquire:true,maxLife:20})} };
    define('ext-launcher',{weapons:[gun],turnRate:10});
    define('ext-emitter',{weapons:[],extensions:{'sensors-v1':sensor({emitters:[{id:'radar',channel:'search',toggleTime:0,cooldown:0}]})}});
    const {game,runtime}=match(), a=newEnt(game.st,'ext-launcher',0,400,400), b=newEnt(game.st,'ext-emitter',1,600,400);
    a.turretAngle=0; a.holdPos=true; game.hash.rebuild(game.st);
    ticks(game,4); expect(game.st.projs.length).toBe(0);
    ticks(game,8); expect(game.st.projs.length).toBe(1);
    const p=game.st.projs[0]; expect(p.targetId).toBe(b.id);
    expect(runtime.order('sensors-v1',{owner:1,ids:[b.id],action:'emitter:radar',on:false})).toBe(true);
    game.step(); expect(p.targetId).toBe(0); expect(p.homing).toBe(false); const lostAngle=p.angle;
    b.y=650; ticks(game,3); expect(p.angle).toBe(lostAngle);
    expect(runtime.order('sensors-v1',{owner:1,ids:[b.id],action:'emitter:radar',on:true})).toBe(true);
    game.step(); expect(p.targetId).toBe(b.id); expect(p.angle).not.toBe(lostAngle);
  });
  test('designation takes continuous acquisition and smoke cuts a sensor line and actual vision tiles', () => {
    define('ext-sensor',{weapons:[],extensions:{'sensors-v1':sensor({sensors:[{id:'laser',channel:'beam',mode:'designate',range:20,acquire:.1,smoke:true}],obstruction:{smoke:true,forest:true}})}});
    const {game,runtime}=match(), observer=newEnt(game.st,'ext-sensor',0,400,400), target=newEnt(game.st,'ltank',1,600,400); target.holdFire=true;
    const module=runtime.module('sensors-v1')!; ticks(game,5);
    let snapshot=JSON.stringify(module.snapshot()); expect(snapshot).toContain('"acquired":true');
    const index=Math.floor(target.y/TILE)*game.st.map.w+Math.floor(target.x/TILE);
    expect(module.filterVisionTiles!(observer,new Uint32Array([index]),false).length).toBe(1);
    game.st.map.terrain[Math.floor(400/TILE)*game.st.map.w+Math.floor(500/TILE)]=Terrain.Forest;
    expect(module.filterVisionTiles!(observer,new Uint32Array([index]),false).length).toBe(0);
    game.st.projs.push({x:500,y:400,px:500,py:400,angle:0,speed:0,kind:'smoke',homing:false,targetId:0,tx:500,ty:400,dmg:0,splash:20,owner:0,team:0,ttl:3,hitsSub:false,hitsAir:false,hitsGround:false});
    game.step(); snapshot=JSON.stringify(module.snapshot()); expect(snapshot).not.toContain('"acquired":true');
    expect(module.snapshot({player:1,visibleEntities:new Set([observer.id,target.id]),visibleProjectiles:new Set(),privateEntity:id=>id===target.id})).toEqual({states:[],locks:[],flights:[]});
  });
  test('decoys consume stock and spoof the declared channel once per activation', () => {
    const gun={...getDef('ltank').weapons[0],id:'guided',reload:100,projectile:'missile' as const,speed:30,homing:true,range:20,extensions:{'sensors-v1':guide({channel:'heat',range:20})}};
    define('ext-launcher',{weapons:[gun]});
    define('ext-decoy',{weapons:[],extensions:{'sensors-v1':sensor({decoys:[{id:'flare',channels:['heat'],range:10,charges:1,chance:1}]})}});
    const {game,runtime}=match(), a=newEnt(game.st,'ext-launcher',0,400,400), b=newEnt(game.st,'ext-decoy',1,600,400); a.turretAngle=0; game.hash.rebuild(game.st);
    ticks(game,4); const p=game.st.projs[0]; expect(p).toBeDefined();
    expect(runtime.order('sensors-v1',{owner:1,ids:[b.id],action:'decoy:flare'})).toBe(true); game.step(); expect(p.targetId).toBe(0);
    expect(runtime.order('sensors-v1',{owner:1,ids:[b.id],action:'decoy:flare'})).toBe(false);
  });
  test('remote orders go through ordinary movement and refuse broken, foreign or out of range links', () => {
    define('ext-remote',{weapons:[],extensions:{'sensors-v1':sensor({remote:{channel:'control',range:5,commands:['move','attack']}})}});
    const {game,runtime}=match(), a=newEnt(game.st,'ext-remote',0,400,400), b=newEnt(game.st,'ext-remote',0,450,400), enemy=newEnt(game.st,'ext-remote',1,500,400);
    const order=(action:string,targetId?:number)=>runtime.order('sensors-v1',{owner:0,ids:[a.id],action,targetId,x:600,y:600});
    expect(order('link',enemy.id)).toBe(false); expect(order('link',b.id)).toBe(true); expect(order('remote-move')).toBe(true); expect(b.orders[0]?.kind).toBe('move');
    b.x=1000; expect(order('remote-move')).toBe(false); game.step(); expect(runtime.module('sensors-v1')!.actions!(a).some(a=>a.id==='remote-move')).toBe(false);
  });
  test('independent mounts aim and fire from separate bearings and muzzle positions', () => {
    const base=getDef('ltank').weapons[0], weapons=[{...base,id:'east',reload:10,range:10},{...base,id:'west',reload:10,range:10}];
    define('ext-mounts',{weapons,extensions:{'articulation-v1':art({mounts:[{id:'a',x:0,y:-12,rest:0,arc:.7,weapons:['east'],turnRate:100},{id:'b',x:0,y:12,rest:Math.PI,arc:.7,weapons:['west'],turnRate:100}]})}});
    const {game,runtime}=match(), a=newEnt(game.st,'ext-mounts',0,600,600), east=newEnt(game.st,'ltank',1,800,600), west=newEnt(game.st,'ltank',1,400,600); a.angle=0; east.holdFire=west.holdFire=true; a.holdPos=true; game.hash.rebuild(game.st);
    ticks(game,2); expect(game.st.projs.filter(p=>p.src===a.id).length).toBe(2);
    const view=runtime.module('articulation-v1')!.render!(a) as ArticulationVisual;
    expect(view.mounts[0].angle).toBeCloseTo(0); expect(Math.abs(view.mounts[1].angle)).toBeCloseTo(Math.PI);
    expect(view.mounts[0].x).toBeGreaterThan(a.x); expect(view.mounts[1].x).toBeLessThan(a.x);
    const shots=game.st.projs.filter(p=>p.src===a.id); expect(new Set(shots.map(p=>p.targetId)).size).toBe(2);
  });
  test('automatic forms retain the real weapon, its reload, pending movement and independently turning member', () => {
    const gun = {...getDef('ltank').weapons[0], id:'launcher', reload:10};
    define('ext-rifleman',{weapons:[],radius:2});
    const attachments=[{id:'crew',unit:'ext-rifleman',x:6,y:3,rest:.6,rotation:'independent',onParentDeath:'kill'}];
    define('ext-carried',{weapons:[gun],extensions:{'articulation-v1':art({attachments,disabledWeapons:['launcher'],deployments:[{id:'set',to:'ext-ready',time:.2,automatic:'idle',orders:'retain'}]})}});
    define('ext-ready',{weapons:[gun],speed:0,extensions:{'articulation-v1':art({attachments,deployments:[{id:'pack',to:'ext-carried',time:.2,automatic:'move',orders:'retain',lockWeapons:false}]})}});
    const {game,runtime}=match(), unit=newEnt(game.st,'ext-carried',0,500,500), foe=newEnt(game.st,'ltank',1,620,500);
    unit.angle=unit.turretAngle=0; foe.holdFire=true; unit.wcd=[5];
    const module=runtime.module('articulation-v1')!;
    game.step(); const child=game.st.ents.get((module.render!(unit) as ArticulationVisual).attachments[0].childId)!;
    expect(child.angle).toBeCloseTo(.6);
    expect(game.st.projs.filter(p=>p.src===unit.id)).toHaveLength(0);
    expect(module.canFire!(unit,getDef(unit.defId),gun,foe,foe)).toBe(false);
    cmdAttack(game,[unit.id],foe.id); ticks(game,2); expect(unit.orders[0]?.kind).toBe('attack');
    ticks(game,4); expect(unit.defId).toBe('ext-ready'); expect(unit.wcd[0]).toBeLessThan(5);
    const x=unit.x; unit.wcd=[0]; cmdMove(game,[unit.id],600,500); ticks(game,3);
    expect(unit.defId).toBe('ext-ready'); expect(unit.x).toBeCloseTo(x);
    expect(module.canFire!(unit,getDef(unit.defId),gun,foe,foe)).toBe(true);
    expect(game.st.projs.some(p=>p.src===unit.id)).toBe(true);
    ticks(game,5); expect(unit.defId).toBe('ext-carried'); expect(unit.x).toBeGreaterThan(x);
    expect((module.render!(unit) as ArticulationVisual).attachments[0].childId).toBe(child.id);
    expect(()=>module.restore(JSON.parse(JSON.stringify(module.snapshot())))).not.toThrow();
    kill(game.st,child); ticks(game,2);
    expect((module.render!(unit) as ArticulationVisual).attachments).toHaveLength(0);
    expect([...game.st.ents.values()].filter(e=>e.defId==='ext-rifleman'&&!e.dead)).toHaveLength(0);
    const driven=newEnt(game.st,'ext-carried',0,400,700); driven.helm={dx:1,dy:0};
    ticks(game,8); expect(driven.defId).toBe('ext-carried'); expect(driven.x).toBeGreaterThan(400);
    const packed=newEnt(game.st,'ext-ready',0,600,700); packed.helm={dx:1,dy:0};
    ticks(game,8); expect(packed.defId).toBe('ext-carried'); expect(packed.x).toBeGreaterThan(600);
  });
  test('members are real damageable entities with preserved identities across deployment and cancellation', () => {
    define('ext-member',{weapons:[],radius:3,pop:1});
    const slots=[{id:'crew',unit:'ext-member',x:0,y:0,onParentDeath:'kill'}];
    const mobile=define('ext-mobile',{weapons:[],extensions:{'articulation-v1':art({attachments:slots,deployments:[{id:'deploy',to:'ext-fixed',time:.1,metal:20}]})}});
    define('ext-fixed',{kind:'building',speed:0,fw:1,fh:1,weapons:[],hp:mobile.hp*2,extensions:{'articulation-v1':art({attachments:slots,deployments:[{id:'pack',to:'ext-mobile',time:.1}]})}});
    const {game,runtime}=match(), a=newEnt(game.st,'ext-mobile',0,400,400); a.hp/=2; game.step();
    const module=runtime.module('articulation-v1')!, visual=module.render!(a) as ArticulationVisual, member=game.st.ents.get(visual.attachments[0].childId)!;
    expect(member.inside).toBeUndefined(); expect(member.owner).toBe(0); const money=game.st.players[0].metal;
    expect(runtime.order('articulation-v1',{owner:0,ids:[a.id],action:'deploy:deploy'})).toBe(true);
    expect(runtime.order('articulation-v1',{owner:0,ids:[a.id],action:'cancel'})).toBe(true); ticks(game,5); expect(a.defId).toBe('ext-mobile'); expect(game.st.players[0].metal).toBe(money);
    expect(runtime.order('articulation-v1',{owner:0,ids:[a.id],action:'deploy:deploy'})).toBe(true); ticks(game,4);
    expect(a.defId).toBe('ext-fixed'); expect(a.hp/getDef(a.defId).hp).toBeCloseTo(.5); expect(game.st.players[0].metal).toBe(money-20);
    expect((module.render!(a) as ArticulationVisual).attachments[0].childId).toBe(member.id);
    kill(game.st,a); game.step(); expect(member.dead).toBe(true);
  });
  test('a blocked deployment commits no metal or shape changes', () => {
    define('ext-mobile',{weapons:[],extensions:{'articulation-v1':art({deployments:[{id:'deploy',to:'ext-fixed',time:.1,metal:20}]})}});
    define('ext-fixed',{kind:'building',speed:0,fw:1,fh:1,weapons:[]});
    const {game,runtime}=match(), a=newEnt(game.st,'ext-mobile',0,400,400), money=game.st.players[0].metal;
    expect(runtime.order('articulation-v1',{owner:0,ids:[a.id],action:'deploy:deploy'})).toBe(true);
    game.st.map.terrain[12*game.st.map.w+12]=Terrain.Water; ticks(game,4);
    expect(a.defId).toBe('ext-mobile'); expect(game.st.players[0].metal).toBe(money); expect(game.st.blocked[12*game.st.map.w+12]).toBe(0);
  });
  test('tow attachment does not teleport, moves both bodies and detaches on a trailer move order', () => {
    define('ext-trailer',{weapons:[],speed:0}); define('ext-tractor',{weapons:[],extensions:{'articulation-v1':art({tow:{accepts:['ext-trailer'],range:4,length:60,speed:.5}})}});
    const {game,runtime}=match(), a=newEnt(game.st,'ext-tractor',0,600,600), b=newEnt(game.st,'ext-trailer',0,530,600);
    expect(runtime.order('articulation-v1',{owner:0,ids:[a.id],action:'tow',targetId:b.id})).toBe(true); expect(b.x).toBe(530);
    cmdMove(game,[a.id],750,600); ticks(game,30); expect(a.x).toBeGreaterThan(600); expect(b.x).toBeGreaterThan(530); expect(Math.hypot(a.x-b.x,a.y-b.y)).toBeLessThan(72);
    cmdMove(game,[b.id],500,600); game.step(); expect((runtime.module('articulation-v1')!.render!(a) as ArticulationVisual).towing).toBeUndefined();
  });
  test('tow collision validates the trailer sweep before committing either body', () => {
    define('ext-trailer',{weapons:[],speed:0}); define('ext-tractor',{weapons:[],extensions:{'articulation-v1':art({tow:{accepts:['ext-trailer'],range:4,length:60,speed:.5}})}});
    const {game,runtime}=match(), a=newEnt(game.st,'ext-tractor',0,600,600), b=newEnt(game.st,'ext-trailer',0,530,600), module=runtime.module('articulation-v1')!;
    expect(runtime.order('articulation-v1',{owner:0,ids:[a.id],action:'tow',targetId:b.id})).toBe(true);
    module.beforeStep!(1/30); game.st.map.terrain[18*game.st.map.w+17]=Terrain.Mountain; a.x+=60;
    module.afterEntities!(1/30); expect(a.x).toBe(600); expect(b.x).toBe(530);
  });
  test('deployment validates all member destinations and preserves ammunition without replenishing', () => {
    define('ext-member',{weapons:[],radius:3,body:undefined,pop:1});
    const gun={...getDef('ltank').weapons[0],id:'gun',ammo:5};
    define('ext-mobile',{weapons:[gun],extensions:{'articulation-v1':art({attachments:[{id:'member',unit:'ext-member',x:0,y:0}],deployments:[{id:'deploy',to:'ext-fixed',time:.1,metal:20}]})}});
    define('ext-fixed',{kind:'building',speed:0,fw:1,fh:1,weapons:[gun],extensions:{'articulation-v1':art({attachments:[{id:'member',unit:'ext-member',x:64,y:0}]})}});
    const {game,runtime}=match(), a=newEnt(game.st,'ext-mobile',0,400,400); a.holdFire=true; a.ammo=[1]; a.wcd=[4]; game.step();
    expect(runtime.order('articulation-v1',{owner:0,ids:[a.id],action:'deploy:deploy'})).toBe(true);
    const money=game.st.players[0].metal; game.st.map.terrain[12*game.st.map.w+14]=Terrain.Water;
    ticks(game,4); expect(a.defId).toBe('ext-mobile'); expect(game.st.players[0].metal).toBe(money); expect(a.ammo).toEqual([1]);
    game.st.map.terrain[12*game.st.map.w+14]=Terrain.Grass;
    expect(runtime.order('articulation-v1',{owner:0,ids:[a.id],action:'deploy:deploy'})).toBe(true); ticks(game,3);
    expect(a.defId).toBe('ext-fixed'); expect(a.ammo).toEqual([1]); expect(a.wcd[0]).toBeGreaterThan(3.5);
  });
  test('rejects reserved identifiers, cyclic mounts, nonfinite state and cyclic tow restoration', () => {
    let errors:ContentIssue[]=[]; readSensorsDef({emitters:[{id:'constructor',channel:'band'}]},'sensors',errors); expect(errors.length).toBeGreaterThan(0);
    errors=[]; readArticulationDef({mounts:[{id:'a',parent:'b',weapons:['a']},{id:'b',parent:'a',weapons:['b']}]},'mounts',errors); expect(errors.length).toBeGreaterThan(0);
    define('ext-node',{weapons:[],extensions:{'sensors-v1':sensor({emitters:[{id:'radio',channel:'band'}]}),'articulation-v1':art({tow:{accepts:['ext-node'],range:4,length:60,speed:.5}})}});
    const {game,runtime}=match(), a=newEnt(game.st,'ext-node',0,400,400), b=newEnt(game.st,'ext-node',0,500,400); game.step();
    const sensors=runtime.module('sensors-v1')!, raw=JSON.parse(JSON.stringify(sensors.snapshot())); raw.states[0][1].emitters.radio.cooldown=NaN;
    expect(()=>sensors.restore(raw)).toThrow('Invalid emitter state');
    const articulation=runtime.module('articulation-v1')!, saved=JSON.parse(JSON.stringify(articulation.snapshot()));
    saved.find((p:unknown[])=>p[0]===a.id)[1].tow=b.id; saved.find((p:unknown[])=>p[0]===b.id)[1].tow=a.id;
    expect(()=>articulation.restore(saved)).toThrow('Cyclic or nested tow relation');
  });
  test('wire state strips hidden target references, guidance internals and enemy deployment jobs', () => {
    define('ext-sensor',{weapons:[],extensions:{'sensors-v1':sensor({sensors:[{id:'observer',channel:'optic',range:20,retain:10}]}),'articulation-v1':art({deployments:[{id:'deploy',to:'ext-form',time:10}]})}});
    define('ext-form',{weapons:[]});
    const {game,runtime}=match(), a=newEnt(game.st,'ext-sensor',0,400,400), target=newEnt(game.st,'ltank',1,600,400); target.holdFire=true; ticks(game,2);
    const sensors=runtime.module('sensors-v1')!, publicState=sensors.snapshot({player:0,visibleEntities:new Set([a.id]),visibleProjectiles:new Set(),privateEntity:id=>id===a.id}) as {states:unknown[][];locks:unknown[];flights:unknown[]};
    expect(JSON.stringify(publicState)).toContain('"target":0'); expect(publicState.locks).toEqual([]); expect(publicState.flights).toEqual([]);
    expect(runtime.order('articulation-v1',{owner:0,ids:[a.id],action:'deploy:deploy'})).toBe(true);
    const module=runtime.module('articulation-v1')!; expect((module.render!(a) as ArticulationVisual).deployment).toBeUndefined(); expect((module.render!(a,true) as ArticulationVisual).deployment).toBeDefined();
  });

  test('contact-only sensors guide matching mounts without revealing entity state or arming unrelated channels', () => {
    const base={...getDef('ltank').weapons[0],reload:100,range:20,projectile:'missile' as const,speed:30,homing:true};
    define('ext-tracker',{vision:1,weapons:[{...base,id:'matched',extensions:{'sensors-v1':guide({mode:'emitter',channel:'band-a',range:20})}},{...base,id:'other',extensions:{'sensors-v1':guide({mode:'emitter',channel:'band-b',range:20})}}],extensions:{
      'sensors-v1':sensor({sensors:[{id:'receiver',mode:'passive',channel:'band-a',range:20,reveal:'contact'}]}),
      'articulation-v1':art({mounts:[{id:'a',weapons:['matched'],turnRate:100},{id:'b',weapons:['other'],turnRate:100}]})}});
    define('ext-emitter',{weapons:[],vision:1,extensions:{'sensors-v1':sensor({emitters:[{id:'radio',channel:'band-a',range:20}]})}});
    const {game,runtime}=match(true), a=newEnt(game.st,'ext-tracker',0,400,400), b=newEnt(game.st,'ext-emitter',1,700,400); a.holdPos=true; game.hash.rebuild(game.st); game.updateFog(); ticks(game,8);
    expect(canSee(game.st,game.hash,0,b)).toBe(false);
    expect(game.st.projs.filter(p=>p.src===a.id).map(p=>p.gun)).toEqual(['ext-tracker/matched']);
    const module=runtime.module('sensors-v1')!, saved=JSON.parse(JSON.stringify(module.snapshot())); module.restore(saved); expect(module.snapshot()).toEqual(saved);
    const own=module.snapshot({player:0,visibleEntities:new Set([a.id]),visibleProjectiles:new Set(game.st.projs.map(p=>p.id!)),privateEntity:id=>id===a.id});
    expect(JSON.stringify(own)).toContain('"target":0'); expect(JSON.stringify(own)).not.toContain('"spec"');
  });
  test('overlapping attached members never push their stationary controller across the map', () => {
    define('ext-member',{weapons:[],radius:3,body:undefined,pop:1});
    define('ext-squad',{weapons:[],extensions:{'articulation-v1':art({squad:true,attachments:[{id:'member',unit:'ext-member',x:0,y:0,select:'parent'}]})}});
    const {game,runtime}=match(), a=newEnt(game.st,'ext-squad',0,400,400); ticks(game,60);
    expect(a.x).toBe(400); expect(a.y).toBe(400);
    const module=runtime.module('articulation-v1')!, child=game.st.ents.get((module.render!(a) as ArticulationVisual).attachments[0].childId)!;
    expect((module.render!(child) as ArticulationVisual).selectParent).toBe(true);
    kill(game.st,child); game.step(); expect(a.dead).toBe(true); ticks(game,3); expect([...game.st.ents.values()].filter(e=>e.defId==='ext-member')).toHaveLength(0);
  });

});

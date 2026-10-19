// Heterogeneous source turrets use the host's native picture/shadow/lighting passes.
export default function (sdk) {
  const ID='naval-warfare.systems-v1';
  return {presentation(base){
    return {...base,Renderer:class NavalWarfareRenderer extends base.Renderer {
      drawEnt(g,e,alpha,view,cam){
        super.drawEnt(g,e,alpha,view,cam);
        const visual=sdk.contentRuntime(this.game)?.module(ID)?.render?.(e);if(!visual?.deck?.length)return;
        const p=super.pictureOf(e,sdk.getDef(e.defId),alpha);
        for(const m of visual.deck){const sp=sdk.getSprite(m.sprite+p.teamSuffix);if(!sp)continue;
          const a=((m.angle+Math.PI/2)%(Math.PI*2)+Math.PI*2)%(Math.PI*2),frame=sp.dirs?Math.round(a/(Math.PI*2)*sp.frames)%sp.frames:0,ss=sp.ss??1,scale=1.5625;
          g.save();g.translate(m.x+p.ex-e.x,m.y+p.spriteY-e.y);if(!sp.dirs)g.rotate(a);
          g.drawImage(sp.cv,frame*sp.fw*ss,0,sp.fw*ss,sp.fh*ss,-sp.fw*scale/2,-sp.fh*scale/2,sp.fw*scale,sp.fh*scale);g.restore();
        }
      }
      drawContentProjectile(g,p,alpha,bounds){
        const slash=p.gun?.lastIndexOf('/')??-1;if(slash<0)return super.drawContentProjectile?.(g,p,alpha,bounds)??false;
        const def=sdk.getDef(p.gun.slice(0,slash)),gun=def.extensions?.[ID]?.guns.find(w=>w.id===p.gun.slice(slash+1));
        const key=gun?.weapon.look?.sprite;if(!key)return super.drawContentProjectile?.(g,p,alpha,bounds)??false;
        const sp=sdk.getSprite(key);if(!sp)return false;
        const phase=((p.angle+Math.PI/2)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
        const frame=sp.dirs?Math.round(phase/(Math.PI*2)*sp.frames)%sp.frames:0,ss=sp.ss??1;
        const x=p.px+(p.x-p.px)*alpha,y=p.py+(p.y-p.py)*alpha-this.projLift(p,alpha);
        g.drawImage(sp.cv,frame*sp.fw*ss,0,sp.fw*ss,sp.fh*ss,x-sp.fw/2,y-sp.fh/2,sp.fw,sp.fh);return true;
      }
      drawContentDecal(g,d,cam,alpha,bounds){
        const match=/^(?:hulk|crash)\.(.+)$/.exec(d.key),c=match&&sdk.getDef(match[1]).extensions?.[ID];
        const sp=c?.wreck&&sdk.getSprite(c.wreck);if(!sp)return super.drawContentDecal?.(g,d,cam,alpha,bounds)??false;
        const ss=sp.ss??1;g.save();g.translate(d.x,d.y);g.rotate((d.rot??0)+(d.spin??0)*(d.fall??0));
        g.drawImage(sp.cv,0,0,sp.fw*ss,sp.fh*ss,-sp.fw/2,-sp.fh/2,sp.fw,sp.fh);g.restore();return true;
      }
      pictureOf(e,def,alpha){
        const p=super.pictureOf(e,def,alpha);
        if(!def.extensions?.[ID]||e.site)return p;
        const visual=sdk.contentRuntime(this.game)?.module(ID)?.render?.(e);
        if(!visual)return p;
        p.gun=undefined;p.gunArt=undefined;p.rings.length=0;
        for(const m of visual.mounts){const sprite=sdk.getSprite(m.sprite+p.teamSuffix);if(!sprite)continue;
          p.gun??=sprite;p.gunArt??=m.sprite;
          const delta=Math.atan2(Math.sin(m.angle-m.previous),Math.cos(m.angle-m.previous));
          p.rings.push({x:m.x+p.ex-e.x,y:m.y+p.spriteY-e.y,bearing:m.previous+delta*alpha,recoil:{art:m.sprite,sprite,shifts:[]}});
        }
        return p;
      }
    }};
  }};
}

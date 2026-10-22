// Uses only installed recordings and the host's existing rendering/audio pipelines.
export default function (sdk) {
  const ID='fg-rusted-league.source-v1';
  return {
    feedback(context,base) {
      const resources=new Set(),seen=new Map(),scope=sdk.createRecordedAudioScope();let previous=-1;
      return {
        unitVoice(defId,action,entityId) {
          const c=sdk.getDef(defId).extensions?.[ID],key=action==='select'&&c?.selectSound;
          const url=key&&sdk.asset(key);
          if(!url){base.unitVoice(defId,action,entityId);return;}
          resources.add(url);sdk.playRecordedUnitVoice(defId,action,entityId,[url],{gain:.65,repeatMs:700});
        },
        update(frame) {
          if(frame.time<previous){seen.clear();scope.reset();}previous=frame.time;
          scope.setPaused(frame.paused);scope.update();
          const active=new Set();
          for(const e of context.game.st.ents.values()) {
            if(e.dead||e.owner!==context.player)continue;
            const c=sdk.getDef(e.defId).extensions?.[ID];if(!c?.reloadSound)continue;
            const visual=sdk.contentRuntime(context.game)?.module(ID)?.render?.(e,true),count=visual?.reloads;
            if(count===undefined)continue;active.add(e.id);
            if(seen.has(e.id)&&count>seen.get(e.id)){const url=sdk.asset(c.reloadSound);if(url)scope.play(url,{position:{x:e.x,y:e.y},gain:.5});}
            seen.set(e.id,count);
          }
          for(const id of seen.keys())if(!active.has(id))seen.delete(id);
        },
        dispose(){scope.dispose();seen.clear();sdk.releaseRecordedVoiceResources([...resources]);}
      };
    },
    presentation(base) {
      return {...base,Renderer:class SourceRenderer extends base.Renderer {
        pictureOf(e,def,alpha) {
          const p=super.pictureOf(e,def,alpha);
          if(!def.extensions?.[ID]||def.domain!=='air'||!p.body||p.body.dirs||p.body.frames<2)return p;
          const states=p.body.anims;
          const firing=e.burstLeft>0||e.wcd.some(value=>value>0);
          const range=(firing&&states?.firing)||(p.moved>.05&&states?.moving)||states?.idle;
          if(range){const[first,last,fps]=range;p.frame=first+Math.floor(this.renderTime*(fps??p.body.fps??8)+e.id)%(last-first+1);}
          return p;
        }
        drawContentDecal(g,d,cam,alpha,bounds) {
          const match=/^(?:hulk|crash|ruin)\.(.+)$/.exec(d.key);
          // Prop debris shares the ruin prefix (for example ruin.d.tower).
          // Only registered definitions can own this package's wreck artwork.
          const def=match&&sdk.DEFS[match[1]],c=def?.extensions?.[ID],sp=c?.wreck&&sdk.getSprite(c.wreck);
          if(!sp)return super.drawContentDecal?.(g,d,cam,alpha,bounds)??false;
          const scale=sdk.unitDisplayScale(def),ss=sp.ss??1,w=sp.fw*scale,h=sp.fh*scale;
          if(d.x+w/2<bounds.x0||d.x-w/2>bounds.x1||d.y+h/2<bounds.y0||d.y-h/2>bounds.y1)return true;
          g.save();
          try {
            g.globalAlpha=Math.max(0,Math.min(1,d.t/(d.fade??6)));g.translate(d.x,d.y);
            g.rotate(def.kind==='building'?0:(d.rot??0)+(d.spin??0)*(d.fall??0));
            g.drawImage(sp.cv,0,0,sp.fw*ss,sp.fh*ss,-w/2,-h/2,w,h);
          } finally {g.restore();}
          return true;
        }
      }};
    }
  };
}

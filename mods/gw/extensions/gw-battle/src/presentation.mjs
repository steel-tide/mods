// GW BattleUniverse on the screen and in the ear: mobile suits riding their
// sub-flight systems, the HQ operator's lines, and each era's soundtrack.
export default function (sdk) {
  const ID = 'gw.battle-v1';
  // Each era's package plays its own tracks while its units are in play
  // (`whenUsingUnitsFromThisMod_playExclusively`).
  const ERA_MUSIC = /* ERA_MUSIC */ {};
  // Noel Anderson, the HQ operator (`CV_HQ_EFSF_0079_NOE`), and the voice each faction is picked with.
  const LINES = /* LINES */ {};
  const PICKED = /* PICKED */ {};
  // Seconds between two of the same call, so a running fight is not one long alarm.
  const REPEAT = { base: 30, allyACE: 20, enemyACE: 20, allySupply: 20, enemySupply: 20 };

  const config = def => def.extensions?.[ID];

  return {
    presentation(base) {
      return {
        ...base,
        Renderer: class GWRenderer extends base.Renderer {
          // A mobile suit on a sub-flight system stands on it, drawn above the carrier.
          drawEnt(g, e, alpha, view, cam) {
            super.drawEnt(g, e, alpha, view, cam);
            if (!e.cargo?.length || !config(sdk.getDef(e.defId))?.sfs) return;
            for (const id of e.cargo) {
              const r = this.game.st.ents.get(id);
              if (r && !r.dead && r.inside === e.id) super.drawEnt(g, r, alpha, view, cam);
            }
          }
        },
      };
    },
    feedback(context, base) {
      const { game, player, spectator } = context;
      const faction = game.st.cfg.players[player]?.faction;
      if (spectator || !faction?.startsWith('gw-')) return base;
      const era = faction.endsWith('0079') ? '0079' : faction.endsWith('0087') ? '0087' : 'ce71';
      const popMusic = ERA_MUSIC[era]?.length ? sdk.pushMusicQueues({ battle: ERA_MUSIC[era] }) : () => {};
      const scope = sdk.createRecordedAudioScope();
      const urls = new Map();
      const resource = id => {
        if (!urls.has(id)) urls.set(id, sdk.asset(id));
        return urls.get(id);
      };
      const last = {};
      let started = false, ended = false, team = game.st.players[player]?.team;
      const known = new Set(), hp = new Map();
      const say = (key, takes) => {
        const now = performance.now() / 1000;
        if (last[key] !== undefined && now - last[key] < (REPEAT[key] ?? 0)) return;
        const list = (takes ?? []).map(resource).filter(Boolean);
        if (!list.length) return;
        last[key] = now;
        scope.play(list[Math.floor(Math.random() * list.length)], { position: null, gain: 1 });
      };
      return {
        unitVoice: base.unitVoice,
        update(frame) {
          if (frame.paused) return;
          const st = game.st;
          if (!started) {
            started = true;
            say('picked', PICKED[faction]);
            setTimeout(() => say('start', LINES.gameStart), 2500);
          }
          if (st.result && !ended) {
            ended = true;
            const r = st.result, win = !r.draw && (r.winnerTeam === undefined ? r.win : r.winnerTeam === team);
            say('end', win ? LINES.win : LINES.lose);
          }
          for (const e of st.ents.values()) {
            if (e.dead) continue;
            const def = sdk.getDef(e.defId), c = config(def);
            if (!c) continue;
            const ours = st.players[e.owner]?.team === team;
            // an enemy is announced once it is seen
            if (!ours && !(sdk.contentRuntime(game)?.visible(e, team) ?? false)) continue;
            if (!known.has(e.id)) {
              known.add(e.id);
              if (frame.time > 1) {
                if (c.ace) say(ours ? 'allyACE' : 'enemyACE', ours ? LINES.allyACE : LINES.enemyACE);
                else if (c.supply && def.kind === 'unit') say(ours ? 'allySupply' : 'enemySupply', ours ? LINES.allySupplyUnit : LINES.enemySupplyUnit);
              }
            }
            // a building of ours losing hit points: the base is under attack
            if (e.owner === player && def.kind === 'building' && !e.site) {
              const before = hp.get(e.id);
              if (before !== undefined && e.hp < before - 1) say('base', LINES.baseUnderAttack);
              hp.set(e.id, e.hp);
            }
          }
        },
        dispose() {
          popMusic();
          scope.dispose();
        },
      };
    },
  };
}

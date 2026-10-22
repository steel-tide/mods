> **Git tracking update 2026-10-22.** The maintainer requested inclusion in Git.
> The port is now `mods/ucgr`, version `0.0.1`, and is no longer Git-ignored.
> References below to its ignored status describe the historical handoff.

> **Superseded 2026-10-19.** The cargo-sentinel blocker is fixed, the pack
> regenerates (0.7.0, 366 definitions) and the full battery passes. Current
> state, decisions, exclusions and remaining work are in [LEDGER.md](LEDGER.md)
> and [non-m5-status.json](non-m5-status.json). The text below is the
> 2026-10-18 handoff, kept for provenance.

# UCGR continuation instruction — 2026-10-18

## Task and hard constraints

Continue the existing UCGR port. The user requested: “Close all remaining non-M5 gaps in the UCGR pack using the new APIs. Preserve original behavior and appearance, add missing translations, and don't touch game code. Stay on main, no push.” Work was interrupted to conserve credits; this is a handoff, not a completion report.

- Modify only the mods repository. Read the game's SDK/source/tests as needed, but **do not edit the game repository**. Any remaining host limitation must be reported for approval. No workaround that silently changes source behavior.
- Keep extensions inside this pack, not in a shared mods extension or in the engine. Other packs may carry their own implementations. The vanilla host must incur no mod-specific work when no mod is installed.
- Prefer omission to a broken or approximate feature. Preserve documented source quirks. Use the existing native recoil and music support where they match.
- M5 remains excluded: the original mode/decks, SUP/SPP, scores/phases, platoon reinforcement calls and 5v5 scenarios. Paid loadout/service purchases remain disabled; explicitly free original sandbox loadouts may be implemented. Do not classify every missing aircraft or action as M5 without checking its source.
- Preserve original descriptions and appearance, correct muzzle positions, and provide English/Chinese/Korean strings for exposed content and actions.
- Stay on `main`; do not push, create another pack/worktree, commit, or publish unless the user newly requests it. All current work remains local.

## Locations and repository state

- Mods repo: `/Users/rivertwilight/Developer/steel-tide-mods`
- Original RW pack: `rusted-warfare-mods/usgr-re`
- Port: `mods/ucgr`
- Pack extension: `mods/ucgr/extensions/combined-arms-v1`
- Read-only game repo: `/Users/rivertwilight/Developer/steel-tide`
- Read applicable `AGENTS.md` files before working.

At handoff, mods branch is `main`, HEAD `a37f1cc85919ab32b86ad6e445abd2a0ee25a951`. **`mods/ucgr` is ignored**, so ordinary `git status` does not reveal these extensive changes. It reports an untracked root `pnpm-lock.yaml` of uncertain origin: preserve it. Do not force-add the pack merely to make it visible.

The game repository changed concurrently during this task. Its last observed HEAD is `b355c6de128823db81d674f57f3eae11de23b5f7`, branch `main`, clean at that observation. Earlier networking/recruiting edits belonged to other work and were subsequently committed externally. This port task made no game edits. Do not reset the game to the initial baseline (`b72adf56bac27df2455de957934ab07503eebc17`) or the intermediate `49dd0d7…`. Recheck current state.

All three implementation agents are stopped. Our Vite process on port 5203 (PID 90587, session 13578) was stopped for this handoff. The existing server on port 5199 predates this task; leave it alone. No port/test/compiler job was running at the last process check.

## First priority: repair regeneration, then establish a trustworthy baseline

**Current `mod.json` is stale:** 319 definitions, 7 factions, 478 sprite sheets, 50 sounds. It predates later source changes. The latest `python3 -B mods/ucgr/port.py --media` failed before writing a new manifest. Several media/report outputs are written earlier, so generated artifacts are currently mixed. Do not certify the folder or use its screenshots as evidence of the latest implementation.

Exact failure (`/tmp/ucgr-port-new.log`):

```text
port.py:180 -> augment_transport
transport_port.py:13
ValueError: Invalid source cargo weight
```

All four source FPV operators (`RUSFPVSQUAD`, `PLAFPVSQUAD`, `USFPVSQUAD`, `EUFPVSQUAD`) have `transportSlotsNeeded:100000`. This is an intentional untransportable sentinel. The new compiler and `src/transportSpec.ts` incorrectly cap source weight at 10000. Retain the actual source value and prohibit boarding, including into native carriers. Do not simply clamp it into a loadable passenger. Native `cargoWeight` is capped at 50; current bridge is `min(50, weight)` with the original weight stored in `sourceTransport`. A source-policy-only carrier gate would leave a hole for vanilla carriers.

The last roster edit also added 24 ordinary ground vehicles; they are not yet in the manifest:

- Russia: K-17, 库尔干人25, T15, SPM_短号, SPM_运兵_1, Kamaz_1, Ural_1, TyphoonK_AT.
- China: CSK181_1, CSK181_2, DFMS1_HJ8, DFMS1, EQ240, VP22, VP23, ZSL56.
- USA: HMMV, HMMV_TOW2, HMMV_MG, M939, MRAP.
- Europe: MANHX, VBL, VBL_MG.

All 24 passed individual transport preflight. The full build then hit the FPV sentinel. Recompute actual roster counts after regeneration; do not use an estimated count in documentation.

## Architecture and integration details to preserve

The extension has seven capabilities: squads, articulation, components, logistics, sensors, targeting, feedback, all namespaced `usgr-re.*-v1`. Keep registration order in **both** `src/runtime.ts` and `build.mjs`:

1. squads
2. articulation
3. components
4. logistics
5. sensors
6. targeting
7. feedback

Articulation must see tow-detach movement orders before damaged components clear them. Targeting must be the last sight-changing boundary; see the fractional sight issue below.

Repeated literal configuration is deduplicated by `profile_pack.py`, `literal-profiles.json`, `src/sourceProfiles.ts` and `src/generatedProfiles.ts`. References look like `{"$ucgr":"hash20"}`. The dictionary lives in this pack's schema module and expands through the complete typed validators; it is not an engine feature. Python tools use `profile_pack.expand_profiles(value, HERE)`, tests use `expandedManifest()` from `test-utils.ts`. `parseMod` returns raw serialized data; `applyMods` plus `getDef` gives normalized runtime definitions. Large fixtures using the real extension package need `capacity:'large'`. Metadata limit is 4 MiB, executable-module source 2 MiB, stored large-pack assets 256 MiB. Do not bypass validation or expand the whole manifest into an oversized metadata fixture.

`port.py` invokes the extension build automatically. It also clears `articulation_port._media_reports.cache_clear()` after media export; this fixes stale geometry reports for newly selected units.

`rw.py` now handles embedded triple-quoted values with prefixes/suffixes. `source_stats.py` preserves literal source scaling: 0.4 world px/RW px, 60 Hz, RW tile 20 / host tile 32, HP ×0.6. Arbitrary older clamps were removed. Main-round compilation includes HE/HEAT/ATGM and retains stable IDs through resource ordering.

### Critical fractional-vision issue

Read-only investigation found native `vision.ts` can loop/allocate indefinitely for fractional ray endpoints (e.g. vision 3.75). An actual HAWK fog test consumed tens of GB before it was killed. **Do not rerun that old bundle.**

The pack fix in targeting captures final composed vision, supplies `Math.ceil(vision)` to the native tile walker, then `filterVisionTiles` clips back to `dx²+dy² <= r²+r`. Original definition values stay fractional. Targeting must remain after components/sensors/squads so another effective-def override cannot restore fractional input. `fractional-sight.test.ts` passed 7 assertions with real fog ticks, base 3.75 and dynamic 2.25. The generated package still needs refreshing and the actual battery/full-roster fog tests must be rerun.

## Implemented or partly implemented work to retain

These are implementation notes, not a claim that the complete current pack passes.

### Squads and towing

`squads_port.py`, `squadsSpec.ts`, `squads.ts`, `squads-game.test.ts`: groups contain actual 3/5 soldiers, not manufactured duplicates. Four source controller/trench forms, invisible proxy body, source trench art; morale 60 with 60/40 hysteresis, chaos 20, source recovery, 10 s rush/30 s cooldown. Dig 20 s, exit 1 s; real identities, damage and ammo survive. HQ auto-group toggle defaults on. Existing-trench entry walks through native boarding; carrier boarding detaches members. Saves separate public membership from private morale/clocks. Five actual game tests passed. Full source search/retry/neutral behavior still needs audit. Proxy minimap dots remain a host seam.

Recovery BREM-1/96 uses original attachment positions, weight 50 and 200 RW px search radius, finds own immobilized armor, approaches through native pickup, carries an exposed damageable child with disabled weapons, follows original gradual orientation, and detaches alive on tractor death or movement order. Last actual tow test passed after registration-order correction. Amphibious/domain edge cases still need checking.

### Artillery and articulation

`barrage_port.py`, `barrageSpec.ts`, articulation integration and `artillery-game.test.ts` implement mobile/deployed forms for 2S35, M109A7, PCL181, PLZ05, Pzh2000 and 凯撒, plus explicit 2S23 mortar barrage.

- 2S23: 5 shells, first 2 s / subsequent 6 s, cooldown 40 s.
- 2S35: 6 shells / 3 s, cooldown 40 s.
- M109A7: 5 shells / 8 s, cooldown 60 s.
- PCL181/PLZ05: 5 shells / 5 s, cooldown 40 s.
- Pzh2000: 3 shells / 3 s, cooldown 20 s.
- Caesar: 5 shells, first 3 s / subsequent 6 s, cooldown 40 s.

Explicit forced shells consume one ammo charge plus source energy, use source aiming/arc gates, and bypass ordinary warmup/fire veto as source actions do. Queue/cancel/cooldown is private and saved. Queue locks movement; deployment only locks movement where the source says so. Form swaps retain identity, HP, orders, ammo, component state, cargo and weapon IDs. Mobile main guns remain disabled but keep state. PLZ05's source mobile gun is impossible to fire due to energy cost; do not create an extra live gun. Mount forms require equal IDs/parents/weapon membership but can differ in source geometry/sprites.

Two actual artillery tests passed at an earlier 305-def state. Fold/save/mobile-denial assertions were added afterwards and have not been rerun. All six SPGs still need complete coverage. Original artillery warning/marker presentation is unfinished. TOS1A and 63火 rocket queues are not implemented.

Articulation now supports nonfiring parent rings, transparent invisible pivots and HAWK per-weapon tolerance 181° for its full-circle slave launcher. Restricted unknown slave arcs still fail preflight. The queued `shouldResetTurret` / `idleDirReversing` / `idleSweep` audit was not completed; no matching fields were found in the current articulation source at handoff.

### Source transport — new, unverified

`transport_port.py`, `transportSpec.ts`, articulation `sourceTransport`, `sourceCanCarry`, order/board gates and unload-step wrapper are WIP. They preserve source weights/capacity/tags, blocking other transports, and unload intervals. Source raw `3` is 3 frames = 0.05 s; default is 30 frames = 0.5 s. Native unload step is a placement/clock boundary, scaled by `0.6/source.unload`, not movement scaling. Tag queries use `sourceEntityTags`.

Compiler rejects unreviewed nondefault air/water, single-slot, death, waypoint, or heal policies. Fix the sentinel blocker above, then test real HMMV capacity/tags/0.05 s unload, T90 weight 48, M2A3 weight 34, and native-carrier rejection. No dedicated transport tests have yet been added.

### Combat and movement

Agent-owned files include `component_port.py`, components/logistics runtime and specs, `sourceBallistics.ts`, `sourceWarmup.ts`, movement compiler/runtime/tests, `achievement_port.py`.

- Independent finite APS launchers, exact interception lifetime/reload and already-intercepted exclusion; saved logical helper IDs avoid exhausting native entity IDs.
- Direct plus area HP phases are additive. AP weak branches, HE/HEAT/AP/TAM fragments, cluster 19/24 offsets, forest variants and TAM 0.25 s expanding hit-once helpers are active.
- Source projectile life, speed/acceleration, near/far turning, spread, gravity versus trueGravity, vertical steering and delayed/contact/expiry phases replace guessed trajectories.
- Source reset-after-shot warmup/decay advances only when ready, aligned and policy-valid; saved privately; forced artillery actions bypass it as authored.
- `logisticsTakeStock` and `componentArtilleryReady` are exported for related systems.
- T90M → T90MArenaM after at least 5 armor kills is implemented once per owner, preserving identity/HP fraction/wounds/ERA/ammo/orders/cooldowns and initializing finite APS. The hidden form is in the last 319-def manifest. Other medals consumed only by M5 remain excluded. Original global/chat announcement is unfinished.
- Exact direct AIR/sliding/ignore-body movement with collisions/formations disabled is bound to the three FPV drone forms. Ordinary ground reverse/path/formation movement is **not** source-parity certified. See `MOVEMENT-PARITY.md`; do not overwrite post-fire native poses as a fake movement fix.

Last agent report: 53 combat runtime tests / 274 assertions and 20 component/movement Python tests passed; TypeScript clean at that point. Later cross-system changes are not covered by that result.

### Sensors, radar batteries, SEAD and FPV

See `SENSORS-SOURCE-AUDIT.md`, `sensors_port.py`, `radar_battery_port.py`, `sead_port.py`, `fpv_port.py` and corresponding runtime modules/tests.

SEAD includes explicit free F16 sandbox loadout, queue/priorities/cones, targetable missile helpers, permanent emitter-off lock loss, source energy/interception, primary+TAM hits, AGM88 station-1-then-2 quirk and KH31/YJ91 alternation. Helpers retain `_source` until root feedback augmentation, then strip it before writing.

9S18M3/HAWK/IRIST provider-launcher policies preserve initial OFF, 0.5 s switching, 10 s cooldown, deployed immobility and private 5 s forward waypoint queues. Original `takeResources` default maxUnits=1 transfers 0.6 mapped HP from the first eligible launcher, even where list capacity is larger. Radar heading and deployed appearance are public/saved. MAS1/2 trench tables and known static KPA MAS3 energy are implemented; unknown equipment-dependent cases remain excluded.

Four FPV operators and FPV/FPVPG7V/FPVRPOM bodies are implemented: finite stock 10, 2 s deploy, recon >5 s / attack >10 s clocks, max 3 live children, battery/link loss, return/refund/orphan cleanup, source sliding movement, PG7V front/top and two RPOM payload helpers. Source global per-unit autoTrigger cooldown is preserved. Operators use explicit `fpv:target`/`fpv:move` actions. Rear FOB/mode2/SUP purchases remain M5. Last reported FPV checks: 3 Python tests and 4 runtime tests / 31 assertions passed before full integration.

### Appearance and sound

See `APPEARANCE-PARITY.md`, `M6-FEEDBACK-SOURCE-AUDIT.md`, media/muzzle/feedback compilers and tests.

Source sheets, independent rings, invisible pivots, muzzle defaults, helper/fragment graphics, radar stock 0–3 appearances, particle layers/timing/randomness/land-liquid conditions, source fade, attachment/death behavior, cannon smoke, ERA bars and delayed missile-launch effects were implemented. Unsupported native substitute trails/impacts/sounds are suppressed. Native impact cleanup removes only the newly created same-point mark, preserving old/source/wreck marks.

Source shooting audio defaults to gain 0.3, explicit volume replaces it, and cyclic cue order is saved. Particle atmosphere includes original frame-based height drag/wind; particles may survive emitter death and show in fog where authored. FPV operators have original deployed/travel art; RUS UAZ variant uses source identity modulo 3. Duplicate media-key handling for BREM/96 was fixed so dedup no longer deletes the canonical file. All six missing muzzle defaults were resolved from source turretSize/globalScale rules.

`emitSourceActionEffect` is available from `feedback.ts` for future smoke action integration. A smoke gameplay compiler/module was **not present at handoff**. The queued smoke work must not be treated as completed.

Earlier appearance run had 22 pass / 3 stale-assertion failures; assertions were then corrected. Three new particle tests passed. Earlier 24 media/muzzle/articulation Python tests passed. Full final rerun remains required.

## Source evidence and unfinished smoke / DynamicLoS work

RW default behavior was investigated using the public RW 1.15 decompilation at revision `52758091b7888bbe4797789d59952f34653ac960` of `https://github.com/coolomet/RustedWarfare`, locally `/tmp/ucgr-rw-115-source`. Cite its provenance accurately. Relevant evidence is recorded in the pack audit docs. Do not discard reviewed defaults merely because the reference is decompiled; distinguish observation from inference. Temporary files are supporting evidence, not the only durable record.

DynamicLoS is **not implemented**. Starting source: `tem/tank.key`, around lines 2446–2535:

- Sample interval along line is 1 RW px = 0.4 world px; applies to target height <15 RW px =6 world px.
- Recheck on target change, own/target movement, recent damage, or the source periodic expression. Compile actual family overrides and `memory.let` conditions.
- Smoke-tag markers within 50 RW px =20 world px block samples.
- Forest-tag markers within 75 RW px =30 world px block after sample index 100, except when the target is the remembered damage source.
- Damage source comes from `lastDamagedBy.customTarget1` with armor tag; expires after 3 s or attacker movement.
- Preserve source target-switch behavior and the separate quantized “acc” variant if used, rather than substitute native tile LoS.

Planned but unwritten coordination: sensors would supply `sourceSmokePoints(game): readonly {x,y}[]` for exact smokeG 5 s markers/interceptors/action clocks; targeting would consume it for DynamicLoS; components would implement source infantry smoke armor; feedback already exports the effect emitter. Audit source before implementing all four parts. Do not render convincing cover without its actual gameplay.

Original `中立及通用单位/林区.ini` replaces RW trees with forest-tag marker entities: hidden/untargetable/unselectable, source forest decals, neutral ownership transitions, range-based cleanup and a 1000-marker limit. Do not automatically invent equivalent markers from native forest tiles. Map replacement/placement must be reviewed against the M5 boundary.

## Remaining roster and behavior audit

Do a fresh original-source inventory; a selection in `mvp-roster` is not proof of full parity. Candidates still absent or not fully audited include:

- Special armor: Obj490M, PLAPOWER, T80U圣诞, T80BV_U, 泠峰.
- Rocket artillery TOS1A and 63火/63火部署.
- Helicopters Mi24P, MI28NM, MI35M, MI8TV, Z19, Z8, Z9, AH1Z, AN2.
- Additional Russian/Chinese/US/European/other jets, their source loadouts, strike/route/landing/service controllers. Paid mode services remain excluded, but do not blanket-exclude aircraft.
- FPV FOBs, loitering munitions (FH901, 乌克兰之鹰, 弹簧刀300/600, 柳叶刀) and UAVs (MQ9, 双尾蝎, 猎户座, 大疆, 扫描鹰); distinguish mode dispatch from independent combat.
- Stationary teams 红箭73架设组, 陶氏架设组, AGS17架设班, HKGMG架设班, MK17架设班, QLZ04架设班, 短号架设组, 长钉架设组.
- General source movement/reverse/formation, firing reveal, smoke/forest state, and artillery warning presentation still require honest disposition.

Known host seams to report without engine edits: BMP2M source recorded gain 5 exceeds API max 4 (cue omitted, not clamped); proxy minimap/replay dots lack an extension presentation hook; source global/chat/warlog announcements may lack a suitable hook. Recheck the SDK before claiming a seam is unavoidable. Native transport domains may expose additional amphibious/towing limitations.

## Verification state, commands and completion criteria

There has been **no successful final full build/test/checker/browser pass**. The last root combined actual-game/squads run at 305 defs was 28 pass / 1 fail / 1608 assertions. HJ8 versus T14 was correctly stopped by newly functioning APS; target changed to BMP1, not rerun. A generic armed-unit test previously skipped everything because normalized defs do not retain `producedBy`; it now builds the recruited set from producer `.produces`, excludes explicitly disabled weapons and requires >200 checked units. This repaired test has not run and may need real battery/loadout setup and compatible targets (e.g. HAWK excludes helicopters). Do not weaken it into another false pass.

`profiles-game.test.ts` was corrected to compare normalized applied definitions, batching 32 expanded definitions to stay within metadata limits; not rerun. Articulation form geometry assertions and package `capacity:'large'` fixtures were corrected; rerun. Fresh actual fog battery tests are essential after rebuilding the fractional-sight fix.

Useful commands, from the mods repo; inspect scripts/options before running:

```sh
python3 -B mods/ucgr/port.py --media
node tools/check.mjs mods/ucgr
node /Users/rivertwilight/Developer/steel-tide/game/core/node_modules/typescript/bin/tsc -p mods/ucgr/extensions/combined-arms-v1/tsconfig.json
python3 -B -m unittest discover -s mods/ucgr -p 'test_*.py'
bun test ./mods/ucgr/*.test.ts ./mods/ucgr/extensions/combined-arms-v1/test
node --test mods/ucgr/pack.test.mjs
python3 -B mods/ucgr/make-map.py
node tools/pack.mjs mods/ucgr
GAME_ORIGIN=http://127.0.0.1:5203 node mods/ucgr/capture.mjs
```

For browser validation, start Vite directly from the game/core directory if needed:

```sh
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5203 --strictPort
```

Avoid game build/dev wrappers that regenerate game files. `capture.mjs` uses a fresh Chrome profile and actual folder import through CDP. Inspect the resulting screenshots with image tools. Existing screenshots are stale (the last fully validated capture had only 132 combat units / 159 definitions).

`make-map.py` expands literal profiles; the 96×200 showcase layout was designed for an older roster and may now overflow. Recheck faction zones, hidden-form spare positions, collisions and the 400-piece map limit. Optional scenery skips occupied tiles.

Documentation also needs reconciliation: `README.md`, `COMPATIBILITY.md`, `PLAYTEST.md`, extension README, `status.py`, `non-m5-status.json`, and `roster-expansion.json` have older counts/omission claims. `README.md` refers to `verification.json`, which has not been created. Agent audit docs are newer but may also lag cross-system fixes. Existing translations cover 415 candidate unit name/description tuples; new actions/dialogue still need auditing.

Finish with a source-to-port ledger distinguishing verified implemented behavior, M5 exclusions, remaining mod work and proven host limitations. Record actual commands/results and fresh counts, refresh screenshots/package only after validation, and report limitations candidly. Do not claim “all non-M5 gaps closed” while work or a host seam remains. The first action for the next task should be to inspect this saved state and fix the cargo-sentinel regeneration blocker, not restart the port from scratch.

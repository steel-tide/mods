# Optional simulation capabilities — host API 2

Implemented in the game host on 2026-10-18. These are generic integration boundaries; the host contains no UCGR definitions, combat rules, seeker algorithms, ammunition formulas, squad membership or source asset mappings. M5 remains outside this work.

## Loading and vanilla ownership

A package using these new boundaries declares `api: 2`. API 1 packages keep their previous SDK version and identity; newer package identities include their API requirement. Match negotiation advertises the required host version and exact package identity.

`createRuntimeGame` composes functions at extended-match creation. The generated extended Game owns the added dispatch and state. Ordinary Game simulation, combat, movement, AI and transport methods retain their native bodies. Generating the optional `combatMove` implementation changes `slotAngles` from private to protected at type level only. The ordinary Game has no per-entity extension branch, wrapper, side table or allocated module instances. Added order helpers are imported by the optional SDK and do not change native command bodies.

The generator remains the source of the optional kernels. Regenerate with `node game/core/scripts/generate-content-kernels.mjs`; its `--check` mode detects drift against canonical native functions.

## Projectile ownership

`projectileStep(projectile, dt)` runs before the native projectile's downed flag, lifetime, interception, arc, steering, movement, terrain collision, contact, destination or expiry processing.

- `undefined`: delegate the entire tick to native processing, including the older `guideProjectile` hook.
- `'keep'`: the module owns the entire tick and retains the round.
- `'remove'`: the module owns the entire tick and asks the host to remove this round without a native impact.

The first module returning a defined result owns that tick. Do not remove or reorder `st.projs` inside this callback; return `'remove'`. New fragment rounds may be appended. Owners must maintain previous positions (`px`, `py`) for presentation and define their own lifetime, motion, collision, interception and detonation behavior. A claimed round does not automatically decrement `ttl` or honor `downed`. This permits an authored interception policy, but also makes that responsibility explicit.

`host.resolveImpact(st, hash, projectile, direct, terrain?)` invokes the composed impact/damage pipeline with `host.currentImpact` correctly scoped, including nested impacts. `onDamage` receives that context; normal damage accounting and deaths remain available. A module detonating a round should invoke the pipeline exactly once, then return `'remove'`. A fizzle returns `'remove'` without invoking it. `wrapImpact` and `wrapDamage` can supply source-specific payload resolution.

Stable projectile identity is required for module side tables and remote visuals: use the existing `id` or allocate `st.nextProjId++` in `onShot`. Persist authored metadata in the module snapshot, not arbitrary native fields that the network serializer may trim.

## Fire, target and terrain policies

`wrapFirePolicy(next)` composes the prelaunch tracking/terrain eligibility function. It may replace native terrain or source tracking restrictions for its own weapons and delegate all other weapons. Existing `canFire` hooks remain final vetoes across every participating module; replacing the native policy does not bypass another module's ammunition or service lock.

The same composed policy drives launch/burst eligibility, stationary target acquisition, escort weapons, priority target ranking/promotion and generated ground combat/bombard movement. This avoids granting launch permission while native terrain logic still rejects the target or forces the unit around cover. A full projectile owner must separately supply any changed post-launch terrain behavior.

`wrapTargetTracking(next)` and `wrapTargetAcquisition(next)` allow source radar/illumination/target-choice rules to replace native acquisition without changing what an opponent's frame reveals. Sensor contact and entity visibility remain distinct. Existing visibility filters, tile filters and view redaction still apply.

## Unit, aircraft, AI and interception policies

`wrapUnitStep` and `wrapBuildingStep` can delegate native behavior, modify the effective definition passed into it, or own the entity update. This allows authored flight paths, movement/altitude states, deployment and source action sequencing without copying a native Game or modifying its prototype. Outer match work, such as time, entity interpolation, spatial-hash rebuilds, effects, replication and death cleanup, stays owned by the host. Existing before/after-step and after-entities hooks cover source scheduling and final transforms.

`wrapAI` and `wrapAutopilot` replace or augment the scheduled decision for each player. An extension can own only its factions and call the native function for other players. Orders must use the common order API. The SDK exports ordinary move, attack, board, pickup and unload commands, and `cmdContentAction` for module actions. `airSteer` and `moveToward` are reusable movement primitives.

`wrapPointDefence` replaces native interception updates independently of ordinary movement/weapons. `wrapActiveProtection` replaces the active ability's interception resolver without duplicating its other effects or timers. A module may own source APS restrictions and seeker/countermeasure interactions; the SDK exposes `downOrdnance` when native interception accounting is desired.

All function wrappers compose once, in module registration order: each later wrapper receives the previously composed function. A wrapper must delegate participants it does not own. Per-projectile claim hooks instead use first claimant wins. Source package cooperation and shared behavior configuration remain package responsibilities.

## Atomic transport

`wrapBoardPassenger`, `wrapUnloadStep` and `wrapReleasePassenger` let a package integrate coupled assemblies at native arrival/unloading boundaries. A package can delay boarding while packing, choose a complete assembly, or implement its own unloading timer without replacing all unit movement. Hooks also observe ordinary automatic rearming board/release calls; delegate those calls when the source assembly does not own them.

`cmdEmbarkGroup(game, owner, carrierId, ids)` is an atomic arrival transaction in `orders.ts`. It validates the carrier and every passenger before any mutation:

- Living, same-owner, unembarked entities; unique nonempty member list.
- Native hold domain, per-passenger weight limit and combined current load/capacity.
- Physical boarding reach and cargo aircraft/submarine readiness.
- Nested hold consistency, no cycles, no carrier-as-descendant, no duplicated descendants.

On success, all passengers enter the same ordinary `inside`/`cargo` relationship. Their orders, paths and targets are cleared and positions move to the carrier. This is a deliberate boarding order, not an automatic rearm-resume operation; automatic service calls needing their original mission should delegate to the native boarder or implement a source mission in module state.

`cmdDisembarkGroup(game, owner, carrierId, placements)` validates every passenger and placement before releasing any of them. Spots must be finite, inside the map and local to the carrier's hull/ramp; arbitrary remote teleporting is rejected. Native terrain/blocked-cell and ship-beam rules apply. Ground placements must not overlap another selected passenger or a living, unembarked ground entity. On success, cargo references are removed, `inside` is cleared, position/interpolation/idle/navigation markers are reset, and old orders/targets are cleared.

The module chooses source grouping, packing state, slots, offsets and timers. No new wire command or native cargo format is introduced. Existing authority checking happens at the `contentAction`/native command gateway; the atomic helpers repeat ownership checks at commit. A failed preflight leaves every passenger and the hold unchanged. Native saves and frames retain the ordinary cargo relationship, and carrier death still kills embarked passengers using native accounting. A source-specific ejection/survival rule must explicitly release its passengers before delegating fatal damage.

## Saves, frames and cleanup

Module state still uses `snapshot`, `restore` and optional `validateRestoredState`. Persist all source clocks and references needed to resume claimed projectiles, assemblies and scripted movement. `snapshot(view)` must filter private entity/projectile state using `visibleEntities`, `visibleProjectiles` and `privateEntity`; the host cannot infer the confidentiality of an arbitrary module JSON object. The source module owns validation of its own state.

The optional after-step hook completes before replay keyframe capture, so a recorded keyframe contains the same complete tick that callers see after `Game.step()` returns.

Runtime disposal is idempotent. Every module is given one cleanup call even if another throws; errors are returned as an `AggregateError` after all modules have run. The match's weak-map runtime/state registrations are released in a `finally` block, so a failing extension cannot leave the match registered. Subsequent disposal does not rerun module cleanup.

## Verification

`server/extension-simulation.test.ts` contains ten independent-author fixtures:

1. Claimed projectile bypasses native downing, expiry and destination collision, then resolves one scoped impact.
2. Unclaimed projectile produces the same serialized battle state as native and leaves vanilla Game identity unchanged.
3. Source terrain policy enables acquisition and launch while a separate module veto still blocks both.
4. Aircraft update, building delegation, player AI/autopilot, point defence and APS are independently replaceable.
5. A coupled group boards/unloads through native orders and keeps save/frame/carrier-death invariants.
6. Capacity, ownership, duplicate/cyclic membership, reach, distant/occupied/invalid placement failures are atomic.
7. Cleanup calls every module once despite one failure.
8. A prepared API 2 ES-module package launches a claimed round, saves/restores mid-flight, resumes identically and filters its frame metadata.
9. A priority-marked target behind native cover remains preferred when the source policy permits firing, including promotion from a retained nearer target.
10. Replay keyframe entity state and the complete world hash include after-step module mutations.

Focused verification also passed the three combat-kernel tests, launch/recoil wrapper test, 27 native transport tests and three cold-loader tests. Existing extension-host and API-version tests pass. The broader performance evidence is recorded separately; these behavior tests alone do not establish startup or cross-device timing parity.

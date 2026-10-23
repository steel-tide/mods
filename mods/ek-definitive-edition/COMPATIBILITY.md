# Compatibility and remaining work

This is a playable local port, **not a claim of complete RW parity**. All 573 named source definitions are represented. Original descriptions are deliberately preserved even when they describe a feature listed below. The complete source-to-definition mapping and per-field findings are in `source-inventory.json` and `conversion-report.json`.

## Current host-contract differences — game changes require approval

| Source feature | Affected source definitions | Current result |
| --- | --- | --- |
| `overrideAndReplace` | `dropship`, `experimentalDropship`, `extractorT3` | The current definition API is additive. Separate EK definitions are retained; existing native definitions are not replaced. |
| RW automatic new-map/global controller setup | `Ek_announcement`, `Ek_InvincibleTarget_Land` | No direct declarative equivalent for RW's new-map/aggressive-team setup is used. The definitions exist, but automatic controller placement and the source aggressive-team assignment are absent. A mod-owned setup adaptation may be possible; this does not mean the entire behavior is impossible in the engine. |
| Native numeric and content bounds | See `adaptations` in the conversion report | The pack uses the existing large-capacity contract. Zero-HP immortal helpers use 1 HP; extreme native cost, radius, sight, turn, build-time and cargo fields are bounded. No limits in the game were raised. |

No game code was changed. If exact native replacement or a new generic host contract is desired, that work needs separate approval.

## Implemented in the mod package

- RW geometry: a turret is drawn at RW's turret scale (`turretImageScale`, `scaleTurretImagesTo`), never the hull's `imageScale`, and `image_drawOffsetX/Y` keeps its pivot. A building faces up as in RW, so its turret layout and firing arcs keep their source bearings; its picture centres on its footprint (`image_offsetY` applied). An RW footprint rounds up to whole tiles and the building is drawn larger by the smaller axis ratio, at most 1.5× and less where the art already overhangs by half again, so a 3×1 wall fills its tiles end to end. A building's parts and every projectile are sized for the scale the game draws them at.
- Aircraft blades are the game's rotors (`rotors`): an arm whose end spins on an RW aircraft (a helicopter's blades, a gunship's fans, the Large Gunship's rotor wings) becomes a rotor at its source place and rate, drawn with its own art in the side's colour, shadowed with the hull and heard while it flies; slow radar dishes stay arms. Every other EK aircraft names none, so none wears a rotor RW never drew. How an aircraft flies is `hovers` alone: RW's bombers (`attackMovement: bomber`) are fixed wings, everything else hovers.
- The player aims the EK guns as the game's own: force fire at a spot and the trigger under the helm train every gun that can shell that ground (flak included) onto it, and an attack ordered on an ally is carried out. A round the player forced hurts its own side; what the guns choose for themselves, cascades and scripted strikes spare it, as in RW.
- Whatever fires below the surface carries sonar to its reach, buildings included, so the torpedo sea bunkers see the submarines they shoot.
- Faction colour: RW's default team mask, every pure-green shade (red equal to blue, green above), becomes the game's magenta on hulls and buildings, on turrets with `teamColorsOnTurret` and on arms with `image_end_teamColors`, so each player's EK units wear their colour.
- Targeting as RW defaults it: land targets only unless a flag says otherwise; `canAttackMaxAngle`; slave barrels aimed by their master turret and an aiming base (`canShoot: 0`) trained for the barrels it carries; fixed guns aimed by the hull; melee reach from the attacker's edge, with the last step taken when the game parks a fighter short of it. Turret `resourceUsage` flags set and clear on firing, and a conditional `invisible` shows a firing frame or loadout only while it holds.
- RW rounds as RW flies them: a round that cannot turn flies to its aim point, an unguided round at its `targetSpeed`, a `speed: 0` round stays put for its life, a round that outlives its life vanishes unless `explodeOnEndOfLife`, ballistic anti-air rounds fly at their target, only ground-aimed rounds scatter, and only a round that strikes nothing but hulls runs as a torpedo.
- Independent turret pivots, parent mounts, firing arcs, reloads, warmups, linked firing, recoil, alternating barrels, source energy/ammunition costs, alternate projectiles and original turret art.
- Source direct/area damage, flat armor, tag mutators, instant hits, projectile acceleration/steering, retargeting, bounded creation/expiry/impact cascades, projectile unit spawning, teleport effects and death weapons. Projectile metadata and searches survive saves.
- Source income, custom local/shared resources, flags, tags, timers, supported conditional expressions, action prices and durations, queued actions, cancellation, upgrades and compatible same-entity conversions. Unknown expression constructs do not become unconditional true guards.
- Research-priced recruitment from EK producers and 17 unit types recruited through actions on native factories. Native construction of research-priced buildings waits for its research payment; multiple assisting builders pay it once. Native factory actions use a separate package queue, so normal native production may run alongside it.
- Attachments and their exposed actions, parent resource transfers, healing auras, carrier cargo, aircraft recovery and selected deck firing. Source spawn offsets, ammunition grants and cargo transfers are retained where represented in the report.
- EMP suppression and recovery, source energy recharge behavior, original body/wreck art, frame animations and conditional visibility. Private resources and action queues are omitted from other players' snapshots.

The safe expression interpreter compiles data to an explicit AST. It never evaluates source text as JavaScript or Python code.

## Port gaps — these are not declared engine limitations

| Area | Effect in this build |
| --- | --- |
| Cliff traversal | 116 definitions request `OVER_CLIFF` or `OVER_CLIFF_WATER`. They currently use native ground/amphibious pathing. Exact traversal needs a mod-owned movement/pathfinding implementation. |
| Legs and articulated motion | 76 definitions retain their original leg sprites and rest positions. RW spring/IK gait, procedural extension and animation-driven transforms are not reproduced. |
| Decals and effects | 116 definitions have conditional/HUD decal sections outside this renderer's compiled subset. Custom particle graphs, animated beam textures, some decorative transforms, source shadow art and exact HUD bars are not reproduced. Native effects/status rows are used where available. |
| Motion and collision | Native acceleration, reversal, formations, terrain collision and flight rules remain. Source `disableAllUnitCollisions`, some helper selection/minimap rules, variable height/fall behavior and `offsetHeight` spawning do not have equivalent behavior in this build. Orbital spawns use valid 2D positions instead of simulating the full descent. |
| Recursive projectile effects | Source cascade declarations asking for more than 64 generations are omitted and reported, including explicit limits of 100, 1,000 and 2,147,483,647. This changes those particular effects/damage chains. Ordinary bounded cascades remain active. |
| Remaining projectile details | Exact RW beam sweep/reuse, gradual area expansion, fog reveal, near-target steering changes, wobble, gravity/height curves and some interception filters are not reproduced. Native interception and terrain/collision rules still apply. |
| Native waypoint events | The source `newWaypointGivenByPlayer` callbacks are recorded but are not dispatched from native player orders. Some formation/builder helper scripts therefore remain inactive. |
| Specialized actions | Uncompiled action effects are disabled, including AI-handicap resource bonuses, certain bug-builder searches, starship stat/marker/team operations and beam-drone target-reference effects. Exact source paths and fields are in `issues`. |
| Orbital transport conversion | The `EkOrbitalTransportLanded` conversion that changes native kind/footprint is disabled pending a placement transaction. Compatible conversions retain entity identity and health fraction. |
| AI and starting setup | Source AI priorities, starting-unit selectors, random-start/map controllers and all RW skirmish behaviors are not fully recreated. Native AI is supplemented with eligible package recruitment/upgrade actions. |
| Construction and transport details | Source stationary construction lists, some builder targeting restrictions, nano-factory multipliers, unload timing/exit geometry, cargo selection rules and cancellation refunds for native building research costs still differ. Package action refunds and recruitment costs are covered by tests. |
| UI text | Original prose is preserved, with missing Chinese/Korean strings added. Dynamic `%{…}` text fragments, specialized source tooltips, icons, hotkeys and layouts are not all rendered as in RW. Internal/debug units without original prose retain their source identifiers. |

The inventory retains source fields beyond the compiled subset. Presence of a source field in that inventory is not evidence that its behavior is implemented. The report is an audit of known differences, not an assertion that every source field has received an exhaustive parity test.

## Missing source dependencies

There are 37 source reference findings. They include absent RW base/bug units, `modularSpider`, `commandcenter`, and `extractorT3_reinforced`. Existing native builders/factories and selected structures have explicit adapters; other missing units are not invented or silently replaced. Missing action targets are disabled or reported rather than being treated as successfully produced.

Ten image uses refer to four unavailable standard shared files:

- `mega_tank_turret2.png` and `experimental_tank_turret3.png`: six mounts across the experimental gunship and its landed form. The hull and available mounts remain; the unavailable turret artwork is absent.
- `icon_build.png`: two internal AI helpers. These use the original standard blank sprite instead of a visible placeholder; the missing source reference remains recorded.
- `no_icon.png`: two refinery decorative arms. No substitute art is drawn.

No playable maps or source music/audio files were present in the EK directory. The port adds an original **EK Complete Showcase** test map containing all 573 definitions. The host's 400-placement map limit is unchanged: 396 EK pieces and four targets are in the map file; this mod supplies the other 177 on its opening tick. Only this map receives test resources, initial hold-fire orders, passive native AI and paused exhibition specimens. Select Start specimen test, issue an order or use an action to activate a specimen and its original scripts. This prevents the unprompted ordnance/spawn cascades from the original showcase opening; ordinary matches retain normal helper lifetimes and actions. Standard shared RW sounds/assets recovered from the supplied base asset archive are attributed in `CREDITS.md`.

## Verification and its scope

- Source checks cover all definition identities, preserved English/Chinese text, section-local inheritance, flag parsing, expression safety, asset existence, metadata/screenshot budgets and the original license copy.
- Engine integration checks initialize and step all 573 definitions, then exercise production, upgrades, resource gating/refunds, multi-builder construction, attachments, healing, suicide weapons, EMP, bomber salvos, private state and deterministic saves during actions and projectile cascades.
- A duel off a deep-water coast checks that every armed definition damages each kind of target its guns name: a tank, a helicopter, a destroyer and a dived submarine, standing first and then on an attack order, buildings raised at the game's angle. The test lists the source definitions that do not fire in a duel and why: carrier-fed drones, expiring strike helpers, AI-only launchers, missiles built by action, the landing-only dropship and the mines-only sweeper.
- Showcase checks load all 573 at their indexed positions, validate terrain and non-overlapping footprints, test reassigned/closed seats, and verify one-time setup across save/load. A full simulated minute preserves every idle specimen without projectiles, effects or extra spawns. Activation, owner checks, player orders and saves retain the intended paused/active state. Exact keyframes continue deterministically; ordinary native save slots round positions and angles, so they are checked for restoration and duplicate/resource safety rather than bit-exact trajectories.
- Actual browser folder import checks all 1,258 declared sprite sheets and 14 sounds, activates the package runtime/renderer, verifies language switching, checks browser errors and captures in-game screenshots. The showcase runs for 60 simulated seconds with fog, selection, camera movement and interpolated rendering; entity counts and canvas state stay stable. Explicitly starting an Arsenal Bird test creates its three original attached hangars.
- Single-file packaging is checked. The user-selected cover is preserved at 3840×2160 (16:9), so registry validation reports its mismatch with the current 4:3 screenshot requirement. Remaining reachability warnings include alternate forms, scripted spawners, debug/map helpers and the missing setup/reference paths described above.

These checks do not establish exhaustive long-match balance, multiplayer performance or exact equivalence of every source weapon and script. The unresolved differences above remain visible for review.

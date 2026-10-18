# Non-M5 host capability closure — 2026-10-18

Game implementation: `b72adf56bac27df2455de957934ab07503eebc17` (local main; not pushed).

This pass supplies generic host primitives for the remaining identified UCGR
combat, transport, presentation and content-capacity gaps. It does not port
those source behaviors into UCGR. The intended boundary is that their next
implementation belongs in the pack's own extension, data, assets and tests.
Exact source parity is still pending; passing a host fixture proves an API
boundary, not a faithful UCGR implementation.

The current UCGR draft remains unchanged, including its API-1 descriptor,
curated roster and omitted features. Its existing 94 tests pass. Installing
this host revision therefore does not automatically add units, seekers,
component models, effects or sounds to that pack. Future pack revisions can
declare API 2 and opt into large capacity when they actually use them.

M5 is explicitly excluded. This pass does not implement the original match
mode, selectors/decks, deployment-point economy, reinforcement purchases,
phase voting or score victory, and does not raise player/map limits.

## Ownership and compatibility

The game owns the versioned host, validation, ordinary orders, persistence,
filtered replication and optional integration boundaries. Each pack owns its
algorithms, configuration readers, source mappings, timers, private state,
actions, translations and presentation. No UCGR capability implementation or
asset is installed globally in the game or shared as a required extension in
the mods repository.

- [Framework guide](../../EXTENSION-FRAMEWORK.md): package ownership, trust,
  installation, identity and host negotiation.
- [Simulation API 2](simulation.md): projectile ownership, fire/target policies,
  entity and AI updates, interception, atomic transport and lifecycle.
- [Presentation API 2](presentation.md): native-mixed recorded audio, frame
  updates, per-item rendering and browser evidence.
- [Capacity profile](capacity.md): catalog, resources, code, embedded worlds,
  saves, import/export bounds and the source asset inventory.

API 1 remains accepted with its existing package identity and SDK version.
API-2 package identities include that requirement, and peers must advertise
`extension-host-v2` before such content starts. An explicit format-4
`capacity: "large"` pack additionally requires `content-capacity-large-v1`,
even without executable modules. Unsupported future APIs are rejected.
No protocol-version bump is needed for these optional capabilities.

Ordinary constructors retain their native implementation. Extended matches
compose their wrappers at creation, and optional presentation/audio modules
load only for content that requests them. This is the architectural boundary;
the performance acceptance result must be read separately below.

## Known gap coverage

The source inventory and previous fidelity boundaries remain in the pack's
[compatibility audit](../../../mods/usgr-re/COMPATIBILITY.md),
[component audit](../../../mods/usgr-re/COMPONENT-GAPS.md),
[sensor audit](../../../mods/usgr-re/SENSORS-SOURCE-AUDIT.md) and
[M6 audit](../../../mods/usgr-re/M6-FEEDBACK-SOURCE-AUDIT.md).
Those documents describe the existing API-1 port. Their statements about the
former host ceilings are superseded by this report; their descriptions of
unported source behavior remain valid until the pack implements it.

In the following table, “available” means the host integration route exists.
It does not mark the corresponding source behavior complete.

| Identified source gap | Available host route | Remaining pack-only work |
| --- | --- | --- |
| Complete roster, alternate forms, helper-backed behavior and the 23-million-HP bonus vehicle | Explicit large profile: 1,024 defs, 2,048 sheets, 512 ordinary recordings, 100-million HP; larger reference/production lists and package resources. Native eight-weapon storage suffices for the audited five-gun omission. | Resolve the 415-candidate ledger and deferred cases; convert definitions and required helpers, preserve dependency/reference validity, add translations and verify each defining mechanic before enabling it. The converter's four-weapon selection must not omit the five-gun vehicle's last gun. |
| Source damage, movement, turning, vision, altitude and other adapted values | Definition data, `effectiveDef`, `wrapUnitStep` / `wrapBuildingStep`, fire policy and module-owned state. A module can own an update where native integration would constrain the source behavior. | Revisit each scale/clamp with source evidence; implement the necessary source update rather than merely changing a displayed number. Custom vision geometry belongs in the visibility module. |
| Armor, angle/ricochet, ERA, crew, drivetrain and rack models beyond the T-90M slice | Existing `wrapImpact`, `wrapDamage`, `onDamage`, effective definitions and private module codecs; API-2 `host.resolveImpact` retains composed accounting/context. | Compile the other vehicle/ammunition templates, AP/HEAT/HE/ATGM payloads and source protection families; verify interactions with native targets without inventing hull damage substitutes. |
| Remaining T-90M details: fragments, post-impact recipients, forest HE radius, source accuracy modifiers, abandonment, service/repair corner cases and script ordering | Full projectile ownership, composed impacts, module clocks, entity update wrappers, common orders and inspection/actions. | Implement the audited source expressions, queues and recipient selection; restore exact transient/empty-rack behavior where required; author icons and repair actions. Source score-economy awards remain M5. |
| Partial reloads, queued initial reload, shared barrels/reloads, finite salvos, alternate equipment and ammunition selection | Existing `wrapWeapons`, `wrapShot`, `canFire`, `spendRound`, `onShot`, lifecycle hooks and module actions; API-2 entity/AI/autopilot wrappers. | Bind every retained weapon and inventory; implement initial/idle reload, loadout switching, shared clocks, source eligibility and AI choices. This unblocks the deferred sniper/gunner/reserve/MARSOC cases once their own tests pass. |
| Aircraft landing/rearm, paid service, source supply checks and mission continuation | Unit update and board/release wrappers, ordinary movement/service orders, module resource/state checks and custom actions. | Port service eligibility and clocks; preserve source charges only when their original required resources exist, and keep mode-dependent pricing omitted. Persist and resume source missions. Original SUP/SPP economy remains M5. |
| Morale, suppression, experience, achievements, aim warmup, emergency smoke/retreat/reverse, armor-facing and scripted reactions | Module damage/shot hooks and deterministic clocks; entity, AI/autopilot and weapon/fire-policy composition; shared orders and entity creation. | Port source formulas, thresholds, priorities and tactical reward behavior; distinguish local combat state from skipped mode score/currency rewards. Do not substitute unrelated native buffs. |
| Radar contacts, illumination, datalinks, RWR, ECM, scout identification and dynamic signatures | `wrapTargetTracking`, `wrapTargetAcquisition`, `wrapFirePolicy`, existing visibility/tile filters and filtered module state. | Extend beyond MiG-29/eight signatures; implement receiver/emitter relationships, warnings and acquisition. A sensor contact must not automatically disclose a hidden enemy entity. |
| Radar/IR/anti-radiation seekers, launch leg, lead/acceleration, inherited motion, proximity detonation, seeker loss and countermeasures | `projectileStep` can claim the entire tick before native life/motion/collision/interception; `host.resolveImpact`; `wrapPointDefence` and `wrapActiveProtection`. | Author each trajectory/seeker/decoy policy, finite countermeasure behavior and source interception restrictions; maintain previous positions, lifetime, IDs and impact-once behavior. |
| Forest/smoke occlusion, concealment, firing reveal and return fire | Existing visibility/tile filters plus source tracking/acquisition/fire policies and complete projectile ownership. | Implement DynamicLoS source rules and cache/update policy. Check sight, acquisition, prelaunch cover and post-launch terrain independently. |
| Remote FPV/FOB designation, reconnaissance/loitering control, dispatch, resupply and waypoint strike runs | Module orders/state/entity creation, owned entity updates, AI/autopilot and before/after-step scheduling. | Implement controller/vehicle relationships, priorities, command actions and source movement. Su-25T/Q-5L can be reconsidered after their waypoint behavior is verified. |
| Visible squads, attached firing members, towing, artillery deployment, trench forms, missile cargo and coupled HJ-8 transport | Existing entity creation/definition changes and module state; `wrapBoardPassenger`, `wrapUnloadStep`, `wrapReleasePassenger`; atomic `cmdEmbarkGroup` / `cmdDisembarkGroup`. | Define membership, visible offsets, per-member weapons, packing clocks and placement. Model unit/building forms as source assemblies where native same-kind morphing is insufficient. Test group death, service arrival, payload release and save/load. |
| Exact coupled transport ownership and source survival/ejection | Atomic transactions retain normal `inside`/`cargo`; composed damage and release policy. | Choose valid local placement for every member; persist groups and orders; explicitly release survivors before fatal damage if the source does so. Native carrier-death behavior otherwise remains authoritative. |
| Independent turret rings, pivots, slave rotation, turn acceleration and six unresolved muzzle origins | Existing mount/picture methods and native muzzle/recoil pipeline, weapon/shot composition and module-owned entity state. | Rebuild source hierarchies and establish the missing barrel-length evidence; separate A10 bore rotation from its anchor. Validate all muzzle/flash/sound origins against actual pixels. Prefer native recoil where it matches; custom curves belong in the pack adapter. |
| Dynamic hull/loadout/ERA art, mount overlays, component icons, messages, radar displays and action UI | Existing `pictureOf`, `drawEnt`, turret methods, screen/world overlays, optional input subclass and localized inspection/actions. | Convert and bind original artwork, expose only permitted state and implement original layouts/timing. Translate remaining labels and dialogs. |
| Projectiles, contrails, muzzle/hit/explosion effects, corpses and vehicle/aircraft wrecks | Native `WeaponLook` / effects where sufficient; API-2 decal, effect, projectile and trail draw methods at native layers; existing falling-aircraft hooks. | Author asset/state mappings, animation, culling, falling pose/shadows and effect lifetime; compare actual scenes with source. Keep visual suppression separate from authoritative collision/death state. |
| Death/reload/engine/jet/penetration/near-miss/rack audio, source feedback timing | Optional `createRecordedAudioScope`, feedback `update(frame)`, native SFX mixing and module presentation cues; existing recorded unit voice/music APIs. | Bind source events, rate/gain/loops/priorities and pause/seek/viewer behavior; sequence and redact remote cues. Preserve silence where no source recording exists. The opening timer and full-spectrum-only music remain M5. |
| Descriptions, actions, manual dialogs and localization | Existing content tuples and package-owned localized inspection/action/presentation data; current source single-line descriptions fit the text ceiling. | Resolve source macros, preserve meaning and add missing English/Chinese/Korean strings. A description mentioning an omitted mechanic is not proof that it works. |
| Determinism, saves, replay, multiplayer secrecy and cleanup across these systems | Module snapshot/restore/validation and view codecs; optional after-step before replay keyframes; API/version negotiation and idempotent all-owner disposal. | Persist every source clock, RNG-dependent decision and reference; validate restores; redact hidden/private state; test midway through reload, flight, impact, service and group transitions in local/remote/replay play. |

## Capacity and distribution boundaries

Large capacity is explicit and bounded. The complete source inventory includes
1,552 PNGs and 268 audio files. Portable PCM16 conversion plus base64 image/audio
encoding is estimated at roughly 93 MiB before metadata, including the deferred
mode music. The large profile's world limit is 128 MiB; standalone pack embedded
files can reach 256 MiB. A pack fitting the standalone ceiling is not promised
to fit inside a world. See [inventory and method](capacity.md#source-basis).

The existing world launch/save container duplicates embedded mods in
`world.mods` and `world.project.mods`. Large world saves therefore have a
320 MiB bound; ordinary world/plain-save limits remain 64/8 MiB. Transport
admits a 132 MiB large-world lobby envelope and 324 MiB save envelope, then the
content/save validators enforce their own smaller limits. Ordinary lobby and
ordinary-message limits remain unchanged. Declaring a budget allocates no
maximum-sized resource; actual installed content pays its memory and decoding
costs.

Folder/ZIP/single-file import, registry download, packing, prepared package
validation, world import/backup/publication and saved worlds use these bounds.
Generated registry checkers and authoring tables match the game validators.
This is local validation coverage, not a claim that a deployed publishing
provider accepts a 128 MiB HTTP request; service delivery limits may need their
own deployment configuration or an alternate existing distribution route.

## Verification evidence

| Area | Evidence and scope |
| --- | --- |
| Simulation integration | Ten independent-author fixtures in `game/core/server/extension-simulation.test.ts`: complete projectile ownership and delegated equivalence, cover/fire-veto composition, entity/AI/interception ownership, atomic groups and unchanged state on failed preflight, cleanup after errors, prepared API-2 save/frame flow, priority targeting and complete replay keyframes. Details in [simulation.md](simulation.md#verification). |
| Native delegation and transport | Focused combat-kernel, recoil/launch wrapper, native transport, cold-loader and host/API compatibility tests pass. These test ordinary delegation and integration contracts, not all UCGR policy combinations. |
| Presentation/audio | Sixteen focused tests cover scopes, native mixing, pause/disposal, callback ownership, draw-independent updates and optional cold imports. Independent SHA-verified API-2 packages run in Chrome and WebKit; [raw browser evidence](presentation-browser.json) verifies layer order, rendered pixels and real paused/resumed audio. |
| Capacity/import/export | Nineteen focused tests exercise a 415-def / 1,552-sheet / 268-sound synthetic pack, 23-million HP through damage/save/full-frame/delta, eight weapon cooldowns, large resource/source preparation, over-limit rejection, world/download/backup/save flow and portable tooling. [Capacity report](capacity.md#verification) records exact bounds and caveats. |
| Existing content | All four mod-repository tests and all seven published mod validations pass. The unchanged UCGR API-1 pack's 94 existing tests pass; this protects its current subset only. |

Tests use independent author packages as well as existing content. No fixture
requires a special UCGR identifier in the host. A source feature is ready to
ship only after its pack implementation has its own source-backed acceptance
case; primitive coverage cannot stand in for that test.

## Vanilla performance gate

**Passed in the tested desktop scope: no repeatable measurable vanilla runtime
regression was identified.** [The performance report](PERFORMANCE.md) retains
all 48 simulation/replication samples, four full-match renderer samples and 52
production boots, including slower first runs and their follow-up investigation.
Native hot-path bodies are unchanged and vanilla loads no optional extension
chunks. Integration code adds 1,481 compressed bytes. This is a bounded desktop
result, not a universal zero-cost or physical-mobile-device claim.

Root workspace type checks pass. The final focused engine run passed **135
tests**, the unchanged UCGR pack passed **94 tests**, and the four registry
tooling tests and all seven published mods passed validation.

## Remaining work and exclusions

The next phase is pack implementation: migrate only the capabilities that need
API 2, opt into the large profile when needed, restore source policies and
assets, add translations, expand the roster and prove each source case before
enabling it. Keep missing features omitted while their behavior is incomplete.
The current API-1 draft need not change merely to remain loadable.

M5 remains a separate engine/mode decision: the original 12 decks, selector
flow, SUP/SPP, phases/votes, platoon reinforcement, deployment-point ownership,
support purchases, score/flag victory and mode-gated soundtrack are outside
this closure. Original 5v5 scenarios still exceed the eight-player limit; the
600-tile map still exceeds the 512-tile side limit. Neither is silently adapted
by this work.

The coverage table closes the host blockers identified in the existing audit;
it is not a claim that every unaudited RW script is already understood or that
the host is unlimited. A newly discovered behavior must be checked against
these primitives and bounded contracts. If it requires a genuinely new host
primitive, report that specific gap instead of approximating the source.

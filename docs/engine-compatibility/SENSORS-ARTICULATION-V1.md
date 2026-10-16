# Sensors and articulation, version 1

These implementations are supplied by the mod repository's
[`combined-arms` extension package](../../extensions/combined-arms-v1/README.md),
loaded through the [generic host](../EXTENSION-FRAMEWORK.md). Format 4 packs embed
its descriptor in `extensionPackages`; fragments below omit the descriptor's
source strings. Capability IDs are package-owned, not an engine feature enum.

These optional modules are prepared only for format 4 packs declaring
`requiredCapabilities: ["sensors-v1", "articulation-v1"]`. The pack supplies IDs,
labels, values and artwork. Labels accept an `[en, zh, ko]` tuple. The schema
rejects unknown fields, nonfinite numbers, unknown references, cycles and
reserved object-property names. IDs and signal channels carry no built-in
meaning. A capability configuration belongs under a definition or weapon's
`extensions` object, keyed by the capability ID.

Ranges are tiles (32 world pixels). Durations are simulation seconds. Angles
are radians; `cone` and `arc` are half widths, at most π. Mount/attachment
positions are pixels on the up-facing art, scaled by the entity's display
scale. Positive x is right; positive y is toward the tail. Towing `length` is
world pixels. Unit/building definitions and normal weapon fields still apply.

## Sensors

Definition `sensors-v1` accepts:

| Field | Contents |
| --- | --- |
| `sensors` | At most 8 `{id,label,channel,mode,reveal,maxTracks,range,cone,targets,acquire,retain,active,forest,smoke,minimumSignature,basis,x,y,interval,scanLimit}` records |
| `signatures` | At most 8 `{channel,strength}` records, with unique channels; passive target properties, not active emissions |
| `emitters` | At most 8 `{id,label,channel,range,active,toggleTime,cooldown}` records |
| `decoys` | At most 4 `{id,label,channels,range,duration,cooldown,charges,chance}` records |
| `obstruction` | `{forest,smoke}` filters this observer's actual fog tiles |
| `remote` | `{channel,range,commands:["move","attack"]}` permits an explicit own-unit link |

Sensor modes are `observe`, `designate`, `illuminate`, `passive`, and `signature`.
`targets` accepts ground/ship/sub/air domains. A sensor must continuously
observe a target for `acquire` seconds. Ordinary sensors respect the native
stealth/sonar detection rules while using their own range; passive sensors
require a live, active emitter on the same channel. `reveal` defaults to `contact`: acquired current contacts provide private measured
positions and channel-qualified guidance without exposing a hidden entity's
identity or other state. `entity` explicitly grants normal team entity visibility
for a current acquired contact. `maxTracks` defaults to 64 (1–256); capacity is
filled in deterministic entity order. `retain` preserves the last
observed position in private state after loss; a stale contact does not reveal
updated coordinates or qualify as fresh designation/illumination support.
Forest and smoke line obstruction can be enabled independently per sensor and
per seeker. Forest stops crossed cells; smoke uses segment/circle intersection.

`signature` requires an explicit target signature on the same channel, with
`strength >= minimumSignature` (default1). It reads that signal independently
of visual fog/stealth and still obeys authored range, cone, domain and line
obstructions. A missing signature is not zero and is never detected. Strength
and threshold accept0–1000000; `minimumSignature` is rejected on other modes.
The measured strength may accompany an owner-only contact; it grants no entity
state or hidden entity ID. A signature does not enable an emitter action and
is not a range multiplier.

All receivers may choose `basis: "body" | "turret"` (default `turret`), with
`x`/`y` offsets in world pixels relative to that up-facing basis (−256–256,
default0; x right and y toward the tail). These are physical sensor offsets,
not artwork coordinates and do not receive display scaling. `interval` is the
sample period in seconds (0–60, default0 means every simulation step). Samples
replace the current contact list and preserve the existing `retain` policy;
between samples, only the measured position is available. The sample clock
survives saves. Optional `scanLimit` (1–256) limits range/channel/domain
candidates **before** the cone and line filter; omission leaves that candidate
scan uncapped. `maxTracks` still limits resulting observations. Candidates use
deterministic entity order. Status shows the pack-labeled contact count and up
to16 measured coordinate rows; all bounded contacts remain in the private
visual read model.

Weapon `sensors-v1` accepts `{mode,channel,range,cone,turnRate,acquire,lossGrace,
reacquire,maxLife,forest,smoke,decoyResistance}`. Modes are `self`, `designation`,
`illumination`, and `emitter`. Launch waits for the acquisition clock before
spending ammunition. Supported flight steers at at most `turnRate` radians per
second. Loss removes the projectile's live target reference immediately.
During `lossGrace` it may steer toward its last observed position. Afterwards
it continues on its current heading. `reacquire` permits the same target to
be acquired again within the authored seeker envelope; it does not select a
new target. Flight life is capped by `maxLife` and the native projectile limit.
A self-guided missile can continue after its launcher dies. Designation and
illumination require a current acquired allied sensor on the declared channel.
Emitter guidance requires actual active emission, including switch delay.

Matching active decoys make one deterministic chance roll per projectile per
activation. The success chance is `chance × (1 - decoyResistance)`. A successful
decoy causes permanent loss for that projectile; it does not create a fake
entity or magically damage the missile. Charges and cooldown belong to the
unit and survive saves.

Actions are `emitter:<id>` (optional boolean `on`), `decoy:<id>`, `link`
(`targetId`), `unlink`, `remote-move` (`x`,`y`) and `remote-attack` (`targetId`).
A remote link requires own units, matching channels, and range at both ends.
Commands recheck range, ownership, EMP and target visibility, then use the
normal shared move/attack orders. Link failure does not leave a command path
to an unavailable receiver. Measured contacts, emitter switches, decoy stocks and links are private to
their owner in network views. Launch locks and flight solutions are never
replicated. Contact diamonds show measured positions on the owner's field,
with fading dashed diamonds for retained observations; spectators receive none.

## Articulation

Definition `articulation-v1` accepts:

| Field | Contents |
| --- | --- |
| `mounts` | At most 8 `{id,label,sprite,parent,x,y,rest,arc,turnRate,weapons,targeting,tolerance}` |
| `attachments` | At most 16 `{id,label,unit,x,y,rest,rotation,fire,select,onParentDeath}` |
| `disabledWeapons` | At most16 weapon IDs disabled on this form; identities and reloads remain intact |
| `squad` | Boolean: an immune selection/order controller for its real members |
| `tow` | `{accepts,range,length,speed,maxWeight,detachOnMove}` |
| `deployments` | At most 4 `{id,label,to,time,metal,cancelable,health,cargo,automatic,orders,lockWeapons}` |

Each weapon belongs to exactly one mount when mounts are declared. A mount
has its own bearing, strict arc, target and burst clock. `targeting` is
`shared` or `independent`; `tolerance` is the angular firing tolerance.
The renderer and muzzle placement use the same world pose. A parent mount
carries a nested mount's origin and arc; chains are bounded and acyclic.
Shared ammunition feeds remain owned by logistics; only a committed new burst
spends stock. A lost burst target cancels the remainder, without choosing a
replacement during that burst.

Attachment units are actual entities with independent HP and ordinary death
accounting. They are created once, then moved with the parent. Destroyed
members never regenerate merely because the parent is still present. Members
cannot themselves contain articulation, cargo or warheads. `fire` is `none`,
`parent` (only the parent's target), or `independent`. `select` is `self` or
`parent`; the latter redirects graphical selection to the parent. Direct CLI
orders still address entity IDs and do not silently retarget arbitrary orders.
`rest` is a relative idle bearing (radians, −π…π, default0).
`rotation` defaults to `fixed`; `independent` lets the real member aim on its
own, carries its bearing through parent turns, and returns toward the authored
idle bearing when it has no live target. `onParentDeath` is `kill` or `detach`. A squad controller hides its body and
cannot absorb damage on behalf of its real members; it dies when all its
members die. Members retain their IDs across a deployment. An assembly commits its swept
pose before impacts and resists subsequent independent-body separation pushes;
this prevents overlapping member offsets from pushing their own controller.

`Tow` accepts an explicit list of compatible surface definitions. Attach
requires ownership, capacity and range. The operation does not teleport the
trailer. Movement advances the trailer no farther than the tractor travelled
and checks both swept bodies against terrain and other entities. A blocked
coupled move rolls back both bodies before projectiles are resolved. There are
no tow chains, cargo trailers, flying trailers, or nested attachment/tow
relations. Towed weapons do not fire. Detach leaves the trailer where it is;
`detachOnMove` also detaches when the trailer receives a move/attack-move order.
Actions are `tow` (`targetId`) and `detach`.

Boarding a parent with attachment slots, an attached member, or either body of
an active tow is unsupported in v1 and rejected at the shared order boundary.
Pickup obeys the same policy. Saves with a coupled assembly already inside a
transport are rejected; transport never counts as a parent death.

Deployment is a transaction requested by `deploy:<id>` and optionally cancelled
by `cancel`. The actor cannot move while progressing; `lockWeapons` defaults
to true and can explicitly permit firing during a transaction. Reload clocks
continue even while weapons are disabled. `automatic` may be `idle` (no orders
or route) or `move` (a pending non-attack order), with one action per trigger.
`orders` defaults to `clear`; `retain` preserves the pending order across the
form change. These policies run inside the optional module. At completion,
footprint, technology, money, cargo and every living member's destination are
validated again. Failure leaves the old definition and bank intact. Metal is
charged only at successful completion. `health` is `fraction` or `absolute`;
`cargo` is `empty` or `retain` (bounded by destination capacity). HP, identity,
XP rank, shared stocks, component/crew condition, ammunition and reload clocks
are preserved. Weapon IDs must match across forms, as must attachment member
IDs/definitions, identical mount layouts, and the complete components,
logistics and sensors configurations (including weapon guidance). Both forms
must declare articulation, even if one has no mounts or members. Building
occupancy is removed/added only within the successful transaction. Production,
HQ/income, aircraft, warhead and changed interceptor-magazine forms are rejected.

## Acceptance fixtures and source boundaries

`fixtures/signal-articulation-lab.steel-tide-mod` is unrelated authored content:
actual emitter switching, passive acquisition, seeker loss/reacquisition,
channel-specific decoys, remote movement/attack, two independently firing
mounts and a tow pair. It intentionally uses ordinary code-drawn art so the
mechanics can be inspected without external image files.

`fixtures/hj8-deployment-study.steel-tide-mod` is a narrow source witness, not a
released HJ-8 port. Source:
`rusted-warfare-mods/usgr-re/阵营单位/2.中华人民共和国/1.步兵/PLA/HJ8架设小队.ini`.
It exercises the source's two-second deploy/pack operations and separately
damageable rifleman which dies with its parent and redirects selection to the
parent. Both forms remain mobile-unit entities: the original uses tags and
changed stats, not a building conversion. Source x=12,y=-6 maps to art x=12,y=6;
art scale and fallback rendering are explicitly fixture values. The deployed-only form deliberately has no producer (the validator reports
that warning); only deployment enters that form. It omits the missile entirely. Automatic idle deployment, waypoint-triggered packing,
transport-triggered packing, energy warmup/reload, refill-provider logic,
source-specific infantry damage and source art switching are not claimed by
this fixture.

The actual `mods/usgr-re` pack separately binds MIG29's reviewed `RADAR_AIR`
controller and eight fixed-wing aircraft's constant radar signatures. Its
source range3000, forward35-degree cone, parent-relative origin, signature
threshold1,100-candidate scan and eight-frame effective sample period are
compiled by `mods/usgr-re/sensors_port.py`. The actual-manifest acceptance case
is `mods/usgr-re/sensors-game.test.ts`; the source audit and explicit omissions
are in `mods/usgr-re/SENSORS-SOURCE-AUDIT.md`. Contacts do not turn the independent
R73 infrared missile into a radar-guided weapon. Dynamic helicopter signatures,
radar target-order forwarding and the source radar-screen artwork are omitted.

The generic v1 seekers do not reproduce UCGR's R-77 altitude/datalink error
accumulation, mutable signature resource pools, detailed ECM contests, energy decay,
search for replacement targets, or source HUD helper entities. No simulated
substitute is enabled in the production UCGR pack. The source's radar helpers
can report a signal without revealing a full unit; `reveal: "contact"` supports
that visibility boundary. Constant channel signatures and measured strength
are supported; arbitrary resource expressions and detection formulas are not.
HJ-8's source automatic behavior is likewise still omitted. These are explicit
remaining port tasks, rather than engine branches for particular unit names.


## Actual HJ-8 acceptance case

The existing UCGR pack binds its original launcher to both mobile and deployed
forms. The carrying form disables the launcher with `disabledWeapons`; idle
starts the original two-second deployment, and a movement order starts the
two-second pack-up while remaining queued. Packing permits firing until the
form changes, as the source deployment tag remains active during that action.
The original PLAINF rifleman is a real member at the source art-scaled offset
and35° idle bearing, with independent aiming, damage and parent-death handling.
Its entity ID and any casualty survive form changes and saves. Coupled transport
is still rejected; the source entered-transport action is explicitly omitted.
`mods/usgr-re/game.test.ts` checks this real pair of forms, and the engine's
separate articulation fixture checks the same data policies without UCGR IDs.

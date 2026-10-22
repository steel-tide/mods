# UCGR signals, flight controls and source-owned ordnance

The pack supplies the implementation in `extensions/combined-arms-v1/src/`.
`sensors_port.py` verifies the actual source clauses before enabling a policy;
changes to unreviewed clauses are reported and are not translated into a generic
homing approximation. Host API 2 owns no UCGR-specific behavior.

## Radar contacts

All matching `RADAR_AIR` attachments use their original search section: 1200,
1800, 2400, 3000, 4800, 6000, 8000 or 10000 source pixels. The helper scans up to
100 signature-bearing enemies before applying its 35-degree body cone. The
attachment origin is `(100,0)`, converted to 40 world pixels laterally. A source
`无雷达` tag suppresses the receiver. Four-frame checks with the 0.1-second source
cooldown yield an eight-frame scan interval. Contacts retain only the last
sampled positions, do not reveal entities, and stay private to the owning player.

Fixed-wing `borrowResourcesWhileAlive:RADAR=-2` profiles remain passive
signatures, rather than invented radar emissions. Dynamic helicopter signatures
remain omitted until their landing/unloading state is ported. Countermeasure and
helicopter payload classification can still be present on those definitions;
neither classification creates an always-airborne radio signature.

## Infrared helper lifecycle

The `红外弹模板.key` family now uses API 2's complete `projectileStep` ownership.
The original missiles are moving helper units, not ordinary native homing
projectiles. `sourceOrdnance.ts` therefore owns their launch leg, velocity,
turning, seeker state, fuse and expiry, then calls the composed `resolveImpact`
pipeline for damage. It never detonates solely at a stale target point.

Each matching attached missile retains its own source parameters. For R73:

- The body launch arc is 60 degrees; the seeker cone is 120 degrees.
- The initial forward leg is 25 source pixels and lasts at most 0.25 seconds.
- Source speed 9.5 is 228 world pixels per second at 60 source ticks and 0.4
  world pixels per source pixel. Maximum speed inherits one quarter of the
  launching aircraft's maximum speed. Linear and angular acceleration are
  independently retained.
- Target-velocity lead is sampled every eight source frames. Field-of-view loss
  starts after two seconds and is permanent; it has no radar/ECM requirement.
- The source lifetime action literally uses five seconds. Its `fuel_time:3`
  global is unused by that action and does not replace it.
- Resistance starts at 180. The proximity fuse is 30 source pixels; its blast
  is 125 source pixels. The template's twofold helicopter damage modifier and
  exclusion of UAVs from helper proximity targets are preserved.

The source `干扰物` helper supplies finite automatic rounds. Ready rounds refill
in 0.5 seconds. A round travels at source speed 8, lasts 30 ticks and applies
`energy=-60` within 200 source pixels. It does not use a random lock-breaking
probability. Each source aircraft supplies its literal initial `热诱` count.
Pulse interception applies to the imported infrared and radio-guided helper families.

Flight solutions, resistance, dispenser stock and traveling pulses serialize
with the match. Enemy frames omit flight solutions and dispenser stock. The
host retains native projectile identity and the pack owns its private state.

## Radio-guided helper families

The `主动弹模板.key` family (including R77/R37 and PL12) uses the same source-owned
lifecycle, with its distinct source scripts. Locking takes 0.1 seconds and adds
half the launching aircraft's maximum speed. Its initial maximum-speed drop,
0.15-per-check ramp before three seconds, 0.025-per-check decay afterwards and
75% base-speed floor remain pack data. Checks follow the source eight-frame
cadence. Its seeker generates velocity lead with the source ECM lateral and
longitudinal offsets, low-altitude penalty and enemy electronic-warfare bonus.
Field-of-view loss counts checks instead of using the infrared one-shot loss.
The launching aircraft's sampled contacts can restore a lost target inside the
seeker cone; high/low source-altitude tags select the original data-link divisor.
Finite move-waypoint lifetimes prevent a stale aim point from turning the
missile back after its source order has expired.

`半主动防空导弹模板.key` has separate behavior, witnessed by HAWK's MIM23B. It uses
its source 0.5-second launch leg and acceleration, target-velocity ECM lead,
direct helicopter aiming, and the limited source attempts to reacquire the
launcher's current attack target after its previous target dies. No invented
radar-illumination requirement is attached where the actual source contains none.

## Fixed-wing controls and ground radar switches

Matching fixed-wing templates now retain player altitude actions (0.1-second
queue, five-second shared cooldown), 15-second additive afterburner with a
20-second cooldown, and reversible speed brakes with the source turn-rate
increment. The initial high/low action runs immediately on creation. Height is
100/200 source pixels with the original ±20 variation, converted into world
pixels; it is separate from the native landing fraction. A10's source override
uses fixed heights and changes only its unrestricted global-range weapons by
400 source pixels. Crossing the source 75/50/25-percent damage flags while
moving permanently subtracts five percent of original speed at each flag.
Repair does not reset these flags.

The pack publishes only current visible height. Timers, queued altitude actions,
brake state and damage flags remain private in filtered frames. The renderer
uses the same height for the living aircraft pose and native shadow. Source
falling-wreck physics remain separate.

The seven reviewed ground-radar profiles retain their half-second player
switch queue, ten-second shared cooldown, initial active emission and source
on/off engagement ranges. HQ17 shuts down its entire envelope; radar autocannons
and Roland retain the source's shorter optical envelope. The five autocannons'
literal current-target ground/air mode transitions retain their range threshold
and retreat hysteresis. Those locked info-only actions use `autoTrigger`, so
their effects execute directly and ignore the player-only `buildSpeed` field.
Visible radar state is public; queued power changes and cooldowns remain private.
The exported match-local `sensorRadarActive` and `sensorAltitude` readers let
source target-tag policies use the real state. Ground-radar contact forwarding,
warning art and split battery controllers are not implied by a power switch.

## Deliberate remaining omissions

Anti-radiation/SEAD is not a plain missile variant. Its actual chain is an
attached targeting controller, carried targetable missile entities, the primary
impact and a separate `tem/tam.key` helper payload. Its priority actions,
interception, emitter-off lock loss and both damage events must be represented
together before enabling it. It remains omitted from this work.

The radio families receive live altitude classifications and source initial ECM.
Uncopied loadout actions and electronic-warfare pod attachments do not
materialize from those labels. Their warning display artwork remains separate.
DynamicLoS and source smoke/forest/firing-reveal state, remote FPV/FOB dispatch,
aircraft service and mission controllers, and unconverted squad/transport forms
remain separate pack work. The finite pulse's optional in-flight retarget search
and original flare animation remain omitted. No feature here claims complete
source parity for those systems.

## Verification

Run from the mod repository:

```sh
python3 -B -m unittest discover -s mods/ucgr -p test_sensors_port.py -v
bun test mods/ucgr/extensions/combined-arms-v1/test/source-ordnance.test.ts
bun test mods/ucgr/extensions/combined-arms-v1/test/flight-controls.test.ts
bun test mods/ucgr/extensions/combined-arms-v1/test/radar-controls.test.ts
bun test mods/ucgr/extensions/combined-arms-v1/test/content-sensors-articulation.test.ts
```

The tests cover actual-source parameters and rejected drift, radar scan ranges,
launch arcs, acceleration/inheritance, delayed permanent loss, non-damaging
expiry, proximity impact once, saved continuation, finite area-energy pulses,
private state and atomic assembly transport. They are deterministic engine
acceptance tests, not a claim of side-by-side RW rendering equivalence.

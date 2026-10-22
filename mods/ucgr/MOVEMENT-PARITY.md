# Source movement evidence and binding boundary

The reviewed engine reference is the public RW 1.15 decompile at
[coolomet/RustedWarfare, revision 52758091b7888bbe4797789d59952f34653ac960](https://github.com/coolomet/RustedWarfare/tree/52758091b7888bbe4797789d59952f34653ac960).
Its README identifies the game version and reports replay desynchronization in the
recompiled jar. This port uses the inspected algorithms as evidence; it does not
claim bit-identical replays against that jar or an unknown RW release.

- `custom/class_436.java:2456–2517` reads the authored speed, acceleration,
  deceleration, reverse share, Y scaling, turn rate/acceleration and sliding flags.
  `custom/class_113.java:2342–2379,2607–2621` returns those values to movement.
- `OrderableUnit.java:1193–1270` applies body angular acceleration. Its braking
  comparison is `abs(error) < abs(angularVelocity)/turnAcceleration`; it is not the
  usual square-root stopping-distance formula.
- `OrderableUnit.java:677–742` implements sliding: desired velocity follows the
  independent movement heading when ignore-body is true, acceleration/deceleration
  is multiplied by1.41, velocity damps only when squared desired-velocity error
  exceeds squared speed, and position integrates the resulting velocity.
- `OrderableUnit.java:3072–3271` chooses throttle and reverse using path length,
  formation state, terminal-waypoint status and distance. Non-sliding acceleration
  changes a signed throttle, rather than physical velocity directly.
- `gameFramework/class_340.java:199,302,1058–1095,1302–1330` supplies float approach,
  wrapped angle difference, the1025-entry atan table and8192-entry midpoint sine
  and cosine tables. The package implements float32 state and these angle tables.

`movement_port.py` currently binds the direct AIR/sliding/ignore-body family only
when collisions and formations are explicitly disabled. The three FPV drone
forms meet that contract. `stepSourceMovement` receives the source controller's
waypoint and owns velocity/body turn; the controller owns waypoint selection,
arrival, height and lifetime. Velocity and angular state survive saves and form
changes. Source attack drones retain zero deceleration and continue coasting.

Ordinary ground vehicle reverse and route arrival are not marked complete.
The available host wrapper surrounds the entire unit update; it does not expose a
movement-call hook or RW path/formation state. Replacing a completed native pose
would move already-fired projectiles away from their muzzle and would not reproduce
source arrival or reverse decisions. No such correction or guessed reverse coin
has been enabled. Ordinary units still use native order routing and locomotion
until their complete source movement/order policy is supplied.

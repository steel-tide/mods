# Original-source comparison — FG Rusted League 0.4.1

Compared against `rusted-warfare-mods/fg-rusted-league`: the packaged stock-unit
counterparts, custom GF plugin definitions, copyFrom chains, art, animations,
weapon/energy settings, actions, carrier phases and destruction assets.
`source-audit.json` records source mappings, hashes, section counts and entities
without a standalone definition. Hard-coded units use the existing extracted
`rw-core.json` data. Stock-art filtering compares against the correct local
`rusted-warfare-mods/rusted-warfare` path.

## Restored

- Five definitions: Sky Support Carrier, Flying Battle Carrier, its deployed
  form, the landed Floating Array, and the flying carrier's interceptor.
  The carriers enter production; deployment and Land/Fly actions work through
  native morph rules. The showcase includes the newly trainable hulls.
- Four through eight real interceptors on the Aircraft Carrier's five levels,
  with faster replenishment on the final level. Aircraft use the source's
  third, armed phase; a real-engine test checks that they inflict damage.
- 15 source energy pools, consumed per emitted projectile and recharged at
  source rates. Firing and burst continuations stop while energy is unavailable;
  saves retain charge and recharge state, and enemy views hide this state.
  The ASW plane returns when empty and refills on its carrier deck.
- Original negative hull regeneration for Kirov and Teleporter.
- Mirage movement no longer reveals its disguise. Firing reveals it, and the
  tank returns to its tree form after the source delay.
- Source idle/movement/attack frame ranges and rates. Aircraft play these
  frames through the existing renderer. Building back/front composition retains
  all frames, including League Command and the T3 Factory.
- 46 source wreck assets. Ground hulls, landed crashes and building ruins use
  authored wreck art where supplied, with native unit scale and fading. Ships
  still use the native sinking sequence.

## Existing adaptations retained

The port retains its Steel Tide numeric calibration, original hero rank tree,
shields, beam weapons, production units, deployed weapons and native carriers.
The flying carrier's scripted disposable phases are represented by native
sorties, recovery and replenishment; they are not exact Rusted Warfare lifetime
simulation. Helicopters retain native rotors. Native weapon sounds stand in for
Rusted Warfare's built-in sound IDs; the examined GF INIs do not reference
separate authored firing recordings to import.

## Remaining differences

This is not complete emulation of the original scripts. Paid ammunition and
money actions, Lord of the Sky's scripted superweapon entities, heterogeneous
independent gun mounts, Hero Tower's targeted healing, helper-unit destruction
spawns, animated limbs/arms, custom particles and some projectile chains still
differ. Source waterborne wreck animation is not restored. Source transition
and projectile helpers listed in the audit are not separate trainable units.

The bug faction and unchanged Corroding Games artwork remain excluded under
the existing port's art policy. Carrier Airship still borrows the League Kirov
hull. The source's bug-report copies and base-game duplicates are inventoried
without being presented as additional playable units. A source mapping means
the entity is represented, not that every script section has exact parity.

## Verification

Rebuild with the README commands, run `node tools/check.mjs
mods/fg-rusted-league` and pack with `node tools/pack.mjs
mods/fg-rusted-league`. With the sibling game checkout present, the shared
integration scenario lives in the Adolence mod: `bun test
mods/adolence/source.test.ts`. It covers simultaneous activation, faction
starts, recharge, carrier launch/damage and saves. Browser checks exercise
both packed mods, aircraft frames and actual wreck pixels. No game source was
modified. The validator's “nothing can build it” warning for the landed
Floating Array is intentional: it is reached through Land/Fly, not a builder.

## Combat canvas fix

Destroyed map props use decal IDs such as `ruin.d.bunker`, which are not unit
definitions. The source wreck hook now checks the definition table before
looking for mod-owned wreck art and delegates prop debris to the native
renderer. Its canvas save/restore is also protected by `try/finally`. This fixes
the frame interruption and accumulated canvas transforms during showcase
combat. Both mod copies carry extension package 1.0.1.

Regression checks: `node --test mods/fg-rusted-league/presentation.test.mjs`.
With a game dev server running, `node mods/fg-rusted-league/verify-combat.mjs
http://127.0.0.1:5173 --both` installs fresh packed copies in a temporary browser
profile and runs three simulated minutes of showcase combat plus prop
destruction. It writes its screenshot and report to the OS temporary folder.

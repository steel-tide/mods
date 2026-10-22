# Original-source comparison — Adolence 1.4.1

Compared against the local Q3.6.0 source in `rusted-warfare-mods/adolence`,
including inherited `.ini`, `.template` and `.key` definitions, images, audio,
unit actions, production lists and all 15 TMX maps. `source-audit.json` records
input hashes, source-to-definition mappings, section counts and definitions
without a standalone counterpart. A source entity is not necessarily a unit:
turrets, attached crew, icons, wrecks, signals and disabled forms also use INIs.

## Restored

- 45 additional definitions: 22 infantry variants, 14 cars and utility vehicles,
  six aircraft, two support buildings, and M1A2 SEPv2. Production menus and the
  City of Sin showcase include them; existing faction builders still work.
- 52 source energy magazines, of which 47 have manual reload actions. Actual
  projectiles consume energy; acquisition and burst continuation stop when
  empty. Source recharge rates and reload durations replace averaged delays.
  Charge, recharge state and reload timers persist through saves. Private
  magazine state is omitted from enemy views.
- Original selection clips and rifle reload audio, using the installed bytes
  and scoped audio mixer. These clips are not cut to the short firing-sound
  duration. Added weapon variants bring their source firing recordings.
- Mortar, walker and drone animation ranges and rates. A mod presentation hook
  makes aircraft frame sequences advance through the native renderer.
- Five original wreck images, retaining their authored pixels and unit scale.
- Armed Recon Drone → Attack Drone conversion; Guard Post squad calls with
  their source unit counts, build times and garage prerequisite; Guard Post
  and Fuel Depot income folded into the port's metal economy.
- Regeneration retains the reviewed Abrams/Stryker turret composites and their
  measured muzzle/recoil geometry. SEPv2 has its own turret and measured guns.

## Existing adaptations retained

Health, prices, damage caps, movement and ranges remain calibrated to Steel
Tide. Credits, diesel and supply are folded into metal. Source infantry
resurrection, nest spawning, crews, repair, night lights and barrel recoil use
the existing port's implementations. Seven original maps and the showcase
ship in the manifest; eight other original-map conversions remain separately
importable. The two survival maps remain skirmish adaptations, with the map
limits documented in `MAPS.md`.

## Remaining differences

This release does **not** reproduce the full original campaign or script VM.
Separate currencies, research/difficulty branches, signal-smoke supply drops,
source autonomous infantry orders, armour/penetration expressions, selectable
tank ammunition and individually simulated attached crew/turret entities still
differ. Scripted decal expressions, breathing/limb animations, custom particle
sequences and multi-stage aircraft crashes are not fully reproduced. Native
lighting, rotors, damage effects and flight physics remain in use.

The Abrams/Stryker gear buttons are locked or hidden in the original release;
they are recorded as disabled, not enabled as invented playable upgrades.
Developer targets, easter-egg units, map props, icon helpers and disabled forms
are not automatically made trainable. See the unrepresented inventory for
specific source names; its generic classifications are not a claim that every
helper's effects are implemented. Representation of a unit does not imply
complete parity for all its script sections.

## Verification

Run the README rebuild commands and `node tools/pack.mjs mods/adolence`.
With the sibling `steel-tide-game` checkout present, run
`bun test mods/adolence/source.test.ts` for both mods' real-engine integration
checks. Tests cover faction starts and builder production, actual magazine
consumption, reload ownership and save determinism, state privacy, drone
conversion, squad calls and FG carrier damage. Browser verification installs
both packed files together, advances aircraft frames, draws a source wreck,
decodes every extension audio asset and checks for page errors. No game source
changes are required.

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

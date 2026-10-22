# Compatibility and fidelity record

No Steel Tide game code was changed for this port. All added simulation and
presentation belongs to the embedded `naval-warfare.systems` package. This
record separates unavailable native behavior from work that can still be
implemented within an extension. Passing the current tests does not mean
complete Rusted Warfare parity.

## Actual engine / additive-content limits

| Source feature | Finding | Port disposition |
| --- | --- | --- |
| `Total war.tmx` | 1000×1090 tiles; exceeds the game's 512×512 map bound for a tile-for-tile conversion. | Omitted. |
| `Kraress coast sea.tmx` | 1200×1300 tiles; exceeds the same bound. | Omitted. |
| `Map01.tmx` in `The last conflict.tmx.rwmod` | 1500×1590 tiles; exceeds the same bound. | Omitted. |
| Replace vanilla `commandCenter` with `OT_factionSelector` | Ordinary mods are additive and cannot override vanilla definitions. | Five native setup factions replace this integration point. |
| Ordinary definition weapon/card limit | Eight native weapons per definition; source ships can have many more. | Package owns all gun clocks, targeting and firing; native HUD lists eight. No gun is dropped solely for that limit. |
| Native vision bound | Several source AWACS request 400–500 RW tiles of sight. | Native vision capped at 64 Steel Tide tiles. A larger authored sensor/vision policy would be further package work. |
| Sheet dimensions and whole-tile building footprints | Source uses very small art and fractional physical dimensions. | Preserve source pixels; enlarge compact buildings with matching native footprints and attached-part geometry (see README). Record each building scale factor and four-pixel minimum adjustment. |

The map-size limits and adds-only rule are confirmed limits. Original
currencies, particle systems, scripted flight and other items below are **not
claimed to require game edits**: existing extension hooks could support more
of them with additional source-specific implementation. No approval to edit
the game is assumed or requested.
Resampling the source maps onto a smaller grid could be separate mod-only
work, with changed tile detail and terrain placement; it is not a faithful
one-for-one import and was not silently substituted here.

## Explicit adaptations and remaining package work

- **Economy:** credits/oil/steel collapse into one metal balance at the source
  HQ's purchase exchange rates. Independent resource stocks, upkeep, AI
  resource subsidies and original selling/buying scarcity are not ported.
  Paid module actions debit the entire price when queued; ordinary native
  build/production retains native payment rules.
- **Construction:** all five original Excavators and cranes are retained,
  including their `.Ini` files, original pictures, source build lists and
  nano ranges. Excavators use native construction. Cranes use package-owned
  sites and timed work behind the ordinary placement/territory/slot checks;
  select the construction action and click the work location. Source salvage
  and reclaim commands are not compiled. Native HQ reconstruction adds one
  build edge to each original Excavator, as required by the faction contract.
  Crane repair uses a single-target native repair aura; exact RW repair
  beam scheduling is not reproduced.
- **Targeting and movement:** the package preserves its compiled weapons'
  target domains, tag restrictions, arcs, warmup and turn speed. Native
  movement, collision, terrain fire policy, formation behavior, AI planning,
  visibility and ordinary veterancy remain. RW acceleration/deceleration,
  turn acceleration, sliding, reverse-speed fractions, exact target lead,
  retarget-search scripts, seeker wobble and ballistic height curves are
  not reproduced. This is not an exact projectile-trajectory simulation.
  Units with underwater weapons receive native sonar to make their original
  submarine-hunting roles usable in Steel Tide's visibility rules.
- **Combat:** direct and area payloads resolve separately with source armor,
  penetration, building multipliers, tag mutators and shield multipliers.
  Converted gameplay stats are rounded to two decimal places, consistently
  across native weapon cards and their package firing settings; this makes
  small changes to converted distances, prices and timings.
  Source damage against vanilla units has no RW-equivalent balance. Native
  weapons retain their native damage behavior. Arbitrary RW expressions are
  never executed; the supplied `if self.flying` predicates are compiled.
  Tagged interception retains declared projectile tags but does not claim
  every RW deflection/laser-defense special case.
- **Production and AI:** explicit `canBuild` lists use native production;
  scripted batches use package actions with their actual source prices and
  quantities. Source multi-queue flags and cancel restrictions are retained
  for these actions. Native AI is supplemented with package recruitment and
  carrier launches. RW's complete scripted AI priorities, auto-waypoints and
  automatic aircraft mission/recovery logic are not replicated.
- **Carriers/attachments:** aircraft ownership and cargo links survive saves,
  launch and one-at-a-time recovery. Visible deck sprites use original
  attachment offsets. Embarked planes remain native cargo: original
  individually targetable deck aircraft, all attachment selection rules,
  nested amphibious cargo exceptions and source ejection/survival-on-parent-
  death scripts are not reproduced. Native carrier death kills its cargo.
- **Nuclear systems:** immediate source projectile/death blast damage and
  heat/cooling states are retained. Radiation propagation, contaminated
  terrain, the most damaged reactor's three-million-credit death penalty,
  source warning broadcasts and exact mushroom-cloud particle stacks are
  not compiled. Reactor variants share a conservative 4×3 footprint to make
  heat/cooling transitions consistent; the source changes its footprint
  between states.
- **Appearance/audio:** original body/turret/rotor/projectile/wreck pixels,
  barrel offsets and recorded firing sounds survive. Source procedural
  walking legs, every animation curve, under/over-body attachment layering,
  transient scorch details, full smoke/wake/explosion emitters, per-recording
  source gain/pitch, hit/engine loops and scripted announcements do not.
  Native lighting, shadows, terrain and fallback effects remain. The 13
  battle tracks repeat in a deterministic file order rather than RW shuffle.
  The native battle queue follows pack activation rather than RW's per-unit
  soundtrack trigger.
- **Descriptions:** full source prose survives in English, including source
  mistakes. Long Chinese/Korean history paragraphs are concise translations,
  not verbatim mirrors of every citation marker. Original source action
  descriptions and other untranslated non-displayed script text remain in
  `source-inventory.json`; the generic content-action UI exposes translated
  labels rather than all of RW's tooltips and stockpile widgets.

## Source defects and omitted extras

- The supplied pack contains no author or redistribution license statement.
  Local implementation/testing does not resolve publication rights.
- Several source ships have duplicated section names. RW INI sections are
  merged in file order, so the final duplicate key wins. For example, Ford's
  repeated `action_build3` ultimately produces helicopters. The port uses
  that final source definition rather than inventing an extra fighter action.
- Admiral Kuznetsov asks for six MiG-29Ks plus four Su-33s in an eight-slot
  hold. Initial cargo is limited to the first eight in source order: six
  MiG-29Ks and two Su-33s. Batch purchases must fit the remaining capacity.
- Carrier `energyStartingPercentage` values above 1 are bounded to a valid
  full charge. Missing local ammunition is not invented; a source gun using
  an empty stock waits for its authored reload action/provider.
- Some extra units name legacy RW factories absent from the retained
  national lists. They remain editor/console extras rather than gaining an
  invented producer. The report marks their availability explicitly.
- Fifteen source definitions are omitted: the original HQ selector, alien
  mothership and helper/enemy definitions, cinematic tripod forms/helpers,
  two sandbox crash cheats, smoke/radiation helpers and an unused nuclear
  aircraft helper. Exact paths and reasons are recorded individually in
  `conversion-report.json`. Conventional ships stored under `Zcheat` remain
  where referenced by the actual national build lists; that folder's name
  alone is not an exclusion criterion.

## Verification scope

`simulation.test.ts` exercises the actual prepared package through the game
host, not a separate mock simulation. `test_port.py` checks source mappings
and art identity. `pack.test.mjs` checks offline bytes and package integrity.
The browser test installs the real folder, checks every asset and definition,
renders independent turrets and visible deck cargo, launches aircraft, and
reads English/Chinese/Korean strings from the actual HUD table.

Network confidentiality has a focused snapshot test: visible enemy turret
poses are sent without ammunition, targets or action queues. Full remote
multiplayer, replay seeking and long-match AI balance have not been separately
accepted in this pass; the existing host codecs carry the package state.

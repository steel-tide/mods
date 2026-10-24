# GW BattleUniverse: port docs

The working record of this port: where it stands, how to carry it on, and how
it differs from the source. A session picking the port up starts here. When
the port changes, update **Progress**, **What is ported**, **Adaptations**
and **Verification** in the same change, and bump the version in `port.py`.

Everything GW-specific lives in the pack: definitions, art, sounds, music,
voices and maps, and the `gw.battle` package. The game carries six general
changes made for it with the user's approval, each open to any pack:

| Game change | What GW uses it for |
| --- | --- |
| A pack's own research nodes (`tech`), researched at one of its buildings, read by `requires` | GW's tech trees, researched at each faction's HQ |
| A module action that names a `target` is aimed by a map click, as a warhead launch is | Aimed skills: the Zaku II C's warhead, mortars, mines, drones |
| `transportDomain` (`ground` / `air`) as a content field | Hangars that carry aircraft |
| Large capacity holds 16 maps and 64 music tracks | 14 maps and 50 tracks |
| A ground hold takes amphibious passengers | Mobile suits are amphibious: they board hangars and ride sub-flight systems |
| A computer side raises the yard of a kind it can build from now before a cheaper one waiting on research | ZAFT's and others' lines open with what their base tech sells |

## Progress

Every faction the source fields on a ground map is ported, with its base
tech and its whole tech tree. The mod is unlisted (`hideFromListing`). The
counts leave out what the game cannot host (see **Not supported**):

| Faction | Era | Plans | Units sold | Unit defs | Buildings | ACE pilots |
| --- | --- | --- | --- | --- | --- | --- |
| EFSF[0079] | UC0079 | base + 17 | 100 | 221 | 20 | 16 |
| ZEON[0079] | UC0079 | base + 18 | 103 | 208 | 20 | 18 |
| AEUG[0087] | UC0087 | base + 16 | 64 | 140 | 15 | — |
| TITANS[0087] | UC0087 | base + 13 | 58 | 121 | 15 | — |
| NEO ZEON[0087] | UC0087 | base + 10 | 45 | 84 | 15 | — |
| OMNI[CE71] | C.E.71 | base + 5 | 22 | 40 | 15 | — |
| ZAFT[CE71] | C.E.71 | base + 6 | 26 | 43 | 15 | — |

**Units sold** counts source units a factory sells on a ground map; **unit
defs** adds each one's loadouts, forms (flight, submerged, systems running)
and package-made units (pilots, drones). The source lists ACE pilots for
UC0079 only; its 0087 and C.E.71 beacons call nobody and are left out.

In all: 865 defs, 820 sheets, 40 firing sounds, 85 research nodes, 14 maps,
50 music tracks and 14 voice recordings. `mod.json` holds 2.7 M characters of
the 4 MiB metadata budget; the packed file is 80 MB, 51 MB of it music.

### Systems

| System | Status |
| --- | --- |
| GW damage formula, hit and graze, back hits, an unseen target hit half as hard | ported (`gw.battle`) |
| EN: per burst, per round, on the move; refill at supply points | ported |
| Supply points: EN and out-of-battle repair | ported |
| Upkeep, MP and income; a computer side's income by its `AIHard` bracket | ported |
| MoralPoint: each side's 1000, paid by the orders that ask it | ported |
| Tech trees: plans at the HQ, TechPoint from HQs and Institutes | ported, every plan |
| Loadout switching beside a supply point; conversions (`CustomUnit`) at a supply point once their plan is in | ported |
| Transformations (flight forms, MA modes), armour purge and the Core Fighter's exit | ported |
| Submarine dive and surface | ported |
| Transport hangars, ground and air; SFS riding with fire | ported |
| Pilots: skills, experience and levels, the Academy's training, officers on command ships, leadership auras | ported |
| ACE pilots and the beacon that calls them, their active skills, their return after a loss | ported |
| Pilotless units and pilots boarding them | ported, without capture (see **Adaptations**) |
| Parts breaking (head, arms, legs), DP and stagger | ported |
| Shields; I-Field, PS armour and anti-beam coating | ported |
| GW detection: detect and anti-detect ranges, a found unit held five seconds | ported |
| Skills: FullBoost and OverBoost, optical camouflage, PS armour switch, drones and funnels, mines, smoke, Minovsky and detection areas, EMP, strikes | ported |
| EXAM, HADES, ALICE: timed runs, their drain and the stun they end in | ported, without the berserk EXAM (see **Not supported**) |
| Mega Factory | ported for every faction that has one |
| Refinery T2, Institute T2, Academy T1/T2, beam and MS turrets | ported with the plans that open them |
| Era music, the HQ operator's lines, the voices factions are picked with | ported (`presentation`) |
| The source's ground maps | ported: 9 maps (see **What is ported**) |
| Firing, melee and guard poses; walking cycles | not ported: units show their rest and boost poses |
| Starting at T2 or T3 (`PassT1`, the host's tech start) | not supported (host options) |

## Carrying the port on

### The user's rules

- Keep the original behaviour, numbers, names, descriptions and art as far
  as possible; add every missing translation (Korean, in `localization.json`).
- **Flag** anything the game or its modding system cannot do. **Never change
  `steel-tide-game` without the user's approval**; when a feature needs the
  game, ask, then build it there with tests and docs. An approved change is
  general, never a case for GW alone.
- Work on `main`; never push; commit only when asked.
- Visual checks are the user's: no browser verification.

### Rebuilding, step by step

From the repository root, with Python 3 and Pillow, FFmpeg, Node 22+ and Bun,
and the sibling `steel-tide-game` checkout:

1. A new plan goes in through the tree itself: `tech_plans` in `port.py`
   reads each faction's TechList in its order, and a plan whose parent is not
   ported fails the port's assert. Buildings a plan opens are ported as the
   faction's buildings, with `requires` on the plan.
2. If `extensions/gw-battle/src` changed: `node mods/gw/extensions/gw-battle/build.mjs`
   (`port.py` runs it too, after writing `audio.json`, and embeds `extension.json`).
3. `python3 mods/gw/port.py` writes sheets, sounds, music, voices, `mod.json`
   and `conversion-report.json`; `--no-media` writes only the last two.
4. Translate every string the port reports without Korean (it lists them in
   `.missing-korean.json`, git-ignored) into `localization.json`: names by their
   English text, descriptions as `desc:<source name>`, in the style already
   there; rerun with `--no-media` until it reports none.
5. `python3 mods/gw/make-map.py` stands every def on the showcase maps,
   sizing each faction's block by its roster. A map holds 400 pieces: a
   faction that outgrows a shared map gets one of its own in `SHOWCASES`.
   `bun mods/gw/source-maps.ts` writes the source's maps.
6. Add tests to `game.test.ts`, then run `bun test ./mods/gw/game.test.ts`,
   `node tools/check.mjs mods/gw` and `node tools/pack.mjs mods/gw`.
7. Bump `version` in `port.py`, rerun it, and update this file and the README.

### Things the format and the source will catch you on

- Def and node ids are at most 40 characters: `node_id` abbreviates through
  `NODE_SHORT`, defs shared between factions take a `SHORT` code, and
  `fit_id` hashes what is still too long. The port asserts the length.
- Sheet keys are at most 40 characters after their prefix; a long round's
  key drops `projectile-`, and a key still too long is hashed.
- A text holds 400 characters a language. `fit` drops a longer description's
  closing quote, then its last lines with an ellipsis, and records it in the
  report's adaptations.
- A def holds eight weapons; the port keeps the first eight and records it.
- The metadata budget is 4 MiB. Supply points are one rule flag
  (`gw-supplied`, raised by the package) rather than a `near` list on every
  def, and `compact()` writes whole floats as integers; keep both.
- A loadout label the source writes in English shorthand (`180mmCannon`,
  `4XMSL`) needs an entry in `VARIANT` for its Korean.
- A hull or turret sheet turns smoothly only with its pivot centred:
  `art.render_frames(..., centre=True)` pads the art, and `Media.sheet`
  asserts it. Otherwise the game bakes 24 headings that step 15°.
- A decal with `total_frames` and `frame:memory.boostFrame` is a flame strip
  the source steps every 8 ticks: `frames_for` renders its frames into the
  sheet's `anims` at 7.5 fps.
- Upkeep, power and TechPoint are in `Building_GetDone`'s
  `temporarilyAddTags`, not the building's own stats: read them through
  `building_tags`.
- A factory that sells any aircraft reads to the game as an airfield. An
  aircraft a land factory sells goes to the airport, or to the Mega Factory
  when the faction has none.
- One Zeon plan's file is `Tech_ZEON_0079_GroundTypeMSDevelopmentPlan.ini.ini`
  in the source; `tech_plan` finds it.
- The source (`rusted-warfare-mods/gw`) is git-ignored and read as data.
- On Linux, the game's corpus battle drifts at tick 600 (libm); its earlier
  ticks hold.

## What is ported

Each faction's `BaseTech` and every plan of its tree, as a ground match
(TileMode 0) offers them: its HQ, Engineer Team, factories (land, airport,
aqua, Mega), refinery, supply depot, institute, academy, ACE beacon (UC0079),
turrets and walls, and every unit those sell. [conversion-report.json](conversion-report.json)
gives every definition's and plan's source file, the plans' prices, the
weapons each unit leaves out, what the port leaves out and why, and each
adaptation by name.

In each of them:

- Original names and descriptions in English and Chinese, source wording and
  source mistakes included; Korean added for every string. Where a source
  English description was copied from another unit, the Korean follows the
  Chinese.
- Original art: mobile suits composed from their part pictures in the
  source's rest pose, with the boost pose and flame as their moving frames;
  aircraft with their engine flames at the source's pace; tanks and turret
  buildings with turning turrets; squads with their soldiers; ships with
  their deck guns; original rounds for every gun.
- Original firing recordings, music and voices.
- HP, prices, build times, speeds, turning, sight, ranges, bursts, cooldowns,
  minimum and melee ranges, blast radii, projectile speeds and spreads, EN,
  defences, parts, shields and fields, detect ranges, pilots' skills.
- Each plan's name, description, Money and Resource, seconds and TechPoint,
  and what it unlocks. TechPoint as `Gen_TechPoint` makes it: 7.5 a second
  for each headquarters, 0.75 for each T1 Institute, a computer side's at
  0.75 of that and its bracket's multiplier, from nothing at the start.

### Maps

Five showcase maps, new rather than the source's: every definition a faction
fields stands on one of them before the whistle, out of reach of the other
side's guns. The 0079 factions and the AEUG have one each; the Titans share
theirs with Neo Zeon, OMNI with ZAFT. `make-map.py` draws them from
`mod.json` and checks coverage, ownership, terrain, sea room and overlaps.

Nine of the source's ground maps, read by the game's own Rusted Warfare
importer (`source-maps.ts`) and resampled to this port's scale: At Jaburo's
Fall [2v2] and [3v3], Cucuruz Doan's Island, Dense Forest Region,
Mountainous Region, New City, Rise From The Ashes, Southeast Asia and Tremor
Mountain. Their names are the source's, with Chinese and Korean. The space
and ground-and-space maps, and the `_02` copies that differ only in props,
are left out.

## Adaptations

| Source | Here | Why |
| --- | --- | --- |
| The HQ builds anywhere on the map (`isBuilder`, nano range 10000); four HQ slots take the support buildings | An **Engineer Team** per faction, drawn from its own soldiers, builds everything and rebuilds the HQ | A native faction needs a builder unit |
| Squad orders of three (one price, one timer) | Three single units at a third of the price and time | Native production is per unit |
| Money and Resource | One metal, 1:1 | One native currency |
| MP and MP max; income halves over the cap | Population and power (HQ 60, depot +9); a power shortfall slows production instead | Native economy |
| A computer side's `AIHard` handicap, set in the host menu | Read from the seat's difficulty: Relaxed and Standard are the source's normal computer, Seasoned and Veteran its next two brackets | No setup options for a mod |
| TechPoint and MoralPoint on the HUD beside Money and Resource | On the HQ's and Institute's cards | The HUD shows one resource |
| A plan's TechPoint is spent when it starts; its button locked until it is there | Queued on the HQ's card, taken when it reaches the head of the queue; back whole if taken off unfinished, lost with the HQ | The game's lab card and queue |
| The Academy and ACE beacon train and call through production lines | Their own queues on the card | Every native production building takes a production slot |
| Capturing a unit whose pilot is lost | A pilotless unit stays inert with its side until a pilot boards it, and destroys itself after 180 s | Capture was declined as a game change |
| A hull with both air and ground hangars | Its larger hold, of one kind; the other is recorded in the report | A hold carries one kind |
| Aircraft a faction's land factory lists, with no airport | Sold by its Mega Factory | The game reads a yard that sells any aircraft as an airfield |
| FanFan sold by the EFSF land factory and airport | Airport only | As above |
| Buildings at their units' scale | 1.5× | Footprints are whole tiles; GW's buildings are barely larger than a mobile suit |
| Hangars that take only infantry (Type 74, APC, Samson truck) | Take any passenger of their kind | A native hold has a weight limit, not a passenger filter |
| An SFS's rider slots | Hold of slots × 2, one passenger of weight 2 at most | A hold counts weight |
| Conversions to a unit the faction's tree never unlocks | Left out | Nothing could build the result |
| Era music played exclusively while the era's units are in play | The era's queue during a match where the player's faction is of that era | Music follows the player's own seat |
| English descriptions past 400 characters | The closing quote is dropped, then the last lines with an ellipsis | The format holds 400 characters a language |
| Albion and MRX-010's ninth weapon | Left out | A def holds eight weapons |
| The tech tree with the game's tech tree switched off in setup | The plans stay closed: only the base tech is built | A pack's nodes follow the game's switch |

## Not supported by the game or its modding system

These need a game change, or are outside what a mod may do. They are not
worked around in this port.

- **Space theatre (TileMode 1).** Steel Tide has no space terrain or space
  mode. Space and Space Mega factories, space turrets, the space-only units
  (Salamis, Columbus, Musai, Papua, the Balls…), re-entry and HLV launches
  between ground and space maps are left out, with the space maps.
- **Host options.** GW's in-match host menu (game mode, ground/space, tech
  start at T2 or T3 and `PassT1`, resource, MP and tech multipliers, bullet
  speed, ACE and PMC switches) has no place in match setup; a mod cannot add
  setup options.
- **A side hostile to everyone.** The berserk EXAM turns a unit on both
  sides; a unit always belongs to one side.
- **OverLine forms** (a system pushed past its limit) are left out with their
  conversions.
- **Capturing units.** Declined as a game change; see **Adaptations**.
- **Removing or replacing vanilla content.** GW deletes every vanilla unit and
  replaces the command centre; mods only add. Native factions give each seat
  GW's own HQ and roster instead.
- **Weather and time-of-day systems** chosen by GW's own markers; the match
  keeps Steel Tide's weather.

## Verification

`game.test.ts` (48 tests) runs the real pack in the engine: every faction's
start and builder loop, factory sales at source prices, plans researched at
the HQ and held for their TechPoint, the Institute's TechPoint and refunds in
a save, a computer side of each faction climbing its tree and fielding armed
units, the damage formula, EN, upkeep and the computer's income by
difficulty, MoralPoint, diving, loadout switching and conversions at supply
points, transformations, the warhead aimed by the player, pilots (made,
learning, trained at the Academy, boarding), the ACE beacon, parts, DP,
shields and fields, detection, FullBoost, aimed and instant skills, SFS
riders firing, leadership, smooth turning of every sheet, the showcase maps
standing every definition with no shot in the first 20 seconds, the source
maps loading, and saves of all of it. The art, the HUD and the sound are the
user's to look over in the game.

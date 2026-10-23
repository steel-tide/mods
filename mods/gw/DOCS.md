# GW BattleUniverse: port docs

The working record of this port: where it stands, how to carry it on, and how
it differs from the source. A session picking the port up starts here. When a
batch lands, update **Progress**, **What is ported**, **Adaptations** and
**Verification** in the same change, and bump the version in `port.py`.

Everything GW-specific lives in the pack: definitions, art and sounds, and the
`gw.battle` package. One game change was made for it, with the user's
approval: a definition pack may declare research nodes of its own (`tech`),
researched at one of its buildings and readable by `requires`. GW's tech tree
needed it, since the game's tree was fixed at its sixteen nodes.

## Progress

Ported: the UC0079 base tech of the Earth Federation and Zeon, Mega Factory
included, and the first two development plans of each tree. The mod is
unlisted (`hideFromListing`). The counts below leave out what the game
cannot host (see **Not supported**):

| Source | Plans | Ported | Units on a ground map | Ported |
| --- | --- | --- | --- | --- |
| EFSF, UC0079 | base + 17 | base + 2 | 100 | 35 |
| ZEON, UC0079 | base + 18 | base + 2 | 102 | 33 |
| AEUG / Titans / Neo Zeon, UC0087 | 16 / 13 / 10 | — | ~187, space ones included | — |
| ZAFT / OMNI, C.E.71 | 6 / 5 | — | ~62, space ones included | — |

A unit counts as one source unit; its loadouts are separate defs here (the
GM Early Type and its bazooka are two).

### The UC0079 trees

Tree order, each plan after the one it needs. **Units** are those a ground
match sells (land, air, aqua and Mega lists); **Mega** is how many of them
only the Mega Factory sells. A plan goes into `TECH_PLANS` in `port.py` as
`Tech_<side>_<id>`, after every plan it needs. **Next** marks the plans whose
parent is ported, the candidates for the next batch.

**EFSF_0079**

| Plan | Id | After | Units | Mega | Buildings it opens | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Base tech | `BaseTech` | — | 16 | 0 | factories, refinery, supply depot, institute, academy, ACE beacon, turrets, walls | ported, but for the Academy and Beacon |
| Anti MS Plan | `AntiMSPlan` | Base tech | 11 | 1 | — | ported |
| Early Type MS Development Plan | `EarlyTypeMSDevelopmentPlan` | Anti MS Plan | 8 | 1 | — | ported |
| Blue Destiny Project | `BlueDestinyProject` | Early Type MS | 3 | 1 | — | next |
| Operation V Data Recovery Project | `OperationVDataRecoveryProject` | Early Type MS | 9 | 1 | — | next |
| Pale Rider Project | `PaleRiderProject` | Blue Destiny | 4 | 0 | — | |
| GM Development Plan | `GMDevelopmentPlan` | Operation V | 3 | 0 | beam turret A, MS turret A | |
| Heavy Guncannon Plan | `HeavyGuncannonPlan` | Operation V | 5 | 0 | — | |
| G4 Plan | `T2_G4Plan` | Pale Rider | 3 | 0 | — | |
| GM Modularization Plan | `T2_GMModularizationPlan` | GM Development | 6 | 0 | Academy T2, Refinery T2 | |
| FSWS Plan | `T2_FSWSPlan` | Heavy Guncannon | 4 | 0 | — | |
| Luna2 Technology Integration Plan | `T2_Luna2TechnologyIntegrationPlan` | GM Modularization | 3 | 0 | — | |
| Gundam Unit 7 Plan | `T2_GundamUnit7Plan` | FSWS | 4 | 0 | — | |
| Gundam NT Custom Plan | `T2_GundamNTCustomPlan` | Luna2 | 6 | 1 | — | |
| GMKai Development Plan | `T2_GMKaiDevelopmentPlan` | Gundam NT Custom | 3 | 0 | — | |
| GLine Development Plan | `T2_GLineDevelopmentPlan` | GMKai | 1 | 0 | — | |
| GM Powerful Plan | `T2_GMPowerfulPlan` | GMKai | 4 | 0 | — | |
| GP Project | `T2_GPProject` | GLine | 8 | 1 | — | |

**ZEON_0079**

| Plan | Id | After | Units | Mega | Buildings it opens | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Base tech | `BaseTech` | — | 14 | 0 | factories, refinery, supply depot, institute, academy, ACE beacon, turrets, walls | ported, but for the Academy and Beacon |
| Ground Type Zaku Development Plan | `GroundTypeZakuDevelopmentPlan` | Base tech | 10 | 0 | — | ported |
| Ground Type MS Development Plan | `GroundTypeMSDevelopmentPlan` | Ground Type Zaku | 9 | 1 | — | ported |
| 603 Test Team | `603TestTeam` | Ground Type MS | 3 | 0 | — | next |
| Gouf Flight Type Development Plan | `GoufFlightTypeDevelopmentPlan` | Ground Type MS | 3 | 0 | — | next |
| New Ground Type MS Development Plan | `NewGroundTypeMSDevelopmentPlan` | Ground Type MS | 6 | 4 | — | next |
| Pezun Project | `PezunProject` | 603 Test Team | 4 | 0 | — | |
| Apsaras Development Plan | `ApsarasDevelopmentPlan` | Gouf Flight Type | 2 | 1 | — | |
| ZakuII LateType Development Plan | `ZakuIILateTypeDevelopmentPlan` | New Ground Type MS | 6 | 0 | beam turret A (yellow), MS turret A | |
| NewType Underwater MS Development Plan | `T2_NewTypeUnderwaterMSDevelopmentPlan` | ZakuII LateType | 6 | 0 | Academy T2, Refinery T2 | |
| NextGeneration Mainstay MS Bidding Plan | `T2_NextGenerationMainstayMSBiddingPlan` | NewType Underwater | 4 | 0 | — | |
| Underwater MA Development Plan | `T2_UnderwaterMADevelopmentPlan` | NextGeneration Mainstay | 5 | 0 | — | |
| United Maintenance Plan | `T2_UnitedMaintenancePlan` | NextGeneration Mainstay | 5 | 1 | — | |
| Hygogg Development Plan | `T2_HygoggDevelopmentPlan` | Underwater MA | 4 | 0 | — | |
| Base Defense MA Development Plan | `T2_BaseDefenseMADevelopmentPlan` | United Maintenance | 2 | 1 | — | |
| Dom Powerful Plan | `T2_DomPowerfulPlan` | United Maintenance | 4 | 0 | — | |
| Zeong Development Plan | `T2_ZeongDevelopmentPlan` | Base Defense MA | 3 | 0 | — | |
| Gyan Powerful Plan | `T2_GyanPowerfulPlan` | Dom Powerful | 4 | 0 | — | |
| Operation Stardust | `T2_OperationStardust` | Zeong | 8 | 1 | — | |

Every plan also unlocks named ACE pilots (16 EFSF, 18 ZEON in all), which
wait for the pilot system.

### Systems

| System | Status |
| --- | --- |
| GW damage formula, hit and graze, back hits | ported (`gw.battle`) |
| EN: per burst, per round, on the move; refill at supply points | ported |
| Supply points: EN and out-of-battle repair | ported |
| Upkeep and MP; a computer side's doubled income | ported |
| Loadout switching beside a supply point | ported |
| Submarine dive and surface | ported |
| Transport hangars (ground passengers) | ported |
| Tech tree: plans at the HQ, TechPoint from HQs and Institutes | ported for the first two plans of each tree |
| Mega Factory | ported: sells the big units of the ported plans (Mini Tray, Big Tray, Dabude) |
| Refinery T2, Institute T2 upgrade, Academy T1/T2, beam turrets | not yet: arrive with the plans that open them |
| Starting at T2 or T3 (`PassT1` and the host's tech start) | not yet |
| Pilots: Academy, skills rising with experience, ACE pilots and beacon, ejection, Core Fighter | not yet; every skill reads 100 meanwhile |
| Parts breaking (arm, head, leg, backpack) | not yet |
| DP and stagger | not yet |
| Shields (block chance and size) | not yet |
| GW stealth and detection (radar-hidden squads, detect and anti-detect ranges) | not yet; the radar uses native `detect` meanwhile |
| Custom units (`CustomUnit` upgrades), Core Block fusion, SFS riding with fire | not yet |
| Targeted actions (the Zaku II C's nuke and other skills aimed by the player) | not yet; the nuke fires on its own meanwhile |
| Firing, melee and guard poses; walking cycles | not yet; units show their rest and boost poses |
| Voices (CV units), BGM, the source's 22 maps | not yet; the pack carries its own showcase map |

## Carrying the port on

### The user's rules

- Port in **small batches**. The user picks each next batch; offer the
  choice with a recommendation, and research only what that batch needs.
- Keep the original behaviour, numbers, names, descriptions and art as far
  as possible; add every missing translation (Korean, in `localization.json`).
- **Flag** anything the game or its modding system cannot do. **Never change
  `steel-tide-game` without the user's approval**; when a feature needs the
  game, ask, then build it there with tests and docs.
- Work on `main`; never push; commit only when asked.
- Visual checks are the user's: no browser verification.

### A batch, step by step

From the repository root, with Python 3 and Pillow, FFmpeg, Node 22+ and Bun,
and the sibling `steel-tide-game` checkout:

1. Add the batch's plans to `TECH_PLANS` in `port.py`, in tree order. A plan
   whose parent is not ported fails the port's assert. Buildings a plan opens
   are skipped from its unlock list: port them on purpose, as
   `COMMON_BUILDINGS` or the faction's factories are, with `requires` on the
   plan. The Mega Factory sells a plan's big units like any other factory.
2. If `extensions/gw-battle/src` changed: `node mods/gw/extensions/gw-battle/build.mjs`
   (port.py embeds `extension.json`).
3. `python3 mods/gw/port.py` writes sheets, sounds, `mod.json` and
   `conversion-report.json`; `--no-media` keeps the sheets and sounds.
4. Translate every string in the report's `missingKorean` into
   `localization.json` (names by their English text, descriptions as
   `desc:<source name>`), in the style already there; rerun with
   `--no-media` until it reports none.
5. `python3 mods/gw/make-map.py` stands every def on Odessa Coast. When it
   says a piece has no place, widen `PARADE`, `APRON` or `FLEET`, or give a
   new building a spot in `BUILDINGS`.
6. Add the batch's tests to `game.test.ts`, then run
   `bun test ./mods/gw/game.test.ts`, `node tools/check.mjs mods/gw` and
   `node tools/pack.mjs mods/gw`.
7. Bump `version` in `port.py`, rerun it, and update this file and the README.

### Things the format and the source will catch you on

- Def and node ids are at most 40 characters: `node_id` writes
  `development` as `dev`, and asserts the length. A longer T2 plan needs
  another abbreviation there.
- Sheet keys are at most 40 characters after their prefix; a long round's
  key drops `projectile-`.
- A text holds 400 characters a language. `fit` drops a longer description's
  closing quote, then its last lines with an ellipsis, and records it in the
  report's adaptations.
- A loadout label the source writes in English shorthand (`180mmCannon`,
  `4XMSL`) needs an entry in `VARIANT` for its Korean.
- A hull or turret sheet turns smoothly only with its pivot centred:
  `art.render_frames(..., centre=True)` pads the art, and `Media.sheet`
  asserts it. Otherwise the game bakes 24 headings that step 15°.
- Ship bodies are measured from the art's bounding box, not the padded sheet.
- A decal with `total_frames` and `frame:memory.boostFrame` is a flame strip
  the source steps every 8 ticks: `frames_for` renders its frames into the
  sheet's `anims` at 7.5 fps, always (aircraft) or while moving (submarines,
  the Fisheye). Rendered once, it freezes on its first frame.
- Pilots and space-only units in an unlock list are skipped and named in
  the report's `leftOut`, with the reason.
- One Zeon plan's file is `Tech_ZEON_0079_GroundTypeMSDevelopmentPlan.ini.ini`
  in the source; `tech_plan` finds it.
- The source (`rusted-warfare-mods/gw`) is git-ignored and read as data.
- On Linux, several of the game's own AI suites outrun bun's 5-second
  timeout; compare a failure with the unchanged checkout before blaming the
  change.

### What the game provides for it

- **Pack research nodes**: the manifest's `tech` list, researched at a
  pack's building, kept, with prerequisite nodes, faction scoping, and the
  computer climbing the tree (`game/tech.ts`, `game/contentDefs.ts`; the
  game's `docs/systems/tech.md`, *A pack's own tree*). GW's lab is each
  faction's HQ.
- **Extension host API 2**, which `gw.battle` uses for damage, firing
  checks, rounds spent, the per-second economy, holding research for
  TechPoint (`wrapBuildingStep`), card rows (`inspect`) and saves.

## What is ported

The UC0079 `BaseTech` of both factions (`Tech_EFSF_0079_BaseTech.ini`,
`Tech_ZEON_0079_BaseTech.ini`), as a ground match (TileMode 0) offers it:

| Faction | Units | Buildings |
| --- | --- | --- |
| EFSF[0079] | Army Squad, Type 61, Hover Truck (Type 74), Anti-Zaku Tank, FanFan, Battle Helicopter, Toriares, Fly Manta, Tincod, SaberFish, Zanny (MG / Cannon), Medea, Torpedo Boat, Burke Class, U-Type Submarine (+ submerged form), Himalaya Class | HQ, Land Factory, Airport, Aqua Factory, Mega Factory |
| ZEON[0079] | Army Squad, Magella tank, Samson truck, APC, Wappa, Battle Helicopter, Fat Uncle, Dopp, Dodai YS, Old Zaku (MG / Bazooka), Zaku II C, Zaku II (MG / Bazooka), Zaku II S (MG / Bazooka), Ucon (+ submerged form) | HQ, Land Factory, Airport, Aqua Factory, Mega Factory |
| shared | — | Refinery T1, Supply Depot T1, Institute T1, MG / AA / CN / MS turrets, Radar, Wall A and B |

and the first two development plans of each tree, researched at the
faction's headquarters, with the units they open on a ground match:

| Plan | Units |
| --- | --- |
| Anti MS Plan (EFSF, `Tech_EFSF_0079_AntiMSPlan`) | GM Early Type (and Bazooka), Type61A5, Hover Truck Kai, Type61 Mode.SPG, Missile Car, Minigun APC, Dash, DEPP·ROG, Don Escargot, M-Type Submarine, Mini Tray |
| Early Type MS Development Plan (EFSF, `Tech_EFSF_0079_EarlyTypeMSDevelopmentPlan`) | Ground Type Gundam (and Bazooka, Beam Rifle), Ground Type Gundam with weapon container (and Bazooka, Beam Rifle, 180mm Cannon, MSL), GM Ground Type and with weapon container (the same loadouts), GM Sniper, Guntank M, Fisheye, Big Tray |
| Ground Type Zaku Development Plan (ZEON, `Tech_ZEON_0079_GroundTypeZakuDevelopmentPlan`) | Zaku II Ground Type (and Bazooka, CN), Gouf B, Zaku Cannon (and BigGun), Zaku Marine Type, Zaku II R-1 (and Bazooka), Gogg, Cui, APC with MS, MadAngler Class |
| Ground Type MS Development Plan (ZEON, `Tech_ZEON_0079_GroundTypeMSDevelopmentPlan`) | Gouf Custom, Zaku II High Mobility Ground Type (and Bazooka, 4XMSL), Zaku Reconnaissance Type, Zaku II R-1A (and Bazooka), Zaku Desert Type (and BigGun), Zaku Tank, Magella Eins, Acguy, Dabude |

[conversion-report.json](conversion-report.json) gives every definition's and
plan's source file, the plans' prices, the weapons each unit leaves out, and
what the port leaves out and why.

In each of them:

- Original names and descriptions in English and Chinese, source wording and
  source mistakes included; Korean added for every string.
- Original art: mobile suits composed from their part pictures in the source's
  rest pose, with the boost pose and flame as their moving frames; aircraft
  with their engine flames running at the source's pace, and submarines and
  the Fisheye with theirs lit under way; tanks and turret buildings with
  turning turrets; squads with their soldiers; ships with their deck guns;
  original rounds for every gun.
- Original firing recordings.
- HP, prices, build times, speeds, turning, sight, ranges, bursts, cooldowns,
  minimum and melee ranges, blast radii, projectile speeds and spreads.
- GW's damage formula, hit and graze rolls, EN, supply points and upkeep (see
  README); loadout switching at supply points; submarine dive/surface forms;
  hangars as transport holds; the Zaku II C's nuclear warhead.
- Each ported plan's name, description, Money and Resource, 30 seconds and
  TechPoint (1200 for a tree's first plan, 3600 for its second), and what it
  unlocks. TechPoint as `Gen_TechPoint` makes it:
  7.5 a second for each headquarters, 0.75 for each T1 Institute, a computer
  side's at 0.75 of that, from nothing at the start; the Institute's upkeep of
  2 Money and 4 Resource.

## Adaptations

| Source | Here | Why |
| --- | --- | --- |
| The HQ builds anywhere on the map (`isBuilder`, nano range 10000); four HQ slots take the support buildings | An **Engineer Team** per faction, drawn from the faction's own soldiers, builds everything and rebuilds the HQ | A native faction needs a builder unit |
| Squad orders of three (one price, one timer) | Three single units at a third of the price and time | Native production is per unit |
| Money and Resource | One metal, 1:1 | One native currency |
| MP and MP max; income halves over the cap | Population and power (HQ 60, depot +9); a power shortfall slows production instead | Native economy |
| A computer side's income ×2, then ×1–2.5 by its `AIHard` handicap | ×2 for every computer side | No difficulty handicap reaches the package |
| A player's targeted nuke action (Zaku II C), 10000 s cooldown | Fires on its own at its source range, once a life | No targeted ground action yet |
| Equipment switch needs `canSupply` (supplied within the last 2 s) | Within 7 tiles of a friendly supply point | Native rule condition |
| FanFan sold by the EFSF land factory and airport | Airport only | The game reads a yard that sells any aircraft as an airfield; its AI then never raises a ground line |
| Buildings at their units' scale | 1.5× | Footprints are whole tiles; GW's buildings are barely larger than a mobile suit |
| Hangars that take only infantry (Type 74, APC, Samson truck) | Take any passenger of one place | A native hold has a weight limit, not a passenger filter |
| The radar reveals hidden units within its detect range | Native `detect` at that range, and radar sight | GW's own stealth and detection are not ported yet |
| A pilot aboard every unit: skills 100–110 at the start (leadership 55–75, which a command unit such as the Himalaya reads instead), rising with experience | No pilot: every skill reads 100 | Pilots are not ported yet |
| The tech tree page, opened from the HQ: every node at once, started with a button, several researched side by side | The plans the HQ can take now are tiles on its card, put on its queue of five; several headquarters research side by side | The game's lab card and queue |
| TechPoint on the HUD beside Money and Resource; a plan's button locked until its TechPoint is there | The TechPoint held, and what a waiting plan asks, on the HQ's and Institute's cards; the plan may be queued, and waits at the head of the queue for it | The HUD shows one resource; a lab queues before it can pay |
| A computer side's TechPoint ×0.75, then ×1–1.35 by its `AIHard` handicap | ×0.75 | No difficulty handicap reaches the package |
| A plan's TechPoint is spent when it starts | Taken when it reaches the head of the queue, whether or not the plan before it is done; back whole if taken off unfinished, lost with the HQ | The package holds research only as the queue's head |
| A host's tech start and tech multiplier options | TechPoint from nothing, at ×1 | No setup options for a mod |
| English descriptions past 400 characters: the M-Type submarines, Mini Tray, Big Tray and Dabude (412–475) | The closing quote is dropped in English; the three battleships also lose their last weakness lines, marked with an ellipsis | The format holds 400 characters a language |
| The tech tree with the game's tech tree switched off in setup | The plans stay closed: only the base tech is built | A pack's nodes follow the game's switch |

## Not supported by the game or its modding system

These need a game change, or are outside what a mod may do. They are not
worked around in this port.

- **Space theatre (TileMode 1).** Steel Tide has no space terrain or space
  mode. Space and Space Mega factories, the space-only units (Salamis,
  Columbus, Gattle, Jicco, Musai, Papua, the Balls, Falmer…), re-entry and HLV
  launches between ground and space maps are left out.
- **Extra currencies on the HUD.** Money, Resource, TechPoint, MP, War Level
  and Moral Point are global resources with their own HUD readouts; a mod has
  one metal and no way to show another player resource. TechPoint is kept by
  the `gw.battle` package and read off the HQ's and Institute's cards instead;
  MoralPoint prices (the Zaku II C asks 250) are dropped.
- **Host options.** GW's in-match host menu (game mode, ground/space, resource,
  MP and tech multipliers, bullet speed, auto tile mode, ACE and PMC switches)
  has no place in Steel Tide's match setup; a mod cannot add setup options.
- **Removing or replacing vanilla content.** GW deletes every vanilla unit and
  replaces the command centre; mods only add. Native factions give each seat
  GW's own HQ and roster instead.
- **Carrying the player's own aircraft.** The Himalaya's three hangars and the
  Burke's hangar hold aircraft; a mod's transport hold carries ground units
  only (`transportDomain` is not a content field).
- **Weather and time-of-day systems** chosen by GW's own markers; the match
  keeps Steel Tide's weather.

## Verification

`game.test.ts` runs the real pack in the engine: both factions' start and
builder loop, factory sales at source prices, each faction's first plan
researched at its headquarters (held for its TechPoint, unbilled, then
opening its units), its second plan queued behind the first and opening its
units and the Mega Factory's battleship, the Institute's TechPoint, a
cancelled plan's refund and the TechPoint in a save, a computer side of each
faction climbing to its second plan, the damage formula on a Zaku machine gun against a Type 61 and
infantry rifles against armour, EN use and refill, upkeep, the warhead's
single shot, diving, loadout switching at a supply point, a save round trip,
and a computer side of each faction building a ground line and fielding
armed units. It also plays the showcase map with both factions seated: every
piece is laid, each unit on its own tile, and no shot is fired in the first
20 seconds with fog off. The art and the HUD are the user's to look over in
the game.

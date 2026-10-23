# Compatibility and fidelity record

No Steel Tide game code is changed for this port. Everything GW-specific lives
in the pack: definitions, art and sounds, and the `gw.battle` package. This
record separates what is ported, what is adapted, what a later batch can still
port within the modding system, and what the game or its modding system does
not support.

## Scope of this pass

The UC0079 `BaseTech` of both factions (`Tech_EFSF_0079_BaseTech.ini`,
`Tech_ZEON_0079_BaseTech.ini`), as a ground match (TileMode 0) offers it:

| Faction | Units | Buildings |
| --- | --- | --- |
| EFSF[0079] | Army Squad, Type 61, Hover Truck (Type 74), Anti-Zaku Tank, FanFan, Battle Helicopter, Toriares, Fly Manta, Tincod, SaberFish, Zanny (MG / Cannon), Medea, Torpedo Boat, Burke Class, U-Type Submarine (+ submerged form), Himalaya Class | HQ, Land Factory, Airport, Aqua Factory |
| ZEON[0079] | Army Squad, Magella tank, Samson truck, APC, Wappa, Battle Helicopter, Fat Uncle, Dopp, Dodai YS, Old Zaku (MG / Bazooka), Zaku II C, Zaku II (MG / Bazooka), Zaku II S (MG / Bazooka), Ucon (+ submerged form) | HQ, Land Factory, Airport, Aqua Factory |
| shared | — | Refinery T1, Supply Depot T1, MG / AA / CN / MS turrets, Radar, Wall A and B |

[conversion-report.json](conversion-report.json) gives every definition's
source file and the weapons it leaves out.

## Ported

- Original names and descriptions in English and Chinese, source wording and
  source mistakes included; Korean added for every string.
- Original art: mobile suits composed from their part pictures in the source's
  rest pose, with the boost pose and flame as their moving frames; tanks and
  turret buildings with turning turrets; squads with their soldiers; ships with
  their deck guns; original rounds for every gun.
- Original firing recordings.
- HP, prices, build times, speeds, turning, sight, ranges, bursts, cooldowns,
  minimum and melee ranges, blast radii, projectile speeds and spreads.
- GW's damage formula, hit and graze rolls, EN, supply points and upkeep (see
  README); loadout switching at supply points; submarine dive/surface forms;
  hangars as transport holds; the Zaku II C's nuclear warhead.

## Adaptations

| Source | Here | Why |
| --- | --- | --- |
| The HQ builds anywhere on the map (`isBuilder`, nano range 10000); four HQ slots take the support buildings | An **Engineer Team** per faction, drawn from the faction's own soldiers, builds everything and rebuilds the HQ | A native faction needs a builder unit |
| Squad orders of three (one price, one timer) | Three single units at a third of the price and time | Native production is per unit |
| Money and Resource | One metal, 1:1 | One native currency |
| MP and MP max; income halves over the cap | Population and power (HQ 60, depot +9); a power shortfall slows production instead | Native economy |
| A computer side's income ×2, then ×1–2.5 by its `AIHard` handicap | ×2 for every computer side | No difficulty handicap reaches the package |
| A player's targeted nuke action (Zaku II C), 10000 s cooldown | Fires on its own at its source range, once a life | No targeted ground action in this pass |
| Equipment switch needs `canSupply` (supplied within the last 2 s) | Within 7 tiles of a friendly supply point | Native rule condition |
| FanFan sold by the EFSF land factory and airport | Airport only | The game reads a yard that sells any aircraft as an airfield; its AI then never raises a ground line |
| Buildings at their units' scale | 1.5× | Footprints are whole tiles; GW's buildings are barely larger than a mobile suit |
| Hangars that take only infantry (Type 74, APC, Samson truck) | Take any passenger of one place | A native hold has a weight limit, not a passenger filter |
| The radar reveals hidden units within its detect range | Native `detect` at that range, and radar sight | GW's own stealth and detection are a later batch |
| A pilot aboard every unit: skills 100–110 at the start (leadership 55–75, which a command unit such as the Himalaya reads instead), rising with experience | No pilot: every skill reads 100 | Pilots are a later batch |

## Later batches (portable through the modding system)

- **Eras and factions**: UC0087 (AEUG, Titans, Neo Zeon) and C.E.71 (ZAFT,
  OMNI), and the UC0079 units behind the tech tree (GM, Gundam, Gouf, Dom…).
- **Tech tree and TechPoint** (Institute), **pilots** (Academy, ACE beacon,
  ejection, Core Fighter), **parts breaking** (arm, head, leg, backpack),
  **DP / stagger**, **shields** (block chance and size), **stealth and
  detection** (radar-hidden squads, detect and anti-detect ranges), **custom units**
  (`CustomUnit` upgrades), **Core Block fusion**, **SFS riding** with fire.
- **Targeted actions**: the Zaku II C nuke and other skills as player actions.
- **More animation**: firing, melee and guard poses; walking cycles.
- **Voices** (CV units), **BGM**, the 22 source maps.

## Not supported by the game or its modding system

These need a game change, or are outside what a mod may do. They are not
worked around in this port.

- **Space theatre (TileMode 1).** Steel Tide has no space terrain or space
  mode. Space and Space Mega factories, the space-only base units (Salamis,
  Columbus, Gattle, Jicco, Musai, Papua), re-entry and HLV launches between
  ground and space maps are left out.
- **Extra currencies on the HUD.** Money, Resource, TechPoint, MP, War Level
  and Moral Point are global resources with their own HUD readouts; a mod has
  one metal and no way to show another player resource. MoralPoint prices (the
  Zaku II C asks 250) are dropped.
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
builder loop, factory sales at source prices, the damage formula on a Zaku
machine gun against a Type 61 and infantry rifles against armour, EN use and
refill, upkeep, the warhead's single shot, diving, loadout switching at a
supply point, a save round trip, and a computer side of each faction building
a ground line and fielding armed units. It also plays the showcase map with
both factions seated: every piece is laid, each unit on its own tile, and no
shot is fired in the first 20 seconds with fog off. No browser check has been
made; the art and the HUD want a look in the game.

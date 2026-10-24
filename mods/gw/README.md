# GW BattleUniverse

A local Steel Tide port of **GW BattleUniverse (高达战争_战争宇宙) V159**, a
Mobile Suit Gundam fan mod for Rusted Warfare by **恐龙再健身房**. The four
source packages in `rusted-warfare-mods/gw` are read as data; nothing of them
runs in the game.

This port is GW's **ground game**: all seven factions of its three eras —
the Earth Federation and Zeon of UC0079, the AEUG, Titans and Neo Zeon of
UC0087, OMNI and ZAFT of C.E.71 — each with its base tech, its whole tech
tree and every unit those sell on a ground map, with GW's pilots, ACEs,
parts, shields, skills and systems, its soundtrack and operator voice, and
nine of its maps. Space is left out: Steel Tide has no space theatre.
[DOCS.md](DOCS.md) tracks the port's progress, how to carry it on, and exactly
what is and is not here.

The pack sets `hideFromListing: true` and requires **extension host API 2**,
**large content capacity**, and a game with pack research nodes, map-aimed
module actions, `transportDomain`, amphibious passengers in ground holds and
the large-capacity caps of 16 maps and 64 tracks.

## Play

**Settings → Mods → Open folder**, choose this folder, and start a new
Conquest match with a GW faction on a seat: **EFSF[0079]**, **ZEON[0079]**,
**AEUG[0087]**, **TITANS[0087]**, **NEO ZEON[0087]**, **OMNI[CE71]** or
**ZAFT[CE71]**. GW is not balanced against the vanilla roster; play it
against itself.

- Each side starts with its headquarters and an **Engineer Team**, which raises
  every building. The HQ trains more engineers.
- **Land Factory**, **Airport**, **Aqua Factory** and **Mega Factory** sell
  the units at the source's prices: a squad order of three becomes three units
  at a third of the price and time each.
- The **Refinery** adds income; the **Supply Depot** raises the power ceiling
  (GW's MP cap) and supplies units around it, as do the HQ and the Aqua Factory.
- The **headquarters' card** is GW's tech tree: it offers the faction's next
  development plans. A plan costs Money and Resource (metal here), seconds of
  work, and **TechPoint**, which the HQ earns at 7.5 a second and each
  **Institute** at 0.75 more. A plan waits at the head of the queue until its
  TechPoint is in hand. The HQ's card also shows the side's **MoralPoint**,
  which some units ask besides their price.
- Every unit has a **pilot** who learns from the harm it does and climbs
  levels. The **Academy** trains pilots for units left without one; the
  UC0079 **ACE Beacon** calls named ACE pilots once their plan is in, each
  with skills of their own. A unit that loses its pilot stands idle until
  another boards it.
- Mobile suits switch **loadouts** and **convert** beside a supply point,
  **transform** to flight forms and back, ride **sub-flight systems** and
  fire from them, and use their **skills** from the card: an aimed skill
  (a warhead, a mortar, mines) takes its point from the next map click.
- Submarines dive and surface from their card; hangars carry ground units
  or aircraft.

### Maps

Five **showcase** maps stand every definition of their factions before the
whistle, out of each other's reach: one each for EFSF[0079], ZEON[0079] and
AEUG[0087], one for TITANS and NEO ZEON, one for OMNI and ZAFT. Seat N opens
on the Nth spawn and gets that faction's pieces, so pick the factions in the
order the map names them. `make-map.py` draws them from `mod.json`.

Nine of the source's ground maps come with them: **At Jaburo's Fall** [2v2]
and [3v3], **Cucuruz Doan's Island**, **Dense Forest Region**,
**Mountainous Region**, **New City**, **Rise From The Ashes**, **Southeast
Asia** and **Tremor Mountain**, read through the game's Rusted Warfare
importer at this port's scale (`source-maps.ts`).

## What GW's battle rules do here

The pack's `gw.battle` package keeps the source's own combat and logistics:

- **Damage** follows GW's damage checkers: each round carries shell, beam or
  melee damage, armour-piercing parts and Anti-land/air/water/building factors;
  a target takes away its flat defence of that kind, then its percentage. A
  machine gun that cannot beat a tank's flat shell defence does nothing to it.
  Shields block, I-Fields turn beams, PS armour turns shells.
- **Hit and graze**: accuracy against reaction, both from the pilot, decides
  whether a round connects, and a second roll whether it only grazes. Fire
  from behind hits harder and more surely; an unseen unit is hit half as hard.
- **Parts and DP**: a mobile suit hit hard and often loses parts: a broken
  right arm drops its hand weapons, a broken head shortens its sight and
  reach, and any break locks its transformation. DP past its whole staggers
  it.
- **Detection**: an enemy is a target only once a detector of its side finds
  it, and stays found five seconds. Smoke and optical camouflage make a unit
  harder to find, smoke also harder to hit; Minovsky particles hide what
  stands in them and halve the reach of detectors inside them.
- **EN** is spent per burst or per round and on the move; an empty unit holds
  its fire. Supply points refill EN and, out of battle, repair.
- **Economy**: a human side pays each unit's MP and its buildings' upkeep
  every second; a computer side earns its income twice, more at Seasoned and
  Veteran (the source's `AIHard` brackets), and three quarters of the
  TechPoint.

## Conversion

| Source | Here |
| --- | --- |
| lengths (RW px) | 0.75 world px: art, radii, ranges, speeds, offsets |
| sight (RW tiles of 20 px) | the same 0.75 scale, in 32 px tiles |
| buildings | drawn 1.5× their units' scale, so footprints come to whole tiles |
| time | 60 RW ticks a second |
| Money + Resource | metal, 1:1 each (same incomes; the HQ trades them symmetrically) |
| MP / MP max | population / power |
| HP, damage, defences, EN, pilots' skills | unscaled |

Units move at their high-speed (boost) mode speed, the default for a human
player in the source.

## Rebuild and verify

From the repository root, with Python 3 and Pillow, FFmpeg, Node 22+ and Bun,
and the sibling `steel-tide-game` checkout for the engine tests:

```sh
python3 mods/gw/port.py                 # --no-media writes only mod.json and the report
python3 mods/gw/make-map.py             # --check-only compares the saved maps
bun mods/gw/source-maps.ts              # the source's ground maps
bun test ./mods/gw/game.test.ts
node tools/check.mjs mods/gw
node tools/pack.mjs mods/gw
```

`port.py` writes `mod.json`, `sprites/`, `sounds/`, `music/`, `voice/`, builds
the `gw.battle` package, and writes [conversion-report.json](conversion-report.json),
which records the source file of every definition, the weapons each one
leaves out and why, what the port leaves out, and the adaptations. Korean text
lives in [localization.json](localization.json); the port reports any string
without it.

## Credits and licence

[CREDITS.md](CREDITS.md). The source pack states no licence or redistribution
terms; this port is local and unpublished until the rights holder's permission
is confirmed.

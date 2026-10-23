# GW BattleUniverse

A local Steel Tide port of **GW BattleUniverse (高达战争_战争宇宙) V159**, a
Mobile Suit Gundam fan mod for Rusted Warfare by **恐龙再健身房**. The four
source packages in `rusted-warfare-mods/gw` are read as data; nothing of them
runs in the game.

This pass is the **UC0079 core**: what the Earth Federation and the
Principality of Zeon unlock at the start of a ground match through their
`BaseTech` nodes — their base units, factories, refinery, supply depot,
turrets and walls. Later eras (UC0087, C.E.71), the tech tree, pilots and the
rest of the source are later batches; [COMPATIBILITY.md](COMPATIBILITY.md)
lists exactly what is and is not here.

The pack sets `hideFromListing: true` and requires **extension host API 2**
and **large content capacity**.

## Play

**Settings → Mods → Open folder**, choose this folder, and start a new
Conquest match with **EFSF[0079]** or **ZEON[0079]** as a seat's faction.

- Each side starts with its headquarters and an **Engineer Team**, which raises
  every building. The HQ trains more engineers.
- **Land Factory**, **Airport** and **Aqua Factory** sell the base units at the
  source's prices: a squad order of three becomes three units at a third of the
  price and time each.
- The **Refinery** adds income; the **Supply Depot** raises the power ceiling
  (GW's MP cap) and supplies units around it, as do the HQ and the Aqua Factory.
- Zaku II, Old Zaku, Zaku II Type S and Zanny switch between their machine gun
  and bazooka/cannon loadouts from their card, paid, beside a supply point.
- The U-type submarines dive and surface from their card.

### Odessa Coast

The pack carries one map, *Odessa Coast*
(`maps/odessa-coast.steel-tide-map`), a new showcase rather than one of the
source's 22 maps. Every definition in the pack stands on it before the match
starts. The Federation holds the west and Zeon the east. Each base has its
headquarters, factories, supply depot, refinery and radar along the north edge,
its aircraft over the apron below them, and its ground forces, loadout variants
included, on a paved parade ground. Its turrets and walls guard the highway out
of the base, and its fleet, the dived submarine forms included, lies off its
own harbour on the southern coast. Shared buildings stand in both bases.
Between the bases a highway runs through a ruined town. The two sides stand
further apart than the longest gun reaches, so nothing fires until a side
moves.

Seat one opens on the west and gets the Federation's pieces, seat two on the
east and gets Zeon's. Choose **EFSF[0079]** and **ZEON[0079]** for those seats
so each opens with its own headquarters and engineers beside the exhibit. The
map is drawn by `make-map.py` from `mod.json`, not in the Map Editor, so it
follows the roster. The generator checks coverage, faction ownership, terrain,
each hull's sea room and overlaps before writing.

## What GW's battle rules do here

The pack's `gw.battle` package keeps the source's own combat and logistics:

- **Damage** follows GW's damage checkers: each round carries shell, beam or
  melee damage, armour-piercing parts and Anti-land/air/water/building factors;
  a target takes away its flat defence of that kind, then its percentage. A
  machine gun that cannot beat a tank's flat shell defence does nothing to it.
- **Hit and graze**: accuracy against reaction decides whether a round
  connects, and a second roll whether it only grazes. A run of hits makes the
  next dodge likelier; fire from behind hits harder and more surely.
- **EN** is spent per burst or per round and on the move; an empty unit holds
  its fire. Supply points refill EN and, out of battle, repair.
- **Upkeep**: a human side pays each unit's MP and its buildings' upkeep every
  second; a computer side earns its income twice, as in the source.

## Conversion

| Source | Here |
| --- | --- |
| lengths (RW px) | 0.75 world px: art, radii, ranges, speeds, offsets |
| sight (RW tiles of 20 px) | the same 0.75 scale, in 32 px tiles |
| buildings | drawn 1.5× their units' scale, so footprints come to whole tiles |
| time | 60 RW ticks a second |
| Money + Resource | metal, 1:1 each (same incomes; the HQ trades them symmetrically) |
| MP / MP max | population / power |
| HP, damage, defences, EN | unscaled |

Units move at their high-speed (boost) mode speed, the default for a human
player in the source. GW is not balanced against the vanilla roster; play it
against itself.

## Rebuild and verify

From the repository root, with Python 3 and Pillow, FFmpeg, Node 22+ and Bun,
and the sibling `steel-tide-game` checkout for the engine tests:

```sh
node mods/gw/extensions/gw-battle/build.mjs
python3 mods/gw/port.py                 # --no-media keeps the sheets and sounds
python3 mods/gw/make-map.py             # --check-only compares the saved map
bun test ./mods/gw/game.test.ts
node tools/check.mjs mods/gw
node tools/pack.mjs mods/gw
```

`port.py` writes `mod.json`, `sprites/`, `sounds/` and
[conversion-report.json](conversion-report.json), which records the source file
of every definition, the weapons each one leaves out and why, the base-tech
entries this pass leaves out, and the adaptations. Korean text lives in
[localization.json](localization.json); the port reports any string without it.

## Credits and licence

[CREDITS.md](CREDITS.md). The source pack states no licence or redistribution
terms; this port is local and unpublished until the rights holder's permission
is confirmed.

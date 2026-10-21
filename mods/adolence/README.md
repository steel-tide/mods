# Adolence: City of Sin

A port of *Adolence-罪恶之都* (City of Sin), the Rusted Warfare total conversion
by 自然常数也有人用? and the Adolence team (art: 潘子慕, 逆模因部成员, 橘子; code:
Sky_Fall乄神域), made with the lead author's permission. The package ported is
release Q3.6.0 of the V3.0 line.

The original is a scenario: a city's police against the SPK strain and the dead
it makes, with three currencies, a day-night cycle, scripted supply drops and a
faction picker. What comes across is the roster and the art: the police, the
troops that come to their aid, their vehicles, aircraft and boats, and the
dead. So does the part of the scripting the game's mod rules can carry (see
The dead, below). The original's city/infected choice is now the game's faction
selector. This release requires Steel Tide 0.8.16 for authored muzzle positions
and native barrel recoil. The currencies, supply drops, difficulty scripts and
infantry's own orders stay behind.

## Choose a side

Enable the mod, then choose a faction for each seat in Conquest or Breakthrough:

| faction | Conquest opening | construction and economy |
| --- | --- | --- |
| Adolon City Authority | Joint Precinct and two Police Engineers | Engineers construct police buildings; Solar Arrays power the force and Supply Caches extract metal. |
| SPK Infected | SPK Colony and two SPK Carriers | Carriers raise colonies and Sin of Sloth nests. Nests extract metal from deposits while breeding the dead. The infected use no electrical power. |

Each side has its own roster, headquarters and replacement builders. Both HQs
provide territory, production slots and a small metal income; the upgraded VD
Precinct keeps those functions and can still train engineers. No vanilla HQ or
engineer is needed. Faction selection requires Steel Tide 0.8.14 with format 2
support.

The Police Engineer, SPK Carrier and SPK Colony adapt the original's scripted
construction to this game's mobile builders. They reuse the port's Traffic
Officer, Brute and Sin of Sloth art respectively. The colony stands on ordinary
land; its nests need deposits. These additions are in `port-rw.py`, so a fresh
conversion preserves the faction setup.

## What is in it

Sixteen buildings, placed by their side's construction units:

| building | line | what it does |
| --- | --- | --- |
| Joint Precinct → VD Joint Precinct | command | city headquarters; trains engineers and the police kit; the VD stage has the whole garrison on call |
| Police Outpost | infantry | every foot unit, from patrol officers to the task force; the Zhongzhou squad once an arsenal stands |
| Police Garage → Police Arsenal | vehicles | cruisers and armoured cars; the arsenal adds the military vehicles, the black-steel tanks, the Abrams and the Stryker |
| Police Helipad → Military Airfield | air | the police helicopter; then gunships, fighters, bomber and transport |
| Coast Guard Base | sea | the scout boat, the two hovercraft IFVs and the drone carrier; it stands on the water by a shore |
| Solar Array → T2 | power | +25, then +75 |
| Supply Cache → II | metal | an extractor on a deposit, 1.4 then 3.0 a second |
| MG Tower | defence | a machine gun on a street mount, fires at aircraft |
| Barricade | defence | a 1×1 block of steel to funnel the horde |
| SPK Colony | infected command | headquarters; breeds SPK Carriers |
| Sin of Sloth | the dead | a nest on a deposit; extracts 1.4 metal a second and trains the dead |

The game judges a production building by what it turns out, so the coast
guard base, with a boat on its list, is a naval yard like the game's own: the
Police Engineer lays it on the water with a shore beside it, and it launches onto
the water.

Eighty-three units: 23 kinds of infantry including the Police Engineer,
33 vehicles, 7 aircraft, 2 boats and 18 of the dead including the SPK Carrier.
The infected raise their forces from nests, and the nests also breed on their own.

## The dead

The original's scripts that the game's mod rules can carry come across with it:

- **The dead rise.** A police officer, a soldier or a guard killed by the dead
  gets up as one of them, on the side that killed it: most as a Brute, the
  task force's anti-materiel rifleman as a Turned Anti-Materiel. Killed by
  anything else, they stay dead.
- **The nests breed.** A Sin of Sloth brings up three Brutes, four Zombies, a
  Rager and a Prisoner every 35 seconds, about a third of the original's
  brood. Like every spawn, it stops at its side's population cap.
- **The dead rage and mend.** One of the dead that makes a kill hits 40%
  harder and 30% faster for eight seconds, then rests twenty. One left alone
  for six seconds mends a little every two.
- **Cars come crewed.** A police cruiser arrives with four officers aboard, an
  armoured car with eight, a heavy escort with seven, a mortar or a heavy
  machine gun with its gunner, and so on, as far as each hold goes. The price of
  each vehicle includes its crew.

The black-steel tanks, the drone carrier, the bomber and the bigger dead mend
their hulls slowly, as they do in the original.

## The maps

The mod now includes seven original map layouts alongside the showcase below.
Enable the companion **Adolence: Original Maps II** for the other eight originals.
All 15 source maps are accounted for in [the map inventory and port notes](MAPS.md).
Maps with more than eight starting teams are capped to eight. The 1000×1000
layout is reduced to 500×500; the two survival layouts are skirmish adaptations.

The original showcase, *City of Sin* (`maps/city-of-sin.steel-tide-map`), depicts
the west bank of Adolon, with the police dug in along the middle avenue, the
dead across it and nests breeding more in the rubble. The 104×76 map has
residential blocks, ruined neighbourhoods, a downtown square and broad
streets leading to the riverfront. City blocks are real obstacles; the
streets and alleys remain open for the fighting.
It showcases every unit and building in the mod, including the upgraded
buildings and both factions' builders. Infantry reserves stand beside the
police yards, vehicles line the southern motor pool, aircraft gather by the
airfield, and the carrier shares the coast guard harbour with the scout boat.
The harbour connects to the river through the southern channel, where the
infected's aquatic Gloaters also lurk.
Seat one opens on the west and gets the police, seat two on the east and gets
the dead. Choose City Authority for seat one and SPK Infected for seat two to
match those forces with their own headquarters. With the mod on, the map is a card in the Conquest setup and the
lobby beside your own map; pick it and it plays exactly as laid. It is drawn by
`make-map.py` rather than in the Map Editor, so it can be regenerated with the
roster. The generator checks roster coverage, faction ownership, terrain,
deposits and overlaps with other pieces or props before writing the file; a roster addition that needs more
display space fails with a request for new placements. The editor opens it
like any map, and with the mod on, the mod's units are in its forces palette.

## How the numbers were made

The package prices things in credits, 柴油 (diesel) and 补给 (supply); this game
has one metal. The three are folded into one figure (a diesel is worth ten
credits, a supply five, from the ratio the buildings generate them in), then
compressed with a power law, `metal = 0.287 × price^0.763`, anchored so a police
cruiser lands near a scout car and a black-steel light tank near a heavy tank,
and kept within a quarter to two and a half times the unit's hit points.
Buildings are a plain tenth of their price. The dead, priced at nothing in the
original, are priced by what they take to kill.

Hit points are 0.35× the original's. Damage is 0.14×, not 0.35×, because the
package kills about three times faster between equals than this game does;
the original's energy magazines are averaged into the reload. Ranges are 0.55
of a tile per 20 original px, speeds 0.55 of the original's px per tick in px
per second, and infantry a step quicker than that so they are not calibrated
as tanks. Every conversion rule is in `port-rw.py`, with a hand-written
weapon set for the Abrams family, the Stryker, the bomber and the carrier,
whose original guns are scripted.

## The art and the sounds

The sheets are the package's own sprites, laid out for this game: hull and
turret parts composited at their offsets, a building's back and top layers
merged, sizes at 0.82 sheet px per original px with the long ones (the
Abrams is 150 px in the original) compressed so nothing is longer than a
battleship. The package disables team colouring. The sheets keep the game's
recolouring switched on, because a sheet without it does not draw at all, but
the converter nudges any pixel the magenta test would catch (the pinks of the
dead, mostly) just out of its reach, so nothing changes colour: your police
and the enemy's look the same, as they did there. Helicopter rotors and the
husk's wings, spinning arms in the original, are painted onto the bodies.

The original draws much of a vehicle with decals: pictures laid on the body or
on a turret besides their own images. The still ones are painted into the
sheets in the order the original draws them — the hull's outline and the
driver's hatch on the hull; on the Abrams' turret the vents, sights, stowage
and crates, the crew hatches with their machine guns at rest, the Stryker's
gun and its shadow. The rest are the game's own decals (`decals` on the def),
because a sheet cannot hold them: the outline a turret carries *under* the
hull, showing where the gun overhangs it; the headlights of every
vehicle and the torches of the infantry, which come on at dusk and are laid
over the dark like lamps; the ambush car's brake lights when it stands; and
the barrels of the machine-gun tower and the MG tanks, which turn while the
gun fires. The interface decals — selection rings, waypoints, ammunition
counters, preview icons — and the ones a script drives are left out. So are
the original's shadow decals: it casts an offset silhouette under every
vehicle and its turret, and so does this game now, hull and turret each,
and a building's gun on its roof, from the art itself — the same look
without a sheet for it.

Three of the vehicles swim, as they do in the original: the police amphibious
car and the two hovercraft IFVs, the hulls the package lets into the water
without drowning (its other cars drift in and sink five seconds later). They
are `amphibious` here — driven ashore, afloat at the game's swimming pace, a
ship to every gun while they swim — and the hovercraft leave the coast guard
base as well as the arsenal. Every vehicle also says what it rolls on: the
Abrams family on treads, the cars, the trucks and the Stryker on tyres, so each
cuts its own marks and is heard as its own engine; the infantry, the crewed
pieces, the walkers and the hovercraft (`trail: "none"`) cut nothing and are
not heard rolling.

Tank and IFV weapons use muzzle positions measured on their actual sprites,
including the separate coaxial guns on the Abrams and Stryker and both missile
pods. Exposed gun barrels recoil through the game's native `barrels`/`recoil`
fields; mantlets, turret bodies and roof fittings stay fixed. Coaxial fire does
not kick the main gun, and missile and flame weapons have no barrel recoil.
Extremism's two hull guns fire from their painted positions behind the turret;
they follow the hull's bearing, while its anti-air missiles launch from the
hull centre independently of the main gun.

`weapon_geometry.py` records the measured source pixels and converts them using
each saved sheet's `fw`, `fh` and pivot, plus the game's unit display scale.
`port-rw.py` applies these measurements on every conversion; `--no-media` keeps
the existing PNGs and their sheet sizes. Re-measure the calibration if the art
changes. Damage, reload, range and the rest of the combat values are unchanged.

The firing sounds are the package's recordings, cut to dry mono one-shots
under a second. The Abrams and the Stryker fire the 120 mm and 105 mm
recordings; small arms fire the calibre recordings the original assigned them.

## Licence and credit

The art and the sounds are the Adolence team's, used with permission; they are
not offered under CC-BY, and the manifest says `LicenseRef-Adolence`. Do not
lift them for another mod. The conversion script and the manifest are the
port's own. The original's authors asked that anyone using their work be
credited in the contributors list, and the author field and this file do that.
The package itself (`rusted-warfare-mods/`) is not part of this repository.

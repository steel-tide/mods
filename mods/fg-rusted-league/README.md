# FG Rusted League (FG 铁锈联盟)

A port of *FG铁锈联盟*, a Rusted Warfare build by 空中之主 with art by 有人, 基卡
and SS元首, made with the author's permission. It is not a mod folder but a
whole Rusted Warfare 1.13.3 package with its army redrawn: the builder, the
tanks, the factories and the turrets, every hull in black and acid green, under
a Red Alert roster's names — the Grizzly, the Prism tank, the Tesla tank, the
Patriot battery. On top of that sits its own plugin, *GF插件*, with carriers,
dreadnoughts, sky fortresses, a nuclear submarine, a superweapon or two and a
hero tank that ranks up.

What comes across is the roster, the art, and the behaviour the game's mod
rules can carry: units that change shape or dig in, a hero that ranks itself
up, a tank that hides as a tree, carriers that fly their own planes, shields,
beams and bases that go up like bombs. What stays behind is the rest of the
original's scripting: the money buttons, and the bug faction the command
centre could be switched to (its art is Rusted Warfare's own).

## What is in it

Enable the mod, then choose **FG Rusted League** for a seat in the Conquest or
Breakthrough setup. A Conquest base starts with a **League Command** and two
**Builders**. The command supplies territory and production slots, trains more
builders, and can be rebuilt by a Builder or Multi-Role Rocket Truck. No vanilla
HQ or engineer is needed. The Construction Ship and Supply Ship place the naval
base and defences from the water.

The command supplies 60 power for the opening mines and factories until the
League can afford its nuclear generator. The faction uses the League roster;
the original bug toggle remains outside this port, as described above.
Faction selection requires Steel Tide 0.8.14 with format 2 support.

Some of its units build others, as they do in the original: the Lord of the Sky
and the Battle Carrier launch helicopters, jets and gunships (and the Lord of
the Sky the Carrier Airship), the Judgment-class battleship support ships and
amphibious tanks, the Land Cruiser builders, Grizzlies and heavy amphibious
tanks, the Littoral Combat Ship submarines, the Battlecruiser its hover
escorts, the Laser UFO the teleporter, and the rocket truck artillery, tank
destroyers and submarines. Select one and its production is on the card beside
its orders; each unit it builds is launched beside it, wherever it has got to.

33 buildings:

| building | what it does |
| --- | --- |
| League Command | headquarters; trains the builder, guns down anything in range, earns 1.75 a second, +60 power |
| Army Base → II | the tanks and vehicles |
| Air Force Base → II | helicopters and jets |
| Naval Base → II | the fleet, and the flying Aircraft Carrier; stands on the water by a shore |
| Ore Mine → II → III | an extractor on a deposit, 1.4, 3 and 8 a second |
| Sentry Gun → II → III, Artillery Emplacement, Flamethrower Turret | ground defences |
| Patriot Missile → II → Absolute Domain, Flak Cannon | air defences; the Absolute Domain hits the ground too |
| Prism Defence Tower → II | shoots down shells and missiles aimed at the base |
| Repair Depot | mends what is parked nearby |
| Battle Lab | unlocks the top tier: the T3 factory, the black-tech factory, the silo, the superweapons |
| T3 Factory | the Apocalypse, the Mirage tank, the V3, the Kirov, the Lord of the Sky |
| Black-Tech Factory | the Experimental Tank, the Star Warship, the Battlecruiser, the B-52, the Laser UFO, the Land Cruiser |
| Tactical Airfield | the gunship platforms |
| Nuclear Missile Silo | builds and launches warheads |
| Colossus Gun, Proton Collider Cannon | long guns; the proton cannon reaches across the map |
| Floating Array | an alien platform that hovers over the base |
| Overloaded Nuclear Generator | the League's nuclear power station: +150 power, and money, fast |
| Hero Barracks, Hero Tower | the barracks trains the hero tank; the tower lets a Lv3 hero reach its MAX |

101 units: 30 on the ground, 32 in the air, 17 at sea and the 22 ranks of the
hero tank. Twelve of them are forms or planes rather than units a line builds:
the Mirage's disguise, the Amphibious Jet under water, the three deployed
forms, the Aircraft Carrier's four levels, and the three carriers' planes.

The hero tank ranks up as it does in the original. The barracks trains the
Lv1 tank. Its card offers three Lv2 lines, each of those three Lv3s, and each
Lv3 its MAX. The tank changes in place: it keeps its orders, its kills and
its share of health. Each rank costs the difference between the two ranks'
prices and takes the time that metal would buy. One Lv3 of each line needs a
standing Army Base II (the original's second-level mech factory), and every
MAX needs a Hero Tower. The computer ranks its heroes up too.

The shape-changers change shape from their cards: the Tengu between jet and
mech, the Striker between gunship and walker, the Skyshaker and the Jiaolong
between air and sea, and the Amphibious Jet between flying and diving under
the sea. The Siege Tank, the Multiple Rocket Launcher and the Pacifier *Deploy*
where they stand, into forms that reach further and hit harder but cannot move
until they *Pack Up* (the Pacifier only on land). The change takes a few
seconds, is free, and waits for ground the new form can stand on.

The Aircraft Carrier builds interceptors from its card, one at a time, as a
building takes its upgrades: four on its deck to begin with, eight at the
most, and the last level recharges them far faster.

Three carriers fly planes of their own: the Light Carrier eight attack
drones, the Carrier Airship ten small drones (it has no guns besides), and the
Littoral Combat Ship one ASW plane, which hunts what the ship's sonar hears.
The planes take off at what their carrier fights — what it is sent at, or else
the nearest enemy in reach — come back to reload when the fight is over or
their sortie is up, and are made again for nothing when they are lost. They are
not the player's to select or order; a carrier sent at a target with no guns
of its own closes to its planes' reach and waits there.

The Mirage tank turns into a tree once it has stood still for a second. It
turns back into a tank the moment it moves or fires. As a tree it is seen only
from three tiles away, and nothing on the other side can be ordered to fire on
it; a blast still reaches it. In the original the tank stays hidden while it
moves too. Here it shows itself when it moves, as in Red Alert, and as the
tank's frames say: two tank frames for moving and three tree frames for
standing.

Units with a shield in the original have one here, drawn over the health bar,
which recharges a little after the last hit. Units that mend themselves in the
original do here, at no more than half a percent of their hull a second. The
Tesla tank, the Prism tank, the Shield Tank, the Laser UFO, the Wasp and a few
heroes fire beams: a laser, or a lightning bolt that jumps from gun to target.
The V3, the Battlecruiser and the Skyshaker fly their own rounds. The Lord of
the Sky, the Battlecruiser, the Battle Carrier and the Supply Ship earn metal,
as they do in the original. The reactor, the battle lab, the proton cannon,
the hero tower, the B-52, the Battlecruiser and the teleporter blow up where
they die. The blast spares their own side.

## The map

*Proving Ground* (试验场, `maps/proving-ground.steel-tide-map`) stands the
whole mod on one field: every building and every unit in it, 132 pieces (the
Mirage puts on its own disguise). Seat 0
opens in the south-west on a League base built out along the north edge — the
command, the factories and their second levels, the three ore mines, the
turret line, the labs and the superweapons — with the army formed up on the
plain, the heroes in their ranks, the air wing over the base and the fleet in
the bay beside the two naval bases. Seat 1 opens in the east behind a Steel
Tide army dug in across the rough ground. `make-map.py` writes it from the
roster, and fails if a def is missing or a piece would overlap another or
stand on the wrong ground.

## The numbers

The League keeps Rusted Warfare's own balance, so its numbers go through the
calibration the Rusted Expansion mod uses for Rusted Warfare's stock roster:
prices ×0.8, hit points ×2.9, ranges ×0.7 in tiles and damage ×1.6, so its
Grizzly lands beside the Bison. The plugin's giants are compressed at the top —
the Battlecruiser costs 75 000 in the original, and is capped at 6000 metal
here — and every unit's damage a second is kept within sight of its price.
Buildings are priced ×0.6 and armoured ×1.25, the way the game's own are.
Income follows the original's extractor: its 8 credits a second is this game's
1.4 metal. Two stand above their price at the author's word, as they do in the
original: the B-52 drops three times the damage its price would give it, and
the Proton Collider Cannon reaches 60 tiles with a blast three tiles wide.

The numbers of the units Rusted Warfare hard-codes — the builder, the tank,
the factories and the turrets — live in its bytecode, not in an ini file.
`rw-dex.py` reads them out of the package's `classes.dex` with the Android SDK's
`dexdump` into `rw-core.json`.

## The art

Only the League's own pictures ship. Every image the converter uses is compared
with the same file in a stock Rusted Warfare build, and one that matches it is
Corroding Games' art and is left out. The Mega Tank, the Ladybug, the dropship,
the anti-nuke, the fabricator and the supply depot kept their stock look in
the League, so they are not here; nor are the bugs.

Helicopters carry their rotor spinning in their frames in the original; the
converter keeps the pixels most frames agree on, which is the hull, and the
game lays its own rotor over it. The Aircraft Carrier's interceptors, which the
original launches as planes that live for two seconds, are its guns here. The
Carrier Airship's hull is Rusted Warfare's own, so it wears the League's Kirov. Weapons fire with the game's own sounds for their kind.

The art of the Strategic Bomber comes, the original says, from *未来战争*
("Future War").

## Rebuilding

The package is not part of this repository. With it unpacked at
`rusted-warfare-mods/skycraft` and a stock Rusted Warfare at `rusted-warfare`:

```
python3 mods/fg-rusted-league/port-fg.py
python3 mods/fg-rusted-league/make-map.py
```

`--dry` prints the conversion without writing, `--dump <name>` a unit's merged
ini. `rw-dex.py` only needs rerunning for a different build of the package.

## Licence

The art and the design are the FG Rusted League authors'. They are shared here with
their permission, for Steel Tide, and are not free to reuse elsewhere.

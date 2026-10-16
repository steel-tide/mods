# Making a Steel Tide mod: a brief for a coding agent

You are helping make a mod for Steel Tide (https://steelti.de), a browser real-time strategy game.
A mod adds units, buildings and upgrade levels, and gives them behaviour of their own — forms they turn into, units they spawn, buttons on their cards, planes they carry, weapons that look like nothing in the game (see Behaviour). It cannot change the game's rules, its interface, or an existing unit or building: it only adds, and everything it adds is switched off with it.
Read this whole brief once, then work from the tables. When in doubt, prefer the smallest mod that plays.

## What a mod is

A folder:

```
my-mod/
  mod.json          the manifest: the mod's identity, its defs, and the sheets they draw with
  sprites/*.png     optional art (a def without any is drawn as a plain placeholder)
  screenshots/*.png the mod in play, 4:3 (the registry asks for at least one; see Publish)
  maps/*.steel-tide-map  optional maps from the Scenario Editor, offered in the setup screens while the mod is on (see Maps)
  README.md         optional
```

Published mods live in https://github.com/steel-tide/mods under `mods/<id>/`; the game lists that registry under Settings → Mods, and the website at https://steelti.de/mods.

## The manifest, minimal

One vanilla unit copied and re-tuned. `extends` inherits everything (art, weapons, where it is built) and every field you name overrides it:

```json
{
  "format": "steel-tide-mod",
  "v": 4,
  "id": "bison-ii",
  "name": [
    "Bison II",
    "野牛 II"
  ],
  "version": "1.0.0",
  "author": "you",
  "description": [
    "A heavier Bison for the late game.",
    "后期用的重型野牛。"
  ],
  "defs": [
    {
      "id": "bison2",
      "extends": "mbt",
      "name": [
        "Bison II",
        "野牛 II"
      ],
      "desc": [
        "Thicker plate, a bigger gun, and a bigger bill.",
        "更厚的装甲、更大的炮，也更贵。"
      ],
      "tier": 3,
      "cost": 520,
      "hp": 1100,
      "speed": 52,
      "requires": [
        "radar"
      ],
      "weapons": [
        {
          "id": "cannon",
          "cls": "cannon",
          "dmg": 90,
          "reload": 2,
          "range": 5,
          "splash": 12,
          "turret": true,
          "muzzleOffset": 23
        }
      ],
      "aiWeight": 2
    }
  ]
}
```

## The manifest, deeper

Own art, a defended building, and a fourth level for a vanilla building line:

```json
{
  "format": "steel-tide-mod",
  "v": 4,
  "id": "ironworks",
  "name": [
    "Ironworks",
    "铁工厂"
  ],
  "version": "1.0.0",
  "author": "you",
  "description": [
    "A hover tank, a bunker and a fusion plant.",
    "一辆悬浮坦克、一座碉堡和一座聚变电站。"
  ],
  "license": "CC-BY-4.0",
  "defs": [
    {
      "id": "ironworks-hover",
      "name": [
        "Skimmer Hover Tank",
        "掠行悬浮坦克"
      ],
      "desc": [
        "Fast, thin-skinned, rockets.",
        "快、皮薄、打火箭。"
      ],
      "kind": "unit",
      "domain": "ground",
      "tier": 2,
      "cost": 260,
      "hp": 320,
      "armor": "light",
      "speed": 110,
      "turnRate": 5,
      "radius": 9,
      "body": {
        "r": 10,
        "len": 10
      },
      "trail": "tire",
      "weapons": [
        {
          "id": "pods",
          "cls": "rocket",
          "dmg": 16,
          "reload": 2.2,
          "range": 4.5,
          "burst": 4,
          "burstDelay": 0.1,
          "splash": 10,
          "spread": 14
        }
      ],
      "producedBy": [
        "factory2",
        "factory3"
      ],
      "aiWeight": 1
    },
    {
      "id": "ironworks-bunker",
      "name": [
        "Bunker",
        "碉堡"
      ],
      "desc": [
        "A gun pit that takes a beating.",
        "扛打的火力点。"
      ],
      "kind": "building",
      "cost": 380,
      "hp": 1600,
      "fw": 2,
      "fh": 2,
      "power": -3,
      "vision": 8,
      "weapons": [
        {
          "id": "gun",
          "cls": "autocannon",
          "dmg": 22,
          "reload": 0.5,
          "range": 5,
          "turret": false,
          "targets": [
            "ground",
            "ship"
          ]
        }
      ]
    },
    {
      "id": "ironworks-fusion",
      "name": [
        "Fusion Plant",
        "聚变电站"
      ],
      "desc": [
        "The plant line's fourth level.",
        "发电厂线的第四级。"
      ],
      "extends": "power3",
      "upgradeOf": "power3",
      "cost": 2200,
      "hp": 2600,
      "power": 500,
      "upgradeCost": 1100,
      "upgradeTime": 60,
      "requires": [
        "radar",
        "reactor"
      ]
    }
  ],
  "sprites": [
    {
      "key": "u.ironworks-hover",
      "file": "sprites/u.ironworks-hover.png",
      "frames": 1,
      "rotated": true,
      "fw": 24,
      "fh": 26
    },
    {
      "key": "u.ironworks-bunker",
      "file": "sprites/u.ironworks-bunker.png",
      "frames": 1
    }
  ],
  "screenshots": [
    "screenshots/skimmers.png"
  ]
}
```

## Fields

Unknown ordinary fields produce a warning. Format-3 extension objects reject unknown fields and unsupported combinations. Numbers outside the stated range are errors.

### mod.json (top level)

| field | type | required | default | meaning |
| --- | --- | --- | --- | --- |
| `requiredCapabilities` | capability id[] |  |  | Required package-provided capability IDs |
| `extensionPackages` | { id, version, api, capabilities, schema, runtime, presentation? }[] |  |  | Versioned extension packages with SHA-256 verified schema, simulation and optional presentation modules (format 4) |
| `format` | string | yes |  | always "steel-tide-mod" |
| `v` | integer 1–4 | yes |  | format version: 1 remains supported; factions and headquarters require 2; capability data requires 3; executable extension packages require 4 |
| `id` | id | yes |  | the mod's id: lower case, letters, digits, `-`; also its folder in the registry |
| `name` | text | yes |  | the name shown in the mod list |
| `version` | string | yes |  | e.g. `1.0.0`; the game offers an update when the registry's is newer |
| `author` | string |  |  | who made it |
| `description` | text |  |  | one or two sentences for the list |
| `homepage` | string |  |  | a link: a repository, a thread |
| `license` | string |  | CC-BY-4.0 | the mod's licence (SPDX id) |
| `minGame` | string |  |  | the oldest game version it is written for |
| `defs` | def[] | yes |  | the units, buildings and upgrade levels; may be empty when terrains, music queues or menu backgrounds are supplied |
| `factions` | faction[] |  |  | selectable factions, each with its own headquarters, starting builder and roster (format 2) |
| `terrains` | terrain[] |  |  | up to 32 map-selected terrain variants; preserve their base terrain’s gameplay |
| `sprites` | sheet[] |  |  | the sheets the defs draw with (see below) |
| `music` | { tracks, menu, setup, battle } |  |  | custom BGM tracks and ordered menu, setup and battle queues (see below) |
| `menuBackground` | { cuts, queue } |  |  | ordered home-menu cut queue, mixing original scenes and this pack’s maps (see below) |
| `sounds` | sound[] |  |  | the recordings the weapons fire with (see below) |
| `screenshots` | path[] |  |  | pictures of the mod in play, relative to mod.json (`screenshots/1.png`): 4:3, at least 640 px wide, under 2 MB each, up to 8. The registry asks for at least one and shows them on the mod's page |
| `maps` | string |  |  | maps the mod carries, relative to mod.json (`maps/city.steel-tide-map`): files exported from the Scenario Editor, up to 8, each under 512 KB. A map may stand the mod's own units; the setup screens offer it beside the player's own map while the mod is on |
| `files` | { path: dataURL } |  |  | single-file form only: the sheets, sounds, music and maps, embedded as data URLs by path |

`name`, `description` and every `desc`/`name` on a def are *text*: a string (used for every language), `["English", "中文", "한국어"]` in that order, or `{ "en": "…", "zh": "…", "ko": "…" }`. Only English is required; a language left out reads as English.

### Extension packages (format 4)

Format 4 packs carry `extensionPackages`: versioned, SHA-256 verified schema, simulation and optional presentation code. The engine provides host API version 1 and no built-in gameplay capability catalog. Declare package-provided IDs in `requiredCapabilities`, then put their data under `extensions[id]`. Only content which requests extensions prepares the optional host. Extension code is executable trusted code, not sandboxed data.
Executable packages require `v:4`. Formats 1 and 2 and ordinary format 3 data remain supported; former built-in capability packs need compatible implementations embedded in format 4. A missing/unsupported capability rejects activation. Vanilla keeps its ordinary simulation; optional state and update work belong to the enabled match. The shared combined-arms package requires complete non-empty `[en, zh, ko]` label tuples and accepts the fixed data policies its own schema defines.

Read [components, protection, crew, ammunition and services](https://github.com/steel-tide/mods/blob/main/docs/engine-compatibility/M1-M2-AUTHORING.md) and [sensors, guidance, mounts and deployment](https://github.com/steel-tide/mods/blob/main/docs/engine-compatibility/SENSORS-ARTICULATION-V1.md) for the exact accepted fields, bounds, defaults, units, actions and explicit omissions. [Runnable study fixtures](https://github.com/steel-tide/mods/tree/main/docs/engine-compatibility/fixtures) are isolated acceptance examples, not full source-mod ports.

For locally chosen content, game/API consumers must `await prepareContentSchema(raw, true)` before synchronously calling `parseDefinitionPack(raw)` or `parseMod(raw)` on capability-bearing content; await `prepareContentCapabilities(packs)` before opening a match. For a world, prepare its embedded packs by passing the raw world to `prepareContentSchema`. Registry tooling likewise explicitly approves local files. Network inputs use `prepareContentSchema(raw)` and cannot approve unknown code. Read the extension framework guide in the mod repository for package ownership, trust and SDK details. Never ignore a schema or capability loading failure.

The shared inspection model exposes private state and available actions only to authorized viewers. Actions go through `contentAction` and the ordinary commands/orders gateway. The CLI exposes the same interface with `steel content-action <units> <module> <action> [--choice id] [--target id] [--at x,y]`. Port only source combinations the contract represents faithfully; omit and document unsupported behavior.

### A faction (`factions[]`, format 2)

| field | type | required | default | meaning |
| --- | --- | --- | --- | --- |
| `id` | id | yes |  | unique faction id, prefixed with the mod id and a dash |
| `name` | text | yes |  | the faction name in game setup |
| `headquarters` | id | yes |  | this mod’s land headquarters definition |
| `builder` | id | yes |  | this mod’s ground or amphibious builder; the HQ must produce it and it must rebuild the HQ |
| `roster` | id[] |  |  | permitted definitions, including prerequisites and upgrades; defaults to all definitions in this mod |

A faction is selected per seat in Conquest and Breakthrough. It changes the headquarters, starting builders and allowed build/production roster; teams and victory rules still belong to the match. The chooser is hidden with only Steel Tide available. The HQ must produce its builder, and that builder must rebuild its HQ. Both must belong to this mod. A starting HQ has no prerequisites; its builder may require only that HQ. Roster building prerequisites must also be in the roster. Format 1 mods continue to work unchanged.

### A terrain variant (`terrains[]`)

| field | type | required | default | meaning |
| --- | --- | --- | --- | --- |
| `id` | id | yes |  | unique terrain variant id, prefixed with the mod id and a dash |
| `name` | text | yes |  | the terrain style name in the editor |
| `base` | grass \| sand \| road \| mud \| marsh \| snow \| rubble \| ice \| city | yes |  | the existing terrain whose movement, construction and combat behavior stays unchanged |
| `texture` | string |  |  | flat terrain material: a ter.<mod id>-<name> sheet in this pack; city uses its city materials instead |
| `city` | { roof, wall, window, lamp, roofTexture, wallTexture, groundTexture, signTexture, accent, accent2, architecture } |  |  | materials, lights and optional visual architecture; only with base city |

Terrain variants add map-selected appearances without changing terrain numbers, movement, construction, cover or city destruction. Enabling a mod alone never repaints a vanilla map. A map opts in with `"terrainVariants": { "city": "my-mod-city" }`; the editor preserves these bindings in saves and exports. Missing or disabled content renders the ordinary base terrain, even when old images remain cached. A terrain-only pack uses `"defs": []`.

Terrain materials are single-frame, square sheets named `ter.<mod id>-<name>`, declared in `sprites` with equal whole `fw` and `fh` (4–512; 128 recommended). `teams`, `stripBg`, `rotated`, `fitFootprint` and `freezeStatic` are false; their false defaults preserve the image. Anchors, mounts, animation states/regions and pivots are not supported. Keep flat materials opaque and seamless, without painted buildings, text, cast shadows or transparent cutouts. `city.signTexture` may instead contain sign artwork. A variant can reference only terrain sheets in its own pack.

#### City appearance (`terrains[].city`)

| field | type | required | default | meaning |
| --- | --- | --- | --- | --- |
| `roof` | string |  |  | roof color, #RRGGBB |
| `wall` | string |  |  | wall color, #RRGGBB |
| `window` | string |  |  | lit window color, #RRGGBB |
| `lamp` | string |  |  | streetlamp color, #RRGGBB |
| `roofTexture` | string |  |  | roof material, a ter.<mod id>-<name> sheet in this pack |
| `wallTexture` | string |  |  | wall material, a ter.<mod id>-<name> sheet in this pack |
| `groundTexture` | string |  |  | courtyard material, a ter.<mod id>-<name> sheet in this pack |
| `signTexture` | string |  |  | 4×4 atlas of 16 square signs in row-major order, a ter.<mod id>-<name> sheet in this pack; custom architecture selects a cell per building |
| `accent` | string |  |  | primary architectural lighting color, #RRGGBB |
| `accent2` | string |  |  | secondary architectural lighting color, #RRGGBB |
| `architecture` | { forms, minStoreys, maxStoreys, coverage, greenery, equipment, facade } |  |  | optional building kit; omitted keeps ordinary city geometry |

A city variant supplies colors, materials or a visual architecture kit while preserving city tile collision, cover and destruction rules. Without `architecture`, city geometry stays exactly ordinary. Flat base terrains require `texture`; cities instead use `roofTexture`, `wallTexture` and `groundTexture`, with `signTexture` for architectural signs. Unsupported bases such as water, forest and cliffs cannot be declared as flat material variants.

#### City architecture (`terrains[].city.architecture`)

| field | type | required | default | meaning |
| --- | --- | --- | --- | --- |
| `forms` | (slab \| court \| terrace \| stepped)[] |  | slab, court, terrace, stepped | distinct building forms to mix: slab blocks, courtyard blocks, terraces and stepped towers |
| `minStoreys` | integer 1–4 |  | 2 | minimum target storeys for the main building; smaller lots and wings may be shorter; must not exceed maxStoreys |
| `maxStoreys` | integer 1–4 |  | 4 | maximum target storeys for the main building; does not change terrain height or cover |
| `coverage` | number 0.35–0.9 |  | 0.72 | building coverage within each visual lot |
| `greenery` | number 0–1 |  | 0.1 | decorative vegetation density |
| `equipment` | number 0–1 |  | 0.65 | rooftop machinery and service equipment density |
| `facade` | ribbon \| panel \| industrial |  | panel | wall structure: ribbon windows, panel cladding or industrial frames |

The optional kit changes visible building forms, storeys, lot coverage, planting, rooftop equipment and facade treatment. It never changes terrain height, passability or combat. `forms` lists distinct supported forms. Storey bounds use the documented defaults when omitted and must satisfy `minStoreys <= maxStoreys`. The existing damage states still control collapsed buildings and extinguished signs.

`signTexture` is a 4×4 atlas of 16 square signs in row-major order; a building’s deterministic seed selects one cell. Use equal `fw`/`fh` divisible by 4 (128 recommended), with dark unlit backing and bright lettering or symbols. Pixels whose strongest RGB channel exceeds 120 emit their own color at night. The image is one frame, not a horizontal 16-frame animation strip. Missing sign artwork uses procedural glyphs.

### A def (`defs[]`)

| field | type | required | default | meaning |
| --- | --- | --- | --- | --- |
| `extensions` | { capability: configuration } |  |  | Configuration keyed by a required engine capability (format 3) |
| `isHQ` | boolean | buildings only |  | a headquarters: holds territory and production slots, follows the ordinary HQ loss and sale rules; format 2 |
| `id` | id | yes |  | unique across every mod and the vanilla roster; prefix a generic word with your mod's id |
| `name` | text | yes |  | as the HUD shows it |
| `desc` | text |  | "" | the tooltip line |
| `extends` | id |  |  | a vanilla def id (or an earlier def of this mod) to copy, then override field by field; inherits its art and where it is built |
| `kind` | unit \| building | yes |  | a unit or a building (required unless `extends` says) |
| `domain` | ground \| ship \| air \| amphibious | units only | ground | where it moves; a submarine is a `ship` with `underwater`, and an `amphibious` hull drives and swims (a ship target afloat, a ground one ashore) |
| `tier` | integer 1–3 |  | 1 | the factory level it appears at, and the badge |
| `cost` | number 0–99999 | yes |  | metal |
| `buildTime` | number 0–3600 |  | cost ÷ 14 | seconds at full power |
| `pop` | integer 0–50 |  | 1 for a unit, 0 for a building | population it counts for |
| `hp` | number 1–1000000 | yes |  | hit points |
| `armor` | light \| medium \| heavy \| ship \| sub \| air \| structure |  | by domain | the armour class weapons are multiplied against |
| `impactMaterial` | armor \| earth \| concrete |  | concrete for structure armor, armor otherwise | projectile-impact sound material; does not change damage. Both ordinary and heavy impacts use the matching recorded family |
| `directionalArmor` | { front, side, rear } | units only |  | ground hull direct-hit multipliers `{front, side, rear}`, each 0–10; 90° front/rear arcs and 90° on each side. Arc fire, collateral blasts, mines and fire ignore facing. Enables slow reversing for short moves behind the hull |
| `speed` | number 0–1000 | units only | 60 | world px/s (a tile is 32) |
| `turnRate` | number 0–50 | units only | 3.5 | rad/s |
| `vision` | number 0–64 |  | 8 | sight, in tiles; rounded to the nearest whole tile when activated |
| `radius` | number 1–200 |  | 9, or the footprint | collision radius, world px, and the *combat* yardstick: range, splash and hits are measured to it |
| `body` | { r, len } | units only | the circle of `radius` | the room the hull takes up when units push each other apart, world px: `r` its half-width, `len` its length less the two round ends. A long hull is what a circle cannot say. A ship whose beam (`r` twice) is over a tile (32) needs that many tiles of water abeam, rounded up: it never enters a channel narrower than itself |
| `weapons` | weapon[] |  | [] | the weapons (see below); an empty list is unarmed |
| `fw` | integer 1–8 | buildings only | 2 | footprint width, tiles |
| `fh` | integer 1–8 | buildings only | 2 | footprint height, tiles |
| `producedBy` | id[] | units only | the line for its domain, from its tier up | the buildings whose production list it joins (vanilla or this mod's), or units of this mod that train it (a carrier) |
| `produces` | id[] |  |  | a factory: the units it builds. On a unit, a carrier or a mothership that trains them itself: each is launched beside it, wherever it has got to |
| `builtBy` | id[] | buildings only | ["engineer"] | the builder units that may place it |
| `builds` | id[] | units only |  | a builder unit: the buildings it can construct |
| `buildRate` | number 0–10000 | units only |  | a builder unit: hp of work per second |
| `reach` | number 0–256 | units only |  | a builder unit: how far past a target's radius it works from, world px (the engineer's 46 when unset; the engineer boat's 64) |
| `power` | number -10000–10000 |  | −pop for a unit, 0 for a building | positive produces, negative draws; every unit draws its population |
| `metalRate` | number 0–1000 |  |  | metal per second: an extractor, or a unit that earns (a supply ship) |
| `needsDeposit` | boolean | buildings only |  | must stand on a deposit |
| `offshore` | boolean | buildings only |  | stands in open water on its own legs: every footprint tile sea, no shore needed; with needsDeposit, an ore field at sea, which only a builder on the water (the engineer boat) can reach |
| `wall` | boolean | buildings only |  | a wall: one tile that joins its neighbours of the same def (its sheet is sixteen frames, one per set of neighbours: north 1, east 2, south 4, west 8), the last thing a gun shoots at, untouched by a pulse, and it falls without a charge |
| `repairRange` | number 0–64 | buildings only |  | a repair aura, tiles |
| `repairRate` | number 0–10000 | buildings only |  | hp per second per target |
| `repairTargets` | integer 1–50 | buildings only |  | targets served at once |
| `upgradeOf` | id | buildings only |  | the building this is the next level of; that one gains the upgrade button |
| `upgradeCost` | number 0–99999 | buildings only | cost − the source's cost | with `upgradeOf`: the upgrade's price |
| `upgradeTime` | number 0–3600 | buildings only | buildTime | with `upgradeOf`: seconds |
| `requires` | id[] |  |  | building ids that must stand before it can be built, or tech node ids that must be researched (`suicideDrones`, `activeProtection`…) |
| `nukeCapacity` | integer 0–10 |  |  | a launcher: warheads it holds |
| `nukeCost` | number 0–99999 |  |  | a launcher: metal per warhead |
| `nukeTime` | number 0–3600 |  |  | a launcher: seconds per warhead |
| `armsAtBase` | number 0–64 | units only |  | a launcher: fabricates its warheads only within this many tiles of one of its own bases of its kind (a naval yard for a hull, an airbase for an aircraft; and, an `underwater` one, only on the surface), and holds the work otherwise (the Kraken's and the Wraith's 4) |
| `rearmTime` | number 0.1–600 |  | 15 | seconds to fill every gun that carries `ammo` from empty, at a base of its kind |
| `hatch` | number 0–30 |  |  | a launcher: seconds its doors take to open before the warhead leaves, and to close after; none fires on the spot |
| `antiWarhead` | boolean |  |  | its anti-air may fire on a nuclear warhead without a veteran's rank |
| `interceptRange` | number 0–64 |  |  | point defence: reach in tiles |
| `interceptMag` | integer 1–200 |  |  | point defence: rounds ready |
| `interceptReload` | number 0.05–600 |  |  | point defence: seconds per round replaced |
| `interceptMuzzleOffset` | number 0–200 |  |  | point defence: launcher length, world px |
| `transportCap` | integer 1–50 | units only |  | a transport: hold, in cargo weight |
| `transportMaxWeight` | number 0–50 | units only | transportCap | a transport: maximum cargo weight of one passenger |
| `cargoReach` | number 0.5–4 | units only | 1 | a transport: how far its load and unload distances stretch, as a multiple of the default (the landing craft's 1.1, the Moray's 1.5); on a ship it widens the ground its ramp reaches too |
| `landsForCargo` | boolean | units only |  | a cargo plane that touches down to load |
| `cargoWeight` | number 0–50 | units only | pop | how much of a hold it takes |
| `underwater` | boolean | units only |  | a submarine: seen only by sonar |
| `sonar` | number 0–64 | units only |  | sonar range, tiles |
| `stealth` | number 0–64 | units only |  | seen only within this many tiles of an enemy |
| `detect` | number 0–64 |  |  | reveals stealth within this many tiles |
| `radar` | boolean |  |  | sees by radio: the sight circle ignores weather and the hour, and drops to 7 tiles when short of power |
| `remoteVision` | boolean | units only |  | remote camera feed: hostile jamming blocks its sight within the field |
| `jamRange` | number 0–64 | buildings only |  | electronic-warfare radius in tiles; requires full power, reveals its location, blocks hostile radar and remote vision, never visual sight or sonar |
| `hovers` | boolean | units only |  | an aircraft that hovers instead of orbiting |
| `kamikaze` | boolean | units only |  | the unit is its own round: it never picks a target, and its one weapon flies it into what it is ordered at (the Hornet) |
| `lowFlying` | boolean | units only |  | an aircraft at treetop height: machine guns and autocannons that fire on the ground reach it too (the helicopters and the Hornet) |
| `limit` | integer 1–200 | units only |  | at most this many a faction at once, alive and queued together (the Hornet's 10) |
| `altitude` | number 0–64 | units only | 12 | an aircraft's drawn height, px |
| `fireOnMove` | boolean | units only |  | keeps shooting on a plain move |
| `burnMult` | number 0–4 | units only | 1 | what fire on the ground does to it, as a multiplier (the Drake's 0.5) |
| `trail` | tread \| tire \| wake \| none | units only | by domain | the mark it leaves, and the sound of it: treads and tyres are heard rolling; `none` for a unit on foot or a hovercraft, which neither cuts a rut nor is heard as an engine |
| `shadow` | boolean |  | true | the shadow the game casts for it: a unit's hull and turret silhouettes, a step to the south-east on the ground, further off in the air; a building's gun's, on its roof; `false` when the art brings its own, or none is wanted (a submarine casts none) |
| `sprite` | string |  | this mod's u.<id> sheet, else the base's art | the body's atlas key: one of this mod's sheets, or a vanilla key to borrow its art |
| `turretSprite` | string |  | this mod's tur.<id> sheet, else the base's (when its art is kept) | the rotating part's key, if any |
| `turretMounts` | mount[] |  | one, where the body sheet's `mount` puts it (else the pivot); the base's, when its art is kept | the rings its turret stands on and fires from, up to 8: a hull with several guns names one each (a battleship's A, B and X), every one drawn with the one `turretSprite` and trained on the one target, as far round as its own arc goes (see below) |
| `decals` | decal[] |  | the base's, when its art is kept | pictures laid on the hull and the turret besides their own sheets (see below), up to 12 |
| `ability` | sprint \| afterburner \| smoke \| incendiary \| barrage \| countermeasures \| damageControl \| emergencyRepair | units only | the base's | its one active ability, a vanilla one by id (`sprint`, `smoke`, `countermeasures`…): the same click, clock and unlock as on the game's own units |
| `aliases` | string[] |  |  | other names the console's `give` accepts |
| `aiWeight` | number 0–10 | units only | 0 | how readily the AI builds it: a Bison is 3, a scout car 1; 0 never |
| `rules` | rule[] |  |  | its behaviour: rules that turn it into another form, spawn, heal, pay, buff or blow up, on an event, a condition, a clock or a button (see Behaviour), up to 24; never inherited through `extends` |
| `shield` | { hp, regen, delay } |  |  | an energy shield, `{ hp, regen, delay }`: it takes harm before the hull does, and recharges `regen` a second once unhurt for `delay` seconds |
| `regen` | number 0–10000 |  |  | hit points a second it mends itself by |
| `untargetable` | boolean |  |  | nothing on the other side may pick it as a target or be ordered to attack it; a blast still reaches it (a disguise, a decoy) |
| `wing` | { unit, count, rebuild, sortie, rearm, range } | units only |  | a carrier: planes of this mod it keeps aboard, `{ unit, count, rebuild, sortie, rearm, range }`, sent out at what it fights, taken back to rearm and made again when lost; never the player's to order (see Behaviour); never inherited through `extends` |

Defaults when `extends` is absent: a unit is `domain: "ground"`, `tier: 1`, `pop: 1`, `speed: 60`, `turnRate: 3.5`, `vision: 8`, `radius: 9`, no `body` (units part on the circle of `radius`), armour by domain (ground and amphibious `medium`, ship `ship`, air `air`), a tread trail on land (`trail: "none"` for a unit on foot, which is then not heard rolling either) and a wake at sea; a building is `fw: 2, fh: 2`, `armor: "structure"`, `power: 0`, `pop: 0`. `buildTime` defaults to cost ÷ 14 seconds.
Where a unit is built when `producedBy` is absent: its domain's line from its tier up (ground: T1 → factory+factory2+factory3, T2 → factory2+factory3, T3 → factory3; ship: T1 → navyard+navyard2+navyard3, T2 → navyard2+navyard3, T3 → navyard3; air: T1 → airbase+airbase2+airbase3, T2 → airbase2+airbase3, T3 → airbase3; amphibious: T1 → factory+navyard+factory2+navyard2+factory3+navyard3, T2 → factory2+navyard2+factory3+navyard3, T3 → factory3+navyard3).
An `upgradeOf` def becomes upgrade-only (never placed directly): the named building gains an Upgrade button that turns it into this def, at `upgradeCost` over `upgradeTime`. A building may have only one next level, so `upgradeOf` can name a vanilla building at the end of its line (`power3`, `factory3`, `extractor3`, `gatling`, `cannonturret2`, `samsite`, `interceptor2`, `radar`, `repairtower`, `reactor`, `nukesilo`) or one of this mod's.

### A weapon (`defs[].weapons[]`)

| field | type | required | default | meaning |
| --- | --- | --- | --- | --- |
| `extensions` | { capability: configuration } |  |  | Optional engine weapon configuration (format 3) |
| `id` | string |  | w1, w2… | a name for the weapon |
| `cls` | mg \| autocannon \| cannon \| at \| he \| rocket \| navgun \| ashm \| torpedo \| aa | yes |  | what it was built to kill; picks its row of the armour matrix |
| `dmg` | number 0–100000 | yes |  | damage per hit |
| `reload` | number 0.05–600 | yes |  | seconds between shots or bursts |
| `range` | number 0.5–64 | yes |  | tiles |
| `minRange` | number 0–64 |  |  | tiles it cannot fire inside |
| `projectile` | bullet \| shell \| missile \| rocket \| bomb \| torpedo \| flak \| flame |  | by class | the round drawn |
| `speed` | number 1–5000 |  | by projectile | round speed, world px/s |
| `targets` | (ground \| ship \| sub \| air)[] |  | by class | what it may fire at: ground, ship, sub, air |
| `mult` | { armour: number } |  |  | overrides of the class row, by armour class |
| `splash` | number 0–500 |  |  | blast radius, world px |
| `burst` | integer 1–32 |  |  | shots per burst |
| `burstDelay` | number 0–5 |  |  | seconds between the shots of a burst |
| `ammo` | integer 1–9999 |  |  | rounds carried, a burst one: dry, a unit goes home for more on its own (an airbase for an aircraft, a naval yard for a hull, a war factory for the rest) and a building refills where it stands; absent never runs dry |
| `vsWarhead` | number 0–10 |  | 1 | against a warhead in flight, this share of what it does to an aircraft |
| `homing` | boolean |  |  | the round tracks its target |
| `interceptable` | boolean |  |  | point defence may shoot it down |
| `arc` | boolean |  |  | a ballistic arc (artillery) |
| `turret` | boolean |  | true when the def has a turretSprite | fired from the rotating part |
| `recoil` | number 0–10 |  |  | cosmetic barrel recoil stroke, art px; requires barrel regions on the turret art, changes no weapon statistic |
| `vertical` | boolean |  |  | launched straight up out of the hull, like a submarine's missile tubes: it fires at any bearing and the hull never turns for it; `muzzleOffset` then runs along the keel to the tubes |
| `muzzleOffset` | number 0–200 |  |  | pivot to muzzle, world px; a unit's art is drawn 1.5625×, so measure on the sheet and multiply |
| `bores` | integer 1–8 |  | 1 | barrels, fired one after another |
| `boreSpacing` | number 0–60 |  |  | gap between adjacent barrels, world px |
| `muzzlePoints` | string |  |  | explicit muzzle positions, fired in list order: 1–8 `{ forward, lateral }` points in world px from the firing pivot (forward along the bore, lateral to its right; either may be negative); replaces `muzzleOffset`, `bores` and `boreSpacing` |
| `spread` | number 0–200 |  |  | inaccuracy at full range, world px |
| `friendlyFire` | boolean |  |  | the blast hurts your own side too |
| `fan` | number 0–1.5 |  |  | a `flame` jet: the half-angle it is sprayed across, radians |
| `burn` | number 0–1000 |  |  | a `flame` jet: damage a second the fire it leaves does, to both sides |
| `burnLife` | number 0–120 |  |  | a `flame` jet: seconds that fire keeps burning |
| `sound` | string |  | by class | the firing sound: mg, autocannon, cannon, missile, flak, arty, rocket, torpedo, bomb, flame, or the key of one of this mod's `sounds` |
| `look` | look |  |  | how it looks, in place of its class: its own round, flash, burst where it lands, or a beam (see Weapon looks) |

The damage a weapon does is `dmg × the armour matrix cell for (cls, target armour)`, with `mult` overriding single cells. The matrix:

```
mg          light ×1.5  medium ×0.8  heavy ×0.4  structure ×0.35  ship ×0.5  air ×0.7
autocannon  light ×1.5  medium ×1  heavy ×0.5  structure ×0.5  ship ×0.7  air ×0.35
cannon      light ×0.6  medium ×1.3  heavy ×1  structure ×0.8  ship ×0.9
at          light ×0.4  medium ×1.1  heavy ×1.8  structure ×0.7  ship ×0.75
he          light ×1.2  medium ×1  heavy ×0.75  structure ×1.6  ship ×1
rocket      light ×1.4  medium ×1.4  heavy ×0.9  structure ×0.7  ship ×0.9
navgun      light ×1  medium ×1  heavy ×0.75  structure ×0.75  ship ×1  air ×0.6
ashm        ship ×1.6
torpedo     ship ×1.3  sub ×1.2
aa          air ×1
```

### A decal (`defs[].decals[]`)

| field | type | required | default | meaning |
| --- | --- | --- | --- | --- |
| `sprite` | string | yes |  | the sheet drawn: one of this mod's `dec.<name>` sheets, or any body or turret key |
| `on` | hull \| turret |  | hull | what it is fixed to and turns with; `turret` needs a `turretSprite` |
| `layer` | under \| hull \| over |  | hull, or over when on a turret | where it goes in the stack: under the body, on the hull under the turret, or over everything |
| `x` | number -256–256 |  | 0 | where it sits on the part's up-facing art: px right of the pivot, in the sheet's own px at its `fw`×`fh` size (the game scales it with the unit) |
| `y` | number -256–256 |  | 0 | px down from the pivot, toward the tail |
| `angle` | number -360–360 |  | 0 | turned this much further than what it is fixed to, degrees clockwise |
| `upright` | boolean |  |  | never turned: laid screen-up wherever its anchor is |
| `scale` | number 0.05–8 |  | 1 | drawn at this multiple of its sheet's size |
| `alpha` | number 0–1 |  | 1 | opacity |
| `when` | always \| moving \| still \| firing \| damaged \| night \| ability |  | always | shown only while the unit moves or stands (`moving`, `still`), within a reload of its last shot (`firing`), under half health (`damaged`), while its ability runs or is armed (`ability`), or after dusk (`night`: laid over the dark like a lamp, and the game's own headlights stay off a unit that has one) |

A decal is a picture laid on a def besides its body and its turret — a hatch, a crew figure, an outline, a lamp — fixed to the hull or the turret (`on`) and turned with it. Up to 12 on a def, drawn in the order listed within a layer. `x`/`y` are a point on that part's up-facing art: right and down (toward the tail) of its pivot, in the px of the sheet at its `fw`×`fh` size; the game scales them with the unit. The sheet is one of the mod's own under a `dec.<name>` key (see Art), or a body or turret key it borrows. A `night` decal is a lamp: laid over the dark rather than dimmed by it, so a headlight or a lit window reads as light, and a unit that carries one gets none of the game's own headlights. Paint a beam soft — a wide, faint falloff, not a hard-edged triangle — or it reads as glass.

### A turret mount (`defs[].turretMounts[]`)

| field | type | required | default | meaning |
| --- | --- | --- | --- | --- |
| `x` | number -256–256 |  | 0 | where the ring is on the body's up-facing art: px right of its pivot, in the body sheet's own px at its `fw`×`fh` size (the game scales it with the unit) |
| `y` | number -256–256 |  | 0 | px down from the pivot, toward the tail |
| `rest` | number -360–360 |  | 0 | the bearing it trains about, degrees clockwise from the bow: 0 forward, 90 to the right, 180 aft |
| `arc` | number 0–180 |  | 180 | how far either side of `rest` it turns, degrees; 180 is all round. A ring that cannot bear on the target waits at the end of its arc, and the rings that can take the shots |

A hull with more than one gun — a battleship's turrets fore and aft, a tank with a turret at each corner — names a ring for each, up to 8: the def's one `turretSprite` is drawn on every ring, and every ring is trained on the one target the unit is aiming at, as far round as its own `arc` of its `rest` bearing goes, so a gun the superstructure blocks waits at its stop while the others fire. A burst walks the rings that bear (the first shot from the first of them, the next from the next), and `muzzleOffset` is measured from the ring a shot leaves, so give a weapon of several guns a `burst` of that many. `x`/`y` are a point on the body's up-facing art, as a decal's are. A def with none has one ring, where its body sheet's `mount` puts it.

### A sheet (`sprites[]`)

| field | type | required | default | meaning |
| --- | --- | --- | --- | --- |
| `key` | string | yes |  | `u.<id>` for a body, `tur.<id>` for a rotating part, `dec.<name>` for a decal, `prj.<name>` for a round and `fx.<name>` for an effect a weapon's look or a rule plays; `ter.<mod id>-<name>` for terrain materials; never a vanilla key |
| `file` | string | yes |  | the image, relative to mod.json (PNG, WebP or JPEG) |
| `frames` | integer 1–64 |  | 1 | animation frames, left to right in one strip |
| `fw` | number 4–512 |  | the footprint (a building) or the image | in-game frame width, whole world px |
| `fh` | number 4–512 |  |  | in-game frame height, whole world px |
| `rotated` | boolean |  |  | one up-facing image; the game bakes the 24 headings (hulls, turrets) |
| `pivotX` | number 0–1 |  | 0.5 | rotation pivot, as a fraction of the frame |
| `pivotY` | number 0–1 |  | 0.5 | rotation pivot, as a fraction of the frame |
| `anchorY` | number 0–512 |  |  | px from the top to the footprint centre (tall buildings) |
| `mount` | [x, y] |  |  | a body: where its turret sits (or, with a repair aura, where the beam leaves), as `[fx, fy]` |
| `barrels` | [left, top, right, bottom][] |  |  | exposed barrel rectangles, each `[left, top, right, bottom]` in 0–1 fractions of the up-facing source frame, in muzzle firing order; leave mantlets fixed. Pair with weapon `recoil` (art px) |
| `fps` | number 0–60 |  |  | animation speed |
| `teams` | boolean |  | true | recolour magenta per faction; `false` draws the sheet as painted for every faction, and for the wreck |
| `ss` | integer 1–4 |  |  | supersample factor; omit to let the game choose |
| `fitFootprint` | boolean |  |  | scale the drawn content to fill the frame |
| `animRegion` | [x0, y0, x1, y1] |  |  | where the animation lives, `[x0, y0, x1, y1]` fractions; the rest is frozen |
| `stabilize` | boolean |  | true | re-align drifting frames |
| `freezeStatic` | boolean |  |  | median-freeze pixels that barely change |
| `stripBg` | boolean |  |  | force background removal on or off |
| `bgMinLuma` | number 0–255 |  |  | lightest colour still taken as background |
| `artifactCleanup` | boolean |  |  | sweep specks left by background removal |
| `anims` | { moving, idle, firing } |  |  | a unit body's frames by what it is doing, `{ moving, idle, firing }`, each `[first, last]` or `[first, last, fps]`: a tank that is a tree when it stands, a walker whose legs move only when it does (see Animation states) |

Barrel recoil is available to any definition with a rotating turret: put `recoil: 2` on its turret weapon (stroke in art pixels) and `barrels: [[0.4, 0, 0.6, 0.45]]` on its turret sheet. Rectangles use 0–1 fractions of the up-facing source frame, must have positive area and must not overlap. Keep stationary mantlets outside them. For several barrels, list rectangles in the same order as `muzzlePoints`, or left to right when using `bores`/`boreSpacing`. Each firing mount and barrel recoils independently; custom or hidden muzzle flashes work too. Inherited art keeps its barrel regions; custom art supplies its own. Recoil changes no combat statistic.

### Home menu background (`menuBackground`)

| field | type | required | default | meaning |
| --- | --- | --- | --- | --- |
| `cuts` | cut[] |  |  | up to 16 custom live scenes |
| `queue` | cut id[] | yes |  | 1–32 cut IDs in repeating order; original IDs: flank, sea, winter, raid, landing, rockets, home, nuke |

| field | type | required | default | meaning |
| --- | --- | --- | --- | --- |
| `id` | id | yes |  | unique cut ID beginning with the mod ID and a dash |
| `map` | string | yes |  | a path in this pack’s maps; at most 128 × 128 tiles and 200 placed units/buildings |
| `camera` | { tx, ty, zoom } | yes |  | opening framing: { tx, ty, zoom } |
| `cameraEnd` | { tx, ty, zoom } |  |  | end framing for a 13-second drift; omitted holds camera |
| `weather` | clear \| rain \| snow |  | clear | weather held throughout the cut |
| `minutes` | number 0–24 |  | 6 | held day-cycle time: 0 dawn, 6 noon, 12 dusk, 18 midnight |
| `seed` | integer 0–2147483647 |  | 1 | simulation seed |
| `orders` | { owner, tx, ty }[] |  |  | opening attack-move targets for the map’s mobile units, by owner |

| field | type | required | default | meaning |
| --- | --- | --- | --- | --- |
| `tx` | number 0–128 | yes |  | horizontal camera centre in tiles, inside the map |
| `ty` | number 0–128 | yes |  | vertical camera centre in tiles, inside the map |
| `zoom` | number 0.25–4 | yes |  | camera zoom, capped by the menu on small screens |

| field | type | required | default | meaning |
| --- | --- | --- | --- | --- |
| `owner` | integer 0–7 | yes |  | map spawn index; one opening attack-move per owner |
| `tx` | number 0–128 | yes |  | target tile x |
| `ty` | number 0–128 | yes |  | target tile y |

Supply a nonempty queue to replace the home-menu reel. It repeats in listed order from a random starting cut, 13 seconds per cut, with the usual camera drift and fades. Mix original IDs with your own, or use only your own. The last active pack with usable cuts wins; disabling it restores the previous reel. A background-only pack may use `defs: []`. A custom cut names a file in `maps`, with its placed units and buildings; every owner needs a spawn, and every camera/order point must be inside the map. Each spawn is a separate side; no AI, default bases or scenario triggers run. Place generators to power the forces. Optional opening orders attack-move all mobile units belonging to the named owner. Missing or invalid cuts are skipped; an unusable queue keeps the previous reel. Reduced motion keeps the still background.

### Background music (`music`)

| field | type | required | default | meaning |
| --- | --- | --- | --- | --- |
| `tracks` | track[] |  |  | up to 32 custom recordings, each with an id and file |
| `menu` | track id[] |  |  | ordered repeating queue for menus; also used for setup unless setup is supplied. Omitted keeps the previous queue; [] is silence |
| `setup` | track id[] |  |  | optional separate queue for match setup |
| `battle` | track id[] |  |  | ordered repeating queue during battle. Omitted keeps the previous queue; [] is silence. Built-in IDs: menu, glassline-drive, setup, cold-front, victory, defeat, battle-1, battle-2, assembly-gears, disciplined-unease, methodical-calm, iron-standard, danger-close, dead-reckoning, zero-hour, stand-to, stand-down |

| field | type | required | default | meaning |
| --- | --- | --- | --- | --- |
| `id` | id | yes |  | unique track id: <mod id>-<name>; cannot replace a built-in ID |
| `file` | string | yes |  | MP3, Ogg or WAV path relative to mod.json |

Each supplied queue replaces that slot, plays in listed order and repeats, keeping the normal gaps, music volume and pause behavior. Keep built-in IDs to mix original tracks with your own; use only your own IDs for a complete replacement. Omitted queues keep the previous selection; an empty queue silences the slot. The last active pack supplying a slot wins. Disabling it restores the preceding pack or the original shuffle. A music-only pack uses `defs: []`. Victory and defeat remain unchanged. Tracks travel with the other mod assets, within the existing total asset limit.

Built-in music IDs by original slot: menu: menu, glassline-drive; setup: setup, cold-front; victory: victory; defeat: defeat; battle: battle-1, battle-2, assembly-gears, disciplined-unease, methodical-calm, iron-standard, danger-close, dead-reckoning, zero-hour, stand-to, stand-down. Any of these IDs may appear in a custom queue; an unshipped file is skipped.

### A sound (`sounds[]`)

| field | type | required | default | meaning |
| --- | --- | --- | --- | --- |
| `key` | string | yes |  | `<mod id>-<name>`, lower case; what a weapon's `sound` names |
| `file` | string | yes |  | the recording, relative to mod.json. An MP3 plays everywhere; WAV works, OGG not on Safari. Dry, close, under a second |

A weapon fires with the game's sound for its class unless its `sound` names one of these keys. A recording is a dry, close-miked one-shot under a second with no reverb tail; the engine attenuates and pans it by distance, and forty overlapping echoes turn to mud. Mono MP3 is the safe format.

## Behaviour

A def may carry `rules`: things that happen to it — it turns into another of the mod's defs, spawns units, heals, pays, takes a buff, blows up — when something happens to it (`on`), when a condition comes true (`when`), on a clock (`every`), or when the player presses a button on its card (`button`). The words are a closed vocabulary, each one checked when the mod loads, so a rule can only do what the game already knows how to do safely; there is no scripting. Up to 24 rules a def. Rules are never inherited through `extends`, and the game's own units have none.

A tank that is a tree while it stands, and a tank again when it moves or fires — two defs, each turning into the other:

```json
[
  {
    "id": "mymod-mirage",
    "name": [
      "Mirage Tank",
      "幻影坦克"
    ],
    "extends": "mbt",
    "sprite": "u.mymod-mirage",
    "rules": [
      {
        "when": {
          "still": 1,
          "quiet": 0.8
        },
        "do": {
          "morph": "mymod-mirage-tree"
        }
      }
    ]
  },
  {
    "id": "mymod-mirage-tree",
    "name": [
      "Mirage Tank",
      "幻影坦克"
    ],
    "extends": "mymod-mirage",
    "producedBy": [],
    "untargetable": true,
    "stealth": 3,
    "rules": [
      {
        "when": {
          "moving": true
        },
        "do": {
          "morph": "mymod-mirage"
        }
      },
      {
        "on": "fired",
        "do": {
          "morph": "mymod-mirage"
        }
      }
    ]
  }
]
```

A hero that ranks itself up from its card — the same unit, a new form, paid as the work is done:

```json
{
  "id": "mymod-hero",
  "name": [
    "Hero Tank",
    "英雄坦克"
  ],
  "extends": "mbt",
  "limit": 3,
  "rules": [
    {
      "button": {
        "cost": 600,
        "time": 20,
        "ai": true
      },
      "do": {
        "morph": "mymod-hero-gunner"
      }
    },
    {
      "button": {
        "cost": 900,
        "time": 30,
        "requires": [
          "radar"
        ]
      },
      "do": {
        "morph": "mymod-hero-sniper"
      }
    },
    {
      "every": 1,
      "if": {
        "hurtWithin": 0.5,
        "hpBelow": 0.3
      },
      "cooldown": 30,
      "do": [
        {
          "buff": {
            "taken": 0.5,
            "for": 5
          }
        },
        {
          "fx": "fx.repair"
        }
      ]
    }
  ]
}
```

### A rule (`defs[].rules[]`)

| field | type | required | default | meaning |
| --- | --- | --- | --- | --- |
| `on` | created \| destroyed \| fired \| damaged \| kill \| morphed |  |  | runs when this happens to it: made (`created`, and when a map stands it), killed (`destroyed`, where it fell), a shot fired (`fired`), hurt (`damaged`), a kill made (`kill`), or a change of form finished (`morphed`) |
| `when` | condition |  |  | runs when this condition becomes true, and again only after it has been false (see Conditions) |
| `every` | number 0.25–3600 |  |  | runs every so many seconds of its life |
| `button` | button |  |  | a button on its card the player presses (see Buttons) |
| `if` | condition |  |  | also checked when triggered: the rule runs only if this holds too; on a button, the button is greyed while it does not |
| `chance` | number 0–1 |  | 1 | the odds it runs when triggered |
| `cooldown` | number 0–3600 |  |  | seconds before it may run again |
| `max` | integer 1–1000 |  |  | times it may run on one unit, ever |
| `do` | effect \| effect[] | yes |  | what it does: an effect or a list of up to 8, in order (see Effects) |

Exactly one trigger. A `when` runs the moment its condition becomes true and not again until it has been false; one held back by its `if` or its `cooldown` tries again while the condition still holds. An `every` counts from the unit's making or its last change of form. Conditions are looked at ten times a second; events are answered on the tick they happen. A rule's `do` runs in order and stops at a change of form: what came after belonged to the old one.

### Conditions (`when`, `if`)

| field | type | required | default | meaning |
| --- | --- | --- | --- | --- |
| `moving` | boolean |  |  | is driving, flying or swimming (true) or standing (false) |
| `still` | number 0–3600 |  |  | has not moved for at least this many seconds |
| `firedWithin` | number 0–3600 |  |  | fired within the last so many seconds |
| `quiet` | number 0–3600 |  |  | has not fired for at least this many seconds |
| `hurtWithin` | number 0–3600 |  |  | was hurt within the last so many seconds |
| `hpBelow` | number 0–1 |  |  | health below this share of its whole |
| `hpAbove` | number 0–1 |  |  | health above this share of its whole |
| `age` | number 0–36000 |  |  | seconds since it was made, or last changed form |
| `flag` | string |  |  | a flag a rule has set on it is up |
| `noFlag` | string |  |  | that flag is down |
| `kills` | integer 0–10000 |  |  | it has made at least this many kills |
| `rank` | integer 1–3 |  |  | its veteran rank is at least this |
| `onWater` | boolean |  |  | stands on water (true) or on land (false) |
| `enemyWithin` | number 0.5–32 |  |  | an enemy its side can see is within this many tiles |
| `near` | { units, kind, side, within, count } |  |  | others stand near it: at least `count` of these `units` or this `kind`, on this `side`, `within` so many tiles (see Near) |
| `night` | boolean |  |  | it is night (true) or day (false) |
| `carrying` | integer 1–50 |  |  | has at least this many units in its hold |
| `killedBy` | id[] |  |  | on `destroyed`: what killed it was one of these defs (the dead rise only when the dead killed them) |
| `any` | condition |  |  | a list of conditions, one of which must hold |
| `not` | condition |  |  | a condition that must not hold |

Every key given must hold; `any` and `not` say otherwise. A misspelt condition is an error, not a condition that always holds.

### Near (`when.near`)

| field | type | required | default | meaning |
| --- | --- | --- | --- | --- |
| `units` | id[] |  |  | these defs only: the game's or any mod's |
| `kind` | unit \| building |  |  | only units, or only buildings |
| `side` | friend \| enemy \| any |  | any | whose: its own side and its allies (`friend`), an enemy's (only what its side can see), or anyone's |
| `within` | number 0.5–32 | yes |  | tiles from it to the other's edge |
| `count` | integer 1–50 |  | 1 | at least this many |

What stands near the unit, measured to the other's edge: a flyer that takes off only with something to hook onto (`{ "kind": "building", "within": 8 }`), troops that fight harder beside their commander (`{ "units": ["mymod-captain"], "side": "friend", "within": 10 }`), a wall that wakes when its master comes by. Name `units`, a `kind`, or both; an enemy is counted only when its side can see it.

### Effects (`do`)

| field | type | required | default | meaning |
| --- | --- | --- | --- | --- |
| `morph` | id |  |  | become another def of this mod, in place: the same unit (its selection, its kills and rank, the orders the new form can carry out), its health keeping its share of the whole. A building only takes the form of a building of the same footprint |
| `spawn` | { unit, count, side, into, max } |  |  | units put down beside it, or into its hold (see Spawn) |
| `heal` | number -1000000–1000000 |  |  | hit points given back; negative takes them, never the last one |
| `healPct` | number -1–1 |  |  | a share of its whole health given back |
| `metal` | number -99999–99999 |  |  | metal to its side; negative takes it, never below nothing |
| `flag` | string |  |  | raise a flag on it, for a condition to read |
| `unflag` | string |  |  | lower that flag |
| `buff` | { speed, damage, reload, taken, for } |  |  | multipliers held for `for` seconds: `speed`, the `damage` it deals, its `reload` time, and the harm it is `taken`; a new buff replaces the one it has |
| `explode` | { dmg, radius, cls, friendlyFire } |  |  | a blast round it: `dmg` at the centre falling to half at the edge of `radius` (world px), through the armour row of `cls` (default he); its own side is spared unless `friendlyFire` |
| `fx` | string |  |  | an effect played where it stands: one of this mod's `fx.<name>` sheets, or fx.expl.s, fx.expl.m, fx.expl.l, fx.spark, fx.flak, fx.smoke, fx.splash, fx.splash.l, fx.muzzle, fx.repair, fx.emp, fx.nuke |
| `fxScale` | number 0.05–8 |  | 1 | the effect drawn at this multiple |
| `sound` | string |  |  | a sound played where it stands: a weapon sound, expl, explBig, upgrade, or one of this mod's `sounds` |
| `die` | boolean |  |  | it is destroyed, as if killed by nobody (its own `destroyed` rules run) |
| `remove` | boolean |  |  | it is gone without a trace: no wreck, no loss, no `destroyed` |

### A spawn (`do.spawn`)

| field | type | required | default | meaning |
| --- | --- | --- | --- | --- |
| `unit` | id | yes |  | the unit: one of the game's or this mod's |
| `count` | integer 1–16 |  | 1 | how many |
| `side` | own \| killer |  | own | whose they are: its own side's, or (on `destroyed`) the side that killed it |
| `into` | hold |  |  | straight into its own hold, as far as the room goes, instead of beside it |
| `max` | integer 1–64 |  |  | at most this many of the units this rule has spawned alive at once |

A spawn never takes a side past its population cap or a def past its `limit`: it puts down what fits and no more. Spawned units are ordinary units of their side, standing where they were put down; a spawned unit's own `created` rules run too. `side: "killer"` on a `destroyed` rule is the dead rising for whoever killed them.

### A button (`rule.button`)

| field | type | required | default | meaning |
| --- | --- | --- | --- | --- |
| `name` | text |  | the form it makes | the button's label |
| `desc` | text |  |  | its tooltip line |
| `cost` | number 0–99999 |  | 0 | metal, paid as the work is done |
| `time` | number 0–3600 |  | 0 | seconds of work at full power; 0 is at once |
| `requires` | id[] |  |  | buildings that must stand, or tech nodes researched, for it to be pressed (and to go on) |
| `ai` | boolean |  |  | a computer side presses it too, when it can spare the metal |

The button is a tile on the unit's card, pressed on every selected unit of that def free to take it. It starts on the production rule — three quarters of the price in hand — and is paid as the work is done; while it runs the tile wears its progress, and pressing it again stops it and gives back what it had cost. It waits while what it `requires` is down. A button whose `do` changes the unit's form is labelled with the form unless it has a `name`; any other button needs one.

### A change of form (`do.morph`)

The unit becomes another def of the same mod in place: the same unit, its side, where it stands and faces, its kills and veteran rank, its flags, the selection and the groups it is in; its health keeps its share of the whole, its guns carry on from where they were in their reload, and it keeps whatever orders the new form can carry out — a move, an attack. A unit turns only into a unit, and a building only into a building of the same footprint. The change is refused, and nothing happens, while the unit is being carried, while its hold holds more than the new form can, while its line or its magazine has work the new form cannot take over, or where the new form cannot stand (a boat on dry land). A form that nothing builds says `"producedBy": []`; the loader expects that of a form and says nothing.

### A weapon's look (`weapons[].look`)

| field | type | required | default | meaning |
| --- | --- | --- | --- | --- |
| `sprite` | string |  |  | the round: one of this mod's `prj.<name>` sheets — its frames play as it flies, or, baked `rotated`, it is turned to its heading |
| `scale` | number 0.1–8 |  | 1 | the round and its flash drawn at this multiple |
| `beam` | { color, width, style, life } |  |  | the round is light: `{ color, width, style, life }` — a line from the muzzle to where it strikes, `laser` straight or `lightning` jagged, held `life` seconds; it strikes at once |
| `muzzle` | string |  | the class's flash | the muzzle flash: one of this mod's `fx.<name>` sheets, or `none` |
| `impact` | string |  | the class's burst | the burst where it lands: an `fx.<name>` sheet of this mod, one of fx.expl.s, fx.expl.m, fx.expl.l, fx.spark, fx.flak, fx.smoke, fx.splash, fx.splash.l, fx.muzzle, fx.repair, fx.emp, fx.nuke, or `none` |
| `impactScale` | number 0.1–8 |  | 1 | the burst drawn at this multiple |
| `impactLife` | number 0.05–5 |  | 0.5 | seconds the burst plays over |
| `trail` | smoke \| none |  | smoke | a rocket's or a missile's smoke trail, or none |

A look is only what is seen: the round hits as the weapon's numbers say. A beam is the exception by its nature — the round goes at once, so it lands where the beam is drawn. A round's sheet (`prj.<name>`) is small art facing up with `rotated: true`, or a strip of `frames` played as it flies; an effect's sheet (`fx.<name>`) is a strip played once, not rotated.

### A shield (`shield`)

| field | type | required | default | meaning |
| --- | --- | --- | --- | --- |
| `hp` | number 1–1000000 | yes |  | what it takes before the hull does |
| `regen` | number 0–100000 |  | 0 | recharged a second |
| `delay` | number 0–600 |  | 3 | seconds unhurt before it starts to recharge |

The shield takes harm before the hull, its bar drawn over the health bar, and shimmers round the hull when struck. `regen` on the def (not the shield) is the hull mending itself.

### A carrier's wing (`wing`)

A unit may carry planes of the mod's own — a carrier's drones, a destroyer's one anti-submarine plane, an airship's swarm — that fly out at what it fights and come back to it:

```json
[
  {
    "id": "mymod-drone",
    "name": [
      "Strike Drone",
      "攻击无人机"
    ],
    "kind": "unit",
    "domain": "air",
    "cost": 60,
    "hp": 80,
    "pop": 0,
    "speed": 200,
    "producedBy": [],
    "weapons": [
      {
        "id": "gun",
        "cls": "mg",
        "dmg": 8,
        "reload": 0.5,
        "range": 2.5,
        "targets": [
          "ground",
          "ship"
        ]
      }
    ]
  },
  {
    "id": "mymod-carrier",
    "name": [
      "Light Carrier",
      "轻型航母"
    ],
    "extends": "destroyer",
    "weapons": [],
    "wing": {
      "unit": "mymod-drone",
      "count": 8,
      "rebuild": 6,
      "sortie": 12,
      "rearm": 2,
      "range": 12
    }
  }
]
```

| field | type | required | default | meaning |
| --- | --- | --- | --- | --- |
| `unit` | id | yes |  | the plane: an aircraft of this mod with `"pop": 0` and `"producedBy": []`, made by its carrier alone |
| `count` | integer 1–16 |  | 1 | planes it keeps |
| `rebuild` | number 0.5–600 |  | 10 | seconds to make a lost one again, for nothing, one at a time |
| `sortie` | number 1–600 |  | 15 | seconds a plane stays out before it comes back to rearm |
| `rearm` | number 0–120 |  | 3 | seconds a plane back aboard waits before it flies again, mended as it waits |
| `range` | number 1–32 |  | 10 | tiles from the carrier its planes go out to fight |

The carrier comes with its planes aboard. While it has work — what its player sent it at, what its own guns are on, or else the nearest enemy its side can see within `range` that the planes can hit — a ready plane leaves the deck every third of a second. A plane comes back when the work is done, when it has been out `sortie` seconds, or when it is badly hurt, and waits `rearm` seconds aboard, mended as it waits, before it flies again; a lost one is made again every `rebuild` seconds, for nothing. A carrier with no guns of its own, sent at a target, closes to its wing's range and waits there. The planes are units of their side, with guns and kills of their own, but never the player's: they cannot be selected or ordered. A carrier lost takes the planes aboard with it; the ones out find another deck of their kind with room, or come down. The plane is an aircraft of the mod's own with `"pop": 0` and `"producedBy": []`: its carrier makes it, and nothing else does. A wing is never inherited through `extends`.

### Animation states (`sprites[].anims`)

| field | type | required | default | meaning |
| --- | --- | --- | --- | --- |
| `moving` | [first, last] or [first, last, fps] |  |  | `[first, last]` frames played while it moves, or `[first, last, fps]` |
| `idle` | [first, last] or [first, last, fps] |  | frame 0 | the frames while it stands |
| `firing` | [first, last] or [first, last, fps] |  |  | the frames within a reload of its last shot; before moving and idle |

On a unit's body sheet, the frames played by what it is doing instead of one loop: the `firing` range within a reload of its last shot, else the `moving` range while it moves, else `idle`. A sheet without `anims` rolls its frames while the unit moves and rests on the first, as treads do.

## Maps

A mod may carry maps: files the game's Scenario Editor exports (`.steel-tide-map`), named under `maps` in mod.json, up to 8 of them and each under 512 KB. While the mod is on, the Conquest setup and the lobby offer them as cards beside the player's own map; choosing one plays it exactly as painted. A map may stand the mod's own units and buildings before the whistle: with the mod on, they are in the editor's forces palette, and the map reads on any game that has the mod (the registry checks it against the mod's own defs, not the vanilla roster). A scene laid this way — a base built up, a horde at the gate — is how a mod shows what it is without a word.

## Units of measure

- A tile is 32 world pixels. `speed` and projectile `speed` are world px/s; `range`, `minRange`, `vision`, `sonar`, `stealth`, `detect`, `repairRange` and `interceptRange` are tiles; `radius`, `body.r`, `body.len`, `splash`, `spread`, `muzzleOffset` are world px.
- Times are seconds: `buildTime`, `reload`, `burstDelay`, `upgradeTime`, `interceptReload`, `nukeTime`.
- For scale: the Bison main battle tank is cost 280, hp 620, speed 60, radius 10, body `{ r: 13, len: 12 }`, a cannon of dmg 60 every 1.8 s at range 4.6; a scout car is cost 60, hp 150, speed 120; a war factory is 3×3 tiles, hp 1500, power −8.

## Art

- Keys: a def's body is `u.<id>`, a rotating turret `tur.<id>`. A def with no sheet of its own may borrow vanilla art by naming a vanilla key in `sprite` (e.g. `"sprite": "u.mbt", "turretSprite": "tur.mbt"`); with `extends` it inherits the base's art. A mod may not replace vanilla art.
- A sheet is one PNG (WebP and JPEG are accepted): `frames` animation frames left to right in one horizontal strip, evenly spaced, no gaps, no borders.
- Hulls, turrets and everything that turns: draw ONE image facing UP and set `"rotated": true`; the game bakes the 24 headings. `fw`/`fh` are the in-game size of that up-facing image in world px (a tank hull is about 24×24; the image itself may be any resolution, 2–4× is best). `pivotX`/`pivotY` put the pivot on the turret ring (default centre).
- Buildings: one strip of frames, not rotated, drawn with a slight top-down southern tilt. The footprint is the bottom `fw×32` by `fh×32` px of the frame; anything above overhangs the terrain behind (towers, masts). Width, height and anchor are sized from the def's footprint automatically.
- A building with a gun that turns is two sheets like a hull and turret: the body with an empty ring and `"mount": [fx, fy]` saying where the ring sits as fractions of the frame, and a `tur.<id>` sheet for the gun; its weapons carry `"turret": true`.
- Several guns of one kind on one hull are one `tur.<id>` sheet and a `turretMounts` ring for each, not guns painted on the body: a painted gun never turns.
- A decal's sheet (`dec.<name>`) is drawn like a turret's: one up-facing image, or a strip of `frames` at `fps` for something that moves (a spinning barrel, a blinking light), sized by `fw`/`fh` and drawn about its centre. Static detail belongs in the body's own sheet; a decal is for what the body cannot hold — a part that turns with the turret, a hatch the barrel sweeps over, a light that comes on at night, a barrel that spins while it fires.
- Faction colour: paint team-coloured parts in pure magenta (highlight #FF66FF, base #FF00FF, shadow #990099) and use magenta nowhere else; the game recolours it per player.
- Style: crisp pixel art, hard edges, no anti-aliasing, a muted military palette (DawnBringer-32), dark #222034 outlines. Generated sheets are cleaned automatically (background removal, frame registration), but a transparent background is best.

## The vanilla roster (ids you may `extends`, name in `producedBy`/`builtBy`/`requires`/`upgradeOf`, or borrow art from)

- ground units: engineer (T1, 150), buggy (T1, 60), ltank (T1, 120), mbt (T2, 280), htank (T3, 900), td (T2, 320), flak (T1, 170), sam (T2, 400), arty (T2, 420), mlrs (T3, 760), radarcar (T3, 480), salamander (T3, 800), bulwark (T3, 650), drake (T2, 400), hercules (T2, 350), scorpion (T3, 1100)
- ships: gunboat (T1, 130), mboat (T1, 280), frigate (T2, 700), destroyer (T2, 700), sub (T2, 480), btlship (T3, 1700), carrier (T3, 2200), seatrans (T1, 220), engboat (T1, 200), kraken (T3, 1000), moray (T3, 700)
- amphibious units: gator (T2, 200)
- aircraft: hornet (T2, 120), drone (T1, 40), fighter (T2, 380), heli (T2, 380), jet (T2, 450), mjet (T2, 520), bomber (T2, 1000), theli (T1, 280), c47 (T2, 650), gunship (T3, 1800), wraith (T3, 1400), cormorant (T3, 700)
- buildings: hq (T1, 2500), hq2 (T2, 17500, upgrade level), extractor (T1, 120), extractor2 (T2, 310, upgrade level), extractor3 (T3, 810, upgrade level), platform (T1, 120), platform2 (T2, 310, upgrade level), platform3 (T3, 810, upgrade level), power (T1, 140), power2 (T2, 400, upgrade level), power3 (T3, 1100, upgrade level), factory (T1, 320), factory2 (T2, 740, upgrade level), factory3 (T3, 1640, upgrade level), airbase (T1, 380), airbase2 (T2, 830, upgrade level), airbase3 (T3, 1780, upgrade level), navyard (T1, 350), navyard2 (T2, 800, upgrade level), navyard3 (T3, 1750, upgrade level), mgturret (T1, 130), gatling (T2, 330, upgrade level), cannonturret (T1, 320), cannonturret2 (T2, 660, upgrade level), aaturret (T1, 400), samsite (T2, 1000, upgrade level), interceptor (T2, 450), interceptor2 (T3, 1100, upgrade level), sandbag (T1, 40), landmine (T1, 60), watermine (T1, 60), repairtower (T1, 360), radar (T2, 400), warlab (T1, 500), veil (T2, 600), reactor (T3, 1400), nukesilo (T3, 1800)

## Test

1. Validate: in a clone of the registry, `node tools/check.mjs path/to/my-mod` prints every error with its path into mod.json. (No clone? The game says the same things when the mod is loaded.)
2. Load it in the game: Settings → Mods → *Open folder…* (Chrome keeps the folder open, so *Reload* re-reads your edits) or *Upload file…* (a zip of the folder, or a `.steel-tide-mod` file). Errors are listed on the spot; a loaded mod says how many units and buildings it added.
3. Play: start a Conquest match. Your units are in the factory's production list from the level you gave them; buildings are in the engineer's build menu; an upgrade level is on its building's Upgrade button. The console (backquote) has `give <id>` for anything. Network players need matching packs and support for their required host API.
4. From a static server: `npx serve --cors path/to/my-mod` then open `https://play.steelti.de/?mod=http://localhost:3000/`. Data-only mods refresh at boot. Executable packages require an explicit local install first, and changed package code needs an explicit reload.

## Publish

1. Fork https://github.com/steel-tide/mods, add your folder as `mods/<id>/` (the folder name is the mod's `id`), run `node tools/check.mjs mods/<id>`, open a pull request.
2. A published mod carries at least one screenshot of it in play, named under `screenshots` in mod.json: 4:3 (1600×1200 is a good size), at least 640 px wide, PNG, JPEG or WebP under 2 MB, up to 8 of them. The game's Settings → Mods page and https://steelti.de/mods show them; the first is the mod's card. Take them in a match with the mod's units on screen (the console's `give` puts them there) and crop to 4:3.
3. CI runs the same check on the whole registry: ids must be unique across every published mod, so prefix a generic word with your mod's id (`ironworks-bunker`, not `bunker`).
4. Once merged, the index is rebuilt and the mod appears in the game's registry list and at https://steelti.de/mods, where its installs are counted. Bump `version` for every change; the game offers the update.

## Rules

- A mod adds definitions and assets; it does not change vanilla defs, art, rules or interface. Music and menu-background queues are explicit exceptions: they select the soundtrack and backdrop without overwriting built-in tracks or cuts. Do not try to override a vanilla id or key; the validator refuses it.
- Keep it honest: a unit needs a counter. The armour matrix is how the game makes one; give a new weapon a class it belongs to rather than an override on every cell.
- A mod is published under the licence its manifest names (default CC-BY-4.0). Only ship art you have the right to.

# Original Adolence maps

All 15 TMX files in `rusted-warfare-mods/adolence/maps` have native layout ports.
All ports live in this mod’s `maps/` folder. Steel Tide allows eight bundled
maps per mod, so the existing showcase and seven originals appear in setup.
Download any of the remaining eight `.steel-tide-map` files from the inventory
below and import it through the Scenario Editor to use it as a custom map.
Those eight files are kept in the repository; they are not included in the
packed `.steel-tide-mod` download.

The maps use native terrain and city buildings, not the original tile artwork.
Their roads, districts, waterways, crossings, trees and resource locations are
translated from the TMX layers. Normal faction setup supplies headquarters and
builders; RW unit placements, neutral turrets/fabricators, civilian crowds,
wave scripts and mission triggers are not carried across.

## Inventory

| Original file | Native map | Access | Size | Players |
| --- | --- | --- | --- | --- |
| `(10P)危险的市区.tmx` | [Dangerous Downtown](maps/dangerous-downtown.steel-tide-map) | Bundled | 200×200 | 8 |
| `(10P)洛杉矶郊区之战等待陆战一师马奇空军基地支援 .tmx` | [Los Angeles Outskirts](maps/los-angeles-outskirts.steel-tide-map) | Bundled | 250×150 | 8 |
| `(1v2)绿色生活-城镇住宅小区.tmx` | [Green Life: Residential District](maps/green-life.steel-tide-map) | Bundled | 100×140 | 3 |
| `(4p)港口城镇-沙漏倒计.tmx` | [Harbour Town: Hourglass](maps/harbour-town.steel-tide-map) | Bundled | 170×160 | 4 |
| `(4p)灰色城市-铁路网络.tmx` | [Grey City: Railway Network](maps/railway-network.steel-tide-map) | Bundled | 279×278 | 4 |
| `(4p)遗失文明-断桥商业街.tmx` | [Lost Civilization: Broken Bridge](maps/broken-bridge.steel-tide-map) | Bundled | 225×210 | 3 |
| `10P沙漠公路.tmx` | [Desert Highway](maps/desert-highway.steel-tide-map) | Bundled | 220×220 | 8 |
| `4p长桥久战.tmx` | [The Long Bridge](maps/long-bridge.steel-tide-map) | Manual import | 300×60 | 4 |
| `8p_industrial_zone_mini_bySeCtAnT_ft.Teoshebo.tmx` | [Industrial Zone Mini](maps/industrial-zone.steel-tide-map) | Manual import | 190×190 | 8 |
| `大城市平原战争超大地图.tmx` | [Great City: War on the Plains](maps/great-city-plains.steel-tide-map) | Manual import | 500×500 | 8 |
| `好多入😍😍😍.tmx` | [Crowded City (Skirmish)](maps/crowded-city.steel-tide-map) | Manual import | 500×500 | 2 |
| `尸城.tmx` | [Dead City (Skirmish)](maps/dead-city.steel-tide-map) | Manual import | 500×500 | 2 |
| `森林湖郊区[8p].tmx` | [Forest Lake Suburbs](maps/forest-lake.steel-tide-map) | Manual import | 210×120 | 8 |
| `森林湖郊区官方重置版.tmx` | [Forest Lake: Remastered](maps/forest-lake-remastered.steel-tide-map) | Manual import | 250×142 | 8 |
| `隔岸.tmx` | [The Opposite Bank](maps/opposite-bank.steel-tide-map) | Manual import | 100×100 | 2 |

## Adaptations

- Starting teams are ordered by their original team number. Maps with more than eight teams keep the first eight, including the four 10-player layouts and the Forest Lake remaster, which actually contains eleven starting teams.
- Multiple HQ markers belonging to one original team produce one seat. Starts move only when needed for a clear 9×9 foundation for either Adolence faction. The report records every move and cleared tile.
- Broken Bridge has three authored starting teams despite its `(4p)` filename. Its port keeps those three starts.
- Great City preserves its entire 1000×1000 layout at 500×500, using 2:1 reduction. Crossings and narrow roads take priority over the majority terrain in each 2×2 source block.
- Long Bridge retains its spanning deck. Its two ends become buildable abutments, with small land foundations for resource sites, because native bridge decks cannot support buildings.
- Every original resource marker becomes a metal deposit. Sites may move up to 24 tiles to fit a 2×2 extractor, avoid the starting headquarters or separate overlapping markers. The original land/sea category is retained.
- Crowded City and Dead City are explicitly labelled **Skirmish**. Their original terrain is identical; their differences were the scripted crowds. Both ports have two connected starting districts and four added deposits. They do not reproduce survival waves, the 959 civilians, 554 brutes or five neutral helicopters.
- A few original GIDs point outside their image atlases (Desert Highway: 1831; Great City: 4563 and 4569). They leave the underlying ground intact and are recorded in the report. Missing desktop image references are resolved from the same embedded atlas in another original map.

## Regenerate and verify

From the repository root (Python 3 with Pillow and Node 22+):

```sh
python3 mods/adolence/port-maps.py
node mods/adolence/verify-maps.mjs
node tools/check.mjs mods/adolence
```

`port-maps.py` reads the originals without changing them, writes all 15 ports
under `adolence/maps/`, and refreshes the eight-entry bundled map list. External stock TSX references use the preserved RW assets under
`rusted-warfare-mods/fg-rusted-league/assets/tilesets`; pass `--tilesets` to use
another copy. `--output-root` writes to a staging `mods` directory, and
`--preview` optionally generates terrain overview PNGs.

`map-port-report.json` records the source SHA-256 hashes, dimensions, retained
and omitted team IDs, starting-area adjustments, resource relocations, original
unit counts and whether each map is bundled or requires manual import. `verify-maps.mjs` independently opens every map with
Steel Tide’s parser and checks inventory coverage, map limits, resource
foundations, starting space and connected ground routes.

The initial port was also exercised in 45 native match openings: all 15 maps
with vanilla, City Authority and SPK Infected, covering 240 headquarters and
480 starting builders.

## Attribution

These are adaptations of the maps bundled with Adolence Q3.6.0, retained under
`LicenseRef-Adolence` and the original port’s author permission. Original
filenames are preserved in the inventory for attribution. Industrial Zone Mini
credits **SeCtAnT ft. Teoshebo** in its original filename. No ownership of the
original layouts or artwork is claimed by this port.

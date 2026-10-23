# Source and attribution

- Original pack: **EK_Definitive_Edition_2026h50**, supplied locally under `rusted-warfare-mods/EK_Definitive_Edition`.
- Original author/copyright notice from `mod-info.txt`: **Copyright © 2021–2026 ice-v5. All Rights Reserved.** Original EK contributors retain their respective work.
- Original license file: `CC-BY-NC-ND-4.0.md`, copied verbatim as [LICENSE.txt](LICENSE.txt). The manifest records that source license; this port does not relicense the original content or assert additional distribution permission.
- Unit descriptions, body/turret/arm/leg/projectile/wreck art and source gameplay data come from the supplied EK pack. `source-inventory.json` records every named INI and its SHA-256; `conversion-report.json` maps generated media to the actual source files.
- Five missing standard shared images (`blank`, `nano_turret`, `leg`, `foot`, `small_laser_turret`) and fourteen standard RW sound effects were recovered from the supplied `rusted-warfare-mods/fg-rusted-league` base assets. Their originals are retained in `source-assets/`; standard sound effects are transcoded to MP3 with FFmpeg. They are not claimed as newly authored EK artwork or audio.
- `SHARED:mega_tank_turret2.png`, `experimental_tank_turret3.png`, `icon_build.png`, and `no_icon.png` were not found in the supplied source assets. Their affected uses are recorded; no replacement gun art was invented.
- Steel Tide integration, the independent expression compiler and EK runtime/presentation adapters were added for this local port. The initial INI/media conversion structure follows the repository's existing naval-warfare port; the resulting EK converter is self-contained.
- `maps/complete-showcase.steel-tide-map` is a newly authored test layout for this port. Its terrain uses Steel Tide's existing terrain types; its specimens retain the supplied EK artwork. The map name, instructions and Chinese/Korean translations were added with the layout. `verification/showcase-*.jpg` are actual captures of that map.
- Missing Korean/Chinese translations were cached using Google Translate, followed by terminology corrections. Existing upstream English and Chinese text was preserved.

The cover is the user-supplied `A8426642F477C69C08D5DE1E1E828E7BF6184E4C.jpeg`, copied unchanged as `screenshots/cover.jpeg`. The other two screenshots are actual game captures made with this local port. The supplied EK directory contains no music, sound files or playable maps of its own, despite its map tag; none is represented as recovered from that directory.

RW timing reference: [the author's modding reference](https://corrodinggames.com/modding-reference-beta). In particular, source generation uses its 40-tick default interval where none is specified.

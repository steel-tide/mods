# EK Definitive Edition 2026h50

Local Steel Tide port of the supplied `rusted-warfare-mods/EK_Definitive_Edition` pack by ice-v5 and the EK contributors. All 573 named source definitions are included, including alternate forms, attachments, carriers and internal helpers. Five unnamed INI templates are resolved into those definitions.

The original English and Chinese names and descriptions are retained. Missing Chinese strings and Korean UI text are supplied in checked-in translation caches. Original body, turret, arm, leg, projectile and wreck pixels are used; this port does not redraw the units. See [CREDITS.md](CREDITS.md) for asset origins and the original license.

**This is an unlisted review build with documented parity gaps.** `hideFromListing: true` keeps it out of website and in-game discovery. [COMPATIBILITY.md](COMPATIBILITY.md) separates engine limitations, absent source dependencies and work still needed in this mod. Importing successfully does not mean every RW mechanic is reproduced.

## Use

In Steel Tide, open **Settings → Mods → Add folder** and select this folder. Enable the pack before starting a match. It uses format 4, large capacity and the existing extension host API 2. It needs a game build whose definitions accept `rotors` and a building's `sonar`; an older build refuses the pack at import.

This is an additive pack. Native engineers gain the source construction links; EK barracks, support factories and carriers expose their own production. Units that cost experimental research use package recruitment actions, including on native factories, so both currencies are charged. Research-priced buildings wait for the shared resource before construction progresses. No separate starting faction is added.

The conversion uses **10 RW credits = 1 metal**, **0.75 world pixels per RW pixel**, and **60 RW ticks = 1 second**. A building's RW footprint rounds up to whole tiles and the building is drawn up to 1.5× larger to fill it. Aircraft RW flies as bombers fly as fixed wings; every other aircraft hovers, and each spins only the blades RW gives it. RW's green team mask becomes each player's colour. HP and damage values are retained in the package simulation. Footprints and bounded native fields have explicit adaptations in `conversion-report.json`. Units do not acquire an extra population or power cost absent from the source.

中文：已保留全部 573 个有名称的源单位定义、原有中英文说明和原始素材，并补充缺失中文及韩文。此版本供本地审阅；尚未完全复现的机制、缺失素材和引擎限制详见兼容性报告。

한국어: 이름이 있는 원본 정의 573개와 원본 그래픽, 영어·중국어 설명을 보존하고 한국어 UI 번역을 추가했습니다. 현재는 로컬 검토용 버전이며, 구현 차이와 누락된 원본 자료는 호환성 보고서에 기록되어 있습니다.

## Complete showcase map

Enable EK, open **Conquest → Maps → Official → EK Complete Showcase**, and use **seat 1**. Turn fog off and leave seat 2 open for the test targets. The map supplies all **573 definitions**, including alternate forms, attachments and internal helpers, plus four passive land/air/sea targets. It grants the showcase owner **1,000,000 metal and 100,000 experimental research** once. Native AI stays idle on this map.

Specimens start paused so the complete roster remains available without automatic explosions, spawning or transformations. Select **Start specimen test**, give a movement/attack order, start production, use a unit action, or release **Hold fire** to activate that specimen. Its normal source scripts then run, including attachments, cargo, transformations and helper lifetimes. The rest of the gallery stays paused. Restart the map to restore the opening specimens. Some helpers are intentionally invisible in the original mod.

After updating an earlier local build, reload or re-import the pack in **Settings → Mods** and start a new showcase match. Existing saves retain their previous active specimens.

| Section | Definitions | Location (tile coordinates) |
| --- | ---: | --- |
| Ground units | 174 | Northwest, from (12, 32) |
| Aircraft | 118 | Northeast, from (172, 32) |
| Buildings | 93 | West, from (12, 224) |
| Amphibious units | 43 | Center, from (172, 264) |
| Fleet and offshore buildings | 49 | Eastern bay, from (284, 264) |
| Helpers and internal forms | 96 | Southwest, from (12, 348) |
| Opponent targets and base | — | Southeast, around (274–330, 408–432) |

[The specimen index](maps/showcase-index.json) gives every source file, localized name and exact location. This is a newly authored test map, not an original RW map. The host accepts at most 400 map placements: the file contains 396 EK specimens and four targets, and the mod adds the other 177 specimens on the opening tick. The editor therefore previews the first 400 placements. The setup matches this map's name, dimensions and placement signature; normal maps receive no test resources or extra units. Save/load retains the setup state and respects reassigned or closed spawn slots.

中文：在征服模式的官方地图列表中选择「EK 全单位展示测试场」，使用1号席位，关闭迷雾。全部573个定义按类别排列，提供100万金属和10万实验科技。展示单位默认暂停；选择「启动单位测试」、下达指令、使用动作或解除停火后，该单位才开始正常运行脚本。重新开始可重置展示。

한국어: 정복 모드의 공식 지도 목록에서 「EK 전체 유닛 시험장」을 선택하고 1번 자리에서 안개를 끄세요. 정의 573개가 종류별로 배치되며 금속 100만과 실험 기술 10만을 제공합니다. 표본은 기본적으로 정지합니다. 「표본 시험 시작」, 명령, 행동 또는 사격 중지 해제를 선택하면 해당 유닛의 원래 스크립트가 실행됩니다. 다시 시작하면 초기 배치로 돌아갑니다.

## Rebuild and check

Run from the mod repository root. Python 3 with Pillow, Node.js and FFmpeg are required; Bun is needed for the engine integration tests. The sibling game checkout is used read-only by the tests.

```sh
python3 mods/ek-definitive-edition/port.py
python3 mods/ek-definitive-edition/source_test.py
bun test mods/ek-definitive-edition/simulation.test.ts
python3 mods/ek-definitive-edition/localize.py
python3 mods/ek-definitive-edition/localize.py --zh
node tools/check.mjs mods/ek-definitive-edition
node tools/pack.mjs mods/ek-definitive-edition
```

`port.py --no-media` rebuilds metadata using already generated media. Normal builds are offline. `localize.py --refresh` (optionally `--zh`) explicitly translates only uncached UI text using Google Translate; it does not replace existing source translations. Translations are machine-assisted with terminology corrections, and may benefit from further language review.

`port.py` also regenerates the test map, specimen index and embedded extension package. `verify-browser.mjs` imports the actual folder in an isolated disposable Chrome profile, checks all definitions/assets, switches languages, selects the installed map in Conquest, and verifies its complete opening roster. It captures the gameplay screenshots and three map views. Set `EK_SOAK_SECONDS=60` to verify the idle map through a full minute of simulation with panning, fog and interpolated rendering, followed by explicit carrier activation. It expects the existing game Vite server at `http://127.0.0.1:5209`; override with `GAME_ORIGIN`. Evidence is in `verification/browser.json`, `verification/showcase-*.jpg` and `screenshots/`.

The package code lives entirely under `extensions/ek-systems`. It uses the public host SDK; it does not copy or modify the game implementation. The port is submitted as unlisted at version 0.0.2. Automatic registry publication remains blocked by the selected cover's 16:9 aspect ratio; the registry currently requires 4:3 screenshots.

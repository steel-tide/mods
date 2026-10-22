# UCGR

A local Steel Tide port of **UCGR-RE v4.3 / 巨浪 v1.29.6 信息战 20261004**,
by **GY工作室 / GY Studio**. Original player group: **1106943912**.
Version **0.0.1** carries its own executable extension and assets in this folder.
It requires the generic **extension host API 2** and large content capacity.
The ordinary game version string alone does not establish compatibility.
The pack ID and folder are `ucgr`; existing unit, sprite and extension IDs
retain their `usgr-re` namespace for authored content references.

This port is included in the Git repository and registry tooling. It sets
`hideFromListing: true`, so it is available through its direct mod page’s
**Add to Game** button and omitted from public discovery lists. It remains
unfinished: M5 is excluded;
other source gaps are listed in [LEDGER.md](LEDGER.md) and [the current coverage record](non-m5-status.json).
The available host APIs do not by themselves establish original-mod parity.

## Install and play

In **Settings → Mods → Open folder**, select `steel-tide-mods/mods/ucgr`,
the folder containing this README and `mod.json`. The original
`rusted-warfare-mods/usgr-re` folder is source material, not a Steel Tide pack.
Reload or reimport an installed copy, verify version **0.0.1**, and start a
**new match**. Select a UCGR national faction or **Crossroads Exercise**.
Installing content does not replace the current faction or an existing match.

The seven national rosters use Steel Tide's ordinary headquarters, construction,
metal economy and individual recruitment. The command posts, recruitment posts,
airfields and support builders are integration definitions using original art.
They do not reproduce the original decks or reinforcement economy. Crossroads
Exercise is a new two-seat showcase, not one of the source's 5v5 scenarios.

## Current source integration

The playable selection is recorded in [mvp-roster.json](mvp-roster.json); the
legacy filename is retained for the tooling. The manifest is authoritative.

- Shared vehicle armor, ERA, crew, component damage, rack failure, repair,
  source morale/rank effects and ammunition policies are compiled from reviewed
  source templates. [Combat coverage](combat-coverage.json) distinguishes the
  compiler's wider source coverage from units actually present in the pack.
- Retained magazines preserve their source empty, idle-partial or queued reload
  policies. Tank main rounds share one reload and finite stocks. Verified
  aircraft starting stocks are finite; unknown or unpaid replacement stocks
  do not become free reloads.
- Source-owned infrared, active-radar and semi-active missile families retain
  their flight, resistance, countermeasure, fuse and lifetime policies. Sampled
  radar contacts remain private and do not reveal hidden entity identity.
  Fixed-wing altitude, thrust and speed-brake actions use the source policies.
- The HJ-8 deploys and packs with its actual rifleman. Coupled transport retains
  both entities and their injuries. Source target tags apply per weapon;
  ordinary infantry concealment retains its source detection hysteresis.
- Original hulls, independent turret parts, projectiles, wrecks, component
  icons, selected effects and recordings travel in this pack. Source muzzle
  geometry uses native recoil where an exposed barrel is verified. Unknown
  numeric muzzle defaults remain reported rather than estimated.
- Tanks and IFVs carry the source Deploy Smoke and Engine Smoke actions: five-second
  markers that defeat ATGM-tagged rounds, with the original cooldowns and crew gates.
- TOS-1A deploys and fires its six-rocket barrage; artillery fire missions,
  battery radars and source transport limits follow their authored policies.
- Names and descriptions preserve source English and Chinese. Korean text and
  missing source-language tuples are supplied for all 415 candidate definitions.
  This text coverage includes candidates which are not yet playable.

These are bounded, tested implementations. They are not a claim that every
script or cosmetic in those families is reproduced. Consult
[COMPATIBILITY.md](COMPATIBILITY.md), [COMPONENT-GAPS.md](COMPONENT-GAPS.md),
[SENSORS-SOURCE-AUDIT.md](SENSORS-SOURCE-AUDIT.md), and
[M6-FEEDBACK-SOURCE-AUDIT.md](M6-FEEDBACK-SOURCE-AUDIT.md) for the boundaries.
Original descriptions can mention features still absent from this port.

## Rebuild and verify

All implementation, tests and port documentation stay in this mod repository.
The game is a read-only SDK and acceptance-test dependency for this work.
No UCGR implementation is installed in a shared mods package or the game core.
From the mod repository root:

```sh
python3 -B mods/ucgr/port.py --media
node mods/ucgr/extensions/combined-arms-v1/build.mjs
python3 -B mods/ucgr/port.py
python3 -B mods/ucgr/make-map.py
python3 -B mods/ucgr/status.py
python3 -B -m unittest discover -s mods/ucgr -p 'test_*.py'
bun test ./mods/ucgr/extensions/combined-arms-v1/test
bun test ./mods/ucgr/*.test.ts
node --test mods/ucgr/pack.test.mjs
python3 -B mods/ucgr/make-map.py --check-only
node tools/check.mjs mods/ucgr
node tools/pack.mjs mods/ucgr
```

Python, Pillow and FFmpeg rebuild the source media; Bun and the sibling game
checkout run engine acceptance tests. Build the package **after** media export
so it includes the new asset map, then regenerate `mod.json` with that descriptor.
`GAME_ORIGIN=http://127.0.0.1:5203 node mods/ucgr/capture.mjs` exercises the
actual folder import, verifies assets/modules and captures play screenshots.
`browser-verification.json` records that run; [verification.json](verification.json) records the latest commands and results. The packed file is
`dist/ucgr.steel-tide-mod`; it is not uploaded by these commands.

The source ledger [roster.json](roster.json) classifies all 724 INIs, including
415 candidate definitions. [media-report.json](media-report.json),
[muzzle-source-data.json](muzzle-source-data.json) and
[conversion-report.json](conversion-report.json) retain numeric and asset provenance.
The original package is a build input, not a runtime dependency.

The maintainer confirmed the original studio's permission for this port on
**2026-10-16**. [CREDITS.md](CREDITS.md), [notices/](notices/) and [LICENSE](LICENSE)
retain the source ownership and notices. No CC-BY relicensing is implied.

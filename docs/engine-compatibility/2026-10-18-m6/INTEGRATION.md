# M6 integration record

Game host commit: `2408f73f` on `main`. M5 remains skipped. The UCGR pack is the
existing ignored local draft in `mods/usgr-re`, version `0.5.0`, with its own
`combined-arms` extension `1.2.0`; it has not been added to the public registry.
There is no separate installable extension pack. This record describes checks
run against the local draft without making it a public repository dependency.

## Implemented and checked

- Generic package resource declarations, scoped schema/browser asset lookup,
  local feedback composition, native recording mixer and disposable native
  music queue layers. Source-specific logic remains in UCGR.
- Optional pre-emission shot composition. Vanilla simulation/combat is unchanged.
- 41 original recordings and ten original component icons. Source silence is
  preserved; public icon codes do not expose private damage or ammunition.
- 139 source-derived weapon origins, including 30 fixed aircraft origins and
  alternating barrels. Eleven verified barrels intentionally correct original
  spawn coordinates to their actual visible tips; both are retained in the
  source ledger. Recoil masks use exact PNG placement. Eleven recoil bindings
  reuse native rendering, with native timing.
- Six muzzle origins remain unresolved: A10's ground cannon needs independent
  bore/anchor handling; EC556HAD's three weapons, Mi-4 and UH-1 omit source barrel
  lengths. No unverified engine default was supplied.
- The source soundtrack belongs to the skipped full-spectrum mode. Audited new
  roster candidates retain unsupported reload/loadout mechanics and remain out.

## Verification

| Check | Result |
| --- | --- |
| Root `pnpm check` | All workspace type checks pass |
| Generic extension, audio and cold-load suites | 38 tests pass |
| Native recoil, mounts, content tools and mod suites | 66 tests pass |
| Recorded vanilla behavior corpus | 12 tests pass; fixtures unchanged |
| UCGR source converter/media suite | 73 tests pass |
| UCGR simulation, network, presentation and muzzle suites | 94 tests pass |
| Registry tooling tests | 3 tests pass |
| Ordinary offline UCGR pack | All declared extension resource bytes retained |
| Registry validation | Seven published mods pass; local UCGR separately passes |
| Real Chrome folder import and playback | All 51 resources present; all 41 WAV recordings decode; source silence and order throttle pass |
| Actual T90M muzzle pixels | Loaded atlas front edge, flash and projectile origin match exactly; native recoil remains active |
| Disable and return to vanilla | No extension runtime; exact native Game, Renderer and HUD constructors |

The final browser report and visual checks live in the local draft's
`verification/m6-browser/`, with the repeatable driver at
`verification/m6-browser.mjs`. These use an actual folder import in a fresh
Chrome profile, actual local voice routing, loaded atlas pixels and teardown
back to native constructors. Browser acceptance is separate from performance.

See [the performance record](README.md) for raw results and their limits.
The simulation/replication executable is byte-identical and no optional work is
added to the exercised vanilla hot paths. The strict cold-start and cross-device
shipping gate remains open; the evidence does not create a slowdown allowance.

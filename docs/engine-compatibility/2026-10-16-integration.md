# UCGR 0.3.0 integration acceptance — 2026-10-16

Engine implementation: local main commit `31095b4f`. No changes were pushed.

The existing `mods/usgr-re` pack now exercises every M1–M4 module with audited
source cases. It is not a separate fixture pack or a claim of full RW parity.
The engine changes are generic data policies; source numbers, selection,
localization and conversion evidence stay in this repository.

| Module | Actual source acceptance |
| --- | --- |
| M1 components | T-90M + 3BM60 AP + 3OF26 HE: directional plate/layer interaction, independent part damage, finite crew, shared repairs, stock-dependent rack threshold and delayed attributed destruction |
| M2 logistics | T-90M AP/HE selection with shared reload, finite inventory, ten-second ammo/ERA refill and eighteen-second crew refill; independent movement/firing service locks |
| M3 sensors | MiG-29 RADAR_AIR with source signatures on eight fixed-wing aircraft, sampled body-forward contacts and private measured coordinates |
| M4 articulation | Real HJ-8 launcher/rifleman assembly, two-second automatic deploy/pack, preserved orders, independent bearing/firing, casualty and save continuity; existing authored mounts retained |

The component loop and its supply service were reviewed together. The review
caught timer bypass, crew/reserve races, residual repair/ERA completion,
restored-inventory validation and attribution privacy issues. The deployment
review caught dropped attack orders, disabled firing during pack-up and helm
movement failing to trigger packing. Those cases now have acceptance checks.
The optional HUD also preserves scrolling through a long component list during
its ordinary refresh.

## Functional validation

- Root `pnpm check`: all workspace type checks and generated-kernel check passed.
- Root `pnpm build`: production bundle and world API checker built successfully.
- Root `pnpm test`: release, game, CLI and website suites passed. The game shards
  report 4,471 passing tests, one existing todo and no failures.
- Python source/converter tests: 54 passed.
- Actual mod tests: 31 passed, 617 assertions across `game.test.ts`,
  `components-game.test.ts` and `sensors-game.test.ts`.
- Registry checker: all eight packs passed against the rebuilt game validator.
- Real browser folder import: 96 definitions, 131 sprite sheets, all four
  requested modules, no missing definitions/art and no uncaught errors.
  HJ-8 deployment/movement and MiG-29 contact rows are checked in that same
  installed pack, with fog enabled and the BTR-82A present. Long component-list
  scroll position survives HUD refresh. The three atlas warnings name existing vanilla sprite keys.

`mods/usgr-re/browser-verification.json` and its screenshots are reproducible
with `node mods/usgr-re/capture.mjs` against the local game on port 5199.
Source extraction and actual-manifest acceptance remain independently runnable
using the commands in the pack README.

## Fog crash found during playtesting

The BTR-82A's source-derived `vision` is 9.600000000000001 tiles. The terrain
ray builder walks integer coordinates, so a fractional destination never
terminated. A bounded child-process witness reached the real ray call and
failed to return within 200 ms, then was killed by the test parent.

Content definition construction now rounds authored/inherited vision once to
the nearest whole tile. The source manifest remains unchanged. This generic
fix covers legacy mods, current packs, embedded worlds and restored/network
content, without touching native visibility updates or caches. Five dedicated
content-vision tests and the actual 96-definition fog/save/load test cover the
failure. The focused content/terrain/mod checker run passed 76 tests with 4,076
assertions, followed by type checking, a production build and browser capture.

## Performance and remaining scope

The clarified gate accepts small payload growth and requires no measurable
vanilla runtime degradation. The [isolation record](2026-10-16-isolation/README.md)
contains cold-import checks, canonical-body identity, real production startup,
heap measurements, final battle/duel comparisons and their measurement limits.
Optional-feature costs are borne by enabled matches.

See the pack's [playtest guide](../../mods/usgr-re/PLAYTEST.md) and
[compatibility ledger](../../mods/usgr-re/COMPATIBILITY.md). ATGM/HEAT component
payloads, other vehicles' component loops, source missile seekers/ECM,
countermeasures and coupled HJ-8 transport remain omitted. Detailed source
limits live in `COMPONENT-GAPS.md` and `SENSORS-SOURCE-AUDIT.md`; the preserved
original unit descriptions do not certify implementation of every source claim.

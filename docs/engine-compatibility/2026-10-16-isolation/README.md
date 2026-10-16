# Vanilla runtime isolation — 2026-10-16

The clarified acceptance rule permits a few KB of integration code, but no
measurable vanilla runtime regression. This pass removes known inactive work
and screens real production startup in two desktop browser engines. It does not
assert identical nanoseconds on all devices.

## Changes included in the measured candidate

- Module-factory preparation and optional UI preparation moved into separate
  `contentCapabilityLoader` / `contentPresentationLoader` chunks. Neither is
  imported or service-worker-precached by ordinary play.
- The no-content manager path no longer awaits a resolved capability Promise.
  It therefore retains its original async scheduling at that boundary.
- Match sidecar WeakMaps and the navigation preparation WeakSet allocate only
  on actual use. Optional loader registries allocate only after activation.
- Ordinary definition packs do not construct an extension reference table.
- The localization source remains the complete `core/strings.ts`. A proposed
  build-time string splitter was discarded before it was built or measured,
  following the clarification that a few KB of code is acceptable.

The production candidate was frozen before concurrent changes to optional
feature modules. All files in this pass's isolation plumbing match that build;
new gameplay behavior inside optional modules requires its own final checks.
The initial JS file hashes are recorded in `production-startup.json`.

## Structural and functional evidence

`canonical-kernel-identity.json` checks the exact canonical source bodies against
`c4754358`: 97 combat, 3 fire-control, 64 simulation, 43 frame encoding, 12 remote
frame, 316 rendering, 212 input and 284 HUD bodies/initializers are unchanged.
Save/load keeps four previously documented integration wrappers; it is not
counted as total source identity. Source identity does not prove identical JIT
output or performance by itself.

The added cold-process test in the engine's `content-cold.test.ts` rejects any
attempt to import a capability loader, schema, runtime or presentation loader,
then opens, steps and saves a vanilla match. It confirms the original `Game`
prototype, absent optional runtime/presentation, and no extension save block.

The seven focused capability suites passed before concurrent feature work:
49 existing cases and then the added cold case (50 total). Core type checking
also passed at that point. The integration owner subsequently completed the
full tests and type check. A later user-reported mod-with-fog crash was traced
to fractional authored vision entering an integer ray loop. The integration
owner normalized definition vision at the cold activation boundary and
verified the actual pack with fog, including the affected BTR-82A; native
vision code remains unchanged. The runtime diagnostic was rebuilt afterward.

## Production startup and retained JavaScript heap

`production-startup.mjs` serves the actual Vite production app with gzip JS/CSS,
shared original media and service workers enabled. Every sample creates and
closes a fresh browser process/profile. It records the boot-ready DOM transition
before user input and the first-screen transition after Enter. No engine debug
hook or special benchmark entry replaces the application.

Four baseline-only A/A samples precede one ABBA comparison in each engine
(two observations per variant). Chromium heap counters are sampled after an
explicit DevTools garbage collection. The first-screen heap sample follows
one second of real menu activity, so menu/canvas work contributes variance.

| Median measure | Baseline | Candidate | A/A control difference |
| --- | ---: | ---: | ---: |
| Chromium boot ready | 4075.75 ms | 4138.65 ms (+1.54%) | 58.05 ms (1.42%) |
| Chromium screen entry | 637.35 ms | 630.90 ms (-1.01%) | 55.80 ms (8.97%) |
| Chromium retained JS heap | 10,608,852 B | 10,276,228 B (-3.14%) | 737,532 B (7.16%) |
| Desktop WebKit boot ready | 4325.50 ms | 4297.50 ms (-0.65%) | 484.00 ms (11.45%) |
| Desktop WebKit screen entry | 458.00 ms | 460.50 ms (+0.55%) | 6.00 ms (1.31%) |

All 16 boots completed without JavaScript errors and without requesting any
optional capability chunk. Chromium's small startup increase is similar to its
A/A variation and is not reproduced by WebKit. This screening does not identify
a repeatable runtime regression; its small sample count is not sufficient to
exclude very small effects. It is not a significance test or a percentage-based
permission to slow the game down.

The production initial JS is 11,478 bytes larger (5,248 bytes gzip) than the
freshly built baseline, under the same release identity and build settings.
That integration payload is reported separately under the clarified gate.

## Final runtime comparison and gate status

[The final runtime evidence](final-runtime/README.md) contains 48 completed
fresh-Chromium samples against `c4754358`, with A/A controls, balanced battle and
duel comparisons, matching behavior/wire witnesses and a fresh canonical-body
identity check. The longer final battle comparison measured simulation at
0.99706 versus 1.00009 ms (+0.30%) and replication at 1.03114 versus 1.03735 ms
(+0.60%). Its same-build A/A differences were -1.70% and -1.57%, respectively.
Duels measured simulation at 0.38986 versus 0.39046 ms (+0.15%).

**The operational runtime gate passes in the tested desktop scope: no
repeatable measurable regression was detected.** Short battle runs showed a
possible replication-tail increase, which was investigated rather than hidden
by the mean. After the fog fix, a rebuilt diagnostic warmed and measured 3,600
ticks in each of 12 fresh browsers. Replication p95 was 1.2550 versus 1.2575 ms
(+0.20%), p99 1.6400 versus 1.6375 ms (-0.15%); same-build A/A differences were
-2.92% / -7.35%, with overlapping sample ranges. The earlier tail signal did
not reproduce. The original interrupted confirmation is retained and excluded.
Both rebuilt diagnostic bundles are byte-identical to their earlier builds.

## Limits and acceptance scope

- Desktop WebKit is not an iPhone measurement. Low-end physical devices remain
  unmeasured.
- Chromium's heap counter excludes native decoded media, GPU memory and process
  overhead. WebKit exposes no equivalent retained-heap counter through this
  harness.
- This is the fresh no-mod startup lifecycle. Returning from an enabled mod to
  vanilla selects the original kernels, but a browser retains imported module
  code in its cache until reload. This pass does not claim unloading that code.
- Optional feature work continued after the production startup snapshot. The
  final fixed-battle/duel comparison uses the later engine source; its imported
  graph excludes optional presentation changes. The final long comparison
  closes the observed replication-tail concern for these fixtures. There is no
  allowed slowdown percentage and no claim of literal universal zero cost or
  exclusion of smaller effects below this experiment's resolution.

## Reproduce

From the mods repository, with the original baseline archive available:

```sh
STEEL_GATE_OUT=/path/to/build-output node tools/engine-capability-gate/web-build.mjs base
STEEL_GATE_OUT=/path/to/build-output node tools/engine-capability-gate/web-build.mjs candidate
node tools/engine-capability-gate/production-startup.mjs \
  --engine /path/to/steel-tide --build /path/to/build-output \
  --playwright /path/to/playwright/index.mjs --engines chromium,webkit --rounds 1 \
  --out /path/to/new-evidence
node tools/check-engine-kernel-identity.mjs --out /path/to/new-evidence/canonical-kernel-identity.json
```

Playwright and its browser binaries must already be present. The script does not
install dependencies, stop the user's Vite server, or change user browser data.
Do not run tests, builds or another benchmark concurrently with timing samples.

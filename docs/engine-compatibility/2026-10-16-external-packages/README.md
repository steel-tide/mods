# External extension package refactor — 2026-10-16

The generic host is committed on game `main` as `28609d80`. This record compares
it with game `31095b4f` and UCGR pack `116ac82`. It is evidence for extracting existing behavior, not adding another
UCGR mechanic or clearing the remaining cross-platform performance gate.

The game owns package loading, integrity, locally granted execution, the host
SDK, optional match lifecycle and generic presentation/replication boundaries.
The mod repository owns the `combined-arms` package: components, logistics,
sensors, articulation, their configuration readers and presentation adapters.
UCGR 0.4.0 embeds that descriptor in its existing format-4 manifest. There is no
second selectable mod. See [the host contract](../../EXTENSION-FRAMEWORK.md).

## Behavior and functional verification

- [Gameplay data](gameplay-data.json): the manifest matches UCGR 0.3.0 exactly
  after excluding only `v`, `version` and `extensionPackages`: 96 definitions,
  131 sheets, 36 sounds. Original gameplay data, maps and art files are preserved.
- [Native function identity](native-identity.json): 1,068/1,068 existing native
  function/method bodies and field initializers match `31095b4f`, including all
  37 save functions. This establishes source identity of the inspected native
  paths, not timing or complete application byte identity.
- Root type checks and production/standalone-server builds pass. The game suite
  passes 4,431 tests, with one existing TODO; CLI passes 52. The 55 gameplay and
  CLI extension tests moved beside their implementation and still run against
  the engine. Together with the 31 actual UCGR tests they pass 86 tests and
  1,103 assertions. The external source passes its own strict TypeScript check.
  The Python converter passes 54 tests. The registry passes three Node tests and
  14 definition/faction tests; all eight published packs validate.
- The unrelated core fixture `test-counter-v1` proves the host accepts a new
  capability without an engine catalog entry. Its 11 tests cover schema/runtime
  loading, commands, state restoration, version isolation, exact provider
  matching, tampering, unsupported ABI, unapproved network code and both SHA-256
  paths. Three cold-path tests verify vanilla never imports optional machinery.
- The browser imports the actual `mods/usgr-re` folder through the Mods screen,
  starts a match and loads all four modules without uncaught errors. The same
  test passes with Web Crypto deliberately unavailable, as on plain HTTP or the
  desktop origin. Three existing vanilla atlas-key warnings remain.
- A production module worker and the compiled standalone server both load the
  actual UCGR world and replicate all four module states. The server receives
  package approval through local administrator configuration, never the socket.
  The desktop smoke test verifies Blob module loading on its insecure custom
  origin and a second player joining the in-app host.

[Verification](verification.json) records commands and artifact hashes. Browser,
worker, standalone and desktop results are stored beside this file.

## Vanilla performance scope

The frozen baseline for this refactor already has optional match/frame factories.
Both sides therefore use their real content factory and codec dispatch. The
benchmark builder's `--base-content` switch is essential when reproducing this
comparison; its default still serves the older pre-framework baseline.

The quiet run uses fresh Chromium profiles, four workloads, A/A controls and two
balanced A/B rounds per workload. Each sample warms 900 ticks and measures 900
ticks from the same frozen scenario. No build, test suite or content capture
runs alongside it. Timing statistics are descriptive; no percentage allowance
turns a slowdown into a pass. State, wire and snapshot witnesses must agree.

The [quiet-run statistics](quiet-summary.json) show the following median changes
in each browser sample's mean time (positive means slower):

| Workload | Simulation | Replication |
| --- | ---: | ---: |
| Battle | +1.87% | +2.45% |
| Idle | −2.28% | −3.02% |
| Duels | +0.40% | +0.33% |
| Projectiles | −2.05% | +0.23% |

Battle, idle and duels change direction between balanced rounds. Projectile
replication is slower in both short rounds (+2.41%, +1.51%), so it receives a
separate [extended run](projectiles-summary.json): 1,800 warm/1,800 measured
ticks, four balanced rounds, A/A controls, 20 fresh browsers. Its replication
median is −1.40%; round changes are −2.55%, −5.36%, +0.47% and −1.15%.
Simulation's median is +0.54%, with rounds +0.05%, −5.44%, +1.12% and +0.78%.
All state/wire/snapshot witnesses match within each scenario. This does not
establish a repeatable refactor slowdown, and does not prove exact equality.
**The strict overall release gate remains open.**

Earlier raw diagnostics remain available: `vanilla-timings.json` used the older
direct baseline harness and is not an attribution test of this refactor;
`vanilla-controlled.json` corrected that harness but overlapped brief functional
verification near its end. They are retained for transparency and excluded from
the final quiet-run statistics.

Production vanilla startup fetches no optional extension chunk. This checks
network/loading isolation and does not establish zero parsing cost, identical
startup time, identical heap usage or performance on all devices. Full renderer,
long-match and low-end/mobile/WebKit release evidence remains required by the
original gate. Any reproducible vanilla slowdown still blocks expansion.

## Reproduction

Use a frozen checkout/archive of game `31095b4f` and its installed build tools:

```sh
node tools/check-engine-kernel-identity.mjs --game ../steel-tide --base 31095b4f --out /tmp/native-identity.json
node tools/engine-capability-gate/build.mjs --engine ../steel-tide --base /path/to/frozen/31095b4f --base-ref 31095b4f --base-content --out dist/external-extension-quiet
node tools/engine-capability-gate/run.mjs --engine ../steel-tide --build dist/external-extension-quiet --out /tmp/vanilla-quiet.json --workloads battle,idle,duels,projectiles
node tools/engine-capability-gate/summarize-vite.mjs /tmp/vanilla-quiet.json --out /tmp/quiet-summary.json
```

Build the external package before regenerating UCGR:

```sh
node extensions/combined-arms-v1/build.mjs
python3 -B mods/usgr-re/port.py
bun test ./extensions/combined-arms-v1/test ./mods/usgr-re/game.test.ts ./mods/usgr-re/components-game.test.ts ./mods/usgr-re/sensors-game.test.ts
node tools/check.mjs
```

`tools/verify-extension-server.mjs` runs with Bun against a compiled server and
the world emitted by `tools/engine-capability-gate/export-world.ts`. Package
approval is explicit through `STEEL_TIDE_EXTENSION_PACKAGES`. Historical evidence
for the initial optional-kernel implementation remains in the adjacent dated
directories.

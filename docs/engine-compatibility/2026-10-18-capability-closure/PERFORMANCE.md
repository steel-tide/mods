# Vanilla performance evidence

The operational gate passes in the tested desktop scope: this pass did not
identify a repeatable measurable vanilla runtime regression. This is a bounded
measurement result, not a claim of identical nanoseconds on every device.
There is no percentage allowance for a slowdown. The earlier clarified gate
permits a few KB of integration code; its separate payload cost is reported.

## Isolation and comparison

[Snapshot provenance](snapshot-provenance.json) records the pre-pass working
tree at game revision `2408f73fe5f1880ee49485edec97d9fdc16e0bc7` and the frozen
candidate, including hashes of every owned file. Both snapshots contain the
same initial unrelated working-tree changes. Only this pass's files and its
exact edits to the two mixed files were copied into the candidate; later UI,
art and recruiting edits were excluded. Both use the same production media,
release identity, build settings and installed tooling. Timings ran serially,
without this task's builds or tests competing with them.

[The exact source-body check](native-body-identity.json) covers 1,439 existing
function/method bodies and class initializers across simulation, combat,
orders, save, frame codecs, rendering, input, HUD, GameScreen, frame loop and
audio. **1,437 are identical**. The two explicit cold changes are save-input
validation and optional feedback binding in `GameScreen.mount`. Every checked
native tick/draw/input/audio body is unchanged. New exported helpers and
access/export modifiers are reported separately. This is stronger than a
passing timer alone, but does not establish identical generated machine code.

[The build comparison](build-identity.json) finds no optional runtime,
presentation or recorded-audio module in the vanilla initial import closure.
The initial JS grew by **5,634 bytes, or 1,481 bytes gzip**. The simulation
benchmark bundles are **not byte-identical**: they include changed cold
validation/entry code, so a byte-identity performance claim would be incorrect.
The no-content tests also retain the native Game identity and reject imports
of optional loaders while opening, stepping and saving a vanilla match.

## Simulation and replication

[The first diagnostic](runtime.json) ran 36 fresh Chromium processes: four A/A
controls and eight balanced comparisons for each of battle, duels and
projectiles, with 1,800 warmup and 1,800 measured ticks. Every scenario's frozen,
start, final-state and wire witnesses agree across all runs. The battle means
initially measured higher in the candidate; the direction reversed between
balanced rounds. That result was retained and investigated.

[The longer confirmation](runtime-confirmation.json) ran another 12 fresh
processes with 3,600 warmup and 3,600 measured ticks for battle. These are medians
of the per-browser measurements; each comparison column has four observations.

| Measurement | Baseline | Candidate |
| --- | ---: | ---: |
| Battle simulation mean, confirmation | 1.01243 ms | 1.01546 ms |
| Battle simulation p95, confirmation | 1.61250 ms | 1.64500 ms |
| Battle simulation p99, confirmation | 2.18500 ms | 2.16750 ms |
| Battle replication mean, confirmation | 1.04647 ms | 1.04635 ms |
| Battle replication p95, confirmation | 1.28500 ms | 1.27750 ms |
| Battle replication p99, confirmation | 1.67750 ms | 1.66000 ms |
| Duel simulation mean | 0.28275 ms | 0.28142 ms |
| Duel replication mean | 0.70713 ms | 0.70684 ms |
| Projectile simulation mean | 0.39749 ms | 0.39487 ms |
| Projectile replication mean | 0.88597 ms | 0.88533 ms |

The confirmation's simulation-mean difference is 0.00303 ms; the A/A
same-build mean difference is 0.00291 ms. The two comparison-round mean
differences again have opposite signs. Simulation p95 remains higher in the
candidate, with overlapping per-browser ranges: baseline 1.555–1.685 ms,
candidate 1.595–1.655 ms. Simulation p99 and both replication tails are lower.
The initial broad slowdown did not reproduce consistently. These small samples
do not exclude a tiny effect; overlap alone is not an equivalence proof.
All confirmation behavior/wire witnesses still agree.

[Initial summaries](runtime-summary.json) and [confirmation summaries](runtime-confirmation-summary.json)
retain means, p50/p95/p99, ranges, A/A controls and each balanced round. No
samples were dropped and no percentage threshold converts a slow result into
a pass.

## Real match rendering

[The renderer report](renderer/summary.json) uses the unchanged native raster
benchmark, full GameScreen/HUD, high graphics, clear/noon, 1,024 opening units,
five seconds of live warmup and ten seconds of measurement. Four fresh Chrome
processes run ABBA. The canvas is 2,880 × 1,620.

Median render time is **7.39675 ms baseline / 7.32083 ms candidate**; render p95
is **8.25 / 8.10 ms**. Both maintain about **59.89 FPS** and **30 simulation
ticks/s**, with **zero missed frames, backlog or JavaScript errors**. This is
warmed development-module delivery, not the production startup test. Screenshot
hashes and local capture locations are recorded in [screenshots.json](renderer/screenshots.json);
the large originals remain in ignored `dist` output rather than the registry.

## Production startup and memory

[The production run](startup/production-startup.json) launches the actual
compressed Vite build and original media with service workers enabled, using a
fresh process/profile each time. Each browser has four A/A controls followed
by 12 balanced comparisons. The script records boot-ready before human input,
first-screen entry after Enter, and Chromium retained JS heap after explicit GC.

| Median measurement | Baseline | Candidate |
| --- | ---: | ---: |
| Chromium boot ready | 3,862.25 ms | 3,884.30 ms |
| Chromium screen entry | 641.45 ms | 644.70 ms |
| Chromium retained JS heap | 10,574,530 B | 10,391,232 B |
| WebKit boot ready, initial run | 3,639 ms | 4,666 ms |
| WebKit screen entry, initial run | 458 ms | 462.5 ms |
| WebKit boot ready, confirmation | 3,670 ms | 3,634 ms |
| WebKit screen entry, confirmation | 457.5 ms | 456 ms |

The initial WebKit boot median was a material warning, not accepted as noise
without investigation. [The confirmation](startup-confirmation/production-startup.json)
adds 20 fresh WebKit processes: four A/A controls and 16 balanced comparisons,
with DOM boot-stage timestamps. Both builds show occasional roughly one-second
pauses between progress 98 and 99, after mod initialization, during the
cursor/interface stage. The baseline comparison has three such pauses and the
candidate two; an A/A baseline sample also shows one. Before that stage, median
progress-98 time is 3,569.5 ms baseline / 3,559.5 ms candidate. Main boot, cursor
and platform sources are [byte-identical](startup-stage-identity.json).

These observations locate the bimodality in an unchanged stage and do not
reproduce a candidate-specific delay. They do not identify the underlying
WebKit scheduler/encoding cause. No cursor/game changes were made to improve
the benchmark. All **52 production boots** complete without errors or requests
for optional extension chunks. The first-screen heap has ordinary scene/canvas
variation; native image/GPU memory is outside the Chromium counter, and WebKit
has no comparable counter in this harness.

## Limits and reproduction

This is desktop Chrome and desktop WebKit on one machine, not physical iOS,
Android, low-memory or long-session certification. Local HTTP/OS media caches,
browser scheduling and JIT decisions introduce variance. Once an installed
extension has been imported, browser module code cannot be unloaded until a
page reload; the no-mod gate here uses fresh profiles. The frozen working trees
are local artifacts, with their source hashes preserved in the provenance.

From the mod repository, use:

- `tools/check-extension-host-isolation.mjs --base <baseline> --candidate <candidate> --out <identity.json>`
- `tools/engine-capability-gate/build.mjs --engine <candidate> --base <baseline> --base-ref 2408f73f --base-content --out <build-dir>`
- `tools/engine-capability-gate/run.mjs --engine <candidate> --build <build-dir> --out <runtime.json> --warmup 3600 --measured 3600 --rounds 2 --workloads battle`
- `tools/benchmark-engine-renderer.mjs --baseline <baseline> --game <candidate> --base-ref 2408f73f --base-port 5211 --candidate-port 5212 --out <renderer-dir>`
- `tools/engine-capability-gate/production-startup.mjs --engine <candidate> --build <build-dir> --out <startup-dir> --playwright <installed-playwright/index.mjs> --webkit <installed-pw_run.sh> --rounds 3`

Build the real apps with `tools/engine-capability-gate/web-build.mjs base` and
`candidate`, setting `STEEL_BASELINE`, `STEEL_CANDIDATE`, `STEEL_BASELINE_REF` and
`STEEL_GATE_OUT` to the recorded paths. `compare-builds.mjs` and
`summarize-runtime.mjs` in this directory regenerate the compact reports.

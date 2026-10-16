# Vite vanilla diagnostic

This is a separate diagnostic for the final M0–M4 discrepancy. Existing Bun
results remain unchanged. It uses the engine's production Vite/Rollup version,
targets, minifier, definitions and asset policy, with a small benchmark entry;
it does not build or render the full app or apply app-only plugins.

```sh
node tools/engine-capability-gate/build.mjs --engine /path/to/steel-tide --base /path/to/c4754358
node tools/engine-capability-gate/run.mjs --engine /path/to/steel-tide
```

The baseline may be a clean archive without `.git`; `build --base-ref` records
its reference through the candidate repository (default `c4754358`) and sets
the same release commit identity before reading either production config.

Both scripts accept output options (`build --out`, `run --build` and `run --out`).
Default generated bundles go under `dist/engine-capability-gate`; raw evidence goes
to `docs/engine-compatibility/2026-10-16-m0-m4/vite-diagnostic-runs.json`.
Do not run with another benchmark, build or test load competing for the CPU.

Default scope is the dense four-seat battle only: 198 extra units per seat,
fixed map/seed, freeze at tick 300, warm a restored copy for 900 ticks including
full/delta replication and stringification, then restore that exact snapshot
again and measure 900 ticks. The warm and measured phase execute the same loop.
Baseline keeps its original direct factory/frame calls. Candidate uses the real
content game factory and selected frame codec, preserving the actual dispatch
being investigated. Frozen/start/end and wire digests must match across samples.

Every sample launches and closes a fresh Chrome process and temporary profile.
A/A control uses the identical baseline build under two labels in ABBA order.
Then two comparison rounds run ABBA and BAAB (four samples per variant). This
narrow default should take roughly one or two minutes on the development host;
it is not a measured duration promise. `--rounds`, `--warmup`, `--measured`,
`--freeze-ticks`, `--workloads battle,idle,duels,projectiles` and `--skip-aa` allow
explicit extensions. Record changed options with the result.

Interpret A/A variation before treating a small difference as a regression or
claiming parity. The restored fixed start avoids changing the sampled battle
phase when warming longer. This diagnostic does not establish render, startup,
mobile/WebKit, memory-retention or installed/disabled lifecycle performance.
No engine files are changed by these scripts. The build graph records chunk
boundaries, and runtime resource paths show what each vanilla sample fetched.

## Reference checkout

`freeze-baseline.mjs --engine /path/to/steel-tide --ref c4754358` creates a new
archive under the system temporary directory and prints its path. It neither
switches branches nor changes the engine checkout. It shares installed
`node_modules` and unchanged generated `public` assets between variants; tracked
assets from the archive are retained as `public.archived`. Use its printed path
with `build.mjs --base`. Do not change dependencies or assets between samples.

## Other witnesses

The other scripts use `STEEL_CANDIDATE`, `STEEL_BASELINE` and `STEEL_GATE_OUT`
environment variables. Defaults are the sibling game checkout, the original
`/tmp/steel-tide-capability-baseline-c4754358` archive, and the game's ignored
`.steel-tide-data/engine-capability-gate` directory.

- `browser-build.ts` (run with the engine's Bun) and `browser-run.mjs` reproduce
  the earlier Bun experiment using `browser-legacy-template.ts`. The template
  defaults to the longer 900/3,600-tick run; the initial run used 300/900. These
  results retain the documented unwarmed-replication and shared-process limits.
- `web-build.mjs base` and `web-build.mjs candidate` build the real production
  app and record its complete chunk graph, using the same baseline commit label.
  They suppress copying the media tree and do not regenerate art.
- `production-boot.mjs` serves that candidate build with the shared public assets,
  opens a fresh browser, enters the normal first screen, and checks that neither
  boot nor service-worker precaching fetches optional capability chunks.
- `export-world.ts` (Bun) writes the hosted acceptance world, then
  `worker-check.mjs` verifies the real compiled module worker's handshake,
  content preparation, first extended frame and shutdown.
- `summarize.mjs <browser-runs.json> [output.json]` reports the original Bun
  samples' descriptive statistics and matching behavior witnesses. It never
  turns a percentage threshold into a performance pass.
- `summarize-vite.mjs <runs.json...> --out summary.json` summarizes completed
  `run.mjs` reports, including A/A dispersion and each balanced round's mean and
  tail comparisons. Incomplete or interrupted reports must be excluded. Results
  with different measured lengths have separate behavioral-identity groups.
- The adjacent `../check-engine-kernel-identity.mjs` and
  `../benchmark-engine-renderer.mjs` record source identity and live full-HUD
  rendering. `../benchmark-engine-capabilities.ts` measures feature-enabled
  costs separately.

Browser scripts use the engine's existing Chrome/CDP test helper. Their temporary
profiles are removed, and only processes they launch are stopped. Run timing
experiments one at a time; functional worker/boot checks are not benchmarks.

## Real production startup and JavaScript heap

`production-startup.mjs` compares the real production builds, using an already
installed Playwright module and Chromium/WebKit binaries. Pass `--playwright
/absolute/path/to/playwright/index.mjs`, `--engine`, `--build`, and `--out` as
needed. `--engines chromium,webkit --rounds 1` runs A/A controls and ABBA in fresh
browser processes. `--samples 1` is a functional smoke check only. It records
boot-ready time, screen-entry time, Chromium's collected JS heap and requested
chunks; it never converts a percentage tolerance into a performance pass.

The current user requirement permits small integration payload growth while
requiring no measurable vanilla runtime degradation. Byte growth remains
reported separately. See the dated `2026-10-16-isolation` evidence for scope,
noise and device/retention limitations.

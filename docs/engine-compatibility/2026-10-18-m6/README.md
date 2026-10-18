# M6 vanilla isolation evidence

This record compares game commit `1e4087ce` with that same commit plus the
M6-owned host changes. Other work was changing the live game checkout, so the
candidate was a temporary detached clone containing only the files listed in
`candidate-provenance.json`. The baseline was a `git archive`; both used the
same installed dependencies and a frozen copy of the same public assets.
Neither repository's working branch was switched.

M5 is excluded. UCGR's implementation and recordings remain inside its own
local pack. These measurements load no mod.

## Exact witnesses

- `build-identity.json` records the vanilla simulation/replication executable:
  both variants are exactly 635,599 bytes with SHA-256
  `5528d9d005cb43931bb8acc06fc164b16754dfcbbc9512b228b5e2c29cb28880`.
  Both use the real content game factory and frame-codec selection. On this
  exercised path, M6 adds no generated instructions.
- `canonical-kernel-identity.json` checks all 1,068 existing function/method
  bodies and class initializers in combat, fire control, simulation, frames,
  remote frames, saves, rendering, input and HUD. 1,067 are identical. The
  exception is `Hud.handleEvent`, whose crew voice call now uses the selected
  feedback method; `Hud.unitVoice` is new. The existing strict source checker
  therefore reports **FAIL**. Its raw result is retained, without adding an
  exception or claiming that every HUD body stayed identical. Every checked
  combat, simulation, save, replication, renderer and input body is identical.
- The production initial import closure contains no optional extension runtime,
  schema or presentation module. `compare-builds.mjs` produces this witness and
  reports initial payload growth separately. This is not a payload-free change.

## Measurements

The commands ran sequentially, with the other task agents holding builds, tests,
audio conversion and browser work. Samples are descriptive evidence, not a
percentage-based pass threshold.

`vanilla-runs.json` / `vanilla-summary.json` contain four fresh-Chrome A/A control
samples, then ABBA and BAAB comparisons. Each restores the same battle snapshot
after 900 warmup ticks and measures 900 ticks, including full/delta replication
and stringification. All frozen, start, final and wire digests match; every run
has the same 8,223,962 wire bytes and 143,654 snapshot bytes. Although the two
executables are byte-identical, the median sample means differ by +1.20% for
simulation and +1.08% for replication. The balanced rounds disagree. These
differences measure run-to-run variation; they do not demonstrate an M6 code
cost or establish a slowdown allowance.

`renderer/` records the unchanged full-match benchmark driver in ABBA order:
1,024 initial units, the complete HUD, high preset, clear noon, 1,920 × 1,080 CSS
viewport, five seconds of warmup and ten seconds measured. Every run has zero
missed frames, zero behind ticks and no browser errors. The average sample FPS
is 59.889 baseline and 59.893 candidate; average render time is 7.658 ms baseline
and 7.586 ms candidate. This four-sample desktop witness shows no renderer
slowdown; it does not establish a performance improvement or mobile parity.

`production-startup.json` and its summary record the real production app in
fresh Chromium and WebKit processes, with A/A controls and ABBA comparisons,
service workers enabled, initial bytes and Chromium's collected JavaScript heap.
All 16 samples have no boot errors and fetch no optional extension chunk.

| Median sample metric | Baseline | Candidate |
| --- | ---: | ---: |
| Chromium boot ready | 3,951.55 ms | 3,924.55 ms |
| Chromium first-screen entry | 634.70 ms | 672.55 ms |
| Chromium retained JavaScript heap | 10,885,852 bytes | 10,482,982 bytes |
| WebKit boot ready | 4,069.50 ms | 3,562.00 ms |
| WebKit first-screen entry | 459.00 ms | 453.50 ms |

Chromium's entry median increases by 37.85 ms; its A/A entry observations span
633.9–705.7 ms. WebKit's A/A boot observations span 3,589–4,569 ms. With two
observations per comparison variant and these fluctuations, startup evidence is
**inconclusive for strict parity**, not a passed zero-regression gate. The lower
heap sample also does not establish a memory improvement. The raw evidence
retains these differences without converting the control dispersion into a
slowdown allowance.

The Chromium suite completed before the default WebKit launcher reported a
missing cache revision. The installed WebKit binary was then selected explicitly
and its full suite completed. `production-startup-chromium.json` and `webkit/`
retain both original runs; `production-startup.json` combines their 16 samples.
No browser was downloaded or installed.

## Final optional-only corrections

After timings finished, the host added resource-cache reload/weak ownership
corrections and the optional shot wrapper needed by source hardpoints. Review
also fixed inherited feedback cleanup being called twice, omitted undefined
music slots before registering a scope, and rolled back failed music-scope setup.
The exact timed source hashes remain in `candidate-provenance.json`; the final
hashes are in `final-candidate-provenance.json`. No timing report was silently
relabeled as testing the later snapshot.

The final build still has the same byte-identical 635,599-byte vanilla
simulation/replication executable, the same single HUD event-body difference,
and no optional code in the initial import closure. The final initial JavaScript
payload is 2,575 bytes larger raw and 769 bytes larger gzipped than baseline
(`final-build-identity.json`). The timed build's corresponding gzip difference
was 729 bytes.

`final-vs-timed-entry.json` compares the two production entry files. Their raw
lengths and executable text now differ after the reviewed music-scope fix. The
comparison therefore reports **false** and its helper exits nonzero; this is
retained rather than presented as production byte identity. Export aliases and
lazy chunk filenames also change when optional SDK consumers change; their
complete mappings are recorded. `compare-entry.mjs --engine "$candidate"
--build "$build"` reproduces the comparison when the timed build is preserved
as `web-candidate-timed` with its corresponding graph JSON.

`audio-after-timing.json` checks the precise source change in the eagerly loaded
audio module: 265 of 266 top-level statements are identical to the timed source;
only the opt-in `pushMusicQueues` function changes. The reconstructed timed file
matches the whole-file SHA-256 recorded before measurement. No native audio
function, initializer or hot loop changed in this review. The lazy feedback
composition correction remains outside the initial import closure. These source
and build witnesses support the isolation claim, while final-snapshot startup
timings remain unmeasured.

## Boundaries of the result

The exact simulation/replication executable, unchanged hot bodies and optional
import boundary establish that M6 adds no optional per-tick, per-projectile or
per-render work to the exercised vanilla paths. Cold setup, voice-event routing
and voice loading do change. Desktop timings cannot prove literal identical
time on every device, and these runs do not isolate every vanilla audio event,
mobile/WebKit rendering, long-session retention or loaded-then-disabled mods.
The wider strict zero-regression gate remains open; no percentage allowance is
introduced. A repeatable slowdown must still be investigated and removed.

Browser ES-module caching remains distinct from owned resource disposal:
unloading a mod can release its recordings, music scope and match state without
making previously evaluated JavaScript disappear from the browser's module cache.

## Reproduction

Use `tools/engine-capability-gate/freeze-baseline.mjs --ref 1e4087ce` and a separate
candidate clone at that commit. Copy only the M6 host files listed in the
provenance record, and use the same fixed media/dependency inputs for both.

```sh
node tools/check-engine-kernel-identity.mjs --game "$candidate" --base 1e4087ce --out "$evidence/canonical-kernel-identity.json"
node tools/engine-capability-gate/build.mjs --engine "$candidate" --base "$baseline" --base-ref 1e4087ce --base-content --out "$build"
node tools/engine-capability-gate/run.mjs --engine "$candidate" --build "$build" --out "$evidence/vanilla-runs.json" --rounds 2
node tools/engine-capability-gate/summarize-vite.mjs "$evidence/vanilla-runs.json" --out "$evidence/vanilla-summary.json"
node tools/benchmark-engine-renderer.mjs --game "$candidate" --baseline "$baseline" --base-ref 1e4087ce --out "$evidence/renderer"
```

Build the real app twice with `tools/engine-capability-gate/web-build.mjs`, setting
`STEEL_CANDIDATE`, `STEEL_BASELINE`, `STEEL_BASELINE_REF=1e4087ce` and
`STEEL_GATE_OUT`. Then run `production-startup.mjs` with `--engines chromium,webkit
--rounds 1` and the installed Playwright module, and run this folder's
`compare-builds.mjs --build "$build"`. The existing tool README documents the
production build and browser options. Do not run timing experiments alongside
other builds, tests or benchmarks.

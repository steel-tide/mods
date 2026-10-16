# Final vanilla runtime comparison

**Result: no repeatable measurable vanilla runtime regression was detected in
the tested desktop workloads, including the longer replication-tail check.**
The operational runtime gate passes within this measured scope. This is not
proof of identical runtime on all hardware, browsers or workloads.

Short battle samples showed a possible replication-tail increase. The first
longer confirmation was cancelled to investigate a user-reported mod-with-fog
crash; its three completed baseline controls remain marked interrupted and
excluded. After the crash fix was verified, the candidate was rebuilt and a new
complete confirmation did not reproduce that tail increase. Every attempted
run remains available here; the inconclusive short results are not discarded.

## Scope and evidence

The candidate contains the final functional engine source at the start of the
run, compared with the archived `c4754358` baseline. Both were built with the
same production Vite/Rollup settings and release identity. The diagnostic uses
the real vanilla factory and selected frame codec, with simulation, team views,
frame encoding and stringification. It does not render the complete app.
`provenance.json` records bundle hashes, imported modules and the host: Apple M5
Pro, 48 GiB RAM, macOS 26.7.1. Every sample launched a fresh Chromium process.
An optional `contentHud.ts` scroll fix after the build is outside this imported
graph and does not change the measured program.

`tail-final-provenance.json` records the rebuild after the generic cold
fractional-vision normalization fix and optional HUD scroll preservation. Both
baseline and candidate diagnostic bundles are byte-identical to their earlier
builds, so the completed shorter tests remain applicable.

- `runs.json`: four baseline-only A/A samples, then ABBA and BAAB comparisons
  for each of battle and duels; 24 fresh-browser samples total.
- `battle-followup-runs.json`: the same 12-sample schedule for battle after the
  first run exhibited pronounced timing drift.
- `battle-tail-final-runs.json`: a fresh complete 12-sample battle schedule with
  3,600 warmed and 3,600 measured ticks. Each browser contributes 1,200
  replication observations, four times the shorter runs.
- All samples freeze the deterministic scenario at tick 300 and restore that
  same start after warming. The shorter runs warm and measure 900 ticks each;
  the final confirmation uses 3,600 each. Replication runs every third tick.
- `summary.json`: descriptive sample statistics, both balanced rounds, control
  distributions and tail statistics. No fixed percentage tolerance makes it
  pass.
- `canonical-kernel-identity.json`: canonical combat, simulation, frame,
  renderer, input and HUD bodies remain identical. The four documented cold
  save/load wrappers are reported separately.

All **48 completed samples** match their workload's frozen, measured-start,
measured-end and wire digests, wire byte count and snapshot byte count. These
FNV digests are behavioral witnesses rather than cryptographic proof. The
recorded runtime resource paths contain no optional capability chunks. End
state/wire identities are grouped by workload and measured length; a 3,600-tick
result is not expected to equal a 900-tick result.

## Mean timing

Values are medians of the four browser samples' mean timings in milliseconds.
The A/A column compares the two baseline-only labels, not different builds.

| Run and measure | Baseline | Candidate | Change | A/A label difference |
| --- | ---: | ---: | ---: | ---: |
| Initial battle simulation | 1.26291 | 1.33639 | +5.82% | +4.93% |
| Initial battle replication | 1.10312 | 1.16678 | +5.77% | +2.95% |
| Follow-up battle simulation | 1.15223 | 1.12700 | -2.19% | +1.06% |
| Follow-up battle replication | 1.01985 | 1.01911 | -0.07% | +1.43% |
| Duels simulation | 0.38986 | 0.39046 | +0.15% | -3.15% |
| Duels replication | 0.94306 | 0.93758 | -0.58% | +1.26% |
| Long confirmation simulation | 0.99706 | 1.00009 | +0.30% | -1.70% |
| Long confirmation replication | 1.03114 | 1.03735 | +0.60% | -1.57% |

The initial battle baseline controls ranged from 1.63 to 2.23 ms per simulation
step; late comparison samples were approximately 1.17–1.23 ms. Its first
balanced round was slower for the candidate and its second faster. The separate
follow-up did not reproduce that mean slowdown. These data do not establish a
performance improvement either.

## Replication-tail investigation

The table compares each balanced round's average of the two per-browser
percentiles. A tick percentile is not an independent browser observation.

| Battle comparison round | Replication p95 change | Replication p99 change |
| --- | ---: | ---: |
| Initial ABBA | +4.73% | +9.85% |
| Initial BAAB | -8.08% | -2.32% |
| Follow-up ABBA | +3.16% | +4.09% |
| Follow-up BAAB | +11.07% | +3.85% |
| Long confirmation ABBA | +0.20% | 0.00% |
| Long confirmation BAAB | -0.59% | +1.08% |

The follow-up medians of per-browser replication p95/p99 rose by 4.38%/3.33%
(about 0.051/0.053 ms), despite its flat mean. Its baseline-only p95 samples
ranged from 1.195 to 1.245 ms; candidate comparison samples ranged from 1.225 to
1.430 ms. p99 distributions overlap: control 1.665–1.805 ms, baseline comparison
1.475–1.670 ms, candidate comparison 1.560–1.730 ms. The initial run had much
larger drift, but three of the four balanced rounds had positive tail changes.
This warranted the longer confirmation instead of dismissing the tails based
on the flat mean.

`battle-tail-confirmation-runs.json` was intended to warm and measure 3,600
ticks, giving 1,200 replication observations per sample. It stopped after three
baseline controls. It contains no candidate comparison and is not summarized
as an acceptance result. It remains separate from the completed rerun.

The complete rerun measured median replication p95 at **1.2550 → 1.2575 ms
(+0.20%)** and p99 at **1.6400 → 1.6375 ms (-0.15%)**. Its baseline-only A/A
label differences were -2.92% and -7.35%, respectively. Baseline/candidate p95
ranges overlapped at 1.245–1.280 / 1.250–1.260 ms; p99 ranges overlapped at
1.565–1.675 / 1.595–1.685 ms. Balanced-round signs are mixed or zero as shown
above. Simulation tails also show no repeatable increase: p95 round changes
were +1.88% / -0.93%, p99 -1.15% / -3.52%.

The short-run tail signal was not reproduced with longer warming and four
times as many replication observations. The small remaining mean differences
are smaller than the observed same-build control differences. Taken with
unchanged canonical hot-path bodies and matching behavioral witnesses, this
supports the operational gate in the tested scope. It neither grants an
allowed slowdown percentage nor excludes effects below the experiment's
resolution. No performance improvement is claimed.

## Reproduce

From the mods repository:

```sh
node tools/engine-capability-gate/build.mjs \
  --engine /path/to/steel-tide --base /path/to/c4754358 --out /path/to/build
node tools/engine-capability-gate/run.mjs \
  --engine /path/to/steel-tide --build /path/to/build \
  --workloads battle,duels --out /path/to/runs.json
node tools/engine-capability-gate/run.mjs \
  --engine /path/to/steel-tide --build /path/to/build \
  --workloads battle --warmup 3600 --measured 3600 \
  --out /path/to/new-tail-confirmation.json
node tools/engine-capability-gate/summarize-vite.mjs \
  /path/to/completed-runs.json --out /path/to/summary.json
```

Do not include the interrupted confirmation in a completed-run summary. This
desktop simulation diagnostic does not resolve physical-mobile, rendering,
native/GPU memory or mod-enabled lifecycle measurements. See the parent README
for the separate production startup evidence and its limits.

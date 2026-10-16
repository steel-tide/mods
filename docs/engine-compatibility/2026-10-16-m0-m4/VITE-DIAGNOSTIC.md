# Frozen-start Vite diagnostic

The earlier Bun-browser battle sample showed slower candidate means even though
canonical hot function bodies matched. Those results remain evidence; this
separate run investigates bundling, caller dispatch, warmup and browser-history
confounders rather than replacing the earlier record.

The [reproduction scripts](../../../tools/engine-capability-gate/README.md) use
Vite 6.4.3/Rollup with the production targets and minifier. They build a small
simulation/replication entry rather than the complete app. The candidate keeps
its real content factory and selected frame-codec calls. Both outputs in this
run were a single entry chunk: baseline 626.06 kB, candidate 635.52 kB. Unused
optional preparation loaders are removed from this vanilla-only entry, so this
is not evidence about full-app lazy-loading or startup cost.

Each sample starts a fresh Chrome process and profile. The same seed-42 dense
four-seat battle is frozen at tick 300. A restored copy warms simulation,
replication and stringification for 900 ticks. A second restore of the same
snapshot then measures 900 ticks. A/A control runs the identical baseline build
under two labels in ABBA order, followed by comparison ABBA and BAAB rounds.
No other benchmark was intentionally run alongside this diagnostic.

[Raw evidence](vite-diagnostic-runs.json) records every run, bundler settings,
module graphs, resource paths, percentiles and behavioral hashes. All twelve
runs had the same frozen, restored-start, final-state and wire digests, the same
wire size and 812 final entities. Frozen and restored-start hashes differ from
each other because the save loader reconstructs the state; each hash is equal
across both builds and all repetitions.

| Comparison | Baseline mean ms | Candidate mean ms | Candidate change |
| --- | ---: | ---: | ---: |
| Simulation tick | 1.16236 | 1.14758 | −1.27% |
| Replication batch | 1.03261 | 1.02090 | −1.13% |

The four paired simulation changes were −0.30%, +2.64%, −0.49%, −6.58%; paired
replication changes were −0.55%, +1.47%, −0.61%, −4.65%. Identical-build A/A pairs
varied by +5.31% and +0.33% for simulation, and +9.52% and +0.90% for replication.
The single positive candidate pair therefore is not sufficient evidence of a
reproducible regression in this diagnostic. Negative aggregate means likewise
must not be presented as a demonstrated optimization.

This run does **not reproduce the earlier dense-battle slowdown** under its
changed diagnostic conditions. It cannot identify which change explains that
result: bundler, fresh processes, warmed replication, fixed battle phase and
the intervening frame-bridge import-boundary fix all changed. Separate
controlled ablations would be needed for causal attribution.

The witness is limited to headless desktop Chrome simulation and replication
for this restored battle phase. It is not proof of literal zero overhead, a
full-app render/startup comparison, retained-memory equivalence, WebKit/mobile
performance or all disabled-content lifecycle transitions. Those gates retain
their own evidence and limitations.

# Enabled-capability load study

Run from the mods repository with Bun:

```sh
bun tools/benchmark-engine-capabilities.ts --engine /absolute/path/to/steel-tide
```

`--out /path/to/results.json` selects another report location. The pure-data
[workload specification](../fixtures/engine-capability-benchmark.json) names the
study fixtures, required capability sets, populations, seed and tick counts.
The script loads and validates those packs through the engine, creates real
content games, and runs the ordinary simulation with the selected modules.

Each sample warms for 300 ticks and measures 900 ticks: ten then thirty seconds
of simulated time. A fixed 96×96 flat map, fixed seed, two human-controlled teams,
no fog or day cycle, stationary shooters and durable targets keep the workload
repeatable. Benchmark-only hull/component durability is raised to 1,000,000 so
combat remains active. These overrides are recorded and hashed, and do not
change the source study fixtures. Targeting can cross between nearby pairs.

The October 16 run used Bun 1.2.20 on an Apple M5 Pro. Raw results include the
engine revision, working-tree inclusion, runtime/OS, counts, active modules,
participant counts, projectile peaks, tick distributions, optional state sizes,
fixture hashes and heap snapshots in
[feature-enabled-benchmark.json](feature-enabled-benchmark.json).

| Enabled workload | Hosts | Total live entities | Mean tick ms | p95 tick ms | Peak projectiles |
| --- | ---: | ---: | ---: | ---: | ---: |
| Components + logistics | 32 | 68 | 0.071 | 0.104 | 32 |
| Components + logistics | 128 | 272 | 0.224 | 0.281 | 128 |
| Sensors + guidance | 32 | 64 | 0.191 | 0.311 | 32 |
| Sensors + guidance | 128 | 256 | 1.823 | 2.807 | 128 |
| Independent mounts | 32 | 96 | 0.284 | 0.378 | 64 |
| Independent mounts | 128 | 384 | 1.686 | 2.129 | 256 |

The component workload has one opposing hull per shooter and a workshop per
eight shooters. It exercises real component impacts, protection wear and
ammunition consumption; providers are present, but this run does not issue
repair, crew-replacement or supply actions. The sensor workload has one emitter
per tracker. The articulated workload has two opposing targets per twin-mount
host. All entities survive the complete workload.

These results measure the enabled match's complete simulation cost, including
ordinary simulation work. They do not isolate the incremental cost of each
module. Four times as many hosts took approximately 3.2× the mean tick time in
the component workload, 9.5× with sensors and 5.9× with independent mounts.
Dense contact discovery and target search therefore need further profiling at
larger populations; the study does not establish linear scaling or arbitrary
capacity. No hard runtime budget is inferred from this small sample.

This is **not the vanilla performance gate**. Other build/typecheck activity
could contend for the same CPU, each workload has one sample in the same
process, and this headless study excludes rendering, replication and startup.
Heap snapshots lack forced collection and are not retained-memory evidence.
The final vanilla comparison remains separate and must run without contention.

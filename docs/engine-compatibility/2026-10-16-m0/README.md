# M0 performance evidence — 2026-10-16

Baseline game commit: `c4754358` (main). No changes were pushed.

## Experiment 1: lexical kernel composition

The prototype changes only step → projectile → impact → damage binding. It adds
no optional entity/state fields or feature checks. Factories create the same
function bodies with dependencies closed over at runtime.

Bun 1.2.20 on macOS ARM64; seed 42; 300 warm-up ticks, 900 measured ticks;
12 independent processes per workload (three ABBA blocks), 48 total. Replication
uses production team views, record memo, deltas and JSON encoding. Snapshot and
wire hashes and entity/Game/state keys matched in every baseline/candidate run.
The four fixtures cover idle units, 1,000 stationary tanks, 1,000 artillery/flak
units and four AI seats with 198 mixed units each on random-l.

Mean simulation changes: idle −14.14%, tank duels −1.47%, projectile mix +0.37%,
AI battle −1.27%. Raw repeated results and p95/p99 are alongside this document.
The small positive projectile result and variation in unchanged save/load costs
are not evidence of a clean zero-cost guarantee. This experiment alone does not
pass the gate or authorize expansion. No M1–M4 mechanics were added during it.

Next experiment: build-time specialization with unchanged vanilla hot functions.
The optional kernels are generated from canonical source, and load only for an
extended match. This avoids changing vanilla lexical bindings/JIT opportunities.
Desktop browser, startup/chunk, memory/lifecycle and final combined checks remain
required. Physical mobile-device evidence is unavailable on this development host;
this record must never be described as an all-device performance guarantee.

## Experiment 2: generated optional kernels — architecture gate passed

Canonical vanilla hot function bodies are unchanged. Only shared-helper exports
and TypeScript `private` → `protected` visibility changed. The generator extracts
seven kernels from their canonical source and binds optional callees only in a
separate, dynamically imported module. `pnpm check` detects generated-file drift.

With identical release metadata, **all 47 files from the complete production
Vite web build are byte-for-byte identical to baseline**. This includes game,
renderer, UI, startup, worker and service-worker outputs. File hashes and sizes
are in `production-web-identity.json`. The separate minified simulation/save/wire
benchmark bundle is also identical: 1,163,469 bytes, SHA-256
`8fbe884b10aecedc2edc2a876bcce9df23eb2e76060fd970e32043089664f7d6`.
There is no optional feature code, allocation, callback, object field or extra
network byte in vanilla production execution at this prototype stage. This
binary identity is stronger evidence than attempting to resolve timing noise.

The second 48-process Bun run again has identical behavior/wire/shape outputs.
Raw timings vary (including +6.86% in tank duels and −9.12% in the AI battle,
with unchanged replication costs moving alongside them). They are retained,
not presented as an improvement. Thirty-two production Chrome runs of the
identical binaries likewise match behavior and bytes; mean simulation deltas
range −0.52% to +0.58%, demonstrating measurement variation of identical code.
The browser harness completed all runs; its temporary-profile deletion initially
raced browser shutdown. The saved results were complete before that cleanup error.

Three focused integration tests (16 assertions) cover real optional projectile
interception, exact default serialized battle identity, and parallel/subsequent
vanilla matches without global reset. Core type checks and generated drift checks
pass. M1–M4 implementation may now expand on this architecture. The final loader,
network, presentation and capability integrations must repeat the gate; this
prototype proof does not pre-approve changes that have not yet been made.

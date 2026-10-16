# M0–M4 implementation and acceptance record

The implementation is committed on the game repository's `main` as
`34b90cd646118b67b4700ada8dc5ad35061113ee`, based on
`c4754358ec9059b45653ce4e75618a6c355b1bd1`. The baseline commit saved the existing
registry work before engine implementation started. Nothing has been pushed.
The plan, evidence, internal test fixtures and regenerated registry tools live
in this mod repository. The playable integration is the existing
[`mods/usgr-re`](../../../mods/usgr-re/README.md) pack, not a separate pack.

**Acceptance: implementation complete; strict release gate remains open.** Local
runtime comparisons did not establish a reproducible slowdown, and optional
code is not fetched by vanilla boot. Initial vanilla JS nevertheless grows by
12,428 bytes (5,545 bytes with reproducible gzip compression). Startup latency,
post-GC retained memory and representative mobile/WebKit performance have not
been established. These limits must not be rounded into a zero-cost claim.

M0's isolated architecture gate passed **before M1–M4 implementation**: its
complete production build was byte-identical to the reference. See the separate
[M0 record](../2026-10-16-m0/README.md). That result is not a claim that the final
integration has an identical build or that every performance gate has passed.

## Delivered scope

| Milestone | Implemented v1 contract |
| --- | --- |
| M0 | Format 3 required capabilities, bounded schemas, lazy preparation, generated optional kernels, match-owned state, commands, persistence, replication and negotiation |
| M1 | Penetration/facing/incidence, wear, independent components, crew identity/reassignment, repair services and explicit failure consequences |
| M2 | Exclusive feeds, shared reload groups, typed finite supplies, explicit unlimited providers, suppression and authored accuracy effects |
| M3 | Typed contacts, optional entity disclosure, illumination/designation, seeker acquisition/loss/reacquisition, decoys, emitter controls and optical obstruction |
| M4 | Independent mounts and recoil, real attached members, squad selection, towing and safe identity-preserving deployment |

The engine contains no UCGR-specific IDs, unit balance or translated unit copy.
Source-derived studies and an unrelated acceptance pack live in
[fixtures](../fixtures/). The [M1/M2 contract](../M1-M2-AUTHORING.md) and
[M3/M4 contract](../SENSORS-ARTICULATION-V1.md) describe the exact supported subset.
The actual pack now uses supported magazine and mount configurations. Its
[remaining source gaps](../../../mods/usgr-re/COMPATIBILITY.md) still prevent
full component, sensor, supply and deployment parity. M5 and broader M6 work
remain future work.

Unsupported cross-form mount/sensor changes and transport of coupled assemblies
are rejected. They are not simulated through replacements that lose state or
duplicate crew. Complex source automation, arbitrary component rule events,
source-specific missile/ECM formulas and authored deployment-match economies
remain outside these v1 contracts.

## Isolation and behavior evidence

- `Game`, combat, fire-control, native renderer, input, HUD, remote-frame consumer and frame kernel bodies
  retain their baseline code. [Canonical source comparison](canonical-kernel-identity.json)
  also checks existing class field initializers. This does not establish machine
  code identity or cover newly selected caller strategies.
- Vanilla uses the ordinary `Game`; entities and projectiles gain no optional
  state. Feature state lives in match-owned side tables. Disposal removes the
  game/state associations; disabled content and later vanilla matches select the
  native constructors again. JavaScript's imported code cache is not unloaded.
- Match setup selects a frame codec. Native codec functions retain their bodies,
  but the host's caller uses codec properties. That change is included in the
  timing comparison and must not be hidden by the kernel-identity result.
- Save/load and navigation have cold preparation/selection boundaries. Generic
  board/pickup policy checks occur when an order is issued, including AI and
  scenario callers; they are not new checks in the vanilla tick or hit loop.
- [Fresh production boot](production-boot.json) and its service-worker installation
  requested none of the optional chunks. Module workers load the same capabilities when a world
  requests them. The production build has additional cold contracts, controls
  and localized vocabulary, so final whole-build byte identity is not claimed.

## Timing experiments

All raw experiments are retained, including results that motivated follow-up.
There is no allowed regression percentage and no automatic pass based on an
average being below a chosen tolerance.

The initial Bun browser comparison used 300 simulation warmup ticks and 900
measured ticks, with four samples per variant in each workload. The longer
follow-up used a high-resolution cross-origin-isolated timer, 900 warmup ticks
and 3,600 measured ticks. Both produced identical state/wire witnesses and
unchanged vanilla object keys. Their simulation and replication means were:

| Workload | Initial simulation Δ | Longer simulation Δ | Initial replication Δ | Longer replication Δ |
| --- | ---: | ---: | ---: | ---: |
| Idle | +3.64% | −2.20% | +0.46% | −1.94% |
| Duels | +0.18% | −0.44% | −1.93% | +0.78% |
| Projectiles | −1.47% | +3.73% | −0.93% | −0.07% |
| Dense battle | +0.72% | +2.43% | +0.76% | +3.18% |

Positive means slower. These results did **not** clear the final gate. The longer
run also samples a later battle phase, replication was not warmed, browser
processes were shared, and Bun split the candidate into different caller/callee
chunks. These are reasons to improve the comparison, not reasons to discard
unfavorable numbers. Raw runs and descriptive summaries are alongside this file.

The follow-up Vite/Rollup diagnostic uses a fixed saved starting state after
warming both paths, a new Chrome process/profile for every sample, and an A/A
control. Its entry is a simulation harness using production compiler settings;
it is not the complete app's bundle. See the diagnostic's raw record and
[reproduction instructions](../../../tools/engine-capability-gate/README.md).

The Vite battle comparison did not reproduce the earlier slowdown: mean
simulation/replication changes were −1.27%/−1.13%, with larger variation between
identical-baseline control samples. The same fresh-process comparison then
covered the other three workloads:

| Vite fixed-start workload | Simulation mean Δ | Replication mean Δ |
| --- | ---: | ---: |
| Idle | +0.15% | −0.66% |
| Duels | +2.01% | +1.23% |
| Projectiles | −0.12% | +0.57% |

Each uses four samples per variant. All state and wire witnesses matched.
Rebuilding the measured Vite harness from the final engine commit produced
[identical JavaScript hashes](final-diagnostic-identity.json). These small mixed
differences are retained in [the additional raw runs](vite-other-runs.json);
there is no claimed optimization or numerical slowdown allowance. The broader
[Vite interpretation](VITE-DIAGNOSTIC.md) explains the A/A control and limits.

The separate [renderer ABBA record](renderer/summary.json) uses the actual full
HUD at high/clear settings with 1,024 opening units. Baseline/candidate mean
render times were 8.936/8.451 ms, all runs sustained about 30 simulation ticks/s
with no backlog, and candidate runs had no missed frames. This is **no observed
warmed rendering regression**, not a claimed speedup: two 10-second samples per
variant near a 60 Hz cap cannot prove universal parity.
The baseline dev-server log also records failed `/api/online-players.ts`
requests. The raw log is retained; these warmed render samples are not an
error-free startup measurement.

[Feature-enabled costs](FEATURE-ENABLED-BENCHMARK.md) are measured separately.
They do not offset or excuse a vanilla slowdown.

## Functional verification

- Full game suite: 4,460 pass, one existing TODO, zero failures after the
  deployment/transport fixes. Eight focused remote-frame tests also pass after
  restoring the native remote consumer.
- Full CLI suite: 56 pass, zero failures.
- Native and extended full/delta frames, hidden contact redaction, old-client
  rejection, checkpoint restore and async-content races are exercised.
- Browser interaction checks exercised actual emitter buttons, deployment,
  cancellation, selection proxies and independent mount pictures without errors.
  [Interaction record](ui-interactions.json), [screenshot](ui-modules.png).
- A compiled production module worker completed host start, handshake, world
  preparation, match start, an extended full frame and clean stop without errors.

## Limits of this record

State/wire digests in the browser runs use FNV-1a32, with separate byte counts
and object-shape checks; they are not cryptographic equality proofs. Structural
source/build hashes use SHA-256. Heap samples taken around the harness are not
post-GC retained-memory measurements. Constructor timings exclude module fetch,
parse and codec selection. No mobile/WebKit hardware result or universal zero
regression claim is provided. A repeatable vanilla slowdown blocks release.

## Work required to close the strict release gate

1. Remove or explicitly measure the remaining initial-download/startup cost;
   [the bundle audit](production-bundle.json) records the added bytes. No startup
   slowdown allowance has been approved.
2. Measure allocations, GC pauses and retained heap after a feature match is
   disposed, including installed-but-disabled content. Existing lifecycle tests
   establish state isolation, not retained-memory equivalence.
3. Repeat sustained production-path measurements on representative mobile and
   WebKit hardware. Current desktop Chrome measurements cannot substitute for
   those devices. Keep the server codec caller change in the experiment.

These items block a strict zero-cost release claim. No M5/M6 work or wider source
roster conversion is included in this delivery.

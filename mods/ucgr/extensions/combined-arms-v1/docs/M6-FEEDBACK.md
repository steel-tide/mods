# UCGR feedback and source muzzle geometry

The `usgr-re.feedback-v1` definition capability accepts `voices` and `cosmetics`.
Voice actions are `select`, `move` and `attack`; each has `assets` (one to sixteen
package resource IDs) and `gain` from zero to one. An empty voice map means source
silence. Definitions without this capability keep native feedback.

Cosmetics bind an existing component `part` to `damaged`/`destroyed` image IDs,
plus screen offsets `x`, `y` and image `scale`. The schema rejects foreign or
missing assets and component names. The module derives only the source's three
visual states: normal, at least 65% component damage, and the source's inclusive
failure threshold. Rack capacity uses the existing stock-dependent threshold.
These are UCGR rules; the game host has no knowledge of them.

Only discrete source-public icons accompany visible enemy entities. Private
component health, occupants and ammunition do not become public. The codec
preserves observed icon states through full/delta frames and resumed remote
checkpoints. Fog hides them; authorized spectators can see source-public icons.
Drawing interpolates the unit position and silently skips missing images.

The presentation factory resolves original recordings through package `asset`,
uses the native voice mixer, and releases used recordings on disposal. Selection
and accepted local orders are client feedback. Order voices share the original
five-second cooldown. The skipped M5 opening phase is not emulated. Portable
PCM WAV files preserve decoded source samples; missing/commented source lines
remain silent. Music remains gated with M5 because its source predicates are
specific to that mode; the native scoped music API is available when needed.

Weapon `articulation-v1: {muzzleFrame: "hull"}` marks source-proven fixed
hardpoints. The converter emits native `muzzlePoints` relative to the actual
firing ring or independent hull origin, including alternating barrels and
audited initial missile attachment slots. The optional shot wrapper counter-
rotates fixed points into an independently aimed native bore before emission,
preserving the native projectile, flash, sound and bore-counter lifecycle.
No emitted projectile is relocated and no fake vertical launch is used.

Native `recoil` is authored only when the exported barrel region matches the
source weapon's decal and turret anchor. Native timing is retained; the source
recoil curve is not reproduced. The unit remains the native sound position.
For those verified visible barrels, the muzzle uses the actual opaque front
edge in the exported atlas. This intentionally corrects source shot coordinates
that sit beyond the artwork (T90M is one case). The ledger retains both the
original spawn coordinates and the visual correction, including sheet rounding.
The flash starts at the resting tip; native recoil then moves the barrel back.

See [the source audit](../../../M6-FEEDBACK-SOURCE-AUDIT.md) and
`../../../muzzle-source-data.json` for coverage and the six unresolved origins.
Source converter tests, `feedback-game.test.ts` and `muzzle-game.test.ts` live in
the owning mod folder; shared game tests use unrelated packages.

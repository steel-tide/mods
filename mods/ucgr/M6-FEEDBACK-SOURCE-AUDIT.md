# M6: original feedback

`feedback_port.py` reads merged source configuration without running its actions.
It exports the original decoded recordings and copies the icons into this pack's own
`extensions/combined-arms-v1/assets/`. The descriptor's `assets` map carries them
through installation and offline packing. These are extension resources, so the
36 ordinary weapon sounds and their existing limit remain unchanged.

The exported source ledger is [feedback-source-data.json](feedback-source-data.json).
It records each active clause, original path, file size and SHA-256. The 51 files
total 3,879,651 packaged bytes: 41 portable PCM16 WAV recordings (3,874,828 bytes)
and ten unchanged PNG icons (4,823 bytes). The source Ogg recordings total
900,302 bytes. WAV keeps each recording's decoded PCM16, original sample rate
and channels so the older supported WebKit audio decoder can play it. Tests
compare the decoded samples against the source, not the compressed file bytes.
The source recording hashes remain in the ledger alongside export hashes.

## Selection and orders

Five units have active `soundOnNewSelection` bindings: PGZ09, HQ17, Z10, Z20 and
J-10. Twenty-one current roster units have active move and attack recordings:
RUSGUD, RUSVDV, RUSRECON, BMP3, BMD4M, BTR82A, T72B3, T90M, T14, PLAINF,
PLASCOUT, ZBL08, ZBD04A, ZTZ96A, ZTZ99A, ZTQ15, PGZ09, HQ17, Z10, Z20 and J-10.
Their source alternatives and gain are preserved. Commented-out selection
bindings, including those for the Russian tanks and PLA rifleman, stay silent.
Definitions with no source recording have an explicit empty voice map so that
native crew speech does not stand in for missing UCGR speech.

The source move/attack actions require `newWaypointGivenByPlayer`, the matching
active waypoint, and `play_timer <= 0`, then set the shared player timer to five.
The port uses a local five-second cooldown shared by move and attack feedback.
Selection is separate. `中立及通用单位/玩家计时器.ini` begins decrementing that timer
only after the source's sixty-second opening; that opening is part of skipped
M5 and is not recreated. Voice feedback never becomes a simulation order or a
network broadcast.

## Component icons

Only the already audited T90M component model receives icons.
`tem/tank.key:921–1061` supplies two original images each for the ammunition
rack, tracks, driver, gunner and engine. They are active, living-unit overlays,
not selection-only overlays. The source explicitly says `onlyTeam:any`.
Only the resulting public icon states may be presented for a visible entity;
raw damage, stocks and concealed entities remain private.

The four ordinary parts display their warning icon at damage from 65% through
100%, and the destroyed icon from 100% upward. Both source conditions hold at
exactly 100%; the destroyed icon is the last layer and takes precedence.
The rack warning begins at `175 * 0.65`; its upper limit and destroyed threshold
are `175 + missingRounds * (175 / 48)`. Icon appearance uses `>=` at that threshold,
even though the existing terminal failure policy uses strict `>`.

Source x offsets are rack 0, tracks −20, driver 20, gunner 40 and engine −40;
all y offsets are 40. Source `imageScale` is 0.4. These are ordinary unit-anchored
world decals: `beforeUI` controls drawing order, while absolute offsets and
`alwaysStartDirAtZero` keep the icons aligned to world axes instead of the hull's
rotation. Both offsets and size include the converter's 0.4 art scale and the
game's 1.5625 unit display scale, for a source-to-world factor of 0.625.
The exported x offsets are 0, −12.5, 12.5, 25 and −25, with y25 and image scale
0.25. This retains their source proportions to the displayed hull; using only
the art scale would incorrectly shrink the row to 64% of those proportions.
The source global `关闭击穿显示` cheat/display toggle remains omitted.

## Native muzzle positions and recoil

`muzzle_port.py` exports 139 weapon origins across the current roster.
It follows source `turret_*.x/y`, `attachedTo`, `barrelX`, `barrelY`/`size`,
`attack.turretSize` and `barrelOffsetX_onOddShots`, plus audited initial aircraft
attachment slots. [muzzle-source-data.json](muzzle-source-data.json) records
the source section, firing ring, source pivot, art/world scale and result for
each weapon. Native muzzle points are world coordinates, so the existing 0.4
art scale is multiplied by the game's 1.5625 unit display scale. Turret mount
coordinates remain art coordinates. The source ring is subtracted exactly once.

T-90M's AP and HE share the original main barrel; its coaxial and roof weapons
use their own source origins. PGZ09 alternates between the two source barrels.
F-2's AIM-120s originate at the four initial attachment slots, not its invisible
targeting turret. Thirty aircraft weapons explicitly use hull-frame origins:
the source must prove fixed firing, a zero-turn bore, or an attached missile.
For example Z10 sets `isFixedFiring:true`; F-16C's gun sets `turnSpeed:0`.
The extension transforms these points for the existing native shot pipeline;
projectiles, muzzle effects, firing sounds and recoil use that pipeline.

Eleven visible barrel bindings deliberately correct an original discrepancy
between the configured projectile spawn and the drawn muzzle. T-90M's source
barrel is 58 pixels long, centered at y40, so its visible tip is y69; the source
`size:50` instead places the shot at y90. The user's actual-muzzle correction
takes precedence over reproducing that gap. For each verified barrel, the
converter reads the first opaque row of the original exported pixels and centers
the muzzle on that row's visible span. It uses the native atlas area quantization
and pins those existing sheets to their current 4× bake size. Broad asymmetric
muzzle-brake bounds do not shift the bore sideways.

The T-90M point is now forward 42.8364 and lateral 0.390625 world units from MAIN;
the small lateral offset comes from its original odd-width image placement.
Its original configured point, forward 56.25 and lateral 0, remains recorded in
`sourceMuzzlePoints`; `visualTip` records the source asset, sprite geometry,
baked pixel witness and conversion rule. The point follows the unrecoiled barrel
tip at firing; native recoil then retracts the barrel behind that initial flash.
Recoil rectangles also follow the PNG's exact integer layer placement so rounding
does not leave an unmoving sliver of barrel outside the mask. Original pixels
are unchanged.

Eleven weapon bindings use original recoil travel with an exposed barrel region.
The converter verifies the original barrel decal asset and its turret anchor.
Alternate T-90M AP/HE art shares that exact anchor; a roof machine gun cannot
recoil an unrelated main cannon in a composite sheet. Unsupported recoil is
omitted instead of translating the whole turret. Native recoil timing is used;
the RW `recoilOutTime`/`recoilReturnTime` curve is not claimed to be reproduced.

Six weapon origins remain explicitly unresolved: A10's ground cannon needs a
rotating bore separate from its hull-mounted anchor, and EC556HAD's three weapons,
Mi-4's gun and UH-1's gun omit all source barrel-length fields. No RW engine
default has been established for those five missing lengths, so none is invented.
These omissions are recorded per weapon; this pass does not claim that those
six firing points have been corrected.

## Music and roster decisions

`中立及通用单位/音乐播放器.ini` explicitly gates both soundtracks on
`全频带阻塞干扰`, plus the Chinese or NATO mode tag. The source's `mod-info.txt`
also identifies this as the full-spectrum mode's independent music player.
No soundtrack is assigned to the ordinary national Conquest factions. These
recordings remain with skipped M5 rather than playing in an unrelated mode.

The roster audit did not justify enabling new units:

- PLA Type 79 sniper, KPA Type 78 sniper, ROK K3 gunner and ROK K2 marksman use
  queued initial reload and idle partial-magazine reload, which the current
  audited empty-magazine converter does not represent.
- Russian reserve infantry and MARSOC define switchable weapon loadouts. Their
  alternate equipment remains unsupported, so they were not added with it missing.

M6 expands presentation across the existing roster. Additional units remain
conditional on their defining mechanics passing their own conversion checks.

Run `python3 -B -m unittest test_feedback_port.py test_muzzle_port.py` from this folder to verify
the source bindings, decoded audio samples and exact PNG bytes, explicit silence, public icon clauses,
failure on source drift, muzzle coordinates and ownership, and the deferred
music/roster decisions.

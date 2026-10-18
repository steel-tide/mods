# Presentation and audio capability closure

This is a host API audit and capability proof, not UCGR source-policy implementation.
New packages using these APIs declare host API **2**. Existing API-1 packages keep
their existing behavior.

## Audio lifetime and native mixing

`createRecordedAudioScope()` is supplied by the optional browser SDK. The scope
owns decoded resources, in-flight loads and playing sources. It accepts installed
`data:audio/*` or `data:application/octet-stream` resources from `host.asset(id)`;
it never fetches an external fallback or synthesizes a missing recording.

| API | Behavior |
| --- | --- |
| `prepare(resource)` | Decode once within this scope; returns false before audio unlock or for missing/corrupt audio. |
| `play(resource, options)` | Return a controllable handle; starts after successful decode. Options: world `position` (or null for local feedback), `gain`, `rate`, `loop`, `loopStart`, `loopEnd`, `offset`. |
| `handle.update(settings)` | Change position, gain or playback rate without replacing the source. |
| `handle.stop()` | Stop and disconnect it, including a request still decoding. |
| `scope.update()` | Refresh active spatial gains/panning after the camera changes. Only the owning extension calls this. |
| `scope.setPaused(boolean)` | Silence sources and freeze buffer cursors; resume at their existing positions. |
| `scope.reset()` | Stop playing/pending requests, retaining decoded resources; use on seek or presentation discontinuity. |
| `scope.dispose()` | Idempotently stop, abort resource loads, disconnect nodes, release buffers and remove the visibility listener. |

The scope connects to the **existing native SFX gain**, using the same listener
position, zoom attenuation and panning law. Native volume changes, the shared
AudioContext recovery and the native output/recording graph therefore apply.
It does not claim the voice channel or duck music. Selection/order recordings
still use `playRecordedUnitVoice`; soundtrack choices still use `pushMusicQueues`.
The optional scope pauses on page visibility loss because rAF may stop while
Web Audio continues.

Gain is bounded to 0–4, rate to 1/16–16, and invalid/non-finite settings do not
poison Web Audio parameters. Out-of-earshot loops become silent and retain their
cursor. Invalid loop regions, undecodable data and disposed loads never start.
Packages own voice limits, throttling, event priorities, range restrictions and
selection of source recordings.

## Frame lifecycle and remote/replay policy

`feedback(context, base)` can return an `update(frame)` callback. Each factory
returns **its own** updater/disposer; do not call `base.update` or `base.dispose`.
The host collects distinct owners once, updates in content order and disposes in
reverse order. A wrapper forwarding an inherited updater is not registered twice.
All update owners are attempted if one throws; errors are reported together.
Disposal suppresses later calls, even if a callback retained the composed object.

The frame is `{ now, dt, time, paused, player, spectator }`: `now`/`dt` are the
presentation clock, `time` is current game time, and viewer fields are current.
The match selects a wrapper at entry only when an updater exists. It runs after
ordinary event/input/camera/listener updates, independent of drawing limits and
covered-frame drawing. The vanilla update body is unchanged. Opening preparation
is reported paused.

For remote matches and replays, author audio cues as **bounded, sequenced module
presentation data**, filtered in the module's view codec. Do not depend on a
simulation callback running in the browser, or native event arrays surviving the
HUD's consumption. Retain a local cursor; ignore duplicate/stale cues and choose
whether newly visible entities should introduce a loop. On a backward seek or
viewer change, reset sources and rebuild loops from the new filtered state.
Those event meanings, filtering and replay choices are pack work; the host now
provides the clocks, update lifetime, playback control and teardown needed to
implement them. No UCGR sound event is automatically mapped by this change.

## Art and tactical presentation

The optional generated renderer adds composable per-item methods:

```ts
drawContentDecal(g, decal, camera, alpha, bounds): boolean
drawContentEffect(g, effect, camera, alpha, bounds): boolean
drawContentProjectileTrail(g, projectile, alpha, bounds): boolean
drawContentProjectile(g, projectile, alpha, bounds): boolean
```

Return true after drawing or intentionally suppressing an owned item. Otherwise
delegate to `super` so another package or the ordinary renderer handles it.
These methods run in the world canvas at the original native layer, before
fog/night compositing. Effects still respect delayed onset and the native hidden
repair filter. Landed wrecks/decals are under units; effects and projectiles retain
their original order. Balance canvas save/restore, cull authored extents where
useful, and read only permitted module presentation state. These methods do not
exist on the vanilla Renderer.

| Remaining source presentation | Host route; remaining pack work |
| --- | --- |
| Dynamic hull, loadout, armor overlays and independent mounts | Existing `pictureOf`, `drawEnt`, turret methods and atlas resources; author state-dependent art, pivots and per-frame cache policy. |
| Corpses and ground vehicle wrecks | Native decal state plus `drawContentDecal`; replace art while preserving the simulation's wreck/collision state. |
| Falling aircraft and custom shadows | Existing overridable `noteFalling`/`drawFalling` and `falling` presentation records; author source pose/art/trail policy. |
| Projectile/contrail artwork | Native `WeaponLook` where sufficient; otherwise the two per-projectile methods. Do not mutate the authoritative projectile list to hide native art. |
| Source muzzle, hit, explosion and animated effects | Native effect sheets/data or `drawContentEffect`; author timing and source sprites. |
| Radar screens, combat messages and tactical overlays | Existing world/screen overlay set, optional renderer/input subclasses and filtered module state. |
| Unit actions and localized status | Existing module inspection/action contracts and content command gateway. |
| Recoil | Existing native recoil manager; a source-specific curve can be implemented by the package's picture/mount adapter. |
| Death/reload/engine/jet/penetration/near-miss/rack audio | Scoped recorded playback plus feedback update and module cues; source event semantics remain in UCGR. |

No source-specific rendering, effect identity, sound choice or gameplay rule was
added to the game. These seams remove the identified presentation capability
gaps; source asset conversion, event bindings, exact timing and visual validation
remain mod work.

## Verification

- `pnpm -C game/core test extension-recorded-audio extension-feedback extension-visuals content-cold game-frame-loop`: **16 passing tests**.
- Audio tests cover native mixer identity, live volume/spatial changes, rate,
  loop regions, pause/background behavior, cache ownership, natural completion,
  reset/disposal, device errors, and late asynchronous decode cancellation.
- Composition tests cover independent owners, inherited callbacks, live timeline
  changes, disposal and invalid factory cleanup. Frame-loop tests verify that a
  draw cap/covered frame does not skip updates.
- The cold-import rejection test includes `recordedAudio`, `contentVisuals` and
  the generated content renderer; ordinary content never loads these modules.
- [Real browser probe](presentation-browser.mjs) and [raw results](presentation-browser.json)
  load an independent SHA-verified API-2 package in Chrome and WebKit. Both show
  `decal → unit → trail → projectile → effect` order and an effect-colored pixel
  over the underlying unit/wreck. Real audio has RMS about 0.041 when playing and
  after resume, exactly zero while paused and after disposal; no page errors.

The browser probe verifies lifecycle/functionality, not long-session memory or
performance equivalence. Cross-device performance evidence belongs to the main
closure report.

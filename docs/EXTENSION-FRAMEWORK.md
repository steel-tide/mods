# Content extension packages

The game supplies a versioned extension host. Each mod carries and maintains its
own extension implementations, alongside its definitions and assets. The game
and the registry have no catalog of component, logistics, sensor or articulation
implementations. A mod can supply new gameplay through the host API without
using another mod's package or adding its implementation to the game.

## Ownership

| Game host | Individual mod |
| --- | --- |
| Package validation, integrity, local approval and loading | Package source, build, version and embedded descriptor |
| Versioned simulation SDK, lifecycle and selected optional kernels | Its own capability IDs, configuration readers and gameplay algorithms |
| Authoritative orders, match state, saves and filtered frames | Private state, actions, restoration and redaction policies |
| Generic status/action HUD, rendering and input SDK | Specialized drawing/input adapters, localized labels and original assets |
| Generic contract tests and vanilla regression gates | Feature tests, fixtures, authoring guides and compatibility reports |

A mod may organize its sources like this; the host reads the embedded descriptor
in `mod.json`, so the source directory name is an authoring choice:

```text
mods/my-mod/
  mod.json
  extensions/
    my-system-v1/
      src/
      test/
      docs/
      build.mjs
      extension.json
  sprites/
```

The mod's build embeds its own descriptor in `extensionPackages`. Installation
carries the complete extension with the mod; it does not require a separate
selectable pack or a repository-level gameplay library. The public framework
guide describes the host contract. A feature's accepted fields, algorithms and
fixtures belong with the mod that implements them.

Adding a capability through the existing SDK requires no game edit. Adding a
new host primitive or breaking its API requires an engine change and an explicit
API version decision. Vanilla keeps its ordinary constructors and kernels. No
per-entity extension dispatch is added to its simulation or drawing.

## Package format

Format 4 adds `extensionPackages` to the existing additive definition-pack
format. `requiredCapabilities` is a bounded list of package-defined IDs, rather
than a fixed engine enum. Choose namespaced package and capability IDs, such as
`my-mod.systems-v1` and `my-mod.heat-v1`, to avoid collisions with other mods.
Namespaces are an authoring convention; the host does not rewrite IDs. A mod
supplies the matching schema and runtime for every required capability and puts
its definition or weapon configuration under `extensions[capabilityId]`.
Conflicting providers are rejected rather than chosen by installation order.
A descriptor contains:

- `id`, semantic `version`, and host `api` (currently `1`).
- `capabilities`, in the package's deterministic initialization order.
- `schema` and `runtime`, each `{source, sha256}`.
- Optional `presentation`, also `{source, sha256}`.
- Optional `assets`, mapping up to 256 package-local resource IDs to safe relative
  paths inside the owning mod. Existing total file-size limits still apply.

Each source is a self-contained ES module exporting a default host factory.
The factory receives an SDK object and returns the part's exports. Modules may
not depend on a source checkout, package manager, or another downloaded script.
A package build should verify that no engine implementation is bundled into its
output; the supplied host SDK is its integration boundary.
The descriptor is embedded directly so folders, packed files, registry downloads,
worlds and offline saves carry the same exact source. Metadata remains bounded
by the game's manifest limit; individual source strings are at most 512 KiB.

The schema factory receives no simulation or browser SDK. It returns
`capabilities: [{id, definition, weapon?, references?}]`. Readers validate and
normalize data; reference checks validate composed definitions. The runtime
factory receives the version-1 simulation SDK and returns
`capabilities: [{id, create(host)}]`. The host supplies match-owned participants,
configuration, RNG through the match, firing/damage and ordinary order functions.
Instances implement lifecycle, private state, restoration, commands and inspection
through `extensions/contracts.ts` in the game.

An instance may expose `wrapShot(next)`, composed once when an extended match
is constructed. It wraps the native emitter for both weapon bursts and explicit
host launches, before projectile and muzzle-effect creation. Keep authored
definitions immutable and forward unmodified arguments for unrelated weapons.
The host preserves the original weapon context for `onShot`; geometry adapters
belong to their owning package. Vanilla does not load or call this composition.

The optional presentation factory receives the browser SDK and exports
`presentation(base)`, returning Renderer/Input subclasses. Packages compose in
content order. The generic HUD renders package-owned rows/actions and language
tuples. Dedicated servers and module workers never import the browser SDK.

The browser SDK's `asset(id)` resolves only that package's declared resources to
installed data URLs. Resource files travel through ordinary folder/zip imports,
offline packing and embedded worlds. No separate download or repository is
needed. Schema readers receive the supplying package's `context.assetIds` for
reference validation. A changed resource mapping changes package identity;
reloading content refreshes asset readers even when executable code is unchanged.

Presentation exports may also supply `feedback(context, base)`, where context
contains the match, local player and spectator status. It returns a `unitVoice`
callback and optional `dispose`. The host composes these once at match entry and
routes selection and accepted local commands through the selected callback.
There is no simulation broadcast or frame-loop feedback lookup. Disposers run
in reverse order, including cleanup after partial setup failure.
Each factory returns only its own cleanup; it must not call `base.dispose`
itself. Forwarding an unchanged inherited disposer does not register it twice.

`playRecordedUnitVoice(defId, action, entityId, takes, {gain, repeatMs})` uses the
existing voice volume, priority, music ducking and destroyed-speaker cleanup.
Takes are installed data URLs; absent or undecodable recordings stay silent.
Release used URLs with `releaseRecordedVoiceResources(takes)` on disposal.
`pushMusicQueues(queues)` layers a local match/faction choice over the existing
music player and returns an idempotent disposer. It restores the current content
queues, including intervening content changes; it does not create another player.
State cosmetics use the existing optional renderer and fog-filtered module view.
Native recoil remains available through the presentation SDK.

## Loading and trust

Extension packages are **trusted executable JavaScript**, not sandboxed RW data.
Hashes establish byte identity, not author trust. A local installation/import or
administrator configuration approves a descriptor. Every code part is checked
before even its schema runs. Integrity uses Web Crypto where available and a
tested dependency-free SHA-256 implementation on hosts without it, such as plain
HTTP and the desktop custom origin. Network messages and automatic `?mod=` links cannot approve new packages. Automatic
URL refresh also preserves the previous approval; changed code needs an explicit
install/reload action. Chosen local folders retain their existing edit/reload workflow.

`await prepareContentSchema(raw, true)` is for a locally chosen package; the
normal `prepareContentSchema(raw)` accepts only previously approved packages.
Then parse the content synchronously and await `prepareContentCapabilities` before
creating a match. A vanilla input returns `null` and keeps the optional loader
unimported. Package failures propagate; there is no built-in gameplay fallback.

In-app hosting passes the page's approved package stamps to its module worker and
forwards later approvals through its private control channel, outside the match tick.
A dedicated administrator selects local package descriptors or mod manifests with
`STEEL_TIDE_EXTENSION_PACKAGES` (semicolon-separated paths). An unapproved world
sent over a socket is refused before its code executes. Players receiving such a
world must first install its trusted mod/package locally. Public world submission
validation likewise refuses an unapproved executable package; publishing these
worlds needs a reviewed package allowlist in that service.

The existing `engineCapabilities` handshake field now advertises `extension-host-v1`.
Ordinary mod rooms additionally compare exact package version/code stamps. World
rooms verify the complete embedded world hash before readiness, including code,
and each endpoint verifies the package's individual hashes. The wire field shapes
and protocol version are unchanged. Old clients can still play vanilla; format 4
and the host ABI keep them out of extension matches they cannot execute.

## State and compatibility

Package instances belong to a match and are disposed with it. Code can remain in
the JavaScript module cache; disposal does not promise to unload parsed code.
Factories are cached by complete content context, so preparing another version
cannot silently replace an existing context. Conflicting providers for the same
capability are rejected. Capability state stays under its existing save/frame ID;
this extraction preserves the current simulation state codecs.

Formats 1 and 2 and ordinary format 3 content remain supported. The former
format-3 built-in-capability packs do not carry executable implementations and
need to be repackaged as format 4 with an explicit compatible package. Old embedded
world/save content is not silently rebound to an arbitrary installed version.

## Verification and performance

The core tests use unrelated counter packages to prove arbitrary IDs,
independent mods running together, orders, persistence, disposal, return to
vanilla, integrity rejection and version isolation. The [ownership verification](engine-compatibility/2026-10-18-mod-owned-extensions/README.md)
records the current layout and checks.
Each mod keeps its feature suites beside its implementation and exercises the
real engine, server, browser adapters and CLI as needed. Shared host tests must
not import a particular mod or depend on a local draft.

The [refactor evidence](engine-compatibility/2026-10-16-external-packages/README.md)
records the earlier extraction against engine `31095b4f`; its directory paths
and package ownership describe that dated revision. Current implementations
belong inside their individual mods. Native function bodies are checked separately
from timing. No reproducible vanilla slowdown is acceptable; lack of a measured
slowdown in a desktop experiment does not establish a universal zero-cost claim.
The [M6 evidence](engine-compatibility/2026-10-18-m6/README.md) records package
feedback and launch wrappers, exact hot-path identity, browser measurements and
the still-inconclusive strict cold-start parity result.

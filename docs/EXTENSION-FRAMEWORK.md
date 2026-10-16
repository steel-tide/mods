# Content extension packages

The game supplies a versioned host. Gameplay capabilities are executable packages
in this mod repository. There is no engine catalog of component, logistics,
sensor or articulation implementations.

The shared [`combined-arms` package](../extensions/combined-arms-v1/README.md)
provides those four capabilities. The unfinished local UCGR draft embeds it in
`mod.json`; `mods/usgr-re` is currently ignored by Git and excluded from the
published registry. Its files remain available for local development. Other definition packs
can embed the identical package without creating another selectable faction or
requiring a second mod installation.

## Ownership

| Game host | Extension package | Definition pack |
| --- | --- | --- |
| Package validation, integrity, local approval and loading | Configuration readers and cross-definition checks | Required capability IDs and pinned package descriptor |
| Versioned simulation SDK, lifecycle and selected optional kernels | Component, ammunition, sensor and assembly algorithms | Unit layouts, armor, stocks, sensors and source formulas |
| Authoritative orders, match state, saves and filtered frames | Private state, actions, restoration and redaction policies | Unit names, artwork, sounds and translations |
| Generic status/action HUD, rendering and input SDK | Specialized drawing and selection adapters | Original sprites and localized presentation data |

Adding another capability through the existing SDK requires no game edit.
Adding a new host primitive or breaking its API requires an engine change and
an explicit API version decision. Vanilla keeps its ordinary constructors and
kernels. No per-entity extension dispatch is added to its simulation or drawing.

## Package format

Format 4 adds `extensionPackages` to the existing additive definition-pack
format. `requiredCapabilities` is a bounded list of package-defined IDs, rather
than a fixed engine enum. A descriptor contains:

- `id`, semantic `version`, and host `api` (currently `1`).
- `capabilities`, in the package's deterministic initialization order.
- `schema` and `runtime`, each `{source, sha256}`.
- Optional `presentation`, also `{source, sha256}`.

Each source is a self-contained ES module exporting a default host factory.
The factory receives an SDK object and returns the part's exports. Modules may
not depend on a source checkout, package manager, or another downloaded script.
The package build verifies that no engine source is bundled into its output.
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

The optional presentation factory receives the browser SDK and exports
`presentation(base)`, returning Renderer/Input subclasses. Packages compose in
content order. The generic HUD renders package-owned rows/actions and language
tuples. Dedicated servers and module workers never import the browser SDK.

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

The core tests use an unrelated `test-counter-v1` package to prove arbitrary IDs,
loading, orders, persistence, unload, integrity rejection and version isolation.
The component/logistics/sensor/articulation suites live beside their implementation
and still exercise the real engine, server, browser adapters and CLI. UCGR retains
its source-specific pack tests.

The [refactor evidence](engine-compatibility/2026-10-16-external-packages/README.md)
compares against engine `31095b4f`. Native function bodies are checked separately
from timing. No reproducible vanilla slowdown is acceptable; lack of a measured
slowdown in a desktop experiment does not establish a universal zero-cost claim.

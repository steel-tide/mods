# Combined arms extension package

UCGR's own component protection/damage, logistics, sensor, articulation and feedback
implementation. This package belongs entirely to the UCGR mod alongside its
definitions and assets; its complete descriptor is embedded in UCGR's `mod.json`.
It needs no separate selectable mod or repository-level gameplay library. The
unfinished UCGR folder, including this extension, is currently ignored by Git
and excluded from the published registry.

`src/` owns the pack implementations, their strict readers, presentation adapters
and `[en, zh, ko]` action labels. `test/` owns their regression/integration suites
and `test/fixtures/` their isolated study packs. `docs/` owns the accepted feature
contracts and omissions. `extension.json` is the distributable API-2 host descriptor, including all
three hashed ES modules. `dist/*.mjs` are readable build outputs and are ignored.

From the mod repository root, with the sibling game checkout and its development tools:

```sh
node mods/ucgr/extensions/combined-arms-v1/build.mjs
node ../steel-tide/game/core/node_modules/typescript/bin/tsc -p mods/ucgr/extensions/combined-arms-v1/tsconfig.json
python3 -B mods/ucgr/port.py
bun test ./mods/ucgr/extensions/combined-arms-v1/test
bun test ./mods/ucgr/*.test.ts
```

The builder replaces `host.ts`/`presentationHost.ts` imports with SDK bindings and
rejects any bundled game source. The game is a build/type-check dependency; shipped
packages contain no checkout paths or engine imports. UCGR embeds this
`extension.json` descriptor in its `extensionPackages` array and declares the
capabilities its definitions use. Other mods supply their own namespaced
capabilities, schema, runtime and presentation through the host API; this
implementation is not a shared framework dependency.

See the [host contract and trust boundary](../../../../docs/EXTENSION-FRAMEWORK.md).
The package's existing bounded capability contracts remain described in the
[M1/M2](docs/M1-M2-AUTHORING.md) and
[M3/M4](docs/SENSORS-ARTICULATION-V1.md) authoring guides, with additional
[T-90M source policies](docs/M1-SOURCE-POLICIES.md).
The [M6 guide](docs/M6-FEEDBACK.md) covers local recordings, public component
icons, fixed hardpoints and native recoil. Asset IDs are declared in `assets.json`
and embedded with the descriptor; `assets/` travels inside the ordinary mod.

Later additions (2026-10-19), all inside existing capabilities: source smoke
(`src/sourceSmoke.ts` under `components-v1.smoke`), TOS-1A tag deployment and
barrage minimum stock (`articulation-v1` `barrages[].minimumStock`,
`clearMoveOrders`), source transport weights/tags (`sourceTransport`) and the
`articulationPointPose` accessor used to place launcher-mounted points. The
pack-level [LEDGER.md](../../LEDGER.md) records evidence and remaining work.

The moved implementation retains the game package's declared
`PolyForm-Noncommercial-1.0.0` license. UCGR's original content and attribution
remain governed by that mod's separate license notice.

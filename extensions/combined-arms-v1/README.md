# Combined arms extension package

Reusable component protection/damage, logistics, sensors and articulation for
Steel Tide definition packs. This is an implementation package in the mod repo,
not a separate selectable mod. The unfinished local UCGR folder embeds it and is
currently ignored by Git and excluded from the published registry.

`src/` owns the four implementations, their strict readers, presentation adapters
and `[en, zh, ko]` action labels. `test/` owns their regression/integration suites.
`extension.json` is the distributable version-1 host descriptor, including all
three hashed ES modules. `dist/*.mjs` are readable build outputs and are ignored.

From this repository, with the sibling game checkout and its development tools:

```sh
node extensions/combined-arms-v1/build.mjs
node ../steel-tide/game/core/node_modules/typescript/bin/tsc -p extensions/combined-arms-v1/tsconfig.json
python3 -B mods/usgr-re/port.py
bun test ./extensions/combined-arms-v1/test
bun test ./mods/usgr-re/game.test.ts ./mods/usgr-re/components-game.test.ts ./mods/usgr-re/sensors-game.test.ts
```

The builder replaces `host.ts`/`presentationHost.ts` imports with SDK bindings and
rejects any bundled game source. The game is a build/type-check dependency; shipped
packages contain no checkout paths or engine imports. Another mod embeds the same
`extension.json` descriptor in its `extensionPackages` array and declares only the
capabilities its definitions use.

See the [host contract and trust boundary](../../docs/EXTENSION-FRAMEWORK.md).
The package's existing bounded capability contracts remain described in the
[M1/M2](../../docs/engine-compatibility/M1-M2-AUTHORING.md) and
[M3/M4](../../docs/engine-compatibility/SENSORS-ARTICULATION-V1.md) authoring guides.

The moved implementation retains the game package's declared
`PolyForm-Noncommercial-1.0.0` license. UCGR's original content and attribution
remain governed by that mod's separate license notice.

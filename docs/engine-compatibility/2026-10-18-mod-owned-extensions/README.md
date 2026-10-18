# Mod-owned extension verification — 2026-10-18

Each mod owns its executable extensions. The UCGR implementation, build,
descriptor, feature tests, fixtures and feature guides now live under
`mods/usgr-re/extensions/combined-arms-v1/`. The former repository-root
`extensions/` library is removed. The converter embeds the descriptor from
UCGR's own folder, so installing its ordinary folder or packed file carries
everything needed at runtime.

UCGR remains an ignored local draft, as established before this move. Its files
are preserved locally and remain excluded from registry publication. This record
and the generic framework documentation do not require that draft to be present.
Earlier dated evidence describes the paths and ownership at its own revision.

## Host boundary

No game runtime code changed for this move. The host already accepts arbitrary
package and capability IDs. A new generic regression test loads two unrelated
mods with separate namespaced capabilities and proves concurrent operation,
independent commands, save continuation, disposal exactly once, removal of
match/state runtime associations, reactivation of one package, and return to the
native `Game` with no extension save field. It imports no UCGR implementation.

The core changes are that test and the generated authoring brief. The brief
describes each mod's own schema, runtime, presentation, tests and documentation;
it no longer presents UCGR's gameplay schema as part of the host contract.

Cold-content tests still prove ordinary content does not load optional
registries, schemas or presentation. Since this change does not alter runtime
code, it introduces no new vanilla runtime path. This is not a new timing study
or a claim that the wider strict performance gate is universally closed. Module
caches can retain loaded code after match disposal; this is not process isolation.

## Reproducibility and checks

Moving the TypeScript sources exposed a build-location-dependent class-field
transform. The UCGR builder now pins the existing assignment semantics explicitly.
Its rebuilt descriptor is byte-for-byte identical to the pre-move descriptor;
the converter's manifest and conversion report are also byte-for-byte identical.
No capability identifiers, source behavior or saved-state codecs changed.

| File | SHA-256 before and after |
| --- | --- |
| `extension.json` | `0bf052c747ce26a854590cf10f2081b62851ab04cd6891e22e2cce8750c821cf` |
| `mod.json` | `5f3c1704996177eacc2b9be6e421bef50377a3f018ff93ed33c3ce7befaa0ec8` |
| `conversion-report.json` | `dae897851ecdb32779b24281b5766ea4645eaf58d2fec64d0e383aed21831a16` |

Passed:

- Root game `pnpm check`, including all five workspaces with check scripts.
- Host/cold-content suites: 15 tests, 64 assertions.
- UCGR extension typecheck and gameplay suites: 86 tests, 1,103 assertions.
- Explicit UCGR validation: 96 definitions, 131 sheets, 36 sounds, one map,
  four screenshots.
- UCGR offline pack round-trip: its exact package and requirements survive.
- Registry-wide validation: seven published mods; UCGR remains excluded.
- Registry tests: two tests; local documentation links and diff whitespace checks.

The generic tools were regenerated from the host; the unrelated concurrent game
translation edit was excluded from the generated checker change.

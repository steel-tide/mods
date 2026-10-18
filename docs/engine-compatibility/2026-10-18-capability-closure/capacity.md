# Content capacity closure — 2026-10-18

Definition packs can opt into a bounded larger catalog by declaring `"v": 4,
"capacity": "large"`. The declaration controls validation and installation. It
does not allocate a catalog, image cache, audio buffer, simulation array or
network frame at the stated maximum. Runtime work follows the content actually
installed and activated. Ordinary packs retain their existing budgets.

| Budget | Ordinary / omitted | Large |
| --- | ---: | ---: |
| Definitions | 200 | 1,024 |
| Sprite sheets | 192 | 2,048 |
| Ordinary weapon recordings | 60 | 512 |
| Definition HP | 1,000,000 | 100,000,000 |
| Production/build/reference list | 64 | 1,024 |
| Explicit faction roster | 200 | 1,024 |
| Manifest metadata | 1 MiB | 4 MiB |
| Stored asset data URLs, aggregate | 24 MiB | 256 MiB |
| Resource IDs per executable package | 256 | 2,048 |
| Source per executable module | 512 KiB | 2 MiB |
| World container, aggregate | 16 MiB | 128 MiB |
| World save | 64 MiB | 320 MiB |

Manifest/source/embedded-file budgets retain the existing character-count
semantics; data URLs are ASCII. World packages use encoded UTF-8 bytes. Each
schema/runtime/presentation module must fit its own source ceiling, and their
combined code plus configuration must also fit the metadata ceiling. A world
gets its larger aggregate budget only when it embeds a valid format-4 pack
with `capacity: "large"`; a capacity declaration is not a validation bypass.
Every embedded pack still passes its own ordinary/large limits. Standalone
packs may therefore carry more assets than a world can embed.

The ordinary eight-weapon limit was already sufficient for the known five-gun
omission. That omission came from the UCGR converter's four-weapon selection;
the host already stores, saves and replicates eight independent weapon slots.
A test now covers all eight slots alongside 23-million HP. No weapon-loop
capacity or native combat arithmetic changed.

All existing identity, path, ownership, reference, hash/trust and additive
content checks remain. Larger packages cannot overwrite vanilla definitions
or artwork. Old/unknown capacity declarations receive the ordinary budget and
are rejected by the format/schema rules. Host API 1 packages remain accepted;
future unsupported API versions are rejected.

## Source basis

[The inventory](source-asset-inventory.json) records the complete source tree,
including content and music deferred with M5:

- 1,552 PNGs: 8,639,657 bytes (8.24 MiB).
- 267 Ogg recordings: 6,335,026 bytes (6.04 MiB), plus one existing WAV.
- 724 INI files. The established content audit retains 415 candidate records.
- Converting every Ogg recording to PCM16 at its original sample rate and
  channel count is estimated at 63,994,252 bytes (61.03 MiB), including a
  44-byte WAV header per recording; its base64 alone is 85,326,016 characters
  (81.37 MiB). This estimate uses `ffprobe` durations rounded to sample frames.
- Those converted recordings plus the original PNGs occupy roughly 93 MiB
  when encoded, before metadata. This is why the large world budget is 128
  MiB instead of 64 MiB. No source music must be recompressed merely to fit
  the container.
- The largest literal source `maxHp` is 23,000,000 (the bonus T-80U), below
  the large ceiling. No HP clamping was introduced.
- All 829 single-line `displayDescription` declarations are at most 259
  characters, below the existing 400-character string/tuple text limit.
  This does not claim translation completeness or dynamic text parity.

The existing world launch config contains both `world.mods` and
`world.project.mods`. A save can therefore duplicate embedded asset bytes.
The 320 MiB save budget accommodates two complete 128 MiB world payloads plus
state. This pass retains that format instead of silently dropping one copy.
Large content pays its actual serialization and memory costs; merely enabling
support reserves no large buffers. Plain saves remain capped at 8 MiB.

## Covered paths

The parser, schema preparation, package loader, generic content dispatcher,
folder/ZIP/single-file imports, URL/registry downloads and installed storage
checks share the selected pack budget. Downloads and folder imports stop once
the aggregate encoded asset budget would be exceeded. ZIP expansion has an
aggregate hard ceiling before the manifest's own budget is applied.

World parsing, community index/downloads, editor import/cover checks, draft
backup restoration, publication validation and saved world validation use the
world budget. Transport envelopes are documented in the parent closure report;
normal message limits remain unchanged. World publishing tests exercise the
local validator/handler, not a deployed provider's request-body limits.

The registry's offline packer now validates the final embedded package as
well as its source manifest. It refuses an oversized export instead of writing
a file the game cannot reopen. The generated mod/world checker bundles and
registry authoring tables were rebuilt from the game-owned validators.

## Verification

Focused tests cover:

- A synthetic 415-definition catalog with 1,552 sheets, 268 sounds and
  23-million HP; activation/removal restores the exact vanilla table.
- Standard and large definition/sprite/sound/HP ceilings, old/unknown profile
  rejection, unsafe paths, and attempts to replace vanilla data/art.
- A pack-owned producer exposing 415 definitions; ordinary lists still reject
  more than 64 entries.
- Generic packed-file import above the former 24 MiB asset ceiling, separate
  metadata/asset budgets and aggregate over-limit rejection using shared
  strings rather than allocating 256 MiB of test data.
- A large package with 1,552 private resources and more than 1 MiB of module
  source; schema preparation and parse agree on limits. Oversized modules and
  resource tables are rejected. The ordinary profile remains bounded.
- 23-million HP after fractional damage, save restoration, a complete
  multiplayer frame and a subsequent delta; all eight weapon cooldowns survive.
- Large world import, registry/index/download and backup round trips above
  16 MiB; a 66+ MiB save restores its embedded assets and state. The declared
  maximum save budget also covers twice the maximum world container.
- Portable tool builds expose the capacity field and validate the same full
  catalog. Registry packing preserves bytes and rejects oversized ordinary
  exports.

Results: 19 focused capacity/world/tool/registry tests pass; the related
ordinary mod/music/feedback suites pass; all four mod-repository tests pass;
all seven published mods validate. Game and server TypeScript checks pass.
These are correctness checks, not a claim of measured zero startup regression;
the parent closure report owns the performance evidence.

## Remaining scope

This closes the identified catalog/media/HP capacity blockers. Source data,
translations, appearance and extension behavior still have to be ported and
verified inside UCGR. M5 player counts, map dimensions, game modes and victory
rules are unchanged. This profile does not promise unlimited future content;
its explicit upper bounds remain part of the format contract.

# Art and audio production record

All illustrations, sprite masters and sound recordings were generated for this expansion. References are its own generated masters; no third-party franchise art or sampled game recordings were used. The overall name describes a science-fiction genre, not another game's setting or license.

The pipeline invokes the unmodified vanilla scripts from the adjacent Steel Tide repository. Every output path points into this mod. Original paintings and recordings remain under `art/` in the authoring workspace; shipping WebP and MP3 files are derived outputs. The registry publishes the finished assets and prompt workbooks, not the original masters or local generation logs.

| Asset | Workbook / source | Vanilla workflow |
|---|---|---|
| 77 sprite masters | `PROMPTS.md`, `art/sprites/` | `gen-sprites.mjs`, `openai/gpt-image-2`, high quality |
| Three Blackout District materials and one 4×4 sign atlas | `TERRAIN-PROMPTS.md`, `art/terrain/` | Same generator and model, 1024 × 1024, Nexus material reference for surfaces; fictional civic/storefront icons for signs; `cut-terrain.mjs` and vanilla `buildSprites`, 128px world materials at 2× supersampling, WebP q95 |
| Five four-pose gait studies | `ANIMATION-PROMPTS.md`, `art/gaits/` | Same generator, 2048 × 2048, own body references |
| Registered walker strips | `compose-animation.mjs`, `art/animations/` | `scripts/lib/frames.mjs`: matte stripping, body registration, premultiplied warping, static-body compositing |
| Twenty-four building power cycles | `art/stills/`, `art/prepared/` | `paint-glow.mjs`, four frames |
| Shipping sprite cuts | `cut-art.mjs` | `buildSprites`, 2× headroom, 2× supersampling metadata, WebP q95 |
| Three cover paintings | `COVER-PROMPTS.md`, `art/covers/` | `gen-store-art.mjs`, `google/gemini-3-pro-image`; `build-covers.mjs`, framed crop, 1920px |
| Twelve weapon/machine sounds | `SFX-PROMPTS.md`, `art/sfx/` | `gen-sfx.mjs` through ElevenLabs, two takes each; `build-sfx.mjs` trims and normalizes; `master-sfx.py` measures codec headroom and re-encodes from the selected original |
| Registry cover card | `art/covers/blackout.png`, `cut-registry-cover.mjs` | Same vanilla cover cutter, followed by a 1600 × 1200 left-framed card cut |
| Six screenshots | `shoot-scenes.mjs`, district runtime captures in `qa/` | Real game rendering through vanilla `scripts/lib/chrome.mjs`; four staged gameplay scenes and day/night views of the district, JPEG q90 |
| Roster portraits | `portraits/` | The game's own `defIcon`, blue team recoloring and assembled turrets |

Audio selection: take 1 for all twelve slots. Raw take 2 is retained as an alternate. The shipping one-shots decode in the browser and have been measured for duration and amplitude. The final MP3s are also decoded at four times their sample rate to check peaks; all remain below −1 dBFS. Each final encode starts from the selected original recording. No synthesized fallback is needed for these slots.

Transparency: matte removal uses the game's flood fill. Explicitly reviewed enclosed background pockets are cleared for open turret rings, split hulls and the naval slip. The effect strips are cropped into equal square cells. Movement strips retain the original torso while the legs move; the original master remains the idle frame. `art/adjustments.json` records measured alignment decisions.

Blackout District authors stepped, court, slab and terrace building forms, with two to four storeys, dense roof equipment and sparse greenery. Three opaque materials supply roof panels, facade cladding and paving; a fourth opaque sheet holds sixteen commercial sign panels in a regular 4×4 grid. The renderer crops a panel for each sign and preserves its cyan, amber, coral or ivory color in the night lighting pass. The terrain cutter restores the full RGB surface where the unit-oriented generator cleared matte alpha. Each cut is 256 × 256; no faction recoloring, rotation or backdrop removal applies. Panel facades, equipment, signs and shadows follow the authored building forms. City tile movement, road access and damage stay unchanged, including extinguished lights in ruined buildings. The eight atlas maps explicitly select this variant. Its namespaced sheets do not replace vanilla art, and missing textures retain the variant's procedural colors. Cyberpunk 1.3.0 requires the upcoming Steel Tide 0.8.15 support and is not yet published.

The separate campaign authoring file uses unit cuts at native baked resolution (1× extra headroom, still 2× supersampling; portable WebP q70). Its 81 images and twelve sounds are embedded across an arsenal pack and a terrain-only district pack. Each pack fits the existing manifest limit; the world packer verifies full asset-byte equality after embedding, without discarding or recompressing any art to make it fit. Both the world and regular ZIP carry the exact same four 256px q95 terrain sheets with 2× supersampling metadata. The regular ZIP keeps 2× extra headroom for units. Both are derived from the same originals.

Rebuild from the authoring checkout, with its retained masters and scripts:

```sh
python3 mods/cyberpunk/build-mod.py
python3 mods/cyberpunk/make-maps.py
# The generation runners only fill missing masters. They use the existing
# game workflow's local credentials, which are never copied into this repo.
python3 mods/cyberpunk/generate-assets.py
python3 mods/cyberpunk/generate-animation.py
bun mods/cyberpunk/cut-art.mjs
node mods/cyberpunk/compose-animation.mjs
bun mods/cyberpunk/cut-art.mjs
bun mods/cyberpunk/cut-terrain.mjs
python3 mods/cyberpunk/master-sfx.py
bun mods/cyberpunk/prepare-world-art.mjs
python3 mods/cyberpunk/build-campaign.py
python3 mods/cyberpunk/build-manual.py
node mods/cyberpunk/cut-registry-cover.mjs
node mods/cyberpunk/pack.mjs
```

API calls are not required to rebuild cuts from the supplied masters. `qa/generation/` preserves per-asset logs and completion receipts. The cover and sound workbooks carry the prompts; original scripts are responsible for API selection and billing.

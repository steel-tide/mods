# Art and audio production record

All illustrations, sprite masters and sound recordings were generated for this expansion. References are its own generated masters; no third-party franchise art or sampled game recordings were used. The overall name describes a science-fiction genre, not another game's setting or license.

The pipeline invokes the unmodified vanilla scripts from the adjacent Steel Tide repository. Every output path points into this mod. Original paintings and recordings remain under `art/` in the authoring workspace; shipping WebP and MP3 files are derived outputs. The registry publishes the finished assets and prompt workbooks, not the original masters or local generation logs.

| Asset | Workbook / source | Vanilla workflow |
|---|---|---|
| 77 sprite masters | `PROMPTS.md`, `art/sprites/` | `gen-sprites.mjs`, `openai/gpt-image-2`, high quality |
| Five four-pose gait studies | `ANIMATION-PROMPTS.md`, `art/gaits/` | Same generator, 2048 × 2048, own body references |
| Registered walker strips | `compose-animation.mjs`, `art/animations/` | `scripts/lib/frames.mjs`: matte stripping, body registration, premultiplied warping, static-body compositing |
| Twenty-four building power cycles | `art/stills/`, `art/prepared/` | `paint-glow.mjs`, four frames |
| Shipping sprite cuts | `cut-art.mjs` | `buildSprites`, 2× headroom, 2× supersampling metadata, WebP q95 |
| Three cover paintings | `COVER-PROMPTS.md`, `art/covers/` | `gen-store-art.mjs`, `google/gemini-3-pro-image`; `build-covers.mjs`, framed crop, 1920px |
| Twelve weapon/machine sounds | `SFX-PROMPTS.md`, `art/sfx/` | `gen-sfx.mjs` through ElevenLabs, two takes each; `build-sfx.mjs` trims and normalizes; `master-sfx.py` measures codec headroom and re-encodes from the selected original |
| Four screenshots | `shoot-scenes.mjs` | Real game rendering through vanilla `scripts/lib/chrome.mjs`; staged gameplay scenes |
| Roster portraits | `portraits/` | The game's own `defIcon`, blue team recoloring and assembled turrets |

Audio selection: take 1 for all twelve slots. Raw take 2 is retained as an alternate. The shipping one-shots decode in the browser and have been measured for duration and amplitude. The final MP3s are also decoded at four times their sample rate to check peaks; all remain below −1 dBFS. Each final encode starts from the selected original recording. No synthesized fallback is needed for these slots.

Transparency: matte removal uses the game's flood fill. Explicitly reviewed enclosed background pockets are cleared for open turret rings, split hulls and the naval slip. The effect strips are cropped into equal square cells. Movement strips retain the original torso while the legs move; the original master remains the idle frame. `art/adjustments.json` records measured alignment decisions.

The separate campaign authoring file uses cuts at native baked resolution (1× extra headroom, still 2× supersampling; portable WebP q70) to fit the existing per-mod JSON ceiling. Its 77 images and twelve sounds are embedded; the regular ZIP keeps 2× extra headroom. Both are derived from the same originals.

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
python3 mods/cyberpunk/master-sfx.py
bun mods/cyberpunk/prepare-world-art.mjs
python3 mods/cyberpunk/build-campaign.py
python3 mods/cyberpunk/build-manual.py
node mods/cyberpunk/pack.mjs
```

API calls are not required to rebuild cuts from the supplied masters. `qa/generation/` preserves per-asset logs and completion receipts. The cover and sound workbooks carry the prompts; original scripts are responsible for API selection and billing.

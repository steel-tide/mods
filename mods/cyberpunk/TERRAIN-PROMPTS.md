# Blackout Protocol — city materials

These materials belong to the Cyberpunk city variant. The district uses stepped mid-rise blocks, slab towers, terraces and enclosed
service courts, with dense roof machinery and illuminated commercial panels.
The mod authors the building forms and material kit together. City tile collision,
road access and damage rules still belong to the base game. These namespaced
assets never replace vanilla atlas keys.

The image workflow is the vanilla `gen-sprites.mjs` generator using
`openai/gpt-image-2`, followed by `cut-terrain.mjs`. Full-resolution originals
remain in `art/terrain/`; `terrain/` contains the shipping cuts.

Run from a sibling `steel-tide` checkout:

```sh
node game/core/scripts/gen-sprites.mjs ter.cyberpunk-city-roof ter.cyberpunk-city-wall ter.cyberpunk-city-ground ter.cyberpunk-city-signs --doc ../steel-tide-mods/mods/cyberpunk/TERRAIN-PROMPTS.md --out ../steel-tide-mods/mods/cyberpunk/art/terrain --size 1024x1024
bun ../steel-tide-mods/mods/cyberpunk/cut-terrain.mjs
```

Each sheet is one opaque 128×128 world-pixel surface, sampled without rotation
or faction recoloring. The shipping image is 256×256 (`ss: 2`). The unit-oriented
generator clears matte alpha while preserving RGB. The terrain cutter restores
opaque alpha, since a material fills its whole square. It then uses the vanilla
sprite cutter with an explicit supersampling size and no alpha/keying cleanup.

The three materials carry restrained cyan service details. A separate 4×4
sign atlas contains sixteen opaque panels for roof billboards and storefronts.
Warm amber, coral and ivory signs contrast with cyan glass and circuitry.
Architecture and signage remain readable in daylight; night emission belongs
to the city lighting pass and extinguishes with building damage.

Suggested procedural colors when a material cannot be loaded:

| Surface | RGB | Hex |
| --- | --- | --- |
| Roof | 81, 97, 108 | `#51616c` |
| Wall | 53, 69, 83 | `#354553` |
| Pavement | 52, 60, 68 | `#343c44` |
| Glass | 64, 87, 103 | `#405767` |
| Copper trim | 157, 112, 77 | `#9d704d` |
| Night lighting | 103, 234, 255 | `#67eaff` |

### Graphite roof panels — `ter.cyberpunk-city-roof.png`

refs: ../../../steel-tide-mods/mods/cyberpunk/art/stills/u.cyberpunk-nexus.png

```text
Exactly 1024×1024 pixels. A seamless repeating square material texture for the roofs of a near-future city in the Cyberpunk: Blackout Protocol military RTS. Image 1 is a material, palette and pixel-detail reference ONLY: borrow the graphite metal, muted copper and restrained cyan accents, but do not reproduce the building, its shape, magenta panels, antennae or equipment.
Strict orthographic flat top-down surface, filling every pixel edge to edge. Paint medium-dark slate graphite maintenance panels in a restrained 4 by 4 modular arrangement, with shallow thin expansion seams, small flush fasteners, a few muted copper service strips and only two or three small unlit cyan inspection tabs per square. The dominant roof color is around #51616c, with modest variation between panels. Sparse scratches, worn dark paint and oxidized edges suggest a lived-in corporate industrial district. Keep at least 90 percent of the surface quiet neutral graphite. Surfaces are flat and readable at 128 by 128 game pixels; details use crisp clustered pixels in the reference's miniature RTS style. Faint north-west edge highlights are acceptable, but no raised equipment or cast shadow.
Both opposite borders must connect seamlessly in any repeated tiling. No border, margin, outer rim, bevel, vignette or transparent area. No whole buildings, skyline, roads, windows, protruding pipes, ventilation units, symbols, text, labels, logos, troops, vehicles, magenta, purple, dramatic lighting, bloom or glow. This is an opaque material texture, not an isolated object or illustration.
```

### Graphite facade cladding — `ter.cyberpunk-city-wall.png`

refs: ../../../steel-tide-mods/mods/cyberpunk/art/stills/u.cyberpunk-nexus.png

```text
Exactly 1024×1024 pixels. A seamless repeating square material texture for the facade cladding of a near-future city in the Cyberpunk: Blackout Protocol military RTS. Image 1 is a material, palette and pixel-detail reference ONLY: borrow the graphite metal, muted copper and restrained cyan accents, but do not reproduce the building, its shape, magenta panels, antennae or equipment.
Strict orthographic front-on flat cladding surface, filling every pixel edge to edge. Dark charcoal blue-grey composite facade panels around #354553. Subtle vertical structural ribs divide a restrained eight-column modular facade; very fine horizontal expansion joints, flush bolt heads, occasional scuffed copper connector plates and a few tiny dim cyan status insets. Keep the material low contrast and at least 95 percent neutral graphite. The renderer places windows, doors, illuminated signs and architectural relief above this material, so do not paint any windows or doors. Crisp clustered pixel detailing, restrained military miniature RTS finish. Clean large readable color masses at 128 by 128 game pixels; no photorealistic grain, soft airbrushing or deep shadows.
Both opposite borders must connect seamlessly in any repeated tiling. No border, margin, outer rim, bevel, vignette or transparent area. No whole buildings, skyline, roof, roads, windows, doors, protruding pipes, ventilation units, symbols, text, labels, logos, troops, vehicles, magenta, purple, dramatic lighting, bloom or glow. This is an opaque material texture, not an isolated object or illustration.
```

### Graphite city paving — `ter.cyberpunk-city-ground.png`

refs: ../../../steel-tide-mods/mods/cyberpunk/art/stills/u.cyberpunk-nexus.png

```text
Exactly 1024×1024 pixels. A seamless repeating square material texture for the pavement and courtyards of a near-future city in the Cyberpunk: Blackout Protocol military RTS. Image 1 is a material, palette and pixel-detail reference ONLY: borrow the industrial charcoal, muted copper and restrained cyan accents, but do not reproduce the building, its shape, magenta panels, antennae or equipment.
Strict orthographic flat top-down ground surface, filling every pixel edge to edge. Tough charcoal concrete street pavers around #343c44, worn slightly lighter on their upper faces, with sparse muted grey chips, shallow seams and one or two small flush rectangular utility access covers. A few subtle copper conduit joints and tiny muted cyan inlaid markers connect the material to the district's electronics. Large rectangular paving pieces, restrained 4 by 4 modular scale, no decorative circuit-board maze. Keep at least 97 percent of the surface quiet neutral charcoal and grey; no glowing lines or pools of light. Crisp clustered pixels in the reference's miniature military RTS style, legible at 128 by 128 game pixels. Nothing rises above the paving and no detail can be mistaken for a unit or obstacle.
Both opposite borders must connect seamlessly in any repeated tiling. No border, margin, outer rim, bevel, vignette or transparent area. No whole buildings, skyline, walls, road lane markings, windows, doors, protruding pipes, ventilation units, symbols, text, labels, logos, troops, vehicles, magenta, purple, puddles, dramatic lighting, bloom or glow. This is an opaque material texture, not an isolated object or illustration.
```

### Veyra sign panel atlas — `ter.cyberpunk-city-signs.png`

```text
Exactly 1024×1024 pixels. Production-ready texture atlas for the city buildings of Cyberpunk: Blackout Protocol, a miniature military real-time strategy game. A perfectly regular 4 by 4 grid of exactly sixteen square sign panels. Every cell is exactly 256 by 256 pixels, with cell edges at x/y 0, 256, 512, 768, 1024. No gaps, no gutters, no margin, no captions, no grid labels. Every cell fills its entire square with an opaque dark graphite sign plate. The renderer crops each cell separately as a billboard or storefront screen. Front-on orthographic flat view, absolutely no perspective or scene.
Each panel is a distinct futuristic urban commercial sign: a noodle bowl, a stacked housing monogram, a clinic cross, a transit arrow, a vertical battery icon, an angular freight emblem, an abstract broadcast tower, a tea cup, a numbered-looking fictional corporate mark, a wrench, a circular data-ring, a boxed abstract storefront glyph, an abstract market character, a delivery chevron, a circuit blossom, and a split circular utility emblem. These are fictional civic and commercial symbols, not military targets. Use just one bold symbol plus at most two or three large abstract rectangular glyph marks per panel. No readable real-world words, no brands, no human faces, no national flags.
Crisp pixel-art texture: each logical pixel is an 8 by 8 square of one solid color, yielding a 32 by 32 readable icon in each cell at game scale. Dark charcoal #18242d and graphite #354553 plates, thin ivory or copper inset framing, bold luminous cyan #67eaff, warm amber #f4b65d, coral #ef8062 and occasional ivory #ede3bf symbols. Keep diverse colors across the grid: roughly six cyan panels, four amber, four coral, two ivory. Bright symbols are broad and legible. At least 50 percent of each panel remains dark plate. The panel edge itself stays dark so the atlas crops cleanly. Metallic fasteners may occupy the corners sparingly.
Flat opaque texture, no alpha. No transparent area, no lighting gradient, no soft anti-aliasing, no glow, bloom or halo outside the symbol pixels. No magenta, purple or pink, no cast shadows, no illustrated buildings, windows, street, city panorama or equipment outside the plates. Consistent dark industrial electronics finish, not a concept-art contact sheet.
```

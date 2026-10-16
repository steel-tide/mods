# Ironworks — how its sheets were painted

The three original sheets follow the game's own sprite contract: a hull as one up-facing image
(the pod is part of the hull, so there is no turret), a building as one
top-down frame filling its 2×2-tile footprint, and the gun that turns on it. Painted with the game's
generator through the Vercel AI Gateway, `openai/gpt-image-2` at high quality:

```sh
pnpm -C game sprites:gen --doc ../steel-tide-mods/mods/ironworks/PROMPTS.md --out ../steel-tide-mods/mods/ironworks/sprites u.ironworks-hover u.ironworks-bunker tur.ironworks-bunker
```

The Fusion Plant extends `power3` and keeps its art.

#### Skimmer hover tank — `u.ironworks-hover.png`

```text
Pixel-art sprite for a 2D real-time strategy game, PNG with fully transparent background, ONE single static image exactly 220×260 pixels. No animation frames, no strip, no border, no label, and no background of any kind.

Subject: a fast military hover tank seen from directly above, facing straight up toward the top edge and centered in the image. A low, wide, wedge-shaped hull on an inflated hover skirt that bulges out along both flanks, a small tinted cockpit canopy set into the hull, two fixed rocket-pod launchers mounted flat on the front deck pointing straight up, and two round thruster nozzles at the rear. It has no turret and no mounting ring — every weapon is fixed to the hull. Keep the silhouette solid and readable.

Style: crisp pixel art on a strict pixel grid, hard edges, no anti-aliasing halos, no blur, no glow; muted military grays (#696a6a #847e87 #9badb7 #595652 #323c39) with dark #222034 silhouette outlines, canopy glass #5fcde4.

Faction markers: one broad band across the hull behind the canopy and the rims of the two rear nozzles in pure magenta only — highlight #FF66FF, base #FF00FF, shadow #990099. Magenta appears nowhere else.

Isolation rule: no ground, no cast shadow, no dust, no terrain. The engine draws the shadow itself.
```

```json
{ "key": "u.ironworks-hover", "file": "sprites/u.ironworks-hover.png", "frames": 1, "rotated": true, "fw": 24, "fh": 26 }
```

#### Bunker — body — `u.ironworks-bunker.png`

The building is two sheets, like a vanilla turret pad: the pit with an empty
mounting ring, and the gun that turns on it. `mount` on the body sheet says
where the ring sits, as fractions of the frame.

```text
Pixel-art sprite for a 2D real-time strategy game, a PNG with an alpha channel: every pixel that is not part of the bunker is fully transparent (alpha 0). ONE static image exactly 256×256 pixels. No animation frames, no strip, no borders, no labels. Do not paint a floor, a backdrop, a gradient, a vignette or a sky behind it — the sprite is composited onto the game's own terrain.

Subject: a squat reinforced concrete bunker — a sunken circular gun pit ringed by a thick raised concrete wall, with one EMPTY dark circular mounting ring exactly at the image center where a gun mount will sit. Draw no gun, no barrel, no turret and no weapon of any kind — the gun is a separate rotating sprite. Sandbag stacks at the four corners of a square concrete pad, and a short antenna mast on the north side. Favor large clean shapes over tiny greebles — bold and readable, not busy.

Camera: top-down RTS view with a slight southern tilt — the pit and pad top dominant, a narrow south-facing wall edge visible along the bottom. Sunlight from the top-left, shadows only inside the sprite.

Ground rule: the square concrete pad fills the whole 256×256 image edge to edge; nothing extends outside it. The empty mounting ring is centered at exactly 50% of the width and 50% of the height. No ground plane, no floor tiles, no cast shadow, no terrain.

Style: crisp pixel art, hard edges, no anti-aliasing halos, no blur, no glow; muted military grays (#696a6a #847e87 #9badb7 #595652 #323c39, outline #222034), sandbags in muted khaki.

Faction markers: a banner panel on the north wall and a stripe along the south wall in pure magenta only — highlight #FF66FF, base #FF00FF, shadow #990099. Magenta appears nowhere else.
```

```json
{ "key": "u.ironworks-bunker", "file": "sprites/u.ironworks-bunker.png", "frames": 1, "mount": [0.5, 0.545] }
```

#### Bunker — gun — `tur.ironworks-bunker.png`

```text
Pixel-art sprite for a 2D real-time strategy game, PNG with fully transparent background, ONE single static image exactly 160×260 pixels. No animation frames, no strip, no border, no label, and no background of any kind.

Subject: a heavy twin-barrel autocannon mount seen from directly above, facing straight up toward the top edge and centered horizontally: a compact armored gun cradle with two long parallel barrels extending straight upward, an ammunition box on one side and a small gunner's shield at the rear. The mount's rotation-ring center sits on the vertical centerline at exactly 62% of the image height from the top; the barrels extend upward from it with no perspective bend. Keep it bold and readable.

Style: crisp pixel art on a strict pixel grid, hard edges, no anti-aliasing halos, no blur, no glow; muted military grays (#696a6a #847e87 #9badb7 #595652 #323c39) with dark #222034 silhouette outlines.

Faction markers: the ammunition box lid in pure magenta only — highlight #FF66FF, base #FF00FF, shadow #990099. Magenta appears nowhere else.

Isolation rule: no ground, no cast shadow, no pit, no muzzle flash, no base plate. This part rotates in-engine on top of the separate bunker body. Keep the ring center fixed at 62% image height.
```

```json
{ "key": "tur.ironworks-bunker", "file": "sprites/tur.ironworks-bunker.png", "frames": 1, "rotated": true, "fw": 26, "fh": 42, "pivotY": 0.66 }
```

## Orca asset provenance

Added in 1.2.0 from Steel Tide's current Orca masters, without repainting:
`game/core/art/sprites/u.destroyer.png` and `tur.destroyer.png` become
`sprites/u.ironworks-orca.png` and `sprites/tur.ironworks-orca.png`.

The vanilla ship draws at 2.34375×; mod units draw at 1.5625×. The mod's
frame dimensions are therefore 1.5× the original (hull 30×72, turret 15×27),
and the gun ring is at y = −12.75 art pixels. With supersampling at 4 instead
of 6, both copies bake the same number of pixels and retain the same world
size. The turret pivot remains 0.6 and its muzzle offset remains 25.3125
world pixels. Torpedoes explicitly use the hull rather than the rotating
gun, because mod weapons otherwise default to the available turret.

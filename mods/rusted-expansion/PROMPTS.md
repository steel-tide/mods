# Rusted Expansion — how its sheets and sounds are made

Everything the mod draws and plays is generated with the game's own pipeline
(`game/core/docs/ASSETS-GENERATION.md`): the sheets by `sprites:gen` through
the Vercel AI Gateway, the sounds by `sfx:gen` through ElevenLabs. Nothing of
Rusted Warfare's ships with the mod. What carries over is the *look*: each
sheet's prompt names one frame of the corresponding Rusted Warfare sprite,
blown up pixel for pixel, on its `refs:` line, and asks the model for an
original, more detailed interpretation that keeps the silhouette, the
proportions, the layout of features and the places the faction colour sits —
not a copy. The reference frames are cut from the game's package by
`import-rw.py --refs` into `rusted-warfare/refs/` (git-ignored, beside the
unzipped package) and are not part of the mod. The sounds are prompted from
measurements of the originals (their length, brightness and envelope), which
is the only thing that can be carried into a sound generator.

From the registry root, with the game beside it:

```sh
MOD=$PWD/mods/rusted-expansion
pnpm -C ../steel-tide/game/core sprites:gen --doc $MOD/PROMPTS.md --out $MOD/sprites --missing
pnpm -C ../steel-tide/game/core sfx:gen --doc $MOD/PROMPTS.md --out $MOD/sfx --all
pnpm -C ../steel-tide/game/core sfx --src $MOD/sfx --out $MOD/sounds
python3 $MOD/measure-masters.py
```

(`sfx/` holds the raw takes and is git-ignored; `sounds/` is the cut the mod
ships. The generators resolve a relative `--doc` against `game/core`, so the
paths above are absolute.)

The masters land at the model's own aspect ratio, and the loader stretches a
sheet to its `fw`×`fh`, so every entry asks for a size on the model's ratio
list and the manifest keeps that ratio: hulls 9:16 or 2:3, the bomber 1:1,
the battleship 1:3, and every turret 1:2, asked for with its ring at 60% of
the height. Sizes are whole pixels: a fractional `fw` made the loader's
resampler run past the row and the hull came out a streaked ghost. Where the
ring and the barrels actually landed is measured off the finished masters by
`measure-masters.py --apply` (`pivotY`, `mount`, `muzzleOffset`,
`boreSpacing`), not guessed.

## Sheets

Shared rules, in every prompt: crisp pixel art on a strict grid, a transparent
background, the game's greys and its dark outline, faction colour as pure
magenta where Rusted Warfare painted green, nothing else magenta, no ground,
no shadow, no text.

#### Tank — hull — `u.rusted-tank.png`

refs: ../../../steel-tide-mods/rusted-warfare/refs/tank-hull.png

```text
Pixel-art sprite for a 2D real-time strategy game, PNG with fully transparent background, ONE single static image exactly 576×1024 pixels. No animation frames, no strip, no border, no label, no text, and no background of any kind.

Reference: the attached picture is a tiny classic mobile-RTS tank hull blown up pixel for pixel. Keep its silhouette, its proportions, the layout of its features and the places its green panels sit, but paint an ORIGINAL, more detailed interpretation for this game — do not trace or copy it.

Subject: a small, plain, boxy medium tank HULL WITHOUT ITS TURRET, seen from directly above, facing straight up toward the top edge and centered in the image, filling the height. A narrow rectangular hull between two full-length tracks with visible tread links, a flat front glacis with a small driver's hatch, a raised engine deck at the rear with a grille, and one empty dark circular turret mounting ring exactly at the image center. Do not draw a turret, gun, or barrel.

Style: crisp pixel art on a strict pixel grid, hard edges, no anti-aliasing halos, no blur, no glow; cool blue-tinted military steel from this palette: #9badb7 #847e87 #696a6a #595652 #323c39, with dark #222034 silhouette outlines.

Faction markers: where the reference is green — the two rear deck panels, one behind each track — paint pure magenta only: highlight #FF66FF, base #FF00FF, shadow #990099. Magenta appears nowhere else.

Isolation rule: no ground, no cast shadow, no terrain, no track marks. The engine draws the shadow itself and composites the turret onto the center ring.
```

```json
{"key": "u.rusted-tank", "file": "sprites/u.rusted-tank.png", "frames": 1, "rotated": true, "fw": 10, "fh": 18, "mount": [0.499, 0.441]}
```

#### Tank — turret — `tur.rusted-tank.png`

refs: ../../../steel-tide-mods/rusted-warfare/refs/tank-turret.png

```text
Pixel-art sprite for a 2D real-time strategy game, PNG with fully transparent background, ONE single static image exactly 512×1024 pixels. No animation frames, no strip, no border, no label, no text, and no background of any kind.

Reference: the attached picture is a tiny classic mobile-RTS tank turret blown up pixel for pixel: a small round dome with one long thin barrel. Keep that character — small dome, long thin gun — but paint an ORIGINAL, more detailed interpretation for this game; do not trace or copy it.

Subject: a small round tank turret seen from directly above, facing straight up toward the top edge and centered horizontally: a compact domed turret body with a closed hatch and a single long, thin cannon barrel with a small muzzle extending straight up to the top edge of the image. The turret's mounting-ring center sits on the vertical centerline at exactly 60% of the image height from the top; the barrel extends upward from it with no perspective bend, and the body reaches no lower than 80% of the height. Leave the sides transparent — the turret is narrow.

Style: crisp pixel art on a strict pixel grid, hard edges, no anti-aliasing halos, no blur, no glow; cool blue-tinted military steel from this palette: #9badb7 #847e87 #696a6a #595652 #323c39, with dark #222034 silhouette outlines. No magenta on this part.

Isolation rule: no ground, no cast shadow, no hull, no muzzle flash, no base plate. This part rotates in-engine on top of the separate tank hull. Keep the mounting-ring center fixed at 60% image height.
```

```json
{"key": "tur.rusted-tank", "file": "sprites/tur.rusted-tank.png", "frames": 1, "rotated": true, "fw": 13, "fh": 26, "pivotY": 0.728}
```

#### Heavy Tank — hull — `u.rusted-heavy-tank.png`

refs: ../../../steel-tide-mods/rusted-warfare/refs/heavy-tank-hull.png

```text
Pixel-art sprite for a 2D real-time strategy game, PNG with fully transparent background, ONE single static image exactly 640×960 pixels. No animation frames, no strip, no border, no label, no text, and no background of any kind.

Reference: the attached picture is a tiny classic mobile-RTS heavy tank hull blown up pixel for pixel. Keep its silhouette, its proportions, the layout of its features and the places its green blocks sit, but paint an ORIGINAL, more detailed interpretation for this game — do not trace or copy it.

Subject: a wide, slab-sided heavy tank HULL WITHOUT ITS TURRET, seen from directly above, facing straight up toward the top edge and centered in the image, filling the height. Two very wide full-length tracks with heavy tread links, a thick flat glacis with bolted armor plates and a notch at the front center, a broad flat deck, twin exhaust stacks at the rear corners, and one empty dark circular turret mounting ring exactly at the image center. Do not draw a turret, gun, missile or barrel.

Style: crisp pixel art on a strict pixel grid, hard edges, no anti-aliasing halos, no blur, no glow; cool blue-tinted military steel from this palette: #9badb7 #847e87 #696a6a #595652 #323c39, with dark #222034 silhouette outlines.

Faction markers: where the reference is green — one armor block on the outer edge of each track guard near the front and one near the rear, four in all — paint pure magenta only: highlight #FF66FF, base #FF00FF, shadow #990099. Magenta appears nowhere else.

Isolation rule: no ground, no cast shadow, no terrain, no track marks. The engine draws the shadow itself and composites the turret onto the center ring.
```

```json
{"key": "u.rusted-heavy-tank", "file": "sprites/u.rusted-heavy-tank.png", "frames": 1, "rotated": true, "fw": 18, "fh": 27, "mount": [0.499, 0.498]}
```

#### Heavy Tank — turret — `tur.rusted-heavy-tank.png`

refs: ../../../steel-tide-mods/rusted-warfare/refs/heavy-tank-turret.png

```text
Pixel-art sprite for a 2D real-time strategy game, PNG with fully transparent background, ONE single static image exactly 512×1024 pixels. No animation frames, no strip, no border, no label, no text, and no background of any kind.

Reference: the attached picture is a tiny classic mobile-RTS heavy tank turret blown up pixel for pixel: a round body, two long parallel barrels, and a small red missile pod on each rear corner. Keep that character but paint an ORIGINAL, more detailed interpretation for this game; do not trace or copy it.

Subject: a heavy tank turret seen from directly above, facing straight up toward the top edge and centered horizontally: a broad rounded armored turret body with a closed hatch, two long parallel cannon barrels close together extending straight up to the top edge of the image, and one small boxy anti-air missile pod on each rear corner of the body, painted red (#ac3232 with a #d95763 highlight), each holding a pair of small missile tips pointing up. The turret's mounting-ring center sits on the vertical centerline at exactly 60% of the image height from the top; the barrels extend upward from it with no perspective bend, and the body reaches no lower than 82% of the height.

Style: crisp pixel art on a strict pixel grid, hard edges, no anti-aliasing halos, no blur, no glow; cool blue-tinted military steel from this palette: #9badb7 #847e87 #696a6a #595652 #323c39, with dark #222034 silhouette outlines. Red only on the two missile pods; no magenta on this part.

Isolation rule: no ground, no cast shadow, no hull, no muzzle flash, no base plate. This part rotates in-engine on top of the separate tank hull. Keep the mounting-ring center fixed at 60% image height.
```

```json
{"key": "tur.rusted-heavy-tank", "file": "sprites/tur.rusted-heavy-tank.png", "frames": 1, "rotated": true, "fw": 17, "fh": 34, "pivotY": 0.735}
```

#### Helicopter — `u.rusted-helicopter.png`

refs: ../../../steel-tide-mods/rusted-warfare/refs/helicopter.png

```text
Pixel-art sprite for a 2D real-time strategy game, PNG with fully transparent background, ONE single static image exactly 576×1024 pixels. No animation frames, no strip, no border, no label, no text, and no background of any kind.

Reference: the attached picture is a tiny classic mobile-RTS attack helicopter blown up pixel for pixel, drawn without its rotor. Keep its silhouette, its proportions, the layout of its features and the place its green band sits, but paint an ORIGINAL, more detailed interpretation for this game — do not trace or copy it.

Subject: a stubby attack helicopter seen from directly above, facing straight up toward the top edge and centered in the image, filling the height: a rounded bulbous nose with a dark tinted canopy, a short thick fuselage with the rotor hub (a small dark disc, NO blades) at the exact image center, a short stub wing on each side carrying one small gun pod, a slim tail boom running straight down to a small T-tail with a tiny tail rotor. Do not draw the main rotor blades — the engine spins them itself.

Style: crisp pixel art on a strict pixel grid, hard edges, no anti-aliasing halos, no blur, no glow; olive-grey airframe from this palette: #847e87 #696a6a #595652 #4b692f #323c39, canopy glass #5fcde4 shaded #306082, with dark #222034 silhouette outlines.

Faction markers: where the reference is green — one broad band across the fuselage just behind the rotor hub — paint pure magenta only: highlight #FF66FF, base #FF00FF, shadow #990099. Magenta appears nowhere else.

Isolation rule: no ground, no cast shadow, no motion blur, no rotor disc, no terrain. The engine draws the shadow and the spinning rotor itself.
```

```json
{"key": "u.rusted-helicopter", "file": "sprites/u.rusted-helicopter.png", "frames": 1, "rotated": true, "fw": 16, "fh": 28}
```

#### Bomber — `u.rusted-bomber.png`

refs: ../../../steel-tide-mods/rusted-warfare/refs/bomber.png

```text
Pixel-art sprite for a 2D real-time strategy game, PNG with fully transparent background, ONE single static image exactly 1024×1024 pixels. No animation frames, no strip, no border, no label, no text, and no background of any kind.

Reference: the attached picture is a tiny classic mobile-RTS jet bomber blown up pixel for pixel. Keep its silhouette, its proportions, the layout of its features and the places its green markings sit, but paint an ORIGINAL, more detailed interpretation for this game — do not trace or copy it.

Subject: a heavy twin-engine jet bomber seen from directly above, facing straight up toward the top edge and centered in the image, filling it: a long fuselage with a pointed nose and a dark canopy, broad swept wings with one thick engine nacelle under each wing and a small pod at each wing tip, a swept tailplane with a single tall fin seen end-on, and a row of closed bomb-bay doors along the belly centerline. Big flat panels with panel lines, bold and readable.

Style: crisp pixel art on a strict pixel grid, hard edges, no anti-aliasing halos, no blur, no glow; olive-grey airframe from this palette: #847e87 #696a6a #595652 #4b692f #323c39, canopy glass #5fcde4 shaded #306082, with dark #222034 silhouette outlines.

Faction markers: where the reference is green — one broad band across the fuselage between the wings, the wing-tip pods and the tips of the tailplane — paint pure magenta only: highlight #FF66FF, base #FF00FF, shadow #990099. Magenta appears nowhere else.

Isolation rule: no ground, no cast shadow, no contrails, no terrain. The engine draws the shadow itself.
```

```json
{"key": "u.rusted-bomber", "file": "sprites/u.rusted-bomber.png", "frames": 1, "rotated": true, "fw": 37, "fh": 37}
```

#### Gun Boat — hull — `u.rusted-gun-boat.png`

refs: ../../../steel-tide-mods/rusted-warfare/refs/gun-boat-hull.png

```text
Pixel-art sprite for a 2D real-time strategy game, PNG with fully transparent background, ONE single static image exactly 576×1024 pixels. No animation frames, no strip, no border, no label, no text, and no background of any kind.

Reference: the attached picture is a tiny classic mobile-RTS gun boat hull blown up pixel for pixel. Keep its silhouette, its proportions, the layout of its features and the places its green bands sit, but paint an ORIGINAL, more detailed interpretation for this game — do not trace or copy it.

Subject: a small fast patrol gun boat HULL WITHOUT ITS GUN, seen from directly above, bow pointing straight up toward the top edge and centered in the image, filling the height: a teardrop hull with a sharp bow and a rounded stern, a low raised deckhouse aft of the middle, a small dark engine hatch at the stern, and one empty dark circular mounting ring exactly at the image center where the gun will sit. Do not draw a gun or barrel.

Style: crisp pixel art on a strict pixel grid, hard edges, no anti-aliasing halos, no blur, no glow; light naval grey from this palette: #cbdbfc #9badb7 #847e87 #696a6a #595652 #323c39, with dark #222034 silhouette outlines.

Faction markers: where the reference is green — a chevron at the bow tip and one band across the deck just aft of the mounting ring — paint pure magenta only: highlight #FF66FF, base #FF00FF, shadow #990099. Magenta appears nowhere else.

Isolation rule: no water, no wake, no cast shadow, no terrain. The engine draws the wake and composites the gun onto the ring.
```

```json
{"key": "u.rusted-gun-boat", "file": "sprites/u.rusted-gun-boat.png", "frames": 1, "rotated": true, "fw": 12, "fh": 21, "mount": [0.499, 0.479]}
```

#### Gun Boat — gun — `tur.rusted-gun-boat.png`

refs: ../../../steel-tide-mods/rusted-warfare/refs/gun-boat-turret.png

```text
Pixel-art sprite for a 2D real-time strategy game, PNG with fully transparent background, ONE single static image exactly 512×1024 pixels. No animation frames, no strip, no border, no label, no text, and no background of any kind.

Reference: the attached picture is a tiny classic mobile-RTS deck gun blown up pixel for pixel: a round pedestal with a small shield and one long thin barrel. Keep that character but paint an ORIGINAL, more detailed interpretation for this game; do not trace or copy it.

Subject: a small naval deck gun seen from directly above, facing straight up toward the top edge and centered horizontally: a round pedestal mount with a small flat gun shield in front and one long thin barrel extending straight up to the top edge of the image. The mount's rotation-ring center sits on the vertical centerline at exactly 60% of the image height from the top; the barrel extends upward from it with no perspective bend, and the mount reaches no lower than 78% of the height. Leave the sides transparent — the gun is narrow.

Style: crisp pixel art on a strict pixel grid, hard edges, no anti-aliasing halos, no blur, no glow; light naval grey from this palette: #cbdbfc #9badb7 #847e87 #696a6a #595652 #323c39, with dark #222034 silhouette outlines. No magenta on this part.

Isolation rule: no deck, no water, no cast shadow, no muzzle flash. This part rotates in-engine on top of the separate hull. Keep the ring center fixed at 60% image height.
```

```json
{"key": "tur.rusted-gun-boat", "file": "sprites/tur.rusted-gun-boat.png", "frames": 1, "rotated": true, "fw": 10, "fh": 20, "pivotY": 0.664}
```

#### Battle Ship — hull — `u.rusted-battle-ship.png`

refs: ../../../steel-tide-mods/rusted-warfare/refs/battle-ship-hull.png

```text
Pixel-art sprite for a 2D real-time strategy game, PNG with fully transparent background, ONE single static image exactly 352×1056 pixels. No animation frames, no strip, no border, no label, no text, and no background of any kind.

Reference: the attached picture is a tiny classic mobile-RTS battleship hull blown up pixel for pixel. Keep its silhouette, its proportions, the layout of its features and the place its green ring sits, but paint an ORIGINAL, more detailed interpretation for this game — do not trace or copy it.

Subject: a long, narrow, dark-hulled battleship HULL WITHOUT ITS TURRET, seen from directly above, bow pointing straight up toward the top edge and centered in the image, filling the height: a sharp raked bow, a long raised forecastle deck with a breakwater running back from the bow, one empty dark circular mounting ring exactly at the image center ringed by a raised barbette, a blocky bridge superstructure and one squat funnel standing astern of the ring, a low quarterdeck with two small hatches, and a squared transom stern. Do not draw a turret, gun or barrel.

Style: crisp pixel art on a strict pixel grid, hard edges, no anti-aliasing halos, no blur, no glow; dark blue-grey naval steel from this palette: #847e87 #696a6a #595652 #45283c #323c39 #222034, with dark #222034 silhouette outlines.

Faction markers: where the reference is green — the raised barbette ring around the mounting ring and a thin stripe along each side of the quarterdeck — paint pure magenta only: highlight #FF66FF, base #FF00FF, shadow #990099. Magenta appears nowhere else.

Isolation rule: no water, no wake, no cast shadow, no terrain. The engine draws the wake and composites the turret onto the ring.
```

```json
{"key": "u.rusted-battle-ship", "file": "sprites/u.rusted-battle-ship.png", "frames": 1, "rotated": true, "fw": 17, "fh": 51, "mount": [0.5, 0.559]}
```

#### Battle Ship — turret — `tur.rusted-battle-ship.png`

refs: ../../../steel-tide-mods/rusted-warfare/refs/battle-ship-turret.png

```text
Pixel-art sprite for a 2D real-time strategy game, PNG with fully transparent background, ONE single static image exactly 512×1024 pixels. No animation frames, no strip, no border, no label, no text, and no background of any kind.

Reference: the attached picture is a tiny classic mobile-RTS battleship turret blown up pixel for pixel: a squat rounded gunhouse with two very long parallel barrels. Keep that character but paint an ORIGINAL, more detailed interpretation for this game; do not trace or copy it.

Subject: a naval gun turret seen from directly above, facing straight up toward the top edge and centered horizontally: a squat rounded armored gunhouse with a rangefinder bump on its roof and two very long parallel gun barrels, set apart, extending straight up to the top edge of the image. The turret's rotation-ring center sits on the vertical centerline at exactly 60% of the image height from the top; the barrels extend upward from it with no perspective bend, and the gunhouse reaches no lower than 80% of the height.

Style: crisp pixel art on a strict pixel grid, hard edges, no anti-aliasing halos, no blur, no glow; dark blue-grey naval steel from this palette: #847e87 #696a6a #595652 #45283c #323c39 #222034, with dark #222034 silhouette outlines. No magenta on this part.

Isolation rule: no deck, no water, no cast shadow, no muzzle flash. This part rotates in-engine on top of the separate hull. Keep the ring center fixed at 60% image height.
```

```json
{"key": "tur.rusted-battle-ship", "file": "sprites/tur.rusted-battle-ship.png", "frames": 1, "rotated": true, "fw": 13, "fh": 26, "pivotY": 0.484}
```

## Sounds

Prompted from measurements of Rusted Warfare's recordings — the tank's shot
is a deep bass thud with almost nothing above 400 Hz, the heavy and naval
guns bright cracks around 1.4 kHz, the gun boat's a thin snap near 2 kHz, the
missile a mid hiss — in the game's own one-shot format (`SFX-PROMPTS.md`).
Every slot is a `rusted-expansion-` key the weapons name. Two takes each; the
cut keeps the better one.

### `rusted-expansion-tank-gun` — 0.8 s · influence 0.7 · keep 2

```text
Single cannon shot from a small light tank: a deep, dull, bass-heavy thud with a soft mid-range knock and almost no high-frequency crack, muffled and round, a short damped tail, dry and close-miked, no echo, no music. One-shot military game weapon sound.
```

### `rusted-expansion-heavy-gun` — 1 s · influence 0.7 · keep 2

```text
Single heavy tank cannon shot: a hard bright crack with a deep chesty boom right behind it, tight and punchy, a brief metallic ring of the breech, decays within a second, dry and close-miked, no long echo, no music. One-shot military game weapon sound.
```

### `rusted-expansion-heavy-missile` — 1 s · influence 0.6 · keep 2

```text
Small anti-aircraft missile leaving a tank-mounted pod: a quick ignition snap, then a mid-pitched hissing rocket-motor whoosh that climbs away and fades within a second, dry and close, no explosion at the end, no music. One-shot military game weapon sound.
```

### `rusted-expansion-heli-gun` — 0.5 s · influence 0.7 · keep 2

```text
Single shot from a helicopter's nose-mounted machine gun: a short, bright, snappy crack with a faint hollow knock behind it, dry and close-miked, starts instantly, no echo, no tail, no music. One-shot military game weapon sound.
```

### `rusted-expansion-boat-gun` — 0.5 s · influence 0.7 · keep 2

```text
Single shot from a small patrol boat's light deck gun: a crisp, high, snappy gunshot crack with a thin metallic ping, quick decay, dry and close-miked, no echo, no music. One-shot military game weapon sound.
```

### `rusted-expansion-ship-gun` — 1.2 s · influence 0.7 · keep 2

```text
Single battleship turret gun firing: a bright, sharp report with a heavy low boom underneath and a short rolling decay, dry and close-miked, no distant echo tail, no music. One-shot naval military game weapon sound.
```

## Registry cover

The first gallery image, `screenshots/cover.jpg`, is promotional artwork
created with the built-in image generation tool from this mod's own art.
The remaining gallery images are gameplay captures. Delivered as a
1600 × 1200 JPEG under the registry's 2 MB limit.

### Initial composition prompt

```text
Use case: ads-marketing.
Asset type: 4:3 landscape registry cover for the Steel Tide mod "Rusted Expansion", ideally 1600x1200.
Primary request: Recompose the supplied mod's land and naval screenshots (images 1 and 2) and bomber sprite (image 3) into an exuberant nostalgic pixel-art RTS title screen / game-box cover. Preserve the recognizable original unit shapes while developing a single coherent hand-crafted pixel-art illustration. The fourth image is the heavy tank's twin-barrel turret with red missile racks for shape accuracy.
Design direction: affectionate classic PC/mobile real-time strategy nostalgia. Crisp richly detailed pixel art, visible intentional pixel clusters, hard outlined silhouettes, saturated grass green and bright blue water, warm ochre sand and tiny orange shell bursts. It should feel like the army the player remembers commanding. Daylight, spirited and colorful, not gloomy modern military key art.
Composition: an overhead/slightly tilted pixel-art coastal battlefield curving in a broad diagonal, land and tanks at bottom left, blue sea and two ships to the right, bomber and stubby helicopter crossing the scene. A chunky heavy tank with two parallel barrels and red missile racks is the lower-left foreground hero, with a couple of smaller boxy single-gun tanks behind it. Long dark narrow battleship with one big twin turret amidships, plus small teardrop gunboat on the sea. Include the reference's swept-wing bomber, its dark steel fuselage and blue cockpit. Change the source blue/magenta faction panels on our army to saturated classic bright green. Preserve the heavy tank's red missile racks as red. Ground vehicles must have clear tank tracks, aircraft have wings or rotors, ships have wakes. No modern real-world replacements, people, flags, or extra unit types.
Title: in the upper LEFT within a calm area of terrain/sky-like pale mist, two compact lines reading exactly "RUSTED" then "EXPANSION", both prominent and readable. Use original chunky beveled PIXEL lettering: rusty copper/orange faces with cream highlight pixels, dark brown extruded edge, playful old RTS character. The title block occupies about 45% of image width and 28% of height, not a full-width header. Keep action composed around it. Tiny clean text "A STEEL TIDE MOD" in the lower right over the sea.
No photo-realism, no distressed white UCGR stencil lettering, no modern tactical grids, no corner framing, no sepia grading, no centered title over a dark screenshot, no panelled engineering layout. This is a single colorful pixel-art scene with an integrated vintage pixel logo. Avoid blurry or airbrushed texture. No other text or watermark. Full bleed 4:3 opaque landscape canvas.
```

### Final refinement prompt

```text
Use case: lighting-weather. Edit the provided finished RUSTED EXPANSION cover. The user says it is too vivid and does not match a war game's mood. Transform it into a sober, gritty, battle-worn pixel-art war-game cover. Preserve the existing distinctive composition, perspective, readable title and all six recognizable unit TYPES: heavy twin-barrel tank with red missile racks, smaller single-gun tanks, helicopter, swept-wing bomber, long twin-turret-barrel battleship, gunboat. Preserve crisp pixel clusters and the exact text "RUSTED EXPANSION" and "A STEEL TIDE MOD".
PALETTE AND MOOD: substantially desaturate the whole image to muted olive drab, charcoal, cold gunmetal, weathered earth and slate-blue sea. Change sunny daylight to overcast combat weather with gray low cloud and drifting dense charcoal smoke. Change bright tropical cyan surf to dark cold slate-blue water with dirty gray-white small wakes. Change jewel-green foliage to worn olive and gray-green scrub, add visible scorched earth and brown track ruts. Vehicles should look like heavy dark steel, with restrained dull olive-green faction markings instead of neon green.
TITLE: retain the exact lettering shape and placement, but replace the bright arcade orange with weathered dark oxidized iron and dark brown rust, a muted light steel highlight along letter faces/edges, strong dark depth. Keep the words readable against their backing. No glowing gold or saturated orange.
COMBAT EFFECTS: remove most of the repetitive bright yellow tracer lines, bright fiery explosions, and the big fire blossoms at every muzzle. Keep just one or two small realistic restrained amber muzzle flashes and distant smoldering fires; use smoke and worn terrain to suggest battle fatigue and weight. The bomber should fly through low smoke, not spray arcade bullets from its wings. No vivid confetti-like bright particles.
This should feel like grounded classic military RTS box art, not a cheerful arcade/action toy game. Keep adequate tonal separation and visual legibility; don't simply crush every shadow to black. Do not adopt the UCGR military stencil/grid template. Keep this composition and pixel-art treatment, but make its atmosphere somber and martial. No new labels, flags, emblems, panel borders or text. Preserve full-bleed 4:3 landscape canvas, opaque background.
```

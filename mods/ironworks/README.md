# Ironworks

Additional armor, naval firepower, fortifications and power generation:

- **Skimmer Hover Tank** — a fresh unit (no `extends`), drawn from
  `sprites/u.ironworks-hover.png`: one up-facing image the game bakes into
  24 headings. The rocket pods are part of the hull, so there is no turret;
  they fire with the mod's own recording, `sfx/ironworks-pods.mp3`.
- **Orca Destroyer** — a naval gun, sonar and anti-submarine torpedoes,
  built at level-two and level-three naval yards. The mod owns its definition
  (`ironworks-orca`) and hull/turret sheets. The original vanilla `destroyer`
  stays available to existing saves and scenarios, hidden from build menus.
- **Bunker** — a turreted building, two sheets like a tank: the pit
  (`sprites/u.ironworks-bunker.png`, with `mount` saying where its ring
  sits) and the twin autocannon that turns on it
  (`sprites/tur.ironworks-bunker.png`). Its gun carries `"turret": true` and
  its own sound. Placed by the engineer, sized to its 2×2 footprint.
- **Fusion Plant** — a fourth level for the power plant line: `power3` gains
  an Upgrade button that turns it into this def. It keeps the plant's art.

The faction colour in every sheet is magenta; the game recolours it per
player. `PROMPTS.md` is how the sheets were painted and `SFX-PROMPTS.md` how
the sounds were recorded.

const MAX_PLAYERS = 8;
const MIN_MAP_SIDE = 16;
const MAX_MAP_SIDE = 512;
var Terrain = /* @__PURE__ */ ((Terrain2) => {
  Terrain2[Terrain2["DeepWater"] = 0] = "DeepWater";
  Terrain2[Terrain2["Water"] = 1] = "Water";
  Terrain2[Terrain2["Sand"] = 2] = "Sand";
  Terrain2[Terrain2["Grass"] = 3] = "Grass";
  Terrain2[Terrain2["Forest"] = 4] = "Forest";
  Terrain2[Terrain2["Mountain"] = 5] = "Mountain";
  Terrain2[Terrain2["Road"] = 6] = "Road";
  Terrain2[Terrain2["Mud"] = 7] = "Mud";
  Terrain2[Terrain2["Marsh"] = 8] = "Marsh";
  Terrain2[Terrain2["Snow"] = 9] = "Snow";
  Terrain2[Terrain2["Rubble"] = 10] = "Rubble";
  Terrain2[Terrain2["Lava"] = 11] = "Lava";
  Terrain2[Terrain2["CliffNorth"] = 12] = "CliffNorth";
  Terrain2[Terrain2["CliffEast"] = 13] = "CliffEast";
  Terrain2[Terrain2["CliffSouth"] = 14] = "CliffSouth";
  Terrain2[Terrain2["CliffWest"] = 15] = "CliffWest";
  Terrain2[Terrain2["City"] = 16] = "City";
  Terrain2[Terrain2["Shallows"] = 17] = "Shallows";
  Terrain2[Terrain2["Ice"] = 18] = "Ice";
  Terrain2[Terrain2["Bridge"] = 19] = "Bridge";
  return Terrain2;
})(Terrain || {});
const TERRAIN_KINDS = 20;
({
  /** open pasture — the generator's old, and still most common, ground */
  meadow: { ground: Terrain.Grass, shore: Terrain.Sand, hollow: Terrain.Mud, height: Terrain.Mountain },
  /** conifer country: the same ground under a much lower treeline */
  boreal: { ground: Terrain.Grass, shore: Terrain.Sand, hollow: Terrain.Mud, height: Terrain.Mountain },
  /** frozen open ground, snow all the way to the water — no beaches this far north */
  tundra: { ground: Terrain.Snow, shore: Terrain.Snow, hollow: Terrain.Mud, height: Terrain.Mountain },
  /** sand from the waterline to the ridges, and nothing growing on it but the palms at an oasis */
  dunes: { ground: Terrain.Sand, shore: Terrain.Sand, hollow: Terrain.Sand, height: Terrain.Mountain },
  /** waterlogged lowland: marsh for a shore and marsh again behind it */
  fen: { ground: Terrain.Grass, shore: Terrain.Marsh, hollow: Terrain.Marsh, height: Terrain.Mountain },
  /** ash flats over old flows, scree at the water and lava in the peaks */
  ashland: { ground: Terrain.Sand, shore: Terrain.Rubble, hollow: Terrain.Rubble, height: Terrain.Lava }
});
const ARMOR_MATRIX = {
  // rapid-fire small arms: shred soft skins, ping off armor plate
  mg: { light: 1.5, medium: 0.8, heavy: 0.4, structure: 0.35, ship: 0.5, air: 0.7 },
  // light autocannons: soft skins and light armor, poor against heavy plate;
  // at a helicopter (`lowFlying`, the only aircraft they reach) a third —
  // the BMP's 30 mm cocks up to 74° for exactly that, and hits it seldom
  autocannon: { light: 1.5, medium: 1, heavy: 0.5, structure: 0.5, ship: 0.7, air: 0.35 },
  // tank guns: built for armored duels, over-penetrate soft targets
  cannon: { light: 0.6, medium: 1.3, heavy: 1, structure: 0.8, ship: 0.9 },
  // shaped-charge guided missiles: heavy armor only, wasted on light vehicles,
  // and a hull is holed rather than broken — 0.75 since 2026-09-27 (it was
  // 1.0, and the Cobra sank whole fleets that could not shoot back): what
  // sinks a ship is the anti-ship missile and the torpedo
  at: { light: 0.4, medium: 1.1, heavy: 1.8, structure: 0.7, ship: 0.75 },
  // high explosive: blast shreds soft targets and buildings, heavy plate shrugs
  he: { light: 1.2, medium: 1, heavy: 0.75, structure: 1.6, ship: 1 },
  // unguided rocket pods: vehicles of any weight, poor against bunkers
  rocket: { light: 1.4, medium: 1.4, heavy: 0.9, structure: 0.7, ship: 0.9 },
  // naval guns: general-purpose bombardment of shore and ship. Dual-purpose
  // mounts (the destroyer's) also fire on aircraft at a little over half;
  // the Aegis's deck gun targets only the surface, with SAMs for the sky.
  navgun: { light: 1, medium: 1, heavy: 0.75, structure: 0.75, ship: 1, air: 0.6 },
  ashm: { ship: 1.6 },
  torpedo: { ship: 1.3, sub: 1.2 },
  aa: { air: 1 }
};
const w = (def) => ({ ...def, mult: { ...ARMOR_MATRIX[def.cls], ...def.mult } });
const BROADSIDE = 150 * Math.PI / 180;
const MG = w({
  id: "mg",
  cls: "mg",
  dmg: 7,
  reload: 0.4,
  range: 3.6,
  projectile: "bullet",
  speed: 500,
  targets: ["ground"],
  turret: true,
  muzzleOffset: 9.5,
  sound: "mg"
});
const ROOF_MG = w({
  id: "roofmg",
  cls: "mg",
  dmg: 9,
  reload: 0.3,
  range: 4.5,
  projectile: "bullet",
  speed: 520,
  targets: ["air"],
  lowOnly: true,
  mult: { air: 0.7, light: 0.7 },
  sound: "mg"
});
const WARHEAD_MOTOR = [
  { sprite: "dec.afterburner", layer: "under", y: 12, scale: 0.6, when: "always" },
  { sprite: "dec.afterburner", layer: "under", y: 12, scale: 0.6, when: "night" }
];
const DEFS = {
  // ================================================================= LAND
  //
  // Every hull carries a `body` — the capsule `separation()` parts units by,
  // measured off the drawn silhouette. Land is mostly a question of *size*
  // rather than shape: a tank is only about 1.6 times as long as it is wide,
  // so its capsule is a short segment inside a much bigger circle than the
  // one it replaced (`radius` was around 60% of the drawn width). Aircraft
  // are the exception and keep their circles: a wing's widest span is across
  // the heading, which is the one shape a capsule along it cannot say, and
  // nothing in the air jams anyway.
  engineer: {
    id: "engineer",
    kind: "unit",
    aliases: ["eng", "builder"],
    domain: "ground",
    tier: 1,
    cost: 150,
    buildTime: 8,
    pop: 1,
    power: -1,
    hp: 200,
    armor: "light",
    detect: 3,
    speed: 70,
    turnRate: 5,
    vision: 7,
    radius: 8,
    weapons: [],
    body: { r: 8, len: 12 },
    builds: ["extractor", "platform", "power", "factory", "factory3", "navyard", "navyard3", "airbase", "airbase3", "mgturret", "cannonturret", "aaturret", "interceptor", "repairtower", "sandbag", "landmine", "warlab", "radar", "veil", "reactor", "nukesilo", "hq"],
    buildRate: 30,
    trail: "tread",
    sprite: "u.engineer"
  },
  buggy: {
    id: "buggy",
    kind: "unit",
    aliases: ["recon", "jeep"],
    domain: "ground",
    tier: 1,
    ability: "sprint",
    cost: 60,
    buildTime: 5,
    pop: 1,
    power: -1,
    hp: 150,
    armor: "light",
    detect: 4,
    speed: 120,
    turnRate: 6,
    vision: 10,
    radius: 7,
    body: { r: 10, len: 10 },
    weapons: [{ ...MG, sound: "mg" }],
    trail: "tire",
    sprite: "u.buggy"
  },
  ltank: {
    id: "ltank",
    kind: "unit",
    aliases: ["wolf", "light"],
    domain: "ground",
    tier: 1,
    ability: "smoke",
    cost: 120,
    buildTime: 9,
    pop: 1,
    power: -1,
    hp: 300,
    armor: "medium",
    speed: 75,
    turnRate: 4.5,
    vision: 7,
    radius: 9,
    fireOnMove: true,
    body: { r: 10, len: 10 },
    weapons: [w({
      id: "autocannon",
      cls: "autocannon",
      dmg: 18,
      reload: 0.55,
      range: 4,
      projectile: "bullet",
      speed: 520,
      targets: ["ground", "ship"],
      turret: true,
      muzzleOffset: 20.5,
      sound: "autocannon"
    })],
    trail: "tread",
    sprite: "u.ltank",
    turretSprite: "tur.ltank"
  },
  mbt: {
    id: "mbt",
    kind: "unit",
    aliases: ["bison", "tank"],
    domain: "ground",
    tier: 2,
    ability: "countermeasures",
    cost: 280,
    buildTime: 18,
    pop: 2,
    power: -2,
    hp: 620,
    armor: "heavy",
    speed: 60,
    turnRate: 3.6,
    vision: 7,
    radius: 10,
    fireOnMove: true,
    body: { r: 13, len: 12 },
    weapons: [w({
      id: "cannon",
      cls: "cannon",
      dmg: 60,
      reload: 1.8,
      range: 4.6,
      projectile: "shell",
      speed: 420,
      targets: ["ground", "ship"],
      turret: true,
      muzzleOffset: 35.7,
      splash: 12,
      sound: "cannon"
    }), ROOF_MG],
    trail: "tread",
    sprite: "u.mbt",
    turretSprite: "tur.mbt",
    // on the commander's hatch, measured on `tur.mbt`
    airMount: { sprite: "tur.pintle", x: -2.6, y: 0.54 }
  },
  htank: {
    id: "htank",
    kind: "unit",
    aliases: ["mammoth", "heavy"],
    domain: "ground",
    tier: 3,
    ability: "countermeasures",
    cost: 900,
    buildTime: 45,
    pop: 4,
    power: -4,
    hp: 1900,
    armor: "heavy",
    speed: 42,
    turnRate: 2.6,
    vision: 7,
    radius: 12,
    requires: ["radar"],
    cargoWeight: 4,
    body: { r: 21, len: 8 },
    weapons: [w({
      id: "twincannon",
      cls: "cannon",
      dmg: 55,
      reload: 1.8,
      range: 5.2,
      projectile: "shell",
      speed: 420,
      targets: ["ground", "ship"],
      mult: { heavy: 1.1, structure: 1 },
      turret: true,
      muzzleOffset: 40.47,
      bores: 2,
      boreSpacing: 11.05,
      splash: 14,
      burst: 2,
      burstDelay: 0.18,
      sound: "cannon"
    }), ROOF_MG],
    trail: "tread",
    sprite: "u.htank",
    turretSprite: "tur.htank",
    // on the right-hand roof mounting plate, measured on `tur.htank`
    airMount: { sprite: "tur.pintle", x: 3.58, y: -1.12 }
  },
  td: {
    id: "td",
    kind: "unit",
    aliases: ["viper", "at"],
    domain: "ground",
    tier: 2,
    ability: "smoke",
    cost: 320,
    buildTime: 20,
    pop: 2,
    power: -2,
    hp: 340,
    armor: "medium",
    speed: 65,
    turnRate: 4,
    vision: 8,
    radius: 9,
    fireOnMove: true,
    body: { r: 16, len: 9 },
    weapons: [w({
      id: "atgm",
      cls: "at",
      dmg: 120,
      reload: 2.8,
      range: 7,
      projectile: "missile",
      speed: 300,
      // Twin canisters: concealed pivot (512,916), tips y=202, centres x=364/660;
      // a 16 × 18 art frame at scale 1.5625. One missile per reload, alternating.
      targets: ["ground", "ship"],
      turret: true,
      muzzleOffset: 13.0737,
      bores: 2,
      boreSpacing: 7.2266,
      homing: true,
      interceptable: true,
      sound: "missile"
    })],
    trail: "tire",
    sprite: "u.td",
    turretSprite: "tur.td"
  },
  /**
   * The Flak Track (2026-10-01): a Gepard, a Shilka. Its guns reach a tile
   * past a helicopter's missiles (6.5 to the Cobra's 5.5), so a Cobra that
   * comes for the column comes into them first, and it is armoured to take
   * the reply (360). And they fire on the ground too, at what a light
   * cannon does to it — the ZSU-23-4 was the gun the Soviet columns in
   * Afghanistan and Grozny turned on the hillsides — so a Flak Track in an
   * army is a gun in the army, not a unit waiting on the sky. It looks to the
   * sky first (`skyFirst` in game/combat.ts): an aircraft in reach takes it
   * off a target on the ground.
   */
  flak: {
    id: "flak",
    kind: "unit",
    aliases: ["flaktrack", "aa"],
    domain: "ground",
    tier: 1,
    cost: 170,
    buildTime: 12,
    pop: 1,
    power: -1,
    hp: 360,
    armor: "medium",
    speed: 70,
    turnRate: 4.5,
    vision: 9,
    radius: 9,
    body: { r: 14, len: 5 },
    weapons: [w({
      id: "flakgun",
      cls: "aa",
      dmg: 24,
      reload: 0.7,
      range: 6.5,
      projectile: "flak",
      speed: 460,
      targets: ["air", "ground", "ship"],
      mult: { air: 1, light: 0.9, medium: 0.6, heavy: 0.25, structure: 0.3, ship: 0.4 },
      turret: true,
      muzzleOffset: 19.3,
      sound: "flak"
    })],
    trail: "tread",
    sprite: "u.flak",
    turretSprite: "tur.flak"
  },
  sam: {
    id: "sam",
    kind: "unit",
    aliases: ["hawk", "aalauncher"],
    domain: "ground",
    tier: 2,
    cost: 400,
    buildTime: 22,
    pop: 2,
    power: -2,
    hp: 240,
    armor: "medium",
    speed: 60,
    turnRate: 4,
    vision: 10,
    radius: 9,
    body: { r: 13, len: 11 },
    // the blast is air-only, like every splash: it catches the flight round
    // the target and nothing under it (sam.test.ts). 125 dmg at 10 tiles since
    // 2026-09-17 (130 at 11.25 before): level with the SAM Site now, and still
    // two tiles past the longest thing in the air, the Albatross's missile
    weapons: [w({
      id: "sam",
      cls: "aa",
      dmg: 125,
      reload: 2.5,
      range: 10,
      projectile: "missile",
      speed: 420,
      targets: ["air"],
      turret: true,
      muzzleOffset: 21.7,
      bores: 2,
      boreSpacing: 7.44,
      splash: 24,
      homing: true,
      sound: "missile"
    })],
    trail: "tire",
    sprite: "u.sam",
    turretSprite: "tur.sam"
  },
  arty: {
    id: "arty",
    kind: "unit",
    aliases: ["thunder", "howitzer"],
    domain: "ground",
    tier: 2,
    ability: "barrage",
    cost: 420,
    buildTime: 24,
    pop: 2,
    power: -2,
    hp: 220,
    armor: "light",
    speed: 48,
    turnRate: 3,
    vision: 8,
    radius: 10,
    body: { r: 18, len: 17 },
    weapons: [w({
      id: "howitzer",
      cls: "he",
      dmg: 110,
      reload: 5,
      range: 11,
      minRange: 3,
      projectile: "shell",
      speed: 260,
      targets: ["ground", "ship"],
      muzzleOffset: 17,
      splash: 48,
      arc: true,
      spread: 26,
      sound: "arty"
    })],
    trail: "tread",
    sprite: "u.arty"
  },
  mlrs: {
    id: "mlrs",
    kind: "unit",
    aliases: ["tempest", "rockets"],
    domain: "ground",
    tier: 3,
    ability: "barrage",
    cost: 760,
    buildTime: 40,
    pop: 3,
    power: -3,
    hp: 380,
    armor: "medium",
    speed: 45,
    turnRate: 2.8,
    vision: 8,
    radius: 11,
    requires: ["radar"],
    cargoWeight: 4,
    body: { r: 20, len: 7 },
    weapons: [w({
      id: "rockets",
      cls: "he",
      dmg: 54,
      reload: 8,
      range: 13,
      minRange: 4,
      projectile: "rocket",
      speed: 300,
      targets: ["ground", "ship"],
      muzzleOffset: 23.4,
      splash: 48,
      arc: true,
      burst: 8,
      burstDelay: 0.16,
      spread: 36,
      turret: true,
      sound: "rocket"
    })],
    trail: "tread",
    sprite: "u.mlrs",
    turretSprite: "tur.mlrs"
  },
  /**
   * The radar station's circle on wheels — smaller (16 tiles to its 24) but
   * the same kind of circle: it sees by radio (`radar`), so neither the night
   * nor the rain shrinks it and a stealth aircraft shows inside `detect`, and
   * every gun standing in it fires at its full reach. That is the unit: a
   * Tempest sees 8 tiles and throws 13, and beside an Owl the other five are
   * a siege that sees. It pays with everything else — no gun, thin plate,
   * and slow, so it is where the column is and not out ahead of it, and
   * killing it is the answer to the column. Level 2 factory and a radar;
   * the AI never fields it.
   */
  radarcar: {
    id: "radarcar",
    kind: "unit",
    aliases: ["owl", "sensor"],
    domain: "ground",
    tier: 3,
    cost: 480,
    buildTime: 26,
    pop: 2,
    power: -2,
    hp: 260,
    armor: "light",
    speed: 32,
    turnRate: 2.6,
    vision: 16,
    radius: 10,
    requires: ["radar"],
    radar: true,
    detect: 6,
    body: { r: 16, len: 10 },
    weapons: [],
    trail: "tread",
    sprite: "u.radarcar",
    turretSprite: "tur.radarcar",
    turretSpins: true
  },
  /**
   * Level 3 of the war factory. The Salamander is the siege piece for the
   * turtle Tier 3 builds — Bastions behind Interrupters, where the Tempest's
   * rockets are shot out of the sky: its round is a *shell*, which point
   * defence never touches, with a blast two tiles across that hits everything
   * in it at full value. The blast does not know whose side it is on
   * (`friendlyFire`): the Mammoths escorting it burn if they stand in the
   * footprint, and its minimum range is what keeps it from catching itself.
   * It reaches 6.5 tiles (4.5 until 2026-09-17: nobody built the Interrupter
   * turtle it was made for, and in the sieges people did fight it walked into
   * Cannon Turret range a tile and a half before it could answer, so nobody
   * built it either), past the Cannon Turret, the Gatling and the MG turret
   * and still under the Bastion, the HQ gun, the Viper and every artillery
   * piece, so it earns its price against clusters and only with something in
   * front of it (salamander.test.ts).
   */
  salamander: {
    id: "salamander",
    kind: "unit",
    aliases: ["sala", "mortar"],
    domain: "ground",
    tier: 3,
    cost: 800,
    buildTime: 42,
    pop: 3,
    power: -3,
    hp: 850,
    armor: "heavy",
    speed: 45,
    turnRate: 2.8,
    vision: 7,
    radius: 11,
    requires: ["radar"],
    body: { r: 19, len: 7 },
    weapons: [w({
      id: "thermobaric",
      cls: "he",
      dmg: 260,
      reload: 4,
      range: 6.5,
      minRange: 3,
      projectile: "shell",
      speed: 240,
      targets: ["ground", "ship"],
      mult: { heavy: 0.6 },
      // 72 and not the 77 the splash pass would give it: the nearest its own
      // round can land, less its hull, was 74 px away at the 4.5 tiles it
      // launched with, and is 78 now the spread scales over a longer reach
      // (`salamander.test.ts`)
      turret: true,
      muzzleOffset: 16,
      splash: 72,
      arc: true,
      spread: 16,
      friendlyFire: true,
      sound: "arty",
      // a fuel cloud that burns over the ground rather than a charge that digs into it
      mark: "thermo"
    })],
    trail: "tread",
    sprite: "u.salamander",
    turretSprite: "tur.salamander",
    // the ring its sheet paints, forward of the hull's centre. A body
    // whose turret *fires* declares it here rather than in the sprite
    // manifest: the manifest moves the drawing and the sim cannot read a
    // sheet, so a ring named only there put the round out of the barrel.
    turretMounts: [{ x: 0, y: -1 }]
  },
  /**
   * Point defence on tracks: the Interrupter's magazine on a hull and no gun
   * at all. Weaker than the tower on purpose — six rounds and one back every
   * 1.5 s against the tower's eight and one every 0.75 s — so one Bulwark
   * thins a Tempest's salvo (most of it down, never all of it: a rocket is
   * inside its ring for under a second, and the reload cannot make up two)
   * and two blank it; it never turns a bad fight into a good one alone
   * (bulwark.test.ts). Shells still land.
   */
  bulwark: {
    id: "bulwark",
    kind: "unit",
    aliases: ["interrupter", "pd"],
    domain: "ground",
    tier: 3,
    cost: 650,
    buildTime: 32,
    pop: 2,
    power: -2,
    hp: 520,
    armor: "medium",
    speed: 60,
    turnRate: 4,
    vision: 9,
    radius: 10,
    requires: ["radar"],
    body: { r: 9, len: 9 },
    weapons: [],
    interceptRange: 5,
    interceptMag: 6,
    interceptReload: 1.5,
    interceptMuzzleOffset: 12,
    trail: "tread",
    sprite: "u.bulwark",
    turretSprite: "tur.bulwark"
  },
  /**
   * The fire curtain, and the glass cannon that lays it. The Drake's weapon
   * does not fire, it *pours*: a glob of burning fuel every tick for a full
   * second, sprayed across an arc and falling short of the aim by up to half,
   * so what leaves the nozzle is one continuous tongue of flame — and the
   * ground it washes over keeps burning for eight seconds afterwards. It is
   * the only unit that denies ground rather than killing what stands on it,
   * and the only weapon whose damage goes on after the trigger is let go.
   *
   * That second is the whole unit, and everything else about it is what the
   * second costs:
   *
   * - **A cooldown, not a reload.** The bottles come back up to pressure over
   *   2.6 s, so for two thirds of every engagement the Drake is a tank with
   *   no gun standing three tiles from something that still has one. What it
   *   set alight is what fights while it waits.
   * - **A light tank's reach.** 4 tiles (3.4 until 2026-09-16, a quarter
   *   more since, floored): level with the Wolf, a hair past the Buggy's
   *   machine gun, and out-ranged by every heavier tank, every turret and
   *   every artillery piece there is, so it still has to be walked in behind
   *   something that can take the crossing.
   * - **Thin skin over a full fuel tank.** 260 hit points of *medium* armour
   *   at Tier 2 — less than the Tier-1 Wolf it is built to burn. A Bison's
   *   gun opens it in six seconds and it rarely sees a second cooldown out.
   *   It costs 400 metal since 2026-10-01 (300 before), and is meant to be
   *   spent.
   * - **Nothing for aircraft**, and a hull in the water does not burn.
   * - **The fire is nobody's friend.** A curtain a column could walk through
   *   unharmed would not be a curtain, so `force` rides on every patch and
   *   the Drake's own side burns in it exactly as the enemy does. The Drake
   *   itself burns at half (`burnMult`): it is built to work in its own
   *   fire, so driving forward into what it just laid costs it, but not
   *   what it costs the tanks beside it.
   *
   * What that buys is a raider, not a line unit. Against equal metal it eats
   * artillery, air defence, engineers' work and swarms — the things that sit
   * still or cannot answer at four tiles — and it is beaten by anything with
   * a tank gun and the reach to use it: two Bisons take four Drakes for a
   * quarter of their price. The AI does not field it, for the reason it does
   * not field the Salamander: keeping a line out of one's own fire is micro,
   * and it has none.
   *
   * Level 2 of the war factory, no radar, since 2026-09-17 (the Arsenal's
   * third unit before, behind the radar): a raider's prey — howitzers, air
   * defence, an engineer's camp — is a minute-5 thing, and by the time an
   * Arsenal stood it met Cannon Turrets and the HQ gun instead, so nobody
   * built one. The Tempest went the other way, to the Arsenal.
   */
  drake: {
    id: "drake",
    kind: "unit",
    aliases: ["flametank", "flamer"],
    domain: "ground",
    tier: 2,
    cost: 400,
    buildTime: 16,
    pop: 2,
    power: -2,
    hp: 260,
    armor: "medium",
    speed: 73.6,
    turnRate: 4.8,
    vision: 6,
    radius: 10,
    fireOnMove: true,
    burnMult: 0.5,
    body: { r: 15, len: 14 },
    weapons: [w({
      // `burst` is not a salvo here: a glob every tick for a full second, and
      // then the tank is empty. The reload is a **cooldown** — pressure back
      // in the bottles — and it is more than twice the pour, so two thirds of
      // the Drake's life is spent at four tiles from something it cannot
      // touch. The fire it left is what fights for it meanwhile. 7.8 a glob
      // since 2026-09-19 (9 before): 90 dps over the cycle, down from 104.
      id: "flamejet",
      cls: "he",
      dmg: 7.8,
      reload: 2.6,
      range: 4,
      projectile: "flame",
      speed: 260,
      targets: ["ground", "ship"],
      mult: { light: 1.5, medium: 1.1, heavy: 0.45, ship: 0.5, structure: 1.3 },
      turret: true,
      muzzleOffset: 18.5,
      splash: 38,
      burst: 30,
      burstDelay: 0.03,
      fan: 0.22,
      burn: 14,
      burnLife: 8,
      sound: "flame"
    })],
    trail: "tread",
    sprite: "u.drake",
    turretSprite: "tur.drake",
    turretMounts: [{ x: 0, y: -5 }]
  },
  /**
   * The amphibian: an eight-wheeled armoured car that swims. The one unit
   * with the `amphibious` domain — it drives on everything a tank drives on
   * and floats on everything a ship floats on, at `SWIM_FACTOR` of its road
   * speed in the water (`game/map.ts`), so a crossing is slow and the way
   * round by land is taken when it is quicker (the pathfinder weighs the
   * water, `terrCostAmphib`). Afloat it is a *ship* to every gun — a
   * torpedo, an anti-ship missile and a naval gun all find it — and ashore
   * a vehicle, judged by the tile under it (`targetCat`); it is medium
   * armour either way, and a Flak Track reaches it on both. It never boards a
   * transport: it is its own.
   *
   * Built at the level-2 naval yard *and* the level-2 war factory — it
   * leaves either by its own domain, the one off the slip already afloat
   * and the one off the ramp already rolling — and priced against the
   * landing it replaces. Its gun is the Wolf's class — a 30 mm autocannon, soft skins
   * and light armour, half value against heavy plate and a wall — on a hull
   * a quarter tougher, at 200 metal and twice the population: five Wolves
   * beat three Gators on land at equal metal. Three Gators cost 600 against
   * 700 for a landing craft and four Wolves, with no beach to load
   * from and none to unload onto, no hull that takes four tanks down with
   * it, and a crossing at 44 px/s against the craft's 70. A raider from the
   * sea — the howitzer line, the air defence, the engineer's outlying
   * extractor — and a beachhead's first armour, not a line unit: a Bison
   * opens it in five shots and a cannon turret outranges it. The AI never
   * fields it; its landings go by the lift (`manageLift`), and teaching a
   * commander to swim an assault is its own job. `gator.test.ts`.
   */
  gator: {
    id: "gator",
    kind: "unit",
    aliases: ["acv", "amphibian", "amtrac"],
    domain: "amphibious",
    tier: 2,
    ability: "smoke",
    cost: 200,
    buildTime: 15,
    pop: 2,
    power: -2,
    hp: 380,
    armor: "medium",
    speed: 80,
    turnRate: 4.5,
    vision: 8,
    radius: 10,
    fireOnMove: true,
    // the sheet's hull is 20 by 36 world px with the wheels: a half-beam and
    // a pixel, and the length less the two round ends
    body: { r: 11, len: 14 },
    weapons: [w({
      // the muzzle is 8.3 art px past the ring on `tur.gator` (the tip at a
      // fifth of the sheet, the ring at three fifths), at the display scale
      id: "autocannon",
      cls: "autocannon",
      dmg: 20,
      reload: 0.5,
      range: 4.2,
      projectile: "bullet",
      speed: 520,
      targets: ["ground", "ship"],
      turret: true,
      muzzleOffset: 13,
      sound: "autocannon"
    })],
    trail: "tire",
    sprite: "u.gator",
    turretSprite: "tur.gator",
    // the ring the sheet paints, an art px forward of the frame's centre
    // (measured at 0.462 of the sheet's height; a body whose turret fires
    // declares it here, not in the manifest)
    turretMounts: [{ x: 0, y: -1 }]
  },
  // ------------------------------------------------------ the doctrines' own
  //
  // Three units the tech tree unlocks (`game/tech.ts`), one a doctrine, each a
  // rule the game already had put on a new hull the way the Bulwark put the
  // interrupter on tracks — so the new work stays in the tree and the
  // abilities. All three are real equipment: the eight-wheeled gun carrier,
  // the ballistic missile on its launcher truck, the armoured recovery tank.
  /**
   * **Lightning's suicide drone** (`suicideDrones`): a quadcopter with a
   * shaped charge slung under it — the FPV drone of the Ukrainian front, the
   * Lancet's poorer cousin — flown into what it is sent at and gone with it.
   * It never picks a target of its own (`kamikaze`): it hovers where it is
   * put until an order names a unit, a building or a spot on the ground,
   * then flies there and goes off. Cheap, quick and made of nothing: a Flak
   * Track or a Hawk swats it, and so does a machine gun or an autocannon,
   * since it comes in at treetop height (`lowFlying`); the charge is the
   * anti-tank one (`at`), wasted on a jeep. Eight a faction at most, those on
   * a line's queue counted (`limit`): fifty of them, each a fair trade for
   * a third of a tank and each certain to arrive, deleted any army (the
   * user's word, 2026-09-26). Off the
   * Advanced Airbase, where everything else that flies is built (the Jaguar
   * it replaced came off the Advanced War Factory, but a line is read by
   * what it turns out, `yardKind`, and a war factory with a drone on its
   * list reads as an airbase).
   */
  hornet: {
    id: "hornet",
    kind: "unit",
    aliases: ["fpv", "kamikaze", "suicidedrone", "quadcopter"],
    domain: "air",
    tier: 2,
    // light, not `air`: a foam-and-carbon frame is no armoured airframe, and
    // the small arms that reach it (`lowFlying`) tear it (×1.5) where they
    // only scratch a helicopter; anti-air hits it the same either way
    cost: 120,
    buildTime: 4,
    pop: 1,
    power: -1,
    hp: 60,
    armor: "light",
    speed: 130,
    turnRate: 6,
    vision: 7,
    radius: 7,
    altitude: 8,
    hovers: true,
    kamikaze: true,
    lowFlying: true,
    limit: 10,
    requires: ["suicideDrones"],
    remoteVision: true,
    weapons: [w({
      // the charge: its range is the touch, and its shot is the drone itself
      id: "charge",
      cls: "at",
      dmg: 160,
      reload: 1,
      range: 0.5,
      projectile: "missile",
      speed: 130,
      targets: ["ground", "ship"],
      splash: 12,
      mark: "cannon",
      sound: "expl"
    })],
    sprite: "u.hornet"
  },
  /**
   * **Anvil's recovery tank** (`fieldRecovery`): the armoured recovery
   * vehicle — the M88A2 Hercules, the Büffel, the BREM — the Repair Tower's aura on tracks. It
   * mends vehicles and ships round it as the tower does, billed at the
   * tower's rate (`REPAIR_TOWER_COST_FRAC`), never a building and never an
   * aircraft: it is a crane and a welder, not an engineer. No gun and heavy
   * plate, so it follows the column into the fire; born with the emergency
   * repair that trebles the aura for six seconds. One Hercules does not mend
   * another, as one tower does not mend another.
   */
  hercules: {
    id: "hercules",
    kind: "unit",
    aliases: ["arv", "recovery", "m88", "buffel"],
    domain: "ground",
    tier: 2,
    ability: "emergencyRepair",
    cost: 350,
    buildTime: 18,
    pop: 1,
    power: -1,
    hp: 700,
    armor: "heavy",
    speed: 58,
    turnRate: 3.8,
    vision: 7,
    radius: 10,
    requires: ["fieldRecovery"],
    body: { r: 13, len: 12 },
    weapons: [],
    repairRange: 4,
    repairRate: 12,
    repairTargets: 2,
    trail: "tread",
    sprite: "u.hercules"
  },
  /**
   * **Hammer's ballistic missile** (`ballisticMissiles`, and the radar the
   * Arsenal already needs): the launcher truck and its two rounds — the
   * Iskander's pair. Eighteen tiles, past the Sovereign and everything else
   * that fires at the ground, one pair every thirty seconds, and a big blast
   * each. The answer is already standing in most bases: the missile is
   * ordnance, and point defence takes it out of the air one round a missile
   * (`interceptable`), so a Scorpion's siege starts with the interrupters.
   * It sees seven tiles and throws eighteen — a Scorpion is blind without a
   * radar car, a drone or a plane over the target. No turret: the erector
   * lays the launcher's whole hull on the bearing, as the howitzer does.
   */
  scorpion: {
    id: "scorpion",
    kind: "unit",
    aliases: ["tbm", "iskander", "ballistic"],
    domain: "ground",
    tier: 3,
    cost: 1100,
    buildTime: 45,
    pop: 3,
    power: -3,
    hp: 320,
    armor: "light",
    speed: 40,
    turnRate: 2.4,
    vision: 7,
    radius: 12,
    requires: ["radar", "ballisticMissiles"],
    cargoWeight: 4,
    body: { r: 14, len: 18 },
    weapons: [w({
      id: "tbm",
      cls: "he",
      dmg: 400,
      reload: 30,
      range: 18,
      minRange: 6,
      projectile: "missile",
      speed: 230,
      targets: ["ground", "ship"],
      muzzleOffset: 6,
      splash: 64,
      arc: true,
      spread: 30,
      burst: 2,
      burstDelay: 0.9,
      interceptable: true,
      mark: "bomb",
      sound: "missile"
    })],
    trail: "tire",
    sprite: "u.scorpion"
  },
  // ================================================================== SEA
  //
  // Every hull carries a `body`: the capsule `separation()` parts ships by,
  // measured off the drawn silhouette. A circle cannot say "long and thin" —
  // the battleship's was 1.8x its own beam and 41% of its length, so a line
  // of them telescoped bow-to-stern while holding each other twice too far
  // apart abeam. `radius` is untouched and still the combat yardstick.
  gunboat: {
    id: "gunboat",
    kind: "unit",
    aliases: ["patrol", "boat"],
    domain: "ship",
    tier: 1,
    cost: 130,
    buildTime: 10,
    pop: 1,
    power: -1,
    hp: 260,
    armor: "ship",
    speed: 90,
    turnRate: 3.4,
    vision: 9,
    radius: 9,
    body: { r: 6, len: 20 },
    weapons: [w({
      // the 30 mm reaches aircraft too, at a quarter (since 2026-09-27): the
      // first yard's one answer to the sky, enough to see off a helicopter
      // with a few boats and never a Flak Track's worth per metal
      id: "autocannon",
      cls: "autocannon",
      dmg: 16,
      reload: 0.5,
      range: 4.2,
      projectile: "bullet",
      speed: 520,
      targets: ["ground", "ship", "air"],
      mult: { ship: 0.8, air: 0.25 },
      turret: true,
      muzzleOffset: 10.4,
      sound: "autocannon"
    })],
    trail: "wake",
    sprite: "u.gunboat",
    turretSprite: "tur.gunboat",
    turretMounts: [{ x: 0, y: -2 }]
  },
  mboat: {
    id: "mboat",
    kind: "unit",
    aliases: ["missileboat", "corvette"],
    domain: "ship",
    tier: 1,
    cost: 280,
    buildTime: 18,
    pop: 2,
    power: -2,
    hp: 300,
    armor: "ship",
    speed: 80,
    turnRate: 3,
    vision: 9,
    radius: 10,
    body: { r: 8, len: 29 },
    weapons: [w({
      id: "ashm",
      cls: "ashm",
      dmg: 170,
      reload: 3.5,
      range: 8,
      projectile: "missile",
      speed: 320,
      targets: ["ship"],
      homing: true,
      turret: true,
      sound: "missile"
    })],
    trail: "wake",
    sprite: "u.mboat"
  },
  frigate: {
    id: "frigate",
    kind: "unit",
    aliases: ["aegis", "escort"],
    domain: "ship",
    tier: 2,
    ability: "damageControl",
    cost: 700,
    buildTime: 34,
    pop: 3,
    power: -3,
    hp: 900,
    armor: "ship",
    speed: 65,
    turnRate: 2.6,
    vision: 10,
    sonar: 9,
    radius: 13,
    // measured at the ship's display scale (core/metrics.ts): a beam of 42
    // world px, over a tile, so it needs two tiles of water abeam
    body: { r: 21, len: 67.5 },
    weapons: [
      w({
        // The deck gun works the surface; the forward VLS answers the sky.
        id: "navgun",
        cls: "navgun",
        dmg: 40,
        reload: 1.5,
        range: 5.5,
        projectile: "shell",
        speed: 420,
        targets: ["ground", "ship"],
        turret: true,
        muzzleOffset: 14.36,
        splash: 10,
        sound: "cannon"
      }),
      w({
        // vertical-launch cells on the forward deck: the missile is aimed once it is
        // out (`vertical`), never by the hull or the gun's ring, since a ship
        // never swings on the spot to point its bow at an aircraft. The cells
        // keep a target of their own (`hasAirMount` in combat.ts) and fire at
        // it while the gun is on a boat and while the ship is under way: they
        // used to wait on the gun's one target, and three patrol boats in
        // front of five helicopters sank three frigates that way
        id: "navsam",
        cls: "aa",
        dmg: 80,
        reload: 2,
        range: 8.5,
        projectile: "missile",
        speed: 430,
        // Hatch grid centre: 8.2 art px forward at the hull's 2.625 scale.
        targets: ["air"],
        homing: true,
        vertical: true,
        muzzleOffset: 21.525,
        sound: "missile"
      }),
      w({
        // The escort's torpedoes screen submerged threats; surface fighting
        // stays with its light deck gun and the fleet's offensive ships.
        id: "torpedo",
        cls: "torpedo",
        dmg: 160,
        reload: 3.2,
        range: 7,
        projectile: "torpedo",
        speed: 150,
        targets: ["sub"],
        mult: { sub: 1.9 },
        homing: true,
        sound: "torpedo"
      })
    ],
    trail: "wake",
    sprite: "u.frigate",
    turretSprite: "tur.frigate",
    // Measured forward ring: 422 / 2016 down the 42 px hull sheet.
    turretMounts: [{ x: 0, y: -12.2 }]
  },
  // Retained for existing saves and authored scenarios; absent from yard menus.
  destroyer: {
    id: "destroyer",
    kind: "unit",
    aliases: ["orca", "dd"],
    domain: "ship",
    tier: 2,
    ability: "damageControl",
    cost: 700,
    buildTime: 34,
    pop: 3,
    power: -3,
    hp: 1300,
    armor: "ship",
    speed: 60,
    turnRate: 2.4,
    vision: 10,
    sonar: 9,
    radius: 15,
    // at the ship's display scale: a beam of 48 world px, two tiles of water abeam
    body: { r: 24, len: 63 },
    weapons: [
      w({
        // dual-purpose, like every naval gun (`ARMOR_MATRIX.navgun`)
        // 7 tiles, past the headquarters' gun (2026-09-27): the level-two
        // fleet's answer to a coast, so a navy threatens a shore before the
        // Sovereign. At 7.5 it outranged a howitzer battery three tiles inland
        id: "navgun",
        cls: "navgun",
        dmg: 70,
        reload: 1.8,
        range: 7,
        projectile: "shell",
        speed: 420,
        targets: ["ground", "ship", "air"],
        mult: { medium: 1.1, heavy: 0.8, structure: 0.8 },
        turret: true,
        muzzleOffset: 25.3125,
        splash: 12,
        sound: "cannon"
      }),
      w({
        // anti-submarine torpedoes: out-range the sub's own, bite hardest below
        id: "torpedo",
        cls: "torpedo",
        dmg: 160,
        reload: 3.2,
        range: 7,
        projectile: "torpedo",
        speed: 150,
        targets: ["ship", "sub"],
        mult: { ship: 1, sub: 1.9 },
        homing: true,
        sound: "torpedo"
      })
    ],
    trail: "wake",
    sprite: "u.destroyer",
    turretSprite: "tur.destroyer",
    // Measured gun ring: 620 / 1920 down the 48 px hull sheet.
    turretMounts: [{ x: 0, y: -8.5 }]
  },
  /**
   * The Barracuda hunts ships and nothing else. It carried a warhead of its
   * own until 2026-09-27; that went to the Kraken, the boat built to strike
   * the land.
   */
  sub: {
    id: "sub",
    kind: "unit",
    aliases: ["barracuda", "submarine"],
    domain: "ship",
    tier: 2,
    cost: 480,
    buildTime: 26,
    pop: 2,
    power: -2,
    hp: 550,
    armor: "sub",
    speed: 55,
    turnRate: 2.6,
    vision: 8,
    sonar: 8,
    radius: 12,
    underwater: true,
    body: { r: 7, len: 78 },
    weapons: [w({
      id: "torpedo",
      cls: "torpedo",
      dmg: 160,
      reload: 3.5,
      range: 6.5,
      projectile: "torpedo",
      speed: 150,
      targets: ["ship", "sub"],
      homing: true,
      sound: "torpedo"
    })],
    sprite: "u.sub"
  },
  /**
   * The Sovereign: three turrets on a long, narrow hull rather than one
   * enormous mounting amidships.
   *
   * `turretMounts` is the whole of it — A and B stepped up over the bow, X
   * abaft the superstructure — and the three-round burst it always fired now
   * walks them, so a salvo is three guns speaking a quarter of a second
   * apart. Each trains only within its own arc, which is why X sits round at
   * its stop while the forward pair are on something over the bow. Nothing
   * about the ship's numbers moved with the mounts: the reach and the shell
   * are what they were, and `radius` is still the collision circle rather
   * than the beam, so the fleet packs and closes exactly as it did. The
   * reload went 5 → 7 s afterwards, then to 20 s on 2026-10-08 alongside
   * a wider firing envelope (4–17 tiles) and the move to the Deepwater
   * Yard: a slower siege salvo with a larger blind zone close to the hull.
   *
   * The secondaries are its answer to the sky (since 2026-09-27): four
   * Cobras used to sink it without a loss and two Albatrosses likewise.
   * A battery of their own (`hasAirMount` in combat.ts), so they fire while
   * the main guns are on the shore and never pull the turrets round; 6.5
   * tiles, past a helicopter's missiles and short of the Albatross's, whose
   * answer is still the Aegis riding with it.
   */
  btlship: {
    id: "btlship",
    kind: "unit",
    aliases: ["sovereign", "battleship"],
    domain: "ship",
    tier: 3,
    ability: "barrage",
    cost: 1700,
    buildTime: 70,
    pop: 5,
    power: -5,
    hp: 2500,
    armor: "ship",
    speed: 45,
    turnRate: 1.6,
    vision: 10,
    radius: 20,
    requires: ["radar"],
    // the hull is drawn at its own display scale (core/metrics.ts), and the
    // capsule is measured off the drawing at that scale: 236 world px stem
    // to stern, over seven tiles, on a beam of 44 — over a tile, so two
    // tiles of water abeam and never a channel a tile wide (`hullBeam`)
    body: { r: 22, len: 192 },
    weapons: [w({
      id: "bigguns",
      cls: "he",
      dmg: 120,
      reload: 20,
      range: 17,
      minRange: 4,
      projectile: "shell",
      speed: 300,
      targets: ["ground", "ship"],
      mult: { heavy: 1, ship: 1.2 },
      // 1024 × 1536 turret master: pivot y=921.6, tips y=86, barrel centres
      // x=425/598, mapped to the original 10 × 16 art frame at scale 3.8.
      turret: true,
      muzzleOffset: 33.076,
      bores: 2,
      boreSpacing: 6.42,
      splash: 54,
      arc: true,
      burst: 3,
      burstDelay: 0.25,
      spread: 40,
      sound: "arty"
    }), w({
      id: "secondaries",
      cls: "aa",
      dmg: 20,
      reload: 0.5,
      range: 6.5,
      projectile: "flak",
      speed: 460,
      targets: ["air"],
      turret: true,
      sound: "flak"
    })],
    trail: "wake",
    sprite: "u.btlship",
    turretSprite: "tur.btlship",
    // Rings measured at y=537/788/1739 on the 800 × 2400 master, mapped to
    // its 62 art-px height. The code-drawn hull uses the same offsets.
    turretMounts: [
      { x: 0, y: -17.1275, arc: BROADSIDE },
      // A, over the bow
      { x: 0, y: -10.6433, arc: BROADSIDE },
      // B, superfiring behind A
      { x: 0, y: 13.9242, rest: Math.PI, arc: BROADSIDE }
      // X, abaft the bridge
    ]
  },
  carrier: {
    id: "carrier",
    kind: "unit",
    aliases: ["aircraftcarrier", "cv"],
    domain: "ship",
    tier: 3,
    ability: "damageControl",
    cost: 2200,
    buildTime: 85,
    pop: 6,
    power: -6,
    hp: 2600,
    armor: "ship",
    speed: 40,
    turnRate: 1.3,
    vision: 11,
    radius: 24,
    requires: ["radar"],
    body: { r: 30, len: 180 },
    transportCap: 10,
    transportDomain: "air",
    rearmsAir: true,
    weapons: [w({
      id: "navgun",
      cls: "navgun",
      dmg: 35,
      reload: 2,
      range: 5.5,
      projectile: "shell",
      speed: 420,
      targets: ["ground", "ship"],
      turret: true,
      muzzleOffset: 14,
      splash: 8,
      sound: "cannon"
    }), w({
      id: "aam",
      cls: "aa",
      dmg: 40,
      reload: 2,
      range: 5,
      projectile: "missile",
      speed: 460,
      targets: ["air"],
      homing: true,
      turret: true,
      muzzleOffset: 6,
      bores: 2,
      boreSpacing: 7,
      sound: "missile"
    })],
    trail: "wake",
    sprite: "u.carrier",
    turretSprite: "tur.carrier",
    airMount: { sprite: "tur.carrier-aa", x: 5.75, y: 20.7, on: "hull" },
    // Port-forward ring measured on the master at (332, 284), in its
    // 1024 × 1536 frame, mapped to the manifest's 32 × 62 art px.
    turretMounts: [{ x: -5.625, y: -19.536 }]
  },
  seatrans: {
    id: "seatrans",
    kind: "unit",
    aliases: ["landingcraft", "lst"],
    domain: "ship",
    tier: 1,
    cost: 220,
    buildTime: 14,
    pop: 1,
    power: -1,
    hp: 500,
    armor: "ship",
    speed: 70,
    turnRate: 2.8,
    vision: 8,
    radius: 13,
    transportCap: 4,
    // a ramp against a beach has more give than a hoist: a tenth more reach
    // to board it, collect with it, and come to the shore it unloads on
    cargoReach: 1.1,
    body: { r: 10, len: 29 },
    weapons: [],
    trail: "wake",
    sprite: "u.seatrans"
  },
  /**
   * The engineer that works from the water. It builds and mends the same
   * things an engineer does, but only what stands within its arms of the
   * sea — which on a naval map is the ore: the fields out in open water,
   * which nothing else can reach (the offshore rig), and the deposits on
   * islets no engineer can drive to. Its `reach` is longer
   * than the engineer's, because the hull stops at the shoreline and the
   * site stands on the beach beyond it; long enough for one tile of beach
   * between the two, not for a deposit inland. Unarmed, and a builder for
   * `canRebuild` like any other pair of hands.
   */
  engboat: {
    id: "engboat",
    kind: "unit",
    aliases: ["workboat", "seabuilder"],
    domain: "ship",
    tier: 1,
    cost: 200,
    buildTime: 10,
    pop: 1,
    power: -1,
    hp: 260,
    armor: "ship",
    detect: 3,
    speed: 75,
    turnRate: 3.2,
    vision: 7,
    radius: 9,
    weapons: [],
    body: { r: 6, len: 18 },
    builds: ["extractor", "platform", "power", "factory", "factory3", "navyard", "navyard3", "airbase", "airbase3", "mgturret", "cannonturret", "aaturret", "interceptor", "repairtower", "sandbag", "landmine", "watermine", "warlab", "radar", "veil", "reactor", "nukesilo", "hq"],
    buildRate: 30,
    reach: 64,
    trail: "wake",
    sprite: "u.engboat"
  },
  /**
   * Level 3 of the naval yard. The Kraken shells the shore from under the
   * water — two cruise missiles every six seconds at ground targets only, no
   * torpedo, nothing to fight a ship with. They go up out of the six tubes
   * amidships and turn onto their bearing once out (`vertical`), so the boat
   * fires at any bearing without coming round. Vision 6 against range 13: it
   * shoots at what the team can see, or force-fires at a point the player
   * remembers. Every missile is `interceptable`, so an Interrupter over the
   * target blanks it the way it blanks a Tempest (kraken.test.ts).
   *
   * It is the second launcher (2026-09-27, the Barracuda's before): one
   * warhead of its own at the silo's price and pace, fired from wherever it
   * lies — but fabricated only alongside one of its own naval yards
   * (`armsAtBase`), so arming it is a trip home and the strike is the trip
   * out (nuke.test.ts).
   *
   * Priced as the naval Tempest with a stealth premium since 2026-09-17
   * (1500 · 60 s · pop 4 · range 12 before): sold beside the Sovereign at 88%
   * of its price, with a quarter of its hull and two tiles less reach, it was
   * never bought.
   */
  kraken: {
    id: "kraken",
    kind: "unit",
    aliases: ["cruisesub", "missilesub"],
    domain: "ship",
    tier: 3,
    cost: 1e3,
    buildTime: 45,
    pop: 3,
    power: -3,
    hp: 620,
    armor: "sub",
    speed: 50,
    turnRate: 2.4,
    vision: 6,
    sonar: 6,
    radius: 13,
    underwater: true,
    requires: ["radar"],
    body: { r: 9, len: 110 },
    nukeCapacity: 1,
    nukeCost: 2500,
    nukeTime: 180,
    armsAtBase: 4,
    weapons: [w({
      id: "cruise",
      cls: "he",
      dmg: 150,
      reload: 6,
      range: 13,
      minRange: 3,
      projectile: "missile",
      speed: 260,
      targets: ["ground"],
      homing: true,
      interceptable: true,
      vertical: true,
      splash: 43,
      burst: 2,
      burstDelay: 0.6,
      sound: "missile"
    })],
    sprite: "u.kraken"
  },
  /**
   * A transport that nobody without sonar can see: a hold of 4 — one
   * Mammoth, two Vipers, four engineers. The beach is the only door: boarding
   * is walking to it, and it unloads only onto ground near its hull, so it
   * has to come in close to a shore. Its hatch is on the surface: for as
   * long as its hold is working it is up, a ship anyone can see and shoot
   * (`surfacesForCargo`). Unarmed, and its cargo dies with it (moray.test.ts).
   */
  moray: {
    id: "moray",
    kind: "unit",
    aliases: ["spysub", "infiltrator"],
    domain: "ship",
    tier: 3,
    cost: 700,
    buildTime: 34,
    pop: 2,
    power: -2,
    hp: 450,
    armor: "sub",
    speed: 62,
    turnRate: 2.8,
    vision: 6,
    sonar: 5,
    radius: 12,
    underwater: true,
    transportCap: 4,
    requires: ["radar"],
    // more give than the landing craft's 1.1 (2026-09-27): a squad boards
    // from further up the beach, and the hold sets it down a tile further out
    cargoReach: 1.5,
    body: { r: 8, len: 70 },
    weapons: [],
    sprite: "u.moray"
  },
  // ================================================================== AIR
  drone: {
    id: "drone",
    kind: "unit",
    aliases: ["scout", "uav"],
    domain: "air",
    tier: 1,
    remoteVision: true,
    cost: 40,
    buildTime: 4,
    pop: 1,
    power: -1,
    hp: 90,
    armor: "air",
    // a fixed wing: it cannot hover, so it loiters the way every other plane
    // does, circling the spot it was sent to
    speed: 130,
    turnRate: 3.2,
    vision: 12,
    radius: 8,
    altitude: 12,
    weapons: [],
    sprite: "u.drone"
  },
  fighter: {
    id: "fighter",
    kind: "unit",
    aliases: ["falcon", "cap"],
    domain: "air",
    tier: 2,
    ability: "afterburner",
    cost: 380,
    buildTime: 22,
    pop: 2,
    power: -2,
    hp: 320,
    armor: "air",
    speed: 190,
    turnRate: 2.8,
    vision: 11,
    radius: 9,
    altitude: 14,
    rearmTime: 12,
    weapons: [w({
      id: "aam",
      cls: "aa",
      dmg: 150,
      reload: 2.2,
      range: 6,
      projectile: "missile",
      speed: 480,
      targets: ["air"],
      homing: true,
      ammo: 4,
      sound: "missile"
    })],
    sprite: "u.fighter",
    decals: [{ sprite: "dec.afterburner", layer: "under", y: 13, scale: 1.5, when: "ability" }]
  },
  /**
   * The Cobra (2026-10-01): off the Advanced Airbase, no longer the first
   * one; at treetop height (`lowFlying`), where the machine guns and the
   * light cannon of a column reach it as small arms reached every Apache of
   * the Karbala raid; eight missiles aboard, an AH-1's load, and then home
   * to the airbase for more (`ammo`, `game/ammo.ts`).
   */
  heli: {
    id: "heli",
    kind: "unit",
    aliases: ["cobra", "attackheli"],
    domain: "air",
    tier: 2,
    cost: 380,
    buildTime: 20,
    pop: 2,
    power: -2,
    hp: 300,
    armor: "air",
    speed: 95,
    turnRate: 3.4,
    vision: 9,
    radius: 9,
    altitude: 11,
    hovers: true,
    lowFlying: true,
    rearmTime: 12,
    weapons: [w({
      // a raider as much as a tank hunter: keeps some bite against soft targets
      id: "atgm",
      cls: "at",
      dmg: 75,
      reload: 2.6,
      range: 5.5,
      projectile: "missile",
      speed: 300,
      targets: ["ground", "ship"],
      mult: { light: 0.6, structure: 0.8 },
      homing: true,
      ammo: 8,
      sound: "missile"
    })],
    sprite: "u.heli"
  },
  jet: {
    id: "jet",
    kind: "unit",
    aliases: ["thunderbolt", "strikejet"],
    domain: "air",
    tier: 2,
    ability: "afterburner",
    cost: 450,
    buildTime: 25,
    pop: 2,
    power: -2,
    hp: 360,
    armor: "air",
    speed: 160,
    turnRate: 2.4,
    vision: 10,
    radius: 10,
    altitude: 14,
    rearmTime: 15,
    weapons: [w({
      // six salvos of four, two pods' worth, then home (`ammo`)
      id: "rockets",
      cls: "rocket",
      dmg: 24,
      reload: 2.4,
      range: 4.5,
      projectile: "rocket",
      speed: 340,
      targets: ["ground", "ship"],
      burst: 4,
      burstDelay: 0.1,
      splash: 22,
      spread: 18,
      ammo: 6,
      sound: "rocket"
    })],
    sprite: "u.jet",
    decals: [{ sprite: "dec.afterburner", layer: "under", x: -2.5, y: 13, scale: 1.3, when: "ability" }, { sprite: "dec.afterburner", layer: "under", x: 2.5, y: 13, scale: 1.3, when: "ability" }]
  },
  mjet: {
    id: "mjet",
    kind: "unit",
    aliases: ["albatross", "antiship"],
    domain: "air",
    tier: 2,
    ability: "afterburner",
    cost: 520,
    buildTime: 28,
    pop: 2,
    power: -2,
    hp: 380,
    armor: "air",
    speed: 150,
    turnRate: 2.2,
    vision: 11,
    radius: 10,
    altitude: 14,
    rearmTime: 15,
    weapons: [w({
      // four anti-ship missiles, a maritime striker's load (`ammo`)
      id: "ashm",
      cls: "ashm",
      dmg: 170,
      reload: 4.5,
      range: 8,
      projectile: "missile",
      speed: 340,
      targets: ["ship"],
      mult: { ship: 1.7 },
      homing: true,
      ammo: 4,
      sound: "missile"
    })],
    sprite: "u.mjet",
    decals: [{ sprite: "dec.afterburner", layer: "under", y: 14, scale: 1.5, when: "ability" }]
  },
  bomber: {
    id: "bomber",
    kind: "unit",
    aliases: ["vulture", "levelbomber"],
    domain: "air",
    tier: 2,
    ability: "incendiary",
    // siege from the air is the strongest thing an airbase makes, and it is
    // priced and armoured so a SAM site is a real answer to it
    cost: 1e3,
    buildTime: 40,
    pop: 3,
    power: -3,
    hp: 560,
    armor: "air",
    speed: 110,
    turnRate: 1.8,
    vision: 9,
    radius: 12,
    altitude: 16,
    rearmTime: 20,
    weapons: [w({
      // heavy bombs: nothing on the ground shrugs them off. Two sticks of
      // five in the bay, then home for the next load (`ammo`)
      id: "bombs",
      cls: "he",
      dmg: 70,
      reload: 6,
      range: 2.4,
      projectile: "bomb",
      speed: 120,
      targets: ["ground", "ship"],
      mult: { medium: 1.2, heavy: 1, ship: 1.1 },
      burst: 5,
      burstDelay: 0.14,
      splash: 42,
      spread: 20,
      ammo: 2,
      sound: "bomb"
    })],
    sprite: "u.bomber",
    // the canisters on the wing just aft of the inner engine pods
    decals: [{ sprite: "dec.incendiary", layer: "hull", y: -1, when: "ability" }]
  },
  theli: {
    id: "theli",
    kind: "unit",
    aliases: ["pelican", "transportheli"],
    domain: "air",
    tier: 1,
    cost: 280,
    buildTime: 16,
    pop: 1,
    power: -1,
    hp: 380,
    armor: "air",
    speed: 100,
    turnRate: 3,
    vision: 8,
    radius: 11,
    altitude: 12,
    transportCap: 2,
    hovers: true,
    lowFlying: true,
    weapons: [],
    sprite: "u.theli"
  },
  c47: {
    id: "c47",
    kind: "unit",
    aliases: ["skytrain", "dakota"],
    domain: "air",
    tier: 2,
    cost: 650,
    buildTime: 34,
    pop: 3,
    power: -3,
    hp: 720,
    armor: "air",
    speed: 120,
    turnRate: 1.9,
    vision: 9,
    radius: 15,
    altitude: 16,
    transportCap: 5,
    landsForCargo: true,
    weapons: [],
    sprite: "u.c47"
  },
  gunship: {
    id: "gunship",
    kind: "unit",
    aliases: ["spectre", "ac130"],
    domain: "air",
    tier: 3,
    cost: 1800,
    buildTime: 60,
    pop: 5,
    power: -5,
    hp: 1100,
    armor: "air",
    speed: 90,
    turnRate: 1.6,
    vision: 10,
    radius: 12,
    altitude: 16,
    requires: ["radar"],
    rearmTime: 25,
    weapons: [w({
      // Sustained fire support, strongest against light and medium armor.
      // The 150-round drum keeps it on station; heavy armor, fortifications
      // and ships call for the air wing's specialist weapons.
      id: "gatcannon",
      cls: "autocannon",
      dmg: 28,
      reload: 0.45,
      range: 5.5,
      projectile: "shell",
      speed: 480,
      targets: ["ground", "ship"],
      mult: { light: 1.2, medium: 1.2, heavy: 0.8, structure: 0.8, ship: 0.7 },
      ammo: 150,
      // side-firing: the gunship shoots out of its orbit instead of nose-on
      turret: true,
      splash: 10,
      sound: "autocannon"
    })],
    sprite: "u.gunship"
  },
  /**
   * Level 3 of the airbase. The Wraith carries two heavy bombs instead of
   * the Vulture's five: one pass puts 832 onto a building, which is a Radar
   * Station, a SAM Site or an Interrupter in a single run. Its `stealth` is
   * a range: an enemy sees it only within 4 tiles of one of their units or
   * buildings, or 8 of their radar (`detect`), so AA elsewhere in the base
   * never joins in and whatever stands at the target gets its shots late.
   * The counters are the cheap ones — flak and gatlings beside the things
   * worth keeping — and a Falcon patrol over them (wraith.test.ts).
   *
   * It also carries one nuclear gravity bomb (2026-09-27, `nukebomb`),
   * fabricated only while it circles one of its own airbases
   * (`armsAtBase`), and delivered the way a bomber delivers one: flown over
   * the point and let go, to lie there on its fuse (nuke-bomb.test.ts).
   */
  wraith: {
    id: "wraith",
    kind: "unit",
    aliases: ["stealth", "stealthbomber"],
    domain: "air",
    tier: 3,
    ability: "incendiary",
    cost: 1400,
    buildTime: 55,
    pop: 4,
    power: -4,
    hp: 450,
    armor: "air",
    speed: 135,
    turnRate: 2,
    vision: 9,
    radius: 11,
    altitude: 16,
    stealth: 4,
    requires: ["radar"],
    rearmTime: 20,
    // one nuclear gravity bomb (`nukebomb`), fabricated over its own airbases
    // — the ground its bombs are loaded on too (`game/ammo.ts`)
    nukeCapacity: 1,
    armsAtBase: 4,
    magazine: ["nukebomb"],
    weapons: [w({
      // two passes' worth of heavy bombs, then home (`ammo`)
      id: "heavybombs",
      cls: "he",
      dmg: 260,
      reload: 8,
      range: 2.4,
      projectile: "bomb",
      speed: 120,
      targets: ["ground", "ship"],
      mult: { light: 1, medium: 0.9, heavy: 0.6 },
      burst: 2,
      burstDelay: 0.2,
      splash: 43,
      spread: 10,
      ammo: 2,
      sound: "bomb"
    })],
    sprite: "u.wraith",
    decals: [{ sprite: "dec.incendiary", layer: "hull", y: 2, when: "ability" }]
  },
  /**
   * The first aircraft that can find a submarine: dipping sonar and homing
   * torpedoes that bite hardest below. A torpedo dropped over land fizzles on
   * the spot — the engine does that to every torpedo — so the Cormorant
   * attacks from over the sea, and its reach (5) is inside the Aegis
   * frigate's missiles (8.5), so a screened fleet is closed to it
   * (cormorant.test.ts).
   */
  cormorant: {
    id: "cormorant",
    kind: "unit",
    aliases: ["asw", "aswheli"],
    domain: "air",
    tier: 3,
    cost: 700,
    buildTime: 34,
    pop: 2,
    power: -2,
    hp: 340,
    armor: "air",
    // the longest sonar in the game — a tile past the Orca's, so it is the
    // one thing that hears a submarine before the submarine's escort hears it
    speed: 92,
    turnRate: 3.2,
    vision: 9,
    sonar: 10,
    radius: 10,
    altitude: 11,
    hovers: true,
    lowFlying: true,
    requires: ["radar"],
    rearmTime: 15,
    weapons: [w({
      // two torpedoes, a Seahawk's, then home for more (`ammo`)
      id: "airtorpedo",
      cls: "torpedo",
      dmg: 140,
      reload: 4,
      range: 5,
      projectile: "torpedo",
      speed: 150,
      targets: ["ship", "sub"],
      mult: { ship: 0.9, sub: 1.8 },
      homing: true,
      ammo: 2,
      sound: "torpedo"
    })],
    sprite: "u.cormorant"
  },
  /**
   * The nuclear warhead in flight. Not built at any factory: a silo or a
   * Kraken launches one, and from then on it is an aircraft with no
   * gun and no orders, flying a straight line at the point it was sent to:
   * a slow launch, cruise, then a faster terminal approach
   * (`Game.tickWarhead`, `warheadTravel`). Two things may shoot it down: a *veteran* — a unit
   * of rank 2 or better whose weapons reach the sky (`canEngage` in
   * combat.ts, `WARHEAD_MIN_RANK`) — and the SAM Site, the one emplacement a
   * def flag clears for the job (`antiWarhead`). A green unit and every other
   * building cannot lock on to it, fire at it or scratch it with a stray
   * burst. The hit points are the balance among those who can: one veteran
   * Hawk under its path is not enough and a row of them is, and the same goes
   * for a pair of SAM Sites under the line versus a cluster over the target
   * (nuke.test.ts pins all of it). They move with the SAM Site's damage —
   * raise its missile and this goes up in step, or one site alone gets the
   * vote the pair was meant to have.
   * Its `requires` is what every launcher needs to fabricate or fire one.
   */
  warhead: {
    id: "warhead",
    kind: "unit",
    aliases: ["nuke", "nuclear"],
    domain: "air",
    tier: 3,
    warhead: true,
    cost: 0,
    buildTime: 0,
    pop: 0,
    hp: 700,
    armor: "air",
    speed: 96,
    turnRate: 0,
    vision: 0,
    radius: 7,
    altitude: 36,
    weapons: [],
    requires: ["radar", "reactor", "nuclearProgram"],
    sprite: "u.warhead",
    decals: WARHEAD_MOTOR
  },
  /**
   * The other thing a silo or a Kraken may put in the shaft: an
   * electromagnetic pulse where the nuclear warhead has a blast. Same
   * missile, same flight, same hit points against the same anti-air — and
   * where it comes down every circuit within `emp.radius` tiles is dead for
   * `emp.seconds` (`pulse` in combat.ts): a column stands still with its
   * guns silent, a radar goes blind, a repair tower and a turret line stop,
   * a plant makes nothing, its own side's included. Nothing in the air is
   * touched, which is what makes air the answer to it, and a wall draws no
   * power and stands as it stood. It leaves no crater and kills nothing,
   * which is why it is half the price and half the wait, needs only the
   * radar, and is the one a player who wants the base rather than the
   * ground it stood on reaches for. `cost` and `buildTime` are its own:
   * the nuclear warhead's are the launcher's (`warheadCost` in
   * game/warheads.ts).
   */
  emp: {
    id: "emp",
    kind: "unit",
    aliases: ["empwarhead", "pulse"],
    domain: "air",
    tier: 3,
    warhead: true,
    cost: 1200,
    buildTime: 90,
    pop: 0,
    hp: 700,
    armor: "air",
    speed: 96,
    turnRate: 0,
    vision: 0,
    radius: 7,
    altitude: 36,
    weapons: [],
    requires: ["radar"],
    emp: { radius: 7, seconds: 12 },
    sprite: "u.emp",
    decals: WARHEAD_MOTOR
  },
  /**
   * The Wraith's nuclear bomb (2026-09-27): a free-fall weapon, not a missile
   * (`laydown`). The bomber carries it to the point and lets it go
   * (`nukeDrop`); it comes down under a parachute and lies there for its
   * fuse — the laydown delay a B61 has so the aircraft can get clear —
   * before it goes off. A tactical yield, about a sixth of the missile's by
   * the cube root that sizes a blast: half its rings (3 and 4 tiles against
   * 6 and 8) and two thirds of its punch at the point. Lying there it is a
   * heavy thing on the ground any gun may shoot apart, which it survives
   * for a few seconds of a tank's fire, and shot apart it does not go off.
   * Priced under half the missile's, being so much less of it.
   */
  nukebomb: {
    id: "nukebomb",
    kind: "unit",
    aliases: ["b61", "nuclearbomb", "gravitybomb"],
    domain: "ground",
    tier: 3,
    warhead: true,
    cost: 1200,
    buildTime: 120,
    pop: 0,
    hp: 800,
    armor: "heavy",
    speed: 0,
    turnRate: 0,
    vision: 0,
    radius: 8,
    weapons: [],
    requires: ["radar", "reactor", "nuclearProgram"],
    laydown: { fuse: 10, dmg: 2e3, inner: 4, outer: 5 },
    sprite: "u.nukebomb"
  },
  // ============================================================ BUILDINGS
  /**
   * The one footprint that is not square: the sheet's ground is four tiles
   * wide and three deep, and a fourth row only put a strip of walkable
   * ground under the south wall. `spawnFootprint` (game/state.ts) settles
   * the odd height against the spawn point.
   */
  /**
   * The headquarters defends itself, the way a tower does in a lane game:
   * a twin heavy machine gun on the roof ring where the helipad was, a
   * shade stronger than the Gatling (79 dps to its 71) and reaching farther
   * (7 tiles, measured from a centre that is already two
   * tiles from the wall, so five past it), so a buggy, a light tank, a
   * gunship or a machine-gun turret that comes for it pays while a howitzer
   * or a launcher standing off still outranges it. It was the Gatling's 5
   * until the recorded matches of 15 September 2026: a gunship at 5.5 hit
   * it for free, and an engineer flown in stood turrets 7 tiles out that
   * shot every engineer it made; the ground a side may build on is its
   * headquarters' (`hqGroundTiles` in `game/orders.ts`), which is what
   * answers that drop. The ring is the pad's centre on the sheet (`mount`
   * in the manifest is the same point, for the placement ghost); the muzzle
   * and the bore spacing are measured across `tur.hq`.
   */
  hq: {
    id: "hq",
    kind: "building",
    domain: "none",
    tier: 1,
    isHQ: true,
    cost: 2500,
    buildTime: 60,
    pop: 0,
    hp: 4e3,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 10,
    radius: 60,
    fw: 4,
    fh: 3,
    weapons: [w({
      id: "hqgun",
      cls: "mg",
      dmg: 11,
      reload: 0.14,
      range: 7,
      projectile: "bullet",
      speed: 520,
      targets: ["ground", "ship", "air"],
      mult: { medium: 0.9, heavy: 0.5, air: 0.8, ship: 0.7, structure: 0.3 },
      turret: true,
      muzzleOffset: 35,
      bores: 2,
      boreSpacing: 5.7,
      sound: "mg"
    })],
    produces: ["engineer"],
    power: 10,
    metalRate: 0.5,
    upgradesTo: "hq2",
    upgradeCost: 15e3,
    upgradeTime: 180,
    sprite: "u.hq",
    turretSprite: "tur.hq",
    turretMounts: [{ x: 26, y: -36 }]
  },
  hq2: {
    id: "hq2",
    kind: "building",
    domain: "none",
    tier: 2,
    isHQ: true,
    upgradeOnly: true,
    cost: 17500,
    buildTime: 240,
    pop: 0,
    hp: 6e3,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 10,
    radius: 60,
    fw: 4,
    fh: 3,
    weapons: [w({
      id: "hqgun",
      cls: "mg",
      dmg: 19.25,
      reload: 0.14,
      range: 7,
      projectile: "bullet",
      speed: 520,
      targets: ["ground", "ship", "air"],
      mult: { medium: 0.9, heavy: 0.5, air: 0.8, ship: 0.7, structure: 0.3 },
      turret: true,
      muzzleOffset: 45,
      bores: 2,
      boreSpacing: 8.4,
      sound: "mg"
    })],
    produces: ["engineer"],
    power: 10,
    metalRate: 0.5,
    requires: ["radar"],
    sound: "bld-hq",
    sprite: "u.hq2",
    turretSprite: "tur.hq2",
    turretMounts: [{ x: 26, y: -36 }]
  },
  extractor: {
    id: "extractor",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 120,
    buildTime: 10,
    pop: 0,
    hp: 600,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 5,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    metalRate: 1.4,
    needsDeposit: true,
    power: -4,
    upgradesTo: "extractor2",
    upgradeCost: 190,
    upgradeTime: 16,
    sprite: "u.extractor"
  },
  extractor2: {
    id: "extractor2",
    kind: "building",
    domain: "none",
    tier: 2,
    upgradeOnly: true,
    cost: 310,
    buildTime: 26,
    pop: 0,
    hp: 950,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 5,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    metalRate: 3,
    needsDeposit: true,
    power: -8,
    upgradesTo: "extractor3",
    upgradeCost: 500,
    upgradeTime: 30,
    sprite: "u.extractor2"
  },
  extractor3: {
    id: "extractor3",
    kind: "building",
    domain: "none",
    tier: 3,
    upgradeOnly: true,
    cost: 810,
    buildTime: 56,
    pop: 0,
    hp: 1700,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    metalRate: 8,
    needsDeposit: true,
    power: -15,
    sprite: "u.extractor3"
  },
  /**
   * The offshore rig: the extractor's line on its own legs over an ore field
   * at sea (`offshore`), laid from the water by the engineer boat — no
   * engineer stands on open sea and no aircraft sets one down there — and
   * worth exactly what the extractor at the same level
   * is: the same price, hit points, yield, draw and upgrades, so the only
   * question a field at sea asks is who holds the water round it. That is
   * the point of it (2026-09-27): with the ore on the islands a Pelican
   * could fly an engineer to, a side could skip the navy and win in the air;
   * a field in open water is mined by a fleet or not at all. An engineer
   * builds one too, where it can walk out to the field over a frozen sea
   * (`isRigTile`: the legs go down through the ice as through the water), and
   * never from a beach, since the maps keep three tiles of sea round every
   * field and its arms reach two. No turret stands on the water, so what
   * guards a rig is the ships anchored over it, which
   * since the same day shoot back at aircraft. The real thing is the Gulf's
   * and the Santa Barbara Channel's: platforms fought over by navies —
   * Nimble Archer and Praying Mantis in 1987 and 1988, the Ellwood field
   * shelled from a submarine in 1942. Exempt from the headquarters' ground
   * as an extractor is (`needsDeposit`); a naval gun, a missile or a bomb
   * reaches it, a torpedo does not (it is a building, `targetCat` ground).
   */
  platform: {
    id: "platform",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 120,
    buildTime: 10,
    pop: 0,
    hp: 600,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 5,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    metalRate: 1.4,
    needsDeposit: true,
    offshore: true,
    power: -4,
    upgradesTo: "platform2",
    upgradeCost: 190,
    upgradeTime: 16,
    sprite: "u.platform",
    sound: "bld-extractor"
  },
  platform2: {
    id: "platform2",
    kind: "building",
    domain: "none",
    tier: 2,
    upgradeOnly: true,
    cost: 310,
    buildTime: 26,
    pop: 0,
    hp: 950,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 5,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    metalRate: 3,
    needsDeposit: true,
    offshore: true,
    power: -8,
    upgradesTo: "platform3",
    upgradeCost: 500,
    upgradeTime: 30,
    sprite: "u.platform2",
    sound: "bld-extractor2"
  },
  platform3: {
    id: "platform3",
    kind: "building",
    domain: "none",
    tier: 3,
    upgradeOnly: true,
    cost: 810,
    buildTime: 56,
    pop: 0,
    hp: 1700,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    metalRate: 8,
    needsDeposit: true,
    offshore: true,
    power: -15,
    sprite: "u.platform3",
    sound: "bld-extractor3"
  },
  /**
   * The plant line is 20 / 50 / 150: each level a shade dearer per unit of
   * power than a fresh plant (7, 8 and 7.3 metal a point), so an upgrade is
   * bought for the ground it gives back and the fewer targets it leaves,
   * never because it is the cheaper power. It was 20 / 60 / 210, and the
   * core at 5.2 a point was the best bargain on the map: every base went
   * there and the Reactor was never built for its output.
   */
  power: {
    id: "power",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 140,
    buildTime: 12,
    pop: 0,
    hp: 500,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 5,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    power: 20,
    upgradesTo: "power2",
    upgradeCost: 260,
    upgradeTime: 18,
    sprite: "u.power"
  },
  power2: {
    id: "power2",
    kind: "building",
    domain: "none",
    tier: 2,
    upgradeOnly: true,
    cost: 400,
    buildTime: 30,
    pop: 0,
    hp: 900,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 5,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    power: 50,
    upgradesTo: "power3",
    upgradeCost: 700,
    upgradeTime: 36,
    sprite: "u.power2",
    sound: "bld-power"
  },
  power3: {
    id: "power3",
    kind: "building",
    domain: "none",
    tier: 3,
    upgradeOnly: true,
    cost: 1100,
    buildTime: 66,
    pop: 0,
    hp: 1800,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    power: 150,
    sprite: "u.power3",
    sound: "bld-power"
  },
  factory: {
    id: "factory",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 320,
    buildTime: 20,
    pop: 0,
    hp: 1500,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 45,
    fw: 3,
    fh: 3,
    weapons: [],
    power: -8,
    produces: ["engineer", "buggy", "ltank", "flak"],
    upgradesTo: "factory2",
    upgradeCost: 420,
    upgradeTime: 25,
    sprite: "u.factory",
    sound: "bld-extractor2"
  },
  factory2: {
    id: "factory2",
    kind: "building",
    domain: "none",
    tier: 2,
    upgradeOnly: true,
    cost: 740,
    buildTime: 45,
    pop: 0,
    hp: 2200,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 45,
    fw: 3,
    fh: 3,
    weapons: [],
    power: -12,
    produces: ["engineer", "buggy", "ltank", "flak", "mbt", "td", "sam", "arty", "drake", "gator", "htank", "radarcar", "hercules"],
    upgradesTo: "factory3",
    upgradeCost: 900,
    upgradeTime: 45,
    sprite: "u.factory2",
    sound: "bld-extractor2"
  },
  /**
   * Level 3. Each production line upgrades once more, in place, and the
   * upgrade needs a Radar Station (`requires`, checked by `cmdUpgrade` on the
   * target def) — the one gate Tier 3 has always had. The line produces
   * nothing while it upgrades, and 45–48 s at this stage is a wave: that
   * downtime is the real price. `cost` is cumulative, as on every upgraded
   * def, because the sell refund reads it.
   *
   * The Tempest is the Arsenal's since 2026-09-17, and the Drake the level
   * below's: the third level sold three specialists nobody bought while the
   * level under it sold the siege piece that took 22% of all value in the
   * first human records, so nobody upgraded. Now the line's second upgrade
   * is what the rocket artillery costs.
   */
  factory3: {
    id: "factory3",
    kind: "building",
    domain: "none",
    tier: 3,
    upgradeOnly: true,
    cost: 1640,
    buildTime: 90,
    pop: 0,
    hp: 3e3,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 7,
    radius: 45,
    fw: 3,
    fh: 3,
    weapons: [],
    power: -20,
    requires: ["radar"],
    produces: ["engineer", "buggy", "ltank", "flak", "mbt", "td", "sam", "arty", "drake", "gator", "htank", "radarcar", "hercules", "mlrs", "salamander", "bulwark", "scorpion"],
    sprite: "u.factory3",
    sound: "bld-extractor2"
  },
  airbase: {
    id: "airbase",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 380,
    buildTime: 24,
    pop: 0,
    hp: 1400,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 60,
    fw: 4,
    fh: 4,
    weapons: [],
    power: -8,
    // the scout and the lift; the Cobra is the Advanced Airbase's since
    // 2026-10-01, so the first attack helicopter is a tier-two decision
    produces: ["drone", "theli"],
    upgradesTo: "airbase2",
    upgradeCost: 450,
    upgradeTime: 26,
    sprite: "u.airbase"
  },
  airbase2: {
    id: "airbase2",
    kind: "building",
    domain: "none",
    tier: 2,
    upgradeOnly: true,
    cost: 830,
    buildTime: 50,
    pop: 0,
    hp: 2e3,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 60,
    fw: 4,
    fh: 4,
    weapons: [],
    power: -12,
    produces: ["drone", "heli", "theli", "fighter", "jet", "mjet", "bomber", "c47", "gunship", "hornet"],
    upgradesTo: "airbase3",
    upgradeCost: 950,
    upgradeTime: 48,
    sprite: "u.airbase2",
    sound: "bld-airbase"
  },
  airbase3: {
    id: "airbase3",
    kind: "building",
    domain: "none",
    tier: 3,
    upgradeOnly: true,
    cost: 1780,
    buildTime: 96,
    pop: 0,
    hp: 2700,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 7,
    radius: 60,
    fw: 4,
    fh: 4,
    weapons: [],
    power: -20,
    requires: ["radar"],
    produces: ["drone", "heli", "theli", "fighter", "jet", "mjet", "bomber", "c47", "gunship", "hornet", "wraith", "cormorant"],
    sprite: "u.airbase3",
    sound: "bld-airbase"
  },
  navyard: {
    id: "navyard",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 350,
    buildTime: 22,
    pop: 0,
    hp: 1500,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 45,
    fw: 3,
    fh: 3,
    weapons: [],
    power: -8,
    produces: ["engboat", "gunboat", "mboat", "seatrans"],
    upgradesTo: "navyard2",
    upgradeCost: 450,
    upgradeTime: 26,
    sprite: "u.navyard",
    sound: "unit-ship"
  },
  navyard2: {
    id: "navyard2",
    kind: "building",
    domain: "none",
    tier: 2,
    upgradeOnly: true,
    cost: 800,
    buildTime: 48,
    pop: 0,
    hp: 2200,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 45,
    fw: 3,
    fh: 3,
    weapons: [],
    power: -12,
    produces: ["engboat", "gunboat", "mboat", "seatrans", "frigate", "sub", "gator"],
    upgradesTo: "navyard3",
    upgradeCost: 950,
    upgradeTime: 48,
    sprite: "u.navyard2",
    sound: "unit-ship"
  },
  navyard3: {
    id: "navyard3",
    kind: "building",
    domain: "none",
    tier: 3,
    upgradeOnly: true,
    cost: 1750,
    buildTime: 96,
    pop: 0,
    hp: 3e3,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 7,
    radius: 45,
    fw: 3,
    fh: 3,
    weapons: [],
    power: -20,
    requires: ["radar"],
    produces: ["engboat", "gunboat", "mboat", "seatrans", "frigate", "sub", "gator", "btlship", "kraken", "moray", "carrier"],
    sprite: "u.navyard3",
    sound: "unit-ship"
  },
  /**
   * The MG Turret: a twin mount, and now firing like one.
   *
   * Both barrels were painted and only the middle of the gun ever shot, so
   * `bores` alternates them — `boreSpacing` is measured off `tur.mg`'s own
   * art, and a building is drawn 1:1 so that measurement is world px as it
   * stands. The cyclic rate went up with it (0.35 → 0.25 s, about a third
   * more damage a second): a gun feeding two barrels in turn is faster than
   * one feeding a single barrel, and the pad wanted the help. It stops short
   * of the Gatling it upgrades into, which reloads in 0.14 and has to stay
   * worth the upgrade.
   */
  mgturret: {
    id: "mgturret",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 130,
    buildTime: 10,
    pop: 0,
    hp: 400,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 8,
    radius: 14,
    fw: 1,
    fh: 1,
    power: -2,
    weapons: [w({
      id: "turretmg",
      cls: "mg",
      dmg: 10,
      reload: 0.25,
      range: 5,
      projectile: "bullet",
      speed: 500,
      targets: ["ground", "ship", "air"],
      mult: { ship: 0.6, structure: 0.3 },
      turret: true,
      muzzleOffset: 24.7,
      bores: 2,
      boreSpacing: 5.75,
      sound: "mg"
    })],
    upgradesTo: "gatling",
    upgradeCost: 200,
    upgradeTime: 16,
    sprite: "u.mgturret",
    turretSprite: "tur.mg",
    sound: "bld-cannonturret",
    turretMounts: [{ x: 0, y: -4 }]
  },
  gatling: {
    id: "gatling",
    kind: "building",
    domain: "none",
    tier: 2,
    upgradeOnly: true,
    cost: 330,
    buildTime: 26,
    pop: 0,
    hp: 700,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 8,
    radius: 14,
    fw: 1,
    fh: 1,
    power: -4,
    weapons: [w({
      id: "gatling",
      cls: "mg",
      dmg: 10,
      reload: 0.14,
      range: 6.5,
      projectile: "bullet",
      speed: 520,
      targets: ["ground", "ship", "air"],
      mult: { medium: 0.9, heavy: 0.5, air: 0.8, ship: 0.7, structure: 0.3 },
      turret: true,
      muzzleOffset: 27.2,
      sound: "mg"
    })],
    sprite: "u.gatling",
    turretSprite: "tur.gatling",
    sound: "bld-cannonturret",
    turretMounts: [{ x: 0, y: -5 }]
  },
  cannonturret: {
    id: "cannonturret",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 320,
    buildTime: 18,
    pop: 0,
    hp: 700,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 8,
    radius: 14,
    fw: 1,
    fh: 1,
    power: -3,
    weapons: [w({
      // static guns hit buildings softer than tanks do — no turret creep
      id: "cannon",
      cls: "cannon",
      dmg: 65,
      reload: 1.9,
      range: 6,
      projectile: "shell",
      speed: 420,
      targets: ["ground", "ship"],
      mult: { heavy: 1.1, structure: 0.6, ship: 1 },
      turret: true,
      muzzleOffset: 29,
      splash: 12,
      sound: "cannon"
    })],
    upgradesTo: "cannonturret2",
    upgradeCost: 340,
    upgradeTime: 22,
    sprite: "u.cannonturret",
    turretSprite: "tur.cannon",
    turretMounts: [{ x: 0, y: -4 }]
  },
  cannonturret2: {
    id: "cannonturret2",
    kind: "building",
    domain: "none",
    tier: 2,
    upgradeOnly: true,
    cost: 660,
    buildTime: 40,
    pop: 0,
    hp: 1500,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 9,
    radius: 14,
    fw: 1,
    fh: 1,
    power: -5,
    weapons: [w({
      id: "twincannon",
      cls: "cannon",
      dmg: 60,
      reload: 2,
      range: 7.5,
      projectile: "shell",
      speed: 420,
      targets: ["ground", "ship"],
      mult: { heavy: 1.2, structure: 0.6, ship: 1.1 },
      turret: true,
      muzzleOffset: 40,
      bores: 2,
      boreSpacing: 7,
      splash: 14,
      burst: 2,
      burstDelay: 0.2,
      sound: "cannon"
    })],
    sprite: "u.cannonturret2",
    turretSprite: "tur.cannon2"
  },
  aaturret: {
    id: "aaturret",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 400,
    buildTime: 14,
    pop: 0,
    hp: 600,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 9,
    radius: 14,
    fw: 1,
    fh: 1,
    power: -3,
    weapons: [w({
      id: "aaflak",
      cls: "aa",
      dmg: 33,
      reload: 0.8,
      range: 8,
      projectile: "flak",
      speed: 480,
      targets: ["air"],
      turret: true,
      muzzleOffset: 27.4,
      sound: "flak"
    })],
    upgradesTo: "samsite",
    upgradeCost: 600,
    upgradeTime: 20,
    sprite: "u.aaturret",
    turretSprite: "tur.aa",
    sound: "bld-cannonturret"
  },
  /**
   * The upgraded flak tower, and the one emplacement a nuclear warhead has to
   * answer to: `antiWarhead` lifts the rank gate that keeps every building
   * off one (`canEngageWarhead` in combat.ts), so a base that paid for its
   * strategic air defence gets a vote on the strike without a veteran Hawk
   * standing under the path. Its damage is what sets the price of that vote —
   * see nuke.test.ts for how many sites it takes.
   */
  samsite: {
    id: "samsite",
    kind: "building",
    domain: "none",
    tier: 2,
    upgradeOnly: true,
    cost: 1e3,
    buildTime: 34,
    pop: 0,
    hp: 800,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 11,
    radius: 14,
    fw: 1,
    fh: 1,
    power: -6,
    antiWarhead: true,
    weapons: [w({
      id: "samsite",
      cls: "aa",
      dmg: 170,
      reload: 2.6,
      range: 10,
      projectile: "missile",
      speed: 460,
      targets: ["air"],
      turret: true,
      muzzleOffset: 20.5,
      bores: 4,
      boreSpacing: 3.5,
      splash: 29,
      homing: true,
      sound: "missile"
    })],
    sprite: "u.samsite",
    turretSprite: "tur.samsite",
    sound: "bld-cannonturret"
  },
  /**
   * Point defence. It cannot shoot at anything on the ground: its rounds are
   * spent on incoming rockets and Viper missiles, one round per round shot
   * down. A nuclear warhead is not its business at either tier — that is an
   * aircraft, and anti-air (a veteran, or a SAM Site) shoots it down or
   * nothing does.
   * The magazine is one Tempest salvo (8 rockets) so a barrage is absorbed
   * whole, and the reload is what sets the duel: one launcher throws 8
   * rockets every 8s (1/s) and one tower replaces 1.33 rounds a second,
   * so a single Tempest never lands a rocket and a second one breaks
   * through. Anything faster here makes the tower unanswerable; anything
   * slower and one launcher grinds it down alone. See interceptor.test.ts.
   */
  interceptor: {
    id: "interceptor",
    kind: "building",
    domain: "none",
    tier: 2,
    cost: 450,
    buildTime: 24,
    pop: 0,
    hp: 600,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 9,
    radius: 14,
    fw: 1,
    fh: 1,
    power: -8,
    weapons: [],
    interceptRange: 7,
    interceptMag: 8,
    interceptReload: 0.75,
    interceptMuzzleOffset: 19,
    upgradesTo: "interceptor2",
    upgradeCost: 650,
    upgradeTime: 36,
    sprite: "u.interceptor",
    turretSprite: "tur.interceptor",
    sound: "bld-cannonturret"
  },
  interceptor2: {
    id: "interceptor2",
    kind: "building",
    domain: "none",
    tier: 3,
    upgradeOnly: true,
    cost: 1100,
    buildTime: 60,
    pop: 0,
    hp: 900,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 11,
    radius: 14,
    fw: 1,
    fh: 1,
    power: -12,
    weapons: [],
    interceptRange: 9,
    interceptMag: 12,
    interceptReload: 0.75,
    interceptMuzzleOffset: 21.5,
    sprite: "u.interceptor2",
    turretSprite: "tur.interceptor2",
    sound: "bld-cannonturret"
  },
  /**
   * The sandbag line: a tile of wall, and the cheapest hit points in the
   * game. It stands across a chokepoint so a column has to go round it or
   * shoot through it (`acquireTarget` puts it last on every gun's list, so
   * an attacker grinds through it only when nothing else is in reach), and
   * every tile laid beside another joins it — the sixteen joints are the
   * sheet's frames, picked off the neighbours (`game/walls.ts`). It has no
   * gun, draws no power (so a pulse leaves it standing), takes no
   * production slot, is built on the ground its headquarters hold like any
   * building, and comes down without a charge (`raze`). Structure armour:
   * a shell or a bomb takes it apart, small arms barely scratch it, which
   * is the point of stacking bags in front of a gun.
   */
  sandbag: {
    id: "sandbag",
    kind: "building",
    domain: "none",
    tier: 1,
    wall: true,
    cost: 40,
    buildTime: 4,
    pop: 0,
    hp: 500,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 3,
    radius: 14,
    fw: 1,
    fh: 1,
    weapons: [],
    sprite: "u.sandbag"
  },
  landmine: {
    id: "landmine",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 60,
    buildTime: 4,
    pop: 0,
    hp: 45,
    armor: "light",
    speed: 0,
    turnRate: 0,
    vision: 0,
    radius: 6,
    fw: 1,
    fh: 1,
    mine: 3,
    stealth: 0.5,
    weapons: [w({
      id: "mineblast",
      cls: "he",
      dmg: 200,
      reload: 1,
      range: 0.65,
      projectile: "shell",
      speed: 0,
      splash: 1.5 * 32,
      targets: ["ground"],
      mult: { light: 1.2, medium: 1, heavy: 0.25, structure: 0.1, ship: 0 }
    })],
    sprite: "u.landmine"
  },
  watermine: {
    id: "watermine",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 60,
    buildTime: 4,
    pop: 0,
    hp: 45,
    armor: "ship",
    speed: 0,
    turnRate: 0,
    vision: 0,
    radius: 6,
    fw: 1,
    fh: 1,
    mine: 3,
    stealth: 0.5,
    offshore: true,
    weapons: [w({
      id: "navalmineblast",
      cls: "he",
      dmg: 200,
      reload: 1,
      range: 0.65,
      projectile: "shell",
      speed: 0,
      splash: 1.5 * 32,
      targets: ["ship", "sub"],
      mult: { light: 1.2, medium: 1, heavy: 0.25, structure: 0, ship: 1, sub: 1, air: 0 }
    })],
    sprite: "u.watermine"
  },
  /**
   * One tile, like a gun pad: a base wants it beside the turret line and at
   * the staging point, and a 2×2 was a footprint that did not fit either.
   */
  repairtower: {
    id: "repairtower",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 360,
    buildTime: 20,
    pop: 0,
    hp: 750,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 7,
    radius: 14,
    fw: 1,
    fh: 1,
    weapons: [],
    power: -8,
    repairRange: 5.5,
    repairRate: 20,
    repairTargets: 3,
    sprite: "u.repairtower"
  },
  /**
   * The radar lifts the fog for 24 tiles round it — three times a turret's
   * sight and the largest circle in the game, so one in the base shows the
   * whole approach and every gun and battery inside the circle fires at
   * what it could never see for itself. Short of power it falls back to a
   * turret's sight (`updateFog`).
   */
  radar: {
    id: "radar",
    kind: "building",
    domain: "none",
    tier: 2,
    cost: 400,
    buildTime: 20,
    pop: 0,
    hp: 800,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 24,
    radius: 30,
    fw: 2,
    fh: 2,
    // and it sees through stealth: a Wraith is visible within 8 tiles of it
    weapons: [],
    power: -8,
    detect: 8,
    radar: true,
    sprite: "u.radar",
    turretSprite: "tur.radar",
    turretSpins: true
  },
  /**
   * The War Lab researches the tech tree (`game/tech.ts`): the doctrine a
   * faction fights by, the units and abilities it unlocks, and the economy
   * buffs any doctrine may take. One a faction (`unique`); what it has
   * researched stays researched when it falls, and only the head of its
   * queue is lost. A Tier-1 building, since the doctrine is a minute-three
   * decision; it draws a plant's worth of power, so the research is slowed
   * by a shortage as a factory's work is.
   */
  warlab: {
    id: "warlab",
    kind: "building",
    domain: "none",
    tier: 1,
    unique: true,
    lab: true,
    cost: 500,
    buildTime: 30,
    pop: 0,
    hp: 1200,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    power: -10,
    sprite: "u.warlab",
    sound: "bld-radar"
  },
  veil: {
    id: "veil",
    kind: "building",
    domain: "none",
    tier: 2,
    cost: 600,
    buildTime: 35,
    pop: 0,
    hp: 900,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    power: -20,
    requires: ["radar"],
    jamRange: 8,
    sprite: "u.veil",
    turretSprite: "tur.veil",
    turretSpins: true
  },
  /**
   * The reactor breeds the cores a warhead is built round: with a radar it is
   * what a silo needs to be built, and what a silo or a submarine needs to
   * fabricate and fire. It feeds the grid as well, though dearer per unit of
   * power than the plant line, which it does not replace.
   */
  reactor: {
    id: "reactor",
    kind: "building",
    domain: "none",
    tier: 3,
    cost: 1400,
    buildTime: 60,
    pop: 0,
    hp: 2200,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 44,
    fw: 3,
    fh: 3,
    weapons: [],
    power: 100,
    requires: ["radar"],
    sprite: "u.reactor",
    sound: "bld-extractor2"
  },
  /**
   * A silo the way one is in the ground: two tiles of concrete over one
   * shaft, a hatch that takes `hatch` seconds to slide open before the
   * warhead leaves (`Game.tickHatch`), and three warheads in the magazine.
   */
  nukesilo: {
    id: "nukesilo",
    kind: "building",
    domain: "none",
    tier: 3,
    cost: 1800,
    buildTime: 75,
    pop: 0,
    hp: 1800,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 7,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    power: -40,
    requires: ["radar", "reactor", "nuclearProgram"],
    nukeCapacity: 3,
    nukeCost: 2500,
    nukeTime: 180,
    hatch: 1.2,
    sprite: "u.nukesilo",
    sound: "bld-extractor2"
  }
};
const ALL_DEF_IDS = Object.keys(DEFS);
const VANILLA_DEF_IDS = new Set(ALL_DEF_IDS);
function getDef(id) {
  const d = DEFS[id];
  if (!d) throw new Error(`unknown def: ${id}`);
  return d;
}
function mapUnitRect(u) {
  const def = getDef(u.id);
  return def.kind === "building" ? { x: u.x, y: u.y, fw: def.fw ?? 1, fh: def.fh ?? 1 } : { x: u.x, y: u.y, fw: 1, fh: 1 };
}
function normalizeTerrainLayers(m) {
  for (let i = 0; i < m.terrain.length; i++) if (m.terrain[i] === Terrain.Bridge) {
    (m.overlays ??= new Uint8Array(m.w * m.h))[i] = Terrain.Bridge;
    m.terrain[i] = Terrain.Water;
  }
}
const DECOR = {
  pole: { fw: 1, fh: 1, sprite: "d.pole", color: [96, 78, 58], hp: 20, shadow: 6 },
  tower: { fw: 1, fh: 1, sprite: "d.tower", color: [76, 80, 86], hp: 90, shadow: 14 },
  /** a date palm: the one tree that stands on sand, an obstacle a tile wide; three drawings, mixed */
  palm: { fw: 1, fh: 1, sprite: "d.palm", color: [86, 120, 60], hp: 40, variants: 3, shadow: 9 },
  /** a canvas field tent, sandbagged: the camp round a staging post */
  tent: { fw: 2, fh: 2, sprite: "d.tent", color: [128, 116, 84], hp: 90 },
  /** an arched aircraft shelter of concrete: what an airfield keeps beside its strip */
  hangar: { fw: 3, fh: 2, sprite: "d.hangar", color: [112, 108, 100], hp: 260 },
  /** a concrete bunker, half buried, the firing slit facing south */
  bunker: { fw: 2, fh: 2, sprite: "d.bunker", color: [98, 94, 86], hp: 340 },
  /**
   * A cargo ship going down by the stern, the bow still up and the boxes
   * sliding off her deck: what the open sea is dressed with. Four tiles long
   * and two across, lying north to south with the bow to the north; a hull,
   * so it takes a broadside to finish, and what finishes it is the sea
   * (`razeDecor`). The wash round her is the renderer's (the idle ripple a
   * ship at rest gets, `render/trails.ts`), not the sheet's.
   */
  freighter: { fw: 2, fh: 4, sprite: "d.freighter", water: true, color: [96, 60, 44], hp: 320 },
  /**
   * The same wreck lying east to west, the bow to the west: a kind of its own
   * rather than a variant, since a variant shares its kind's footprint and
   * this one is the footprint turned. Two on a map, one each way, and the
   * sea stops looking stamped.
   */
  freighter2: { fw: 4, fh: 2, sprite: "d.freighter2", water: true, color: [96, 60, 44], hp: 320 }
};
const RETIRED_DECOR = ["derrick"];
function isDecorKind(k) {
  return typeof k === "string" && Object.prototype.hasOwnProperty.call(DECOR, k);
}
function rleEncode(a) {
  const out = [];
  let i = 0;
  while (i < a.length) {
    const v = a[i];
    let run = 1;
    while (i + run < a.length && a[i + run] === v && run < 255) run++;
    out.push(run, v);
    i += run;
  }
  let s = "";
  for (let k = 0; k < out.length; k += 4096) {
    s += String.fromCharCode(...out.slice(k, k + 4096));
  }
  return btoa(s);
}
function rleDecode(s, len) {
  return rleDecodeInto(s, new Uint8Array(len));
}
function rleDecodeInto(s, out) {
  const len = out.length;
  if (!s) {
    out.fill(0);
    return out;
  }
  const raw = atob(s);
  let oi = 0;
  for (let i = 0; i + 1 < raw.length; i += 2) {
    const run = raw.charCodeAt(i);
    const v = raw.charCodeAt(i + 1);
    out.fill(v, oi, Math.min(len, oi + run));
    oi += run;
  }
  if (oi < len) out.fill(0, oi);
  return out;
}
const TERRAIN_BASES = Object.freeze({
  grass: Terrain.Grass,
  sand: Terrain.Sand,
  road: Terrain.Road,
  mud: Terrain.Mud,
  marsh: Terrain.Marsh,
  snow: Terrain.Snow,
  rubble: Terrain.Rubble,
  ice: Terrain.Ice,
  city: Terrain.City
});
const VARIANT_ID_RE = /^[a-z0-9][a-z0-9_-]{1,39}$/;
function readTerrainAssignments(value, path, issues) {
  if (value === void 0) return void 0;
  const start = issues.length;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    issues.push({ path, message: "must be an object of terrain base → variant id" });
    return void 0;
  }
  const entries = Object.entries(value);
  if (entries.length > Object.keys(TERRAIN_BASES).length) {
    issues.push({ path, message: `at most ${Object.keys(TERRAIN_BASES).length} terrain bindings` });
    return void 0;
  }
  const out = {};
  for (const [base, id] of entries) {
    if (!Object.hasOwn(TERRAIN_BASES, base)) issues.push({ path: `${path}.${base}`, message: "unsupported terrain base" });
    else if (typeof id !== "string" || !VARIANT_ID_RE.test(id) || !id.includes("-"))
      issues.push({ path: `${path}.${base}`, message: "must be a namespaced terrain variant id, 2–40 characters" });
    else out[base] = id;
  }
  return issues.length === start && entries.length > 0 ? out : void 0;
}
const CUSTOM_MAP_FORMAT = "steel-tide-map";
const CUSTOM_MAP_VERSION = 1;
const CUSTOM_MAP_EXT = ".steel-tide-map";
const MAX_DEPOSITS = 400;
const MAX_DECOR = 4e3;
const MAX_MAP_UNITS = 400;
const MAX_NAME_LENGTH = 48;
const MAX_DESCRIPTION_LENGTH = 240;
const MAP_LANG_RE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/;
const MAX_TRANSLATIONS = 16;
function isMapUnitId(id, only) {
  return (only ? only.has(id) : id in DEFS) && !DEFS[id]?.warhead;
}
function encodeMapUnit(u) {
  return { id: u.id, owner: u.owner, x: u.x, y: u.y, ...u.a !== void 0 ? { a: u.a } : {} };
}
function encodeCustomMap(map, name, description = "", translations) {
  map = { ...map, terrain: map.terrain.slice(), overlays: map.overlays?.slice() };
  normalizeTerrainLayers(map);
  const blurb = cleanDescription(description);
  const given = cleanTranslations(translations);
  return {
    format: CUSTOM_MAP_FORMAT,
    v: CUSTOM_MAP_VERSION,
    name: cleanName(name),
    ...blurb ? { description: blurb } : {},
    ...given ? { translations: given } : {},
    w: map.w,
    h: map.h,
    terrain: rleEncode(map.terrain),
    ...map.terrainVariants && Object.keys(map.terrainVariants).length ? { terrainVariants: { ...map.terrainVariants } } : {},
    ...map.overlays?.some(Boolean) ? { overlays: rleEncode(map.overlays) } : {},
    deposits: map.deposits.map((d) => ({ x: d.x, y: d.y })),
    spawns: map.spawns.map((s) => ({ x: s.x, y: s.y })),
    ...map.decor?.length ? { decor: map.decor.map((d) => ({ kind: d.kind, x: d.x, y: d.y })) } : {},
    ...map.units?.length ? { units: map.units.map(encodeMapUnit) } : {}
  };
}
function customMapToGameMap(data, lang) {
  const map = {
    nameKey: lang ? mapText(data, lang).name : data.name,
    w: data.w,
    h: data.h,
    terrain: rleDecode(data.terrain, data.w * data.h),
    ...data.terrainVariants && Object.keys(data.terrainVariants).length ? { terrainVariants: { ...data.terrainVariants } } : {},
    ...data.overlays ? { overlays: rleDecode(data.overlays, data.w * data.h) } : {},
    deposits: data.deposits.map((d) => ({ x: d.x, y: d.y })),
    spawns: data.spawns.map((s) => ({ x: s.x, y: s.y })),
    ...data.decor?.length ? { decor: data.decor.map((d) => ({ kind: d.kind, x: d.x, y: d.y })) } : {},
    ...data.units?.length ? { units: data.units.map(encodeMapUnit) } : {}
  };
  normalizeTerrainLayers(map);
  return map;
}
function readDecor(list, w2, h) {
  if (list === void 0) return [];
  if (!Array.isArray(list)) return "bad props";
  if (list.length > MAX_DECOR) return "too many props";
  const taken = new Uint8Array(w2 * h);
  const out = [];
  for (const item of list) {
    if (!item || typeof item !== "object") return "bad props";
    const { kind, x, y } = item;
    if (typeof kind === "string" && RETIRED_DECOR.includes(kind)) continue;
    if (!isDecorKind(kind)) return "the map uses a prop this build does not know";
    const def = DECOR[kind];
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x + def.fw > w2 || y + def.fh > h) {
      return "a prop lies outside the map";
    }
    const tx = x, ty = y;
    let free = true;
    for (let yy = ty; yy < ty + def.fh && free; yy++) {
      for (let xx = tx; xx < tx + def.fw; xx++) if (taken[yy * w2 + xx]) {
        free = false;
        break;
      }
    }
    if (!free) continue;
    for (let yy = ty; yy < ty + def.fh; yy++) for (let xx = tx; xx < tx + def.fw; xx++) taken[yy * w2 + xx] = 1;
    out.push({ kind, x: tx, y: ty });
  }
  return out;
}
function readUnits(list, w2, h, only) {
  if (list === void 0) return [];
  if (!Array.isArray(list)) return "bad units";
  if (list.length > MAX_MAP_UNITS) return "too many units";
  const taken = new Uint8Array(w2 * h);
  const out = [];
  for (const item of list) {
    if (!item || typeof item !== "object") return "bad units";
    const { id, owner, x, y, a } = item;
    if (typeof id !== "string" || !isMapUnitId(id, only)) return "the map stands a unit this build does not know";
    if (!Number.isInteger(owner) || owner < 0 || owner >= MAX_PLAYERS) return "a unit belongs to no faction";
    if (!Number.isInteger(x) || !Number.isInteger(y)) return "bad units";
    const r = mapUnitRect({ id, x, y });
    if (r.x < 0 || r.y < 0 || r.x + r.fw > w2 || r.y + r.fh > h) return "a unit lies outside the map";
    let facing;
    if (a !== void 0 && DEFS[id].kind === "unit") {
      if (!Number.isInteger(a) || a < 0 || a >= 360) return "bad units";
      facing = a;
    }
    let free = true;
    for (let yy = r.y; yy < r.y + r.fh && free; yy++) {
      for (let xx = r.x; xx < r.x + r.fw; xx++) if (taken[yy * w2 + xx]) {
        free = false;
        break;
      }
    }
    if (!free) continue;
    for (let yy = r.y; yy < r.y + r.fh; yy++) for (let xx = r.x; xx < r.x + r.fw; xx++) taken[yy * w2 + xx] = 1;
    out.push({ id, owner, x: r.x, y: r.y, ...facing !== void 0 ? { a: facing } : {} });
  }
  return out;
}
function cleanLine(name) {
  return name.replace(/[\r\n\t]+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
}
function cleanName(name) {
  return cleanLine(name) || "Untitled";
}
function cleanDescription(text) {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_DESCRIPTION_LENGTH);
}
function cleanTranslations(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return void 0;
  const out = {};
  let n = 0;
  for (const [key, given] of Object.entries(v)) {
    const lang = key.toLowerCase();
    if (!MAP_LANG_RE.test(lang) || lang in out || !given || typeof given !== "object") continue;
    const { name, description } = given;
    const text = {};
    const line = typeof name === "string" ? cleanLine(name) : "";
    if (line) text.name = line;
    const blurb = typeof description === "string" ? cleanDescription(description) : "";
    if (blurb) text.description = blurb;
    if (!text.name && !text.description) continue;
    if (++n > MAX_TRANSLATIONS) break;
    out[lang] = text;
  }
  return n ? out : void 0;
}
function mapText(data, lang) {
  const own = data.translations?.[lang.toLowerCase()];
  const en = data.translations?.en;
  return {
    name: own?.name ?? en?.name ?? data.name,
    description: own?.description ?? en?.description ?? data.description ?? ""
  };
}
function parseCustomMap(json, opts = {}) {
  if (typeof json !== "string" || json.length === 0 || json.length > 4 * 1024 * 1024) {
    return { ok: false, error: "the file is empty or too large" };
  }
  let raw;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: "not a map file" };
  }
  if (!raw || typeof raw !== "object") return { ok: false, error: "not a map file" };
  const r = raw;
  if (r.format !== CUSTOM_MAP_FORMAT) return { ok: false, error: "not a Steel Tide map" };
  if (r.v !== CUSTOM_MAP_VERSION) return { ok: false, error: `unsupported map version ${String(r.v)}` };
  if (!Number.isInteger(r.w) || !Number.isInteger(r.h) || r.w < MIN_MAP_SIDE || r.h < MIN_MAP_SIDE || r.w > MAX_MAP_SIDE || r.h > MAX_MAP_SIDE) {
    return { ok: false, error: `the map must be ${MIN_MAP_SIDE}–${MAX_MAP_SIDE} tiles a side` };
  }
  const w2 = r.w, h = r.h;
  if (typeof r.terrain !== "string" || r.terrain.length > 2 * 1024 * 1024) return { ok: false, error: "bad terrain data" };
  let terrain;
  try {
    terrain = rleDecode(r.terrain, w2 * h);
  } catch {
    return { ok: false, error: "bad terrain data" };
  }
  for (let i = 0; i < terrain.length; i++) {
    if (terrain[i] >= TERRAIN_KINDS) return { ok: false, error: "the map uses a terrain this build does not know" };
  }
  const variantIssues = [];
  const terrainVariants = readTerrainAssignments(r.terrainVariants, "terrainVariants", variantIssues);
  if (variantIssues.length) return { ok: false, error: `${variantIssues[0].path}: ${variantIssues[0].message}` };
  let overlays;
  if (r.overlays !== void 0) {
    if (typeof r.overlays !== "string") return { ok: false, error: "bad overlay data" };
    try {
      overlays = rleDecode(r.overlays, w2 * h);
    } catch {
      return { ok: false, error: "bad overlay data" };
    }
    if (overlays.some((t) => t !== 0 && t !== Terrain.Bridge)) return { ok: false, error: "the map uses an overlay this build does not know" };
  }
  const layers = { w: w2, h, terrain, overlays };
  normalizeTerrainLayers(layers);
  overlays = layers.overlays;
  const points2 = (list, max, what) => {
    if (list === void 0) return [];
    if (!Array.isArray(list)) return `bad ${what}`;
    if (list.length > max) return `too many ${what}`;
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const p of list) {
      if (!p || typeof p !== "object") return `bad ${what}`;
      const { x, y } = p;
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= w2 || y >= h) {
        return `a ${what.replace(/s$/, "")} lies outside the map`;
      }
      const key = y * w2 + x;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ x, y });
    }
    return out;
  };
  const deposits = points2(r.deposits, MAX_DEPOSITS, "deposits");
  if (typeof deposits === "string") return { ok: false, error: deposits };
  const spawns = points2(r.spawns, MAX_PLAYERS, "spawns");
  if (typeof spawns === "string") return { ok: false, error: spawns };
  const decor = readDecor(r.decor, w2, h);
  if (typeof decor === "string") return { ok: false, error: decor };
  const units = readUnits(r.units, w2, h, opts.only);
  if (typeof units === "string") return { ok: false, error: units };
  const description = cleanDescription(typeof r.description === "string" ? r.description : "");
  const translations = cleanTranslations(r.translations);
  const author = typeof r.author === "string" ? cleanLine(r.author) : "";
  return {
    ok: true,
    data: {
      format: CUSTOM_MAP_FORMAT,
      v: CUSTOM_MAP_VERSION,
      name: cleanName(typeof r.name === "string" ? r.name : ""),
      ...author ? { author } : {},
      ...description ? { description } : {},
      ...translations ? { translations } : {},
      w: w2,
      h,
      terrain: rleEncode(terrain),
      ...terrainVariants ? { terrainVariants } : {},
      ...overlays?.some(Boolean) ? { overlays: rleEncode(overlays) } : {},
      deposits,
      spawns,
      ...decor.length ? { decor } : {},
      ...units.length ? { units } : {}
    }
  };
}
const MAP_REGISTRY_REPO = "steel-tide/maps";
const MAP_REGISTRY_WEB = `https://github.com/${MAP_REGISTRY_REPO}`;
const MAP_REGISTRY_URL = `https://raw.githubusercontent.com/${MAP_REGISTRY_REPO}/main/index.json`;
const MAP_REGISTRY_DIR = "maps";
const MAP_REGISTRY_RELEASE = "registry";
const MAP_REGISTRY_COUNTS_URL = `https://api.github.com/repos/${MAP_REGISTRY_REPO}/releases/tags/${MAP_REGISTRY_RELEASE}`;
function mapFileUrl(slug) {
  return `https://raw.githubusercontent.com/${MAP_REGISTRY_REPO}/main/${MAP_REGISTRY_DIR}/${slug}${CUSTOM_MAP_EXT}`;
}
function mapCountUrl(slug) {
  return `${MAP_REGISTRY_WEB}/releases/download/${MAP_REGISTRY_RELEASE}/${slug}${CUSTOM_MAP_EXT}`;
}
function mapPageUrl(slug) {
  return `${MAP_REGISTRY_WEB}/blob/main/${MAP_REGISTRY_DIR}/${slug}${CUSTOM_MAP_EXT}`;
}
const PUBLISH_URL_BUDGET = 6e3;
function mapPublishUrl(slug, contents) {
  const base = `${MAP_REGISTRY_WEB}/new/main/${MAP_REGISTRY_DIR}?filename=${encodeURIComponent(slug + CUSTOM_MAP_EXT)}`;
  if (contents === void 0) return base;
  const url = `${base}&value=${encodeURIComponent(contents)}`;
  return url.length <= PUBLISH_URL_BUDGET ? url : base;
}
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = MAX_NAME_LENGTH;
function slugify(name) {
  const flat = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const slug = flat.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, MAX_SLUG_LENGTH).replace(/-+$/, "");
  if (slug) return slug;
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  return `map-${(h >>> 0).toString(16).padStart(8, "0").slice(0, 6)}`;
}
const THUMB_MAX = 64;
function thumbOf(data) {
  const scale = Math.min(1, THUMB_MAX / Math.max(data.w, data.h));
  const w2 = Math.max(1, Math.round(data.w * scale)), h = Math.max(1, Math.round(data.h * scale));
  const tiles = rleDecode(data.terrain, data.w * data.h);
  if (data.overlays) {
    const overlays = rleDecode(data.overlays, tiles.length);
    for (let i = 0; i < tiles.length; i++) if (overlays[i]) tiles[i] = overlays[i];
  }
  const kinds = TERRAIN_KINDS;
  const votes = new Uint16Array(w2 * h * kinds);
  for (let y = 0; y < data.h; y++) {
    const cy = Math.min(h - 1, Math.floor(y * h / data.h));
    for (let x = 0; x < data.w; x++) {
      const cx = Math.min(w2 - 1, Math.floor(x * w2 / data.w));
      votes[(cy * w2 + cx) * kinds + tiles[y * data.w + x]]++;
    }
  }
  const terrain = new Uint8Array(w2 * h);
  for (let c = 0; c < w2 * h; c++) {
    let best = 0;
    for (let k = 1; k < kinds; k++) if (votes[c * kinds + k] > votes[c * kinds + best]) best = k;
    terrain[c] = best;
  }
  const at = (p) => ({
    x: Math.min(w2 - 1, Math.floor(p.x * w2 / data.w)),
    y: Math.min(h - 1, Math.floor(p.y * h / data.h))
  });
  return { w: w2, h, terrain: rleEncode(terrain), spawns: data.spawns.map(at), deposits: data.deposits.map(at) };
}
function thumbToMap(thumb, name) {
  return {
    nameKey: name,
    w: thumb.w,
    h: thumb.h,
    terrain: rleDecode(thumb.terrain, thumb.w * thumb.h),
    deposits: thumb.deposits.map((d) => ({ ...d })),
    spawns: thumb.spawns.map((s) => ({ ...s }))
  };
}
function indexEntryFor(data, slug, extra = {}) {
  const author = data.author || extra.author;
  return {
    slug,
    name: data.name,
    ...data.description ? { description: data.description } : {},
    ...data.translations ? { translations: data.translations } : {},
    ...author ? { author } : {},
    w: data.w,
    h: data.h,
    spawns: data.spawns.length,
    deposits: data.deposits.length,
    decor: data.decor?.length ?? 0,
    ...extra.updated ? { updated: extra.updated } : {},
    ...extra.downloads !== void 0 ? { downloads: extra.downloads } : {},
    thumb: thumbOf(data)
  };
}
function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function points(list, w2, h) {
  if (!Array.isArray(list)) return null;
  const out = [];
  for (const p of list) {
    if (!isPlainObject(p) || !Number.isInteger(p.x) || !Number.isInteger(p.y)) return null;
    const x = p.x, y = p.y;
    if (x < 0 || y < 0 || x >= w2 || y >= h) return null;
    out.push({ x, y });
  }
  return out;
}
function parseMapIndex(json) {
  let raw = json;
  if (typeof json === "string") {
    try {
      raw = JSON.parse(json);
    } catch {
      return null;
    }
  }
  if (!isPlainObject(raw) || raw.format !== "steel-tide-map-index" || !Array.isArray(raw.maps)) return null;
  const maps = [];
  for (const m of raw.maps) {
    if (!isPlainObject(m) || typeof m.slug !== "string" || !SLUG_RE.test(m.slug) || typeof m.name !== "string") continue;
    if (!Number.isInteger(m.w) || !Number.isInteger(m.h) || !Number.isInteger(m.spawns)) continue;
    if (m.w < MIN_MAP_SIDE || m.h < MIN_MAP_SIDE || m.w > MAX_MAP_SIDE || m.h > MAX_MAP_SIDE) continue;
    const t = m.thumb;
    if (!isPlainObject(t) || !Number.isInteger(t.w) || !Number.isInteger(t.h) || typeof t.terrain !== "string") continue;
    const tw = t.w, th = t.h;
    if (tw < 1 || th < 1 || tw > THUMB_MAX || th > THUMB_MAX) continue;
    let terrain;
    try {
      terrain = rleDecode(t.terrain, tw * th);
    } catch {
      continue;
    }
    if (terrain.some((v) => v >= TERRAIN_KINDS)) continue;
    const spawns = points(t.spawns, tw, th), deposits = points(t.deposits, tw, th);
    if (!spawns || !deposits) continue;
    const translations = cleanTranslations(m.translations);
    maps.push({
      slug: m.slug,
      name: cleanName(m.name),
      ...typeof m.description === "string" && m.description ? { description: cleanDescription(m.description) } : {},
      ...translations ? { translations } : {},
      ...typeof m.author === "string" && m.author ? { author: m.author.slice(0, 80) } : {},
      w: m.w,
      h: m.h,
      spawns: m.spawns,
      deposits: Number.isInteger(m.deposits) ? m.deposits : 0,
      decor: Number.isInteger(m.decor) ? m.decor : 0,
      ...typeof m.updated === "string" ? { updated: m.updated } : {},
      ...Number.isInteger(m.downloads) ? { downloads: m.downloads } : {},
      thumb: { w: tw, h: th, terrain: t.terrain, spawns, deposits }
    });
  }
  return { format: "steel-tide-map-index", v: 1, generated: typeof raw.generated === "string" ? raw.generated : "", maps };
}
function mapMatches(entry, query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const other = Object.values(entry.translations ?? {}).flatMap((x) => [x.name ?? "", x.description ?? ""]);
  const hay = [entry.name, entry.description ?? "", ...other, entry.author ?? "", entry.slug].join("\n").toLowerCase();
  return words.every((word) => hay.includes(word));
}
const MAX_MAP_FILE_BYTES = 512 * 1024;
function checkMapFile(json, filename) {
  if (new TextEncoder().encode(json).byteLength > MAX_MAP_FILE_BYTES) return { ok: false, reason: "size", error: `the file is over ${MAX_MAP_FILE_BYTES / 1024} KB` };
  const parsed = parseCustomMap(json, { only: VANILLA_DEF_IDS });
  if (!parsed.ok) return { ok: false, reason: "parse", error: parsed.error };
  const data = parsed.data;
  if (data.name === "Untitled") return { ok: false, reason: "name", error: "the map needs a name of its own" };
  if (!data.description) return { ok: false, reason: "description", error: "the map needs a description: a line or two on what kind of fight it is" };
  if (data.spawns.length < 2) return { ok: false, reason: "spawns", error: "a map needs at least two spawn points to be played" };
  let slug = slugify(data.name);
  if (filename !== void 0) {
    const base = filename.replace(/^.*[\\/]/, "");
    if (!base.endsWith(CUSTOM_MAP_EXT)) return { ok: false, reason: "slug", error: `the file must be named <slug>${CUSTOM_MAP_EXT}` };
    slug = base.slice(0, -CUSTOM_MAP_EXT.length);
    if (!SLUG_RE.test(slug) || slug.length > MAX_SLUG_LENGTH) return { ok: false, reason: "slug", error: `"${slug}" is not a slug: lower-case letters, digits and single hyphens` };
  }
  return { ok: true, data, slug };
}
export {
  CUSTOM_MAP_EXT,
  CUSTOM_MAP_FORMAT,
  CUSTOM_MAP_VERSION,
  MAP_LANG_RE,
  MAP_REGISTRY_COUNTS_URL,
  MAP_REGISTRY_DIR,
  MAP_REGISTRY_RELEASE,
  MAP_REGISTRY_REPO,
  MAP_REGISTRY_URL,
  MAP_REGISTRY_WEB,
  MAX_DESCRIPTION_LENGTH,
  MAX_MAP_FILE_BYTES,
  MAX_NAME_LENGTH,
  MAX_SLUG_LENGTH,
  MAX_TRANSLATIONS,
  SLUG_RE,
  THUMB_MAX,
  checkMapFile,
  cleanDescription,
  cleanLine,
  cleanName,
  cleanTranslations,
  customMapToGameMap,
  encodeCustomMap,
  indexEntryFor,
  mapCountUrl,
  mapFileUrl,
  mapMatches,
  mapPageUrl,
  mapPublishUrl,
  mapText,
  parseCustomMap,
  parseMapIndex,
  slugify,
  thumbOf,
  thumbToMap
};

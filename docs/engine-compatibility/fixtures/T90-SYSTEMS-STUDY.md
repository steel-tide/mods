# T-90M systems fixture

`t90-systems-study.steel-tide-mod` is a standalone format-3 acceptance fixture for `components-v1` and `logistics-v1`. It is separate from the playable `mods/usgr-re` pack. It uses inherited vanilla art and a synthetic test projectile to exercise a selected source-data subset; it is not a finished T-90M port or a claim of full combat parity.

The source tree is `rusted-warfare-mods/usgr-re` in this repository:

- `阵营单位/1.俄罗斯联邦/3.坦克及重型装甲车辆/T-90M/T90M.ini`: 35° front/rear half-angle; KE 600/100/60, CE 650/150/60; extra KE 300/200/0, extra CE 700/700/0; 100-point track/engine/driver/gunner components, one reserve crew member; 8-second field work, 5-second crew move, 18-second crew replenishment; 20 AP, 18 HE, 10 guided rounds; 390 RW frames / 60 = 6.5-second main reload.
- `tem/tank.key`: damaged threshold 65%; speed multipliers track 0.8, engine 0.8, driver 0.5; destroyed drive components stop movement; gunner injury adds 0.1 base reload. Disabled track/engine recover to 65% damage after 8 seconds. Full repair uses `1.3 × 8 = 10.4` seconds. Driver/gunner work needs a repair provider within 240 RW distance units. A hit retains half repair progress. Crew moves prioritize the gunner and preserve an individual rather than manufacturing an additional living seat.
- `模板/坦克模板.key`: 10-second ammunition/protection replenishment at the service provider. It restores stock rather than withdrawing a finite resource, so this fixture explicitly uses timed `refill`, not `transfer`.
- `弹药/RUS/穿甲弹/3BM60.ini` and `tem/ap.key`: base penetration 700, component strength 85, diameter coefficient 0.696, fractional layer loss `0.696 × 85 / 180`. The controlled test payload uses the independent strong/weak component branches to test the engine contract.

Distances follow the existing port's 0.4 world-pixel conversion: 240 RW units becomes 96 world pixels / 3 Steel Tide tiles. The fixture's ordinary hull/weapon presentation values are test scaffolding. HE and missile inventory slots are retained to test complete resupply, but they have no firing weapon in this fixture.

The fixture deliberately leaves out the ammunition rack. Its source threshold is `175 + 175/48 × rounds fired`; a fixed 175-point part would misrepresent it. It also omits the reserve pool's incoming damage calculation, occupied-seat exchanges, linked turn-rate formula `0.5 + 0.5 × combined speed multiplier`, morale/experience/target-dependent hit policy, full source range/jitter/ricochet behavior, HE and guided payloads, APS, and gun-station articulation. The reserve seat has no incoming damage channel in this isolated fixture. None of those omissions is replaced with a claimed equivalent.

The game validator must prepare the lazy v3 schema before parsing:

```ts
await prepareContentSchema(raw);
const parsed = parseDefinitionPack(raw);
if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
const resolved = resolveDefinitions(parsed.pack);
if (resolved.errors.length) throw new Error(JSON.stringify(resolved.errors));
```

After validation and `prepareContentCapabilities`, activate the pack and create a normal match. Place the fixture hulls on opposing teams and an allied fixture workshop nearby. The shared module inspection/action interface exposes local labels for damaged parts, ammunition, timed repair and resupply. Common orders cover repair, crew reassignment, cancellation and provider-targeted supply. Focused engine tests additionally cover finite transfer, shielding, shared feed switching, save continuation and privacy; those generic policies are not claimed as this vehicle's original behavior.

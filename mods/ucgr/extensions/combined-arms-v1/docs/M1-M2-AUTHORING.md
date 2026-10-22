# Components and logistics: format 4 authoring

These are the contracts of UCGR's own
[`combined-arms` extension](../README.md), loaded through the
[generic host](../../../../../docs/EXTENSION-FRAMEWORK.md). UCGR's format-4
manifest embeds its descriptor in `extensionPackages`; fragments below omit
the descriptor's source strings. These capability IDs and schemas belong to
this implementation. Another mod can supply its own contracts through the host.
This guide and its fixtures remain part of the ignored local UCGR draft.
Additional accepted T-90M policies are documented in
[M1-SOURCE-POLICIES.md](M1-SOURCE-POLICIES.md).

These optional UCGR modules are enabled by a definition pack's `requiredCapabilities`. Put a capability's configuration under `extensions[capabilityId]` on a definition or weapon. A pack must declare every capability it uses. The format-4 reader rejects unknown fields, invalid references, non-finite values and over-sized collections; the capability configuration has no executable script field. The embedded extension descriptor itself contains approved executable JavaScript.

```json
{
  "format": "steel-tide-mod",
  "v": 4,
  "requiredCapabilities": ["components-v1", "logistics-v1"]
}
```

This is a fragment; ordinary pack identity and definitions are still required. See [the complete source-derived fixture](../test/fixtures/t90-systems-study.steel-tide-mod) and [its deliberately limited scope](../test/fixtures/T90-SYSTEMS-STUDY.md).

All labels below must be non-empty `[en, zh, ko]` tuples, each string at most 240 characters. Local IDs have 1–40 lower-case letters, digits, underscores or hyphens and start with a letter or digit. Reserved object-property names are rejected. Distances use world pixels, time uses seconds, authored sector angles use degrees. A Steel Tide tile is 32 world pixels.

## `components-v1` on a definition

| Field | Shape and behavior |
| --- | --- |
| `protection` | Optional `{frontHalfAngle?, rearHalfAngle?, incidence?, families, layers?}`. Half angles are 1–89°, default 45°. `incidence` defaults true. A family maps `front`, `side`, `rear`, optional `top` (default 0) to non-negative thickness, at most 100000. At most 16 families. A layer must name an existing family and uses the same shape. |
| `parts` | Up to 32 named parts; defaults empty. A part is `{id,label,hp,channel,exposure,damagedAt?,damaged?,destroyed?,failure?,repairs?,crew?}`. `hp` is 1–1000000. `channel` selects a weapon payload channel. `exposure` has front/side/rear/top coefficients in 0–10; top defaults 0. `damagedAt` is 0.01–0.99, default 0.65. |
| `repairHitRetention` | Fraction 0–1 of a repair's accumulated progress retained after a handled hit; default 1. Zero restarts progress. Money already spent is retained as paid, so interruption does not charge more than the policy's total price. |
| `services` | Up to 16 provider tag IDs. Tags have no built-in meaning. A repair policy can require one within range. |
| `crew` | `{priority,replacements,seconds,automatic?,destroyWhenEmpty?}`. Requires 1–8 parts marked `crew:true`. Priority is a list of vacant destination seat IDs. Replacements are up to 32 `{from,to}` pairs between distinct crew seats. Transfer time is 0.1–600 seconds. Automatic replacement and destruction when every crew seat is empty both default false. |

An effect is `{speed?,turn?,reloadAdd?,disableWeapons?}`. Speed and turn multipliers are 0–4 and multiply across active parts. Reload additions are -0.9–20, sum across active parts, and produce `max(0.1, 1 + sum) × current reload`. Weapon IDs must exist on the definition. A destroyed part uses its `destroyed` effect, falling back to `damaged` only when absent. `failure` can author `destroy:true` or non-negative `hullDamage` for the one-time crossing of the destruction threshold. Those consequences use the ordinary damage/death attribution pipeline.

A repair is `{seconds,toDamage?,fromDamage?,provider?,range?,stationary?,auto?,metal?}`. There are at most four policies per part. Duration is 0.1–3600 seconds. `toDamage` defaults 0; `fromDamage` defaults the part's damage threshold; completion must reduce damage. Provider and range must appear together (range 1–4096). A provider must be alive, finished, outside transport, not EMP-disabled, allied, and in range. Stationary defaults true, automatic defaults false, total metal defaults 0. Automatic work starts while idle. A field repair can restore a destroyed mechanical component; dead crew need reassignment or a crew refill service. Losing provider eligibility cancels the repair. Stationary repair stops movement while active. Cancel leaves damage and money already spent intact.

Each crew member has an identity independent of the seat. Reassignment to an empty seat preserves that member's fractional health and empties the source seat. Incoming harm can kill an occupant. An authored crew refill restores occupied seats to full health and creates replacement identities for empty seats. It does not create additional seats.

## `components-v1` on a weapon

| Field | Shape and behavior |
| --- | --- |
| `family` | Required protection-family ID. A protected target without this family uses ordinary damage behavior; it does not invent a resistance value. Parts without protection are unarmored. |
| `penetration` | Required base penetration, 0–100000. Penetration must be strictly greater than effective thickness. |
| `hullDamage`, `strength` | Non-negative values up to 1000000, both default 0. Hull payload is explicit; `hullDamage:0` allows purely internal damage. Strength scales component channel damage. |
| `diameter` | 0–10, default 1. Scales each component's independent strong-hit probability: `clamp(exposure[face] × diameter, 0, 1)`. It does not automatically scale damage. |
| `channels` | At most 16 channel IDs mapping to `{strong:[min,max],weak:[min,max]}`. Each range is 0–100. A component independently rolls its strong/weak channel, then its damage is `strength × sampled range × residual multiplier × shield remainder × weak-hit multiplier`. Missing channels cause no harm to that component. |
| `wear` | 0–1, default 0. Every non-ricochet handled hit multiplies every protection family's remaining layer on the struck face by `1 - wear`. Layers remain fractional, rather than being rounded into charges. |
| `top` | Defaults false. True explicitly selects top armor. |
| `jitter` | `[min,max]` in 0–4, default `[1,1]`, using the match RNG. |
| `rangeAdjustment` | `[a,b,c]`, default zeros: penetration before jitter is `max(0, penetration + a + b*d + c*d*d)`. `d` is traveled straight-line distance from launch, clamped to 32768 world pixels. Launch positions survive authoritative saves. |
| `ricochet` | Optional `{cosine,requiresNominalBlock?}`. Cosine 0–1; the nominal-block condition defaults true. |
| `residual` | Optional `{base,scale,max}`, all 0–10: residual damage multiplier is `clamp(base + scale × (penetration - effectiveArmor)/penetration, 0, max)`. Absent means 1. |
| `weakHit` | Optional `{chance,multiplier}`, both 0–1. A single projectile hit may reduce all component channels by this multiplier. This is a damage policy, not an artificial spatial miss. |

The component path applies to direct or contact-distance impacts. Collateral area damage retains the existing pipeline. Protection resolves first. A shield then absorbs an energy budget of `max(strength,hullDamage)` once; its remaining fraction scales hull and internal effects. Configured hull HP passes through the shared HP, ability, buff, profile and death accounting. Internal damage is a separate authored system and does not infer hull armor multipliers. Pack authors should not also bake the same directional resistance into that payload.

## `logistics-v1` on a definition

| Field | Shape and behavior |
| --- | --- |
| `stocks` | Up to 32 `{id,label,capacity,initial?,refillAfter?}` entries. Capacity 1–100000; initial defaults capacity. Stocks may contain fractional quantities during transfer; firing requires a full cost. `refillAfter` explicitly authors an unlimited empty-magazine refill after 0.1–3600 seconds. Omit it for finite stocks. |
| `feeds` | Up to 16 `{id,label,weapons,selected}` entries. Every weapon names this feed in its weapon extension, and can belong to only one feed. Exactly the selected alternative can start a shot. Alternatives preserve the actual shared committed reload, including core abilities/rules. A burst consumes one cost at commitment; its continuation does not consume extra costs. Switching during a burst is rejected. |
| `services` | Up to 16 `{id,label,mode,range,stocks?,rate?,seconds?,stationary?,components?}` entries. A recipient explicitly orders service from an allied provider in range 1–4096. Stationary defaults true; moving provider/recipient pauses its clock, and a stationary service blocks recipient movement/firing. Losing eligibility cancels the task. |
| `suppression` | Optional `{label,max,decay,quiet?,thresholds}`. Max 1–100000; decay 0.001–100000 points/second; quiet defaults 0, at most 3600 seconds. Thresholds are strictly ascending and number 1–8. Only the highest reached applies. |

`mode:"transfer"` requires rate 0.001–10000 rounds/second and actual matching stocks on the provider. It conserves inventory and shares one rate budget among all recipients of the same provider/service in stable entity order. It cannot refill crew or protection and cannot specify seconds. `mode:"refill"` requires duration 0.1–3600 seconds and has no finite-inventory claim: at completion it restores named recipient stocks to capacity and optionally `components:["crew","protection"]`. These explicit policies must not be substituted for one another during a port.

A suppression threshold is `{at,speed?,reloadAdd?,spread?,disableWeapons?}`. At is positive and no greater than max. Speed 0–1 defaults 1; additional reload fraction 0–20 defaults 0; scatter radius 0–512 world pixels defaults 0. Listed weapons must exist. A hit resets quiet time; recovery begins after the remaining quiet interval has elapsed. One projectile can add suppression to a given target only once. Discrete blocked component impacts can suppress; pure heal/repair calls cannot.

## `logistics-v1` on a weapon

`{stock?,cost?,feed?,suppression?,accuracy?}`. Stock and feed IDs are local to its definition. Cost is 0.001–100000, defaults 1, cannot exceed capacity, and requires stock when explicitly supplied. Suppression is 0–100000, default 0. Module stocks/feeds cannot be combined with legacy `ammo` on that weapon.

Accuracy is `{base?,moving?,targetMoving?,rangeFactor?,smallTarget?}`. Scatter additions are 0–512 world pixels, default 0. Range factor is 0–2, default 0. Small-target data is `{radius,spread}` with radius 0.1–1024. Source and target movement are measured from their previous positions. Scatter chooses a seeded uniform point in the resulting disk, capped at 1024 world pixels. It applies to non-homing discrete projectiles; combining explicit accuracy with homing or continuous fire/smoke is rejected. Suppression does not redirect homing weapons.

## Shared controls and persistence

The ordinary module order gateway takes capability ID plus `{action,ids,owner,targetId?,choice?}`. UI, CLI, AI or scenarios use that same gateway.

| Module/action | Choice and target |
| --- | --- |
| `components-v1 / repair` | `partId/policyIndex`; zero-based policy index |
| `components-v1 / reassign` | `sourceSeat/destinationSeat`; destination must be empty |
| `components-v1 / cancel` | Cancel current repair/reassignment |
| `logistics-v1 / ammunition` | `feedId/weaponId` |
| `logistics-v1 / supply` | `serviceId`, with `targetId` naming provider |
| `logistics-v1 / cancel` | Cancel service |

Private component health, occupants, repair progress, stocks, feeds and suppression are visible only in an authorized private entity view. Authoritative snapshots retain them and validate bounds/references on restore. Component projectile launch metadata is authoritative only. Equal-config deployment forms retain all private tasks and clocks; incompatible form changes reconcile matching IDs and cancel incompatible tasks.

## Deliberately unsupported combinations

The v1 reader rejects arbitrary expressions, stock-dependent component HP/threshold formulas, cross-component derived-stat formulas, occupied-seat swaps, reserve-crew pool arithmetic, scripted kill-chain experience, arbitrary per-target accuracy functions, and finite transfer of crew/protection. No field for these behaviors exists: unknown fields are errors, rather than requests for an approximation. Shape-based penetration rays, volumetric interiors and source script scheduling are not implemented by this statistical component model. A port must omit any system which needs them until its exact behavior has an approved generic contract.


## Independent service locks and carried-stock queries

A service now accepts `lockMovement`, `lockWeapons` and `providerStationary`
booleans. Each defaults to the existing `stationary` value, preserving older
packs. `stationary` itself requires the recipient to remain still to advance
the job. Movement lock, firing lock and provider motion are separate policies:
a free timed depot can stop its recipient while allowing that recipient to
fire and its provider to move, or a different pack can require both to stop.
Out-of-range, destroyed or hostile providers still cancel the service.

The UCGR T-90M uses a ten-second refill within96 world pixels of an allied
depot, with `stationary:false`, `lockMovement:true`, `lockWeapons:false` and
`providerStationary:false`. Its carried source stocks are20AP,18HE and10ATGM;
only supported payload families are selectable. The main barrel uses one feed,
so changing rounds cannot erase its committed reload. Stocks and the selected
round are visible on the unit, with current service progress. This is the
source's explicitly free tank refill, not a substitute for paid aircraft rearm.

Component failure policies can query the authoritative optional logistics stock.
A completed stock refill rebases a stock-dependent component before restoring
that stock, preserving the source relationship between spent ammunition and
accumulated rack damage. Merely healing hull HP never refills either system.

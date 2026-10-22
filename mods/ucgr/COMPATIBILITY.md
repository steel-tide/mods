# UCGR compatibility and remaining source work

The port uses host API 2 entirely from the UCGR pack. This pass changes no game
code. API availability and source fidelity are separate claims: the complete
non-M5 port is **not yet finished**. [non-m5-status.json](non-m5-status.json)
records the current roster, actual manifest bindings and outstanding families.

## What is represented

| Family | Implemented source policies | Remaining boundary |
| --- | --- | --- |
| Unit data and text | Original HP, speed, turn rate, radius, sight and positive passive regeneration with explicit unit conversion; English/Chinese retained and Korean added | Native movement, collision, elevation and some combat timing still differ from RW; dynamic stats require their source state machine |
| Armored combat | Reviewed shared tank/vehicle templates, AP/HE/HEAT, small-arms component payloads, crew/rack/repair, morale and separate armor/air experience | Uncompiled projectile families, source helper-ID weak-hit branches, fragments, exact dual damage and additional source actions remain; see combat audit |
| Ammunition | Shared main feeds, finite tank stocks, reviewed empty/partial/queued magazines, literal aircraft starting inventories | Paid loadouts/service depend on source currencies; no invented free replacement |
| Signals | Source radar scans, signature contacts, IR/active/semi-active helper flight, finite countermeasure pulses and fixed-wing flight controls | Free sandbox SEAD and FPV operators are implemented; FOB/loitering dispatch is capture-point M5; dynamic helicopter landing/signatures and aircraft strike workflows remain pack work |
| Assemblies | Independent source turret roots; HJ-8 deploy/pack/member and atomic transport | Squads, trench forms, recovery towing, source transport capacity/tags/unload cadence are implemented; squad search/retry and amphibious towing edge cases remain unaudited |
| Targeting | Literal source tags, initial infantry equipment tags, per-weapon exclusions and high/low aircraft conditions; MAS1/2 concealment detection hysteresis | Source smoke actions and ATGM-defeating markers are implemented; DynamicLoS target nudges and forest markers remain |
| Presentation | Original art, certified muzzles/native recoil, projectiles/wrecks, component/ERA states, source voices and reviewed effects/audio | Unverified muzzle defaults, atmospheric/physics/conditional effects, movement-audio scheduling and unported state art remain reported |

All 415 candidate unit text tuples are present; this is not a count of playable
units. Candidate forms/helpers are not silently turned into standalone purchases.
The actual playable selection is `mvp-roster.json`. Compiler coverage reports
must not be mistaken for runtime or browser acceptance of every source unit.

## Spatial and numeric conversion

The source-to-world length scale is 0.4. RW speed 1 is 60 source pixels/second;
it therefore maps to 24 world pixels/second. RW sight is in 20-pixel tiles and
Steel Tide tiles are 32 world pixels: sight uses `source * 20 * .4 / 32`.
HP and damage retain the common 0.6 scale. The imported source values are not
clamped to the former MVP balance range. Native fog uses whole tile radii at
activation; the raw fractional value remains in the manifest and audit.

The primary reference is the [official RW modding field table](https://docs.google.com/spreadsheets/d/1aeP3pUic0IutZlgGix_cM8xR7LEH44gS4itAxETK954/edit),
linked by [Corroding Games](https://www.corrodinggames.com/rusted_warfare).
It does not establish numeric defaults for every omitted source turret field.
Unverified defaults are not inferred from collision radius or art dimensions.

## Excluded M5 and its dependencies

Original deck selectors, SUP/SPP, reinforcement phases, platoon purchases,
mobile deployment points, score victory and the source full-spectrum mode are
excluded. Seven native national factions are an explicit Steel Tide adaptation.
Paid equipment and aircraft servicing are not made free to bypass the missing
economy. The full-spectrum soundtrack has mode/coalition conditions and remains
with that excluded mode; the existing native music API needs no replacement.

The six source TMX scenarios are 5v5, including a 600-tile-wide map. They remain
excluded with M5. Crossroads Exercise is a newly authored two-seat showcase with
normal openings and all selected combat definitions; it makes no original-map
or original-coalition fidelity claim.

## Architecture, performance and delivery

`extensions/combined-arms-v1` belongs only to this pack. Its versioned schema,
simulation, presentation and assets are embedded in the ordinary format-4
manifest. A user installs this one folder. Large capacity is declared explicitly;
it does not preallocate runtime memory. The engine supplies generic lifecycle,
orders, targeting, projectile, rendering, audio and state transport boundaries.

This pack pass neither changes the game nor adds work to a no-mod match. The
existing host isolation measurements remain historical engine evidence, not a
new cross-device performance claim. No source implementation or docs were added
to the game checkout. The repositories stay on main and nothing is pushed.

Saves and filtered replication must retain module state without leaking enemy
stocks, private contacts or controls. Acceptance tests exercise source policy,
save continuation, privacy, faction openings, recruitment and pack unload.
Browser folder import and packed-file verification exercise the actual shipped
manifest and its assets, rather than only standalone schema fixtures.

## Attribution

GY工作室 / GY Studio owns the original pack. Permission for this port was
confirmed by the maintainer on 2026-10-16. Preserve [CREDITS.md](CREDITS.md), the
source [notices](notices/) and [LICENSE](LICENSE). Source permission does not
make every bonus unit a normal roster purchase or imply new licensing terms.

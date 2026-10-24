# UCGR source-to-port ledger — 2026-10-19

Pack version **0.0.2**, 366 definitions, 553 sheets, 50 ordinary sounds, 312
extension assets. Seven national rosters recruit 323 source combat units
(ru 75, cn 81, us 47, eu 53, kp 36, kr 24, jp 6). Host: extension API 2, large
capacity. No game code changed; work stays local on `main`, unpushed.

Evidence for RW behaviour is the public RW 1.15 decompilation
(`coolomet/RustedWarfare` @ `52758091`). Where a decision rests on it, the class
is cited in code next to the policy.

## Verified implemented this pass

| Item | Source basis | Evidence |
| --- | --- | --- |
| FPV teams' untransportable sentinel (`transportSlotsNeeded:100000`) | Weight retained (bound raised to 10⁶); a heavier-than-native passenger is refused by native holds too, not clamped into one | `transport-game.test.ts` (mutation-checked) |
| Source transport capacity, passenger tags, 0.05 s unload, T-90M 48 / M2A3 34 weights | `transportSlotsNeeded`, `transportUnitsRequireTag`, unload delay frames | `transport-game.test.ts` |
| HAWK/IRIS-T launchers actually launch on battery-forwarded targets | Independent mounts fall back to the unit's given target when acquisition is refused; forwarded waypoints capped at 29 (`OrderableUnit.ap`) | `game.test.ts`, `sensors-game.test.ts` |
| T-90M Arena-M reward form recognised as a form (no loader warning) | Components references register achievement targets | checker clean |
| 21 spawn-deck units added: Mi-28NM, Mi-35M, Mi-8TV, Su-25T, Su-34, Z-19, Z-8, Z-9, Q-5L, JH-7A, J-16, Avenger, AH-1Z, F-15E, F-15EX, T-80BV (UA), JAS 39E, Tornado, Rafale, MiG-23, F-1 | National `出生点*.ini` decks | every armed one damages an admissible target in `game.test.ts` |
| TOS-1A: 1 s Deploy/UnDeploy forms, immobile deployed form clearing player moves, 6-rocket barrage (0.5 s spacing, 20 s cooldown, locked below 6 of 24 free created rockets), thermobaric helper | `彩蛋/TOS/TOS1A.ini`; action-fired turrets skip their own `energyUsage`/`resourceUsage` (`class_113`) | `artillery-game.test.ts` |
| Smoke on 140 vehicles: Deploy Smoke (4 markers at the launchers, 30 s shared cooldown, gunner/rack gate), Engine Smoke (1 marker per whole second of age for 10 s, 30 s shared or 120 s self cooldown, driver gate), smokeG 5 s markers removing the life of one enemy `ATGM` round within 40 px (energy 2, +0.9/s, 1 per round, 50-frame reload), life-999 flight variant on four SPAAGs, cloud and sounds | `模板/坦克模板.key`, `步战车模板.key`, `烟雾弹.ini`; life-0 rounds burst on first update; autoTrigger every frame with 60-frame cooldown; default `shootDelay` 50; full starting energy | `smoke-game.test.ts` |
| Voice/firing gain 0.3 default and `shoot_sound_vol` replacing item gain | `class_393`, `class_392.a(float)` | `feedback-game.test.ts` |
| Translations: Chinese source resource names (针 as a shared helicopter-AAM alias, 毒刺, 西北风, 魔术2, 机枪, 火箭弹) given proper en/zh/ko stock labels; Korean artillery labels now follow the English; fire-mission cancel no longer says "Cancel deployment"; untranslated resource names fail the build | — | `test_localization.py`, manifest scan |

## M5 or unreachable — excluded with reasons

Recorded per unit in [roster-expansion.json](roster-expansion.json):
unreachable easter eggs and drones (no spawn, build or reference anywhere in the
source), air-combat-mode-only fighters (`阵营选择/空战模式.ini`), capture-point
FOBs, loitering munitions and 63火, grenade teams that exist only as platoon
preloads selected by deck flags, ATGM teams that exist only as capture-point
trench attachments, the paid-SUP DJI launch, the AN-2 paradrop call, spawn-point
structures and deck command vehicles. Vehicles produced empty is correct: their
preloaded troops are chosen by flags only the M5 decks set.

## Remaining non-M5 work

- **DynamicLoS** (`tem/tank.key`): idle-unit target-switch nudges and the LoS line
  decal. No recruited unit gates firing on it. Forest markers (`林区.ini`) are
  map content still to be reviewed against M5.
- **Aircraft strike workflows**: bombs/missiles from sandbox or purchased
  loadouts drop through a designated-target route controller that is not
  ported. Air-to-air and cannon armament are live.
- **Partial families**: squad search/retry/neutral audit, amphibious towing,
  ground movement parity, artillery warning markers, T-90M Arena-M global
  announcement, flying smoke-round sprite, smokeG soft collision and enemy
  auto-targeting of the invulnerable marker.

## Host seams (reported, not worked around)

- BMP-2M firing cue authored at gain 5; the recording API accepts 0..4. Omitted, not clamped.
- No extension hook for proxy minimap/replay dots or global chat/war-log announcements.
- Native `cmdMove` does not consult `allowOrder`; the pack clears TOS-1A moves in its own unit step instead.

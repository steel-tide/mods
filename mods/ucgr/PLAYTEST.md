# UCGR 0.0.2 playtest

Use the current local game checkout and import `mods/ucgr`, the folder with
`mod.json`. In Settings → Mods, reload the installed folder (or import it again),
confirm **0.0.2** is enabled, and start a **new match**. An old match retains its
old definitions. The original `rusted-warfare-mods/usgr-re` folder is source,
not the playable pack.

Choose **Crossroads Exercise** for the displayed roster, or use the UCGR
Russia, China or North Korea faction in Conquest to recruit the units below.
Each national command post can recruit its roster. These checks use ordinary
unit selection and commands.

## M6: original voices and public component icons

1. With sound enabled, select a **PGZ-09**, **HQ-17**, **Z-10**, **Z-20** or
   **J-10**. Hear its original selection recording. Selecting a T-90M or a
   PLA rifleman stays silent: those source selection bindings are commented out.
2. Move or attack with a **T-90M**, Russian rifleman or one of the Chinese
   units listed in [the source audit](M6-FEEDBACK-SOURCE-AUDIT.md). A local
   acknowledgement plays from its original alternatives. Rapid follow-up orders
   share the source five-second cooldown. The other player's orders, AI orders
   and replay playback must not produce local command acknowledgements.
3. Damage a **T-90M**'s track, engine, driver, gunner or rack through actual
   combat. Original yellow/red component icons should appear at their source
   positions. The public icon may be visible on an enemy tank that is already
   visible; it must never reveal a concealed tank or its private numeric state.
   Move it into fog and verify the overlay disappears with the unit.
4. Disable the pack and start a native match. Its recordings, icons and local
   feedback registration must be gone. Reloading the pack recreates its feedback
   resources; voice throttling continues to use the native mixer. Verify folder
   import and packed offline import behave alike.

The full-spectrum soundtrack remains deferred with skipped M5. The playable
roster now contains132combatunits. These checks cover reviewed bindings, not
a declaration that every source feature or performance gate passed.

## T-90M: ammunition, components and supply

1. Select a **T-90M**. Its card shows tracks, engine, driver, gunner, ammunition
   rack, reserve crew and carried ammunition. Scroll the component/stat list
   to reach the ammunition rows below the crew rows. The main gun initially selects
   APFSDS. It carries 20 AP and 18 HE rounds; the 10 carried guided rounds count
   toward rack vulnerability but have no selectable launcher in this slice.
2. Use the **Ammunition: High-explosive shells** action button. Hover the
   wrench-shaped action icons to read their labels. Fire at a suitable
   ground target. HE decreases, AP does not. Switch back to AP immediately after
   firing: changing ammunition must not erase the running reload.
3. Fight another T-90M with the main gun. Component damage may disable a part
   while hull HP remains unchanged. An empty or damaged rack and a damaged crew
   affect survival; do not use hull HP alone to judge whether AP hit. Penetration
   depends on facing, range and ERA, so a single hit need not damage a component.
4. Move beside an allied **field supply depot**. Choose the **Resupply: Resupply
   ammunition & ERA** action, select that depot in its target dialog, and confirm. The service takes ten seconds,
   holds the tank in place and permits firing. Stocks and ERA restore at
   completion. Moving the provider out of range cancels the service.
5. After nonfatal damage, watch the automatic recovery of disabled parts. For
   remaining repairable damage beside the depot, choose **Repair components**.
   The source shared repair clock and ordered completions apply. Completing
   manual repair clears residual part damage and restores ERA. Missing crew
   also starts the separate eighteen-second crew service when available.
6. **Resupply: Replenish crew** appears when crew are missing. A living reserve
   replaces lost crew automatically; **Reassign crew** is available only when
   the reserve is empty and a surviving occupant can change seats. Save and
   reload during service or repair: progress and ammunition should continue.

The same reviewed source templates now cover additional vehicles, with their
own armor, crew, inventory and ammunition data. Combat families outside those
templates remain explicit in COMPONENT-GAPS.md; the full source combat model
is not yet complete.

## MiG-29: radar contacts

1. Recruit/select a **MiG-29** from UCGR North Korea. Use an opposing retained
   fixed-wing aircraft (for example F-2, F-5E or F-16C) as the contact target.
   Vanilla aircraft and unaudited helicopter signatures are not substitutes.
2. Point the MiG's body toward that aircraft within 37.5 tiles. The source
   search is a forward ±35° cone, offset laterally from the aircraft. The card
   shows its radar contact count and measured coordinates; markers show those
   measurements on the field. Only the first sixteen contacts get card rows.
3. Turn away or move the target beyond range. Contacts update on the source
   sampling cadence; they do not follow the target continuously between scans.
   Radar alone must not expose hidden enemy identity, HP, orders or stock.
4. Save and reload with a contact present. The saved scan phase and measured
   contact should persist until the next scheduled scan.

This is radio detection. MiG-29 infrared missiles do not require these contacts.
The source IR/active/semi-active helper families and finite countermeasure
pulses now run independently. Warning artwork and unconverted helper/controller
families remain incomplete. A radar contact is not a weapon-lock test.

## HJ-8: automatic deployment and the real rifleman

1. Recruit an **HJ-8 team** from UCGR China. Leave it idle on open ground for
   two seconds: it automatically changes to the deployed form. The launcher
   cannot fire while carried or while deploying.
2. Attack a ground target in range. The launcher and attached PLA rifleman use
   their own real weapons. The rifleman sits at the source offset and rests at
   a 35° bearing relative to the launcher; it can aim independently.
3. Order movement. The team spends two seconds packing, then follows the same
   move order. Source firing during packing is retained. Stop it and it deploys
   again. An attack ordered during deployment must survive the transition.
4. The rifleman is a damageable entity. A killed member must not reappear when
   the team packs, deploys or loads a save. Killing the parent removes its
   coupled member. Selecting the member selects its parent assembly.

Order the team into a suitable transport. Both surviving members board together;
the source entered-transport delay packs the launcher. On unload, both original
entities and their injuries remain. Save during transport and repeat the check.

## Existing mount and magazine checks

Verified source assemblies now export their own separate turret roots. Place targets on
opposite sides to see independent aim; the other authored mounts and their
weapon groups remain present. Mount configuration is pack data, not an in-match
loadout editor. Infantry and supported autocannons still consume their source
magazines and refill after the audited empty-magazine delay.

Check that the T-90M main AP/HE flash and projectile leave the main bore, while
its coaxial and roof weapons keep their own origins. Its exported exposed main
barrel recoils through the native recoil system without moving the mantlet.
PGZ-09 shots alternate between its left and right bores. Fixed aircraft missiles
leave their actual initial-loadout hardpoints even when their target is away
from the nose; the launch point must not rotate around the hull toward it.
`muzzle-source-data.json` traces each resolved point back to the source.

The automated acceptance checks are `game.test.ts`, `components-game.test.ts`,
`sensors-game.test.ts` and `feedback-game.test.ts` in this folder. Run the latter
with `bun test ./mods/ucgr/feedback-game.test.ts` from the mod repository root.
`python3 -B mods/ucgr/test_feedback_port.py` checks the original source assets
and conditions. Remaining limits are tracked in
[COMPATIBILITY.md](COMPATIBILITY.md), [COMPONENT-GAPS.md](COMPONENT-GAPS.md) and
[SENSORS-SOURCE-AUDIT.md](SENSORS-SOURCE-AUDIT.md).

## Source flight controls and targeting

Switch a supported fixed-wing aircraft between high and low cruise. Check the
source queue and shared cooldown, drawn height, high/low gun eligibility, thrust
duration and speed-brake state. Save during a pending action and verify it resumes.
Toggle a supported ground radar and verify the original optical/radar engagement
ranges and delayed emission state. These controls do not implement SEAD by themselves.

Move ordinary infantry away from source-tagged detectors, then approach with a
tank, soldier, UAV or helicopter. Acquisition follows the distinct source hide
and reveal distances; concealment is a targeting tag, not invented invisibility.
Unknown stock must remain unavailable, never turn into infinite ammunition.

## 0.7.0: smoke, TOS-1A, batteries and new aircraft

1. Select a **T-90M** and press **Deploy Smoke**. Four clouds appear at its
   turret launchers and last about ten seconds; both smoke buttons grey out for
   30 s. Have an enemy ATGM carrier (HMMV-TOW, BMPT) fire through the smoke in the
   first five seconds: a missile that passes within the markers' radius dies short.
2. Press **Engine Smoke** on another tank: one cloud per second rises behind the
   hull for ten seconds. Destroying the driver (engine smoke) or gunner/rack
   (grenades) greys out the matching button.
3. Recruit a **TOS-1A** (Russia). **Rocket Barrage** is absent until **Deploy**
   finishes (1 s). Deployed, move orders are discarded; the barrage fires six
   rockets 0.5 s apart at a ground point within 12.5 tiles, uses 6 of 24 rockets,
   cools down 20 s and locks below six rockets. **UnDeploy** restores movement.
4. Deploy a **HAWK** launcher beside its radar and switch the radar on: the
   launcher fires at aircraft the radar forwards, and its order queue never
   exceeds 29 entries.
5. New spawn-deck aircraft (Mi-28NM, Z-19, AH-1Z, Su-34, JH-7A, F-15E, Tornado,
   Rafale, …) fly and fight with their air-to-air and cannon armament; their
   bomb and ground-missile stores remain omitted with the strike workflow.

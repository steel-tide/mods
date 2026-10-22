"""Real-source acceptance for reviewed component families and omission gates."""
from copy import deepcopy
import unittest
import math

import component_port
from achievement_port import source_achievements
import rw
from weapons import convert_weapons, source_index, append_main_rounds
from logistics_port import augment_logistics


def source_unit(name):
    entry = source_index()[name]
    ini = rw.load_unit(rw.RW / entry['source'])
    weapons, _ = convert_weapons(entry, ini)
    return entry, ini, {'id': entry['id'], 'weapons': weapons}


class ComponentPortTests(unittest.TestCase):
    def test_arena_achievement_uses_original_five_armor_kills_and_m5_rewards_stay_omitted(self):
        entry, ini, definition = source_unit('T90M')
        append_main_rounds(entry, ini, definition)
        augment_logistics(entry, ini, definition)
        component_port.augment_components(entry, ini, definition)
        achievement = definition['extensions']['components-v1']['achievements'][0]
        self.assertEqual((achievement['counter'], achievement['threshold'], achievement['to']),
                         ('armor', 5, source_index()['T90MArenaM']['id']))
        self.assertEqual(len(achievement['label']), 3)
        for name in ['T72A', '2S38', 'M2A3', 'K1', 'L2A6', 'ZTZ96']:
            self.assertEqual(source_achievements(source_unit(name)[1]), [])
        changed = deepcopy(ini)
        changed['hiddenAction_T90M Mod.2025']['addResources'] = 'SUP=100'
        self.assertEqual(source_achievements(changed), [])

    def test_real_t90_loop_does_not_replace_playable_weapons_with_incomplete_zero_hull_ap(self):
        entry, ini, definition = source_unit('T90M')
        definition['extensions'] = {'logistics-v1': {'stocks': []}}
        before = deepcopy(definition)
        source_before = deepcopy(ini)
        notes = component_port.augment_components(entry, ini, definition)
        self.assertEqual(definition, before)
        self.assertEqual(ini, source_before)
        self.assertEqual(ini.origins, source_before.origins)
        self.assertGreater(definition['weapons'][0]['dmg'], 0)
        self.assertTrue(any('components-v1 omitted' in note for note in notes))
        self.assertTrue(all('components-v1' not in weapon.get('extensions', {})
                            for weapon in definition['weapons']))

    def test_actual_t90_ap_he_component_loop_compiles_only_after_inventory(self):
        entry, ini, definition = source_unit('T90M')
        append_main_rounds(entry, ini, definition)
        augment_logistics(entry, ini, definition)
        notes = component_port.augment_components(entry, ini, definition)
        self.assertIn('binds', notes[0])
        c = definition['extensions']['components-v1']
        self.assertEqual([p['id'] for p in c['parts']], ['rack', 'track', 'driver', 'engine', 'gunner'])
        self.assertEqual(c['reserve']['capacity'], 1)
        self.assertNotIn('reserve', [p['id'] for p in c['parts']])
        self.assertEqual(c['reserve']['refillCosts'], {'gunner': 0, 'driver': 1})
        rack = c['parts'][0]
        self.assertAlmostEqual(rack['stockThreshold']['perMissing'], 175 / 48)
        self.assertTrue(rack['stockThreshold']['strict'])
        self.assertEqual(c['repairGroup']['priority'][:2], ['track/0', 'engine/0'])
        self.assertEqual(c['blast']['minimumDistance'], 16)
        ap = definition['weapons'][0]['extensions']['components-v1']
        he = definition['weapons'][3]['extensions']['components-v1']
        self.assertEqual((ap['strength'], ap['penetration'], ap['hullDamage']), (85, 700, 0))
        self.assertEqual(ap['wearFaces'], {'rear': 'side'})
        self.assertEqual(ap['rangeOrigin'], 'source')
        self.assertEqual(he['blast']['yield'], 1.73)  # Projectile helper; unit description says 5.24.
        self.assertEqual(he['blast']['radius'], 38)
        self.assertEqual(c['parts'][4]['destroyed']['disableWeapons'], ['w1', 'w4', 'w2'])
        self.assertEqual(c['reserve']['empty']['disableWeapons'], ['w3'])

    def test_no_partial_binding_when_he_helper_or_stock_contract_is_missing(self):
        entry, ini, definition = source_unit('T90M')
        augment_logistics(entry, ini, definition)
        before = deepcopy(definition)
        self.assertIn('omitted', component_port.augment_components(entry, ini, definition)[0])
        self.assertEqual(before, definition)
        self.assertFalse(component_port.supports_components({'rwName': 'T90A'}))

    def test_shared_template_is_compiled_from_each_vehicle_and_heat_keeps_both_payloads(self):
        for name in ('T72B3', 'T90A', 'M1A2SEPV3', 'L2A6'):
            with self.subTest(name=name):
                entry, ini, definition = source_unit(name)
                self.assertTrue(component_port.supports_components(entry, ini))
                append_main_rounds(entry, ini, definition, resources=('高爆弹', '破甲弹'))
                augment_logistics(entry, ini, definition)
                notes = component_port.augment_components(entry, ini, definition)
                self.assertIn('binds', notes[0])
                c = definition['extensions']['components-v1']
                self.assertEqual(c['protection']['families']['kinetic']['front'], float(ini['core']['@global frontA']))
                self.assertEqual(c['sourceRadius'], float(ini['core']['radius']) * .4)
                if name == 'M1A2SEPV3':
                    heat = [w['extensions']['components-v1'] for w in definition['weapons']
                            if w.get('extensions', {}).get('components-v1', {}).get('family') == 'chemical'][0]
                    self.assertTrue(heat['blast']['combined'])
                    self.assertEqual(heat['recipient'], {'range': 40, 'radiusSquared': 1.5})
                    self.assertEqual(heat['residual'], {'base': .5, 'scale': 1, 'max': 1})
                    self.assertEqual(c['reserve']['capacity'], 2)
        entry, ini, definition = source_unit('T14')
        self.assertTrue(component_port.supports_components(entry, ini))
        append_main_rounds(entry, ini, definition, resources=('高爆弹', '破甲弹'))
        augment_logistics(entry, ini, definition)
        component_port.augment_components(entry, ini, definition)
        aps = definition['extensions']['components-v1']['aps']
        self.assertEqual([l['capacity'] for l in aps['launchers']], [4,4])
        self.assertEqual([l['reload'] for l in aps['launchers']], [2.5,2.5])

    def test_fixed_rack_ifv_recovery_and_open_compartment_use_independent_source_constants(self):
        for name, rack, driver, minimum, seconds in [('BMP2',85,80,10,18), ('BMP3',95,100,12,20), ('M2A3',90,20,12,18), ('BREM-1装甲牵引车',10000,100,16,18), ('BRDM',40,100,0,20)]:
            with self.subTest(name=name):
                entry, ini, definition = source_unit(name)
                augment_logistics(entry, ini, definition)
                self.assertTrue(component_port.supports_components(entry, ini))
                notes = component_port.augment_components(entry, ini, definition)
                self.assertIn('binds', notes[0])
                c = definition['extensions']['components-v1']
                self.assertEqual(c['parts'][0]['hp'], rack)
                self.assertTrue(c['parts'][0]['strict'])
                self.assertNotIn('stockThreshold', c['parts'][0])
                self.assertEqual(c['parts'][2]['hp'], driver)
                self.assertEqual(c['blast']['minimumDistance'], minimum)
                self.assertEqual(definition['extensions']['logistics-v1']['serviceSeconds']['tank-crew'], seconds)
                self.assertEqual(c['crew']['vacatedExtra'], 10)

    def test_zero_initial_reserve_keeps_the_source_refill_count_and_zero_pool_health(self):
        entry, ini, definition = source_unit('LAV25')
        augment_logistics(entry, ini, definition)
        self.assertIn('binds', component_port.augment_components(entry, ini, definition)[0])
        c = definition['extensions']['components-v1']
        self.assertEqual(c['reserve']['capacity'], 0)
        self.assertEqual(c['reserve']['refillCount'], 1)
        self.assertEqual(c['commander']['seat'], 'gunner')
        self.assertEqual(ini['action_suppMemb']['setResourcesWithLogic'], 'crewR=select(0==0,1,0),crewRhp=0')

    def test_source_parent_and_helper_hp_branches_remain_independent(self):
        entry, ini, definition = source_unit('T90M')
        append_main_rounds(entry, ini, definition, resources=('高爆弹','破甲弹'))
        augment_logistics(entry, ini, definition)
        component_port.augment_components(entry, ini, definition)
        phases = definition['weapons'][0]['extensions']['components-v1']['hpPhases']
        self.assertEqual((phases[0]['direct'], phases[0]['area'], phases[0]['radius']), (900,300,8))
        self.assertTrue(phases[0]['targetGround'])
        self.assertEqual((phases[1]['direct'], phases[1]['area'], phases[1]['radius']), (0,51,4))
        self.assertTrue(phases[1]['fromEdge'])
        ap = definition['weapons'][0]['extensions']['components-v1']
        self.assertEqual(ap['sourceWeak'], {'roll':50,'multiplier':.25,'helperParity':True})

    def test_artillery_spawn_lists_preserve_each_he_top_attack_and_cluster_helper(self):
        for name,count in [('2S35',19),('M109A7',24),('PCL181',24)]:
            entry,ini,definition=source_unit(name)
            primary=component_port.spawned_payloads(ini['projectile_1'])
            self.assertEqual(len(primary),2)
            self.assertTrue(primary[0]['payload']['blast']['forest'])
            self.assertTrue(primary[0]['payload']['hpPhases'][0]['forest'])
            self.assertTrue(primary[1]['payload']['top'])
            self.assertEqual(primary[1]['payload']['hpPhases'][0]['expand'],.25)
            cluster=component_port.spawned_payloads(ini['projectile_2'])
            self.assertEqual(len(cluster),count)
            self.assertEqual(cluster[0]['payload']['penetration'],50)
            self.assertEqual(cluster[1]['x'],0)
            self.assertEqual(cluster[1]['y'],16 if name=='2S35' else 20)
        self.assertIsNone(component_port.spawned_payloads({'spawnUnit':'155炮弹,155炮弹TAM(spawnChance=0.5)'}))

    def test_manned_loader_and_commander_effects_are_source_specific(self):
        for name, loader, threshold in [('T90M',False,0), ('M1A2SEPV3',True,1)]:
            entry, ini, definition = source_unit(name)
            append_main_rounds(entry, ini, definition, resources=('高爆弹','破甲弹'))
            augment_logistics(entry, ini, definition)
            component_port.augment_components(entry, ini, definition)
            c = definition['extensions']['components-v1']
            self.assertEqual(c['reserve']['empty'].get('reloadAdd', 0), .5 if loader else 0)
            self.assertEqual(c['commander']['reserveThreshold'], threshold)
            self.assertEqual(c['commander']['visionPenalty'], 1.875)

    def test_t90_family_is_audited_from_each_resolved_source_not_copied_fixture_values(self):
        for name, front, penetration in (('T90M', '600', '700'),
                                         ('T90A', '520', '740'),
                                         ('T14', '750', '900')):
            with self.subTest(name=name):
                entry, ini, definition = source_unit(name)
                report = component_port.audit_components(entry, ini, definition)
                self.assertEqual(report['status'], 'omitted')
                self.assertEqual(report['bindings'], [])
                self.assertEqual(report['sourceValues']['frontA']['value'], front)
                gaps = {item['code']: item for item in report['gaps']}
                self.assertIn('stock-dependent-rack-failure', gaps)
                self.assertIn('reserve-crew-pool', gaps)
                self.assertIn('shared-quantized-repair-clock', gaps)
                self.assertIn('coupled-mobility-formula', gaps)
                range_values = '\n'.join(e['value'] for e in gaps['projectile-current-source-range']['evidence'])
                self.assertIn(penetration + '*memory.pene', range_values)
                self.assertIn('distanceBetweenSquared(self,customTarget1)', range_values)
                self.assertTrue(all(not e['source'].startswith('/')
                                    for gap in report['gaps'] for e in gap['evidence']))

    def test_t90_projectile_zero_hull_and_wrong_face_wear_are_evidenced_not_silently_corrected(self):
        entry, ini, definition = source_unit('T90M')
        report = component_port.audit_components(entry, ini, definition)
        gaps = {item['code']: item for item in report['gaps']}
        wear = gaps['rear-hit-side-layer-routing']['evidence']
        tags = next(e for e in wear if e['field'] == 'sendMessageWithTags')
        self.assertEqual(tags['source'], 'tem/ap.key')
        self.assertEqual(tags['section'], 'hiddenAction_bERA')
        self.assertEqual(tags['value'], 'sERA')
        hull = {e['field']: e['value'] for e in gaps['native-hull-payload-is-not-parity']['evidence']}
        self.assertEqual(hull['armour'], '100000')
        self.assertEqual(hull['armourMinDamageToKeep'], '0')
        self.assertEqual(hull['areaDamage'], '85')
        self.assertEqual(hull['armourIgnoreAmount'], '1000')
        self.assertEqual(hull['mutator2_areaDamageMultiplier'], '2')

    def test_infantry_is_not_given_a_tank_component_audit_or_mutated(self):
        entry, ini, definition = source_unit('RUSGUD')
        before = deepcopy(definition)
        self.assertEqual(component_port.augment_components(entry, ini, definition), [])
        self.assertEqual(definition['extensions']['components-v1']['parts'], [])
        self.assertTrue(definition['extensions']['components-v1']['sourceInfantry'])
        self.assertEqual(definition['extensions']['components-v1']['sourceArmor']['armor'], 12)
        self.assertEqual(definition['weapons'][0]['extensions']['components-v1']['ordinary']['ignore'], 9)
        self.assertEqual(definition['weapons'][0]['extensions']['components-v1']['penetration'], 10)
        self.assertEqual(component_port.audit_components(entry, ini, definition)['status'], 'not-applicable')

    def test_future_unreviewed_component_handler_does_not_opt_in_just_because_patterns_changed(self):
        ini = {'hiddenAction_newHandler': {'setUnitMemory': 'amRa=eventData(name="amRa1", type="float")'}}
        definition = {'id': 'new-source-unit', 'weapons': []}
        report = component_port.audit_components({'source': 'new.ini'}, ini, definition)
        self.assertEqual(report['status'], 'omitted')
        self.assertEqual(report['bindings'], [])
        self.assertEqual([gap['code'] for gap in report['gaps']], ['unreviewed-component-loop'])
        self.assertEqual(definition, {'id': 'new-source-unit', 'weapons': []})

    def test_real_source_fragment_chain_and_accelerating_direct_missile(self):
        entry, ini, definition = source_unit('T90M')
        ap = component_port.compile_component_payloads(definition, ini)['w1']
        fragments = ap['fragments']
        self.assertEqual((fragments['penetrated'], fragments['blocked'], fragments['offset'], fragments['ricochet']), (6, 4, 2, 88))
        main, child, ricochet = fragments['rounds']
        self.assertEqual(main['motion']['vz'], 24)
        self.assertEqual(main['motion']['gravity'], 12)
        self.assertAlmostEqual(child['motion']['delay'], 1 / 6)
        self.assertEqual(ricochet['motion']['spread'], 88)
        self.assertEqual(main['hpPhases'][0]['direct'], 24)
        self.assertTrue(main['hpPhases'][0]['targetGround'])
        entry, ini, definition = source_unit('豹猫')
        p = component_port.projectile_motion(ini['projectile_2'])
        self.assertEqual((p['speed'], p['targetSpeed'], p['acceleration'], p['life'], p['end']), (48, 144, 432, 2.5, True))
        self.assertAlmostEqual(p['turn'], 1.2 * math.pi / 3)

    def test_normal_warmup_keeps_reload_separate_and_rejects_unreviewed_spinup(self):
        ini = {'attack': {'shootDelay': '30'}, 'turret_main': {'warmup': '90'},
               'projectile_main': {'directDamage': '10'}}
        weapon = {'id': 'w1', 'reload': 1.5, '_source': {'turret': 'turret_main', 'projectile': 'projectile_main'}}
        payload = component_port.compile_component_payloads({'weapons': [weapon]}, ini)['w1']
        self.assertEqual(payload['warmup'], {'seconds': 1.5, 'decay': 4})
        component_port.bind_source_reload(ini, weapon, payload)
        self.assertEqual(weapon['reload'], .5)
        ini['turret_main']['warmupNoReset'] = 'true'
        self.assertNotIn('warmup', component_port.compile_component_payloads({'weapons': [weapon]}, ini)['w1'])

    def test_bad_helper_metadata_is_reported_without_reading_outside_source_pack(self):
        entry, ini, definition = source_unit('T90M')
        definition['weapons'][0]['_source']['helper']['source'] = '../outside.ini'
        report = component_port.audit_components(entry, ini, definition)
        self.assertIn('unresolved-projectile-provenance', [gap['code'] for gap in report['gaps']])

    def test_selected_roster_evidence_covers_tanks_and_recovery_vehicles_with_no_bindings(self):
        reports = component_port.selected_roster_audit()
        names = {report['rwName'] for report in reports}
        self.assertTrue({'T90M', 'T14', 'M1A2SEPV3', 'ZTZ99A', 'BREM-1装甲牵引车', '96装甲牵引车'} <= names)
        self.assertNotIn('RUSGUD', names)
        self.assertTrue(all(report['status'] == 'omitted' and report['bindings'] == [] for report in reports))


if __name__ == '__main__':
    unittest.main()

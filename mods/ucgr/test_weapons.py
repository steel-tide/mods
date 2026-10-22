"""Regression checks for source-to-native weapon mistakes found in the MVP audit."""
import json
from pathlib import Path
import unittest

import rw
import weapons


@unittest.skipUnless(rw.RW.is_dir(), 'original package not present')
class SourceWeaponTests(unittest.TestCase):
    def convert(self, name):
        entry = weapons.source_index()[name]
        return weapons.convert_weapons(entry, rw.load_unit(rw.RW / entry['source']))

    def test_ap_uses_actual_hp_payload_not_armour_blocked_carrier(self):
        entry = weapons.source_index()['T90M']
        ini = rw.load_unit(rw.RW / entry['source'])
        carrier = ini['projectile_3BM60']
        self.assertEqual(rw.num(carrier['directDamage']), 1500)
        payload, source, kinetic = weapons.payload_for(carrier)
        self.assertTrue(kinetic)
        self.assertIn('3BM60.ini [projectile_空]', source)
        self.assertEqual(weapons.damaging_value(payload), 85)
        converted, _ = self.convert('T90M')
        self.assertEqual(converted[0]['dmg'], 51)

    def test_t90_keeps_source_main_reload_and_one_ammunition_choice(self):
        converted, notes = self.convert('T90M')
        self.assertEqual([w['_projectile'] for w in converted], ['3BM60', 'PKT', 'AGS'])
        self.assertEqual(converted[0]['reload'], 6.5)
        self.assertEqual(converted[0]['range'], 8.125)
        self.assertTrue(any('alternate main-gun ammunition omitted' in n for n in notes))

    def test_small_arms_do_not_gain_damage_against_armoured_hulls(self):
        converted, _ = self.convert('T90M')
        for weapon in converted[1:]:
            with self.subTest(projectile=weapon['_projectile']):
                self.assertEqual(weapon['mult']['light'], 1)
                for armour in ('medium', 'heavy', 'ship', 'sub', 'structure'):
                    self.assertEqual(weapon['mult'][armour], 0)

    def test_infantry_uses_initial_loadout_and_its_configured_range(self):
        converted, _ = self.convert('PLAINF')
        self.assertEqual(len(converted), 1)
        self.assertEqual(converted[0]['_projectile'], 'QBZ95')
        self.assertEqual(converted[0]['range'], 3.75)
        self.assertEqual(converted[0]['reload'], .1)

    def test_at_infantry_keeps_initial_rocket_and_energy_reload(self):
        converted, _ = self.convert('人民军反坦克手')
        self.assertEqual(len(converted), 1)
        self.assertEqual(converted[0]['_projectile'], '69-1')
        self.assertEqual(converted[0]['dmg'], 144)
        self.assertAlmostEqual(converted[0]['reload'], 550 / 60, places=4)
        self.assertEqual(converted[0]['range'], 3.75)

    def test_deployable_hj8_retains_the_deployed_weapon_range(self):
        converted, _ = self.convert('PLAHJ8TEAM')
        self.assertEqual(len(converted), 1)
        self.assertEqual(converted[0]['_projectile'], 'HJ8')
        self.assertEqual(converted[0]['range'], 8.125)
        self.assertEqual(converted[0]['reload'], 10)

    def test_panzerfaust_uses_anti_tank_role_despite_reused_rocket_art(self):
        converted, _ = self.convert('韩军反坦克手')
        self.assertEqual(len(converted), 1)
        self.assertEqual(converted[0]['cls'], 'at')
        self.assertEqual(converted[0]['projectile'], 'rocket')

    def test_finite_resource_rocket_salvos_are_omitted(self):
        for name in ('MI4', 'UH1', 'EC556HAD'):
            with self.subTest(unit=name):
                converted, notes = self.convert(name)
                self.assertFalse([w for w in converted if w['cls'] == 'rocket'])
                self.assertTrue(any('finite resource/salvo cadence' in n for n in notes))

    def test_attached_missile_keeps_launch_timer_instead_of_gun_cadence(self):
        converted, _ = self.convert('台风')
        by_projectile = {w['_projectile']: w for w in converted}
        self.assertEqual(by_projectile['AIM120']['reload'], 4)
        self.assertEqual(by_projectile['AIM120']['dmg'], 630)
        self.assertEqual(by_projectile['AIM9M']['reload'], 2)

    def test_f2_automatic_initial_loadout_retains_both_missile_families(self):
        converted, notes = self.convert('F-2')
        by_projectile = {w['_projectile']: w for w in converted}
        self.assertEqual(set(by_projectile), {'AP', 'AIM120', 'AIM9M'})
        self.assertEqual(len(converted), 4)
        self.assertEqual(by_projectile['AIM120']['reload'], 4)
        self.assertEqual(by_projectile['AIM120']['range'], 37.5)
        self.assertEqual(by_projectile['AIM120']['dmg'], 630)
        self.assertEqual(by_projectile['AIM9M']['reload'], 2)
        self.assertEqual(by_projectile['AIM9M']['range'], 11.25)
        for name in ('AIM120', 'AIM9M'):
            self.assertEqual(by_projectile[name]['targets'], ['air'])
            self.assertNotIn('burst', by_projectile[name])
        self.assertTrue(any('action_AIM120: audited automatic initial loadout AIM120*4' in n for n in notes))
        self.assertTrue(any('hiddenAction_AIM9Mx2: audited automatic initial loadout AIM9M*2' in n for n in notes))

    def test_mig29_automatic_initial_loadout_excludes_optional_r27er(self):
        converted, notes = self.convert('MIG29')
        by_projectile = {w['_projectile']: w for w in converted}
        self.assertEqual(set(by_projectile), {'AP', 'R73', 'R27T'})
        self.assertEqual(len(converted), 4)
        self.assertEqual(by_projectile['R27T']['reload'], 4)
        self.assertEqual(by_projectile['R27T']['range'], 18.75)
        self.assertEqual(by_projectile['R27T']['dmg'], 600)
        self.assertEqual(by_projectile['R73']['reload'], 2)
        self.assertEqual(by_projectile['R73']['range'], 10)
        for name in ('R27T', 'R73'):
            self.assertEqual(by_projectile[name]['targets'], ['air'])
            self.assertNotIn('burst', by_projectile[name])
        self.assertTrue(any('action_挂载R27T: audited automatic initial loadout R27T*2,R73*2' in n for n in notes))

    def test_source_altitude_and_physical_barrels_are_not_merged(self):
        expected = {
            'M2A3': ['PKT', '2A42', 'TOW2'],
            '台风': ['AP', 'AP', 'AIM120', 'AIM9M'],
            'UH1': ['1', '1'],
            'HQ17': ['1', '1', '2'],
        }
        for name, projectiles in expected.items():
            with self.subTest(unit=name):
                converted, notes = self.convert(name)
                self.assertEqual([w['_projectile'] for w in converted], projectiles)
        bradley, _ = self.convert('M2A3')
        self.assertEqual(next(w for w in bradley if w['_projectile'] == 'TOW2')['reload'], 7.5)

    def test_mvp_has_no_zero_damage_weapons_or_infinite_missile_hose(self):
        roster = json.loads((Path(__file__).parent / 'mvp-roster.json').read_text())
        names = [name for nation in roster['nations'].values() for name in nation]
        names.extend(roster['shared'])
        for name in names:
            with self.subTest(unit=name):
                converted, _ = self.convert(name)
                self.assertLessEqual(len(converted), 8)
                for weapon in converted:
                    self.assertGreater(weapon['dmg'], 0)
                    self.assertGreater(weapon['range'], 0)
                    if weapon['projectile'] in ('missile', 'rocket', 'bomb'):
                        self.assertGreaterEqual(weapon['reload'], .5)
                    self.assertNotIn('ammo', weapon)

    def test_shared_tank_rounds_keep_the_fifth_source_weapon(self):
        entry = weapons.source_index()['T62']
        ini = rw.load_unit(rw.RW / entry['source'])
        converted, _ = self.convert('T62')
        definition = {'weapons': converted}
        weapons.append_main_rounds(entry, ini, definition, resources=('高爆弹', '破甲弹'))
        self.assertEqual(len(converted), 5)
        self.assertEqual(len({w['id'] for w in converted}), 5)
        self.assertTrue(any(w['_source']['turret'].startswith('turret_HEAT_') for w in converted))

    def test_am3_retains_only_its_two_original_main_round_categories(self):
        for name in ('PT76', 'PTL02'):
            entry = weapons.source_index()[name]
            ini = rw.load_unit(rw.RW / entry['source'])
            converted, _ = self.convert(name)
            weapons.append_main_rounds(entry, ini, {'weapons': converted}, resources=('高爆弹', '破甲弹'))
            self.assertFalse(any(w['_source']['turret'].startswith('turret_HE_') for w in converted))
            self.assertTrue(any(w['_source']['turret'].startswith('turret_HEAT_') for w in converted))


if __name__ == '__main__':
    unittest.main()

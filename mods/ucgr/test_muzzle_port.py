"""Original muzzle and hardpoint witnesses, independent of collision radii."""
from copy import deepcopy
import json
import unittest

import rw
from profile_pack import expand_profiles
from muzzle_port import augment_muzzles, attached_hardpoints
from weapons import convert_weapons, append_main_rounds, source_index


class MuzzleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.defs = {d['id']: d for d in expand_profiles(json.loads((rw.HERE / 'mod.json').read_text()), rw.HERE)['defs']}
        cls.sprites = json.loads((rw.HERE / 'mod.json').read_text())['sprites']

    def unit(self, name):
        entry = source_index()[name]
        ini = deepcopy(rw.load_unit(rw.RW / entry['source']))
        definition = deepcopy(self.defs[entry['id']])
        definition['weapons'], _ = convert_weapons(entry, ini)
        if name == 'T90M':
            append_main_rounds(entry, ini, definition)
        return entry, ini, definition

    def test_t90_real_main_bore_coax_and_roof_station_have_distinct_muzzles(self):
        entry, ini, definition = self.unit('T90M')
        records, omitted = augment_muzzles(entry, ini, definition, sprites=self.sprites)
        self.assertFalse([note for note in omitted if 'muzzle omitted' in note])
        points = {r['weapon']: r['muzzlePoints'] for r in records}
        self.assertEqual(points['w1'], [{'forward': 43.592378, 'lateral': .390625}])
        self.assertEqual(records[0]['sourceMuzzlePoints'], [{'forward': 56.25, 'lateral': 0}])
        self.assertEqual(records[0]['visualTip']['bakedPixelTip'], [39, 3])
        self.assertEqual(points['w2'], [{'forward': 8.75, 'lateral': 1.875}])
        self.assertEqual(points['w3'], [{'forward': 12.5, 'lateral': 0}])
        self.assertEqual(points['w4'], points['w1'])
        self.assertNotEqual(points['w1'][0]['forward'], definition['radius'] * .9)

    def test_visual_barrel_tip_uses_opaque_front_not_muzzle_brake_box_center(self):
        entry, ini, definition = self.unit('L2A6')
        records, _ = augment_muzzles(entry, ini, definition, sprites=self.sprites)
        cannon = next(record for record in records if record['weapon'] == 'w1')
        self.assertEqual(cannon['muzzlePoints'], [{'forward': 49.860945, 'lateral': 0}])
        self.assertEqual(cannon['sourceMuzzlePoints'], [{'forward': 62.5, 'lateral': 0}])
        tip = cannon['visualTip']
        # The barrel region holds the barrel alone, without its painted shadow.
        self.assertAlmostEqual((tip['barrelRegion'][0] + tip['barrelRegion'][2]) / 2, .5)
        self.assertEqual(tip['bakedPixelTip'][0], tip['displaySize'][0] * tip['supersample'] / 2)

    def test_pgz09_alternates_between_its_two_real_barrels(self):
        entry, ini, definition = self.unit('PGZ09')
        records, omitted = augment_muzzles(entry, ini, definition)
        self.assertEqual(omitted, [])
        for record in records:
            # Its inherited AA template uses turretSize10, added to source y20.
            self.assertEqual(record['muzzlePoints'], [{'forward': 18.75, 'lateral': 6.5625},
                                                      {'forward': 18.75, 'lateral': -6.5625}])

    def test_fixed_wing_missiles_start_at_attachment_slots_not_the_lock_turret(self):
        entry, ini, definition = self.unit('F-2')
        slots = attached_hardpoints(entry, ini, 'AIM120')
        self.assertEqual([(slot['x'], slot['y']) for slot in slots], [(15, -1), (-15, -1), (30, -5), (-30, -5)])
        records, omitted = augment_muzzles(entry, ini, definition)
        missile = next(record for record in records if record.get('hardpoints') == slots)
        self.assertEqual(missile['muzzlePoints'], [{'forward': -.625, 'lateral': 9.375},
                                                 {'forward': -.625, 'lateral': -9.375},
                                                 {'forward': -3.125, 'lateral': 18.75},
                                                 {'forward': -3.125, 'lateral': -18.75}])
        self.assertFalse(next(w for w in definition['weapons'] if w['id'] == missile['weapon'])['turret'])

    def test_nested_slave_is_measured_from_the_firing_ring_once(self):
        ini = {'attack': {'turretSize': '10'},
               'turret_MAIN': {'x': '8', 'y': '5'},
               'turret_BARREL': {'x': '-3', 'y': '20', 'size': '30', 'attachedTo': 'MAIN'}}
        definition = {'kind': 'unit', 'turretMounts': [{'x': 3.2, 'y': -2}],
                      'weapons': [{'id': 'gun', '_source': {'turret': 'turret_BARREL'}}],
                      'extensions': {'articulation-v1': {'mounts': [{'id': 'mount-main', 'weapons': ['gun']}]}}}
        records, omitted = augment_muzzles({'rwName': 'test', 'source': 'test.ini'}, ini, definition)
        self.assertEqual(omitted, [])
        self.assertEqual(records[0]['muzzlePoints'], [{'forward': 31.25, 'lateral': -1.875}])
        # At hull and barrel heading east, native mountAt puts MAIN at
        # (+3.125,+5); the real shot is then (+34.375,+3.125), not a second
        # addition of the main ring's source x/y to the muzzle point.
        self.assertEqual(3.125 + records[0]['muzzlePoints'][0]['forward'], 34.375)
        self.assertEqual(5 + records[0]['muzzlePoints'][0]['lateral'], 3.125)

    def test_rw_115_default_barrel_size_and_global_scale_resolve_original_helicopter_muzzles(self):
        for name in ['EC556HAD', 'MI4', 'UH1']:
            entry, ini, definition = self.unit(name)
            records, omitted = augment_muzzles(entry, ini, definition)
            self.assertEqual(omitted, [], name)
            self.assertEqual(len(records), len(definition['weapons']))
        ini = {'core': {'globalScale': '2'}, 'turret_MAIN': {'x': '0', 'y': '0'}}
        definition = {'kind': 'unit', 'weapons': [{'id': 'gun', '_source': {'turret': 'turret_MAIN'}}]}
        records, omitted = augment_muzzles({'rwName': 'test', 'source': 'test.ini'}, ini, definition)
        self.assertEqual(omitted, [])
        self.assertEqual(records[0]['barrelY'], 2)
        self.assertEqual(records[0]['muzzlePoints'], [{'forward': 1.25, 'lateral': 0}])
        ini['turret_MAIN']['size'] = '7'
        records, _ = augment_muzzles({'rwName': 'test', 'source': 'test.ini'}, ini, definition)
        self.assertEqual(records[0]['barrelY'], 7)

    def test_dynamic_or_cyclic_source_geometry_is_reported_without_guessing(self):
        entry, ini, definition = self.unit('T90M')
        ini['turret_APFSDS_1']['y'] = 'memory.barrelPosition'
        definition['weapons'][0].pop('muzzlePoints', None)
        _, omitted = augment_muzzles(entry, ini, definition)
        self.assertTrue(any('nonliteral y' in note for note in omitted))
        self.assertNotIn('muzzlePoints', definition['weapons'][0])

    def test_original_recoil_uses_native_exposed_barrel_regions(self):
        entry, ini, definition = self.unit('T90M')
        records, notes = augment_muzzles(entry, ini, definition, sprites=self.sprites)
        self.assertEqual(definition['weapons'][0]['recoil'], 6)
        self.assertEqual(definition['weapons'][3]['recoil'], 6)
        self.assertNotIn('recoil', definition['weapons'][1])
        self.assertNotIn('recoil', definition['weapons'][2])
        self.assertTrue(records[0]['recoil']['barrels'])

    def test_roof_gun_does_not_recoil_an_unrelated_main_barrel(self):
        entry, ini, definition = self.unit('AMX10RC')
        records, notes = augment_muzzles(entry, ini, definition, sprites=self.sprites)
        self.assertEqual(definition['weapons'][0]['recoil'], 2)
        self.assertNotIn('recoil', definition['weapons'][2])
        self.assertTrue(any('w3: source recoil omitted' in note for note in notes))

    def test_aircraft_fixed_origin_requires_source_proof(self):
        entry, ini, definition = self.unit('Z10')
        records, notes = augment_muzzles(entry, ini, definition)
        self.assertEqual(len(records), 3)
        self.assertTrue(all(record['muzzleFrame'] == 'hull' for record in records))
        self.assertEqual(ini['attack']['isFixedFiring'], 'true')
        entry, ini, definition = self.unit('A10')
        records, notes = augment_muzzles(entry, ini, definition)
        cannon = next(record for record in records if record['weapon'] == 'w1')
        self.assertEqual(cannon['muzzlePoints'], [{'forward': .625, 'lateral': 0}])
        self.assertEqual(cannon['muzzleAnchor'], {'forward': 28.125, 'lateral': 0})
        self.assertEqual(definition['weapons'][0]['extensions']['articulation-v1']['muzzleFrame'], 'bore')
        self.assertTrue(definition['weapons'][0]['turret'])


if __name__ == '__main__':
    unittest.main()

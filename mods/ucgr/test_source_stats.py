import json
import unittest

import rw
from source_stats import unit_stats


class SourceStatsTests(unittest.TestCase):
    def test_speed_and_sight_use_the_same_spatial_scale(self):
        stats = unit_stats({'core': {'maxHp': '800', 'radius': '40', 'fogOfWarSightRange': '20'},
                            'movement': {'moveSpeed': '1', 'maxTurnSpeed': '1'}})
        self.assertEqual(stats['speed'], 24)
        self.assertEqual(stats['vision'] * 32, 160)
        self.assertEqual(stats['radius'], 16)
        self.assertAlmostEqual(stats['turnRate'], 1.047197551, places=8)

    def test_source_hp_is_not_clipped_to_mvp_balance(self):
        self.assertEqual(unit_stats({'core': {'maxHp': '23000000'}})['hp'], 13_800_000)
        self.assertEqual(unit_stats({'core': {'maxHp': '50'}})['hp'], 30)
        self.assertEqual(unit_stats({'core': {'selfRegenRate': '.01'}})['regen'], .36)

    def test_no_silent_expression_or_capacity_fallback(self):
        for ini in [{'movement': {'moveSpeed': 'memory.speed'}},
                    {'movement': {'moveSpeed': '10000'}}, {'core': {'maxHp': 'nan'}}]:
            with self.assertRaises(ValueError):
                unit_stats(ini)

    def test_every_selected_unit_has_literal_in_range_source_stats(self):
        selection = json.loads((rw.HERE / 'mvp-roster.json').read_text())
        entries = {e['rwName']: e for e in json.loads((rw.HERE / 'inventory.json').read_text())['entries']}
        for name in [n for group in selection['nations'].values() for n in group] + selection['shared']:
            with self.subTest(name=name):
                unit_stats(rw.load_unit(rw.RW / entries[name]['source']))


if __name__ == '__main__':
    unittest.main()

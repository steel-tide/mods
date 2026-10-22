"""Regression checks for fidelity-sensitive source import, with no game writes."""
import json
from pathlib import Path
import tempfile
import unittest
import rw


class ReaderTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.old_root = rw.RW
        rw.RW = Path(self.temp.name).resolve()
        rw.load_file.cache_clear()
        rw.load_unit.cache_clear()

    def tearDown(self):
        rw.RW = self.old_root
        rw.load_file.cache_clear()
        rw.load_unit.cache_clear()
        self.temp.cleanup()

    def put(self, name, text):
        p = rw.RW / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding='utf-8')
        return p

    def test_inheritance_variables_and_origins(self):
        self.put('all-units.template', '[core]\n@global armor:20\n[graphics]\nimage:base.png\n')
        base = self.put('templates/tank.key', '[core]\nmaxHp:100\n@global reload:390\n[turret_main]\nx:4\ny:8\ndelay:${reload/60}s\n')
        unit = self.put('units/tank.ini', '[core]\ncopyFrom:ROOT:templates/tank.key\nname:T90M\nmaxHp:1100\n@global armor:600\ndisplayDescription:Armor ${armor}\n[turret_alt]\n@copyFromSection:turret_main\nx:7\n')
        value = rw.load_unit(unit)
        self.assertEqual(value['core']['maxHp'], '1100')
        self.assertEqual(value['core']['displayDescription'], 'Armor 600')
        self.assertEqual(value['turret_alt']['delay'], '6.5s')
        self.assertEqual(value['turret_alt']['x'], '7')
        self.assertEqual(value.origins['turret_alt']['y'], str(base))
        self.assertFalse(value.warnings)

    def test_section_defines_are_local_and_dynamic_expressions_survive(self):
        p = self.put('unit.ini', '[core]\nname:test\n@global n:4\n[action_a]\n@define n:9\ntext:${n}\nisVisible:if self.hp < memory.threshold\n[action_b]\ntext:${n}\nunknown:${memory.threshold}\n')
        value = rw.load_unit(p)
        self.assertEqual(value['action_a']['text'], '9')
        self.assertEqual(value['action_b']['text'], '4')
        self.assertEqual(value['action_a']['isVisible'], 'if self.hp < memory.threshold')
        self.assertEqual(value['action_b']['unknown'], '${memory.threshold}')

    def test_multiline_and_windows_paths(self):
        p = self.put('unit.ini', '[core]\nname:test\ndisplayDescription:"""A:B\nC:D\n"""\n')
        self.put('Art/TANK.PNG', 'pixels')
        self.assertEqual(rw.load_unit(p)['core']['displayDescription'], 'A:B\nC:D')
        self.assertTrue(rw.resolve('ROOT:Art\\tank.png', rw.RW).samefile(rw.RW/'Art/TANK.PNG'))

    def test_embedded_multiline_logic_retains_assignment_and_suffix(self):
        p = self.put('squad.ini', '[core]\nname:squad\n[action_vision]\nsetUnitStats:fogOfWarSightRange="""\nmax(attachment(slot="1").memory.sight,\nattachment(slot="2").memory.sight)"""\ndebugMessage:%{"""max(1,2)"""}\n')
        section = rw.load_unit(p)['action_vision']
        self.assertEqual(section['setUnitStats'], 'fogOfWarSightRange=max(attachment(slot="1").memory.sight,\nattachment(slot="2").memory.sight)')
        self.assertEqual(section['debugMessage'], '%{max(1,2)}')

    def test_missing_inheritance_is_reported_not_silently_used(self):
        p = self.put('unit.ini', '[core]\ncopyFrom:missing.key\nname:test\n')
        self.assertIn('missing copyFrom missing.key', rw.load_unit(p).warnings[0])

    def test_numeric_reader_does_not_execute_code_or_swallow_suffixes(self):
        self.assertEqual(rw.numeric_expression('max(2, 390 / 60)'), 6.5)
        with self.assertRaises(ValueError):
            rw.numeric_expression('__import__("os").getcwd()')
        self.assertEqual(rw.num('1000', None), 1000)
        self.assertIsNone(rw.num('1000s', None))


class SuppliedPackageTests(unittest.TestCase):
    @unittest.skipUnless(rw.RW.is_dir(), 'original package not present')
    def test_source_inventory_preserves_all_records_and_resolves_descriptions(self):
        data = rw.inventory()
        entries = data['entries']
        self.assertEqual(len(entries), len(list(rw.RW.rglob('*.ini'))))
        self.assertEqual(len({e['id'] for e in entries}), len(entries))
        self.assertTrue(all(len(e['id']) <= 39 for e in entries))
        self.assertFalse(data['duplicates'])
        self.assertFalse([w for e in entries for w in e['warnings']])
        self.assertFalse([d for e in entries for d in e['desc'] if '${' in d])
        t90 = next(e for e in entries if e['rwName'] == 'T90M')
        self.assertIn('V-92S2F', t90['desc'][0])
        self.assertIn('化石', t90['desc'][1])
        self.assertEqual(t90['image'], 'ROOT:PUB/透明.png')
        ini = rw.load_unit(rw.RW / t90['source'])
        self.assertIn('decal_车体', ini)
        # The raw placeholder and layered art must remain distinguishable.
        self.assertNotEqual(ini['decal_车体'].get('image'), ini['graphics']['image'])


if __name__ == '__main__':
    unittest.main()

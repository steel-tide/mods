"""The full candidate ledger has translations even when its runtime is deferred."""
import json
import unittest
import rw


class LocalizationTests(unittest.TestCase):
    def test_all_candidates_have_complete_text_tuples(self):
        texts = json.loads((rw.HERE / 'localization.json').read_text())
        candidates = json.loads((rw.HERE / 'roster.json').read_text())['entries']
        for candidate in candidates:
            if not candidate['include']:
                continue
            with self.subTest(unit=candidate['rwName']):
                entry = texts[candidate['rwName']]
                for field in ('name', 'desc'):
                    self.assertEqual(len(entry[field]), 3)
                    self.assertTrue(all(isinstance(s, str) and '${' not in s for s in entry[field]))
                self.assertTrue(all(entry['name']))
                # The source Recon UAV intentionally has no description.
                if candidate['rwName'] != 'UAV':
                    self.assertTrue(all(entry['desc']))

    def test_new_translations_keep_source_english_and_chinese(self):
        texts = json.loads((rw.HERE / 'localization.json').read_text())
        entries = {e['rwName']: e for e in json.loads((rw.HERE / 'inventory.json').read_text())['entries']}
        for name in ('2S35', '2S35未架设', 'M109A7', 'M109A7未架设', 'Obj490M', 'PCL181',
                     'PCL181未架设', 'PLAPOWER', 'PLZ05', 'PLZ05未架设', 'Pzh2000', 'Pzh2000未架设',
                     'T80U圣诞', 'T80BV_U', 'TOS1A', '凯撒', '凯撒未架设', '泠峰'):
            core = rw.load_unit(rw.RW / entries[name]['source'])['core']
            for field, source in [('name', 'displayText'), ('desc', 'displayDescription')]:
                self.assertEqual(texts[name][field][:2], [core[source].replace('\\n', '\n'), core[source + '_zh'].replace('\\n', '\n')])


if __name__ == '__main__':
    unittest.main()

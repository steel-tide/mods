import unittest
import rw
import weapons
from copy import deepcopy
from targeting_port import augment_targeting, infantry_concealment, CAPABILITY


class TargetingTests(unittest.TestCase):
    def test_t90_source_exclusions_are_retained_per_barrel(self):
        e = weapons.source_index()['T90M']; ini = rw.load_unit(rw.RW/e['source'])
        converted, _ = weapons.convert_weapons(e, ini)
        definition = {'weapons': converted}
        augment_targeting(e, ini, definition)
        self.assertIn('装甲', definition['extensions'][CAPABILITY]['tags'])
        self.assertEqual(converted[0]['extensions'][CAPABILITY]['withoutTags'], ['FOB', 'soldiers', 'dest'])
        self.assertIn('高空', converted[2]['extensions'][CAPABILITY]['withoutTags'])

    def test_default_equipment_tags_and_literal_source_detection_hysteresis(self):
        e = weapons.source_index()['PLAINF']; ini = rw.load_unit(rw.RW/e['source'])
        converted, _ = weapons.convert_weapons(e, ini); d = {'weapons': converted}
        augment_targeting(e, ini, d)
        cfg = d['extensions'][CAPABILITY]
        self.assertIn('QBZ95', cfg['tags']); self.assertIn('MAS1', cfg['tags'])
        self.assertEqual([r['range'] for r in cfg['concealment']['enter']], [160, 160, 80, 120])
        self.assertEqual([r['range'] for r in cfg['concealment']['leave']], [140, 140, 70, 100])
        changed = deepcopy(ini)
        changed['hiddenAction_trigger_mas_1']['autoTrigger'] += ' and self.hasFlag(id=12)'
        self.assertIsNone(infantry_concealment(changed, cfg['tags']))


    def test_actual_mas3_energy_and_trench_tables_are_retained(self):
        e=weapons.source_index()['人民军反坦克手'];ini=rw.load_unit(rw.RW/e['source']);converted,_=weapons.convert_weapons(e,ini);d={'weapons':converted}
        augment_targeting(e,ini,d);c=d['extensions'][CAPABILITY]['concealment']
        self.assertEqual(c['energy'],{'max':550,'regen':60,'costs':[{'id':'w1','amount':550}]})
        self.assertEqual([r['range'] for r in c['trench']['enter']],[120,120,60,60])
        changed=deepcopy(ini);changed['hiddenAction_trigger_mas3战壕']['autoTrigger']+=' and false'
        self.assertIsNone(infantry_concealment(changed,d['extensions'][CAPABILITY]['tags'],d))


if __name__ == '__main__': unittest.main()

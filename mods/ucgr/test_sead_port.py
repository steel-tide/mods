from copy import deepcopy
import json
from pathlib import Path
import unittest
from unittest.mock import patch

import rw
import sead_port as port
import weapons

@unittest.skipUnless(rw.RW.is_dir(), 'original package absent')
class SeadSourceTests(unittest.TestCase):
    def test_three_source_families_preserve_different_launch_station_flags(self):
        for family in port.FAMILIES:
            with self.subTest(family=family):
                carrier, helper, entry = port.source_sead_family(family)
                self.assertEqual(carrier['rounds'],4)
                self.assertEqual(carrier['range'],1000)
                self.assertEqual(carrier['scanInterval'],.75)
                self.assertEqual(carrier['queueTime'],.25)
                self.assertEqual(carrier['alternate'],family!='AGM88')
                self.assertEqual(carrier['lateral'],[12,-12] if family=='AGM88' else [10,-10])
                self.assertEqual(helper['id'],entry['id'])
                spec=helper['extensions']['sensors-v1']['seadMissile']
                self.assertEqual((spec['energy'],spec['lostDrain'],spec['interval']),(300,50,.25))
                self.assertEqual((spec['primaryDamage'],spec['primaryRadius']),(480,48))
                self.assertEqual((spec['payloadDamage'],spec['payloadRadius'],spec['payloadExpand']),(300,20,.25))
                payload=helper['weapons'][1]['extensions']['components-v1']
                self.assertEqual(payload['family'],'chemical')
                self.assertTrue(payload['top'])
                self.assertEqual(payload['recipient'],{'range':32,'radiusSquared':1.5})
                self.assertEqual([w['id'] for w in helper['weapons']],['primary','payload'])

    def test_actual_f16_sandbox_loadout_and_original_energy_override(self):
        entry=weapons.source_index()['F-16C'];ini=rw.load_unit(rw.RW/entry['source'])
        carrier=port.source_sead_carrier(entry,ini)
        self.assertEqual(carrier['family'],'AGM88')
        self.assertEqual(carrier['energy'],16)
        self.assertEqual(carrier['energyRegen'],0)
        self.assertEqual(carrier['speedReset'],-.05)
        definition={'id':entry['id'],'weapons':[]}
        self.assertTrue(port.augment_sead(entry,ini,definition))
        self.assertEqual(len(port.sead_helpers([definition])),1)

    def test_unrelated_original_aircraft_do_not_gain_new_equipment(self):
        for name in ('MIG29','SU35S','J-10','A10'):
            e=weapons.source_index()[name]
            self.assertIsNone(port.source_sead_carrier(e,rw.load_unit(rw.RW/e['source'])))

    def test_changed_source_sandbox_condition_is_rejected(self):
        e=weapons.source_index()['F-16C'];ini=deepcopy(rw.load_unit(rw.RW/e['source']))
        ini['action_AGM88']['isVisible']='true'
        definition={'id':e['id'],'weapons':[]}
        notes=port.augment_sead(e,ini,definition)
        self.assertIn('omitted',notes[0]);self.assertNotIn('extensions',definition)

    def test_source_missile_energy_and_waypoint_changes_do_not_silently_compile(self):
        original=port._unit
        def changed(name):
            e,ini=original(name);ini=deepcopy(ini)
            if name=='AGM88反辐射弹药':ini['hiddenAction_自爆']['addEnergy']='-25'
            return e,ini
        with patch.object(port,'_unit',side_effect=changed):
            with self.assertRaises(port.SourceMismatch):port.source_sead_family('AGM88')

    def test_checked_in_runtime_evidence_is_generated_from_actual_sources(self):
        data=json.loads((Path(__file__).parent/'sead-source-data.json').read_text())
        e=weapons.source_index()['F-16C'];ini=rw.load_unit(rw.RW/e['source'])
        self.assertEqual(data['carrier'],port.source_sead_carrier(e,ini))
        self.assertEqual(data['helper'],port.source_sead_family('AGM88')[1])

if __name__=='__main__':unittest.main()

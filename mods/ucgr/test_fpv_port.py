import unittest
from copy import deepcopy
from fpv_port import *

class FpvSourceTests(unittest.TestCase):
    def test_all_frontline_factions_share_literal_inventory_and_deployment(self):
        profiles=[]
        for name in OPERATORS:
            e,ini=unit(name);profiles.append(fpv_operator_profile(e,ini))
        self.assertTrue(all(p==profiles[0] for p in profiles))
        self.assertEqual(profiles[0]['stock'],10)
        self.assertEqual(profiles[0]['drones'],['usgr-re-fpv','usgr-re-fpvpg7v','usgr-re-fpvrpom'])
    def test_controller_clause_drift_is_rejected(self):
        e,ini=unit('USFPVSQUAD');ini['hiddenAction_侦察']['spawnUnits']='FPVPG7V'
        with self.assertRaises(SourceMismatch):fpv_operator_profile(e,ini)
    def test_attack_payloads_keep_primary_and_each_spawn_separate(self):
        for name in DRONES:
            d,_=fpv_drone_definition(name)
            self.assertEqual(d['extensions']['components-v1']['sourceMovement']['acceleration'],1)
            if name=='FPV':self.assertEqual(d['extensions']['sensors-v1']['fpvDrone']['energy'],300);continue
            cfg=d['extensions']['sensors-v1']['fpvDrone'];self.assertEqual([p['chance'] for p in cfg['payloads']],[.5,1])
            self.assertEqual(len(d['weapons']),3)
            phase=d['weapons'][0]['extensions']['components-v1']['hpPhases'][0]
            self.assertEqual((phase['direct'],phase['area'],phase['radius']),(6,60,20))
            self.assertTrue(all(w['extensions']['components-v1']['sourceHelper'] for w in d['weapons'][1:]))
if __name__=='__main__':unittest.main()

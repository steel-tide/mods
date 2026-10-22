from copy import deepcopy
import unittest
import rw
from weapons import source_index
from logistics_port import stock_id
import radar_battery_port as port

@unittest.skipUnless(rw.RW.is_dir(),'source absent')
class BatteryTests(unittest.TestCase):
    def source(self,name):
        e=source_index()[name];return e,rw.load_unit(rw.RW/e['source'])
    def test_three_providers_preserve_initial_off_and_authored_indexing_quirk(self):
        for name in port.PROVIDERS:
            e,i=self.source(name);d={'weapons':[]}
            self.assertIn('Source split',port.augment_radar_battery(e,i,d)[0])
            cfg=d['extensions']['sensors-v1'];self.assertFalse(cfg['radarControl']['initial']);self.assertEqual(cfg['radarBattery']['hpTransfer'],.6)
            self.assertEqual(cfg['radarBattery']['indexDistance'],name!='HAWK雷达车')
            self.assertEqual(cfg['radarBattery']['listCap'],port.PROVIDERS[name])
    def test_actual_launchers_require_real_finite_logistics_stock(self):
        for name,resource in port.LAUNCHERS.items():
            e,i=self.source(name);d={'extensions':{'logistics-v1':{'stocks':[{'id':stock_id(resource)}]}}}
            cfg=port.radar_battery_profile(e,i,d)
            self.assertEqual(cfg['stock'],stock_id(resource));self.assertEqual(cfg['waypointTime'],5)
            self.assertEqual(cfg['high'],1000 if name=='HAWK发射车' else 800)
            with self.assertRaises(port.SourceMismatch):port.radar_battery_profile(e,i,{})
    def test_changed_resource_transfer_is_rejected_instead_of_upgrading_capacity(self):
        e,i=self.source('HAWK雷达车');i=deepcopy(i);i['hiddenAction_编入防空车列表1']['takeResources_maxUnits']='3'
        with self.assertRaises(port.SourceMismatch):port.radar_battery_profile(e,i,{})
    def test_unrelated_autonomous_buk_launcher_is_not_changed(self):
        e,i=self.source('9K37M2');self.assertIsNone(port.radar_battery_profile(e,i,{}))
if __name__=='__main__':unittest.main()

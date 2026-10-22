import unittest
from copy import deepcopy
import rw
from weapons import source_index,convert_weapons
from barrage_port import append_barrage_weapons,augment_barrages

class BarrageCompilerTests(unittest.TestCase):
    def test_mortar_original_count_and_timing(self):
        e=source_index()['2S23'];ini=rw.load_unit(rw.RW/e['source']);weapons,_=convert_weapons(e,ini)
        weapon=next(w for w in weapons if w['_source']['turret']=='turret_APFSDS')
        d={'weapons':weapons,'extensions':{'articulation-v1':{'mounts':[{'id':'mount-2','weapons':[weapon['id']]}]}}}
        augment_barrages(e,ini,d);b=d['extensions']['articulation-v1']['barrages'][0]
        self.assertEqual((b['shots'],b['first'],b['interval'],b['cooldown']),(5,2,6,40))
        self.assertFalse(b['componentGate'])
        changed=deepcopy(ini);changed['hiddenAction_迫击炮覆盖']['alsoQueueAction']='different'
        with self.assertRaises(ValueError):augment_barrages(e,changed,d)

    def test_manual_main_barrels_do_not_become_automatic_native_guns(self):
        for name in ('2S35','M109A7','PCL181','PLZ05','Pzh2000','凯撒'):
            e=source_index()[name];ini=rw.load_unit(rw.RW/e['source']);weapons,_=convert_weapons(e,ini)
            self.assertFalse(any(w['_source']['turret']=='turret_2' for w in weapons))
            append_barrage_weapons(e,ini,{'weapons':weapons})
            self.assertEqual(sum(w['_source']['turret']=='turret_2' for w in weapons),1)

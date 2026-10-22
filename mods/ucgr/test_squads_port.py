import json
import unittest
from copy import deepcopy
import rw
from weapons import source_index,convert_weapons
import squads_port as port

class SquadCompilerTests(unittest.TestCase):
    def test_source_dynamic_members_and_morale_tags(self):
        for name,controller in [('PLAINF','五人班组'),('RUSSSO','三人班组')]:
            e=source_index()[name];u=rw.load_unit(rw.RW/e['source']);weapons,_=convert_weapons(e,u);d={'weapons':weapons}
            port.augment_squads(e,u,d)
            self.assertEqual(d['extensions'][port.CAPABILITY]['member']['controller'],source_index()[controller]['id'])
            self.assertTrue(any(w.get('extensions',{}).get(port.CAPABILITY,{}).get('moraleLoss') for w in weapons))
        e=source_index()['PLAHJ8TEAM'];u=rw.load_unit(rw.RW/e['source']);d={'weapons':[]};port.augment_squads(e,u,d)
        self.assertNotIn(port.CAPABILITY,d.get('extensions',{}))

    def test_original_positions_times_and_trench_images(self):
        text=json.loads((rw.HERE/'localization.json').read_text());text=text.get('entries',text)
        media={'defPatches':{e['id']:{} for e in port.squad_art_entries()}}
        defs=port.squad_definitions(text,media)
        five=next(d for d in defs if d['id']==source_index()['五人班组']['id'])
        spec=five['extensions'][port.CAPABILITY]['controller']
        self.assertEqual(spec['capacity'],5)
        self.assertEqual(spec['positions'][0],{'x':8.8,'y':-2.0})
        self.assertEqual((spec['digTime'],spec['exitTime']),(20,1))
        self.assertEqual(spec['groundOffset'],.4)
        self.assertEqual(five['pop'],0)
        self.assertEqual(five['weapons'],[])

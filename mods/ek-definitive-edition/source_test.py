#!/usr/bin/env python3
"""Source preservation and converter regressions; no game changes or network."""
import json
import unittest
from pathlib import Path
from PIL import Image
from port import HERE, RW, resources, strings, load
from logic import compile_expr, Unsupported

class Preservation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest=json.loads((HERE/'mod.json').read_text())
        cls.source=load()
        cls.defs={d['id']:d for d in cls.manifest['defs']}

    def test_source_identity_and_original_text(self):
        self.assertEqual(len(self.source),573)
        self.assertEqual(set(self.defs),{e['id'] for e in self.source})
        for e in self.source:
            c=e['ini']['core'];d=self.defs[e['id']]
            self.assertEqual(d['name'][0],strings(c.get('displayText',e['rwName'])),e['source'])
            if c.get('displayText_zh'):self.assertEqual(d['name'][1],strings(c['displayText_zh']))
            desc=d['desc'] if isinstance(d['desc'],dict) else dict(zip(('en','zh','ko'),d['desc']))
            self.assertEqual(desc['en'],strings(c.get('displayDescription','')),e['source'])
            if c.get('displayDescription_zh'):self.assertEqual(desc['zh'],strings(c['displayDescription_zh']))
            self.assertTrue(d['name'][2])
            if desc['en']:self.assertTrue(desc['ko'])

    def test_inherited_section_variables(self):
        entry=next(e for e in self.source if e['rwName']=='Ek_modular_bunker_emptySlot')
        self.assertEqual(entry['ini']['action_buildGun']['descriptionAddFromUnit'],'Ek_modular_bunker_gunturret')
        for e in self.source:
            for section,fields in e['ini'].items():
                if section.startswith(('action_','hiddenAction_','turret_','projectile_')):
                    for key,value in fields.items():
                        self.assertNotIn('${',value,(e['source'],section,key))

    def test_unset_flags_do_not_set_the_same_flags(self):
        self.assertEqual(resources('unsetFlag=10-12,setFlag=11'),{'unsetflag':[10,11,12],'setflag':[11]})

    def test_expression_compiler_is_data_only(self):
        self.assertEqual(compile_expr('if self.ammo(greaterThan=10)')[0],'call')
        self.assertEqual(compile_expr("self.attachment(withTag='x').resource.ammo")[0],'of')
        with self.assertRaises(Unsupported):compile_expr("__import__('os')")

    def test_package_budget_media_and_license(self):
        self.assertLessEqual((HERE/'mod.json').stat().st_size,4*1024*1024)
        for item in self.manifest['sprites']+self.manifest['sounds']:self.assertTrue((HERE/item['file']).is_file(),item['file'])
        for path in self.manifest['screenshots']:
            # The user-selected cover retains its original 16:9 composition.
            # Registry validation records that exception; game captures stay 4:3.
            with Image.open(HERE/path) as image:
                if path!='screenshots/cover.jpeg':self.assertEqual(image.width*3,image.height*4)
            self.assertLess((HERE/path).stat().st_size,2*1024*1024)
        self.assertEqual((HERE/'LICENSE.txt').read_bytes(),(RW/'CC-BY-NC-ND-4.0.md').read_bytes())

if __name__=='__main__':unittest.main()

"""Source-backed acceptance checks; no original RW scripts are executed."""
import hashlib
import json
import unittest
from pathlib import Path
from PIL import Image
from port import HERE, RW, load, EXCLUDED, CAP, NATIONS, WORLD, seconds, resource, metal, num

class SourcePort(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source=load();cls.mod=json.loads((HERE/'mod.json').read_text());cls.report=json.loads((HERE/'conversion-report.json').read_text())
        cls.units={e['rwName']:e for e in cls.source};cls.defs={d['id']:d for d in cls.mod['defs']}

    def test_every_source_definition_has_exactly_one_disposition(self):
        self.assertEqual(len(self.source),300)
        self.assertEqual({e['source'] for e in self.source},{e['source'] for e in self.report['entries']})
        omitted={e['rwName'] for e in self.report['entries'] if e['status']=='omitted'}
        self.assertEqual(omitted,set(EXCLUDED))
        self.assertEqual(len(self.mod['defs']),285)
        self.assertTrue(all('Excavator '+n in self.units for n in ('US','RU','JP','CH','AFP')))

    def test_original_hp_and_complete_english_descriptions_survive(self):
        for name,e in self.units.items():
            if name in EXCLUDED:continue
            d=self.defs[e['id']];c=e['ini']['core']
            self.assertEqual(d['hp'],float(c['maxHp']),name)
            desc=c.get('displayDescription','').replace('\\\\n','\n').replace('\\n','\n').strip()
            if not desc:self.assertEqual(d['desc'],'')
            elif desc=='鹰眼':self.assertEqual(d['desc']['en'],'Hawkeye')
            else:self.assertEqual(d['desc']['en'],desc,name)
            if desc:
                self.assertTrue(d['desc']['zh']);self.assertTrue(d['desc']['ko'])

    def test_all_source_firing_mounts_are_present_even_beyond_native_eight(self):
        for name,e in self.units.items():
            if name in EXCLUDED:continue
            ini=e['ini'];c=self.defs[e['id']]['extensions'][CAP]
            if ini.get('attack',{}).get('canAttack','true').lower()=='false':continue
            expected={s[7:] for s,t in ini.items() if s.startswith('turret_') and t.get('canShoot','true').lower()!='false'
                      and 'projectile_'+t.get('projectile','1') in ini
                      and any(t.get(k,ini.get('attack',{}).get(k,'true' if k!='canAttackUnderwaterUnits' else 'false')).lower()=='true'
                              for k in ('canAttackLandUnits','canAttackFlyingUnits','canAttackUnderwaterUnits'))}
            actual={g['id'] for g in c['guns']}
            self.assertTrue(expected<=actual,(name,expected-actual))
        iowa=self.defs[self.units['SimpleIowa']['id']]['extensions'][CAP]
        self.assertEqual(len(iowa['guns']),24)

    def test_exported_pixels_are_original_not_regenerated(self):
        for sheet in self.mod['sprites']:
            original=RW/self.report['images'][sheet['key']]['source']
            with Image.open(original) as a,Image.open(HERE/sheet['file']) as b:
                self.assertEqual(a.convert('RGBA').size,b.size)
                self.assertEqual(a.convert('RGBA').tobytes(),b.convert('RGBA').tobytes(),sheet['key'])

    def test_national_bases_have_full_size_art_and_placement_footprints(self):
        sheets={s['key']:s for s in self.mod['sprites']}
        names=[name for _,hq,factory,_ in NATIONS.values() for name in (hq,factory)]
        names+=['CHDCK','JPDCK','AFPD','RUDCK','USDCK']
        for name in names:
            d=self.defs[self.units[name]['id']];s=sheets[d['sprite']]
            self.assertEqual((d['fw'],d['fh']),(3,3),name)
            self.assertEqual(s['fw'],96,name)
            self.assertFalse(s['fitFootprint'],name)
            self.assertEqual(s['anchorY'],round(s['fh']/2),name)
        for name in ('Helipad PLA','Helipad JSDF','Helipad  AFP','Helipad  US','Helipad RU'):
            d=self.defs[self.units[name]['id']];s=sheets[d['sprite']]
            self.assertEqual((d['fw'],d['fh']),(2,2),name)
            self.assertEqual((s['fw'],s['fh']),(64,64),name)

    def test_enlarged_building_parts_and_muzzles_keep_their_source_alignment(self):
        for name in ('Crane Us','C-Ram','IRON DOME','JPASMS','nukeLauncher'):
            e=self.units[name];d=self.defs[e['id']];ini=e['ini'];c=d['extensions'][CAP]
            factor=self.report['images'][d['sprite']]['buildingScaleFactor']
            self.assertGreater(factor,1,name)
            for mount in c['mounts']:
                source=ini.get('turret_'+mount['id'],ini.get(mount['id']))
                for field,sign in (('x',1),('y',-1)):
                    self.assertAlmostEqual(mount[field],sign*num(source.get(field))*WORLD*factor,places=3,msg=name)
            for gun in c['guns']:
                turret=ini['turret_'+gun['id']];attack=ini.get('attack',{})
                muzzle=max(0,num(turret.get('barrelY',turret.get('size',attack.get('turretSize')))))
                self.assertAlmostEqual(gun['muzzle'],muzzle*WORLD*factor,places=3,msg=name)
            if c.get('wreck'):
                body=self.report['images'][d['sprite']];wreck=self.report['images'][c['wreck']]
                self.assertEqual(body['scale'],wreck['scale'],name)

    def test_large_bases_and_mobile_units_keep_their_original_scale(self):
        for d in self.mod['defs']:
            art=self.report['images'][d['sprite']]
            if d['kind']=='unit':
                self.assertNotIn('buildingScaleFactor',art,d['id'])
        for name in ('USAF Air Base','Nuclear_factory','Nuclear_factoryC'):
            d=self.defs[self.units[name]['id']]
            self.assertEqual(self.report['images'][d['sprite']]['buildingScaleFactor'],1,name)

    def test_package_hashes_match_reviewable_source(self):
        package=self.mod['extensionPackages'][0]
        for part in ('schema','runtime','presentation'):
            source=(HERE/'extensions/naval-systems/src'/f'{part}.mjs').read_text()
            self.assertEqual(package[part]['source'],source)
            self.assertEqual(package[part]['sha256'],hashlib.sha256(source.encode()).hexdigest())

    def test_rw_time_units_and_declared_exchange(self):
        self.assertEqual(seconds('120'),2)
        self.assertEqual(seconds('5s'),5)
        self.assertAlmostEqual(seconds('.003',rate=True),1/(.003*60))
        self.assertAlmostEqual(metal(resource('credits=90000')),900)
        self.assertAlmostEqual(metal(resource('oil=1400')),900)
        self.assertAlmostEqual(metal(resource('Steel=1300')),400)

    def test_parser_expands_inline_actions_and_attached_rotor_inheritance(self):
        self.assertEqual(self.units['s400']['ini']['action_1']['convertTo'],'s400dep')
        for e in self.source:
            for s,t in e['ini'].items():
                if s.startswith('arm_') and t.get('copyFrom'):
                    parent=e['ini']['arm_'+t['copyFrom']]
                    if parent.get('image_end'):self.assertEqual(t['image_end'],parent['image_end'])

    def test_capitalized_ini_files_and_original_builder_art_are_not_missed(self):
        self.assertEqual(sum(e['source'].endswith('.Ini') for e in self.source),10)
        for n in ('US','RU','JP','CH','AFP'):
            d=self.defs[self.units['Excavator '+n]['id']]
            self.assertEqual(d['kind'],'unit');self.assertEqual(d['domain'],'ground')
            self.assertIn(d['sprite'],self.report['images'])

if __name__=='__main__':unittest.main()

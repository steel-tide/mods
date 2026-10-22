"""Source witnesses for the pack-local mount authoring and HJ-8 boundary."""
from copy import deepcopy
from collections import Counter
import json
import math
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

import articulation_port as port
import rw
import weapons


@unittest.skipUnless(rw.RW.is_dir(), 'original package not present')
class SourceArticulationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.media = json.loads((rw.HERE / 'media-data.json').read_text())

    def unit(self, name):
        entry = deepcopy(weapons.source_index()[name])
        ini = deepcopy(rw.load_unit(rw.RW / entry['source']))
        converted, _ = weapons.convert_weapons(entry, ini)
        definition = {'id': entry['id'], 'weapons': converted,
                      **deepcopy(self.media['defPatches'][entry['id']])}
        return entry, ini, definition

    def split(self, entry):
        entry['_articulation_art'] = {'scale': .4, 'sprites': {
            'MAIN': 'tur.' + entry['id'] + '-main',
            'NSVT': 'tur.' + entry['id'] + '-nsvt'}}

    def test_composited_station_is_not_duplicated_into_a_second_full_turret(self):
        entry, ini, definition = self.unit('T90M')
        before = deepcopy(definition)
        notes = port.augment_articulation(entry, ini, definition)
        self.assertEqual(definition, before)
        self.assertTrue(any('separate source-pixel sheets' in note for note in notes))

    def test_real_t90_main_slaves_and_independent_station_keep_source_pivots(self):
        entry, ini, definition = self.unit('T90M')
        self.split(entry)
        notes = port.augment_articulation(entry, ini, definition)
        mounts = definition['extensions']['articulation-v1']['mounts']
        self.assertEqual(len(mounts), 2)
        main, station = mounts
        self.assertEqual(main['weapons'], ['w1', 'w2'])
        self.assertEqual(station['weapons'], ['w3'])
        self.assertEqual(station['parent'], main['id'])
        self.assertEqual((main['x'], main['y']), (0, -1.6))
        self.assertEqual((station['x'], station['y']), (1.8, 1.6))
        self.assertAlmostEqual(main['turnRate'], .9 * math.pi / 3)
        self.assertAlmostEqual(station['turnRate'], 2 * math.pi / 3)
        self.assertEqual(main['targeting'], 'independent')
        self.assertNotEqual(main['sprite'], station['sprite'])
        self.assertEqual(len(notes), 2)

    def test_added_main_gun_ammunition_joins_the_original_slave_mount(self):
        entry, ini, definition = self.unit('T90M')
        self.split(entry)
        alternate = deepcopy(definition['weapons'][0])
        alternate.update(id='w4', _source={'source': entry['source'], 'turret': 'turret_HE_1', 'projectile': 'projectile_3OF26'})
        definition['weapons'].append(alternate)
        port.augment_articulation(entry, ini, definition)
        mounts = definition['extensions']['articulation-v1']['mounts']
        self.assertEqual(mounts[0]['weapons'], ['w1', 'w2', 'w4'])
        self.assertEqual(mounts[1]['weapons'], ['w3'])

    def test_single_slaved_ring_preserves_original_sheet_and_scale(self):
        entry, ini, definition = self.unit('ZBD04A')
        original = definition['turretSprite']
        port.augment_articulation(entry, ini, definition)
        mount, = definition['extensions']['articulation-v1']['mounts']
        self.assertEqual(mount['sprite'], original)
        self.assertEqual((mount['x'], mount['y']), (-1.6, 4.4))
        self.assertEqual(mount['weapons'], [weapon['id'] for weapon in definition['weapons']])

    def test_hawk_full_circle_slave_keeps_181_degree_launch_tolerance(self):
        entry, ini, definition = self.unit('HAWK发射车')
        entry['_articulation_art']={'scale':.4,'sprites':{'MAIN':'tur.hawk-rack'}}
        notes=port.augment_articulation(entry,ini,definition)
        self.assertFalse(any('omitted' in n.lower() for n in notes))
        mount,=definition['extensions']['articulation-v1']['mounts']
        self.assertEqual(set(mount['weaponTolerances']),set(mount['weapons']))
        self.assertTrue(all(abs(t-math.radians(181))<1e-9 for t in mount['weaponTolerances'].values()))

    def test_unresolved_geometry_or_missing_separate_sheet_is_atomic(self):
        for problem in ('dynamic-position', 'missing-sheet', 'dynamic-acceleration', 'slave-arc', 'cycle'):
            with self.subTest(problem=problem):
                entry, ini, definition = self.unit('T90M')
                self.split(entry)
                if problem == 'dynamic-position':
                    ini['turret_NSVT']['x'] = 'memory.shift'
                elif problem == 'missing-sheet':
                    del entry['_articulation_art']['sprites']['NSVT']
                elif problem == 'dynamic-acceleration':
                    ini['turret_NSVT']['turnSpeedAcceleration'] = 'memory.acceleration'
                elif problem == 'slave-arc':
                    ini['turret_PKT']['limitingAngle'] = '20'
                else:
                    ini['turret_MAIN']['attachedTo'] = 'NSVT'
                before = deepcopy(definition)
                notes = port.augment_articulation(entry, ini, definition)
                self.assertEqual(definition, before)
                self.assertTrue(any('omitted' in note.lower() for note in notes))

    def test_literal_acceleration_and_idle_spin_are_source_normalized(self):
        entry,ini,definition=self.unit('T90M')
        self.split(entry)
        ini['turret_NSVT']['turnSpeedAcceleration']='.5'
        ini['turret_NSVT']['turnSpeedDeceleration']='.25'
        ini['turret_NSVT']['idleSpin']='1'
        port.augment_articulation(entry,ini,definition)
        mount=next(m for m in definition['extensions']['articulation-v1']['mounts'] if m['id']=='mount-nsvt')
        self.assertAlmostEqual(mount['acceleration'],math.radians(.5)*3600)
        self.assertAlmostEqual(mount['deceleration'],math.radians(.25)*3600)
        self.assertAlmostEqual(mount['idleSpin'],math.radians(1)*60)

    def test_hj8_keeps_real_launcher_member_and_source_automatic_forms(self):
        entry, ini, deployed = self.unit('PLAHJ8TEAM')
        mobile = deepcopy(deployed)
        deployed['id'] += '-deployed'
        mobile['weapons'] = []
        original = deepcopy(deployed['weapons'])
        texts = json.loads((rw.HERE / 'localization.json').read_text())
        texts = texts.get('entries', texts)
        notes = port.configure_deployment(mobile, deployed, texts)
        self.assertEqual(deployed['weapons'], original)
        self.assertEqual(mobile['weapons'], original)
        carrying = mobile['extensions']['articulation-v1']
        firing = deployed['extensions']['articulation-v1']
        self.assertTrue(carrying['transportTogether'])
        self.assertTrue(firing['transportTogether'])
        self.assertEqual(firing['enteredTransport'],'pack-up')
        self.assertEqual(carrying['disabledWeapons'], [w['id'] for w in original])
        self.assertEqual(firing['disabledWeapons'], [])
        deploy, pack = carrying['deployments'][0], firing['deployments'][0]
        self.assertEqual((deploy['time'], pack['time']), (2, 2))
        self.assertEqual((deploy['automatic'], pack['automatic']), ('idle', 'move'))
        self.assertEqual((deploy['lockWeapons'], pack['lockWeapons']), (True, False))
        self.assertEqual(deploy['to'], deployed['id'])
        self.assertEqual(pack['to'], mobile['id'])
        member, = carrying['attachments']
        self.assertEqual(member, firing['attachments'][0])
        self.assertEqual(member['unit'], weapons.source_index()['PLAINF']['id'])
        self.assertEqual((member['x'], member['y']), (4.800000000000001, 2.4000000000000004))
        self.assertAlmostEqual(member['rest'], math.radians(35))
        self.assertTrue(any('transport' in note for note in notes))

    def test_split_tank_sheets_keep_each_original_layer_and_its_parent_relative_pivot_once(self):
        import media
        for name in ('T72B3', 'T90M', 'T14'):
            with self.subTest(unit=name), TemporaryDirectory() as temporary:
                entry, ini, _ = self.unit(name)
                entry['ini'] = ini
                original_assemble = media.assemble

                def build(folder, split):
                    path = Path(temporary) / folder
                    path.mkdir()
                    candidate = deepcopy(entry)
                    if split:
                        candidate['splitTurrets'] = ['MAIN', 'NSVT']
                    else:
                        candidate['splitTurrets'] = []
                    pixels = []

                    def inspect_parts(parts, *args, **kwargs):
                        pixels.extend((tuple((frame.size, frame.tobytes()) for frame in part['frames']), part.get('alpha', 1), part['order']) for part in parts)
                        return original_assemble(parts, *args, **kwargs)

                    with patch.object(media, 'assemble', side_effect=inspect_parts):
                        sheets, definition, report = media.build_unit(candidate, path)
                    return sheets, definition, report, Counter(pixels)

                _, original, before, old_pixels = build('combined', False)
                sheets, split, after, new_pixels = build('separated', True)
                self.assertEqual(old_pixels, new_pixels, 'No source-pixel layer may be lost, redrawn, or duplicated.')
                identity = lambda layer: (layer['section'], layer['source'], layer['order'])
                self.assertEqual(Counter(map(identity, before['layers'])), Counter(map(identity, after['layers'])))
                main = ini['turret_MAIN']
                main_origin = (float(main['x']), -float(main['y']))
                station = ini['turret_NSVT']
                station_origin = (main_origin[0] + float(station['x']), main_origin[1] - float(station['y']))
                origins = {'MAIN': main_origin, 'NSVT': station_origin}
                old_layers = {identity(layer): layer for layer in before['layers']}
                for layer in after['layers']:
                    old = old_layers[identity(layer)]
                    if layer['target'] == 'hull':
                        self.assertEqual((old['x'], old['y']), (layer['x'], layer['y']))
                        continue
                    origin = origins[layer['mount']]
                    self.assertAlmostEqual(old['x'] + main_origin[0], layer['x'] + origin[0])
                    self.assertAlmostEqual(old['y'] + main_origin[1], layer['y'] + origin[1])
                    self.assertEqual(layer['mount'], 'NSVT' if layer['section'] == 'decal_部件NSVT' else 'MAIN')
                metadata = split['_articulation_art']
                self.assertEqual(set(metadata['sprites']), {'MAIN', 'NSVT'})
                self.assertEqual(metadata['sprites']['MAIN'], original['turretSprite'])
                self.assertTrue(set(metadata['sprites'].values()) <= {sheet['key'] for sheet in sheets})


if __name__ == '__main__':
    unittest.main()

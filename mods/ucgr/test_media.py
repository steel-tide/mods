"""Guard against cropping source art onto the engine's stepped rotation path."""
import json
from pathlib import Path
import unittest
from copy import deepcopy
from collections import Counter
from tempfile import TemporaryDirectory
from PIL import Image, ImageChops
from media import assemble, build_unit, build_deployment_art, build_media, without_shadow
from rw import RW, load_unit


def pixels_at_source_origin(frame, bounds):
    return {(x + bounds[0], y + bounds[1]): frame.getpixel((x, y))
            for y in range(frame.height) for x in range(frame.width)
            if frame.getpixel((x, y))[3]}


class RotationTests(unittest.TestCase):
    def test_duplicate_roster_roles_keep_the_canonical_sheet_file(self):
        from weapons import source_index
        entry = source_index()['BREM-1装甲牵引车']
        with TemporaryDirectory() as tmp:
            media = build_media([entry, entry], Path(tmp))
            keys = [sheet['key'] for sheet in media['sprites']]
            self.assertEqual(len(keys), len(set(keys)))
            self.assertTrue(keys)
            for sheet in media['sprites']:
                self.assertTrue((Path(tmp) / sheet['file']).is_file())
            self.assertIn(media['defPatches'][entry['id']]['sprite'], keys)

    def test_barrel_bounds_use_the_actual_integer_layer_placement(self):
        barrel = Image.new('RGBA', (3, 58), (50, 60, 70, 255))
        body = Image.new('RGBA', (49, 81), (20, 30, 40, 255))
        part = {'frames': [barrel], 'x': 0, 'y': -40, 'order': 0}
        frames, _, _ = assemble([part, {'frames': [body], 'x': 3, 'y': 0, 'order': 1}], centered_x=True)
        x, y = part['_imageOffset']
        first_row = [i for i in range(frames[0].width) if frames[0].getpixel((i, y))[3]]
        self.assertEqual(first_row, list(range(x, x + barrel.width)))
        self.assertTrue(all(isinstance(value, int) for value in part['_imageOffset']))

    def test_odd_width_layer_keeps_its_original_half_pixel_rounding(self):
        image = Image.new('RGBA', (9, 7))
        image.putpixel((8, 3), (80, 120, 40, 255))
        parts = [{'frames': [image], 'x': 0, 'y': 0, 'order': 0}]
        before, _, old_bounds = assemble(parts)
        after, pivot, new_bounds = assemble(parts, centered_x=True)
        self.assertEqual(pivot[0], .5)
        self.assertEqual(pixels_at_source_origin(before[0], old_bounds),
                         pixels_at_source_origin(after[0], new_bounds))

    def test_padding_preserves_every_pixel_relative_to_original_pivot(self):
        first = Image.new('RGBA', (9, 7))
        first.putpixel((1, 2), (200, 50, 25, 255))
        first.putpixel((7, 3), (20, 140, 60, 127))
        second = first.copy()
        second.putpixel((8, 6), (30, 40, 180, 255))
        for x in range(-6, 7):
            with self.subTest(offset=x):
                parts = [{'frames': [first, second], 'x': x, 'y': -2, 'order': 0}]
                before, _, old_bounds = assemble(parts)
                after, pivot, new_bounds = assemble(parts, centered_x=True)
                self.assertEqual(pivot[0], .5)
                self.assertEqual(len(before), len(after))
                for old, new in zip(before, after):
                    self.assertEqual(pixels_at_source_origin(old, old_bounds),
                                     pixels_at_source_origin(new, new_bounds))

    def test_battery_travel_deployment_and_visible_round_layers_keep_source_pixels(self):
        from weapons import source_index
        entries = source_index()
        with TemporaryDirectory() as tmp:
            for name in ['HAWK发射车', 'IRIS-T SLM', '9S18M3', 'HAWK雷达车', 'IRIS-T SLM_RADAR']:
                entry = entries[name]
                sheets, appearance, witnesses = build_deployment_art({**entry, 'ini': load_unit(RW / entry['source'])}, Path(tmp))
                by_key = {sheet['key']: sheet for sheet in sheets}
                self.assertTrue(all(len(Image.open(Path(tmp) / sheet['file']).getcolors(1000000)) > 1 for sheet in sheets))
                if name == 'HAWK发射车':
                    self.assertEqual(appearance['stock'], 'magazine-mim23b')
                    self.assertEqual(len(appearance['states']), 8)
                    for state, witness in zip(appearance['states'], witnesses):
                        rounds = [layer for layer in witness['layers'] if layer['source'].endswith('/MIM23.png')]
                        self.assertEqual(len(rounds), state['minimum'])
                        self.assertEqual(bool(state['mounts']), state['deployed'])
                    travel = by_key[appearance['states'][3]['body']]
                    deployed = by_key[appearance['states'][7]['body']]
                    self.assertNotEqual((Path(tmp) / travel['file']).read_bytes(), (Path(tmp) / deployed['file']).read_bytes())
                else:
                    self.assertEqual(len(appearance['states']), 2)
                if name == '9S18M3':
                    self.assertEqual([(state['radar']['x'], state['radar']['y'], state['radar']['active']) for state in appearance['states']], [(0, -.8, False), (0, -.8, True)])
                self.assertFalse(any('rotor' in sheet['key'] for sheet in sheets), 'source radar angle belongs to simulation, never a sampled rotor animation')

    def test_fpv_deployment_retains_separate_fixed_ground_and_source_vehicle_variants(self):
        from weapons import source_index
        with TemporaryDirectory() as tmp:
            for name in ['EUFPVSQUAD', 'PLAFPVSQUAD', 'RUSFPVSQUAD', 'USFPVSQUAD']:
                entry = source_index()[name]
                sheets, appearance, witnesses = build_deployment_art({**entry, 'ini': load_unit(RW / entry['source'])}, Path(tmp))
                by_key = {sheet['key']: sheet for sheet in sheets}
                self.assertEqual(len(appearance['states']), 6 if name == 'RUSFPVSQUAD' else 2)
                if name == 'RUSFPVSQUAD': self.assertEqual(appearance['variantModulo'], 3)
                for state, witness in zip(appearance['states'], witnesses):
                    if state['deployed']:
                        self.assertTrue(state['fixedDirection'])
                        ground = [layer for layer in witness['layers'] if layer['target'] == 'ground']
                        self.assertEqual([layer['section'] for layer in ground], ['decal_架设坑', 'decal_操作员'])
                        self.assertTrue(Image.open(Path(tmp) / by_key[state['ground']]['file']).getbbox())
                    else: self.assertNotIn('ground', state)
                    self.assertTrue(Image.open(Path(tmp) / by_key[state['body']]['file']).getbbox())
                if name == 'RUSFPVSQUAD':
                    self.assertEqual([next(layer['source'].split('/')[-1] for layer in witness['layers'] if layer['section'] == 'decal_车') for witness in witnesses[:3]], ['UAZ469_1.png','UAZ469_2.png','UAZ469_3.png'])

    def test_original_squad_controllers_keep_transparency_and_fixed_trench_pixels(self):
        from weapons import source_index
        entries = source_index()
        with TemporaryDirectory() as tmp:
            for name in ['三人班组', '五人班组', '战壕三人班组', '战壕五人班组']:
                entry = deepcopy(entries[name]); entry['ini'] = load_unit(RW / entry['source'])
                sprites, patch, report = build_unit(entry, Path(tmp))
                self.assertFalse(patch['shadow'])
                self.assertEqual(len(sprites), 1)
                sprite = sprites[0]
                with Image.open(Path(tmp) / sprite['file']) as pixels:
                    if name.startswith('战壕'):
                        self.assertTrue(pixels.getbbox())
                        self.assertFalse(sprite.get('rotated', False))
                        self.assertEqual(report['bodyBounds'][1], -report['bodyBounds'][3])
                        self.assertTrue(any(s['source'].endswith('散兵坑.png') for s in report['layers']))
                    else:
                        self.assertIsNone(pixels.getbbox())
                        self.assertTrue(any(s['source'].endswith('透明.png') for s in report['layers']))

    def test_all_shipped_rotating_parts_support_live_rotation(self):
        manifest = json.loads((Path(__file__).parent / 'mod.json').read_text())
        sprites = {s['key']: s for s in manifest['sprites']}
        tanks = [d for d in manifest['defs'] if d.get('armor') == 'heavy']
        self.assertGreaterEqual(len(tanks), 14)
        for sprite in sprites.values():
            if sprite.get('rotated'):
                with self.subTest(sprite=sprite['key']):
                    self.assertEqual(sprite.get('pivotX', .5), .5)
        for tank in tanks:
            self.assertTrue(sprites[tank['sprite']]['rotated'])

    def test_roster_independent_source_rings_split_without_a_unit_name_allowlist(self):
        here = Path(__file__).parent
        entries = {e['rwName']: e for e in json.loads((here / 'inventory.json').read_text())['entries']}
        roster = json.loads((here / 'mvp-roster.json').read_text())
        split = []
        with TemporaryDirectory() as temporary:
            for name in sum(roster['nations'].values(), []) + roster['shared']:
                entry = deepcopy(entries[name]); entry['ini'] = load_unit(RW / entry['source'])
                out = Path(temporary) / name.replace('/', '-'); out.mkdir()
                sheets, patch, report = build_unit(entry, out)
                art = patch.get('_articulation_art')
                if not art: continue
                split.append(name)
                self.assertGreaterEqual(len(art['sprites']), 2, name)
                self.assertEqual(len(set(art['sprites'].values())), len(art['sprites']), name)
                self.assertTrue(set(art['sprites'].values()) <= {s['key'] for s in sheets})
                combined = {**entry, 'splitTurrets': []}
                _, _, before = build_unit(combined, out)
                identity = lambda layer: (layer['section'], layer['source'], layer.get('order'))
                self.assertEqual(Counter(map(identity, before['layers'])), Counter(map(identity, report['layers'])), name)
                # Child ring keeps its own art once; barrels/slaves stay main.
                for layer in report['layers']:
                    if layer['section'] == 'decal_部件NSVT': self.assertEqual(layer['mount'], 'NSVT', name)
        self.assertGreaterEqual(len(split), 60)
        self.assertTrue({'T90M', 'T72B3', 'T14'} <= set(split))

    def test_turret_art_leaves_its_shadow_to_the_engine(self):
        from weapons import source_index
        entries = source_index()
        with TemporaryDirectory() as tmp:
            # The two keep it: it is all that shows of a barrel the port does not draw.
            for name, kept in (('T72B3', False), ('BMP1AM', True), ('PGZ88', True)):
                entry = deepcopy(entries[name]); entry['ini'] = load_unit(RW / entry['source'])
                sheets, _, _ = build_unit(entry, Path(tmp))
                turrets = [sheet for sheet in sheets if sheet['key'].startswith('tur.')]
                self.assertTrue(turrets, name)
                for sheet in turrets:
                    with Image.open(Path(tmp) / sheet['file']) as pixels:
                        pixels = pixels.convert('RGBA')
                        painted = ImageChops.difference(pixels.getchannel('A'), without_shadow(pixels).getchannel('A')).getbbox()
                        self.assertEqual(bool(painted), kept, sheet['key'])


if __name__ == '__main__':
    unittest.main()

"""M6 provenance and fail-closed conversion checks against the actual RW pack."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import tempfile
import subprocess
import unittest

from feedback_port import FeedbackExport, SourceMismatch, CAPABILITY, PACKAGE
from rw import HERE, RW, load_unit
from profile_pack import expand_profiles


class FeedbackTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.entries = {e['rwName']: e for e in json.loads((HERE / 'inventory.json').read_text())['entries']}
        cls.manifest = expand_profiles(json.loads((HERE / 'mod.json').read_text()), HERE)
        cls.defs = {d['id']: d for d in cls.manifest['defs']}

    def source(self, name):
        entry = self.entries[name]
        return entry, deepcopy(load_unit(RW / entry['source']))

    def definition(self, name):
        return deepcopy(self.defs[self.entries[name]['id']])

    def test_source_smoke_retains_original_atmosphere_lifetime_fog_and_pixels(self):
        from weapons import source_index
        entry = source_index()['smokeG']
        ini = load_unit(RW / entry['source'])
        with tempfile.TemporaryDirectory() as tmp:
            export = FeedbackExport(tmp)
            picture = export.effect_picture(entry, ini, 'effect_烟雾弹')
            self.assertTrue(picture['atmospheric'])
            self.assertTrue(picture['showInFog'])
            self.assertFalse(picture['physics'])
            self.assertEqual(picture['life'], 10)
            self.assertEqual(picture['fadeIn'], .5)
            self.assertEqual((picture['scaleFrom'], picture['alpha']), (.3125, .5))
            self.assertAlmostEqual(picture['scaleTo'], .46875)
            self.assertAlmostEqual(picture['random']['speedForward'], 4.8)
            self.assertAlmostEqual(picture['random']['speedLateral'], 4.8)
            source = export.asset_sources[picture['asset']]
            self.assertEqual((Path(tmp) / source['file']).read_bytes(), (RW / source['source']).read_bytes())

    def test_child_helper_media_keeps_expanded_source_index_and_parent_silence(self):
        from component_port import spawned_payloads
        entry, ini = self.source('2S35')
        payloads = spawned_payloads(ini['projectile_1'])
        self.assertEqual(len(payloads), 2)
        weapon = {'id': 'howitzer', '_source': {'projectile': 'projectile_1'},
                  'extensions': {'components-v1': {'spawned': payloads}}}
        with tempfile.TemporaryDirectory() as tmp:
            export = FeedbackExport(tmp)
            records = export.impact_sounds(entry, ini, {'weapons': [weapon]})
            self.assertEqual([record.get('variant') for record in records if record.get('variant', {}).get('kind') != 'fragment'],
                             [None, {'kind': 'helper', 'index': 0}, {'kind': 'helper', 'index': 1}])
            self.assertEqual(records[0]['effects'], [])  # Source projectile_1: NONE.
            self.assertEqual(records[2]['effects'], [])  # 152 TAM projectile_b: NONE.
            self.assertTrue(any(effect.get('picture') for effect in records[1]['effects']))
            weapon['extensions']['components-v1']['spawned'].pop()
            with self.assertRaises(SourceMismatch):
                export.impact_sounds(entry, ini, {'weapons': [weapon]})

    def test_source_fragments_use_original_spark_and_ricochet_pixels_in_the_correct_helper_branch(self):
        from component_port import compile_component_payloads
        from weapons import convert_weapons
        from barrage_port import append_barrage_weapons
        with tempfile.TemporaryDirectory() as tmp:
            export = FeedbackExport(tmp)
            for name in ['T90M', '2S35']:
                entry, ini = self.source(name)
                weapons, _ = convert_weapons(entry, ini)
                append_barrage_weapons(entry, ini, {'weapons': weapons})
                payloads = compile_component_payloads({'weapons': weapons}, ini)
                for weapon in weapons:
                    weapon['extensions'] = {'components-v1': payloads.get(weapon['id'], {})}
                pictures = [p for p in export.projectiles(entry, ini, {'weapons': weapons}) if p.get('variant')]
                if name == 'T90M':
                    main = [p for p in pictures if p['weapon'] == 'w1']
                    self.assertEqual([p['variant'] for p in main], [{'kind': 'fragment', 'index': i, 'branch': -1} for i in range(3)])
                    self.assertEqual([p['scale'] for p in main], [.1875, .1875, .3125])
                    self.assertEqual([export.asset_sources[p['asset']]['source'] for p in main], ['RES/lights/spark.png', 'RES/lights/spark.png', 'RES/misc/rico.png'])
                else:
                    self.assertEqual([p['variant'] for p in pictures], [{'kind': 'fragment', 'index': i, 'branch': 1} for i in range(2)])
                for picture in pictures:
                    source = export.asset_sources[picture['asset']]
                    self.assertEqual((RW / source['source']).read_bytes(), (Path(tmp) / source['file']).read_bytes())

    def test_actual_roster_uses_only_explicit_uncommented_voice_bindings(self):
        selection = json.loads((HERE / 'mvp-roster.json').read_text())
        names = [name for group in selection['nations'].values() for name in group] + selection['shared']
        counts = dict(select=0, move=0, attack=0)
        with tempfile.TemporaryDirectory() as tmp:
            export = FeedbackExport(tmp)
            for name in names:
                entry, ini = self.source(name)
                definition = self.definition(name)
                # The shipped manifest intentionally strips source weapon metadata.
                # This test audits voices; weapon reconstruction has separate tests.
                definition['weapons'] = []
                export.augment(entry, ini, definition)
                for event in definition['extensions'][CAPABILITY]['voices']:
                    counts[event] += 1
            self.assertGreaterEqual(counts['select'], 5)
            self.assertGreaterEqual(counts['move'], 21)
            self.assertEqual(counts['move'], counts['attack'])
            self.assertGreaterEqual(sum(key.startswith('voice-') for key in export.assets), 41)
            self.assertGreaterEqual(sum(value['sourceBytes'] for key, value in export.asset_sources.items() if key.startswith('voice-')), 900302)
            for asset, value in export.asset_sources.items():
                source, target = RW / value['source'], Path(tmp) / value['file']
                if asset.startswith(('voice-', 'audio-')):
                    def pcm(path):
                        return subprocess.check_output(['ffmpeg', '-hide_banner', '-loglevel', 'error',
                                                        '-i', str(path), '-f', 's16le', '-c:a', 'pcm_s16le', '-'])
                    self.assertEqual(pcm(source), pcm(target))
                    self.assertEqual(target.suffix, '.wav')
                else:
                    self.assertEqual(target.read_bytes(), source.read_bytes())

    def test_commented_selection_recordings_remain_silent(self):
        with tempfile.TemporaryDirectory() as tmp:
            for name in ['T90M', 'T72B3', 'PLAINF', 'RUSGUD']:
                entry, ini = self.source(name)
                definition = self.definition(name)
                FeedbackExport(tmp).augment(entry, ini, definition)
                self.assertNotIn('select', definition['extensions'][CAPABILITY]['voices'])

    def test_native_fallback_is_suppressed_for_every_pack_definition(self):
        for definition in self.manifest['defs']:
            self.assertIsInstance(definition['extensions'][CAPABILITY]['voices'], dict)
        self.assertEqual(self.defs['usgr-re-us-hq']['extensions'][CAPABILITY], {'voices': {}})

    def test_original_alternative_recordings_and_gain_are_preserved(self):
        russian = self.definition('RUSGUD')['extensions'][CAPABILITY]['voices']
        self.assertEqual(russian['attack']['gain'], .5)
        self.assertEqual(len(russian['attack']['assets']), 1)
        chinese = self.definition('PGZ09')['extensions'][CAPABILITY]['voices']
        self.assertEqual(chinese['attack']['gain'], .3)
        self.assertEqual(len(chinese['attack']['assets']), 3)
        self.assertEqual(len(chinese['select']['assets']), 2)

    def test_order_source_gate_drift_is_rejected(self):
        entry, ini = self.source('RUSGUD')
        ini['hiddenAction_ATT_S']['requireConditional'] += ' and self.hp<50'
        with tempfile.TemporaryDirectory() as tmp, self.assertRaises(SourceMismatch):
            FeedbackExport(tmp).augment(entry, ini, self.definition('RUSGUD'))

    def test_missing_original_recording_is_rejected_without_a_replacement(self):
        entry, ini = self.source('PGZ09')
        ini['core']['soundOnNewSelection'] = 'ROOT:音效/does-not-exist.ogg'
        with tempfile.TemporaryDirectory() as tmp, self.assertRaises(SourceMismatch):
            FeedbackExport(tmp).augment(entry, ini, self.definition('PGZ09'))

    def test_t90_icons_keep_public_source_pose_and_threshold_provenance(self):
        entry, ini = self.source('T90M')
        with tempfile.TemporaryDirectory() as tmp:
            export = FeedbackExport(tmp)
            definition = self.definition('T90M')
            export.augment(entry, ini, definition)
            icons = definition['extensions'][CAPABILITY]['cosmetics']
            self.assertEqual([item['part'] for item in icons], ['rack', 'track', 'driver', 'gunner', 'engine'])
            self.assertEqual([item['x'] for item in icons], [0, -12.5, 12.5, 25, -25])
            self.assertTrue(all(item['y'] == 25 and item['scale'] == .25 for item in icons))
            self.assertEqual(sum(asset.startswith('icon-') for asset in export.assets), 10)
            report = export.finish()
            self.assertEqual(report['cosmeticGeometry']['worldScale'], .625)
            self.assertEqual(report['cosmeticGeometry']['worldY'], 40 * .4 * 1.5625)
            self.assertIn('missingRounds', report['cosmeticPredicates']['rack'])
            self.assertIn('>=', report['cosmeticPredicates']['rack'])
            for key, source in export.asset_sources.items():
                self.assertEqual(hashlib.sha256((Path(tmp) / source['file']).read_bytes()).hexdigest(), source['sha256'])
            self.assertEqual(json.loads((Path(tmp) / PACKAGE / 'assets.json').read_text()), export.assets)

    def test_private_or_conditional_icon_drift_is_not_silently_published(self):
        entry, ini = self.source('T90M')
        ini['decal_traDiYe_1']['onlyTeam'] = 'ally'
        with tempfile.TemporaryDirectory() as tmp, self.assertRaises(SourceMismatch):
            FeedbackExport(tmp).augment(entry, ini, self.definition('T90M'))

    def test_skipped_mode_music_and_unsupported_new_units_stay_absent(self):
        report = json.loads((HERE / 'feedback-source-data.json').read_text())
        self.assertEqual(report['music']['status'], 'deferred with skipped M5')
        self.assertNotIn('music', self.manifest)
        self.assertTrue(all('音乐文件夹' not in item['source'] for item in report['assets'].values()))


    def test_source_audio_preserves_jet_cadence_death_gain_and_reload_completion(self):
        with tempfile.TemporaryDirectory() as tmp:
            export = FeedbackExport(tmp)
            entry, ini = self.source('A10')
            definition = self.definition('A10')
            export.augment(entry, ini, definition)
            self.assertEqual(definition['extensions'][CAPABILITY]['audio']['periodic'][0]['interval'], 2)
            self.assertEqual(definition['extensions'][CAPABILITY]['audio']['periodic'][0]['cue']['gain'], .1)
            entry, ini = self.source('T90M')
            definition = self.definition('T90M')
            export.augment(entry, ini, definition)
            audio = definition['extensions'][CAPABILITY]['audio']
            self.assertEqual(audio['death']['gain'], 2)
            self.assertEqual({item['stock'] for item in audio['reloads']}, {'magazine-pkt', 'magazine-nsvt'})
            self.assertNotIn('periodic', audio)

    def test_projectile_and_death_art_are_original_bytes_at_source_scale(self):
        from weapons import convert_weapons
        with tempfile.TemporaryDirectory() as tmp:
            export = FeedbackExport(tmp)
            entry, ini = self.source('A10')
            definition = self.definition('A10')
            definition['weapons'], _ = convert_weapons(entry, ini)
            export.augment(entry, ini, definition)
            cfg = definition['extensions'][CAPABILITY]
            cannon = next(v for v in cfg['projectiles'] if v['weapon'] == 'w1')
            self.assertEqual(cannon['scale'], 1.2 * .625)
            self.assertTrue(export.asset_sources[cannon['asset']]['source'].endswith('曳光弹2.png'))
            self.assertTrue(export.asset_sources[cfg['wreck'][0]['asset']]['source'].endswith('A10摧毁.png'))
            missile = next(v for v in cfg['projectiles'] if v['weapon'] == 'w3')
            from PIL import Image
            with Image.open(Path(tmp) / export.assets[missile['asset']]) as image:
                self.assertAlmostEqual(image.width * missile['scale'], 25 * .625)
            for key in [cannon['asset'], missile['asset'], cfg['wreck'][0]['asset']]:
                self.assertEqual((Path(tmp) / export.assets[key]).read_bytes(), (RW / export.asset_sources[key]['source']).read_bytes())

    def test_source_firing_recordings_keep_pcm_gain_and_original_weapon_binding(self):
        from weapons import convert_weapons
        with tempfile.TemporaryDirectory() as tmp:
            export = FeedbackExport(tmp)
            entry, ini = self.source('T90M')
            definition = self.definition('T90M')
            definition['weapons'], _ = convert_weapons(entry, ini)
            export.augment(entry, ini, definition)
            shots = definition['extensions'][CAPABILITY]['audio']['shots']
            station = next(s for s in shots if s['weapon'] == 'w3')
            self.assertAlmostEqual(station['cue']['gain'], .3)
            asset, = station['cue']['assets']
            provenance = export.asset_sources[asset]
            self.assertTrue(provenance['source'].endswith('迫击炮.ogg'))
            def pcm(path):
                return subprocess.check_output(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', str(path), '-f', 's16le', '-c:a', 'pcm_s16le', '-'])
            self.assertEqual(pcm(RW / provenance['source']), pcm(Path(tmp) / provenance['file']))
            del ini['turret_NSVT']['shoot_sound_vol']
            export.augment(entry, ini, definition)
            self.assertEqual(next(s for s in definition['extensions'][CAPABILITY]['audio']['shots'] if s['weapon'] == 'w3')['cue']['gain'], .2)
            ini['turret_NSVT']['shoot_sound'] = ini['turret_NSVT']['shoot_sound'].rsplit(':', 1)[0]
            export.augment(entry, ini, definition)
            self.assertEqual(next(s for s in definition['extensions'][CAPABILITY]['audio']['shots'] if s['weapon'] == 'w3')['cue']['gain'], .3)

    def test_radar_missile_launch_sound_follows_its_original_queued_helper_action(self):
        from weapons import convert_weapons
        with tempfile.TemporaryDirectory() as tmp:
            export = FeedbackExport(tmp)
            entry, ini = self.source('F-2'); definition = self.definition('F-2')
            sources = {w['id']: w['_source'] for w in convert_weapons(entry, ini)[0]}
            for weapon in definition['weapons']:
                if weapon['id'] in sources: weapon['_source'] = sources[weapon['id']]
            export.augment(entry, ini, definition)
            launch = next(s for s in definition['extensions'][CAPABILITY]['audio']['shots'] if s.get('atProjectile'))
            self.assertEqual(launch['delay'], .1)
            self.assertEqual(launch['cue']['gain'], .5)
            asset, = launch['cue']['assets']
            self.assertTrue(export.asset_sources[asset]['source'].endswith('shoot.ogg'))

    def test_actual_nonlooping_source_animation_terminates_on_final_frame(self):
        entry, ini = self.source('T90M')
        section = next(s for s, v in ini.items() if s.startswith('effect_') and v.get('image', '').endswith('土坑.png'))
        with tempfile.TemporaryDirectory() as tmp:
            picture = FeedbackExport(tmp).effect_picture(entry, ini, section)
            self.assertEqual((picture['life'], picture['frames'], picture['fps']), (1, 4, 24))
            self.assertAlmostEqual(picture['duration'], 1 / 6)
            self.assertFalse(picture['loop'])

    def test_effect_children_do_not_recursively_emit_grandchildren_and_keep_terrain_gates(self):
        entry, ini = self.source('T90M')
        ini['effect_parent'] = {'alsoEmitEffects': 'child', 'createWhenOverLand': 'false'}
        ini['effect_child'] = {'alsoEmitEffects': 'grandchild', 'alsoPlaySound': 'ROOT:SOUND/amRa2.ogg:0.9'}
        ini['effect_grandchild'] = {'alsoPlaySound': 'ROOT:SOUND/amRa2.ogg:0.9'}
        with tempfile.TemporaryDirectory() as tmp:
            root, = FeedbackExport(tmp).effects(entry, ini, 'parent')
            self.assertFalse(root['land']); self.assertTrue(root['water'])
            child, = root['children']; self.assertIn('cue', child); self.assertNotIn('children', child)

    def test_original_cannon_smoke_retains_source_random_ranges_and_terrain(self):
        from weapons import convert_weapons
        entry, ini = self.source('T90M')
        with tempfile.TemporaryDirectory() as tmp:
            export = FeedbackExport(tmp)
            definition = self.definition('T90M')
            definition['weapons'], _ = convert_weapons(entry, ini)
            export.augment(entry, ini, definition)
            flash = next(item for item in definition['extensions'][CAPABILITY]['flashes'] if item['weapon'] == 'w1')
            smoke = flash['effects'][1]
            self.assertEqual(smoke, flash['effects'][0]['children'][0])
            self.assertTrue(smoke['land']); self.assertFalse(smoke['water'])
            picture = smoke['picture']
            self.assertEqual(picture['duration'], 100 / 60)
            self.assertEqual(picture['random']['speedForward'], .2 * 24)
            self.assertEqual(picture['random']['speedLateral'], .2 * 24)
            self.assertAlmostEqual(picture['random']['dir'], 2 * 3.141592653589793)
            self.assertEqual(picture['speedForward'], -.5 * 24)
            self.assertEqual(picture['speedLateral'], .2 * 24)
            self.assertEqual(definition['weapons'][0]['look']['impact'], 'none')
            self.assertTrue(picture['under'])
            self.assertEqual(picture['y'], .1 * .4)
            self.assertEqual(picture['vy'], .1 * 24)
            asset = picture['asset']
            self.assertTrue(export.asset_sources[asset]['source'].endswith('浓烟.png'))
            self.assertEqual((Path(tmp) / export.assets[asset]).read_bytes(), (RW / export.asset_sources[asset]['source']).read_bytes())
            ini['effect_炮烟']['xSpeedRelativeRandom'] = 'self.hp'
            self.assertIsNone(export.effect_picture(entry, ini, 'effect_炮烟'))
            self.assertTrue(any('literal finite' in reason for _, _, reason in export.effect_omissions))

    def test_original_rear_armor_bar_uses_the_same_source_frame_thresholds(self):
        entry, ini = self.source('M1128')
        with tempfile.TemporaryDirectory() as tmp:
            definition = self.definition('M1128')
            export = FeedbackExport(tmp)
            export.augment(entry, ini, definition)
            rear = next(bar for bar in definition['extensions'][CAPABILITY]['era'] if bar['face'] == 'rear')
            self.assertEqual(rear['maximum'], 200)
            source = ini['decal_显示装甲状态-后']
            self.assertEqual(rear['y'], float(source['yOffsetAbsolute']) * .625)
            self.assertEqual(rear['scaleX'], float(source['imageScaleX']) * .625)
            self.assertEqual(rear['scaleY'], float(source.get('imageScaleY', source.get('imageScale', 1))) * .625)
            self.assertIn('memory.backAEH>=150.0', source['frame'])
            self.assertIn('memory.backAEH>=80.0', source['frame'])

    def test_gain_above_host_api_bound_is_omitted_without_clamping_or_export_failure(self):
        from weapons import convert_weapons
        entry, ini = self.source('BMP2M')
        weapons, _ = convert_weapons(entry, ini)
        definition = {'weapons': weapons}
        with tempfile.TemporaryDirectory() as tmp:
            export = FeedbackExport(tmp)
            audio = export.audio(entry, ini, definition)
            grenade = next(w for w in weapons if w['_source']['turret'] == 'turret_AGS')
            self.assertFalse(any(s['weapon'] == grenade['id'] for s in audio.get('shots', [])))
            self.assertTrue(any('gain 5' in reason and 'without clamping' in reason for _, _, reason in export.audio_omissions))

    def test_selected_armor_bars_preserve_four_frames_and_source_absolute_pose(self):
        entry, ini = self.source('T90M')
        with tempfile.TemporaryDirectory() as tmp:
            export = FeedbackExport(tmp)
            definition = self.definition('T90M')
            export.augment(entry, ini, definition)
            bars = definition['extensions'][CAPABILITY]['era']
            self.assertEqual([b['face'] for b in bars], ['front', 'side'])
            self.assertEqual([b['maximum'] for b in bars], [700, 700])
            self.assertEqual([b['y'] for b in bars], [55 * .625, 60 * .625])
            self.assertTrue(all(b['scaleX'] == 5 * .625 and b['scaleY'] == .5 * .625 and b['alpha'] == .45 for b in bars))
            ini['decal_显示装甲状态-正']['onlyTeam'] = 'any'
            with self.assertRaises(SourceMismatch):
                export.augment(entry, ini, definition)


if __name__ == '__main__':
    unittest.main()

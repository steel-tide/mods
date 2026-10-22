"""Actual selected-roster witnesses for radio contacts and rejected seekers."""
from copy import deepcopy
import json
import math
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

import rw
import sensors_port as port
import weapons


@unittest.skipUnless(rw.RW.is_dir(), 'original package not present')
class SourceSensorsTests(unittest.TestCase):
    def unit(self, name):
        entry = deepcopy(weapons.source_index()[name])
        ini = deepcopy(rw.load_unit(rw.RW / entry['source']))
        converted, _ = weapons.convert_weapons(entry, ini)
        return entry, ini, {'id': entry['id'], 'weapons': converted}

    def test_real_mig29_radar_matches_source_geometry_signature_and_sampling(self):
        entry, ini, definition = self.unit('MIG29')
        before = deepcopy(definition)
        candidate, notes = port.source_sensor_candidate(entry, ini, definition)
        sensor, = candidate['sensors']
        signature, = candidate['signatures']
        self.assertEqual(signature, {'channel': port.RADAR_CHANNEL, 'strength': 2})
        self.assertEqual(sensor['mode'], 'signature')
        self.assertEqual(sensor['minimumSignature'], 1)
        self.assertEqual(sensor['reveal'], 'contact')
        self.assertEqual(sensor['range'], 37.5)
        self.assertAlmostEqual(sensor['cone'], math.radians(35))
        self.assertEqual((sensor['basis'], sensor['x'], sensor['y']), ('body', 40, 0))
        self.assertAlmostEqual(sensor['interval'], 8 / 60)
        self.assertEqual((sensor['scanLimit'], sensor['maxTracks']), (100, 100))
        self.assertEqual((sensor['acquire'], sensor['retain']), (0, 0))
        self.assertEqual(len(sensor['label']), 3)
        self.assertEqual(definition, before, 'Staged data must not activate itself.')
        self.assertTrue(any('separate source systems' in note for note in notes))

    def test_fixed_wing_signatures_are_not_emitter_states_or_seeker_locks(self):
        for name in ('SU35S', 'J-10', 'F-16C', 'A10', '台风', 'MIG29', 'F-5E', 'F-2'):
            with self.subTest(unit=name):
                entry, ini, definition = self.unit(name)
                candidate, _ = port.source_sensor_candidate(entry, ini, definition)
                self.assertEqual(candidate['signatures'], [{'channel': port.RADAR_CHANNEL, 'strength': 2}])
                self.assertNotIn('emitters', candidate)
                self.assertFalse(any(port.CAPABILITY in w.get('extensions', {}) for w in definition['weapons']))
                if ini.get('hiddenAction_preset',{}).get('attachments_addNewUnits')=='RADAR_AIR' and '无雷达' not in ini['core'].get('tags','').split(','):
                    self.assertEqual(candidate['sensors'][0]['range'],float(ini['core']['@global radar'])*weapons.RANGE_SCALE)

    def test_dynamic_helicopter_signature_is_omitted_instead_of_always_airborne(self):
        for name in ('KA52', 'Mi8', 'Z10', 'AH64D'):
            with self.subTest(unit=name):
                entry, ini, definition = self.unit(name)
                candidate, notes = port.source_sensor_candidate(entry, ini, definition)
                self.assertNotIn('signatures',candidate or {})
                self.assertTrue(any('dynamic radar signature omitted' in note for note in notes))

    def test_unknown_sensor_geometry_detection_or_sampling_does_not_silently_compile(self):
        for section, key, value, helper in [
            ('attachment_RADAR', 'idleDir', '10', False),
            ('attachment_RADAR', 'x', 'memory.position', False),
            ('action_雷达显示', 'isVisible', 'true', False),
            ('hiddenAction_搜索_3000', 'takeResources', 'RADAR=2', True),
            ('hiddenAction_搜索_3000', 'autoTriggerCheckRate', 'every8Frames', True),
            ('hiddenAction_标记', 'requireConditional', 'if true', True),
        ]:
            with self.subTest(section=section, key=key):
                entry, ini, _ = self.unit('MIG29')
                _, controller = port._unit('RADAR_AIR')
                controller = deepcopy(controller)
                (controller if helper else ini)[section][key] = value
                with self.assertRaises(port.SourceMismatch):
                    port.radar_air_profile(entry, ini, controller)

    def test_missing_and_changed_signatures_are_not_assumed_to_be_two(self):
        entry, ini, _ = self.unit('MIG29')
        ini['core']['borrowResourcesWhileAlive'] = 'RADAR=-0.5'
        with self.assertRaises(port.SourceMismatch):
            port.stable_radar_signature(entry, ini)
        ini['core']['borrowResourcesWhileAlive'] = 'RADAR=-memory.rcs'
        self.assertIsNone(port.stable_radar_signature(entry, ini)[0])
        ini['core']['borrowResourcesWhileAlive'] = 'RADAR=-2'
        ini['hiddenAction_new'] = {'setResourcesWithLogic': 'RADAR=0'}
        self.assertIn('dynamic', port.stable_radar_signature(entry, ini)[1])

    def test_r73_audit_does_not_confuse_unused_fuel_global_with_actual_lifetime(self):
        entry, ini, definition = self.unit('MIG29')
        audit = port.infrared_gap(entry, ini, definition)
        self.assertEqual(audit['weapon'], next(w['id'] for w in definition['weapons'] if w.get('_source',{}).get('attachedMissile')=='R73'))
        self.assertEqual(audit['status'], 'implemented-source-helper')
        self.assertFalse(audit['radarDependency'])
        self.assertFalse(audit['illuminationDependency'])
        self.assertFalse(audit['ecmDependency'])
        self.assertEqual(audit['source']['actualLifetimeSeconds'], 5)
        self.assertEqual(audit['source']['unusedFuelTimeGlobal'], 3)
        self.assertEqual(audit['source']['countermeasureResistance'], 180)
        self.assertEqual(audit['source']['seekerConeDegrees'], 120)
        self.assertEqual(audit['missingContracts'],[])
        self.assertEqual(audit['implementedPolicy']['sourceFlight']['speed'],228)
        self.assertEqual(audit['implementedPolicy']['sourceFlight']['blastRadius'],50)
        self.assertFalse(any('sensors-v1' in w.get('extensions', {}) for w in definition['weapons']))

    def test_actual_infrared_helpers_use_source_lifecycle_and_finite_countermeasures(self):
        for name in ('MIG29','SU35S','F-16C','J-10'):
            entry, ini, definition = self.unit(name)
            port.augment_sensors(entry,ini,definition)
            flights=[w['extensions']['sensors-v1']['sourceFlight'] for w in definition['weapons'] if 'sensors-v1' in w.get('extensions',{})]
            self.assertGreater(len(flights),0)
            for flight in flights:
                if flight.get('radar'):continue
                self.assertEqual(flight['life'],5)
                self.assertEqual(flight['inheritSpeed'],.25)
                self.assertEqual(flight['sample'],8/60)
                self.assertEqual(flight['lossDelay'],2)
            decoy=definition['extensions']['sensors-v1']['countermeasures']
            self.assertEqual(decoy['energy'],60)
            self.assertEqual(decoy['reload'],.5)
            self.assertEqual(decoy['radius'],80)

    def test_active_radar_helpers_keep_fuel_speed_curve_and_ecm_parameters(self):
        entry,ini,definition=self.unit('SU35S')
        port.augment_sensors(entry,ini,definition)
        flights=[w['extensions']['sensors-v1']['sourceFlight'] for w in definition['weapons'] if w.get('extensions',{}).get('sensors-v1',{}).get('sourceFlight',{}).get('radar')]
        self.assertEqual(len(flights),2)
        for flight in flights:
            self.assertEqual(flight['inheritSpeed'],.5)
            self.assertEqual(flight['radar']['scriptInterval'],8/60)
            self.assertEqual(flight['radar']['lostChecks'],10)
            self.assertEqual(flight['radar']['speedDrop'],72)
            self.assertAlmostEqual(flight['radar']['speedUp'],3.6)
            self.assertAlmostEqual(flight['radar']['speedDown'],.6)
            self.assertEqual(flight['radar']['ecmX'],24)
        self.assertEqual(definition['extensions']['sensors-v1']['ecm'],30)
        self.assertTrue(definition['extensions']['sensors-v1']['airSuperiority'])

    def test_hawk_source_helper_has_its_own_semi_active_policy(self):
        entry,ini,definition=self.unit('HAWK发射车')
        port.augment_sensors(entry,ini,definition)
        guide=definition['weapons'][0]['extensions']['sensors-v1']
        flight=guide['sourceFlight'];radar=flight['radar']
        self.assertTrue(radar['semiActive'])
        self.assertEqual(radar['lostChecks'],2)
        self.assertEqual(flight['inheritSpeed'],0)
        self.assertEqual(flight['life'],5.1)
        self.assertEqual(flight['launchTime'],.5)
        self.assertEqual(flight['launchLeg'],24)
        self.assertEqual(guide['launchArc'],math.pi)

    def test_source_fixed_wing_controls_retain_action_arithmetic_and_height_scale(self):
        for name in ('MIG29','SU35S','F-16C','J-10'):
            entry,ini,definition=self.unit(name)
            port.augment_sensors(entry,ini,definition)
            control=definition['extensions']['sensors-v1']['flightControls']
            self.assertEqual(control['highHeight'],80)
            self.assertEqual(control['lowHeight'],40)
            self.assertEqual(control['heightSpread'],8)
            self.assertEqual(control['heightRate'],2376)
            self.assertEqual(control['thrust'],.2)
            self.assertEqual(control['thrustDuration'],15)
            self.assertEqual(control['thrustCooldown'],20)
            self.assertAlmostEqual(control['brakeTurn'],math.radians(.4)*60)
            self.assertEqual(control['damageThresholds'],[.75,.5,.25])

    def test_source_ground_radar_toggle_ranges_and_automatic_ground_mode(self):
        for name,on,off,ground in [('2S6',900,450,400),('M163',600,300,350),('K263',650,325,350),('PGZ09',750,375,400),('猎豹',700,350,400),('HQ17',1800,0,None),('罗兰',1000,500,None)]:
            entry,ini,definition=self.unit(name)
            port.augment_sensors(entry,ini,definition)
            control=definition['extensions']['sensors-v1']['radarControl']
            self.assertEqual(control['rangeOn'],on*weapons.RANGE_SCALE)
            self.assertEqual(control['rangeOff'],off*weapons.RANGE_SCALE)
            self.assertEqual(control['switchTime'],.5)
            self.assertEqual(control['cooldown'],10)
            self.assertEqual(control.get('groundRange'),None if ground is None else ground*weapons.RANGE_SCALE)
            if ground is not None:
                self.assertEqual(control['groundTime'],0)  # direct autoTrigger ignores player buildSpeed

    def test_a10_uses_its_fixed_height_override_and_low_altitude_ground_gun_gate(self):
        entry,ini,definition=self.unit('A10')
        port.augment_sensors(entry,ini,definition)
        control=definition['extensions']['sensors-v1']['flightControls']
        self.assertEqual(control['heightSpread'],0)
        self.assertEqual(control['highRangeBonus'],5)
        self.assertEqual(control['heightWeapons'],[{'id':next(w['id'] for w in definition['weapons'] if w['_source']['turret']=='turret_AP'),'below':60}])

    def test_reviewable_data_regenerates_without_writing_the_manifest(self):
        before = (rw.HERE / 'mod.json').read_bytes()
        with TemporaryDirectory() as temporary:
            destination = Path(temporary) / 'audit.json'
            audit = port.write_source_audit(destination)
            self.assertEqual(json.loads(destination.read_text()), audit)
            self.assertEqual(audit['unit'], weapons.source_index()['MIG29']['id'])
            self.assertTrue(all(len(source['sha256']) == 64 for source in audit['sourceFiles']))
        self.assertEqual((rw.HERE / 'mod.json').read_bytes(), before)


if __name__ == '__main__':
    unittest.main()

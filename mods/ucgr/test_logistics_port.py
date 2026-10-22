"""Behavior-facing checks for audited UCGR magazines and explicit omissions."""
from copy import deepcopy
import json
import unittest

import logistics_port as logistics
import rw
import weapons


@unittest.skipUnless(rw.RW.is_dir(), 'original package not present')
class LogisticsPortTests(unittest.TestCase):
    def converted(self, name):
        entry = weapons.source_index()[name]
        ini = rw.load_unit(rw.RW / entry['source'])
        converted, _ = weapons.convert_weapons(entry, ini)
        definition = {'id': entry['id'], 'weapons': converted}
        notes = logistics.augment_logistics(entry, ini, definition)
        return definition, notes

    def test_t90_magazines_and_finite_main_inventory_follow_source(self):
        definition, notes = self.converted('T90M')
        stocks = {s['id']: s for s in definition['extensions']['logistics-v1']['stocks']}
        self.assertEqual((stocks['magazine-pkt']['capacity'], stocks['magazine-pkt']['refillAfter']), (100, 10))
        self.assertEqual((stocks['magazine-nsvt']['capacity'], stocks['magazine-nsvt']['refillAfter']), (60, 20))
        self.assertEqual(stocks['shell-ap']['capacity'], 20)
        self.assertEqual(stocks['shell-he']['capacity'], 18)
        self.assertEqual(stocks['missile-atgm']['capacity'], 10)
        self.assertNotIn('refillAfter', stocks['shell-ap'])
        self.assertEqual(definition['weapons'][0]['extensions']['logistics-v1']['feed'], 'main-gun')
        self.assertEqual(len(definition['weapons']), 3)

    def test_rifle_initial_default_and_reload_follow_source_switch_action(self):
        definition, notes = self.converted('RUSGUD')
        stocks = definition['extensions']['logistics-v1']['stocks']
        self.assertEqual(len(stocks), 1)
        self.assertEqual((stocks[0]['capacity'], stocks[0]['initial'], stocks[0]['refillAfter']), (30, 30, 3))
        self.assertEqual(stocks[0]['idleReload'], {'after': 10, 'below': 10})

    def test_source_loadout_tag_can_differ_from_its_shared_projectile_name(self):
        for name in ('USLAND', 'FRIF'):
            with self.subTest(name=name):
                definition, _ = self.converted(name)
                stock = definition['extensions']['logistics-v1']['stocks'][0]
                self.assertEqual((stock['capacity'], stock['refillAfter']), (30, 3))

    def test_shared_aa_barrels_spend_one_common_magazine(self):
        definition, _ = self.converted('PGZ09')
        stocks = definition['extensions']['logistics-v1']['stocks']
        self.assertEqual(len(stocks), 1)
        self.assertEqual((stocks[0]['capacity'], stocks[0]['refillAfter']), (480, 30))
        ids = {w['extensions']['logistics-v1']['stock'] for w in definition['weapons']}
        self.assertEqual(ids, {stocks[0]['id']})

    def test_special_free_services_preserve_recipient_stocks_and_timing(self):
        for name, resource, capacity, duration in [('2S35', '152', 33, 20), ('M109A7', '155', 50, 20), ('9K37M2', '9M37', 4, 60)]:
            with self.subTest(name=name):
                definition, _ = self.converted(name)
                cfg = definition['extensions']['logistics-v1']
                sid = logistics.stock_id(resource)
                stock = next(s for s in cfg['stocks'] if s['id'] == sid)
                self.assertEqual(stock['initial'], capacity)
                self.assertNotIn('refillAfter', stock)
                self.assertEqual(cfg['serviceStocks']['tank-resupply'], [sid])
                self.assertEqual(cfg['serviceSeconds']['tank-resupply'], duration)
        ini = rw.load_unit(rw.RW / weapons.source_index()['TOS1A']['source'])
        self.assertIsNone(logistics.vehicle_supply(ini))

    def test_sam_created_set_stock_allows_its_actual_magazine_reload(self):
        for name, capacity, duration in [('HAWK发射车', 3, 60), ('IRIS-T SLM', 8, 45)]:
            with self.subTest(name=name):
                definition, _ = self.converted(name)
                stock = definition['extensions']['logistics-v1']['stocks'][0]
                self.assertEqual((stock['initial'], stock['refillAfter']), (capacity, duration))

    def test_sam_source_explicit_unlimited_reload_is_retained(self):
        definition, _ = self.converted('HQ17')
        stock = definition['extensions']['logistics-v1']['stocks'][0]
        self.assertEqual((stock['capacity'], stock['refillAfter']), (8, 60))

    def test_paid_landing_aircraft_service_keeps_finite_initial_stock_without_free_refill(self):
        for name in ('KA52', 'MIG29'):
            with self.subTest(name=name):
                definition, notes = self.converted(name)
                self.assertTrue(definition['extensions']['logistics-v1']['stocks'])
                self.assertTrue(all('refillAfter' not in s for s in definition['extensions']['logistics-v1']['stocks']))
                self.assertTrue(any('aircraft' in n for n in notes))

    def test_created_aircraft_loadouts_count_slots_without_duplicate_wingtip_missiles(self):
        for name, expected in [('MIG29', {'air-r73': 4, 'air-r27t': 2}), ('F-2', {'air-aim120': 4, 'air-aim9m': 2}), ('KA52', {'air-30mm': 200, 'air-ham': 12})]:
            d, _ = self.converted(name)
            stocks = {s['id']: s for s in d['extensions']['logistics-v1']['stocks']}
            for key, count in expected.items():
                self.assertEqual(stocks[key]['initial'], count)
                self.assertNotIn('refillAfter', stocks[key])

    def test_korean_magazines_queue_partial_reload_without_discarding_live_rounds(self):
        for name in ('人民军_88突', '韩军_K2'):
            d, _ = self.converted(name)
            stock = d['extensions']['logistics-v1']['stocks'][0]
            self.assertEqual((stock['initial'], stock['capacity'], stock['refillAfter']), (30,30,3))
            self.assertTrue(stock['queuedReload'])

    def test_modified_source_price_or_initial_stock_cannot_sneak_into_free_cycle(self):
        ini = deepcopy(rw.load_unit(rw.RW / weapons.source_index()['T90M']['source']))
        ini['hiddenAction_同轴机枪装填']['price'] = 'SUP=20'
        self.assertIsNone(logistics.magazine_policy(ini, 'PKT', 'PKT')[0])
        del ini['hiddenAction_同轴机枪装填']['price']
        ini['hiddenAction_同轴机枪装填']['requireConditional'] = 'if self.hasFlag(id=9)'
        self.assertIsNone(logistics.magazine_policy(ini, 'PKT', 'PKT')[0])
        del ini['hiddenAction_同轴机枪装填']['requireConditional']
        ini['hiddenAction_同轴机枪弹药']['addResources'] = 'PKT=50'
        self.assertIsNone(logistics.magazine_policy(ini, 'PKT', 'PKT')[0])

    def test_all_roster_stocks_have_source_empty_refill_and_complete_translations(self):
        roster = json.loads((rw.HERE / 'mvp-roster.json').read_text())
        count = 0
        for name in sum(roster['nations'].values(), []) + roster['shared']:
            with self.subTest(name=name):
                definition, _ = self.converted(name)
                for stock in definition.get('extensions', {}).get('logistics-v1', {}).get('stocks', []):
                    count += 1
                    self.assertTrue(stock.get('refillAfter', 0) > 0 or stock['id'] in {value[0] for value in logistics.MAIN_STOCKS.values()} or stock['id'].startswith('air-') or any(stock['id'] in ids for ids in definition['extensions']['logistics-v1'].get('serviceStocks', {}).values()) or logistics.paid_vehicle_initial(rw.load_unit(rw.RW/weapons.source_index()[name]['source'])))
                    self.assertEqual(len(stock['label']), 3)
                    self.assertTrue(all(stock['label']))
                    self.assertLessEqual(stock['initial'], stock['capacity'])
        self.assertGreater(count, 30)

    def test_partial_magazine_requires_exact_source_shot_reset_and_discard(self):
        ini = deepcopy(rw.load_unit(rw.RW / weapons.source_index()['RUSGUD']['source']))
        self.assertEqual(logistics.idle_reload_policy(ini, '子弹', 'AK74M'), {'after': 10, 'below': 10})
        ini['hiddenAction_RESET']['resetCustomTimer'] = 'false'
        self.assertIsNone(logistics.idle_reload_policy(ini, '子弹', 'AK74M'))

    def test_source_tank_stocks_generalize_and_aps_retains_its_own_service(self):
        for name in ('T72B3', 'M1A2SEPV3', 'L2A6'):
            definition, _ = self.converted(name)
            self.assertTrue(definition['extensions']['logistics-v1']['feeds'])
        ini = rw.load_unit(rw.RW / weapons.source_index()['T14']['source'])
        self.assertEqual(logistics.tank_stocks(ini)['穿甲弹'], 20)
        definition, _ = self.converted('T14')
        self.assertEqual(definition['extensions']['logistics-v1']['serviceSeconds']['tank-resupply'], 20)
        self.assertEqual(logistics.aps_policy(ini)['launchers'][0]['reload'], 2.5)

    def test_provider_preserves_movement_lock_and_firing_during_source_service(self):
        definition = {'id': 'usgr-re-supply-depot'}
        notes = logistics.augment_supply_provider(definition, rw.load_unit(rw.RW / weapons.source_index()['T90M']['source']))
        service, crew = definition['extensions']['logistics-v1']['services']
        self.assertEqual((service['seconds'], service['range']), (10, 96))
        self.assertTrue(service['lockMovement'])
        self.assertFalse(service['lockWeapons'])
        self.assertFalse(service['providerStationary'])
        self.assertEqual(service['components'], ['protection'])
        self.assertEqual((crew['seconds'], crew['range'], crew['components']), (18, 96, ['crew']))
        self.assertTrue(crew['lockMovement'])
        self.assertFalse(crew['lockWeapons'])
        self.assertEqual(crew['stocks'], [])
        ini = deepcopy(rw.load_unit(rw.RW / weapons.source_index()['T90M']['source']))
        ini['action_suppMemb']['price'] = 'SUP=5'
        with self.assertRaises(ValueError):
            logistics.augment_supply_provider({}, ini)


if __name__ == '__main__':
    unittest.main()

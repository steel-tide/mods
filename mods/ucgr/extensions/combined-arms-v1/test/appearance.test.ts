import { afterEach, expect, test } from 'bun:test';
import { DEFS, getDef } from '../../../../../../steel-tide/game/core/src/game/defs';
import { newEnt } from '../../../../../../steel-tide/game/core/src/game/state';
import { arena } from '../../../../../../steel-tide/game/core/server/testkit/game';
import { createRuntimeGame } from '../../../../../../steel-tide/game/core/src/game/extensions/runtime';
import { createSensorsModule } from '../src/sensors';
import { readSensorsDef } from '../src/sensorsSpec';
import { createLogisticsModule, type LogisticsModule } from '../src/logistics';
import { createFeedbackModule, type FeedbackModule } from '../src/feedback';
import { FEEDBACK_ID, readFeedbackDef } from '../src/feedbackSpec';
const id = 'appearance-launcher';
afterEach(() => { delete DEFS[id]; });
test('source deployment artwork follows real deployment and stock, with only its public picture index replicated', () => {
  const errors: any[] = [];
  const sensor = readSensorsDef({ radarBattery: { role: 'launcher', interval: 8/60, linkRange: 200, stock: 'sam', high: 1000, low: 600, helicopter: 480, waypointTime: 5 } }, 'sensor', errors)!;
  const states = [false, true].flatMap(deployed => [0, 1, 2, 3].map(minimum => ({ deployed, minimum, body: `body-${deployed}-${minimum}`, mounts: deployed ? { 'mount-main': `ring-${minimum}` } : {} })));
  const spriteKeys = new Set(states.flatMap(s => [s.body, ...Object.values(s.mounts)]));
  const feedback = readFeedbackDef({ voices: {}, appearance: { stock: 'sam', states } }, 'feedback', errors, { assetIds: new Set(), spriteKeys } as any)!;
  expect(errors).toEqual([]);
  DEFS[id] = { ...getDef('ltank'), id, weapons: [{ ...getDef('ltank').weapons[0], id: 'sam', extensions: { 'logistics-v1': { stock: 'sam', cost: 1 } } }], extensions: {
    'sensors-v1': sensor, [FEEDBACK_ID]: feedback,
    'logistics-v1': { stocks: [{ id: 'sam', label: ['SAM', 'SAM', 'SAM'], capacity: 3, initial: 3 }], feeds: [], services: [] },
  } } as any;
  const base = arena({ mode: 'campaign', fog: true, dayNight: false });
  const { game, runtime } = createRuntimeGame(base.st.cfg, base.st.map, true, [{ id: 'logistics-v1', create: createLogisticsModule }, { id: 'sensors-v1', create: createSensorsModule }, { id: FEEDBACK_ID, create: createFeedbackModule }]);
  const e = newEnt(game.st, id, 0, 500, 500), hidden = newEnt(game.st, id, 1, 800, 800);
  const pictures = runtime.module(FEEDBACK_ID) as FeedbackModule, sensors = runtime.module('sensors-v1')!, logistics = runtime.module('logistics-v1') as LogisticsModule;
  sensors.beforeStep!(1/60);
  expect(pictures.appearance(e)?.body).toBe('body-false-3');
  expect(sensors.order!({ owner: 0, ids: [e.id], action: 'battery:deploy' })).toBe(true);
  expect(pictures.appearance(e)?.body).toBe('body-true-3');
  const stock = logistics.snapshot() as any;
  stock[e.id].stocks.sam = 1;
  logistics.restore(stock);
  expect(pictures.appearance(e)?.body).toBe('body-true-1');
  const snapshot = pictures.snapshot({ visibleEntities: new Set([e.id]), visibleProjectiles: new Set(), privateEntity: () => false } as any) as any;
  expect(snapshot[e.id]).toEqual({ icons: [], public: true, appearance: 5 });
  expect(snapshot[hidden.id]).toBeUndefined();
  pictures.restore(snapshot);
  expect(pictures.appearance(e)?.body).toBe('body-true-1');
  const invalid = structuredClone(snapshot); invalid[e.id].appearance = 8;
  expect(() => pictures.restore(invalid)).toThrow('Invalid feedback source appearance');
  runtime.dispose();
});

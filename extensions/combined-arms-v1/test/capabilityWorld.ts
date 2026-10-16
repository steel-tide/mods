import {grantTrustedExtensions} from '../../../../steel-tide/game/core/src/game/contentSchema';
import {extensionPackageStamp} from '../../../../steel-tide/game/core/src/game/extensions/contracts';
import extensionPackage from '../extension.json';
import { encodeCustomMap } from '../../../../steel-tide/game/core/src/game/customMap';
import type { World } from '../../../../steel-tide/game/core/src/game/world';
import type { WorldSelection } from '../../../../steel-tide/game/core/src/net/protocol';
import { arenaMap } from '../../../../steel-tide/game/core/server/testkit/game';
export const capabilities = ['extension-host-v1'];
const labels = ['Signal carrier', '通信车', '통신차'];
export function selection(): WorldSelection {
  grantTrustedExtensions([extensionPackageStamp(extensionPackage)]);
  const map = arenaMap(); map.spawns = [{ x: 5, y: 5 }, { x: 10, y: 5 }, { x: 40, y: 40 }];
  const project: World = { format: 'steel-tide-world', v: 1, id: 'cap-network-world', name: 'Capability network', version: '1', maps: { arena: encodeCustomMap(map, 'Arena') }, campaigns: [], texts: {},
    mods: [{ format: 'steel-tide-mod', v: 4, extensionPackages:[extensionPackage], id: 'cap-network', name: labels, version: '1', requiredCapabilities: ['logistics-v1', 'sensors-v1'], defs: [{ id: 'cap-network-carrier', extends: 'engineer', name: labels,
      extensions: { 'logistics-v1': { stocks: [{ id: 'cells', label: labels, capacity: 7, initial: 5 }] }, 'sensors-v1': { emitters: [{ id: 'radio', label: labels, channel: 'signal', range: 20, toggleTime: .1 }] } } }] }],
    scenarios: [{ id: 'network', name: 'Network', map: 'arena', cfg: { mode: 'campaign', mapKey: 'custom', seed: 45, fog: false, popCap: 100, startMetal: 1000, players: [{ isHuman: true, team: 0 }, { isHuman: true, team: 0 }, { isHuman: false, team: 1, scripted: true }] },
      instances: [{ id: 'first', defId: 'cap-network-carrier', owner: 0, x: 160, y: 160 }, { id: 'second', defId: 'cap-network-carrier', owner: 1, x: 320, y: 160 }, { id: 'enemy', defId: 'cap-network-carrier', owner: 2, x: 1200, y: 1200 }], variables: {}, triggers: [] }],
  };
  return { project, scenarioId: 'network' };
}

import type { TextTuple } from '../../../../steel-tide/game/core/src/core/i18n';
const STRINGS:Record<string,TextTuple>={
  'extension.link': ['Link controller', '连接控制器', '제어기 연결'],
  'extension.unlink': ['Disconnect controller', '断开控制器', '제어기 연결 해제'],
  'extension.remoteMove': ['Move remotely', '远程移动', '원격 이동'],
  'extension.remoteAttack': ['Attack remotely', '远程攻击', '원격 공격'],
  'extension.tow': ['Tow', '牵引', '견인'],
  'extension.detach': ['Detach', '解除连接', '분리'],
  'extension.cancel': ['Cancel deployment', '取消部署', '배치 취소'],
  'module.repair': ['Repair components', '修复部件', '부품 수리'],
  'module.cancel': ['Cancel work', '取消作业', '작업 취소'],
  'module.reassign': ['Reassign crew', '调配乘员', '승무원 재배치'],
  'module.ammunition': ['Ammunition', '弹药', '탄약'],
  'module.refill': ['Resupply', '补给', '재보급'],
};
export function t(key:string):TextTuple {return STRINGS[key];}

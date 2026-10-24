// The source's ground maps as Scenario Editor files, through the game's own
// Rusted Warfare importer, at this port's scale.
//
//   bun mods/gw/source-maps.ts
//
// A map is read from the source (`GW_BattleUniverse_Main/Maps`, git-ignored),
// its terrain classed by the importer, then resampled: this port draws 0.75
// world px for every RW px, so a 20 px RW tile is 15 world px, under half a
// 32 px tile. The space and ground-and-space maps, and the `_02` copies that
// differ only in their props, stay out (DOCS.md).
import { DOMParser } from '../../../steel-tide-game/game/core/node_modules/@xmldom/xmldom/lib/index.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { importRustedWarfareMap } from '../../../steel-tide-game/game/core/src/game/rustedWarfareMap';
import { parseCustomMap } from '../../../steel-tide-game/game/core/src/game/customMap';
import { rleDecode, rleEncode } from '../../../steel-tide-game/game/core/src/game/rle';
import { MAX_MAP_SIDE } from '../../../steel-tide-game/game/core/src/core/types';

(globalThis as any).DOMParser = DOMParser;
const HERE = import.meta.dir;
const SOURCE = resolve(HERE, '../../rusted-warfare-mods/gw/GW_BattleUniverse_Main/Maps');
const WORLD = 0.75, TILE = 32;

const MAPS: { file: string; id: string; name: [string, string, string]; line: [string, string, string] }[] = [
  { file: 'AtJaburosFall[2v2]_PVP_01', id: 'at-jaburos-fall-2v2', name: ["At Jaburo's Fall", '魂断贾布罗', '자브로 함락'],
    line: ['The Federation headquarters under the jungle, assaulted from both banks.', '丛林下的联邦军总部，两岸同时遭到攻击。', '정글 아래의 연방군 본부, 양쪽 강변에서 공격받는다.'] },
  { file: 'AtJaburosFall[3v3]_PVP_01', id: 'at-jaburos-fall-3v3', name: ["At Jaburo's Fall", '魂断贾布罗', '자브로 함락'],
    line: ['The Federation headquarters under the jungle, assaulted from both banks.', '丛林下的联邦军总部，两岸同时遭到攻击。', '정글 아래의 연방군 본부, 양쪽 강변에서 공격받는다.'] },
  { file: 'CucuruzDoansIsland[2v2]_PVP_01', id: 'cucuruz-doans-island', name: ["Cucuruz Doan's Island", '库库鲁斯多安之岛', '쿠쿠루즈 도안의 섬'],
    line: ['A lone island and the sea round it.', '一座孤岛，与环绕它的海。', '외딴 섬과 그를 둘러싼 바다.'] },
  { file: 'DenseForestRegion[1v1]_PVP_01', id: 'dense-forest-region', name: ['Dense Forest Region', '密林地带', '밀림 지대'],
    line: ['Two bases a short drive apart through the trees.', '两座基地隔着树林，近在咫尺。', '숲을 사이에 두고 가까이 마주한 두 기지.'] },
  { file: 'MountainousRegion[1v1]_PVP_01', id: 'mountainous-region', name: ['Mountainous Region', '山岳地带', '산악 지대'],
    line: ['Passes between the peaks.', '群峰之间的山口。', '봉우리 사이의 고갯길.'] },
  { file: 'NewCity[3v3]_PVP_01', id: 'new-city', name: ['New City', '燃烧的新都市', '불타는 신도시'],
    line: ['A city fought over street by street.', '逐街争夺的城市。', '거리마다 쟁탈전이 벌어지는 도시.'] },
  { file: 'RiseFromTheAshes[3v3]_PVP_01', id: 'rise-from-the-ashes', name: ['Rise From The Ashes', '自灰烬中崛起', '잿더미에서 일어서다'],
    line: ['Open ground and the ruins on it.', '开阔地与其上的废墟。', '탁 트인 땅과 그 위의 폐허.'] },
  { file: 'SoutheastAsia[3v3]_PVP_01', id: 'southeast-asia', name: ['Southeast Asia', '东南亚战线', '동남아시아 전선'],
    line: ['Jungle, rivers and the coast.', '丛林、河流与海岸。', '정글과 강, 그리고 해안.'] },
  { file: 'TremorMountain[3v3]_PVP_01', id: 'tremor-mountain', name: ['Tremor Mountain', '震荡之山', '진동의 산'],
    line: ['A mountain range split by a valley.', '被山谷一分为二的山脉。', '골짜기로 갈라진 산맥.'] },
];

/** A map too large for the importer is read at half its tiles, every other one kept, as CSV. */
function halve(xml: string): string {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const root = doc.documentElement as any;
  const w = Number(root.getAttribute('width')), h = Number(root.getAttribute('height'));
  const nw = Math.floor(w / 2), nh = Math.floor(h / 2);
  for (const layer of Array.from(root.getElementsByTagName('layer')) as any[]) {
    const data = layer.getElementsByTagName('data')[0];
    const raw = Buffer.from((data.textContent ?? '').trim(), 'base64');
    const bytes = data.getAttribute('compression') === 'zlib' ? inflateSync(raw) : raw;
    const gids = new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.length / 4);
    // the ground keeps a corner of each block; a marker anywhere in one (a spawn, a deposit) is kept
    const ground = layer.getAttribute('name') === 'Ground';
    const out: number[] = [];
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      const block = [gids[(y * 2) * w + x * 2], gids[(y * 2) * w + x * 2 + 1], gids[(y * 2 + 1) * w + x * 2], gids[(y * 2 + 1) * w + x * 2 + 1]];
      out.push(ground ? block[0] : block.find(g => g) ?? 0);
    }
    data.removeAttribute('compression');
    data.setAttribute('encoding', 'csv');
    data.textContent = out.join(',');
    layer.setAttribute('width', String(nw));
    layer.setAttribute('height', String(nh));
  }
  root.setAttribute('width', String(nw));
  root.setAttribute('height', String(nh));
  root.setAttribute('tilewidth', String(Number(root.getAttribute('tilewidth')) * 2));
  root.setAttribute('tileheight', String(Number(root.getAttribute('tileheight')) * 2));
  return doc.toString();
}

for (const m of MAPS) {
  let xml = readFileSync(`${SOURCE}/${m.file}.tmx`, 'utf8').replace(/\s(offsetx|offsety)="[^"]*"/g, '');
  const head = /<map[^>]*>/.exec(xml)![0];
  const side = (k: string) => Number(new RegExp(`\\s${k}="(\\d+)"`).exec(head)![1]);
  if (side('width') > MAX_MAP_SIDE || side('height') > MAX_MAP_SIDE) xml = halve(xml);
  const tile = Number(/\stilewidth="(\d+)"/.exec(/<map[^>]*>/.exec(xml)![0])![1]);
  const r = await importRustedWarfareMap(xml, m.file);
  if (!r.ok) throw Error(`${m.file}: ${r.error}`);
  const src = r.data, f = tile * WORLD / TILE;
  const w = Math.max(16, Math.round(src.w * f)), h = Math.max(16, Math.round(src.h * f));
  const sample = (grid: Uint8Array): Uint8Array => {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const sx = Math.min(src.w - 1, Math.floor((x + 0.5) / f)), sy = Math.min(src.h - 1, Math.floor((y + 0.5) / f));
      out[y * w + x] = grid[sy * src.w + sx];
    }
    return out;
  };
  const at = (p: { x: number; y: number }) => ({ x: Math.min(w - 1, Math.floor((p.x + 0.5) * f)), y: Math.min(h - 1, Math.floor((p.y + 0.5) * f)) });
  const deposits = [...new Map(src.deposits.map(at).map(p => [`${p.x},${p.y}`, p])).values()];
  const data: any = {
    format: src.format, v: src.v, name: m.name[0], description: m.line[0],
    translations: { zh: { name: m.name[1], description: m.line[1] }, ko: { name: m.name[2], description: m.line[2] } },
    w, h, terrain: rleEncode(sample(rleDecode(src.terrain, src.w * src.h))),
    ...(src.overlays ? { overlays: rleEncode(sample(rleDecode(src.overlays, src.w * src.h))) } : {}),
    deposits, spawns: src.spawns.map(at),
  };
  const text = JSON.stringify(data);
  const check = parseCustomMap(text);
  if (!check.ok) throw Error(`${m.file}: ${check.error}`);
  writeFileSync(`${HERE}/maps/${m.id}.steel-tide-map`, text + '\n');
  console.log(`${m.id}: ${w}×${h} from ${src.w}×${src.h} (${tile} px tiles), ${data.spawns.length} spawns, ${deposits.length} deposits, ${(text.length / 1024).toFixed(0)} KB, warnings ${r.warnings.join(' ') || 'none'}`);
}

const EXTENSION_HOST_VERSION = 2;
function validCapabilityId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(value) && !["__proto__", "constructor", "prototype"].includes(value);
}
function extensionPackageStamp(pkg) {
  const resources = pkg.assets ? ":" + resourceFingerprint(pkg.assets) : "";
  return `${pkg.id}@${pkg.version}:${pkg.schema.sha256}:${pkg.runtime.sha256}:${pkg.presentation?.sha256 ?? ""}${resources}${pkg.api > 1 ? ":api" + pkg.api : ""}`;
}
function resourceFingerprint(assets) {
  const text = JSON.stringify(Object.entries(assets).sort(([a2], [b2]) => a2 < b2 ? -1 : a2 > b2 ? 1 : 0));
  let a = 2166136261, b = 2654435769, c = 2246822507, d = 3266489909;
  for (let i = 0; i < text.length; i++) {
    const n = text.charCodeAt(i);
    a = Math.imul(a ^ n, 16777619);
    b = Math.imul(b ^ n, 2246822507);
    c = Math.imul(c ^ n, 3266489909);
    d = Math.imul(d ^ n, 668265263);
  }
  return [a, b, c, d].map((n) => (n >>> 0).toString(16).padStart(8, "0")).join("");
}
let read, references;
let loading;
let trustedPackages;
function grantTrustedExtensions(stamps) {
  if (!stamps.length) return;
  for (const stamp of stamps)
    if (typeof stamp === "string" && stamp.length <= 512 && !trustedPackages?.has(stamp)) {
      (trustedPackages ??= /* @__PURE__ */ new Set()).add(stamp);
    }
}
function isTrustedExtension(stamp) {
  return trustedPackages?.has(stamp) ?? false;
}
let prepareSchemas$1;
let checkPackages;
function registerContentSchema(reader, validator, checker) {
  read = reader;
  references = validator;
  checkPackages = checker;
}
function validateContentPackages(raw, issues, limits) {
  if (!checkPackages)
    issues.push({ path: "mod.extensionPackages", message: "extension package schema must be prepared" });
  else checkPackages(raw, "mod.extensionPackages", issues, limits);
}
function contentSchemaPrepared() {
  return read !== void 0;
}
function needsContentSchema(input) {
  if (typeof input === "string") {
    if (!/"v"\s*:\s*[34](?:\s*[,}])/.test(input)) return false;
    try {
      return needsContentSchema(JSON.parse(input));
    } catch {
      return false;
    }
  }
  if (Array.isArray(input)) return input.some(needsContentSchema);
  if (!input || typeof input !== "object") return false;
  const value = input;
  const configured = value.extensionPackages !== void 0 || Array.isArray(value.requiredCapabilities) && value.requiredCapabilities.length > 0 || Array.isArray(value.defs) && value.defs.some((def) => {
    if (!def || typeof def !== "object") return false;
    const d = def;
    return d.extensions !== void 0 || Array.isArray(d.weapons) && d.weapons.some((w2) => !!w2 && typeof w2 === "object" && "extensions" in w2);
  });
  return value.format === "steel-tide-mod" && (value.v === 3 || value.v === 4) && !!configured || Array.isArray(value.mods) && value.mods.some(needsContentSchema);
}
function prepareContentSchema(input, trust = false) {
  if (!needsContentSchema(input)) return null;
  if (prepareSchemas$1) return prepareSchemas$1(input, trust);
  if (!loading) {
    loading = Promise.resolve().then(() => schema).then((schema2) => {
      registerContentSchema(schema2.readExtensions, schema2.validateExtensionReferences, schema2.checkExtensionPackages);
      prepareSchemas$1 = schema2.prepareSchemas;
      schema2.preparedExtensionStamps;
    });
    loading.catch(() => {
      loading = void 0;
    });
  }
  return loading.then(async () => {
    await prepareSchemas$1?.(input, trust);
  });
}
function readExtensions$1(raw, pack, path, issues, context, weapon = false) {
  if (!read) {
    issues.push({ path, message: "content extension schema must be prepared before validation" });
    return;
  }
  return read(raw, pack, path, issues, context, weapon);
}
function validateExtensionReferences$1(def, table, path, issues, forms, pack) {
  references?.(def, table, path, issues, forms, pack);
}
const STANDARD_CONTENT_LIMITS = Object.freeze({
  defs: 200,
  sprites: 192,
  sounds: 60,
  manifestBytes: 1024 * 1024,
  filesBytes: 24 * 1024 * 1024,
  hp: 1e6,
  extensionSourceBytes: 512 * 1024,
  extensionAssets: 256
});
const LARGE_CONTENT_LIMITS = Object.freeze({
  defs: 1024,
  sprites: 2048,
  sounds: 512,
  manifestBytes: 4 * 1024 * 1024,
  filesBytes: 256 * 1024 * 1024,
  hp: 1e8,
  extensionSourceBytes: 2 * 1024 * 1024,
  extensionAssets: 2048
});
function contentLimits(pack) {
  return pack.v === 4 && pack.capacity === "large" ? LARGE_CONTENT_LIMITS : STANDARD_CONTENT_LIMITS;
}
const MAX_CONTENT_INPUT_BYTES = LARGE_CONTENT_LIMITS.manifestBytes + LARGE_CONTENT_LIMITS.filesBytes;
function contentFilesSize(files) {
  let size = 0;
  for (const value of Object.values(files)) if (typeof value === "string") size += value.length;
  return size;
}
const K = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
const rotate = (n, bits) => n >>> bits | n << 32 - bits;
function sha256Hex(input) {
  const size = Math.ceil((input.length + 9) / 64) * 64, bytes = new Uint8Array(size), view = new DataView(bytes.buffer);
  bytes.set(input);
  bytes[input.length] = 128;
  const bits = input.length * 8;
  view.setUint32(size - 8, Math.floor(bits / 4294967296));
  view.setUint32(size - 4, bits >>> 0);
  const hash = new Uint32Array([
    1779033703,
    3144134277,
    1013904242,
    2773480762,
    1359893119,
    2600822924,
    528734635,
    1541459225
  ]), words = new Uint32Array(64);
  for (let block = 0; block < size; block += 64) {
    for (let i = 0; i < 16; i++) words[i] = view.getUint32(block + i * 4);
    for (let i = 16; i < 64; i++) {
      const x = words[i - 15], y = words[i - 2];
      words[i] = words[i - 16] + (rotate(x, 7) ^ rotate(x, 18) ^ x >>> 3) + words[i - 7] + (rotate(y, 17) ^ rotate(y, 19) ^ y >>> 10) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let i = 0; i < 64; i++) {
      const first = h + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) + (e & f ^ ~e & g) + K[i] + words[i] >>> 0;
      const second = (rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + (a & b ^ a & c ^ b & c) >>> 0;
      h = g;
      g = f;
      f = e;
      e = d + first >>> 0;
      d = c;
      c = b;
      b = a;
      a = first + second >>> 0;
    }
    const values = [a, b, c, d, e, f, g, h];
    for (let i = 0; i < 8; i++) hash[i] = hash[i] + values[i] >>> 0;
  }
  return [...hash].map((n) => n.toString(16).padStart(8, "0")).join("");
}
const verifiedSources = /* @__PURE__ */ new Map();
const schemas = /* @__PURE__ */ new Map();
const pendingSchemas = /* @__PURE__ */ new Map();
const modules = /* @__PURE__ */ new Map();
const rawObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);
function checkExtensionPackages(raw, path, issues, limits = STANDARD_CONTENT_LIMITS) {
  const start = issues.length;
  if (!Array.isArray(raw) || raw.length > 16) {
    issues.push({ path, message: "must be a list of up to 16 extension packages" });
    return false;
  }
  const ids = /* @__PURE__ */ new Set(), capabilities = /* @__PURE__ */ new Set();
  for (const [i, value] of raw.entries()) {
    const p = `${path}[${i}]`;
    if (!rawObject(value)) {
      issues.push({ path: p, message: "must be an extension package" });
      continue;
    }
    for (const key of Object.keys(value))
      if (!["id", "version", "api", "capabilities", "schema", "runtime", "presentation", "assets"].includes(key))
        issues.push({ path: `${p}.${key}`, message: "unsupported field" });
    if (!validCapabilityId(value.id) || ids.has(value.id))
      issues.push({ path: `${p}.id`, message: "must be a unique bounded identifier" });
    else ids.add(value.id);
    if (typeof value.version !== "string" || !/^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$/.test(value.version) || value.version.length > 32)
      issues.push({ path: `${p}.version`, message: "must be a semantic version" });
    if (!Number.isInteger(value.api) || value.api < 1 || value.api > EXTENSION_HOST_VERSION)
      issues.push({ path: `${p}.api`, message: `requires unsupported extension host API ${String(value.api)}` });
    if (!Array.isArray(value.capabilities) || !value.capabilities.length || value.capabilities.length > 32 || new Set(value.capabilities).size !== value.capabilities.length || value.capabilities.some((id) => !validCapabilityId(id) || capabilities.has(id)))
      issues.push({ path: `${p}.capabilities`, message: "must declare unique bounded capability IDs" });
    else for (const id of value.capabilities) capabilities.add(id);
    if (value.assets !== void 0) {
      if (!rawObject(value.assets) || Object.keys(value.assets).length > limits.extensionAssets)
        issues.push({ path: `${p}.assets`, message: `must map up to ${limits.extensionAssets} resource IDs to relative files` });
      else for (const [id, file] of Object.entries(value.assets)) {
        if (!validCapabilityId(id)) issues.push({ path: `${p}.assets.${id}`, message: "must be a bounded resource identifier" });
        if (typeof file !== "string" || !/^(?!\/)(?!.*\.\.)[A-Za-z0-9_./-]{1,120}$/.test(file))
          issues.push({ path: `${p}.assets.${id}`, message: "must be a relative path inside the owning mod" });
      }
    }
    for (const part of ["schema", "runtime", "presentation"]) {
      const code = value[part];
      if (part === "presentation" && code === void 0) continue;
      if (!rawObject(code) || Object.keys(code).some((key) => key !== "source" && key !== "sha256") || typeof code.source !== "string" || !code.source.length || code.source.length > limits.extensionSourceBytes || typeof code.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(code.sha256))
        issues.push({ path: `${p}.${part}`, message: "must contain bounded ES module source and its SHA-256 hash" });
    }
  }
  return issues.length === start;
}
async function verify(code) {
  if (verifiedSources.get(code.sha256) === code.source) return;
  const bytes = new TextEncoder().encode(code.source);
  const subtle = globalThis.crypto?.subtle;
  const actual = subtle ? [...new Uint8Array(await subtle.digest("SHA-256", bytes))].map((n) => n.toString(16).padStart(2, "0")).join("") : sha256Hex(bytes);
  if (actual !== code.sha256) throw new Error("Extension package integrity mismatch");
  verifiedSources.set(code.sha256, code.source);
}
async function importExtension(code, api) {
  await verify(code);
  let module = modules.get(code.sha256);
  if (!module) {
    const browser = typeof document !== "undefined" || "WorkerGlobalScope" in globalThis || "Bun" in globalThis;
    const url = browser ? URL.createObjectURL(new Blob([code.source], { type: "text/javascript" })) : `data:text/javascript;base64,${btoa(unescape(encodeURIComponent(code.source)))}`;
    module = import(
      /* @vite-ignore */
      url
    ).finally(() => {
      if (browser) URL.revokeObjectURL(url);
    });
    modules.set(code.sha256, module);
    module.catch(() => modules.delete(code.sha256));
  }
  const loaded = await module;
  if (typeof loaded.default !== "function") throw new Error("Extension module must export a host factory");
  return loaded.default(api);
}
function preparedExtensionStamps() {
  return [...schemas.keys()].map((stamp) => "package:" + stamp);
}
function parts(pkg) {
  return [pkg.schema, pkg.runtime, ...pkg.presentation ? [pkg.presentation] : []];
}
function preparedPackage(pkg) {
  return parts(pkg).every((code) => verifiedSources.get(code.sha256) === code.source) ? schemas.get(extensionPackageStamp(pkg)) : void 0;
}
function preparePackageSchemas(packages, trust = false, limits = STANDARD_CONTENT_LIMITS) {
  if (!trust && packages.some((pkg) => !isTrustedExtension(extensionPackageStamp(pkg))))
    return Promise.reject(new Error("Extension package code must be installed or approved locally before network use"));
  const work = packages.filter((pkg) => !preparedPackage(pkg)).map(async (pkg) => {
    const issues = [];
    if (!checkExtensionPackages([pkg], "extensionPackages", issues, limits))
      throw new Error(issues.map((e) => `${e.path}: ${e.message}`).join("; "));
    await Promise.all(parts(pkg).map(verify));
    if (trust) grantTrustedExtensions([extensionPackageStamp(pkg)]);
    const stamp = extensionPackageStamp(pkg);
    let pending = pendingSchemas.get(stamp);
    if (!pending) {
      pending = (async () => {
        const schema2 = await importExtension(pkg.schema, Object.freeze({}));
        if (!schema2 || !Array.isArray(schema2.capabilities) || schema2.capabilities.length !== pkg.capabilities.length || new Set(schema2.capabilities.map((s) => s.id)).size !== pkg.capabilities.length || pkg.capabilities.some(
          (id) => !schema2.capabilities.some(
            (s) => s.id === id && typeof s.definition === "function" && (s.weapon === void 0 || typeof s.weapon === "function") && (s.references === void 0 || typeof s.references === "function")
          )
        ))
          throw new Error(`Invalid schema exports: ${pkg.id}`);
        schemas.set(stamp, schema2);
      })();
      pendingSchemas.set(stamp, pending);
      pending.finally(() => pendingSchemas.delete(stamp)).catch(() => {
      });
    }
    return pending;
  });
  return work.length ? Promise.all(work).then(() => {
  }) : null;
}
function readExtensions(raw, pack, path, issues, context, weapon = false) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    issues.push({ path, message: "must be an object" });
    return;
  }
  if (pack.v < 3) {
    issues.push({ path, message: "extensions require format 3 or later" });
    return;
  }
  const out = /* @__PURE__ */ Object.create(null);
  for (const [id, value] of Object.entries(raw)) {
    if (!validCapabilityId(id) || !pack.requiredCapabilities?.includes(id)) {
      issues.push({ path: `${path}.${id}`, message: "must be a valid ID declared in requiredCapabilities" });
      continue;
    }
    const pkg = pack.extensionPackages?.find((p) => p.capabilities.includes(id));
    const schema2 = pkg && preparedPackage(pkg)?.capabilities.find((s) => s.id === id);
    const reader = weapon ? schema2?.weapon : schema2?.definition;
    if (!reader) {
      issues.push({
        path: `${path}.${id}`,
        message: schema2 ? "this capability has no weapon configuration" : "extension package schema has not been prepared"
      });
      continue;
    }
    const config = reader(value, `${path}.${id}`, issues, { ...context, assetIds: new Set(Object.keys(pkg?.assets ?? {})) });
    if (config !== void 0) out[id] = config;
  }
  return Object.keys(out).length ? out : void 0;
}
function validateExtensionReferences(def, table, path, issues, forms, pack) {
  for (const pkg of pack?.extensionPackages ?? [])
    for (const schema2 of preparedPackage(pkg)?.capabilities ?? []) {
      if (def.extensions?.[schema2.id]) schema2.references?.(def, table, `${path}.${schema2.id}`, issues, forms);
    }
}
function prepareSchemas(input, trust = false) {
  if (typeof input === "string" && input.length > MAX_CONTENT_INPUT_BYTES) return Promise.reject(new Error("Extension manifest is too large"));
  const raw = typeof input === "string" ? JSON.parse(input) : input;
  if (Array.isArray(raw)) {
    const work = raw.map((value2) => prepareSchemas(value2, trust)).filter((p) => p !== null);
    return work.length ? Promise.all(work).then(() => {
    }) : null;
  }
  if (!raw || typeof raw !== "object") return null;
  const value = raw;
  if (Array.isArray(value.mods)) return prepareSchemas(value.mods, trust);
  if (value.extensionPackages === void 0) return null;
  if (value.format !== "steel-tide-mod" || value.v !== 4)
    return Promise.reject(new Error("Executable extension packages require definition pack format 4"));
  const limits = contentLimits(value);
  const { files: _files, ...metadata } = value;
  if (JSON.stringify(metadata).length > limits.manifestBytes)
    return Promise.reject(new Error("Extension manifest is too large"));
  const issues = [];
  if (!checkExtensionPackages(value.extensionPackages, "extensionPackages", issues, limits))
    return Promise.reject(new Error(issues.map((e) => `${e.path}: ${e.message}`).join("; ")));
  return preparePackageSchemas(value.extensionPackages, trust, limits);
}
const schema = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  checkExtensionPackages,
  prepareSchemas,
  preparedExtensionStamps,
  readExtensions,
  validateExtensionReferences
}, Symbol.toStringTag, { value: "Module" }));
const MENU_CUT_IDS = ["flank", "sea", "winter", "raid", "landing", "rockets", "home", "nuke"];
const MAX_MENU_CUTS = 16;
const MAX_MENU_QUEUE = 32;
const MAX_MENU_MAP_SIDE = 128;
const MAX_MENU_UNITS = 200;
function menuCutMapError(cut, map) {
  if (map.w > MAX_MENU_MAP_SIDE || map.h > MAX_MENU_MAP_SIDE) return `menu maps must be at most ${MAX_MENU_MAP_SIDE} × ${MAX_MENU_MAP_SIDE} tiles`;
  if ((map.units?.length ?? 0) > MAX_MENU_UNITS) return `menu maps may place at most ${MAX_MENU_UNITS} units and buildings`;
  if (!map.spawns.length) return "a menu map needs at least one spawn";
  for (const point of [cut.camera, cut.cameraEnd, ...cut.orders ?? []]) {
    if (point && (point.tx < 0 || point.ty < 0 || point.tx >= map.w || point.ty >= map.h)) return "camera and order targets must be inside the map";
  }
  if (cut.orders?.some((order) => order.owner >= map.spawns.length) || map.units?.some((unit) => unit.owner >= map.spawns.length)) return "each unit and order owner needs a map spawn";
  return null;
}
const CONTENT_MUSIC_SLOTS = ["menu", "setup", "battle"];
const MUSIC_FILES = {
  menu: ["menu", "glassline-drive"],
  setup: ["setup", "cold-front"],
  // the two the result plate stands on, held under it for as long as it is
  // up (`MUSIC_LOOP`): the match is over, so there is nothing for a gap
  // between files to make room for
  victory: ["victory"],
  defeat: ["defeat"],
  battle: [
    "battle-1",
    "battle-2",
    "assembly-gears",
    "disciplined-unease",
    "methodical-calm",
    "iron-standard",
    "danger-close",
    "dead-reckoning",
    "zero-hour",
    "stand-to",
    "stand-down"
  ]
};
const MUSIC_IDS = new Set(Object.values(MUSIC_FILES).flat());
const STRINGS = {
  "cli.contentAction.usage": ["content-action <units> <module> <action> [--choice id] [--target id] [--at x,y]", "content-action <单位> <模块> <操作> [--choice id] [--target id] [--at x,y]", "content-action <유닛> <모듈> <작업> [--choice id] [--target id] [--at x,y]"],
  "cli.contentAction.help": ["Use an action provided by the match’s content.", "执行当前内容提供的操作。", "현재 콘텐츠에서 제공하는 작업을 수행합니다."],
  "cli.contentAction.choice": ["An authored choice ID", "内容定义的选项 ID", "콘텐츠에 정의된 선택 ID"],
  "cli.contentAction.at": ["Ground target in tiles", "目标地块坐标", "타일 단위 지상 목표"],
  "cli.contentAction.notes": ["Read a unit with steel show to list its module actions and choices. The server validates every order.", "使用 steel show 查看单位的模块操作和选项。服务器会验证每条指令。", "steel show으로 유닛의 모듈 작업과 선택 항목을 확인하세요. 서버가 모든 명령을 검증합니다."],
  "module.suppression": ["Suppression", "压制", "제압"],
  "module.disabled": ["Unavailable", "不可用", "사용 불가"],
  "module.ready": ["Ready", "就绪", "준비 완료"],
  "module.busy": ["In progress", "进行中", "진행 중"],
  "module.target": ["Target", "目标", "대상"],
  "module.confirm": ["Give order", "下达指令", "명령 내리기"],
  "module.failed": ["The action is unavailable now.", "当前无法执行此操作。", "지금은 이 작업을 수행할 수 없습니다."],
  "module.restoring": ["The server is restoring its content. Please reconnect shortly.", "服务器正在恢复内容，请稍后重新连接。", "서버가 콘텐츠를 복원하고 있습니다. 잠시 후 다시 연결하세요."],
  "module.required": ["This room requires engine capabilities this client does not support.", "此房间需要当前客户端不支持的引擎功能。", "이 방에는 현재 클라이언트에서 지원하지 않는 엔진 기능이 필요합니다."],
  "module.everyoneRequired": ["Everyone in the room must support the required engine capabilities.", "房间内的所有玩家都必须支持所需的引擎功能。", "방의 모든 플레이어가 필요한 엔진 기능을 지원해야 합니다."],
  "module.loadFailed": ["The required content modules could not be loaded.", "无法加载所需的内容模块。", "필요한 콘텐츠 모듈을 불러올 수 없습니다."],
  "faction.vanilla": ["Steel Tide", "钢铁浪潮", "스틸 타이드"],
  "world.workspace.library": ["Library", "资源库", "라이브러리"],
  "world.workspace.assets": ["Asset Manager", "资源管理器", "에셋 관리자"],
  "world.workspace.modEditor": ["Mod Editor", "模组编辑器", "모드 편집기"],
  "world.workspace.world": ["World", "世界", "월드"],
  "world.workspace.openTabs": ["Open editors", "已打开的编辑器", "열린 편집기"],
  "world.workspace.closeTab": ["Close {0}", "关闭 {0}", "{0} 닫기"],
  "world.workspace.new": ["New", "新建", "새로 만들기"],
  "world.workspace.scenarioDescription": ["Set up factions, objectives and scripted events on a map.", "在地图上设置阵营、目标和脚本事件。", "지도에 진영, 목표, 스크립트 이벤트를 설정합니다."],
  "world.workspace.mapDescription": ["Shape the terrain and place scenery, resources and units.", "塑造地形，放置景物、资源和单位。", "지형을 만들고 장식물, 자원, 유닛을 배치합니다."],
  "world.workspace.modDescription": ["Create custom units and buildings with their own stats, visuals and sounds.", "创建拥有自定义属性、外观和音效的单位与建筑。", "능력치, 외형, 사운드를 갖춘 나만의 유닛과 건물을 만듭니다."],
  "world.home.worlds": ["Worlds", "世界", "월드"],
  "world.home.maps": ["Maps", "地图", "지도"],
  "world.home.mods": ["Mods", "模组", "모드"],
  "world.home.scenarios": ["Scenarios", "场景", "시나리오"],
  "world.home.categories": ["Content categories", "内容分类", "콘텐츠 종류"],
  "world.home.actions": ["Actions", "操作", "작업"],
  "world.home.selected": ["Selected item", "已选内容", "선택한 항목"],
  "world.home.count": ["{0} items", "{0} 项", "{0}개 항목"],
  "world.home.openHint": ["Double-click or press Enter to open", "双击或按回车打开", "두 번 클릭하거나 Enter 키로 열기"],
  "world.home.itemActions": ["Actions for {0}", "{0} 的操作", "{0} 작업"],
  "world.home.about.worlds": ["Bring maps, scenarios and mods together in a world.", "将地图、场景和模组组合成一个世界。", "지도, 시나리오와 모드를 하나의 월드로 모읍니다."],
  "world.home.about.maps": ["Create and edit the terrain, scenery and starting forces of a battlefield.", "创建和编辑战场的地形、装饰和初始兵力。", "전장의 지형, 장식과 시작 병력을 만들고 편집합니다."],
  "world.home.about.mods": ["Create units and buildings with the existing mod format.", "使用现有模组格式创建单位和建筑。", "기존 모드 형식으로 유닛과 건물을 만듭니다."],
  "world.home.about.scenarios": ["Define objectives, events and rules for a playable scenario.", "为可玩的场景编写目标、事件和规则。", "플레이할 시나리오의 목표, 이벤트와 규칙을 정합니다."],
  "world.home.empty.worlds": ["No worlds yet. Create a world or open a world file.", "暂无世界。创建世界或打开世界文件。", "월드가 없습니다. 월드를 만들거나 월드 파일을 여세요."],
  "world.home.empty.maps": ["No maps yet. Create a map or open a map file.", "暂无地图。创建地图或打开地图文件。", "지도가 없습니다. 지도를 만들거나 지도 파일을 여세요."],
  "world.home.empty.mods": ["No mods yet. Create a mod or open a mod file.", "暂无模组。创建模组或打开模组文件。", "모드가 없습니다. 모드를 만들거나 모드 파일을 여세요."],
  "world.home.empty.scenarios": ["No scenarios yet. Create a scenario or open a scenario file.", "暂无场景。创建场景或打开场景文件。", "시나리오가 없습니다. 시나리오를 만들거나 시나리오 파일을 여세요."],
  "world.home.newWorld": ["New World", "新建世界", "새 월드"],
  "world.home.openWorld": ["Open World", "打开世界", "월드 열기"],
  "world.home.newMap": ["New Map", "新建地图", "새 지도"],
  "world.home.openMap": ["Open Map", "打开地图", "지도 열기"],
  "world.home.newMod": ["New Mod", "新建模组", "새 모드"],
  "world.home.openMod": ["Open Mod", "打开模组", "모드 열기"],
  "world.home.newScenario": ["New Scenario", "新建场景", "새 시나리오"],
  "world.home.openScenario": ["Open Scenario", "打开场景", "시나리오 열기"],
  "world.home.edit": ["Edit", "编辑", "편집"],
  "world.home.standalone": ["Standalone", "独立内容", "독립 항목"],
  "world.home.worldCount": ["In {0} worlds", "属于 {0} 个世界", "{0}개 월드에서 사용"],
  "world.home.worldName": ["World: {0}", "世界：{0}", "월드: {0}"],
  "world.home.allWorlds": ["All Worlds", "所有世界", "모든 월드"],
  "world.home.addExisting": ["Add Existing…", "添加已有内容…", "기존 항목 추가…"],
  "world.home.renameWorld": ["Rename World", "重命名世界", "월드 이름 변경"],
  "world.home.worldItems": ["{0} items", "{0} 项", "{0}개 항목"],
  "world.home.deleteWorldBody": ["Delete world “{0}”? Its maps, mods and scenarios will stay in your library.", "删除世界“{0}”？其中的地图、模组和场景将保留在你的内容库中。", "월드 “{0}”을(를) 삭제할까요? 지도, 모드와 시나리오는 라이브러리에 남습니다."],
  "world.home.deleteMapBody": ["Delete map “{0}” from this device?", "从此设备删除地图“{0}”？", "이 기기에서 지도 “{0}”을(를) 삭제하시겠습니까?"],
  "world.home.mapInUse": ["This map is used by a scenario. Change or remove that scenario before deleting the map.", "此地图被场景引用。删除地图前，请更改或删除该场景。", "이 지도는 시나리오에서 사용 중입니다. 지도를 삭제하기 전에 해당 시나리오를 변경하거나 삭제하세요."],
  "world.home.noOtherItems": ["No more items to add.", "没有更多可添加的内容。", "추가할 항목이 더 없습니다."],
  "world.home.chooseWorld": ["Choose a World", "选择世界", "월드 선택"],
  "world.home.incompatibleFile": ["This file does not contain the selected content type.", "此文件不包含所选类型的内容。", "이 파일에는 선택한 종류의 콘텐츠가 없습니다."],
  "world.home.addToWorld": ["Add to World", "添加到世界", "월드에 추가"],
  "world.home.removeFromWorld": ["Remove from World", "从世界中移除", "월드에서 제거"],
  "world.field.cls": ["Weapon class", "武器类型", "무기 유형"],
  "world.field.dmg": ["Damage", "伤害", "피해"],
  "world.field.reload": ["Reload time", "装填时间", "재장전 시간"],
  "world.field.range": ["Range", "射程", "사거리"],
  "world.field.proj": ["Projectile type", "弹体类型", "발사체 종류"],
  "world.field.splash": ["Splash radius", "溅射半径", "폭발 반경"],
  "world.field.burst": ["Burst count", "连射次数", "연사 수"],
  "world.field.burstDelay": ["Burst interval", "连射间隔", "연사 간격"],
  "world.field.spread": ["Spread", "散布", "탄퍼짐"],
  "world.field.turnRate": ["Turn rate", "转向速度", "회전 속도"],
  "world.field.pop": ["Population", "人口", "인구"],
  "world.field.power": ["Power", "电力", "전력"],
  "world.field.radius": ["Collision radius", "碰撞半径", "충돌 반경"],
  "world.field.fw": ["Footprint width", "占地宽度", "차지하는 너비"],
  "world.field.fh": ["Footprint height", "占地高度", "차지하는 높이"],
  "world.field.sprite": ["Body sprite", "主体图像", "본체 스프라이트"],
  "world.field.turretSprite": ["Turret sprite", "炮塔图像", "포탑 스프라이트"],
  "world.field.recoil": ["Barrel recoil", "炮管后坐", "포신 반동"],
  "world.field.barrels": ["Barrel regions", "炮管区域", "포신 영역"],
  "world.field.hasTurret": ["Has turret", "带炮塔", "포탑 있음"],
  "world.field.tier": ["Tier", "等级", "단계"],
  "world.field.requires": ["Requirements", "前置条件", "요구 사항"],
  "world.field.techTier": ["Technology tier", "科技等级", "기술 단계"],
  "world.field.built": ["Buildings constructed", "已建造建筑", "건설한 건물"],
  "world.field.trained": ["Units trained", "已训练单位", "생산한 유닛"],
  "world.field.lost": ["Units lost", "损失单位", "잃은 유닛"],
  "world.field.on": ["Event", "事件", "이벤트"],
  "world.field.when": ["Condition becomes true", "条件成立时", "조건이 참이 될 때"],
  "world.field.do": ["Effects", "效果", "효과"],
  "world.field.chance": ["Probability", "概率", "확률"],
  "world.field.cooldown": ["Cooldown", "冷却时间", "재사용 대기시간"],
  "world.field.button": ["Ability button", "技能按钮", "능력 버튼"],
  "world.field.morph": ["Transform into", "变形为", "변신 대상"],
  "world.field.heal": ["Heal amount", "治疗量", "치유량"],
  "world.field.healPct": ["Heal fraction", "治疗比例", "치유 비율"],
  "world.field.flag": ["Set flag", "设置标记", "표식 설정"],
  "world.field.unflag": ["Clear flag", "清除标记", "표식 해제"],
  "world.field.buff": ["Temporary modifiers", "临时增益", "임시 효과"],
  "world.field.explode": ["Explosion", "爆炸", "폭발"],
  "world.field.for": ["Duration", "持续时间", "지속 시간"],
  "world.field.taken": ["Damage taken multiplier", "承伤倍率", "받는 피해 배율"],
  "world.field.fx": ["Effect sprite", "效果图像", "효과 스프라이트"],
  "world.field.fxScale": ["Effect scale", "效果缩放", "효과 크기"],
  "world.field.die": ["Destroy entity", "摧毁实体", "개체 파괴"],
  "world.field.side": ["Side", "所属方", "소속"],
  "world.field.into": ["Destination", "目的地", "대상"],
  "world.field.unit": ["Unit definition", "单位定义", "유닛 정의"],
  "world.field.within": ["Within distance", "范围内距离", "거리 이내"],
  "world.field.moving": ["Moving", "移动中", "이동 중"],
  "world.field.still": ["Stationary duration", "静止时间", "정지 시간"],
  "world.field.age": ["Age", "存在时间", "생성 후 시간"],
  "world.field.hpBelow": ["Health below fraction", "生命低于比例", "체력 비율 미만"],
  "world.field.hpAbove": ["Health above fraction", "生命高于比例", "체력 비율 초과"],
  "world.field.rank": ["Veteran rank", "老兵等级", "숙련 등급"],
  "world.field.night": ["At night", "夜间", "야간"],
  "world.field.carrying": ["Cargo count", "载荷数量", "화물 수"],
  "world.field.killedBy": ["Destroyed by definition", "被指定单位摧毁", "파괴한 유닛 정의"],
  "world.field.file": ["Asset file", "素材文件", "에셋 파일"],
  "world.field.key": ["Asset identifier", "素材标识符", "에셋 식별자"],
  "world.field.frames": ["Frames", "帧数", "프레임 수"],
  "world.field.fps": ["Frames per second", "每秒帧数", "초당 프레임"],
  "world.field.teams": ["Faction colour masks", "阵营颜色遮罩", "진영 색상 마스크"],
  "world.field.mount": ["Mount point", "挂载点", "장착 지점"],
  "world.field.rotated": ["Pre-rotated frames", "预旋转帧", "사전 회전 프레임"],
  "world.field.body": ["Collision body", "碰撞体", "충돌 형체"],
  "world.field.len": ["Body length", "主体长度", "본체 길이"],
  "world.field.r": ["Half width", "半宽", "반 너비"],
  "world.field.mult": ["Armour damage multipliers", "装甲伤害倍率", "장갑별 피해 배율"],
  "world.field.targets": ["Target domains", "可攻击域", "공격 대상 영역"],
  "world.field.shield": ["Shield", "护盾", "보호막"],
  "world.field.look": ["Weapon appearance", "武器外观", "무기 외형"],
  "world.field.anims": ["Animation states", "动画状态", "애니메이션 상태"],
  "world.field.wing": ["Air wing", "舰载机联队", "비행 편대"],
  "world.replaceFrom": ["Replace definition", "替换定义", "교체할 정의"],
  "world.replaceTo": ["With definition", "替换为定义", "새 정의"],
  "world.field.skyMinutes": ["Opening time (minutes after midnight)", "初始时间（午夜后的分钟数）", "시작 시각 (자정 이후 분)"],
  "world.field.carryVariables": ["Variables carried between missions", "跨任务保留的变量", "임무 간 유지할 변수"],
  "world.field.touchTextKey": ["Touch instructions", "触屏说明", "터치 안내"],
  "world.field.gesture": ["Remember completed gesture", "记住已完成的操作", "완료한 동작 기억"],
  "world.field.done": ["Completion condition", "完成条件", "완료 조건"],
  "world.field.focus": ["Highlight target", "高亮目标", "강조 대상"],
  "world.field.filter": ["Unit filter", "单位筛选", "유닛 필터"],
  "world.field.preferIdle": ["Prefer idle units", "优先空闲单位", "유휴 유닛 우선"],
  "world.field.deposit": ["Highlight ore field", "高亮矿区", "광물 지대 강조"],
  "world.field.distance": ["Distance (tiles)", "距离（格）", "거리 (타일)"],
  "world.field.objectiveParam": ["Objective parameter", "目标参数", "목표 매개변수"],
  "world.field.index": ["Parameter index", "参数序号", "매개변수 번호"],
  "world.field.fallback": ["Default value", "默认值", "기본값"],
  "world.field.nearFaction": ["Near faction", "靠近阵营", "인근 진영"],
  "world.op.entities": ["Highlight units", "高亮单位", "유닛 강조"],
  "world.op.build": ["Highlight construction", "高亮建造", "건설 강조"],
  "world.op.train": ["Highlight production", "高亮生产", "생산 강조"],
  "world.op.faction": ["Highlight faction", "高亮阵营", "진영 강조"],
  "world.op.literal": ["Specific targets", "指定目标", "특정 대상"],
  "world.op.objectiveParam": ["Objective parameter", "目标参数", "목표 매개변수"],
  "world.op.kills": ["Kills", "击杀数", "격파 수"],
  "world.op.nearFaction": ["Near faction", "靠近阵营", "인근 진영"],
  "world.op.owned": ["Owned units", "己方单位", "보유 유닛"],
  "world.op.selected": ["Selected units", "已选单位", "선택한 유닛"],
  "world.op.planned": ["Built or planned", "已建造或规划", "건설 또는 계획됨"],
  "world.mp.connect": ["Choose a server you host or start a local server to host this world.", "选择你管理的服务器，或启动本地服务器来主持此世界。", "관리하는 서버를 선택하거나 로컬 서버를 시작해 이 월드를 호스팅하세요."],
  "world.mp.unsupported": ["This server needs a version that supports World Editor games.", "此服务器需要支持世界编辑器游戏的版本。", "이 서버에는 월드 에디터 게임을 지원하는 버전이 필요합니다."],
  "world.mp.rules": ["Rules and factions come from the authored scenario.", "规则与阵营由场景定义。", "규칙과 진영은 제작된 시나리오에 따릅니다."],
  "world.mp.verified": ["Every player verifies the same world and embedded mods before starting.", "开始前，每位玩家都会验证相同的世界及内嵌模组。", "시작 전에 모든 플레이어가 동일한 월드와 포함된 모드를 검증합니다."],
  // World Editor authoring tools.
  "world.title": ["World Editor", "世界编辑器", "월드 편집기"],
  "world.manual": ["Editor Manual", "编辑器手册", "에디터 매뉴얼"],
  "world.create": ["Create a world", "创造世界", "세계 만들기"],
  "world.welcome": ["Paint a map, build a campaign, or invent a game with objectives, triggers and custom units.", "绘制地图、编写战役，或用目标、触发器和自定义单位创造新玩法。", "지도를 그리고 캠페인을 만들거나 목표, 트리거, 맞춤 유닛으로 새 게임을 만드세요."],
  "world.open": ["Open world", "打开世界", "월드 열기"],
  "world.worlds": ["Your worlds", "我的世界", "내 월드"],
  "world.noWorlds": ["Your saved maps and worlds appear here.", "保存的地图和世界会显示在这里。", "저장한 지도와 월드가 여기에 표시됩니다."],
  "world.counts": ["{0} maps · {1} scenarios · {2} mods", "{0} 张地图 · {1} 个场景 · {2} 个模组", "지도 {0}개 · 시나리오 {1}개 · 모드 {2}개"],
  "world.name": ["World name", "世界名称", "월드 이름"],
  "world.newMap": ["New map", "新建地图", "새 지도"],
  "world.newScenario": ["New scenario", "新建场景", "새 시나리오"],
  "world.newCampaign": ["New campaign", "新建战役", "새 캠페인"],
  "world.newMod": ["New mod", "新建模组", "새 모드"],
  "world.export": ["Export world", "导出世界", "월드 내보내기"],
  "world.run": ["Test scenario", "测试场景", "시나리오 테스트"],
  "world.redo": ["Redo", "重做", "다시 실행"],
  "world.saved": ["All changes saved", "更改已保存", "변경 사항 저장됨"],
  "world.unsaved": ["Saving…", "正在保存…", "저장 중…"],
  "world.storageFailed": ["Storage unavailable. Export your world to keep a copy.", "无法保存到设备。请导出世界保留副本。", "저장소를 사용할 수 없습니다. 월드를 내보내 사본을 보관하세요."],
  "world.untitledWorld": ["Untitled world", "未命名世界", "새 월드"],
  "world.untitledMap": ["Untitled map", "未命名地图", "새 지도"],
  "world.untitledScenario": ["Untitled scenario", "未命名场景", "새 시나리오"],
  "world.untitledCampaign": ["Untitled campaign", "未命名战役", "새 캠페인"],
  "world.untitledMod": ["Untitled mod", "未命名模组", "새 모드"],
  "world.untitledObject": ["Custom unit", "自定义单位", "맞춤 유닛"],
  "world.untitledTrigger": ["New trigger", "新触发器", "새 트리거"],
  "world.scenarios": ["Scenarios", "场景", "시나리오"],
  "world.maps": ["Maps", "地图", "지도"],
  "world.tools": ["Authoring tools", "创作工具", "제작 도구"],
  "world.overview": ["Scenario", "场景设置", "시나리오"],
  "world.forces": ["Forces", "兵力", "병력"],
  "world.regions": ["Regions", "区域", "영역"],
  "world.routes": ["Routes", "路线", "경로"],
  "world.triggers": ["Triggers", "触发器", "트리거"],
  "world.objectives": ["Objectives", "任务目标", "목표"],
  "world.guide": ["Guide", "教学引导", "안내"],
  "world.campaigns": ["Campaign", "战役", "캠페인"],
  "world.objects": ["Objects", "对象与模组", "오브젝트"],
  "world.texts": ["Text & translations", "文字与翻译", "텍스트 및 번역"],
  "world.assets": ["Assets & dependencies", "素材与依赖", "에셋 및 의존성"],
  "world.settings": ["World settings", "世界设置", "월드 설정"],
  "world.validate": ["Validate", "检查世界", "검증"],
  "world.valid": ["The world is ready to test and export.", "世界可供测试和导出。", "월드를 테스트하고 내보낼 수 있습니다."],
  "world.paint": ["Edit terrain", "编辑地形", "지형 편집"],
  "world.exportMap": ["Export map", "导出地图", "지도 내보내기"],
  "world.mapOnly": ["This map works on its own. Add scenario behaviour whenever you need objectives or custom rules.", "此地图可独立使用。需要目标或自定义规则时，可添加场景逻辑。", "이 지도는 독립적으로 사용할 수 있습니다. 목표나 맞춤 규칙이 필요하면 시나리오 동작을 추가하세요."],
  "world.addBehaviour": ["Add scenario behaviour", "添加场景逻辑", "시나리오 동작 추가"],
  "world.factions": ["Factions & match settings", "阵营与对局设置", "진영 및 게임 설정"],
  "world.briefing": ["Briefing", "任务简报", "브리핑"],
  "world.rosters": ["Construction & production", "建造与生产", "건설 및 생산"],
  "world.variables": ["Variables", "变量", "변수"],
  "world.actionGroups": ["Reusable action groups", "可复用动作组", "재사용 동작 그룹"],
  "world.counters": ["HUD counters", "界面计数器", "HUD 카운터"],
  "world.groups": ["Named groups", "命名编组", "이름 있는 그룹"],
  "world.add": ["Add", "添加", "추가"],
  "world.addField": ["Add property", "添加属性", "속성 추가"],
  "world.identifier": ["Identifier", "标识符", "식별자"],
  "world.search": ["Search", "搜索", "검색"],
  "world.empty": ["Add an item to begin.", "添加一个条目以开始编辑。", "항목을 추가하여 시작하세요."],
  "world.depth": ["This value exceeds the editor nesting limit.", "此数值超出编辑器嵌套层数限制。", "이 값은 편집기 중첩 제한을 초과합니다."],
  "world.expr": ["Expression", "表达式", "표현식"],
  "world.action": ["Action", "动作", "동작"],
  "world.event": ["Event", "事件", "이벤트"],
  "world.selectMove": ["Select / move", "选择 / 移动", "선택 / 이동"],
  "world.place": ["Place forces", "放置兵力", "병력 배치"],
  "world.spatial.forces": ["Click to select; drag to move. Switch to Place to add a unit. Coordinates below are world pixels.", "单击选择，拖动移动。切换为“放置兵力”添加单位。下方坐标为世界像素。", "클릭하여 선택하고 끌어서 이동하세요. 배치 모드로 유닛을 추가합니다. 아래 좌표는 월드 픽셀입니다."],
  "world.spatial.regions": ["Drag a rectangle on the map to create a region. Coordinates are tiles.", "在地图上拖出矩形以创建区域。坐标以格为单位。", "지도에서 사각형을 끌어 영역을 만드세요. 좌표는 타일 단위입니다."],
  "world.spatial.routes": ["Click the map to append points to the selected route. Coordinates are tiles.", "单击地图以向选中路线添加节点。坐标以格为单位。", "지도를 클릭하여 선택한 경로에 지점을 추가하세요. 좌표는 타일 단위입니다."],
  "world.copyName": ["{0} — copy", "{0} — 副本", "{0} — 사본"],
  "world.duplicateScenario": ["Duplicate scenario", "复制场景", "시나리오 복제"],
  "world.deleteScenario": ["Delete scenario", "删除场景", "시나리오 삭제"],
  "world.deleteMap": ["Delete map", "删除地图", "지도 삭제"],
  "world.deleteWorld": ["Delete world", "删除世界", "월드 삭제"],
  "world.deleteWorldBody": ["Delete “{0}” from this device?", "从此设备删除“{0}”？", "이 기기에서 “{0}”을(를) 삭제하시겠습니까?"],
  "world.referencesRemain": ["{0} campaign references use this scenario. Validation will show references that need updating.", "{0} 处战役引用使用此场景。检查世界将显示需要更新的引用。", "캠페인에서 이 시나리오를 {0}번 참조합니다. 검증으로 수정할 참조를 확인할 수 있습니다."],
  "world.importMod": ["Import mod", "导入模组", "모드 가져오기"],
  "world.noMod": ["Create a mod or import an existing mod to edit its objects.", "新建模组或导入已有模组以编辑对象。", "모드를 만들거나 기존 모드를 가져와 오브젝트를 편집하세요."],
  "world.modHint": ["Create variants from existing units. Objects use the same format as installed mods; inherited values remain available below.", "从现有单位创建变体。对象使用与已安装模组相同的格式，下方可查看继承的属性。", "기존 유닛으로 변형을 만드세요. 설치한 모드와 같은 형식을 사용하며 상속한 값은 아래에서 확인할 수 있습니다."],
  "world.cloneObject": ["Create unit variant", "创建单位变体", "유닛 변형 만들기"],
  "world.cloneHint": ["Choose a source unit. Its original definition stays intact; the new ID belongs to this mod.", "选择源单位。原始定义保持不变，新标识符归属此模组。", "원본 유닛을 선택하세요. 새 ID는 이 모드에 속하며 원본 정의는 유지됩니다."],
  "world.exportMod": ["Export mod", "导出模组", "모드 내보내기"],
  "world.installMod": ["Install mod", "安装模组", "모드 설치"],
  "world.forkMod": ["Fork mod", "创建模组分支", "모드 사본 만들기"],
  "world.inherited": ["Inherited values", "继承属性", "상속한 값"],
  "world.replaceReferences": ["Replace placements & waves", "替换预置兵力与波次", "배치 및 웨이브 교체"],
  "world.replaceCount": ["{0} references use “{1}”. Choose the replacement definition ID.", "{0} 处引用使用“{1}”。输入替代的定义标识符。", "“{1}”을(를) {0}번 참조합니다. 교체할 정의 ID를 선택하세요."],
  "world.replace": ["Replace", "替换", "교체"],
  "world.modMetadata": ["Mod details", "模组信息", "모드 세부 정보"],
  "world.modInstalled": ["Mod installed.", "模组已安装。", "모드가 설치되었습니다."],
  "world.modInstallFailed": ["The mod could not be installed. Check its validation report.", "无法安装模组，请检查验证报告。", "모드를 설치하지 못했습니다. 검증 보고서를 확인하세요."],
  "world.textKey": ["Text identifier", "文字标识符", "텍스트 식별자"],
  "world.addAsset": ["Import image or audio", "导入图像或音频", "이미지 또는 오디오 가져오기"],
  "world.assetTooLarge": ["Each asset must be smaller than 8 MB.", "单个素材不得超过 8 MB。", "각 에셋은 8MB보다 작아야 합니다."],
  "world.addToMod": ["Copy into mod", "复制到模组", "모드로 복사"],
  "world.dependencies": ["Required mods", "依赖模组", "필요한 모드"],
  "world.embedInstalled": ["Embed an installed mod", "嵌入已安装模组", "설치한 모드 포함"],
  "world.noInstalled": ["There are no installed mods to embed.", "没有可嵌入的已安装模组。", "포함할 설치된 모드가 없습니다."],
  "world.triggerTemplate": ["Add trigger from template", "从模板添加触发器", "템플릿에서 트리거 추가"],
  "world.template.timedWave": ["Repeating attack wave", "重复进攻波次", "반복 공격 웨이브"],
  "world.template.eliminate": ["Win when enemies are eliminated", "敌军全灭时获胜", "적 전멸 시 승리"],
  "world.template.survive": ["Survive a duration", "生存指定时间", "일정 시간 생존"],
  "world.template.income": ["Income on enemy destruction", "摧毁敌人时获得收入", "적 파괴 시 수입"],
  "world.template.escape": ["Lose lives at an exit", "敌人逃离时扣除生命", "출구 도달 시 생명 차감"],
  "world.noScenario": ["Create a map or scenario to test.", "先创建地图或场景，再进行测试。", "테스트할 지도나 시나리오를 만드세요."],
  "world.invalidJson": ["This file is not valid JSON.", "此文件不是有效的 JSON。", "올바른 JSON 파일이 아닙니다."],
  "world.invalidFile": ["Choose a Steel Tide world, map or mod file.", "请选择钢铁浪潮世界、地图或模组文件。", "스틸 타이드 월드, 지도 또는 모드 파일을 선택하세요."],
  "world.importFailed": ["Import failed", "导入失败", "가져오기 실패"],
  "world.fileTooLarge": ["This world exceeds its package size limit.", "此世界超出其文件包大小限制。", "월드가 해당 패키지 크기 제한을 초과합니다."],
  "world.op.start": ["Scenario start", "场景开始", "시나리오 시작"],
  "world.op.tick": ["Simulation tick", "模拟更新", "시뮬레이션 틱"],
  "world.op.time": ["Elapsed time", "经过时间", "경과 시간"],
  "world.op.destroyed": ["Entity destroyed", "实体被摧毁", "개체 파괴"],
  "world.op.created": ["Entity created", "实体被创建", "개체 생성"],
  "world.op.completed": ["Construction completed", "建造完成", "건설 완료"],
  "world.op.removed": ["Entity removed", "实体被移除", "개체 제거"],
  "world.op.escaped": ["Entity escaped", "实体逃离", "개체 탈출"],
  "world.op.enter": ["Enter region", "进入区域", "영역 진입"],
  "world.op.leave": ["Leave region", "离开区域", "영역 이탈"],
  "world.op.objective": ["Objective state", "目标状态", "목표 상태"],
  "world.op.projectile": ["Projectile outcome", "弹体结果", "발사체 결과"],
  "world.op.set": ["Set variable", "设置变量", "변수 설정"],
  "world.op.add": ["Add", "相加", "더하기"],
  "world.op.if": ["If / else", "如果 / 否则", "조건 분기"],
  "world.op.each": ["For each entity", "逐个实体执行", "각 개체에 실행"],
  "world.op.call": ["Run action group", "执行动作组", "동작 그룹 실행"],
  "world.op.delay": ["Delay actions", "延迟执行", "동작 지연"],
  "world.op.trigger": ["Enable / disable trigger", "启用 / 禁用触发器", "트리거 활성화"],
  "world.op.spawn": ["Spawn placed forces", "生成预置兵力", "배치 병력 생성"],
  "world.op.wave": ["Spawn wave", "生成波次", "웨이브 생성"],
  "world.op.group": ["Set group", "设置编组", "그룹 설정"],
  "world.op.remove": ["Remove entities", "移除实体", "개체 제거"],
  "world.op.damage": ["Deal damage", "造成伤害", "피해 입히기"],
  "world.op.order": ["Issue order", "下达命令", "명령 내리기"],
  "world.op.entity": ["Entity property", "实体属性", "개체 속성"],
  "world.op.metal": ["Change metal", "改变金属", "금속 변경"],
  "world.op.research": ["Grant research", "授予科技", "연구 부여"],
  "world.op.dress": ["Faction appearance", "阵营外观", "진영 외형"],
  "world.op.announce": ["Announcement", "通知", "알림"],
  "world.op.ping": ["Map ping", "地图标记", "지도 표시"],
  "world.op.sound": ["Play sound", "播放声音", "소리 재생"],
  "world.op.launch": ["Launch projectile", "发射弹体", "발사체 발사"],
  "world.op.result": ["End scenario", "结束场景", "시나리오 종료"],
  "world.op.number": ["Number", "数字", "숫자"],
  "world.op.boolean": ["True / false", "真 / 假", "참 / 거짓"],
  "world.op.string": ["Text", "文本", "텍스트"],
  "world.op.var": ["Variable", "变量", "변수"],
  "world.op.count": ["Entity count", "实体数量", "개체 수"],
  "world.op.stat": ["Faction statistic", "阵营统计", "진영 통계"],
  "world.op.canRebuild": ["Can rebuild", "可重建", "재건 가능"],
  "world.op.groupOutcome": ["Group outcome", "编组结果", "그룹 결과"],
  "world.op.random": ["Random entity", "随机实体", "무작위 개체"],
  "world.op.sub": ["Subtract", "相减", "빼기"],
  "world.op.mul": ["Multiply", "相乘", "곱하기"],
  "world.op.div": ["Divide", "相除", "나누기"],
  "world.op.mod": ["Remainder", "取余", "나머지"],
  "world.op.min": ["Minimum", "最小值", "최솟값"],
  "world.op.max": ["Maximum", "最大值", "최댓값"],
  "world.op.floor": ["Round down", "向下取整", "내림"],
  "world.op.ceil": ["Round up", "向上取整", "올림"],
  "world.op.eq": ["Equal", "等于", "같음"],
  "world.op.ne": ["Not equal", "不等于", "같지 않음"],
  "world.op.lt": ["Less than", "小于", "보다 작음"],
  "world.op.lte": ["Less than or equal", "小于等于", "이하"],
  "world.op.gt": ["Greater than", "大于", "보다 큼"],
  "world.op.gte": ["Greater than or equal", "大于等于", "이상"],
  "world.op.all": ["All conditions", "所有条件", "모든 조건"],
  "world.op.any": ["Any condition", "任一条件", "하나 이상의 조건"],
  "world.op.not": ["Not", "取反", "부정"],
  "world.op.scripted": ["Scripted results", "触发器判定结果", "트리거로 결과 결정"],
  "world.op.conquest": ["Conquest results", "征服判定结果", "정복 규칙으로 결과 결정"],
  "world.op.unit": ["Unit", "单位", "유닛"],
  "world.op.building": ["Building", "建筑", "건물"],
  "world.op.move": ["Move", "移动", "이동"],
  "world.op.attackMove": ["Attack move", "攻击移动", "공격 이동"],
  "world.op.stop": ["Stop", "停止", "정지"],
  "world.op.hold": ["Hold", "坚守", "위치 사수"],
  "world.op.clear": ["Clear", "晴朗", "맑음"],
  "world.op.rain": ["Rain", "雨", "비"],
  "world.op.storm": ["Storm", "风暴", "폭풍"],
  "world.op.snow": ["Snow", "雪", "눈"],
  "world.op.sandstorm": ["Sandstorm", "沙尘暴", "모래 폭풍"],
  "world.op.easy": ["Easy", "简单", "쉬움"],
  "world.op.standard": ["Standard", "标准", "표준"],
  "world.op.veteran": ["Veteran", "老兵", "베테랑"],
  "world.op.show": ["Show", "显示", "표시"],
  "world.op.complete": ["Complete", "完成", "완료"],
  "world.op.update": ["Update", "更新", "업데이트"],
  "world.field.id": ["Identifier", "标识符", "식별자"],
  "world.field.name": ["Name", "名称", "이름"],
  "world.field.description": ["Description", "描述", "설명"],
  "world.field.version": ["Version", "版本", "버전"],
  "world.field.author": ["Author", "作者", "작성자"],
  "world.field.license": ["License", "许可证", "라이선스"],
  "world.field.map": ["Map", "地图", "지도"],
  "world.field.defId": ["Unit definition", "单位定义", "유닛 정의"],
  "world.field.owner": ["Faction index", "阵营序号", "진영 번호"],
  "world.field.x": ["X", "X", "X"],
  "world.field.y": ["Y", "Y", "Y"],
  "world.field.w": ["Width", "宽度", "너비"],
  "world.field.h": ["Height", "高度", "높이"],
  "world.field.angle": ["Facing (radians)", "朝向（弧度）", "방향 (라디안)"],
  "world.field.hp": ["Hit points", "生命值", "체력"],
  "world.field.cost": ["Metal cost", "金属造价", "금속 비용"],
  "world.field.speed": ["Speed", "速度", "속도"],
  "world.field.armor": ["Armour", "装甲", "장갑"],
  "world.field.impactMaterial": ["Impact sound material", "命中音效材质", "피격음 재질"],
  "world.field.directionalArmor": ["Directional armor", "方向装甲", "방향별 장갑"],
  "world.field.buildTime": ["Build time", "建造时间", "생산 시간"],
  "world.field.vision": ["Vision", "视野", "시야"],
  "world.field.locked": ["Cannot receive commands", "禁止接受命令", "명령 수신 금지"],
  "world.field.holdPos": ["Hold position", "坚守位置", "위치 사수"],
  "world.field.holdFire": ["Hold fire", "停火", "사격 중지"],
  "world.field.aggressive": ["Aggressive", "主动攻击", "공격적"],
  "world.field.xp": ["Experience", "经验", "경험치"],
  "world.field.scriptedFire": ["Trigger-controlled weapons", "触发器控制武器", "트리거 제어 무기"],
  "world.field.orders": ["Starting orders", "初始命令", "시작 명령"],
  "world.field.order": ["Order", "命令", "명령"],
  "world.field.kind": ["Kind", "类别", "종류"],
  "world.field.points": ["Waypoints", "路径节点", "경로 지점"],
  "world.field.attack": ["Attack along route", "沿途攻击", "경로 중 공격"],
  "world.field.textKey": ["Text identifier", "文字标识符", "텍스트 식별자"],
  "world.field.params": ["Text parameters", "文字参数", "텍스트 매개변수"],
  "world.field.team": ["Team", "队伍", "팀"],
  "world.field.visible": ["Initially visible", "初始可见", "처음부터 표시"],
  "world.field.event": ["Event", "事件", "이벤트"],
  "world.field.condition": ["Condition", "条件", "조건"],
  "world.field.actions": ["Actions", "动作", "동작"],
  "world.field.enabled": ["Enabled", "启用", "활성화"],
  "world.field.once": ["Run once", "仅执行一次", "한 번 실행"],
  "world.field.maxRuns": ["Maximum executions", "最多执行次数", "최대 실행 횟수"],
  "world.field.seed": ["Random seed", "随机种子", "무작위 시드"],
  "world.field.fog": ["Fog of war", "战争迷雾", "전장의 안개"],
  "world.field.weather": ["Weather", "天气", "날씨"],
  "world.field.dayNight": ["Day / night cycle", "昼夜循环", "낮과 밤 주기"],
  "world.field.hour": ["Hour", "时间", "시각"],
  "world.field.popCap": ["Population cap", "人口上限", "인구 제한"],
  "world.field.startMetal": ["Starting metal", "初始金属", "시작 금속"],
  "world.field.productionSlotsPerHQ": ["Production lines per HQ", "每座总部生产线", "본부당 생산 라인"],
  "world.field.tech": ["Technology tree", "科技树", "기술 트리"],
  "world.field.buildRadius": ["Require HQ territory", "需要总部领地", "본부 영역 필요"],
  "world.field.players": ["Factions", "阵营", "진영"],
  "world.field.isHuman": ["Playable faction", "玩家可用阵营", "플레이 가능 진영"],
  "world.field.difficulty": ["AI difficulty", "电脑难度", "AI 난이도"],
  "world.field.spawn": ["Spawn index", "出生点序号", "시작 지점 번호"],
  "world.field.scripted": ["Trigger-controlled faction", "触发器控制阵营", "트리거 제어 진영"],
  "world.field.titleKey": ["Title text", "标题文字", "제목 텍스트"],
  "world.field.bodyKey": ["Briefing text", "简报文字", "브리핑 텍스트"],
  "world.field.dateKey": ["Date text", "日期文字", "날짜 텍스트"],
  "world.field.locationKey": ["Location text", "地点文字", "위치 텍스트"],
  "world.field.image": ["Cover image", "封面图像", "표지 이미지"],
  "world.field.voice": ["Narration", "旁白", "해설"],
  "world.field.paragraphs": ["Paragraphs", "段落", "문단"],
  "world.field.selection": ["Required selection", "所需选择", "필요한 선택"],
  "world.field.placement": ["Placement selection", "放置选择", "배치 선택"],
  "world.field.highlight": ["Highlighted control", "高亮控件", "강조할 컨트롤"],
  "world.field.panel": ["Panel", "面板", "패널"],
  "world.field.resultPolicy": ["Victory policy", "胜负规则", "승리 규칙"],
  "world.field.mapUnits": ["Include map forces", "包括地图兵力", "지도 병력 포함"],
  "world.field.defaultBases": ["Place default bases", "放置默认基地", "기본 기지 배치"],
  "world.field.roster": ["Available definitions", "可用单位定义", "사용 가능한 정의"],
  "world.field.buildRegions": ["Construction regions", "允许建造区域", "건설 가능 영역"],
  "world.field.variable": ["Variable", "变量", "변수"],
  "world.field.value": ["Value", "值", "값"],
  "world.field.then": ["Then", "成立时", "참일 때"],
  "world.field.else": ["Else", "不成立时", "거짓일 때"],
  "world.field.query": ["Entity query", "实体查询", "개체 검색"],
  "world.field.limit": ["Iteration limit", "迭代上限", "반복 제한"],
  "world.field.args": ["Arguments", "参数", "인수"],
  "world.field.seconds": ["Seconds", "秒数", "초"],
  "world.field.instances": ["Instances", "预置实体", "배치 개체"],
  "world.field.group": ["Group", "编组", "그룹"],
  "world.field.units": ["Wave units", "波次单位", "웨이브 유닛"],
  "world.field.targetX": ["Target X", "目标 X", "목표 X"],
  "world.field.targetY": ["Target Y", "目标 Y", "목표 Y"],
  "world.field.replaceGroup": ["Replace group members", "替换组内成员", "그룹 구성원 교체"],
  "world.field.route": ["Route", "路线", "경로"],
  "world.field.append": ["Append to group", "追加到编组", "그룹에 추가"],
  "world.field.reason": ["Removal reason", "移除原因", "제거 이유"],
  "world.field.amount": ["Amount", "数量", "수량"],
  "world.field.property": ["Property", "属性", "속성"],
  "world.field.ids": ["Definition IDs", "定义标识符", "정의 ID"],
  "world.field.skins": ["Skins", "涂装", "스킨"],
  "world.field.decals": ["Decals", "贴花", "데칼"],
  "world.field.state": ["State", "状态", "상태"],
  "world.field.color": ["Colour", "颜色", "색상"],
  "world.field.marker": ["Area marker", "区域标记", "구역 표시"],
  "world.field.sound": ["Sound", "声音", "소리"],
  "world.field.from": ["From", "来源", "출발"],
  "world.field.target": ["Target", "目标", "목표"],
  "world.field.weapon": ["Weapon", "武器", "무기"],
  "world.field.damage": ["Damage", "伤害", "피해"],
  "world.field.win": ["Victory", "胜利", "승리"],
  "world.field.winnerTeam": ["Winning team", "获胜队伍", "승리 팀"],
  "world.field.instance": ["Named instance", "命名实体", "이름 있는 개체"],
  "world.field.prefix": ["Definition prefix", "定义前缀", "정의 접두사"],
  "world.field.domain": ["Movement domain", "移动域", "이동 영역"],
  "world.field.yard": ["Production domain", "生产域", "생산 영역"],
  "world.field.armed": ["Armed", "有武装", "무장"],
  "world.field.hq": ["Headquarters", "总部", "본부"],
  "world.field.notMine": ["Exclude extractors", "排除采矿场", "채굴기 제외"],
  "world.field.outside": ["Outside region", "区域外", "영역 밖"],
  "world.field.region": ["Region", "区域", "영역"],
  "world.field.alive": ["Alive", "存活", "생존"],
  "world.field.at": ["Time (seconds)", "时间（秒）", "시간 (초)"],
  "world.field.every": ["Repeat interval", "重复间隔", "반복 간격"],
  "world.field.fate": ["Projectile outcome", "弹体结果", "발사체 결과"],
  "world.field.var": ["Variable", "变量", "변수"],
  "world.field.stat": ["Statistic", "统计", "통계"],
  "world.field.field": ["Statistic field", "统计项", "통계 항목"],
  "world.field.projectile": ["Projectile handle", "弹体标识", "발사체 핸들"],
  "world.field.outcome": ["Outcome", "结果", "결과"],
  "world.field.op": ["Operator", "运算符", "연산자"],
  "world.field.scenarios": ["Mission sequence", "任务顺序", "임무 순서"],
  "world.field.branches": ["Branches", "分支", "분기"],
  "world.field.to": ["Next mission", "下一任务", "다음 임무"],
  "world.field.equals": ["Required value", "所需值", "필요한 값"],
  "world.field.extends": ["Inherit from", "继承自", "상속 원본"],
  "world.field.desc": ["Description", "描述", "설명"],
  "world.field.weapons": ["Weapons", "武器", "무기"],
  "world.field.rules": ["Behaviours", "行为", "동작 규칙"],
  "world.field.sprites": ["Sprite sheets", "精灵图", "스프라이트 시트"],
  "world.field.menuBackground": ["Menu background", "菜单背景", "메뉴 배경"],
  "world.field.cuts": ["Background cuts", "背景镜头", "배경 장면"],
  "world.field.queue": ["Playback queue", "播放队列", "재생 목록"],
  "world.field.camera": ["Opening camera", "初始镜头", "시작 카메라"],
  "world.field.cameraEnd": ["Ending camera", "结束镜头", "종료 카메라"],
  "world.field.minutes": ["Day-cycle time", "昼夜时刻", "일주기 시간"],
  "world.field.zoom": ["Camera zoom", "镜头缩放", "카메라 확대"],
  "world.field.tx": ["Tile X", "横向格坐标", "타일 X"],
  "world.field.ty": ["Tile Y", "纵向格坐标", "타일 Y"],
  "world.field.music": ["Background music", "背景音乐", "배경 음악"],
  "world.field.tracks": ["Music tracks", "音乐曲目", "음악 트랙"],
  "world.field.menu": ["Menu queue", "菜单播放队列", "메뉴 재생 목록"],
  "world.field.setup": ["Match setup queue", "对局设置播放队列", "전투 설정 재생 목록"],
  "world.field.battle": ["Battle queue", "战斗播放队列", "전투 재생 목록"],
  "world.field.sounds": ["Audio files", "音频文件", "오디오 파일"],
  "world.field.builtBy": ["Builders", "建造单位", "건설 유닛"],
  "world.field.producedBy": ["Production buildings", "生产建筑", "생산 건물"],
  "world.field.produces": ["Production roster", "可生产单位", "생산 목록"],
  "world.field.builds": ["Construction roster", "可建造建筑", "건설 목록"],
  "world.field.upgradeOf": ["Upgrade from", "升级来源", "업그레이드 원본"],
  "world.field.hash": ["Content identity", "内容标识", "콘텐츠 식별값"],
  "world.field.homepage": ["Homepage", "主页", "홈페이지"],
  "world.field.minGame": ["Minimum game version", "最低游戏版本", "최소 게임 버전"],
  "world.library.title": ["Custom games", "自定义游戏", "사용자 게임"],
  "world.library.import": ["Import", "导入", "가져오기"],
  "world.library.create": ["World Editor", "世界编辑器", "월드 에디터"],
  "world.library.tab.browse": ["Browse", "浏览", "둘러보기"],
  "world.library.tab.favorite": ["Favorite", "收藏", "즐겨찾기"],
  "world.library.tab.my": ["My", "我的", "내 월드"],
  "world.library.favorite": ["Favorite", "收藏", "즐겨찾기"],
  "world.library.unfavorite": ["Favorited", "已收藏", "즐겨찾기 등록됨"],
  "world.library.favoritesEmpty": ["Favorite a world to find it here.", "收藏的世界会显示在这里。", "즐겨찾기에 추가한 월드가 여기에 표시됩니다."],
  "world.library.favoriteFailed": ["Could not save favorites on this device.", "无法在此设备上保存收藏。", "이 기기에 즐겨찾기를 저장하지 못했습니다."],
  "world.library.installToPlay": ["Install this world to explore its scenarios.", "安装此世界以查看和游玩其中的场景。", "월드를 설치하여 시나리오를 살펴보세요."],
  "world.library.scenariosRequired": ["Choose a world file with playable scenarios. Maps can be imported in the World Editor.", "请选择包含可玩场景的世界文件。地图可在世界编辑器中导入。", "플레이할 시나리오가 있는 월드 파일을 선택하세요. 지도는 월드 에디터에서 가져올 수 있습니다."],
  "world.cover.title": ["World cover", "世界封面", "월드 표지"],
  "world.cover.upload": ["Upload cover", "上传封面", "표지 업로드"],
  "world.cover.placeholder": ["Default cover", "默认封面", "기본 표지"],
  "world.cover.hint": ["Choose an image for this world. PNG, JPEG, WebP or GIF, up to 8 MB.", "为此世界选择图片。支持 PNG、JPEG、WebP 或 GIF，最大 8 MB。", "월드에 사용할 이미지를 선택하세요. PNG, JPEG, WebP, GIF 형식, 최대 8 MB."],
  "world.cover.invalid": ["Choose a PNG, JPEG, WebP or GIF image.", "请选择 PNG、JPEG、WebP 或 GIF 图片。", "PNG, JPEG, WebP 또는 GIF 이미지를 선택하세요."],
  "world.library.installed": ["Your worlds", "你的世界", "내 월드"],
  "world.library.details": ["World details", "世界详情", "월드 정보"],
  "world.library.scenarioCount": ["{0} scenarios", "{0} 个场景", "시나리오 {0}개"],
  "world.library.empty": ["Import a world or create your own.", "导入世界或创建你自己的世界。", "월드를 가져오거나 직접 만드세요."],
  "world.library.edit": ["Edit a copy", "编辑副本", "복사본 편집"],
  "world.library.export": ["Export", "导出", "내보내기"],
  "world.library.mapOnly": ["This world contains maps. Open the editor to create a playable scenario.", "此世界包含地图。打开编辑器创建可玩的场景。", "이 월드에는 지도가 있습니다. 에디터에서 플레이할 시나리오를 만드세요."],
  "world.library.progress": ["{0} / {1} completed", "已完成 {0} / {1}", "{0} / {1} 완료"],
  "world.library.campaign": ["Continue campaign", "继续战役", "캠페인 계속"],
  "world.library.play": ["Play", "开始游戏", "플레이"],
  "world.library.invalid": ["This world needs corrections before it can be played.", "此世界需要修正后才能游玩。", "플레이하기 전에 이 월드를 수정해야 합니다."],
  "world.library.tooLarge": ["This world exceeds its package size limit.", "此世界超出其文件包大小限制。", "월드가 해당 패키지 크기 제한을 초과합니다."],
  "world.library.storageFailed": ["Could not save this world on this device. Export a copy to keep it.", "无法在此设备上保存世界。请导出副本以保留。", "이 기기에 월드를 저장하지 못했습니다. 사본을 내보내 보관하세요."],
  "world.library.desc": ["Play community campaigns and custom modes, or make your own.", "游玩社区战役和自定义模式，或亲手制作。", "커뮤니티 캠페인과 사용자 모드를 플레이하거나 직접 만드세요."],
  "world.community.browse": ["Discover worlds", "发现世界", "월드 찾아보기"],
  "world.community.loading": ["Loading worlds…", "正在加载世界…", "월드 불러오는 중…"],
  "world.community.empty": ["No worlds are available yet.", "暂无可用的世界。", "아직 이용 가능한 월드가 없습니다."],
  "world.community.install": ["Install", "安装", "설치"],
  "world.community.failed": ["Could not load the world catalog.", "无法加载世界目录。", "월드 목록을 불러오지 못했습니다."],
  "world.host.title": ["Host", "创建房间", "호스트"],
  "world.test.stop": ["Stop test", "停止测试", "테스트 종료"],
  "world.test.pause": ["Pause", "暂停", "일시정지"],
  "world.test.step": ["Step", "单步", "한 틱 진행"],
  "world.publish.title": ["Publish world", "发布世界", "월드 게시"],
  "world.publish.author": ["Author", "作者", "제작자"],
  "world.publish.email": ["Contact email", "联系邮箱", "연락 이메일"],
  "world.publish.license": ["License", "许可证", "라이선스"],
  "world.publish.description": ["Description", "介绍", "설명"],
  "world.publish.explain": ["Submit this package for community review. Your contact email is kept out of the public package.", "提交此包以供社区审核。联系邮箱不会出现在公开包中。", "이 패키지를 커뮤니티 검토에 제출합니다. 연락 이메일은 공개 패키지에 포함되지 않습니다."],
  "world.publish.submit": ["Submit for review", "提交审核", "검토 요청"],
  "world.publish.review": ["View submission", "查看提交", "제출 보기"],
  "world.publish.local": ["Local development review only. Nothing will be sent to GitHub.", "仅在本地开发环境审核。不会发送到 GitHub。", "로컬 개발 검토입니다. GitHub로 전송되지 않습니다."],
  // ------------------------------------------------------------- app
  "app.title": ["Steel Tide", "钢铁浪潮", "스틸 타이드"],
  "app.gameTitle": ["{0} | {1} Players | Steel Tide", "{0} | {1} 名玩家 | 钢铁浪潮", "{0} | 플레이어 {1}명 | 스틸 타이드"],
  "app.pageTitle": ["{0} | Steel Tide", "{0} | 钢铁浪潮", "{0} | 스틸 타이드"],
  "boot.systems": ["Preparing command systems…", "正在准备指挥系统…", "지휘 시스템 준비 중…"],
  "boot.art": ["Generating unit artwork…", "正在生成单位图像…", "유닛 아트워크 생성 중…"],
  "boot.terrain": ["Building terrain textures…", "正在构建地形纹理…", "지형 텍스처 구성 중…"],
  "boot.sprites": ["Loading unit sprites…", "正在加载单位图像…", "유닛 스프라이트 불러오는 중…"],
  "boot.mods": ["Loading mods…", "正在加载模组…", "모드 불러오는 중…"],
  "boot.interface": ["Fitting interface panels…", "正在装载界面面板…", "인터페이스 패널 장착 중…"],
  "boot.ready": ["Opening command center…", "正在开启指挥中心…", "지휘 본부 여는 중…"],
  // the single-line author credit before the loading screen
  "boot.gameBy": ["A game by {0}", "由 {0} 呈现", "{0}이 선보입니다"],
  // the loading screen's prompt once everything is in, by the way the player answers it
  "boot.pressAnyKey": ["Press any key to continue", "按任意键继续", "아무 키나 눌러 계속"],
  "boot.tapToContinue": ["Tap to continue", "点击继续", "탭하여 계속"],
  // Inlined into index.html: the compatibility notice must work even when
  // the device cannot parse the game bundle or load its translations.
  "boot.unsupported.browser.title": ["Unsupported browser", "浏览器版本过低", "지원되지 않는 브라우저"],
  "boot.unsupported.browser.body": [
    "Steel Tide needs a newer browser than this one. Please update to the latest Chrome, Edge, Firefox, or Safari and reload.",
    "钢铁浪潮需要较新的浏览器才能运行。请升级到最新版本的 Chrome、Edge、Firefox 或 Safari 后重新加载。",
    "스틸 타이드는 더 새로운 브라우저가 필요합니다. 최신 Chrome, Edge, Firefox 또는 Safari로 업데이트한 뒤 다시 불러오세요."
  ],
  "boot.unsupported.app.title": ["Unsupported device", "设备暂不支持", "지원되지 않는 기기"],
  "boot.unsupported.app.body": [
    "Steel Tide cannot run on this device with its current software. Please install the latest app and system updates. On Android, also update Android System WebView, then reopen the game.",
    "此设备当前的软件版本无法运行钢铁浪潮。请将应用和系统更新至最新版本。Android 设备还需更新 Android System WebView，然后重新打开游戏。",
    "이 기기의 현재 소프트웨어로는 스틸 타이드를 실행할 수 없습니다. 앱과 시스템을 최신 버전으로 업데이트하세요. Android에서는 Android System WebView도 업데이트한 뒤 게임을 다시 여세요."
  ],
  "boot.tipTitle": ["Did you know?", "你知道吗？", "알고 계셨나요?"],
  // ------------------------------------------------------------- boot tips
  // One of these is picked at random for the loading screen. They are read by
  // their `tip.` prefix (`showBootTip` in main.ts) rather than by name, so a
  // new fact is one line here and nothing else — and equally, a key scan for
  // `t('...')` will never find a call site for any of them.
  "tip.engine": [
    "The whole engine is hand-rolled. The game ships with zero runtime dependencies.",
    "整个引擎都是手写的，游戏没有任何运行时依赖。",
    "엔진 전체가 직접 만든 것입니다. 이 게임은 런타임 의존성이 하나도 없습니다."
  ],
  "tip.audio": [
    "Every sound effect has a synthesized twin. Pull the recordings and the game plays its chiptune self.",
    "每个音效都有一个合成的孪生版本：拿掉录音，游戏就用自己的芯片音色照常开打。",
    "모든 효과음에는 합성음 쌍둥이가 있습니다. 녹음 파일을 빼면 게임은 칩튠 사운드로 그대로 돌아갑니다."
  ],
  "tip.save": [
    "A save carries its own map, so improvements to the generator never shift an old battlefield.",
    "存档里包含了独立的地图信息，即使地图下架也可以继续游玩。",
    "저장 파일에는 지도가 통째로 들어 있어서, 생성기가 개선되어도 옛 전장은 그대로입니다."
  ],
  "tip.pwa": [
    "Steel Tide installs. Once the shell is cached it starts and plays a Conquest match with no network at all.",
    "钢铁浪潮可以装到桌面。游戏缓存之后，完全断网也能打一局征服对局。",
    "스틸 타이드는 설치할 수 있습니다. 한번 캐시되면 네트워크 없이도 실행되고 정복 대전을 할 수 있습니다."
  ],
  "tip.bot": [
    "A language model can take a seat. It plays through the same fog-filtered frames and the same orders you do.",
    "大语言模型也能参战：它和你一样只看得到被迷雾过滤的战场，也只能通过同一套指令下令。",
    "언어 모델도 한 자리를 맡을 수 있습니다. 당신과 똑같이 안개로 가려진 전장을 보고, 똑같은 명령으로 움직입니다."
  ],
  "tip.transport": [
    "Transports carry weight, not head count. A Mammoth takes four capacity; no helicopter will lift it.",
    "运输载具算的是重量，不是人头。猛犸占 4 点载重，直升机无法吊运。",
    "수송은 머릿수가 아니라 무게로 셉니다. 매머드는 4칸을 차지해서 헬기로는 들어 올릴 수 없습니다."
  ],
  "tip.cargoplane": [
    "The Condor parks. An idle cargo plane puts its wheels down instead of circling, and passengers walk to it.",
    "神鹰会停下来：闲着的运输机是把轮子放到地上，而不是在天上盘旋，乘员自己走过去登机。",
    "콘도르는 착륙합니다. 할 일 없는 수송기는 선회하는 대신 바퀴를 내리고, 탑승자가 걸어와 올라탑니다."
  ],
  "tip.intercept": [
    "The Missile Interrupter stops rockets, never shells, and never a nuclear warhead. That is a flying target: a veteran anti-air unit's job, or a SAM Site's.",
    "导弹拦截塔只拦火箭弹，从不拦炮弹，也不拦核弹头：核弹头是空中目标，归老兵级防空单位或防空导弹阵地管。",
    "미사일 요격탑은 로켓만 막고 포탄은 절대 막지 못하며, 핵탄두도 막지 못합니다. 핵탄두는 공중 표적으로, 베테랑 대공 유닛이나 대공 미사일 진지의 몫입니다."
  ],
  "tip.rockets": [
    "One rocket launcher never lands a rocket on a point-defended base. Two get through.",
    "一辆火箭炮永远打不穿有一座拦截器的基地，两辆就能。",
    "다연장 로켓포 한 대로는 요격 방어가 있는 기지에 로켓 한 발도 떨어뜨리지 못합니다. 두 대면 뚫립니다."
  ],
  "tip.terrain": [
    "Forest, mountains and every cliff face stop a ground vehicle. Aircraft ignore all three.",
    "森林、山地和所有崖面都挡住地面载具，飞机对这三样视若无睹。",
    "숲, 산지, 모든 절벽면은 지상 차량을 막습니다. 항공기는 셋 다 무시합니다."
  ],
  "tip.build": [
    "Grass, sand, snow and asphalt will hold a foundation. Mud, marsh and rubble are drivable, not buildable.",
    "草地、沙地、雪地和柏油路都能修建筑。泥地、沼泽和瓦砾能走，但不能建。",
    "풀밭, 모래, 눈, 아스팔트 위에는 건물을 지을 수 있습니다. 진흙, 습지, 잔해는 지나갈 수는 있지만 지을 수는 없습니다."
  ],
  "tip.startMetal": [
    "Work begins once you have 75% of the price in hand, and bills the rest as it goes.",
    "凑够所需金属的 75% 就能开工，剩下的边造边付。",
    "가격의 75%만 손에 있으면 공사가 시작되고, 나머지는 진행하면서 청구됩니다."
  ],
  "tip.slots": [
    "Units sent at the same target fan out along a firing ring instead of queueing behind whoever arrived first.",
    "攻击同一目标的部队会沿着射击环散开，而不是挤在先到者身后。",
    "같은 표적을 노리는 유닛들은 먼저 도착한 유닛 뒤에 줄을 서는 대신 사격 원을 따라 흩어집니다."
  ],
  "tip.wreck": [
    "Every wreck is sized to what died and lies on the heading it was facing. A flattened building collapses into its own ruin, and the burnt ground under it stays far longer.",
    "每具残骸的大小与死者相当，倒下的朝向就是它生前的朝向。被夷平的建筑会塌成自己的废墟，而它底下烧焦的土地会留存更久。",
    "모든 잔해는 죽은 것의 크기 그대로, 향하던 방향 그대로 남습니다. 무너진 건물은 자신의 폐허가 되고, 그 아래 그을린 땅은 훨씬 오래 남습니다."
  ],
  "tip.repair": [
    "A repair tower works on three damaged allies at once, worst hit first. Multiple towers repair a shared target faster.",
    "维修塔同时修三个受损友军，先修伤得最重的。多座塔同时维修同一个目标时，维修速度会叠加。",
    "수리탑은 손상된 아군 셋을 동시에, 가장 심하게 다친 쪽부터 수리합니다. 탑 여러 개가 같은 표적을 수리하면 더 빠릅니다."
  ],
  "tip.engineerRepair": [
    "An idle engineer repairs damaged buildings around it on its own, for metal. Hold position disables automatic repairs and retreating under fire. It cannot repair units.",
    "空闲的工程车会自动维修周围受损的建筑，并消耗金属。“原地驻守”会关闭自动维修和受攻击时的自动撤退。它无法维修单位。",
    "할 일 없는 공병차는 주변의 손상된 건물을 금속을 써서 스스로 수리합니다. 위치 사수는 자동 수리와 공격받을 때의 자동 후퇴를 끕니다. 유닛은 수리하지 못합니다."
  ],
  "tip.shift": [
    "Hold Shift to queue orders. On a touchscreen, a long press is an attack-move.",
    "按住 Shift 可以排队下令；在触屏上，长按就是攻击移动。",
    "Shift를 누른 채로 명령하면 명령이 대기열에 쌓입니다. 터치스크린에서는 길게 누르면 공격 이동입니다."
  ],
  "tip.route": [
    "Hold Ctrl (Cmd on a Mac) and right-click to lay a patrol: the unit walks the blue path for good, back and forth, or round and round if you close it on its first point.",
    "按住 Ctrl（Mac 上是 Cmd）右键点击可以铺设巡逻路线：单位会沿着这条蓝色路径往返巡逻；若终点回到起点，则绕圈巡逻。",
    "Ctrl(Mac에서는 Cmd)을 누른 채 오른쪽 클릭으로 순찰 경로를 놓습니다. 유닛은 파란 경로를 계속 오가며, 첫 지점에서 닫으면 빙빙 돕니다."
  ],
  "tip.console": [
    "The backquote key opens the admin console.",
    "按反引号键（`）打开管理员控制台。",
    "백쿼트(`) 키로 관리자 콘솔을 엽니다."
  ],
  "tip.spectate": [
    "Anyone in a lobby can sit in the stands instead of taking a seat, and watch the whole map.",
    "多人模式中，观战者可以看到整张地图。",
    "로비에 있는 누구나 자리를 맡는 대신 관중석에 앉아 지도 전체를 볼 수 있습니다."
  ],
  "mode.campaign": ["Campaign", "战役", "캠페인"],
  "mode.sandbox": ["Conquest", "征服", "정복"],
  "mode.breakthrough": ["Breakthrough", "突破", "돌파"],
  // ------------------------------------------------------------- menu
  "menu.campaign": ["Campaign", "战役", "캠페인"],
  "menu.sandbox": ["Conquest", "征服", "정복"],
  "menu.conquest.subtitle": ["Build and conquer", "建设与征服", "건설과 정복"],
  "menu.breakthrough": ["Breakthrough", "突破", "돌파"],
  "menu.bt.subtitle": ["Attack or defend", "进攻或防守", "공격 또는 방어"],
  "menu.multiplayer": ["Multiplayer", "多人游戏", "멀티플레이어"],
  "menu.load": ["Load Game", "载入存档", "게임 불러오기"],
  "menu.editor": ["Editor", "编辑器", "에디터"],
  "menu.customGame": ["Custom Game", "自定义游戏", "사용자 게임"],
  "menu.mapEditor": ["Scenario Editor", "场景编辑器", "시나리오 에디터"],
  "menu.settings": ["Settings", "设置", "설정"],
  // the corner tile to the players: the QQ group under a Chinese interface, the Discord under the rest
  "menu.discord": ["Join the Discord", "加入 Discord", "Discord 참여"],
  "changelog.title": ["What's New", "更新内容", "새 소식"],
  "changelog.loading": ["Loading release notes…", "正在加载更新日志…", "업데이트 내역을 불러오는 중…"],
  "changelog.empty": ["No release notes yet.", "暂无更新日志。", "아직 업데이트 내역이 없습니다."],
  "changelog.offline": ["Could not load release notes. Check your connection and try again.", "无法加载更新日志，请检查网络连接后重试。", "업데이트 내역을 불러오지 못했습니다. 연결을 확인하고 다시 시도하세요."],
  "changelog.retry": ["Try again", "重试", "다시 시도"],
  "changelog.all": ["All updates", "全部更新", "모든 업데이트"],
  "menu.qq": ["Join the QQ group ({0})", "加入 QQ 群（{0}）", "QQ 그룹 참여 ({0})"],
  "menu.qqShort": ["Join the QQ group", "加入 QQ 群", "QQ 그룹 참여"],
  // where QQ did not take the join link: the number is on the clipboard, or at least on screen
  "menu.qqCopied": ["QQ group number {0} copied. Search for it in QQ to join.", "已复制 QQ 群号 {0}，请在 QQ 中搜索加群。", "QQ 그룹 번호 {0}을(를) 복사했습니다. QQ에서 검색해 참여하세요."],
  "menu.qqNumber": ["QQ group number: {0}. Search for it in QQ to join.", "QQ 群号：{0}，请在 QQ 中搜索加群。", "QQ 그룹 번호: {0}. QQ에서 검색해 참여하세요."],
  "menu.exit": ["Exit game", "退出游戏", "게임 종료"],
  "menu.continue": ["Continue", "继续游戏", "이어하기"],
  "menu.continueFactions": ["{0} factions", "{0} 个阵营", "진영 {0}개"],
  // what each home tile opens, beside the tiles on a large screen (`detailPanel` in ui/menu.ts); Conquest's is `mode.sandbox.desc`
  // the chips of what is good to know, beside the tiles under a tile's name (`Tile.facts`)
  "menu.fact.factions": ["{0}–{1} factions", "{0}–{1} 个阵营", "진영 {0}–{1}개"],
  "menu.fact.players": ["{0}–{1} players", "{0}–{1} 名玩家", "플레이어 {0}–{1}명"],
  "menu.fact.checkpoints": ["{0}–{1} checkpoints", "{0}–{1} 个检查点", "검문소 {0}–{1}개"],
  "menu.fact.clock": ["{0}–{1} min opening clock", "初始时限 {0}–{1} 分钟", "초기 제한 시간 {0}–{1}분"],
  "menu.fact.missions": ["{0} missions", "{0} 个任务", "임무 {0}개"],
  "menu.fact.online": ["Online", "在线", "온라인"],
  "menu.fact.onlineLan": ["Online · LAN", "在线 · 局域网", "온라인 · LAN"],
  "menu.desc.continue": ["Back into your last saved match, where you left it.", "回到你最近保存的对局，从离开的地方继续。", "마지막으로 저장한 대전으로 돌아가 멈춘 곳부터 이어 갑니다."],
  "menu.desc.multiplayer": [
    "Play against people: pick an open room, join a server by its address, or host a game of your own.",
    "与真人对战：挑选一个开放的房间，按地址加入服务器，或自己主持一局。",
    "사람과 대전합니다. 열린 방을 고르거나, 주소로 서버에 참가하거나, 직접 게임을 엽니다."
  ],
  "menu.desc.breakthrough": [
    "Lead an assault with a finite budget and ready production lines, or build defenses around working bases. Fight over checkpoints in order; each one taken moves the front forward.",
    "带着有限的预算和现成的生产线指挥进攻，或围绕已运转的基地布置防御。按顺序争夺检查点，每攻下一处，战线就向前推进。",
    "한정된 예산과 준비된 생산 라인으로 공세를 이끌거나, 가동 중인 기지에 방어선을 세우세요. 검문소를 차례로 두고 싸우며, 점령할 때마다 전선이 전진합니다."
  ],
  "menu.desc.campaign": [
    "A desert war fought mission by mission, each with its own map, orders and briefing.",
    "一场沙漠战争，一关接一关地打，每关都有自己的地图、命令和简报。",
    "임무마다 지도와 명령, 브리핑이 따로 있는 사막 전쟁을 한 임무씩 치릅니다."
  ],
  "menu.desc.load": ["Open a saved match, or a save file from elsewhere.", "打开保存的对局，或来自别处的存档文件。", "저장한 대전이나 다른 곳의 저장 파일을 엽니다."],
  "menu.desc.editor": [
    "Paint a map of your own, stand its forces and publish it for others to play.",
    "绘制自己的地图，布置初始部队，并发布给其他人游玩。",
    "나만의 지도를 그리고, 병력을 배치하고, 다른 사람이 플레이하도록 공개합니다."
  ],
  "menu.desc.exit": ["Close the game.", "关闭游戏。", "게임을 닫습니다."],
  "menu.desc.cuts": [
    "The menu's cut scenes on their own, with the raster test and its readout.",
    "单独播放主菜单的过场镜头，附带光栅测试及其读数。",
    "메뉴의 컷 장면을 따로 재생하며, 래스터 테스트와 그 판독값을 함께 봅니다."
  ],
  "menu.desc.replays": ["Recorded matches, played back from their orders.", "已录制的对局，按其指令重放。", "기록된 대전을 그 명령대로 다시 재생합니다."],
  "menu.desc.storeDot": ["Put the Store's blue dot back on this device.", "在这台设备上重新显示商店的蓝点。", "이 기기에서 상점의 파란 점을 다시 표시합니다."],
  "menu.version": ["v{0}", "v{0}", "v{0}"],
  "menu.preview": ["Early development preview. Content is subject to change.", "早期开发预览版，不代表最终品质。", "초기 개발 미리보기 버전입니다. 콘텐츠는 변경될 수 있습니다."],
  "dev.enabled": ["Developer mode on.", "已开启开发者模式。", "개발자 모드가 켜졌습니다."],
  // the plate that asks for developer mode's passcode, checked online (`ui/devUnlock.ts`)
  "dev.code.label": ["Passcode", "密码", "암호"],
  "dev.code.show": ["Show passcode", "显示密码", "암호 보기"],
  "dev.code.hide": ["Hide passcode", "隐藏密码", "암호 숨기기"],
  "dev.code.unlock": ["Unlock", "解锁", "잠금 해제"],
  "dev.code.checking": ["Checking…", "正在验证…", "확인 중…"],
  "dev.code.wrong": ["That passcode is not right.", "密码不正确。", "암호가 올바르지 않습니다."],
  "dev.code.offline": ["Could not reach the server. Unlocking needs an internet connection.", "无法连接服务器。解锁需要联网。", "서버에 연결할 수 없습니다. 잠금을 해제하려면 인터넷 연결이 필요합니다."],
  // a launch whose code the server no longer takes: the mode goes off
  "dev.code.revoked": ["Developer mode is off: its passcode has changed.", "开发者模式已关闭：密码已更改。", "개발자 모드가 꺼졌습니다. 암호가 바뀌었습니다."],
  // the developer tools (the home screen's tiles, developer mode only)
  "menu.cuts": ["Cuts", "过场镜头", "컷 장면"],
  "menu.replays": ["Replays", "回放", "리플레이"],
  // the Store tab's blue dot put back on this device (`clearStoreSeen`)
  "menu.storeDot": ["Reset the Store dot", "重置商店圆点", "상점 점 초기화"],
  "menu.storeDot.done": ["The Store dot is back.", "商店圆点已恢复。", "상점 점이 다시 표시됩니다."],
  // ---- the cuts viewer's own column. Each cut is named by what it shows, so
  // a recording session can be talked about; `cuts.<id>` matches `REEL` and
  // `MORE_CUTS` (menuCuts.ts), in the order the viewer lists them.
  "cuts.reel": ["Reel", "镜头列表", "릴"],
  "cuts.flank": ["Flank Assault", "侧翼突击", "측면 강습"],
  "cuts.sea": ["Sea Battle", "海战", "해전"],
  "cuts.winter": ["Winter Line", "冬季防线", "겨울 방어선"],
  "cuts.raid": ["Air Raid", "空袭", "공습"],
  "cuts.landing": ["Beachhead", "抢滩登陆", "교두보"],
  "cuts.rockets": ["Rocket Storm", "火箭洗地", "로켓 폭풍"],
  "cuts.home": ["Home Front", "大后方", "후방"],
  "cuts.nuke": ["Nuclear Strike", "核打击", "핵 공격"],
  // ---- the cuts the menu never loops, each showing what the reel has no room for
  "cuts.more": ["Extras", "额外镜头", "추가 컷"],
  "cuts.airlift": ["Airlift", "空运登陆", "공수 작전"],
  "cuts.emp": ["Blackout", "断电突袭", "블랙아웃"],
  "cuts.ice": ["Ice Road", "冰上补给线", "얼음 보급로"],
  // ---- and the raster test's, under a card of their own (`RASTER_CUTS` in
  // rasterCuts.ts): named by what they are for, so each row says what is in it
  "cuts.raster": ["Raster test", "光栅测试", "래스터 테스트"],
  "cuts.pitched": ["Pitched Battle", "会战", "대회전"],
  "cuts.pitched.tip": [
    "Eight seats on the largest generated map: 1,048 units and 176 buildings at the opening, with the armies gathered at the centre and the bases producing more. Try rain at midnight to load the lighting and weather passes.",
    "生成器最大尺寸的地图上坐满八个席位：开场有 1048 个单位、176 座建筑，大军集结在中央，基地继续出兵。可切换到雨夜，测试灯光与天气的负载。",
    "생성기가 만드는 가장 큰 지도에 여덟 진영이 있습니다. 시작 시 유닛 1,048개와 건물 176개이며, 군대는 중앙에 모이고 기지는 계속 생산합니다. 비 내리는 자정으로 조명과 날씨 부하를 시험할 수 있습니다."
  ],
  "cuts.pitched2": ["Pitched Battle ×2", "会战 ×2", "대회전 ×2"],
  "cuts.pitched2.tip": [
    "Double the opening armies: 2,096 units and 176 buildings. The same map, bases, camera and unit mix, with denser formations. Compare under the same sky and graphics settings; casualties and production change the live count.",
    "开场兵力翻倍：2096 个单位、176 座建筑。地图、基地、镜头与兵种比例相同，阵型更密集。请在相同天气和画质下比较；战损与生产会改变实时数量。",
    "시작 병력 두 배: 유닛 2,096개와 건물 176개. 지도, 기지, 카메라, 병종 비율은 같고 대형은 더 촘촘합니다. 같은 하늘과 그래픽 설정에서 비교하세요. 손실과 생산에 따라 현재 수가 달라집니다."
  ],
  "cuts.pitched4": ["Pitched Battle ×4", "会战 ×4", "대회전 ×4"],
  "cuts.pitched4.tip": [
    "Four times the opening armies: 4,192 units and 176 buildings. The same battlefield packed more tightly to probe the frame budget. Compare under the same sky and graphics settings; casualties and production change the live count.",
    "开场兵力增至四倍：4192 个单位、176 座建筑。在同一战场上布置更密集的部队，探测帧时间的上限。请在相同天气和画质下比较；战损与生产会改变实时数量。",
    "시작 병력 네 배: 유닛 4,192개와 건물 176개. 같은 전장에 더 밀집한 병력을 배치해 프레임 예산의 한계를 살핍니다. 같은 하늘과 그래픽 설정에서 비교하세요. 손실과 생산에 따라 현재 수가 달라집니다."
  ],
  "cuts.playback": ["Playback", "播放", "재생"],
  "cuts.autoPlay": ["Auto play", "自动播放", "자동 재생"],
  "cuts.autoPlayTip": [
    "Run the reel: each cut holds the screen for 13 seconds and the next one comes in through the dip. Off, the cut you pick stays up for as long as you leave it.",
    "自动放完整卷：每个镜头停留 13 秒，随后淡黑切到下一个。关闭后，你选中的镜头会一直停在画面上。",
    "릴을 돌립니다. 각 컷은 13초 동안 화면에 머물고 다음 컷이 암전을 거쳐 들어옵니다. 끄면 고른 컷이 그대로 머뭅니다."
  ],
  "cuts.prev": ["Previous cut", "上一个镜头", "이전 컷"],
  "cuts.next": ["Next cut", "下一个镜头", "다음 컷"],
  "cuts.pause": ["Hold the picture", "暂停画面", "화면 멈춤"],
  "cuts.resume": ["Let it run", "继续播放", "계속 재생"],
  "cuts.sky": ["Sky", "天空", "하늘"],
  "cuts.ownSky": ["Scene's own sky", "场景自带天空", "장면 고유 하늘"],
  "cuts.ownSkyTip": [
    "Every cut under the weather and the hour it was written for. Touch the weather or the hour below and every cut is held under yours instead.",
    "每个镜头都用它自己设定的天气与时刻。调整下方的天气或时刻后，所有镜头都改用你的设置。",
    "각 컷을 원래 정해진 날씨와 시각으로 보여 줍니다. 아래의 날씨나 시각을 바꾸면 모든 컷에 그 설정이 적용됩니다."
  ],
  "cuts.time": ["Hour", "时刻", "시각"],
  "cuts.timeTip": [
    "Where the sun is, from dawn through midnight. The sun is stopped while the viewer is open, so a cut stays under the light you framed it in.",
    "太阳的位置，从黎明到午夜。查看器里太阳不会自己走，镜头会一直停在你选定的光线下。",
    "새벽부터 자정까지 해의 위치입니다. 뷰어가 열려 있는 동안 해는 멈춰 있어서, 컷은 잡아 둔 빛 아래 그대로 머뭅니다."
  ],
  "cuts.hide": ["Hide the panel: nothing is drawn over the picture", "收起面板：画面上不再有任何遮挡", "패널 숨기기: 화면 위에 아무것도 그리지 않습니다"],
  "cuts.show": ["Show the panel", "展开面板", "패널 보이기"],
  "cuts.leave": ["Back to the developer tools", "返回开发者工具", "개발자 도구로 돌아가기"],
  // ---- the readout in the corner: this screen's own, not the match's fps tag
  "cuts.perf": ["Performance", "性能", "성능"],
  "cuts.readout": ["Readout", "性能读数", "측정값 표시"],
  "cuts.readoutTip": [
    "Frame, sim and render times, what is drawn and what is held, in the bottom right corner, read off the viewer's own loop twice a second. Independent of the fps indicator in the settings.",
    "在右下角显示帧时间、模拟与渲染耗时、绘制与缓存的数量，每半秒从查看器自己的循环里读一次。与设置里的帧率指示器无关。",
    "프레임, 시뮬레이션, 렌더 시간과 그려진 것, 보관 중인 것을 오른쪽 아래에 표시합니다. 뷰어 자체 루프에서 초당 두 번 읽으며, 설정의 fps 표시와는 별개입니다."
  ],
  // ---- a session: the same readings kept, and read out as text for a paste
  "cuts.record": ["Record", "录制", "기록"],
  "cuts.recordTip": [
    "Keep every reading from now on, with a mark for each cut, sky and hold, until Stop. Starting again drops the last session.",
    "从现在起保留每一次读数，并记下每次镜头、天空和暂停的变化，直到按下停止。再次开始会丢弃上一个会话。",
    "지금부터 모든 측정값을 컷, 하늘, 정지 표시와 함께 중지할 때까지 기록합니다. 다시 시작하면 이전 세션은 버립니다."
  ],
  "cuts.stop": ["Stop", "停止", "중지"],
  "cuts.stopTip": ["End the session; its report stays ready to copy", "结束会话，报告仍可随时复制", "세션을 끝냅니다. 보고서는 계속 복사할 수 있습니다"],
  "cuts.copyReport": ["Copy report", "复制报告", "보고서 복사"],
  "cuts.copyReportTip": [
    "The session as text: the setting it ran under, the whole, every half-second window, the marks, and what looks wrong",
    "会话的文字报告：运行环境、总体数据、每半秒一行、标记，以及可疑之处",
    "세션을 글로 정리한 것: 실행 환경, 전체 수치, 반초 단위의 각 구간, 표시, 의심스러운 점"
  ],
  "cuts.session": ["{0} s · {1} samples", "{0} 秒 · {1} 个样本", "{0}초 · 샘플 {1}개"],
  // ------------------------------------------------------------- common
  "common.back": ["Back", "返回", "뒤로"],
  // the chevrons either side of a row of cards (`ui/stripArrows.ts`)
  "common.previous": ["Previous", "上一个", "이전"],
  "common.next": ["Next", "下一个", "다음"],
  "common.start": ["Start", "开始", "시작"],
  "common.cancel": ["Cancel", "取消", "취소"],
  "common.undo": ["Undo", "撤销", "실행 취소"],
  "common.quit": ["Quit", "退出", "나가기"],
  "common.close": ["Close", "关闭", "닫기"],
  "common.done": ["Done", "完成", "완료"],
  "common.delete": ["Delete", "删除", "삭제"],
  "common.more": ["More", "更多", "더 보기"],
  "date.today": ["Today", "今天", "오늘"],
  "date.yesterday": ["Yesterday", "昨天", "어제"],
  "common.reset": ["Reset", "重置", "초기화"],
  "common.empty": ["Empty", "空", "비어 있음"],
  "common.on": ["On", "开", "켜짐"],
  "common.off": ["Off", "关", "꺼짐"],
  "common.player": ["Player", "玩家", "플레이어"],
  "common.confirmDelete": ["Delete this save?", "确定删除该存档？", "이 저장을 삭제할까요?"],
  "common.overwrite": ["Overwrite this slot?", "覆盖该存档位？", "이 슬롯을 덮어쓸까요?"],
  // the plates the two questions above are asked on, and the answers that say what happens
  "save.delete": ["Delete save", "删除存档", "저장 삭제"],
  "save.overwriteTitle": ["Overwrite slot", "覆盖存档位", "슬롯 덮어쓰기"],
  "save.overwrite": ["Overwrite", "覆盖", "덮어쓰기"],
  // ------------------------------------------------------------- save slots
  "save.auto": ["Autosave", "自动存档", "자동 저장"],
  "save.quick": ["Quicksave", "快速存档", "빠른 저장"],
  "save.slot": ["Slot {0}", "存档位 {0}", "슬롯 {0}"],
  // a save that cannot be played here (ui/loadgame.ts `playSave`), said on a plate rather than a blank screen
  "save.loadFailed": ["The save could not be loaded", "存档无法读取", "저장을 불러올 수 없습니다"],
  "save.invalidHQContacts": ["Invalid HQ contact data.", "总部失守位置标记数据无效。", "본부 상실 위치 표시 데이터가 올바르지 않습니다."],
  "save.needsMods": ["This save needs mods", "该存档需要模组", "이 저장에는 모드가 필요합니다"],
  "save.needsMods.body": [
    "It was played with these mods on. Install them, or switch them on, to load it.",
    "该存档使用了以下模组。请安装或启用它们后再读取。",
    "이 모드들을 켠 채로 플레이한 저장입니다. 불러오려면 설치하거나 켜 주세요."
  ],
  "save.needsMods.off": ["installed, switched off", "已安装，未启用", "설치됨, 꺼짐"],
  "save.needsMods.missing": ["not installed", "未安装", "설치 안 됨"],
  "save.openMods": ["Open Mods", "打开模组", "모드 열기"],
  // ------------------------------------------------------------- difficulty
  "diff.relaxed": ["Relaxed", "轻松", "여유"],
  "diff.standard": ["Standard", "标准", "표준"],
  "diff.seasoned": ["Seasoned", "老练", "숙련"],
  "diff.veteran": ["Veteran", "老兵", "베테랑"],
  "diff.relaxed.desc": ["A calm opponent that attacks rarely.", "进攻节奏缓慢的温和对手。", "좀처럼 공격하지 않는 차분한 상대입니다."],
  "diff.standard.desc": ["A balanced opponent for most players.", "适合多数玩家的均衡对手。", "대부분의 플레이어에게 맞는 균형 잡힌 상대입니다."],
  "diff.seasoned.desc": ["Plays like the Veteran, but under the same fog of war as you.", "打法与老兵相同，但和你一样受战争迷雾限制。", "베테랑처럼 싸우지만, 당신과 같은 전장의 안개 속에서 싸웁니다."],
  "diff.veteran.desc": ["Aggressive, expands fast, counters your army, and sees through the fog of war.", "扩张迅速、针对性极强的凶猛对手，能看穿战争迷雾。", "공격적이고, 빠르게 확장하며, 당신의 군대에 맞춰 대응하고, 전장의 안개를 꿰뚫어 봅니다."],
  // ------------------------------------------------------------- sandbox setup
  "setup.title": ["Conquest", "征服", "정복"],
  // ---- the mode, the strip above the lobby's maps: the open match, or the front line
  "mode.sandbox.desc": [
    "Every faction opens with a headquarters and builds. Win by eliminating the opposition, or hold the most metal when the time limit runs out.",
    "每个阵营都从一座总部起步、自由建设。消灭敌对势力，或在时限到达时存有最多金属，即可获胜。",
    "모든 진영이 사령부 하나로 시작해 건설합니다. 적을 모두 제거하거나 제한 시간이 끝날 때 가장 많은 금속을 보유하면 승리합니다."
  ],
  "mode.breakthrough.desc": [
    "One side attacks, one holds. The defenders build a base at every checkpoint; the attackers fight from a war chest with no base at all, and take the checkpoints in order. The attackers win at the last one, the defenders when the clock runs out or the chest is spent.",
    "一方进攻，一方防守。守方在每个检查点建立基地；攻方没有基地，只靠一笔战争基金作战，按顺序夺取检查点。攻下最后一个检查点则攻方胜；时间耗尽或基金花光则守方胜。",
    "한쪽은 공격하고 한쪽은 지킵니다. 수비측은 검문소마다 기지를 세우고, 공격측은 기지 없이 군자금만으로 싸우며 검문소를 차례로 점령합니다. 마지막 검문소가 떨어지면 공격측이, 시계가 다 돌거나 군자금이 바닥나면 수비측이 이깁니다."
  ],
  "setup.checkpoints": ["Checkpoints", "检查点", "검문소"],
  "setup.checkpoints.desc": [
    "Headquarters in the chain, front to rear. A map seats one fewer than its spawns.",
    "链条上的总部数量，从前到后。一张地图最多容纳“出生点数减一”个。",
    "사슬을 이루는 사령부 수, 앞에서 뒤로. 지도의 시작 지점 수보다 하나 적게까지 둘 수 있습니다."
  ],
  "setup.assaultChest": ["War chest", "战争基金", "군자금"],
  "setup.assaultChest.desc": [
    "The attackers’ starting metal, available immediately to prepare the assault. No mining income; each checkpoint taken refills 4000.",
    "攻方开场即可使用的金属，用来准备进攻。没有采矿收入；每攻下一个检查点补充 4000。",
    "공세 준비에 즉시 쓸 수 있는 공격측의 시작 금속입니다. 채굴 수입은 없으며, 검문소 하나를 점령할 때마다 4000이 보충됩니다."
  ],
  "setup.clock": ["Clock", "倒计时", "시계"],
  "setup.clock.desc": [
    "What the defenders have to hold, from the whistle. Each checkpoint taken adds four minutes.",
    "守方从哨响起需要坚守的时间。每失守一个检查点，攻方多得四分钟。",
    "휘슬부터 수비측이 버텨야 하는 시간입니다. 검문소 하나가 함락될 때마다 4분이 추가됩니다."
  ],
  "guide.bt.attack.title": ["Leading the assault", "指挥进攻", "공세 지휘"],
  "guide.bt.defend.title": ["Holding the line", "坚守防线", "전선 사수"],
  "guide.bt.attack.prepare": ["Prepare your army", "准备部队", "병력 준비"],
  "guide.bt.attack.prepare.body": ["Your metal is available now. Select a factory and queue troops; the advanced factory can build tanks and howitzers. You have {0} to prepare before the front headquarters unlocks.", "金属现在就可使用。选中工厂生产部队，高级工厂可生产坦克和榴弹炮。前线总部解锁前，你有 {0} 的准备时间。", "금속을 지금 쓸 수 있습니다. 공장을 선택해 병력을 생산하세요. 고급 공장은 전차와 곡사포를 생산합니다. 최전방 사령부가 개방되기 전까지 {0} 동안 준비할 수 있습니다."],
  "guide.bt.attack.budget": ["Spend a finite budget", "使用有限预算", "한정된 예산 사용"],
  "guide.bt.attack.budget.body": ["There are no engineers, extractors or power plants to build. Your production lines are protected and supplied. Units and upgrades share one budget, so losses reduce what you can send next.", "无需建造工程师、采矿设施或电厂。生产线受到保护且供能充足。部队和升级共用一笔预算，损失会减少后续可投入的兵力。", "공병, 채굴 시설이나 발전소를 지을 필요가 없습니다. 생산 라인은 보호받으며 전력도 공급됩니다. 유닛과 업그레이드는 같은 예산을 쓰므로 손실이 다음에 보낼 병력을 줄입니다."],
  "guide.bt.attack.front": ["Destroy the front headquarters", "摧毁前线总部", "최전방 사령부 파괴"],
  "guide.bt.attack.front.body": ["The bright checkpoint is your target. Destroy its headquarters to advance; rear headquarters stay protected until their turn. Attack-move ({3}) sends your force forward while engaging enemies.", "明亮的检查点就是目标。摧毁其总部即可推进，后方总部会受保护直到轮到它。使用攻击移动（{3}）让部队边前进边交战。", "밝게 표시된 검문소가 목표입니다. 사령부를 파괴하면 전진하며, 후방 사령부는 차례가 올 때까지 보호됩니다. 공격 이동({3})으로 적과 교전하며 전진하세요."],
  "guide.bt.attack.advance": ["Keep your momentum", "继续推进", "공세 이어가기"],
  "guide.bt.attack.advance.body": ["Each checkpoint taken adds {1} metal and {2} minutes. Your lines move forward with their upgrades, queues and work intact. Take the last headquarters to win.", "每攻下一处检查点补充 {1} 金属和 {2} 分钟。生产线前移时保留升级、队列和生产进度。攻下最后一座总部即可获胜。", "검문소를 점령할 때마다 금속 {1}과 {2}분이 추가됩니다. 생산 라인은 업그레이드, 대기열과 진행도를 유지한 채 전진합니다. 마지막 사령부를 점령하면 승리합니다."],
  "guide.bt.defend.prepare": ["A working base at each checkpoint", "各检查点已有运转中的基地", "검문소마다 가동 중인 기지"],
  "guide.bt.defend.prepare.body": ["Mining and production are already set up. You have {0} to prepare. Use your engineers for power and defenses, and queue a reserve at the factories.", "采矿和生产设施已就绪，你有 {0} 的准备时间。用工程师补充电力、布置防御，并在工厂生产预备队。", "채굴과 생산 시설이 이미 준비되어 있으며 준비 시간은 {0}입니다. 공병으로 전력과 방어 시설을 보강하고 공장에서 예비대를 생산하세요."],
  "guide.bt.defend.front": ["Defend the bright checkpoint", "守住明亮的检查点", "밝은 검문소 방어"],
  "guide.bt.defend.front.body": ["Only the front headquarters can fall after preparation. Place defenses along the attackers’ approach. Rear headquarters are protected, but their miners, factories and armies can still be attacked.", "准备结束后，只有前线总部能被攻下。在攻方来路布置防御。后方总部受到保护，但其采矿设施、工厂和部队仍可能遭受攻击。", "준비가 끝나면 최전방 사령부만 함락될 수 있습니다. 공격측의 접근로에 방어선을 세우세요. 후방 사령부는 보호되지만 채굴 시설, 공장과 병력은 공격받을 수 있습니다."],
  "guide.bt.defend.army": ["Support the defenses", "支援防御阵地", "방어선 지원"],
  "guide.bt.defend.army.body": ["Keep a mobile reserve behind your turrets and repair damaged positions. The attackers have a finite budget; destroying their units helps exhaust the assault.", "在炮塔后方保留机动预备队，维修受损阵地。攻方预算有限，摧毁其部队能消耗这场进攻。", "포탑 뒤에 기동 예비대를 두고 손상된 진지를 수리하세요. 공격측의 예산은 한정되어 있어 병력을 파괴하면 공세를 소진시킬 수 있습니다."],
  "guide.bt.defend.fallback": ["Fall back and hold", "撤回下一处继续坚守", "후퇴 후 사수"],
  "guide.bt.defend.fallback.body": ["If the front falls, defend the next headquarters. The attackers gain {1} metal and {2} minutes. You win when the clock expires or they have neither forces nor funds for another unit.", "前线失守后，守住下一座总部。攻方获得 {1} 金属和 {2} 分钟。时间耗尽，或攻方既无兵力又无资金生产新部队时，你就获胜。", "최전방이 함락되면 다음 사령부를 지키세요. 공격측은 금속 {1}과 {2}분을 얻습니다. 시간이 끝나거나 공격측에 병력도 새 유닛을 살 자금도 없으면 승리합니다."],
  "setup.mapNotInMode": ["This map is not played in this mode.", "这张地图不在此模式中。", "이 지도는 이 모드에서 플레이할 수 없습니다."],
  "setup.needSides": ["Breakthrough needs an attacker and a defender.", "突破模式需要一个进攻方和一个防守方。", "돌파에는 공격측과 수비측이 모두 있어야 합니다."],
  "setup.map": ["Map", "地图", "지도"],
  "setup.factions": ["Factions", "阵营", "진영"],
  "setup.rules": ["Game config", "对局设置", "게임 설정"],
  "setup.conquestTimeLimit": ["Time limit (min)", "时限（分钟）", "시간 제한(분)"],
  "setup.conquestTimeLimit.desc": [
    "At the time limit, the surviving faction with the most stored metal wins for its team. A tie between opposing teams is a draw. Set 0 for no limit.",
    "时限到达时，存有最多金属的存活阵营及其盟友获胜。敌对队伍并列则平局。设为 0 表示不限时。",
    "제한 시간이 되면 보유 금속이 가장 많은 생존 진영과 그 동맹이 승리합니다. 서로 다른 팀이 동률이면 무승부입니다. 0은 시간 제한 없음입니다."
  ],
  "setup.startMetal": ["Starting metal", "初始金属", "시작 금속"],
  "setup.productionSlotsPerHQ": ["Production slots per HQ", "每座总部的生产席位", "사령부당 생산 슬롯"],
  "setup.productionSlotsPerHQ.desc": [
    "Each completed Headquarters supports this many factories, airbases and naval yards combined.",
    "每座建成的总部可支持的战车工厂、空军基地和造船厂总数。",
    "완성된 사령부 하나가 지원하는 전차 공장, 공군 기지, 조선소의 합계입니다."
  ],
  "setup.fog": ["Fog of war", "战争迷雾", "전장의 안개"],
  "setup.tech": ["Tech tree", "科技树", "기술 트리"],
  "setup.tech.desc": [
    "The War Lab: a doctrine for each side, the units and abilities it unlocks, and economy upgrades.",
    "战争实验室：每方选择一种学说，以及它解锁的单位、技能和经济升级。",
    "전쟁 연구소: 진영마다 교리를 고르고, 교리가 해금하는 유닛과 능력, 경제 향상을 연구합니다."
  ],
  "setup.reset": ["Reset to default", "恢复默认", "기본값으로 되돌리기"],
  "settings.resetAll": ["Reset to default", "恢复默认", "기본값으로 되돌리기"],
  "settings.resetAll.confirm": [
    "Every setting goes back to its default, and every notice you chose not to be reminded of will show again. Your commander name and developer mode are kept.",
    "所有设置都将恢复默认，你选择不再提醒的提示也会重新出现。指挥官名称和开发者模式会保留。",
    "모든 설정이 기본값으로 돌아가고, 다시 알리지 않기로 한 안내도 다시 표시됩니다. 지휘관 이름과 개발자 모드는 유지됩니다."
  ],
  "setup.buildRadius": ["Build radius", "建造范围", "건설 반경"],
  "setup.buildRadius.desc": [
    "A side builds only within a ring round its Headquarters. Extractors and offshore rigs stand anywhere. Off: build anywhere.",
    "各方只能在己方总部周围的范围内建造，采矿场和海上钻井平台不受限制。关闭后可在任意位置建造。",
    "각 진영은 사령부 주변 반경 안에서만 건설할 수 있습니다. 금속 채굴장과 해상 시추 플랫폼은 어디에나 지을 수 있습니다. 끄면 어디에나 건설할 수 있습니다."
  ],
  // ---- weather. The name is a word, the sentence beneath it is the whole
  // rule: what it takes off sight, and what it takes off speed.
  "setup.weather": ["Weather", "天气", "날씨"],
  "weather.clear": ["Clear", "晴朗", "맑음"],
  "weather.rain": ["Rain", "雨天", "비"],
  "weather.snow": ["Snow", "雪天", "눈"],
  "weather.random": ["Random", "随机", "무작위"],
  "weather.clear.desc": ["Open sky. Every unit sees and moves as it was built to.", "天朗气清。所有单位的视野和速度都是默认值。", "맑은 하늘. 모든 유닛이 원래대로 보고 움직입니다."],
  "weather.rain.desc": [
    "Sight down 25% and everything on the ground 15% slower. Aircraft keep their speed, but under the cloud they see 30% less again and their bombs and rockets scatter wider.",
    "视野下降 25%，地面与水面单位慢 15%。飞机速度不变，但在云层下视野再减 30%，炸弹与火箭散布更大。",
    "시야 25% 감소, 지상의 모든 것이 15% 느려집니다. 항공기는 속도를 유지하지만 구름 아래에서 시야가 30% 더 줄고 폭탄과 로켓이 더 넓게 흩어집니다."
  ],
  "weather.snow.desc": [
    "You see it coming as clearly as ever, and everything on the ground crawls, 25% slower. Aircraft keep their speed, but in the snowfall they see 30% less and their bombs and rockets scatter wider.",
    "你照样看得一清二楚，但地面与水面单位慢了 25%，救援总是迟一步。飞机速度不变，但在飞雪中视野减 30%，炸弹与火箭散布更大。",
    "다가오는 것은 평소처럼 또렷이 보이지만, 지상의 모든 것이 25% 느리게 기어갑니다. 항공기는 속도를 유지하지만 눈보라 속에서 시야가 30% 줄고 폭탄과 로켓이 더 넓게 흩어집니다."
  ],
  "weather.random.desc": [
    "The sky will not settle: the match opens clear and turns every few minutes, and you are told each time it does.",
    "天气不会一成不变：开局晴朗，之后每隔几分钟变换一次，每次变换都会通报。",
    "하늘이 가만있지 않습니다. 맑게 시작해 몇 분마다 바뀌고, 바뀔 때마다 알려 줍니다."
  ],
  // the Time row: the sun turning, or held at one of three hours (`SKY_CHOICES`,
  // game/weather.ts); each choice has a sentence, the way each weather does
  "setup.time": ["Time", "时间", "시간대"],
  "sky.cycle": ["Day and night", "昼夜循环", "낮과 밤"],
  "sky.cycle.desc": [
    "The sun turns: 24 minutes to the full cycle, starting at dawn. At the bottom of the night every unit sees 40% less, the radar excepted, and the weather stacks on top.",
    "太阳会转：一个完整昼夜 24 分钟，从黎明开局。夜最深时所有单位视野缩减 40%（雷达站除外），并与天气叠加。",
    "해가 돕니다. 한 바퀴에 24분, 새벽에 시작합니다. 한밤중에는 모든 유닛의 시야가 40% 줄고(레이더 제외), 날씨가 그 위에 겹칩니다."
  ],
  "sky.dawn.desc": [
    "The sun is held at first light for the whole match: the amber sky of the opening minute, and every unit sees 15% less than at noon, the radar excepted.",
    "太阳停在破晓时分，整局不动：开局那一分钟的琥珀色天空，所有单位视野比正午少 15%（雷达站除外）。",
    "해가 동틀 녘에 멈춘 채 한 판을 치릅니다. 첫 1분의 호박빛 하늘이 이어지고, 모든 유닛의 시야가 정오보다 15% 줄어듭니다(레이더 제외)."
  ],
  "sky.noon.desc": [
    "The sun is held overhead: unending daylight, and one less variable.",
    "太阳停在头顶：全场保持白昼，少一个变数。",
    "해가 머리 위에 멈춥니다. 끝나지 않는 대낮, 변수 하나가 줄어듭니다."
  ],
  "sky.midnight.desc": [
    "The sun is held at the bottom of the night for the whole match: every unit sees 40% less, the radar excepted, and the weather stacks on top.",
    "太阳停在深夜，整局不动：所有单位视野缩减 40%（雷达站除外），并与天气叠加。",
    "해가 한밤중에 멈춘 채 한 판을 치릅니다. 모든 유닛의 시야가 40% 줄고(레이더 제외), 날씨가 그 위에 겹칩니다."
  ],
  // the hours the sky's clock is read back as (`skyTimeName`, game/weather.ts).
  // The console prints the word itself; anything a player reads is looked up.
  "sky.dawn": ["Dawn", "黎明", "새벽"],
  "sky.morning": ["Morning", "清晨", "아침"],
  "sky.noon": ["Noon", "正午", "정오"],
  "sky.afternoon": ["Afternoon", "午后", "오후"],
  "sky.dusk": ["Dusk", "黄昏", "황혼"],
  "sky.evening": ["Evening", "傍晚", "저녁"],
  "sky.night": ["Night", "夜晚", "밤"],
  "sky.midnight": ["Midnight", "午夜", "자정"],
  "setup.popCap": ["Unit cap", "人口上限", "유닛 상한"],
  "setup.you": ["You", "你", "당신"],
  "setup.watch": ["Watch the AI battle?", "观看 AI 对战？", "AI 전투를 관전할까요?"],
  "setup.watchConfirm": [
    "You have not assigned yourself a faction. Start as a spectator and watch the AI battle with the whole map in view?",
    "你没有为自己分配阵营。是否以观战者身份开始，观看 AI 对战并查看整张地图？",
    "직접 조종할 진영을 배정하지 않았습니다. 관전자로 시작해 전체 지도를 보며 AI 전투를 관전할까요?"
  ],
  "setup.seat": ["Your faction. It decides which spawn you start from.", "你的阵营，决定你从哪个出生点开局。", "당신의 진영. 어느 시작 지점에서 출발할지 정합니다."],
  // the words over the cells of the seat row under the conquest setup's map (`seatRow`'s label, `seatField`)
  "setup.col.faction": ["Faction", "阵营", "진영"],
  "setup.col.player": ["Player", "玩家", "플레이어"],
  "setup.col.team": ["Team", "队伍", "팀"],
  // breakthrough's: attackers or defenders
  "setup.col.side": ["Side", "攻防", "공수"],
  "setup.col.difficulty": ["Difficulty", "难度", "난이도"],
  // the lobby's: who holds a player's seat
  "setup.col.commander": ["Commander", "指挥官", "지휘관"],
  "setup.playHere": ["Play this faction too", "你也操作此阵营", "이 진영도 직접 조종"],
  "setup.openSeat": ["Open a faction here", "在此开启一个阵营", "여기에 진영 열기"],
  // the line under the conquest setup's seat row: what the mouse does on the map (`seatMapHints`)
  "setup.hint.select": ["Select faction", "选择阵营", "진영 선택"],
  "setup.hint.close": ["Close faction", "关闭阵营", "진영 닫기"],
  "setup.hint.open": ["Open faction", "开启阵营", "진영 열기"],
  // a deposit on the setup map, under the pointer: {0} is what mines it, {1} (at sea) what lays that
  "setup.ore.land": ["Ore deposit: build a {0} on it to mine metal.", "矿藏：在上面建造{0}即可开采金属。", "광맥: 위에 {0}을(를) 지으면 금속을 캡니다."],
  "setup.ore.sea": ["Ore at sea: an {0} mines it, laid from an {1}.", "海上矿藏：由{1}建造的{0}开采。", "해상 광맥: {1}이(가) 세운 {0}으로 캡니다."],
  "setup.staging": ["Staging ground: the attackers start here", "集结地：进攻方从这里出发", "집결지: 공격측이 여기서 시작합니다"],
  "setup.mapSize": ["Map size", "地图尺寸", "지도 크기"],
  "setup.symmetric": ["Mirrored map", "镜像地图", "대칭 지도"],
  "setup.symmetricTip": [
    "Both halves of a generated map are the same ground turned half a turn, so no homeland has better country than another. Turned off, the generator draws every corner on its own: livelier, and not a fair fight.",
    "生成的地图两半互为半圈旋转的同一片地形，任何家园都不会占到地利。关闭后生成器让各处自行成形：更有看头，但谈不上公平。",
    "생성된 지도의 두 절반은 같은 땅을 반 바퀴 돌린 것이라, 어느 본거지도 더 좋은 땅을 갖지 않습니다. 끄면 생성기가 구석구석을 제멋대로 그립니다. 더 생동감 있지만 공정한 싸움은 아닙니다."
  ],
  "setup.seed": ["Seed", "随机种子", "시드"],
  "setup.reseed": ["Roll a new seed", "重新生成种子", "새 시드 굴리기"],
  "setup.mapSize.s": ["Small", "小型", "소형"],
  "setup.mapSize.m": ["Medium", "中型", "중형"],
  "setup.mapSize.l": ["Large", "大型", "대형"],
  "setup.mapSize.xl": ["Huge", "巨型", "초대형"],
  "setup.slots": ["{0} slots", "{0} 席", "{0}자리"],
  "setup.slotsRange": ["{0}-{1} slots", "{0}-{1} 席", "{0}-{1}자리"],
  "setup.customMap": ["Custom map", "自定义地图", "사용자 지도"],
  // a card for a map a mod carries (`maps` in its manifest): the mod's name leads the title
  "setup.modMapTip": ["A map this mod ships, played exactly as its author laid it out.", "模组自带的地图，按作者布置的原样游玩。", "모드에 포함된 지도. 제작자가 배치한 그대로 플레이합니다."],
  "setup.uploadMap": ["Upload map…", "上传地图…", "지도 업로드…"],
  "setup.uploadMapTip": ["A map exported from the Scenario Editor (.steel-tide-map)", "从场景编辑器导出的地图（.steel-tide-map）", "시나리오 에디터에서 내보낸 지도(.steel-tide-map)"],
  "setup.dropMap": ["Drop the map file here", "把地图文件拖到这里", "지도 파일을 여기에 놓으세요"],
  "setup.deleteMap": ["Remove this map", "移除此地图", "이 지도 제거"],
  // the conquest setup's maps column, two tabs under the upload: the game's own maps, and the players'
  "setup.maps.official": ["Official", "官方", "공식"],
  "setup.maps.my": ["My", "我的", "내 지도"],
  "setup.maps.community": ["Community", "社区", "커뮤니티"],
  "setup.mapInvalid": ["Could not read that map: {0}", "无法读取该地图：{0}", "지도를 읽을 수 없습니다: {0}"],
  "setup.mapLoaded": ["Map loaded: {0}", "已载入地图：{0}", "지도를 불러왔습니다: {0}"],
  "map.custom.style": ["Your own map, played exactly as it was painted in the editor.", "你自己的地图，与编辑器中绘制的完全一致。", "직접 만든 지도를 에디터에서 그린 그대로 플레이합니다."],
  "map.openRange": ["Open Range", "靶场", "사격장"],
  "map.openRange.style": [
    "A coastal proving ground that starts you with the whole army: a garrison, an airfield, a harbour, and a firing line looking downrange at the impact area.",
    "海边的靶场，开局就把全部部队交给你：营区、机场、军港，以及正对靶区的射击线。",
    "군대 전체를 갖추고 시작하는 해안의 시험장입니다. 주둔지, 비행장, 항구, 그리고 탄착 지역을 내려다보는 사선이 있습니다."
  ],
  // ------------------------------------------------------------- multiplayer
  "mp.title": ["Multiplayer", "多人游戏", "멀티플레이어"],
  "mp.server": ["Server IP or address", "服务器 IP 或地址", "서버 IP 또는 주소"],
  "mp.name": ["Commander name", "指挥官名称", "사령관 이름"],
  // the plate that asks for the name: once, the first time Multiplayer is
  // pressed, and again with a door's reason when a server refuses the name
  "mp.nameFirst.title": ["Your commander name", "你的指挥官名称", "사령관 이름"],
  "mp.nameFirst.intro": [
    "This is how other players see you on a server. Change it any time in Settings ▸ General.",
    "其他玩家在服务器上会以此称呼你。随时可以在“设置 ▸ 常规”中修改。",
    "서버에서 다른 플레이어에게 보이는 이름입니다. 언제든 설정 ▸ 일반에서 바꿀 수 있습니다."
  ],
  "mp.nameFirst.go": ["Continue", "继续", "계속"],
  // under the name on the General page
  "settings.commanderName.desc": ["How other players see you on a server.", "其他玩家在服务器上看到的你的名字。", "서버에서 다른 플레이어에게 보이는 이름입니다."],
  "mp.joinCode": ["Join code", "加入码", "참가 코드"],
  "mp.hostKey": ["Host key (host only)", "主机密钥（仅房主）", "호스트 키(호스트 전용)"],
  "mp.connect": ["Connect", "连接", "접속"],
  "mp.showKey": ["Show host key", "显示主机密钥", "호스트 키 보기"],
  "mp.hideKey": ["Hide host key", "隐藏主机密钥", "호스트 키 숨기기"],
  // the dice beside the name: one of `COMMANDER_NAMES`
  "mp.randomName": ["Random name", "随机名称", "무작위 이름"],
  "mp.connecting": ["Connecting…", "正在连接…", "접속 중…"],
  "mp.findMatch": ["Find match", "寻找对手", "상대 찾기"],
  "mp.matchIntro": ["Casual 1v1 on official servers. Find an opponent while you browse the menus.", "在官方服务器进行休闲 1v1。浏览菜单时也能等待对手。", "공식 서버에서 캐주얼 1대1을 플레이하세요. 메뉴를 둘러보는 동안 상대를 찾습니다."],
  "mp.explain.match": ["Join the shared 1v1 queue. Accept when an opponent is found; the game chooses the server, map and rules.", "加入统一的 1v1 匹配队列。找到对手后确认接受，游戏会安排服务器、地图和规则。", "공용 1대1 대기열에 참가합니다. 상대를 찾으면 수락하세요. 서버, 지도와 규칙은 게임이 정합니다."],
  "mp.matchSearching": ["Searching {0} · {1} searching", "寻找对手 {0} · {1} 人匹配中", "상대 찾는 중 {0} · {1}명 대기 중"],
  "mp.matchCapacity": ["Waiting for a server {0} · {1} searching", "等待空闲服务器 {0} · {1} 人匹配中", "서버 기다리는 중 {0} · {1}명 대기 중"],
  "mp.matchChecking": ["Checking official servers…", "正在检查官方服务器…", "공식 서버 확인 중…"],
  "mp.matchReconnecting": ["Reconnecting to matchmaking…", "正在重新连接匹配服务…", "매칭 서비스에 다시 연결 중…"],
  "mp.matchFound": ["Opponent found", "已找到对手", "상대를 찾았습니다"],
  "mp.matchAccept": ["Accept", "接受", "수락"],
  "mp.matchDecline": ["Decline", "拒绝", "거절"],
  "mp.matchAccepted": ["Waiting for your opponent to accept…", "等待对手接受…", "상대의 수락을 기다리는 중…"],
  "mp.matchDeadline": ["Accept within {0} seconds", "请在 {0} 秒内接受", "{0}초 안에 수락하세요"],
  "mp.matchJoining": ["Preparing your 1v1…", "正在准备 1v1 对局…", "1대1 대전 준비 중…"],
  "mp.matchMapChosen": ["Map selected for this match.", "已为本场对局选定地图。", "이번 대전의 지도가 선택되었습니다."],
  "mp.matchCancel": ["Cancel search", "取消匹配", "매칭 취소"],
  "mp.matchReserved": ["Reserved for a match", "已为匹配对局预留", "매칭 대전용으로 예약됨"],
  "mp.matchError.name": ["Choose another commander name in Settings.", "请在设置中更换指挥官名称。", "설정에서 다른 지휘관 이름을 선택하세요."],
  "mp.matchError.version": ["Update the game to use matchmaking.", "请更新游戏后使用匹配。", "매칭을 이용하려면 게임을 업데이트하세요."],
  "mp.matchError.busy": ["You are already searching, or the queue is full. Try again shortly.", "你已在匹配中，或队列已满。请稍后重试。", "이미 매칭 중이거나 대기열이 가득 찼습니다. 잠시 후 다시 시도하세요."],
  "mp.matchError.latency": ["No official server has a suitable connection right now. Try Browse.", "目前没有连接适合的官方服务器，请尝试浏览房间。", "현재 연결 상태가 적합한 공식 서버가 없습니다. 방 목록을 확인하세요."],
  "mp.matchError.expired": ["The match offer expired. Search again when you are ready.", "匹配邀请已过期。准备好后可重新寻找对手。", "매칭 제안이 만료되었습니다. 준비되면 다시 상대를 찾으세요."],
  "mp.matchError.unavailable": ["Matchmaking is unavailable. Try again shortly or browse rooms.", "匹配服务暂不可用。请稍后重试，或浏览房间。", "매칭 서비스를 이용할 수 없습니다. 잠시 후 다시 시도하거나 방 목록을 확인하세요."],
  // read by a browser alone: an https page cannot open a plain socket, and the
  // server serves no page of its own to be sent to. The apps open the socket
  // natively and never reach it.
  "mp.needsTls": [
    "A browser can only reach a server with HTTPS (a domain name and a certificate). Ask the host for an https:// address, or join from the desktop or mobile app.",
    "浏览器只能连接启用了 HTTPS（有域名和证书）的服务器。请向房主索取 https:// 地址，或改用桌面版或手机版加入。",
    "브라우저는 HTTPS(도메인 이름과 인증서)가 있는 서버에만 접속할 수 있습니다. 호스트에게 https:// 주소를 요청하거나 데스크톱이나 모바일 앱으로 참가하세요."
  ],
  "mp.addressRequired": [
    "Enter the server's address.",
    "请输入服务器地址。",
    "서버 주소를 입력하세요."
  ],
  "mp.lobby": ["Server Lobby", "服务器大厅", "서버 로비"],
  "mp.lobbyTab": ["Lobby", "大厅", "로비"],
  "mp.waiting": ["Waiting for a human slot. The host or acting host assigns them.", "等待玩家席位，由房主或代理房主分配。", "플레이어 자리를 기다리는 중입니다. 호스트나 대리 호스트가 배정합니다."],
  // the roster's role tags: who runs the room. The acting host is the player
  // the host appointed, or the senior seated player standing in while no host
  // is connected (see `leaderId`)
  "mp.host": ["Host", "房主", "호스트"],
  "mp.actingHost": ["Acting host", "代理房主", "대리 호스트"],
  "mp.actingHostTip": [
    "Runs the lobby, appointed by the host or standing in while no host is connected: the map, the seats, Start, pause and the way back to the lobby.",
    "管理大厅（由房主指定，或在房主不在线时代为管理）：地图、席位、开始、暂停以及返回大厅。",
    "로비를 운영합니다 (호스트가 지정했거나, 호스트가 접속해 있지 않은 동안 대신 맡습니다): 지도, 자리, 시작, 일시 정지, 로비로 돌아가기."
  ],
  // the host's menu on a seated player: hand them the room, or take it back
  "mp.appoint": ["Make acting host", "设为代理房主", "대리 호스트로 지정"],
  "mp.withdrawActing": ["Withdraw acting host", "撤销代理房主", "대리 호스트 해제"],
  "mp.ready": ["Ready", "准备", "준비"],
  "mp.notReady": ["Not ready", "取消准备", "준비 해제"],
  "mp.human": ["Human", "玩家", "플레이어"],
  "mp.ai": ["AI", "AI", "AI"],
  // an AI seat named by its difficulty: {0} is Relaxed, Standard or Veteran
  "mp.aiPersona": ["AI ({0})", "AI（{0}）", "AI ({0})"],
  "mp.closed": ["Closed", "关闭", "닫힘"],
  "mp.seatOpen": ["Open seat", "空位", "빈 자리"],
  "mp.spectator": ["Spectator", "观战者", "관전자"],
  "mp.spectators": ["Spectators", "观战者", "관전자"],
  "mp.rosterUnknown": ["This server does not report who else is here.", "此服务器不提供在场玩家列表。", "이 서버는 다른 참가자가 누구인지 알려 주지 않습니다."],
  "mp.watch": ["Spectate", "观战", "관전"],
  "mp.kick": ["Kick", "踢出", "추방"],
  "mp.kickConfirm": [
    "Remove {0} from the server? They can rejoin with the join code.",
    "将 {0} 移出服务器？他们可以凭加入码重新加入。",
    "{0}을(를) 서버에서 내보낼까요? 참가 코드로 다시 참가할 수 있습니다."
  ],
  "mp.takeSeat": ["Wait for a seat", "等待席位", "자리 기다리기"],
  "mp.youWatch": ["You will watch the match from the start, with the whole map in view.", "你将从一开始观战本局，并能看到整张地图。", "처음부터 지도 전체를 보며 대전을 관전합니다."],
  "mp.youWatchNow": ["Joining the match as a spectator…", "正在以观战者身份加入对局…", "관전자로 대전에 참가하는 중…"],
  // {0} is the team's callsign (`game/teams.ts`), never a number
  "mp.team": ["Team {0}", "{0}队", "{0} 팀"],
  "mp.loadSave": ["Load local save", "载入本地存档", "로컬 저장 불러오기"],
  "mp.gameSave": ["Game save", "游戏存档", "게임 저장"],
  "mp.selectSave": ["Select save…", "选择存档…", "저장 선택…"],
  "mp.clearSave": ["Clear", "清除", "지우기"],
  "mp.clearSaveTip": [
    "Drop the loaded save. The lobby goes back to a generated map, and the factions reset.",
    "移除已载入的存档。大厅将回到随机生成的地图，阵营重置。",
    "불러온 저장을 내립니다. 로비는 생성 지도로 돌아가고 진영은 초기화됩니다."
  ],
  "mp.uploadSave": ["Upload a file…", "上传文件…", "파일 업로드…"],
  "mp.tabJoin": ["Join", "加入", "참가"],
  "mp.tabHost": ["Host", "架设", "호스트"],
  "mp.hostIntro": [
    "Run this on any Linux machine with a public address and it becomes a Steel Tide server. It prints what the host and the players need to join.",
    "在任意一台有公网地址的 Linux 机器上运行这条命令，它就会变成一台钢铁浪潮服务器，并输出房主和玩家加入所需的信息。",
    "공인 주소가 있는 아무 Linux 머신에서 이 명령을 실행하면 스틸 타이드 서버가 됩니다. 호스트와 플레이어가 참가하는 데 필요한 정보를 출력합니다."
  ],
  "mp.hostNote": [
    "Open TCP port 28785 in the firewall. The guide covers TLS, updates and removal.",
    "请在防火墙中开放 TCP 端口 28785。指南中还有 TLS、更新与卸载的说明。",
    "방화벽에서 TCP 포트 28785를 열어 주세요. 안내서에 TLS, 업데이트, 제거 방법이 있습니다."
  ],
  // under the command: the app's way to host
  "mp.hostAppIntro": [
    "Download the app to host a game on this device.",
    "下载应用，即可在此设备上架设对局。",
    "앱을 다운로드해 이 기기에서 게임을 호스팅하세요."
  ],
  "mp.serverGuide": ["How to set up a server", "如何架设服务器", "서버 설치 방법"],
  // the connect page's right band (`buildConnectPage`): what each way in is for, and what each field asks for
  "mp.explain.browse": [
    "The games on this network and the public rooms, each with who is in it and how it stands. Pick one to join it.",
    "本地网络上的游戏和公开房间，各自显示房间里有谁、进行到哪一步。选一个即可加入。",
    "이 네트워크의 게임과 공개 방을, 누가 있고 어떤 상태인지와 함께 보여 줍니다. 하나를 골라 참가하세요."
  ],
  "mp.explain.join": [
    "A server somebody runs: its address, and the code or the key its owner gave you, if any.",
    "他人运行的服务器：填写它的地址，以及服务器主人给你的加入码或主机密钥（如有）。",
    "누군가 운영하는 서버입니다. 주소와 함께, 서버 주인이 알려 준 참가 코드나 호스트 키가 있으면 입력하세요."
  ],
  "mp.explain.host": [
    "A game others can join: on this device in the app, or on a server of your own with one command.",
    "主持一局别人可以加入的游戏：在应用中用这台设备，或用一条命令在自己的服务器上。",
    "다른 사람이 참가할 수 있는 게임을 엽니다. 앱에서는 이 기기로, 아니면 명령 한 줄로 자신의 서버에서 엽니다."
  ],
  "mp.server.desc": [
    "The server's address: a host name or an IP, with its port after a colon where it is not the usual one.",
    "服务器地址：主机名或 IP；端口不是默认端口时，在冒号后写上端口。",
    "서버 주소입니다. 호스트 이름이나 IP를 쓰고, 기본 포트가 아니면 콜론 뒤에 포트를 붙입니다."
  ],
  "mp.joinCode.desc": [
    "The code the server's owner set on the door. Leave it empty for a server with none.",
    "服务器主人设置的加入码。服务器没有设置时留空。",
    "서버 주인이 정한 참가 코드입니다. 코드가 없는 서버라면 비워 두세요."
  ],
  "mp.hostKey.desc": [
    "The server's own password. Joining with it makes you the room's host: the console, the kicks and the saves are yours.",
    "服务器自身的密码。用它加入即成为房间的主机：控制台、踢人和存档都由你掌管。",
    "서버의 비밀번호입니다. 이 키로 참가하면 방의 호스트가 되어 콘솔, 강퇴, 저장을 맡습니다."
  ],
  "mp.hostName.desc": [
    "The name the game goes by on the network. It follows your commander's name until you give it one.",
    "这局游戏在网络上显示的名称。在你另起名字之前，它沿用你的指挥官名称。",
    "네트워크에서 게임이 불리는 이름입니다. 따로 정하기 전까지는 지휘관 이름을 따릅니다."
  ],
  "mp.hostJoinCode.desc": [
    "A code the players must type to come in. Leave it empty to let anyone on the network join.",
    "玩家进入时必须输入的码。留空则网络上的任何人都能加入。",
    "플레이어가 들어오려면 입력해야 하는 코드입니다. 비워 두면 네트워크의 누구나 참가할 수 있습니다."
  ],
  "mp.hostVisible.desc": [
    "Announce the game on this network, so it shows up in the others' Browse list.",
    "在本地网络上广播这局游戏，让它出现在其他人的浏览列表中。",
    "이 네트워크에 게임을 알려, 다른 사람의 찾아보기 목록에 나타나게 합니다."
  ],
  "mp.copyCommand": ["Copy command", "复制命令", "명령 복사"],
  "mp.startMatch": ["Start match", "开始对局", "대전 시작"],
  "mp.disconnect": ["Disconnect", "断开连接", "접속 끊기"],
  "mp.hostPaused": ["HOST PAUSED", "房主已暂停", "호스트가 일시 정지함"],
  "mp.unreachable": ["Could not reach {0}.", "无法连接到 {0}。", "{0}에 연결할 수 없습니다."],
  // the door's refusal over a name somebody on the server already holds; {0} is the name asked for
  "mp.nameTaken": [
    "A commander called {0} is already on this server. Choose another name.",
    "服务器上已有名为 {0} 的指挥官，请换一个名称。",
    "이 서버에 이미 {0}(이)라는 사령관이 있습니다. 다른 이름을 고르세요."
  ],
  "mp.checkPort": [
    "Check the address and port; a server listens on {0} unless it was changed.",
    "请检查地址与端口；除非另行更改，服务器监听 {0}。",
    "주소와 포트를 확인하세요. 서버는 바꾸지 않았다면 {0}에서 대기합니다."
  ],
  "mp.players": ["Players", "玩家", "플레이어"],
  "mp.ping": ["Ping", "延迟", "핑"],
  "mp.device.mobile": ["Mobile", "移动设备", "모바일"],
  "mp.device.desktop": ["Desktop", "桌面设备", "데스크톱"],
  "mp.you": ["you", "你", "나"],
  "mp.defeated": ["Defeated", "已淘汰", "패배"],
  "mp.disconnected": ["Disconnected", "已断开", "접속 끊김"],
  "mp.measuring": ["measuring…", "测量中…", "측정 중…"],
  "mp.behind": ["behind", "滞后", "지연"],
  "mp.connectionLost": ["Connection lost", "连接已断开", "연결이 끊어졌습니다"],
  "mp.exportSave": ["Export", "导出", "내보내기"],
  "mp.downloadSave": ["Download server save", "下载服务器存档", "서버 저장 다운로드"],
  "mp.returnLobby": ["Return everyone to lobby", "所有人返回大厅", "모두 로비로 돌려보내기"],
  // pressed from the lobby screen while a match is on without us: it ends that match
  "mp.endMatch": ["End match", "结束对局", "대전 종료"],
  "mp.returnLobbyConfirm": [
    "End the match in progress and bring everyone back to the lobby?",
    "结束进行中的对局并让所有人返回大厅？",
    "진행 중인 대전을 끝내고 모두를 로비로 돌려보낼까요?"
  ],
  "mp.matchOn": [
    "A match is in progress. The lobby opens again when it ends.",
    "对局正在进行中。对局结束后大厅将重新开放。",
    "대전이 진행 중입니다. 대전이 끝나면 로비가 다시 열립니다."
  ],
  // the server settings plate, behind the gear in the lobby's title strip
  // (`ui/serverSettings.ts`): the mods the room requires, the leader's to
  // set between matches, and the invite page beside it
  "mp.serverSettings": ["Server settings", "服务器设置", "서버 설정"],
  // the plate's second page, beside Mods (`mods.title`)
  "mp.tab.invite": ["Invite", "邀请", "초대"],
  "mp.mods.title": ["Required mods", "所需模组", "필요한 모드"],
  "mp.mods.intro": [
    "Pick the mods this server plays with. Everyone who joins must have them installed.",
    "选择本服务器使用的模组。加入的玩家必须安装这些模组。",
    "이 서버에서 사용할 모드를 고르세요. 참가하는 모든 플레이어가 설치해야 합니다."
  ],
  "mp.mods.none": ["None", "无", "없음"],
  "mp.mods.noneInstalled": [
    "You have no mods installed. Install some from Settings first.",
    "你尚未安装任何模组。请先在设置中安装。",
    "설치된 모드가 없습니다. 먼저 설정에서 설치하세요."
  ],
  // a mod that did not come from the registry: a guest cannot fetch it on their own
  "mp.mods.notRegistry": [
    "Not in the registry: players must install it themselves.",
    "不在官方仓库中：玩家需要自行安装。",
    "레지스트리에 없는 모드입니다. 플레이어가 직접 설치해야 합니다."
  ],
  // the leader's copy is behind the registry's, which is the only version a guest can fetch
  "mp.mods.updateFirst": [
    "The registry has {0}: update your copy before requiring it.",
    "官方仓库已有 {0}：请先更新你的模组再设为必需。",
    "레지스트리에 {0} 버전이 있습니다. 필수로 지정하기 전에 먼저 업데이트하세요."
  ],
  "mp.mods.bounceNote": [
    "Players without these mods will be asked to install them and rejoin.",
    "没有这些模组的玩家将被要求安装后重新加入。",
    "이 모드가 없는 플레이어는 설치 후 다시 참가하라는 안내를 받습니다."
  ],
  "mp.mods.apply": ["Apply", "应用", "적용"],
  "mp.mods.applied.toast": ["Required mods updated", "所需模组已更新", "필요한 모드를 갱신했습니다"],
  "mp.mods.manage": ["Manage mods…", "管理模组…", "모드 관리…"],
  // the read-only row in the lobby's rules pane
  "mp.mods.row": ["Mods", "模组", "모드"],
  // the plate a player meets at the door of a server that requires mods (`ui/requiredMods.ts`)
  "mp.modsRequired.title": ["Mods required", "需要模组", "모드 필요"],
  "mp.modsRequired.intro": [
    "This server plays with mods you do not have. Install them to join.",
    "本服务器使用了你尚未安装的模组。安装后即可加入。",
    "이 서버는 아직 설치하지 않은 모드를 사용합니다. 설치하면 참가할 수 있습니다."
  ],
  "mp.modsRequired.status": ["This server requires mods.", "本服务器需要模组。", "이 서버는 모드가 필요합니다."],
  "mp.modsRequired.install": ["Install and join", "安装并加入", "설치 후 참가"],
  "mp.modsRequired.installing": ["Installing {0}…", "正在安装 {0}…", "{0} 설치 중…"],
  "mp.modsRequired.missing": ["Not installed", "未安装", "설치되지 않음"],
  "mp.modsRequired.otherVersion": ["You have {0}", "你已安装 {0}", "{0} 버전이 설치됨"],
  "mp.modsRequired.notInRegistry": [
    "Not in the registry: install it yourself from Settings, Mods.",
    "不在官方仓库中：请在“设置 > 模组”中自行安装。",
    "레지스트리에 없습니다. 설정의 모드에서 직접 설치하세요."
  ],
  "mp.modsRequired.registryVersion": [
    "The registry has {0}; ask the host to update.",
    "官方仓库的版本是 {0}，请房主更新。",
    "레지스트리에는 {0} 버전이 있습니다. 호스트에게 업데이트를 요청하세요."
  ],
  "mp.modsRequired.checking": ["Checking the registry…", "正在查询模组仓库…", "레지스트리 확인 중…"],
  // the LAN page's badge on a game that requires mods
  "mp.lanMods": ["{0} mods", "{0} 个模组", "모드 {0}개"],
  // the invite section of the server settings plate: everything somebody
  // needs to join this room, each line with its copy button, and the whole
  // of it as one text to share
  "mp.invite": ["Invite players", "邀请玩家", "플레이어 초대"],
  "mp.inviteIntro": [
    "Whoever is joining enters these on the Join page of the Multiplayer screen.",
    "要加入的人在多人游戏界面的“加入”页填入这些信息即可。",
    "참가할 사람은 멀티플레이어 화면의 참가 페이지에 이 정보를 입력하면 됩니다."
  ],
  "mp.inviteAddress": ["Server address", "服务器地址", "서버 주소"],
  // the addresses a host reports on its own network: good on that network alone
  "mp.inviteLan": ["Address on this network", "本网络中的地址", "이 네트워크에서의 주소"],
  "mp.inviteLink": ["Invite link", "邀请链接", "초대 링크"],
  "mp.inviteLinkHint": [
    "Opens the game in a browser, already dialled in.",
    "在浏览器中打开游戏并自动连接。",
    "브라우저에서 게임을 열고 바로 접속합니다."
  ],
  // the room asks for no code
  "mp.inviteNoCode": ["None needed", "无需加入码", "필요 없음"],
  // the room asks for one, and this member came in on the host key without it
  "mp.inviteCodeUnknown": [
    "Set on the server; the host key let you in without it.",
    "由服务器设置；主机密钥让你无需输入即可进入。",
    "서버에서 설정합니다. 호스트 키로는 코드 없이 들어왔습니다."
  ],
  "mp.inviteHeading": ["Join my Steel Tide match", "来加入我的钢铁浪潮对局", "내 스틸 타이드 대전에 참가하세요"],
  "mp.inviteCopy": ["Copy invite", "复制邀请", "초대 복사"],
  "mp.inviteShare": ["Share…", "分享…", "공유…"],
  // the platform's own friends list, where a shell offers one (Steam)
  "mp.inviteFriends": ["Invite friends", "邀请好友", "친구 초대"],
  "common.copy": ["Copy", "复制", "복사"],
  "mp.copied": ["Copied", "已复制", "복사됨"],
  "mp.chat": ["Lobby chat", "大厅聊天", "로비 채팅"],
  // the same pane as a tab, on a folded screen (`setupTabs`): one word, since three tabs share a phone's column
  "mp.chatTab": ["Chat", "聊天", "채팅"],
  // the lobby's band on a large screen: the players and the talk under one tab
  "mp.roomTab": ["Players & chat", "玩家与聊天", "플레이어와 채팅"],
  "mp.chatEmpty": ["Nobody has said anything yet.", "还没有人说话。", "아직 아무도 말하지 않았습니다."],
  "mp.chatPlaceholder": ["Say something… (/t for team only)", "说点什么…（/t 仅队伍可见）", "메시지 입력… (/t 는 팀에게만)"],
  "mp.chatSend": ["Send", "发送", "보내기"],
  "chat.teamTag": ["[Team]", "[队伍]", "[팀]"],
  // the console's channel switch, where the prompt stood (a desktop's chat line)
  "chat.channel.all": ["To everyone. Click or press Tab to talk to your team", "发给所有人。点击或按 Tab 改为只发给队伍", "모두에게. 클릭하거나 Tab을 누르면 팀에게만"],
  "chat.channel.team": ["To your team only. Click or press Tab to talk to everyone", "只发给队伍。点击或按 Tab 改为发给所有人", "팀에게만. 클릭하거나 Tab을 누르면 모두에게"],
  "mp.spectating": ["SPECTATING", "观战中", "관전 중"],
  "spec.commentaryOn": ["Commentary On", "解说已开启", "해설 켜짐"],
  "spec.commentaryFailed": ["Live commentary stopped. The voice service could not respond; toggle commentary to try again.", "实时解说已停止。语音服务未能响应；请重新开启解说重试。", "실시간 해설이 중단되었습니다. 음성 서비스가 응답하지 못했습니다. 해설을 다시 켜서 재시도하세요."],
  "spec.commentaryDenied": ["Live commentary stopped. Unlock Developer Mode again to continue.", "实时解说已停止。请重新解锁开发者模式后继续。", "실시간 해설이 중단되었습니다. 개발자 모드를 다시 잠금 해제하세요."],
  "spec.commentaryVolume": ["Enable audio and raise the voice volume to hear live commentary.", "请启用音频并调高语音音量，以收听实时解说。", "실시간 해설을 들으려면 오디오를 활성화하고 음성 볼륨을 높이세요."],
  "spec.local.win": ["{0} won the match.", "{0}赢得了这场对局。", "{0} 진영이 이번 대전에서 승리했습니다."],
  "spec.local.winTeam": ["{0} and their allies won the match.", "{0}及其盟友赢得了这场对局。", "{0} 진영과 동맹이 이번 대전에서 승리했습니다."],
  "spec.local.finished": ["The match has ended.", "这场对局已经结束。", "이번 대전이 끝났습니다."],
  "spec.local.nuke": ["A nuclear weapon was launched. If it reaches a concentrated force or base, rebuilding could reshape the next phase.", "核武器已经发射。若命中密集部队或基地，接下来的局势可能取决于谁能更快重建。", "핵무기가 발사됐습니다. 밀집 병력이나 기지에 도달한다면 이후 국면은 재건 속도에 따라 달라질 수 있습니다."],
  "spec.local.eliminated": ["{0} has been eliminated from the match.", "{0}已被淘汰出局。", "{0} 진영이 대전에서 탈락했습니다."],
  "spec.local.mine": ["Damage cut output at {0}'s {1} to half rate. Repairing surviving income assets could pay back through future production.", "{0}的{1}受损导致产出减半。修复幸存的收入设施，有机会通过后续产出收回投入。", "{0}의 {1}: 손상으로 생산량이 절반으로 줄었습니다. 살아남은 수입 시설을 복구하면 이후 생산으로 투자분을 회수할 수 있습니다."],
  "spec.local.mine.alt": ["The damage to {0}'s {1} carried an economic cost before any destruction. Every interval left unrepaired would add to that bill.", "{0}的{1}即使没有被摧毁，受损也已造成经济代价。若迟迟不修复，这笔损失还会继续累积。", "{0}의 {1}: 파괴되기 전에도 손상만으로 경제적 손실이 생겼습니다. 복구가 늦어질수록 그 비용이 더 커질 수 있습니다."],
  "spec.local.production": ["Losing {0}'s {1} production line would narrow their replacement options. Protecting that investment could matter beyond a single exchange.", "如果失去{0}的{1}这条生产线，补充部队的选择就会减少。保住这笔投入，价值可能不止于一次交火。", "{0}의 {1} 생산 시설을 잃으면 병력 보충 선택지가 줄어듭니다. 이 투자를 지키는 가치는 한 번의 교전을 넘어설 수 있습니다."],
  "spec.local.production.alt": ["The replacement cost of {0}'s {1} would be only part of the loss. Time spent rebuilding the line could also delay the next army.", "对{0}而言，重建{1}的金属费用只是损失的一部分。恢复生产线所需的时间，也可能拖慢下一支部队成形。", "{0}의 {1}: 재건에 드는 금속은 손실의 일부일 뿐입니다. 생산 시설을 복구하는 시간도 다음 병력 편성을 늦출 수 있습니다."],
  "spec.local.range": ["Distance could favor {0}'s {1} against {2}'s {3}. Preserving that range advantage would offer more than simply closing in.", "{0}的{1}若对上{2}的{3}，保持距离可能更有利。贴近交战反而可能放弃射程带来的余地。", "{0}의 {1}: {2}의 {3}보다 사거리가 깁니다. 이 차이를 살릴 수 있다면 접근전보다 유리한 교환을 기대할 수 있습니다."],
  "spec.local.range.alt": ["For {0}'s {1}, the longer reach against {2}'s {3} creates an opportunity, not a guarantee. Giving up that distance could erase the advantage.", "{0}的{1}对{2}的{3}有更远的射程，但这只是机会，并不保证战果。若丢掉距离，优势也可能随之消失。", "{0}의 {1}: {2}의 {3}보다 긴 사거리는 기회일 뿐 승리를 보장하지 않습니다. 거리를 내주면 그 이점도 사라질 수 있습니다."],
  "spec.local.counter": ["The weapon matchup could favor {0}'s {1} over {2}'s {3}. Repeating that matchup might punish a force that does not adapt.", "{0}的{1}在武器与装甲的对抗中可能占优于{2}的{3}。如果兵种搭配不作调整，这种对抗可能反复付出代价。", "{0}의 {1}: 무기와 장갑 상성은 {2}의 {3}을 상대로 유리할 수 있습니다. 구성을 바꾸지 않으면 같은 상성에 반복해서 손해를 볼 수 있습니다."],
  "spec.local.counter.alt": ["{0}'s {1} offers a useful counter to {2}'s {3}. That could make changing the next production choice more valuable than simply replacing like for like.", "{0}的{1}能够针对{2}的{3}。面对这种克制，调整下一轮生产选择，可能比原样补充同类单位更有价值。", "{0}의 {1}: {2}의 {3}에 대응할 수 있는 병종입니다. 같은 유닛을 그대로 보충하기보다 다음 생산 구성을 바꾸는 편이 나을 수 있습니다."],
  "spec.local.repair": ["The damage to {0}'s force made recovery a possible investment. If surviving units can reach repair support, they may avoid needing full replacements.", "{0}部队遭受的损伤，让维修成为一项值得权衡的投入。幸存单位若能得到修复，就可能免去整辆重造的代价。", "{0} 부대의 손상은 복구에 투자할 이유가 됐습니다. 생존 병력이 수리 지원에 도달한다면 새로 생산할 필요를 줄일 수 있습니다."],
  "spec.local.repair.alt": ["For {0}, the next decision after those losses in health could be recovery rather than another trade. Repair access may preserve more of the original investment.", "对{0}而言，在承受这些损伤后，下一步可以是恢复战力，而非再换一次伤害。获得维修支援，可能保住更多原有投入。", "{0}의 다음 선택은 추가 교전보다 손상 복구가 될 수 있습니다. 수리 지원을 받으면 기존 투자분을 더 많이 보존할 수 있습니다."],
  "spec.local.damage": ["{0}'s force suffered substantial damage. Preserving any survivors could reduce the metal needed to rebuild after the exchange.", "{0}的部队受到了明显损伤。若能保住幸存单位，重建战力所需的金属就可能减少。", "{0} 부대가 상당한 손상을 입었습니다. 생존 병력을 보존하면 교전 뒤 전력을 재건하는 데 필요한 금속을 줄일 수 있습니다."],
  "spec.local.power": ["A power shortage cut {0}'s economic output at the last check. Restoring the grid could be worth more than adding another consumer.", "电力短缺压低了{0}的经济产出。恢复供电，可能比再添一座耗电设施更有价值。", "지난 확인에서 전력 부족이 {0}의 경제 생산량을 낮췄습니다. 전력 소비 시설을 늘리기보다 전력망 복구가 더 가치 있을 수 있습니다."],
  "spec.local.losses": ["{0} lost units in the last interval. Replacing them would compete with money for expansion or a different army composition.", "{0}出现了单位损失。补回这些单位，需要与扩张或调整兵种搭配争用资金。", "지난 구간에 {0}의 유닛 손실이 발생했습니다. 이를 보충하는 비용은 확장이나 병력 구성 변경에 쓸 자원과 경쟁하게 됩니다."],
  "spec.local.losses.alt": ["The unit losses for {0} have already created a rebuilding cost. The next production choices could determine whether the same trade happens again.", "{0}的单位损失已经带来了重建成本。下一轮生产选择，可能决定是否还会重复同样的交换。", "{0}의 유닛 손실은 이미 재건 비용을 만들었습니다. 다음 생산 선택에 따라 같은 교환이 반복될 수도, 달라질 수도 있습니다."],
  "spec.local.replacements": ["{0} produced units and suffered losses in the same interval. Those totals alone cannot establish whether the exchange was efficient.", "{0}补充了新单位，也遭受了损失。仅凭数量，还不能判断交换是否划算。", "같은 구간에 {0}의 유닛 생산과 손실이 모두 있었습니다. 이 수치만으로 교환이 효율적이었는지는 판단할 수 없습니다."],
  "spec.local.army": ["{0} committed more metal to combat units in the last interval. That added army value could widen their options in the next engagement.", "{0}投入作战单位的金属价值有所增加。这份新增战力，可能为下一次交战带来更多选择。", "지난 구간에 {0}의 전투 병력 금속 가치가 늘었습니다. 추가된 전력은 다음 교전의 선택지를 넓힐 수 있습니다."],
  "spec.local.army.alt": ["The rise in army value for {0} was a real investment. Preserving it through favorable exchanges could matter more than chasing a higher kill count.", "{0}部队价值的增长是一笔实在的投入。通过有利交换保住它，可能比追求更高击毁数更重要。", "{0}의 병력 가치 증가는 실제 투자였습니다. 격파 수를 늘리기보다 유리한 교환으로 그 전력을 보존하는 편이 중요할 수 있습니다."],
  "spec.local.income": ["{0}'s metal income improved at the last tally. If that gain holds, it could fund more replacements over a longer fight.", "{0}的金属收入有所提高。若能保住这份增长，较长的战斗里就可能获得更多补充。", "지난 집계에서 {0}의 금속 수입이 늘었습니다. 그 증가분을 유지하면 장기전에서 더 많은 병력을 보충할 수 있습니다."],
  "spec.local.income.alt": ["The income gain for {0} improved the return on their economy. Its value would accumulate over time, rather than deciding the next shot.", "{0}的收入增长改善了经济回报。这份优势的价值会随时间积累，而非直接决定下一发炮弹的结果。", "{0}의 수입 증가는 경제 투자 수익을 높였습니다. 그 가치는 다음 한 발보다 시간이 흐르면서 더 크게 드러날 수 있습니다."],
  "spec.local.incomeDown": ["{0}'s income fell in the last interval. If the shortfall persists, replacing future losses could become harder to finance.", "{0}的收入下降了。若缺口持续，未来补充损失所需的资金就可能更加紧张。", "지난 구간에 {0}의 수입이 줄었습니다. 부족분이 이어지면 이후 손실을 보충할 자금을 마련하기 어려워질 수 있습니다."],
  "spec.local.powerRestored": ["{0} restored full power by the last check. That recovery could improve the return from existing industry without building another production site.", "{0}已经恢复了完整供电。这次恢复可能让现有工业发挥更大作用，无需再建一条生产线。", "지난 확인까지 {0}의 전력이 완전히 복구됐습니다. 생산 시설을 추가하지 않아도 기존 산업의 효율이 회복될 수 있습니다."],
  "spec.local.buildingsLost": ["{0} lost structures in the last interval. Rebuilding those assets would compete with the budget for the next army.", "{0}损失了建筑。重建这些资产，将与下一支部队争用预算。", "지난 구간에 {0}의 건물 손실이 발생했습니다. 시설 재건은 다음 병력 편성 예산과 경쟁하게 됩니다."],
  "spec.local.built": ["{0} completed more structures. Protecting that investment could matter as much as funding the next batch of units.", "{0}完成了更多建筑。保护这笔投入，可能与筹措下一批单位的资金同样重要。", "{0} 진영이 건물을 추가로 완성했습니다. 이 투자를 보호하는 일은 다음 병력을 생산할 자금만큼 중요할 수 있습니다."],
  "spec.local.tech": ["{0} reached a higher production tier. The extra unit choices could change the next matchup if the supporting requirements are met.", "{0}达到了更高的生产等级。若配套条件齐备，新增的单位选择可能改变下一轮兵种对抗。", "{0} 진영이 더 높은 생산 단계에 도달했습니다. 필요한 조건을 갖춘다면 늘어난 유닛 선택지가 다음 상성을 바꿀 수 있습니다."],
  "spec.local.advanced": ["Higher-tier industry was part of the build we saw from {0}. That investment could pay off through more specialized replacements.", "{0}已建成较高等级的工业设施。这笔投入，有可能通过更专业的后续补充发挥价值。", "앞서 확인한 {0}의 건설에는 상위 단계 생산 시설이 포함됐습니다. 더 전문화된 병력을 보충할 수 있다면 그 투자가 가치를 낼 수 있습니다."],
  "spec.local.industry": ["Multiple production sites were visible for {0}. Given enough metal and power, parallel queues could rebuild a force faster.", "{0}对多座生产设施的投入，提供了并行生产的空间。若金属和电力足够，就可能更快恢复部队规模。", "앞서 {0}의 여러 생산 시설이 확인됐습니다. 금속과 전력이 충분하다면 병렬 생산으로 부대를 더 빨리 재건할 수 있습니다."],
  "spec.local.industry.alt": ["{0}'s investment in several production sites offers redundancy. Losing one line would not necessarily end their ability to replace units.", "{0}对多座生产设施的投入提供了余地。即使失去其中一条线，也未必会丧失补充部队的能力。", "{0}의 여러 생산 시설에 대한 투자는 여유를 제공합니다. 한 시설을 잃어도 병력 보충 능력 전체를 잃는 것은 아닐 수 있습니다."],
  "spec.local.expansion": ["{0} invested in multiple income sites. Those assets could reward a longer game if they survive future raids.", "{0}已在多处收入设施上投入资源。若这些资产能躲过后续袭击，较长的对局可能带来更好的回报。", "{0} 진영은 여러 수입 시설에 투자했습니다. 이후 습격에서 살아남는다면 긴 대전에서 더 큰 보상을 얻을 수 있습니다."],
  "spec.local.expansion.alt": ["The income sites seen for {0} represent more than a metal bill. Protecting their future output could make repeated army replacement sustainable.", "{0}的收入设施，其价值不只是建造费用。保住未来产出，就有可能支持多轮部队重建。", "앞서 확인한 {0}의 수입 시설 가치는 건설 비용에만 있지 않습니다. 미래 생산량을 지키면 반복적인 병력 재건을 뒷받침할 수 있습니다."],
  "spec.local.concentration": ["The {1} accounted for most of the combat investment we saw from {0}. Diversifying could reduce exposure to a single counter.", "这批{0}部队的投入以{1}为主。丰富兵种搭配，有助于降低被单一克制手段针对的风险。", "앞서 확인한 {0}의 전투 투자에서 {1} 비중이 가장 컸습니다. 병종을 다양화하면 한 가지 대응 수단에 노출되는 위험을 줄일 수 있습니다."],
  "spec.local.concentration.alt": ["Much of the visible combat value for {0} went into the {1}. If the opponent finds the right counter, adding more of the same could become costly.", "{0}的{1}占据了这批部队的大部分战斗价值。若对手找到了合适的克制手段，继续堆同一种单位就可能代价高昂。", "앞서 보인 {0}의 전투 가치 상당 부분은 {1}에 집중됐습니다. 상대가 적절한 대응책을 찾으면 같은 유닛을 늘리는 비용이 커질 수 있습니다."],
  "spec.local.air": ["The force seen from {0} included an air component. It could bypass ground obstacles, though anti-air weapons would change the risk.", "{0}投入的空中力量可以越过地面障碍。但若遭遇针对性防空，这份机动优势也可能伴随更高风险。", "앞서 확인한 {0} 부대에는 항공 전력이 포함됐습니다. 지상 장애물을 우회할 수 있지만 대공 무기에 따라 위험은 달라질 수 있습니다."],
  "spec.local.air.alt": ["{0}'s air investment could create options beyond ground routes. Whether that pays off would depend on target choice and enemy air defenses.", "{0}对空中力量的投入，可能带来地面路线之外的选择。能否收回价值，还要看目标选择与敌方防空。", "{0}의 항공 투자는 지상 경로 밖의 선택지를 만들 수 있습니다. 그 성과는 표적 선택과 적 대공 전력에 따라 달라질 수 있습니다."],
  "spec.local.airDefense": ["The force we saw from {0} included anti-air capability. Keeping that cover near valuable units could make a future air raid more expensive.", "若将防空力量安排在重要单位附近，{0}就可能提高敌方空袭的代价。", "앞서 확인한 {0} 부대에는 대공 능력이 있었습니다. 중요한 유닛 가까이에서 엄호한다면 이후 공습의 비용을 높일 수 있습니다."],
  "spec.local.splash": ["{0}'s force included blast weapons. An opponent that bunches units together could pay for that spacing in the next exchange.", "如果对手把单位挤在一起，{0}的范围杀伤武器就可能放大下一次交战的代价。", "{0} 부대에는 범위 피해 무기가 포함됐습니다. 상대가 유닛을 밀집시키면 다음 교전에서 그 배치의 대가를 치를 수 있습니다."],
  "spec.local.splash.alt": ["The blast capability seen for {0} could turn formation spacing into an economic decision. A single area hit might force several replacements.", "{0}的范围杀伤能力，让阵形间距也成为经济问题。一次区域命中，就可能带来多个单位的补充成本。", "앞서 확인한 {0}의 범위 피해 능력은 대형 간격을 경제적 선택으로 만들 수 있습니다. 한 번의 광역 명중이 여러 유닛의 보충 비용으로 이어질 수 있습니다."],
  "spec.local.standOff": ["Some weapons in {0}'s force had a minimum range. An escort could matter if an opponent gets inside that firing gap.", "{0}的部分武器存在最小射程。若对手钻入射击死角，护卫力量就可能格外重要。", "{0} 부대 일부 무기에는 최소 사거리가 있었습니다. 상대가 그 안쪽으로 접근한다면 호위 전력이 중요해질 수 있습니다."],
  "spec.local.standOff.alt": ["The minimum ranges in {0}'s force create a tradeoff. Supporting those weapons at close quarters could preserve the value of their longer reach.", "{0}部队中的最小射程带来了一项取舍。若能在近距离保护这些武器，就可能保住远程火力的价值。", "{0} 부대의 최소 사거리는 하나의 절충점입니다. 근거리에서 해당 무기를 지원하면 긴 사거리의 가치를 보존할 수 있습니다."],
  "spec.local.support": ["Repair support accompanied the force seen from {0}. If it survives with the combat units, recovery could reduce the need for full replacements.", "{0}的维修支援若能与作战单位一同幸存，修复就可能减少整辆重造的需求。", "앞서 확인한 {0} 부대에는 수리 지원이 있었습니다. 전투 유닛과 함께 살아남으면 복구를 통해 완전한 재생산 필요를 줄일 수 있습니다."],
  "spec.local.cap": ["At the last count, {0} had little room below the unit cap. Further production could hit that limit unless capacity becomes available.", "单位容量可能成为{0}下一轮生产的限制。能否腾出空间，将影响后续补充的节奏。", "지난 집계에서 {0}의 유닛 상한 여유가 적었습니다. 수용량이 확보되지 않으면 추가 생산이 상한에 막힐 수 있습니다."],
  "spec.local.reserves": ["{0} had a sizeable metal reserve at the last tally. Turning some of it into units could strengthen the next force, while saving some would preserve flexibility.", "{0}的金属储备提供了两种选择：投入一部分壮大下一支部队，或保留更多以备调整。", "지난 집계에서 {0}의 금속 비축량은 상당했습니다. 일부를 병력으로 바꾸면 다음 전력을 강화할 수 있고, 일부를 남기면 선택의 여유를 지킬 수 있습니다."],
  "spec.local.reserves.alt": ["The metal saved by {0} offered choices, but it had not yet become combat power. Production time would still separate that reserve from a stronger army.", "{0}存下的金属提供了选择，却尚未转化为战斗力。从储备到更强的部队，中间仍隔着生产时间。", "{0}의 비축 금속은 선택지를 제공했지만 아직 전투력은 아니었습니다. 그 자원이 더 강한 병력이 되기까지는 생산 시간이 필요합니다."],
  "spec.local.incomeLead": ["{0}'s team had an income edge over {1}'s at the last tally. If sustained, that could matter most after several rounds of rebuilding.", "{0}所在队伍的收入领先于{1}所在队伍。若能维持，多轮重建之后，这份优势可能更明显。", "지난 집계에서 {0}의 팀은 {1}의 팀보다 수입이 높았습니다. 이 차이를 유지하면 여러 차례 재건한 뒤 그 가치가 더 커질 수 있습니다."],
  "spec.local.incomeLead.alt": ["The income advantage belonged to {0}'s team over {1}'s in the last count. Extending the contest could favor that economy, provided its income assets survive.", "{0}所在队伍的收入高于{1}所在队伍。若收入设施能够幸存，拉长对抗可能更有利于这份经济基础。", "지난 집계의 수입 우위는 {1}의 팀보다 {0}의 팀에 있었습니다. 수입 시설이 살아남는다면 긴 대결이 그 경제력에 유리할 수 있습니다."],
  "spec.local.tradeoff": ["{0}'s team had more army value, while {1}'s had better income. A longer rebuilding phase could shift that balance if the economic advantage holds.", "{0}所在队伍的部队价值更高，而{1}所在队伍收入更强。若经济优势能保住，更长的重建阶段可能改变平衡。", "앞선 집계에서 {0}의 팀은 병력 가치가, {1}의 팀은 수입이 더 높았습니다. 경제 우위가 유지된다면 긴 재건 국면에서 균형이 바뀔 수 있습니다."],
  "spec.local.tradeoff.alt": ["The last tally gave {0}'s team the larger army investment and {1}'s the stronger economy. The result could depend on whether field strength converts before that income accumulates.", "{0}所在队伍投入部队更多，{1}所在队伍经济更强。结果可能取决于场上战力能否在收入优势累积前转化为战果。", "지난 집계에서 {0}의 팀은 병력 투자가, {1}의 팀은 경제력이 더 컸습니다. 수입 우위가 쌓이기 전에 전력을 성과로 바꿀 수 있는지가 결과를 좌우할 수 있습니다."],
  "spec.streaming": ["Streaming HUD", "直播界面", "방송 HUD"],
  "spec.streamingTip": ["Streaming HUD · Esc to exit", "直播界面 · 按 Esc 退出", "방송 HUD · Esc로 종료"],
  "spec.streamingSite": ["https://steeltide.io", "https://steeltide.io", "https://steeltide.io"],
  "spec.population": ["Population", "人口", "인구"],
  // the stands' board across the top of the map (ui/spectateBoard.ts)
  "spec.faction": ["Faction", "阵营", "진영"],
  "spec.h.metal": ["Metal", "金属", "금속"],
  "spec.h.income": ["Income", "收入", "수입"],
  "spec.h.army": ["Army", "军力", "병력"],
  "spec.h.pop": ["Units", "单位", "유닛"],
  "spec.h.tech": ["Tech", "科技", "기술"],
  "spec.h.kills": ["Kills", "击毁", "격파"],
  "spec.col.metal": ["Metal in the bank", "库存金属", "보유 금속"],
  "spec.col.income": ["Metal mined a second", "每秒开采的金属", "초당 채굴 금속"],
  "spec.col.army": ["What the army on the field cost, in metal", "场上军队的金属造价", "전장에 있는 병력의 금속 가치"],
  "spec.col.pop": ["Units against the cap", "单位数 / 上限", "유닛 수 / 한도"],
  "spec.col.tech": ["The highest level a production line stands at", "生产线的最高等级", "생산 라인의 최고 레벨"],
  "spec.col.kills": ["Units and buildings destroyed", "击毁的单位与建筑", "격파한 유닛과 건물"],
  "spec.seeingAll": ["Whole map", "全图视野", "전체 지도"],
  "spec.seeingAs": ["Seeing as {0}", "{0} 的视野", "{0}의 시야"],
  "spec.watchTip": ["See the field as this side does; again for the whole map", "以该方的视野观看；再点一次恢复全图", "이 진영의 시야로 보기, 다시 누르면 전체 지도"],
  "spec.aiSeesAll": ["The built-in AI sees the whole map: its side has no view of its own to watch", "内置 AI 无视野限制：该方没有可供观看的视野", "내장 AI는 전체 지도를 봅니다: 이 진영에는 볼 수 있는 시야가 따로 없습니다"],
  "spec.wholeMap": ["Whole map", "全图", "전체 지도"],
  "spec.wholeMapTip": ["Back to the whole map", "恢复全图视野", "전체 지도로 돌아가기"],
  "spec.fold": ["Fold the board", "收起面板", "패널 접기"],
  "spec.unfold": ["Open the board", "展开面板", "패널 펼치기"],
  "mp.kicked": ["Removed from the match by the host.", "已被房主移出对局。", "호스트가 대전에서 내보냈습니다."],
  "mp.mapChosen": ["The host picks the map.", "由房主选择地图。", "지도는 호스트가 고릅니다."],
  "mp.tooManyFactions": ["This map holds {0} factions; close the rest.", "此地图最多 {0} 个阵营，请关闭其余席位。", "이 지도는 진영 {0}개까지입니다. 나머지를 닫으세요."],
  "mp.needFaction": ["Open at least one faction to play.", "至少开放一个阵营才能开局。", "플레이하려면 진영을 하나 이상 여세요."],
  "mp.officialNeedsPlayers": [
    "Official servers require at least two connected human players seated in factions to start a match.",
    "官方服务器至少需要两名已连接并就座的真人玩家才能开局。",
    "공식 서버에서는 진영에 착석한 접속 중인 사람 플레이어가 두 명 이상이어야 대전을 시작할 수 있습니다."
  ],
  "mp.needPlayer": [
    "Nobody holds {0}; seat a player, or set it to AI or Closed.",
    "{0}无人就座。请安排玩家，或将其改为 AI 或关闭。",
    "{0} 진영에 아무도 없습니다. 플레이어를 앉히거나 AI 또는 닫힘으로 바꾸세요."
  ],
  "mp.needReady": ["Waiting for {0} to press Ready.", "等待 {0} 点击准备。", "{0}이(가) 준비를 누르기를 기다리는 중입니다."],
  // the Browse page's two sections: the games announced on the local network
  // (a section an app fills; a browser gets the signpost below), the public servers
  "mp.tabLan": ["LAN", "局域网", "LAN"],
  "mp.browsePublic": ["Public", "公开服务器", "공개 서버"],
  // a browser sees the LAN page too, as a signpost: the network is the app's to see
  "mp.lanBrowserIntro": [
    "Download the app to play over LAN.",
    "下载应用，即可通过局域网联机。",
    "앱을 다운로드해 LAN으로 플레이하세요."
  ],
  "mp.getApp": ["Get the app", "获取应用", "앱 받기"],
  "mp.lanEmpty": ["Scanning… games hosted on this network appear here.", "正在扫描…本网络中架设的对局会显示在这里。", "검색 중… 이 네트워크에서 호스팅되는 게임이 여기에 나타납니다."],
  // the scan that finds nothing: a subnet, a guest network or a firewall
  // eating multicast, and the address form is the way through all three
  "mp.lanNotFound": [
    "Cannot find your game? Some networks hide the announcement; ask the host for their address and type it in.",
    "找不到你的对局？有些网络会屏蔽广播；向房主要地址后手动输入。",
    "게임이 안 보이나요? 일부 네트워크는 알림을 숨깁니다. 호스트에게 주소를 물어 직접 입력하세요."
  ],
  "mp.lanPlayers": ["{0} players", "玩家 {0}", "플레이어 {0}명"],
  "mp.lanLocked": ["Needs a join code", "需要加入码", "참가 코드 필요"],
  "mp.lanVersion": [
    "A different game version; both copies must be updated to play together.",
    "游戏版本不同，双方都更新后才能一起游戏。",
    "게임 버전이 다릅니다. 함께 플레이하려면 양쪽 모두 업데이트해야 합니다."
  ],
  "mp.phase.lobby": ["In lobby", "大厅中", "로비"],
  "mp.phase.playing": ["Match in progress", "对局进行中", "대전 진행 중"],
  "mp.phase.paused": ["Paused", "已暂停", "일시 정지"],
  "mp.phase.ended": ["Match over", "对局结束", "대전 종료"],
  // ---- the Browse page: the public servers (net/servers.ts)
  "mp.tabBrowse": ["Browse", "浏览", "찾아보기"],
  "mp.browseIntro": [
    "Strangers meet here, so keep it kind: the room removes players for language, and the seated can vote one out.",
    "这里会遇到陌生人，请友善相待：言语不当会被移出，就座玩家也可以投票移出他人。",
    "낯선 사람을 만나는 곳이니 예의를 지켜 주세요. 욕설은 퇴장 사유이며 착석한 플레이어는 투표로 퇴장시킬 수 있습니다."
  ],
  "mp.browseLoading": ["Looking up the servers…", "正在查找服务器…", "서버를 찾는 중…"],
  "mp.browseEmpty": ["No public server is listed right now.", "目前没有公开的服务器。", "지금은 공개 서버가 없습니다."],
  "mp.browseOffline": [
    "The list could not be fetched; these are the servers this version knows.",
    "无法获取列表，以下是此版本内置的服务器。",
    "목록을 가져올 수 없어 이 버전에 내장된 서버를 표시합니다."
  ],
  "mp.browseRefresh": ["Refresh", "刷新", "새로 고침"],
  // {0} seated of {1} seats the match will have
  "mp.browseSeats": ["{0}/{1} seats", "{0}/{1} 席", "좌석 {0}/{1}"],
  "mp.browseFree": ["Free", "空闲", "비어 있음"],
  "mp.browseUnreachable": ["Unreachable", "无法连接", "연결 불가"],
  "mp.browseFull": ["Full", "已满", "만석"],
  "mp.browseVersion": [
    "This server runs another version of the game; update to join it.",
    "此服务器运行的是其他版本，请更新后再加入。",
    "이 서버는 다른 버전의 게임을 실행합니다. 업데이트 후 참가하세요."
  ],
  // ---- conduct: mute, report, the vote, and what the room says (mp.notice.*)
  "mp.mute": ["Mute", "屏蔽", "음소거"],
  "mp.unmute": ["Unmute", "取消屏蔽", "음소거 해제"],
  "mp.muted": ["{0} is muted: their chat is hidden on this device.", "已屏蔽 {0}：其聊天在本设备上不再显示。", "{0}님을 음소거했습니다. 이 기기에서는 채팅이 표시되지 않습니다."],
  "mp.report": ["Report…", "举报…", "신고…"],
  "mp.reportTitle": ["Report {0}", "举报 {0}", "{0} 신고"],
  "mp.reportIntro": [
    "The server's admin reads reports together with the last lines of chat. Nothing happens to the player on the spot.",
    "服务器管理员会连同最近的聊天记录一起查看举报。举报不会立即对该玩家产生影响。",
    "서버 관리자가 최근 채팅 내용과 함께 신고를 확인합니다. 신고해도 그 자리에서 바로 조치되지는 않습니다."
  ],
  "mp.reportReason": ["What happened", "发生了什么", "무슨 일이 있었나요"],
  "mp.reason.language": ["Language", "言语不当", "욕설"],
  "mp.reason.harassment": ["Harassment", "骚扰", "괴롭힘"],
  "mp.reason.griefing": ["Griefing or blocking the room", "搅局或阻碍开局", "방해 행위"],
  "mp.reason.cheating": ["Cheating", "作弊", "치팅"],
  "mp.reason.other": ["Something else", "其他", "기타"],
  "mp.reportNote": ["Anything else (optional)", "补充说明（可选）", "추가 설명(선택)"],
  "mp.reportSend": ["Send report", "发送举报", "신고 보내기"],
  "mp.voteKick": ["Vote to remove", "投票移出", "퇴장 투표"],
  "mp.voteKickConfirm": [
    "Call a vote to remove {0}? A majority of the seated players carries it, and they are kept out for a while.",
    "发起投票移出 {0}？多数就座玩家同意即通过，被移出者一段时间内无法再加入。",
    "{0} 퇴장 투표를 시작할까요? 착석한 플레이어 과반이 찬성하면 통과되며, 한동안 다시 들어올 수 없습니다."
  ],
  "mp.notice.voteCalled": ["{0} called a vote to remove {1} ({2}/{3})", "{0} 发起投票移出 {1}（{2}/{3}）", "{0}님이 {1} 퇴장 투표를 시작했습니다 ({2}/{3})"],
  "mp.notice.votePassed": ["{0} was removed by vote.", "{0} 已被投票移出。", "{0}님이 투표로 퇴장되었습니다."],
  "mp.notice.languageKick": ["{0} was removed for language.", "{0} 因言语不当被移出。", "{0}님이 욕설로 퇴장되었습니다."],
  "mp.notice.afk": ["{0} was moved to the stands: away while the room waited.", "{0} 长时间未响应，已移至观众席。", "{0}님이 자리를 비워 관전석으로 이동되었습니다."],
  "mp.notice.playerDisconnected": ["{0} has disconnected.", "{0} 已断开连接。", "{0}님의 연결이 끊어졌습니다."],
  "mp.notice.playerReconnected": ["{0} has reconnected.", "{0} 已重新连接。", "{0}님이 다시 연결되었습니다."],
  "mp.notice.say": ["Server: {0}", "服务器：{0}", "서버: {0}"],
  "mp.notice.reported": ["Your report on {0} was sent to the server's admin.", "对 {0} 的举报已发送给服务器管理员。", "{0}님에 대한 신고가 서버 관리자에게 전달되었습니다."],
  // a public room did not relay a line; {0} is how many more end in removal
  "mp.chatRefused": ["That message was not sent: it contains blocked content or a link. {0} more and you are out.", "该消息未发送：包含不允许的内容或链接。再有 {0} 次将被移出。", "차단된 내용이나 링크가 포함되어 메시지가 전송되지 않았습니다. {0}번 더 반복하면 퇴장됩니다."],
  "mp.removedLanguage": ["Removed from the server for language.", "因言语不当被移出服务器。", "욕설로 서버에서 퇴장되었습니다."],
  "mp.removedVote": ["Removed from the server by a vote of the players.", "经玩家投票被移出服务器。", "플레이어 투표로 서버에서 퇴장되었습니다."],
  "mp.removedBanned": ["Removed from the server by its admin.", "已被服务器管理员移出。", "서버 관리자가 퇴장시켰습니다."],
  "mp.nameRefused": ["That name is not allowed here. Choose another.", "此名称不可用，请换一个。", "이 이름은 사용할 수 없습니다. 다른 이름을 고르세요."],
  "mp.chatContentRefused": ["That message contains content that is not allowed here. Please edit it before sending.", "该消息包含不允许的内容，请修改后再发送。", "이곳에서 허용되지 않는 내용이 포함되어 있습니다. 메시지를 수정한 뒤 보내 주세요."],
  "mp.hostLanIntro": [
    "Host a game on this device. Players on your network find it under LAN; anyone else joins with the address the lobby shows.",
    "在此设备上架设对局。同一网络的玩家可在“局域网”页找到它；其他人用大厅中显示的地址加入。",
    "이 기기에서 게임을 호스팅합니다. 같은 네트워크의 플레이어는 LAN에서 찾고, 그 밖의 사람은 로비에 표시된 주소로 참가합니다."
  ],
  "mp.hostName": ["Server name", "服务器名称", "서버 이름"],
  "mp.hostNameDefault": ["{0}'s game", "{0} 的对局", "{0}의 게임"],
  "mp.hostJoinCode": ["Join code (optional)", "加入码（可选）", "참가 코드(선택)"],
  "mp.hostJoinCodeHint": ["Leave empty to let anyone on the network join", "留空则本网络中任何人都可加入", "비워 두면 네트워크의 누구나 참가할 수 있습니다"],
  "mp.hostVisible": ["Visible on this network", "在本网络中可见", "이 네트워크에 표시"],
  "mp.startHosting": ["Start hosting", "开始架设", "호스팅 시작"],
  "mp.starting": ["Starting the server…", "正在启动服务器…", "서버 시작 중…"],
  "mp.hostFailed": ["Could not start the server: {0}", "无法启动服务器：{0}", "서버를 시작할 수 없습니다: {0}"],
  // ------------------------------------------------------------- maps
  "map.greenfield": ["Greenfield", "绿野", "그린필드"],
  "map.greenfield.style": ["Open pasture with room to manoeuvre and few natural walls.", "开阔牧野，回旋余地充足，天然屏障稀少。", "기동할 여지가 넉넉하고 천연 장벽이 적은 탁 트인 목초지."],
  "map.twinBays": ["Twin Bays", "双子湾", "쌍둥이 만"],
  "map.twinBays.style": ["Two sheltered bays cut the land in half.", "两处避风海湾把陆地一分为二。", "아늑한 만 두 곳이 땅을 반으로 가릅니다."],
  "map.archipelago": ["Archipelago", "群岛", "군도"],
  "map.archipelago.style": [
    "Scattered islands and narrow straits; nothing crosses without a hull or a wing.",
    "岛屿零散、海峡狭窄，没有海空军便寸步难行。",
    "흩어진 섬과 좁은 해협. 선체나 날개 없이는 아무것도 건너지 못합니다."
  ],
  "map.riftValley": ["Rift Valley", "裂谷", "열곡"],
  "map.riftValley.style": ["Mountain ridges channel every advance into a handful of passes.", "山脊把每一次推进都逼进少数几处隘口。", "산줄기가 모든 진격을 몇 개의 고개로 몰아넣습니다."],
  "map.burnoutHighway": ["Burnout Highway", "燃速公路", "번아웃 하이웨이"],
  "map.burnoutHighway.style": [
    "A four-lane highway straight across open country: a town astride it at either end, a burnt-out crossroads in the middle, and a ring road round it past a village and a wood.",
    "一条四车道公路笔直横穿旷野：两端各有一座城镇跨路而建，中央是烧毁的十字路口，外围一圈环路途经村庄和树林。",
    "탁 트인 들판을 곧게 가로지르는 4차선 고속도로: 양 끝에는 도로를 끼고 선 마을, 한가운데에는 불탄 교차로, 그리고 그 둘레를 돌며 마을과 숲을 지나는 순환 도로."
  ],
  "map.pripet": ["Pripet Marshes", "普里皮亚季沼泽", "프리퍄트 습지"],
  "map.pripet.style": [
    "The bog on the Pripyat: causeways across marsh and pine islands, one bridge in the river town at the centre, and a ford upstream on each side.",
    "普里皮亚季河畔的大沼泽：堤道穿过沼地与松林岛，中央河镇里只有一座桥，两侧上游各有一处浅滩。",
    "프리퍄트 강의 늪지대: 습지와 소나무 섬을 가로지르는 둑길, 한가운데 강변 마을의 다리 하나, 그리고 양쪽 상류의 여울 하나씩."
  ],
  "map.ladoga": ["Lake Ladoga", "拉多加湖", "라도가 호"],
  "map.ladoga.style": [
    "The lake frozen in the winter of the siege: an ice road over the open ice between two taiga shores, open water round the island in the middle, and the long way round by Shlisselburg.",
    "围城之冬冰封的湖面：两岸泰加林之间，一条冰上道路横越开阔冰面，湖心岛周围的水面没有封冻，陆路则要绕经施吕瑟尔堡。",
    "포위전의 겨울에 얼어붙은 호수: 타이가 숲 두 기슭 사이 트인 빙판을 가로지르는 얼음길, 호수 한가운데 섬 둘레의 얼지 않은 물, 그리고 실리셀부르크를 돌아가는 먼 길."
  ],
  "map.shatteredCity": ["Shattered City", "破碎城区", "부서진 도시"],
  "map.shatteredCity.style": [
    "A city on a river, fought street by street: three bridges, a flattened centre between them, and rubble lanes the shelling cut through the blocks.",
    "一座临河的城市，逐街争夺：三座桥，桥间被夷平的市中心，以及炮火在街区中轰出的瓦砾通道。",
    "강을 낀 도시, 거리마다 벌어지는 싸움: 다리 셋, 그 사이의 평평해진 도심, 그리고 포격이 블록 사이로 뚫어 놓은 잔해 통로."
  ],
  "map.caldera": ["Caldera Crown", "火山王冠", "칼데라 크라운"],
  "map.caldera.style": [
    "A volcano on an ash plain: three walled terraces up to the crater rim, the ore round a lava lake inside it, and four lava flows down the flanks with a causeway over each.",
    "灰原上的一座火山：三层崖壁台地直上火口缘，火口内的熔岩湖周围有矿脉，四条熔岩流沿山坡而下，每条上各有一道堤道。",
    "잿빛 평원 위의 화산: 절벽으로 둘러싸인 세 단의 대지가 분화구 가장자리까지 오르고, 그 안 용암 호수 둘레에 광석이 있으며, 네 줄기 용암류가 산비탈을 타고 내려오고 그 위마다 둑길이 하나씩 놓여 있습니다."
  ],
  "map.hormuz": ["Strait of Hormuz", "霍尔木兹海峡", "호르무즈 해협"],
  "map.hormuz.style": [
    "Two desert coasts under bare mountains, and the strait between: an oilfield and a port city on each, a long island behind a mangrove channel, and reefs that squeeze the fleets into the deep water.",
    "荒山下的两道沙漠海岸隔峡相望：两岸各有油田与港城，一座长岛隔着红树林水道，暗礁把舰队逼进中央深水航道。",
    "민둥산 아래 사막 해안 둘과 그 사이의 해협: 양쪽마다 유전과 항구 도시, 맹그로브 수로 너머의 긴 섬, 그리고 함대를 깊은 물로 몰아넣는 암초."
  ],
  "map.kazungula": ["Kazungula", "卡宗古拉", "카중굴라"],
  "map.kazungula.style": [
    "Savanna where the Chobe meets the Zambezi: three banks between three rivers, a bridge by the confluence and a ford upstream between every two, and a sandbar island in the pool.",
    "乔贝河汇入赞比西河处的稀树草原：三条河隔出三片河岸，每两岸之间在汇流处附近有一座桥、上游有一处浅滩，汇流潭中还有一座沙洲岛。",
    "초베 강이 잠베지 강과 만나는 사바나: 세 강 사이의 세 기슭, 두 기슭 사이마다 합류점 근처의 다리 하나와 상류의 여울 하나, 그리고 합류 웅덩이의 모래톱 섬."
  ],
  "map.lucerne": ["Lake Lucerne", "琉森湖", "루체른 호"],
  "map.lucerne.style": [
    "Six valleys round an Alpine lake: a town and a delta at the head of each arm, a ridge with one pass between every two valleys, and glaciers under the peaks.",
    "高山湖畔的六条山谷：每道湖湾尽头有一座小镇和一片三角洲，每两条山谷之间隔着一道只有一处山口的山脊，峰下是冰川。",
    "알프스 호수를 둘러싼 여섯 골짜기: 호수 갈래 끝마다 마을과 삼각주, 골짜기 둘 사이마다 고개 하나 난 능선, 그리고 봉우리 아래의 빙하."
  ],
  "map.sichuan": ["Sichuan Basin", "四川盆地", "쓰촨 분지"],
  "map.sichuan.style": [
    "The Chengdu plain beneath the western mountains, wooded foothills to the north, and long ridges to the east; the Yangtze crosses the south, with river towns and roads through the basin.",
    "西部群山脚下是成都平原，北面是林木覆盖的丘陵，东面山岭绵长；长江横贯南部，河畔城镇与道路散布盆地。",
    "서쪽 산맥 아래 펼쳐진 청두 평야, 북쪽의 숲 덮인 구릉과 동쪽의 긴 능선. 남쪽을 가로지르는 양쯔강을 따라 강변 마을이 서 있고 분지에는 도로가 이어집니다."
  ],
  "map.solomonIslands": ["Solomon Islands", "所罗门群岛", "솔로몬 제도"],
  "map.solomonIslands.style": [
    "Three jungle islands in a row under an estuary: a harbour and a plantation on the western one, a village on the central one, a beach and a bunker ridge on the eastern one, and a swamp ford and a bridge between them.",
    "河口之下三座丛林岛屿一字排开：西岛有港口与种植园，中岛是村庄，东岛有海滩与碉堡山脊，岛与岛之间是沼泽浅滩和一座桥。",
    "하구 아래 나란히 늘어선 정글 섬 셋: 서쪽 섬에는 항구와 농장, 가운데 섬에는 마을, 동쪽 섬에는 해변과 벙커 능선, 그 사이에 늪 여울과 다리 하나."
  ],
  "map.santaBarbara": ["Santa Barbara Channel", "圣巴巴拉海峡", "샌타바버라 해협"],
  "map.santaBarbara.style": [
    "The Southern California Bight, where oil was first drilled from the sea: six islands and the mainland at Point Mugu, and most of the ore out on the fields at sea, the channel's platforms among them.",
    "南加州湾，人类最早在海上钻采石油的地方：六座岛屿与穆古角所在的大陆，大部分矿藏都在海上矿区，海峡里的钻井平台也在其中。",
    "인류가 처음으로 바다에서 석유를 시추한 남캘리포니아 만: 여섯 개의 섬과 포인트 무구가 있는 본토, 그리고 해협의 시추 플랫폼들이 있는 해상 광구에 놓인 광석 대부분."
  ],
  "map.pacificStorm": ["Pacific Storm", "太平洋风暴", "퍼시픽 스톰"],
  "map.pacificStorm.style": [
    "An island chain in open sea: an airfield island in the west with the strip up its spine, a knot of islands in the middle cut by shallow channels and a lagoon, and an anchorage among skerries out to the east.",
    "大洋中的一条岛链：西面是机场岛，跑道沿岛脊延伸；正中一簇岛屿被浅水航道和一片潟湖切开；东面的开阔海上有一处锚地和一串散落的礁屿。",
    "먼바다의 열도 하나: 서쪽에 등줄기를 따라 활주로가 놓인 비행장 섬, 얕은 수로와 석호로 갈라진 한가운데의 섬 무리, 그리고 동쪽 먼바다의 흩어진 암초 섬 사이의 정박지."
  ],
  "map.iwoJima": ["Iwo Jima", "硫磺岛", "이오지마"],
  "map.iwoJima.style": [
    "A volcanic island: Suribachi walled at the south-western tip, the neck and the landing beaches, a terrace with the first airfield, and the Motoyama plateau on the head, falling into the sea from Kama Rock round Kitano Point and down the whole east coast, with the richest ore on the map up top.",
    "一座火山岛：西南端是崖壁环绕的折钵山，然后是岛颈和登陆海滩、带第一座机场的台地，岛头是元山高原，从釜岩绕北角直到整条东岸都直落入海，全图最富的矿藏就在高原之上。",
    "화산섬 하나: 남서쪽 끝의 절벽에 둘러싸인 스리바치산, 잘록한 목과 상륙 해변, 첫 비행장의 단구, 그리고 가마바위에서 기타노곶을 돌아 동해안 전체로 바다에 떨어지는 섬 머리의 모토야마 고원, 그 위에 지도에서 가장 부유한 광석."
  ],
  "map.wakeIsland": ["Wake Island", "威克岛", "웨이크섬"],
  "map.wakeIsland.style": [
    "An atoll: Wake a V with the airstrip along its southern leg and Downtown on its arm, Wilkes and Peale each over a bridged channel, and a reef flat round the lagoon, open at the north-western end.",
    "一座环礁：威克岛呈V形，跑道沿南臂延伸，市区在北臂上；威尔克斯岛和皮尔岛各隔一道水道，有桥相连；潟湖四周是浅滩礁坪，只在西北端敞开。",
    "환초 하나: 남쪽 팔을 따라 활주로가 놓이고 팔 끝에 다운타운이 있는 V자 모양의 웨이크, 다리 놓인 수로 건너의 윌크스와 필, 그리고 북서쪽 끝만 열린 채 석호를 두른 산호초 여울."
  ],
  "map.coastRoad": ["Coast Road", "海岸公路", "해안 도로"],
  "map.coastRoad.style": [
    "A desert strip between the Gulf and an escarpment, the coast road its whole length: a landing ground at the west end, an oasis, a town astride the road, an oilfield at the east end, and a wadi and a salt flat to cross between them.",
    "海湾与陡崖之间的一条沙漠地带，海岸公路贯穿全程：西端是登陆场，然后是绿洲、横跨公路的小镇，东端是油田，中间还有干河谷和盐滩要穿越。",
    "만과 절벽 사이의 사막 띠에 끝까지 이어진 해안 도로: 서쪽 끝의 상륙장, 오아시스, 길에 걸터앉은 마을, 동쪽 끝의 유전, 그리고 그 사이에 건너야 할 와디와 염전."
  ],
  "map.threeGates": ["Three Gates", "三重关", "세 관문"],
  "map.threeGates.style": [
    "A canyon north through the mountains with three plateaus across it, each gated by one road through its rim, and ore in the pockets off the road.",
    "一条穿山北去的峡谷，横卧着三座高地，每座只有一条穿过崖沿的道路作为关门，矿藏在公路两侧的口袋里。",
    "산맥을 뚫고 북으로 난 협곡에 고원 셋이 가로놓여 있고, 각각 절벽 테두리를 지나는 길 하나가 관문이며, 광석은 길에서 벗어난 주머니 지형에 있습니다."
  ],
  "map.random": ["Random Map", "随机地图", "무작위 지도"],
  "map.random.style": [
    "A fresh layout every match, with exactly as many homelands as there are players in the game.",
    "每局都是全新布局，家园数量与参战人数一致。",
    "매 대전마다 새 배치에, 본거지 수는 참가 플레이어 수와 정확히 같습니다."
  ],
  // the climates a generated map is drawn in (game/biomes.ts) — the name it is
  // announced under, and the promise of what the ground will be like
  "climate.heartland": ["Heartland", "腹地", "중심지"],
  "climate.taiga": ["Taiga", "泰加林", "타이가"],
  "climate.badlands": ["Badlands", "荒原", "황무지"],
  "climate.ashlands": ["Ashlands", "焦土", "잿더미 땅"],
  "climate.coastland": ["Coastland", "滨海", "해안 지대"],
  "climate.fenlands": ["Fenlands", "沼原", "늪지대"],
  "climate.frozenSea": ["Frozen Sea", "冰海", "얼어붙은 바다"],
  "climate.archipelago": ["Island Chain", "岛链", "열도"],
  // ------------------------------------------------------------- campaign
  "campaign.title": ["Campaign", "战役", "캠페인"],
  "campaign.mission": ["Mission {0}", "第 {0} 关", "임무 {0}"],
  "campaign.locked": ["Complete the previous mission to unlock.", "完成上一关后解锁。", "이전 임무를 완료하면 열립니다."],
  "campaign.completed": ["Completed", "已完成", "완료"],
  "campaign.replay": ["Replay", "重玩", "다시 하기"],
  "campaign.missions": ["Missions", "任务列表", "임무"],
  "campaign.brief": ["Briefing", "任务简报", "브리핑"],
  "campaign.objectives": ["Objectives", "任务目标", "목표"],
  "campaign.progress.reset": ["Reset progress", "重置进度", "진행 초기화"],
  "campaign.progress.resetConfirm": ["Reset all campaign progress?", "确定重置全部战役进度？", "캠페인 진행을 모두 초기화할까요?"],
  // ---- the campaign: the Gulf War of 1990–91 under other flags (docs/CAMPAIGN.md).
  // Each mission carries a name, a dateline, a background card (paragraphs
  // apart by a blank line, read in silence) and Command's orders (read by the
  // narrator: `briefing.mN` in core/voice.ts).
  "m1.name": ["Desert Shield", "沙漠盾牌", "사막의 방패"],
  "m1.date": ["8 August 1990 · 0600 · Ras Hadar, the Kingdom", "1990 年 8 月 8 日 · 0600 · 拉斯哈达尔，王国", "1990년 8월 8일 · 0600 · 라스 하다르, 왕국"],
  "m1.background": [
    "On 2 August 1990, at two in the morning, the army of the Republic of Qarash crossed the border into the Emirate of Sarab. Four divisions of the Guard led. Sarab had sixteen thousand soldiers under arms; by the second evening it had none in the field, and its ruler was over the southern border in a convoy of cars.\n\nQarash now held a fifth of the world’s oil under one flag, and its columns had stopped on the Kingdom’s border, facing south.\n\nThirty-four nations answered. Under one command they took a name: the Concord. On 7 August its first aircraft landed at Ras Hadar on the Kingdom’s coast, three hundred kilometres from the border. What it needed next was ground, metal and a war factory.",
    "1990 年 8 月 2 日凌晨两点，卡拉什共和国的军队越过边境，进入萨拉布酋长国。近卫军的四个师打头阵。萨拉布有一万六千名武装士兵；到第二天傍晚，战场上一个也不剩，它的统治者已乘车队越过南面的边境。\n\n卡拉什如今把全世界五分之一的石油收在一面旗下，它的纵队停在王国的边境上，面朝南方。\n\n三十四个国家做出了回应。它们在一个指挥部之下取了一个名字：协约。8 月 7 日，协约的第一批飞机降落在王国海岸的拉斯哈达尔，距边境三百公里。接下来它需要的是土地、金属，和一座战车工厂。",
    "1990년 8월 2일 새벽 두 시, 카라시 공화국군이 국경을 넘어 사라브 토후국으로 들어갔다. 근위군 4개 사단이 앞장섰다. 사라브에는 무장 병력 1만 6천 명이 있었다. 둘째 날 저녁에는 전장에 한 명도 남지 않았고, 통치자는 승용차 행렬로 남쪽 국경을 넘어 있었다.\n\n카라시는 이제 세계 석유의 5분의 1을 한 깃발 아래 두었고, 그 종대는 왕국 국경에서 남쪽을 향한 채 멈춰 있었다.\n\n서른네 나라가 응답했다. 하나의 지휘 아래 그들은 이름을 택했다. 콩코드. 8월 7일, 첫 항공기가 왕국 해안의 라스 하다르에 내렸다. 국경에서 300킬로미터. 다음에 필요한 것은 땅과 금속, 그리고 전차 공장이었다."
  ],
  "m1.brief": [
    "Command online. We hold the port and nothing else. Raise extractors on the deposits along the coast road and put up a war factory. A Qarashi screening force has crossed the line to see what we have; it sits on the escarpment to the north. Build a column and clear it out. Command will walk you through the basics.",
    "指挥系统上线。我们只握着港口，别的什么都没有。在海岸公路沿线的矿脉上建起采矿场，再立一座战车工厂。一支卡拉什侦察部队越线来探我们的虚实，它盘踞在北面的陡崖上。组建一支纵队，把它清出去。指挥部会带你熟悉基础操作。",
    "지휘부 온라인. 우리가 쥔 것은 항구뿐입니다. 해안 도로를 따라 광맥에 채굴장을 세우고 전차 공장을 올리십시오. 카라시 정찰대가 우리 형편을 보러 선을 넘어왔습니다. 북쪽 절벽 위에 앉아 있습니다. 종대를 만들어 쓸어내십시오. 기본 조작은 지휘부가 안내합니다."
  ],
  "m2.name": ["Instant Thunder", "瞬间雷霆", "인스턴트 선더"],
  "m2.date": ["17 January 1991 · 0238 · The southern desert", "1991 年 1 月 17 日 · 0238 · 南部沙漠", "1991년 1월 17일 · 0238 · 남부 사막"],
  "m2.background": [
    "The Concord gave Qarash until 15 January to leave Sarab. Five months of the largest deployment since 1945 went into the desert behind that date: half a million soldiers, four thousand tanks, and an air fleet on every runway within reach.\n\nThe date passed. Qarash stayed. On the night of 16 January the first helicopters crossed the border low to take out the radar stations in the west, and behind them the sky filled.\n\nAt 0238 on the 17th the air war began. Its first targets were the eyes of the Qarashi air defence: the radars, the missile belts, then the airfields themselves. The first bomb fell on the capital at 0300, live on television.",
    "协约给卡拉什的期限是 1 月 15 日之前撤出萨拉布。这个日期背后，是五个月里 1945 年以来规模最大的部署：五十万士兵、四千辆坦克，以及触手可及的每一条跑道上停满的机群。\n\n期限过去了。卡拉什没有走。1 月 16 日夜里，第一批直升机贴地越过边境，摧毁西部的雷达站，它们身后，天空被填满了。\n\n17 日 0238，空战开始。第一批目标是卡拉什防空体系的眼睛：雷达、导弹阵地带，然后是机场本身。0300，第一枚炸弹落在首都，电视直播。",
    "콩코드는 카라시에 1월 15일까지 사라브에서 물러나라는 기한을 주었다. 그 날짜 뒤에는 다섯 달에 걸친 1945년 이래 최대 규모의 전개가 있었다. 병력 50만, 전차 4천 대, 닿는 모든 활주로를 채운 항공 전력.\n\n기한이 지났다. 카라시는 남았다. 1월 16일 밤, 첫 헬기들이 서부의 레이더 기지를 부수러 국경을 낮게 넘었고, 그 뒤로 하늘이 가득 찼다.\n\n17일 0238, 항공전이 시작됐다. 첫 표적은 카라시 방공의 눈이었다. 레이더, 미사일 벨트, 그리고 비행장 자체. 0300에 첫 폭탄이 수도에 떨어졌다. 텔레비전 생중계로."
  ],
  "m2.brief": [
    "Command online. The radars come first: two stations north of the ridge feed every missile battery in the sector, and while they stand our aircraft die. Put up an airbase, take the radars down, then the airfields behind them. Expect their bombers to hit us the whole time. Keep the headquarters standing.",
    "指挥系统上线。先打雷达：山脊以北的两座雷达站为这一区域的每一处导弹阵地提供引导，它们不倒，我们的飞机就会不断坠落。建一座空军基地，敲掉雷达，再敲掉它们身后的机场。整个过程中他们的轰炸机都会来袭。总部必须屹立不倒。",
    "지휘부 온라인. 레이더가 먼저입니다. 능선 북쪽의 기지 두 곳이 이 구역의 모든 미사일 포대를 먹여 살리고, 그것이 서 있는 한 우리 항공기는 죽습니다. 공군 기지를 세우고 레이더를 떨어뜨린 뒤, 그 뒤의 비행장을 치십시오. 내내 적 폭격기가 우리를 때릴 것입니다. 사령부를 지키십시오."
  ],
  "m3.name": ["Sarsar Hunt", "猎杀萨尔萨尔", "사르사르 사냥"],
  "m3.date": ["18 January 1991 · 0300 · The western desert", "1991 年 1 月 18 日 · 0300 · 西部沙漠", "1991년 1월 18일 · 0300 · 서부 사막"],
  "m3.background": [
    "On the second night of the air war Qarash answered with the one weapon that could reach past the front. Sarsar: a ballistic missile on a wheeled launcher, a ton of warhead, a range of six hundred kilometres. Seven fell on cities across the border that night. Over the next six weeks, eighty-eight.\n\nThey could not be aimed at anything smaller than a city, and that was the point. Every launch was a test of whether the Concord would hold together; every launch put a neighbour a night closer to entering the war and breaking it.\n\nFinding a launcher took an aircraft over it within minutes of the flash. The western desert had a thousand wadis to hide in. A third of the air war went into the hunt.\n\nRound the ports and the capital stood batteries of interceptor missiles, and from the first night they fired at what came down. How many they stopped was argued over for years.",
    "空战的第二个夜晚，卡拉什用唯一一种能够越过前线的武器做出了回答。萨尔萨尔：装在轮式发射车上的弹道导弹，一吨重的弹头，六百公里射程。那一夜有七枚落在边境另一侧的城市里。此后六周，八十八枚。\n\n它们瞄不准比一座城市更小的东西，而这正是用意所在。每一次发射都是对协约能否维系的考验；每一次发射都让某个邻国离参战、离让协约瓦解更近一夜。\n\n要找到一辆发射车，必须在火光亮起后几分钟内让一架飞机飞到它头顶。西部沙漠有一千条干河谷可以藏身。三分之一的空战投进了这场猎杀。\n\n港口和首都周围部署着一个个拦截导弹连，从第一夜起就向落下来的东西开火。它们究竟拦下了多少，人们争论了很多年。",
    "항공전 둘째 밤, 카라시는 전선 너머에 닿을 수 있는 유일한 무기로 응답했다. 사르사르. 차륜 발사대에 실린 탄도 미사일, 1톤짜리 탄두, 사거리 600킬로미터. 그날 밤 국경 너머 도시들에 일곱 발이 떨어졌다. 이후 여섯 주 동안 여든여덟 발.\n\n도시보다 작은 것은 겨눌 수 없었고, 바로 그것이 목적이었다. 발사 하나하나가 콩코드가 버틸 수 있는지에 대한 시험이었다. 발사 하나하나가 이웃 나라를 참전과 동맹의 파열에 하룻밤씩 더 가깝게 밀었다.\n\n발사대를 찾으려면 섬광 뒤 몇 분 안에 항공기가 그 위에 있어야 했다. 서부 사막에는 숨을 와디가 천 개 있었다. 항공전의 3분의 1이 그 사냥에 들어갔다.\n\n항구와 수도 주위에는 요격 미사일 포대들이 서 있었고, 첫날 밤부터 떨어지는 것을 향해 쐈다. 그것들이 얼마나 막았는지는 그 뒤로 몇 해 동안 논쟁거리였다."
  ],
  "m3.brief": [
    "Command online. Six launchers are in the wadis west of you, and each one that fires gives itself away for a moment: watch the map for the flash and go. You have a light column and the fuel for one night; there is no economy here worth the name. The eighth launch to land is one too many. Find them first.",
    "指挥系统上线。你西面的干河谷里藏着六辆发射车，每一辆一开火就会暴露片刻：盯住地图上的火光，然后冲过去。你手里有一支轻装纵队和一夜的油料；这里没有值得一提的经济。第八枚落地的导弹就是多出来的那一枚。抢在它之前找到它们。",
    "지휘부 온라인. 서쪽 와디에 발사대 여섯 대가 있고, 쏘는 순간마다 잠깐 제 위치를 드러냅니다. 지도의 섬광을 보고 달려가십시오. 가진 것은 경장 종대와 하룻밤치 연료뿐이고, 여기에 경제라 할 만한 것은 없습니다. 여덟 번째 착탄은 하나가 너무 많습니다. 먼저 찾아내십시오."
  ],
  "m4.name": ["Rasfa", "拉斯法", "라스파"],
  "m4.date": ["29 January 1991 · 2000 · Rasfa, the coast", "1991 年 1 月 29 日 · 2000 · 拉斯法，海岸", "1991년 1월 29일 · 2000 · 라스파, 해안"],
  "m4.background": [
    "Twelve days of bombing had not moved a Qarashi column. On the night of 29 January three of them moved themselves: south across the border into the Kingdom, toward the coastal town of Rasfa.\n\nRasfa had been emptied of civilians and was held by a screen of reconnaissance teams. The columns took the town in the dark. It was the first ground battle of the war, and the only one Qarash chose.\n\nTwo nights it was fought for, house by house and along the coast road under the guns of the ships offshore. The Concord’s Arab contingents retook it on the 31st. The columns that came south did not go back.",
    "十二天的轰炸没能让一支卡拉什纵队挪动分毫。1 月 29 日夜里，三支纵队自己动了：向南越过边境进入王国，直指海滨小镇拉斯法。\n\n拉斯法的平民早已撤空，守着它的只有一层薄薄的侦察小队。纵队在黑暗中拿下了小镇。这是这场战争的第一场地面战，也是卡拉什唯一一次主动选择的战斗。\n\n为它打了两夜，逐屋争夺，沿着海岸公路，在近海军舰的炮火之下。31 日，协约的阿拉伯部队将它夺回。南下的纵队没有回去。",
    "열이틀의 폭격도 카라시 종대 하나를 움직이지 못했다. 1월 29일 밤, 종대 셋이 스스로 움직였다. 남쪽으로 국경을 넘어 왕국으로, 해안 마을 라스파를 향해.\n\n라스파는 민간인이 비워진 채 정찰조의 얇은 막이 지키고 있었다. 종대는 어둠 속에서 마을을 차지했다. 이 전쟁의 첫 지상전이었고, 카라시가 택한 유일한 싸움이었다.\n\n이틀 밤을 두고 집집마다, 해안 도로를 따라, 앞바다 군함의 함포 아래에서 싸웠다. 31일, 콩코드의 아랍 부대가 마을을 되찾았다. 남쪽으로 내려온 종대는 돌아가지 못했다."
  ],
  "m4.brief": [
    "Command online. Rasfa is yours to hold: a headquarters in the town, two turrets, and what you can build before they arrive. The columns come down the coast road and across the salt flats from the north-west. Hold twelve minutes for the ships and the armour to come up. Then retake the town.",
    "指挥系统上线。拉斯法交给你守：镇里一座总部、两座炮塔，以及他们到来之前你能建起的一切。纵队会沿海岸公路南下，并从西北方穿过盐滩而来。坚守十二分钟，等军舰和装甲部队上来。然后夺回小镇。",
    "지휘부 온라인. 라스파는 당신이 지킵니다. 마을 안의 사령부 하나, 포탑 둘, 그리고 적이 오기 전에 지을 수 있는 것. 종대는 해안 도로를 타고 내려오고, 북서쪽 염전을 가로질러 옵니다. 함선과 장갑이 올라올 때까지 12분을 버티십시오. 그다음 마을을 되찾으십시오."
  ],
  "m5.name": ["Bayan Channel", "巴扬水道", "바얀 수로"],
  "m5.date": ["30 January 1991 · 0200 · The Bayan Channel", "1991 年 1 月 30 日 · 0200 · 巴扬水道", "1991년 1월 30일 · 0200 · 바얀 수로"],
  "m5.background": [
    "Qarash had a navy of missile boats and minelayers, and one use for it: to run north up the Bayan Channel to a port out of reach, and to sow the Gulf behind it with mines.\n\nOut in the Gulf stood the oil platforms, and Qarash had put men on them with guns against helicopters. From 18 January the Concord’s frigates and their helicopters took them back a field at a time, and the first prisoners of the war came off those decks.\n\nOn 29 January the Concord’s aircraft caught the first of them in the channel. Over four days they sank or beached every ship that tried the run. Qarash never had a navy again.\n\nThe mines were another matter. Twelve hundred were laid. In February two warships struck them within three hours of each other, and the landing the Concord had rehearsed on Bayan Island, across the mudflats that ring it at low water, became the feint it was always meant to be. The Guard kept six divisions on the beaches waiting for it.",
    "卡拉什有一支由导弹艇和布雷舰组成的海军，只有一个用途：沿巴扬水道向北突围，逃到一座够不着的港口，并在身后的海湾里布满水雷。\n\n海湾里矗立着一座座石油平台，卡拉什在上面放了人，架着对付直升机的枪炮。从 1 月 18 日起，协约的护卫舰和舰载直升机一片油田一片油田地把它们夺回来，这场战争的第一批俘虏就是从那些甲板上走下来的。\n\n1 月 29 日，协约的飞机在水道里逮住了第一批。四天之内，每一艘试图突围的船都被击沉或搁浅。卡拉什从此再没有海军。\n\n水雷则是另一回事。一共布了一千两百枚。二月，两艘军舰在三小时内先后触雷，协约在巴扬岛演练过的登陆，要越过退潮时环岛的泥滩，最终变成了它本来就该是的佯攻。近卫军把六个师留在海滩上等着它。",
    "카라시에는 미사일정과 기뢰부설함으로 이루어진 해군이 있었고, 쓸모는 하나였다. 바얀 수로를 타고 북쪽으로, 손이 닿지 않는 항구까지 달아나고, 그 뒤의 만에 기뢰를 뿌리는 것.\n\n만 한가운데에는 석유 플랫폼들이 서 있었고, 카라시는 그 위에 헬기를 노리는 총포와 함께 사람을 올려 두었다. 1월 18일부터 콩코드의 프리깃과 함재 헬기들이 유전 하나씩 플랫폼을 되찾았고, 이 전쟁의 첫 포로들이 그 갑판에서 내려왔다.\n\n1월 29일, 콩코드 항공기가 수로에서 첫 배들을 잡았다. 나흘에 걸쳐 그들은 돌파를 시도한 모든 배를 가라앉히거나 좌초시켰다. 카라시에 해군은 다시 없었다.\n\n기뢰는 다른 문제였다. 1,200개가 깔렸다. 2월에 군함 두 척이 세 시간 간격으로 기뢰를 밟았고, 콩코드가 썰물 때 섬을 두르는 갯벌 너머로 바얀섬에 연습해 둔 상륙은 처음부터 그렇게 되기로 되어 있던 기만이 되었다. 근위군은 그것을 기다리며 6개 사단을 해변에 붙들어 두었다."
  ],
  "m5.brief": [
    "Command online. Their fleet runs tonight, in groups, up the channel past Bayan Island to the port at its head. Build a naval yard and sink them in the open; any that reach the port hide under its guns and you go in after them. Then take the island. Its command post is what holds those six divisions on the beaches.",
    "指挥系统上线。他们的舰队今夜分批突围，沿水道经过巴扬岛，逃往水道尽头的港口。建一座造船厂，在开阔水面上击沉它们；逃进港口的船会躲在岸炮之下，你得追进去。然后拿下这座岛。岛上的指挥所，就是把那六个师钉在海滩上的东西。",
    "지휘부 온라인. 오늘 밤 적 함대가 무리를 지어 바얀섬을 지나 수로 끝의 항구로 달아납니다. 조선소를 짓고 트인 바다에서 가라앉히십시오. 항구에 닿은 배는 그곳 포 아래 숨을 테니, 뒤따라 들어가야 합니다. 그다음 섬을 차지하십시오. 섬의 지휘소가 그 6개 사단을 해변에 붙들어 두고 있습니다."
  ],
  "m6.name": ["The Breach", "突破口", "돌파구"],
  "m6.date": ["24 February 1991 · 0400 · The Sarab border", "1991 年 2 月 24 日 · 0400 · 萨拉布边境", "1991년 2월 24일 · 0400 · 사라브 국경"],
  "m6.background": [
    "Six months of digging had made the border a line: a sand berm, then a ditch of oil with a pipe to light it, then wire, then half a million mines, then the trenches. Behind it stood the conscript divisions that had been bombed for thirty-eight days. Behind them, the Guard.\n\nAt 0400 on 24 February, in rain and low cloud, the ground war began. Ploughs on the front of tanks cut lanes through the mines; the berms were bulldozed; the fire ditches were bridged or filled. In the centre the breach was through in hours.\n\nFar to the west, out where the line was thin, the heaviest corps the Concord had was already across and turning east. Qarash was looking south.",
    "六个月的挖掘把边境变成了一道防线：一道沙堤，然后是一条能用管道点燃的油沟，然后是铁丝网，然后是五十万枚地雷，然后是战壕。防线后面，是已经被轰炸了三十八天的征召兵师。它们后面，是近卫军。\n\n2 月 24 日 0400，在雨和低云之中，地面战开始了。坦克前端的犁刀在雷区里犁出通道；沙堤被推平；火沟被架桥或填平。中央的突破口几小时内就打通了。\n\n遥远的西边，防线最薄弱的地方，协约最重的一个军已经越了过去，正在向东转向。卡拉什却在望着南方。",
    "여섯 달의 땅파기가 국경을 하나의 선으로 만들었다. 모래 둑, 그다음 불붙일 관이 달린 기름 도랑, 그다음 철조망, 그다음 지뢰 50만 개, 그다음 참호. 그 뒤에는 서른여드레 동안 폭격을 받은 징집 사단들이 서 있었다. 그 뒤에 근위군.\n\n2월 24일 0400, 비와 낮은 구름 속에서 지상전이 시작됐다. 전차 앞의 쟁기가 지뢰밭에 통로를 갈랐고, 둑은 불도저로 밀렸고, 불 도랑에는 다리가 놓이거나 메워졌다. 중앙의 돌파구는 몇 시간 만에 뚫렸다.\n\n저 멀리 서쪽, 선이 얇은 곳에서는 콩코드의 가장 무거운 군단이 이미 건너가 동쪽으로 돌고 있었다. 카라시는 남쪽을 보고 있었다."
  ],
  "m6.brief": [
    "Command online. The line runs east to west across your front: a berm, a fire trench, and the guns behind it. Two lanes have been cut, one at each end. Take engineers forward under artillery, silence the guns, and go through. The reserve division’s headquarters is behind the line; that is the objective. Rain until noon.",
    "指挥系统上线。防线横贯你的正面，东西向：一道沙堤、一条火沟、堤后的炮位。已经开出两条通道，两端各一条。在炮火掩护下把工程车推上去，压制炮位，穿过去。预备师的总部就在防线后面，那是目标。雨会下到中午。",
    "지휘부 온라인. 선은 정면을 동서로 가로지릅니다. 둑, 불 도랑, 그 뒤의 포. 통로 두 개가 뚫려 있고, 양 끝에 하나씩입니다. 포병 엄호 아래 공병을 앞으로 보내 포를 잠재우고 통과하십시오. 예비 사단의 사령부가 선 뒤에 있습니다. 그것이 목표입니다. 비는 정오까지입니다."
  ],
  "m7.name": ["73 Easting", "73 东线", "73 이스팅"],
  "m7.date": ["26 February 1991 · 1618 · The 73 Easting, Qarashi desert", "1991 年 2 月 26 日 · 1618 · 73 东线，卡拉什沙漠", "1991년 2월 26일 · 1618 · 73 이스팅, 카라시 사막"],
  "m7.background": [
    "The Guard was the army inside the army: the divisions that had taken Sarab, kept out of the line and out of the bombing, dug in behind it with the best of everything. Nasr, Saif, Hadid.\n\nOn 26 February a shamal came in off the desert: sand and rain together, visibility under a kilometre. The Concord’s western corps was driving east through it toward the Guard, on no map but a grid: north-south lines a kilometre apart, numbered by their easting.\n\nAt 1618 a cavalry troop crested a rise on the 73 Easting and found the Nasr Division dug in on the far side, a whole brigade of tanks in the storm, at nine hundred metres. The Guard’s war there lasted twenty-three minutes. It kept fighting into the night.",
    "近卫军是军队中的军队：攻下萨拉布的那几个师，被留在防线之外、轰炸之外，带着最好的一切在防线后面掘壕据守。纳斯尔、赛义夫、哈迪德。\n\n2 月 26 日，一场沙暴从沙漠上卷来：沙与雨一起，能见度不足一公里。协约的西部军正穿过它向东推进，直奔近卫军，手里没有地图，只有一张网格：一公里一条的南北线，按东向坐标编号。\n\n1618，一支骑兵分队冲上 73 东线上的一道坡顶，发现纳斯尔师就掘壕在坡的另一侧，整整一个旅的坦克，在风暴里，九百米外。近卫军在那里的战斗持续了二十三分钟。战斗一直打进了夜里。",
    "근위군은 군대 속의 군대였다. 사라브를 점령한 사단들, 전선 밖에 폭격 밖에 남겨져, 최고의 장비로 그 뒤에 파고든 자들. 나스르, 사이프, 하디드.\n\n2월 26일, 사막에서 샤말이 불어왔다. 모래와 비가 함께, 시계는 1킬로미터 아래. 콩코드의 서부 군단은 그것을 뚫고 동쪽으로 근위군을 향해 달리고 있었다. 지도는 없고 격자뿐이었다. 1킬로미터 간격의 남북선, 동경 좌표로 번호가 붙은.\n\n1618, 기병 부대 하나가 73 이스팅의 언덕마루에 올라섰고, 그 너머에 파고든 나스르 사단을 찾았다. 폭풍 속의 전차 1개 여단 전체, 900미터 거리. 그곳에서 근위군의 전쟁은 23분 걸렸다. 싸움은 밤까지 이어졌다."
  ],
  "m7.brief": [
    "Command online. Sight is under a kilometre in this and everything crawls. The Nasr Division is dug in on a north-south line ahead of you, turrets and tanks in pits, and it will not see you before you see it. You have a cavalry column and a staging post behind you; hold the post. Their reserve brigade will come down from the north when the shooting starts. Destroy the division.",
    "指挥系统上线。这种天气里视野不足一公里，一切都在爬行。纳斯尔师掘壕在你前方一条南北线上，炮塔和坦克都在掩体里，它不会比你先发现对方。你有一支骑兵纵队，身后有一处前进基地；守住基地。枪声一响，他们的预备旅就会从北面压下来。歼灭这个师。",
    "지휘부 온라인. 이 속에서는 시계가 1킬로미터가 안 되고 모든 것이 기어갑니다. 나스르 사단이 정면의 남북선에 파고들어 있습니다. 포탑과 전차가 참호 속에 있고, 당신이 먼저 보기 전에는 저들이 당신을 보지 못합니다. 기병 종대와 뒤쪽의 전진 기지가 있습니다. 기지를 지키십시오. 총성이 시작되면 적 예비 여단이 북쪽에서 내려옵니다. 사단을 격멸하십시오."
  ],
  "m8.name": ["Hadid Ridge", "哈迪德岭", "하디드 능선"],
  "m8.date": ["27 February 1991 · 1200 · Hadid Ridge", "1991 年 2 月 27 日 · 1200 · 哈迪德岭", "1991년 2월 27일 · 1200 · 하디드 능선"],
  "m8.background": [
    "By the morning of the 27th the Guard’s remaining armour had turned to face west, on the one piece of high ground between the Concord’s corps and the road home: a low ridge the Hadid Division, the Iron, had chosen in advance.\n\nIt was the reverse-slope defence of the manuals: tanks dug in below the crest, ranged on the ground in front, their artillery behind. Against it came a full armoured division on line, with the guns and the helicopters and the sky.\n\nThe tanks on the ridge could hit at two kilometres. The tanks coming at them could hit at three, and could see through the smoke of the burning oilfields. It was the largest tank battle of the war and it was over in forty minutes.",
    "到 27 日早晨，近卫军剩下的装甲部队已经转身面向西方，据守在协约各军与回家之路之间唯一的一处高地上：一道低矮的山岭，哈迪德师，“铁”师，早就选好了它。\n\n这是教科书上的反斜面防御：坦克掘壕在岭线之下，射界已经标定在前方的地面上，炮兵在后面。迎面而来的，是一整个展开成线的装甲师，带着火炮、直升机和整片天空。\n\n岭上的坦克能打两公里。压过来的坦克能打三公里，还能看穿燃烧油田的浓烟。这是这场战争中最大的一场坦克战，四十分钟就结束了。",
    "27일 아침, 근위군에 남은 장갑 부대는 서쪽을 향해 돌아서 있었다. 콩코드 군단과 귀로 사이의 유일한 고지, 하디드 사단, “철”의 사단이 미리 골라 둔 낮은 능선 위에.\n\n교범대로의 반사면 방어였다. 마루 아래 파고든 전차, 앞쪽 지형에 미리 맞춰 둔 사거리, 뒤에는 포병. 그 앞으로 온 것은 횡대로 전개한 장갑 사단 하나 전체, 포와 헬기와 하늘까지.\n\n능선 위의 전차는 2킬로미터에서 맞출 수 있었다. 밀고 오는 전차는 3킬로미터에서 맞출 수 있었고, 불타는 유전의 연기를 꿰뚫어 볼 수 있었다. 이 전쟁 최대의 전차전이었고, 40분 만에 끝났다."
  ],
  "m8.brief": [
    "Command online. This is the Guard’s last division on the field, dug in below the crest of a ridge across your whole front with its artillery behind it. Nothing subtle: bring everything. Tier-two armour is authorised; so is the air. Their command post is on the ridge. Take it, and the road north is open.",
    "指挥系统上线。这是近卫军留在战场上的最后一个师，掘壕在横贯你整个正面的一道山岭岭线之下，炮兵在它后面。不用玩花样：把所有家当都带上。二级装甲已获批准，空中力量也是。他们的指挥所就在岭上。拿下它，向北的路就通了。",
    "지휘부 온라인. 전장에 남은 근위군 마지막 사단입니다. 정면 전체를 가로지르는 능선 마루 아래 파고들었고, 포병이 그 뒤에 있습니다. 잔재주는 없습니다. 전부 데려가십시오. 2단계 장갑이 승인되었고, 항공도 마찬가지입니다. 적 지휘소는 능선 위에 있습니다. 그것을 잡으면 북쪽 길이 열립니다."
  ],
  "m9.name": ["The Hundred Hours", "一百小时", "백 시간"],
  "m9.date": ["27 February 1991 · 1800 · Sarab City", "1991 年 2 月 27 日 · 1800 · 萨拉布城", "1991년 2월 27일 · 1800 · 사라브 시"],
  "m9.background": [
    "Qarash had seven months to make Sarab its nineteenth province, and it left the way it came. On the 25th the order came to withdraw. The garrison of Sarab City took every vehicle it could start and went north on the one road out, Highway 80, through the night, as the wells behind them were set alight: six hundred of them.\n\nAircraft found the road on the night of the 26th, where it climbs the ridge north of the city. What was left of the column was still there in the morning, thirty kilometres of it.\n\nOn the 27th the Arab contingents of the Concord entered Sarab City through the smoke. The last of the occupation command held out in the ministry district by the port. At 0800 the next morning a ceasefire took effect: one hundred hours after the ground war began.",
    "卡拉什用七个月时间想把萨拉布变成它的第十九个省，最后却是怎么来的怎么走的。25 日，撤退的命令下达。萨拉布城的驻军开走了每一辆发得动的车，沿着唯一一条出城的路，80 号公路，连夜向北，身后的油井被点燃：六百口。\n\n26 日夜里，飞机在公路爬上城北山岭的地方找到了它。天亮时，纵队剩下的东西还在那里，绵延三十公里。\n\n27 日，协约的阿拉伯部队穿过浓烟进入萨拉布城。占领军指挥部的最后一批人守在港口边的部委区。第二天早晨 0800，停火生效：距地面战开始，整整一百小时。",
    "카라시는 일곱 달 동안 사라브를 열아홉 번째 주로 만들려 했고, 온 길로 떠났다. 25일에 철수 명령이 내려왔다. 사라브 시의 수비대는 시동이 걸리는 차량이란 차량은 다 끌고, 밖으로 나가는 유일한 길인 80번 고속도로를 타고 밤새 북으로 갔다. 그 뒤로 유정에 불이 붙었다. 600곳.\n\n26일 밤, 항공기가 도시 북쪽 능선을 오르는 곳에서 그 길을 찾았다. 아침에도 종대의 잔해는 그대로 거기 있었다. 30킬로미터에 걸쳐.\n\n27일, 콩코드의 아랍 부대가 연기를 뚫고 사라브 시로 들어갔다. 점령군 사령부의 마지막 인원은 항구 옆 정부 청사 구역에서 버텼다. 이튿날 아침 0800, 정전이 발효됐다. 지상전이 시작된 지 꼭 백 시간 뒤였다."
  ],
  "m9.brief": [
    "Command online. The city is under a sky of oil smoke and the wells are burning on every side. The occupation command is dug into the ministry district by the port, and what is left of the garrison is running north on Highway 80 while it can. Take the command. Whatever you can catch on the road is yours. The ceasefire is at 0800: be finished.",
    "指挥系统上线。城市笼罩在油烟之下，四面八方的油井都在燃烧。占领军指挥部盘踞在港口边的部委区，残余的驻军正趁还来得及沿 80 号公路向北逃窜。拿下指挥部。路上能截住多少，都算你的。停火时间是 0800：在那之前结束。",
    "지휘부 온라인. 도시는 기름 연기의 하늘 아래 있고 사방의 유정이 타고 있습니다. 점령군 사령부는 항구 옆 청사 구역에 파고들었고, 남은 수비대는 아직 갈 수 있을 때 80번 고속도로로 북쪽으로 달아나고 있습니다. 사령부를 잡으십시오. 길에서 잡히는 것은 전부 당신 몫입니다. 정전은 0800입니다. 그 전에 끝내십시오."
  ],
  // ------------------------------------------------------------- objectives
  "obj.destroyEnemy": ["Destroy all enemy forces", "消灭所有敌军", "적군을 모두 파괴"],
  "obj.destroyHQ": ["Destroy the enemy headquarters", "摧毁敌方总部", "적 사령부 파괴"],
  "obj.protectHQ": ["Your HQ must survive", "保卫我方总部", "아군 사령부 사수"],
  "obj.survive": ["Survive for {0}", "坚守 {0}", "{0} 동안 버티기"],
  "obj.buildExtractors": ["Build {0} metal extractors", "建造 {0} 座采矿场", "금속 채굴장 {0}개 건설"],
  "obj.buildFactory": ["Build a war factory", "建造战车工厂", "전차 공장 건설"],
  "obj.trainArmy": ["Build {0} combat units", "生产 {0} 个战斗单位", "전투 유닛 {0}개 생산"],
  "obj.buildNavyard": ["Build a naval yard", "建造造船厂", "조선소 건설"],
  "obj.buildAirbase": ["Build an airbase", "建造空军基地", "공군 기지 건설"],
  "obj.destroyAirbases": ["Destroy the enemy airfields", "摧毁敌方机场", "적 비행장 파괴"],
  "obj.destroyOutpost": ["Destroy the border post", "摧毁边境哨所", "국경 초소 파괴"],
  "obj.destroyRadars": ["Destroy the two radar stations", "摧毁两座雷达站", "레이더 기지 두 곳 파괴"],
  "obj.destroyLaunchers": ["Destroy the six launchers", "摧毁六辆发射车", "발사대 여섯 대 파괴"],
  "obj.destroyLaunchers.count": ["({0} of {1})", "（{0}/{1}）", "({0}/{1})"],
  "obj.noEighthLaunch": ["The eighth launch must not land", "第八枚导弹不得落地", "여덟 번째 착탄을 막기"],
  "obj.noEighthLaunch.count": ["({0} of {1} landed)", "（已落地 {0}/{1}）", "(착탄 {0}/{1})"],
  "obj.clearTown": ["Retake the town: destroy every enemy in it", "夺回小镇：消灭镇内所有敌军", "마을 탈환: 마을 안의 적을 모두 파괴"],
  "obj.sinkFleet": ["Sink the fleet: every enemy ship", "击沉舰队：所有敌舰", "함대 격침: 모든 적함"],
  "obj.breachLine": ["Breach the line: silence every gun on it", "突破防线：压制线上的所有炮位", "전선 돌파: 선 위의 모든 포를 침묵시키기"],
  "obj.destroyReserve": ["Destroy the reserve division’s headquarters", "摧毁预备师总部", "예비 사단 사령부 파괴"],
  "obj.destroyDivision": ["Destroy the Nasr Division", "歼灭纳斯尔师", "나스르 사단 격멸"],
  "obj.destroyCommand": ["Destroy the enemy command", "摧毁敌军指挥部", "적 지휘부 파괴"],
  "obj.clearPlatforms": ["Clear the oil platforms", "清除石油平台", "석유 플랫폼 소탕"],
  "obj.clearPlatforms.count": ["({0} of {1})", "（{0}/{1}）", "({0}/{1})"],
  "obj.cutHighway": ["Cut Highway 80: destroy {1} vehicles of the retreating column", "切断 80 号公路：摧毁撤退纵队的 {1} 辆车", "80번 고속도로 차단: 퇴각 종대 차량 {1}대 파괴"],
  "obj.cutHighway.count": ["({0} of {1})", "（{0}/{1}）", "({0}/{1})"],
  // breakthrough, one line a side; both sides read both
  "obj.takeCheckpoints": ["Attackers: take every checkpoint in order ({0} of {1})", "进攻方：按顺序夺取全部检查点（{0}/{1}）", "공격측: 검문소를 차례로 모두 점령 ({0}/{1})"],
  "obj.holdUntil": ["Defenders: hold until the clock runs out ({0})", "防守方：坚守到倒计时结束（{0}）", "수비측: 시계가 다 돌 때까지 사수 ({0})"],
  // ------------------------------------------------------------- game HUD
  "hud.metal": ["Metal", "金属", "금속"],
  "hud.power": ["Power", "电力", "전력"],
  "hud.powerShortage": ["POWER SHORTAGE", "电力短缺", "전력 부족"],
  "hud.warheadLaunching": ["WARHEAD LAUNCHING", "弹头发射中", "탄두 발사 중"],
  "hud.income": ["+{0}/s", "+{0}/秒", "+{0}/초"],
  // the economy strip's breakdown popover
  "hud.economy": ["Economy", "经济", "경제"],
  "hud.eco.hint": ["Hover for the full breakdown", "悬停查看详细收支", "마우스를 올리면 전체 내역이 보입니다"],
  "hud.eco.balance": ["Balance", "余额", "잔고"],
  "hud.eco.committed": ["Committed", "已承诺", "예약됨"],
  "hud.eco.available": ["Available", "可动用", "사용 가능"],
  "hud.eco.incomeTotal": ["Income", "收入", "수입"],
  "hud.eco.brownout": [
    "Low power: mining and work at {0}%, units move at {1}%",
    "电力不足：开采与作业降至 {0}%，单位移速降至 {1}%",
    "전력 부족: 채굴과 작업은 {0}%, 유닛 이동은 {1}%"
  ],
  "hud.eco.gridLoss": ["Grid losses", "电网损耗", "송전 손실"],
  "hud.eco.gridLossNote": [
    "The grid loses the square of its load: every unit and building costs a little more power than the last.",
    "电网损耗随负载的平方增长：每多一个单位或建筑，耗电都比上一个略多。",
    "전력망은 부하의 제곱만큼 잃습니다. 유닛과 건물 하나하나가 바로 앞 것보다 조금 더 많은 전력을 씁니다."
  ],
  "hud.eco.surplus": ["Surplus", "盈余", "잉여"],
  "hud.eco.deficit": ["Deficit", "缺口", "부족"],
  "hud.conquestTimeLimit": [
    "Time limit: {0} remaining. Most stored metal wins; a tie is a draw.",
    "距离时限还剩 {0}。存有最多金属者获胜，并列则平局。",
    "제한 시간까지 {0}. 보유 금속이 가장 많으면 승리, 동률이면 무승부입니다."
  ],
  "hud.eco.noPower": ["Nothing generating or drawing power", "没有发电或耗电设施", "전력을 만들거나 쓰는 것이 없습니다"],
  "hud.eco.other": ["Other ×{0}", "其他 ×{0}", "기타 ×{0}"],
  "hud.eco.count": ["{0} ×{1}", "{0} ×{1}", "{0} ×{1}"],
  "hud.paused": ["PAUSED", "已暂停", "일시 정지"],
  "hud.speed": ["Speed ×{0}", "速度 ×{0}", "속도 ×{0}"],
  "hud.menu": ["Menu", "菜单", "메뉴"],
  "hud.allies": ["Allies", "盟友", "동맹"],
  "hud.techTier": ["T{0}", "T{0}", "T{0}"],
  "hud.objectives": ["Objectives", "任务目标", "목표"],
  // the Guide panel under the objectives, for a mission that teaches (ui/guidePanel.ts)
  "hud.guide": ["Guide", "指引", "안내"],
  "hud.guideCount": ["{0} / {1}", "{0} / {1}", "{0} / {1}"],
  // the breakthrough strip
  "hud.bt.whistle": ["Whistle in", "哨响倒计时", "휘슬까지"],
  "hud.bt.clock": ["Clock", "倒计时", "시계"],
  "hud.bt.checkpoints": ["Checkpoints", "检查点", "검문소"],
  "hud.bt.checkpoint": ["Checkpoint {0}", "检查点 {0}", "검문소 {0}"],
  "hud.bt.front": ["the front", "前线", "전선"],
  "hud.bt.fallen": ["fallen", "已失守", "함락"],
  "hud.bt.locked": ["locked until the one before it falls", "前一个失守后才会开放", "앞 검문소가 떨어져야 열립니다"],
  "hud.offGrid": ["off grid", "无需电力", "전력 불필요"],
  "hud.queue": ["Queue", "生产队列", "대기열"],
  "hud.queueEmpty": ["Queue is empty", "队列为空", "대기열이 비어 있습니다"],
  "hud.queueReorder": ["Drag to reorder", "拖动调整顺序", "끌어서 순서 변경"],
  "hud.kills": ["Kills: {0}", "击杀：{0}", "격파: {0}"],
  "hud.rank": ["Rank {0}: {1}", "等级 {0}：{1}", "계급 {0}: {1}"],
  "hud.commanderAssignmentTip": ["Assigned to the commander. Give this unit an order or choose Take control to command it yourself.", "已交给指挥官。下达命令或选择「接管指挥」即可自行指挥此单位。", "사령관에게 배정됨. 이 유닛에 명령을 내리거나 지휘권 회수를 선택하면 직접 지휘합니다."],
  "hud.formationTip": ["In formation: it keeps its place among the others and marches at the slowest one's pace. A move order of its own takes it out.", "编队中：保持与其他单位的相对位置，以最慢单位的速度行进。单独给它下达移动命令即可使其离队。", "대형 유지 중: 다른 유닛과의 상대 위치를 지키며 가장 느린 유닛의 속도로 이동합니다. 이 유닛에만 이동 명령을 내리면 대형에서 빠집니다."],
  "hud.highGround": ["High ground", "高地", "고지"],
  "hud.highGroundTip": [
    "High ground: unseen from below, and shots from below do {0}% less. Aircraft and radar see it all the same.",
    "高地：下方看不见它，来自下方的射击伤害减少 {0}%。飞机和雷达照常可见。",
    "고지: 아래에서는 보이지 않고, 아래에서 쏘는 공격은 피해가 {0}% 줄어듭니다. 항공기와 레이더는 그대로 봅니다."
  ],
  "rank.2": ["Veteran", "老兵", "베테랑"],
  "rank.3": ["Elite", "精英", "정예"],
  "hud.cargo": ["Cargo {0}/{1}", "载员 {0}/{1}", "적재 {0}/{1}"],
  "stat.transportMaxWeight": ["Max passenger weight", "单个乘员载重上限", "탑승자당 최대 중량"],
  "hud.hold": ["Cargo hold", "货舱", "적재함"],
  "hud.holdUnit": ["{0} (cargo weight {1})", "{0}（载重 {1}）", "{0} (적재 무게 {1})"],
  "hud.holdEmpty": ["Nothing carried", "未搭载任何单位", "실은 유닛이 없습니다"],
  "hud.warheads": ["Warheads {0}/{1}", "核弹头 {0}/{1}", "핵탄두 {0}/{1}"],
  "sight.designation": ["TARGET DESIGNATION", "目标指示", "표적 지정"],
  "sight.optical": ["SENSOR · OPTICAL", "传感器 · 光学", "센서 · 광학"],
  "sight.thermal": ["SENSOR · THERMAL / WHITE HOT", "传感器 · 热成像 / 白热", "센서 · 열영상 / 백열"],
  "sight.altitude": ["ALT {0} m", "高度 {0} 米", "고도 {0} m"],
  "sight.zoom": ["MAG {0}×", "倍率 {0}×", "배율 {0}×"],
  "sight.latitude": ["LAT {0}", "纬度 {0}", "위도 {0}"],
  "sight.longitude": ["LON {0}", "经度 {0}", "경도 {0}"],
  "sight.bearing": ["AZ {0}°", "方位 {0}°", "방위 {0}°"],
  "sight.range": ["RNG {0} m", "距离 {0} 米", "거리 {0} m"],
  "sight.flightTime": ["TOF ≈ {0} s", "预计飞行 {0} 秒", "예상 비행 {0}초"],
  "sight.switchSensor": ["Switch sensor", "切换传感器", "센서 전환"],
  "hud.rounds": ["Rounds {0}/{1}", "备弹 {0}/{1}", "탄약 {0}/{1}"],
  "hud.roundReady": ["Interceptor ready", "拦截弹已就绪", "요격 준비 완료"],
  "hud.roundReloading": ["Reloading", "装填中", "재장전 중"],
  "hud.nukeReady": ["Warhead ready", "核弹头已就绪", "핵탄두 준비 완료"],
  "hud.empReady": ["EMP warhead ready", "电磁脉冲弹头已就绪", "EMP 탄두 준비 완료"],
  "hud.empFabricating": ["Fabricating EMP warhead (click to cancel)", "正在制造电磁脉冲弹头（点击取消）", "EMP 탄두 제조 중 (클릭하면 취소)"],
  "hud.disabled": ["Disabled for {0} s", "瘫痪 {0} 秒", "{0}초 동안 무력화"],
  "hud.nukeFabricating": ["Fabricating warhead (click to cancel)", "正在制造核弹头（点击取消）", "핵탄두 제조 중 (클릭하면 취소)"],
  "hud.nukeEmpty": ["Empty warhead slot", "空核弹槽位", "빈 핵탄두 슬롯"],
  "hud.nukeFull": ["Warhead magazine is full", "弹仓已满", "탄두 저장고가 가득 찼습니다"],
  "hud.nukeHeld": ["Paused (click to cancel)", "已暂停（点击取消）", "멈춤 (클릭하면 취소)"],
  "hud.nukeAwayFromYard": ["Warhead work paused: bring it back to one of your naval yards and keep it on the surface there.", "弹头制造已暂停：把它开回己方造船厂附近，并在那里保持上浮。", "탄두 제조가 멈췄습니다. 아군 조선소 곁으로 돌려보내 부상한 채로 두세요."],
  "hud.nukeAwayFromAirbase": ["Warhead work paused: bring it back over one of your airbases.", "弹头制造已暂停：把它飞回己方机场上空。", "탄두 제조가 멈췄습니다. 아군 비행장 위로 돌려보내세요."],
  "hud.tooShallow": ["Too shallow to dive here: it stays on the surface until the water deepens.", "此处水太浅，无法下潜：驶入深水之前会一直浮在水面。", "여기는 너무 얕아 잠수할 수 없습니다. 깊은 물에 들어설 때까지 수면 위에 머뭅니다."],
  "hud.nukeSubmerged": ["Warhead work paused: it loads only on the surface. Surface it ({0}).", "弹头制造已暂停：只能在水面上装填。让它上浮（{0}）。", "탄두 제조가 멈췄습니다. 수면 위에서만 장전합니다. 부상시키세요 ({0})."],
  "hud.watchHint": ["Select a faction's HQ to watch its economy", "选择某阵营的指挥中心以查看其经济", "진영의 사령부를 선택하면 그 경제를 볼 수 있습니다"],
  "hud.battleMap": ["Battle map", "战场地图", "전장 지도"],
  "hud.chat": ["Chat", "聊天", "채팅"],
  "hud.chatEmpty": ["Press Enter to say something.", "按 Enter 发言。", "Enter를 눌러 말하세요."],
  "hud.chatPlaceholder": ["Message… (/t = team)", "输入消息…（/t = 队伍）", "메시지… (/t = 팀)"],
  // the desktop's chat box, which is the console too: a slash makes a line a command
  "hud.talk.placeholder": ["Message (/t = team), or /command", "输入消息（/t = 队伍），或以 / 开头输入命令", "메시지 (/t = 팀), 명령은 /로 시작"],
  "hud.talk.placeholderSolo": ["Type /help for the commands", "输入 /help 查看命令", "/help를 입력하면 명령 목록"],
  "hud.groups": ["Army Groups", "编队", "부대 편성"],
  "hud.groupsAdd": ["Add to Group", "加入编队", "부대에 추가"],
  "hud.groupsHint": ["Select units, then put them in a group.", "选中单位后将其加入编队。", "유닛을 선택한 뒤 부대에 넣으세요."],
  "hud.groupSelect": [
    "Group {0}: {1} units. Click to select, again to jump there.",
    "编队 {0}：{1} 个单位。点击选中，再次点击跳转。",
    "부대 {0}: 유닛 {1}개. 클릭하면 선택, 다시 클릭하면 이동."
  ],
  "hud.groupDisband": ["Disband group {0}", "解散编队 {0}", "부대 {0} 해산"],
  "hud.groupAdd": ["Add the selection to group {0}", "将所选单位加入编队 {0}", "선택한 유닛을 부대 {0}에 추가"],
  "hud.groupRemove": ["Take the selection out of group {0}", "将所选单位移出编队 {0}", "선택한 유닛을 부대 {0}에서 제외"],
  // the work panel: everything of ours at work while nothing is held
  "hud.work": ["In Progress", "进行中", "진행 중"],
  "hud.work.produce": ["Producing {0}", "正在生产{0}", "{0} 생산 중"],
  "hud.work.produceMore": ["Producing {0}, {1} more queued", "正在生产{0}，还有 {1} 个排队", "{0} 생산 중, 대기 {1}개"],
  "hud.work.build": ["Building {0}", "正在建造{0}", "{0} 건설 중"],
  "hud.work.upgrade": ["Upgrading to {0}", "正在升级为{0}", "{0}(으)로 업그레이드 중"],
  "hud.work.research": ["Researching {0}", "正在研究{0}", "{0} 연구 중"],
  "hud.work.researchMore": ["Researching {0}, {1} more queued", "正在研究{0}，还有 {1} 项排队", "{0} 연구 중, 대기 {1}개"],
  "hud.work.fabricate": ["Fabricating {0}", "正在制造{0}", "{0} 제조 중"],
  "hud.work.fabricateMore": ["Fabricating {0}, {1} more queued", "正在制造{0}，还有 {1} 枚排队", "{0} 제조 중, 대기 {1}개"],
  "hud.work.fabricateHeld": ["{0} paused: it loads only at its base (see its card)", "{0}已暂停：只能在基地旁装填（详见单位卡片）", "{0} 멈춤: 기지 곁에서만 장전합니다 (유닛 카드 참고)"],
  // ------------------------------------------------------- quick selection
  "quick.title": ["Quick selection", "快速选择", "빠른 선택"],
  // the four branches of the inner ring
  "quick.unit": ["FORCES", "部队", "부대"],
  "quick.factory": ["PRODUCTION", "生产建筑", "생산 건물"],
  "quick.camera": ["CAMERA", "镜头", "카메라"],
  "quick.support": ["SUPPORT", "支援", "지원"],
  // forces: every armed unit, a branch of them, the armed units on screen
  "quick.army": ["ARMY", "全军", "전군"],
  "quick.land": ["LAND", "陆军", "지상"],
  "quick.air": ["AIR", "空军", "공중"],
  "quick.sea": ["SEA", "海军", "해상"],
  "quick.inView": ["ON SCREEN", "屏幕内", "화면 안"],
  // the lines: every war factory, airbase or naval yard, at any level, and the War Lab
  "quick.factories": ["FACTORIES", "战车工厂", "전차 공장"],
  "quick.airbases": ["AIRBASES", "空军基地", "공군 기지"],
  "quick.navyards": ["NAVAL YARDS", "造船厂", "조선소"],
  "quick.warlabs": ["WAR LAB", "战争实验室", "전쟁 연구소"],
  // the camera: to the headquarters, to the last place under attack, to what is selected
  "quick.hq": ["HQ", "总部", "사령부"],
  "quick.alert": ["UNDER ATTACK", "遇袭处", "공격받는 곳"],
  "quick.selection": ["SELECTION", "选中单位", "선택 대상"],
  // support: every builder, the idle ones, every transport, every unit under half strength
  "quick.engineers": ["ENGINEERS", "工程车", "공병차"],
  "quick.idleEngineers": ["IDLE ENGINEERS", "空闲工程车", "대기 공병차"],
  "quick.transports": ["TRANSPORTS", "运输单位", "수송 유닛"],
  "quick.damaged": ["DAMAGED", "受损单位", "손상 유닛"],
  // ------------------------------------------------------------ map marks
  // what a mark is called where it is named in words rather than drawn:
  // the battle map's legend, the feed, a screen reader
  "priority.noSeat": ["Join a faction to set priorities.", "加入阵营后才能设置优先目标。", "진영에 참가한 뒤 우선 표적을 지정하세요."],
  "priority.needId": ["Provide the target ID to remove its priority.", "请提供要取消优先标记的目标 ID。", "우선 지정을 해제할 표적 ID를 입력하세요."],
  "priority.needVisible": ["Choose a visible enemy unit or building.", "请选择视野内的敌方单位或建筑。", "시야 안의 적 유닛이나 건물을 선택하세요."],
  "priority.markedTarget": ["Target #{0} marked as high priority.", "已将目标 #{0} 标记为高优先级。", "표적 #{0}을 우선 표적으로 지정했습니다."],
  "priority.removedTarget": ["Priority removed from target #{0}.", "已取消目标 #{0} 的优先标记。", "표적 #{0}의 우선 지정을 해제했습니다."],
  "priority.none": ["No priority targets.", "尚无优先目标。", "우선 표적이 없습니다."],
  "priority.cliHelp": ["List priority targets, mark an enemy, or remove a mark with --off.", "列出优先目标、标记敌人，或用 --off 取消标记。", "우선 표적 목록을 보거나 적을 지정합니다. --off로 지정을 해제합니다."],
  "priority.mark": ["High priority", "高优先级目标", "우선 표적"],
  "priority.remove": ["Remove priority", "取消优先标记", "우선 표적 해제"],
  "priority.title": ["Priority targets", "优先目标", "우선 표적"],
  "priority.lost": ["Lost sight", "视野丢失", "시야에서 사라짐"],
  "priority.desc": ["Your units prefer this enemy when their current orders and weapons allow. Area sweeps stay within their assigned area.", "当前命令和武器允许时，你的部队会优先攻击此敌人。区域扫荡仍限于指定区域。", "현재 명령과 무기가 허용할 때 아군이 이 적을 우선 공격합니다. 구역 소탕은 지정 구역 안에서만 수행합니다."],
  "priority.replaced": ["Oldest priority target replaced.", "已替换最早标记的优先目标。", "가장 오래된 우선 표적을 교체했습니다."],
  "bind.priorityTarget": ["Mark selected enemy as high priority", "将选中的敌人标记为优先目标", "선택한 적을 우선 표적으로 지정"],
  "pin.attack": ["Attack here", "攻击此处", "이곳을 공격"],
  "pin.defend": ["Defend here", "防守此处", "이곳을 방어"],
  "pin.watch": ["Watch out", "注意此处", "이곳을 주의"],
  "pin.left": ["{0} left a mark: {1}", "{0} 留下标记：{1}", "{0}님이 표식을 남겼습니다: {1}"],
  // ------------------------------------------------------------- commands
  "cmd.repair": ["Repair", "维修", "수리"],
  // working a mountain face (`game/dig.ts`): the one map where a mountain can be dug
  "cmd.dig": ["Dig", "挖掘", "파기"],
  "cmd.move": ["Move", "移动", "이동"],
  "cmd.attack": ["Attack", "攻击", "공격"],
  "cmd.attackMove": ["Attack-move", "攻击移动", "공격 이동"],
  "cmd.stop": ["Stop", "停止", "정지"],
  "cmd.hold": ["Hold position", "原地驻守", "위치 사수"],
  "cmd.holdFire": ["Hold fire", "停火待命", "사격 중지"],
  "cmd.fireAtWill": ["Fire at will", "自由开火", "자유 사격"],
  "cmd.holdFire.desc": [
    "Stop firing and pursuing enemies while keeping movement and support orders. An attack or attack-move order resumes fire. Combine with Hold position to wait in ambush.",
    "停止开火和追击敌人，保留移动与支援命令。攻击或攻击移动命令会恢复开火。配合原地驻守可等待伏击时机。",
    "이동 및 지원 명령을 유지하며 사격과 적 추격을 중지합니다. 공격이나 공격 이동 명령을 내리면 사격을 재개합니다. 위치 사수와 함께 사용해 매복할 수 있습니다."
  ],
  "cmd.fireAtWill.desc": ["Resume automatic fire without changing movement orders.", "恢复自动开火，不改变移动命令。", "이동 명령을 바꾸지 않고 자동 사격을 재개합니다."],
  "cmd.holdFire.noArmed": ["Choose armed units or emplacements.", "请选择武装单位或炮台。", "무장 유닛이나 포대를 선택하세요."],
  "cmd.holdFire.state": ["holding fire", "停火待命", "사격 중지 중"],
  "cli.holdFire.usage": ["hold-fire <units> [--off]", "hold-fire <单位> [--off]", "hold-fire <유닛> [--off]"],
  "cli.holdFire.help": ["Hold fire; --off resumes automatic fire.", "停火待命；--off 恢复自动开火。", "사격 중지; --off로 자동 사격을 재개합니다."],
  "cmd.protect": ["Protect", "保护", "보호"],
  "cmd.direct": ["Direct control", "直接操控", "직접 조종"],
  "cmd.assignCommander": ["Assign to commander", "交给指挥官", "사령관에게 배정"],
  "cmd.takeControl": ["Take control", "接管指挥", "지휘권 회수"],
  "cmd.formation": ["Formation", "编队", "대형"],
  "cmd.formationOff": ["Break formation", "解散编队", "대형 해제"],
  "cmd.surface": ["Surface", "上浮", "부상"],
  "cmd.dive": ["Dive", "下潜", "잠수"],
  "cmd.ability": ["Use ability", "使用技能", "능력 사용"],
  "cmd.research": ["Research", "研究", "연구"],
  "cmd.build": ["Build", "建造", "건설"],
  "cmd.sell": ["Sell", "出售", "판매"],
  "cmd.upgrade": ["Upgrade", "升级", "업그레이드"],
  // a mod's button on a unit's card (`game/modRules.ts`)
  "cmd.morph": ["Become {0}", "变为{0}", "{0}(으)로 전환"],
  "cmd.ruleWorking": ["{0}: {1}% — press again to stop", "{0}：{1}%——再按一次停止", "{0}: {1}% — 다시 누르면 중지"],
  "rule.block.requires": ["Needs {0}", "需要{0}", "{0} 필요"],
  "rule.block.busy": ["Busy", "忙碌中", "작업 중"],
  "rule.block.metal": ["Not enough metal", "金属不足", "금속 부족"],
  "rule.block.terrain": ["Cannot take that form here", "此处无法变形", "여기서는 전환할 수 없음"],
  "rule.block.cargo": ["Unload first", "请先卸载", "먼저 하차하세요"],
  "rule.block.limit": ["At the limit", "已达上限", "한도 도달"],
  "rule.block.used": ["Used up", "已用尽", "모두 사용함"],
  "rule.block.cooldown": ["Not ready yet", "尚未就绪", "아직 준비되지 않음"],
  "rule.block.if": ["Not now", "现在不行", "지금은 불가"],
  "cmd.fabricateNuke": ["Fabricate warhead", "制造核弹头", "핵탄두 제조"],
  "cmd.launchNuke": ["Launch nuke", "发射核弹", "핵 발사"],
  "cmd.fabricateEmp": ["Fabricate EMP warhead", "制造电磁脉冲弹头", "EMP 탄두 제조"],
  "cmd.launchEmp": ["Launch EMP", "发射电磁脉冲弹", "EMP 발사"],
  "cmd.fabricateNukeBomb": ["Fabricate nuclear bomb", "制造核航弹", "핵폭탄 제조"],
  "cmd.dropNukeBomb": ["Drop nuclear bomb", "投放核航弹", "핵폭탄 투하"],
  "cmd.resume": ["Resume construction", "继续建造", "건설 재개"],
  "cmd.unload": ["Unload all", "全部卸载", "모두 하차"],
  "cmd.sellRefund": ["Sell (+{0})", "出售 (+{0})", "판매 (+{0})"],
  // HUD action tooltips: the title above, what the order does beneath it.
  "cmd.move.desc": [
    "Choose a destination. Units move there without stopping to chase enemies; units able to fire on the move can still shoot along the way.",
    "选择目的地。单位会向那里移动，不会停下追击敌人；能够移动射击的单位仍会沿途开火。",
    "목적지를 선택하세요. 유닛은 적을 추격하느라 멈추지 않고 이동하며, 이동 사격이 가능한 유닛은 도중에도 사격합니다."
  ],
  "cmd.attack.desc": [
    "Choose an enemy for the selected buildings to attack. Their weapons stay focused on that target while it remains within range.",
    "选择要攻击的敌人。选中建筑的武器会集中攻击该目标，直到它离开射程或被摧毁。",
    "선택한 건물이 공격할 적을 지정하세요. 목표가 사거리 안에 있는 동안 해당 목표에 화력을 집중합니다."
  ],
  "cmd.attackMove.desc": [
    "Choose a destination to advance while engaging enemies, or an enemy to focus the attack. Frame an area to clear it of enemy units and buildings; each unit chooses its own targets as the battle changes. Hold Shift while framing to queue the area objective.",
    "选择目的地可攻击前进，选择敌人可集中攻击。框选区域可清除其中的敌方单位和建筑；各单位会根据战况自主选择目标。按住 Shift 框选可追加区域清剿任务。",
    "목적지를 선택하면 적과 교전하며 전진하고, 적을 지정하면 집중 공격합니다. 영역을 상자로 감싸면 그 안의 적 유닛과 건물을 소탕하며, 각 유닛은 전황에 따라 목표를 선택합니다. Shift를 누른 채 영역을 지정하면 소탕 임무를 대기열에 추가합니다."
  ],
  "cmd.stop.desc": [
    "Cancel current and queued orders. Units stop their current task and can still engage enemies automatically.",
    "取消当前任务和排队中的命令。单位停止正在执行的任务，但仍会自动攻击敌人。",
    "현재 명령과 대기 중인 명령을 취소합니다. 유닛은 수행 중인 작업을 멈추지만 적과 자동으로 교전할 수 있습니다."
  ],
  "cmd.hold.desc": [
    "Keep units at their current position. They fire at enemies within range without chasing them or automatically retreating. Press again, or give a movement order, to release the hold.",
    "让单位在当前位置驻守。单位会攻击射程内的敌人，但不会追击或自动撤退。再次按下，或下达移动命令，即可解除驻守。",
    "현재 위치를 지키게 합니다. 사거리 안의 적에게 사격하지만 추격하거나 자동으로 후퇴하지 않습니다. 다시 누르거나 이동 명령을 내리면 위치 사수가 해제됩니다."
  ],
  "cmd.protect.desc": [
    "Click a friendly unit or building to escort it, or frame an area to patrol. Guards prioritize enemies attacking allies inside, then resume patrolling after nearby threats are dealt with.",
    "点击友方单位或建筑进行护卫，或框选区域进行巡逻。护卫会优先攻击正在袭击区域内友军的敌人，处理附近威胁后继续巡逻。",
    "아군 유닛이나 건물을 클릭하면 호위하고, 영역을 지정하면 순찰합니다. 영역 안의 아군을 공격하는 적을 우선 상대하고, 주변 위협을 처리한 뒤 순찰을 재개합니다."
  ],
  "cmd.direct.desc": [
    "Take manual control of up to {0} selected units to drive, aim and fire directly. Press again to return to normal command control.",
    "直接操控最多{0}个选中单位，控制移动、瞄准和开火。再次按下即可返回普通指挥模式。",
    "선택한 유닛을 최대 {0}개까지 직접 이동시키고 조준하며 사격합니다. 다시 누르면 일반 명령 조작으로 돌아갑니다."
  ],
  "cmd.assignCommander.desc": [
    "Hand these combat units to your army commander after their current orders finish. Giving them another order takes them back.",
    "让这些战斗单位在完成当前命令后归部队指挥官调度。下达其他命令即可接管指挥。",
    "현재 명령을 마치면 이 전투 유닛들을 사령관에게 맡깁니다. 다른 명령을 내리면 지휘권을 되찾습니다."
  ],
  "cmd.takeControl.desc": [
    "Return these units to your command. They keep their current orders and can still engage nearby enemies.",
    "接管这些单位的指挥权。它们会继续执行当前命令，并仍可攻击附近的敌人。",
    "이 유닛들의 지휘권을 되찾습니다. 현재 명령을 계속 수행하며 주변 적과 교전할 수 있습니다."
  ],
  "cmd.formation.desc": [
    "Keep the selected units in their current arrangement when moving them together. The formation travels at the pace of its slowest member.",
    "让选中单位在一同移动时保持当前队形。编队以最慢成员的速度行进。",
    "선택한 유닛이 함께 이동할 때 현재 배치를 유지하게 합니다. 대형은 가장 느린 유닛의 속도로 이동합니다."
  ],
  "cmd.formationOff.desc": [
    "Release the selected units from their formation so each can move at its own speed. Their current orders continue.",
    "让选中单位脱离编队，各自按自身速度移动。当前命令会继续执行。",
    "선택한 유닛을 대형에서 해제하여 각자의 속도로 이동하게 합니다. 현재 명령은 계속 수행합니다."
  ],
  "cmd.surface.desc": [
    "Bring submarines to the surface for faster travel and a wider view. They become visible without sonar and vulnerable to weapons that target surface ships.",
    "让潜艇上浮，以获得更快的航速和更广的视野。上浮后，无需声呐就能发现它们，攻击水面舰艇的武器也能击中它们。",
    "잠수함을 부상시켜 이동 속도와 시야를 늘립니다. 수면에서는 소나 없이도 발견되며 수상함을 공격하는 무기에 피격될 수 있습니다."
  ],
  "cmd.dive.desc": [
    "Send submarines below the surface to conceal them from enemies without sonar. Diving requires deep water and gives up the surface speed and sight bonuses.",
    "让潜艇下潜，使没有声呐的敌人无法发现它们。下潜需要深水，并会失去水面航行的速度和视野加成。",
    "잠수함을 잠수시켜 소나가 없는 적에게서 숨깁니다. 잠수하려면 깊은 물이 필요하며 수면에서 얻는 속도와 시야 보너스는 사라집니다."
  ],
  "cmd.unload.desc": [
    "Unload every passenger from the selected transports at their current location. Passengers disembark where the nearby terrain allows.",
    "让选中运输单位在当前位置卸下全部乘员。乘员会在附近能够通行的地形上离开运输单位。",
    "선택한 수송 유닛의 모든 탑승 유닛을 현재 위치에서 내립니다. 탑승 유닛은 주변의 이동 가능한 지형에 하차합니다."
  ],
  "cmd.resume.desc": [
    "Send nearby engineers to finish the selected construction site. Idle engineers are chosen first; if none are idle, nearby working engineers are reassigned.",
    "派遣附近的工程车完成选中的施工工地。优先选择空闲工程车；如果没有空闲工程车，则调派附近正在工作的工程车。",
    "주변 공병차를 보내 선택한 건설 현장을 완성합니다. 대기 중인 공병차를 우선 선택하며, 없으면 주변에서 작업 중인 공병차를 재배정합니다."
  ],
  "cmd.sell.desc": [
    "Dismantle the selected buildings and recover part of their cost. The refund depends on their remaining health. Unfinished construction is cancelled instead.",
    "拆除选中的建筑，收回部分建造费用。返还金额取决于剩余生命值。未完工的工地则会取消建造。",
    "선택한 건물을 철거하고 건설 비용의 일부를 돌려받습니다. 환급액은 남은 체력에 따라 달라집니다. 미완성 건물은 건설을 취소합니다."
  ],
  "cmd.launchNuke.desc": [
    "Choose a target point for a loaded nuclear warhead. The blast damages units and buildings across a wide area, including friendly forces.",
    "选择已装载核弹头的打击地点。爆炸会对大范围内的单位和建筑造成伤害，也会波及友军。",
    "장전된 핵탄두의 목표 지점을 선택하세요. 폭발은 아군을 포함해 넓은 범위의 유닛과 건물에 피해를 줍니다."
  ],
  "cmd.launchEmp.desc": [
    "Choose a target point for a loaded EMP warhead. Its pulse temporarily disables units and buildings in the blast area, including friendly forces.",
    "选择已装载电磁脉冲弹头的打击地点。脉冲会暂时瘫痪爆炸范围内的单位和建筑，也会波及友军。",
    "장전된 EMP 탄두의 목표 지점을 선택하세요. 펄스는 폭발 범위 안의 아군을 포함한 유닛과 건물을 일시적으로 무력화합니다."
  ],
  "cmd.dropNukeBomb.desc": [
    "Choose a target point. The aircraft flies there to drop its loaded nuclear bomb, damaging units and buildings across a wide area, including friendly forces.",
    "选择打击地点。飞机会飞往那里投下已装载的核航弹，对大范围内的单位和建筑造成伤害，也会波及友军。",
    "목표 지점을 선택하세요. 항공기가 그곳으로 날아가 장전된 핵폭탄을 투하하여 아군을 포함한 넓은 범위의 유닛과 건물에 피해를 줍니다."
  ],
  // the looks (`game/skins.ts`): each camo's and skin's name, and what it is (the Store's pages)
  "skin.steel.name": ["Steel", "钢铁", "강철"],
  "skin.steel.desc": [
    "The machines as the factory turns them out: bare steel and gunmetal grey, with nothing painted over them.",
    "工厂出厂时的原样：裸露的钢材与炮铜灰，不加任何涂装。",
    "공장에서 막 나온 그대로의 모습. 맨 강철과 건메탈 회색에 아무것도 덧칠하지 않았습니다."
  ],
  "skin.desert-depot.name": ["Desert Depot", "沙漠补给站", "사막 보급창"],
  "skin.desert-depot.desc": [
    "The war factory in desert tan under sprawling camouflage nets, the way the depots of 1990–91 stood in the sand.",
    "沙漠黄色的战车工厂，覆盖着大片伪装网，一如 1990 至 1991 年间伫立在沙地里的补给站。",
    "넓은 위장망 아래 사막색으로 칠한 전차 공장. 1990~91년 모래 위에 서 있던 보급창의 모습입니다."
  ],
  "skin.nodding-donkey.name": ['Extractor "Nodding Donkey"', "采矿场“磕头机”", '채굴장 "노딩 동키"'],
  "skin.nodding-donkey.desc": [
    "A pumpjack nodding over its well on a gravel pad, day and night, the way the oilfields of the Gulf have been worked for generations.",
    "砾石井场上，抽油机日夜对着油井点头，海湾的油田世世代代都是这样开采的。",
    "자갈 깔린 부지에서 펌프잭이 밤낮으로 유정 위로 고개를 끄덕입니다. 걸프의 유전은 대대로 이렇게 돌아갔습니다."
  ],
  "skin.guoliang-hq.name": ["Guoliang Headquarters", "郭亮总部", "궈량 사령부"],
  "skin.guoliang-hq.desc": [
    "The headquarters cut into the red rock of the Taihang, a gallery of windows along its face.",
    "凿入太行山红色岩壁的总部，岩面上开着一排窗洞。",
    "타이항산의 붉은 바위를 깎아 만든 사령부. 바위 면을 따라 창문 회랑이 뚫려 있습니다."
  ],
  "skin.pt-base.name": ["PT Base", "PT 艇基地", "PT 보트 기지"],
  "skin.pt-base.desc": [
    "A PT-boat base in the Solomons, 1943: timber piers on palm logs, a Quonset hut, a thatched lookout, and boats that went out every night into the Slot.",
    "1943 年所罗门群岛的 PT 艇基地：棕榈原木上的木码头、半圆拱形营房和茅草顶瞭望塔，鱼雷艇每晚从这里驶入“狭道”。",
    "1943년 솔로몬 제도의 PT 보트 기지. 야자 통나무 위의 나무 부두, 퀀셋 막사, 초가지붕 망루. 보트들은 밤마다 이곳에서 '슬롯'으로 나갔습니다."
  ],
  "skin.woodland.name": ["Woodland", "林地迷彩", "우드랜드 위장"],
  "skin.woodland.desc": [
    "The four-colour pattern of the 1980s: blotches of forest green and brown over light green, broken by black strokes.",
    "20 世纪 80 年代的四色迷彩：浅绿底色上铺开森林绿与棕色斑块，再以黑色笔触打散。",
    "1980년대의 4색 위장. 연녹색 바탕에 짙은 녹색과 갈색 반점을 얹고 검은 붓질로 흩뜨립니다."
  ],
  "skin.winter.name": ["Winter Whitewash", "冬季白色涂装", "동계 백색 도장"],
  "skin.winter.desc": [
    "Lime wash brushed on by hand when the snow came, the olive showing through wherever the brush ran dry.",
    "下雪时用刷子手工刷上的石灰涂层，刷子干涩处还透出底下的橄榄绿。",
    "눈이 내리자 붓으로 직접 덧바른 석회 도료. 붓이 마른 자리마다 올리브색 바탕이 비칩니다."
  ],
  "skin.desert.name": ["Desert", "沙漠迷彩", "사막 위장"],
  "skin.desert.desc": [
    "Broad blotches of field drab over a sand ground, a few dark marks among them to break the edges.",
    "沙色底色上铺开大块土褐色斑块，其间点缀几处深色痕迹以打散轮廓。",
    "모래색 바탕에 넓은 흑갈색 반점을 얹고, 윤곽을 흐리려고 짙은 자국 몇 개를 더했습니다."
  ],
  "skin.urban.name": ["Urban", "城市迷彩", "도시 위장"],
  "skin.urban.desc": [
    "Rectangles of light grey, slate and near-black, the pattern city garrisons painted to break a vehicle's lines against walls and windows.",
    "浅灰、石板灰与近黑色的矩形色块，城市驻军用它在墙壁与窗户前打散车辆的轮廓。",
    "밝은 회색, 슬레이트, 검은색에 가까운 사각형들. 도시 주둔군이 벽과 창 앞에서 차량의 윤곽을 흐리려고 칠한 무늬입니다."
  ],
  "skin.dazzle.name": ["Dazzle", "炫目迷彩", "다즐 위장"],
  "skin.dazzle.desc": [
    "Bold wedges of black, pale grey and navy cut across the hull at clashing angles, to make a ship's course and speed a guess.",
    "黑、浅灰与海军蓝的醒目楔形以相互冲突的角度切过船体，让航向与航速难以判断。",
    "검정, 옅은 회색, 남색의 굵은 쐐기가 서로 어긋난 각도로 선체를 가로지릅니다. 침로와 속력을 짐작하기 어렵게 만드는 도색입니다."
  ],
  "skin.aggressor.name": ["Aggressor", "假想敌涂装", "가상적기 도장"],
  "skin.aggressor.desc": [
    "The blue-grey splinter of the squadrons that fly as the enemy in training, in sharp shards over the whole machine.",
    "在训练中扮演敌方的中队所用的蓝灰碎片迷彩，尖锐的色块铺满全身。",
    "훈련에서 적 역할을 맡는 비행대의 청회색 파편 위장. 날카로운 조각이 전체를 덮습니다."
  ],
  "skin.lizard.name": ["Lizard", "蜥蜴迷彩", "리저드 위장"],
  "skin.lizard.desc": [
    "Long wavy bands of two dark greens and gunship grey, the scheme helicopters and transports wore over the forests of 1980s Europe.",
    "两种深绿与炮艇灰组成的长条波浪色带，是 20 世纪 80 年代欧洲森林上空的直升机与运输机所用的涂装。",
    "두 가지 짙은 녹색과 건십 회색이 긴 물결 띠를 이루는 도장. 1980년대 유럽의 숲 위를 날던 헬리콥터와 수송기의 모습입니다."
  ],
  "skin.cold-wave.name": ['Bison "Cold Wave"', "野牛“寒潮”", '바이슨 "콜드 웨이브"'],
  "skin.cold-wave.desc": [
    "A dome of cast steel on a low hull, built for a war on the plains of Europe that everyone rehearsed and nobody fought.",
    "低矮车体上顶着一座铸钢圆顶炮塔，为一场人人都在演练、却从未打响的欧洲平原之战而造。",
    "낮은 차체 위에 주조 강철 돔 포탑을 얹었습니다. 모두가 연습했지만 끝내 아무도 치르지 않은 유럽 평원의 전쟁을 위해 만들어졌습니다."
  ],
  "skin.hailstorm.name": ['Tempest "Hailstorm"', "暴风雨“冰雹”", '템페스트 "헤일스톰"'],
  "skin.hailstorm.desc": [
    "A rack of rocket tubes on the back of an army truck: a whole battery's weight of fire in one salvo, and gone down the road before the answer lands.",
    "军用卡车后背上的一排火箭发射管：一次齐射倾泻整个炮兵连的火力，回击落下之前已经开走。",
    "군용 트럭 적재함에 로켓 발사관을 줄지어 얹었습니다. 한 번의 일제 사격에 포대 하나 분량의 화력을 쏟아붓고, 반격이 떨어지기 전에 길을 따라 사라집니다."
  ],
  "skin.linebacker.name": ['Falcon "Linebacker"', "猎隼“后卫”", '팔콘 "라인배커"'],
  "skin.linebacker.desc": [
    "Two crew under one long canopy, in the tan and two greens it wore over the jungles of Southeast Asia. Its first models went to war with no gun at all.",
    "长长的座舱盖下坐着两名机组，涂着它在东南亚丛林上空所穿的棕褐与两种绿色。早期型号上战场时干脆没有装机炮。",
    "긴 캐노피 아래 두 명의 승무원, 동남아시아 정글 위에서 입었던 황갈색과 두 가지 녹색의 도색. 초기형은 기관포 하나 없이 전쟁에 나갔습니다."
  ],
  "skin.dew-line.name": ['Radar Station "DEW Line"', "雷达站“远程预警线”", '레이더 기지 "듀 라인"'],
  "skin.dew-line.desc": [
    "A mesh antenna on the edge of the Arctic, one of a chain of stations across the top of the world, watching the polar sky for bombers that never came.",
    "北极边缘的一面网状天线，是横贯世界之巅的一串雷达站之一，日夜注视极地天空，等待始终没有飞来的轰炸机。",
    "북극 가장자리에 선 그물망 안테나. 세계의 꼭대기를 가로지르는 기지 사슬 가운데 하나로, 끝내 오지 않은 폭격기를 기다리며 극지의 하늘을 지켰습니다."
  ],
  "skin.minuteman.name": ['Nuclear Silo "Minuteman"', "核弹发射井“民兵”", '핵 사일로 "미니트맨"'],
  "skin.minuteman.desc": [
    "A square of chain-link on the open prairie and a concrete lid flush with the grass. Farmers ploughed around them for decades.",
    "开阔草原上一圈方形铁丝网，一块与草地齐平的混凝土盖板。几十年来，农夫们就绕着它们耕地。",
    "탁 트인 대초원 위 네모난 철조망과 풀밭과 높이가 같은 콘크리트 덮개. 농부들은 수십 년 동안 그 둘레를 돌아 밭을 갈았습니다."
  ],
  "skin.rhino.name": ['Wolf "Rhino"', "野狼“犀牛”", '울프 "라이노"'],
  "skin.rhino.desc": [
    "In the hedgerows of Normandy a sergeant welded steel from the beach obstacles to a tank's bow as tusks, and it burst through the banks that had stopped every tank before it.",
    "在诺曼底的树篱间，一名中士把海滩障碍物上的钢材焊到坦克车首做成钢齿，从此它能冲破那些挡住所有坦克的土垄。",
    "노르망디의 산울타리 사이에서 한 부사관이 해변 장애물의 강철을 전차 앞머리에 엄니처럼 용접했고, 전차들을 가로막던 흙둑을 뚫고 나갈 수 있게 되었습니다."
  ],
  "skin.bocage.name": ['Recon Buggy "Bocage"', "侦察车“树篱”", '정찰 버기 "보카주"'],
  "skin.bocage.desc": [
    "A quarter-ton of open four-by-four with a machine gun on a post. It carried generals, wounded, wire and mail, and went wherever a man could walk.",
    "四分之一吨的敞篷四驱车，支架上架着一挺机枪。它载过将军、伤员、电话线和邮包，人走得到的地方它就开得到。",
    "기관총을 거치대에 올린 4분의 1톤 무개 사륜구동차. 장군과 부상병, 전화선과 우편을 실어 날랐고, 사람이 걸어갈 수 있는 곳이면 어디든 갔습니다."
  ],
  "skin.pulpit.name": ['Thunder "Pulpit"', "雷霆“讲坛”", '선더 "풀핏"'],
  "skin.pulpit.desc": [
    "An open-topped howitzer on a tank's hull, a machine gun standing in a round pulpit beside the gun. For that pulpit its crews named it after a priest.",
    "坦克底盘上的一门敞顶榴弹炮，炮旁一座圆形机枪座高高耸起，形似教堂讲坛，乘员们便因此给它起了个神父的名字。",
    "전차 차체 위의 무개 곡사포, 포 옆에는 둥근 설교단 같은 총좌에 기관총이 서 있습니다. 그 설교단 때문에 승무원들은 이 포에 사제의 이름을 붙였습니다."
  ],
  "skin.hedgehog.name": ['Flak Track "Hedgehog"', "防空炮车“刺猬”", '대공 장갑차 "헤지호그"'],
  "skin.hedgehog.desc": [
    "Four 20 mm cannon on one turning mount on the back of a German half-track, its mesh sides let down for the crew to stand on. It guarded the roads behind the beaches against the fighter-bombers.",
    "德军半履带车后部的一座旋转炮架上装着四门 20 毫米机炮，网格侧板放倒下来，成了炮手站立的平台。它守着滩头后方的公路，防备战斗轰炸机。",
    "독일군 반궤도 차량 뒤편의 회전 포가 하나에 20mm 기관포 네 문. 그물 측판을 내려 사수들의 발판으로 삼았습니다. 해변 뒤편의 도로를 전투폭격기로부터 지켰습니다."
  ],
  "skin.neptune.name": ['Landing Craft "Neptune"', "登陆艇“海王星”", '상륙정 "넵튠"'],
  "skin.neptune.desc": [
    "Plywood and a steel ramp, green from bow to stern, putting men on the beach a boatload at a time on the morning of the landings. A general said afterwards that this little boat won the war.",
    "胶合板船身配一块钢制跳板，从艇首到艇尾通体漆绿。登陆那天清晨，它一船又一船地把士兵送上海滩；一位将军后来说，是这种小艇赢得了战争。",
    "합판 선체에 강철 램프, 뱃머리부터 고물까지 녹색. 상륙의 아침, 병사들을 한 배씩 해변에 내려놓았습니다. 훗날 한 장군은 이 작은 배가 전쟁을 이겼다고 말했습니다."
  ],
  "skin.overlord.name": ['Thunderbolt "Overlord"', "霹雳“霸王”", '선더볼트 "오버로드"'],
  "skin.overlord.desc": [
    "A radial engine as big as a barrel, bombs under the wings, and a name for bringing its pilot home through anything. It hunted trains and tanks on the roads behind the beaches.",
    "木桶般粗大的星型发动机，翼下挂着炸弹，以不管伤成什么样都能把飞行员带回家而闻名。它在滩头后方的公路上猎杀火车与坦克。",
    "드럼통만 한 성형 엔진, 날개 아래 폭탄. 어떤 피해를 입어도 조종사를 집에 데려온다는 평판을 얻었습니다. 해변 뒤편의 도로에서 열차와 전차를 사냥했습니다."
  ],
  "skin.flying-tiger.name": ['Falcon "Flying Tiger"', "猎隼“飞虎”", '팔콘 "플라잉 타이거"'],
  "skin.flying-tiger.desc": [
    "A long nose, a bubble canopy, and a silk patch sewn inside the pilot's jacket asking whoever found him to see him safely home.",
    "修长的机头，水滴形座舱罩；飞行员夹克内缝着一块绸布，请求发现他的人护送他平安回家。",
    "긴 기수와 물방울형 캐노피. 조종사의 재킷 안쪽에는 자신을 발견한 사람에게 무사히 돌려보내 달라고 부탁하는 비단 천이 꿰매져 있었습니다."
  ],
  "skin.hump.name": ['C-47 "Hump"', "C-47“驼峰”", 'C-47 "험프"'],
  "skin.hump.desc": [
    "Bare aluminium over the Himalaya, flying fuel and shells into China across the mountains its crews called the Hump. The wreckage below marked the way.",
    "未上漆的铝色机身飞越喜马拉雅，把燃料与炮弹运进中国；机组称那片群山为“驼峰”，航线下散落的残骸就是路标。",
    "도색하지 않은 알루미늄 기체로 히말라야를 넘어 중국에 연료와 포탄을 날랐습니다. 승무원들은 그 산맥을 '험프'라 불렀고, 항로 아래 흩어진 잔해가 곧 이정표였습니다."
  ],
  "skin.expedition.name": ['Bison "Expedition"', "野牛“远征”", '바이슨 "익스페디션"'],
  "skin.expedition.desc": [
    "A cast turret on a long engine deck, driven by Chinese crews who trained in India and fought their way back into Burma to open the road again.",
    "修长发动机舱上的铸造炮塔，由在印度受训的中国乘员驾驶，一路打回缅甸，重新打通公路。",
    "긴 기관실 위에 주조 포탑. 인도에서 훈련받은 중국 전차병들이 몰고 버마로 싸워 들어가 길을 다시 열었습니다."
  ],
  "skin.ledo.name": ['Engineer "Ledo"', "工程车“雷多”", '공병차 "레도"'],
  "skin.ledo.desc": [
    "Blade raised, it cut a road through jungle and over mountains from India into China. The saying went that the road cost a man a mile.",
    "它高举推铲，从印度穿越丛林、翻过群山，一路推出通往中国的公路。人们说，这条路每修一英里就要付出一条人命。",
    "삽날을 치켜든 채 정글을 뚫고 산을 넘어 인도에서 중국까지 길을 냈습니다. 1마일마다 한 사람의 목숨이 들었다는 말이 전해집니다."
  ],
  "skin.bridge-buster.name": ['Vulture "Bridge Buster"', "秃鹫“桥梁克星”", '벌처 "브리지 버스터"'],
  "skin.bridge-buster.desc": [
    "Twin tails and a gun turret on its back, flying low along the rivers of Burma, where its squadron brought down so many bridges that it took the name.",
    "双垂尾，机背一座炮塔，沿着缅甸的河流低空飞行；它所在的中队炸断的桥梁多到干脆以此为名。",
    "쌍수직꼬리와 등의 기총 포탑. 버마의 강을 따라 낮게 날았고, 소속 비행대는 다리를 하도 많이 끊어서 아예 그것을 이름으로 삼았습니다."
  ],
  "skin.kunming.name": ['Airbase "Kunming"', "空军基地“昆明”", '공군 기지 "쿤밍"'],
  "skin.kunming.desc": [
    "A runway of crushed stone laid by hand, a great stone roller beside it that hundreds of villagers hauled up and down on ropes, and pens of earth for the aircraft.",
    "一条手工铺就的碎石跑道，旁边是数百名乡民用绳索来回拖拽的巨大石碾，四周是土筑的机堡。",
    "손으로 깐 쇄석 활주로, 그 옆에는 수백 명의 마을 사람들이 밧줄로 끌고 오가던 커다란 돌 롤러, 그리고 흙으로 쌓은 엄체호."
  ],
  // the bundles (`game/bundles.ts`): what the Store's catalogue sells, each under a name of its own
  "bundle.normandy.name": ["Normandy", "诺曼底", "노르망디"],
  "bundle.normandy.desc": [
    "June 1944 on the Norman coast: the machines of both sides that met on the beaches and fought on through the hedgerows, and the black and white invasion stripes on the Thunderbolt and the C-47.",
    "1944 年 6 月的诺曼底海岸：双方在海滩上交锋、又在树篱间一路苦战的装备，霹雳与 C-47 涂着黑白相间的入侵条纹。",
    "1944년 6월, 노르망디 해안. 해변에서 맞붙고 산울타리 사이를 싸워 나간 양측의 장비들, 그리고 선더볼트와 C-47에 칠한 흑백 침공 줄무늬."
  ],
  "bundle.burma-road.name": ["Burma Road", "滇缅公路", "버마 공로"],
  "bundle.burma-road.desc": [
    "The road into China, 1942 to 1945: fighters over Kunming, transports over the Hump, the tanks and bulldozers that opened the way from India, and the shark mouth on the Falcon and the Vulture.",
    "通往中国的公路，1942 至 1945 年：昆明上空的战斗机，飞越驼峰的运输机，从印度打开通路的坦克与推土机，猎隼与秃鹫的机头涂着鲨鱼嘴。",
    "중국으로 가는 길, 1942~1945년. 쿤밍 하늘의 전투기, 험프를 넘은 수송기, 인도에서 길을 연 전차와 불도저, 그리고 팔콘과 벌처의 기수에 그린 상어 입."
  ],
  "bundle.cold-war.name": ["Cold War Echoes", "冷战余波", "냉전의 메아리"],
  "bundle.cold-war.desc": [
    "The 1960s, when both sides built for a war that never came: dome-turreted tanks, rocket trucks, radar at the edge of the Arctic and silos under the prairie, the flag of the United States over the Bison's rear deck and the flag of Russia over the Hailstorm's.",
    "20 世纪 60 年代，双方都在为一场从未到来的战争做准备：圆顶炮塔的坦克、火箭卡车、北极边缘的雷达与草原下的发射井；野牛的后甲板上系着美国国旗，冰雹的后甲板上系着俄罗斯国旗。",
    "양쪽 모두 끝내 오지 않은 전쟁을 준비하던 1960년대. 돔 포탑 전차, 로켓 트럭, 북극 끝의 레이더와 대초원 아래의 사일로. 바이슨의 후면 갑판에는 미국 국기를, 헤일스톰의 후면 갑판에는 러시아 국기를 묶었습니다."
  ],
  "bundle.fulda-gap.name": ["Fulda Gap", "富尔达缺口", "풀다 갭"],
  "bundle.fulda-gap.desc": [
    "West Germany in the 1980s: the four-colour woodland camouflage, and sandbags slung along the tracked vehicles' sides.",
    "20 世纪 80 年代的西德：四色林地迷彩，履带车辆两侧挂着沙袋。",
    "1980년대의 서독. 4색 우드랜드 위장에, 궤도 차량 양옆에는 모래주머니를 매답니다."
  ],
  "bundle.ardennes.name": ["Ardennes", "阿登", "아르덴"],
  "bundle.ardennes.desc": [
    "The winter front: lime wash brushed over the paint, and a white ring on the barrel for every kill.",
    "冬季战线：刷在涂装上的石灰涂层，每击毁一个敌人就在炮管上添一道白环。",
    "겨울 전선. 도장 위에 덧바른 석회 도료에, 적을 격파할 때마다 포신에 흰 고리를 하나씩 더합니다."
  ],
  "bundle.burgan.name": ["Burgan Field", "布尔甘油田", "부르간 유전"],
  "bundle.burgan.desc": [
    "The oil war of 1990–91: the war factory in desert tan under its camouflage nets, and pumpjacks nodding over the extractors' wells.",
    "1990 至 1991 年的石油战争：伪装网下的沙漠黄战车工厂，抽油机在采矿场的井口上不停点头。",
    "1990~91년의 석유 전쟁. 위장망 아래 사막색 전차 공장과, 채굴장 유정 위에서 고개를 끄덕이는 펌프잭입니다."
  ],
  "bundle.tobruk.name": ["Tobruk", "托布鲁克", "토브루크"],
  "bundle.tobruk.desc": [
    "The desert war: field drab over sand, and fuel cans racked on the wheeled vehicles where there is room.",
    "沙漠战争：沙色上的土褐色迷彩，轮式车辆在空处架着备用油桶。",
    "사막 전쟁. 모래색 위의 흑갈색 위장에, 바퀴 달린 차량은 빈자리에 연료통을 겁니다."
  ],
  "bundle.berlin-brigade.name": ["Berlin Brigade", "柏林旅", "베를린 여단"],
  "bundle.berlin-brigade.desc": [
    "The city garrison of the Cold War: the grey blocks of the urban camouflage, and sandbags laid round the gun pads' mounts.",
    "冷战时期的城市驻军：城市迷彩的灰色色块，炮塔的炮座四周垒着沙袋。",
    "냉전기의 도시 주둔군. 도시 위장의 회색 블록에, 포탑 포좌 둘레에는 모래주머니를 쌓습니다."
  ],
  "bundle.north-atlantic.name": ["North Atlantic", "北大西洋", "북대서양"],
  "bundle.north-atlantic.desc": [
    "The convoy war: dazzle wedges cut across the hulls, a white ring on the guns for every kill, and the Union Jack over the headquarters.",
    "护航战争：楔形炫目迷彩切过船体，每击毁一个敌人就在炮管上添一道白环，总部上空飘着米字旗。",
    "호송 전쟁. 선체를 가로지르는 다즐 쐐기에, 적을 격파할 때마다 포신에 흰 고리를 하나씩 더하고, 사령부에는 유니언 잭을 올립니다."
  ],
  "bundle.red-flag.name": ["Red Flag", "红旗演习", "레드 플래그"],
  "bundle.red-flag.desc": [
    "The squadrons that fly as the enemy in training: the aggressor splinter, a fuel tank under each wing of the fast jets, and the South African flag over the headquarters.",
    "训练中扮演敌方的中队：假想敌碎片迷彩，快速喷气机两翼下各挂一具副油箱，总部上空飘着南非国旗。",
    "훈련에서 적 역할을 맡는 비행대. 가상적기 파편 위장에, 고속 제트기의 양 날개 아래에는 보조 연료탱크를 하나씩 달고, 사령부에는 남아프리카 공화국 국기를 올립니다."
  ],
  "bundle.nap-of-the-earth.name": ["Nap of the Earth", "贴地飞行", "초저공 비행"],
  "bundle.nap-of-the-earth.desc": [
    "Low over the forests of 1980s Europe: the lizard's long bands of green and grey on the helicopters and transports, and the Tricolore over the headquarters.",
    "低掠 20 世纪 80 年代欧洲的森林：直升机与运输机涂着蜥蜴迷彩的绿灰长条色带，总部上空飘着法国三色旗。",
    "1980년대 유럽의 숲 위를 낮게. 헬리콥터와 수송기에 리저드 위장의 녹색과 회색 긴 띠를 두르고, 사령부에는 프랑스 삼색기를 올립니다."
  ],
  // the decals (`game/decals.ts`), mounted on whichever lines they fit, over any look
  "decal.stars-and-stripes.name": ["Stars and Stripes", "星条旗", "성조기"],
  "decal.stars-and-stripes.desc": [
    "The flag of the United States: tied over a land vehicle's rear deck, and flown from a building's mast.",
    "美国国旗：陆地车辆系在后甲板上，建筑则挂在天线杆上。",
    "미국 국기. 지상 차량은 후면 갑판에 묶고, 건물은 안테나 돛대에 겁니다."
  ],
  "decal.five-star-red-flag.name": ["Five-Star Red Flag", "五星红旗", "오성홍기"],
  "decal.five-star-red-flag.desc": [
    "The flag of China: tied over a land vehicle's rear deck, and flown from a building's mast.",
    "中国国旗：陆地车辆系在后甲板上，建筑则挂在天线杆上。",
    "중국 국기. 지상 차량은 후면 갑판에 묶고, 건물은 안테나 돛대에 겁니다."
  ],
  "decal.russian-tricolour.name": ["Russian Tricolour", "俄罗斯三色旗", "러시아 삼색기"],
  "decal.russian-tricolour.desc": [
    "The flag of Russia: tied over a land vehicle's rear deck, and flown from a building's mast.",
    "俄罗斯国旗：陆地车辆系在后甲板上，建筑则挂在天线杆上。",
    "러시아 국기. 지상 차량은 후면 갑판에 묶고, 건물은 안테나 돛대에 겁니다."
  ],
  "decal.maple-leaf.name": ["Maple Leaf", "枫叶旗", "단풍잎기"],
  "decal.maple-leaf.desc": [
    "The flag of Canada: tied over a land vehicle's rear deck, and flown from a building's mast.",
    "加拿大国旗：陆地车辆系在后甲板上，建筑则挂在天线杆上。",
    "캐나다 국기. 지상 차량은 후면 갑판에 묶고, 건물은 안테나 돛대에 겁니다."
  ],
  "decal.tricolore.name": ["Tricolore", "法国三色旗", "프랑스 삼색기"],
  "decal.tricolore.desc": [
    "The flag of France: tied over a land vehicle's rear deck, and flown from a building's mast.",
    "法国国旗：陆地车辆系在后甲板上，建筑则挂在天线杆上。",
    "프랑스 국기. 지상 차량은 후면 갑판에 묶고, 건물은 안테나 돛대에 겁니다."
  ],
  "decal.union-jack.name": ["Union Jack", "米字旗", "유니언 잭"],
  "decal.union-jack.desc": [
    "The flag of the United Kingdom: tied over a land vehicle's rear deck, and flown from a building's mast.",
    "英国国旗：陆地车辆系在后甲板上，建筑则挂在天线杆上。",
    "영국 국기. 지상 차량은 후면 갑판에 묶고, 건물은 안테나 돛대에 겁니다."
  ],
  "decal.taegukgi.name": ["Taegukgi", "太极旗", "태극기"],
  "decal.taegukgi.desc": [
    "The flag of South Korea: tied over a land vehicle's rear deck, and flown from a building's mast.",
    "韩国国旗：陆地车辆系在后甲板上，建筑则挂在天线杆上。",
    "대한민국 국기. 지상 차량은 후면 갑판에 묶고, 건물은 안테나 돛대에 겁니다."
  ],
  "decal.south-african-flag.name": ["South African Flag", "南非国旗", "남아프리카 공화국 국기"],
  "decal.south-african-flag.desc": [
    "The flag of South Africa: tied over a land vehicle's rear deck, and flown from a building's mast.",
    "南非国旗：陆地车辆系在后甲板上，建筑则挂在天线杆上。",
    "남아프리카 공화국 국기. 지상 차량은 후면 갑판에 묶고, 건물은 안테나 돛대에 겁니다."
  ],
  "decal.german-flag.name": ["German Flag", "德国国旗", "독일 국기"],
  "decal.german-flag.desc": [
    "The flag of Germany: tied over a land vehicle's rear deck, and flown from a building's mast.",
    "德国国旗：陆地车辆系在后甲板上，建筑则挂在天线杆上。",
    "독일 국기. 지상 차량은 후면 갑판에 묶고, 건물은 안테나 돛대에 겁니다."
  ],
  "decal.tiranga.name": ["Tiranga", "印度国旗", "인도 국기"],
  "decal.tiranga.desc": [
    "The flag of India: tied over a land vehicle's rear deck, and flown from a building's mast.",
    "印度国旗：陆地车辆系在后甲板上，建筑则挂在天线杆上。",
    "인도 국기. 지상 차량은 후면 갑판에 묶고, 건물은 안테나 돛대에 겁니다."
  ],
  "decal.auriverde.name": ["Auriverde", "巴西国旗", "브라질 국기"],
  "decal.auriverde.desc": [
    "The flag of Brazil: tied over a land vehicle's rear deck, and flown from a building's mast.",
    "巴西国旗：陆地车辆系在后甲板上，建筑则挂在天线杆上。",
    "브라질 국기. 지상 차량은 후면 갑판에 묶고, 건물은 안테나 돛대에 겁니다."
  ],
  "decal.sandbags.name": ["Sandbags", "沙袋", "모래주머니"],
  "decal.sandbags.desc": [
    "Sandbags slung along a tracked vehicle's sides for a little more protection, a bag or two here and there.",
    "履带车辆两侧零星挂上几只沙袋，多添一点防护。",
    "궤도 차량 양옆에 모래주머니를 드문드문 매달아 방호를 조금 더합니다."
  ],
  "decal.gun-pit.name": ["Gun Pit", "沙袋炮位", "모래주머니 포좌"],
  "decal.gun-pit.desc": [
    "A broken ring of sandbags laid round a gun pad's mount, one course high, with a way in at the back.",
    "炮塔炮座四周垒起一圈断续的沙袋，只有一层，背后留出入口。",
    "포탑 포좌 둘레에 한 층 높이로 띄엄띄엄 쌓은 모래주머니. 뒤쪽에 드나드는 틈을 남겼습니다."
  ],
  "decal.jerry-cans.name": ["Jerry Cans", "备用油桶", "제리캔"],
  "decal.jerry-cans.desc": [
    "Fuel cans racked on a wheeled vehicle where there is room, olive drab and now and then one in sand.",
    "轮式车辆在空处架着的备用油桶，橄榄绿，偶尔一只沙色。",
    "바퀴 달린 차량의 빈자리에 건 연료통. 올리브색이고, 가끔 모래색이 하나 섞입니다."
  ],
  "decal.drop-tanks.name": ["Drop Tanks", "副油箱", "보조 연료탱크"],
  "decal.drop-tanks.desc": [
    "A fuel tank slung under each wing of a fast jet.",
    "快速喷气机两翼下各挂一具副油箱。",
    "고속 제트기의 양 날개 아래에 하나씩 단 연료탱크."
  ],
  "decal.invasion-stripes.name": ["Invasion Stripes", "入侵条纹", "침공 줄무늬"],
  "decal.invasion-stripes.desc": [
    "Five bands of white and black round the wings and the tail, painted by hand on the night before the landing.",
    "机翼与机尾绕着五道黑白相间的条纹，是登陆前夜手工漆上的。",
    "날개와 꼬리에 흰색과 검은색 띠 다섯 줄을 둘렀습니다. 상륙 전날 밤 손으로 칠한 것입니다."
  ],
  "decal.shark-mouth.name": ["Shark Mouth", "鲨鱼嘴", "상어 입"],
  "decal.shark-mouth.desc": [
    "A shark's mouth and eye painted on the nose, red, lined with white teeth.",
    "机头漆着鲨鱼的嘴和眼睛，红色的嘴边排着白牙。",
    "기수에 칠한 상어의 입과 눈. 붉은 입가에 흰 이빨이 늘어서 있습니다."
  ],
  "decal.kill-rings.name": ["Kill Rings", "击毁环", "격파 링"],
  "decal.kill-rings.desc": [
    "A white ring painted round the gun's barrel for every enemy it destroys, the way tank and gun crews have kept their tally.",
    "每击毁一个敌人，就在炮管上漆一道白环，坦克与火炮乘员向来这样记下战绩。",
    "적을 하나 격파할 때마다 포신에 흰 고리를 하나씩 칠합니다. 전차와 포 승무원들이 전과를 새겨 온 방식입니다."
  ],
  // ------------------------------------------------------------- alerts
  "alert.underAttack": ["{0} under attack!", "{0} 遭到攻击！", "{0}이(가) 공격받고 있습니다!"],
  "alert.unitsUnderAttack": ["{0} under attack!", "{0} 遭到攻击！", "{0}이(가) 공격받고 있습니다!"],
  "alert.lowPower": ["Power shortage: work and movement slowed", "电力短缺：生产与移动减速", "전력 부족: 작업과 이동이 느려집니다"],
  // the stands' wording of a faction's own news: {0} is the faction
  "alert.lowPowerBy": ["{0} is short of power", "{0} 电力短缺", "{0} 전력 부족"],
  "alert.powerRestoredBy": ["{0} has power again", "{0} 电力已恢复", "{0} 전력 복구"],
  "alert.lastStandBy": ["{0} has no base left: its forces fight on for {1}s", "{0} 已失去基地，部队将再坚持 {1} 秒", "{0}의 기지가 없습니다. 부대는 {1}초 더 싸웁니다"],
  "alert.powerRestored": ["Power restored", "电力已恢复", "전력 복구"],
  "alert.metalStalled": ["Out of metal: work paused", "金属耗尽：工程暂停", "금속 소진: 작업 중단"],
  "alert.noPop": ["Unit cap reached", "已达人口上限", "유닛 상한 도달"],
  "alert.unitReady": ["{0} ready", "{0} 就绪", "{0} 준비 완료"],
  "alert.constructionDone": ["{0} built", "{0} 建造完成", "{0} 건설 완료"],
  "alert.upgradeDone": ["Upgrade complete: {0}", "升级完成：{0}", "업그레이드 완료: {0}"],
  "alert.directMax": ["Direct control takes up to {0} units at a time", "直接操控一次最多 {0} 个单位", "직접 조종은 한 번에 최대 {0}개 유닛까지입니다"],
  "alert.formationFew": ["A formation needs at least two units", "编队至少需要两个单位", "대형에는 유닛이 두 개 이상 필요합니다"],
  "alert.formationMax": ["A formation takes up to {0} units", "一个编队最多 {0} 个单位", "대형은 최대 {0}개 유닛까지입니다"],
  "alert.formationMixed": ["A formation is one kind: all land, all amphibious, all naval, all helicopters or all fixed-wing", "编队只能是同一类单位：全为陆地、两栖、海上、直升机或固定翼单位", "대형은 한 종류로만 이뤄집니다: 모두 지상, 수륙양용, 해상, 헬리콥터 또는 고정익기"],
  "alert.formationCannot": ["Only units that move can form up", "只有能移动的单位才能组成编队", "움직일 수 있는 유닛만 대형을 이룰 수 있습니다"],
  "alert.formationStall": ["The slowest of these flies below the others' stall speed: they cannot keep station on it", "其中最慢的一架飞得比其他飞机的失速速度还慢，它们无法与之保持编队", "가장 느린 기체가 다른 기체들의 실속 속도보다 느려서 대형을 유지할 수 없습니다"],
  "alert.sellConfirm": ["Press {0} again to sell {1} (+{2})", "再按一次 {0} 出售{1}（+{2}）", "{0}을(를) 한 번 더 누르면 {1}을(를) 판매 (+{2})"],
  "alert.sellConfirmMany": ["Press {0} again to sell {1} buildings (+{2})", "再按一次 {0} 出售 {1} 座建筑（+{2}）", "{0}을(를) 한 번 더 누르면 건물 {1}개를 판매 (+{2})"],
  "alert.unitRecycled": ["Unit recycling returned {0} metal", "回收单位返还了 {0} 金属", "유닛 재활용으로 금속 {0} 반환"],
  // the touch bar's sell button asks the same way; {0} is the button's word
  "alert.sellConfirmTap": ["Tap {0} again to sell {1} (+{2})", "再点一次“{0}”出售{1}（+{2}）", "{0}을(를) 한 번 더 누르면 {1}을(를) 판매 (+{2})"],
  "alert.sellConfirmTapMany": ["Tap {0} again to sell {1} buildings (+{2})", "再点一次“{0}”出售 {1} 座建筑（+{2}）", "{0}을(를) 한 번 더 누르면 건물 {1}개를 판매 (+{2})"],
  "alert.nukeReady": ["Nuclear warhead ready", "核弹头已就绪", "핵탄두 준비 완료"],
  "alert.nukeReadyBy": ["{0} has a nuclear warhead ready", "{0} 的核弹头已就绪", "{0}의 핵탄두 준비 완료"],
  "alert.nukeLaunched": ["Nuclear launch detected", "检测到核弹发射", "핵 발사 감지"],
  // the same launch told to the stands, who may know who fired: {0} is the faction
  "alert.nukeLaunchedBy": ["{0} launched a nuclear missile", "{0} 发射了核弹", "{0}이(가) 핵미사일을 발사했습니다"],
  "alert.nukeIntercepted": ["Nuclear warhead shot down", "核弹头已被击落", "핵탄두 격추됨"],
  "alert.nukeBombAway": ["Nuclear bomb away", "核航弹已投放", "핵폭탄 투하"],
  "alert.nukeBombBy": ["{0} dropped a nuclear bomb", "{0} 投放了核航弹", "{0}이(가) 핵폭탄을 투하했습니다"],
  "alert.nukeBombSighted": ["Nuclear bomb on the ground in sight: destroy it or clear the area", "视野内发现落地的核航弹：摧毁它或撤离该区域", "시야에 핵폭탄 낙하: 파괴하거나 그 지역을 비우세요"],
  "alert.nukeBombDestroyed": ["Nuclear bomb destroyed before it went off", "核航弹在起爆前被摧毁", "핵폭탄이 폭발 전에 파괴됨"],
  "alert.empReady": ["EMP warhead ready", "电磁脉冲弹头已就绪", "EMP 탄두 준비 완료"],
  "alert.empReadyBy": ["{0} has an EMP warhead ready", "{0} 的电磁脉冲弹头已就绪", "{0}의 EMP 탄두 준비 완료"],
  "alert.empLaunched": ["EMP launch detected", "检测到电磁脉冲弹发射", "EMP 발사 감지"],
  "alert.empLaunchedBy": ["{0} launched an EMP missile", "{0} 发射了电磁脉冲弹", "{0}이(가) EMP 미사일을 발사했습니다"],
  "alert.promoted": ["{0} promoted to {1}", "{0} 晋升为{1}", "{0}이(가) {1}(으)로 진급"],
  // the kill feed (`Hud.pushKill`): {0} what died, {1} what did it, {2} how many
  "kill.lost": ["{0} lost to {1}", "{0} 被{1}摧毁", "{1}에게 {0} 손실"],
  "kill.lostMany": ["{0} ×{2} lost to {1}", "{0} ×{2} 被{1}摧毁", "{1}에게 {0} ×{2} 손실"],
  "kill.got": ["{1} destroyed {0}", "{1} 摧毁了{0}", "{1}: {0} 격파"],
  "kill.gotMany": ["{1} destroyed {0} ×{2}", "{1} 摧毁了{0} ×{2}", "{1}: {0} ×{2} 격파"],
  "kill.unknown": ["Unknown", "未知", "알 수 없음"],
  "kill.targetMany": ["{0} ×{1}", "{0} ×{1}", "{0} ×{1}"],
  // nothing known to have done it: {0} what died, {1} how many
  "kill.lostBlind": ["{0} lost", "{0} 被摧毁", "{0} 손실"],
  "kill.lostBlindMany": ["{0} ×{1} lost", "{0} ×{1} 被摧毁", "{0} ×{1} 손실"],
  "kill.gotBlind": ["{0} destroyed", "{0} 已被摧毁", "{0} 격파"],
  "kill.gotBlindMany": ["{0} ×{1} destroyed", "{0} ×{1} 已被摧毁", "{0} ×{1} 격파"],
  "alert.respawned": ["{0} has been given a new headquarters", "{0} 获得了新的总部", "{0}이(가) 새 사령부를 받았습니다"],
  "alert.handover": ["{0} is now under AI command", "{0} 已交由 AI 指挥", "{0}이(가) 이제 AI 지휘를 받습니다"],
  "alert.kicked": ["{0} was removed by the host", "{0} 已被房主移出", "{0}이(가) 호스트에 의해 내보내졌습니다"],
  "alert.speed": ["Game speed set to ×{0}", "游戏速度设为 ×{0}", "게임 속도 ×{0}"],
  "alert.waveIncoming": ["Enemy attack wave incoming!", "敌军进攻波即将来袭！", "적 공격 파도 접근 중!"],
  // the campaign's own
  "alert.launch": ["Sarsar launch", "萨尔萨尔发射", "사르사르 발사"],
  "alert.launchDown": ["Sarsar shot down", "萨尔萨尔已被拦截", "사르사르 요격"],
  "alert.fleetRun": ["Enemy ships running the channel", "敌舰正在突入水道", "적함이 수로를 돌파 중"],
  "alert.columnOut": ["A column is leaving the city on Highway 80", "一支纵队正沿 80 号公路撤出城市", "종대 하나가 80번 고속도로로 도시를 빠져나갑니다"],
  "alert.reliefShips": ["Gunboats are on station offshore", "炮艇已在近海就位", "포함이 앞바다에 배치되었습니다"],
  "alert.marines": ["The amphibious group is on station", "两栖战斗群已就位", "상륙 전단이 배치되었습니다"],
  "alert.reliefLanded": ["The relief column has landed on the beach", "援军已在海滩登陆", "구원 종대가 해변에 상륙했습니다"],
  // breakthrough
  "alert.whistle": ["The whistle: the assault begins", "哨响：进攻开始", "휘슬: 공세 시작"],
  "alert.checkpointFell": ["Checkpoint {0} has fallen", "检查点 {0} 已失守", "검문소 {0} 함락"],
  "alert.linesMovedUp": ["The attackers’ lines have moved up", "进攻方的生产线已前移", "공격측 생산 라인이 전진했습니다"],
  "alert.chestLow": ["War chest nearly spent", "战争基金即将耗尽", "군자금이 거의 바닥났습니다"],
  "alert.clockLow": ["{0} left on the clock", "倒计时还剩 {0}", "시계에 {0} 남음"],
  "alert.playerDefeated": ["{0} has been eliminated", "{0} 已被消灭", "{0}이(가) 탈락했습니다"],
  "alert.playerSurrendered": ["{0} has surrendered", "{0} 已投降", "{0}이(가) 항복했습니다"],
  "alert.cannotBuildHere": ["Cannot build here", "无法在此建造", "여기에는 지을 수 없습니다"],
  "alert.farFromHq": ["Too far from a friendly Headquarters to build here", "离己方总部太远，无法在此建造", "아군 사령부에서 너무 멀어 여기에는 지을 수 없습니다"],
  "alert.onlyOne": ["Only one of these per faction", "每个阵营只能拥有一座", "진영마다 하나만 지을 수 있습니다"],
  // a unit a faction may hold only so many of (`UnitDef.limit`, the Hornet): {0} out now, counting those queued, of {1}
  "hud.limit": ["{0} of {1} in service", "在役 {0}/{1}", "운용 중 {0}/{1}"],
  "hud.atLimit": ["At most {0} per faction: spend one first", "每个阵营最多 {0} 架：先用掉一架", "진영당 최대 {0}대: 먼저 한 대를 쓰세요"],
  "alert.researchDone": ["Research complete: {0}", "研究完成：{0}", "연구 완료: {0}"],
  "alert.doctrineChosen": ["{0} adopted the {1}", "{0}采用了{1}", "{0}이(가) {1}을(를) 채택했습니다"],
  "alert.buildUnreachable": ["Builder cannot reach that site", "工程车无法抵达该工地", "공병차가 그 부지에 닿을 수 없습니다"],
  "alert.unloadNoGround": ["{0} cannot unload here: no open ground within reach", "{0}无法在此卸载：附近没有可用的地面", "{0}이(가) 여기서 하차시킬 수 없습니다: 닿는 범위에 빈 지면이 없습니다"],
  "alert.notEnoughMetal": [
    "Not enough metal: three quarters of the price is needed to start",
    "金属不足：需备齐四分之三造价才能开工",
    "금속 부족: 시작하려면 가격의 4분의 3이 필요합니다"
  ],
  "alert.lastStand": ["No base left: your forces fight on for {0}s", "基地已失，部队将再坚持 {0} 秒", "기지가 없습니다. 부대는 {0}초 더 싸웁니다"],
  "alert.cannotSellLastHQ": ["Cannot sell your last completed Headquarters", "无法出售最后一座已建成的总部", "마지막으로 남은 완공된 사령부는 판매할 수 없습니다"],
  "alert.hqContacts": ["{0} has lost its last HQ: surviving forces are marked for enemies", "{0} 已失去最后一座总部：敌方可见其剩余部队与建筑的位置标记", "{0}의 마지막 본부가 파괴되었습니다. 남은 병력과 건물의 위치가 적에게 표시됩니다"],
  "alert.needsDeposit": ["Must be built on a metal deposit", "必须建在金属矿脉上", "금속 광맥 위에 지어야 합니다"],
  "alert.noProductionSlot": [
    "No free production slot: build another Headquarters for more",
    "没有空余生产席位：再建一座总部可增加席位",
    "빈 생산 슬롯이 없습니다. 사령부를 하나 더 지으면 슬롯이 늘어납니다"
  ],
  "alert.requiresTech": ["Requires: {0}", "需要：{0}", "필요: {0}"],
  "alert.saved": ["Game saved", "游戏已保存", "게임 저장됨"],
  "alert.autosaved": ["Autosaved", "已自动保存", "자동 저장됨"],
  "alert.cameraSaved": ["Camera {0} saved", "镜头 {0} 已保存", "카메라 {0} 저장됨"],
  "alert.cameraOverwritten": ["Camera {0} overwritten", "镜头 {0} 已覆盖", "카메라 {0} 덮어씀"],
  // ------------------------------------------------------------- pause menu
  "pause.title": ["Paused", "暂停", "일시 정지"],
  "pause.brief": ["Battlefield brief", "战场简报", "전장 현황"],
  "pause.hiddenStats": ["Enemy statistics are revealed when the match ends.", "敌方统计在对局结束后公开。", "적 통계는 대전이 끝나면 공개됩니다."],
  "pause.resume": ["Resume", "继续", "계속"],
  "pause.save": ["Save game", "保存游戏", "게임 저장"],
  "pause.load": ["Load game", "载入游戏", "게임 불러오기"],
  "pause.settings": ["Settings", "设置", "설정"],
  "pause.restart": ["Restart", "重新开始", "다시 시작"],
  "pause.quit": ["Quit to menu", "退出到主菜单", "메뉴로 나가기"],
  "pause.restartConfirm": ["Restart this game? Unsaved progress is lost.", "重新开始？未保存的进度将丢失。", "이 게임을 다시 시작할까요? 저장하지 않은 진행은 사라집니다."],
  "pause.quitConfirm": ["Quit to menu? Unsaved progress is lost.", "退出到主菜单？未保存的进度将丢失。", "메뉴로 나갈까요? 저장하지 않은 진행은 사라집니다."],
  "pause.surrender": ["Surrender", "投降", "항복"],
  "pause.surrenderConfirm": [
    "Surrender the match? Everything you own is destroyed and you are out, though you can stay and watch.",
    "确定投降？你的一切都会被摧毁，你也随之出局，但可以留下来观战。",
    "대전에서 항복할까요? 가진 모든 것이 파괴되고 탈락합니다. 남아서 관전할 수는 있습니다."
  ],
  // ------------------------------------------------------------- the away notice
  // a browser tab on return: the battle waited, and the app would not have
  "away.title": ["Battle paused", "对局已暂停", "전투 일시 정지"],
  "away.body": [
    "The battle paused while you were away: a browser stops the game when its tab is in the background.",
    "你离开时对局已暂停：标签页切到后台后，浏览器会停止游戏。",
    "자리를 비운 동안 전투가 일시 정지되었습니다. 탭이 백그라운드로 가면 브라우저가 게임을 멈춥니다."
  ],
  "away.appIntro": [
    "The app keeps the battle running while you are away.",
    "应用可让对局在后台继续进行。",
    "앱은 자리를 비운 동안에도 전투를 계속 진행합니다."
  ],
  "away.dontRemind": ["Don't remind me again", "下次不再提醒", "다시 알리지 않기"],
  // ------------------------------------------------------------- victory / defeat
  "end.victory": ["VICTORY", "胜利", "승리"],
  "end.draw": ["DRAW", "平局", "무승부"],
  "end.timeLimit": [
    "Time limit reached. The faction with the most stored metal wins for its team.",
    "已到时限。存有最多金属的阵营及其盟友获胜。",
    "제한 시간이 되었습니다. 보유 금속이 가장 많은 진영과 그 동맹이 승리합니다."
  ],
  "end.timeLimitDraw": [
    "Time limit reached. Opposing factions are tied for the most stored metal.",
    "已到时限。敌对阵营的最高金属储备并列。",
    "제한 시간이 되었습니다. 서로 다른 팀의 진영이 보유 금속 공동 1위입니다."
  ],
  "end.defeat": ["DEFEAT", "战败", "패배"],
  "end.time": ["Time", "用时", "시간"],
  "end.unitsBuilt": ["Units built", "生产单位", "생산한 유닛"],
  "end.unitsLost": ["Units lost", "损失单位", "잃은 유닛"],
  "end.unitsKilled": ["Units destroyed", "击毁单位", "파괴한 유닛"],
  "end.buildingsLost": ["Buildings lost", "损失建筑", "잃은 건물"],
  "end.buildingsKilled": ["Buildings destroyed", "摧毁建筑", "파괴한 건물"],
  "end.metalMined": ["Metal mined", "开采金属", "채굴한 금속"],
  // ---- the ranking the plate ends on (`game/ranking.ts`, `ui/ranking.ts`)
  "rank.faction": ["Faction", "阵营", "진영"],
  "rank.kills": ["Killed", "击毁", "격파"],
  "rank.losses": ["Lost", "损失", "손실"],
  "rank.kd": ["K/D", "击损比", "격파/손실"],
  "rank.built": ["Built", "建造", "생산"],
  "rank.mined": ["Mined", "开采", "채굴"],
  "rank.spent": ["Spent", "支出", "지출"],
  // a seat that destroyed things and lost nothing: not an infinite ratio, a fact
  "rank.flawless": ["Flawless", "无损", "무손실"],
  // the accolades, one figure each, handed to whoever has the most of it
  "rank.awardedTo": ["{0} · {1}", "{0} · {1}", "{0} · {1}"],
  "rank.mostKills": ["Top gun", "击毁之王", "최다 격파"],
  "rank.mostRazed": ["Wrecking ball", "拆迁大队", "건물 파괴왕"],
  "rank.richest": ["Quartermaster", "后勤总管", "보급의 달인"],
  "rank.busiest": ["Production line", "生产线", "생산 라인"],
  "rank.cleanest": ["Hardest to kill", "损失最少", "최소 손실"],
  "rank.veterans": ["Veteran corps", "精锐之师", "정예 부대"],
  "rank.strategist": ["Strategic command", "战略司令", "전략 사령부"],
  "rank.shield": ["Shield of the realm", "护国之盾", "왕국의 방패"],
  "rank.ownGoal": ["Friendly fire", "误伤友军", "아군 오사"],
  "end.nextMission": ["Next mission", "下一关", "다음 임무"],
  "end.retry": ["Retry", "重试", "다시 시도"],
  "end.toMenu": ["Main menu", "主菜单", "메인 메뉴"],
  "end.continuePlay": ["Keep playing", "继续游玩", "계속 플레이"],
  "end.matchOver": ["MATCH OVER", "对局结束", "대전 종료"],
  "end.winner": ["{0} wins", "{0} 获胜", "{0} 승리"],
  "end.eliminated": ["ELIMINATED", "已淘汰", "탈락"],
  "end.eliminatedBody": [
    "Your faction is out of the fight. You can keep watching the match, or leave it.",
    "你的阵营已退出战斗。你可以继续观战，或离开对局。",
    "당신의 진영은 싸움에서 밀려났습니다. 대전을 계속 관전하거나 떠날 수 있습니다."
  ],
  "end.spectate": ["Keep watching", "继续观战", "계속 관전"],
  // --------------------------------------------------------- achievements
  "ach.list": ["Awards", "勋章", "훈장"],
  "ach.earned": ["Earned", "已获得", "획득"],
  "ach.secret": ["Classified", "机密", "기밀"],
  "ach.none": ["Nothing earned yet. Play a match.", "还没有获得任何成就。先打一局吧。", "아직 얻은 것이 없습니다. 대전을 한 판 하세요."],
  "ach.tier.bronze": ["Bronze", "铜", "동"],
  "ach.tier.steel": ["Steel", "钢", "강철"],
  "ach.tier.silver": ["Silver", "银", "은"],
  "ach.tier.gold": ["Gold", "金", "금"],
  "ach.tier.black": ["Blackened", "玄铁", "흑철"],
  "ach.unlocked": ["{0} unlocked", "解锁成就：{0}", "{0} 달성"],
  // the nods to other games (docs/EASTER-EGGS.md): one's own warhead on one's own headquarters
  "egg.wasted": ["WASTED", "WASTED", "WASTED"],
  // the defeat plate's F (a wreath is laid)
  "egg.respects": ["Respects paid.", "已致敬。", "경의를 표했습니다."],
  // the cheats of other games, typed into the console offline: all turned down
  "egg.cheat.denied": ["Requisition denied.", "申请驳回。", "요청 기각."],
  "egg.cheat.wololo": ["Nobody changes sides.", "无人倒戈。", "아무도 편을 바꾸지 않는다."],
  "egg.cheat.panzer": ["The motor pool is closed.", "车库已关门。", "차량기지 폐쇄."],
  // the console's `zeppelin`, never in its help: the airship called across now
  "egg.zeppelin": ["Airship inbound.", "飞艇正在接近。", "비행선 접근 중."],
  // the campaign screen's tenth card, before its door is open: a bare stone
  "egg.door.stone": ["Stone", "石", "돌"],
  // 愚公移山, the long haul (docs/EASTER-EGGS.md, section 1): the map, and the card's one line
  "egg.yugong.map": ["Taihang · Wangwu", "太行 · 王屋", "태항 · 왕옥"],
  "egg.yugong.question": [
    "Shall we level the heights with all our strength, and open a road straight south to the Han?",
    "吾与汝毕力平险，指通豫南，达于汉阴，可乎？",
    "우리 모두 힘을 다해 험한 산을 깎아, 예주 남쪽으로 곧장 길을 내고 한수 남쪽까지 닿게 하면 어떻겠느냐?"
  ],
  // the first load ever dug: where is it all to go?
  "egg.yugong.wife": [
    "His wife raised a doubt: “You could not so much as level the hill of Kuifu. What of Taihang and Wangwu? And where will you put the earth and stones?”",
    "其妻献疑曰：“以君之力，曾不能损魁父之丘，如太行、王屋何？且焉置土石？”",
    "그 아내가 의문을 제기했다. “당신의 힘으로는 괴보의 언덕도 깎지 못할 텐데, 태항과 왕옥을 어찌하겠소? 게다가 흙과 돌은 어디에 두려오?”"
  ],
  // a load out by the wrong road, the first time; and every time after
  "egg.yugong.laugh": [
    "The Wise Old Man of the River Bend laughed and would stop him: “How foolish you are! With the strength of your last years you cannot harm one hair of the mountain. What of its earth and stones?”",
    "河曲智叟笑而止之曰：“甚矣，汝之不惠！以残年余力，曾不能毁山之一毛，其如土石何？”",
    "하곡의 지수가 웃으며 말렸다. “참으로 어리석구나! 남은 힘으로는 산의 털끝 하나도 허물지 못할 텐데, 흙과 돌은 어찌하겠는가?”"
  ],
  "egg.yugong.laughShort": ["The Wise Old Man of the River Bend laughs.", "河曲智叟笑之。", "하곡의 지수가 웃는다."],
  // Yugong's answer, at each handover
  "egg.yugong.answer": [
    "“When I die my son goes on, and his son, and his sons’ sons, without end; and the mountain grows no higher. Why should it not be levelled?”",
    "“虽我之死，有子存焉；子子孙孙无穷匮也，而山不加增，何苦而不平？”",
    "“내가 죽어도 아들이 있고, 자자손손 끝이 없으리라. 산은 더 높아지지 않으니, 어찌 평평해지지 않겠느냐?”"
  ],
  // {0} the generation that takes the house
  "egg.yugong.handover": ["{0} takes up the pole.", "{0}接过了扁担。", "{0}이(가) 멜대를 이어받는다."],
  "egg.yugong.fall": ["The house has fallen. At the turn of the season, {0} begins again.", "房屋倾塌。换季之时，{0}从头再来。", "집이 무너졌다. 계절이 바뀌면 {0}이(가) 다시 시작한다."],
  // {0} the loads gone to the Bohai this season
  "egg.yugong.bohai": ["A load goes into the tail of the Bohai ({0} this season).", "一担土石投于渤海之尾（本季第 {0} 担）。", "흙과 돌 한 짐이 발해 끝에 던져졌다 (이번 계절 {0}짐째)."],
  "egg.yugong.boy": [
    "The widow of the Jingcheng house next door had a son, just losing his milk teeth. He skipped over to help.",
    "邻人京城氏之孀妻有遗男，始龀，跳往助之。",
    "이웃 경성씨 과부에게 막 젖니를 갈기 시작한 아들이 있었다. 아이는 뛰어와 거들었다."
  ],
  "egg.yugong.boyName": ["The Widow’s Boy", "京城氏之子", "경성씨의 아이"],
  "egg.yugong.boyDesc": ["The Jingcheng widow’s son, and his handcart.", "京城氏孀妻的儿子，和他的小推车。", "경성씨 과부의 아들과 그의 손수레."],
  // the finale
  "egg.yugong.god": [
    "The snake-holding god of the mountain heard, feared the digging would never stop, and told Heaven.",
    "操蛇之神闻之，惧其不已也，告之于帝。",
    "뱀을 쥔 산신이 이를 듣고, 그 일이 그치지 않을까 두려워 천제에게 아뢰었다."
  ],
  "egg.yugong.silent": ["The Wise Old Man of the River Bend had no reply.", "河曲智叟亡以应。", "하곡의 지수는 대꾸할 말이 없었다."],
  "egg.yugong.heaven": [
    "Heaven, moved by his sincerity, sent the two sons of Kua’e to carry the mountains away, one to the east of Shuo, one to the south of Yong.",
    "帝感其诚，命夸娥氏二子负二山，一厝朔东，一厝雍南。",
    "천제는 그 정성에 감동하여 과아씨의 두 아들에게 두 산을 지게 해, 하나는 삭동에, 하나는 옹남에 옮겨 놓게 했다."
  ],
  "egg.yugong.last": ["From then on, nothing stood between the south of Ji and the Han.", "自此，冀之南，汉之阴，无陇断焉。", "이로부터 기주의 남쪽과 한수의 북쪽 사이를 가로막는 언덕이 없어졌다."],
  // the turn of the season; {0} the year
  "egg.yugong.season.0": ["Spring, year {0}.", "第 {0} 年，春。", "{0}년째 봄."],
  "egg.yugong.season.1": ["Summer, year {0}.", "第 {0} 年，夏。", "{0}년째 여름."],
  "egg.yugong.season.2": ["Autumn, year {0}.", "第 {0} 年，秋。", "{0}년째 가을."],
  "egg.yugong.season.3": ["Winter, year {0}.", "第 {0} 年，冬。", "{0}년째 겨울."],
  // the generations on the headquarters' plate: Yugong, and the nine names of the line after him
  "egg.yugong.gen.0": ["Yugong", "愚公", "우공"],
  "egg.yugong.gen.1": ["His Son", "其子", "그 아들"],
  "egg.yugong.gen.2": ["His Grandson", "其孙", "그 손자"],
  "egg.yugong.gen.3": ["His Great-Grandson", "曾孙", "증손"],
  "egg.yugong.gen.4": ["His Great-Great-Grandson", "玄孙", "현손"],
  "egg.yugong.gen.5": ["The Sixth Generation", "来孙", "내손"],
  "egg.yugong.gen.6": ["The Seventh Generation", "晜孙", "곤손"],
  "egg.yugong.gen.7": ["The Eighth Generation", "仍孙", "잉손"],
  "egg.yugong.gen.8": ["The Ninth Generation", "云孙", "운손"],
  "egg.yugong.gen.9": ["The Tenth Generation", "耳孙", "이손"],
  "egg.yugong.gen.more": ["Sons and Grandsons", "子子孙孙", "자자손손"],
  // the skin a medal unlocks (`game/skins.ts`): {0} the skin, {1} the building it dresses
  "ach.unlocksSkin": ["Unlocks a skin: {0} ({1})", "解锁外观：{0}（{1}）", "외형 해금: {0} ({1})"],
  // a medal earned in play hands over its skin, equipped from the next match (`wearHandedOver`): {0} the skin
  "ach.skinWorn": ["Skin unlocked, equipped from your next match: {0}", "外观已解锁，下一场对局起装备：{0}", "외형 해금, 다음 대전부터 장착: {0}"],
  "ach.reset": ["Reset achievements", "重置成就", "업적 초기화"],
  "ach.resetConfirm": [
    "Reset every achievement? The service record goes with them: they are one record, and the medals are earned off its numbers.",
    "确定重置全部成就？服役记录也会一并清空：两者是同一份记录，勋章正是根据其中的数字发出的。",
    "업적을 모두 초기화할까요? 복무 기록도 함께 사라집니다. 둘은 하나의 기록이고, 훈장은 그 숫자로 받은 것입니다."
  ],
  // ------------------------------------------------------------- profile
  // the Profile screen (`ui/profile.ts`): the career (medals and the record),
  // the skins, and the field manual of every unit and building
  "menu.profile": ["Profile", "个人档案", "프로필"],
  "menu.home": ["Home", "主页", "홈"],
  // the global navigation's tabs (`ui/hub.ts`): the home menu's stack, the Arsenal, the Store
  "menu.play": ["Play", "游玩", "플레이"],
  "menu.onlinePlayers": ["{0} players online", "{0} 名玩家在线", "플레이어 {0}명 접속 중"],
  "menu.onlinePlayersTip": ["Active players in the past 15 minutes", "过去 15 分钟内活跃的玩家", "지난 15분 동안 활동한 플레이어"],
  "menu.store": ["Store", "商店", "상점"],
  // the wardrobe on a screen of its own (`ui/arsenal.ts`): each line's look and decals
  "menu.arsenal": ["Arsenal", "军械库", "무기고"],
  // the small screen's side menu, what the title strip and the stack have no room for
  "menu.more": ["Menu", "菜单", "메뉴"],
  "profile.title": ["Profile", "个人档案", "프로필"],
  "profile.share": ["Share", "分享", "공유"],
  "profile.poster.title": ["Share your service record", "分享你的战绩", "복무 기록 공유"],
  "profile.poster.summary": ["{0} matches · {1} awards", "{0} 场对局 · {1} 枚勋章", "{0}회 대전 · 훈장 {1}개"],
  "profile.poster.save": ["Save PNG", "保存 PNG", "PNG 저장"],
  "profile.poster.saved": ["Poster saved", "海报已保存", "포스터 저장됨"],
  "profile.poster.failed": ["The poster could not be created or saved", "无法生成或保存海报", "포스터를 만들거나 저장하지 못했습니다"],
  "profile.poster.shareFailed": ["The poster could not be shared. Try saving the PNG.", "分享失败，请尝试保存 PNG。", "포스터를 공유하지 못했습니다. PNG로 저장해 보세요."],
  "profile.poster.unavailable": ["Sharing and saving images are unavailable in this app.", "此应用暂不支持分享或保存图片。", "이 앱에서는 이미지 공유와 저장을 사용할 수 없습니다."],
  // the commander's name in the title strip; a press changes it
  // the roster both pages pick from, by the wiki's categories (`game/roster.ts`)
  "profile.cat.land": ["Land", "陆军", "지상"],
  "profile.cat.sea": ["Naval", "海军", "해상"],
  "profile.cat.air": ["Air", "空军", "항공"],
  "profile.cat.economy": ["Economy", "经济建筑", "경제 건물"],
  "profile.cat.production": ["Production", "生产建筑", "생산 건물"],
  "profile.cat.defense": ["Defence", "防御建筑", "방어 건물"],
  "profile.cat.support": ["Support", "支援建筑", "지원 건물"],
  "profile.cat.ordnance": ["Warheads", "弹头", "탄두"],
  // the Arsenal's wardrobe (`ui/wardrobe.ts`): every line's looks, the standard one always among them
  "profile.skins.looks": ["Looks", "外观", "외형 목록"],
  // the decals a line may carry, under its looks
  "profile.decals": ["Decals", "贴花", "데칼"],
  // the Store (`ui/store.ts`): its three pages, the bundles and the two shelves of single things (`ui/storeItems.ts`)
  "store.title": ["Store", "商店", "상점"],
  "store.tab.bundles": ["Bundles", "套装", "번들"],
  "store.tab.skins": ["Skins", "皮肤", "스킨"],
  "store.tab.supply": ["Supply", "补给", "보급"],
  // the Items page's groups
  "store.group.camos": ["Camos", "迷彩", "위장"],
  "store.group.skins": ["Skins", "皮肤", "스킨"],
  "store.group.decals": ["Decals", "贴花", "데칼"],
  // an item held: the way to equip it
  "store.toArsenal": ["Equip in the Arsenal", "在军械库中装备", "무기고에서 장착"],
  // the Arsenal (`ui/arsenal.ts`): where what is held is equipped
  "arsenal.title": ["Arsenal", "军械库", "무기고"],
  "arsenal.toStore": ["Go to Store", "前往商店", "상점으로"],
  // the faction colour the Arsenal's picture shows a line in
  "arsenal.colour": ["Faction colour", "阵营颜色", "진영 색상"],
  "arsenal.colourPrev": ["Previous colour", "上一个颜色", "이전 색상"],
  "arsenal.colourNext": ["Next colour", "下一个颜色", "다음 색상"],
  // the Arsenal's right panel, two views under a toggle: the looks the line may wear, and its Field manual sheet
  "arsenal.view.looks": ["Looks", "外观", "외형"],
  "arsenal.view.manual": ["Field manual", "兵器图鉴", "병기 도감"],
  // a line with nothing held for it but the standard look
  "arsenal.none": [
    "Camos, skins and decals bought in the Store are equipped here.",
    "在商店购买的迷彩、皮肤和贴花在这里装备。",
    "상점에서 구매한 위장, 스킨, 데칼은 여기서 장착합니다."
  ],
  "store.bundles": ["Bundles", "套装", "번들"],
  // the kinds of thing the Store sells, and how many of each a bundle holds: {0} a count
  "store.kind.camo": ["Camo", "迷彩", "위장"],
  "store.kind.decal": ["Decal", "贴花", "데칼"],
  "store.kind.skin": ["Skin", "皮肤", "스킨"],
  "store.camo": ["{0} camo", "{0} 款迷彩", "위장 {0}종"],
  "store.camos": ["{0} camos", "{0} 款迷彩", "위장 {0}종"],
  "store.skin": ["{0} skin", "{0} 款皮肤", "스킨 {0}종"],
  "store.skinsN": ["{0} skins", "{0} 款皮肤", "스킨 {0}종"],
  "store.decal": ["{0} decal", "{0} 款贴花", "데칼 {0}종"],
  "store.decalsN": ["{0} decals", "{0} 款贴花", "데칼 {0}종"],
  // a bundle some of whose items the player holds already
  "store.heldSome": ["Some of it is yours already, and taken off the price.", "其中部分已拥有，已从价格中扣除。", "이미 가진 것은 가격에서 뺐습니다."],
  // a thing a bundle holds that the player bought on its own already (`ui/store.ts`)
  "store.yours": ["Yours", "已拥有", "보유 중"],
  // the buying plate's last tile, for a set of more lines than it pictures: {0} how many more
  "store.more": ["+{0} more", "另外 {0} 种", "외 {0}종"],
  "store.wearAll": ["Equip on all", "全部装备", "모두 장착"],
  "store.takeOff": ["Unequip all", "全部卸下", "모두 해제"],
  // a look or a decal held, pressed in the Arsenal: {0} the line's name
  "store.wearTip": ["Equip it on the {0}", "装备到{0}", "{0}에 장착"],
  "store.unmountTip": ["Unequip it from the {0}", "从{0}上卸下", "{0}에서 해제"],
  // a skin a medal also hands over: {0} the medal
  "store.orEarn": ["Or earn {0}", "或获得“{0}”", "또는 {0} 획득"],
  // an item sold nowhere else (`ui/storeItems.ts`): {0} the bundle that sells it
  "store.onlyIn": ["Only in the {0} bundle.", "仅在“{0}”套装中提供。", "{0} 번들에서만 구할 수 있습니다."],
  "store.viewBundle": ["View bundle", "查看套装", "번들 보기"],
  "store.price": ["Price", "价格", "가격"],
  "store.short": ["Still needed", "还差", "부족분"],
  "store.after": ["Left after", "购买后剩余", "구매 후 잔액"],
  "store.buy.title": ["Buy {0}", "购买“{0}”", "{0} 구매"],
  // the wardrobe's plate for several things tried on at once: {0} how many
  "store.buy.items": ["Buy {0} items", "购买 {0} 件物品", "{0}개 항목 구매"],
  // a Buy, the price beside it (`buyButton`, the buying plate's answer)
  "store.buy": ["Buy", "购买", "구매"],
  // beside a bundle's Buy (`ui/store.ts`): what it saves on its items bought one by one, {0} in whole percent; its tip {0} what they would cost
  "store.save": ["Save {0}%", "省 {0}%", "{0}% 절약"],
  "store.wasTip": ["{0} bought one by one", "单独购买共需 {0}", "하나씩 사면 {0}"],
  "store.buy.short": [
    "Not enough merit yet. Every finished match pays some.",
    "军功还不够。每完成一场对局都会获得军功。",
    "공훈이 아직 부족합니다. 대전을 마칠 때마다 공훈을 받습니다."
  ],
  // bought and put on (a bundle, a skin on its own line): {0} its name
  "store.bought": ["{0} is yours, and equipped.", "已获得“{0}”，并已装备。", "{0} 구매 완료. 바로 장착했습니다."],
  // bought and waiting in the Arsenal (a camo, a decal): {0} its name, or how many
  "store.boughtHeld": ["{0} is yours. Equip it in the Arsenal.", "已获得“{0}”，可在军械库中装备。", "{0} 구매 완료. 무기고에서 장착하세요."],
  "store.boughtSome": ["{0} items are yours. Equip them in the Arsenal.", "已获得 {0} 件物品，可在军械库中装备。", "{0}개 항목 구매 완료. 무기고에서 장착하세요."],
  // merit (`core/merit.ts`): what a finished match pays, and the Store spends
  "merit.title": ["Merit", "军功", "공훈"],
  "merit.tip": ["Merit: {0}. What matches pay, and the Store spends.", "军功：{0}。对局获得，商店消费。", "공훈: {0}. 대전에서 받고 상점에서 씁니다."],
  "merit.intro": [
    "Finished matches are scored. Eligible matches pay merit for combat and the economy and victory it supports, which the Store takes for skins.",
    "打完的对局都会计分。符合条件的对局根据战斗贡献及其支持的经济和胜利奖励发放军功，可在商店购买外观。",
    "끝난 대전은 점수가 매겨집니다. 지급 대상 대전에서는 전투와 그 기여에 따른 경제·승리 보상을 공훈으로 받아 상점에서 외형을 살 수 있습니다."
  ],
  "merit.how.combat": [
    "{0} points for every enemy unit destroyed, {1} for every enemy building.",
    "每摧毁一个敌方单位得 {0} 分，每摧毁一座敌方建筑得 {1} 分。",
    "적 유닛을 파괴할 때마다 {0}점, 적 건물마다 {1}점."
  ],
  "merit.how.economy": ["A point for every {0} metal mined.", "每开采 {0} 金属得 1 分。", "금속 {0}을 채굴할 때마다 1점."],
  "merit.how.victory": [
    "A win adds {0} points for each enemy AI on Standard, half for one on Relaxed and up to double for a Veteran or a person; in full once the match has run {1} minutes.",
    "获胜时，每个“标准”难度的敌方 AI 加 {0} 分，“轻松”减半，“老兵”或真人玩家最多翻倍；对局满 {1} 分钟才能拿到全额。",
    "승리하면 표준 난이도 적 AI마다 {0}점, 여유는 절반, 베테랑이나 사람 상대는 최대 두 배를 더합니다. 대전이 {1}분을 넘겨야 전액을 받습니다."
  ],
  "merit.how.pay": [
    "Every {0} reward points pay 1 merit. Economy rewards cannot exceed combat rewards; victory rewards cannot exceed twice the combat rewards. A match changed from the console pays nothing.",
    "每 {0} 奖励分换 1 军功。经济奖励不超过战斗奖励，胜利奖励不超过战斗奖励的两倍。用控制台改动过的对局不计军功。",
    "보상 점수 {0}점마다 공훈 1. 경제 보상은 전투 보상 이하, 승리 보상은 전투 보상의 두 배 이하입니다. 콘솔로 바꾼 대전은 지급되지 않습니다."
  ],
  "merit.how.limits": [
    "Per match, reward points are limited to {0} combat, {1} economy and {2} victory. Merit is also limited to 1 per {3} seconds on the match clock. The score itself is shown in full.",
    "每局奖励分上限：战斗 {0}，经济 {1}，胜利 {2}。军功同时受对局时间限制，每 {3} 秒最多 1 点。得分仍完整显示。",
    "대전당 보상 점수 상한은 전투 {0}, 경제 {1}, 승리 {2}입니다. 공훈은 대전 시간 {3}초당 최대 1로도 제한됩니다. 점수 자체는 전부 표시됩니다."
  ],
  "merit.how.eligible": [
    "Merit is earned on built-in maps except Open Range, without mods, once per match. Loading a save or reconnecting does not pay the same match again.",
    "在除靶场外的内置地图且未启用模组的对局中获得军功，每局只结算一次。读取存档或重新连接不会重复结算。",
    "사격장을 제외한 기본 지도에서 모드 없이 공훈을 얻으며, 대전당 한 번 지급됩니다. 저장 불러오기나 재접속으로 같은 대전의 보상을 다시 받을 수 없습니다."
  ],
  "merit.howLink": ["How merit is earned", "如何获得军功", "공훈 얻는 법"],
  // redemption codes (`ui/redeem.ts`): the merit plate's leading button, and the plate it opens
  "redeem.entry": ["Redeem code", "兑换码", "코드 입력"],
  "redeem.title": ["Redeem a code", "兑换码", "코드 입력"],
  "redeem.intro": ["Enter a code to receive what it gives. It is checked online.", "输入兑换码领取对应物品。兑换码需联网验证。", "코드를 입력하면 그 보상을 받습니다. 코드는 온라인에서 확인합니다."],
  "redeem.label": ["Code", "兑换码", "코드"],
  "redeem.confirm": ["Redeem", "兑换", "받기"],
  "redeem.checking": ["Checking…", "正在验证…", "확인 중…"],
  "redeem.wrong": ["That code is not valid.", "兑换码无效。", "유효하지 않은 코드입니다."],
  "redeem.offline": ["Could not reach the server. Redeeming needs an internet connection.", "无法连接服务器。兑换需要联网。", "서버에 연결할 수 없습니다. 코드를 사용하려면 인터넷 연결이 필요합니다."],
  "redeem.held": ["You already have everything this code gives.", "此兑换码的物品你已全部拥有。", "이 코드의 보상을 이미 모두 가지고 있습니다."],
  "redeem.newer": ["This code is for a newer version of the game. Update it, then try again.", "此兑换码需要更新版本的游戏，请更新后再试。", "이 코드는 새 버전의 게임용입니다. 업데이트한 뒤 다시 시도하세요."],
  "redeem.done": ["{0} is yours, and equipped.", "已获得“{0}”，并已装备。", "{0} 획득. 바로 장착했습니다."],
  "redeem.doneHeld": ["{0} is yours. Equip it in the Arsenal.", "已获得“{0}”，可在军械库中装备。", "{0} 획득. 무기고에서 장착하세요."],
  "redeem.doneSome": ["{0} things are yours. Find them in the Arsenal.", "已获得 {0} 件物品，可在军械库中查看。", "{0}개 항목 획득. 무기고에서 확인하세요."],
  "merit.balance": ["Balance", "余额", "보유"],
  "merit.earned": ["Merit earned", "累计获得军功", "누적 획득 공훈"],
  "merit.spent": ["Merit spent", "已花费军功", "사용한 공훈"],
  "merit.best": ["Best score", "最高得分", "최고 점수"],
  // the result plate's strip: the score, its parts, and what it paid
  "merit.score": ["Score", "得分", "점수"],
  "merit.combat": ["Combat", "战斗", "전투"],
  "merit.economy": ["Economy", "经济", "경제"],
  "merit.victory": ["Victory", "胜利", "승리"],
  "merit.paid": ["+{0} merit", "+{0} 军功", "공훈 +{0}"],
  "merit.unpaid": ["No merit: the console changed this match", "不计军功：本局经控制台改动", "공훈 없음: 콘솔로 바뀐 대전"],
  "merit.duplicate": ["No merit: this match was already recorded", "不计军功：本局已结算", "공훈 없음: 이미 기록된 대전"],
  "merit.ineligible": ["No merit: Open Range, custom map or mods", "不计军功：靶场、自定义地图或模组", "공훈 없음: 사격장, 사용자 지도 또는 모드"],
  "merit.customGame": ["No merit: custom game", "不计军功：自定义游戏", "공훈 없음: 사용자 게임"],
  // the Field manual: one sheet a def, the wiki's figures in the wiki's words
  "profile.manual.weapons": ["Weapons", "武器", "무기"],
  // a line's levels over its sheet, by number (the level's own name in the tip)
  "profile.manual.level": ["Level {0}", "{0}级", "{0}단계"],
  "profile.manual.levels": ["Levels", "等级", "단계"],
  "profile.manual.fromMod": ["From a mod: {0}", "来自模组：{0}", "모드: {0}"],
  "profile.manual.armour": ["Armour", "装甲", "장갑"],
  "profile.manual.vision": ["Vision", "视野", "시야"],
  "profile.manual.sonar": ["Sonar", "声呐", "소나"],
  "profile.manual.tiles": ["{0} tiles", "{0} 格", "{0}칸"],
  "profile.manual.tilesPerSec": ["{0} tiles/s", "{0} 格/秒", "{0}칸/초"],
  "profile.manual.seconds": ["{0} s", "{0} 秒", "{0}초"],
  "profile.manual.metal": ["{0} metal", "{0} 金属", "금속 {0}"],
  "profile.manual.footprint": ["Footprint", "占地", "크기"],
  "profile.manual.footprintValue": ["{0} × {1} tiles", "{0} × {1} 格", "{0} × {1}칸"],
  "profile.manual.mining": ["Mining", "采矿", "채굴"],
  "profile.manual.repair": ["Repair aura", "维修光环", "수리 오라"],
  "profile.manual.repairValue": ["{0} HP/s to up to {2} within {1} tiles", "{1} 格内最多 {2} 个目标，每个每秒 {0} 耐久", "{1}칸 안의 대상 최대 {2}개에 초당 체력 {0}"],
  "profile.manual.intercept": ["Point defence", "点防御", "점방어"],
  "profile.manual.interceptValue": ["Rockets within {0} tiles", "拦截 {0} 格内的火箭弹", "{0}칸 안의 로켓 요격"],
  "profile.manual.magazine": ["Magazine", "弹仓", "탄창"],
  "profile.manual.magazineValue": ["{0} rounds, one back every {1} s", "{0} 发，每 {1} 秒补充 1 发", "{0}발, {1}초마다 1발 보충"],
  "profile.manual.warheadSlots": ["Warhead slots", "核弹槽位", "탄두 슬롯"],
  "profile.manual.cargo": ["Hold", "运载量", "적재량"],
  "profile.manual.cargoValue": ["{0} cargo weight", "{0} 点载重", "적재 중량 {0}"],
  "profile.manual.buildRate": ["Build rate", "建造速率", "건설 속도"],
  "profile.manual.buildRateValue": ["{0} HP/s", "{0} 耐久/秒", "초당 체력 {0}"],
  "profile.manual.upgrade": ["Upgrade", "升级", "업그레이드"],
  "profile.manual.limit": ["Limit", "上限", "제한"],
  "profile.manual.limitValue": ["{0} at a time", "同时最多 {0} 个", "동시에 {0}대"],
  "profile.manual.producedAt": ["Built at", "生产于", "생산처"],
  "profile.manual.builtBy": ["Built by", "建造者", "건설 유닛"],
  "profile.manual.requires": ["Requires", "前置条件", "요구 조건"],
  "profile.manual.research": ["Research", "研究", "연구"],
  "profile.manual.upgradeOf": ["Upgrade of", "升级自", "이전 단계"],
  "profile.manual.upgradesTo": ["Upgrades to", "可升级为", "다음 단계"],
  "profile.manual.produces": ["Produces", "可生产", "생산"],
  "profile.manual.builds": ["Can build", "可建造", "건설 가능"],
  "profile.manual.carriedBy": ["Carried by", "搭载于", "탑재 유닛"],
  "profile.manual.carries": ["Carries", "可搭载", "탑재 가능"],
  "profile.manual.damage": ["Damage", "伤害", "피해"],
  "profile.manual.reload": ["Reload", "装填", "재장전"],
  "profile.manual.ammo": ["Rounds carried", "载弹量", "탑재 탄약"],
  "profile.manual.minRange": ["Min range", "最小射程", "최소 사거리"],
  "profile.manual.splash": ["Splash", "溅射", "폭발 반경"],
  "profile.manual.burn": ["Fire on the ground", "地面燃烧", "지면 화염"],
  "profile.manual.burnValue": ["{0}/s for {1} s", "每秒 {0}，持续 {1} 秒", "초당 {0}, {1}초간"],
  "profile.manual.targets": ["Fires at", "可攻击", "공격 대상"],
  "profile.manual.traits": ["Traits", "特性", "특성"],
  "profile.manual.turret": ["Turreted", "旋转炮塔", "회전 포탑"],
  "profile.manual.homing": ["Homing", "制导", "유도"],
  "profile.manual.flightRange": ["Max flight distance", "最大飞行距离", "최대 비행 거리"],
  "profile.manual.guidance": ["Guidance", "制导限制", "유도 한계"],
  "profile.manual.guidanceValue": [
    "{0}°/s turn; loses lock beyond {1}° off the nose, then flies straight.",
    "每秒最多转向 {0}°；目标偏离弹头方向超过 {1}° 时失锁，随后直飞。",
    "초당 최대 {0}° 선회. 기수에서 {1}°를 벗어나면 추적을 잃고 직진합니다."
  ],
  "profile.manual.arc": ["Indirect fire", "曲射", "곡사"],
  "profile.manual.vs": ["vs {0}", "对{0}", "{0} 상대"],
  "profile.manual.unarmed": ["Unarmed", "无武装", "비무장"],
  "profile.manual.target.ground": ["Ground", "地面", "지상"],
  "profile.manual.target.ship": ["Ships", "舰船", "함선"],
  "profile.manual.target.sub": ["Submarines", "潜艇", "잠수함"],
  "profile.manual.target.air": ["Aircraft", "飞行器", "항공기"],
  "profile.manual.deposit": ["Stands on a metal deposit", "必须建在金属矿脉上", "금속 광맥 위에 세웁니다"],
  "profile.manual.seaDeposit": ["Stands on a metal field at sea", "必须建在海上的金属矿田上", "바다의 금속 광맥 위에 세웁니다"],
  "profile.manual.shore": ["Stands on the shoreline", "必须沿海岸线放置", "해안선에 세웁니다"],
  "profile.manual.upgradeOnly": ["Only reached by upgrading", "仅能通过升级获得", "업그레이드로만 얻습니다"],
  // a warhead's own figures: the blast, its outer ring, the pulse, the fuse
  "profile.manual.blast": ["Blast radius", "爆炸半径", "폭발 반경"],
  "profile.manual.outerRing": ["Outer ring", "外圈", "외곽 반경"],
  "profile.manual.outerRingValue": ["{0} tiles at {1}% of the blast", "{0} 格，爆炸伤害的 {1}%", "{0}칸, 폭발 피해의 {1}%"],
  "profile.manual.pulse": ["Pulse", "脉冲", "펄스"],
  "profile.manual.pulseValue": ["Circuits within {0} tiles out for {1} s", "{0} 格内的电路瘫痪 {1} 秒", "{0}칸 안의 회로가 {1}초간 마비"],
  "profile.manual.fuse": ["Fuse", "引信", "신관"],
  // the player's own record of a unit (`UnitRecord` in core/achievements.ts), on its sheet
  "profile.record.title": ["Your record", "你的战绩", "나의 전적"],
  "profile.record.matches": ["Matches: {0}", "出场：{0}", "출전: {0}"],
  "profile.record.built": ["Built", "生产", "생산"],
  "profile.record.raised": ["Raised", "建造", "건설"],
  "profile.record.made": ["Fabricated", "制造", "제조"],
  "profile.record.lost": ["Lost", "损失", "손실"],
  "profile.record.kills": ["Units destroyed", "击毁单位", "파괴한 유닛"],
  "profile.record.razed": ["Buildings destroyed", "摧毁建筑", "파괴한 건물"],
  "profile.record.dmg": ["Damage dealt", "造成伤害", "가한 피해"],
  // the Career page's pane of the units with the best records
  "profile.top.title": ["Top units", "王牌单位", "에이스 유닛"],
  "profile.top.kills": ["Kills", "击毁", "격파"],
  "profile.top.dmg": ["Damage", "伤害", "피해"],
  "profile.top.none": ["No unit has a record yet. Play a match.", "还没有单位留下战绩。先打一局吧。", "아직 전적이 있는 유닛이 없습니다. 대전을 한 판 하세요."],
  "profile.top.open": ["{0}: open in the Field manual", "{0}：在兵器图鉴中查看", "{0}: 병기 도감에서 보기"],
  // a weapon's name, by its id; a mod's weapon the table has no name for goes by its class
  "weapon.mg.name": ["Machine gun", "机枪", "기관총"],
  "weapon.roofmg.name": ["Roof machine gun", "车顶机枪", "포탑 상부 기관총"],
  "weapon.autocannon.name": ["Autocannon", "机炮", "기관포"],
  "weapon.cannon.name": ["Cannon", "加农炮", "주포"],
  "weapon.twincannon.name": ["Twin cannon", "双联加农炮", "연장 주포"],
  "weapon.atgm.name": ["Anti-tank missiles", "反坦克导弹", "대전차 미사일"],
  "weapon.flakgun.name": ["Flak gun", "高射炮", "대공포"],
  "weapon.sam.name": ["Surface-to-air missiles", "地对空导弹", "지대공 미사일"],
  "weapon.howitzer.name": ["Howitzer", "榴弹炮", "곡사포"],
  "weapon.rockets.name": ["Rocket pods", "火箭巢", "로켓 포드"],
  "weapon.thermobaric.name": ["Thermobaric mortar", "温压迫击炮", "열압력 박격포"],
  "weapon.flamejet.name": ["Flamethrower", "火焰喷射器", "화염방사기"],
  "weapon.charge.name": ["Shaped charge", "聚能战斗部", "성형작약"],
  "weapon.mineblast.name": ["Fragmentation charge", "破片装药", "파편 폭약"],
  "weapon.navalmineblast.name": ["Naval blast charge", "水雷装药", "기뢰 폭약"],
  "weapon.tbm.name": ["Ballistic missiles", "弹道导弹", "탄도 미사일"],
  "weapon.ashm.name": ["Anti-ship missiles", "反舰导弹", "대함 미사일"],
  "weapon.navgun.name": ["Naval gun", "舰炮", "함포"],
  "weapon.navsam.name": ["Naval SAM", "舰载防空导弹", "함대공 미사일"],
  "weapon.torpedo.name": ["Torpedoes", "鱼雷", "어뢰"],
  "weapon.bigguns.name": ["Main battery", "主炮群", "주포대"],
  "weapon.secondaries.name": ["Secondary battery", "防空副炮", "부포대"],
  "weapon.cruise.name": ["Cruise missiles", "巡航导弹", "순항 미사일"],
  "weapon.aam.name": ["Air-to-air missiles", "空对空导弹", "공대공 미사일"],
  "weapon.bombs.name": ["Bomb bay", "炸弹舱", "폭탄창"],
  "weapon.gatcannon.name": ["Gatling cannon", "加特林机炮", "개틀링 기관포"],
  "weapon.heavybombs.name": ["Heavy bombs", "重型炸弹", "대형 폭탄"],
  "weapon.airtorpedo.name": ["Homing torpedoes", "自导鱼雷", "유도 어뢰"],
  "weapon.hqgun.name": ["Roof machine gun", "屋顶机枪", "옥상 기관총"],
  "weapon.turretmg.name": ["Machine gun", "机枪", "기관총"],
  "weapon.gatling.name": ["Gatling gun", "加特林机枪", "개틀링 기관총"],
  "weapon.aaflak.name": ["Flak battery", "高射炮组", "대공포대"],
  "weapon.samsite.name": ["Long-range SAM", "远程防空导弹", "장거리 지대공 미사일"],
  "weapon.cls.mg": ["Machine guns", "机枪", "기관총"],
  "weapon.cls.autocannon": ["Autocannons", "机炮", "기관포"],
  "weapon.cls.cannon": ["Tank guns", "坦克炮", "전차포"],
  "weapon.cls.at": ["Anti-tank missiles", "反坦克导弹", "대전차 미사일"],
  "weapon.cls.he": ["High explosive", "高爆弹", "고폭탄"],
  "weapon.cls.rocket": ["Rocket pods", "火箭巢", "로켓 포드"],
  "weapon.cls.navgun": ["Naval guns", "舰炮", "함포"],
  "weapon.cls.ashm": ["Anti-ship missiles", "反舰导弹", "대함 미사일"],
  "weapon.cls.torpedo": ["Torpedoes", "鱼雷", "어뢰"],
  "weapon.cls.aa": ["Anti-air", "防空武器", "대공 무기"],
  // the record's four panes
  "stat.career": ["Service record", "服役记录", "복무 기록"],
  "stat.battle": ["Battle", "战斗", "전투"],
  "stat.economy": ["Economy", "经济", "경제"],
  "stat.victories": ["Victories", "胜场分布", "승리 내역"],
  "stat.matches": ["Matches played", "对局总数", "치른 대전"],
  "stat.wins": ["Victories", "胜利", "승리"],
  "stat.losses": ["Defeats", "失败", "패배"],
  "stat.winRate": ["Win rate", "胜率", "승률"],
  "stat.timePlayed": ["Time in command", "指挥时长", "지휘 시간"],
  "stat.longest": ["Longest match", "最长对局", "가장 긴 대전"],
  "stat.fastestWin": ["Fastest victory", "最快取胜", "가장 빠른 승리"],
  "stat.campaign": ["Campaign", "战役进度", "캠페인"],
  "stat.builtUnits": ["Units built", "生产单位", "생산한 유닛"],
  "stat.killedUnits": ["Units destroyed", "击毁单位", "파괴한 유닛"],
  "stat.lostUnits": ["Units lost", "损失单位", "잃은 유닛"],
  "stat.builtBuildings": ["Buildings raised", "建造建筑", "세운 건물"],
  "stat.killedBuildings": ["Buildings destroyed", "摧毁建筑", "파괴한 건물"],
  "stat.lostBuildings": ["Buildings lost", "损失建筑", "잃은 건물"],
  "stat.kd": ["Kill/loss ratio", "战损比", "격파/손실 비율"],
  "stat.bestKills": ["Best match (kills)", "单场最多击毁", "최고 기록(격파)"],
  "stat.metalMined": ["Metal mined", "开采金属", "채굴한 금속"],
  "stat.metalSpent": ["Metal spent", "消耗金属", "쓴 금속"],
  "stat.bestMined": ["Best match (mined)", "单场最多开采", "최고 기록(채굴)"],
  "stat.nukes": ["Warheads launched", "发射核弹头", "발사한 핵탄두"],
  "stat.elites": ["Units promoted to Elite", "晋升精英单位", "정예로 진급한 유닛"],
  "stat.sandbox": ["Conquest", "征服", "정복"],
  "stat.breakthrough": ["Breakthrough", "突破", "돌파"],
  "stat.multiplayer": ["Multiplayer", "多人对战", "멀티플레이어"],
  "stat.never": ["—", "—", "—"],
  // bronze
  "ach.first-blood.name": ["First Blood", "首杀", "첫 피"],
  "ach.first-blood.desc": ["Destroy an enemy unit.", "摧毁一个敌方单位。", "적 유닛을 파괴하세요."],
  "ach.first-command.name": ["First Command", "首战告捷", "첫 지휘"],
  "ach.first-command.desc": ["Win a match.", "赢下一场对局。", "대전에서 승리하세요."],
  "ach.prospector.name": ["Prospector", "探矿者", "탐광자"],
  "ach.prospector.desc": ["Mine 10,000 metal.", "累计开采 10,000 金属。", "금속 10,000을 채굴하세요."],
  "ach.assembly-line.name": ["Assembly Line", "流水线", "조립 라인"],
  "ach.assembly-line.desc": ["Build 50 units.", "累计生产 50 个单位。", "유닛 50개를 생산하세요."],
  "ach.demolition.name": ["Demolition", "拆迁", "철거"],
  "ach.demolition.desc": ["Destroy 10 buildings.", "累计摧毁 10 座建筑。", "건물 10개를 파괴하세요."],
  "ach.enlisted.name": ["Enlisted", "入伍", "입대"],
  "ach.enlisted.desc": ["Complete the first campaign mission.", "完成战役第一关。", "첫 캠페인 임무를 완료하세요."],
  "ach.contact.name": ["Contact", "接敌", "접촉"],
  "ach.contact.desc": ["Finish a multiplayer match.", "打完一场多人对局。", "멀티플레이어 대전을 끝까지 치르세요."],
  "ach.fallout.name": ["Fallout", "核尘", "낙진"],
  "ach.fallout.desc": ["Launch a nuclear warhead.", "发射一枚核弹头。", "핵탄두를 발사하세요."],
  // steel
  "ach.steel-rain.name": ["Steel Rain", "钢铁之雨", "강철의 비"],
  "ach.steel-rain.desc": ["Destroy 500 units.", "累计摧毁 500 个单位。", "유닛 500개를 파괴하세요."],
  "ach.wrecking-crew.name": ["Wrecking Crew", "拆除队", "철거반"],
  "ach.wrecking-crew.desc": ["Destroy 150 buildings.", "累计摧毁 150 座建筑。", "건물 150개를 파괴하세요."],
  "ach.war-machine.name": ["War Machine", "战争机器", "전쟁 기계"],
  "ach.war-machine.desc": ["Build 500 units.", "累计生产 500 个单位。", "유닛 500개를 생산하세요."],
  "ach.foundry.name": ["Foundry", "熔炉", "주조소"],
  "ach.foundry.desc": ["Mine 250,000 metal.", "累计开采 250,000 金属。", "금속 250,000을 채굴하세요."],
  "ach.field-officer.name": ["Field Officer", "校官", "야전 장교"],
  "ach.field-officer.desc": ["Win 10 matches.", "赢下 10 场对局。", "대전 10승을 거두세요."],
  "ach.long-service.name": ["Long Service", "久经沙场", "장기 복무"],
  "ach.long-service.desc": ["Spend ten hours in command.", "累计指挥十小时。", "열 시간 동안 지휘하세요."],
  "ach.hard-lessons.name": ["Hard Lessons", "血的教训", "뼈아픈 교훈"],
  "ach.hard-lessons.desc": [
    "Lose 250 units. The game teaches by taking things away.",
    "累计损失 250 个单位。这门课的学费由你的部队来付。",
    "유닛 250개를 잃으세요. 이 게임은 빼앗으면서 가르칩니다."
  ],
  "ach.cartographer.name": ["Cartographer", "制图师", "지도 제작자"],
  "ach.cartographer.desc": ["Finish a match on a map you drew yourself.", "在自己画的地图上打完一局。", "직접 그린 지도에서 대전을 끝까지 치르세요."],
  "ach.old-guard.name": ["Old Guard", "老近卫", "고참 근위대"],
  "ach.old-guard.desc": ["Promote a unit to Elite.", "让一个单位晋升到精英。", "유닛 하나를 정예로 진급시키세요."],
  // silver
  "ach.blitz.name": ["Blitz", "闪击", "전격전"],
  "ach.blitz.desc": ["Win a match in under five minutes.", "五分钟内赢下一场对局。", "5분 안에 대전에서 승리하세요."],
  "ach.flawless.name": ["Not a Scratch", "毫发无伤", "흠집 하나 없이"],
  "ach.flawless.desc": ["Win without losing a single unit.", "一个单位都没损失就取得胜利。", "유닛을 하나도 잃지 않고 승리하세요."],
  "ach.total-war.name": ["Total War", "总体战", "총력전"],
  "ach.total-war.desc": ["Destroy 200 units in a single match.", "单场摧毁 200 个单位。", "한 대전에서 유닛 200개를 파괴하세요."],
  "ach.outnumbered.name": ["Outnumbered", "寡不敌众", "중과부적"],
  "ach.outnumbered.desc": ["Win against three or more enemy factions.", "面对三个及以上敌方阵营取胜。", "적 진영 셋 이상을 상대로 승리하세요."],
  "ach.hard-won.name": ["Hard Won", "险胜", "힘겨운 승리"],
  "ach.hard-won.desc": ["Win a match with a Veteran opponent in it.", "在有老兵难度对手的对局中取胜。", "베테랑 상대가 있는 대전에서 승리하세요."],
  "ach.foul-weather.name": ["Foul Weather", "恶劣天候", "악천후"],
  "ach.foul-weather.desc": ["Win a match fought under rain or snow.", "在雨或雪的天气下赢得对局。", "비나 눈 아래에서 치른 대전에서 승리하세요."],
  "ach.admiral.name": ["Admiral", "海军上将", "제독"],
  "ach.admiral.desc": ["Win on the Santa Barbara Channel.", "在圣巴巴拉海峡取胜。", "샌타바버라 해협에서 승리하세요."],
  "ach.second-strike.name": ["Second Strike", "二次打击", "2차 타격"],
  "ach.second-strike.desc": ["Launch ten nuclear warheads.", "累计发射十枚核弹头。", "핵탄두 열 발을 발사하세요."],
  "ach.interception.name": ["Interception", "拦截", "요격"],
  "ach.interception.desc": ["Shoot a nuclear warhead out of the sky.", "在核弹头落地前将它击落。", "핵탄두를 하늘에서 떨어뜨리세요."],
  // gold
  "ach.iron-tide.name": ["Iron Tide", "钢铁浪潮", "강철의 파도"],
  "ach.iron-tide.desc": ["Destroy 2,500 units.", "累计摧毁 2,500 个单位。", "유닛 2,500개를 파괴하세요."],
  "ach.marshal.name": ["Marshal", "元帅", "원수"],
  "ach.marshal.desc": ["Win 50 matches.", "赢下 50 场对局。", "대전 50승을 거두세요."],
  "ach.war-economy.name": ["War Economy", "战时经济", "전시 경제"],
  "ach.war-economy.desc": ["Mine 1,000,000 metal.", "累计开采 1,000,000 金属。", "금속 1,000,000을 채굴하세요."],
  "ach.decorated.name": ["Decorated", "授勋", "서훈"],
  "ach.decorated.desc": ["Complete the campaign.", "通关全部战役。", "캠페인을 완료하세요."],
  // blackened \u2014 the two nobody arrives at by accident
  "ach.concrete-doctrine.name": ["Concrete Doctrine", "混凝土教条", "콘크리트 교리"],
  "ach.concrete-doctrine.desc": [
    "Win a Conquest match without producing a single unit.",
    "在征服对局中一个单位都不生产，并且取得胜利。",
    "유닛을 하나도 생산하지 않고 정복 대전에서 승리하세요."
  ],
  "ach.danger-close.name": ["Danger Close", "危险距离", "근접 위험"],
  "ach.danger-close.desc": ["Destroy one of your own buildings with your own nuclear warhead.", "用自己的核弹头摧毁自己的建筑。", "자신의 핵탄두로 자신의 건물을 파괴하세요."],
  "ach.no-reply.name": ["The Mountain Grows No Higher", "亡以应", "우공이산"],
  "ach.no-reply.desc": ["See Taihang and Wangwu carried away.", "亲见太行、王屋二山被负走。", "태항과 왕옥이 옮겨지는 것을 지켜보세요."],
  "ach.eleven-alive.name": ["Eleven Alive", "十一人生还", "열한 명 생존"],
  "ach.eleven-alive.desc": ["Answer the coastwatcher’s lamp before first light.", "在天亮之前回应海岸瞭望员的灯。", "첫 빛이 들기 전에 해안 감시원의 등불에 응답하세요."],
  // ------------------------------------------------------------- settings
  "settings.title": ["Settings", "设置", "설정"],
  // the Settings page's right column (ui/settingsPage.ts): what a section is for, and what each row does
  "settings.impact": ["Performance impact:", "性能影响：", "성능 영향:"],
  "settings.impact.high": ["High", "高", "높음"],
  "settings.impact.medium": ["Medium", "中", "보통"],
  "settings.impact.low": ["Low", "低", "낮음"],
  "settings.explain.general": ["The language, your name on a server, and how the interface behaves.", "界面语言、你在服务器上的名字，以及界面的行为。", "언어, 서버에서의 이름, 인터페이스 동작 방식입니다."],
  "settings.explain.audio": ["The volume of the music, the battle and Command, and the language Command speaks.", "音乐、战斗音效与指挥系统语音的音量，以及语音的语言。", "음악, 전투 효과음, 지휘부 음성의 음량과 지휘부가 쓰는 언어입니다."],
  "settings.explain.keys": ["The keys, the mouse and, on a touch screen, how orders are given.", "按键、鼠标，以及触屏上的下令方式。", "키, 마우스, 그리고 터치 화면에서 명령을 내리는 방식입니다."],
  "settings.explain.graphics": ["How the battlefield is drawn, and what that asks of your device.", "战场的绘制方式，以及对设备性能的要求。", "전장을 그리는 방식과 그에 드는 기기 부담입니다."],
  "settings.explain.pad": ["The controller's glyphs, stick, rumble and buttons.", "手柄的按键图标、摇杆、震动与按键分配。", "컨트롤러의 버튼 표시, 스틱, 진동, 버튼 배치입니다."],
  "settings.explain.mods": ["Mods add units and buildings to the game. Install them here and switch them on or off.", "模组为游戏添加单位与建筑。在这里安装，并启用或停用。", "모드는 게임에 유닛과 건물을 더합니다. 여기서 설치하고 켜거나 끌 수 있습니다."],
  "settings.explain.dev": ["Developer mode's tools and switches.", "开发者模式的工具与开关。", "개발자 모드의 도구와 스위치입니다."],
  "settings.explain.about": ["The game's version, what it is built with and the people who made it.", "游戏的版本、所用的技术，以及制作者。", "게임 버전, 사용한 기술, 그리고 만든 사람들입니다."],
  "settings.language.desc": ["The language of the interface. Automatic follows the device.", "界面的语言。选择自动时跟随设备设置。", "인터페이스 언어입니다. 자동은 기기 설정을 따릅니다."],
  "settings.windowMode.desc": ["Play in a window or across the whole screen.", "在窗口中游玩，或铺满整个屏幕。", "창으로 플레이하거나 화면 전체를 씁니다."],
  "settings.edgeScroll.desc": ["Move the camera by bringing the pointer to the edge of the screen.", "将指针移到屏幕边缘时移动镜头。", "포인터를 화면 가장자리로 가져가면 카메라가 움직입니다."],
  "settings.healthBars.desc": ["Show the health bar over every unit and building at all times.", "始终显示所有单位与建筑的生命条。", "모든 유닛과 건물의 체력 바를 항상 표시합니다."],
  "settings.killFeed.desc": ["List each unit and building destroyed in the feed, and what destroyed it.", "在动态栏中列出被摧毁的单位与建筑，以及摧毁它们的武器。", "파괴된 유닛과 건물, 그리고 무엇에 파괴되었는지를 피드에 표시합니다."],
  "settings.othersSkins.desc": ["Draw other players' camos, skins and decals. Off, theirs wear the standard look; yours always wear your own.", "显示其他玩家的迷彩、涂装与贴花。关闭后他们的单位和建筑以标准外观显示，你自己的不受影响。", "다른 플레이어의 위장, 스킨, 데칼을 표시합니다. 끄면 그들의 것은 기본 모습으로 보이고, 내 것은 항상 그대로입니다."],
  "settings.placeGrid.desc": ["Show the tile grid while a building is being placed.", "放置建筑时显示地块网格。", "건물을 배치하는 동안 타일 격자를 표시합니다."],
  "settings.actionHints.desc": ["A strip along the foot of the screen naming what the mouse buttons and keys do at that moment.", "屏幕底部的提示条，说明此刻鼠标按键与按键的作用。", "화면 아래에 지금 마우스 버튼과 키가 하는 일을 알려 주는 줄을 표시합니다."],
  "settings.shareUsage.desc": ["The game sends anonymous counts of what is played, such as a match started or won, so we can see what to improve. On, a random ID kept on this device lets us see whether players come back. Off, the ID is deleted and each launch counts as a stranger. No names, no chat, nothing you type, either way.", "游戏会发送匿名的游玩统计，例如开始或赢下一局，帮助我们改进游戏。开启时，本设备上保存的随机 ID 让我们知道玩家是否会回来。关闭后该 ID 会被删除，每次启动都算作一位新访客。无论开关与否，都不含名字、聊天或任何你输入的内容。", "게임은 대전 시작이나 승리처럼 어떤 플레이를 하는지 익명 통계를 보내 게임 개선에 씁니다. 켜면 이 기기에 저장된 무작위 ID로 플레이어가 다시 돌아오는지 알 수 있습니다. 끄면 ID가 삭제되고 실행할 때마다 처음 온 사람으로 집계됩니다. 어느 쪽이든 이름, 채팅, 입력한 내용은 보내지 않습니다."],
  "settings.showFps.desc": ["Show the frame rate in the corner during a match.", "对局中在角落显示帧率。", "대전 중 모서리에 프레임 속도를 표시합니다."],
  "settings.music.desc": ["The soundtrack's volume.", "配乐的音量。", "배경 음악의 음량입니다."],
  "settings.sfx.desc": ["The volume of the battle's and the interface's sounds.", "战斗与界面音效的音量。", "전투와 인터페이스 효과음의 음량입니다."],
  "settings.voice.desc": ["The volume of Command's radio lines.", "指挥系统无线电语音的音量。", "지휘부 무전 음성의 음량입니다."],
  "settings.voiceLang.desc": ["The language Command speaks. Automatic follows the interface.", "指挥系统语音的语言。选择自动时跟随界面语言。", "지휘부가 쓰는 언어입니다. 자동은 인터페이스 언어를 따릅니다."],
  "settings.keys.bind.desc": ["Press a key's box, then the key to put the action on. Each action takes two.", "点击按键框，再按下要绑定的键。每个操作可设两个键。", "키 칸을 누른 다음 동작을 둘 키를 누르세요. 동작마다 두 개까지 지정할 수 있습니다."],
  "settings.mouse.invertZoom.desc": ["Reverse which way the wheel zooms.", "反转滚轮缩放的方向。", "휠로 확대하고 축소하는 방향을 반대로 합니다."],
  "settings.graphicsPreset.desc": ["A preset sets every option below at once. Changing any of them makes it Custom.", "预设会一次设定下方的所有选项。修改其中任意一项即变为自定义。", "프리셋은 아래 모든 옵션을 한 번에 정합니다. 하나라도 바꾸면 사용자 지정이 됩니다."],
  "settings.renderScale.desc": ["How many pixels the battlefield is drawn with. Higher is sharper and asks more of your device.", "绘制战场所用的像素倍率。越高越清晰，对设备的要求也越高。", "전장을 그리는 픽셀 배율입니다. 높을수록 선명하지만 기기 부담이 커집니다."],
  "settings.water.desc": ["How the sea and the rivers are drawn: with their light, foam and depth, simpler, or flat.", "海洋与河流的绘制方式：完整的光影、浪花与深度，简化，或平面。", "바다와 강을 그리는 방식입니다. 빛, 물거품, 깊이까지 모두, 단순하게, 또는 평면으로."],
  "settings.lighting.desc": ["Muzzle flashes, blasts and lamps lighting the field, most of all at night.", "枪口焰、爆炸与灯光照亮战场的效果，夜间最为明显。", "총구 화염, 폭발, 조명이 전장을 밝히는 효과입니다. 밤에 가장 두드러집니다."],
  "settings.terrainDetail.desc": ["How much of the ground's texture, scrub and relief is drawn.", "地面纹理、灌木与地形起伏的绘制程度。", "지면의 질감, 덤불, 기복을 얼마나 그릴지 정합니다."],
  "settings.precipitation.desc": ["How much rain and snow falls on the screen.", "屏幕上雨雪的多少。", "화면에 내리는 비와 눈의 양입니다."],
  "settings.frameCap.desc": ["The most frames a second the game draws. A lower cap saves battery.", "游戏每秒绘制的最高帧数。上限越低越省电。", "게임이 초당 그리는 최대 프레임 수입니다. 낮출수록 배터리를 아낍니다."],
  "settings.groundMarks.desc": ["Craters, scorching and tyre ruts left on the ground.", "地面上留下的弹坑、焦痕与车辙。", "지면에 남는 포탄 구덩이, 그을음, 바퀴 자국입니다."],
  "settings.wetReflections.desc": ["Buildings reflected in the wet ground while it rains.", "下雨时建筑映在湿润的地面上。", "비가 올 때 젖은 지면에 건물이 비칩니다."],
  "settings.rainRipples.desc": ["The rings the rain makes on the water.", "雨点在水面激起的涟漪。", "빗방울이 수면에 만드는 물결입니다."],
  "settings.rainOutline.desc": ["Rain splashing on the buildings' roofs and walls.", "雨水溅落在建筑的屋顶与墙面上。", "빗방울이 건물 지붕과 벽에 튀는 모습입니다."],
  "settings.snowCover.desc": ["Snow settling on the ground and the buildings as it falls.", "降雪时积在地面与建筑上的雪。", "눈이 내릴 때 지면과 건물에 쌓이는 눈입니다."],
  "settings.cloudShadows.desc": ["The shadows of clouds drifting across the field on a clear day.", "晴天时掠过战场的云影。", "맑은 날 전장을 지나가는 구름 그림자입니다."],
  "settings.buildingShadows.desc": ["Buildings and props casting their shadows in the sun.", "建筑与装饰物在阳光下投下阴影。", "건물과 장식물이 햇빛에 그림자를 드리웁니다."],
  "settings.chimneySmoke.desc": ["Smoke rising from the power plants' stacks.", "发电厂烟囱升起的烟。", "발전소 굴뚝에서 피어오르는 연기입니다."],
  "settings.muzzleSmoke.desc": ["Smoke from the guns as they fire.", "武器开火时的硝烟。", "무기가 발사될 때 나는 연기입니다."],
  "settings.heatHaze.desc": ["Hot air shimmering over fire and a warhead's blast.", "火焰与核爆上方扭曲的热浪。", "불길과 핵폭발 위로 일렁이는 뜨거운 공기입니다."],
  "settings.lavaGlow.desc": ["The embers in the lava glowing and fading.", "熔岩中余烬的明灭。", "용암 속 불씨가 빛났다 사그라지는 모습입니다."],
  "settings.screenShake.desc": ["The screen shakes with heavy blasts nearby.", "附近发生猛烈爆炸时屏幕震动。", "가까이서 큰 폭발이 일어나면 화면이 흔들립니다."],
  "settings.keepAwake.desc": ["Keep the screen from dimming or locking during a match.", "对局中防止屏幕变暗或锁定。", "대전 중에 화면이 어두워지거나 잠기지 않게 합니다."],
  "settings.autoFullscreen.desc": ["Go fullscreen on the first tap.", "首次点触时进入全屏。", "처음 탭할 때 전체 화면으로 전환합니다."],
  "settings.haptics.desc": ["A short vibration when an order is taken.", "下达指令时短促震动。", "명령이 접수되면 짧게 진동합니다."],
  "settings.padStickSpeed.desc": ["How fast the stick moves the camera, from half the keyboard's pace to twice it.", "摇杆移动镜头的速度，为键盘速度的一半至两倍。", "스틱으로 카메라를 움직이는 속도입니다. 키보드 속도의 절반부터 두 배까지."],
  "settings.padRumble.desc": ["The controller shakes with heavy blasts and alerts.", "猛烈爆炸与警报时手柄震动。", "큰 폭발과 경보가 있으면 컨트롤러가 진동합니다."],
  "settings.padBind.desc": ["Press a button's box, then the button to put the action on. A button already taken swaps with it.", "点击按键框，再按下要分配的手柄按键。已被占用的按键会互换。", "버튼 칸을 누른 다음 동작을 둘 버튼을 누르세요. 이미 쓰는 버튼이면 서로 바뀝니다."],
  "settings.devMode.desc": ["Every mission open, and the developer tools on this page between matches.", "开放全部关卡，并在对局之外的本页显示开发者工具。", "모든 임무가 열리고 대전 밖에서는 이 페이지에 개발자 도구가 나타납니다."],
  "settings.record.desc": ["Only matches lasting at least 3 minutes in real time are recorded. Watch them in Replays on the home screen.", "仅记录实际游玩时间至少3分钟的对局，可在主界面的回放中重看。", "실제 플레이 시간이 3분 이상인 대전만 기록하며, 홈 화면의 리플레이에서 다시 볼 수 있습니다."],
  "settings.grid.desc": ["Draw the tile grid over every match.", "在每场对局中绘制地块网格。", "모든 대전에서 타일 격자를 그립니다."],
  "settings.paths.desc": ["Draw the route every moving unit is taking.", "绘制每个移动中单位的路线。", "움직이는 모든 유닛의 경로를 그립니다."],
  "settings.language": ["Language", "语言 / Language", "언어 / Language"],
  "settings.lang.auto": ["Auto", "自动", "자동"],
  "settings.downloadRegistry": ["Download registry", "下载源", "다운로드 소스"],
  "settings.downloadRegistry.desc": ["Where mods and community maps are downloaded from.", "模组与社区地图的下载来源。", "모드와 커뮤니티 지도를 다운로드할 소스입니다."],
  "settings.downloadRegistry.auto": ["Auto", "自动", "자동"],
  "settings.downloadRegistry.github": ["GitHub", "GitHub", "GitHub"],
  "settings.downloadRegistry.cloudflare": ["Cloudflare", "Cloudflare", "Cloudflare"],
  "settings.music": ["Music volume", "音乐音量", "음악 음량"],
  "settings.sfx": ["Sound effects", "音效音量", "효과음"],
  "settings.voice": ["Voice", "语音音量", "음성"],
  "settings.voiceLang": ["Narrator language", "语音播报语言", "내레이터 언어"],
  "settings.voiceLang.auto": ["Same as interface", "与界面语言一致", "인터페이스와 같게"],
  "settings.windowMode": ["Window mode", "显示模式", "화면 모드"],
  "settings.windowMode.windowed": ["Windowed", "窗口", "창 모드"],
  "settings.windowMode.fullscreen": ["Fullscreen", "全屏", "전체 화면"],
  "settings.edgeScroll": ["Edge scrolling", "屏幕边缘滚动", "가장자리 스크롤"],
  "settings.healthBars": ["Always show health bars", "始终显示血条", "체력 바 항상 표시"],
  "settings.killFeed": ["Show kill log", "显示击毁记录", "격파 기록 표시"],
  "settings.othersSkins": ["Show other players' skins", "显示其他玩家的外观", "다른 플레이어의 외형 표시"],
  "settings.shareUsage": ["Link statistics to this device", "将统计关联到本设备", "통계를 이 기기에 연결"],
  "settings.showFps": ["Show FPS", "显示帧率", "FPS 표시"],
  // the backup of the player's game (`ui/backup.ts`, `core/backup.ts`)
  "settings.backup": ["Back up your game", "备份游戏数据", "게임 백업"],
  "settings.backup.desc": [
    "Save your campaign, career, merit, looks, saved games, settings and mods to a file you keep. The browser can clear what it stores; a file you keep stays yours.",
    "把战役进度、生涯记录、军功、外观、存档、设置和模组保存为一个文件。浏览器可能清除它保存的数据，你自己保管的文件不会。",
    "캠페인, 경력, 공훈, 외형, 저장한 게임, 설정, 모드를 파일 하나로 저장합니다. 브라우저는 저장한 데이터를 지울 수 있지만, 직접 보관한 파일은 남습니다."
  ],
  "settings.backup.export": ["Export", "导出", "내보내기"],
  "settings.restore": ["Restore a backup", "恢复备份", "백업 복원"],
  "settings.restore.desc": [
    "Load a backup file. What this device holds is replaced by the file's, except the graphics settings; the file's mods are installed beside yours.",
    "载入备份文件。本设备上的数据将被文件中的替换（画面设置除外），文件中的模组会与你已安装的并存。",
    "백업 파일을 불러옵니다. 그래픽 설정을 뺀 이 기기의 데이터가 파일의 것으로 바뀌고, 파일의 모드는 설치된 모드와 함께 설치됩니다."
  ],
  "settings.restore.import": ["Import", "导入", "가져오기"],
  "backup.saved": ["Backup saved: {0}", "备份已保存：{0}", "백업 저장됨: {0}"],
  "backup.failed": ["The backup could not be saved.", "无法保存备份。", "백업을 저장하지 못했습니다."],
  "backup.notBackup": ["That file is not a Steel Tide backup.", "该文件不是钢铁浪潮的备份。", "이 파일은 스틸 타이드 백업이 아닙니다."],
  "backup.newer": ["That backup was made by a newer version of the game. Update the game to restore it.", "该备份由更新版本的游戏创建。请更新游戏后再恢复。", "더 새로운 버전의 게임에서 만든 백업입니다. 게임을 업데이트한 뒤 복원하세요."],
  "backup.restoreTitle": ["Restore this backup?", "恢复此备份？", "이 백업을 복원할까요?"],
  "backup.made": ["Saved: {0} · version {1}", "保存时间：{0} · 版本 {1}", "저장: {0} · 버전 {1}"],
  "backup.holds.missions": ["Campaign: {0} of {1} missions", "战役：已完成 {0}/{1} 关", "캠페인: 임무 {1}개 중 {0}개 완료"],
  "backup.holds.career": ["Medals: {0} · matches: {1}", "勋章：{0} · 对局：{1}", "훈장: {0} · 대전: {1}"],
  "backup.holds.merit": ["Merit: {0}", "军功：{0}", "공훈: {0}"],
  "backup.holds.saves": ["Saved games: {0}", "存档：{0}", "저장한 게임: {0}"],
  "backup.holds.mods": ["Mods: {0}", "模组：{0}", "모드: {0}"],
  "backup.replaces": [
    "What this device holds now is replaced by the backup, and the game restarts.",
    "本设备当前的数据将被备份替换，随后游戏将重新启动。",
    "이 기기의 현재 데이터가 백업으로 바뀌고 게임이 다시 시작됩니다."
  ],
  "backup.restore": ["Restore", "恢复", "복원"],
  "backup.restoreFailed": ["There was no room to restore the backup. Nothing was changed.", "存储空间不足，无法恢复备份。数据未作任何更改。", "공간이 부족해 백업을 복원하지 못했습니다. 아무것도 바뀌지 않았습니다."],
  "settings.uiScale": ["UI scale", "界面缩放", "UI 크기"],
  "settings.section.graphics": ["Graphics", "画面", "그래픽"],
  "settings.touchUi": ["Touch controls", "触屏操作", "터치 조작"],
  "settings.touchUi.auto": ["Auto", "自动", "자동"],
  "settings.touchUi.desc": ["On-screen order buttons and tap-to-command.", "屏幕指令按钮与点触下令。", "화면 명령 버튼과 탭으로 명령하기."],
  "settings.portrait": ["Portrait play", "竖屏游玩", "세로 화면 플레이"],
  "settings.portrait.desc": ["Play with the phone held upright; the panels lie along the bottom.", "竖握手机游玩，面板排在屏幕底部。", "휴대폰을 세워 들고 플레이합니다. 패널은 화면 아래에 놓입니다."],
  // the picture: a preset is one row of knobs (core/graphics.ts), and touching a knob makes it custom
  "settings.graphicsPreset": ["Quality preset", "画质预设", "품질 프리셋"],
  "settings.graphicsPreset.max": ["Max", "最高", "최대"],
  "settings.graphicsPreset.high": ["High", "高", "높음"],
  "settings.graphicsPreset.medium": ["Medium", "中", "중간"],
  "settings.graphicsPreset.low": ["Low", "低", "낮음"],
  "settings.graphicsPreset.custom": ["Custom", "自定义", "사용자 지정"],
  "settings.renderScale": ["Render sharpness", "渲染精度", "렌더링 선명도"],
  "settings.renderScale.low": ["Low", "低", "낮음"],
  "settings.renderScale.medium": ["Medium", "中", "중간"],
  "settings.renderScale.high": ["High", "高", "높음"],
  "settings.water": ["Water surface", "水面效果", "수면 효과"],
  "settings.water.full": ["Waves and light", "波浪与光影", "파도와 빛"],
  "settings.water.simple": ["Light only", "仅光影", "빛만"],
  "settings.water.off": ["Still", "静止", "정지"],
  "settings.lighting": ["Night lighting", "夜间光照", "야간 조명"],
  "settings.lighting.full": ["Full", "完整", "전체"],
  "settings.lighting.basic": ["Basic", "基础", "기본"],
  "settings.lighting.off": ["Off", "关闭", "끔"],
  "settings.terrainDetail": ["Terrain detail", "地形细节", "지형 디테일"],
  "settings.terrainDetail.full": ["Full", "完整", "전체"],
  "settings.terrainDetail.reduced": ["Reduced", "精简", "축소"],
  "settings.terrainDetail.plain": ["Plain", "平面", "단순"],
  "settings.groundCacheMiB": ["Ground cache memory", "地面缓存内存", "지면 캐시 메모리"],
  "settings.groundCacheMiB.value": ["{0} MiB", "{0} MiB", "{0} MiB"],
  "settings.groundCacheMiB.desc": ["Memory target for cached ground images. Higher limits reduce rebuilding when you revisit an area. Visible ground stays cached; trees and other graphics use additional memory.", "地面图像缓存的目标内存。提高上限可减少返回已浏览区域时的重绘。视野内的地面始终保留；树木等其他画面内容另占内存。", "지면 이미지 캐시의 목표 메모리입니다. 한도를 높이면 이전 지역으로 돌아갈 때 다시 그리는 작업이 줄어듭니다. 화면 안의 지면은 항상 유지되며, 나무 등 다른 그래픽은 별도 메모리를 사용합니다."],
  "settings.precipitation": ["Rain and snow", "雨雪粒子", "비와 눈"],
  "settings.precipitation.full": ["Full", "完整", "전체"],
  "settings.precipitation.light": ["Light", "稀疏", "약하게"],
  "settings.precipitation.off": ["Off", "关闭", "끔"],
  "settings.groundMarks": ["Tracks and smoke trails", "车辙与烟迹", "바퀴 자국과 연기 궤적"],
  "settings.frameCap": ["Frame rate limit", "帧率上限", "프레임 상한"],
  "settings.frameCap.display": ["Display", "跟随屏幕", "디스플레이"],
  "settings.wetReflections": ["Wet ground reflections", "地面湿滑倒影", "젖은 땅 반사"],
  "settings.rainRipples": ["Rain on water", "雨打水面", "수면의 빗방울"],
  "settings.rainOutline": ["Rain on buildings", "雨打建筑", "건물의 빗방울"],
  "settings.snowCover": ["Snow settles", "积雪", "쌓이는 눈"],
  "settings.cloudShadows": ["Cloud shadows", "云影", "구름 그림자"],
  "settings.buildingShadows": ["Building shadows", "建筑阴影", "건물 그림자"],
  "settings.chimneySmoke": ["Chimney smoke", "烟囱烟雾", "굴뚝 연기"],
  "settings.muzzleSmoke": ["Gun smoke", "炮口硝烟", "포연"],
  "settings.heatHaze": ["Heat haze over fire", "火焰热浪", "불길의 아지랑이"],
  "settings.lavaGlow": ["Lava glow", "熔岩辉光", "용암 불빛"],
  "settings.screenShake": ["Screen shake", "画面震动", "화면 흔들림"],
  "settings.keepAwake": ["Keep screen awake", "保持屏幕常亮", "화면 켜짐 유지"],
  "settings.autoFullscreen": ["Fullscreen", "全屏", "전체 화면"],
  "settings.haptics": ["Vibration feedback", "振动反馈", "진동 피드백"],
  // the campaign row (its title is `campaign.title`): what a reset throws away
  "settings.progress.desc": ["{0} of {1} missions completed.", "已完成 {0}/{1} 关。", "임무 {1}개 중 {0}개 완료."],
  "settings.career.desc": ["{0} of {1} earned, over {2} recorded matches.", "已获得 {0}/{1}，共记录 {2} 场对局。", "{1}개 중 {0}개 획득, 기록된 대전 {2}회."],
  "settings.section.dev": ["Developer", "开发者", "개발자"],
  // ------------------------------------------------------------- mods (ui/modsPage.ts)
  "mods.title": ["Mods", "模组", "모드"],
  "mods.pending": ["Changes take effect after this match.", "更改将在本场结束后生效。", "변경 사항은 이 대전이 끝난 뒤 적용됩니다."],
  "mods.installed": ["Installed", "已安装", "설치됨"],
  "mods.none": ["No mods installed", "尚未安装模组", "설치된 모드 없음"],
  "mods.drop": ["Drop a mod file or folder here", "将模组文件或文件夹拖放到这里", "모드 파일이나 폴더를 여기에 놓으세요"],
  "mods.by": ["by {0}", "作者：{0}", "제작: {0}"],
  "mods.source.registry": ["from the registry", "来自官方仓库", "레지스트리에서"],
  "mods.source.url": ["from {0}", "来自 {0}", "{0}에서"],
  "mods.source.file": ["from {0}", "来自文件 {0}", "{0}에서"],
  "mods.source.folder": ["from the folder {0}", "来自文件夹 {0}", "폴더 {0}에서"],
  "mods.failed": ["Not loaded", "未加载", "불러오지 못함"],
  "mods.newerGame": ["Needs game {0} or newer", "需要游戏版本 {0} 或更新", "게임 {0} 이상 필요"],
  "mods.reload": ["Reload", "重新读取", "다시 읽기"],
  "mods.reloadTip": ["Read the mod again from where it came", "从来源重新读取模组", "모드를 원래 위치에서 다시 읽습니다"],
  "mods.update": ["Update", "更新", "업데이트"],
  "mods.remove": ["Remove", "移除", "제거"],
  "mods.removeTitle": ["Remove mod", "移除模组", "모드 제거"],
  "mods.removeConfirm": [
    "Remove this mod? Saves that use it will not load until it is back.",
    "移除该模组？使用它的存档在重新安装前无法读取。",
    "이 모드를 제거할까요? 이 모드를 쓰는 저장은 다시 설치할 때까지 불러올 수 없습니다."
  ],
  "mods.registry": ["Official registry", "官方仓库", "공식 레지스트리"],
  "mods.detail.loading": ["Loading mod details…", "正在加载模组详情…", "모드 상세 정보 불러오는 중…"],
  "mods.detail.offline": ["Mod details could not be loaded.", "无法加载模组详情。", "모드 상세 정보를 불러올 수 없습니다."],
  "mods.detail.retry": ["Try again", "重试", "다시 시도"],
  "mods.registry.loading": ["Fetching the list…", "正在获取列表…", "목록 가져오는 중…"],
  "mods.registry.offline": ["The registry could not be reached.", "无法连接到模组仓库。", "레지스트리에 연결할 수 없습니다."],
  "mods.registry.empty": ["No mods published yet.", "尚无已发布的模组。", "아직 공개된 모드가 없습니다."],
  "mods.search": ["Search", "搜索", "검색"],
  "mods.searchHint": ["Name, author, description…", "名称、作者、描述…", "이름, 제작자, 설명…"],
  "mods.searchNone": ['Nothing matches "{0}".', "没有匹配“{0}”的模组。", '"{0}"에 맞는 모드가 없습니다.'],
  "mods.install": ["Install", "安装", "설치"],
  "mods.installedMark": ["Installed", "已安装", "설치됨"],
  "mods.add": ["Add your own", "添加自制模组", "직접 만든 모드 추가"],
  "mods.add.file": ["Upload file", "上传文件", "파일 업로드"],
  "mods.add.folder": ["Open folder", "打开文件夹", "폴더 열기"],
  "mods.add.url": ["Add from URL", "从网址添加", "URL로 추가"],
  "mods.add.urlPrompt": [
    "The address of a mod folder (where mod.json is) or of a .steel-tide-mod file",
    "模组文件夹（mod.json 所在处）或 .steel-tide-mod 文件的网址",
    "모드 폴더(mod.json이 있는 곳) 또는 .steel-tide-mod 파일의 주소"
  ],
  "mods.add.guide": ["How to make one", "如何制作", "만드는 방법"],
  "mods.installed.toast": ["{0} installed", "已安装 {0}", "{0} 설치됨"],
  "mods.updated.toast": ["{0} reloaded", "已重新读取 {0}", "{0} 다시 읽음"],
  "mods.error.title": ["The mod could not be loaded", "模组无法加载", "모드를 불러올 수 없습니다"],
  "mods.warnings": ["Notes", "提示", "참고"],
  "mods.enabled": ["Enabled", "启用", "사용"],
  "mods.badge": ["Mod", "模组", "모드"],
  // the mod's own plate (ui/modDetail.ts): the pictures, the facts, what it adds
  "mods.detailTip": ["Details", "详情", "상세 정보"],
  "mods.downloads": ["Downloads", "下载次数", "다운로드 횟수"],
  "mods.updatedOn": ["Updated {0}", "更新于 {0}", "{0} 업데이트"],
  "mods.screenshotOf": ["{0} in play", "{0} 游戏截图", "{0} 플레이 화면"],
  "mods.adds": ["Adds", "新增", "추가 항목"],
  "mods.units": ["Units", "单位", "유닛"],
  "mods.buildings": ["Buildings", "建筑", "건물"],
  "mods.tier": ["T{0}", "T{0}", "T{0}"],
  "mods.basedOn": ["based on {0}", "基于 {0}", "{0} 기반"],
  "mods.source": ["Source on GitHub", "GitHub 源码", "GitHub 소스"],
  "mods.homepage": ["Homepage", "主页", "홈페이지"],
  // ------------------------------------------------------------- the beginner guide (ui/guide.ts)
  "guide.title": ["Getting started", "新手上路", "시작하기"],
  "guide.metal": ["Claim metal", "占领矿点", "금속 확보"],
  "guide.metal.body": [
    "You start with two engineers, the only units that can build. Send one to the nearest deposit and place an extractor. Deposits are the only income there is, so an idle one is money left on the table.",
    "开局自带两辆工程车，只有它们能建造。派一辆去最近的矿点建一座采矿场。矿点是唯一的收入来源，空着的矿点就是白白流失的钱。",
    "공병차 두 대로 시작합니다. 건설할 수 있는 유일한 유닛입니다. 하나를 가장 가까운 광맥으로 보내 채굴장을 지으세요. 광맥은 유일한 수입원이라, 놀고 있는 광맥은 그냥 버려두는 돈입니다."
  ],
  "guide.power": ["Add power", "补充电力", "전력 추가"],
  "guide.power.body": [
    "The other engineer builds a power plant. The headquarters covers about one extractor by itself; after that every building you add needs power behind it.",
    "另一辆工程车建一座发电厂。总部自身的电力大约只够一座采矿场，之后每加一座建筑都要有电力支撑。",
    "다른 공병차로 발전소를 짓습니다. 사령부 혼자서는 채굴장 하나 정도만 감당하고, 그 뒤로는 건물을 하나 더할 때마다 뒤를 받칠 전력이 필요합니다."
  ],
  "guide.factory": ["A factory", "建造工厂", "공장"],
  "guide.factory.body": [
    "Place a war factory facing the enemy and set its rally point with a {0}. Build a buggy first and send it around the map to see what you are up against.",
    "把战车工厂建在面向敌人的一侧，用{0}设置集结点。先造一辆侦察车绕地图侦察，看看对手在做什么。",
    "적을 향해 전차 공장을 놓고 {0}으로 집결 지점을 정하세요. 먼저 버기 한 대를 만들어 지도를 한 바퀴 돌려 상대가 무얼 하는지 보세요."
  ],
  "guide.defense": ["Build defense", "修建防御", "방어 건설"],
  "guide.defense.body": [
    "An MG turret or two out by the extractors, which stand alone and are what a raid goes for; a cannon turret once tanks show up. Turrets draw power, so keep a plant ahead of them.",
    "在采矿场旁修一两座机枪塔；它们孤零零地立在外面，突袭首先冲着那里来；见到坦克再补加农炮塔。炮塔也耗电，发电要走在前面。",
    "채굴장 곁에 기관총 포탑 한두 개를 세우세요. 외따로 서 있어 기습이 먼저 노리는 곳입니다. 전차가 보이면 캐논 포탑을 더하세요. 포탑은 전력을 쓰니 발전소를 앞서 지으세요."
  ],
  "guide.fight": ["Fight your enemy", "出击迎敌", "적과 싸우기"],
  "guide.fight.body": [
    "Gather a group before you go; a handful of tanks beats a trickle. Attack-move ({1}) rather than move, so units engage on the way, and keep the factory queued while they fight.",
    "集结成群再出发；一小队坦克胜过零星添油。用攻击移动（{1}）而不是移动，单位会一路交战；打起来时也别让工厂闲着。",
    "떠나기 전에 무리를 모으세요. 전차 한 줌이 찔끔찔끔 보내는 것보다 낫습니다. 이동 대신 공격 이동({1})을 써서 가는 길에 교전하게 하고, 싸우는 동안에도 공장 대기열을 채워 두세요."
  ],
  "guide.learnMore": ["Learn more on the website", "在官网了解更多", "웹사이트에서 더 알아보기"],
  "guide.learnMore.sub": ["The full guide: the economy, the counter web, the tech tree.", "完整指南：经济与电力、克制关系、科技树。", "전체 안내서: 경제, 상성 관계, 기술 트리."],
  // ------------------------------------------------ the first mission's lesson (campaign/tutorial.ts)
  // `tut.<step>` is the step's title and `.body` its line; `.body.touch` is
  // the line for a finger where the gesture differs. In a body {0} is the
  // press that selects (a tap, or the mouse button the settings make the
  // selecting one) and {1} the attack-move key.
  "tut.tap": ["tap", "手指", "탭"],
  "tut.engineer": ["Select an engineer", "选中一辆工程车", "공병차 선택"],
  "tut.engineer.body": [
    "Engineers are the only units that can build. Select one with a {0}.",
    "只有工程车能建造。用{0}点一下，把一辆选中。",
    "건설할 수 있는 유닛은 공병차뿐입니다. {0}으로 하나를 선택하세요."
  ],
  "tut.extractor": ["Build an extractor", "建造采矿场", "채굴장 건설"],
  "tut.extractor.body": [
    "Metal is your main resource, and extractors mine it. Pick the Metal Extractor from the build menu, then place it on the marked deposit.",
    "金属是你的主要资源，由采矿场开采。在建造菜单里选择采矿场，再把它放在标出的矿点上。",
    "금속은 주 자원이고, 채굴장이 이를 캡니다. 건설 메뉴에서 금속 채굴장을 고른 뒤 표시된 광맥 위에 놓으세요."
  ],
  "tut.power": ["Build a power plant", "建造发电厂", "발전소 건설"],
  "tut.power.body": [
    "Every building draws power, and the headquarters alone cannot carry a war factory. Short of power, everything slows down. Put a Power Plant beside your base.",
    "每座建筑都要耗电，光靠总部带不动一座战车工厂。电力不足时，一切都会变慢。在基地旁建一座发电厂。",
    "모든 건물은 전력을 씁니다. 사령부 혼자서는 전차 공장을 감당하지 못하고, 전력이 모자라면 모든 것이 느려집니다. 기지 옆에 발전소를 지으세요."
  ],
  "tut.extractor2": ["Claim a second deposit", "占领第二个矿点", "두 번째 광맥 확보"],
  "tut.extractor2.body": [
    "More extractors, more metal. Put another one on the next deposit.",
    "采矿场越多，金属就越多。在下一个矿点上再建一座。",
    "채굴장이 많을수록 금속도 많습니다. 다음 광맥에 하나 더 지으세요."
  ],
  "tut.factory": ["Build a war factory", "建造战车工厂", "전차 공장 건설"],
  "tut.factory.body": [
    "The war factory turns metal into tanks. Build one near your headquarters.",
    "战车工厂把金属变成坦克。在总部附近建一座。",
    "전차 공장은 금속을 전차로 바꿉니다. 사령부 근처에 하나 지으세요."
  ],
  "tut.selectFactory": ["Select the war factory", "选中战车工厂", "전차 공장 선택"],
  "tut.selectFactory.body": [
    "Once it is finished, select it with a {0}. A building’s menu shows what it makes.",
    "建成后，用{0}点一下将它选中。建筑的菜单会列出它能生产的东西。",
    "완성되면 {0}으로 선택하세요. 건물의 메뉴에 그 건물이 만드는 것이 나옵니다."
  ],
  "tut.train": ["Train a Wolf", "生产一辆野狼", "울프 생산"],
  "tut.train.body": [
    "Pick the Wolf Light Tank to put one in the queue. It drives out on its own when it is done.",
    "选择野狼轻型坦克，把它排进生产队列。造好后它会自己开出来。",
    "울프 경전차를 골라 대기열에 넣으세요. 완성되면 스스로 나옵니다."
  ],
  "tut.army": ["Build a column: {0} of {1}", "组建纵队：{0}/{1}", "종대 편성: {0}/{1}"],
  "tut.army.body": [
    "One tank is a target; six are a column. Queue more: a click with Shift held queues five at once.",
    "一辆坦克只是靶子，六辆才成纵队。继续排产：按住 Shift 点击，一次排五辆。",
    "전차 한 대는 표적일 뿐이고, 여섯 대면 종대입니다. 더 넣으세요. Shift를 누른 채 클릭하면 한 번에 다섯 대가 들어갑니다."
  ],
  "tut.army.body.touch": [
    "One tank is a target; six are a column. Keep tapping the tile to queue more.",
    "一辆坦克只是靶子，六辆才成纵队。继续轻触图标，排进更多。",
    "전차 한 대는 표적일 뿐이고, 여섯 대면 종대입니다. 타일을 계속 탭해 더 넣으세요."
  ],
  "tut.selectArmy": ["Select your column", "选中你的纵队", "종대 선택"],
  "tut.selectArmy.body": [
    "Drag a box around your tanks to pick them all up at once.",
    "按住鼠标拖出一个框，把坦克一次全部框选。",
    "전차들을 드래그 상자로 감싸 한꺼번에 선택하세요."
  ],
  "tut.selectArmy.body.touch": [
    "Plant two fingers either side of your tanks and hold them still; when one lifts, everything between them is selected.",
    "两根手指按在坦克两侧并保持不动；抬起其中一根时，两指之间的单位都会被选中。",
    "두 손가락을 전차들 양옆에 대고 가만히 누르세요. 한 손가락을 떼면 그 사이의 유닛이 모두 선택됩니다."
  ],
  "tut.attack": ["Attack the border post", "进攻边境哨所", "국경 초소 공격"],
  "tut.attack.body": [
    "Press {1} or the lit order button, then click near the marked border post. On an attack-move the column fights whatever it meets on the way.",
    "按 {1} 或点亮的指令按钮，再点击标出的边境哨所附近。攻击移动时，纵队会与途中遇到的一切交战。",
    "{1} 키나 빛나는 명령 버튼을 누른 뒤 표시된 국경 초소 근처를 클릭하세요. 공격 이동 중인 종대는 가는 길에 만나는 모든 것과 싸웁니다."
  ],
  "tut.attack.body.touch": [
    "Hold a finger on the ground near the marked border post: the column attack-moves there, fighting whatever it meets on the way.",
    "在标出的边境哨所附近长按地面：纵队会攻击移动过去，与途中遇到的一切交战。",
    "표시된 국경 초소 근처 땅을 길게 누르세요. 종대가 그곳으로 공격 이동하며 가는 길에 만나는 모든 것과 싸웁니다."
  ],
  "tut.destroy": ["Clear the border post", "清除边境哨所", "국경 초소 소탕"],
  "tut.destroy.body": [
    "Destroy every building and vehicle at the post. Tanks lost on the way can be replaced at the war factory.",
    "摧毁哨所的每一座建筑和每一辆车。路上损失的坦克可以在战车工厂补充。",
    "초소의 모든 건물과 차량을 파괴하세요. 가는 길에 잃은 전차는 전차 공장에서 보충할 수 있습니다."
  ],
  "tut.complete": ["Lesson complete", "教学完成", "교육 완료"],
  "tut.complete.body": [
    "Metal, power, a factory and a column: every battle after this one is built the same way, only bigger.",
    "金属、电力、工厂、纵队：之后的每一场仗都是这样打起来的，只是规模更大。",
    "금속, 전력, 공장, 종대. 앞으로의 모든 전투는 이렇게 쌓아 올립니다. 규모만 더 클 뿐입니다."
  ],
  "settings.devMode": ["Developer mode", "开发者模式", "개발자 모드"],
  "settings.clientContentFilter": ["Client content filter", "客户端内容过滤", "클라이언트 콘텐츠 필터"],
  "settings.clientContentFilter.desc": ["Check names and chat before sending to official servers with filtering enabled. Turn off to skip these checks while Developer mode is on. Server rules still apply.", "仅在官方服务器开启过滤时，发送前检查名称和聊天内容。关闭后，在开发者模式开启期间跳过这些检查。服务器规则仍然生效。", "필터가 켜진 공식 서버에 이름과 채팅을 보내기 전에 확인합니다. 끄면 개발자 모드가 켜져 있는 동안 이 검사를 건너뜁니다. 서버 규칙은 계속 적용됩니다."],
  "settings.dev.group.commentary": ["Commentary", "解说", "해설"],
  "settings.dev.group.tools": ["Tools", "工具", "도구"],
  "settings.dev.group.battlefield": ["Battlefield", "战场", "전장"],
  "settings.dev.group.progress": ["Progress", "进度", "진행 상황"],
  "settings.dev.group.store": ["Store", "商店", "상점"],
  "settings.commentary.local": ["Generate commentary locally", "本地生成解说", "해설을 로컬에서 생성"],
  "settings.commentary.local.desc": ["Write commentary immediately from game events and tactical rules. Turn off to stream commentary from the text model as it writes. Both modes use the Narration Language from Audio settings.", "根据战况和战术规则即时生成解说。关闭后，文本模型边生成边播报。两种模式均遵循音频设置中的旁白语言。", "게임 상황과 전술 규칙으로 해설을 즉시 작성합니다. 끄면 텍스트 모델이 작성하는 대로 해설을 스트리밍합니다. 두 모드 모두 오디오 설정의 내레이션 언어를 사용합니다."],
  "settings.commentary.textModel": ["Commentary text model", "解说文本模型", "해설 텍스트 모델"],
  "settings.commentary.textModel.desc": ["The AI model that writes live spectator commentary.", "用于撰写观战实时解说的 AI 模型。", "관전 중 실시간 해설을 작성하는 AI 모델입니다."],
  "settings.commentary.voiceModel": ["Commentary voice model", "解说语音模型", "해설 음성 모델"],
  "settings.commentary.voiceModel.desc": ["The ElevenLabs model that speaks live commentary in either generation mode.", "用于播报实时解说的 ElevenLabs 模型，适用于两种生成模式。", "두 생성 모드에서 실시간 해설을 읽는 ElevenLabs 모델입니다."],
  "settings.commentary.model.elevenV4": ["eleven_v4", "eleven_v4", "eleven_v4"],
  "settings.commentary.model.elevenV3": ["eleven_v3", "eleven_v3", "eleven_v3"],
  "settings.commentary.model.elevenMultilingual": ["eleven_multilingual_v2 (default)", "eleven_multilingual_v2（默认）", "eleven_multilingual_v2 (기본값)"],
  "settings.commentary.model.ling": ["inclusionai/ling-3.1-flash", "inclusionai/ling-3.1-flash", "inclusionai/ling-3.1-flash"],
  "settings.commentary.model.laguna": ["poolside/laguna-s-2.1-free", "poolside/laguna-s-2.1-free", "poolside/laguna-s-2.1-free"],
  "settings.commentary.model.gemini": ["google/gemini-3.6-flash", "google/gemini-3.6-flash", "google/gemini-3.6-flash"],
  // a developer tool's row on the Developer page (`ui/devTools.ts`): the button that opens its screen
  "settings.devTool.open": ["Open", "打开", "열기"],
  "settings.grid": ["Always show grid", "始终显示网格", "항상 격자 표시"],
  "settings.placeGrid": ["Show grid when building", "建造时显示网格", "건설 시 격자 표시"],
  "settings.actionHints": ["Show action hints", "显示操作提示", "조작 안내 표시"],
  "settings.paths": ["Show paths", "显示寻路路径", "이동 경로 표시"],
  "pause.recording": ["Recording", "录制中", "녹화 중"],
  "hud.hiddenHint": ["Interface hidden: {0} brings it back", "界面已隐藏：按 {0} 恢复", "인터페이스를 숨겼습니다. {0} 키로 다시 표시합니다"],
  "shot.saved": ["Screenshot saved: {0}", "截图已保存：{0}", "스크린샷 저장됨: {0}"],
  "shot.failed": ["The screenshot could not be saved", "截图保存失败", "스크린샷을 저장하지 못했습니다"],
  "shot.unavailable": ["Screenshots cannot be kept in this app", "此应用无法保存截图", "이 앱에서는 스크린샷을 저장할 수 없습니다"],
  // ------------------------------------------------------------- match profiles (ui/profilesPage.ts)
  "settings.record": ["Record matches", "记录对局", "대전 기록"],
  // the Developer page's merit, to try the Store with (`core/merit.ts`)
  "settings.merit": ["Merit", "军功", "공훈"],
  "settings.merit.desc": [
    "{0} to spend in the Store. Merit added here counts as none earned.",
    "商店可用 {0}。在此添加的军功不计入累计获得。",
    "상점에서 쓸 수 있는 공훈 {0}. 여기서 더한 공훈은 누적 획득에 포함되지 않습니다."
  ],
  "settings.merit.grant": ["Add {0}", "添加 {0}", "{0} 추가"],
  // the Developer page's *Clear purchases* (`clearPurchases`): {0} how many the Store sold, {1} the merit spent on them;
  // the confirmation's {0} is the standard pack's name (`skin.steel.name`)
  "settings.purchases": ["Clear purchases", "清除购买", "구매 초기화"],
  "settings.purchases.desc": [
    "{0} bought in the Store, {1} merit spent.",
    "已在商店购买 {0} 项，花费 {1} 军功。",
    "상점에서 {0}개 구매, 공훈 {1} 사용."
  ],
  "settings.purchases.clear": ["Clear", "清除", "지우기"],
  "settings.purchases.confirm": [
    "Take back everything bought in the Store? The merit spent on it is refunded, and everything wearing it goes back to {0}.",
    "确定撤销在商店中的全部购买？所花费的军功将全部退还，使用这些外观的单位和建筑将恢复为“{0}”。",
    "상점에서 구매한 것을 모두 되돌릴까요? 사용한 공훈은 돌려받고, 그 외형을 쓰던 유닛과 건물은 {0}로 돌아갑니다."
  ],
  "profiles.open": ["Open a file…", "打开文件…", "파일 열기…"],
  "profiles.notASave": ["That is not a Steel Tide save or recording.", "这不是钢铁浪潮的存档或录像。", "스틸 타이드 저장 파일이나 녹화가 아닙니다."],
  "profiles.admin": ["console used", "使用过控制台", "콘솔 사용됨"],
  "profiles.copyFailed": ["Could not reach the clipboard.", "无法访问剪贴板。", "클립보드에 접근할 수 없습니다."],
  "profiles.noReplay.loaded": [
    "This save was picked up from another save, so it cannot be replayed from its opening.",
    "该存档是从另一份存档续玩的，无法从开局回放。",
    "이 저장은 다른 저장에서 이어진 것이라 시작부터 다시 재생할 수 없습니다."
  ],
  "profiles.noReplay.legacy": ["This file has no replay record.", "该文件没有回放记录。", "이 파일에는 리플레이 기록이 없습니다."],
  "profiles.noReplay.truncated": [
    "The order log of this save was cut short, so it cannot be replayed.",
    "该存档的指令记录被截断，无法回放。",
    "이 저장의 명령 기록이 잘려 있어 다시 재생할 수 없습니다."
  ],
  "replay.recordings": ["Recordings", "录像", "녹화"],
  "replay.all": ["All", "全部", "전체"],
  "replay.favorites": ["Favorites", "收藏", "즐겨찾기"],
  "replay.trash": ["Trash", "回收站", "휴지통"],
  "replay.favorite": ["Add to favorites", "添加到收藏", "즐겨찾기에 추가"],
  "replay.unfavorite": ["Remove from favorites", "取消收藏", "즐겨찾기에서 제거"],
  "replay.moveToTrash": ["Move to trash", "移至回收站", "휴지통으로 이동"],
  "replay.trashed": ["Moved to trash.", "已移至回收站。", "휴지통으로 이동했습니다."],
  "replay.restore": ["Restore", "还原", "복원"],
  "replay.deletePermanently": ["Delete permanently", "永久删除", "영구 삭제"],
  "replay.deleted": ["Permanently deleted.", "已永久删除。", "영구 삭제했습니다."],
  "replay.loading": ["Loading recordings…", "正在加载录像…", "녹화 불러오는 중…"],
  "replay.noFavorites": ["No favorites yet. Select a recording and add it to favorites.", "还没有收藏。选择一份录像并将其添加到收藏。", "아직 즐겨찾기가 없습니다. 녹화를 선택해 즐겨찾기에 추가하세요."],
  "replay.noTrash": ["Trash is empty.", "回收站为空。", "휴지통이 비어 있습니다."],
  "replay.noRecordings": [
    "No recordings. With recording on, matches lasting at least 3 minutes in real time are kept here.",
    "还没有录像。开启记录后，实际游玩时间至少3分钟的对局会保存在这里。",
    "녹화가 없습니다. 녹화를 켜면 실제 플레이 시간이 3분 이상인 대전이 여기에 보관됩니다."
  ],
  "replay.delete": ["Delete recording", "删除录像", "녹화 삭제"],
  "replay.deleteConfirm": ["Permanently delete this recording? This cannot be undone.", "永久删除该录像？此操作无法撤销。", "이 녹화를 영구 삭제할까요? 되돌릴 수 없습니다."],
  "replay.selectedCount": ["{0} recordings selected", "已选择 {0} 份录像", "녹화 {0}개 선택됨"],
  "replay.selectedSize": ["{0} MB selected", "已选录像共 {0} MB", "선택한 녹화 {0} MB"],
  "replay.deleteMany": ["Delete recordings", "删除录像", "녹화 삭제"],
  "replay.deleteManyConfirm": ["Permanently delete these {0} recordings? This cannot be undone.", "永久删除这 {0} 份录像？此操作无法撤销。", "이 녹화 {0}개를 영구 삭제할까요? 되돌릴 수 없습니다."],
  "replay.updateFailed": ["Could not update the selected recordings.", "无法更新所选录像。", "선택한 녹화를 업데이트할 수 없습니다."],
  "replay.exportFailed": ["Could not export the selected recordings.", "无法导出所选录像。", "선택한 녹화를 내보낼 수 없습니다."],
  "replay.won": ["Won", "获胜", "승리"],
  "replay.lost": ["Lost", "战败", "패배"],
  "replay.teamWon": ["Team {0} won", "{0}队获胜", "{0} 팀 승리"],
  "replay.unfinished": ["Unfinished", "未完成", "미완료"],
  "replay.match": ["Match", "对局", "대전"],
  "replay.selection": ["Unit", "单位", "유닛"],
  "replay.orders": ["orders", "条指令", "개 명령"],
  "replay.copy": ["Copy profile", "复制记录", "프로필 복사"],
  "replay.copyTip": ["The match profile as JSON, to paste for analysis", "对局记录 JSON，可粘贴用于分析", "분석용으로 붙여 넣을 대전 프로필 JSON"],
  "replay.restart": ["From the opening", "从开局", "처음부터"],
  "replay.play": ["Play", "播放", "재생"],
  "replay.pause": ["Pause", "暂停", "일시 정지"],
  "replay.progress": ["Progress", "进度", "진행"],
  "replay.event.hq": ["{0}: HQ destroyed", "{0}：总部被摧毁", "{0}: 본부 파괴"],
  "replay.event.nuclear": ["{0}: Nuclear launch", "{0}：核武器发射", "{0}: 핵무기 발사"],
  "replay.event.battle": ["Heavy fighting", "激烈交战", "격전"],
  "replay.otherBuild": [
    "Recorded on build {0}; this is {1}. Under different rules the match may go differently.",
    "录制于版本 {0}，当前为 {1}。规则不同，对局可能走向不同。",
    "빌드 {0}에서 기록됨, 현재는 {1}입니다. 규칙이 다르면 대전이 다르게 흘러갈 수 있습니다."
  ],
  "replay.keyframes": ["keyframes", "个关键帧", "개 키프레임"],
  "replay.storage": ["{0} MB of {1} MB kept; past that the oldest go", "已用 {0} MB / {1} MB，超出后最旧的先删", "{0} MB / {1} MB 사용, 넘으면 오래된 것부터 삭제"],
  "rec.started": [
    "Recording this match from here. Find the replay under Replays on the home screen.",
    "从此刻起录制本局。可在主界面的“回放”中查看。",
    "지금부터 이 경기를 녹화합니다. 홈 화면의 리플레이에서 확인하세요."
  ],
  "rec.already": ["This match is already being recorded.", "本局已在录制中。", "이 경기는 이미 녹화 중입니다."],
  "rec.matchOnly": ["Only players and spectators in the match can record.", "只有本局的参战玩家和观战者可以录制。", "이 경기의 플레이어와 관전자만 녹화할 수 있습니다."],
  "rec.serverStarted": [
    "On record from tick {0}: the record is kept with the match and handed to players and spectators at the result.",
    "从第 {0} 帧开始录制：录像随对局保存，并在比赛结束后提供给玩家和观战者。",
    "틱 {0}부터 녹화합니다. 녹화는 경기와 함께 보관되며 경기가 끝나면 플레이어와 관전자에게 제공됩니다."
  ],
  "rec.notKept": [
    "The recording could not be stored: this device refused the space. It is kept only until the game closes: export it under Replays on the home screen.",
    "录像无法保存：本设备拒绝分配空间。它只保留到游戏关闭：请到主界面的“回放”导出。",
    "녹화를 저장할 수 없습니다. 이 기기가 공간을 거부했습니다. 게임을 닫을 때까지만 남으니 홈 화면의 리플레이에서 내보내세요."
  ],
  "replay.copyReport": ["Copy report", "复制报告", "보고서 복사"],
  "replay.copyReportTip": ["The match read out as text: economy, tech, guns, matchups, what looks wrong", "对局文字解读：经济、科技、武器、对位、可疑之处", "대전을 글로 읽어낸 것: 경제, 테크, 무기, 상성, 의심스러운 점"],
  "replay.exportVideo": ["Export as video", "导出为视频", "동영상으로 내보내기"],
  "replay.exportVideoFormat": ["The whole map, {0}×{1} at {2} fps, WebM ({3}), picture only", "整张地图，{0}×{1}，{2} fps，WebM（{3}），仅画面", "전체 지도, {0}×{1}, {2} fps, WebM ({3}), 화면만"],
  "replay.exportVideoSpeed": ["Playback speed", "播放速度", "재생 속도"],
  "replay.exportVideoLength": ["{0} of match at {1}× makes {2} of video", "{0} 的对局以 {1}× 导出为 {2} 的视频", "{0} 길이의 대전을 {1}×로 내보내면 {2} 길이의 동영상"],
  "replay.exportVideoLeft": ["about {0} left", "剩余约 {0}", "약 {0} 남음"],
  "replay.exportVideoDone": ["Video saved as {0}", "视频已保存为 {0}", "동영상을 {0}(으)로 저장했습니다"],
  "replay.exportVideoUnsupported": [
    "No video encoder (WebCodecs) is available here; the export needs one.",
    "此处没有可用的视频编码器（WebCodecs），无法导出。",
    "여기서는 동영상 인코더(WebCodecs)를 쓸 수 없어 내보낼 수 없습니다."
  ],
  "replay.exportVideoFailed": ["The video export failed: {0}", "视频导出失败：{0}", "동영상 내보내기 실패: {0}"],
  // ------------------------------------------------------------- controller
  "settings.tab.general": ["General", "常规", "일반"],
  "settings.tab.audio": ["Audio", "音频", "오디오"],
  "settings.section.pad": ["Controller", "手柄", "컨트롤러"],
  "settings.padGlyphs": ["Button glyphs", "按键图标", "버튼 아이콘"],
  "settings.padGlyphs.auto": ["Auto", "自动", "자동"],
  "settings.padGlyphs.desc": [
    "Steam Input presents every pad as an Xbox one; choose your own here.",
    "Steam 输入会把所有手柄都当作 Xbox 手柄，可在此手动指定。",
    "Steam 입력은 모든 패드를 Xbox 패드로 보여 줍니다. 여기서 직접 고르세요."
  ],
  "settings.padStickSpeed": ["Stick pan speed", "摇杆平移速度", "스틱 이동 속도"],
  "settings.padRumble": ["Vibration", "手柄震动", "진동"],
  "pause.speed": ["Game speed", "游戏速度", "게임 속도"],
  // the bindings (core/controls.ts, settingsUi.ts)
  "settings.tab.keys": ["Controls", "按键", "조작"],
  "settings.keys.keyboard": ["Keyboard", "键盘", "키보드"],
  "settings.keys.layout": ["Keyboard preset", "键盘预设", "키보드 프리셋"],
  "settings.keys.layout.wasd": ["WASD", "WASD", "WASD"],
  "settings.keys.layout.classic": ["Classic", "经典", "클래식"],
  "settings.keys.layout.aoe2": ["Age of Empires II", "帝国时代 II", "에이지 오브 엠파이어 II"],
  "settings.keys.layout.sc2": ["StarCraft II", "星际争霸 II", "스타크래프트 II"],
  "settings.keys.layout.ra2": ["Red Alert 2", "红色警戒 2", "레드 얼럿 2"],
  "settings.keys.layout.custom": ["Custom ({0})", "自定义（{0}）", "사용자 지정 ({0})"],
  "settings.keys.layout.custom.desc": [
    "Custom bindings based on {0}.",
    "基于{0}的自定义绑定。",
    "{0} 기반의 사용자 지정 키 설정입니다."
  ],
  "settings.keys.layout.desc": [
    "Choosing a preset replaces custom keyboard bindings. Familiar keys are adapted to Steel Tide; edit any key below.",
    "选择预设会替换自定义键盘绑定。熟悉的按键已适配 Steel Tide；下方可继续修改。",
    "프리셋을 선택하면 사용자 지정 키 설정을 바꿉니다. 익숙한 키를 Steel Tide에 맞췄으며 아래에서 수정할 수 있습니다."
  ],
  "settings.keys.layout.wasd.desc": [
    "WASD pans the camera; F attack-moves, R stops.",
    "WASD 平移视角；F 攻击移动，R 停止。",
    "WASD로 화면을 이동합니다. F는 공격 이동, R은 정지입니다."
  ],
  "settings.keys.layout.classic.desc": [
    "The arrow keys and the screen edge pan; A attack-moves, S stops.",
    "方向键与屏幕边缘平移视角；A 攻击移动，S 停止。",
    "방향키와 화면 가장자리로 이동합니다. A는 공격 이동, S는 정지입니다."
  ],
  "settings.keys.layout.aoe2.desc": [
    "R or Z attack-moves, S stops, N holds position, X protects, H goes to HQ. Arrow keys pan.",
    "R 或 Z 攻击移动，S 停止，N 原地驻守，X 保护，H 返回总部。方向键平移视角。",
    "R 또는 Z는 공격 이동, S는 정지, N은 위치 사수, X는 보호, H는 본부 이동입니다. 방향키로 화면을 이동합니다."
  ],
  "settings.keys.layout.sc2.desc": [
    "A attack-moves, M moves, S stops, H holds position, D unloads, Backspace goes to HQ. Arrow keys pan.",
    "A 攻击移动，M 移动，S 停止，H 原地驻守，D 卸载，退格键返回总部。方向键平移视角。",
    "A는 공격 이동, M은 이동, S는 정지, H는 위치 사수, D는 하차, Backspace는 본부 이동입니다. 방향키로 화면을 이동합니다."
  ],
  "settings.keys.layout.ra2.desc": [
    "S stops, G protects, D uses an ability, L sells, H goes to HQ. A attack-moves; arrow keys pan.",
    "S 停止，G 保护，D 使用技能，L 出售，H 返回总部。A 攻击移动，方向键平移视角。",
    "S는 정지, G는 보호, D는 능력 사용, L은 판매, H는 본부 이동입니다. A는 공격 이동이며 방향키로 화면을 이동합니다."
  ],
  "settings.keys.mouse": ["Mouse", "鼠标", "마우스"],
  "settings.keys.pad": ["Buttons", "按键", "버튼"],
  "settings.keys.group.orders": ["Orders", "指令", "명령"],
  "settings.keys.group.direct": ["Direct control", "直接操控", "직접 조종"],
  "settings.keys.group.camera": ["Camera and view", "视角", "카메라와 시점"],
  "settings.keys.group.game": ["Game", "游戏", "게임"],
  "settings.keys.press": ["Press a key…", "请按键…", "키를 누르세요…"],
  "settings.keys.pressPad": ["Press a button…", "请按手柄键…", "버튼을 누르세요…"],
  "settings.keys.clear": ["Clear", "清除", "지우기"],
  "settings.keys.hint": [
    "Click a key to change it; a key may serve more than one action. Escape and the number row are fixed.",
    "点击按键即可更改；一个键可用于多个操作。Esc 与数字行固定不变。",
    "키를 클릭해 바꾸세요. 한 키가 여러 동작을 맡을 수 있습니다. Esc와 숫자 줄은 고정입니다."
  ],
  "settings.mouse.command": ["Command button", "指令键", "명령 버튼"],
  "settings.mouse.command.desc": ["Gives orders; the other button selects.", "用于下令，另一键用于选择。", "명령을 내립니다. 다른 버튼은 선택합니다."],
  "settings.mouse.right": ["Right", "右键", "오른쪽"],
  "settings.mouse.left": ["Left", "左键", "왼쪽"],
  "settings.mouse.panDrag": ["Pan by dragging", "拖动平移", "드래그로 화면 이동"],
  "settings.mouse.panDrag.desc": ["With the command button, a click still gives the order.", "选指令键时，单击仍为下令。", "명령 버튼으로 드래그해도 클릭은 여전히 명령입니다."],
  "settings.mouse.middle": ["Middle button", "中键", "가운데 버튼"],
  "settings.mouse.commandBtn": ["Command button", "指令键", "명령 버튼"],
  "settings.mouse.none": ["Off", "关", "끔"],
  "settings.mouse.invertZoom": ["Invert zoom", "反转缩放", "줌 반전"],
  "bind.attackMove": ["Attack-move", "攻击移动", "공격 이동"],
  "bind.move": ["Move, ignoring targets", "移动（忽略目标）", "이동(표적 무시)"],
  "bind.stop": ["Stop", "停止", "정지"],
  "bind.hold": ["Hold position", "原地待命", "위치 사수"],
  "bind.holdFire": ["Hold fire / fire at will", "停火待命 / 自由开火", "사격 중지 / 자유 사격"],
  "bind.protect": ["Protect a friendly target or area", "保护友方目标或区域", "아군 대상 또는 영역 보호"],
  "bind.unload": ["Unload", "卸载", "하차"],
  "bind.upgrade": ["Upgrade the building", "升级建筑", "건물 업그레이드"],
  "bind.sell": ["Sell the building (twice)", "出售建筑（按两次）", "건물 판매(두 번)"],
  "bind.launch": ["Launch warhead", "发射核弹", "핵탄두 발사"],
  "bind.selfDestruct": ["Recycle / self-destruct", "回收 / 自毁", "재활용 / 자폭"],
  "bind.quickSelect": ["Mark (tap) · quick select (hold)", "标记（轻按）· 快速选择（按住）", "표식(짧게) · 빠른 선택(누르고 있기)"],
  "bind.buildPrev": ["Previous building (while placing)", "上一个建筑（放置时）", "이전 건물(배치 중)"],
  "bind.buildNext": ["Next building (while placing)", "下一个建筑（放置时）", "다음 건물(배치 중)"],
  "bind.direct": ["Direct control of the selection", "直接操控所选单位", "선택 유닛 직접 조종"],
  "bind.formation": ["Formation for the selection, or break it", "所选单位组成编队，或解散编队", "선택 유닛 대형 편성 또는 해제"],
  "bind.ability": ["Use the selection's ability; surface or dive a submarine", "所选单位使用技能；潜艇上浮或下潜", "선택 유닛 능력 사용; 잠수함 부상 또는 잠수"],
  "bind.steerUp": ["Steer up", "向上驾驶", "위로 조종"],
  "bind.steerDown": ["Steer down", "向下驾驶", "아래로 조종"],
  "bind.steerLeft": ["Steer left", "向左驾驶", "왼쪽으로 조종"],
  "bind.steerRight": ["Steer right", "向右驾驶", "오른쪽으로 조종"],
  "bind.panUp": ["Pan up", "视角上移", "위로 이동"],
  "bind.panDown": ["Pan down", "视角下移", "아래로 이동"],
  "bind.panLeft": ["Pan left", "视角左移", "왼쪽으로 이동"],
  "bind.panRight": ["Pan right", "视角右移", "오른쪽으로 이동"],
  "bind.jumpHq": ["Jump to headquarters (hold to peek)", "跳转到总部（按住查看）", "사령부로 이동(누르면 잠깐 보기)"],
  "bind.follow": ["Follow the selection", "跟随所选单位", "선택 유닛 따라가기"],
  "bind.map": ["Battle map (hold to peek)", "战场地图（按住查看）", "전장 지도(누르면 잠깐 보기)"],
  "bind.sidebar": ["Toggle the sidebar", "展开 / 收起侧边栏", "사이드바 전환"],
  "bind.xray": ["Health bars and see-through (hold)", "血条与透视（按住）", "체력 바와 투시(누르고 있기)"],
  "bind.hideHud": ["Hide the interface", "隐藏界面", "인터페이스 숨기기"],
  "bind.screenshot": ["Screenshot", "截图", "스크린샷"],
  "bind.readout": ["Performance readout (FPS)", "性能读数（帧率）", "성능 측정값 표시(FPS)"],
  "bind.pause": ["Pause", "暂停", "일시 정지"],
  "bind.speedDown": ["Slower", "减速", "느리게"],
  "bind.speedUp": ["Faster", "加速", "빠르게"],
  "bind.speedCycle": ["Cycle game speed", "切换游戏速度", "게임 속도 전환"],
  "bind.quickSave": ["Quick save", "快速保存", "빠른 저장"],
  "bind.quickLoad": ["Quick load", "快速读取", "빠른 불러오기"],
  "bind.record": ["Record this match from now", "从此刻起录制本局", "지금부터 이 경기 녹화"],
  "bind.help": ["Beginner guide", "新手指南", "초보자 안내"],
  "bind.scoreboard": ["Player list (hold)", "玩家列表（按住）", "플레이어 목록(누르고 있기)"],
  "bind.chat": ["Chat", "聊天", "채팅"],
  "bind.console": ["Admin console", "管理控制台", "관리자 콘솔"],
  "bind.command": ["Command line", "命令行", "명령줄"],
  "bind.pad.confirm": ["Select / confirm", "选择 / 确认", "선택 / 확인"],
  "bind.pad.cancel": ["Cancel / back", "取消 / 返回", "취소 / 뒤로"],
  "bind.pad.command": ["Command", "下令", "명령"],
  "bind.pad.attackMove": ["Attack-move", "攻击移动", "공격 이동"],
  "bind.pad.modifier": ["Modifier (hold: queue, add)", "修饰键（按住：排队、加选）", "보조 키(누르고 있기: 대기열, 추가 선택)"],
  "bind.pad.wheel": ["Command wheel (hold)", "指令轮盘（按住）", "명령 휠(누르고 있기)"],
  "bind.pad.quickSelect": ["Mark (tap) · quick select (hold)", "标记（轻按）· 快速选择（按住）", "표식(짧게) · 빠른 선택(누르고 있기)"],
  "bind.pad.focus": ["Camera to the selection", "视角跳转到所选", "선택 유닛으로 카메라"],
  "bind.pad.map": ["Battle map", "战场地图", "전장 지도"],
  "bind.pad.menu": ["Pause menu", "暂停菜单", "일시 정지 메뉴"],
  "bind.pad.hq": ["Jump to headquarters", "跳转到总部", "사령부로 이동"],
  "bind.pad.sidebar": ["Sidebar focus", "操作侧边栏", "사이드바 포커스"],
  "help.leftClickShort": ["left click", "左键", "왼쪽 클릭"],
  "help.rightClickShort": ["right click", "右键", "오른쪽 클릭"],
  "pad.more": ["More…", "更多…", "더 보기…"],
  "pad.hint.select": ["Select", "选择", "선택"],
  "pad.hint.boxSelect": ["Hold: box-select", "按住：框选", "누르고 있기: 범위 선택"],
  "pad.hint.boxRelease": ["Release to select", "松开完成选择", "놓으면 선택"],
  "pad.hint.quickSelect": ["Mark · hold: quick select", "标记 · 按住：快速选择", "표식 · 누르고 있기: 빠른 선택"],
  "pad.hint.groups": ["Groups", "编队", "부대"],
  "pad.hint.map": ["Battle map", "战场地图", "전장 지도"],
  "pad.hint.menu": ["Menu", "菜单", "메뉴"],
  "pad.hint.orders": ["Orders", "指令", "명령"],
  "pad.hint.build": ["Build", "建造", "건설"],
  "pad.hint.produce": ["Produce", "生产", "생산"],
  "pad.hint.deselect": ["Deselect", "取消选择", "선택 해제"],
  // direct control on the pad: the left stick drives, the right stick aims
  "pad.hint.steer": ["Steer", "驾驶", "조종"],
  "pad.hint.aimGuns": ["Aim", "瞄准", "조준"],
  "pad.hint.fire": ["Fire", "开火", "발사"],
  "pad.hint.orderAt": ["Order here", "在此下令", "여기에 명령"],
  "pad.hint.zoom": ["Zoom", "缩放", "확대/축소"],
  "pad.hint.letGo": ["Let go", "结束操控", "조종 해제"],
  "pad.hint.place": ["Place", "放置", "놓기"],
  "pad.hint.keepPlacing": ["Hold: keep placing", "按住：连续放置", "누르고 있기: 계속 놓기"],
  "pad.hint.nudge": ["Nudge", "微调", "미세 조정"],
  "pad.hint.cancel": ["Cancel", "取消", "취소"],
  "pad.hint.confirm": ["Confirm", "确认", "확인"],
  "pad.hint.choose": ["Choose", "选取", "고르기"],
  "pad.hint.release": ["Release to confirm", "松开确认", "놓으면 확인"],
  "pad.hint.page": ["Next page", "下一页", "다음 페이지"],
  "pad.hint.aim": ["Aim", "瞄准", "조준"],
  "pad.hint.look": ["Look there", "跳转视角", "그곳 보기"],
  "pad.hint.orderHere": ["Order here", "在此下令", "여기에 명령"],
  "pad.hint.close": ["Close", "关闭", "닫기"],
  "pad.hint.move": ["Navigate", "导航", "탐색"],
  "pad.hint.back": ["Back", "返回", "뒤로"],
  "pad.hint.tabs": ["Tabs", "切换页签", "탭"],
  "pad.verb.rally": ["Set rally point", "设置集结点", "집결 지점 설정"],
  "pad.verb.attack": ["Attack", "攻击", "공격"],
  "pad.verb.assist": ["Help build", "协助建造", "건설 돕기"],
  "pad.verb.board": ["Board", "登乘", "탑승"],
  "pad.verb.pickup": ["Pick up", "接载", "태우기"],
  // the mouse and keyboard's hint bar (ui/actionHints.ts); the rest of its words are the pad's
  "hint.selectAny": ["Select building or unit", "选择建筑或单位", "건물 또는 유닛 선택"],
  "hint.pan": ["Pan", "移动视角", "화면 이동"],
  "hint.nextBuilding": ["Next building", "下一个建筑", "다음 건물"],
  "hint.wheel": ["mouse wheel", "鼠标滚轮", "마우스 휠"],
  "hint.turnOff": ["Turn off hints", "关闭操作提示", "조작 안내 끄기"],
  "hint.offToast": ["Action hints off. {0} › {1} turns them back on.", "操作提示已关闭，可在“{0} › {1}”中重新开启。", "조작 안내를 껐습니다. {0} › {1}에서 다시 켤 수 있습니다."],
  // ------------------------------------------------------------- PWA updates
  "pwa.updateReady": ["A new version is ready.", "新版本已就绪。", "새 버전이 준비되었습니다."],
  "pwa.reload": ["Reload", "重新载入", "다시 불러오기"],
  // a screen's code that would not load (`ui/missingFiles.ts`), offered the same Reload
  "files.missing": ["Part of the game did not load.", "部分游戏内容未能载入。", "게임 일부를 불러오지 못했습니다."],
  // the store apps' own updater: Settings → General → Update (`ui/updateField.ts`)
  "update.title": ["Update", "更新", "업데이트"],
  "update.running": ["Version {0}, installed with the app", "版本 {0}，随应用安装", "버전 {0}, 앱과 함께 설치됨"],
  "update.runningDownloaded": ["Version {0}, downloaded", "版本 {0}，已下载", "버전 {0}, 내려받음"],
  "update.check": ["Check for updates", "检查更新", "업데이트 확인"],
  "update.checking": ["Checking…", "正在检查…", "확인 중…"],
  "update.latest": ["This is the latest version.", "已是最新版本。", "최신 버전입니다."],
  "update.available": ["Version {0} is available ({1}).", "有新版本 {0}（{1}）。", "버전 {0} 업데이트가 있습니다({1})."],
  "update.download": ["Download", "下载", "다운로드"],
  "update.downloading": ["Downloading version {0}: {1}%", "正在下载版本 {0}：{1}%", "버전 {0} 다운로드 중: {1}%"],
  "update.ready": ["Version {0} is downloaded. Restart to run it.", "版本 {0} 已下载，重启后运行。", "버전 {0} 다운로드를 마쳤습니다. 다시 시작하면 실행됩니다."],
  "update.readyNextLaunch": ["Version {0} is downloaded and runs the next time the game starts.", "版本 {0} 已下载，将在下次启动游戏时运行。", "버전 {0} 다운로드를 마쳤습니다. 다음에 게임을 시작하면 실행됩니다."],
  "update.restart": ["Restart", "重启", "다시 시작"],
  "update.store": ["Version {0} needs a newer app: update it from the store.", "版本 {0} 需要新版应用，请从应用商店更新。", "버전 {0}에는 새 앱이 필요합니다. 스토어에서 업데이트하세요."],
  "update.error.network": ["Could not reach the update server.", "无法连接更新服务器。", "업데이트 서버에 연결할 수 없습니다."],
  "update.error.verify": ["The update failed its check and was not installed.", "更新未通过校验，未安装。", "업데이트가 검증을 통과하지 못해 설치하지 않았습니다."],
  "update.error.space": ["Not enough free space for the update.", "存储空间不足，无法更新。", "업데이트할 저장 공간이 부족합니다."],
  "update.error.other": ["The update could not be installed.", "无法安装更新。", "업데이트를 설치할 수 없습니다."],
  "update.failed": ["Version {0} did not start, so the game went back to the version before it.", "版本 {0} 未能启动，游戏已回到之前的版本。", "버전 {0}이(가) 시작되지 않아 이전 버전으로 돌아갔습니다."],
  "update.revert": ["Version installed with the app", "随应用安装的版本", "앱과 함께 설치된 버전"],
  "update.revertDesc": ["Go back to version {0}.", "回到版本 {0}。", "버전 {0}(으)로 돌아갑니다."],
  "update.revertAction": ["Go back", "回退", "되돌리기"],
  "update.revertConfirm": ["The game restarts on version {0}, the one installed with the app, and the downloaded version is removed.", "游戏将以随应用安装的版本 {0} 重新启动，已下载的版本会被删除。", "앱과 함께 설치된 버전 {0}(으)로 게임을 다시 시작하고, 내려받은 버전은 삭제합니다."],
  "update.required.title": ["Update required", "需要更新", "업데이트 필요"],
  "update.required.body": ["Version {0} is required to keep playing ({1}).", "需要更新到版本 {0} 才能继续游戏（{1}）。", "계속 플레이하려면 버전 {0}(으)로 업데이트해야 합니다({1})."],
  "update.required.store": ["Version {0} is required to keep playing, and it needs a newer app: update Steel Tide from the store.", "需要版本 {0} 才能继续游戏，它需要新版应用：请从应用商店更新钢铁浪潮。", "계속 플레이하려면 버전 {0}이(가) 필요하며, 새 앱이 있어야 합니다. 스토어에서 스틸 타이드를 업데이트하세요."],
  "update.required.update": ["Update", "更新", "업데이트"],
  "update.required.openStore": ["Open the store", "打开应用商店", "스토어 열기"],
  "update.required.retry": ["Try again", "重试", "다시 시도"],
  "update.required.later": ["Later", "稍后", "나중에"],
  "update.required.starting": ["Starting version {0}…", "正在启动版本 {0}…", "버전 {0} 시작 중…"],
  // a phone app older than the floor the site keeps: its wall, which only the store gets past (`ui/shellFloor.ts`)
  "retired.body": ["This version of the app can no longer be played. Update Steel Tide from the store to keep playing.", "此版本的应用已无法继续游玩。请从应用商店更新钢铁浪潮以继续游戏。", "이 버전의 앱은 더 이상 플레이할 수 없습니다. 계속 플레이하려면 스토어에서 스틸 타이드를 업데이트하세요."],
  "retired.versions": ["This app is version {0}; the oldest still supported is {1}.", "当前应用版本为 {0}，最低支持版本为 {1}。", "이 앱의 버전은 {0}이며, 지원되는 최소 버전은 {1}입니다."],
  // ------------------------------------------------------------- touch play
  "touch.deselect": ["Deselect", "取消选择", "선택 해제"],
  "touch.visibleUnits": ["Units in view", "视野内单位", "화면 안의 유닛"],
  "touch.selectType": ["Select {0} in view ({1})", "选择视野内的{0}（{1}）", "화면 안의 {0} 선택 ({1})"],
  "touch.details": ["Selection details", "选择详情", "선택 정보"],
  "touch.detailsHold": ["{0} · hold to view details", "{0} · 长按查看详情", "{0} · 길게 눌러 정보 보기"],
  "touch.groupContents": ["Group {0} contents", "编队 {0} 的成员", "부대 {0} 구성"],
  "touch.groupRecall": ["Select group {0} · {1} units", "选择编队 {0} · {1} 个单位", "부대 {0} 선택 · 유닛 {1}개"],
  "touch.groupHold": ["{0} · hold to view members", "{0} · 长按查看成员", "{0} · 길게 눌러 구성 보기"],
  "touch.shortcut": ["{0} · hold for more choices", "{0} · 长按查看更多选项", "{0} · 길게 눌러 선택 항목 더 보기"],
  "touch.aimFire": ["Aim & fire", "瞄准开火", "조준 및 사격"],
  "touch.launchLoaded": ["{0} · {1} loaded", "{0} · 已装填 {1} 枚", "{0} · {1}발 장전됨"],
  "touch.confirm": ["Place", "放置", "놓기"],
  "touch.cancel": ["Cancel", "取消", "취소"],
  "touch.rotateTitle": ["Rotate your device", "请横屏游玩", "기기를 돌려 주세요"],
  "touch.rotateBody": ["Steel Tide is played in landscape.", "钢铁浪潮需要横屏操作。", "스틸 타이드는 가로 화면으로 플레이합니다."],
  "touch.keepPortrait": ["Keep portrait", "保持竖屏", "세로 화면 유지"],
  "touch.hintPlace": ["Drag to aim, then confirm", "拖动定位，然后确认", "끌어서 위치를 잡은 뒤 확인"],
  "touch.hintPlaceMore": ["Confirm for another · ✕ to stop", "再次确认可继续建造 · ✕ 结束", "확인하면 하나 더 · ✕로 마침"],
  "touch.hintMove": ["Tap where to move", "点击移动目的地", "이동할 곳을 탭"],
  "touch.hintProtect": ["Tap an ally to protect, or hold two fingers to frame a patrol area", "点击友军进行保护，或双指按住框选巡逻区域", "아군을 탭해 보호하거나 두 손가락을 길게 눌러 순찰 영역 지정"],
  "touch.hintAttackMove": ["Tap where to attack-move", "点击攻击移动目的地", "공격 이동할 곳을 탭"],
  "touch.hintNuke": ["Tap the map to choose the nuclear target", "点击地图选择核打击目标", "지도를 탭해 핵 표적을 고르세요"],
  "touch.hintEmp": ["Tap the map to choose the EMP target", "点击地图选择电磁脉冲打击目标", "지도를 탭해 EMP 표적을 고르세요"],
  "touch.hintBomb": ["Tap the map where the bomber drops the nuclear bomb", "点击地图选择轰炸机投放核航弹的位置", "지도를 탭해 폭격기가 핵폭탄을 떨굴 곳을 고르세요"],
  // ------------------------------------------------------------- about (the settings' last page) / help
  "about.title": ["About", "关于", "정보"],
  "about.version": ["v{0} ({1})", "v{0} ({1})", "v{0} ({1})"],
  // the About page's doors (`ui/about.ts`): the website's home, its wiki and its agent page
  "about.website": ["Website", "官网", "웹사이트"],
  "about.wiki": ["Wiki", "百科", "위키"],
  "about.agent": ["AI Agent", "AI Agent", "AI 에이전트"],
  "about.rateAppStore": ["Rate on the App Store", "在 App Store 评分", "App Store에서 평가하기"],
  // the card's trailing button and the legal line under the doors, named as the website names its pages
  "about.changelog": ["Changelog", "更新日志", "변경 사항"],
  "about.privacy": ["Privacy Policy", "隐私政策", "개인정보 처리방침"],
  "about.terms": ["Terms of Service", "服务条款", "이용 약관"],
  // the credits roll (`ui/credits.ts`): the About page's way in, and the lines
  // round the list itself, which is `CREDITS` at the foot of this file
  "credits.open": ["Credits", "制作人员名单", "크레디트"],
  "credits.presents": ["A {0} Production", "{0} 出品", "{0} 제작"],
  "credits.rights": ["Steel Tide © 2026 {0}. All rights reserved.", "《钢铁浪潮》© 2026 {0}。保留所有权利。", "스틸 타이드 © 2026 {0}. 모든 권리 보유."],
  "credits.thanks": ["Thank you for playing Steel Tide", "感谢游玩《钢铁浪潮》", "스틸 타이드를 플레이해 주셔서 감사합니다"],
  "help.shiftDesc": ["Queue orders · add to selection", "排队指令 · 加选单位", "명령 대기열 · 선택에 추가"],
  // ------------------------------------------------------------- stats labels (tooltips)
  // ------------------------------------------------------------- the tech tree
  // `game/tech.ts`: a node's name and what it does, and the War Lab's card
  "tech.lightning.name": ["Lightning Doctrine", "闪电学说", "번개 교리"],
  "tech.lightning.desc": [
    "Speed is armour. Every unit moves 8% faster. Opens Smoke Dischargers, Suicide Drones and Afterburners.",
    "速度就是装甲。所有单位移动速度提高 8%。开启烟幕发射器、自杀式无人机与加力燃烧室。",
    "속도가 곧 장갑입니다. 모든 유닛이 8% 빨라집니다. 연막탄 발사기, 자폭 드론, 애프터버너가 열립니다."
  ],
  "tech.smokeDischargers.name": ["Smoke Dischargers", "烟幕发射器", "연막탄 발사기"],
  "tech.smokeDischargers.desc": ["Wolf, Viper and Gator gain Smoke Screen.", "野狼、蝰蛇与鳄鱼获得烟幕技能。", "울프, 바이퍼, 게이터가 연막 능력을 얻습니다."],
  "tech.suicideDrones.name": ["Suicide Drones", "自杀式无人机", "자폭 드론"],
  "tech.suicideDrones.desc": ["Unlocks the Hornet Suicide Drone at the Advanced Airbase.", "在高级空军基地解锁黄蜂自杀式无人机。", "고급 공군 기지에서 호넷 자폭 드론을 해금합니다."],
  "tech.afterburners.name": ["Afterburners", "加力燃烧室", "애프터버너"],
  "tech.afterburners.desc": ["Falcon, Thunderbolt and Albatross gain Afterburner. Needs a Radar Station.", "猎隼、霹雳与信天翁获得加力技能。需要雷达站。", "팔콘, 선더볼트, 알바트로스가 애프터버너 능력을 얻습니다. 레이더 기지가 필요합니다."],
  "tech.hammer.name": ["Hammer Doctrine", "重锤学说", "망치 교리"],
  "tech.hammer.desc": [
    "Firepower wins. High-explosive and rocket rounds do 10% more damage. Opens Incendiary Bombs, Ballistic Missiles and Rapid Barrage.",
    "火力决定胜负。高爆弹与火箭弹伤害提高 10%。开启燃烧弹、弹道导弹与急速弹幕。",
    "화력이 이깁니다. 고폭탄과 로켓탄의 피해가 10% 늘어납니다. 소이탄, 탄도 미사일, 속사 탄막이 열립니다."
  ],
  "tech.incendiaryBombs.name": ["Incendiary Bombs", "燃烧弹", "소이탄"],
  "tech.incendiaryBombs.desc": ["Vulture and Wraith gain Incendiary Load.", "秃鹫与幽魂获得燃烧弹挂载技能。", "벌처와 레이스가 소이탄 장전 능력을 얻습니다."],
  "tech.ballisticMissiles.name": ["Ballistic Missiles", "弹道导弹", "탄도 미사일"],
  "tech.ballisticMissiles.desc": ["Unlocks the Scorpion Ballistic Missile Launcher at the Arsenal.", "在兵工厂解锁蝎子弹道导弹发射车。", "병기창에서 스콜피온 탄도 미사일 발사차를 해금합니다."],
  "tech.rapidBarrage.name": ["Rapid Barrage", "急速弹幕", "속사 탄막"],
  "tech.rapidBarrage.desc": ["Thunder, Tempest and Sovereign gain Rapid Barrage. Needs a Radar Station.", "雷霆、暴风雨与君王获得急速弹幕技能。需要雷达站。", "선더, 템페스트, 소버린이 속사 탄막 능력을 얻습니다. 레이더 기지가 필요합니다."],
  "tech.anvil.name": ["Anvil Doctrine", "铁砧学说", "모루 교리"],
  "tech.anvil.desc": [
    "Hold the line. Your buildings take 15% less damage. Opens Active Protection, Field Recovery and Damage Control Parties.",
    "坚守阵线。你的建筑受到的伤害降低 15%。开启主动防护、战场抢修与损管分队。",
    "전선을 지킵니다. 내 건물이 받는 피해가 15% 줄어듭니다. 능동 방어, 야전 구난, 손상 통제반이 열립니다."
  ],
  "tech.activeProtection.name": ["Active Protection", "主动防护", "능동 방어"],
  "tech.activeProtection.desc": ["Bison and Mammoth gain Countermeasures + ERA.", "野牛与猛犸获得主动防护+反应装甲技能。", "바이슨과 매머드가 능동 방어+반응 장갑 능력을 얻습니다."],
  "tech.fieldRecovery.name": ["Field Recovery", "战场抢修", "야전 구난"],
  "tech.fieldRecovery.desc": ["Unlocks the Hercules Recovery Vehicle at the Advanced War Factory.", "在高级战车工厂解锁大力神装甲抢修车。", "고급 전차 공장에서 허큘리스 구난 전차를 해금합니다."],
  "tech.damageParties.name": ["Damage Control Parties", "损管分队", "손상 통제반"],
  "tech.damageParties.desc": ["Aegis and Orca gain Damage Control. Needs a Radar Station.", "神盾与虎鲸获得损管技能。需要雷达站。", "이지스와 오르카가 손상 통제 능력을 얻습니다. 레이더 기지가 필요합니다."],
  "tech.deepDrilling.name": ["Deep Drilling", "深层钻探", "심층 시추"],
  "tech.deepDrilling.desc": ["Extractors mine 15% more metal.", "采矿场的金属产量提高 15%。", "채굴장이 금속을 15% 더 캡니다."],
  "tech.gridTuning.name": ["Grid Tuning", "电网调校", "전력망 조율"],
  "tech.gridTuning.desc": ["Power plants put out 20% more.", "发电厂输出提高 20%。", "발전소 출력이 20% 늘어납니다."],
  "tech.fieldEngineering.name": ["Field Engineering", "野战工程", "야전 공병"],
  "tech.fieldEngineering.desc": ["Engineers build and repair 30% faster.", "工程车建造与维修速度提高 30%。", "공병차가 30% 빠르게 짓고 수리합니다."],
  "tech.nuclearProgram.name": ["Nuclear Program", "核计划", "핵 개발 계획"],
  "tech.nuclearProgram.desc": [
    "The last node of the tree, open to every doctrine once its own column is researched. Unlocks the Nuclear Silo and the Nuclear Warhead.",
    "科技树的最后一个节点：任何学说研究完自己的全部节点后即可研究。解锁核弹发射井与核弹头。",
    "기술 트리의 마지막 노드로, 어느 교리든 자기 노드를 모두 연구하면 열립니다. 핵 사일로와 핵탄두를 해금합니다."
  ],
  "tech.logistics": ["Logistics", "后勤", "군수"],
  "tech.doctrine": ["Doctrine", "学说", "교리"],
  "tech.none": ["No doctrine yet", "尚未选择学说", "아직 교리 없음"],
  "tech.pickNote": [
    "Choosing it closes the other two doctrines for the rest of the match.",
    "选定后，本局将无法再选择另外两种学说。",
    "선택하면 이번 경기에서 나머지 두 교리는 닫힙니다."
  ],
  "tech.needsDoctrine": ["Choose a doctrine first", "请先选择学说", "먼저 교리를 선택하세요"],
  "tech.needsColumn": ["Research the rest of your doctrine first", "请先研究完本学说的其余节点", "먼저 교리의 나머지 노드를 연구하세요"],
  "tech.unlocks": ["Unlocks: {0}", "解锁：{0}", "해금: {0}"],
  "tech.researching": ["Researching {0}", "正在研究：{0}", "연구 중: {0}"],
  "tech.researched": ["Researched", "已研究", "연구 완료"],
  // ------------------------------------------------------------- abilities
  // `game/abilities.ts`: one click, a timed effect, a cooldown
  "ability.sprint.name": ["Sprint", "冲刺", "질주"],
  "ability.sprint.desc": ["The governor off: 60% faster for 4 s.", "解除限速：4 秒内速度提高 60%。", "조속기를 풉니다: 4초 동안 60% 빨라집니다."],
  "ability.afterburner.name": ["Afterburner", "加力", "애프터버너"],
  "ability.afterburner.desc": ["80% faster for 5 s. The turns open up with the speed. Can escape missiles fired from far away.", "5 秒内速度提高 80%，转弯半径也随之变大。可甩开远处发射的导弹。", "5초 동안 80% 빨라집니다. 속도만큼 선회 반경도 커집니다. 멀리서 발사된 미사일을 따돌릴 수 있습니다."],
  "ability.smoke.name": ["Smoke Screen", "烟幕", "연막"],
  "ability.smoke.desc": [
    "Lays a cloud round the unit for 8 s. Nothing on the ground inside it can be seen from more than 2 tiles away.",
    "在单位周围释放持续 8 秒的烟幕。烟幕中的地面目标在 2 格之外无法被看见。",
    "유닛 주위에 8초간 연막을 칩니다. 연막 안의 지상 목표는 2칸 밖에서 보이지 않습니다."
  ],
  "ability.incendiary.name": ["Incendiary Load", "燃烧弹挂载", "소이탄 장전"],
  "ability.incendiary.desc": [
    "The next bomb run sets the ground alight where it lands. Stays armed for 30 s.",
    "下一轮投弹会点燃落点的地面。挂载后 30 秒内有效。",
    "다음 폭격이 떨어진 자리의 땅에 불을 붙입니다. 30초 동안 장전 상태가 유지됩니다."
  ],
  "ability.barrage.name": ["Rapid Barrage", "急速弹幕", "속사 탄막"],
  "ability.barrage.desc": ["Reloads twice as fast for 8 s.", "8 秒内装填速度翻倍。", "8초 동안 두 배로 빨리 재장전합니다."],
  "ability.countermeasures.name": ["Countermeasures + ERA", "主动防护+反应装甲", "능동 방어+반응 장갑"],
  "ability.countermeasures.desc": [
    "For 10 s the launchers shoot down the first 3 missiles or rockets fired at the hull, and the reactive armour takes 40% off every shell. Fights on the move; a green beacon flashes on the turret while it is on.",
    "10 秒内，发射器击落射向车体的前 3 枚导弹或火箭弹，反应装甲使每发炮弹的伤害降低 40%。可边走边打；生效时炮塔上闪烁绿色信标灯。",
    "10초 동안 발사기가 차체를 향해 날아오는 미사일이나 로켓을 3발까지 격추하고, 반응 장갑이 포탄 피해를 40% 줄입니다. 이동 중에도 싸우며, 작동 중에는 포탑에서 녹색 표시등이 깜박입니다."
  ],
  "ability.intercepts": ["Countermeasures: {0} of {1} left", "主动防护：剩余 {0}/{1}", "능동 방어: {1}발 중 {0}발 남음"],
  "ability.damageControl.name": ["Damage Control", "损管", "손상 통제"],
  "ability.damageControl.desc": ["Mends 30% of the hull over 10 s, paid for like a repair.", "10 秒内修复 30% 的船体，费用与维修相同。", "10초에 걸쳐 선체의 30%를 수리합니다. 비용은 수리와 같습니다."],
  "ability.emergencyRepair.name": ["Emergency Repair", "紧急抢修", "긴급 수리"],
  "ability.emergencyRepair.desc": ["Triples the repair aura for 6 s.", "6 秒内维修光环效果提高到三倍。", "6초 동안 수리 범위의 효과가 세 배가 됩니다."],
  "ability.ready": ["{0} of {1} ready", "{1} 个中 {0} 个就绪", "{1}대 중 {0}대 준비"],
  "ability.cooldown": ["Ready in {0} s", "{0} 秒后就绪", "{0}초 후 준비"],
  "ability.locked": ["Research {0} to unlock", "研究{0}后解锁", "{0} 연구 시 해금"],
  "ability.active": ["Active: {0} s", "生效中：{0} 秒", "작동 중: {0}초"],
  "stat.ability": ["Ability", "技能", "능력"],
  "stat.cost": ["Cost", "造价", "가격"],
  "stat.time": ["Build time", "建造时间", "건설 시간"],
  "stat.hp": ["HP", "耐久", "체력"],
  "stat.dps": ["DPS", "每秒伤害", "DPS"],
  "stat.blastDamage": ["Blast damage", "爆炸伤害", "폭발 피해"],
  "stat.mine": ["Arms {0}s after construction; detonates once under enemy ground vehicles. Units can drive over it.", "建成后 {0} 秒布防，敌方地面载具经过时引爆一次。单位可直接驶过。", "건설 후 {0}초에 작동하며 적 지상 차량이 지나가면 한 번 폭발합니다. 유닛은 그 위를 지나갈 수 있습니다."],
  "stat.waterMine": ["Arms {0}s after construction; detonates once on enemy ships or submarines. Hulls can pass through it.", "建成后 {0} 秒布防，敌方舰船或潜艇经过时引爆一次。舰船可直接驶过。", "건설 후 {0}초에 작동하며 적 함선이나 잠수함이 지나가면 한 번 폭발합니다. 선체는 그 위를 지나갈 수 있습니다."],
  "stat.range": ["Range", "射程", "사거리"],
  "stat.repair": ["Repair", "维修", "수리"],
  "stat.speed": ["Speed", "速度", "속도"],
  "stat.pop": ["Unit cap", "人口", "유닛 상한"],
  "stat.power": ["Power", "电力", "전력"],
  "stat.productionSlots": ["Production slots: {0} of {1} in use", "生产席位：已用 {0} / 共 {1}", "생산 슬롯: {1}개 중 {0}개 사용 중"],
  "hud.slotsFull": [
    "Production slots {0}/{1}; build another Headquarters for more",
    "生产席位 {0}/{1}，再建一座总部可增加席位",
    "생산 슬롯 {0}/{1}. 사령부를 하나 더 지으면 슬롯이 늘어납니다"
  ],
  "stat.metalRate": ["+{0} metal/s", "+{0} 金属/秒", "+{0} 금속/초"],
  "stat.strongVs": ["Strong vs", "克制", "강함"],
  "stat.weakVs": ["Weak vs", "被克制", "약함"],
  "stat.underwater": ["Submerged; only sonar reveals it", "潜航，仅声呐可发现", "잠항. 소나로만 드러납니다"],
  "stat.sonar": ["Sonar: reveals submarines and water mines", "声呐：可发现潜艇与水雷", "소나: 잠수함과 기뢰를 드러냅니다"],
  "stat.stealth": [
    "Stealth: the enemy sees it only within {0} tiles, or {1} of a Radar Station",
    "隐形：敌人仅在 {0} 格内可见，雷达站为 {1} 格",
    "스텔스: 적은 {0}칸 안에서만, 레이더 기지는 {1}칸 안에서만 봅니다"
  ],
  "stat.detect": ["Reveals concealed units and mines within {0} tiles", "可发现 {0} 格内的隐形单位与地雷", "{0}칸 안의 은폐 유닛과 지뢰를 드러냅니다"],
  "stat.jammingRange": ["Jamming radius", "干扰半径", "교란 반경"],
  "stat.jamming": [
    "Jams enemy radar, drone feeds and global surveillance within {0} tiles. Requires full power. Direct observation and sonar still work. Transmitting reveals its location.",
    "阻断 {0} 格内敌方雷达、无人机画面与全图监视。需要充足电力。直接观测与声呐仍然有效。发射时会暴露自身位置。",
    "{0}칸 안의 적 레이더, 드론 영상, 전역 감시를 교란합니다. 충분한 전력이 필요합니다. 직접 관측과 소나는 유지됩니다. 송신 중에는 위치가 드러납니다."
  ],
  "stat.jammingActive": ["Transmitting", "正在发射", "송신 중"],
  "stat.jammingOffline": ["Jammer offline", "干扰器离线", "교란기 정지"],
  "stat.remoteVision": ["Remote camera feed: blocked inside hostile jamming fields", "远程影像：敌方干扰区内的画面会被阻断", "원격 영상: 적 교란 구역 안에서는 차단됩니다"],
  "stat.friendlyFire": ["Friendly fire: the blast harms your own units too", "误伤：爆炸同样会伤及己方单位", "아군 오사: 폭발이 아군 유닛도 해칩니다"],
  "stat.armor.light": ["Light", "轻甲", "경장갑"],
  "stat.armor.medium": ["Medium", "中甲", "중형 장갑"],
  "stat.armor.heavy": ["Heavy", "重甲", "중장갑"],
  "stat.armor.ship": ["Ship", "舰船", "함선"],
  "stat.armor.sub": ["Submarine", "潜艇", "잠수함"],
  "stat.armor.air": ["Aircraft", "飞行器", "항공기"],
  "stat.armor.structure": ["Structure", "建筑", "건물"],
  "stat.directionalArmor": ["Directional armor", "方向装甲", "방향별 장갑"],
  "stat.armorFacing.front": ["Front", "正面", "정면"],
  "stat.armorFacing.side": ["Sides", "侧面", "측면"],
  "stat.armorFacing.rear": ["Rear", "背面", "후면"],
  "stat.directionalArmor.value": ["Front {0}% · Sides {1}% · Rear {2}%", "正面 {0}% · 侧面 {1}% · 背面 {2}%", "정면 {0}% · 측면 {1}% · 후면 {2}%"],
  "stat.directionalArmor.tip": [
    "Direct-hit damage: front {0}%, sides {1}%, rear {2}%. Each arc is 90°. Artillery, collateral blasts, mines and fire ignore facing. Moves up to {3} tiles behind the hull reverse at {4}% speed.",
    "直击伤害：正面 {0}%，侧面 {1}%，背面 {2}%。各方向扇区为 90°。炮击、溅射、地雷与火焰不计朝向。向车后 {3} 格内移动时，会以 {4}% 速度倒车。",
    "직격 피해: 정면 {0}%, 측면 {1}%, 후면 {2}%. 각 방향의 각도는 90°입니다. 곡사 포격, 주변 폭발, 지뢰, 화염은 방향의 영향을 받지 않습니다. 차체 뒤쪽 {3}칸 이내로 이동할 때는 {4}% 속도로 후진합니다."
  ],
  // ------------------------------------------------------------- teams
  "team.blue": ["Blue", "蓝方", "파랑"],
  "team.red": ["Red", "红方", "빨강"],
  "team.green": ["Green", "绿方", "초록"],
  "team.purple": ["Purple", "紫方", "보라"],
  "team.orange": ["Orange", "橙方", "주황"],
  "team.cyan": ["Cyan", "青方", "청록"],
  "team.yellow": ["Yellow", "黄方", "노랑"],
  "team.white": ["White", "白方", "하양"],
  // a team's callsign (`game/teams.ts`): the phonetic alphabet in English,
  // animals in Chinese, the alphabet transliterated in Korean
  "team.alpha": ["Alpha", "战狼", "알파"],
  "team.bravo": ["Bravo", "鲨鱼", "브라보"],
  "team.charlie": ["Charlie", "猛虎", "찰리"],
  "team.delta": ["Delta", "雄鹰", "델타"],
  "team.echo": ["Echo", "猎豹", "에코"],
  "team.foxtrot": ["Foxtrot", "毒蛇", "폭스트롯"],
  "team.golf": ["Golf", "黑熊", "골프"],
  "team.hotel": ["Hotel", "蛟龙", "호텔"],
  // breakthrough: a seat's team is a side
  "team.attackers": ["Attackers", "进攻方", "공격측"],
  "team.defenders": ["Defenders", "防守方", "수비측"],
  // ------------------------------------------------------------- admin console
  "console.title": ["Console", "控制台", "콘솔"],
  "console.placeholder": ["type help for the commands", "输入 help 查看命令", "help를 입력하면 명령 목록"],
  "console.hostOnly": ["Only the host can run commands.", "只有房主可以执行命令。", "호스트만 명령을 실행할 수 있습니다."],
  "console.noKick": ["There is nobody to remove in a local game.", "本地对局中没有可移出的玩家。", "로컬 게임에는 내보낼 사람이 없습니다."],
  "console.serverOnly": ["That is a server command: it runs on a multiplayer server, as its host.", "这是服务器命令：需要以房主身份在多人服务器上运行。", "서버 명령입니다: 멀티플레이어 서버에서 호스트로 실행하세요."],
  "console.speedSet": ["Game speed ×{0}", "游戏速度 ×{0}", "게임 속도 ×{0}"],
  "console.campaignSpeed": ["Campaign speed is fixed at ×1.", "战役速度固定为 ×1。", "캠페인 속도는 ×1로 고정됩니다."],
  "console.noControl": ["The server decides which faction you command.", "你操作哪个阵营由服务器决定。", "어느 진영을 지휘할지는 서버가 정합니다."],
  "console.commanding": ["Now commanding {0}.", "现在操作{0}。", "이제 {0}을(를) 지휘합니다."],
  "console.handedOver": [
    'An AI is driving your faction now. Watch, or take it back with "play {0}".',
    'AI 正在指挥你的阵营。你可以旁观，或用 "play {0}" 收回指挥权。',
    'AI가 당신의 진영을 몰고 있습니다. 지켜보거나 "play {0}"으로 되찾으세요.'
  ],
  // Short names keep the kill feed compact; full names remain on cards and tooltips.
  // ------------------------------------------------------------- units: land
  "unit.engineer.name": ["Engineer", "工程车", "공병차"],
  "unit.engineer.shortName": ["Engineer", "工程车", "공병차"],
  "unit.engineer.desc": ["Constructs and repairs buildings. The backbone of any base.", "建造并维修建筑，基地运转的基石。", "건물을 짓고 수리합니다. 모든 기지의 중추입니다."],
  "unit.buggy.name": ["Recon Buggy", "侦察车", "정찰 버기"],
  "unit.buggy.shortName": ["Buggy", "侦察车", "버기"],
  "unit.buggy.desc": ["Fast scout with a light machine gun. Great eyes, thin skin.", "装备轻机枪的高速侦察车。眼观六路，皮薄馅大。", "경기관총을 단 빠른 정찰차. 눈은 좋고 살갗은 얇습니다."],
  "unit.ltank.name": ["Wolf Light Tank", "野狼轻型坦克", "울프 경전차"],
  "unit.ltank.shortName": ["Wolf", "野狼", "울프"],
  "unit.ltank.desc": ["Cheap autocannon tank. Shreds light vehicles.", "廉价机炮坦克，专撕轻型载具。", "값싼 기관포 전차. 경차량을 찢어 놓습니다."],
  "unit.mbt.name": ["Bison Battle Tank", "野牛主战坦克", "바이슨 주력 전차"],
  "unit.mbt.shortName": ["Bison", "野牛", "바이슨"],
  "unit.mbt.desc": ["Reliable main battle tank. The core of any armored push.", "可靠的主战坦克，装甲推进的中坚。", "믿을 만한 주력 전차. 모든 장갑 돌격의 핵심입니다."],
  "unit.htank.name": ["Mammoth Heavy Tank", "猛犸重型坦克", "매머드 중전차"],
  "unit.htank.shortName": ["Mammoth", "猛犸", "매머드"],
  "unit.htank.desc": [
    "Twin cannons, massive armor. Slow, but it arrives like a verdict.",
    "双联主炮、超厚装甲。行如判决，缓慢而不可阻挡。",
    "쌍포와 육중한 장갑. 느리지만, 판결처럼 도착합니다."
  ],
  "unit.td.name": ["Viper Tank Destroyer", "蝰蛇反坦克车", "바이퍼 구축전차"],
  "unit.td.shortName": ["Viper", "蝰蛇", "바이퍼"],
  "unit.td.desc": [
    "Long-range guided anti-tank missiles. Melts heavy armor, hates being rushed.",
    "远程反坦克导弹，融化重甲，惧怕近身。",
    "장거리 유도 대전차 미사일. 중장갑을 녹이지만 달려드는 건 질색합니다."
  ],
  "unit.flak.name": ["Flak Track", "防空炮车", "대공 장갑차"],
  "unit.flak.shortName": ["Flak Track", "防空炮车", "대공 장갑차"],
  "unit.flak.desc": ["Mobile flak cannon. Its guns look to the sky first and the ground after.", "机动高射炮，炮口先指天空，再指地面。", "기동 대공포. 포구는 먼저 하늘을, 그다음 땅을 겨눕니다."],
  "unit.sam.name": ["Hawk SAM Launcher", "猎鹰防空导弹车", "호크 대공 미사일 차량"],
  "unit.sam.shortName": ["Hawk", "猎鹰", "호크"],
  "unit.sam.desc": ["Long-range surface-to-air missiles. Owns the sky above your army.", "远程防空导弹，掌控大军头顶的天空。", "장거리 지대공 미사일. 아군 머리 위 하늘을 장악합니다."],
  "unit.arty.name": ["Thunder Howitzer", "雷霆榴弹炮", "선더 곡사포"],
  "unit.arty.shortName": ["Thunder", "雷霆", "선더"],
  "unit.arty.desc": [
    "Long-range artillery. Cracks turtled defenses from beyond retaliation.",
    "远程榴弹炮，在敌方还击范围之外敲开乌龟壳。",
    "장거리 포병. 보복이 닿지 않는 곳에서 웅크린 방어를 깨뜨립니다."
  ],
  "unit.mlrs.name": ["Tempest MLRS", "暴风雨火箭炮", "템페스트 다연장 로켓포"],
  "unit.mlrs.shortName": ["Tempest", "暴风雨", "템페스트"],
  "unit.mlrs.desc": [
    "Eight-rocket saturation barrage. Erases fortified positions and clumped armies.",
    "八联饱和火箭覆盖，抹平堡垒与扎堆的军队。",
    "로켓 여덟 발의 포화 사격. 요새화된 진지와 뭉친 군대를 지워 버립니다."
  ],
  "unit.radarcar.name": ["Owl Radar Car", "夜枭雷达车", "아울 레이더 차량"],
  "unit.radarcar.shortName": ["Owl", "夜枭", "아울"],
  "unit.radarcar.desc": [
    "A radar on wheels: sees far by radio, through night and rain, and finds what hides. Unarmed, thin and slow.",
    "车载雷达：靠无线电看得很远，无惧黑夜与雨雪，还能揪出隐形的东西。无武装、装甲薄、速度慢。",
    "바퀴 달린 레이더: 밤과 비를 뚫고 전파로 멀리 보고, 숨은 것을 찾아냅니다. 비무장에 얇고 느립니다."
  ],
  "unit.salamander.name": ["Salamander Thermobaric Mortar", "火蜥蜴温压炮车", "샐러맨더 열압력 박격포"],
  "unit.salamander.shortName": ["Salamander", "火蜥蜴", "샐러맨더"],
  "unit.salamander.desc": [
    "Lobs thermobaric shells: a wide blast that point defence cannot stop, and that burns your own units too.",
    "投掷温压弹：大范围的爆炸无法被拦截塔阻挡，但也会烧伤己方单位。",
    "열압력탄을 던집니다. 넓은 폭발은 요격 방어로 막을 수 없고, 아군 유닛도 태웁니다."
  ],
  "unit.bulwark.name": ["Bulwark Mobile Interrupter", "壁垒机动拦截车", "불워크 기동 요격차"],
  "unit.bulwark.shortName": ["Bulwark", "壁垒", "불워크"],
  "unit.bulwark.desc": [
    "Point defence on tracks: shoots down rockets and guided missiles over the column it rides with. No gun of its own.",
    "履带式点防御：为同行的纵队击落来袭的火箭弹与制导导弹。自身没有武器。",
    "궤도 위의 요격 방어: 함께 움직이는 종대 위로 날아드는 로켓과 유도 미사일을 격추합니다. 자체 무기는 없습니다."
  ],
  "unit.drake.name": ["Drake Flame Tank", "火龙喷火坦克", "드레이크 화염 전차"],
  "unit.drake.shortName": ["Drake", "火龙", "드레이크"],
  "unit.drake.desc": [
    "Pours fire in bursts, and the ground it washes over keeps burning under friend and foe alike. Paper-thin and short-armed: it is meant to be spent.",
    "一阵阵喷射火焰，被它浇过的地面会持续燃烧，敌我不分。装甲薄如纸、射程短：它本来就是消耗品。",
    "불을 한바탕씩 쏟아붓고, 불이 휩쓴 땅은 피아를 가리지 않고 계속 탑니다. 종잇장 장갑에 짧은 팔: 소모품으로 만들어졌습니다."
  ],
  // ------------------------------------------------------------- units: amphibious
  "unit.gator.name": ["Gator Amphibious Combat Vehicle", "鳄鱼两栖战车", "게이터 상륙 전투차"],
  "unit.gator.shortName": ["Gator", "鳄鱼", "게이터"],
  "unit.gator.desc": ["An armoured car that swims, and lands itself.", "会游泳的装甲车，能自行登陆。", "헤엄치는 장갑차. 스스로 상륙합니다."],
  // ------------------------------------------------------------- units: the doctrines' own
  "unit.hornet.name": ["Hornet Suicide Drone", "黄蜂自杀式无人机", "호넷 자폭 드론"],
  "unit.hornet.shortName": ["Hornet", "黄蜂", "호넷"],
  "unit.hornet.desc": [
    "A quadcopter with an anti-tank charge under it: sent at a target, it flies there and explodes.",
    "挂着反坦克战斗部的四旋翼无人机：派它攻击目标，它就飞过去引爆。",
    "대전차 탄두를 매단 쿼드콥터: 표적으로 보내면 날아가 폭발합니다."
  ],
  "unit.hercules.name": ["Hercules Recovery Vehicle", "大力神装甲抢修车", "허큘리스 구난 전차"],
  "unit.hercules.shortName": ["Hercules", "大力神", "허큘리스"],
  "unit.hercules.desc": ["An armoured recovery tank that mends the vehicles and ships around it. No gun.", "装甲抢修车，维修周围的车辆与舰船。没有武器。", "주위의 차량과 함선을 수리하는 장갑 구난 전차. 무기는 없습니다."],
  "unit.scorpion.name": ["Scorpion Ballistic Missile Launcher", "蝎子弹道导弹发射车", "스콜피온 탄도 미사일 발사차"],
  "unit.scorpion.shortName": ["Scorpion", "蝎子", "스콜피온"],
  "unit.scorpion.desc": ["Heavy ballistic missiles, thrown far beyond its own sight.", "重型弹道导弹，射程远超自身视野。", "자기 시야 훨씬 너머로 던지는 무거운 탄도 미사일."],
  // ------------------------------------------------------------- units: sea
  "unit.gunboat.name": ["Gunboat", "炮艇", "포함"],
  "unit.gunboat.shortName": ["Gunboat", "炮艇", "포함"],
  "unit.gunboat.desc": ["Fast patrol boat with an autocannon that also fires at aircraft. Cheap naval eyes.", "装备机炮的高速巡逻艇，也能对空射击，海上的廉价耳目。", "대공 사격도 되는 기관포를 단 빠른 초계정. 값싼 바다의 눈입니다."],
  "unit.mboat.name": ["Missile Boat", "导弹艇", "미사일정"],
  "unit.mboat.shortName": ["Missile Boat", "导弹艇", "미사일정"],
  "unit.mboat.desc": ["Anti-ship missiles on a small hull. Punches far above its weight.", "小艇扛重锤，反舰导弹一击致命。", "작은 선체에 대함 미사일. 체급을 훌쩍 넘는 한 방입니다."],
  "unit.frigate.name": ["Aegis Frigate", "神盾护卫舰", "이지스 호위함"],
  "unit.frigate.shortName": ["Aegis", "神盾", "이지스"],
  "unit.frigate.desc": ["Fleet escort with anti-aircraft missiles, sonar, anti-submarine torpedoes and a light deck gun.", "舰队护航舰，配备防空导弹、声呐、反潜鱼雷和轻型舰炮。", "대공 미사일, 소나, 대잠 어뢰와 경함포를 갖춘 함대 호위함입니다."],
  "unit.destroyer.name": ["Orca Destroyer", "虎鲸驱逐舰", "오르카 구축함"],
  "unit.destroyer.shortName": ["Orca", "虎鲸", "오르카"],
  "unit.carrier.name": ["Aircraft Carrier", "航空母舰", "항공모함"],
  "unit.carrier.shortName": ["Carrier", "航母", "항모"],
  "unit.carrier.desc": ["A floating flight deck that rearms embarked aircraft, with a light naval gun and short-range anti-aircraft missiles.", "为登舰飞机补充弹药的海上飞行甲板，配备轻型舰炮和近程防空导弹。", "착함한 항공기에 탄약을 보급하는 해상의 비행 갑판. 경함포와 단거리 대공 미사일을 갖추고 있습니다."],
  "unit.destroyer.desc": ["Dual-purpose naval gun, sonar and anti-submarine torpedoes: the submarine hunter.", "高平两用舰炮、声呐加反潜鱼雷：潜艇猎手。", "양용 함포와 소나, 그리고 대잠 어뢰. 잠수함 사냥꾼입니다."],
  "unit.sub.name": ["Barracuda Submarine", "梭鱼潜艇", "바라쿠다 잠수함"],
  "unit.sub.shortName": ["Barracuda", "梭鱼", "바라쿠다"],
  "unit.sub.desc": [
    "Submerged torpedo ambusher, invisible except to sonar.",
    "潜航鱼雷伏击者，除声呐外无人可见。",
    "잠항 어뢰 매복자. 소나 말고는 볼 수 없습니다."
  ],
  "unit.btlship.name": ["Sovereign Battleship", "君王战列舰", "소버린 전함"],
  "unit.btlship.shortName": ["Sovereign", "君王", "소버린"],
  "unit.btlship.desc": ["Triple heavy guns bombard land and sea from extreme range; secondaries keep helicopters off.", "三联重炮超远程轰击海陆目标，防空副炮驱离直升机。", "3연장 중포가 극한의 사거리에서 육지와 바다를 포격하고, 대공 부포가 헬기를 쫓아냅니다."],
  "unit.seatrans.name": ["Landing Craft", "登陆艇", "상륙정"],
  "unit.seatrans.shortName": ["Landing Craft", "登陆艇", "상륙정"],
  "unit.seatrans.desc": ["An air-cushion landing craft with a broad open vehicle deck.", "配有宽阔开放式车辆甲板的气垫登陆艇。", "넓은 개방형 차량 갑판을 갖춘 공기부양 상륙정."],
  "unit.engboat.name": ["Engineer Boat", "工程船", "공병정"],
  "unit.engboat.shortName": ["Engineer Boat", "工程船", "공병정"],
  "unit.engboat.desc": [
    "Builds and repairs from the water, anything within reach of the shore. No gun.",
    "从水上建造与维修岸边触手可及的一切。没有武器。",
    "물 위에서 해안 가까이의 무엇이든 짓고 수리합니다. 무기는 없습니다."
  ],
  "unit.kraken.name": ["Kraken Cruise-Missile Submarine", "海妖巡航导弹潜艇", "크라켄 순항 미사일 잠수함"],
  "unit.kraken.shortName": ["Kraken", "海妖", "크라켄"],
  "unit.kraken.desc": [
    "Fires cruise missiles at the land from under the water, far beyond its own sight. Nothing for ships. It can arm a nuclear warhead of its own.",
    "从水下向陆地发射巡航导弹，射程远超自身视野。无法攻击舰船。可自行装备一枚核弹头。",
    "물속에서 지상으로 순항 미사일을 쏩니다. 자기 시야보다 훨씬 멀리요. 함선은 노릴 수 없습니다. 핵탄두 하나를 직접 갖출 수 있습니다."
  ],
  "unit.moray.name": ["Moray Infiltration Submarine", "海鳗渗透潜艇", "모레이 침투 잠수함"],
  "unit.moray.shortName": ["Moray", "海鳗", "모레이"],
  "unit.moray.desc": ["A submerged transport: unarmed, and hidden under the water.", "潜航运输艇：无武装，藏身水下。", "잠항 수송함: 비무장이고, 물속에 숨어 있습니다."],
  // ------------------------------------------------------------- units: air
  "unit.drone.name": ["Scout Drone", "侦察无人机", "정찰 드론"],
  "unit.drone.shortName": ["Scout Drone", "侦察无人机", "정찰 드론"],
  "unit.drone.desc": ["Unarmed, expendable, sees everything.", "无武装、可消耗，但看得见一切。", "비무장, 소모품, 모든 것을 봅니다."],
  "unit.fighter.name": ["Falcon Fighter", "猎隼战斗机", "팔콘 전투기"],
  "unit.fighter.shortName": ["Falcon", "猎隼", "팔콘"],
  "unit.fighter.desc": ["Air-superiority fighter. Only targets aircraft, and deletes them.", "制空战斗机，只打飞机，且一打一个准。", "제공 전투기. 항공기만 노리고, 지워 버립니다."],
  "unit.heli.name": ["Cobra Attack Helicopter", "眼镜蛇武装直升机", "코브라 공격 헬기"],
  "unit.heli.shortName": ["Cobra", "眼镜蛇", "코브라"],
  "unit.heli.desc": ["Hovering anti-tank missile platform. Terror of slow armor.", "悬停反坦克导弹平台，重甲的噩梦。", "제자리 비행하는 대전차 미사일 발사대. 느린 장갑의 공포입니다."],
  "unit.jet.name": ["Thunderbolt Strike Jet", "霹雳攻击机", "선더볼트 공격기"],
  "unit.jet.shortName": ["Thunderbolt", "霹雳", "선더볼트"],
  "unit.jet.desc": ["Rocket strafing runs against vehicles and light targets.", "火箭弹俯冲扫射，专欺负地面载具。", "차량과 경표적을 향한 로켓 기총 소사입니다."],
  "unit.mjet.name": ["Albatross Naval Striker", "信天翁反舰攻击机", "알바트로스 대함 공격기"],
  "unit.mjet.shortName": ["Albatross", "信天翁", "알바트로스"],
  "unit.mjet.desc": ["Sea-skimming anti-ship missiles. Warships fear the horizon.", "掠海反舰导弹，让军舰恐惧地平线。", "해면을 스치는 대함 미사일. 군함이 수평선을 두려워하게 됩니다."],
  "unit.bomber.name": ["Vulture Bomber", "秃鹫轰炸机", "벌처 폭격기"],
  "unit.bomber.shortName": ["Vulture", "秃鹫", "벌처"],
  "unit.bomber.desc": ["Carpet bombs that level buildings and dug-in positions.", "地毯式轰炸，夷平建筑与坚固阵地。", "건물과 파고든 진지를 평평하게 만드는 융단 폭격입니다."],
  "unit.theli.name": ["Pelican Transport Helicopter", "鹈鹕运输直升机", "펠리컨 수송 헬기"],
  "unit.theli.shortName": ["Pelican", "鹈鹕", "펠리컨"],
  "unit.theli.desc": ["Airlifts a light load anywhere.", "轻载空运，全图直达。", "가벼운 짐을 어디든 공수합니다."],
  "unit.c47.name": ["Condor Cargo Plane", "神鹰运输机", "콘도르 수송기"],
  "unit.c47.shortName": ["Condor", "神鹰", "콘도르"],
  "unit.c47.desc": [
    "Four-engine jet transport with a broad cargo fuselage and high tail.",
    "宽大货舱、高置尾翼的四发喷气运输机。",
    "넓은 화물 동체와 높은 꼬리날개를 갖춘 4발 제트 수송기입니다."
  ],
  "unit.gunship.name": ["Spectre Gunship", "幽灵炮艇机", "스펙터 건십"],
  "unit.gunship.shortName": ["Spectre", "幽灵", "스펙터"],
  "unit.gunship.desc": ["Circling heavy gunship raining sustained cannon fire.", "盘旋重型炮艇机，倾泻持续炮火。", "선회하며 기관포 사격을 끊임없이 퍼붓는 대형 건십입니다."],
  "unit.wraith.name": ["Wraith Stealth Bomber", "幽魂隐形轰炸机", "레이스 스텔스 폭격기"],
  "unit.wraith.shortName": ["Wraith", "幽魂", "레이스"],
  "unit.wraith.desc": [
    "Two heavy bombs on a hull no radar sees until it is nearly overhead. It can carry a nuclear bomb.",
    "两枚重型炸弹，机身在逼近头顶之前不会出现在任何雷达上。可携带一枚核航弹。",
    "중폭탄 두 발. 거의 머리 위에 올 때까지 어떤 레이더에도 잡히지 않는 기체입니다. 핵폭탄 한 발을 실을 수 있습니다."
  ],
  "unit.cormorant.name": ["Cormorant ASW Helicopter", "鸬鹚反潜直升机", "코모란트 대잠 헬기"],
  "unit.cormorant.shortName": ["Cormorant", "鸬鹚", "코모란트"],
  "unit.cormorant.desc": [
    "Dipping sonar and homing torpedoes: the aircraft that hunts submarines.",
    "吊放声呐加自导鱼雷，专门猎杀潜艇的飞行器。",
    "디핑 소나와 유도 어뢰: 잠수함을 사냥하는 항공기입니다."
  ],
  // ------------------------------------------------------------- buildings
  "unit.hq2.name": ["Headquarters Lv.2", "二级总部", "사령부 2단계"],
  "unit.hq2.shortName": ["HQ Lv.2", "二级总部", "사령부 2단계"],
  "unit.hq2.desc": ["Fortified theater command center with a satellite communications tower.", "设有卫星通信塔的强化战区指挥中枢。", "위성 통신탑을 갖춘 요새화된 전구 지휘소."],
  "stat.hq2Requires": ["A Radar Station and a completed Lv.3 factory, airbase or naval yard", "雷达站和已建成的三级战车工厂、空军基地或造船厂", "레이더 기지, 완공된 3단계 전차 공장·공군 기지·조선소 중 하나"],
  "stat.hq2Benefits": [
    "While this HQ stands: full-map team vision; your units gain +75% damage and +15% movement speed; new production lines can be built at Lv.3 for the full price. Does not stack. Warheads are excluded; stealth, smoke and sonar rules still apply.",
    "此总部存续期间：全队获得全图视野；己方单位伤害 +75%、移动速度 +15%；新生产线可按全价直接建造为三级。效果不叠加，不影响弹头；隐身、烟幕和声呐规则仍然有效。",
    "이 사령부가 있는 동안: 팀 전체 지도 시야, 내 유닛 피해량 +75% 및 이동 속도 +15%, 새 생산 라인을 전체 비용으로 3단계부터 건설. 중첩되지 않으며 탄두는 제외됩니다. 은신·연막·소나 규칙은 유지됩니다."
  ],
  "stat.hq2DirectBuild": ["Upgrade an existing line, or build Lv.3 directly at full price while your Lv.2 HQ stands.", "升级现有生产线，或在己方二级总部存续期间按全价直接建造三级生产线。", "기존 생산 라인을 업그레이드하거나, 내 2단계 사령부가 있는 동안 전체 비용으로 3단계부터 건설할 수 있습니다."],
  "alert.hq2Started": ["{0} is upgrading to Headquarters Lv.2.", "{0} 正在升级二级总部。", "{0}: 사령부 2단계 업그레이드를 시작했습니다."],
  "alert.hq2Ready": ["{0} has completed Headquarters Lv.2. Their army is empowered.", "{0} 的二级总部已建成，部队已获得强化。", "{0}: 사령부 2단계가 완공되어 병력이 강화되었습니다."],
  "unit.hq.name": ["Headquarters", "总部", "사령부"],
  "unit.hq.shortName": ["HQ", "总部", "사령부"],
  "unit.hq.desc": [
    "Command center. Produces engineers and supports production lines: factories, airbases or naval yards, in any mix.",
    "指挥中枢。生产工程车，并支持战车工厂、空军基地或造船厂的生产线，任意搭配。",
    "지휘 중추. 공병차를 생산하고 전차 공장, 공군 기지, 조선소의 생산 라인을 지원합니다. 어떻게 섞어도 됩니다."
  ],
  "unit.extractor.name": ["Metal Extractor", "采矿场", "금속 채굴장"],
  "unit.extractor.shortName": ["Extractor", "采矿场", "채굴장"],
  "unit.extractor.desc": ["Mines metal from a deposit. Your economy lives here.", "在矿脉上开采金属，经济命脉所在。", "광맥에서 금속을 캡니다. 경제가 여기서 삽니다."],
  "unit.extractor2.name": ["Advanced Extractor", "高级采矿场", "고급 채굴장"],
  "unit.extractor2.shortName": ["Advanced Extractor", "高级采矿场", "고급 채굴장"],
  "unit.extractor2.desc": ["Twin drills double the yield of the same deposit.", "双钻头并进，同一矿脉双倍产出。", "쌍 드릴이 같은 광맥의 산출을 두 배로 늘립니다."],
  "unit.extractor3.name": ["Deep-Core Extractor", "深层采矿场", "심층 채굴장"],
  "unit.extractor3.shortName": ["Deep-Core Extractor", "深层采矿场", "심층 채굴장"],
  "unit.extractor3.desc": ["A deep-core bore yields far more metal from the same deposit.", "深层钻机从同一矿脉中开采出远超以往的金属。", "심층 시추가 같은 광맥에서 훨씬 많은 금속을 냅니다."],
  "unit.platform.name": ["Offshore Rig", "海上钻井平台", "해상 시추 플랫폼"],
  "unit.platform.shortName": ["Rig", "钻井平台", "시추 플랫폼"],
  "unit.platform.desc": ["Mines metal from a deposit at sea, on its own legs in the water.", "立于水中的桩腿之上，开采海上矿脉中的金属。", "물속에 세운 다리 위에서 해상 광맥의 금속을 캡니다."],
  "unit.platform2.name": ["Advanced Offshore Rig", "高级钻井平台", "고급 시추 플랫폼"],
  "unit.platform2.shortName": ["Advanced Rig", "高级钻井平台", "고급 시추 플랫폼"],
  "unit.platform2.desc": ["Twin derricks double the yield of the same field at sea.", "双井架并进，同一海上矿脉双倍产出。", "쌍 데릭이 같은 해상 광맥의 산출을 두 배로 늘립니다."],
  "unit.platform3.name": ["Deepwater Rig", "深水钻井平台", "심해 시추 플랫폼"],
  "unit.platform3.shortName": ["Deepwater Rig", "深水钻井平台", "심해 시추 플랫폼"],
  "unit.platform3.desc": ["A deepwater drilling complex yields far more metal from the same field at sea.", "深水钻探综合平台从同一海上矿脉中开采出远超以往的金属。", "심해 시추 단지가 같은 해상 광맥에서 훨씬 많은 금속을 냅니다."],
  "unit.power.name": ["Power Plant", "发电厂", "발전소"],
  "unit.power.shortName": ["Power Plant", "发电厂", "발전소"],
  "unit.power.desc": ["Generates power. Low power slows production and defenses.", "产生电力。电力不足会拖慢生产与防御。", "전력을 만듭니다. 전력이 부족하면 생산과 방어가 느려집니다."],
  "unit.power2.name": ["Advanced Power Plant", "高级发电厂", "고급 발전소"],
  "unit.power2.shortName": ["Advanced Plant", "高级发电厂", "고급 발전소"],
  "unit.power2.desc": ["Two and a half times the output from the same footprint.", "同样占地，两倍半出力。", "같은 자리에서 두 배 반의 출력."],
  "unit.power3.name": ["Singularity Power Plant", "奇点发电厂", "특이점 발전소"],
  "unit.power3.shortName": ["Singularity Plant", "奇点发电厂", "특이점 발전소"],
  "unit.power3.desc": ["A contained core triples the Advanced Plant's output.", "受控核心的出力是高级发电厂的三倍。", "봉인된 코어가 고급 발전소 출력의 세 배를 냅니다."],
  "unit.factory.name": ["War Factory", "战车工厂", "전차 공장"],
  "unit.factory.shortName": ["Factory", "战车工厂", "전차 공장"],
  "unit.factory.desc": ["Produces engineers and ground vehicles.", "生产工程车与地面载具。", "공병차와 지상 차량을 생산합니다."],
  "unit.factory2.name": ["Advanced War Factory", "高级战车工厂", "고급 전차 공장"],
  "unit.factory2.shortName": ["Advanced Factory", "高级战车工厂", "고급 전차 공장"],
  "unit.factory2.desc": ["Unlocks advanced ground vehicles.", "解锁高级地面载具。", "고급 지상 차량을 해금합니다."],
  "unit.factory3.name": ["Arsenal", "兵工厂", "병기창"],
  "unit.factory3.shortName": ["Arsenal", "兵工厂", "병기창"],
  "unit.factory3.desc": [
    "The Level-3 war factory: adds the Tempest, the Salamander and the Bulwark.",
    "三级战车工厂：新增暴风雨火箭炮、火蜥蜴与壁垒。",
    "3단계 전차 공장: 템페스트, 샐러맨더, 불워크가 추가됩니다."
  ],
  "unit.airbase.name": ["Airbase", "空军基地", "공군 기지"],
  "unit.airbase.shortName": ["Airbase", "空军基地", "공군 기지"],
  "unit.airbase.desc": ["Produces aircraft.", "生产飞行器。", "항공기를 생산합니다."],
  "unit.airbase2.name": ["Advanced Airbase", "高级空军基地", "고급 공군 기지"],
  "unit.airbase2.shortName": ["Advanced Airbase", "高级空军基地", "고급 공군 기지"],
  "unit.airbase2.desc": ["Unlocks advanced aircraft.", "解锁高级飞行器。", "고급 항공기를 해금합니다."],
  "unit.airbase3.name": ["Strategic Airbase", "战略空军基地", "전략 공군 기지"],
  "unit.airbase3.shortName": ["Strategic Airbase", "战略空军基地", "전략 공군 기지"],
  "unit.airbase3.desc": ["The Level-3 airbase: adds the Wraith and the Cormorant.", "三级空军基地：新增幽魂与鸬鹚。", "3단계 공군 기지: 레이스와 코모란트가 추가됩니다."],
  "unit.navyard.name": ["Naval Yard", "造船厂", "조선소"],
  "unit.navyard.shortName": ["Naval Yard", "造船厂", "조선소"],
  "unit.navyard.desc": ["Builds warships from the shoreline.", "在海岸线上建造舰船。", "해안선에서 군함을 건조합니다."],
  "unit.navyard2.name": ["Advanced Naval Yard", "高级造船厂", "고급 조선소"],
  "unit.navyard2.shortName": ["Advanced Yard", "高级造船厂", "고급 조선소"],
  "unit.navyard2.desc": ["Unlocks advanced warships.", "解锁高级舰船。", "고급 군함을 해금합니다."],
  "unit.navyard3.name": ["Deepwater Yard", "深水船坞", "심해 조선소"],
  "unit.navyard3.shortName": ["Deepwater Yard", "深水船坞", "심해 조선소"],
  "unit.navyard3.desc": ["Deepwater quays for battleships, aircraft carriers and specialist submarines.", "为战列舰、航空母舰与特种潜艇服务的深水码头。", "전함, 항공모함과 특수 잠수함을 위한 심해 부두입니다."],
  "unit.mgturret.name": ["MG Turret", "机枪塔", "기관총 포탑"],
  "unit.mgturret.shortName": ["MG Turret", "机枪塔", "기관총 포탑"],
  "unit.mgturret.desc": ["Rapid-fire defense against light vehicles and aircraft.", "速射防御塔，克制轻型载具与飞行器。", "경차량과 항공기를 상대하는 속사 방어입니다."],
  "unit.gatling.name": ["Gatling Turret", "加特林炮塔", "개틀링 포탑"],
  "unit.gatling.shortName": ["Gatling", "加特林", "개틀링"],
  "unit.gatling.desc": ["A wall of lead. Triple the firepower.", "弹幕如墙，三倍火力。", "납의 벽. 화력 세 배."],
  "unit.cannonturret.name": ["Cannon Turret", "加农炮塔", "캐논 포탑"],
  "unit.cannonturret.shortName": ["Cannon Turret", "加农炮塔", "캐논 포탑"],
  "unit.cannonturret.desc": ["Anti-armor cannon emplacement.", "反装甲加农炮阵地。", "대장갑 캐논 진지입니다."],
  "unit.cannonturret2.name": ["Bastion Cannon", "要塞重炮", "요새 캐논"],
  "unit.cannonturret2.shortName": ["Bastion", "要塞重炮", "요새 캐논"],
  "unit.cannonturret2.desc": ["Heavy twin cannons with extended range.", "双联重炮，射程更远。", "사거리가 늘어난 쌍열 중포입니다."],
  "unit.aaturret.name": ["AA Turret", "防空炮塔", "대공 포탑"],
  "unit.aaturret.shortName": ["AA Turret", "防空炮塔", "대공 포탑"],
  "unit.aaturret.desc": ["Flak battery. Air-only.", "高射炮组，仅对空。", "대공포 진지. 공중 전용입니다."],
  "unit.samsite.name": ["SAM Site", "防空导弹阵地", "대공 미사일 진지"],
  "unit.samsite.shortName": ["SAM Site", "防空导弹阵地", "대공 미사일 진지"],
  "unit.samsite.desc": ["Long-range missiles that own the local airspace, and that will fire on a nuclear warhead.", "远程防空导弹，掌控周边空域，也会向核弹头开火。", "주변 공역을 장악하는 장거리 미사일. 핵탄두에도 불을 뿜습니다."],
  "unit.interceptor.name": ["Missile Interrupter", "导弹拦截塔", "미사일 요격탑"],
  "unit.interceptor.shortName": ["Interrupter", "拦截塔", "요격탑"],
  "unit.interceptor.desc": [
    "Point defence: shoots down incoming rockets and guided missiles. Nothing for shells, warheads or the ground.",
    "点防御设施：击落来袭的火箭弹与制导导弹。对炮弹、核弹头和地面目标无能为力。",
    "요격 방어: 날아드는 로켓과 유도 미사일을 격추합니다. 포탄, 핵탄두, 지상 표적에는 손쓰지 못합니다."
  ],
  "unit.interceptor2.name": ["Strategic Interrupter", "战略拦截塔", "전략 요격탑"],
  "unit.interceptor2.shortName": ["Strategic Interrupter", "战略拦截塔", "전략 요격탑"],
  "unit.interceptor2.desc": [
    "Point defence with a longer reach, a deeper magazine and thicker walls.",
    "射程更远、备弹更多、装甲更厚的点防御设施。",
    "더 긴 사거리, 더 깊은 탄창, 더 두꺼운 벽을 가진 요격 방어입니다."
  ],
  "unit.sandbag.name": ["Sandbags", "沙袋", "모래주머니"],
  "unit.sandbag.shortName": ["Sandbags", "沙袋", "모래주머니"],
  "unit.landmine.name": ["Land Mine", "地雷", "지뢰"],
  "unit.landmine.shortName": ["Land Mine", "地雷", "지뢰"],
  "unit.landmine.desc": ["A concealed pressure mine with a fragmentation charge against light vehicles.", "隐蔽的压发地雷，以破片爆炸打击轻型载具。", "경차량을 겨냥한 파편 장약을 갖춘 은폐형 압력 지뢰."],
  "unit.watermine.name": ["Water Mine", "水雷", "기뢰"],
  "unit.watermine.shortName": ["Water Mine", "水雷", "기뢰"],
  "unit.watermine.desc": ["A concealed floating contact mine with a blast charge against passing hulls.", "隐蔽的浮式触发水雷，以爆炸装药打击经过的船体。", "지나가는 선체를 겨냥한 폭약을 갖춘 은폐형 부유 접촉 기뢰."],
  "unit.sandbag.desc": ["A tile of wall, cheap and quick. Tiles laid side by side join into one line.", "一格廉价而快速的工事。相邻的沙袋会连成一道防线。", "값싸고 빠른 한 타일짜리 벽. 나란히 놓은 타일은 한 줄로 이어집니다."],
  "unit.repairtower.name": ["Repair Tower", "维修塔", "수리탑"],
  "unit.repairtower.shortName": ["Repair Tower", "维修塔", "수리탑"],
  "unit.repairtower.desc": [
    "Mends damaged allies in range, worst hit first. Repairs cost metal.",
    "维修范围内的受损友军，优先最重伤者。维修消耗金属。",
    "사거리 안의 손상된 아군을 가장 심하게 다친 쪽부터 수리합니다. 수리에는 금속이 듭니다."
  ],
  "unit.warlab.name": ["War Lab", "战争实验室", "전쟁 연구소"],
  "unit.warlab.shortName": ["War Lab", "战争实验室", "전쟁 연구소"],
  "unit.warlab.desc": [
    "Researches the tech tree: the doctrine you fight by, the units and abilities it unlocks, and economy upgrades.",
    "研究科技树：你的作战学说、它解锁的单位与技能，以及经济升级。",
    "기술 트리를 연구합니다: 싸울 교리와 그 교리가 해금하는 유닛과 능력, 그리고 경제 향상."
  ],
  "unit.radar.name": ["Radar Station", "雷达站", "레이더 기지"],
  "unit.radar.shortName": ["Radar", "雷达站", "레이더"],
  "unit.veil.name": ["Veil EW Station", "帷幕干扰站", "베일 전자전 기지"],
  "unit.veil.shortName": ["Veil", "帷幕", "베일"],
  "unit.veil.desc": [
    "An antenna array above an armored control bunker, filling the air with electronic interference.",
    "装甲控制掩体上架设天线阵列，向周围空域发射电子干扰。",
    "장갑 통제 벙커 위에 세운 안테나 배열이 주변에 전자 교란을 퍼뜨립니다."
  ],
  "unit.radar.desc": [
    "Lifts the fog far around it, through night and rain, and unlocks the top tier of weapons.",
    "驱散周围大片战争迷雾，无惧黑夜与雨雪，并解锁顶级武器科技。",
    "밤과 비를 뚫고 주위의 안개를 멀리까지 걷어 내며, 최상위 무기 기술을 해금합니다."
  ],
  "unit.nukesilo.name": ["Nuclear Silo", "核弹发射井", "핵 사일로"],
  "unit.nukesilo.shortName": ["Silo", "核弹井", "사일로"],
  "unit.nukesilo.desc": [
    "Fabricates and stores nuclear warheads, and launches one only where you point it.",
    "制造并储存核弹头，只向你指定的目标发射。",
    "핵탄두를 제조하고 보관하며, 당신이 가리킨 곳에만 발사합니다."
  ],
  "unit.reactor.name": ["Nuclear Reactor", "核反应堆", "원자로"],
  "unit.reactor.shortName": ["Reactor", "反应堆", "원자로"],
  "unit.reactor.desc": [
    "Breeds the cores that arm a warhead. Feeds the grid as well.",
    "培育装配核弹头所需的裂变核心。同时为电网供电。",
    "탄두를 무장시키는 코어를 증식합니다. 전력망에도 전력을 공급합니다."
  ],
  "unit.warhead.name": ["Nuclear Warhead", "核弹头", "핵탄두"],
  "unit.warhead.shortName": ["Nuke", "核弹头", "핵탄두"],
  "unit.warhead.desc": [
    "A warhead in flight: no gun, no orders, a straight line to the point it was sent to.",
    "飞行中的核弹头：没有武器、不接受指令，直线飞向目标点。",
    "비행 중인 탄두: 무기도 명령도 없이 보내진 지점으로 직선 비행합니다."
  ],
  "unit.nukebomb.name": ["Nuclear Bomb", "核航弹", "핵폭탄"],
  "unit.nukebomb.shortName": ["Nuclear Bomb", "核航弹", "핵폭탄"],
  "unit.nukebomb.desc": [
    "The Wraith's free-fall nuclear bomb: it lies where it lands for a while before it goes off.",
    "幽魂的自由落体核航弹：落地后要静置片刻才会起爆。",
    "레이스의 자유 낙하 핵폭탄: 떨어진 자리에 잠시 놓여 있다가 터집니다."
  ],
  "unit.emp.name": ["EMP Warhead", "电磁脉冲弹头", "EMP 탄두"],
  "unit.emp.shortName": ["EMP", "电磁脉冲弹", "EMP"],
  "unit.emp.desc": [
    "A missile with an electromagnetic pulse in place of the warhead: the vehicles, ships and buildings where it comes down go dead for a while. Aircraft are above it.",
    "装着电磁脉冲的导弹：落点周围的车辆、舰船与建筑会瘫痪一阵。飞行器不受影响。",
    "탄두 대신 전자기 펄스를 실은 미사일: 떨어진 곳의 차량, 함선, 건물이 한동안 멈춥니다. 항공기는 그 위에 있습니다."
  ],
  // ------------------------------------------------------------- terrain
  // the map's props (`game/decor.ts`), named on the editor's palette
  "decor.pole": ["Telegraph pole", "电线杆", "전신주"],
  "decor.tower": ["Water tower", "水塔", "급수탑"],
  "decor.palm": ["Date palm", "椰枣树", "대추야자"],
  "decor.tent": ["Field tent", "野战帐篷", "야전 천막"],
  "decor.hangar": ["Aircraft shelter", "机堡", "항공기 격납고"],
  "decor.bunker": ["Bunker", "碉堡", "벙커"],
  "decor.freighter": ["Sinking freighter, north to south", "沉没的货轮（南北向）", "침몰하는 화물선 (남북 방향)"],
  "decor.freighter2": ["Sinking freighter, east to west", "沉没的货轮（东西向）", "침몰하는 화물선 (동서 방향)"],
  "terrain.0": ["Deep water", "深水", "깊은 물"],
  "terrain.1": ["Shallow water", "浅水", "얕은 물"],
  "terrain.2": ["Sand", "沙地", "모래"],
  "terrain.3": ["Grass", "草地", "풀밭"],
  "terrain.4": ["Forest", "森林", "숲"],
  "terrain.5": ["Mountain", "山地", "산지"],
  "terrain.6": ["Road", "道路", "도로"],
  "terrain.7": ["Mud", "泥地", "진흙"],
  "terrain.8": ["Marsh", "沼泽", "습지"],
  "terrain.9": ["Snow", "雪地", "눈"],
  "terrain.10": ["Rubble", "废墟", "잔해"],
  "terrain.11": ["Lava", "熔岩", "용암"],
  "terrain.12": ["Cliff, facing north", "悬崖（面朝北）", "절벽(북향)"],
  "terrain.13": ["Cliff, facing east", "悬崖（面朝东）", "절벽(동향)"],
  "terrain.14": ["Cliff, facing south", "悬崖（面朝南）", "절벽(남향)"],
  "terrain.15": ["Cliff, facing west", "悬崖（面朝西）", "절벽(서향)"],
  "terrain.16": ["City", "城镇", "시가지"],
  "terrain.17": ["Ford", "浅滩", "여울"],
  "terrain.18": ["Ice", "冰面", "빙판"],
  "terrain.19": ["Bridge", "桥梁", "다리"],
  // ------------------------------------------------------------- community maps
  "community.searchHint": ["Name, author, description…", "名称、作者、简介…", "이름, 제작자, 설명…"],
  "community.title": ["Community maps", "社区地图", "커뮤니티 지도"],
  "community.expand": ["Open map picker", "打开地图选择器", "지도 선택기 열기"],
  "community.sort": ["Sort method", "排序方式", "정렬 방식"],
  "community.sort.downloads": ["Most downloaded", "下载最多", "다운로드 많은 순"],
  "community.sort.latest": ["Latest", "最新", "최신순"],
  "community.slots": ["Slot count", "席位数", "자리 수"],
  "community.size": ["Size", "尺寸", "크기"],
  "community.allSlots": ["All slot counts", "所有席位数", "모든 자리 수"],
  "community.allSizes": ["All sizes", "所有尺寸", "모든 크기"],
  "community.noMatches": ["No maps match these filters.", "没有符合筛选条件的地图。", "이 필터에 맞는 지도가 없습니다."],
  "community.loading": ["Fetching the list…", "正在获取列表…", "목록 가져오는 중…"],
  "community.offline": ["The map registry could not be reached.", "无法连接到地图仓库。", "지도 레지스트리에 연결할 수 없습니다."],
  "community.empty": ["No maps published yet. Yours could be the first: Publish from the Scenario Editor.", "尚无已发布的地图。你的可以是第一张：在场景编辑器中发布。", "아직 공개된 지도가 없습니다. 시나리오 에디터에서 공개하면 첫 지도가 됩니다."],
  "community.none": ['Nothing matches "{0}".', "没有匹配“{0}”的地图。", '"{0}"에 맞는 지도가 없습니다.'],
  "community.page": ["{0} / {1}", "{0} / {1}", "{0} / {1}"],
  "community.prev": ["Previous page", "上一页", "이전 페이지"],
  "community.next": ["Next page", "下一页", "다음 페이지"],
  "community.by": ["by {0}", "作者：{0}", "제작: {0}"],
  "community.downloads": ["Downloads", "下载次数", "다운로드 횟수"],
  "community.taking": ["Fetching {0}…", "正在获取 {0}…", "{0} 가져오는 중…"],
  "community.takeFailed": ["Could not fetch that map: {0}", "无法获取该地图：{0}", "지도를 가져올 수 없습니다: {0}"],
  "community.publish": ["Publish your map", "发布你的地图", "내 지도 공개하기"],
  // -------------------------------------------------------- scenario editor
  "editor.title": ["Scenario Editor", "场景编辑器", "시나리오 에디터"],
  // Scenario settings use a modal at every screen size.
  "editor.settings": ["Map settings", "地图设置", "지도 설정"],
  "editor.terrain": ["Terrain", "地形", "지형"],
  "editor.terrainStyle": ["{0} appearance", "{0}外观", "{0} 외형"],
  "editor.originalTerrain": ["Original", "原版", "기본"],
  "editor.unavailableTerrain": ["{0} (unavailable)", "{0}（不可用）", "{0} (사용 불가)"],
  "editor.decor": ["Props", "装饰物", "장식물"],
  "editor.map": ["Scenario", "场景", "시나리오"],
  "editor.tools": ["Drawing tools", "绘图工具", "그리기 도구"],
  "editor.tool.pan": ["Pan · drag to move, pinch to zoom", "平移 · 拖动移动，双指缩放", "이동 · 드래그로 이동, 두 손가락으로 확대/축소"],
  "editor.tool.rectangle": ["Rectangle · drag between corners", "矩形 · 拖动绘制两个角之间的区域", "직사각형 · 두 모서리 사이를 드래그"],
  "editor.tool.circle": ["Circle · drag from centre to edge", "圆形 · 从圆心拖动到边缘", "원 · 중심에서 가장자리로 드래그"],
  "editor.renameHint": ["Double-click to rename · F2", "双击重命名 · F2", "두 번 클릭하여 이름 변경 · F2"],
  "editor.library": ["Library", "场景库", "라이브러리"],
  "editor.myScenarios": ["My Scenarios", "我的场景", "내 시나리오"],
  "editor.scenarioLimit": ["Up to {0} scenarios. Delete one to make room.", "最多保存 {0} 个场景。删除一个以腾出空间。", "시나리오는 최대 {0}개까지 저장할 수 있습니다. 하나를 삭제하여 공간을 확보하세요."],
  "editor.empty": ["Create or import a scenario to start editing.", "创建或导入场景，开始编辑。", "시나리오를 만들거나 가져와 편집을 시작하세요."],
  "editor.deleteScenario": ["Delete scenario", "删除场景", "시나리오 삭제"],
  "editor.confirmDeleteScenario": ["Delete “{0}” from My Scenarios? Export it first if you want to keep a copy.", "从我的场景中删除“{0}”？如需保留副本，请先导出。", "내 시나리오에서 “{0}”을(를) 삭제할까요? 사본을 보관하려면 먼저 내보내세요."],
  "editor.share": ["Share", "分享", "공유"],
  "editor.brushSize": ["Brush size", "笔刷大小", "브러시 크기"],
  "editor.brush": ["Brush", "笔刷", "브러시"],
  "editor.eraser": ["Eraser", "橡皮擦", "지우개"],
  "editor.tool.deposit": ["Metal deposit", "金属矿脉", "금속 광맥"],
  "editor.tool.spawn": ["Spawn point", "出生点", "시작 지점"],
  "editor.tool.erase": ["Erase a unit, prop, deposit or spawn", "清除单位、装饰物、矿脉或出生点", "유닛, 장식물, 광맥, 시작 지점 지우기"],
  "editor.forces": ["Forces", "兵力", "병력"],
  "editor.forcesBuildings": ["Buildings", "建筑", "건물"],
  "editor.forcesUnits": ["Units", "单位", "유닛"],
  "editor.faction": ["Faction", "阵营", "진영"],
  "editor.factionTip": [
    "Place for faction {0}: whoever opens on spawn point {0} gets it.",
    "为阵营 {0} 放置：从出生点 {0} 开局的玩家会得到它。",
    "진영 {0}에 배치합니다. 시작 지점 {0}에서 시작하는 플레이어가 갖게 됩니다."
  ],
  "editor.factionNone": [
    "Place a spawn point first: what stands in the scenario belongs to the faction that opens there.",
    "请先放置出生点：场景中的兵力属于从那里开局的阵营。",
    "먼저 시작 지점을 놓으세요. 시나리오의 병력은 그곳에서 시작하는 진영의 것입니다."
  ],
  "editor.facingTip": [
    "R turns the unit in hand a step; until turned, a unit faces the middle of the scenario.",
    "R 键将手中的单位转动一格；未转动时，单位朝向场景中央。",
    "R 키로 손에 든 유닛을 한 단계 돌립니다. 돌리기 전에는 시나리오 가운데를 향합니다."
  ],
  "editor.warn.buildingGround": [
    "{0} buildings stand on ground an engineer could not build on; they are laid all the same.",
    "{0} 座建筑立在工程车无法施工的地面上；开局时仍会照原样放置。",
    "건물 {0}개가 공병차가 지을 수 없는 땅 위에 있습니다. 그래도 그대로 놓입니다."
  ],
  "editor.warn.buildingSpawn": [
    "A building stands where spawn {0}'s headquarters goes; the headquarters takes the ground and the building is not laid.",
    "有建筑占据了出生点 {0} 的总部位置；总部会占用该地面，建筑不会放置。",
    "시작 지점 {0}의 사령부 자리에 건물이 있습니다. 사령부가 그 땅을 차지하고 건물은 놓이지 않습니다."
  ],
  "editor.warn.unitGround": [
    "{0} units stand where they cannot move; each opens on the nearest tile it can.",
    "{0} 个单位立在无法移动的位置；开局时会移到最近的可通行格。",
    "유닛 {0}개가 움직일 수 없는 곳에 있습니다. 각각 가장 가까운 갈 수 있는 타일에서 시작합니다."
  ],
  "editor.warn.forcesNoSpawn": [
    "{0} units or buildings belong to a faction past the scenario's {1} spawn points; nobody opens there, so they are not laid.",
    "{0} 个单位或建筑属于超出场景 {1} 个出生点的阵营；没有人从那里开局，它们不会放置。",
    "유닛 또는 건물 {0}개가 시나리오의 시작 지점 {1}개를 넘는 진영에 속합니다. 그곳에서 시작하는 사람이 없어 놓이지 않습니다."
  ],
  "editor.warn.forcesFull": ["A scenario holds at most {0} units and buildings.", "一个场景最多容纳 {0} 个单位和建筑。", "시나리오 하나에는 유닛과 건물을 {0}개까지 놓을 수 있습니다."],
  "editor.name": ["Name", "名称", "이름"],
  "editor.description": ["Description", "简介", "설명"],
  "editor.descriptionHint": [
    "A line or two about the scenario, shown beside it on the setup screen.",
    "关于场景的一两句话，会显示在设置界面的场景旁边。",
    "시나리오에 대한 한두 줄. 설정 화면에서 시나리오 옆에 표시됩니다."
  ],
  "editor.translations": ["Translations", "翻译", "번역"],
  "editor.translationAdd": ["Add the name and description in {0}", "添加{0}的名称与简介", "{0} 이름과 설명 추가"],
  "editor.translationRemove": ["Remove this translation", "删除此翻译", "이 번역 삭제"],
  "editor.autosaved": ["Map automatically saved", "地图已自动保存", "지도가 자동으로 저장되었습니다"],
  "editor.autosaveFailed": [
    "The draft could not be kept: storage is full or unavailable. Export the scenario to keep it.",
    "无法保存草稿：存储空间已满或不可用。请导出场景以保留它。",
    "초안을 저장하지 못했습니다: 저장 공간이 가득 찼거나 사용할 수 없습니다. 시나리오를 내보내 보관하세요."
  ],
  "editor.new": ["New scenario…", "新建场景…", "새 시나리오…"],
  "editor.newTitle": ["New map", "新建地图", "새 지도"],
  "editor.size": ["Map size", "地图尺寸", "지도 크기"],
  "editor.width": ["Width (tiles)", "宽度（格）", "너비 (타일)"],
  "editor.height": ["Height (tiles)", "高度（格）", "높이 (타일)"],
  "editor.resize": ["Resize map", "调整地图尺寸", "지도 크기 변경"],
  "editor.resizeHint": [
    "Tiles stay in place. Added space uses the selected fill. Shrinking crops the right and bottom edges; removed spawns also remove their forces. You can undo the resize.",
    "现有地块保持原位，新增区域使用所选地形填充。缩小会裁去右侧和底部边缘；被移除的出生点所属部队也会移除。尺寸调整可以撤销。",
    "기존 타일의 위치는 유지되며, 추가된 영역은 선택한 지형으로 채워집니다. 축소하면 오른쪽과 아래쪽 가장자리가 잘리고, 제거된 시작 지점의 병력도 제거됩니다. 크기 변경은 실행 취소할 수 있습니다."
  ],
  "editor.fill": ["Fill with", "填充", "채우기"],
  "editor.create": ["Create", "创建", "만들기"],
  "editor.replaceTitle": ["Replace scenario", "替换场景", "시나리오 바꾸기"],
  "editor.replace": ["Replace", "替换", "바꾸기"],
  "editor.confirmReplace": [
    "Replace the scenario you are editing? Anything not exported is lost.",
    "替换正在编辑的场景？未导出的内容将丢失。",
    "편집 중인 시나리오를 바꿀까요? 내보내지 않은 것은 사라집니다."
  ],
  "editor.shorelines": ["Tidy shorelines", "整理海岸线", "해안선 정리"],
  "editor.shorelinesTip": [
    "Sand beside water and shallows beside land, the way the generators finish a scenario.",
    "临水铺沙、临岸变浅，与生成器收尾时一致。",
    "물가에는 모래, 뭍가에는 얕은 물. 생성기가 시나리오를 마무리하는 방식입니다."
  ],
  "editor.grid": ["Grid", "网格", "격자"],
  "editor.levels": ["High ground", "高地", "고지"],
  "editor.levelsTip": [
    "Shade the ground by the level the cliffs put it at: the plateau behind a face a step above the ground before it, a gate the slope between.",
    "按悬崖形成的高度给地面着色：崖面后方的高原比崖面前方的地面高一级，缺口是二者之间的坡道。",
    "절벽이 만드는 높이에 따라 지면을 음영으로 표시합니다. 절벽면 뒤의 고원은 앞의 땅보다 한 단계 높고, 틈은 그 사이의 비탈입니다."
  ],
  "editor.undo": ["Undo", "撤销", "실행 취소"],
  "editor.import": ["Import", "导入", "가져오기"],
  "editor.importSelect": ["Select file", "选择文件", "파일 선택"],
  "editor.importFileHint": ["Open a .steel-tide-map or .json map file.", "打开 .steel-tide-map 或 .json 地图文件。", ".steel-tide-map 또는 .json 지도 파일을 엽니다."],
  "editor.importRusted": ["Import Rusted Warfare map", "导入铁锈战争地图", "Rusted Warfare 지도 가져오기"],
  "editor.importRustedHint": [
    "Convert a .tmx map to Steel Tide terrain, resources and starting forces. Custom artwork and mission scripts are omitted.",
    "将 .tmx 地图转换为 Steel Tide 的地形、资源与初始部队。不包含自定义美术和任务脚本。",
    ".tmx 지도를 Steel Tide의 지형, 자원, 시작 병력으로 변환합니다. 사용자 지정 그래픽과 임무 스크립트는 제외됩니다."
  ],
  "editor.importDrop": ["Click to choose, or drop a file here", "点击选择，或将文件拖到此处", "클릭하여 선택하거나 여기에 파일을 놓으세요"],
  "editor.importReading": ["Reading map…", "正在读取地图…", "지도를 읽는 중…"],
  "editor.importTooLarge": ["That map file is too large.", "该地图文件过大。", "지도 파일이 너무 큽니다."],
  "editor.importReadError": ["Could not read that file. Choose it again or try another map.", "无法读取该文件。请重新选择或尝试其他地图。", "파일을 읽을 수 없습니다. 다시 선택하거나 다른 지도를 시도하세요."],
  "editor.rw.error.file": ["The map file is empty or too large.", "地图文件为空或过大。", "지도 파일이 비어 있거나 너무 큽니다."],
  "editor.rw.error.xml": ["Could not read the TMX file. Its XML is invalid.", "无法读取 TMX 文件：XML 格式无效。", "TMX 파일을 읽을 수 없습니다. XML 형식이 잘못되었습니다."],
  "editor.rw.error.map": ["Choose a finite, orthogonal Rusted Warfare .tmx map.", "请选择有限大小、正交网格的铁锈战争 .tmx 地图。", "크기가 정해진 직교 격자 Rusted Warfare .tmx 지도를 선택하세요."],
  "editor.rw.error.size": ["The map must be {0}–{1} tiles a side.", "地图每边必须为 {0}–{1} 格。", "지도의 각 변은 {0}–{1} 타일이어야 합니다."],
  "editor.rw.error.ground": ["This map has no Ground layer to convert.", "该地图没有可转换的 Ground 图层。", "변환할 Ground 레이어가 없습니다."],
  "editor.rw.error.layer": ["Map layers must match the map size and have no offset.", "地图图层必须与地图大小一致，且没有偏移。", "지도 레이어의 크기가 지도와 같고 오프셋이 없어야 합니다."],
  "editor.rw.error.encoding": ["Save the TMX tile data as CSV, XML tiles or base64, then try again.", "请将 TMX 地块数据保存为 CSV、XML 地块或 base64 后重试。", "TMX 타일 데이터를 CSV, XML 타일 또는 base64로 저장한 뒤 다시 시도하세요."],
  "editor.rw.error.compression": ["Use uncompressed, gzip or zlib TMX data in a browser that supports decompression.", "请使用未压缩、gzip 或 zlib 格式的 TMX 数据，并在支持解压的浏览器中导入。", "압축 해제를 지원하는 브라우저에서 무압축, gzip 또는 zlib TMX 데이터를 사용하세요."],
  "editor.rw.error.data": ["The TMX tile data is incomplete or invalid.", "TMX 地块数据不完整或无效。", "TMX 타일 데이터가 불완전하거나 잘못되었습니다."],
  "editor.rw.error.players": ["The map has more factions than Steel Tide supports.", "地图的阵营数量超出 Steel Tide 支持的范围。", "지도의 진영 수가 Steel Tide에서 지원하는 수를 초과합니다."],
  "editor.rw.error.deposits": ["The map has too many resource points to import.", "地图的资源点过多，无法导入。", "자원 지점이 너무 많아 가져올 수 없습니다."],
  "editor.rw.error.units": ["The map has too many starting units to import.", "地图的初始单位过多，无法导入。", "시작 유닛이 너무 많아 가져올 수 없습니다."],
  "editor.rw.reviewTitle": ["Map converted", "地图已转换", "지도 변환 완료"],
  "editor.rw.reviewIntro": ["The map is ready to edit. Review these conversion notes:", "地图已可编辑。请查看以下转换说明：", "지도를 편집할 수 있습니다. 다음 변환 안내를 확인하세요:"],
  "editor.rw.warning.terrain": ["Custom terrain was approximated; unsupported layers and artwork were omitted.", "自定义地形已近似转换；不支持的图层和美术已省略。", "사용자 지정 지형은 근사하게 변환되었으며, 지원하지 않는 레이어와 그래픽은 제외되었습니다."],
  "editor.rw.warning.units": ["Units without a Steel Tide equivalent, including neutral forces, were omitted.", "没有 Steel Tide 对应类型的单位（包括中立部队）已省略。", "중립 병력을 포함하여 Steel Tide에 대응하는 유형이 없는 유닛은 제외되었습니다."],
  "editor.rw.warning.triggers": ["Mission scripts, events and team settings were omitted.", "任务脚本、事件与阵营设置已省略。", "임무 스크립트, 이벤트, 진영 설정은 제외되었습니다."],
  "editor.rw.warning.spawns": ["Some headquarters positions were inferred. Check the faction spawns before playing.", "部分总部位置为自动推定。请在游玩前检查阵营出生点。", "일부 본부 위치를 추정했습니다. 플레이 전에 진영 시작 지점을 확인하세요."],
  "editor.rw.warning.placements": ["Overlapping units and buildings, or pieces extending past the map edge, were omitted.", "重叠或超出地图边界的单位与建筑已省略。", "겹치거나 지도 경계를 벗어난 유닛과 건물은 제외되었습니다."],
  "editor.export": ["Export", "导出", "내보내기"],
  "editor.publish": ["Publish", "发布", "공개"],
  "editor.publishTip": ["Propose the scenario to the community registry", "将场景提交到社区场景仓库", "커뮤니티 레지스트리에 시나리오 제안"],
  "editor.publishTitle": ["Publish to the community", "发布到社区", "커뮤니티에 공개"],
  "editor.publishIntro": [
    "Submit your scenario for review without an account. Once approved, it appears in the Community tab for everyone.",
    "无需账号即可提交场景审核。通过后，场景会出现在所有人的社区标签页中。",
    "계정 없이 시나리오를 검토에 제출하세요. 승인되면 모두의 커뮤니티 탭에 나타납니다."
  ],
  "editor.publishSlots": ["Player slots", "玩家席位", "플레이어 자리"],
  "editor.publishDeposits": ["Metal deposits", "金属矿脉", "금속 광맥"],
  "editor.publishForces": ["Units and buildings", "单位与建筑", "유닛과 건물"],
  "editor.publishEmail": ["Contact email (required)", "联系邮箱（必填）", "연락 이메일 (필수)"],
  "editor.publishBalance": ["Merit balance: {0}", "军功余额：{0}", "보유 공훈: {0}"],
  "editor.publishLicense": [
    "By submitting, you confirm this is your work and agree to share the scenario under CC-BY-4.0. Your scenario, commander name and contact email will be public in the review request.",
    "提交即表示你确认这是自己的作品，并同意以 CC-BY-4.0 许可分享场景。场景、指挥官名称和联系邮箱将在审核请求中公开展示。",
    "제출하면 본인의 작품임을 확인하고 CC-BY-4.0으로 공유하는 데 동의합니다. 시나리오, 사령관 이름, 연락 이메일이 검토 요청에 공개됩니다."
  ],
  "editor.publishGo": ["Submit for review", "提交审核", "검토에 제출"],
  "editor.publishSending": ["Submitting…", "正在提交…", "제출 중…"],
  "editor.publishSubmitted": [
    "Your scenario was submitted for review. It will appear in the Community tab once approved.",
    "场景已提交审核。通过后会出现在社区标签页中。",
    "시나리오가 검토에 제출되었습니다. 승인되면 커뮤니티 탭에 나타납니다."
  ],
  "editor.publishView": ["View submission", "查看提交", "제출 보기"],
  "editor.publish.error.conflict": [
    "This scenario name is already published or reserved by a submission. Choose another name for a new scenario.",
    "该场景名称已发布或已被一份提交占用。新场景请使用其他名称。",
    "이 시나리오 이름은 이미 공개되었거나 제출에 사용 중입니다. 새 시나리오에는 다른 이름을 사용하세요."
  ],
  "editor.publish.error.busy": ["Submissions are busy. Try again later.", "提交繁忙，请稍后重试。", "제출이 혼잡합니다. 나중에 다시 시도하세요."],
  "editor.publish.error.email": ["Enter a valid contact email before submitting.", "请填写有效的联系邮箱后再提交。", "제출하기 전에 유효한 연락 이메일을 입력하세요."],
  "editor.publish.error.merit": ["You need {0} merit to submit a new scenario.", "提交新场景需要 {0} 军功。", "새 시나리오를 제출하려면 공훈 {0}이 필요합니다."],
  "editor.publish.error.storage": ["The submission payment could not be saved. Free some storage, then retry with the same scenario and email.", "无法保存提交扣费记录。请清理存储空间后，使用相同的场景和邮箱重试。", "제출 결제 기록을 저장하지 못했습니다. 저장 공간을 확보한 뒤 같은 시나리오와 이메일로 다시 시도하세요."],
  "editor.publish.error.invalid": ["The scenario could not be accepted. Check its name, description, spawns and file size.", "场景无法提交，请检查名称、简介、出生点和文件大小。", "시나리오를 접수할 수 없습니다. 이름, 설명, 시작 지점, 파일 크기를 확인하세요."],
  "editor.publish.error.unavailable": ["The submission service could not be reached. Your draft is saved; try again later.", "无法连接到提交服务。草稿已保存，请稍后重试。", "제출 서비스에 연결할 수 없습니다. 초안은 저장되어 있으니 나중에 다시 시도하세요."],
  "editor.publish.needName": ["Give the scenario a name of its own first.", "请先给场景起一个名字。", "먼저 시나리오에 이름을 지어 주세요."],
  "editor.publish.needDescription": ["Write a description first: a line or two on what kind of fight it is.", "请先写一段简介：一两句话说明这是怎样的战斗。", "먼저 설명을 써 주세요: 어떤 싸움인지 한두 줄."],
  "editor.publish.needSpawns": ["A scenario needs at least two spawn points to be published.", "场景至少需要两个出生点才能发布。", "공개하려면 시작 지점이 최소 두 개 필요합니다."],
  "editor.publish.blocked": ["Not ready to publish: {0}", "尚不能发布：{0}", "아직 공개할 수 없습니다: {0}"],
  "editor.warn.noSpawn": ["No spawn point yet; the scenario cannot be played.", "尚无出生点，场景无法游玩。", "시작 지점이 아직 없습니다. 이 시나리오는 플레이할 수 없습니다."],
  "editor.warn.spawnGround": [
    "Spawn {0} is not on open grass or sand: the headquarters needs it.",
    "出生点 {0} 不在开阔的草地或沙地上：总部需要这样的地面。",
    "시작 지점 {0}이(가) 탁 트인 풀밭이나 모래 위에 있지 않습니다. 사령부에는 그런 땅이 필요합니다."
  ],
  "editor.warn.cliffLevel": [
    "{0} cliff faces contradict the rest: the ground behind them did not come out a step above the ground before them.",
    "{0} 个悬崖面与其余部分矛盾：其后方的地面没有比前方高出一级。",
    "절벽면 {0}개가 나머지와 모순됩니다. 그 뒤의 땅이 앞의 땅보다 한 단계 높게 나오지 않았습니다."
  ],
  "editor.warn.cliffStub": [
    "{0} isolated cliff tiles; a lone cliff draws as a stub.",
    "{0} 个孤立的悬崖格，孤立悬崖会显示为残桩。",
    "고립된 절벽 타일 {0}개. 외따로 선 절벽은 그루터기로 그려집니다."
  ],
  "editor.warn.decorGround": [
    "{0} props stand on the wrong ground: water, cliffs, roads or obstacles, or a wreck out of deep water.",
    "{0} 个装饰物立在不合适的地面上：水面、悬崖、道路或障碍物，或者沉船不在深水中。",
    "장식물 {0}개가 잘못된 지면에 서 있습니다: 물, 절벽, 도로, 장애물이거나 난파선이 깊은 물 밖에 있습니다."
  ],
  "editor.warn.decorSpawn": [
    "A prop stands where spawn {0}'s headquarters goes; the headquarters is built over it.",
    "装饰物占据了出生点 {0} 的总部位置；总部会盖在它上面。",
    "시작 지점 {0}의 사령부 자리에 장식물이 있습니다. 사령부가 그 위에 지어집니다."
  ],
  "editor.warn.spawnsFull": ["A scenario seats at most {0} factions.", "一个场景最多容纳 {0} 个阵营。", "시나리오 하나에는 진영 {0}개까지 앉을 수 있습니다."],
  "editor.importFailed": ["Could not read that map: {0}", "无法读取该地图：{0}", "지도를 읽을 수 없습니다: {0}"],
  "editor.imported": ["Map loaded: {0}", "已载入地图：{0}", "지도를 불러왔습니다: {0}"],
  // ------------------------------------------------------------- misc gameplay
  "game.constructing": ["Constructing…", "建造中…", "건설 중…"],
  "game.upgrading": ["Upgrading… ({0}%)", "升级中…（{0}%）", "업그레이드 중… ({0}%)"],
  // ------------------------------------------------------------- voice
  // What Command says over the radio (core/voice.ts lists when). Recorded by
  // `pnpm voice` from these lines, so a change here is a re-take, not a retitle.
  "voice.match.start": [
    "Command online. Base established. The field is yours, commander.",
    "指挥系统上线。基地已建立。战场交给你了，指挥官。",
    "지휘부 온라인. 기지 구축 완료. 전장은 사령관님의 것입니다."
  ],
  "voice.objective.done": ["Objective complete.", "目标已完成。", "목표 완료."],
  "voice.objective.new": ["New objective received.", "收到新目标。", "새 목표 수신."],
  "voice.victory": ["Victory. The enemy has been broken. Well fought, commander.", "胜利。敌军已被击溃。打得漂亮，指挥官。", "승리. 적은 무너졌습니다. 훌륭한 싸움이었습니다, 사령관님."],
  "voice.defeat": ["Our forces have been overrun. Command is going dark.", "我军已被击溃。指挥系统即将关闭。", "아군이 유린당했습니다. 지휘부 통신을 끊습니다."],
  "voice.lastStand": [
    "Headquarters lost. No way to rebuild. Hold out, this is our last stand.",
    "总部已失守，无法重建。坚持住，这是最后一战。",
    "사령부 상실. 재건 불가. 버티십시오, 이것이 마지막 저항입니다."
  ],
  "voice.faction.enemyOut": ["Enemy faction eliminated.", "敌方阵营已被消灭。", "적 진영 제거."],
  "voice.faction.allyOut": ["An allied faction has fallen.", "友军阵营已陷落。", "아군 진영이 무너졌습니다."],
  "voice.built": ["Construction complete.", "建造完成。", "건설 완료."],
  "voice.unit.ready.1": ["Unit ready.", "单位就绪。", "유닛 준비 완료."],
  "voice.unit.ready.2": ["New unit rolling out.", "新单位已出厂。", "새 유닛 출고."],
  "voice.unit.ready.3": ["Reinforcements ready.", "增援就绪。", "증원 준비 완료."],
  "voice.upgrade.done": ["Upgrade complete.", "升级完成。", "업그레이드 완료."],
  "voice.power.low": ["Power shortage. Production is slowing.", "电力短缺，生产减速。", "전력 부족. 생산이 느려집니다."],
  "voice.power.restored": ["Power restored.", "电力已恢复。", "전력 복구."],
  "voice.metal.out": ["Out of metal. Work has stalled.", "金属耗尽，工程暂停。", "금속 소진. 작업이 멈췄습니다."],
  "voice.pop.cap": ["Unit cap reached.", "已达人口上限。", "유닛 상한 도달."],
  "voice.place.blocked": ["Cannot build there.", "无法在此建造。", "거기에는 지을 수 없습니다."],
  "voice.place.deposit": ["Extractors must stand on a deposit.", "采矿场必须建在矿脉上。", "채굴장은 광맥 위에 세워야 합니다."],
  "voice.place.metal": ["Insufficient metal.", "金属不足。", "금속이 부족합니다."],
  "voice.place.ok": ["Building.", "开始建造。", "건설 시작."],
  "voice.sold": ["Structure sold.", "建筑已出售。", "건물 판매 완료."],
  "voice.attack.base": ["Our building is under attack.", "我方建筑遭到攻击。", "아군 건물이 공격받고 있습니다."],
  "voice.attack.hq": ["Headquarters under attack!", "总部遭到攻击！", "사령부가 공격받고 있습니다!"],
  "voice.attack.units": ["Our forces are under attack.", "我方部队遭到攻击。", "아군 부대가 공격받고 있습니다."],
  "voice.wave.incoming": ["Enemy attack wave inbound.", "敌军进攻波来袭。", "적 공격 파도 접근 중."],
  "voice.launch.detected": ["Sarsar launch detected. Impact in five seconds.", "检测到萨尔萨尔发射。五秒后落地。", "사르사르 발사 감지. 5초 후 착탄."],
  "voice.fleet.run": ["Enemy ships in the channel. Intercept them.", "敌舰进入水道。拦截它们。", "수로에 적함. 요격하십시오."],
  "voice.column.out": ["A column is on the highway. Cut it off.", "一支纵队上了公路。截住它。", "종대가 고속도로에 올랐습니다. 차단하십시오."],
  "voice.relief": ["Reinforcements have arrived.", "援军已到。", "증원이 도착했습니다."],
  "voice.checkpoint.fell": ["Checkpoint lost. The front has moved.", "检查点失守。前线已经移动。", "검문소 상실. 전선이 이동했습니다."],
  "voice.whistle": ["The assault begins. Hold the line.", "进攻开始。守住防线。", "공세 시작. 전선을 사수하십시오."],
  "voice.enemy.sighted": ["Enemy sighted.", "发现敌军。", "적 발견."],
  "voice.unit.lost": ["Unit lost.", "单位损失。", "유닛 손실."],
  "voice.structure.lost": ["Structure destroyed.", "建筑被摧毁。", "건물 파괴됨."],
  "voice.promoted": ["Unit promoted.", "单位晋升。", "유닛 진급."],
  "voice.nuke.ready": ["Nuclear warhead ready.", "核弹头已就绪。", "핵탄두 준비 완료."],
  "voice.nuke.launch": ["Warning. Nuclear launch detected.", "警告，检测到核弹发射。", "경고. 핵 발사 감지."],
  "voice.nuke.intercepted": ["Warhead intercepted.", "核弹头已被拦截。", "핵탄두 요격."],
  "voice.nuke.shotDown": ["Our warhead has been shot down.", "我方核弹头被击落。", "아군 핵탄두가 격추되었습니다."],
  "voice.nuke.impact": ["Nuclear detonation confirmed.", "核爆已确认。", "핵폭발 확인."],
  "voice.emp.ready": ["EMP warhead ready.", "电磁脉冲弹头已就绪。", "EMP 탄두 준비 완료."],
  "voice.emp.launch": ["Warning. EMP launch detected.", "警告，检测到电磁脉冲弹发射。", "경고. EMP 발사 감지."],
  "voice.emp.impact": ["EMP detonation confirmed. Systems down.", "电磁脉冲已引爆，区域内系统瘫痪。", "EMP 폭발 확인. 시스템 정지."],
  "voice.ack.move.1": ["Moving out.", "出发。", "이동합니다."],
  "voice.ack.move.2": ["On our way.", "正在前往。", "가는 중입니다."],
  "voice.ack.attack.1": ["Engaging.", "开始交战。", "교전 개시."],
  "voice.ack.attack.2": ["Target acquired.", "已锁定目标。", "표적 포착."],
  "voice.ack.fireMission": ["Fire mission received.", "收到火力任务。", "화력 임무 수신."],
  "voice.ack.hold": ["Holding position.", "原地待命。", "위치 사수."],
  "voice.ack.load": ["Loading up.", "正在装载。", "탑승 중."],
  "voice.ack.unload": ["Unloading.", "正在卸载。", "하차 중."],
  "voice.saved": ["Game saved.", "游戏已保存。", "게임 저장 완료."],
  // Unit crews: each unit type keeps its own actor across every action.
  "voice.unit.engineer.select.1": ["Tools ready.", "请指示作业位置。", "장비 준비 완료."],
  "voice.unit.engineer.move.1": ["Point me at the job.", "向指定位置机动。", "작업 위치만 알려 줘."],
  "voice.unit.buggy.select.1": ["Eyes open.", "请指示侦察方向。", "눈 크게 뜨고 있다."],
  "voice.unit.buggy.move.1": ["Let's kick up some dust.", "向指定区域机动。", "먼지 좀 날려 볼까."],
  "voice.unit.buggy.attack.1": ["Putting them in our sights.", "准备射击。", "조준선에 잡는다."],
  "voice.unit.ltank.select.1": ["Ready to hunt.", "车组待命。", "사냥 준비 끝."],
  "voice.unit.ltank.move.1": ["Tracks turning.", "开始机动。", "궤도 돌린다."],
  "voice.unit.ltank.attack.1": ["Moving in for a bite.", "准备接敌。", "한 입 물러 간다."],
  "voice.unit.mbt.select.1": ["Gun crew ready.", "战斗准备完毕。", "포반 준비 완료."],
  "voice.unit.mbt.move.1": ["Rolling with the column.", "向指定位置推进。", "종대 따라간다."],
  "voice.unit.mbt.attack.1": ["Putting steel on target.", "炮手，准备射击。", "표적에 포탄 먹여 준다."],
  "voice.unit.td.select.1": ["Looking for armor.", "请求目标方位。", "장갑 표적 찾는 중."],
  "voice.unit.td.move.1": ["Moving to a firing position.", "转移射击阵地。", "사격 위치로 이동한다."],
  "voice.unit.td.attack.1": ["Lining up an armor kill.", "准备导弹射击。", "장갑부터 뚫어 주지."],
  "voice.unit.flak.select.1": ["Watching the skies.", "对空警戒。", "하늘 감시 중."],
  "voice.unit.flak.move.1": ["Moving the air cover.", "转移阵地。", "대공 엄호 이동한다."],
  "voice.unit.flak.attack.1": ["Gunners, track that target.", "跟踪目标，准备射击。", "포수, 표적 추적해."],
  "voice.unit.sam.select.1": ["Air defense ready.", "防空待命。", "방공 준비 완료."],
  "voice.unit.sam.move.1": ["Relocating the launcher.", "转移发射阵地。", "발사대 이동한다."],
  "voice.unit.sam.attack.1": ["Tracking the bandit.", "准备拦截目标。", "적기 추적 중."],
  "voice.unit.arty.select.1": ["Send it.", "请求目标坐标。", "말해라."],
  "voice.unit.arty.move.1": ["Limbering up. Moving out.", "收炮，转移阵地。", "방열 접고 이동한다."],
  "voice.unit.arty.attack.1": ["Fire mission received.", "按坐标准备射击。", "사격 임무 수신."],
  "voice.unit.mlrs.select.1": ["Rockets standing by.", "等候射击命令。", "로켓 대기 중."],
  "voice.unit.mlrs.move.1": ["Moving the rocket battery.", "转移发射阵地。", "로켓 포대 이동한다."],
  "voice.unit.mlrs.attack.1": ["Laying in the coordinates.", "准备火力覆盖。", "표적 좌표 입력한다."],
  "voice.unit.radarcar.select.1": ["Watching the scope.", "请指示搜索区域。", "레이더 감시 중."],
  "voice.unit.radarcar.move.1": ["Moving our eyes forward.", "转移雷达阵地。", "눈을 앞으로 옮긴다."],
  "voice.unit.salamander.select.1": ["Mortar crew ready.", "等候射击命令。", "박격포반 준비 완료."],
  "voice.unit.salamander.move.1": ["Moving the tube.", "转移射击阵地。", "포 옮긴다."],
  "voice.unit.salamander.attack.1": ["Plotting the fire mission.", "装填温压弹。", "사격 제원 잡는다."],
  "voice.unit.bulwark.select.1": ["Covering the column.", "拦截待命。", "종대 엄호 중."],
  "voice.unit.bulwark.move.1": ["Keeping the shield moving.", "转移阵地。", "방패도 함께 움직인다."],
  "voice.unit.drake.select.1": ["Ready to turn up the heat.", "战斗准备完毕。", "열기 좀 올려 볼까."],
  "voice.unit.drake.move.1": ["Bringing the heat along.", "向指定位置机动。", "열기 몰고 간다."],
  "voice.unit.drake.attack.1": ["Let's warm them up.", "接近目标，准备喷火。", "좀 데워 주지."],
  "voice.unit.gator.select.1": ["Ready for the crossing.", "等待机动指令。", "도하 준비 완료."],
  "voice.unit.gator.move.1": ["Taking the crew across.", "向指定位置前进。", "대원들 데리고 건넌다."],
  "voice.unit.gator.attack.1": ["Making room on the far bank.", "准备火力支援。", "건너편 자리 좀 비워라."],
  "voice.unit.scorpion.select.1": ["Launcher standing by.", "等待发射命令。", "발사대 대기 중."],
  "voice.unit.scorpion.move.1": ["Shifting the launch position.", "转移发射阵地。", "발사 위치 옮긴다."],
  "voice.unit.scorpion.attack.1": ["Programming the strike.", "准备发射。", "타격 제원 입력한다."],
  "voice.unit.gunboat.select.1": ["Ready, skipper.", "等待巡逻任务。", "함장님, 준비됐습니다."],
  "voice.unit.gunboat.move.1": ["Aye, getting underway.", "按指定航向前进。", "알겠습니다. 출항합니다."],
  "voice.unit.gunboat.attack.1": ["Training the gun.", "舰炮准备射击。", "함포 돌립니다."],
  "voice.unit.mboat.select.1": ["Awaiting tasking.", "等待攻击命令。", "임무 대기 중."],
  "voice.unit.mboat.move.1": ["Aye, changing course.", "改变航向。", "알겠습니다. 침로 변경합니다."],
  "voice.unit.mboat.attack.1": ["Setting up the missile solution.", "准备发射反舰导弹。", "미사일 사격 제원 산출합니다."],
  "voice.unit.frigate.select.1": ["Fleet cover ready.", "等待护航任务。", "함대 엄호 준비 완료."],
  "voice.unit.frigate.move.1": ["Moving with the screen.", "按指定航向前进。", "호위 대형 따라갑니다."],
  "voice.unit.frigate.attack.1": ["Bringing weapons to bear.", "准备迎击目标。", "무장을 표적으로 돌립니다."],
  "voice.unit.btlship.select.1": ["Main battery ready.", "主炮待命。", "주포 준비 완료."],
  "voice.unit.btlship.move.1": ["Aye, bringing her around.", "调整航向。", "알겠습니다. 배 돌립니다."],
  "voice.unit.btlship.attack.1": ["Laying the main battery.", "主炮准备射击。", "주포 조준합니다."],
  "voice.unit.carrier.select.1": ["Air group standing by.", "全舰待命。", "비행대 대기 중."],
  "voice.unit.carrier.move.1": ["Setting a new course.", "按指定航向前进。", "새 침로 설정합니다."],
  "voice.unit.carrier.attack.1": ["Directing the air group.", "准备迎击目标。", "비행대에 지시합니다."],
  "voice.unit.seatrans.select.1": ["Ready to ferry.", "等待输送任务。", "수송 준비 완료."],
  "voice.unit.seatrans.move.1": ["Taking them across.", "驶向指定位置。", "건너편으로 모십니다."],
  "voice.unit.engboat.select.1": ["Deck crew ready.", "请指示施工位置。", "갑판 작업반 준비 완료."],
  "voice.unit.engboat.move.1": ["Aye, heading to the job.", "驶向指定位置。", "알겠습니다. 작업 지점으로 갑니다."],
  "voice.unit.kraken.select.1": ["Missile room standing by.", "请求目标坐标。", "미사일실 대기 중."],
  "voice.unit.kraken.move.1": ["Aye, taking a new bearing.", "保持潜航，调整航向。", "알겠습니다. 새 방위로 갑니다."],
  "voice.unit.kraken.attack.1": ["Plotting the missile strike.", "准备发射巡航导弹。", "미사일 타격 제원 잡습니다."],
  "voice.unit.moray.select.1": ["Keeping watch.", "等待渗透任务。", "감시 중입니다."],
  "voice.unit.moray.move.1": ["Slipping into position.", "保持潜航，前往指定位置。", "조용히 위치 잡습니다."],
  "voice.unit.jet.select.1": ["Strike flight ready.", "等待攻击任务。", "타격 편대 준비 완료."],
  "voice.unit.jet.move.1": ["Turning to your mark.", "按指定航向飞行。", "지정 지점으로 선회합니다."],
  "voice.unit.jet.attack.1": ["Setting up the rocket run.", "进入攻击航线。", "로켓 공격 진입합니다."],
  "voice.unit.mjet.select.1": ["Hunting surface contacts.", "等待反舰任务。", "수상 표적 수색 중."],
  "voice.unit.mjet.move.1": ["Changing course over the water.", "改变航向。", "해상에서 침로 변경합니다."],
  "voice.unit.mjet.attack.1": ["Setting up an anti-ship run.", "准备发射反舰导弹。", "대함 공격 진입합니다."],
  "voice.unit.bomber.select.1": ["Bomb crew ready.", "等待轰炸任务。", "폭격 준비 완료."],
  "voice.unit.bomber.move.1": ["Turning onto the new heading.", "按指定航向飞行。", "새 침로로 선회합니다."],
  "voice.unit.bomber.attack.1": ["Lining up the bombing run.", "进入轰炸航线。", "폭격 진입로 잡습니다."],
  "voice.unit.theli.select.1": ["Lift crew ready.", "请指示接运位置。", "수송 승무원 준비 완료."],
  "voice.unit.theli.move.1": ["Taking the lift to you.", "飞往指定位置。", "수송하러 갑니다."],
  "voice.unit.c47.select.1": ["Cargo crew standing by.", "等待运输任务。", "수송 승무원 대기 중."],
  "voice.unit.c47.move.1": ["Hauling out.", "飞往指定位置。", "화물 싣고 갑니다."],
  "voice.unit.gunship.select.1": ["Gun crew on station.", "等待火力支援任务。", "포반 정위치."],
  "voice.unit.gunship.move.1": ["Moving the orbit.", "调整盘旋位置。", "선회 지점 옮깁니다."],
  "voice.unit.gunship.attack.1": ["Bringing the side guns around.", "转入盘旋射击。", "측면 포를 표적으로 돌립니다."],
  "voice.unit.wraith.select.1": ["Quiet and ready.", "等待突击命令。", "조용히 대기 중."],
  "voice.unit.wraith.move.1": ["Taking the quiet way in.", "隐蔽接近指定位置。", "조용히 접근합니다."],
  "voice.unit.wraith.attack.1": ["Setting up a silent approach.", "进入投弹航线。", "은밀 진입 준비합니다."],
  "voice.unit.cormorant.select.1": ["Listening for boats.", "请指示反潜区域。", "잠수함 탐지 중."],
  "voice.unit.cormorant.move.1": ["Moving the search pattern.", "飞往指定位置。", "수색 구역 옮깁니다."],
  "voice.unit.cormorant.attack.1": ["Setting up the torpedo approach.", "准备投放鱼雷。", "어뢰 공격 진입합니다."],
  "voice.unit.engineer.build.1": ["Let's break ground.", "执行施工任务。", "땅부터 파 보자."],
  "voice.unit.engineer.repair.1": ["Tools out. We'll fix it.", "执行维修任务。", "공구 꺼내. 고쳐 주지."],
  "voice.unit.hercules.protect.1": ["Recovery crew's got your back.", "随队执行抢修任务。", "구난반이 뒤를 맡지."],
  "voice.unit.engboat.build.1": ["Deck crew, get to work.", "执行施工任务。", "갑판 작업반, 작업 시작."],
  "voice.unit.engboat.repair.1": ["Aye, bringing the tools.", "准备靠近维修目标。", "알겠습니다. 공구 가져갑니다."],
  "voice.unit.radarcar.protect.1": ["Keeping an eye out for you.", "随队警戒。", "주변은 내가 살피지."],
  "voice.unit.bulwark.protect.1": ["We'll cover you.", "执行掩护任务。", "우리가 엄호하지."],
  "voice.unit.seatrans.load.1": ["Bring them aboard.", "准备装载。", "승선시키십시오."],
  "voice.unit.seatrans.unload.1": ["Preparing to put them ashore.", "准备卸载。", "상륙 준비합니다."],
  "voice.unit.gator.load.1": ["Climb in. We've got room.", "准备装载。", "타라. 자리 있다."],
  "voice.unit.gator.unload.1": ["Getting the crew out.", "准备卸载。", "대원들 내린다."],
  "voice.unit.theli.load.1": ["Coming in for pickup.", "准备接运。", "탑승 지점으로 접근합니다."],
  "voice.unit.theli.unload.1": ["Setting up the drop.", "准备卸载。", "하차 준비합니다."],
  "voice.unit.c47.load.1": ["Ready to take them aboard.", "准备降落装载。", "탑승 준비됐습니다."],
  "voice.unit.c47.unload.1": ["Preparing the cargo drop.", "准备降落卸载。", "화물 투하 준비합니다."],
  "voice.crew.ground.select.1": ["Crew standing by.", "等待指令。", "승무원 대기 중."],
  "voice.crew.ground.move.1": ["On our way.", "开始机动。", "가는 중이다."],
  "voice.crew.ground.attack.1": ["Engaging the target.", "准备攻击。", "표적 교전한다."],
  "voice.crew.ground.hold.1": ["Holding position.", "原地待命。", "현 위치 사수."],
  "voice.crew.ground.build.1": ["Getting to work.", "准备施工。", "작업 시작한다."],
  "voice.crew.ground.buildBlocked.1": ["Cannot build there.", "指定位置无法施工。", "거기에는 지을 수 없습니다."],
  "voice.crew.ground.repair.1": ["We'll patch it up.", "准备维修。", "우리가 수리하지."],
  "voice.crew.ground.load.1": ["Moving to board.", "准备就位。", "탑승하러 간다."],
  "voice.crew.ground.unload.1": ["Preparing to unload.", "准备卸载。", "하차 준비한다."],
  "voice.crew.ground.protect.1": ["We've got your back.", "随队掩护。", "뒤는 우리가 맡지."],
  "voice.crew.ground.ability.1": ["On it, command.", "收到。", "알았다, 사령부."],
  "voice.crew.air.select.1": ["Flight standing by.", "等待任务。", "비행 대기 중."],
  "voice.crew.air.move.1": ["Copy. Moving to your mark.", "调整航向。", "수신. 지정 지점으로 이동합니다."],
  "voice.crew.air.attack.1": ["Copy. Starting the attack.", "准备攻击。", "수신. 공격 시작합니다."],
  "voice.crew.air.hold.1": ["Standing by for orders.", "保持当前位置。", "명령 대기합니다."],
  "voice.crew.air.build.1": ["Copy. Starting work.", "准备作业。", "수신. 작업 시작합니다."],
  "voice.crew.air.buildBlocked.1": ["Cannot build there.", "指定位置无法施工。", "거기에는 지을 수 없습니다."],
  "voice.crew.air.repair.1": ["Copy. On the repair job.", "执行维修任务。", "수신. 수리 작업 들어갑니다."],
  "voice.crew.air.load.1": ["Coming in for pickup.", "准备就位。", "탑승 지점으로 접근합니다."],
  "voice.crew.air.unload.1": ["Preparing to unload.", "准备卸载。", "하차 준비합니다."],
  "voice.crew.air.protect.1": ["Staying with you.", "执行护航任务。", "곁을 지키겠습니다."],
  "voice.crew.air.ability.1": ["Copy. On it.", "收到。", "수신. 실행합니다."],
  "voice.crew.naval.select.1": ["Standing by, command.", "等待指示。", "사령부, 대기 중입니다."],
  "voice.crew.naval.move.1": ["Aye, underway.", "改变航向。", "알겠습니다. 항해합니다."],
  "voice.crew.naval.attack.1": ["Aye, engaging.", "准备交战。", "알겠습니다. 교전합니다."],
  "voice.crew.naval.hold.1": ["Holding station.", "保持阵位。", "현 위치 유지합니다."],
  "voice.crew.naval.build.1": ["Aye, starting work.", "准备施工。", "알겠습니다. 작업 시작합니다."],
  "voice.crew.naval.buildBlocked.1": ["Cannot build there.", "指定位置无法施工。", "거기에는 지을 수 없습니다."],
  "voice.crew.naval.repair.1": ["Repair crew, on the job.", "准备维修。", "수리반, 작업 들어갑니다."],
  "voice.crew.naval.load.1": ["Preparing to take them aboard.", "准备就位。", "승선 준비합니다."],
  "voice.crew.naval.unload.1": ["Preparing to disembark.", "准备卸载。", "하선 준비합니다."],
  "voice.crew.naval.protect.1": ["Taking escort station.", "进入护航阵位。", "호위 위치 잡습니다."],
  "voice.crew.naval.ability.1": ["Aye, carrying out orders.", "收到。", "알겠습니다. 명령 수행합니다."],
  "voice.unit.htank.select.1": ["Heavy armor ready.", "主炮待命。", "중장갑 준비 완료."],
  "voice.unit.htank.move.1": ["Getting this beast moving.", "开始推进。", "이 덩치 좀 움직여 볼까."],
  "voice.unit.htank.attack.1": ["Bringing the big guns around.", "主炮瞄准，准备射击。", "주포 돌린다."],
  "voice.unit.hercules.select.1": ["Recovery crew ready.", "请指示抢修位置。", "구난반 준비 완료."],
  "voice.unit.hercules.move.1": ["On our way. Hang tight.", "向指定位置机动。", "가는 중이다. 조금만 버텨."],
  "voice.unit.hercules.repair.1": ["We'll get you rolling.", "准备抢修。", "다시 굴러가게 해 주지."],
  "voice.unit.fighter.select.1": ["Ready for tasking.", "等待截击任务。", "임무 대기 중."],
  "voice.unit.fighter.move.1": ["Copy. Changing heading.", "改变航向。", "수신. 기수 돌립니다."],
  "voice.unit.fighter.attack.1": ["Moving to intercept.", "执行截击任务。", "요격하러 갑니다."],
  "voice.unit.heli.select.1": ["Go ahead.", "等待攻击指令。", "말해라."],
  "voice.unit.heli.move.1": ["Copy. Coming around.", "飞往指定位置。", "수신. 선회한다."],
  "voice.unit.heli.attack.1": ["Lining up the shot.", "调整攻击位置。", "사격각 잡는 중."],
  "voice.unit.destroyer.select.1": ["Guns standing by.", "等待作战指令。", "함포 대기 중."],
  "voice.unit.destroyer.move.1": ["Aye, setting course.", "调整航向。", "알겠습니다. 침로 설정합니다."],
  "voice.unit.destroyer.attack.1": ["Bringing guns to bear.", "执行攻击命令。", "함포를 표적으로 돌립니다."],
  "voice.unit.sub.select.1": ["Listening.", "声呐保持监听。", "듣고 있습니다."],
  "voice.unit.sub.move.1": ["Aye. Keeping it quiet.", "保持潜航，调整航向。", "알겠습니다. 조용히 이동합니다."],
  "voice.unit.sub.attack.1": ["Setting up a torpedo run.", "准备鱼雷攻击。", "어뢰 공격 침로 잡습니다."],
  // Authored reference world shipped with the World Editor.
  // Portable official custom game content.
  "world.hotzone.title": ["Hotzone — Strategic Sectors", "热区争夺 — 战略区域", "핫존 — 전략 구역"],
  "world.hotzone.description": ["A combined-arms struggle for an inland relay, an island harbour and an offshore shipping lane.", "陆海空力量争夺内陆中继站、岛屿港湾与近海航道。", "내륙 중계소, 섬 항구, 해상 항로를 둘러싼 육해공 전투입니다."],
  "world.hotzone.mapDescription": ["Coastal bases face a wooded ridge, an island harbour and open water.", "海岸基地之间横亘着林地山脊、岛屿港湾与开阔海域。", "해안 기지 사이에 숲이 우거진 능선과 섬 항구, 넓은 바다가 놓여 있습니다."],
  "world.hotzone.solo": ["Strategic Sectors · Solo vs AI", "战略区域 · 单人对抗 AI", "전략 구역 · AI 상대 싱글"],
  "world.hotzone.versus": ["Strategic Sectors · 1v1", "战略区域 · 1 对 1", "전략 구역 · 1대1"],
  "world.hotzone.ridge": ["Ridge Relay", "山脊中继站", "능선 중계소"],
  "world.hotzone.harbour": ["Island Harbour", "岛屿港湾", "섬 항구"],
  "world.hotzone.shipping": ["Shipping Lane", "近海航道", "해상 항로"],
  "world.hotzone.redBase": ["Red staging area", "红方集结区", "레드 집결지"],
  "world.hotzone.objective": ["Control two sectors to drain enemy reserves, or eliminate the enemy.", "控制两个区域以消耗敌方储备，或消灭敌军。", "두 구역을 장악해 적 예비 전력을 소모시키거나 적을 섬멸하십시오."],
  "world.hotzone.sector.ridge": ["Ridge Relay: {0} · {1}/{2}s", "山脊中继站：{0} · {1}/{2}秒", "능선 중계소: {0} · {1}/{2}초"],
  "world.hotzone.sector.harbour": ["Island Harbour: {0} · {1}/{2}s", "岛屿港湾：{0} · {1}/{2}秒", "섬 항구: {0} · {1}/{2}초"],
  "world.hotzone.sector.shipping": ["Shipping Lane: {0} · {1}/{2}s", "近海航道：{0} · {1}/{2}秒", "해상 항로: {0} · {1}/{2}초"],
  "world.hotzone.tickets0": ["Blue reserves: {0}", "蓝方储备：{0}", "블루 예비 전력: {0}"],
  "world.hotzone.tickets1": ["Red reserves: {0}", "红方储备：{0}", "레드 예비 전력: {0}"],
  "world.hotzone.active0": ["Blue active sectors: {0}/3", "蓝方有效区域：{0}/3", "블루 유효 구역: {0}/3"],
  "world.hotzone.active1": ["Red active sectors: {0}/3", "红方有效区域：{0}/3", "레드 유효 구역: {0}/3"],
  "world.hotzone.brief": ["Both sides begin with 900 reserves. Hold an uncontested sector with an armed ground, amphibious or naval unit for 12 seconds to capture it. Ownership persists when empty. Enemy surface forces interrupt its contribution immediately; aircraft and builders cannot capture or contest. After a two-minute deployment period, holding two active sectors drains one enemy reserve per second; all three drain two. Zero reserves loses the match.", "双方初始拥有 900 点储备。武装地面、两栖或海军单位在无争夺的区域停留 12 秒即可占领。部队离开后仍保有控制权；敌方地面或海上战斗单位进入即中断该区域的贡献。飞机和工程单位无法占领或争夺。两分钟部署期结束后，控制两个有效区域每秒消耗敌方 1 点储备，控制全部三个则消耗 2 点。储备归零即告失败。", "양측은 예비 전력 900으로 시작합니다. 무장한 지상·수륙양용·해군 유닛이 적 없이 12초 동안 구역을 지키면 점령합니다. 비워도 소유권은 유지되지만 적 지상·해상 전투 유닛이 들어오면 즉시 점령 효과가 중단됩니다. 항공기와 건설 유닛은 점령하거나 경합할 수 없습니다. 2분의 배치 시간 후 유효 구역 두 곳은 초당 적 예비 전력 1, 세 곳은 2를 소모시킵니다. 예비 전력이 0이 되면 패배합니다."],
  "world.hotzone.economy": ["Expand extractors and offshore rigs, protect power and production, and research the normal tech tree. Reinforcements must be produced. The island has ore and space for a forward base; fleets can contest its harbour approaches. Normal Conquest elimination and last-stand rules also apply.", "扩张采矿设施与海上平台，保护电力和生产设施，研究正常科技树。所有增援都需要生产。岛上有矿床与前进基地空间，舰队也可争夺港湾入口。同时适用征服模式的常规淘汰和背水一战规则。", "채굴기와 해상 플랫폼을 확장하고 전력과 생산 시설을 지키며 일반 기술을 연구하십시오. 증원은 직접 생산해야 합니다. 섬에는 광상과 전진 기지 공간이 있으며 함대도 항구 진입로를 경합할 수 있습니다. 일반 정복전의 탈락 및 최후 항전 규칙도 적용됩니다."],
  "world.hotzone.briefSolo": ["Command Blue against Red. The opponent develops its base and directs surface forces toward the sectors.", "指挥蓝方对抗红方。对手会发展基地并调遣地面及海上部队争夺区域。", "블루를 지휘해 레드와 싸우십시오. 적은 기지를 발전시키며 지상·해상 병력을 구역으로 보냅니다."],
  "world.hotzone.briefVersus": ["Two commanders, opposing teams, identical openings and sector rules.", "两名指挥官分属敌对阵营，采用相同的开局配置与区域规则。", "두 지휘관이 서로 다른 팀에서 동일한 시작 전력과 구역 규칙으로 대결합니다."],
  "world.hotzone.guide": ["Strategic sectors", "战略区域", "전략 구역"],
  "world.hotzone.guideBody": ["Capture with armed surface units. Two active sectors drain reserves after deployment; enemy presence interrupts control. Build your economy and replacements. Aircraft support all three fronts.", "用武装地面或海上单位占领区域。部署期后，两个有效区域即可消耗敌方储备；敌军进入会中断控制效果。发展经济并生产补充兵力，空军可支援三条战线。", "무장한 지상·해상 유닛으로 점령하십시오. 배치 시간 후 두 유효 구역이 적 예비 전력을 소모시키며 적 진입 시 효과가 중단됩니다. 경제를 확장하고 병력을 보충하십시오. 항공기는 세 전선을 모두 지원합니다."],
  "world.hotzone.opening": ["Hotzone: establish your economy and secure the sectors. Reserve drain begins after deployment.", "热区争夺：发展经济并夺取区域，部署期后开始消耗储备。", "핫존: 경제를 구축하고 구역을 확보하십시오. 배치 시간 후 예비 전력 소모가 시작됩니다."],
  "world.hotzone.deploymentOver": ["Deployment complete. Sector majority now drains enemy reserves.", "部署期结束，区域多数控制开始消耗敌方储备。", "배치 시간이 끝났습니다. 구역 과반 장악으로 적 예비 전력이 소모됩니다."],
  "world.hotzone.neutral": ["Neutral", "中立", "중립"],
  "world.hotzone.blue": ["Blue control", "蓝方控制", "블루 장악"],
  "world.hotzone.red": ["Red control", "红方控制", "레드 장악"],
  "world.hotzone.blueCapturing": ["Blue capturing", "蓝方占领中", "블루 점령 중"],
  "world.hotzone.redCapturing": ["Red capturing", "红方占领中", "레드 점령 중"],
  "world.hotzone.contested": ["Contested", "争夺中", "경합 중"],
  "world.hotzone.captured0": ["Blue secured {0}.", "蓝方已控制{0}。", "블루가 {0} 확보."],
  "world.hotzone.captured1": ["Red secured {0}.", "红方已控制{0}。", "레드가 {0} 확보."],
  "world.hotzone.wins0": ["Blue wins: Red reserves exhausted.", "蓝方获胜：红方储备耗尽。", "블루 승리: 레드 예비 전력 소진."],
  "world.hotzone.wins1": ["Red wins: Blue reserves exhausted.", "红方获胜：蓝方储备耗尽。", "레드 승리: 블루 예비 전력 소진."],
  "world.hotzone.ruleOpening.name": ["Opening reserves", "初始储备", "시작 예비 전력"],
  "world.hotzone.ruleOpening.desc": ["Initialize both reserves from the editable value and mark the sectors.", "按可编辑值初始化双方储备并标记区域。", "편집 가능한 값으로 양측 예비 전력을 초기화하고 구역을 표시합니다."],
  "world.hotzone.ruleCapture.ridge.name": ["Capture the ridge", "占领山脊", "능선 점령"],
  "world.hotzone.ruleCapture.ridge.desc": ["Track uncontested surface presence, capture progress and persistent ownership at the ridge.", "记录山脊的无争夺地面兵力、占领进度与持续控制权。", "능선의 지상·해상 병력, 점령 진행 및 유지되는 소유권을 기록합니다."],
  "world.hotzone.ruleCapture.harbour.name": ["Capture the island harbour", "占领岛屿港湾", "섬 항구 점령"],
  "world.hotzone.ruleCapture.harbour.desc": ["Count troops on the island and vessels in its approaches toward harbour control.", "岛上部队与港口入口舰船均可参与港湾争夺。", "섬의 지상군과 항구 진입로의 함선으로 항구 점령을 판정합니다."],
  "world.hotzone.ruleCapture.shipping.name": ["Capture the shipping lane", "占领航道", "항로 점령"],
  "world.hotzone.ruleCapture.shipping.desc": ["Track control of the offshore sector; aircraft do not capture or contest.", "记录近海区域控制权，飞机不能占领或争夺。", "해상 구역의 장악 상태를 기록합니다. 항공기는 점령하거나 경합할 수 없습니다."],
  "world.hotzone.ruleReserves.name": ["Majority drains reserves", "多数控制消耗储备", "과반 점령 시 예비 전력 소모"],
  "world.hotzone.ruleReserves.desc": ["After all captures update, count unthreatened owned sectors. Two drain one reserve per second; three drain two, after deployment.", "全部占领状态更新后计算未受威胁的已控制区域。部署期后，两个区域每秒消耗一点储备，三个消耗两点。", "모든 점령 상태 갱신 후 위협받지 않는 소유 구역을 셉니다. 배치 시간 후 두 구역은 초당 1, 세 구역은 2를 소모시킵니다."],
  "world.hotzone.ruleDeployment.name": ["Deployment ends", "部署期结束", "배치 시간 종료"],
  "world.hotzone.ruleDeployment.desc": ["Announce the start of reserve drain once, using the editable deployment time.", "根据可编辑的部署时间，一次性播报储备消耗开始。", "편집 가능한 배치 시간이 지나면 예비 전력 소모 시작을 한 번 알립니다."],
  "world.hotzone.ruleAI.name": ["AI sector assignments", "AI 区域调度", "AI 구역 배치"],
  "world.hotzone.ruleAI.desc": ["Direct surface detachments to sectors; leave economy, aircraft and base defence to the normal AI. Suspend assignments while the base is attacked.", "引导地面及海上分队争夺区域；经济、空军与基地防御由常规 AI 负责。基地遭袭时暂停区域调度。", "지상·해상 분대를 구역으로 보내고 경제, 항공 작전, 기지 방어는 일반 AI에 맡깁니다. 기지 공격 시 구역 배치를 중단합니다."],
  "world.hotzone.ruleVictory.name": ["Reserve victory", "储备胜利", "예비 전력 승리"],
  "world.hotzone.ruleVictory.desc": ["End the match when one side has no reserves and the other still has some. Normal elimination remains enabled.", "一方储备耗尽而另一方仍有储备时结束比赛，常规淘汰仍然有效。", "한쪽의 예비 전력이 소진되고 상대에게 남아 있으면 경기를 종료합니다. 일반 섬멸 승리도 유지됩니다."],
  "world.td.title": ["Harbour Siege", "港湾围城", "항만 공방전"],
  "world.td.description": ["Tower defence across roads, sea lanes and air corridors. Includes the Lane Defence tutorial and Harbour Siege.", "横跨道路、航道与空中走廊的塔防战。包含防线塔防教程和港湾围城。", "도로, 항로, 공중 회랑을 지키는 타워 디펜스. 경로 방어 튜토리얼과 항만 공방전이 포함됩니다."],
  "world.td.mapDescription": ["A coastal fortress between winding supply roads and a busy shipping channel.", "蜿蜒补给道路与繁忙航道之间的海岸要塞。", "굽이치는 보급로와 분주한 항로 사이의 해안 요새."],
  "world.td.tutorial": ["Lane Defence — Tutorial", "防线塔防 — 教程", "경로 방어 — 튜토리얼"],
  "world.td.tutorialSelect": ["Select an engineer", "选择工程车", "공병 선택"],
  "world.td.tutorialSelectBody": ["Select either engineer to open its construction menu.", "选择任意工程车，打开建造菜单。", "공병 하나를 선택해 건설 메뉴를 여세요."],
  "world.td.tutorialBuild": ["Build beside the road", "在道路旁建造", "도로 옆에 건설"],
  "world.td.tutorialBuildBody": ["Place a Sentry tower in a marked construction zone. The first wave arrives after 30 seconds.", "在标记的建造区域内放置哨戒塔。第一波将在30秒后抵达。", "표시된 건설 구역에 감시탑을 배치하세요. 첫 공격은 30초 후에 시작됩니다."],
  "world.td.tutorialHold": ["Grow the defence", "扩建防线", "방어선 확장"],
  "world.td.tutorialHoldBody": ["Kills earn metal. Select a completed Sentry to upgrade it, or add Cannon towers for heavy vehicles. Stop ten waves; escaping vehicles cost lives.", "击杀可获得金属。选择建成的哨戒塔进行升级，或增建火炮塔对付重型车辆。阻止十波敌军；逃脱车辆会消耗生命。", "적을 파괴하면 금속을 얻습니다. 완성된 감시탑을 선택해 업그레이드하거나 중장갑 차량에 맞설 포탑을 추가하세요. 열 차례의 공격을 막으세요. 탈출한 차량은 목숨을 소모합니다."],
  "world.td.brief": ["Hold the harbour through 18 waves with 30 integrity. Two road approaches, a shipping channel and an air corridor share one defence budget. You have 45 seconds to prepare, then 20 seconds after each cleared wave. The forecast lists the next attack before it arrives.", "以30点防线耐久抵挡18波进攻。两条道路、一条航道和一条空中走廊共用建造预算。开局准备45秒，每波清除后准备20秒。预报会提前列出下一波进攻。", "내구도 30으로 18차례의 공격을 막으세요. 두 도로와 항로, 공중 회랑이 하나의 방어 예산을 공유합니다. 시작 준비 시간은 45초, 각 공격 격퇴 후에는 20초입니다. 예보에 다음 공격이 미리 표시됩니다."],
  "world.td.arsenal": ["Repeaters cover light ground columns; Cannons engage armour and ships; Flak covers aircraft; Mortars strike clustered surface targets but have a minimum range. Each has a paid upgrade. Build on the sand pads; the roads and water remain open.", "连射塔对付轻型地面纵队，岸炮对付装甲与舰船，高射塔对付飞机，迫击炮打击密集水面及地面目标，但存在最小射程。每类塔均可付费升级。在沙色阵地上建造，道路与水面保持畅通。", "연사탑은 경차량, 대포는 장갑과 함선, 대공포는 항공기, 박격포는 밀집된 지상 및 수상 목표를 상대합니다. 박격포에는 최소 사거리가 있습니다. 각 포탑은 금속으로 업그레이드할 수 있습니다. 모래색 진지에 건설하세요. 도로와 물길은 비워 둡니다."],
  "world.td.economy": ["Kills pay bounties: runner 10, armour 26, ship 32, aircraft 16, behemoth 160, flagship 220 metal. Clearing a wave pays 100 + 10 × wave number. Escapes pay nothing and cost 1 integrity for runners or aircraft, 2 for armour or ships, 5 for behemoths and 6 for flagships. There is no passive income.", "击杀赏金：突进车10、装甲车26、舰船32、飞机16、巨兽160、旗舰220金属。清除奖励为100＋10×波次。逃脱无赏金：突进车或飞机扣1点耐久，装甲车或舰船扣2点，巨兽扣5点，旗舰扣6点。没有被动收入。", "처치 보상은 돌격 차량 10, 장갑 차량 26, 함선 32, 항공기 16, 거수 160, 기함 220 금속입니다. 격퇴 보상은 100 + 공격 차수 × 10입니다. 탈출 시 보상 없이 내구도가 감소합니다. 차량과 항공기는 1, 장갑과 함선은 2, 거수는 5, 기함은 6입니다. 자동 수입은 없습니다."],
  "world.td.objective": ["Survive all 18 waves", "守住全部18波进攻", "18차례의 공격에서 생존"],
  "world.td.forecast": ["Wave {0}: {1}", "第{0}波：{1}", "{0}차 공격: {1}"],
  "world.td.lives": ["Integrity: {0} / 30", "防线耐久：{0} / 30", "내구도: {0} / 30"],
  "world.td.wave": ["Wave: {0} / 18", "波次：{0} / 18", "공격: {0} / 18"],
  "world.td.countdown": ["Preparation: {0}s", "准备：{0}秒", "준비: {0}초"],
  "world.td.incoming": ["Wave {0} is entering the harbour.", "第{0}波正在进入港湾。", "{0}차 공격이 항만에 진입합니다."],
  "world.td.opening": ["Harbour defence ready. Check the forecast and prepare the sand positions.", "港湾防线就绪。查看预报，在沙色阵地准备防御。", "항만 방어 준비 완료. 예보를 확인하고 모래색 진지를 준비하세요."],
  "world.td.cleared": ["Wave cleared. Construction funds received; the next forecast is ready.", "本波已清除。建造资金到账，下一波预报已更新。", "공격 격퇴. 건설 자금을 받았습니다. 다음 공격 예보를 확인하세요."],
  "world.td.guide": ["Harbour defence", "港湾防御", "항만 방어"],
  "world.td.guideBody": ["Build on the marked sand pads. Read the wave forecast, cover land, sea and air, and select completed towers to upgrade them.", "在标记的沙色阵地建造。查看波次预报，兼顾陆海空防御，选择建成的塔进行升级。", "표시된 모래색 진지에 건설하세요. 공격 예보를 확인하고 육해공을 방어하며 완성된 포탑을 선택해 업그레이드하세요."],
  "world.td.exit": ["Harbour perimeter", "港湾边界", "항만 경계"],
  "world.td.pad.ridge": ["Ridge battery", "山脊炮位", "능선 포대"],
  "world.td.pad.inner": ["Inner battery", "内侧炮位", "내측 포대"],
  "world.td.pad.central": ["Central battery", "中央炮位", "중앙 포대"],
  "world.td.pad.quay": ["Quayside battery", "码头炮位", "부두 포대"],
  "world.td.pad.reserve": ["Reserve battery", "后备炮位", "예비 포대"],
  "world.td.lane.north": ["Northern road", "北侧道路", "북쪽 도로"],
  "world.td.lane.south": ["Southern road", "南侧道路", "남쪽 도로"],
  "world.td.lane.sea": ["Shipping channel", "海运航道", "해상 항로"],
  "world.td.lane.air": ["Air corridor", "空中走廊", "공중 회랑"],
  "world.td.repeater": ["Repeater tower", "连射塔", "연사탑"],
  "world.td.repeater2": ["Gatling battery", "加特林炮位", "개틀링 포대"],
  "world.td.repeaterDesc": ["A rapid-fire ground defence emplacement.", "速射地面防御阵地。", "속사 지상 방어 진지."],
  "world.td.cannon": ["Coastal cannon", "岸防炮", "해안포"],
  "world.td.cannon2": ["Heavy coastal cannon", "重型岸防炮", "중해안포"],
  "world.td.cannonDesc": ["An armoured gun overlooking the roads and sea.", "俯瞰道路与海面的装甲火炮。", "도로와 바다를 내려다보는 장갑 포대."],
  "world.td.flak": ["Flak battery", "高射炮位", "대공포대"],
  "world.td.flak2": ["Missile battery", "导弹炮位", "미사일 포대"],
  "world.td.flakDesc": ["A dedicated harbour air defence position.", "港湾专用防空阵地。", "항만 전용 방공 진지."],
  "world.td.mortar": ["Mortar battery", "迫击炮位", "박격포대"],
  "world.td.mortar2": ["Heavy mortar battery", "重型迫击炮位", "중박격포대"],
  "world.td.mortarDesc": ["An indirect-fire position covering the approaches.", "覆盖进港通道的间接火力阵地。", "진입로를 담당하는 간접 화력 진지."],
  "world.td.runner": ["Raider", "突进车", "돌격 차량"],
  "world.td.runnerDesc": ["A fast vehicle heading for the harbour perimeter.", "驶向港湾边界的快速车辆。", "항만 경계를 향하는 고속 차량."],
  "world.td.armour": ["Armoured column", "装甲纵队", "장갑 차량"],
  "world.td.armourDesc": ["A heavy tracked vehicle on the coastal roads.", "沿海岸道路前进的重型履带车辆。", "해안 도로를 달리는 중장갑 궤도 차량."],
  "world.td.ship": ["Blockade runner", "突围舰", "봉쇄 돌파선"],
  "world.td.shipDesc": ["A reinforced hull crossing the harbour channel.", "穿越港湾航道的强化舰艇。", "항만 수로를 통과하는 강화 선체의 함선."],
  "world.td.aircraft": ["Air raider", "空袭机", "공중 돌격기"],
  "world.td.aircraftDesc": ["A low-flying aircraft crossing the harbour.", "低空穿越港湾的飞机。", "항만을 저공으로 가로지르는 항공기."],
  "world.td.behemoth": ["Behemoth", "巨兽", "거수"],
  "world.td.behemothDesc": ["A massive armoured spearhead leading the road columns.", "引领道路纵队的巨型装甲先锋。", "도로 대열을 이끄는 거대한 장갑 선봉."],
  "world.td.flagship": ["Siege flagship", "攻城旗舰", "공성 기함"],
  "world.td.flagshipDesc": ["A capital ship at the head of the blockade fleet.", "率领封锁舰队的主力战舰。", "봉쇄 함대의 선두에 선 주력함."],
  "world.td.wave1": ["North: 10 raiders", "北路：10辆突进车", "북쪽: 돌격 차량 10"],
  "world.td.wave2": ["South: 12 raiders", "南路：12辆突进车", "남쪽: 돌격 차량 12"],
  "world.td.wave3": ["North: 3 armour · South: 8 raiders", "北路：3辆装甲车 · 南路：8辆突进车", "북쪽: 장갑 3 · 남쪽: 돌격 차량 8"],
  "world.td.wave4": ["Sea: 4 ships · North: 8 raiders", "海路：4艘舰船 · 北路：8辆突进车", "바다: 함선 4 · 북쪽: 돌격 차량 8"],
  "world.td.wave5": ["Air: 5 aircraft · South: 4 armour", "空中：5架飞机 · 南路：4辆装甲车", "공중: 항공기 5 · 남쪽: 장갑 4"],
  "world.td.wave6": ["North: behemoth · South: 10 raiders · Sea: 4 ships", "北路：巨兽 · 南路：10辆突进车 · 海路：4艘舰船", "북쪽: 거수 · 남쪽: 돌격 차량 10 · 바다: 함선 4"],
  "world.td.wave7": ["Both roads: 12 raiders each · Air: 6 aircraft", "两路：各12辆突进车 · 空中：6架飞机", "양쪽 도로: 돌격 차량 각 12 · 공중: 항공기 6"],
  "world.td.wave8": ["Sea: 8 ships · North: 6 armour", "海路：8艘舰船 · 北路：6辆装甲车", "바다: 함선 8 · 북쪽: 장갑 6"],
  "world.td.wave9": ["Air: 10 aircraft · South: 14 raiders", "空中：10架飞机 · 南路：14辆突进车", "공중: 항공기 10 · 남쪽: 돌격 차량 14"],
  "world.td.wave10": ["North: 8 armour · Sea: 8 ships", "北路：8辆装甲车 · 海路：8艘舰船", "북쪽: 장갑 8 · 바다: 함선 8"],
  "world.td.wave11": ["Air: 8 aircraft · Sea: 6 ships · South: 6 armour", "空中：8架飞机 · 海路：6艘舰船 · 南路：6辆装甲车", "공중: 항공기 8 · 바다: 함선 6 · 남쪽: 장갑 6"],
  "world.td.wave12": ["Sea: flagship · North: behemoth · Air: 6 aircraft", "海路：旗舰 · 北路：巨兽 · 空中：6架飞机", "바다: 기함 · 북쪽: 거수 · 공중: 항공기 6"],
  "world.td.wave13": ["Both roads: 20 raiders each · Sea: 8 ships", "两路：各20辆突进车 · 海路：8艘舰船", "양쪽 도로: 돌격 차량 각 20 · 바다: 함선 8"],
  "world.td.wave14": ["South: 12 armour · Air: 14 aircraft", "南路：12辆装甲车 · 空中：14架飞机", "남쪽: 장갑 12 · 공중: 항공기 14"],
  "world.td.wave15": ["Sea: 14 ships · Air: 10 aircraft · North: 14 raiders", "海路：14艘舰船 · 空中：10架飞机 · 北路：14辆突进车", "바다: 함선 14 · 공중: 항공기 10 · 북쪽: 돌격 차량 14"],
  "world.td.wave16": ["North: 2 behemoths · South: 10 armour · Sea: 10 ships", "北路：2辆巨兽 · 南路：10辆装甲车 · 海路：10艘舰船", "북쪽: 거수 2 · 남쪽: 장갑 10 · 바다: 함선 10"],
  "world.td.wave17": ["Air: 20 aircraft · Sea: 12 ships · North: 10 armour", "空中：20架飞机 · 海路：12艘舰船 · 北路：10辆装甲车", "공중: 항공기 20 · 바다: 함선 12 · 북쪽: 장갑 10"],
  "world.td.wave18": ["North: 2 behemoths · Sea: 2 flagships · Air: 16 aircraft · South: 20 raiders", "北路：2辆巨兽 · 海路：2艘旗舰 · 空中：16架飞机 · 南路：20辆突进车", "북쪽: 거수 2 · 바다: 기함 2 · 공중: 항공기 16 · 남쪽: 돌격 차량 20"],
  "world.td.ruleOpening.name": ["Opening briefing", "开场简报", "시작 브리핑"],
  "world.td.ruleOpening.desc": ["Announce the preparation period.", "播报准备阶段。", "준비 시간을 알립니다."],
  "world.td.ruleBounty.name": ["Kill bounty", "击杀赏金", "처치 보상"],
  "world.td.ruleBounty.desc": ["Pay for destroyed enemies; escapes give no metal.", "摧毁敌人获得金属，逃脱不获得金属。", "파괴된 적에만 금속을 지급합니다."],
  "world.td.ruleEscape.name": ["Perimeter breach", "突破边界", "경계 돌파"],
  "world.td.ruleEscape.desc": ["Deduct integrity by enemy type and remove the escaped unit.", "按敌人类型扣除耐久并移除逃脱单位。", "적 종류에 따라 내구도를 차감하고 탈출한 유닛을 제거합니다."],
  "world.td.ruleResult.name": ["Match result", "对局结果", "경기 결과"],
  "world.td.ruleResult.desc": ["Integrity decides defeat; clearing the final dispatch decides victory.", "耐久耗尽判负，清除最后一批敌军判胜。", "내구도가 소진되면 패배하고 마지막 부대를 격퇴하면 승리합니다."],
  "world.td.ruleClock.name": ["Wave clock", "波次时钟", "공격 시계"],
  "world.td.ruleClock.desc": ["Show preparation time and dispatch the next wave when it expires.", "显示准备时间，到时派出下一波。", "준비 시간을 표시하고 종료 시 다음 공격을 시작합니다."],
  "world.td.ruleClear.name": ["Wave settlement", "波次结算", "공격 정산"],
  "world.td.ruleClear.desc": ["Wait for every dispatch and surviving enemy before paying the construction grant.", "全部批次派出且敌军清除后发放建造奖励。", "모든 부대가 투입되고 남은 적이 없어지면 건설 보상을 지급합니다."],
  "world.sample.td": ["Lane Defence", "防线塔防", "경로 방어"],
  "world.sample.tower": ["Sentry tower", "哨戒塔", "감시탑"],
  "world.sample.tower2": ["Veteran sentry tower", "精锐哨戒塔", "정예 감시탑"],
  "world.sample.towerDesc": ["A paired machine-gun emplacement beside the road.", "道路旁的双联机枪阵地。", "도로 옆의 쌍열 기관총 진지."],
  "world.sample.cannon": ["Cannon tower", "火炮塔", "포탑"],
  "world.sample.cannonDesc": ["An armoured cannon position overlooking the lane.", "俯瞰通道的装甲火炮阵地。", "경로를 내려다보는 장갑 포 진지."],
  "world.sample.runner": ["Runner", "突进车", "돌격 차량"],
  "world.sample.runnerDesc": ["A light vehicle driving the supply road.", "沿补给道路行进的轻型车辆。", "보급 도로를 달리는 경차량."],
  "world.sample.heavy": ["Heavy runner", "重型突进车", "중장갑 돌격 차량"],
  "world.sample.heavyDesc": ["A tracked vehicle at the heart of the column.", "纵队中心的履带车辆。", "행군 대열의 중심에 있는 궤도 차량."],
  "world.sample.entrance": ["Entrance", "入口", "입구"],
  "world.sample.exit": ["Exit", "出口", "출구"],
  "world.sample.buildZone": ["Construction zone", "建造区域", "건설 구역"],
  "world.sample.lane": ["Supply road", "补给道路", "보급 도로"],
  "world.sample.objective": ["Stop all ten waves", "阻止全部十波敌军", "열 차례의 공격을 모두 저지하세요"],
  "world.sample.lives": ["Lives: {0}", "生命：{0}", "목숨: {0}"],
  "world.sample.wave": ["Wave: {0} / 10", "波次：{0} / 10", "공격: {0} / 10"],
  "world.sample.waveIncoming": ["A column is entering the lane.", "一支纵队正在进入通道。", "행군 대열이 경로에 진입합니다."],
  "world.sample.brief": ["Build towers beside the road. Destroy the columns before they reach the exit. Each destroyed vehicle earns metal; each escaping vehicle costs a life. Clear a wave for a construction bonus and time to prepare. Survive ten waves to win.", "在道路旁建造防御塔，在纵队抵达出口前消灭它们。每摧毁一辆车可获得金属，每逃脱一辆车会损失一点生命。清除一波敌军可获得建造奖励和准备时间。坚持十波即可获胜。", "도로 옆에 탑을 건설하세요. 대열이 출구에 도달하기 전에 파괴하세요. 차량을 파괴하면 금속을 얻고, 차량이 탈출하면 목숨을 잃습니다. 공격을 막으면 건설 보너스와 준비 시간이 주어집니다. 열 번의 공격에서 살아남으면 승리합니다."],
  "backup.holds.worlds": ["{0} World Editor content files", "{0} 个世界编辑器内容文件", "월드 에디터 콘텐츠 파일 {0}개"],
  "backup.holds.worldCollections": ["{0} World Editor worlds", "{0} 个世界编辑器世界", "월드 에디터 월드 {0}개"]
};
const LANGS = ["en", "zh", "ko"];
let lang = "en";
function langIndex(l) {
  return LANGS.indexOf(l);
}
function pick(entry, l = lang) {
  return entry[langIndex(l)] ?? entry[0] ?? "";
}
const MAX_PLAYERS = 8;
const MIN_MAP_SIDE = 16;
const MAX_MAP_SIDE = 512;
var Terrain = /* @__PURE__ */ ((Terrain2) => {
  Terrain2[Terrain2["DeepWater"] = 0] = "DeepWater";
  Terrain2[Terrain2["Water"] = 1] = "Water";
  Terrain2[Terrain2["Sand"] = 2] = "Sand";
  Terrain2[Terrain2["Grass"] = 3] = "Grass";
  Terrain2[Terrain2["Forest"] = 4] = "Forest";
  Terrain2[Terrain2["Mountain"] = 5] = "Mountain";
  Terrain2[Terrain2["Road"] = 6] = "Road";
  Terrain2[Terrain2["Mud"] = 7] = "Mud";
  Terrain2[Terrain2["Marsh"] = 8] = "Marsh";
  Terrain2[Terrain2["Snow"] = 9] = "Snow";
  Terrain2[Terrain2["Rubble"] = 10] = "Rubble";
  Terrain2[Terrain2["Lava"] = 11] = "Lava";
  Terrain2[Terrain2["CliffNorth"] = 12] = "CliffNorth";
  Terrain2[Terrain2["CliffEast"] = 13] = "CliffEast";
  Terrain2[Terrain2["CliffSouth"] = 14] = "CliffSouth";
  Terrain2[Terrain2["CliffWest"] = 15] = "CliffWest";
  Terrain2[Terrain2["City"] = 16] = "City";
  Terrain2[Terrain2["Shallows"] = 17] = "Shallows";
  Terrain2[Terrain2["Ice"] = 18] = "Ice";
  Terrain2[Terrain2["Bridge"] = 19] = "Bridge";
  return Terrain2;
})(Terrain || {});
const TERRAIN_KINDS = 20;
({
  /** open pasture — the generator's old, and still most common, ground */
  meadow: { ground: Terrain.Grass, shore: Terrain.Sand, hollow: Terrain.Mud, height: Terrain.Mountain },
  /** conifer country: the same ground under a much lower treeline */
  boreal: { ground: Terrain.Grass, shore: Terrain.Sand, hollow: Terrain.Mud, height: Terrain.Mountain },
  /** frozen open ground, snow all the way to the water — no beaches this far north */
  tundra: { ground: Terrain.Snow, shore: Terrain.Snow, hollow: Terrain.Mud, height: Terrain.Mountain },
  /** sand from the waterline to the ridges, and nothing growing on it but the palms at an oasis */
  dunes: { ground: Terrain.Sand, shore: Terrain.Sand, hollow: Terrain.Sand, height: Terrain.Mountain },
  /** waterlogged lowland: marsh for a shore and marsh again behind it */
  fen: { ground: Terrain.Grass, shore: Terrain.Marsh, hollow: Terrain.Marsh, height: Terrain.Mountain },
  /** ash flats over old flows, scree at the water and lava in the peaks */
  ashland: { ground: Terrain.Sand, shore: Terrain.Rubble, hollow: Terrain.Rubble, height: Terrain.Lava }
});
const ARMOR_MATRIX = {
  // rapid-fire small arms: shred soft skins, ping off armor plate
  mg: { light: 1.5, medium: 0.8, heavy: 0.4, structure: 0.35, ship: 0.5, air: 0.7 },
  // light autocannons: soft skins and light armor, poor against heavy plate;
  // at a helicopter (`lowFlying`, the only aircraft they reach) a third —
  // the BMP's 30 mm cocks up to 74° for exactly that, and hits it seldom
  autocannon: { light: 1.5, medium: 1, heavy: 0.5, structure: 0.5, ship: 0.7, air: 0.35 },
  // tank guns: built for armored duels, over-penetrate soft targets
  cannon: { light: 0.6, medium: 1.3, heavy: 1, structure: 0.8, ship: 0.9 },
  // shaped-charge guided missiles: heavy armor only, wasted on light vehicles,
  // and a hull is holed rather than broken — 0.75 since 2026-09-27 (it was
  // 1.0, and the Cobra sank whole fleets that could not shoot back): what
  // sinks a ship is the anti-ship missile and the torpedo
  at: { light: 0.4, medium: 1.1, heavy: 1.8, structure: 0.7, ship: 0.75 },
  // high explosive: blast shreds soft targets and buildings, heavy plate shrugs
  he: { light: 1.2, medium: 1, heavy: 0.75, structure: 1.6, ship: 1 },
  // unguided rocket pods: vehicles of any weight, poor against bunkers
  rocket: { light: 1.4, medium: 1.4, heavy: 0.9, structure: 0.7, ship: 0.9 },
  // naval guns: general-purpose bombardment of shore and ship. Dual-purpose
  // mounts (the destroyer's) also fire on aircraft at a little over half;
  // the Aegis's deck gun targets only the surface, with SAMs for the sky.
  navgun: { light: 1, medium: 1, heavy: 0.75, structure: 0.75, ship: 1, air: 0.6 },
  ashm: { ship: 1.6 },
  torpedo: { ship: 1.3, sub: 1.2 },
  aa: { air: 1 }
};
const w = (def) => ({ ...def, mult: { ...ARMOR_MATRIX[def.cls], ...def.mult } });
const BROADSIDE = 150 * Math.PI / 180;
const resolveWeapon = w;
const MG = w({
  id: "mg",
  cls: "mg",
  dmg: 7,
  reload: 0.4,
  range: 3.6,
  projectile: "bullet",
  speed: 500,
  targets: ["ground"],
  turret: true,
  muzzleOffset: 9.5,
  sound: "mg"
});
const ROOF_MG = w({
  id: "roofmg",
  cls: "mg",
  dmg: 9,
  reload: 0.3,
  range: 4.5,
  projectile: "bullet",
  speed: 520,
  targets: ["air"],
  lowOnly: true,
  mult: { air: 0.7, light: 0.7 },
  sound: "mg"
});
const WARHEAD_MOTOR = [
  { sprite: "dec.afterburner", layer: "under", y: 12, scale: 0.6, when: "always" },
  { sprite: "dec.afterburner", layer: "under", y: 12, scale: 0.6, when: "night" }
];
const DEFS = {
  // ================================================================= LAND
  //
  // Every hull carries a `body` — the capsule `separation()` parts units by,
  // measured off the drawn silhouette. Land is mostly a question of *size*
  // rather than shape: a tank is only about 1.6 times as long as it is wide,
  // so its capsule is a short segment inside a much bigger circle than the
  // one it replaced (`radius` was around 60% of the drawn width). Aircraft
  // are the exception and keep their circles: a wing's widest span is across
  // the heading, which is the one shape a capsule along it cannot say, and
  // nothing in the air jams anyway.
  engineer: {
    id: "engineer",
    kind: "unit",
    aliases: ["eng", "builder"],
    domain: "ground",
    tier: 1,
    cost: 150,
    buildTime: 8,
    pop: 1,
    power: -1,
    hp: 200,
    armor: "light",
    detect: 3,
    speed: 70,
    turnRate: 5,
    vision: 7,
    radius: 8,
    weapons: [],
    body: { r: 8, len: 12 },
    builds: ["extractor", "platform", "power", "factory", "factory3", "navyard", "navyard3", "airbase", "airbase3", "mgturret", "cannonturret", "aaturret", "interceptor", "repairtower", "sandbag", "landmine", "warlab", "radar", "veil", "reactor", "nukesilo", "hq"],
    buildRate: 30,
    trail: "tread",
    sprite: "u.engineer"
  },
  buggy: {
    id: "buggy",
    kind: "unit",
    aliases: ["recon", "jeep"],
    domain: "ground",
    tier: 1,
    ability: "sprint",
    cost: 60,
    buildTime: 5,
    pop: 1,
    power: -1,
    hp: 150,
    armor: "light",
    detect: 4,
    speed: 120,
    turnRate: 6,
    vision: 10,
    radius: 7,
    body: { r: 10, len: 10 },
    weapons: [{ ...MG, sound: "mg" }],
    trail: "tire",
    sprite: "u.buggy"
  },
  ltank: {
    id: "ltank",
    kind: "unit",
    aliases: ["wolf", "light"],
    domain: "ground",
    tier: 1,
    ability: "smoke",
    cost: 120,
    buildTime: 9,
    pop: 1,
    power: -1,
    hp: 300,
    armor: "medium",
    directionalArmor: { front: 0.8, side: 1, rear: 1.2 },
    speed: 75,
    turnRate: 4.5,
    vision: 7,
    radius: 9,
    fireOnMove: true,
    body: { r: 10, len: 10 },
    weapons: [w({
      id: "autocannon",
      cls: "autocannon",
      dmg: 18,
      reload: 0.55,
      range: 4,
      projectile: "bullet",
      speed: 520,
      targets: ["ground", "ship"],
      turret: true,
      muzzleOffset: 20.5,
      sound: "autocannon"
    })],
    trail: "tread",
    sprite: "u.ltank",
    turretSprite: "tur.ltank"
  },
  mbt: {
    id: "mbt",
    kind: "unit",
    aliases: ["bison", "tank"],
    domain: "ground",
    tier: 2,
    ability: "countermeasures",
    cost: 280,
    buildTime: 18,
    pop: 2,
    power: -2,
    hp: 620,
    armor: "heavy",
    directionalArmor: { front: 0.8, side: 1, rear: 1.2 },
    speed: 60,
    turnRate: 3.6,
    vision: 7,
    radius: 10,
    fireOnMove: true,
    body: { r: 13, len: 12 },
    weapons: [w({
      id: "cannon",
      cls: "cannon",
      dmg: 60,
      reload: 1.8,
      range: 4.6,
      projectile: "shell",
      speed: 420,
      targets: ["ground", "ship"],
      turret: true,
      recoil: 1.6,
      muzzleOffset: 35.7,
      splash: 12,
      sound: "cannon"
    }), ROOF_MG],
    trail: "tread",
    sprite: "u.mbt",
    turretSprite: "tur.mbt",
    // on the commander's hatch, measured on `tur.mbt`
    airMount: { sprite: "tur.pintle", x: -2.6, y: 0.54 }
  },
  htank: {
    id: "htank",
    kind: "unit",
    aliases: ["mammoth", "heavy"],
    domain: "ground",
    tier: 3,
    ability: "countermeasures",
    cost: 900,
    buildTime: 45,
    pop: 4,
    power: -4,
    hp: 1900,
    armor: "heavy",
    directionalArmor: { front: 0.8, side: 1, rear: 1.2 },
    speed: 42,
    turnRate: 2.6,
    vision: 7,
    radius: 12,
    requires: ["radar"],
    cargoWeight: 4,
    body: { r: 21, len: 8 },
    weapons: [w({
      id: "twincannon",
      cls: "cannon",
      dmg: 55,
      reload: 1.8,
      range: 5.2,
      projectile: "shell",
      speed: 420,
      targets: ["ground", "ship"],
      mult: { heavy: 1.1, structure: 1 },
      turret: true,
      recoil: 2,
      muzzleOffset: 40.47,
      bores: 2,
      boreSpacing: 11.05,
      splash: 14,
      burst: 2,
      burstDelay: 0.18,
      sound: "cannon"
    }), ROOF_MG],
    trail: "tread",
    sprite: "u.htank",
    turretSprite: "tur.htank",
    // on the right-hand roof mounting plate, measured on `tur.htank`
    airMount: { sprite: "tur.pintle", x: 3.58, y: -1.12 }
  },
  td: {
    id: "td",
    kind: "unit",
    aliases: ["viper", "at"],
    domain: "ground",
    tier: 2,
    ability: "smoke",
    cost: 320,
    buildTime: 20,
    pop: 2,
    power: -2,
    hp: 340,
    armor: "medium",
    speed: 65,
    turnRate: 4,
    vision: 8,
    radius: 9,
    fireOnMove: true,
    body: { r: 16, len: 9 },
    weapons: [w({
      id: "atgm",
      cls: "at",
      dmg: 120,
      reload: 2.8,
      range: 7,
      projectile: "missile",
      speed: 300,
      // Twin canisters: concealed pivot (512,916), tips y=202, centres x=364/660;
      // a 16 × 18 art frame at scale 1.5625. One missile per reload, alternating.
      targets: ["ground", "ship"],
      turret: true,
      muzzleOffset: 13.0737,
      bores: 2,
      boreSpacing: 7.2266,
      homing: true,
      interceptable: true,
      sound: "missile"
    })],
    trail: "tire",
    sprite: "u.td",
    turretSprite: "tur.td"
  },
  /**
   * The Flak Track (2026-10-01): a Gepard, a Shilka. Its guns reach a tile
   * past a helicopter's missiles (6.5 to the Cobra's 5.5), so a Cobra that
   * comes for the column comes into them first, and it is armoured to take
   * the reply (360). And they fire on the ground too, at what a light
   * cannon does to it — the ZSU-23-4 was the gun the Soviet columns in
   * Afghanistan and Grozny turned on the hillsides — so a Flak Track in an
   * army is a gun in the army, not a unit waiting on the sky. It looks to the
   * sky first (`skyFirst` in game/combat.ts): an aircraft in reach takes it
   * off a target on the ground.
   */
  flak: {
    id: "flak",
    kind: "unit",
    aliases: ["flaktrack", "aa"],
    domain: "ground",
    tier: 1,
    cost: 170,
    buildTime: 12,
    pop: 1,
    power: -1,
    hp: 360,
    armor: "medium",
    speed: 70,
    turnRate: 4.5,
    vision: 9,
    radius: 9,
    body: { r: 14, len: 5 },
    weapons: [w({
      id: "flakgun",
      cls: "aa",
      dmg: 24,
      reload: 0.7,
      range: 6.5,
      projectile: "flak",
      speed: 460,
      targets: ["air", "ground", "ship"],
      mult: { air: 1, light: 0.9, medium: 0.6, heavy: 0.25, structure: 0.3, ship: 0.4 },
      turret: true,
      muzzleOffset: 19.3,
      sound: "flak"
    })],
    trail: "tread",
    sprite: "u.flak",
    turretSprite: "tur.flak"
  },
  sam: {
    id: "sam",
    kind: "unit",
    aliases: ["hawk", "aalauncher"],
    domain: "ground",
    tier: 2,
    cost: 400,
    buildTime: 22,
    pop: 2,
    power: -2,
    hp: 240,
    armor: "medium",
    speed: 60,
    turnRate: 4,
    vision: 10,
    radius: 9,
    body: { r: 13, len: 11 },
    // the blast is air-only, like every splash: it catches the flight round
    // the target and nothing under it (sam.test.ts). 125 dmg at 10 tiles since
    // 2026-09-17 (130 at 11.25 before): level with the SAM Site now, and still
    // two tiles past the longest thing in the air, the Albatross's missile
    weapons: [w({
      id: "sam",
      cls: "aa",
      dmg: 125,
      reload: 2.5,
      range: 10,
      projectile: "missile",
      speed: 420,
      targets: ["air"],
      turret: true,
      muzzleOffset: 21.7,
      bores: 2,
      boreSpacing: 7.44,
      splash: 24,
      homing: true,
      sound: "missile"
    })],
    trail: "tire",
    sprite: "u.sam",
    turretSprite: "tur.sam"
  },
  arty: {
    id: "arty",
    kind: "unit",
    aliases: ["thunder", "howitzer"],
    domain: "ground",
    tier: 2,
    ability: "barrage",
    cost: 420,
    buildTime: 24,
    pop: 2,
    power: -2,
    hp: 220,
    armor: "light",
    speed: 48,
    turnRate: 3,
    vision: 8,
    radius: 10,
    body: { r: 18, len: 17 },
    weapons: [w({
      id: "howitzer",
      cls: "he",
      dmg: 110,
      reload: 5,
      range: 11,
      minRange: 3,
      projectile: "shell",
      speed: 260,
      targets: ["ground", "ship"],
      muzzleOffset: 17,
      splash: 48,
      arc: true,
      spread: 26,
      sound: "arty"
    })],
    trail: "tread",
    sprite: "u.arty"
  },
  mlrs: {
    id: "mlrs",
    kind: "unit",
    aliases: ["tempest", "rockets"],
    domain: "ground",
    tier: 3,
    ability: "barrage",
    cost: 760,
    buildTime: 40,
    pop: 3,
    power: -3,
    hp: 380,
    armor: "medium",
    speed: 45,
    turnRate: 2.8,
    vision: 8,
    radius: 11,
    requires: ["radar"],
    cargoWeight: 4,
    body: { r: 20, len: 7 },
    weapons: [w({
      id: "rockets",
      cls: "he",
      dmg: 54,
      reload: 8,
      range: 13,
      minRange: 4,
      projectile: "rocket",
      speed: 300,
      // Inclined 2×3 muzzle face: pivot (512,520), columns x414/610,
      // rows y291/431/584 on the 1024×1536 master. A 20×30 art frame
      // at scale 1.5625; fire left/right pairs from front to rear.
      targets: ["ground", "ship"],
      muzzlePoints: [
        { forward: 6.988525390625, lateral: -2.99072265625 },
        { forward: 6.988525390625, lateral: 2.99072265625 },
        { forward: 2.716064453125, lateral: -2.99072265625 },
        { forward: 2.716064453125, lateral: 2.99072265625 },
        { forward: -1.953125, lateral: -2.99072265625 },
        { forward: -1.953125, lateral: 2.99072265625 }
      ],
      splash: 48,
      arc: true,
      burst: 8,
      burstDelay: 0.16,
      spread: 36,
      turret: true,
      sound: "rocket"
    })],
    trail: "tread",
    sprite: "u.mlrs",
    turretSprite: "tur.mlrs"
  },
  /**
   * The radar station's circle on wheels — smaller (16 tiles to its 24) but
   * the same kind of circle: it sees by radio (`radar`), so neither the night
   * nor the rain shrinks it and a stealth aircraft shows inside `detect`, and
   * every gun standing in it fires at its full reach. That is the unit: a
   * Tempest sees 8 tiles and throws 13, and beside an Owl the other five are
   * a siege that sees. It pays with everything else — no gun, thin plate,
   * and slow, so it is where the column is and not out ahead of it, and
   * killing it is the answer to the column. Level 2 factory and a radar;
   * the AI never fields it.
   */
  radarcar: {
    id: "radarcar",
    kind: "unit",
    aliases: ["owl", "sensor"],
    domain: "ground",
    tier: 3,
    cost: 480,
    buildTime: 26,
    pop: 2,
    power: -2,
    hp: 260,
    armor: "light",
    speed: 32,
    turnRate: 2.6,
    vision: 16,
    radius: 10,
    requires: ["radar"],
    radar: true,
    detect: 6,
    body: { r: 16, len: 10 },
    weapons: [],
    trail: "tread",
    sprite: "u.radarcar",
    turretSprite: "tur.radarcar",
    turretSpins: true
  },
  /**
   * Level 3 of the war factory. The Salamander is the siege piece for the
   * turtle Tier 3 builds — Bastions behind Interrupters, where the Tempest's
   * rockets are shot out of the sky: its round is a *shell*, which point
   * defence never touches, with a blast two tiles across that hits everything
   * in it at full value. The blast does not know whose side it is on
   * (`friendlyFire`): the Mammoths escorting it burn if they stand in the
   * footprint, and its minimum range is what keeps it from catching itself.
   * It reaches 6.5 tiles (4.5 until 2026-09-17: nobody built the Interrupter
   * turtle it was made for, and in the sieges people did fight it walked into
   * Cannon Turret range a tile and a half before it could answer, so nobody
   * built it either), past the Cannon Turret, the Gatling and the MG turret
   * and still under the Bastion, the HQ gun, the Viper and every artillery
   * piece, so it earns its price against clusters and only with something in
   * front of it (salamander.test.ts).
   */
  salamander: {
    id: "salamander",
    kind: "unit",
    aliases: ["sala", "mortar"],
    domain: "ground",
    tier: 3,
    cost: 800,
    buildTime: 42,
    pop: 3,
    power: -3,
    hp: 850,
    armor: "heavy",
    speed: 45,
    turnRate: 2.8,
    vision: 7,
    radius: 11,
    requires: ["radar"],
    body: { r: 19, len: 7 },
    weapons: [w({
      id: "thermobaric",
      cls: "he",
      dmg: 260,
      reload: 4,
      range: 6.5,
      minRange: 3,
      projectile: "shell",
      speed: 240,
      targets: ["ground", "ship"],
      mult: { heavy: 0.6 },
      // 72 and not the 77 the splash pass would give it: the nearest its own
      // round can land, less its hull, was 74 px away at the 4.5 tiles it
      // launched with, and is 78 now the spread scales over a longer reach
      // (`salamander.test.ts`)
      turret: true,
      muzzleOffset: 16,
      splash: 72,
      arc: true,
      spread: 16,
      friendlyFire: true,
      sound: "arty",
      // a fuel cloud that burns over the ground rather than a charge that digs into it
      mark: "thermo"
    })],
    trail: "tread",
    sprite: "u.salamander",
    turretSprite: "tur.salamander",
    // the ring its sheet paints, forward of the hull's centre. A body
    // whose turret *fires* declares it here rather than in the sprite
    // manifest: the manifest moves the drawing and the sim cannot read a
    // sheet, so a ring named only there put the round out of the barrel.
    turretMounts: [{ x: 0, y: -1 }]
  },
  /**
   * Point defence on tracks: the Interrupter's magazine on a hull and no gun
   * at all. Weaker than the tower on purpose — six rounds and one back every
   * 1.5 s against the tower's eight and one every 0.75 s — so one Bulwark
   * thins a Tempest's salvo (most of it down, never all of it: a rocket is
   * inside its ring for under a second, and the reload cannot make up two)
   * and two blank it; it never turns a bad fight into a good one alone
   * (bulwark.test.ts). Shells still land.
   */
  bulwark: {
    id: "bulwark",
    kind: "unit",
    aliases: ["interrupter", "pd"],
    domain: "ground",
    tier: 3,
    cost: 650,
    buildTime: 32,
    pop: 2,
    power: -2,
    hp: 520,
    armor: "medium",
    speed: 60,
    turnRate: 4,
    vision: 9,
    radius: 10,
    requires: ["radar"],
    body: { r: 9, len: 9 },
    weapons: [],
    interceptRange: 5,
    interceptMag: 6,
    interceptReload: 1.5,
    interceptMuzzleOffset: 12,
    trail: "tread",
    sprite: "u.bulwark",
    turretSprite: "tur.bulwark"
  },
  /**
   * The fire curtain, and the glass cannon that lays it. The Drake's weapon
   * does not fire, it *pours*: a glob of burning fuel every tick for a full
   * second, sprayed across an arc and falling short of the aim by up to half,
   * so what leaves the nozzle is one continuous tongue of flame — and the
   * ground it washes over keeps burning for eight seconds afterwards. It is
   * the only unit that denies ground rather than killing what stands on it,
   * and the only weapon whose damage goes on after the trigger is let go.
   *
   * That second is the whole unit, and everything else about it is what the
   * second costs:
   *
   * - **A cooldown, not a reload.** The bottles come back up to pressure over
   *   2.6 s, so for two thirds of every engagement the Drake is a tank with
   *   no gun standing three tiles from something that still has one. What it
   *   set alight is what fights while it waits.
   * - **A light tank's reach.** 4 tiles (3.4 until 2026-09-16, a quarter
   *   more since, floored): level with the Wolf, a hair past the Buggy's
   *   machine gun, and out-ranged by every heavier tank, every turret and
   *   every artillery piece there is, so it still has to be walked in behind
   *   something that can take the crossing.
   * - **Thin skin over a full fuel tank.** 260 hit points of *medium* armour
   *   at Tier 2 — less than the Tier-1 Wolf it is built to burn. A Bison's
   *   gun opens it in six seconds and it rarely sees a second cooldown out.
   *   It costs 400 metal since 2026-10-01 (300 before), and is meant to be
   *   spent.
   * - **Nothing for aircraft**, and a hull in the water does not burn.
   * - **The fire is nobody's friend.** A curtain a column could walk through
   *   unharmed would not be a curtain, so `force` rides on every patch and
   *   the Drake's own side burns in it exactly as the enemy does. The Drake
   *   itself burns at half (`burnMult`): it is built to work in its own
   *   fire, so driving forward into what it just laid costs it, but not
   *   what it costs the tanks beside it.
   *
   * What that buys is a raider, not a line unit. Against equal metal it eats
   * artillery, air defence, engineers' work and swarms — the things that sit
   * still or cannot answer at four tiles — and it is beaten by anything with
   * a tank gun and the reach to use it: two Bisons take four Drakes for a
   * quarter of their price. The AI does not field it, for the reason it does
   * not field the Salamander: keeping a line out of one's own fire is micro,
   * and it has none.
   *
   * Level 2 of the war factory, no radar, since 2026-09-17 (the Arsenal's
   * third unit before, behind the radar): a raider's prey — howitzers, air
   * defence, an engineer's camp — is a minute-5 thing, and by the time an
   * Arsenal stood it met Cannon Turrets and the HQ gun instead, so nobody
   * built one. The Tempest went the other way, to the Arsenal.
   */
  drake: {
    id: "drake",
    kind: "unit",
    aliases: ["flametank", "flamer"],
    domain: "ground",
    tier: 2,
    cost: 400,
    buildTime: 16,
    pop: 2,
    power: -2,
    hp: 260,
    armor: "medium",
    speed: 73.6,
    turnRate: 4.8,
    vision: 6,
    radius: 10,
    fireOnMove: true,
    burnMult: 0.5,
    body: { r: 15, len: 14 },
    weapons: [w({
      // `burst` is not a salvo here: a glob every tick for a full second, and
      // then the tank is empty. The reload is a **cooldown** — pressure back
      // in the bottles — and it is more than twice the pour, so two thirds of
      // the Drake's life is spent at four tiles from something it cannot
      // touch. The fire it left is what fights for it meanwhile. 7.8 a glob
      // since 2026-09-19 (9 before): 90 dps over the cycle, down from 104.
      id: "flamejet",
      cls: "he",
      dmg: 7.8,
      reload: 2.6,
      range: 4,
      projectile: "flame",
      speed: 260,
      targets: ["ground", "ship"],
      mult: { light: 1.5, medium: 1.1, heavy: 0.45, ship: 0.5, structure: 1.3 },
      turret: true,
      muzzleOffset: 18.5,
      splash: 38,
      burst: 30,
      burstDelay: 0.03,
      fan: 0.22,
      burn: 14,
      burnLife: 8,
      sound: "flame"
    })],
    trail: "tread",
    sprite: "u.drake",
    turretSprite: "tur.drake",
    turretMounts: [{ x: 0, y: -5 }]
  },
  /**
   * The amphibian: an eight-wheeled armoured car that swims. The one unit
   * with the `amphibious` domain — it drives on everything a tank drives on
   * and floats on everything a ship floats on, at `SWIM_FACTOR` of its road
   * speed in the water (`game/map.ts`), so a crossing is slow and the way
   * round by land is taken when it is quicker (the pathfinder weighs the
   * water, `terrCostAmphib`). Afloat it is a *ship* to every gun — a
   * torpedo, an anti-ship missile and a naval gun all find it — and ashore
   * a vehicle, judged by the tile under it (`targetCat`); it is medium
   * armour either way, and a Flak Track reaches it on both. It never boards a
   * transport: it is its own.
   *
   * Built at the level-2 naval yard *and* the level-2 war factory — it
   * leaves either by its own domain, the one off the slip already afloat
   * and the one off the ramp already rolling — and priced against the
   * landing it replaces. Its gun is the Wolf's class — a 30 mm autocannon, soft skins
   * and light armour, half value against heavy plate and a wall — on a hull
   * a quarter tougher, at 200 metal and twice the population: five Wolves
   * beat three Gators on land at equal metal. Three Gators cost 600 against
   * 700 for a landing craft and four Wolves, with no beach to load
   * from and none to unload onto, no hull that takes four tanks down with
   * it, and a crossing at 44 px/s against the craft's 70. A raider from the
   * sea — the howitzer line, the air defence, the engineer's outlying
   * extractor — and a beachhead's first armour, not a line unit: a Bison
   * opens it in five shots and a cannon turret outranges it. The AI never
   * fields it; its landings go by the lift (`manageLift`), and teaching a
   * commander to swim an assault is its own job. `gator.test.ts`.
   */
  gator: {
    id: "gator",
    kind: "unit",
    aliases: ["acv", "amphibian", "amtrac"],
    domain: "amphibious",
    tier: 2,
    ability: "smoke",
    cost: 200,
    buildTime: 15,
    pop: 2,
    power: -2,
    hp: 380,
    armor: "medium",
    speed: 80,
    turnRate: 4.5,
    vision: 8,
    radius: 10,
    fireOnMove: true,
    // the sheet's hull is 20 by 36 world px with the wheels: a half-beam and
    // a pixel, and the length less the two round ends
    body: { r: 11, len: 14 },
    weapons: [w({
      // tur.gator: measured pivot y=1000, muzzle y=300 on the 1536px
      // master; 700/1536 * 21 art px * 1.5625 display scale
      id: "autocannon",
      cls: "autocannon",
      dmg: 20,
      reload: 0.5,
      range: 4.2,
      projectile: "bullet",
      speed: 520,
      targets: ["ground", "ship"],
      turret: true,
      muzzleOffset: 14.95361328125,
      sound: "autocannon"
    })],
    trail: "tire",
    sprite: "u.gator",
    turretSprite: "tur.gator",
    // Aft ring at (512,880) on the 1024x1536 hull: (880/1536 - .5)*26.
    // Rendering and firing share this mount; the hull's frame size stays put.
    turretMounts: [{ x: 0, y: 1.8958333333333333 }]
  },
  // ------------------------------------------------------ the doctrines' own
  //
  // Three units the tech tree unlocks (`game/tech.ts`), one a doctrine, each a
  // rule the game already had put on a new hull the way the Bulwark put the
  // interrupter on tracks — so the new work stays in the tree and the
  // abilities. All three are real equipment: the eight-wheeled gun carrier,
  // the ballistic missile on its launcher truck, the armoured recovery tank.
  /**
   * **Lightning's suicide drone** (`suicideDrones`): a quadcopter with a
   * shaped charge slung under it — the FPV drone of the Ukrainian front, the
   * Lancet's poorer cousin — flown into what it is sent at and gone with it.
   * It never picks a target of its own (`kamikaze`): it hovers where it is
   * put until an order names a unit, a building or a spot on the ground,
   * then flies there and goes off. Cheap, quick and made of nothing: a Flak
   * Track or a Hawk swats it, and so does a machine gun or an autocannon,
   * since it comes in at treetop height (`lowFlying`); the charge is the
   * anti-tank one (`at`), wasted on a jeep. Eight a faction at most, those on
   * a line's queue counted (`limit`): fifty of them, each a fair trade for
   * a third of a tank and each certain to arrive, deleted any army (the
   * user's word, 2026-09-26). Off the
   * Advanced Airbase, where everything else that flies is built (the Jaguar
   * it replaced came off the Advanced War Factory, but a line is read by
   * what it turns out, `yardKind`, and a war factory with a drone on its
   * list reads as an airbase).
   */
  hornet: {
    id: "hornet",
    kind: "unit",
    aliases: ["fpv", "kamikaze", "suicidedrone", "quadcopter"],
    domain: "air",
    tier: 2,
    // light, not `air`: a foam-and-carbon frame is no armoured airframe, and
    // the small arms that reach it (`lowFlying`) tear it (×1.5) where they
    // only scratch a helicopter; anti-air hits it the same either way
    cost: 120,
    buildTime: 4,
    pop: 1,
    power: -1,
    hp: 60,
    armor: "light",
    speed: 130,
    turnRate: 6,
    vision: 7,
    radius: 7,
    altitude: 8,
    hovers: true,
    kamikaze: true,
    lowFlying: true,
    limit: 10,
    requires: ["suicideDrones"],
    remoteVision: true,
    weapons: [w({
      // the charge: its range is the touch, and its shot is the drone itself
      id: "charge",
      cls: "at",
      dmg: 160,
      reload: 1,
      range: 0.5,
      projectile: "missile",
      speed: 130,
      targets: ["ground", "ship"],
      splash: 12,
      mark: "cannon",
      sound: "expl"
    })],
    sprite: "u.hornet"
  },
  /**
   * **Anvil's recovery tank** (`fieldRecovery`): the armoured recovery
   * vehicle — the M88A2 Hercules, the Büffel, the BREM — the Repair Tower's aura on tracks. It
   * mends vehicles and ships round it as the tower does, billed at the
   * tower's rate (`REPAIR_TOWER_COST_FRAC`), never a building and never an
   * aircraft: it is a crane and a welder, not an engineer. No gun and heavy
   * plate, so it follows the column into the fire; born with the emergency
   * repair that trebles the aura for six seconds. One Hercules does not mend
   * another, as one tower does not mend another.
   */
  hercules: {
    id: "hercules",
    kind: "unit",
    aliases: ["arv", "recovery", "m88", "buffel"],
    domain: "ground",
    tier: 2,
    ability: "emergencyRepair",
    cost: 350,
    buildTime: 18,
    pop: 1,
    power: -1,
    hp: 700,
    armor: "heavy",
    speed: 58,
    turnRate: 3.8,
    vision: 7,
    radius: 10,
    requires: ["fieldRecovery"],
    body: { r: 13, len: 12 },
    weapons: [],
    repairRange: 4,
    repairRate: 12,
    repairTargets: 2,
    trail: "tread",
    sprite: "u.hercules"
  },
  /**
   * **Hammer's ballistic missile** (`ballisticMissiles`, and the radar the
   * Arsenal already needs): the launcher truck and its two rounds — the
   * Iskander's pair. Eighteen tiles, past the Sovereign and everything else
   * that fires at the ground, one pair every thirty seconds, and a big blast
   * each. The answer is already standing in most bases: the missile is
   * ordnance, and point defence takes it out of the air one round a missile
   * (`interceptable`), so a Scorpion's siege starts with the interrupters.
   * It sees seven tiles and throws eighteen — a Scorpion is blind without a
   * radar car, a drone or a plane over the target. No turret: the erector
   * lays the launcher's whole hull on the bearing, as the howitzer does.
   */
  scorpion: {
    id: "scorpion",
    kind: "unit",
    aliases: ["tbm", "iskander", "ballistic"],
    domain: "ground",
    tier: 3,
    cost: 1100,
    buildTime: 45,
    pop: 3,
    power: -3,
    hp: 320,
    armor: "light",
    speed: 40,
    turnRate: 2.4,
    vision: 7,
    radius: 12,
    requires: ["radar", "ballisticMissiles"],
    cargoWeight: 4,
    body: { r: 14, len: 18 },
    weapons: [w({
      id: "tbm",
      cls: "he",
      dmg: 400,
      reload: 30,
      range: 18,
      minRange: 6,
      projectile: "missile",
      speed: 230,
      targets: ["ground", "ship"],
      muzzleOffset: 6,
      splash: 64,
      arc: true,
      spread: 30,
      burst: 2,
      burstDelay: 0.9,
      interceptable: true,
      mark: "bomb",
      sound: "missile"
    })],
    trail: "tire",
    sprite: "u.scorpion"
  },
  // ================================================================== SEA
  //
  // Every hull carries a `body`: the capsule `separation()` parts ships by,
  // measured off the drawn silhouette. A circle cannot say "long and thin" —
  // the battleship's was 1.8x its own beam and 41% of its length, so a line
  // of them telescoped bow-to-stern while holding each other twice too far
  // apart abeam. `radius` is untouched and still the combat yardstick.
  gunboat: {
    id: "gunboat",
    kind: "unit",
    aliases: ["patrol", "boat"],
    domain: "ship",
    tier: 1,
    cost: 130,
    buildTime: 10,
    pop: 1,
    power: -1,
    hp: 260,
    armor: "ship",
    speed: 90,
    turnRate: 3.4,
    vision: 9,
    radius: 9,
    body: { r: 6, len: 20 },
    weapons: [w({
      // the 30 mm reaches aircraft too, at a quarter (since 2026-09-27): the
      // first yard's one answer to the sky, enough to see off a helicopter
      // with a few boats and never a Flak Track's worth per metal
      id: "autocannon",
      cls: "autocannon",
      dmg: 16,
      reload: 0.5,
      range: 4.2,
      projectile: "bullet",
      speed: 520,
      targets: ["ground", "ship", "air"],
      mult: { ship: 0.8, air: 0.25 },
      turret: true,
      muzzleOffset: 10.4,
      sound: "autocannon"
    })],
    trail: "wake",
    sprite: "u.gunboat",
    turretSprite: "tur.gunboat",
    turretMounts: [{ x: 0, y: -2 }]
  },
  mboat: {
    id: "mboat",
    kind: "unit",
    aliases: ["missileboat", "corvette"],
    domain: "ship",
    tier: 1,
    cost: 280,
    buildTime: 18,
    pop: 2,
    power: -2,
    hp: 300,
    armor: "ship",
    speed: 80,
    turnRate: 3,
    vision: 9,
    radius: 10,
    body: { r: 8, len: 29 },
    weapons: [w({
      id: "ashm",
      cls: "ashm",
      dmg: 170,
      reload: 3.5,
      range: 8,
      projectile: "missile",
      speed: 320,
      targets: ["ship"],
      homing: true,
      turret: true,
      sound: "missile"
    })],
    trail: "wake",
    sprite: "u.mboat"
  },
  frigate: {
    id: "frigate",
    kind: "unit",
    aliases: ["aegis", "escort"],
    domain: "ship",
    tier: 2,
    ability: "damageControl",
    cost: 700,
    buildTime: 34,
    pop: 3,
    power: -3,
    hp: 900,
    armor: "ship",
    speed: 65,
    turnRate: 2.6,
    vision: 10,
    sonar: 9,
    radius: 13,
    // measured at the ship's display scale (core/metrics.ts): a beam of 46.2
    // world px, over a tile, so it needs two tiles of water abeam
    body: { r: 23.1, len: 74.25 },
    weapons: [
      w({
        // The deck gun works the surface; the forward VLS answers the sky.
        id: "navgun",
        cls: "navgun",
        dmg: 40,
        reload: 1.5,
        range: 5.5,
        projectile: "shell",
        speed: 420,
        targets: ["ground", "ship"],
        turret: true,
        muzzleOffset: 15.796,
        splash: 10,
        sound: "cannon"
      }),
      w({
        // vertical-launch cells on the forward deck: the missile is aimed once it is
        // out (`vertical`), never by the hull or the gun's ring, since a ship
        // never swings on the spot to point its bow at an aircraft. The cells
        // keep a target of their own (`hasAirMount` in combat.ts) and fire at
        // it while the gun is on a boat and while the ship is under way: they
        // used to wait on the gun's one target, and three patrol boats in
        // front of five helicopters sank three frigates that way
        id: "navsam",
        cls: "aa",
        dmg: 80,
        reload: 2,
        range: 8.5,
        projectile: "missile",
        speed: 430,
        // Hatch grid centre: 8.2 art px forward at the hull's 2.8875 scale.
        targets: ["air"],
        homing: true,
        vertical: true,
        muzzleOffset: 23.6775,
        sound: "missile"
      }),
      w({
        // The escort's torpedoes screen submerged threats; surface fighting
        // stays with its light deck gun and the fleet's offensive ships.
        id: "torpedo",
        cls: "torpedo",
        dmg: 160,
        reload: 3.2,
        range: 7,
        projectile: "torpedo",
        speed: 150,
        targets: ["sub"],
        mult: { sub: 1.9 },
        homing: true,
        sound: "torpedo"
      })
    ],
    trail: "wake",
    sprite: "u.frigate",
    turretSprite: "tur.frigate",
    // Measured forward ring: 422 / 2016 down the 42 px hull sheet.
    turretMounts: [{ x: 0, y: -12.2 }]
  },
  // Retained for existing saves and authored scenarios; absent from yard menus.
  // Ironworks supplies the buildable copy under its own ironworks-orca ID.
  destroyer: {
    id: "destroyer",
    kind: "unit",
    aliases: ["orca", "dd"],
    domain: "ship",
    tier: 2,
    ability: "damageControl",
    cost: 700,
    buildTime: 34,
    pop: 3,
    power: -3,
    hp: 1300,
    armor: "ship",
    speed: 60,
    turnRate: 2.4,
    vision: 10,
    sonar: 9,
    radius: 15,
    // at the ship's display scale: a beam of 48 world px, two tiles of water abeam
    body: { r: 24, len: 63 },
    weapons: [
      w({
        // dual-purpose, like every naval gun (`ARMOR_MATRIX.navgun`)
        // 7 tiles, past the headquarters' gun (2026-09-27): the level-two
        // fleet's answer to a coast, so a navy threatens a shore before the
        // Sovereign. At 7.5 it outranged a howitzer battery three tiles inland
        id: "navgun",
        cls: "navgun",
        dmg: 70,
        reload: 1.8,
        range: 7,
        projectile: "shell",
        speed: 420,
        targets: ["ground", "ship", "air"],
        mult: { medium: 1.1, heavy: 0.8, structure: 0.8 },
        turret: true,
        muzzleOffset: 25.3125,
        splash: 12,
        sound: "cannon"
      }),
      w({
        // anti-submarine torpedoes: out-range the sub's own, bite hardest below
        id: "torpedo",
        cls: "torpedo",
        dmg: 160,
        reload: 3.2,
        range: 7,
        projectile: "torpedo",
        speed: 150,
        targets: ["ship", "sub"],
        mult: { ship: 1, sub: 1.9 },
        homing: true,
        sound: "torpedo"
      })
    ],
    trail: "wake",
    sprite: "u.destroyer",
    turretSprite: "tur.destroyer",
    // Measured gun ring: 620 / 1920 down the 48 px hull sheet.
    turretMounts: [{ x: 0, y: -8.5 }]
  },
  /**
   * The Barracuda hunts ships and nothing else. It carried a warhead of its
   * own until 2026-09-27; that went to the Kraken, the boat built to strike
   * the land.
   */
  sub: {
    id: "sub",
    kind: "unit",
    aliases: ["barracuda", "submarine"],
    domain: "ship",
    tier: 2,
    cost: 480,
    buildTime: 26,
    pop: 2,
    power: -2,
    hp: 550,
    armor: "sub",
    speed: 55,
    turnRate: 2.6,
    vision: 8,
    sonar: 8,
    radius: 12,
    underwater: true,
    body: { r: 7, len: 78 },
    weapons: [w({
      id: "torpedo",
      cls: "torpedo",
      dmg: 160,
      reload: 3.5,
      range: 6.5,
      projectile: "torpedo",
      speed: 150,
      targets: ["ship", "sub"],
      homing: true,
      sound: "torpedo"
    })],
    sprite: "u.sub"
  },
  /**
   * The Sovereign: three turrets on a long, narrow hull rather than one
   * enormous mounting amidships.
   *
   * `turretMounts` is the whole of it — A and B stepped up over the bow, X
   * abaft the superstructure — and the three-round burst it always fired now
   * walks them, so a salvo is three guns speaking a quarter of a second
   * apart. Each trains only within its own arc, which is why X sits round at
   * its stop while the forward pair are on something over the bow. Nothing
   * about the ship's numbers moved with the mounts: the reach and the shell
   * are what they were, and `radius` is still the collision circle rather
   * than the beam, so the fleet packs and closes exactly as it did. The
   * reload went 5 → 7 s afterwards, then to 20 s on 2026-10-08 alongside
   * a wider firing envelope (4–17 tiles) and the move to the Deepwater
   * Yard: a slower siege salvo with a larger blind zone close to the hull.
   *
   * The secondaries are its answer to the sky (since 2026-09-27): four
   * Cobras used to sink it without a loss and two Albatrosses likewise.
   * A battery of their own (`hasAirMount` in combat.ts), so they fire while
   * the main guns are on the shore and never pull the turrets round; 6.5
   * tiles, past a helicopter's missiles and short of the Albatross's, whose
   * answer is still the Aegis riding with it.
   */
  btlship: {
    id: "btlship",
    kind: "unit",
    aliases: ["sovereign", "battleship"],
    domain: "ship",
    tier: 3,
    ability: "barrage",
    cost: 1700,
    buildTime: 70,
    pop: 5,
    power: -5,
    hp: 2500,
    armor: "ship",
    speed: 45,
    turnRate: 1.6,
    vision: 10,
    radius: 20,
    requires: ["radar"],
    // the hull is drawn at its own display scale (core/metrics.ts), and the
    // capsule is measured off the drawing at that scale: 236 world px stem
    // to stern, over seven tiles, on a beam of 44 — over a tile, so two
    // tiles of water abeam and never a channel a tile wide (`hullBeam`)
    body: { r: 22, len: 192 },
    weapons: [w({
      id: "bigguns",
      cls: "he",
      dmg: 120,
      reload: 20,
      range: 17,
      minRange: 4,
      projectile: "shell",
      speed: 300,
      targets: ["ground", "ship"],
      mult: { heavy: 1, ship: 1.2 },
      // 1024 × 1536 turret master: pivot y=921.6, tips y=86, barrel centres
      // x=425/598, mapped to the original 10 × 16 art frame at scale 3.8.
      turret: true,
      muzzleOffset: 33.076,
      bores: 2,
      boreSpacing: 6.42,
      splash: 54,
      arc: true,
      burst: 3,
      burstDelay: 0.25,
      spread: 40,
      sound: "arty"
    }), w({
      id: "secondaries",
      cls: "aa",
      dmg: 20,
      reload: 0.5,
      range: 6.5,
      projectile: "flak",
      speed: 460,
      targets: ["air"],
      turret: true,
      sound: "flak"
    })],
    trail: "wake",
    sprite: "u.btlship",
    turretSprite: "tur.btlship",
    // Rings measured at y=537/788/1739 on the 800 × 2400 master, mapped to
    // its 62 art-px height. The code-drawn hull uses the same offsets.
    turretMounts: [
      { x: 0, y: -17.1275, arc: BROADSIDE },
      // A, over the bow
      { x: 0, y: -10.6433, arc: BROADSIDE },
      // B, superfiring behind A
      { x: 0, y: 13.9242, rest: Math.PI, arc: BROADSIDE }
      // X, abaft the bridge
    ]
  },
  carrier: {
    id: "carrier",
    kind: "unit",
    aliases: ["aircraftcarrier", "cv"],
    domain: "ship",
    tier: 3,
    ability: "damageControl",
    cost: 2200,
    buildTime: 85,
    pop: 6,
    power: -6,
    hp: 2600,
    armor: "ship",
    speed: 40,
    turnRate: 1.3,
    vision: 11,
    radius: 24,
    requires: ["radar"],
    body: { r: 30, len: 180 },
    transportCap: 10,
    transportDomain: "air",
    rearmsAir: true,
    weapons: [w({
      id: "navgun",
      cls: "navgun",
      dmg: 35,
      reload: 2,
      range: 5.5,
      projectile: "shell",
      speed: 420,
      targets: ["ground", "ship"],
      turret: true,
      muzzleOffset: 14,
      splash: 8,
      sound: "cannon"
    }), w({
      id: "aam",
      cls: "aa",
      dmg: 40,
      reload: 2,
      range: 5,
      projectile: "missile",
      speed: 460,
      targets: ["air"],
      homing: true,
      turret: true,
      muzzleOffset: 6,
      bores: 2,
      boreSpacing: 7,
      sound: "missile"
    })],
    trail: "wake",
    sprite: "u.carrier",
    turretSprite: "tur.carrier",
    airMount: { sprite: "tur.carrier-aa", x: 5.75, y: 20.7, on: "hull" },
    // Port-forward ring measured on the master at (332, 284), in its
    // 1024 × 1536 frame, mapped to the manifest's 32 × 62 art px.
    turretMounts: [{ x: -5.625, y: -19.536 }]
  },
  seatrans: {
    id: "seatrans",
    kind: "unit",
    aliases: ["landingcraft", "lst", "lcac"],
    domain: "ship",
    tier: 1,
    cost: 220,
    buildTime: 14,
    pop: 1,
    power: -1,
    hp: 500,
    armor: "ship",
    speed: 70,
    turnRate: 2.8,
    vision: 8,
    radius: 20,
    transportCap: 8,
    // a ramp against a beach has more give than a hoist: a tenth more reach
    // to board it, collect with it, and come to the shore it unloads on
    cargoReach: 1.1,
    // The cushion skirt overhangs the firm hull; retain one-tile beach access.
    body: { r: 14, len: 30 },
    weapons: [],
    trail: "wake",
    sprite: "u.seatrans"
  },
  /**
   * The engineer that works from the water. It builds and mends the same
   * things an engineer does, but only what stands within its arms of the
   * sea — which on a naval map is the ore: the fields out in open water,
   * which nothing else can reach (the offshore rig), and the deposits on
   * islets no engineer can drive to. Its `reach` is longer
   * than the engineer's, because the hull stops at the shoreline and the
   * site stands on the beach beyond it; long enough for one tile of beach
   * between the two, not for a deposit inland. Unarmed, and a builder for
   * `canRebuild` like any other pair of hands.
   */
  engboat: {
    id: "engboat",
    kind: "unit",
    aliases: ["workboat", "seabuilder"],
    domain: "ship",
    tier: 1,
    cost: 200,
    buildTime: 10,
    pop: 1,
    power: -1,
    hp: 260,
    armor: "ship",
    detect: 3,
    speed: 75,
    turnRate: 3.2,
    vision: 7,
    radius: 9,
    weapons: [],
    body: { r: 6, len: 18 },
    builds: ["extractor", "platform", "power", "factory", "factory3", "navyard", "navyard3", "airbase", "airbase3", "mgturret", "cannonturret", "aaturret", "interceptor", "repairtower", "sandbag", "landmine", "watermine", "warlab", "radar", "veil", "reactor", "nukesilo", "hq"],
    buildRate: 30,
    reach: 64,
    trail: "wake",
    sprite: "u.engboat"
  },
  /**
   * Level 3 of the naval yard. The Kraken shells the shore from under the
   * water — two cruise missiles every six seconds at ground targets only, no
   * torpedo, nothing to fight a ship with. They go up out of the six tubes
   * amidships and turn onto their bearing once out (`vertical`), so the boat
   * fires at any bearing without coming round. Vision 6 against range 13: it
   * shoots at what the team can see, or force-fires at a point the player
   * remembers. Every missile is `interceptable`, so an Interrupter over the
   * target blanks it the way it blanks a Tempest (kraken.test.ts).
   *
   * It is the second launcher (2026-09-27, the Barracuda's before): one
   * warhead of its own at the silo's price and pace, fired from wherever it
   * lies — but fabricated only alongside one of its own naval yards
   * (`armsAtBase`), so arming it is a trip home and the strike is the trip
   * out (nuke.test.ts).
   *
   * Priced as the naval Tempest with a stealth premium since 2026-09-17
   * (1500 · 60 s · pop 4 · range 12 before): sold beside the Sovereign at 88%
   * of its price, with a quarter of its hull and two tiles less reach, it was
   * never bought.
   */
  kraken: {
    id: "kraken",
    kind: "unit",
    aliases: ["cruisesub", "missilesub"],
    domain: "ship",
    tier: 3,
    cost: 1e3,
    buildTime: 45,
    pop: 3,
    power: -3,
    hp: 620,
    armor: "sub",
    speed: 50,
    turnRate: 2.4,
    vision: 6,
    sonar: 6,
    radius: 13,
    underwater: true,
    requires: ["radar"],
    body: { r: 9, len: 110 },
    nukeCapacity: 1,
    nukeCost: 2500,
    nukeTime: 180,
    armsAtBase: 4,
    weapons: [w({
      id: "cruise",
      cls: "he",
      dmg: 150,
      reload: 6,
      range: 13,
      minRange: 3,
      projectile: "missile",
      speed: 260,
      targets: ["ground"],
      homing: true,
      interceptable: true,
      vertical: true,
      splash: 43,
      burst: 2,
      burstDelay: 0.6,
      sound: "missile"
    })],
    sprite: "u.kraken"
  },
  /**
   * A transport that nobody without sonar can see: a hold of 4 — one
   * Mammoth, two Vipers, four engineers. The beach is the only door: boarding
   * is walking to it, and it unloads only onto ground near its hull, so it
   * has to come in close to a shore. Its hatch is on the surface: for as
   * long as its hold is working it is up, a ship anyone can see and shoot
   * (`surfacesForCargo`). Unarmed, and its cargo dies with it (moray.test.ts).
   */
  moray: {
    id: "moray",
    kind: "unit",
    aliases: ["spysub", "infiltrator"],
    domain: "ship",
    tier: 3,
    cost: 700,
    buildTime: 34,
    pop: 2,
    power: -2,
    hp: 450,
    armor: "sub",
    speed: 62,
    turnRate: 2.8,
    vision: 6,
    sonar: 5,
    radius: 12,
    underwater: true,
    transportCap: 4,
    requires: ["radar"],
    // more give than the landing craft's 1.1 (2026-09-27): a squad boards
    // from further up the beach, and the hold sets it down a tile further out
    cargoReach: 1.5,
    body: { r: 8, len: 70 },
    weapons: [],
    sprite: "u.moray"
  },
  // ================================================================== AIR
  drone: {
    id: "drone",
    kind: "unit",
    aliases: ["scout", "uav"],
    domain: "air",
    tier: 1,
    remoteVision: true,
    cost: 40,
    buildTime: 4,
    pop: 1,
    power: -1,
    hp: 90,
    armor: "air",
    // a fixed wing: it cannot hover, so it loiters the way every other plane
    // does, circling the spot it was sent to
    speed: 130,
    turnRate: 3.2,
    vision: 12,
    radius: 8,
    altitude: 12,
    weapons: [],
    sprite: "u.drone"
  },
  fighter: {
    id: "fighter",
    kind: "unit",
    aliases: ["falcon", "cap"],
    domain: "air",
    tier: 2,
    ability: "afterburner",
    cost: 380,
    buildTime: 22,
    pop: 2,
    power: -2,
    hp: 320,
    armor: "air",
    speed: 190,
    turnRate: 2.8,
    vision: 11,
    radius: 9,
    altitude: 14,
    rearmTime: 12,
    weapons: [w({
      id: "aam",
      cls: "aa",
      dmg: 150,
      reload: 2.2,
      range: 6,
      projectile: "missile",
      speed: 480,
      targets: ["air"],
      homing: true,
      ammo: 4,
      sound: "missile"
    })],
    sprite: "u.fighter",
    decals: [{ sprite: "dec.afterburner", layer: "under", y: 13, scale: 1.5, when: "ability" }]
  },
  /**
   * The Cobra (2026-10-01): off the Advanced Airbase, no longer the first
   * one; at treetop height (`lowFlying`), where the machine guns and the
   * light cannon of a column reach it as small arms reached every Apache of
   * the Karbala raid; eight missiles aboard, an AH-1's load, and then home
   * to the airbase for more (`ammo`, `game/ammo.ts`).
   */
  heli: {
    id: "heli",
    kind: "unit",
    aliases: ["cobra", "attackheli"],
    domain: "air",
    tier: 2,
    cost: 380,
    buildTime: 20,
    pop: 2,
    power: -2,
    hp: 300,
    armor: "air",
    speed: 95,
    turnRate: 3.4,
    vision: 9,
    radius: 9,
    altitude: 11,
    hovers: true,
    lowFlying: true,
    rearmTime: 12,
    weapons: [w({
      // a raider as much as a tank hunter: keeps some bite against soft targets
      id: "atgm",
      cls: "at",
      dmg: 75,
      reload: 2.6,
      range: 5.5,
      projectile: "missile",
      speed: 300,
      targets: ["ground", "ship"],
      mult: { light: 0.6, structure: 0.8 },
      homing: true,
      ammo: 8,
      sound: "missile"
    })],
    sprite: "u.heli"
  },
  jet: {
    id: "jet",
    kind: "unit",
    aliases: ["thunderbolt", "strikejet"],
    domain: "air",
    tier: 2,
    ability: "afterburner",
    cost: 450,
    buildTime: 25,
    pop: 2,
    power: -2,
    hp: 360,
    armor: "air",
    speed: 160,
    turnRate: 2.4,
    vision: 10,
    radius: 10,
    altitude: 14,
    rearmTime: 15,
    weapons: [w({
      // six salvos of four, two pods' worth, then home (`ammo`)
      id: "rockets",
      cls: "rocket",
      dmg: 24,
      reload: 2.4,
      range: 4.5,
      projectile: "rocket",
      speed: 340,
      targets: ["ground", "ship"],
      burst: 4,
      burstDelay: 0.1,
      splash: 22,
      spread: 18,
      ammo: 6,
      sound: "rocket"
    })],
    sprite: "u.jet",
    decals: [{ sprite: "dec.afterburner", layer: "under", x: -2.5, y: 13, scale: 1.3, when: "ability" }, { sprite: "dec.afterburner", layer: "under", x: 2.5, y: 13, scale: 1.3, when: "ability" }]
  },
  mjet: {
    id: "mjet",
    kind: "unit",
    aliases: ["albatross", "antiship"],
    domain: "air",
    tier: 2,
    ability: "afterburner",
    cost: 520,
    buildTime: 28,
    pop: 2,
    power: -2,
    hp: 380,
    armor: "air",
    speed: 150,
    turnRate: 2.2,
    vision: 11,
    radius: 10,
    altitude: 14,
    rearmTime: 15,
    weapons: [w({
      // four anti-ship missiles, a maritime striker's load (`ammo`)
      id: "ashm",
      cls: "ashm",
      dmg: 170,
      reload: 4.5,
      range: 8,
      projectile: "missile",
      speed: 340,
      targets: ["ship"],
      mult: { ship: 1.7 },
      homing: true,
      ammo: 4,
      sound: "missile"
    })],
    sprite: "u.mjet",
    decals: [{ sprite: "dec.afterburner", layer: "under", y: 14, scale: 1.5, when: "ability" }]
  },
  bomber: {
    id: "bomber",
    kind: "unit",
    aliases: ["vulture", "levelbomber"],
    domain: "air",
    tier: 2,
    ability: "incendiary",
    // siege from the air is the strongest thing an airbase makes, and it is
    // priced and armoured so a SAM site is a real answer to it
    cost: 1e3,
    buildTime: 40,
    pop: 3,
    power: -3,
    hp: 560,
    armor: "air",
    speed: 110,
    turnRate: 1.8,
    vision: 9,
    radius: 12,
    altitude: 16,
    rearmTime: 20,
    weapons: [w({
      // heavy bombs: nothing on the ground shrugs them off. Two sticks of
      // five in the bay, then home for the next load (`ammo`)
      id: "bombs",
      cls: "he",
      dmg: 70,
      reload: 6,
      range: 2.4,
      projectile: "bomb",
      speed: 120,
      targets: ["ground", "ship"],
      mult: { medium: 1.2, heavy: 1, ship: 1.1 },
      burst: 5,
      burstDelay: 0.14,
      splash: 42,
      spread: 20,
      ammo: 2,
      sound: "bomb"
    })],
    sprite: "u.bomber",
    // the canisters on the wing just aft of the inner engine pods
    decals: [{ sprite: "dec.incendiary", layer: "hull", y: -1, when: "ability" }]
  },
  theli: {
    id: "theli",
    kind: "unit",
    aliases: ["pelican", "transportheli"],
    domain: "air",
    tier: 1,
    cost: 280,
    buildTime: 16,
    pop: 1,
    power: -1,
    hp: 380,
    armor: "air",
    speed: 100,
    turnRate: 3,
    vision: 8,
    radius: 11,
    altitude: 12,
    transportCap: 2,
    hovers: true,
    lowFlying: true,
    weapons: [],
    sprite: "u.theli"
  },
  c47: {
    id: "c47",
    kind: "unit",
    aliases: ["condor", "cargoplane", "skytrain", "dakota"],
    domain: "air",
    tier: 2,
    cost: 650,
    buildTime: 34,
    pop: 3,
    power: -3,
    hp: 720,
    armor: "air",
    speed: 120,
    turnRate: 1.9,
    vision: 9,
    radius: 15,
    altitude: 16,
    transportCap: 4,
    transportMaxWeight: 2,
    landsForCargo: true,
    weapons: [],
    sprite: "u.c47"
  },
  gunship: {
    id: "gunship",
    kind: "unit",
    aliases: ["spectre", "ac130"],
    domain: "air",
    tier: 3,
    cost: 1800,
    buildTime: 60,
    pop: 5,
    power: -5,
    hp: 1100,
    armor: "air",
    speed: 90,
    turnRate: 1.6,
    vision: 10,
    radius: 12,
    altitude: 16,
    requires: ["radar"],
    rearmTime: 25,
    weapons: [w({
      // Sustained fire support, strongest against light and medium armor.
      // The 150-round drum keeps it on station; heavy armor, fortifications
      // and ships call for the air wing's specialist weapons.
      id: "gatcannon",
      cls: "autocannon",
      dmg: 28,
      reload: 0.45,
      range: 5.5,
      projectile: "shell",
      speed: 480,
      targets: ["ground", "ship"],
      mult: { light: 1.2, medium: 1.2, heavy: 0.8, structure: 0.8, ship: 0.7 },
      ammo: 150,
      // side-firing: the gunship shoots out of its orbit instead of nose-on
      turret: true,
      splash: 10,
      sound: "autocannon"
    })],
    sprite: "u.gunship"
  },
  /**
   * Level 3 of the airbase. The Wraith carries two heavy bombs instead of
   * the Vulture's five: one pass puts 832 onto a building, which is a Radar
   * Station, a SAM Site or an Interrupter in a single run. Its `stealth` is
   * a range: an enemy sees it only within 4 tiles of one of their units or
   * buildings, or 8 of their radar (`detect`), so AA elsewhere in the base
   * never joins in and whatever stands at the target gets its shots late.
   * The counters are the cheap ones — flak and gatlings beside the things
   * worth keeping — and a Falcon patrol over them (wraith.test.ts).
   *
   * It also carries one nuclear gravity bomb (2026-09-27, `nukebomb`),
   * fabricated only while it circles one of its own airbases
   * (`armsAtBase`), and delivered the way a bomber delivers one: flown over
   * the point and let go, to lie there on its fuse (nuke-bomb.test.ts).
   */
  wraith: {
    id: "wraith",
    kind: "unit",
    aliases: ["stealth", "stealthbomber"],
    domain: "air",
    tier: 3,
    ability: "incendiary",
    cost: 1400,
    buildTime: 55,
    pop: 4,
    power: -4,
    hp: 450,
    armor: "air",
    speed: 135,
    turnRate: 2,
    vision: 9,
    radius: 11,
    altitude: 16,
    stealth: 4,
    requires: ["radar"],
    rearmTime: 20,
    // one nuclear gravity bomb (`nukebomb`), fabricated over its own airbases
    // — the ground its bombs are loaded on too (`game/ammo.ts`)
    nukeCapacity: 1,
    armsAtBase: 4,
    magazine: ["nukebomb"],
    weapons: [w({
      // two passes' worth of heavy bombs, then home (`ammo`)
      id: "heavybombs",
      cls: "he",
      dmg: 260,
      reload: 8,
      range: 2.4,
      projectile: "bomb",
      speed: 120,
      targets: ["ground", "ship"],
      mult: { light: 1, medium: 0.9, heavy: 0.6 },
      burst: 2,
      burstDelay: 0.2,
      splash: 43,
      spread: 10,
      ammo: 2,
      sound: "bomb"
    })],
    sprite: "u.wraith",
    decals: [{ sprite: "dec.incendiary", layer: "hull", y: 2, when: "ability" }]
  },
  /**
   * The first aircraft that can find a submarine: dipping sonar and homing
   * torpedoes that bite hardest below. A torpedo dropped over land fizzles on
   * the spot — the engine does that to every torpedo — so the Cormorant
   * attacks from over the sea, and its reach (5) is inside the Aegis
   * frigate's missiles (8.5), so a screened fleet is closed to it
   * (cormorant.test.ts).
   */
  cormorant: {
    id: "cormorant",
    kind: "unit",
    aliases: ["asw", "aswheli"],
    domain: "air",
    tier: 3,
    cost: 700,
    buildTime: 34,
    pop: 2,
    power: -2,
    hp: 340,
    armor: "air",
    // the longest sonar in the game — a tile past the Orca's, so it is the
    // one thing that hears a submarine before the submarine's escort hears it
    speed: 92,
    turnRate: 3.2,
    vision: 9,
    sonar: 10,
    radius: 10,
    altitude: 11,
    hovers: true,
    lowFlying: true,
    requires: ["radar"],
    rearmTime: 15,
    weapons: [w({
      // two torpedoes, a Seahawk's, then home for more (`ammo`)
      id: "airtorpedo",
      cls: "torpedo",
      dmg: 140,
      reload: 4,
      range: 5,
      projectile: "torpedo",
      speed: 150,
      targets: ["ship", "sub"],
      mult: { ship: 0.9, sub: 1.8 },
      homing: true,
      ammo: 2,
      sound: "torpedo"
    })],
    sprite: "u.cormorant"
  },
  /**
   * The nuclear warhead in flight. Not built at any factory: a silo or a
   * Kraken launches one, and from then on it is an aircraft with no
   * gun and no orders, flying a straight line at the point it was sent to:
   * a slow launch, cruise, then a faster terminal approach
   * (`Game.tickWarhead`, `warheadTravel`). Two things may shoot it down: a *veteran* — a unit
   * of rank 2 or better whose weapons reach the sky (`canEngage` in
   * combat.ts, `WARHEAD_MIN_RANK`) — and the SAM Site, the one emplacement a
   * def flag clears for the job (`antiWarhead`). A green unit and every other
   * building cannot lock on to it, fire at it or scratch it with a stray
   * burst. The hit points are the balance among those who can: one veteran
   * Hawk under its path is not enough and a row of them is, and the same goes
   * for a pair of SAM Sites under the line versus a cluster over the target
   * (nuke.test.ts pins all of it). They move with the SAM Site's damage —
   * raise its missile and this goes up in step, or one site alone gets the
   * vote the pair was meant to have.
   * Its `requires` is what every launcher needs to fabricate or fire one.
   */
  warhead: {
    id: "warhead",
    kind: "unit",
    aliases: ["nuke", "nuclear"],
    domain: "air",
    tier: 3,
    warhead: true,
    cost: 0,
    buildTime: 0,
    pop: 0,
    hp: 700,
    armor: "air",
    speed: 96,
    turnRate: 0,
    vision: 0,
    radius: 7,
    altitude: 36,
    weapons: [],
    requires: ["radar", "reactor", "nuclearProgram"],
    sprite: "u.warhead",
    decals: WARHEAD_MOTOR
  },
  /**
   * The other thing a silo or a Kraken may put in the shaft: an
   * electromagnetic pulse where the nuclear warhead has a blast. Same
   * missile, same flight, same hit points against the same anti-air — and
   * where it comes down every circuit within `emp.radius` tiles is dead for
   * `emp.seconds` (`pulse` in combat.ts): a column stands still with its
   * guns silent, a radar goes blind, a repair tower and a turret line stop,
   * a plant makes nothing, its own side's included. Nothing in the air is
   * touched, which is what makes air the answer to it, and a wall draws no
   * power and stands as it stood. It leaves no crater and kills nothing,
   * which is why it is half the price and half the wait, needs only the
   * radar, and is the one a player who wants the base rather than the
   * ground it stood on reaches for. `cost` and `buildTime` are its own:
   * the nuclear warhead's are the launcher's (`warheadCost` in
   * game/warheads.ts).
   */
  emp: {
    id: "emp",
    kind: "unit",
    aliases: ["empwarhead", "pulse"],
    domain: "air",
    tier: 3,
    warhead: true,
    cost: 1200,
    buildTime: 90,
    pop: 0,
    hp: 700,
    armor: "air",
    speed: 96,
    turnRate: 0,
    vision: 0,
    radius: 7,
    altitude: 36,
    weapons: [],
    requires: ["radar"],
    emp: { radius: 7, seconds: 12 },
    sprite: "u.emp",
    decals: WARHEAD_MOTOR
  },
  /**
   * The Wraith's nuclear bomb (2026-09-27): a free-fall weapon, not a missile
   * (`laydown`). The bomber carries it to the point and lets it go
   * (`nukeDrop`); it comes down under a parachute and lies there for its
   * fuse — the laydown delay a B61 has so the aircraft can get clear —
   * before it goes off. A tactical yield, about a sixth of the missile's by
   * the cube root that sizes a blast: half its rings (3 and 4 tiles against
   * 6 and 8) and two thirds of its punch at the point. Lying there it is a
   * heavy thing on the ground any gun may shoot apart, which it survives
   * for a few seconds of a tank's fire, and shot apart it does not go off.
   * Priced under half the missile's, being so much less of it.
   */
  nukebomb: {
    id: "nukebomb",
    kind: "unit",
    aliases: ["b61", "nuclearbomb", "gravitybomb"],
    domain: "ground",
    tier: 3,
    warhead: true,
    cost: 1200,
    buildTime: 120,
    pop: 0,
    hp: 800,
    armor: "heavy",
    speed: 0,
    turnRate: 0,
    vision: 0,
    radius: 8,
    weapons: [],
    requires: ["radar", "reactor", "nuclearProgram"],
    laydown: { fuse: 10, dmg: 2e3, inner: 4, outer: 5 },
    sprite: "u.nukebomb"
  },
  // ============================================================ BUILDINGS
  /**
   * The one footprint that is not square: the sheet's ground is four tiles
   * wide and three deep, and a fourth row only put a strip of walkable
   * ground under the south wall. `spawnFootprint` (game/state.ts) settles
   * the odd height against the spawn point.
   */
  /**
   * The headquarters defends itself, the way a tower does in a lane game:
   * a twin heavy machine gun on the roof ring where the helipad was, a
   * shade stronger than the Gatling (79 dps to its 71) and reaching farther
   * (7 tiles, measured from a centre that is already two
   * tiles from the wall, so five past it), so a buggy, a light tank, a
   * gunship or a machine-gun turret that comes for it pays while a howitzer
   * or a launcher standing off still outranges it. It was the Gatling's 5
   * until the recorded matches of 15 September 2026: a gunship at 5.5 hit
   * it for free, and an engineer flown in stood turrets 7 tiles out that
   * shot every engineer it made; the ground a side may build on is its
   * headquarters' (`hqGroundTiles` in `game/orders.ts`), which is what
   * answers that drop. The ring is the pad's centre on the sheet (`mount`
   * in the manifest is the same point, for the placement ghost); the muzzle
   * and the bore spacing are measured across `tur.hq`.
   */
  hq: {
    id: "hq",
    kind: "building",
    domain: "none",
    tier: 1,
    isHQ: true,
    cost: 2500,
    buildTime: 60,
    pop: 0,
    hp: 4e3,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 10,
    radius: 60,
    fw: 4,
    fh: 3,
    weapons: [w({
      id: "hqgun",
      cls: "mg",
      dmg: 11,
      reload: 0.14,
      range: 7,
      projectile: "bullet",
      speed: 520,
      targets: ["ground", "ship", "air"],
      mult: { medium: 0.9, heavy: 0.5, air: 0.8, ship: 0.7, structure: 0.3 },
      turret: true,
      muzzleOffset: 35,
      bores: 2,
      boreSpacing: 5.7,
      sound: "mg"
    })],
    produces: ["engineer"],
    power: 10,
    metalRate: 0.5,
    upgradesTo: "hq2",
    upgradeCost: 15e3,
    upgradeTime: 180,
    sprite: "u.hq",
    turretSprite: "tur.hq",
    turretMounts: [{ x: 26, y: -36 }]
  },
  hq2: {
    id: "hq2",
    kind: "building",
    domain: "none",
    tier: 2,
    isHQ: true,
    upgradeOnly: true,
    cost: 17500,
    buildTime: 240,
    pop: 0,
    hp: 6e3,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 10,
    radius: 60,
    fw: 4,
    fh: 3,
    weapons: [w({
      id: "hqgun",
      cls: "mg",
      dmg: 19.25,
      reload: 0.14,
      range: 7,
      projectile: "bullet",
      speed: 520,
      targets: ["ground", "ship", "air"],
      mult: { medium: 0.9, heavy: 0.5, air: 0.8, ship: 0.7, structure: 0.3 },
      turret: true,
      muzzleOffset: 45,
      bores: 2,
      boreSpacing: 8.4,
      sound: "mg"
    })],
    produces: ["engineer"],
    power: 10,
    metalRate: 0.5,
    requires: ["radar"],
    sound: "bld-hq",
    sprite: "u.hq2",
    turretSprite: "tur.hq2",
    turretMounts: [{ x: 26, y: -36 }]
  },
  extractor: {
    id: "extractor",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 120,
    buildTime: 10,
    pop: 0,
    hp: 600,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 5,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    metalRate: 1.4,
    needsDeposit: true,
    power: -4,
    upgradesTo: "extractor2",
    upgradeCost: 190,
    upgradeTime: 16,
    sprite: "u.extractor"
  },
  extractor2: {
    id: "extractor2",
    kind: "building",
    domain: "none",
    tier: 2,
    upgradeOnly: true,
    cost: 310,
    buildTime: 26,
    pop: 0,
    hp: 950,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 5,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    metalRate: 3,
    needsDeposit: true,
    power: -8,
    upgradesTo: "extractor3",
    upgradeCost: 500,
    upgradeTime: 30,
    sprite: "u.extractor2"
  },
  extractor3: {
    id: "extractor3",
    kind: "building",
    domain: "none",
    tier: 3,
    upgradeOnly: true,
    cost: 810,
    buildTime: 56,
    pop: 0,
    hp: 1700,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    metalRate: 8,
    needsDeposit: true,
    power: -15,
    sprite: "u.extractor3"
  },
  /**
   * The offshore rig: the extractor's line on its own legs over an ore field
   * at sea (`offshore`), laid from the water by the engineer boat — no
   * engineer stands on open sea and no aircraft sets one down there — and
   * worth exactly what the extractor at the same level
   * is: the same price, hit points, yield, draw and upgrades, so the only
   * question a field at sea asks is who holds the water round it. That is
   * the point of it (2026-09-27): with the ore on the islands a Pelican
   * could fly an engineer to, a side could skip the navy and win in the air;
   * a field in open water is mined by a fleet or not at all. An engineer
   * builds one too, where it can walk out to the field over a frozen sea
   * (`isRigTile`: the legs go down through the ice as through the water), and
   * never from a beach, since the maps keep three tiles of sea round every
   * field and its arms reach two. No turret stands on the water, so what
   * guards a rig is the ships anchored over it, which
   * since the same day shoot back at aircraft. The real thing is the Gulf's
   * and the Santa Barbara Channel's: platforms fought over by navies —
   * Nimble Archer and Praying Mantis in 1987 and 1988, the Ellwood field
   * shelled from a submarine in 1942. Exempt from the headquarters' ground
   * as an extractor is (`needsDeposit`); a naval gun, a missile or a bomb
   * reaches it, a torpedo does not (it is a building, `targetCat` ground).
   */
  platform: {
    id: "platform",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 120,
    buildTime: 10,
    pop: 0,
    hp: 600,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 5,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    metalRate: 1.4,
    needsDeposit: true,
    offshore: true,
    power: -4,
    upgradesTo: "platform2",
    upgradeCost: 190,
    upgradeTime: 16,
    sprite: "u.platform",
    sound: "bld-extractor"
  },
  platform2: {
    id: "platform2",
    kind: "building",
    domain: "none",
    tier: 2,
    upgradeOnly: true,
    cost: 310,
    buildTime: 26,
    pop: 0,
    hp: 950,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 5,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    metalRate: 3,
    needsDeposit: true,
    offshore: true,
    power: -8,
    upgradesTo: "platform3",
    upgradeCost: 500,
    upgradeTime: 30,
    sprite: "u.platform2",
    sound: "bld-extractor2"
  },
  platform3: {
    id: "platform3",
    kind: "building",
    domain: "none",
    tier: 3,
    upgradeOnly: true,
    cost: 810,
    buildTime: 56,
    pop: 0,
    hp: 1700,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    metalRate: 8,
    needsDeposit: true,
    offshore: true,
    power: -15,
    sprite: "u.platform3",
    sound: "bld-extractor3"
  },
  /**
   * The plant line is 20 / 50 / 150: each level a shade dearer per unit of
   * power than a fresh plant (7, 8 and 7.3 metal a point), so an upgrade is
   * bought for the ground it gives back and the fewer targets it leaves,
   * never because it is the cheaper power. It was 20 / 60 / 210, and the
   * core at 5.2 a point was the best bargain on the map: every base went
   * there and the Reactor was never built for its output.
   */
  power: {
    id: "power",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 140,
    buildTime: 12,
    pop: 0,
    hp: 500,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 5,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    power: 20,
    upgradesTo: "power2",
    upgradeCost: 260,
    upgradeTime: 18,
    sprite: "u.power"
  },
  power2: {
    id: "power2",
    kind: "building",
    domain: "none",
    tier: 2,
    upgradeOnly: true,
    cost: 400,
    buildTime: 30,
    pop: 0,
    hp: 900,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 5,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    power: 50,
    upgradesTo: "power3",
    upgradeCost: 700,
    upgradeTime: 36,
    sprite: "u.power2",
    sound: "bld-power"
  },
  power3: {
    id: "power3",
    kind: "building",
    domain: "none",
    tier: 3,
    upgradeOnly: true,
    cost: 1100,
    buildTime: 66,
    pop: 0,
    hp: 1800,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    power: 150,
    sprite: "u.power3",
    sound: "bld-power"
  },
  factory: {
    id: "factory",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 320,
    buildTime: 20,
    pop: 0,
    hp: 1500,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 45,
    fw: 3,
    fh: 3,
    weapons: [],
    power: -8,
    produces: ["engineer", "buggy", "ltank", "flak"],
    upgradesTo: "factory2",
    upgradeCost: 420,
    upgradeTime: 25,
    sprite: "u.factory",
    sound: "bld-extractor2"
  },
  factory2: {
    id: "factory2",
    kind: "building",
    domain: "none",
    tier: 2,
    upgradeOnly: true,
    cost: 740,
    buildTime: 45,
    pop: 0,
    hp: 2200,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 45,
    fw: 3,
    fh: 3,
    weapons: [],
    power: -12,
    produces: ["engineer", "buggy", "ltank", "flak", "mbt", "td", "sam", "arty", "drake", "gator", "htank", "radarcar", "hercules"],
    upgradesTo: "factory3",
    upgradeCost: 900,
    upgradeTime: 45,
    sprite: "u.factory2",
    sound: "bld-extractor2"
  },
  /**
   * Level 3. Each production line upgrades once more, in place, and the
   * upgrade needs a Radar Station (`requires`, checked by `cmdUpgrade` on the
   * target def) — the one gate Tier 3 has always had. The line produces
   * nothing while it upgrades, and 45–48 s at this stage is a wave: that
   * downtime is the real price. `cost` is cumulative, as on every upgraded
   * def, because the sell refund reads it.
   *
   * The Tempest is the Arsenal's since 2026-09-17, and the Drake the level
   * below's: the third level sold three specialists nobody bought while the
   * level under it sold the siege piece that took 22% of all value in the
   * first human records, so nobody upgraded. Now the line's second upgrade
   * is what the rocket artillery costs.
   */
  factory3: {
    id: "factory3",
    kind: "building",
    domain: "none",
    tier: 3,
    upgradeOnly: true,
    cost: 1640,
    buildTime: 90,
    pop: 0,
    hp: 3e3,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 7,
    radius: 45,
    fw: 3,
    fh: 3,
    weapons: [],
    power: -20,
    requires: ["radar"],
    produces: ["engineer", "buggy", "ltank", "flak", "mbt", "td", "sam", "arty", "drake", "gator", "htank", "radarcar", "hercules", "mlrs", "salamander", "bulwark", "scorpion"],
    sprite: "u.factory3",
    sound: "bld-extractor2"
  },
  airbase: {
    id: "airbase",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 380,
    buildTime: 24,
    pop: 0,
    hp: 1400,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 60,
    fw: 4,
    fh: 4,
    weapons: [],
    power: -8,
    // the scout and the lift; the Cobra is the Advanced Airbase's since
    // 2026-10-01, so the first attack helicopter is a tier-two decision
    produces: ["drone", "theli"],
    upgradesTo: "airbase2",
    upgradeCost: 450,
    upgradeTime: 26,
    sprite: "u.airbase"
  },
  airbase2: {
    id: "airbase2",
    kind: "building",
    domain: "none",
    tier: 2,
    upgradeOnly: true,
    cost: 830,
    buildTime: 50,
    pop: 0,
    hp: 2e3,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 60,
    fw: 4,
    fh: 4,
    weapons: [],
    power: -12,
    produces: ["drone", "heli", "theli", "fighter", "jet", "mjet", "bomber", "c47", "gunship", "hornet"],
    upgradesTo: "airbase3",
    upgradeCost: 950,
    upgradeTime: 48,
    sprite: "u.airbase2",
    sound: "bld-airbase"
  },
  airbase3: {
    id: "airbase3",
    kind: "building",
    domain: "none",
    tier: 3,
    upgradeOnly: true,
    cost: 1780,
    buildTime: 96,
    pop: 0,
    hp: 2700,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 7,
    radius: 60,
    fw: 4,
    fh: 4,
    weapons: [],
    power: -20,
    requires: ["radar"],
    produces: ["drone", "heli", "theli", "fighter", "jet", "mjet", "bomber", "c47", "gunship", "hornet", "wraith", "cormorant"],
    sprite: "u.airbase3",
    sound: "bld-airbase"
  },
  navyard: {
    id: "navyard",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 350,
    buildTime: 22,
    pop: 0,
    hp: 1500,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 45,
    fw: 3,
    fh: 3,
    weapons: [],
    power: -8,
    produces: ["engboat", "gunboat", "mboat", "seatrans"],
    upgradesTo: "navyard2",
    upgradeCost: 450,
    upgradeTime: 26,
    sprite: "u.navyard",
    sound: "unit-ship"
  },
  navyard2: {
    id: "navyard2",
    kind: "building",
    domain: "none",
    tier: 2,
    upgradeOnly: true,
    cost: 800,
    buildTime: 48,
    pop: 0,
    hp: 2200,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 45,
    fw: 3,
    fh: 3,
    weapons: [],
    power: -12,
    produces: ["engboat", "gunboat", "mboat", "seatrans", "frigate", "sub", "gator"],
    upgradesTo: "navyard3",
    upgradeCost: 950,
    upgradeTime: 48,
    sprite: "u.navyard2",
    sound: "unit-ship"
  },
  navyard3: {
    id: "navyard3",
    kind: "building",
    domain: "none",
    tier: 3,
    upgradeOnly: true,
    cost: 1750,
    buildTime: 96,
    pop: 0,
    hp: 3e3,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 7,
    radius: 45,
    fw: 3,
    fh: 3,
    weapons: [],
    power: -20,
    requires: ["radar"],
    produces: ["engboat", "gunboat", "mboat", "seatrans", "frigate", "sub", "gator", "btlship", "kraken", "moray", "carrier"],
    sprite: "u.navyard3",
    sound: "unit-ship"
  },
  /**
   * The MG Turret: a twin mount, and now firing like one.
   *
   * Both barrels were painted and only the middle of the gun ever shot, so
   * `bores` alternates them — `boreSpacing` is measured off `tur.mg`'s own
   * art, and a building is drawn 1:1 so that measurement is world px as it
   * stands. The cyclic rate went up with it (0.35 → 0.25 s, about a third
   * more damage a second): a gun feeding two barrels in turn is faster than
   * one feeding a single barrel, and the pad wanted the help. It stops short
   * of the Gatling it upgrades into, which reloads in 0.14 and has to stay
   * worth the upgrade.
   */
  mgturret: {
    id: "mgturret",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 130,
    buildTime: 10,
    pop: 0,
    hp: 400,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 8,
    radius: 14,
    fw: 1,
    fh: 1,
    power: -2,
    weapons: [w({
      id: "turretmg",
      cls: "mg",
      dmg: 10,
      reload: 0.25,
      range: 5,
      projectile: "bullet",
      speed: 500,
      targets: ["ground", "ship", "air"],
      mult: { ship: 0.6, structure: 0.3 },
      turret: true,
      muzzleOffset: 24.7,
      bores: 2,
      boreSpacing: 5.75,
      sound: "mg"
    })],
    upgradesTo: "gatling",
    upgradeCost: 200,
    upgradeTime: 16,
    sprite: "u.mgturret",
    turretSprite: "tur.mg",
    sound: "bld-cannonturret",
    turretMounts: [{ x: 0, y: -4 }]
  },
  gatling: {
    id: "gatling",
    kind: "building",
    domain: "none",
    tier: 2,
    upgradeOnly: true,
    cost: 330,
    buildTime: 26,
    pop: 0,
    hp: 700,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 8,
    radius: 14,
    fw: 1,
    fh: 1,
    power: -4,
    weapons: [w({
      id: "gatling",
      cls: "mg",
      dmg: 10,
      reload: 0.14,
      range: 6.5,
      projectile: "bullet",
      speed: 520,
      targets: ["ground", "ship", "air"],
      mult: { medium: 0.9, heavy: 0.5, air: 0.8, ship: 0.7, structure: 0.3 },
      turret: true,
      muzzleOffset: 27.2,
      sound: "mg"
    })],
    sprite: "u.gatling",
    turretSprite: "tur.gatling",
    sound: "bld-cannonturret",
    turretMounts: [{ x: 0, y: -5 }]
  },
  cannonturret: {
    id: "cannonturret",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 320,
    buildTime: 18,
    pop: 0,
    hp: 700,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 8,
    radius: 14,
    fw: 1,
    fh: 1,
    power: -3,
    weapons: [w({
      // static guns hit buildings softer than tanks do — no turret creep
      id: "cannon",
      cls: "cannon",
      dmg: 65,
      reload: 1.9,
      range: 6,
      projectile: "shell",
      speed: 420,
      targets: ["ground", "ship"],
      mult: { heavy: 1.1, structure: 0.6, ship: 1 },
      turret: true,
      recoil: 1.8,
      muzzleOffset: 29,
      splash: 12,
      sound: "cannon"
    })],
    upgradesTo: "cannonturret2",
    upgradeCost: 340,
    upgradeTime: 22,
    sprite: "u.cannonturret",
    turretSprite: "tur.cannon",
    turretMounts: [{ x: 0, y: -4 }]
  },
  cannonturret2: {
    id: "cannonturret2",
    kind: "building",
    domain: "none",
    tier: 2,
    upgradeOnly: true,
    cost: 660,
    buildTime: 40,
    pop: 0,
    hp: 1500,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 9,
    radius: 14,
    fw: 1,
    fh: 1,
    power: -5,
    weapons: [w({
      id: "twincannon",
      cls: "cannon",
      dmg: 60,
      reload: 2,
      range: 7.5,
      projectile: "shell",
      speed: 420,
      targets: ["ground", "ship"],
      mult: { heavy: 1.2, structure: 0.6, ship: 1.1 },
      // Hidden swivel at (464,1100), tips at y20 with 228px separation;
      // the 928×1712 master is drawn in a 28×52 world-pixel frame.
      turret: true,
      recoil: 2.2,
      muzzleOffset: 32.8037,
      bores: 2,
      boreSpacing: 6.87931,
      splash: 14,
      burst: 2,
      burstDelay: 0.2,
      sound: "cannon"
    })],
    sprite: "u.cannonturret2",
    turretSprite: "tur.cannon2"
  },
  aaturret: {
    id: "aaturret",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 400,
    buildTime: 14,
    pop: 0,
    hp: 600,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 9,
    radius: 14,
    fw: 1,
    fh: 1,
    power: -3,
    weapons: [w({
      id: "aaflak",
      cls: "aa",
      dmg: 33,
      reload: 0.8,
      range: 8,
      projectile: "flak",
      speed: 480,
      targets: ["air"],
      turret: true,
      muzzleOffset: 27.4,
      sound: "flak"
    })],
    upgradesTo: "samsite",
    upgradeCost: 600,
    upgradeTime: 20,
    sprite: "u.aaturret",
    turretSprite: "tur.aa",
    sound: "bld-cannonturret"
  },
  /**
   * The upgraded flak tower, and the one emplacement a nuclear warhead has to
   * answer to: `antiWarhead` lifts the rank gate that keeps every building
   * off one (`canEngageWarhead` in combat.ts), so a base that paid for its
   * strategic air defence gets a vote on the strike without a veteran Hawk
   * standing under the path. Its damage is what sets the price of that vote —
   * see nuke.test.ts for how many sites it takes.
   */
  samsite: {
    id: "samsite",
    kind: "building",
    domain: "none",
    tier: 2,
    upgradeOnly: true,
    cost: 1e3,
    buildTime: 34,
    pop: 0,
    hp: 800,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 11,
    radius: 14,
    fw: 1,
    fh: 1,
    power: -6,
    antiWarhead: true,
    weapons: [w({
      id: "samsite",
      cls: "aa",
      dmg: 170,
      reload: 2.6,
      range: 10,
      projectile: "missile",
      speed: 460,
      targets: ["air"],
      turret: true,
      muzzleOffset: 20.5,
      bores: 4,
      boreSpacing: 3.5,
      splash: 29,
      homing: true,
      sound: "missile"
    })],
    sprite: "u.samsite",
    turretSprite: "tur.samsite",
    sound: "bld-cannonturret"
  },
  /**
   * Point defence. It cannot shoot at anything on the ground: its rounds are
   * spent on incoming rockets and Viper missiles, one round per round shot
   * down. A nuclear warhead is not its business at either tier — that is an
   * aircraft, and anti-air (a veteran, or a SAM Site) shoots it down or
   * nothing does.
   * The magazine is one Tempest salvo (8 rockets) so a barrage is absorbed
   * whole, and the reload is what sets the duel: one launcher throws 8
   * rockets every 8s (1/s) and one tower replaces 1.33 rounds a second,
   * so a single Tempest never lands a rocket and a second one breaks
   * through. Anything faster here makes the tower unanswerable; anything
   * slower and one launcher grinds it down alone. See interceptor.test.ts.
   */
  interceptor: {
    id: "interceptor",
    kind: "building",
    domain: "none",
    tier: 2,
    cost: 450,
    buildTime: 24,
    pop: 0,
    hp: 600,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 9,
    radius: 14,
    fw: 1,
    fh: 1,
    power: -8,
    weapons: [],
    interceptRange: 7,
    interceptMag: 8,
    interceptReload: 0.75,
    interceptMuzzleOffset: 19,
    upgradesTo: "interceptor2",
    upgradeCost: 650,
    upgradeTime: 36,
    sprite: "u.interceptor",
    turretSprite: "tur.interceptor",
    sound: "bld-cannonturret"
  },
  interceptor2: {
    id: "interceptor2",
    kind: "building",
    domain: "none",
    tier: 3,
    upgradeOnly: true,
    cost: 1100,
    buildTime: 60,
    pop: 0,
    hp: 900,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 11,
    radius: 14,
    fw: 1,
    fh: 1,
    power: -12,
    weapons: [],
    interceptRange: 9,
    interceptMag: 12,
    interceptReload: 0.75,
    interceptMuzzleOffset: 21.5,
    sprite: "u.interceptor2",
    turretSprite: "tur.interceptor2",
    sound: "bld-cannonturret"
  },
  /**
   * The sandbag line: a tile of wall, and the cheapest hit points in the
   * game. It stands across a chokepoint so a column has to go round it or
   * shoot through it (`acquireTarget` puts it last on every gun's list, so
   * an attacker grinds through it only when nothing else is in reach), and
   * every tile laid beside another joins it — the sixteen joints are the
   * sheet's frames, picked off the neighbours (`game/walls.ts`). It has no
   * gun, draws no power (so a pulse leaves it standing), takes no
   * production slot, is built on the ground its headquarters hold like any
   * building, and comes down without a charge (`raze`). Structure armour:
   * a shell or a bomb takes it apart, small arms barely scratch it, which
   * is the point of stacking bags in front of a gun.
   */
  sandbag: {
    id: "sandbag",
    kind: "building",
    domain: "none",
    tier: 1,
    wall: true,
    cost: 40,
    buildTime: 4,
    pop: 0,
    hp: 500,
    armor: "structure",
    impactMaterial: "earth",
    speed: 0,
    turnRate: 0,
    vision: 3,
    radius: 14,
    fw: 1,
    fh: 1,
    weapons: [],
    sprite: "u.sandbag"
  },
  landmine: {
    id: "landmine",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 60,
    buildTime: 4,
    pop: 0,
    hp: 45,
    armor: "light",
    speed: 0,
    turnRate: 0,
    vision: 0,
    radius: 6,
    fw: 1,
    fh: 1,
    mine: 3,
    stealth: 0.5,
    weapons: [w({
      id: "mineblast",
      cls: "he",
      dmg: 200,
      reload: 1,
      range: 0.65,
      projectile: "shell",
      speed: 0,
      splash: 1.5 * 32,
      targets: ["ground"],
      mult: { light: 1.2, medium: 1, heavy: 0.25, structure: 0.1, ship: 0 }
    })],
    sprite: "u.landmine"
  },
  watermine: {
    id: "watermine",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 60,
    buildTime: 4,
    pop: 0,
    hp: 45,
    armor: "ship",
    speed: 0,
    turnRate: 0,
    vision: 0,
    radius: 6,
    fw: 1,
    fh: 1,
    mine: 3,
    stealth: 0.5,
    offshore: true,
    weapons: [w({
      id: "navalmineblast",
      cls: "he",
      dmg: 200,
      reload: 1,
      range: 0.65,
      projectile: "shell",
      speed: 0,
      splash: 1.5 * 32,
      targets: ["ship", "sub"],
      mult: { light: 1.2, medium: 1, heavy: 0.25, structure: 0, ship: 1, sub: 1, air: 0 }
    })],
    sprite: "u.watermine"
  },
  /**
   * One tile, like a gun pad: a base wants it beside the turret line and at
   * the staging point, and a 2×2 was a footprint that did not fit either.
   */
  repairtower: {
    id: "repairtower",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 360,
    buildTime: 20,
    pop: 0,
    hp: 750,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 7,
    radius: 14,
    fw: 1,
    fh: 1,
    weapons: [],
    power: -8,
    repairRange: 5.5,
    repairRate: 20,
    repairTargets: 3,
    sprite: "u.repairtower"
  },
  /**
   * The radar lifts the fog for 24 tiles round it — three times a turret's
   * sight and the largest circle in the game, so one in the base shows the
   * whole approach and every gun and battery inside the circle fires at
   * what it could never see for itself. Short of power it falls back to a
   * turret's sight (`updateFog`).
   */
  radar: {
    id: "radar",
    kind: "building",
    domain: "none",
    tier: 2,
    cost: 400,
    buildTime: 20,
    pop: 0,
    hp: 800,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 24,
    radius: 30,
    fw: 2,
    fh: 2,
    // and it sees through stealth: a Wraith is visible within 8 tiles of it
    weapons: [],
    power: -8,
    detect: 8,
    radar: true,
    sprite: "u.radar",
    turretSprite: "tur.radar",
    turretSpins: true
  },
  /**
   * The War Lab researches the tech tree (`game/tech.ts`): the doctrine a
   * faction fights by, the units and abilities it unlocks, and the economy
   * buffs any doctrine may take. One a faction (`unique`); what it has
   * researched stays researched when it falls, and only the head of its
   * queue is lost. A Tier-1 building, since the doctrine is a minute-three
   * decision; it draws a plant's worth of power, so the research is slowed
   * by a shortage as a factory's work is.
   */
  warlab: {
    id: "warlab",
    kind: "building",
    domain: "none",
    tier: 1,
    unique: true,
    lab: true,
    cost: 500,
    buildTime: 30,
    pop: 0,
    hp: 1200,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    power: -10,
    sprite: "u.warlab",
    sound: "bld-radar"
  },
  veil: {
    id: "veil",
    kind: "building",
    domain: "none",
    tier: 2,
    cost: 600,
    buildTime: 35,
    pop: 0,
    hp: 900,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    power: -20,
    requires: ["radar"],
    jamRange: 8,
    sprite: "u.veil",
    turretSprite: "tur.veil",
    turretSpins: true
  },
  /**
   * The reactor breeds the cores a warhead is built round: with a radar it is
   * what a silo needs to be built, and what a silo or a submarine needs to
   * fabricate and fire. It feeds the grid as well, though dearer per unit of
   * power than the plant line, which it does not replace.
   */
  reactor: {
    id: "reactor",
    kind: "building",
    domain: "none",
    tier: 3,
    cost: 1400,
    buildTime: 60,
    pop: 0,
    hp: 2200,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 44,
    fw: 3,
    fh: 3,
    weapons: [],
    power: 100,
    requires: ["radar"],
    sprite: "u.reactor",
    sound: "bld-extractor2"
  },
  /**
   * A silo the way one is in the ground: two tiles of concrete over one
   * shaft, a hatch that takes `hatch` seconds to slide open before the
   * warhead leaves (`Game.tickHatch`), and three warheads in the magazine.
   */
  nukesilo: {
    id: "nukesilo",
    kind: "building",
    domain: "none",
    tier: 3,
    cost: 1800,
    buildTime: 75,
    pop: 0,
    hp: 1800,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 7,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    power: -40,
    requires: ["radar", "reactor", "nuclearProgram"],
    nukeCapacity: 3,
    nukeCost: 2500,
    nukeTime: 180,
    hatch: 1.2,
    sprite: "u.nukesilo",
    sound: "bld-extractor2"
  }
};
const ALL_DEF_IDS = Object.keys(DEFS);
const VANILLA_DEF_IDS = new Set(ALL_DEF_IDS);
function getDef(id) {
  const d = DEFS[id];
  if (!d) throw new Error(`unknown def: ${id}`);
  return d;
}
function mapUnitRect(u) {
  const def = getDef(u.id);
  return def.kind === "building" ? { x: u.x, y: u.y, fw: def.fw ?? 1, fh: def.fh ?? 1 } : { x: u.x, y: u.y, fw: 1, fh: 1 };
}
function normalizeTerrainLayers(m) {
  for (let i = 0; i < m.terrain.length; i++) if (m.terrain[i] === Terrain.Bridge) {
    (m.overlays ??= new Uint8Array(m.w * m.h))[i] = Terrain.Bridge;
    m.terrain[i] = Terrain.Water;
  }
}
const DECOR = {
  pole: { fw: 1, fh: 1, sprite: "d.pole", color: [96, 78, 58], hp: 20, shadow: 6 },
  tower: { fw: 1, fh: 1, sprite: "d.tower", color: [76, 80, 86], hp: 90, shadow: 14 },
  /** a date palm: the one tree that stands on sand, an obstacle a tile wide; three drawings, mixed */
  palm: { fw: 1, fh: 1, sprite: "d.palm", color: [86, 120, 60], hp: 40, variants: 3, shadow: 9 },
  /** a canvas field tent, sandbagged: the camp round a staging post */
  tent: { fw: 2, fh: 2, sprite: "d.tent", color: [128, 116, 84], hp: 90 },
  /** an arched aircraft shelter of concrete: what an airfield keeps beside its strip */
  hangar: { fw: 3, fh: 2, sprite: "d.hangar", color: [112, 108, 100], hp: 260 },
  /** a concrete bunker, half buried, the firing slit facing south */
  bunker: { fw: 2, fh: 2, sprite: "d.bunker", color: [98, 94, 86], hp: 340 },
  /**
   * A cargo ship going down by the stern, the bow still up and the boxes
   * sliding off her deck: what the open sea is dressed with. Four tiles long
   * and two across, lying north to south with the bow to the north; a hull,
   * so it takes a broadside to finish, and what finishes it is the sea
   * (`razeDecor`). The wash round her is the renderer's (the idle ripple a
   * ship at rest gets, `render/trails.ts`), not the sheet's.
   */
  freighter: { fw: 2, fh: 4, sprite: "d.freighter", water: true, color: [96, 60, 44], hp: 320 },
  /**
   * The same wreck lying east to west, the bow to the west: a kind of its own
   * rather than a variant, since a variant shares its kind's footprint and
   * this one is the footprint turned. Two on a map, one each way, and the
   * sea stops looking stamped.
   */
  freighter2: { fw: 4, fh: 2, sprite: "d.freighter2", water: true, color: [96, 60, 44], hp: 320 }
};
const RETIRED_DECOR = ["derrick"];
function isDecorKind(k) {
  return typeof k === "string" && Object.prototype.hasOwnProperty.call(DECOR, k);
}
function rleEncode(a) {
  const out = [];
  let i = 0;
  while (i < a.length) {
    const v = a[i];
    let run = 1;
    while (i + run < a.length && a[i + run] === v && run < 255) run++;
    out.push(run, v);
    i += run;
  }
  let s = "";
  for (let k = 0; k < out.length; k += 4096) {
    s += String.fromCharCode(...out.slice(k, k + 4096));
  }
  return btoa(s);
}
function rleDecode(s, len) {
  return rleDecodeInto(s, new Uint8Array(len));
}
function rleDecodeInto(s, out) {
  const len = out.length;
  if (!s) {
    out.fill(0);
    return out;
  }
  const raw = atob(s);
  let oi = 0;
  for (let i = 0; i + 1 < raw.length; i += 2) {
    const run = raw.charCodeAt(i);
    const v = raw.charCodeAt(i + 1);
    out.fill(v, oi, Math.min(len, oi + run));
    oi += run;
  }
  if (oi < len) out.fill(0, oi);
  return out;
}
const TERRAIN_BASES = Object.freeze({
  grass: Terrain.Grass,
  sand: Terrain.Sand,
  road: Terrain.Road,
  mud: Terrain.Mud,
  marsh: Terrain.Marsh,
  snow: Terrain.Snow,
  rubble: Terrain.Rubble,
  ice: Terrain.Ice,
  city: Terrain.City
});
const CITY_FORMS = ["slab", "court", "terrace", "stepped"];
const VARIANT_ID_RE = /^[a-z0-9][a-z0-9_-]{1,39}$/;
function readTerrainAssignments(value, path, issues) {
  if (value === void 0) return void 0;
  const start = issues.length;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    issues.push({ path, message: "must be an object of terrain base → variant id" });
    return void 0;
  }
  const entries = Object.entries(value);
  if (entries.length > Object.keys(TERRAIN_BASES).length) {
    issues.push({ path, message: `at most ${Object.keys(TERRAIN_BASES).length} terrain bindings` });
    return void 0;
  }
  const out = {};
  for (const [base, id] of entries) {
    if (!Object.hasOwn(TERRAIN_BASES, base)) issues.push({ path: `${path}.${base}`, message: "unsupported terrain base" });
    else if (typeof id !== "string" || !VARIANT_ID_RE.test(id) || !id.includes("-"))
      issues.push({ path: `${path}.${base}`, message: "must be a namespaced terrain variant id, 2–40 characters" });
    else out[base] = id;
  }
  return issues.length === start && entries.length > 0 ? out : void 0;
}
let active$1 = Object.freeze([]);
let byId = /* @__PURE__ */ new Map();
function replaceTerrainVariants(variants) {
  active$1 = Object.freeze(variants.map((variant) => Object.freeze({
    ...variant,
    name: Object.freeze([...variant.name]),
    ...variant.city ? { city: Object.freeze({
      ...variant.city,
      ...variant.city.architecture ? { architecture: Object.freeze({
        ...variant.city.architecture,
        ...variant.city.architecture.forms ? { forms: Object.freeze([...variant.city.architecture.forms]) } : {}
      }) } : {}
    }) } : {}
  })));
  byId = new Map(active$1.map((variant) => [variant.id, variant]));
}
function activeTerrainVariants() {
  return active$1;
}
function terrainVariant(id) {
  return byId.get(id);
}
const CUSTOM_MAP_FORMAT = "steel-tide-map";
const CUSTOM_MAP_VERSION = 1;
const CUSTOM_MAP_EXT = ".steel-tide-map";
const MAX_DEPOSITS = 400;
const MAX_DECOR = 4e3;
const MAX_MAP_UNITS = 400;
const MAX_NAME_LENGTH = 48;
const MAX_DESCRIPTION_LENGTH = 240;
const MAP_LANG_RE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/;
const MAX_TRANSLATIONS = 16;
function isMapUnitId(id, only) {
  return (only ? only.has(id) : id in DEFS) && !DEFS[id]?.warhead;
}
function readDecor(list, w2, h) {
  if (list === void 0) return [];
  if (!Array.isArray(list)) return "bad props";
  if (list.length > MAX_DECOR) return "too many props";
  const taken = new Uint8Array(w2 * h);
  const out = [];
  for (const item of list) {
    if (!item || typeof item !== "object") return "bad props";
    const { kind, x, y } = item;
    if (typeof kind === "string" && RETIRED_DECOR.includes(kind)) continue;
    if (!isDecorKind(kind)) return "the map uses a prop this build does not know";
    const def = DECOR[kind];
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x + def.fw > w2 || y + def.fh > h) {
      return "a prop lies outside the map";
    }
    const tx = x, ty = y;
    let free = true;
    for (let yy = ty; yy < ty + def.fh && free; yy++) {
      for (let xx = tx; xx < tx + def.fw; xx++) if (taken[yy * w2 + xx]) {
        free = false;
        break;
      }
    }
    if (!free) continue;
    for (let yy = ty; yy < ty + def.fh; yy++) for (let xx = tx; xx < tx + def.fw; xx++) taken[yy * w2 + xx] = 1;
    out.push({ kind, x: tx, y: ty });
  }
  return out;
}
function readUnits(list, w2, h, only) {
  if (list === void 0) return [];
  if (!Array.isArray(list)) return "bad units";
  if (list.length > MAX_MAP_UNITS) return "too many units";
  const taken = new Uint8Array(w2 * h);
  const out = [];
  for (const item of list) {
    if (!item || typeof item !== "object") return "bad units";
    const { id, owner, x, y, a } = item;
    if (typeof id !== "string" || !isMapUnitId(id, only)) return "the map stands a unit this build does not know";
    if (!Number.isInteger(owner) || owner < 0 || owner >= MAX_PLAYERS) return "a unit belongs to no faction";
    if (!Number.isInteger(x) || !Number.isInteger(y)) return "bad units";
    const r = mapUnitRect({ id, x, y });
    if (r.x < 0 || r.y < 0 || r.x + r.fw > w2 || r.y + r.fh > h) return "a unit lies outside the map";
    let facing;
    if (a !== void 0 && DEFS[id].kind === "unit") {
      if (!Number.isInteger(a) || a < 0 || a >= 360) return "bad units";
      facing = a;
    }
    let free = true;
    for (let yy = r.y; yy < r.y + r.fh && free; yy++) {
      for (let xx = r.x; xx < r.x + r.fw; xx++) if (taken[yy * w2 + xx]) {
        free = false;
        break;
      }
    }
    if (!free) continue;
    for (let yy = r.y; yy < r.y + r.fh; yy++) for (let xx = r.x; xx < r.x + r.fw; xx++) taken[yy * w2 + xx] = 1;
    out.push({ id, owner, x: r.x, y: r.y, ...facing !== void 0 ? { a: facing } : {} });
  }
  return out;
}
function cleanLine(name) {
  return name.replace(/[\r\n\t]+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
}
function cleanName(name) {
  return cleanLine(name) || "Untitled";
}
function cleanDescription(text) {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_DESCRIPTION_LENGTH);
}
function cleanTranslations(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return void 0;
  const out = {};
  let n = 0;
  for (const [key, given] of Object.entries(v)) {
    const lang2 = key.toLowerCase();
    if (!MAP_LANG_RE.test(lang2) || lang2 in out || !given || typeof given !== "object") continue;
    const { name, description } = given;
    const text = {};
    const line = typeof name === "string" ? cleanLine(name) : "";
    if (line) text.name = line;
    const blurb = typeof description === "string" ? cleanDescription(description) : "";
    if (blurb) text.description = blurb;
    if (!text.name && !text.description) continue;
    if (++n > MAX_TRANSLATIONS) break;
    out[lang2] = text;
  }
  return n ? out : void 0;
}
function parseCustomMap(json, opts = {}) {
  if (typeof json !== "string" || json.length === 0 || json.length > 4 * 1024 * 1024) {
    return { ok: false, error: "the file is empty or too large" };
  }
  let raw;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: "not a map file" };
  }
  if (!raw || typeof raw !== "object") return { ok: false, error: "not a map file" };
  const r = raw;
  if (r.format !== CUSTOM_MAP_FORMAT) return { ok: false, error: "not a Steel Tide map" };
  if (r.v !== CUSTOM_MAP_VERSION) return { ok: false, error: `unsupported map version ${String(r.v)}` };
  if (!Number.isInteger(r.w) || !Number.isInteger(r.h) || r.w < MIN_MAP_SIDE || r.h < MIN_MAP_SIDE || r.w > MAX_MAP_SIDE || r.h > MAX_MAP_SIDE) {
    return { ok: false, error: `the map must be ${MIN_MAP_SIDE}–${MAX_MAP_SIDE} tiles a side` };
  }
  const w2 = r.w, h = r.h;
  if (typeof r.terrain !== "string" || r.terrain.length > 2 * 1024 * 1024) return { ok: false, error: "bad terrain data" };
  let terrain;
  try {
    terrain = rleDecode(r.terrain, w2 * h);
  } catch {
    return { ok: false, error: "bad terrain data" };
  }
  for (let i = 0; i < terrain.length; i++) {
    if (terrain[i] >= TERRAIN_KINDS) return { ok: false, error: "the map uses a terrain this build does not know" };
  }
  const variantIssues = [];
  const terrainVariants = readTerrainAssignments(r.terrainVariants, "terrainVariants", variantIssues);
  if (variantIssues.length) return { ok: false, error: `${variantIssues[0].path}: ${variantIssues[0].message}` };
  let overlays;
  if (r.overlays !== void 0) {
    if (typeof r.overlays !== "string") return { ok: false, error: "bad overlay data" };
    try {
      overlays = rleDecode(r.overlays, w2 * h);
    } catch {
      return { ok: false, error: "bad overlay data" };
    }
    if (overlays.some((t) => t !== 0 && t !== Terrain.Bridge)) return { ok: false, error: "the map uses an overlay this build does not know" };
  }
  const layers = { w: w2, h, terrain, overlays };
  normalizeTerrainLayers(layers);
  overlays = layers.overlays;
  const points = (list, max, what) => {
    if (list === void 0) return [];
    if (!Array.isArray(list)) return `bad ${what}`;
    if (list.length > max) return `too many ${what}`;
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const p of list) {
      if (!p || typeof p !== "object") return `bad ${what}`;
      const { x, y } = p;
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= w2 || y >= h) {
        return `a ${what.replace(/s$/, "")} lies outside the map`;
      }
      const key = y * w2 + x;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ x, y });
    }
    return out;
  };
  const deposits = points(r.deposits, MAX_DEPOSITS, "deposits");
  if (typeof deposits === "string") return { ok: false, error: deposits };
  const spawns = points(r.spawns, MAX_PLAYERS, "spawns");
  if (typeof spawns === "string") return { ok: false, error: spawns };
  const decor = readDecor(r.decor, w2, h);
  if (typeof decor === "string") return { ok: false, error: decor };
  const units = readUnits(r.units, w2, h, opts.only);
  if (typeof units === "string") return { ok: false, error: units };
  const description = cleanDescription(typeof r.description === "string" ? r.description : "");
  const translations = cleanTranslations(r.translations);
  const author = typeof r.author === "string" ? cleanLine(r.author) : "";
  return {
    ok: true,
    data: {
      format: CUSTOM_MAP_FORMAT,
      v: CUSTOM_MAP_VERSION,
      name: cleanName(typeof r.name === "string" ? r.name : ""),
      ...author ? { author } : {},
      ...description ? { description } : {},
      ...translations ? { translations } : {},
      w: w2,
      h,
      terrain: rleEncode(terrain),
      ...terrainVariants ? { terrainVariants } : {},
      ...overlays?.some(Boolean) ? { overlays: rleEncode(overlays) } : {},
      deposits,
      spawns,
      ...decor.length ? { decor } : {},
      ...units.length ? { units } : {}
    }
  };
}
const RULE_EVENTS = ["created", "destroyed", "fired", "damaged", "kill", "morphed"];
const MAX_DEF_RULES = 24;
const MAX_RULE_EFFECTS = 8;
const MAX_DEF_BUTTONS = 8;
const RULE_SOUNDS = ["expl", "explBig", "upgrade"];
const VANILLA_FX = [
  "fx.expl.s",
  "fx.expl.m",
  "fx.expl.l",
  "fx.spark",
  "fx.flak",
  "fx.smoke",
  "fx.splash",
  "fx.splash.l",
  "fx.muzzle",
  "fx.repair",
  "fx.emp",
  "fx.nuke"
];
const RULE_SPECS = [
  { name: "on", type: "enum", values: RULE_EVENTS, doc: [
    "runs when this happens to it: made (`created`, and when a map stands it), killed (`destroyed`, where it fell), a shot fired (`fired`), hurt (`damaged`), a kill made (`kill`), or a change of form finished (`morphed`)",
    "在发生这些事时执行：被造出（`created`，地图上预置的也算）、被摧毁（`destroyed`，在倒下的地方）、开火（`fired`）、受伤（`damaged`）、击杀（`kill`）、变形完成（`morphed`）"
  ] },
  { name: "when", type: "cond", doc: [
    "runs when this condition becomes true, and again only after it has been false (see Conditions)",
    "当此条件变为成立时执行；须先变回不成立才会再次触发（见“条件”）"
  ] },
  { name: "every", type: "number", min: 0.25, max: 3600, doc: [
    "runs every so many seconds of its life",
    "在存活期间每隔若干秒执行一次"
  ] },
  { name: "button", type: "button", doc: [
    "a button on its card the player presses (see Buttons)",
    "卡片上由玩家按下的按钮（见“按钮”）"
  ] },
  { name: "if", type: "cond", doc: [
    "also checked when triggered: the rule runs only if this holds too; on a button, the button is greyed while it does not",
    "触发时同时检查：仅当它也成立时才执行；用于按钮时，不成立则按钮置灰"
  ] },
  { name: "chance", type: "number", min: 0, max: 1, def: "1", doc: ["the odds it runs when triggered", "触发时执行的概率"] },
  { name: "cooldown", type: "number", min: 0, max: 3600, doc: ["seconds before it may run again", "再次执行前的冷却秒数"] },
  { name: "max", type: "int", min: 1, max: 1e3, doc: ["times it may run on one unit, ever", "同一单位上最多执行的次数"] },
  { name: "do", type: "effects", required: true, doc: [
    `what it does: an effect or a list of up to ${MAX_RULE_EFFECTS}, in order (see Effects)`,
    `执行的效果：一个效果或最多 ${MAX_RULE_EFFECTS} 个效果的列表，依次执行（见“效果”）`
  ] }
];
const COND_SPECS = [
  { name: "moving", type: "bool", doc: ["is driving, flying or swimming (true) or standing (false)", "正在移动（true）或静止（false）"] },
  { name: "still", type: "number", min: 0, max: 3600, doc: ["has not moved for at least this many seconds", "已静止至少这么多秒"] },
  { name: "firedWithin", type: "number", min: 0, max: 3600, doc: ["fired within the last so many seconds", "最近这么多秒内开过火"] },
  { name: "quiet", type: "number", min: 0, max: 3600, doc: ["has not fired for at least this many seconds", "已至少这么多秒没有开火"] },
  { name: "hurtWithin", type: "number", min: 0, max: 3600, doc: ["was hurt within the last so many seconds", "最近这么多秒内受过伤"] },
  { name: "hpBelow", type: "number", min: 0, max: 1, doc: ["health below this share of its whole", "生命低于总量的此比例"] },
  { name: "hpAbove", type: "number", min: 0, max: 1, doc: ["health above this share of its whole", "生命高于总量的此比例"] },
  { name: "age", type: "number", min: 0, max: 36e3, doc: ["seconds since it was made, or last changed form", "自被造出或上次变形以来的秒数"] },
  { name: "flag", type: "string", max: 32, doc: ["a flag a rule has set on it is up", "规则设置的某个标记为开"] },
  { name: "noFlag", type: "string", max: 32, doc: ["that flag is down", "该标记为关"] },
  { name: "kills", type: "int", min: 0, max: 1e4, doc: ["it has made at least this many kills", "击杀数至少为此"] },
  { name: "rank", type: "int", min: 1, max: 3, doc: ["its veteran rank is at least this", "老兵等级至少为此"] },
  { name: "onWater", type: "bool", doc: ["stands on water (true) or on land (false)", "位于水面（true）或陆地（false）"] },
  { name: "enemyWithin", type: "number", min: 0.5, max: 32, doc: ["an enemy its side can see is within this many tiles", "己方可见的敌人在此格数之内"] },
  { name: "near", type: "near", doc: ["others stand near it: at least `count` of these `units` or this `kind`, on this `side`, `within` so many tiles (see Near)", "附近有其他单位：`within` 格之内至少有 `count` 个属于 `side` 一方的 `units` 或 `kind`（见“附近”）"] },
  { name: "night", type: "bool", doc: ["it is night (true) or day (false)", "是夜晚（true）或白天（false）"] },
  { name: "carrying", type: "int", min: 1, max: 50, doc: ["has at least this many units in its hold", "载有至少这么多单位"] },
  { name: "killedBy", type: "ids", doc: ["on `destroyed`: what killed it was one of these defs (the dead rise only when the dead killed them)", "用于 `destroyed`：击杀它的是这些定义之一（只有被丧尸杀死的才会尸变）"] },
  { name: "any", type: "cond", doc: ["a list of conditions, one of which must hold", "条件列表，其中任一成立即可"] },
  { name: "not", type: "cond", doc: ["a condition that must not hold", "必须不成立的条件"] }
];
const EFFECT_SPECS = [
  { name: "morph", type: "id", doc: [
    "become another def of this mod, in place: the same unit (its selection, its kills and rank, the orders the new form can carry out), its health keeping its share of the whole. A building only takes the form of a building of the same footprint",
    "原地变为本模组的另一个定义：仍是同一个单位（选中状态、击杀与等级、新形态能执行的命令都保留），生命值按比例保留。建筑只能变为占地相同的建筑"
  ] },
  { name: "spawn", type: "spawn", doc: ["units put down beside it, or into its hold (see Spawn)", "在其旁边或其载舱内生成单位（见“生成”）"] },
  { name: "heal", type: "number", min: -1e6, max: 1e6, doc: ["hit points given back; negative takes them, never the last one", "回复的生命值；负数为扣除，但不会致死"] },
  { name: "healPct", type: "number", min: -1, max: 1, doc: ["a share of its whole health given back", "按总生命比例回复"] },
  { name: "metal", type: "number", min: -99999, max: 99999, doc: ["metal to its side; negative takes it, never below nothing", "给予己方的金属；负数为扣除，最低为零"] },
  { name: "flag", type: "string", max: 32, doc: ["raise a flag on it, for a condition to read", "设置一个标记，供条件读取"] },
  { name: "unflag", type: "string", max: 32, doc: ["lower that flag", "清除该标记"] },
  { name: "buff", type: "buff", doc: [
    "multipliers held for `for` seconds: `speed`, the `damage` it deals, its `reload` time, and the harm it is `taken`; a new buff replaces the one it has",
    "持续 `for` 秒的倍率：`speed` 速度、`damage` 造成伤害、`reload` 装填时间、`taken` 承受伤害；新的增益会替换旧的"
  ] },
  { name: "explode", type: "explode", doc: [
    "a blast round it: `dmg` at the centre falling to half at the edge of `radius` (world px), through the armour row of `cls` (default he); its own side is spared unless `friendlyFire`",
    "以自身为中心爆炸：中心伤害 `dmg`，在 `radius`（世界像素）边缘降为一半，按 `cls`（默认 he）的装甲倍率计算；除非 `friendlyFire`，否则不伤己方"
  ] },
  { name: "fx", type: "string", max: 48, doc: [`an effect played where it stands: one of this mod's \`fx.<name>\` sheets, or ${VANILLA_FX.join(", ")}`, `在其位置播放的特效：本模组的 \`fx.<名字>\` 精灵图，或 ${VANILLA_FX.join("、")}`] },
  { name: "fxScale", type: "number", min: 0.05, max: 8, def: "1", doc: ["the effect drawn at this multiple", "特效的缩放倍数"] },
  { name: "sound", type: "string", max: 64, doc: ["a sound played where it stands: a weapon sound, expl, explBig, upgrade, or one of this mod's `sounds`", "在其位置播放的声音：武器音效、expl、explBig、upgrade，或本模组的 `sounds`"] },
  { name: "die", type: "bool", doc: ["it is destroyed, as if killed by nobody (its own `destroyed` rules run)", "被摧毁，如同无人击杀（其 `destroyed` 规则会执行）"] },
  { name: "remove", type: "bool", doc: ["it is gone without a trace: no wreck, no loss, no `destroyed`", "无痕消失：没有残骸、不计损失、不触发 `destroyed`"] }
];
const NEAR_SPECS = [
  { name: "units", type: "ids", doc: ["these defs only: the game's or any mod's", "仅限这些定义：原版或任何模组的"] },
  { name: "kind", type: "enum", values: ["unit", "building"], doc: ["only units, or only buildings", "仅限单位，或仅限建筑"] },
  { name: "side", type: "enum", values: ["friend", "enemy", "any"], def: "any", doc: ["whose: its own side and its allies (`friend`), an enemy's (only what its side can see), or anyone's", "归属：己方及盟友（`friend`）、敌方（仅限己方可见的），或任何一方"] },
  { name: "within", type: "number", min: 0.5, max: 32, required: true, doc: ["tiles from it to the other's edge", "从它到对方边缘的格数"] },
  { name: "count", type: "int", min: 1, max: 50, def: "1", doc: ["at least this many", "至少这么多个"] }
];
const SPAWN_SPECS = [
  { name: "unit", type: "id", required: true, doc: ["the unit: one of the game's or this mod's", "生成的单位：原版或本模组的"] },
  { name: "count", type: "int", min: 1, max: 16, def: "1", doc: ["how many", "数量"] },
  { name: "side", type: "enum", values: ["own", "killer"], def: "own", doc: ["whose they are: its own side's, or (on `destroyed`) the side that killed it", "归属：己方，或（在 `destroyed` 中）击杀者一方"] },
  { name: "into", type: "enum", values: ["hold"], doc: ["straight into its own hold, as far as the room goes, instead of beside it", "直接放进自身载舱（以剩余空间为限），而不是放在旁边"] },
  { name: "max", type: "int", min: 1, max: 64, doc: ["at most this many of the units this rule has spawned alive at once", "此规则生成的单位同时存活的上限"] }
];
const BUTTON_SPECS = [
  { name: "name", type: "text", def: "the form it makes", doc: ["the button's label", "按钮名称"] },
  { name: "desc", type: "text", doc: ["its tooltip line", "提示中的描述"] },
  { name: "cost", type: "number", min: 0, max: 99999, def: "0", doc: ["metal, paid as the work is done", "金属，随工作进度支付"] },
  { name: "time", type: "number", min: 0, max: 3600, def: "0", doc: ["seconds of work at full power; 0 is at once", "满电力下的工作秒数；0 为立即"] },
  { name: "requires", type: "ids", doc: ["buildings that must stand, or tech nodes researched, for it to be pressed (and to go on)", "按下（及持续进行）所需存在的建筑或已研究的科技"] },
  { name: "ai", type: "bool", doc: ["a computer side presses it too, when it can spare the metal", "电脑一方在有余钱时也会按下它"] }
];
const LOOK_SPECS = [
  { name: "sprite", type: "string", max: 48, doc: ["the round: one of this mod's `prj.<name>` sheets — its frames play as it flies, or, baked `rotated`, it is turned to its heading", "弹药图像：本模组的 `prj.<名字>` 精灵图——飞行时播放其帧；若为 `rotated`，则朝向飞行方向"] },
  { name: "scale", type: "number", min: 0.1, max: 8, def: "1", doc: ["the round and its flash drawn at this multiple", "弹药与枪口焰的缩放倍数"] },
  { name: "beam", type: "beam", doc: [
    "the round is light: `{ color, width, style, life }` — a line from the muzzle to where it strikes, `laser` straight or `lightning` jagged, held `life` seconds; it strikes at once",
    "弹药是光束：`{ color, width, style, life }`——从枪口到命中点的一条线，`laser` 为直线，`lightning` 为闪电折线，持续 `life` 秒；即时命中"
  ] },
  { name: "muzzle", type: "string", max: 48, def: "the class's flash", doc: ["the muzzle flash: one of this mod's `fx.<name>` sheets, or `none`", "枪口焰：本模组的 `fx.<名字>` 精灵图，或 `none`"] },
  { name: "impact", type: "string", max: 48, def: "the class's burst", doc: [`the burst where it lands: an \`fx.<name>\` sheet of this mod, one of ${VANILLA_FX.join(", ")}, or \`none\``, `命中处的爆炸：本模组的 \`fx.<名字>\` 精灵图、${VANILLA_FX.join("、")} 之一，或 \`none\``] },
  { name: "impactScale", type: "number", min: 0.1, max: 8, def: "1", doc: ["the burst drawn at this multiple", "爆炸的缩放倍数"] },
  { name: "impactLife", type: "number", min: 0.05, max: 5, def: "0.5", doc: ["seconds the burst plays over", "爆炸播放的秒数"] },
  { name: "trail", type: "enum", values: ["smoke", "none"], def: "smoke", doc: ["a rocket's or a missile's smoke trail, or none", "火箭或导弹的尾烟，或无"] }
];
const SHIELD_SPECS = [
  { name: "hp", type: "number", min: 1, max: 1e6, required: true, doc: ["what it takes before the hull does", "在船体受损前可吸收的伤害"] },
  { name: "regen", type: "number", min: 0, max: 1e5, def: "0", doc: ["recharged a second", "每秒恢复量"] },
  { name: "delay", type: "number", min: 0, max: 600, def: "3", doc: ["seconds unhurt before it starts to recharge", "未受伤多少秒后开始恢复"] }
];
const WING_SPECS = [
  { name: "unit", type: "id", required: true, doc: ['the plane: an aircraft of this mod with `"pop": 0` and `"producedBy": []`, made by its carrier alone', '舰载机：本模组的飞行器，须为 `"pop": 0`、`"producedBy": []`，只由母舰制造'] },
  { name: "count", type: "int", min: 1, max: 16, def: "1", doc: ["planes it keeps", "搭载的飞机数"] },
  { name: "rebuild", type: "number", min: 0.5, max: 600, def: "10", doc: ["seconds to make a lost one again, for nothing, one at a time", "损失后多少秒免费补充一架，逐架补充"] },
  { name: "sortie", type: "number", min: 1, max: 600, def: "15", doc: ["seconds a plane stays out before it comes back to rearm", "飞机出击多少秒后返航"] },
  { name: "rearm", type: "number", min: 0, max: 120, def: "3", doc: ["seconds a plane back aboard waits before it flies again, mended as it waits", "返航后多少秒才能再次出击，期间会被修复"] },
  { name: "range", type: "number", min: 1, max: 32, def: "10", doc: ["tiles from the carrier its planes go out to fight", "飞机在离母舰多少格内出击"] }
];
const ANIM_SPECS = [
  { name: "moving", type: "range", doc: ["`[first, last]` frames played while it moves, or `[first, last, fps]`", "移动时播放的帧 `[起, 止]`，或 `[起, 止, fps]`"] },
  { name: "idle", type: "range", def: "frame 0", doc: ["the frames while it stands", "静止时播放的帧"] },
  { name: "firing", type: "range", doc: ["the frames within a reload of its last shot; before moving and idle", "上次开火后一次装填时间内播放的帧；优先于移动与静止"] }
];
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v) => typeof v === "number" && Number.isFinite(v);
function checkRow(row, v, path, errors, ctx) {
  const bad = (message) => {
    errors.push({ path, message });
    return false;
  };
  const lo = row.min ?? -Infinity, hi = row.max ?? Infinity;
  switch (row.type) {
    case "number":
      return num(v) && v >= lo && v <= hi || bad(`must be a number between ${lo} and ${hi}`);
    case "int":
      return Number.isInteger(v) && v >= lo && v <= hi || bad(`must be a whole number between ${lo} and ${hi}`);
    case "bool":
      return typeof v === "boolean" || bad("must be true or false");
    case "enum":
      return typeof v === "string" && row.values.includes(v) || bad(`must be one of ${row.values.join(", ")}`);
    case "string":
      return typeof v === "string" && v.length > 0 && v.length <= (row.max ?? 64) || bad(`must be a string of at most ${row.max ?? 64} characters`);
    case "id":
      return typeof v === "string" && ctx.idRe.test(v) || bad("must be an id");
    case "ids":
      return Array.isArray(v) && v.length <= 64 && v.every((x) => typeof x === "string" && ctx.idRe.test(x)) || bad("must be a list of up to 64 ids");
    case "text":
      return ctx.isText(v) || bad("must be text: a string, [en, zh, ko] or { en, zh, ko }");
    default:
      return true;
  }
}
function checkKeys(raw, rows, path, errors) {
  const known = new Set(rows.map((r) => r.name));
  let ok = true;
  for (const k of Object.keys(raw)) {
    if (!known.has(k)) {
      errors.push({ path: `${path}.${k}`, message: `"${k}" is not a word it knows (${[...known].join(", ")})` });
      ok = false;
    }
  }
  return ok;
}
function readCond(raw, path, errors, ctx, depth = 0) {
  if (!isObj(raw)) {
    errors.push({ path, message: "must be an object of conditions" });
    return null;
  }
  if (depth > 3) {
    errors.push({ path, message: "conditions nest at most three deep" });
    return null;
  }
  if (!checkKeys(raw, COND_SPECS, path, errors)) return null;
  if (Object.keys(raw).length === 0) {
    errors.push({ path, message: "names no condition" });
    return null;
  }
  const out = {};
  for (const row of COND_SPECS) {
    const v = raw[row.name];
    if (v === void 0) continue;
    const p = `${path}.${row.name}`;
    if (row.name === "any") {
      if (!Array.isArray(v) || v.length === 0 || v.length > 8) {
        errors.push({ path: p, message: "must be a list of one to eight conditions" });
        return null;
      }
      const list = v.map((c, i) => readCond(c, `${p}[${i}]`, errors, ctx, depth + 1));
      if (list.some((c) => !c)) return null;
      out.any = list;
    } else if (row.name === "not") {
      const c = readCond(v, p, errors, ctx, depth + 1);
      if (!c) return null;
      out.not = c;
    } else if (row.name === "near") {
      const n = readNear(v, p, errors, ctx);
      if (!n) return null;
      out.near = n;
    } else if (checkRow(row, v, p, errors, ctx)) {
      if (row.name === "killedBy") {
        const bad = v.find((id) => !ctx.find(id));
        if (bad) {
          errors.push({ path: p, message: `"${bad}" is not a def` });
          return null;
        }
      }
      out[row.name] = v;
    } else return null;
  }
  return out;
}
function readNear(raw, path, errors, ctx) {
  if (!isObj(raw)) {
    errors.push({ path, message: "must be { units, kind, side, within, count }" });
    return null;
  }
  if (!checkKeys(raw, NEAR_SPECS, path, errors)) return null;
  const out = {};
  for (const row of NEAR_SPECS) {
    const v = raw[row.name];
    const p = `${path}.${row.name}`;
    if (v === void 0) {
      if (row.required) {
        errors.push({ path: p, message: "is required" });
        return null;
      }
      continue;
    }
    if (!checkRow(row, v, p, errors, ctx)) return null;
    if (row.name === "units") {
      const list = v;
      if (list.length === 0) {
        errors.push({ path: p, message: "names no def" });
        return null;
      }
      const bad = list.find((id) => !ctx.find(id));
      if (bad) {
        errors.push({ path: p, message: `"${bad}" is not a def` });
        return null;
      }
    }
    out[row.name] = v;
  }
  return out;
}
function readEffect(raw, path, errors, ctx, rule) {
  if (!isObj(raw)) {
    errors.push({ path, message: "must be an object" });
    return null;
  }
  if (!checkKeys(raw, EFFECT_SPECS, path, errors)) return null;
  if (Object.keys(raw).length === 0) {
    errors.push({ path, message: "does nothing" });
    return null;
  }
  const out = {};
  const me = ctx.def;
  for (const row of EFFECT_SPECS) {
    const v = raw[row.name];
    if (v === void 0) continue;
    const p = `${path}.${row.name}`;
    switch (row.name) {
      case "morph": {
        if (!checkRow(row, v, p, errors, ctx)) return null;
        const to = ctx.find(v);
        if (!to || !ctx.ownDef(v)) {
          errors.push({ path: p, message: `"${String(v)}" is not a def of this mod: a unit takes only its own mod's forms` });
          return null;
        }
        if (to.id === me.id) {
          errors.push({ path: p, message: "a def cannot turn into itself" });
          return null;
        }
        if (to.kind !== me.kind) {
          errors.push({ path: p, message: `a ${me.kind} cannot turn into a ${to.kind}` });
          return null;
        }
        if (me.kind === "building" && ((to.fw ?? 2) !== (me.fw ?? 2) || (to.fh ?? 2) !== (me.fh ?? 2))) {
          errors.push({ path: p, message: "a building turns only into one of the same footprint" });
          return null;
        }
        out.morph = to.id;
        break;
      }
      case "spawn": {
        if (!isObj(v)) {
          errors.push({ path: p, message: "must be { unit, count, side, into, max }" });
          return null;
        }
        if (!checkKeys(v, SPAWN_SPECS, p, errors)) return null;
        const sp = {};
        for (const r of SPAWN_SPECS) {
          const x = v[r.name];
          if (x === void 0) {
            if (r.required) {
              errors.push({ path: `${p}.${r.name}`, message: "is required" });
              return null;
            }
            continue;
          }
          if (!checkRow(r, x, `${p}.${r.name}`, errors, ctx)) return null;
          sp[r.name] = x;
        }
        const u = ctx.find(sp.unit);
        if (!u || u.kind !== "unit" || u.warhead) {
          errors.push({ path: `${p}.unit`, message: `"${String(sp.unit)}" is not a unit it can spawn` });
          return null;
        }
        if (sp.into === "hold" && !me.transportCap) {
          errors.push({ path: `${p}.into`, message: "it has no hold (`transportCap`)" });
          return null;
        }
        if (sp.side === "killer" && rule.on !== "destroyed") {
          errors.push({ path: `${p}.side`, message: "only a `destroyed` rule knows who killed it" });
          return null;
        }
        out.spawn = sp;
        break;
      }
      case "buff": {
        if (!isObj(v)) {
          errors.push({ path: p, message: "must be { speed, damage, reload, taken, for }" });
          return null;
        }
        const b = {};
        for (const [k, x] of Object.entries(v)) {
          if (k === "for") {
            if (!num(x) || x < 0.1 || x > 600) {
              errors.push({ path: `${p}.for`, message: "must be seconds between 0.1 and 600" });
              return null;
            }
          } else if (["speed", "damage", "reload", "taken"].includes(k)) {
            if (!num(x) || x < 0.05 || x > 20) {
              errors.push({ path: `${p}.${k}`, message: "must be a multiplier between 0.05 and 20" });
              return null;
            }
          } else {
            errors.push({ path: `${p}.${k}`, message: "is not speed, damage, reload, taken or for" });
            return null;
          }
          b[k] = x;
        }
        if (b.for === void 0) {
          errors.push({ path: `${p}.for`, message: "is required" });
          return null;
        }
        if (Object.keys(b).length < 2) {
          errors.push({ path: p, message: "names no multiplier" });
          return null;
        }
        out.buff = b;
        break;
      }
      case "explode": {
        if (!isObj(v)) {
          errors.push({ path: p, message: "must be { dmg, radius, cls, friendlyFire }" });
          return null;
        }
        const dmg = v.dmg, radius = v.radius, cls = v.cls ?? "he";
        for (const k of Object.keys(v)) {
          if (!["dmg", "radius", "cls", "friendlyFire"].includes(k)) {
            errors.push({ path: `${p}.${k}`, message: "is not dmg, radius, cls or friendlyFire" });
            return null;
          }
        }
        if (!num(dmg) || dmg < 0 || dmg > 1e5) {
          errors.push({ path: `${p}.dmg`, message: "must be a number between 0 and 100000" });
          return null;
        }
        if (!num(radius) || radius < 1 || radius > 500) {
          errors.push({ path: `${p}.radius`, message: "must be world px between 1 and 500" });
          return null;
        }
        if (typeof cls !== "string" || !ctx.weaponClasses.includes(cls)) {
          errors.push({ path: `${p}.cls`, message: `must be one of ${ctx.weaponClasses.join(", ")}` });
          return null;
        }
        if (v.friendlyFire !== void 0 && typeof v.friendlyFire !== "boolean") {
          errors.push({ path: `${p}.friendlyFire`, message: "must be true or false" });
          return null;
        }
        out.explode = { dmg, radius, cls, ...v.friendlyFire ? { friendlyFire: true } : {} };
        break;
      }
      case "fx": {
        if (!checkRow(row, v, p, errors, ctx)) return null;
        if (!fxKnown(v, ctx)) {
          errors.push({ path: p, message: `"${String(v)}" is neither an fx.<name> sheet of this mod nor one of ${VANILLA_FX.join(", ")}` });
          return null;
        }
        out.fx = v;
        break;
      }
      case "sound": {
        if (!checkRow(row, v, p, errors, ctx)) return null;
        const s = v;
        if (!ctx.weaponSounds.includes(s) && !RULE_SOUNDS.includes(s) && !ctx.sounds.has(s)) {
          errors.push({ path: p, message: `"${s}" is not a sound the game has or this mod brings` });
          return null;
        }
        out.sound = s;
        break;
      }
      case "die":
      case "remove":
        if (v !== true) {
          errors.push({ path: p, message: "must be true" });
          return null;
        }
        out[row.name] = true;
        break;
      default:
        if (!checkRow(row, v, p, errors, ctx)) return null;
        out[row.name] = v;
    }
  }
  return out;
}
function fxKnown(key, ctx) {
  return key.startsWith("fx.") && ctx.sheets.has(key) || VANILLA_FX.includes(key);
}
function readRules(raw, path, ctx, into) {
  const out = [];
  const strings = {};
  const errors = [];
  const done = () => {
    into.push(...errors);
    return { rules: errors.length ? [] : out, strings };
  };
  if (!Array.isArray(raw)) {
    errors.push({ path, message: "must be a list of rules" });
    return done();
  }
  if (raw.length > MAX_DEF_RULES) {
    errors.push({ path, message: `at most ${MAX_DEF_RULES} rules` });
    return done();
  }
  let buttons = 0;
  raw.forEach((r, i) => {
    const rp = `${path}[${i}]`;
    if (!isObj(r)) {
      errors.push({ path: rp, message: "must be an object" });
      return;
    }
    if (!checkKeys(r, RULE_SPECS, rp, errors)) return;
    const triggers = ["on", "when", "every", "button"].filter((k) => r[k] !== void 0);
    if (triggers.length !== 1) {
      errors.push({ path: rp, message: "needs exactly one trigger: on, when, every or button" });
      return;
    }
    const rule = {};
    const before = errors.length;
    if (r.on !== void 0 && checkRow(RULE_SPECS[0], r.on, `${rp}.on`, errors, ctx)) rule.on = r.on;
    if (r.when !== void 0) rule.when = readCond(r.when, `${rp}.when`, errors, ctx) ?? void 0;
    if (r.every !== void 0 && checkRow(RULE_SPECS[2], r.every, `${rp}.every`, errors, ctx)) rule.every = r.every;
    if (r.button !== void 0) {
      const b = readButton(r.button, `${rp}.button`, errors, ctx);
      if (b) {
        rule.button = b.button;
        if (b.name !== void 0) strings[`rule.${ctx.def.id}.${i}.name`] = b.name;
        if (b.desc !== void 0) strings[`rule.${ctx.def.id}.${i}.desc`] = b.desc;
        buttons++;
      }
    }
    if (r.if !== void 0) rule.if = readCond(r.if, `${rp}.if`, errors, ctx) ?? void 0;
    for (const k of ["chance", "cooldown", "max"]) {
      const row = RULE_SPECS.find((x) => x.name === k);
      if (r[k] !== void 0 && checkRow(row, r[k], `${rp}.${k}`, errors, ctx)) rule[k] = r[k];
    }
    const list = r.do === void 0 ? void 0 : Array.isArray(r.do) ? r.do : [r.do];
    if (!list) {
      errors.push({ path: `${rp}.do`, message: "is required" });
      return;
    }
    if (list.length === 0 || list.length > MAX_RULE_EFFECTS) {
      errors.push({ path: `${rp}.do`, message: `must be one to ${MAX_RULE_EFFECTS} effects` });
      return;
    }
    const effects = list.map((x, k) => readEffect(x, Array.isArray(r.do) ? `${rp}.do[${k}]` : `${rp}.do`, errors, ctx, rule));
    if (effects.some((x) => !x) || errors.length > before) return;
    rule.do = effects;
    if (rule.button && !rule.do.some((x) => x.morph) && strings[`rule.${ctx.def.id}.${i}.name`] === void 0) {
      errors.push({ path: `${rp}.button.name`, message: "a button that changes no form needs a name" });
      return;
    }
    out[i] = rule;
  });
  if (buttons > MAX_DEF_BUTTONS) errors.push({ path, message: `at most ${MAX_DEF_BUTTONS} buttons` });
  return done();
}
function readButton(raw, path, errors, ctx) {
  if (!isObj(raw)) {
    errors.push({ path, message: "must be an object" });
    return null;
  }
  if (!checkKeys(raw, BUTTON_SPECS, path, errors)) return null;
  const b = { cost: 0, time: 0 };
  for (const row of BUTTON_SPECS) {
    const v = raw[row.name];
    if (v === void 0) continue;
    if (!checkRow(row, v, `${path}.${row.name}`, errors, ctx)) return null;
    if (row.name === "cost" || row.name === "time") b[row.name] = v;
    if (row.name === "ai") b.ai = v;
    if (row.name === "requires") {
      const reqs = [];
      for (const id of v) {
        if (ctx.isTech(id)) {
          reqs.push(id);
          continue;
        }
        const d = ctx.find(id);
        if (!d || d.kind !== "building") {
          errors.push({ path: `${path}.requires`, message: `"${id}" is neither a building nor a tech node` });
          return null;
        }
        reqs.push(id);
      }
      if (reqs.length) b.requires = reqs;
    }
  }
  return { button: b, name: raw.name, desc: raw.desc };
}
function readLook(raw, path, ctx, errors) {
  if (!isObj(raw)) {
    errors.push({ path, message: "must be an object" });
    return null;
  }
  if (!checkKeys(raw, LOOK_SPECS, path, errors)) return null;
  const out = {};
  for (const row of LOOK_SPECS) {
    const v = raw[row.name];
    if (v === void 0) continue;
    const p = `${path}.${row.name}`;
    if (row.name === "beam") {
      if (!isObj(v)) {
        errors.push({ path: p, message: "must be { color, width, style, life }" });
        return null;
      }
      const color = v.color ?? "#9cf", width = v.width ?? 2, style = v.style ?? "laser", life = v.life ?? 0.15;
      if (typeof color !== "string" || !/^#[0-9a-fA-F]{3,8}$/.test(color)) {
        errors.push({ path: `${p}.color`, message: "must be a colour, #rgb or #rrggbb" });
        return null;
      }
      if (!num(width) || width < 0.5 || width > 16) {
        errors.push({ path: `${p}.width`, message: "must be world px between 0.5 and 16" });
        return null;
      }
      if (style !== "laser" && style !== "lightning") {
        errors.push({ path: `${p}.style`, message: "must be laser or lightning" });
        return null;
      }
      if (!num(life) || life < 0.03 || life > 3) {
        errors.push({ path: `${p}.life`, message: "must be seconds between 0.03 and 3" });
        return null;
      }
      out.beam = { color, width, style, life };
      continue;
    }
    if (!checkRow(row, v, p, errors, ctx)) return null;
    if (row.name === "sprite") {
      if (!v.startsWith("prj.") || !ctx.sheets.has(v)) {
        errors.push({ path: p, message: `"${String(v)}" is not a prj.<name> sheet of this mod` });
        return null;
      }
    }
    if ((row.name === "muzzle" || row.name === "impact") && v !== "none" && !fxKnown(v, ctx)) {
      errors.push({ path: p, message: `"${String(v)}" is neither an fx.<name> sheet of this mod, a game effect, nor none` });
      return null;
    }
    out[row.name] = v;
  }
  return out;
}
function readShield(raw, path, ctx, errors) {
  if (!isObj(raw)) {
    errors.push({ path, message: "must be { hp, regen, delay }" });
    return null;
  }
  if (!checkKeys(raw, SHIELD_SPECS, path, errors)) return null;
  for (const row of SHIELD_SPECS) {
    const v = raw[row.name];
    if (v === void 0) {
      if (row.required) {
        errors.push({ path: `${path}.${row.name}`, message: "is required" });
        return null;
      }
      continue;
    }
    if (!checkRow(row, v, `${path}.${row.name}`, errors, ctx)) return null;
  }
  return { hp: raw.hp, regen: raw.regen ?? 0, delay: raw.delay ?? 3 };
}
function readWing(raw, path, ctx, errors) {
  if (!isObj(raw)) {
    errors.push({ path, message: "must be { unit, count, rebuild, sortie, rearm, range }" });
    return null;
  }
  if (!checkKeys(raw, WING_SPECS, path, errors)) return null;
  for (const row of WING_SPECS) {
    const v = raw[row.name];
    if (v === void 0) {
      if (row.required) {
        errors.push({ path: `${path}.${row.name}`, message: "is required" });
        return null;
      }
      continue;
    }
    if (!checkRow(row, v, `${path}.${row.name}`, errors, ctx)) return null;
  }
  if (ctx.def.kind !== "unit") {
    errors.push({ path, message: "only a unit carries a wing" });
    return null;
  }
  const unit = raw.unit;
  const plane = ctx.find(unit);
  const at = `${path}.unit`;
  if (!plane || !ctx.ownDef(unit)) {
    errors.push({ path: at, message: `"${unit}" is not a unit of this mod` });
    return null;
  }
  if (unit === ctx.def.id) {
    errors.push({ path: at, message: "a carrier is not its own plane" });
    return null;
  }
  if (plane.kind !== "unit" || plane.domain !== "air" || plane.warhead) {
    errors.push({ path: at, message: `"${unit}" is not an aircraft` });
    return null;
  }
  if (plane.pop > 0) {
    errors.push({ path: at, message: `"${unit}" counts population; a plane its carrier makes for nothing counts none (\`"pop": 0\`)` });
    return null;
  }
  return {
    unit,
    count: raw.count ?? 1,
    rebuild: raw.rebuild ?? 10,
    sortie: raw.sortie ?? 15,
    rearm: raw.rearm ?? 3,
    range: raw.range ?? 10
  };
}
function readAnims(raw, frames, path, errors) {
  if (!isObj(raw)) {
    errors.push({ path, message: "must be { moving, idle, firing }" });
    return null;
  }
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const p = `${path}.${k}`;
    if (!ANIM_SPECS.some((r) => r.name === k)) {
      errors.push({ path: p, message: "is not moving, idle or firing" });
      return null;
    }
    if (!Array.isArray(v) || v.length !== 2 && v.length !== 3 || !v.every(num)) {
      errors.push({ path: p, message: "must be [first, last] or [first, last, fps]" });
      return null;
    }
    const [a, b, fps] = v;
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < a || b >= frames) {
      errors.push({ path: p, message: `must name frames between 0 and ${frames - 1}, first before last` });
      return null;
    }
    if (fps !== void 0 && (fps < 0 || fps > 60)) {
      errors.push({ path: p, message: "fps must be between 0 and 60" });
      return null;
    }
    out[k] = v;
  }
  return out;
}
function cloneData(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  const seen = /* @__PURE__ */ new Map();
  const clone = (entry) => {
    if (typeof entry === "function" || typeof entry === "symbol") {
      throw new DOMException("Game data cannot contain functions or symbols", "DataCloneError");
    }
    if (entry === null || typeof entry !== "object") return entry;
    if (seen.has(entry)) return seen.get(entry);
    const array = Array.isArray(entry);
    if (!array && Object.prototype.toString.call(entry) !== "[object Object]") {
      throw new DOMException("Game data must contain records and arrays", "DataCloneError");
    }
    const copy = array ? new Array(entry.length) : {};
    seen.set(entry, copy);
    for (const key of Object.keys(entry)) {
      Object.defineProperty(copy, key, {
        value: clone(entry[key]),
        writable: true,
        enumerable: true,
        configurable: true
      });
    }
    return copy;
  };
  return clone(value);
}
const ABILITIES = {
  /** the governor off and the throttle to the stop — the Recon Buggy, born with it */
  sprint: { id: "sprint", cooldown: 20, duration: 4, speedMul: 1.6, sound: "abSprint" },
  /** reheat: a fighter's dash to a fight or out of one; the turning circle opens with the speed */
  afterburner: { id: "afterburner", cooldown: 30, duration: 5, speedMul: 1.8, requires: ["afterburners"], sound: "abAfterburner" },
  /** grenade dischargers: a cloud round the hull that nothing outside it sees into */
  smoke: { id: "smoke", cooldown: 40, duration: 8, smoke: 2.5, requires: ["smokeDischargers"], sound: "abSmoke" },
  /** the bomb bay loaded with incendiaries for the next run */
  incendiary: { id: "incendiary", cooldown: 45, duration: 30, incendiary: true, requires: ["incendiaryBombs"], sound: "abArm" },
  /** the crew at the guns flat out: every reload halved */
  barrage: { id: "barrage", cooldown: 45, duration: 8, reloadMul: 0.5, requires: ["rapidBarrage"], sound: "abArm" },
  /**
   * A tank's two protections switched on together, the Trophy and the
   * Kontakt-5: the hard-kill launchers take three missiles or rockets out of
   * the air at the hull, and the reactive bricks take four tenths off every
   * shell that lands. It fights on the move; nothing is dropped.
   */
  countermeasures: {
    id: "countermeasures",
    cooldown: 40,
    duration: 10,
    takenMul: 0.6,
    takenFrom: ["shell"],
    intercepts: 3,
    interceptReach: 1.5,
    beacon: true,
    requires: ["activeProtection"],
    sound: "abCountermeasures"
  },
  /** the damage control parties at work: fires out, holes plugged */
  damageControl: { id: "damageControl", cooldown: 60, duration: 10, heal: 0.3, requires: ["damageParties"], sound: "abRepair" },
  /** every crew of the recovery vehicle at the wrecks at once — the Hercules, born with it */
  emergencyRepair: { id: "emergencyRepair", cooldown: 30, duration: 6, auraMul: 3, sound: "abRepair" }
};
const ABILITY_IDS = Object.keys(ABILITIES);
const TECH = {
  // ---- Lightning: speed, the raid, the air
  lightning: { id: "lightning", branch: "lightning", pick: true, cost: 300, time: 30, buff: { stat: "speed", mul: 1.08, kind: "unit" } },
  smokeDischargers: { id: "smokeDischargers", branch: "lightning", cost: 450, time: 40 },
  suicideDrones: { id: "suicideDrones", branch: "lightning", cost: 600, time: 45 },
  afterburners: { id: "afterburners", branch: "lightning", requires: ["radar"], cost: 700, time: 50 },
  // ---- Hammer: firepower, the siege, the bomb
  hammer: { id: "hammer", branch: "hammer", pick: true, cost: 300, time: 30, buff: { stat: "dmg", mul: 1.1, cls: ["he", "rocket"] } },
  incendiaryBombs: { id: "incendiaryBombs", branch: "hammer", cost: 450, time: 40 },
  ballisticMissiles: { id: "ballisticMissiles", branch: "hammer", cost: 600, time: 45 },
  rapidBarrage: { id: "rapidBarrage", branch: "hammer", requires: ["radar"], cost: 700, time: 50 },
  // ---- Anvil: endurance, the hold, the repair
  anvil: { id: "anvil", branch: "anvil", pick: true, cost: 300, time: 30, buff: { stat: "taken", mul: 0.85, kind: "building" } },
  activeProtection: { id: "activeProtection", branch: "anvil", cost: 450, time: 40 },
  fieldRecovery: { id: "fieldRecovery", branch: "anvil", cost: 600, time: 45 },
  damageParties: { id: "damageParties", branch: "anvil", requires: ["radar"], cost: 700, time: 50 },
  // ---- Logistics: any doctrine, any order
  deepDrilling: { id: "deepDrilling", cost: 500, time: 40, buff: { stat: "mine", mul: 1.15 } },
  gridTuning: { id: "gridTuning", cost: 450, time: 40, buff: { stat: "plant", mul: 1.2 } },
  fieldEngineering: { id: "fieldEngineering", cost: 350, time: 30, buff: { stat: "build", mul: 1.3 } },
  // ---- the last node, any doctrine's, behind its whole column
  nuclearProgram: { id: "nuclearProgram", final: true, gates: true, cost: 1e3, time: 60 }
};
function isTechId(id) {
  return Object.prototype.hasOwnProperty.call(TECH, id);
}
const MOD_FORMAT = "steel-tide-mod";
const MOD_FORMAT_VERSION = 4;
const MOD_FILE_EXT = ".steel-tide-mod";
const MOD_MANIFEST_NAME = "mod.json";
const MAX_MOD_DEFS = STANDARD_CONTENT_LIMITS.defs;
const MAX_MOD_SPRITES = STANDARD_CONTENT_LIMITS.sprites;
const MAX_MOD_TERRAINS = 32;
const MAX_DEF_DECALS = 12;
const MAX_DEF_MOUNTS = 8;
const MAX_MOD_SOUNDS = STANDARD_CONTENT_LIMITS.sounds;
const MAX_MOD_MUSIC_TRACKS = 32;
const MAX_MOD_MUSIC_QUEUE = 64;
const MAX_MOD_SCREENSHOTS = 8;
const MAX_MOD_MAPS = 8;
const MAX_MOD_MAP_BYTES = 512 * 1024;
const MIN_SCREENSHOT_WIDTH = 640;
const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024;
const SCREENSHOT_ASPECT = 4 / 3;
const SCREENSHOT_ASPECT_TOLERANCE = 0.01;
const SOUND_KEY_RE = /^[a-z0-9][a-z0-9-]{1,59}$/;
const MAX_MANIFEST_BYTES = STANDARD_CONTENT_LIMITS.manifestBytes;
const MAX_MOD_FILES_BYTES = STANDARD_CONTENT_LIMITS.filesBytes;
const ID_RE = /^[a-z0-9][a-z0-9_-]{1,39}$/;
const ATLAS_KEY_RE = /^(u|tur|dec|prj|fx|ter)\.[a-z0-9][a-z0-9_-]{1,39}$/;
const FILE_RE = /^(?!\/)(?!.*\.\.)[A-Za-z0-9_./-]{1,120}$/;
const IMAGE_FILE_RE = /\.(png|jpe?g|webp)$/i;
const MAP_FILE_RE = /\.(steel-tide-map|json)$/i;
function definitionFiles(mod) {
  return [.../* @__PURE__ */ new Set([...(mod.sprites ?? []).map((s) => s.file), ...(mod.sounds ?? []).map((s) => s.file), ...(mod.music?.tracks ?? []).map((t) => t.file), ...mod.maps ?? [], ...(mod.extensionPackages ?? []).flatMap((pkg) => Object.values(pkg.assets ?? {}))])];
}
const ARMOR_CLASSES = ["light", "medium", "heavy", "ship", "sub", "air", "structure"];
const TARGET_DOMAINS = ["ground", "ship", "sub", "air"];
const WEAPON_CLASSES = ["mg", "autocannon", "cannon", "at", "he", "rocket", "navgun", "ashm", "torpedo", "aa"];
const PROJECTILES = ["bullet", "shell", "missile", "rocket", "bomb", "torpedo", "flak", "flame"];
const UNIT_DOMAINS = ["ground", "ship", "air", "amphibious"];
const TRAILS = ["tread", "tire", "wake", "none"];
const WEAPON_SOUNDS = ["mg", "autocannon", "cannon", "missile", "flak", "arty", "rocket", "torpedo", "bomb", "flame"];
const DECAL_LAYERS = ["under", "hull", "over"];
const DECAL_ANCHORS = ["hull", "turret"];
const DECAL_WHENS = ["always", "moving", "still", "firing", "damaged", "night", "ability"];
const MANIFEST_SPECS = [
  { name: "capacity", type: "enum", values: ["standard", "large"], def: "standard", doc: [`format 4: large allows ${LARGE_CONTENT_LIMITS.defs} defs, ${LARGE_CONTENT_LIMITS.sprites} sheets, ${LARGE_CONTENT_LIMITS.sounds} sounds, ${LARGE_CONTENT_LIMITS.manifestBytes / 1048576} MiB metadata and ${LARGE_CONTENT_LIMITS.filesBytes / 1048576} MiB stored data URLs; standard keeps ${MAX_MOD_DEFS}/${MAX_MOD_SPRITES}/${MAX_MOD_SOUNDS}, ${MAX_MANIFEST_BYTES / 1048576}/${MAX_MOD_FILES_BYTES / 1048576} MiB`, `格式 4：large 允许 ${LARGE_CONTENT_LIMITS.defs} 个定义、${LARGE_CONTENT_LIMITS.sprites} 张图、${LARGE_CONTENT_LIMITS.sounds} 个音效、${LARGE_CONTENT_LIMITS.manifestBytes / 1048576} MiB 元数据和 ${LARGE_CONTENT_LIMITS.filesBytes / 1048576} MiB 已编码资源；standard 保留 ${MAX_MOD_DEFS}/${MAX_MOD_SPRITES}/${MAX_MOD_SOUNDS} 和 ${MAX_MANIFEST_BYTES / 1048576}/${MAX_MOD_FILES_BYTES / 1048576} MiB 限额`] },
  { name: "requiredCapabilities", type: "capabilities", min: 1, max: 32, doc: ["Required package-provided capability IDs", "由扩展包提供的必需能力 ID"] },
  { name: "extensionPackages", type: "extensionPackages", doc: ["Versioned extension packages with SHA-256 verified schema, simulation and optional presentation modules (format 4)", "含 SHA-256 校验的配置验证、模拟和可选显示模块的版本化扩展包（格式 4）"] },
  { name: "format", type: "string", required: true, doc: [`always "${MOD_FORMAT}"`, `固定为 "${MOD_FORMAT}"`] },
  { name: "v", type: "int", required: true, min: 1, max: MOD_FORMAT_VERSION, doc: ["format version: 1 remains supported; factions and headquarters require 2; capability data requires 3; executable extension packages require 4", "格式版本：仍支持 1；阵营和总部需要 2；扩展配置需要 3；可执行扩展包需要 4"] },
  { name: "id", type: "id", required: true, doc: ["the mod's id: lower case, letters, digits, `-`; also its folder in the registry", "模组 id：小写字母、数字和 `-`，也是它在仓库中的文件夹名"] },
  { name: "name", type: "text", required: true, doc: ["the name shown in the mod list", "模组列表中显示的名称"] },
  { name: "version", type: "string", required: true, max: 32, doc: ["e.g. `1.0.0`; the game offers an update when the registry's is newer", "如 `1.0.0`；仓库版本更新时游戏会提示更新"] },
  { name: "author", type: "string", max: 80, doc: ["who made it", "作者"] },
  { name: "description", type: "text", doc: ["one or two sentences for the list", "一两句话的介绍"] },
  { name: "homepage", type: "string", max: 200, doc: ["a link: a repository, a thread", "主页链接"] },
  { name: "license", type: "string", max: 80, def: "CC-BY-4.0", doc: ["the mod's licence (SPDX id)", "模组许可证（SPDX 标识）"] },
  { name: "minGame", type: "string", max: 32, doc: ["the oldest game version it is written for", "所需的最低游戏版本"] },
  { name: "defs", type: "defs", required: true, doc: ["the units, buildings and upgrade levels; may be empty when terrains, music queues or menu backgrounds are supplied", "单位、建筑与升级等级；提供 terrains、音乐队列或菜单背景时可为空"] },
  { name: "factions", type: "factions", doc: ["selectable factions, each with its own headquarters, starting builder and roster (format 2)", "可选阵营，各有自己的总部、初始建造单位和单位表（格式 2）"] },
  { name: "terrains", type: "terrains", doc: [`up to ${MAX_MOD_TERRAINS} map-selected terrain variants; preserve their base terrain’s gameplay`, `最多 ${MAX_MOD_TERRAINS} 种由地图选择的地形外观变体；保留基础地形的游戏规则`] },
  { name: "sprites", type: "sprites", doc: ["the sheets the defs draw with (see below)", "各定义使用的精灵图（见下）"] },
  { name: "music", type: "music", doc: ["custom BGM tracks and ordered menu, setup and battle queues (see below)", "自定义背景音乐及菜单、设置、战斗的顺序播放队列（见下）"] },
  { name: "menuBackground", type: "menuBackground", doc: ["ordered home-menu cut queue, mixing original scenes and this pack’s maps (see below)", "主页背景镜头的顺序队列，可混用原版场景与本模组地图（见下）"] },
  { name: "sounds", type: "sounds", doc: ["the recordings the weapons fire with (see below)", "武器开火时播放的录音（见下）"] },
  { name: "screenshots", type: "images", doc: [`pictures of the mod in play, relative to mod.json (\`screenshots/1.png\`): 4:3, at least ${MIN_SCREENSHOT_WIDTH} px wide, under ${MAX_SCREENSHOT_BYTES / 1048576} MB each, up to ${MAX_MOD_SCREENSHOTS}. The registry asks for at least one and shows them on the mod's page`, `模组游玩截图，路径相对 mod.json（\`screenshots/1.png\`）：4:3，宽至少 ${MIN_SCREENSHOT_WIDTH} 像素，每张不超过 ${MAX_SCREENSHOT_BYTES / 1048576} MB，最多 ${MAX_MOD_SCREENSHOTS} 张。仓库要求至少一张，并展示在模组页面上`] },
  { name: "maps", type: "maps", doc: [`maps the mod carries, relative to mod.json (\`maps/city.steel-tide-map\`): files exported from the Scenario Editor, up to ${MAX_MOD_MAPS}, each under ${MAX_MOD_MAP_BYTES / 1024} KB. A map may stand the mod's own units; the setup screens offer it beside the player's own map while the mod is on`, `模组自带的地图，路径相对 mod.json（\`maps/city.steel-tide-map\`）：场景编辑器导出的文件，最多 ${MAX_MOD_MAPS} 张，每张不超过 ${MAX_MOD_MAP_BYTES / 1024} KB。地图上可以预置本模组的单位；模组开启时，设置界面会把它列在自定义地图旁`] },
  { name: "files", type: "files", doc: ["single-file form only: the sheets, sounds, music and maps, embedded as data URLs by path", "仅单文件形式：按路径内嵌的图片、音频与地图（data URL）"] }
];
const DEF_SPECS = [
  { name: "extensions", type: "extensions", doc: ["Configuration keyed by a required engine capability (format 3)", "按必需引擎能力命名的配置（格式 3）"] },
  { name: "isHQ", type: "bool", only: "building", doc: ["a headquarters: holds territory and production slots, follows the ordinary HQ loss and sale rules; format 2", "总部：提供建造范围和生产槽位，遵循普通总部的失守与出售规则；格式 2"] },
  { name: "id", type: "id", required: true, doc: ["unique across every mod and the vanilla roster; prefix a generic word with your mod's id", "在所有模组和原版中唯一；通用名字前加上模组 id 前缀"] },
  { name: "name", type: "text", required: true, doc: ["as the HUD shows it", "HUD 中显示的名称"] },
  { name: "desc", type: "text", def: '""', doc: ["the tooltip line", "提示中的描述"] },
  { name: "extends", type: "id", doc: ["a vanilla def id (or an earlier def of this mod) to copy, then override field by field; inherits its art and where it is built", "要复制的原版定义 id（或本模组中前面的定义），再逐字段覆盖；继承其图像和生产位置"] },
  { name: "kind", type: "enum", values: ["unit", "building"], required: true, doc: ["a unit or a building (required unless `extends` says)", "单位或建筑（除非 `extends` 已说明，否则必填）"] },
  { name: "domain", type: "enum", values: UNIT_DOMAINS, only: "unit", def: "ground", doc: ["where it moves; a submarine is a `ship` with `underwater`, and an `amphibious` hull drives and swims (a ship target afloat, a ground one ashore)", "移动域；潜艇是带 `underwater` 的 `ship`，`amphibious` 既能行驶也能泅渡（在水上算舰船目标，上岸算地面目标）"] },
  { name: "tier", type: "int", min: 1, max: 3, def: "1", doc: ["the factory level it appears at, and the badge", "出现的工厂等级与徽标"] },
  { name: "cost", type: "number", required: true, min: 0, max: 99999, doc: ["metal", "金属造价"] },
  { name: "buildTime", type: "number", min: 0, max: 3600, def: "cost ÷ 14", doc: ["seconds at full power", "满电力下的建造秒数"] },
  { name: "pop", type: "int", min: 0, max: 50, def: "1 for a unit, 0 for a building", doc: ["population it counts for", "占用人口"] },
  { name: "hp", type: "number", required: true, min: 1, max: LARGE_CONTENT_LIMITS.hp, doc: [`hit points; standard capacity is limited to ${STANDARD_CONTENT_LIMITS.hp}, large to ${LARGE_CONTENT_LIMITS.hp}`, `生命值；standard 上限为 ${STANDARD_CONTENT_LIMITS.hp}，large 上限为 ${LARGE_CONTENT_LIMITS.hp}`] },
  { name: "armor", type: "enum", values: ARMOR_CLASSES, def: "by domain", doc: ["the armour class weapons are multiplied against", "武器倍率所针对的装甲类型"] },
  { name: "impactMaterial", type: "enum", values: ["armor", "earth", "concrete"], def: "concrete for structure armor, armor otherwise", doc: ["projectile-impact sound material; does not change damage. Both ordinary and heavy impacts use the matching recorded family", "弹体命中音效材质，不改变伤害；普通与重型爆炸使用对应的录音组"] },
  { name: "directionalArmor", type: "directionalArmor", only: "unit", doc: ["ground hull direct-hit multipliers `{front, side, rear}`, each 0–10; 90° front/rear arcs and 90° on each side. Arc fire, collateral blasts, mines and fire ignore facing. Enables slow reversing for short moves behind the hull", "地面车体直击倍率 `{front, side, rear}`，各为 0–10；正面、背面各 90°，两侧各 90°。抛射、溅射、地雷与火焰不计朝向。向车后短距离移动时会慢速倒车"] },
  { name: "speed", type: "number", only: "unit", min: 0, max: 1e3, def: "60", doc: ["world px/s (a tile is 32)", "世界像素/秒（一格 32）"] },
  { name: "turnRate", type: "number", only: "unit", min: 0, max: 50, def: "3.5", doc: ["rad/s", "弧度/秒"] },
  { name: "vision", type: "number", min: 0, max: 64, def: "8", doc: ["sight, in tiles; rounded to the nearest whole tile when activated", "视野（格）；启用内容时四舍五入为整格"] },
  { name: "radius", type: "number", min: 1, max: 200, def: "9, or the footprint", doc: ["collision radius, world px, and the *combat* yardstick: range, splash and hits are measured to it", "碰撞半径（世界像素），也是*战斗*基准：射程、溅射与命中都以它为准"] },
  { name: "body", type: "body", only: "unit", def: "the circle of `radius`", doc: ["the room the hull takes up when units push each other apart, world px: `r` its half-width, `len` its length less the two round ends. A long hull is what a circle cannot say. A ship whose beam (`r` twice) is over a tile (32) needs that many tiles of water abeam, rounded up: it never enters a channel narrower than itself", "单位互相推挤时所占的形状（世界像素）：`r` 为半宽，`len` 为去掉两端半圆后的长度。圆形无法表达细长的船体。船宽（`r` 的两倍）超过一格（32）的舰船需要相应格数的水面（向上取整），永远不会驶入比自身更窄的水道"] },
  { name: "weapons", type: "weapons", def: "[]", doc: ["the weapons (see below); an empty list is unarmed", "武器列表（见下）；空列表即无武装"] },
  { name: "fw", type: "int", only: "building", min: 1, max: 8, def: "2", doc: ["footprint width, tiles", "占地宽度（格）"] },
  { name: "fh", type: "int", only: "building", min: 1, max: 8, def: "2", doc: ["footprint height, tiles", "占地高度（格）"] },
  { name: "producedBy", type: "ids", only: "unit", def: "the line for its domain, from its tier up", doc: ["the buildings whose production list it joins (vanilla or this mod's), or units of this mod that train it (a carrier)", "加入哪些建筑的生产列表（原版或本模组的），或由本模组的哪些单位生产（航母）"] },
  { name: "produces", type: "ids", doc: ["a factory: the units it builds. On a unit, a carrier or a mothership that trains them itself: each is launched beside it, wherever it has got to", "工厂：可生产的单位。写在单位上，就是自己生产它们的航母或母舰：造好的单位在它当前的位置旁出现"] },
  { name: "builtBy", type: "ids", only: "building", def: '["engineer"]', doc: ["the builder units that may place it", "可建造它的工程单位"] },
  { name: "builds", type: "ids", only: "unit", doc: ["a builder unit: the buildings it can construct", "工程单位：可建造的建筑"] },
  { name: "buildRate", type: "number", only: "unit", min: 0, max: 1e4, doc: ["a builder unit: hp of work per second", "工程单位：每秒建造量"] },
  { name: "reach", type: "number", only: "unit", min: 0, max: 256, doc: ["a builder unit: how far past a target's radius it works from, world px (the engineer's 46 when unset; the engineer boat's 64)", "工程单位：超出目标半径多远即可施工（世界像素；默认工程车的 46，工程船为 64）"] },
  { name: "power", type: "number", min: -1e4, max: 1e4, def: "−pop for a unit, 0 for a building", doc: ["positive produces, negative draws; every unit draws its population", "正为发电，负为耗电；单位默认耗电等于其人口"] },
  { name: "metalRate", type: "number", min: 0, max: 1e3, doc: ["metal per second: an extractor, or a unit that earns (a supply ship)", "每秒金属：采矿场，或能赚钱的单位（补给舰）"] },
  { name: "needsDeposit", type: "bool", only: "building", doc: ["must stand on a deposit", "必须建在矿点上"] },
  { name: "offshore", type: "bool", only: "building", doc: ["stands in open water on its own legs: every footprint tile sea, no shore needed; with needsDeposit, an ore field at sea, which only a builder on the water (the engineer boat) can reach", "立于开阔海面：占地全为海水，无需岸边；配合 needsDeposit 即为海上矿点，只有水上的建造者（工程船）够得到"] },
  { name: "wall", type: "bool", only: "building", doc: ["a wall: one tile that joins its neighbours of the same def (its sheet is sixteen frames, one per set of neighbours: north 1, east 2, south 4, west 8), the last thing a gun shoots at, untouched by a pulse, and it falls without a charge", "墙：单格建筑，与相邻的同种建筑连成一体（精灵图为 16 帧，按相邻方向的掩码取帧：北 1、东 2、南 4、西 8），是火炮最后才会射击的目标，不受电磁脉冲影响，倒塌时没有爆炸"] },
  { name: "repairRange", type: "number", only: "building", min: 0, max: 64, doc: ["a repair aura, tiles", "维修光环范围（格）"] },
  { name: "repairRate", type: "number", only: "building", min: 0, max: 1e4, doc: ["hp per second per target", "每目标每秒维修量"] },
  { name: "repairTargets", type: "int", only: "building", min: 1, max: 50, doc: ["targets served at once", "同时维修的目标数"] },
  { name: "upgradeOf", type: "id", only: "building", doc: ["the building this is the next level of; that one gains the upgrade button", "作为哪座建筑的下一等级；那座建筑获得升级按钮"] },
  { name: "upgradeCost", type: "number", only: "building", min: 0, max: 99999, def: "cost − the source's cost", doc: ["with `upgradeOf`: the upgrade's price", "配合 `upgradeOf`：升级价格"] },
  { name: "upgradeTime", type: "number", only: "building", min: 0, max: 3600, def: "buildTime", doc: ["with `upgradeOf`: seconds", "配合 `upgradeOf`：升级秒数"] },
  { name: "requires", type: "ids", doc: ["building ids that must stand before it can be built, or tech node ids that must be researched (`suicideDrones`, `activeProtection`…)", "建造前必须存在的建筑 id，或必须研究完成的科技节点 id（`suicideDrones`、`activeProtection`…）"] },
  { name: "nukeCapacity", type: "int", min: 0, max: 10, doc: ["a launcher: warheads it holds", "发射器：可储存的弹头数"] },
  { name: "nukeCost", type: "number", min: 0, max: 99999, doc: ["a launcher: metal per warhead", "发射器：每枚弹头的金属"] },
  { name: "nukeTime", type: "number", min: 0, max: 3600, doc: ["a launcher: seconds per warhead", "发射器：每枚弹头的秒数"] },
  { name: "armsAtBase", type: "number", only: "unit", min: 0, max: 64, doc: ["a launcher: fabricates its warheads only within this many tiles of one of its own bases of its kind (a naval yard for a hull, an airbase for an aircraft; and, an `underwater` one, only on the surface), and holds the work otherwise (the Kraken's and the Wraith's 4)", "发射器：只在距己方同类基地（舰船为造船厂，飞机为机场）此格数内制造弹头（`underwater` 的还须浮出水面），否则暂停（海妖与幽魂为 4）"] },
  { name: "rearmTime", type: "number", min: 0.1, max: 600, def: "15", doc: ["seconds to fill every gun that carries `ammo` from empty, at a base of its kind", "在同类基地把所有带 `ammo` 的武器从空装满所需秒数"] },
  { name: "hatch", type: "number", min: 0, max: 30, doc: ["a launcher: seconds its doors take to open before the warhead leaves, and to close after; none fires on the spot", "发射器：发射前舱门打开所需秒数，发射后关闭亦然；不填则即刻发射"] },
  { name: "antiWarhead", type: "bool", doc: ["its anti-air may fire on a nuclear warhead without a veteran's rank", "其防空武器无需老兵等级即可攻击核弹头"] },
  { name: "interceptRange", type: "number", min: 0, max: 64, doc: ["point defence: reach in tiles", "拦截：范围（格）"] },
  { name: "interceptMag", type: "int", min: 1, max: 200, doc: ["point defence: rounds ready", "拦截：备弹数"] },
  { name: "interceptReload", type: "number", min: 0.05, max: 600, doc: ["point defence: seconds per round replaced", "拦截：每发补充秒数"] },
  { name: "interceptMuzzleOffset", type: "number", min: 0, max: 200, doc: ["point defence: launcher length, world px", "拦截：发射器长度（世界像素）"] },
  { name: "transportCap", type: "int", only: "unit", min: 1, max: 50, doc: ["a transport: hold, in cargo weight", "运输载具：载重"] },
  { name: "transportMaxWeight", type: "number", only: "unit", min: 0, max: 50, def: "transportCap", doc: ["a transport: maximum cargo weight of one passenger", "运输载具：单个乘员的最大载重"] },
  { name: "cargoReach", type: "number", only: "unit", min: 0.5, max: 4, def: "1", doc: ["a transport: how far its load and unload distances stretch, as a multiple of the default (the landing craft's 1.1, the Moray's 1.5); on a ship it widens the ground its ramp reaches too", "运输载具：装卸距离相对默认值的倍率（登陆艇 1.1，海鳗 1.5）；舰船的卸载落点范围也随之扩大"] },
  { name: "landsForCargo", type: "bool", only: "unit", doc: ["a cargo plane that touches down to load", "装卸时降落的运输机"] },
  { name: "cargoWeight", type: "number", only: "unit", min: 0, max: 50, def: "pop", doc: ["how much of a hold it takes", "占用的载重"] },
  { name: "underwater", type: "bool", only: "unit", doc: ["a submarine: seen only by sonar", "潜艇：仅声呐可见"] },
  { name: "sonar", type: "number", only: "unit", min: 0, max: 64, doc: ["sonar range, tiles", "声呐范围（格）"] },
  { name: "stealth", type: "number", only: "unit", min: 0, max: 64, doc: ["seen only within this many tiles of an enemy", "仅在敌方此距离内可见"] },
  { name: "detect", type: "number", min: 0, max: 64, doc: ["reveals stealth within this many tiles", "在此范围内揭示隐形"] },
  { name: "radar", type: "bool", doc: ["sees by radio: the sight circle ignores weather and the hour, and drops to 7 tiles when short of power", "靠无线电观测：视野不受天气与昼夜影响，电力不足时缩至 7 格"] },
  { name: "remoteVision", type: "bool", only: "unit", doc: ["remote camera feed: hostile jamming blocks its sight within the field", "远程图像传输：敌方干扰阻止其揭示干扰区内的视野"] },
  { name: "jamRange", type: "number", only: "building", min: 0, max: 64, doc: ["electronic-warfare radius in tiles; requires full power, reveals its location, blocks hostile radar and remote vision, never visual sight or sonar", "电子战半径（格）：需充足电力，会暴露自身位置，阻断敌方雷达与远程视野，不影响目视与声呐"] },
  { name: "hovers", type: "bool", only: "unit", doc: ["an aircraft that hovers instead of orbiting", "悬停而非盘旋的飞行器"] },
  { name: "kamikaze", type: "bool", only: "unit", doc: ["the unit is its own round: it never picks a target, and its one weapon flies it into what it is ordered at (the Hornet)", "自身即弹药：从不自行索敌，唯一的武器是被命令攻击时撞向目标（黄蜂）"] },
  { name: "lowFlying", type: "bool", only: "unit", doc: ["an aircraft at treetop height: machine guns and autocannons that fire on the ground reach it too (the helicopters and the Hornet)", "贴着树梢飞行的飞行器：对地的机枪与机炮也能打到它（直升机与黄蜂）"] },
  { name: "limit", type: "int", min: 1, max: 200, only: "unit", doc: ["at most this many a faction at once, alive and queued together (the Hornet's 10)", "每个阵营同时最多拥有的数量，在役与排队中合计（黄蜂为 10）"] },
  { name: "altitude", type: "number", only: "unit", min: 0, max: 64, def: "12", doc: ["an aircraft's drawn height, px", "飞行器的绘制高度（像素）"] },
  { name: "fireOnMove", type: "bool", only: "unit", doc: ["keeps shooting on a plain move", "移动时持续开火"] },
  { name: "burnMult", type: "number", only: "unit", min: 0, max: 4, def: "1", doc: ["what fire on the ground does to it, as a multiplier (the Drake's 0.5)", "地面火焰对它的伤害倍率（火龙为 0.5）"] },
  { name: "trail", type: "enum", values: TRAILS, only: "unit", def: "by domain", doc: ["the mark it leaves, and the sound of it: treads and tyres are heard rolling; `none` for a unit on foot or a hovercraft, which neither cuts a rut nor is heard as an engine", "留下的痕迹，也决定行驶声：履带与轮胎行驶时可闻；步行单位或气垫船用 `none`，既不留痕也没有引擎声"] },
  { name: "shadow", type: "bool", def: "true", doc: ["the shadow the game casts for it: a unit's hull and turret silhouettes, a step to the south-east on the ground, further off in the air; a building's gun's, on its roof; `false` when the art brings its own, or none is wanted (a submarine casts none)", "游戏为它投下的影子：单位是车体与炮塔的剪影，在地面上向东南偏一步，在空中则更远；建筑是其炮塔投在屋顶上的影子；图像自带阴影或不需要时设为 `false`（潜艇不投影）"] },
  { name: "sprite", type: "string", max: 48, def: "this mod's u.<id> sheet, else the base's art", doc: ["the body's atlas key: one of this mod's sheets, or a vanilla key to borrow its art", "主体图像键：本模组的精灵图，或借用原版的键"] },
  { name: "turretSprite", type: "string", max: 48, def: "this mod's tur.<id> sheet, else the base's (when its art is kept)", doc: ["the rotating part's key, if any", "旋转部件的图像键（若有）"] },
  { name: "turretMounts", type: "mounts", def: "one, where the body sheet's `mount` puts it (else the pivot); the base's, when its art is kept", doc: [`the rings its turret stands on and fires from, up to ${MAX_DEF_MOUNTS}: a hull with several guns names one each (a battleship's A, B and X), every one drawn with the one \`turretSprite\` and trained on the one target, as far round as its own arc goes (see below)`, `炮塔所在并由此开火的炮塔环，最多 ${MAX_DEF_MOUNTS} 个：有多门炮的车体每门各写一个（战列舰的 A、B、X 炮塔），每个都用同一个 \`turretSprite\` 绘制，并在各自射界之内瞄准同一个目标（见下）`] },
  { name: "decals", type: "decals", def: "the base's, when its art is kept", doc: [`pictures laid on the hull and the turret besides their own sheets (see below), up to ${MAX_DEF_DECALS}`, `除车体与炮塔本身之外贴在其上的图像（见下），最多 ${MAX_DEF_DECALS} 个`] },
  { name: "ability", type: "enum", values: ABILITY_IDS, only: "unit", def: "the base's", doc: ["its one active ability, a vanilla one by id (`sprint`, `smoke`, `countermeasures`…): the same click, clock and unlock as on the game's own units", "唯一的主动技能，按 id 取原版技能（`sprint`、`smoke`、`countermeasures`…）：点击、计时与解锁条件与原版单位相同"] },
  { name: "aliases", type: "strings", doc: ["other names the console's `give` accepts", "控制台 `give` 接受的别名"] },
  { name: "aiWeight", type: "number", only: "unit", min: 0, max: 10, def: "0", doc: ["how readily the AI builds it: a Bison is 3, a scout car 1; 0 never", "AI 生产它的倾向：野牛是 3，侦察车 1；0 为从不"] },
  { name: "rules", type: "rules", doc: [`its behaviour: rules that turn it into another form, spawn, heal, pay, buff or blow up, on an event, a condition, a clock or a button (see Behaviour), up to ${MAX_DEF_RULES}; never inherited through \`extends\``, `行为：在事件、条件、定时或按钮触发时让它变形、生成单位、回血、给钱、增益或爆炸的规则（见“行为”），最多 ${MAX_DEF_RULES} 条；不会通过 \`extends\` 继承`] },
  { name: "shield", type: "shield", doc: ["an energy shield, `{ hp, regen, delay }`: it takes harm before the hull does, and recharges `regen` a second once unhurt for `delay` seconds", "能量护盾 `{ hp, regen, delay }`：先于船体承受伤害，未受伤 `delay` 秒后每秒恢复 `regen`"] },
  { name: "regen", type: "number", min: 0, max: 1e4, doc: ["hit points a second it mends itself by", "每秒自我修复的生命值"] },
  { name: "untargetable", type: "bool", doc: ["nothing on the other side may pick it as a target or be ordered to attack it; a blast still reaches it (a disguise, a decoy)", "敌方无法将其选为目标或下令攻击它；爆炸仍能伤到它（伪装、诱饵）"] },
  { name: "wing", type: "wing", only: "unit", doc: ["a carrier: planes of this mod it keeps aboard, `{ unit, count, rebuild, sortie, rearm, range }`, sent out at what it fights, taken back to rearm and made again when lost; never the player's to order (see Behaviour); never inherited through `extends`", "母舰：搭载本模组的飞机 `{ unit, count, rebuild, sortie, rearm, range }`，出击它所攻击的目标，返航补给，损失后重新制造；玩家不能直接指挥（见“行为”）；不会通过 `extends` 继承"] }
];
const WEAPON_SPECS = [
  { name: "extensions", type: "extensions", doc: ["Optional engine weapon configuration (format 3)", "可选引擎武器配置（格式 3）"] },
  { name: "id", type: "string", max: 32, def: "w1, w2…", doc: ["a name for the weapon", "武器名"] },
  { name: "cls", type: "enum", values: WEAPON_CLASSES, required: true, doc: ["what it was built to kill; picks its row of the armour matrix", "设计用途，决定装甲倍率表中的行"] },
  { name: "dmg", type: "number", required: true, min: 0, max: 1e5, doc: ["damage per hit", "每次命中伤害"] },
  { name: "reload", type: "number", required: true, min: 0.05, max: 600, doc: ["seconds between shots or bursts", "两次射击/齐射间隔秒数"] },
  { name: "range", type: "number", required: true, min: 0.5, max: 64, doc: ["tiles", "射程（格）"] },
  { name: "minRange", type: "number", min: 0, max: 64, doc: ["tiles it cannot fire inside", "最小射程（格）"] },
  { name: "projectile", type: "enum", values: PROJECTILES, def: "by class", doc: ["the round drawn", "弹药样式"] },
  { name: "speed", type: "number", min: 1, max: 5e3, def: "by projectile", doc: ["round speed, world px/s", "弹速（世界像素/秒）"] },
  { name: "targets", type: "targets", def: "by class", doc: ["what it may fire at: ground, ship, sub, air", "可攻击目标：ground、ship、sub、air"] },
  { name: "mult", type: "mult", doc: ["overrides of the class row, by armour class", "按装甲类型覆盖倍率"] },
  { name: "splash", type: "number", min: 0, max: 500, doc: ["blast radius, world px", "溅射半径（世界像素）"] },
  { name: "burst", type: "int", min: 1, max: 32, doc: ["shots per burst", "每次齐射发数"] },
  { name: "burstDelay", type: "number", min: 0, max: 5, doc: ["seconds between the shots of a burst", "齐射内各发间隔秒数"] },
  { name: "ammo", type: "int", min: 1, max: 9999, doc: ["rounds carried, a burst one: dry, a unit goes home for more on its own (an airbase for an aircraft, a naval yard for a hull, a war factory for the rest) and a building refills where it stands; absent never runs dry", "携弹量，一次齐射算一发：打空后单位自行返回补给（飞机回机场，舰船回造船厂，其余回战车工厂），建筑原地补充；不填则永不耗尽"] },
  { name: "vsWarhead", type: "number", min: 0, max: 10, def: "1", doc: ["against a warhead in flight, this share of what it does to an aircraft", "对飞行中的弹头，造成对飞机伤害的此比例"] },
  { name: "homing", type: "bool", doc: ["the round tracks its target", "弹药追踪目标"] },
  { name: "interceptable", type: "bool", doc: ["point defence may shoot it down", "可被拦截"] },
  { name: "arc", type: "bool", doc: ["a ballistic arc (artillery)", "抛物线弹道（火炮）"] },
  { name: "turret", type: "bool", def: "true when the def has a turretSprite", doc: ["fired from the rotating part", "由旋转部件发射"] },
  { name: "recoil", type: "number", min: 0, max: 10, doc: ["cosmetic barrel recoil stroke, art px; requires barrel regions on the turret art, changes no weapon statistic", "炮管后坐的视觉行程（美术像素）；炮塔图像须带炮管区域，不改变武器属性"] },
  { name: "vertical", type: "bool", doc: ["launched straight up out of the hull, like a submarine's missile tubes: it fires at any bearing and the hull never turns for it; `muzzleOffset` then runs along the keel to the tubes", "从艇体垂直发射，如潜艇的导弹发射筒：任何方向都能开火，艇体无需转向；此时 `muzzleOffset` 沿艇身纵轴量到发射筒"] },
  { name: "muzzleOffset", type: "number", min: 0, max: 200, doc: ["pivot to muzzle, world px; a unit's art is drawn 1.5625×, so measure on the sheet and multiply", "枢轴到炮口距离（世界像素）；单位美术按 1.5625 倍绘制，量图后需乘以该倍数"] },
  { name: "bores", type: "int", min: 1, max: 8, def: "1", doc: ["barrels, fired one after another", "炮管数，逐根轮流开火"] },
  { name: "boreSpacing", type: "number", min: 0, max: 60, doc: ["gap between adjacent barrels, world px", "相邻炮管间距（世界像素）"] },
  { name: "muzzlePoints", type: "muzzles", min: 1, max: 8, doc: ["explicit muzzle positions, fired in list order: 1–8 `{ forward, lateral }` points in world px from the firing pivot (forward along the bore, lateral to its right; either may be negative); replaces `muzzleOffset`, `bores` and `boreSpacing`", "按列表顺序开火的炮口位置：1–8 个 `{ forward, lateral }` 点，单位为距开火枢轴的世界像素（forward 沿炮管向前，lateral 向右，均可为负）；替代 `muzzleOffset`、`bores` 和 `boreSpacing`"] },
  { name: "spread", type: "number", min: 0, max: 200, doc: ["inaccuracy at full range, world px", "最大射程处的散布（世界像素）"] },
  { name: "friendlyFire", type: "bool", doc: ["the blast hurts your own side too", "溅射也会伤及己方"] },
  { name: "fan", type: "number", min: 0, max: 1.5, doc: ["a `flame` jet: the half-angle it is sprayed across, radians", "`flame` 喷流：喷射张角的一半（弧度）"] },
  { name: "burn", type: "number", min: 0, max: 1e3, doc: ["a `flame` jet: damage a second the fire it leaves does, to both sides", "`flame` 喷流：残留火焰每秒伤害，敌我通吃"] },
  { name: "burnLife", type: "number", min: 0, max: 120, doc: ["a `flame` jet: seconds that fire keeps burning", "`flame` 喷流：火焰持续秒数"] },
  { name: "sound", type: "string", max: 64, def: "by class", doc: [`the firing sound: ${WEAPON_SOUNDS.join(", ")}, or the key of one of this mod's \`sounds\``, `开火音效：${WEAPON_SOUNDS.join("、")}，或本模组 \`sounds\` 中的一个键`] },
  { name: "look", type: "look", doc: ["how it looks, in place of its class: its own round, flash, burst where it lands, or a beam (see Weapon looks)", "外观，替代其类别默认的样子：自己的弹药、枪口焰、命中爆炸，或光束（见“武器外观”）"] }
];
const DECAL_SPECS = [
  { name: "sprite", type: "string", max: 48, required: true, doc: ["the sheet drawn: one of this mod's `dec.<name>` sheets, or any body or turret key", "所绘精灵图：本模组的 `dec.<名字>` 精灵图，或任一车体/炮塔键"] },
  { name: "on", type: "enum", values: DECAL_ANCHORS, def: "hull", doc: ["what it is fixed to and turns with; `turret` needs a `turretSprite`", "固定在何处并随之转动；`turret` 要求该定义有 `turretSprite`"] },
  { name: "layer", type: "enum", values: DECAL_LAYERS, def: "hull, or over when on a turret", doc: ["where it goes in the stack: under the body, on the hull under the turret, or over everything", "在图层中的位置：车体之下、车体之上炮塔之下、或最上层"] },
  { name: "x", type: "number", min: -256, max: 256, def: "0", doc: ["where it sits on the part's up-facing art: px right of the pivot, in the sheet's own px at its `fw`×`fh` size (the game scales it with the unit)", "在部件朝上图像上的位置：枢轴右侧的像素，按精灵图 `fw`×`fh` 尺寸计（游戏随单位一并缩放）"] },
  { name: "y", type: "number", min: -256, max: 256, def: "0", doc: ["px down from the pivot, toward the tail", "枢轴下方（车尾方向）的像素"] },
  { name: "angle", type: "number", min: -360, max: 360, def: "0", doc: ["turned this much further than what it is fixed to, degrees clockwise", "相对所固定部件再顺时针转动的角度"] },
  { name: "upright", type: "bool", doc: ["never turned: laid screen-up wherever its anchor is", "永不旋转：始终朝屏幕上方"] },
  { name: "scale", type: "number", min: 0.05, max: 8, def: "1", doc: ["drawn at this multiple of its sheet's size", "按精灵图尺寸的此倍数绘制"] },
  { name: "alpha", type: "number", min: 0, max: 1, def: "1", doc: ["opacity", "不透明度"] },
  { name: "when", type: "enum", values: DECAL_WHENS, def: "always", doc: ["shown only while the unit moves or stands (`moving`, `still`), within a reload of its last shot (`firing`), under half health (`damaged`), while its ability runs or is armed (`ability`), or after dusk (`night`: laid over the dark like a lamp, and the game's own headlights stay off a unit that has one)", "仅在移动/静止（`moving`/`still`）、上次开火后一次装填时间内（`firing`）、生命低于一半（`damaged`）、技能生效或待发时（`ability`）或天黑后（`night`：像灯一样亮于夜色之上，且游戏不再为该单位画自己的车灯）时显示"] }
];
const MOUNT_SPECS = [
  { name: "x", type: "number", min: -256, max: 256, def: "0", doc: ["where the ring is on the body's up-facing art: px right of its pivot, in the body sheet's own px at its `fw`×`fh` size (the game scales it with the unit)", "炮塔环在主体朝上图像上的位置：枢轴右侧的像素，按主体精灵图 `fw`×`fh` 尺寸计（游戏随单位一并缩放）"] },
  { name: "y", type: "number", min: -256, max: 256, def: "0", doc: ["px down from the pivot, toward the tail", "枢轴下方（车尾方向）的像素"] },
  { name: "rest", type: "number", min: -360, max: 360, def: "0", doc: ["the bearing it trains about, degrees clockwise from the bow: 0 forward, 90 to the right, 180 aft", "转动所围绕的朝向，自车头顺时针计的角度：0 向前、90 向右、180 向后"] },
  { name: "arc", type: "number", min: 0, max: 180, def: "180", doc: ["how far either side of `rest` it turns, degrees; 180 is all round. A ring that cannot bear on the target waits at the end of its arc, and the rings that can take the shots", "在 `rest` 两侧各能转动的角度；180 即全向。无法指向目标的炮塔停在射界尽头，由能指向目标的炮塔开火"] }
];
const SOUND_SPECS = [
  { name: "key", type: "string", max: 60, required: true, doc: ["`<mod id>-<name>`, lower case; what a weapon's `sound` names", "`<模组 id>-<名字>`，小写；武器 `sound` 引用的键"] },
  { name: "file", type: "string", max: 120, required: true, doc: ["the recording, relative to mod.json. An MP3 plays everywhere; WAV works, OGG not on Safari. Dry, close, under a second", "录音路径，相对 mod.json。MP3 处处可播；WAV 可用，OGG 在 Safari 上不行。干声、近距、一秒以内"] }
];
const SPRITE_SPECS = [
  { name: "key", type: "string", max: 48, required: true, doc: ["`u.<id>` for a body, `tur.<id>` for a rotating part, `dec.<name>` for a decal, `prj.<name>` for a round and `fx.<name>` for an effect a weapon's look or a rule plays; `ter.<mod id>-<name>` for terrain materials; never a vanilla key", "主体用 `u.<id>`，旋转部件用 `tur.<id>`，贴花用 `dec.<名字>`，弹药用 `prj.<名字>`，武器外观或规则播放的特效用 `fx.<名字>`；地形材质用 `ter.<模组 id>-<名字>`；不可与原版键重名"] },
  { name: "file", type: "string", max: 120, required: true, doc: ["the image, relative to mod.json (PNG, WebP or JPEG)", "图片路径，相对 mod.json（PNG、WebP 或 JPEG）"] },
  { name: "frames", type: "int", min: 1, max: 64, def: "1", doc: ["animation frames, left to right in one strip", "动画帧数，横向排列"] },
  { name: "fw", type: "number", min: 4, max: 512, def: "the footprint (a building) or the image", doc: ["in-game frame width, whole world px", "游戏内帧宽（世界像素，整数）"] },
  { name: "fh", type: "number", min: 4, max: 512, doc: ["in-game frame height, whole world px", "游戏内帧高（世界像素，整数）"] },
  { name: "rotated", type: "bool", doc: ["one up-facing image; the game bakes the 24 headings (hulls, turrets)", "一张朝上的图；游戏烘焙 24 个朝向（车体、炮塔）"] },
  { name: "pivotX", type: "number", min: 0, max: 1, def: "0.5", doc: ["rotation pivot, as a fraction of the frame", "旋转枢轴（帧宽比例）"] },
  { name: "pivotY", type: "number", min: 0, max: 1, def: "0.5", doc: ["rotation pivot, as a fraction of the frame", "旋转枢轴（帧高比例）"] },
  { name: "anchorY", type: "number", min: 0, max: 512, doc: ["px from the top to the footprint centre (tall buildings)", "顶部到占地中心的像素（高建筑）"] },
  { name: "mount", type: "pair", doc: ["a body: where its turret sits (or, with a repair aura, where the beam leaves), as `[fx, fy]`", "主体：炮塔安装位置（带维修光环时则是光束的起点），写作 `[fx, fy]`"] },
  { name: "barrels", type: "barrels", min: 1, max: 8, doc: ["exposed barrel rectangles, each `[left, top, right, bottom]` in 0–1 fractions of the up-facing source frame, in muzzle firing order; leave mantlets fixed. Pair with weapon `recoil` (art px)", "外露炮管矩形，每项为朝上原始帧中 0–1 比例的 `[左, 上, 右, 下]`，按炮口开火顺序排列；不含固定炮盾。搭配武器的 `recoil`（美术像素）"] },
  { name: "fps", type: "number", min: 0, max: 60, doc: ["animation speed", "动画速度"] },
  { name: "teams", type: "bool", def: "true", doc: ["recolour magenta per faction; `false` draws the sheet as painted for every faction, and for the wreck", "按阵营重着色品红部分；`false` 则各阵营（以及残骸）都按原图绘制"] },
  { name: "ss", type: "int", min: 1, max: 4, doc: ["supersample factor; omit to let the game choose", "超采样倍率；留空由游戏决定"] },
  { name: "fitFootprint", type: "bool", doc: ["scale the drawn content to fill the frame", "缩放内容以填满帧"] },
  { name: "animRegion", type: "quad", doc: ["where the animation lives, `[x0, y0, x1, y1]` fractions; the rest is frozen", "动画所在区域 `[x0, y0, x1, y1]`（比例）；其余部分冻结"] },
  { name: "stabilize", type: "bool", def: "true", doc: ["re-align drifting frames", "对齐漂移的帧"] },
  { name: "freezeStatic", type: "bool", doc: ["median-freeze pixels that barely change", "冻结几乎不变的像素"] },
  { name: "stripBg", type: "bool", doc: ["force background removal on or off", "强制开启/关闭背景去除"] },
  { name: "bgMinLuma", type: "number", min: 0, max: 255, doc: ["lightest colour still taken as background", "仍视为背景的最亮颜色"] },
  { name: "artifactCleanup", type: "bool", doc: ["sweep specks left by background removal", "清理背景去除后的杂点"] },
  { name: "anims", type: "anims", doc: ["a unit body's frames by what it is doing, `{ moving, idle, firing }`, each `[first, last]` or `[first, last, fps]`: a tank that is a tree when it stands, a walker whose legs move only when it does (see Animation states)", "单位主体按状态播放的帧 `{ moving, idle, firing }`，每项为 `[起, 止]` 或 `[起, 止, fps]`：静止时变成树的坦克、只在移动时迈腿的步行机（见“动画状态”）"] }
];
const MENU_BACKGROUND_SPECS = [
  { name: "cuts", type: "menuCuts", doc: [`up to ${MAX_MENU_CUTS} custom live scenes`, `最多 ${MAX_MENU_CUTS} 个自定义实时场景`] },
  { name: "queue", type: "menuQueue", required: true, doc: [`1–${MAX_MENU_QUEUE} cut IDs in repeating order; original IDs: ${MENU_CUT_IDS.join(", ")}`, `1–${MAX_MENU_QUEUE} 个循环播放的镜头 id；原版 id：${MENU_CUT_IDS.join("、")}`] }
];
const MENU_CAMERA_SPECS = [
  { name: "tx", type: "number", required: true, min: 0, max: MAX_MENU_MAP_SIDE, doc: ["horizontal camera centre in tiles, inside the map", "镜头中心的横向格坐标，须位于地图内"] },
  { name: "ty", type: "number", required: true, min: 0, max: MAX_MENU_MAP_SIDE, doc: ["vertical camera centre in tiles, inside the map", "镜头中心的纵向格坐标，须位于地图内"] },
  { name: "zoom", type: "number", required: true, min: 0.25, max: 4, doc: ["camera zoom, capped by the menu on small screens", "镜头缩放，小屏幕上由菜单限制最大值"] }
];
const MENU_ORDER_SPECS = [
  { name: "owner", type: "int", required: true, min: 0, max: MAX_PLAYERS - 1, doc: ["map spawn index; one opening attack-move per owner", "地图出生点序号；每方可指定一次初始攻击移动"] },
  ...MENU_CAMERA_SPECS.filter((s) => s.name !== "zoom").map((s) => ({ ...s, doc: [s.name === "tx" ? "target tile x" : "target tile y", s.name === "tx" ? "目标横向格坐标" : "目标纵向格坐标"] }))
];
const MENU_CUT_SPECS = [
  { name: "id", type: "id", required: true, doc: ["unique cut ID beginning with the mod ID and a dash", "唯一镜头 id，以模组 id 和连字符开头"] },
  { name: "map", type: "string", required: true, max: 120, doc: ["a path in this pack’s maps; at most 128 × 128 tiles and 200 placed units/buildings", "本模组 maps 中的路径；最多 128 × 128 格及 200 个预置单位/建筑"] },
  { name: "camera", type: "menuCamera", required: true, doc: ["opening framing: { tx, ty, zoom }", "初始构图：{ tx, ty, zoom }"] },
  { name: "cameraEnd", type: "menuCamera", doc: ["end framing for a 13-second drift; omitted holds camera", "13 秒镜头移动的终点构图；省略则固定镜头"] },
  { name: "weather", type: "enum", values: ["clear", "rain", "snow"], def: "clear", doc: ["weather held throughout the cut", "镜头期间保持的天气"] },
  { name: "minutes", type: "number", min: 0, max: 24, def: "6", doc: ["held day-cycle time: 0 dawn, 6 noon, 12 dusk, 18 midnight", "固定昼夜时刻：0 黎明、6 正午、12 黄昏、18 午夜"] },
  { name: "seed", type: "int", min: 0, max: 2147483647, def: "1", doc: ["simulation seed", "模拟随机种子"] },
  { name: "orders", type: "menuOrders", doc: ["opening attack-move targets for the map’s mobile units, by owner", "按所属方为地图上的移动单位指定初始攻击移动目标"] }
];
const MUSIC_SPECS = [
  { name: "tracks", type: "musicTracks", doc: [`up to ${MAX_MOD_MUSIC_TRACKS} custom recordings, each with an id and file`, `最多 ${MAX_MOD_MUSIC_TRACKS} 首自定义录音，每首包含 id 和 file`] },
  { name: "menu", type: "musicQueue", doc: ["ordered repeating queue for menus; also used for setup unless setup is supplied. Omitted keeps the previous queue; [] is silence", "菜单循环顺序队列；未指定 setup 时也用于对局设置。省略保留之前的队列；[] 表示静音"] },
  { name: "setup", type: "musicQueue", doc: ["optional separate queue for match setup", "可选的对局设置独立队列"] },
  { name: "battle", type: "musicQueue", doc: [`ordered repeating queue during battle. Omitted keeps the previous queue; [] is silence. Built-in IDs: ${Object.values(MUSIC_FILES).flat().join(", ")}`, `战斗中的循环顺序队列。省略保留之前的队列；[] 表示静音。原版曲目 id：${Object.values(MUSIC_FILES).flat().join("、")}`] }
];
const MUSIC_TRACK_SPECS = [
  { name: "id", type: "id", required: true, doc: ["unique track id: <mod id>-<name>; cannot replace a built-in ID", "唯一曲目 id：<模组 id>-<名字>；不能覆盖原版 id"] },
  { name: "file", type: "string", required: true, max: 120, doc: ["MP3, Ogg or WAV path relative to mod.json", "相对 mod.json 的 MP3、Ogg 或 WAV 路径"] }
];
const FACTION_SPECS = [
  { name: "id", type: "id", required: true, doc: ["unique faction id, prefixed with the mod id and a dash", "唯一阵营 id，以模组 id 和连字符开头"] },
  { name: "name", type: "text", required: true, doc: ["the faction name in game setup", "对局设置中的阵营名称"] },
  { name: "headquarters", type: "id", required: true, doc: ["this mod’s land headquarters definition", "本模组的陆地总部定义"] },
  { name: "builder", type: "id", required: true, doc: ["this mod’s ground or amphibious builder; the HQ must produce it and it must rebuild the HQ", "本模组的陆地或两栖建造单位；总部必须能生产它，它必须能重建总部"] },
  { name: "roster", type: "ids", max: LARGE_CONTENT_LIMITS.defs, doc: ["permitted definitions, including prerequisites and upgrades; defaults to all definitions in this mod", "允许的定义，包括前置建筑与升级；默认为本模组的全部定义"] }
];
const TERRAIN_SPECS = [
  { name: "id", type: "id", required: true, doc: ["unique terrain variant id, prefixed with the mod id and a dash", "唯一地形变体 id，以模组 id 和连字符开头"] },
  { name: "name", type: "text", required: true, doc: ["the terrain style name in the editor", "编辑器中的地形外观名称"] },
  { name: "base", type: "enum", values: Object.keys(TERRAIN_BASES), required: true, doc: ["the existing terrain whose movement, construction and combat behavior stays unchanged", "基础地形；移动、建造和战斗规则保持不变"] },
  { name: "texture", type: "string", max: 48, doc: ["flat terrain material: a ter.<mod id>-<name> sheet in this pack; city uses its city materials instead", "平面地形材质：本模组中的 ter.<模组 id>-<名字> 图像；城市使用 city 材质"] },
  { name: "city", type: "cityTerrain", doc: ["materials, lights and optional visual architecture; only with base city", "材质、灯光与可选建筑外形；仅适用于 base city"] }
];
const CITY_TERRAIN_SPECS = [
  { name: "roof", type: "string", max: 7, doc: ["roof color, #RRGGBB", "屋顶颜色，#RRGGBB"] },
  { name: "wall", type: "string", max: 7, doc: ["wall color, #RRGGBB", "墙面颜色，#RRGGBB"] },
  { name: "window", type: "string", max: 7, doc: ["lit window color, #RRGGBB", "亮窗颜色，#RRGGBB"] },
  { name: "lamp", type: "string", max: 7, doc: ["streetlamp color, #RRGGBB", "路灯颜色，#RRGGBB"] },
  { name: "roofTexture", type: "string", max: 48, doc: ["roof material, a ter.<mod id>-<name> sheet in this pack", "屋顶材质，本模组中的 ter.<模组 id>-<名字> 图像"] },
  { name: "wallTexture", type: "string", max: 48, doc: ["wall material, a ter.<mod id>-<name> sheet in this pack", "墙面材质，本模组中的 ter.<模组 id>-<名字> 图像"] },
  { name: "groundTexture", type: "string", max: 48, doc: ["courtyard material, a ter.<mod id>-<name> sheet in this pack", "庭院地面材质，本模组中的 ter.<模组 id>-<名字> 图像"] },
  { name: "signTexture", type: "string", max: 48, doc: ["4×4 atlas of 16 square signs in row-major order, a ter.<mod id>-<name> sheet in this pack; custom architecture selects a cell per building", "4×4 排列的 16 个正方形招牌图集，按行排列，使用本模组的 ter.<模组 id>-<名字> 图像；自定义建筑按楼栋选取单格"] },
  { name: "accent", type: "string", max: 7, doc: ["primary architectural lighting color, #RRGGBB", "建筑主装饰灯颜色，#RRGGBB"] },
  { name: "accent2", type: "string", max: 7, doc: ["secondary architectural lighting color, #RRGGBB", "建筑副装饰灯颜色，#RRGGBB"] },
  { name: "architecture", type: "cityArchitecture", doc: ["optional building kit; omitted keeps ordinary city geometry", "可选建筑外形组合；省略时保留普通城市几何形状"] }
];
const CITY_ARCHITECTURE_SPECS = [
  { name: "forms", type: "enums", values: CITY_FORMS, min: 1, max: CITY_FORMS.length, def: "slab, court, terrace, stepped", doc: ["distinct building forms to mix: slab blocks, courtyard blocks, terraces and stepped towers", "混合使用的不同建筑形态：板楼、庭院街区、露台楼与阶梯塔楼"] },
  { name: "minStoreys", type: "int", min: 1, max: 4, def: "2", doc: ["minimum target storeys for the main building; smaller lots and wings may be shorter; must not exceed maxStoreys", "主楼目标楼层下限；小地块与附楼可更低；不能超过 maxStoreys"] },
  { name: "maxStoreys", type: "int", min: 1, max: 4, def: "4", doc: ["maximum target storeys for the main building; does not change terrain height or cover", "主楼目标楼层上限；不改变地形高度或掩护"] },
  { name: "coverage", type: "number", min: 0.35, max: 0.9, def: "0.72", doc: ["building coverage within each visual lot", "每个外观地块的建筑覆盖比例"] },
  { name: "greenery", type: "number", min: 0, max: 1, def: "0.1", doc: ["decorative vegetation density", "装饰植被密度"] },
  { name: "equipment", type: "number", min: 0, max: 1, def: "0.65", doc: ["rooftop machinery and service equipment density", "屋顶机械与附属设备密度"] },
  { name: "facade", type: "enum", values: ["ribbon", "panel", "industrial"], def: "panel", doc: ["wall structure: ribbon windows, panel cladding or industrial frames", "墙面结构：带状窗、面板外墙或工业框架"] }
];
const FIELD_SPECS = {
  menuBackground: MENU_BACKGROUND_SPECS,
  menuCut: MENU_CUT_SPECS,
  menuCamera: MENU_CAMERA_SPECS,
  menuOrder: MENU_ORDER_SPECS,
  music: MUSIC_SPECS,
  musicTrack: MUSIC_TRACK_SPECS,
  manifest: MANIFEST_SPECS,
  faction: FACTION_SPECS,
  terrain: TERRAIN_SPECS,
  cityTerrain: CITY_TERRAIN_SPECS,
  cityArchitecture: CITY_ARCHITECTURE_SPECS,
  def: DEF_SPECS,
  weapon: WEAPON_SPECS,
  decal: DECAL_SPECS,
  mount: MOUNT_SPECS,
  sprite: SPRITE_SPECS,
  sound: SOUND_SPECS,
  // a mod's behaviour, a weapon's look, a shield, a sheet's states and a carrier's wing (`game/ruleSpec.ts`)
  rule: RULE_SPECS,
  cond: COND_SPECS,
  near: NEAR_SPECS,
  effect: EFFECT_SPECS,
  spawn: SPAWN_SPECS,
  button: BUTTON_SPECS,
  look: LOOK_SPECS,
  shield: SHIELD_SPECS,
  anims: ANIM_SPECS,
  wing: WING_SPECS
};
function cloneTable(table) {
  return cloneData(table);
}
const VANILLA = cloneTable(DEFS);
const VANILLA_IDS = VANILLA_DEF_IDS;
function aliasesOf(table) {
  const out = /* @__PURE__ */ new Set();
  for (const d of Object.values(table)) for (const a of d.aliases ?? []) out.add(a);
  return out;
}
function spriteKeysOf(table) {
  const out = /* @__PURE__ */ new Set();
  for (const d of Object.values(table)) {
    out.add(d.sprite);
    if (d.turretSprite) out.add(d.turretSprite);
    for (const dc of d.decals ?? []) out.add(dc.sprite);
  }
  return out;
}
const VANILLA_SPRITE_KEYS = spriteKeysOf(VANILLA);
const LINES = {
  ground: [["factory"], ["factory2"], ["factory3"]],
  ship: [["navyard"], ["navyard2"], ["navyard3"]],
  air: [["airbase"], ["airbase2"], ["airbase3"]],
  amphibious: [["factory", "navyard"], ["factory2", "navyard2"], ["factory3", "navyard3"]]
};
function defaultProducers(domain, tier) {
  const line = LINES[domain] ?? LINES.ground;
  return line.slice(Math.max(0, Math.min(2, tier - 1))).flat();
}
const SOUND_BY_CLASS = {
  mg: "mg",
  autocannon: "autocannon",
  cannon: "cannon",
  at: "missile",
  he: "arty",
  rocket: "rocket",
  navgun: "cannon",
  ashm: "missile",
  torpedo: "torpedo",
  aa: "flak"
};
const PROJECTILE_BY_CLASS = {
  mg: "bullet",
  autocannon: "bullet",
  cannon: "shell",
  at: "missile",
  he: "shell",
  rocket: "rocket",
  navgun: "shell",
  ashm: "missile",
  torpedo: "torpedo",
  aa: "flak"
};
const SPEED_BY_PROJECTILE = {
  bullet: 500,
  shell: 420,
  missile: 320,
  rocket: 300,
  bomb: 120,
  torpedo: 150,
  flak: 460,
  nuke: 96,
  flame: 200,
  fire: 0
};
const TARGETS_BY_CLASS = {
  aa: ["air"],
  torpedo: ["ship", "sub"],
  ashm: ["ship"]
};
function contentText(v, fallback = "") {
  const given = (lang2) => {
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return v[langIndex(lang2)];
    if (v && typeof v === "object") return v[lang2];
    return void 0;
  };
  const en = typeof given("en") === "string" ? given("en") : fallback;
  return LANGS.map((lang2) => typeof given(lang2) === "string" ? given(lang2) : en);
}
function contentName(mod, lang2 = "en") {
  return pick(contentText(mod.name, mod.id), lang2) || mod.id;
}
function compareVersions(a, b) {
  const pa = String(a).split(/[.+-]/).map((n) => Number.parseInt(n, 10) || 0);
  const pb = String(b).split(/[.+-]/).map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
function isPlainObject$1(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function isText(v) {
  if (typeof v === "string") return v.length <= 400;
  if (Array.isArray(v)) return v.length >= 1 && v.length <= LANGS.length && v.every((x) => typeof x === "string" && x.length <= 400);
  if (isPlainObject$1(v)) return typeof v.en === "string" && LANGS.every((lang2) => v[lang2] === void 0 || typeof v[lang2] === "string");
  return false;
}
function checkField(spec, value, path, issues) {
  const bad = (message) => {
    issues.push({ path, message });
    return false;
  };
  const min = spec.min ?? -Infinity, max = spec.max ?? Infinity;
  switch (spec.type) {
    case "string":
      if (typeof value !== "string") return bad("must be a string");
      if (value.length === 0) return bad("must not be empty");
      if (value.length > (spec.max ?? 200)) return bad(`must be at most ${spec.max ?? 200} characters`);
      return true;
    case "text":
      return isText(value) || bad(`must be a string, [${LANGS.join(", ")}] or { ${LANGS.join(", ")} }`);
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) return bad("must be a number");
      if (value < min || value > max) return bad(`must be between ${min} and ${max}`);
      return true;
    case "int":
      if (!Number.isInteger(value)) return bad("must be a whole number");
      if (value < min || value > max) return bad(`must be between ${min} and ${max}`);
      return true;
    case "bool":
      return typeof value === "boolean" || bad("must be true or false");
    case "enum":
      return typeof value === "string" && spec.values.includes(value) || bad(`must be one of ${spec.values.join(", ")}`);
    case "enums":
      if (!Array.isArray(value) || value.length < (spec.min ?? 1) || value.length > (spec.max ?? spec.values.length))
        return bad(`must list ${spec.min ?? 1}–${spec.max ?? spec.values.length} distinct choices`);
      if (new Set(value).size !== value.length) return bad("must not repeat a choice");
      return value.every((entry) => typeof entry === "string" && spec.values.includes(entry)) || bad(`every choice must be one of ${spec.values.join(", ")}`);
    case "id":
      return typeof value === "string" && ID_RE.test(value) || bad("must be an id: lower case letters, digits, - or _, 2–40 characters");
    case "ids":
      if (!Array.isArray(value) || value.length > (spec.max ?? 64)) return bad("must be a list of ids");
      for (const x of value) if (typeof x !== "string" || !ID_RE.test(x)) return bad(`"${String(x)}" is not an id`);
      return true;
    case "strings":
      if (!Array.isArray(value) || value.length > 32) return bad("must be a list of strings");
      for (const x of value) if (typeof x !== "string" || x.length === 0 || x.length > 40) return bad("every entry must be a short string");
      return true;
    case "images":
      if (!Array.isArray(value) || value.length > MAX_MOD_SCREENSHOTS) return bad(`must be a list of up to ${MAX_MOD_SCREENSHOTS} image paths`);
      for (const x of value) {
        if (typeof x !== "string" || !FILE_RE.test(x)) return bad(`"${String(x)}" is not a relative path inside the mod`);
        if (!IMAGE_FILE_RE.test(x)) return bad(`${x} is not a PNG, JPEG or WebP`);
      }
      return true;
    case "maps":
      if (!Array.isArray(value) || value.length > MAX_MOD_MAPS) return bad(`must be a list of up to ${MAX_MOD_MAPS} map paths`);
      for (const x of value) {
        if (typeof x !== "string" || !FILE_RE.test(x)) return bad(`"${String(x)}" is not a relative path inside the mod`);
        if (!MAP_FILE_RE.test(x)) return bad(`${x} is not a .steel-tide-map file`);
      }
      if (new Set(value).size !== value.length) return bad("names a map twice");
      return true;
    case "targets":
      if (!Array.isArray(value) || value.length === 0 || value.length > 4) return bad("must list one to four of ground, ship, sub, air");
      for (const x of value) if (!TARGET_DOMAINS.includes(x)) return bad(`"${String(x)}" is not a target domain`);
      return true;
    case "mult":
      if (!isPlainObject$1(value)) return bad("must be an object keyed by armour class");
      for (const [k, v] of Object.entries(value)) {
        if (!ARMOR_CLASSES.includes(k)) return bad(`"${k}" is not an armour class`);
        if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 10) return bad(`${k} must be a number between 0 and 10`);
      }
      return true;
    case "directionalArmor":
      if (!isPlainObject$1(value)) return bad("must be { front, side, rear } damage multipliers");
      for (const k of Object.keys(value)) if (k !== "front" && k !== "side" && k !== "rear") return bad(`"${k}" is not an armour facing`);
      for (const k of ["front", "side", "rear"]) {
        const n = value[k];
        if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 10) return bad(`${k} must be a number between 0 and 10`);
      }
      return true;
    case "body": {
      if (!isPlainObject$1(value)) return bad('must be { "r": half-width, "len": length }, world px');
      for (const k of Object.keys(value)) if (k !== "r" && k !== "len") return bad(`"${k}" is not a field of a body`);
      const r = value.r, len = value.len;
      if (typeof r !== "number" || !Number.isFinite(r) || r < 1 || r > 200) return bad("r must be a number between 1 and 200");
      if (typeof len !== "number" || !Number.isFinite(len) || len < 0 || len > 400) return bad("len must be a number between 0 and 400");
      return true;
    }
    case "pair":
      return Array.isArray(value) && value.length === 2 && value.every((n) => typeof n === "number" && n >= 0 && n <= 1) || bad("must be [x, y] fractions between 0 and 1");
    case "quad":
      return Array.isArray(value) && value.length === 4 && value.every((n) => typeof n === "number" && n >= 0 && n <= 1) || bad("must be [x0, y0, x1, y1] fractions between 0 and 1");
    case "barrels":
      if (!Array.isArray(value) || value.length < min || value.length > max) return bad(`must list ${min}–${max} barrel rectangles`);
      for (let i = 0; i < value.length; i++) {
        const r = value[i];
        if (!Array.isArray(r) || r.length !== 4 || r.some((n) => typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 1))
          return bad(`barrel ${i} must be [left, top, right, bottom] fractions between 0 and 1`);
        if (r[0] >= r[2] || r[1] >= r[3]) return bad(`barrel ${i} must have positive width and height`);
        for (let j = 0; j < i; j++) {
          const other = value[j];
          if (r[0] < other[2] && r[2] > other[0] && r[1] < other[3] && r[3] > other[1])
            return bad(`barrels ${j} and ${i} must not overlap`);
        }
      }
      return true;
    case "decals":
      return Array.isArray(value) && value.length <= MAX_DEF_DECALS || bad(`must be a list of up to ${MAX_DEF_DECALS} decals`);
    case "mounts":
      return Array.isArray(value) && value.length >= 1 && value.length <= MAX_DEF_MOUNTS || bad(`must be a list of one to ${MAX_DEF_MOUNTS} mounts`);
    case "muzzles":
      if (!Array.isArray(value) || value.length < min || value.length > max) return bad(`must list ${min}–${max} muzzle points`);
      for (const point of value) {
        if (!isPlainObject$1(point)) return bad("every muzzle point must be { forward, lateral }");
        for (const key of Object.keys(point)) if (key !== "forward" && key !== "lateral") return bad(`"${key}" is not a muzzle coordinate`);
        for (const key of ["forward", "lateral"]) {
          const n = point[key];
          if (typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > 200) return bad(`${key} must be a number between -200 and 200`);
        }
      }
      return true;
    case "menuQueue":
      return Array.isArray(value) && value.length >= 1 && value.length <= MAX_MENU_QUEUE && value.every((id) => typeof id === "string" && ID_RE.test(id)) || bad(`must be a list of 1–${MAX_MENU_QUEUE} cut ids`);
    case "menuCuts":
      return Array.isArray(value) && value.length <= MAX_MENU_CUTS || bad(`must be a list of up to ${MAX_MENU_CUTS} cuts`);
    case "menuOrders":
      return Array.isArray(value) && value.length <= MAX_PLAYERS || bad(`must be a list of up to ${MAX_PLAYERS} opening orders`);
    case "musicQueue":
      return Array.isArray(value) && value.length <= MAX_MOD_MUSIC_QUEUE && value.every((id) => typeof id === "string" && ID_RE.test(id)) || bad(`must be a list of up to ${MAX_MOD_MUSIC_QUEUE} track ids`);
    case "musicTracks":
      return Array.isArray(value) && value.length <= MAX_MOD_MUSIC_TRACKS || bad(`must be a list of up to ${MAX_MOD_MUSIC_TRACKS} tracks`);
    case "weapons":
    case "factions":
    case "terrains":
    case "defs":
    case "sprites":
    case "sounds":
      return Array.isArray(value) || bad("must be a list");
    case "files":
      return isPlainObject$1(value) || bad("must be an object of path → data URL");
    // read word for word once the mod's defs and sheets are known (`game/ruleSpec.ts`)
    case "rules":
      return Array.isArray(value) || bad("must be a list of rules");
    case "capabilities":
      return Array.isArray(value) && value.length >= 1 && value.length <= 32 && value.every(validCapabilityId) && new Set(value).size === value.length || bad("must contain 1–32 unique bounded capability identifiers");
    case "extensionPackages":
      return Array.isArray(value) && value.length <= 16 || bad("must be a list of up to 16 extension packages");
    case "extensions":
    case "shield":
    case "look":
    case "anims":
    case "wing":
    case "cityTerrain":
    case "cityArchitecture":
    case "menuBackground":
    case "menuCamera":
    case "music":
      return isPlainObject$1(value) || bad("must be an object");
    // a rule's own words never stand in a table this checks: `game/ruleSpec.ts` reads them
    default:
      return true;
  }
}
function checkObject(raw, specs, path, issues, warnings, opts = {}) {
  const out = {};
  const known = new Set(specs.map((s) => s.name));
  for (const key of Object.keys(raw)) {
    if (!known.has(key)) warnings.push({ path: `${path}.${key}`, message: "unknown field, ignored" });
  }
  for (const spec of specs) {
    const value = raw[spec.name];
    if (value === void 0 || value === null) {
      const needed = spec.required === true || spec.required && spec.required === opts.kind;
      if (needed && !opts.skipRequired?.has(spec.name)) issues.push({ path: `${path}.${spec.name}`, message: "is required" });
      continue;
    }
    if (spec.only && opts.kind && spec.only !== opts.kind) {
      warnings.push({ path: `${path}.${spec.name}`, message: `only applies to a ${spec.only}, ignored` });
      continue;
    }
    const effective = opts.idListMax !== void 0 && spec.type === "ids" ? { ...spec, max: opts.idListMax } : spec;
    if (checkField(effective, value, `${path}.${spec.name}`, issues)) out[spec.name] = value;
  }
  return out;
}
function parseDefinitionPack(input) {
  let raw = input;
  if (typeof input === "string") {
    if (input.length > MAX_CONTENT_INPUT_BYTES) return { ok: false, errors: [{ path: "", message: "the manifest is too large" }], warnings: [] };
    try {
      raw = JSON.parse(input);
    } catch {
      return { ok: false, errors: [{ path: "", message: "not valid JSON" }], warnings: [] };
    }
  }
  if (!isPlainObject$1(raw)) return { ok: false, errors: [{ path: "", message: "not a mod manifest" }], warnings: [] };
  const limits = contentLimits(raw);
  const { files: embedded, ...metadata } = raw;
  try {
    if (JSON.stringify(metadata).length > limits.manifestBytes)
      return { ok: false, errors: [{ path: "", message: "the manifest is too large" }], warnings: [] };
  } catch {
    return { ok: false, errors: [{ path: "", message: "manifest metadata must be JSON data" }], warnings: [] };
  }
  if (isPlainObject$1(embedded) && contentFilesSize(embedded) > limits.filesBytes)
    return { ok: false, errors: [{ path: "files", message: "the embedded files are too large" }], warnings: [] };
  if (raw.format !== MOD_FORMAT) return { ok: false, errors: [{ path: "format", message: `must be "${MOD_FORMAT}"` }], warnings: [] };
  if (raw.v !== 1 && raw.v !== 2 && raw.v !== 3 && raw.v !== MOD_FORMAT_VERSION) return { ok: false, errors: [{ path: "v", message: `unsupported format version ${String(raw.v)} (this game reads 1–${MOD_FORMAT_VERSION})` }], warnings: [] };
  if (needsContentSchema(raw) && !contentSchemaPrepared()) return { ok: false, errors: [{ path: "v", message: "content extension schema must be prepared before validation" }], warnings: [] };
  const errors = [];
  const warnings = [];
  const head = checkObject(raw, MANIFEST_SPECS, "mod", errors, warnings);
  if (errors.length > 0) return { ok: false, errors, warnings };
  if (head.capacity !== void 0 && Number(head.v) < 4) errors.push({ path: "mod.capacity", message: "capacity profiles require format 4" });
  if (head.requiredCapabilities !== void 0 && Number(head.v) < 3) errors.push({ path: "mod.requiredCapabilities", message: "engine capabilities require format 3" });
  if (head.extensionPackages !== void 0) {
    if (Number(head.v) < 4) errors.push({ path: "mod.extensionPackages", message: "executable extension packages require format 4" });
    validateContentPackages(head.extensionPackages, errors, limits);
  }
  if (errors.length) return { ok: false, errors, warnings };
  const available = new Set((head.extensionPackages ?? []).flatMap((p) => p.capabilities ?? []));
  for (const id of head.requiredCapabilities ?? []) if (!available.has(id)) errors.push({ path: "mod.requiredCapabilities", message: `no extension package provides ${id}` });
  const defs = head.defs;
  const terrains = head.terrains ?? [];
  if (terrains.length > MAX_MOD_TERRAINS) errors.push({ path: "mod.terrains", message: `at most ${MAX_MOD_TERRAINS} terrain variants` });
  if (defs.length > limits.defs) errors.push({ path: "mod.defs", message: `at most ${limits.defs} defs` });
  const sprites = head.sprites ?? [];
  if (sprites.length > limits.sprites) errors.push({ path: "mod.sprites", message: `at most ${limits.sprites} sheets` });
  const sounds = head.sounds ?? [];
  if (sounds.length > limits.sounds) errors.push({ path: "mod.sounds", message: `at most ${limits.sounds} sounds` });
  if (errors.length > 0) return { ok: false, errors, warnings };
  const files = head.files;
  if (files) {
    for (const [k, v] of Object.entries(files)) {
      if (typeof v !== "string" || !v.startsWith("data:")) errors.push({ path: `mod.files.${k}`, message: "must be a data URL" });
    }
  }
  const mod = {
    ...head,
    defs,
    sprites,
    sounds,
    ...files ? { files } : {}
  };
  if (files) {
    for (const [i, pkg] of (mod.extensionPackages ?? []).entries())
      for (const [id, file] of Object.entries(pkg.assets ?? {}))
        if (!Object.hasOwn(files, file)) errors.push({ path: `extensionPackages[${i}].assets.${id}`, message: `"${file}" is not among the embedded files` });
  }
  const resolved = resolveDefinitions(mod, VANILLA);
  if (defs.length === 0 && terrains.length === 0 && !CONTENT_MUSIC_SLOTS.some((slot) => mod.music?.[slot] !== void 0) && !mod.menuBackground?.queue?.length) errors.push({ path: "mod.defs", message: "a mod needs at least one def, terrain variant, music queue or menu background" });
  errors.push(...resolved.errors);
  warnings.push(...resolved.warnings);
  return errors.length > 0 ? { ok: false, errors, warnings } : { ok: true, pack: mod, warnings };
}
function resolveDefinitions(mod, table = VANILLA) {
  const limits = contentLimits(mod);
  const errors = [];
  const warnings = [];
  const defs = [];
  const patches = [];
  const strings = {};
  const placeholders = [];
  const built = /* @__PURE__ */ new Map();
  const aliases = aliasesOf(table);
  const tableSprites = spriteKeysOf(table);
  const sheetKeys = /* @__PURE__ */ new Set();
  const cleanSprites = [];
  (mod.sprites ?? []).forEach((raw, i) => {
    const path = `sprites[${i}]`;
    if (!isPlainObject$1(raw)) {
      errors.push({ path, message: "must be an object" });
      return;
    }
    const clean = checkObject(raw, SPRITE_SPECS, path, errors, warnings);
    if (typeof clean.key !== "string" || typeof clean.file !== "string") return;
    if (!ATLAS_KEY_RE.test(clean.key)) {
      errors.push({ path: `${path}.key`, message: "must be u.<id>, tur.<id>, dec.<name>, prj.<name>, fx.<name> or ter.<mod id>-<name>" });
      return;
    }
    if (clean.key.startsWith("ter.")) {
      if (!clean.key.startsWith(`ter.${mod.id}-`) || clean.key.length <= `ter.${mod.id}-`.length) {
        errors.push({ path: `${path}.key`, message: `terrain materials must be named "ter.${mod.id}-<name>"` });
        return;
      }
      if ((clean.frames ?? 1) !== 1) errors.push({ path: `${path}.frames`, message: "terrain materials have one frame" });
      for (const field of ["rotated", "teams", "stripBg", "fitFootprint", "freezeStatic"]) {
        if (clean[field] === true) errors.push({ path: `${path}.${field}`, message: "terrain materials preserve their square image without rotation, recoloring or cleanup" });
        clean[field] = false;
      }
      if (!Number.isInteger(clean.fw) || !Number.isInteger(clean.fh) || clean.fw !== clean.fh)
        errors.push({ path, message: "terrain materials require equal whole fw and fh between 4 and 512 (128 recommended)" });
      for (const field of ["anchorY", "mount", "anims", "animRegion", "pivotX", "pivotY", "barrels"]) {
        if (clean[field] !== void 0) errors.push({ path: `${path}.${field}`, message: "not supported on a flat terrain material" });
      }
    }
    if (VANILLA_SPRITE_KEYS.has(clean.key) || tableSprites.has(clean.key) && !sheetKeys.has(clean.key) && !mod.defs.some((d) => d && (d.sprite === clean.key || d.turretSprite === clean.key || `u.${d.id}` === clean.key || `tur.${d.id}` === clean.key))) {
      errors.push({ path: `${path}.key`, message: `"${clean.key}" is art the game already has; a mod adds art, it does not replace it` });
      return;
    }
    if (!FILE_RE.test(clean.file)) {
      errors.push({ path: `${path}.file`, message: "must be a relative path inside the mod" });
      return;
    }
    if (sheetKeys.has(clean.key)) {
      errors.push({ path: `${path}.key`, message: `"${clean.key}" is listed twice` });
      return;
    }
    if (mod.files && !(clean.file in mod.files)) errors.push({ path: `${path}.file`, message: `"${clean.file}" is not among the embedded files` });
    for (const side of ["fw", "fh"]) {
      const v = clean[side];
      if (typeof v === "number" && !Number.isInteger(v)) warnings.push({ path: `${path}.${side}`, message: `${v} is not a whole number of pixels; the game bakes it as ${Math.round(v)}` });
    }
    if (clean.anims !== void 0) {
      const anims = readAnims(clean.anims, clean.frames ?? 1, `${path}.anims`, errors);
      if (!anims) return;
      clean.anims = anims;
    }
    sheetKeys.add(clean.key);
    cleanSprites.push({ ...clean, frames: clean.frames ?? 1 });
  });
  mod.sprites = cleanSprites;
  if (mod.terrains !== void 0) {
    const cleanTerrains = [];
    const terrainIds = /* @__PURE__ */ new Set();
    if (!Array.isArray(mod.terrains) || mod.terrains.length > MAX_MOD_TERRAINS)
      errors.push({ path: "terrains", message: `must be a list of up to ${MAX_MOD_TERRAINS} terrain variants` });
    else mod.terrains.forEach((raw, i) => {
      const path = `terrains[${i}]`;
      const before = errors.length;
      if (!isPlainObject$1(raw)) {
        errors.push({ path, message: "must be an object" });
        return;
      }
      const clean = checkObject(raw, TERRAIN_SPECS, path, errors, warnings);
      if (!clean.id || !clean.base || clean.name === void 0) return;
      if (!clean.id.startsWith(`${mod.id}-`) || clean.id.length <= mod.id.length + 1 || terrainIds.has(clean.id))
        errors.push({ path: `${path}.id`, message: "must be unique and prefixed with the mod id and a dash" });
      terrainIds.add(clean.id);
      const material = (key, at) => {
        if (key !== void 0 && (!key.startsWith(`ter.${mod.id}-`) || !sheetKeys.has(key)))
          errors.push({ path: at, message: "must name a terrain material sheet belonging to this mod" });
      };
      material(clean.texture, `${path}.texture`);
      let city;
      if (clean.city !== void 0) {
        if (clean.base !== "city") errors.push({ path: `${path}.city`, message: "city materials require base city" });
        if (clean.city.architecture === null) errors.push({ path: `${path}.city.architecture`, message: "must be an object" });
        const fields = checkObject(clean.city, CITY_TERRAIN_SPECS, `${path}.city`, errors, warnings);
        for (const color of ["roof", "wall", "window", "lamp", "accent", "accent2"]) {
          if (fields[color] !== void 0 && !/^#[0-9a-fA-F]{6}$/.test(fields[color]))
            errors.push({ path: `${path}.city.${color}`, message: "must be a #RRGGBB color" });
        }
        for (const texture of ["roofTexture", "wallTexture", "groundTexture", "signTexture"]) material(fields[texture], `${path}.city.${texture}`);
        if (fields.architecture !== void 0) {
          for (const spec of CITY_ARCHITECTURE_SPECS) {
            if (fields.architecture[spec.name] === null)
              errors.push({ path: `${path}.city.architecture.${spec.name}`, message: "must not be null; omit the field to use its default" });
          }
          const architecture = checkObject(fields.architecture, CITY_ARCHITECTURE_SPECS, `${path}.city.architecture`, errors, warnings);
          if ((architecture.minStoreys ?? 2) > (architecture.maxStoreys ?? 4))
            errors.push({ path: `${path}.city.architecture.minStoreys`, message: "must not exceed maxStoreys (defaults: minStoreys 2, maxStoreys 4)" });
          if (architecture.forms) architecture.forms = Object.freeze([...architecture.forms]);
          fields.architecture = Object.freeze(architecture);
        }
        city = Object.freeze(fields);
      }
      if (clean.base === "city") {
        if (clean.texture !== void 0) errors.push({ path: `${path}.texture`, message: "city uses city.roofTexture, wallTexture and groundTexture" });
        if (!city || Object.keys(city).length === 0) errors.push({ path: `${path}.city`, message: "a city variant needs at least one material, color or architecture" });
      } else if (clean.texture === void 0) errors.push({ path: `${path}.texture`, message: "a flat terrain variant needs a texture" });
      if (errors.length !== before) return;
      cleanTerrains.push(Object.freeze({
        id: clean.id,
        name: Object.freeze(contentText(clean.name)),
        base: clean.base,
        ...clean.texture ? { texture: clean.texture } : {},
        ...city ? { city } : {}
      }));
    });
    mod.terrains = cleanTerrains;
  }
  const soundKeys = /* @__PURE__ */ new Set();
  const cleanSounds = [];
  (mod.sounds ?? []).forEach((raw, i) => {
    const path = `sounds[${i}]`;
    if (!isPlainObject$1(raw)) {
      errors.push({ path, message: "must be an object" });
      return;
    }
    const clean = checkObject(raw, SOUND_SPECS, path, errors, warnings);
    if (typeof clean.key !== "string" || typeof clean.file !== "string") return;
    if (!SOUND_KEY_RE.test(clean.key) || !clean.key.startsWith(`${mod.id}-`)) {
      errors.push({ path: `${path}.key`, message: `must be "${mod.id}-<name>", lower case` });
      return;
    }
    if (!FILE_RE.test(clean.file)) {
      errors.push({ path: `${path}.file`, message: "must be a relative path inside the mod" });
      return;
    }
    if (soundKeys.has(clean.key)) {
      errors.push({ path: `${path}.key`, message: `"${clean.key}" is listed twice` });
      return;
    }
    if (mod.files && !(clean.file in mod.files)) errors.push({ path: `${path}.file`, message: `"${clean.file}" is not among the embedded files` });
    soundKeys.add(clean.key);
    cleanSounds.push({ key: clean.key, file: clean.file });
  });
  mod.sounds = cleanSounds;
  if (mod.music !== void 0) {
    if (!isPlainObject$1(mod.music)) errors.push({ path: "music", message: "must be an object" });
    else {
      const music = checkObject(mod.music, MUSIC_SPECS, "music", errors, warnings);
      const ids = /* @__PURE__ */ new Set();
      const tracks = [];
      (music.tracks ?? []).forEach((raw, i) => {
        const path = `music.tracks[${i}]`;
        if (!isPlainObject$1(raw)) {
          errors.push({ path, message: "must be an object" });
          return;
        }
        const track = checkObject(raw, MUSIC_TRACK_SPECS, path, errors, warnings);
        if (typeof track.id !== "string" || typeof track.file !== "string") return;
        if (!track.id.startsWith(`${mod.id}-`) || track.id.length <= mod.id.length + 1 || MUSIC_IDS.has(track.id)) errors.push({ path: `${path}.id`, message: `must be a new "${mod.id}-<name>" track id` });
        if (ids.has(track.id)) errors.push({ path: `${path}.id`, message: "track id is listed twice" });
        if (!FILE_RE.test(track.file) || !/\.(mp3|ogg|wav)$/i.test(track.file)) errors.push({ path: `${path}.file`, message: "must be a relative MP3, Ogg or WAV path inside the mod" });
        if (mod.files && !Object.prototype.hasOwnProperty.call(mod.files, track.file)) errors.push({ path: `${path}.file`, message: `"${track.file}" is not among the embedded files` });
        ids.add(track.id);
        tracks.push(track);
      });
      for (const slot of CONTENT_MUSIC_SLOTS) music[slot]?.forEach((id, i) => {
        if (!MUSIC_IDS.has(id) && !ids.has(id)) errors.push({ path: `music.${slot}[${i}]`, message: `"${id}" is neither a built-in track nor one of this pack's tracks` });
      });
      mod.music = { ...music, tracks };
    }
  }
  if (mod.menuBackground !== void 0) {
    const bg = checkObject(mod.menuBackground, MENU_BACKGROUND_SPECS, "menuBackground", errors, warnings);
    const ids = /* @__PURE__ */ new Set();
    const cuts = [];
    (bg.cuts ?? []).forEach((raw, i) => {
      const path = `menuBackground.cuts[${i}]`;
      if (!isPlainObject$1(raw)) {
        errors.push({ path, message: "must be an object" });
        return;
      }
      const cut = checkObject(raw, MENU_CUT_SPECS, path, errors, warnings);
      if (typeof cut.id !== "string") return;
      if (!cut.id.startsWith(`${mod.id}-`) || cut.id.length <= mod.id.length + 1 || MENU_CUT_IDS.includes(cut.id)) errors.push({ path: `${path}.id`, message: `must be a new "${mod.id}-<name>" cut id` });
      if (ids.has(cut.id)) errors.push({ path: `${path}.id`, message: "cut id is listed twice" });
      ids.add(cut.id);
      if (!mod.maps?.includes(cut.map)) errors.push({ path: `${path}.map`, message: "must name a file listed in this pack’s maps" });
      for (const key of ["camera", "cameraEnd"]) if (cut[key]) cut[key] = checkObject(cut[key], MENU_CAMERA_SPECS, `${path}.${key}`, errors, warnings);
      const owners = /* @__PURE__ */ new Set();
      cut.orders = (cut.orders ?? []).flatMap((raw2, k) => {
        const orderPath = `${path}.orders[${k}]`;
        if (!isPlainObject$1(raw2)) {
          errors.push({ path: orderPath, message: "must be an object" });
          return [];
        }
        const order = checkObject(raw2, MENU_ORDER_SPECS, orderPath, errors, warnings);
        if (owners.has(order.owner)) errors.push({ path: `${orderPath}.owner`, message: "owner is listed twice" });
        owners.add(order.owner);
        return [order];
      });
      cuts.push(cut);
    });
    const queue = bg.queue ?? [];
    queue.forEach((id, i) => {
      if (!MENU_CUT_IDS.includes(id) && !ids.has(id)) errors.push({ path: `menuBackground.queue[${i}]`, message: `"${id}" is neither an original cut nor one of this pack’s cuts` });
    });
    mod.menuBackground = { cuts, queue };
  }
  mod.defs.forEach((raw, i) => {
    const path = `defs[${i}]`;
    if (!isPlainObject$1(raw)) {
      errors.push({ path, message: "must be an object" });
      return;
    }
    const id = raw.id;
    if (typeof id !== "string" || !ID_RE.test(id)) {
      errors.push({ path: `${path}.id`, message: "must be an id: lower case letters, digits, - or _, 2–40 characters" });
      return;
    }
    if (table[id]) {
      errors.push({ path: `${path}.id`, message: `"${id}" is already a def${VANILLA_IDS.has(id) ? " of the game" : ` (mod ${table[id].mod ?? "?"})`}` });
      return;
    }
    if (built.has(id)) {
      errors.push({ path: `${path}.id`, message: `"${id}" is defined twice` });
      return;
    }
    if (aliases.has(id)) {
      errors.push({ path: `${path}.id`, message: `"${id}" is an alias of a def of the game` });
      return;
    }
    let base;
    if (raw.extends !== void 0) {
      if (typeof raw.extends !== "string" || !(table[raw.extends] ?? built.get(raw.extends))) {
        errors.push({ path: `${path}.extends`, message: `"${String(raw.extends)}" is not a def it can extend` });
        return;
      }
      base = table[raw.extends] ?? built.get(raw.extends);
      if (base.warhead || base.isHQ && mod.v < 2) {
        errors.push({ path: `${path}.extends`, message: `"${raw.extends}" cannot be extended in this format` });
        return;
      }
    }
    const kind = raw.kind ?? base?.kind;
    if (kind !== "unit" && kind !== "building") {
      errors.push({ path: `${path}.kind`, message: 'must be "unit" or "building"' });
      return;
    }
    const clean = checkObject(raw, DEF_SPECS, path, errors, warnings, {
      kind,
      // the base supplies what a fresh def would have to state
      skipRequired: base ? /* @__PURE__ */ new Set(["kind", "cost", "hp"]) : void 0,
      idListMax: mod.capacity === "large" && mod.v === 4 ? limits.defs : void 0
    });
    const own = clean;
    if (own.isHQ && mod.v < 2) errors.push({ path: `${path}.isHQ`, message: "headquarters require format 2" });
    if (own.name === void 0) return;
    if (own.kind === void 0) own.kind = kind;
    const def = buildDef(own, kind, base, mod.id, soundKeys, path, errors, warnings);
    if (def?.isHQ && (def.kind !== "building" || def.offshore || def.needsDeposit)) errors.push({ path: `${path}.isHQ`, message: "a headquarters must be a land building without a deposit requirement" });
    if (!def) return;
    if (def.hp > limits.hp) errors.push({ path: `${path}.hp`, message: `must be between 1 and ${limits.hp} for ${mod.capacity ?? "standard"} capacity` });
    if (def.extensions !== void 0 || def.weapons.some((w2) => w2.extensions !== void 0)) {
      const extensionContext = { definition: { ...def, ...raw, extensions: def.extensions, weapons: def.weapons }, weaponIds: def.weapons.map((w2) => w2.id), defIds: /* @__PURE__ */ new Set([...Object.keys(table), ...mod.defs.map((d) => d.id)]), spriteKeys: /* @__PURE__ */ new Set([...tableSprites, ...sheetKeys]) };
      if (def.extensions !== void 0) def.extensions = readExtensions$1(def.extensions, mod, `${path}.extensions`, errors, extensionContext);
      def.weapons.forEach((w2, wi) => {
        if (w2.extensions !== void 0) w2.extensions = readExtensions$1(w2.extensions, mod, `${path}.weapons[${wi}].extensions`, errors, extensionContext, true);
      });
    }
    const lookCtx = ruleContext(def, table, built, sheetKeys, soundKeys);
    def.weapons.forEach((wp, k) => {
      if (!wp.look || !own.weapons?.[k]?.look) return;
      const look = readLook(wp.look, `${path}.weapons[${k}].look`, lookCtx, errors);
      if (!look) {
        delete wp.look;
        return;
      }
      wp.look = look;
      if (look.beam) wp.speed = 5e3;
    });
    if (own.shield !== void 0) {
      const shield = readShield(own.shield, `${path}.shield`, lookCtx, errors);
      if (shield) def.shield = shield;
      else delete def.shield;
    }
    const ownSheet = sheetKeys.has(`u.${id}`);
    const bodyKey = own.sprite ?? (ownSheet ? `u.${id}` : base?.sprite ?? `u.${id}`);
    if (!sheetKeys.has(bodyKey) && !tableSprites.has(bodyKey)) {
      if (own.sprite) errors.push({ path: `${path}.sprite`, message: `"${bodyKey}" is neither a sheet of this mod nor art the game has` });
      else {
        warnings.push({ path: `${path}.sprite`, message: `no sheet u.${id}: a placeholder is drawn until one is added` });
        placeholders.push(bodyKey);
      }
    }
    def.sprite = bodyKey;
    const ownTurret = sheetKeys.has(`tur.${id}`);
    const turretKey = own.turretSprite ?? (ownTurret ? `tur.${id}` : own.sprite !== void 0 || ownSheet ? void 0 : base?.turretSprite);
    if (turretKey !== void 0) {
      if (!sheetKeys.has(turretKey) && !tableSprites.has(turretKey)) {
        errors.push({ path: `${path}.turretSprite`, message: `"${turretKey}" is neither a sheet of this mod nor art the game has` });
      } else def.turretSprite = turretKey;
    } else delete def.turretSprite;
    for (const wp of def.weapons) if (wp.turret === void 0) wp.turret = !!def.turretSprite;
    if (own.turretMounts !== void 0) {
      const rings = [];
      own.turretMounts.forEach((rawMount, k) => {
        const mpath = `${path}.turretMounts[${k}]`;
        if (!isPlainObject$1(rawMount)) {
          errors.push({ path: mpath, message: "must be an object" });
          return;
        }
        const m = checkObject(rawMount, MOUNT_SPECS, mpath, errors, warnings);
        const ring = { x: m.x ?? 0, y: m.y ?? 0 };
        if (m.rest) ring.rest = m.rest * Math.PI / 180;
        if (m.arc !== void 0 && m.arc < 180) ring.arc = m.arc * Math.PI / 180;
        rings.push(ring);
      });
      if (rings.length > 0) def.turretMounts = rings;
      else delete def.turretMounts;
    } else if (own.sprite !== void 0 || ownSheet) delete def.turretMounts;
    const rawDecals = own.decals ?? (own.sprite !== void 0 || ownSheet ? void 0 : base?.decals);
    delete def.decals;
    if (rawDecals) {
      const list = [];
      rawDecals.forEach((rawDecal, k) => {
        const dpath = `${path}.decals[${k}]`;
        if (!isPlainObject$1(rawDecal)) {
          errors.push({ path: dpath, message: "must be an object" });
          return;
        }
        const dc = checkObject(rawDecal, DECAL_SPECS, dpath, errors, warnings);
        if (typeof dc.sprite !== "string") return;
        if (!sheetKeys.has(dc.sprite) && !tableSprites.has(dc.sprite)) {
          errors.push({ path: `${dpath}.sprite`, message: `"${dc.sprite}" is neither a sheet of this mod nor art the game has` });
          return;
        }
        if (dc.on === "turret" && !def.turretSprite) {
          errors.push({ path: `${dpath}.on`, message: "fixed to a turret the def does not have" });
          return;
        }
        list.push(dc);
      });
      if (list.length > 0) def.decals = list;
    }
    for (const a of def.aliases ?? []) {
      if (aliases.has(a) || table[a] || built.has(a)) errors.push({ path: `${path}.aliases`, message: `"${a}" is already a name of another def` });
      aliases.add(a);
    }
    built.set(id, def);
    defs.push(def);
    strings[`unit.${id}.name`] = contentText(own.name, id);
    strings[`unit.${id}.desc`] = contentText(own.desc, "");
  });
  const find = (id) => table[id] ?? built.get(id);
  const forms = /* @__PURE__ */ new Set();
  mod.defs.forEach((raw, i) => {
    if (!isPlainObject$1(raw) || typeof raw.id !== "string") return;
    const def = built.get(raw.id);
    if (!def) return;
    const own = raw;
    const base = own.extends ? find(own.extends) : void 0;
    const path = `defs[${i}]`;
    const ids = (list, field, want) => {
      if (!Array.isArray(list)) return [];
      const out = [];
      for (const ref of list) {
        const other = find(ref);
        if (!other) errors.push({ path: `${path}.${field}`, message: `"${ref}" is not a def` });
        else if (other.kind !== want) errors.push({ path: `${path}.${field}`, message: `"${ref}" is not a ${want}` });
        else if (want === "unit" && other.warhead) errors.push({ path: `${path}.${field}`, message: `"${ref}" cannot be produced` });
        else out.push(ref);
      }
      return out;
    };
    const lines = (list) => {
      if (!Array.isArray(list)) return [];
      const out = [];
      for (const ref of list) {
        const other = find(ref);
        if (!other) errors.push({ path: `${path}.producedBy`, message: `"${ref}" is not a def` });
        else if (other.kind === "unit" && !built.has(ref)) errors.push({ path: `${path}.producedBy`, message: `"${ref}" is a unit of the game's own; only a building, or a unit of this mod, can train others` });
        else if (other.kind === "unit" && other.warhead) errors.push({ path: `${path}.producedBy`, message: `"${ref}" cannot train anything` });
        else out.push(ref);
      }
      return out;
    };
    delete def.rules;
    if (own.rules !== void 0) {
      const read2 = readRules(own.rules, `${path}.rules`, ruleContext(def, table, built, sheetKeys, soundKeys), errors);
      if (read2.rules.length) {
        def.rules = read2.rules;
        for (const r of read2.rules) {
          for (const x of r.do) {
            if (x.morph) forms.add(x.morph);
            if (x.spawn) forms.add(x.spawn.unit);
          }
        }
      }
      for (const [k, v] of Object.entries(read2.strings)) strings[k] = contentText(v, "");
    }
    delete def.wing;
    if (own.wing !== void 0) {
      const wing = readWing(own.wing, `${path}.wing`, ruleContext(def, table, built, sheetKeys, soundKeys), errors);
      if (wing) {
        def.wing = wing;
        forms.add(wing.unit);
      }
    }
    const nodes = (def.requires ?? []).filter((r) => isTechId(r));
    def.requires = [...ids((def.requires ?? []).filter((r) => !isTechId(r)), "requires", "building"), ...nodes];
    if (def.requires.length === 0) delete def.requires;
    if (def.kind === "building") {
      if (def.produces) def.produces = ids(def.produces, "produces", "unit");
      if (own.upgradeOf !== void 0) {
        const src = find(own.upgradeOf);
        if (!src || src.kind !== "building") errors.push({ path: `${path}.upgradeOf`, message: `"${own.upgradeOf}" is not a building` });
        else if (src.upgradesTo || patches.some((p) => p.kind === "upgrade" && p.target === src.id)) {
          errors.push({ path: `${path}.upgradeOf`, message: `"${own.upgradeOf}" already upgrades to ${src.upgradesTo ?? "another def of this mod"}` });
        } else if (own.upgradeOf === def.id) errors.push({ path: `${path}.upgradeOf`, message: "a building cannot upgrade to itself" });
        else {
          def.upgradeOnly = true;
          patches.push({
            kind: "upgrade",
            target: src.id,
            id: def.id,
            cost: own.upgradeCost ?? Math.max(0, def.cost - src.cost),
            time: own.upgradeTime ?? def.buildTime
          });
        }
      } else {
        const builders = own.builtBy !== void 0 ? ids(own.builtBy, "builtBy", "unit") : base ? Object.values({ ...table, ...Object.fromEntries(built) }).filter((d) => d.builds?.includes(base.id)).map((d) => d.id) : ["engineer"];
        for (const b of builders) {
          const unit = find(b);
          if (!unit.builds) {
            errors.push({ path: `${path}.builtBy`, message: `"${b}" is not a builder unit` });
            continue;
          }
          patches.push({ kind: "builds", target: b, id: def.id });
        }
        if (builders.length === 0) warnings.push({ path: `${path}.builtBy`, message: "nothing can build it" });
      }
    } else {
      if (def.builds) def.builds = ids(def.builds, "builds", "building");
      if (def.produces) def.produces = ids(def.produces, "produces", "unit");
      const producers = own.producedBy !== void 0 ? lines(own.producedBy) : base ? Object.values({ ...table, ...Object.fromEntries(built) }).filter((d) => d.produces?.includes(base.id)).map((d) => d.id) : defaultProducers(def.domain, def.tier).filter((b) => !!find(b));
      for (const b of producers) {
        const line = find(b);
        if (!line.produces && line.id !== def.id) {
          warnings.push({ path: `${path}.producedBy`, message: `"${b}" was not a factory; it becomes one` });
        }
        patches.push({ kind: "produces", target: b, id: def.id });
      }
      if (producers.length === 0 && !mod.defs.some((d) => isPlainObject$1(d) && Array.isArray(d.produces) && d.produces.includes(def.id))) {
        warnings.push({ path: `${path}.producedBy`, message: "nothing produces it" });
      }
    }
  });
  mod.defs.forEach((raw, i) => {
    const wing = isPlainObject$1(raw) && typeof raw.id === "string" ? built.get(raw.id)?.wing : void 0;
    if (!wing) return;
    const at = `defs[${i}].wing.unit`;
    const lines = patches.filter((p) => p.kind === "produces" && p.id === wing.unit).map((p) => p.target).concat(defs.filter((d) => d.produces?.includes(wing.unit)).map((d) => d.id));
    if (lines.length) errors.push({ path: at, message: `"${wing.unit}" is also built by ${lines.join(", ")}; a carrier's plane is made by its carrier alone (\`"producedBy": []\`)` });
    if (built.get(wing.unit)?.wing) errors.push({ path: at, message: `"${wing.unit}" carries a wing of its own; a carrier's plane carries none` });
  });
  if (mod.requiredCapabilities?.length) {
    const extensionTable = { ...table, ...Object.fromEntries(built) };
    defs.forEach((def, i) => validateExtensionReferences$1(def, extensionTable, `defs[${i}].extensions`, errors, forms, mod));
  }
  const quiet = warnings.filter((w2) => {
    const m = /^defs\[(\d+)\]\.producedBy$/.exec(w2.path);
    const d = m ? mod.defs[Number(m[1])] : void 0;
    return !(m && w2.message === "nothing produces it" && isPlainObject$1(d) && forms.has(d.id));
  });
  warnings.length = 0;
  warnings.push(...quiet);
  if (mod.factions !== void 0) {
    if (mod.v < 2) errors.push({ path: "factions", message: "factions require format 2" });
    if (!Array.isArray(mod.factions) || mod.factions.length > 16) errors.push({ path: "factions", message: "must be a list of up to 16 factions" });
    else {
      const resolved = cloneTable({ ...table, ...Object.fromEntries(built) });
      applyPatches(resolved, patches);
      const seen = /* @__PURE__ */ new Set();
      const factions = [];
      mod.factions.forEach((raw, i) => {
        const path = `factions[${i}]`;
        if (!isPlainObject$1(raw)) {
          errors.push({ path, message: "must be an object" });
          return;
        }
        const f = checkObject(raw, FACTION_SPECS, path, errors, warnings);
        if (!f.id || !f.headquarters || !f.builder || !f.name) return;
        if (!f.id.startsWith(`${mod.id}-`) || seen.has(f.id)) errors.push({ path: `${path}.id`, message: "must be unique and prefixed with the mod id and a dash" });
        seen.add(f.id);
        const hq = resolved[f.headquarters], builder = resolved[f.builder];
        if (!built.has(f.headquarters) || !hq?.isHQ || hq.kind !== "building" || hq.offshore || hq.needsDeposit || hq.upgradeOnly)
          errors.push({ path: `${path}.headquarters`, message: "must name this mod’s buildable land headquarters" });
        if (!built.has(f.builder) || builder?.kind !== "unit" || !["ground", "amphibious"].includes(builder.domain) || !builder.builds?.includes(f.headquarters) || !(builder.buildRate > 0) || !(builder.speed > 0))
          errors.push({ path: `${path}.builder`, message: "must name this mod’s mobile land builder that can rebuild its headquarters" });
        if (!hq?.produces?.includes(f.builder)) errors.push({ path: `${path}.headquarters`, message: "the headquarters must produce its starting builder" });
        if (hq?.requires?.length) errors.push({ path: `${path}.headquarters`, message: "a starting headquarters cannot require another building or research" });
        if (builder?.requires?.some((id) => id !== f.headquarters)) errors.push({ path: `${path}.builder`, message: "the starting builder can require only its headquarters" });
        const roster = f.roster ?? defs.map((d) => d.id);
        if (roster.length > limits.defs) errors.push({ path: `${path}.roster`, message: `at most ${limits.defs} definitions for ${mod.capacity ?? "standard"} capacity` });
        if (!roster.includes(f.headquarters) || !roster.includes(f.builder)) errors.push({ path: `${path}.roster`, message: "must include the headquarters and starting builder" });
        for (const id of roster) {
          const def = resolved[id];
          if (!def) {
            errors.push({ path: `${path}.roster`, message: `unknown definition "${id}"` });
            continue;
          }
          for (const required of def.requires ?? []) if (!isTechId(required) && !roster.includes(required))
            errors.push({ path: `${path}.roster`, message: `"${id}" requires "${required}" outside the roster` });
        }
        factions.push({ ...f, roster });
      });
      mod.factions = factions;
    }
  }
  return { ok: errors.length === 0, pack: mod, defs, patches, strings, placeholders, errors, warnings };
}
function ruleContext(def, table, built, sheets, sounds) {
  return {
    def,
    find: (id) => table[id] ?? built.get(id),
    ownDef: (id) => built.has(id),
    isTech: isTechId,
    sheets,
    sounds,
    weaponSounds: WEAPON_SOUNDS,
    weaponClasses: WEAPON_CLASSES,
    isText,
    idRe: ID_RE
  };
}
function buildDef(own, kind, base, modId, soundKeys, path, errors, warnings) {
  const inherited = base ? cloneData(base) : {};
  delete inherited.id;
  delete inherited.aliases;
  delete inherited.mod;
  delete inherited.upgradesTo;
  delete inherited.upgradeCost;
  delete inherited.upgradeTime;
  delete inherited.upgradeOnly;
  delete inherited.warhead;
  delete inherited.emp;
  delete inherited.aiWeight;
  delete inherited.lab;
  delete inherited.unique;
  delete inherited.rules;
  if (base && base.kind !== kind) {
    errors.push({ path: `${path}.kind`, message: `a ${kind} cannot extend a ${base.kind}` });
    return null;
  }
  const domain = kind === "building" ? "none" : own.domain ?? inherited.domain ?? "ground";
  const fw = kind === "building" ? own.fw ?? inherited.fw ?? 2 : void 0;
  const fh = kind === "building" ? own.fh ?? inherited.fh ?? fw : void 0;
  const cost = own.cost ?? inherited.cost;
  const hp = own.hp ?? inherited.hp;
  if (cost === void 0 || hp === void 0) return null;
  const armor = own.armor ?? inherited.armor ?? (kind === "building" ? "structure" : domain === "air" ? "air" : domain === "ship" ? own.underwater ?? inherited.underwater ? "sub" : "ship" : "medium");
  const def = {
    ...inherited,
    ...stripModOnly(own),
    id: own.id,
    kind,
    domain,
    tier: own.tier ?? inherited.tier ?? 1,
    cost,
    buildTime: own.buildTime ?? inherited.buildTime ?? Math.max(2, Math.round(cost / 14)),
    pop: own.pop ?? inherited.pop ?? (kind === "unit" ? 1 : 0),
    hp,
    armor,
    speed: kind === "building" ? 0 : own.speed ?? inherited.speed ?? 60,
    turnRate: kind === "building" ? 0 : own.turnRate ?? inherited.turnRate ?? 3.5,
    // Fog rays and their cache use whole tile coordinates. Normalize authored
    // and inherited content here, before either simulation kernel sees it.
    vision: Math.round(own.vision ?? inherited.vision ?? 8),
    radius: own.radius ?? inherited.radius ?? (kind === "building" ? Math.max(fw, fh) * 15 : 9),
    weapons: [],
    sprite: "",
    mod: modId
  };
  if (kind === "building") {
    def.fw = fw;
    def.fh = fh;
    if (def.power === void 0) def.power = 0;
  } else {
    if (def.power === void 0) def.power = -def.pop;
    if (own.trail === void 0 && inherited.trail === void 0) {
      if (domain === "ground" || domain === "amphibious") def.trail = "tread";
      else if (domain === "ship" && !def.underwater) def.trail = "wake";
    }
  }
  if (def.aliases) def.aliases = def.aliases.map((a) => a.toLowerCase());
  if (def.directionalArmor && (kind !== "unit" || domain !== "ground")) {
    if (own.directionalArmor) errors.push({ path: `${path}.directionalArmor`, message: "directional armour requires a ground unit" });
    else delete def.directionalArmor;
  }
  const rawWeapons = own.weapons ?? (base ? inherited.weapons : []) ?? [];
  const hasTurret = !!(own.turretSprite ?? (own.sprite ? void 0 : inherited.turretSprite));
  rawWeapons.forEach((raw, i) => {
    const wpath = `${path}.weapons[${i}]`;
    if (!isPlainObject$1(raw)) {
      errors.push({ path: wpath, message: "must be an object" });
      return;
    }
    const clean = checkObject(raw, WEAPON_SPECS, wpath, errors, warnings);
    if (!clean.cls || clean.dmg === void 0 || clean.reload === void 0 || clean.range === void 0) return;
    if (clean.sound !== void 0 && !WEAPON_SOUNDS.includes(clean.sound) && !soundKeys.has(clean.sound)) {
      errors.push({ path: `${wpath}.sound`, message: `"${clean.sound}" is neither a game sound (${WEAPON_SOUNDS.join(", ")}) nor one of this mod's sounds` });
      return;
    }
    const projectile = clean.projectile ?? PROJECTILE_BY_CLASS[clean.cls];
    const wp = {
      ...clean,
      id: clean.id ?? `w${i + 1}`,
      cls: clean.cls,
      dmg: clean.dmg,
      reload: clean.reload,
      range: clean.range,
      projectile,
      speed: clean.speed ?? SPEED_BY_PROJECTILE[projectile] ?? 400,
      targets: clean.targets ?? TARGETS_BY_CLASS[clean.cls] ?? ["ground", "ship"],
      sound: clean.sound ?? SOUND_BY_CLASS[clean.cls]
    };
    if (clean.turret === void 0 && hasTurret) wp.turret = true;
    if (wp.minRange !== void 0 && wp.minRange >= wp.range) {
      errors.push({ path: `${wpath}.minRange`, message: "must be less than range" });
      return;
    }
    def.weapons.push(resolveWeapon(wp));
  });
  if (def.weapons.length > 8) {
    errors.push({ path: `${path}.weapons`, message: "at most 8 weapons" });
    return null;
  }
  return def;
}
function stripModOnly(own) {
  const { name: _n, desc: _d, extends: _e, weapons: _w, producedBy: _p, builtBy: _b, upgradeOf: _u, sprite: _s, turretSprite: _t, turretMounts: _tm, decals: _dc, rules: _r, wing: _wg, ...rest } = own;
  return rest;
}
let active = [];
const injected = /* @__PURE__ */ new Set();
const listeners = /* @__PURE__ */ new Set();
function applyDefinitions(mods) {
  const table = cloneTable(VANILLA);
  const strings = {};
  const report = { active: [], rejected: [], warnings: [], placeholders: [] };
  const terrains = [];
  const terrainIds = /* @__PURE__ */ new Set();
  const terrainSheets = /* @__PURE__ */ new Set();
  for (const mod of mods) {
    const r = resolveDefinitions(mod, table);
    if (!r.ok) {
      report.rejected.push({ id: mod.id, errors: r.errors });
      continue;
    }
    const duplicate = mod.terrains?.find((terrain) => terrainIds.has(terrain.id));
    if (duplicate) {
      report.rejected.push({ id: mod.id, errors: [{ path: "terrains", message: `"${duplicate.id}" is already an active terrain variant` }] });
      continue;
    }
    const duplicateSheet = mod.sprites?.find((sprite) => sprite.key.startsWith("ter.") && terrainSheets.has(sprite.key));
    if (duplicateSheet) {
      report.rejected.push({ id: mod.id, errors: [{ path: "sprites", message: `"${duplicateSheet.key}" is already an active terrain material` }] });
      continue;
    }
    if (r.warnings.length > 0) report.warnings.push({ id: mod.id, warnings: r.warnings });
    for (const d of r.defs) table[d.id] = d;
    applyPatches(table, r.patches);
    Object.assign(strings, r.strings);
    report.placeholders.push(...r.placeholders);
    report.active.push(mod);
    for (const terrain of mod.terrains ?? []) {
      terrainIds.add(terrain.id);
      terrains.push({ ...terrain, name: contentText(terrain.name), mod: mod.id });
    }
    for (const sprite of mod.sprites ?? []) if (sprite.key.startsWith("ter.")) terrainSheets.add(sprite.key);
  }
  for (const k of Object.keys(DEFS)) delete DEFS[k];
  Object.assign(DEFS, table);
  ALL_DEF_IDS.length = 0;
  ALL_DEF_IDS.push(...Object.keys(table));
  for (const k of injected) delete STRINGS[k];
  injected.clear();
  for (const [k, v] of Object.entries(strings)) {
    STRINGS[k] = v;
    injected.add(k);
  }
  active = report.active;
  replaceTerrainVariants(terrains);
  for (const fn of listeners) fn();
  return report;
}
function applyPatches(table, patches) {
  for (const p of patches) {
    const target = table[p.target];
    if (!target) continue;
    if (p.kind === "produces") {
      target.produces = target.produces ?? [];
      if (!target.produces.includes(p.id)) target.produces.push(p.id);
    } else if (p.kind === "builds") {
      target.builds = target.builds ?? [];
      if (!target.builds.includes(p.id)) target.builds.push(p.id);
    } else {
      target.upgradesTo = p.id;
      target.upgradeCost = p.cost;
      target.upgradeTime = p.time;
    }
  }
}
function activeDefinitions() {
  return active;
}
function activeContentStamps() {
  return active.map((m) => ({ id: m.id, version: m.version }));
}
const MAX_REQUIRED_MODS = 16;
const MAX_HELLO_MODS = 64;
const VERSION_MAX = 32;
function stampOf(mod) {
  return { id: mod.id, version: mod.version };
}
function requiredContentOf(mod) {
  return { id: mod.id, version: mod.version, name: mod.name };
}
function isContentStamp(value) {
  return isPlainObject$1(value) && typeof value.id === "string" && ID_RE.test(value.id) && typeof value.version === "string" && value.version.length > 0 && value.version.length <= VERSION_MAX;
}
function sameStamps(a, b) {
  return a.length === b.length && a.every((s, i) => s.id === b[i].id && s.version === b[i].version);
}
function missingContent(required, have) {
  return required.filter((r) => !(have ?? []).some((h) => h.id === r.id && h.version === r.version));
}
function onContentChanged(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function contentOfDef(id) {
  const modId = DEFS[id]?.mod;
  return modId ? active.find((m) => m.id === modId) : void 0;
}
function countDefs(mod) {
  let units = 0, buildings = 0;
  for (const d of mod.defs) {
    if (!isPlainObject$1(d)) continue;
    const kind = d.kind ?? (typeof d.extends === "string" ? VANILLA[d.extends]?.kind : void 0);
    if (kind === "building") buildings++;
    else units++;
  }
  return { units, buildings };
}
function imageSize(bytes) {
  const u32 = (i) => (bytes[i] << 24 | bytes[i + 1] << 16 | bytes[i + 2] << 8 | bytes[i + 3]) >>> 0;
  const u16 = (i) => bytes[i] << 8 | bytes[i + 1];
  const u24le = (i) => bytes[i] | bytes[i + 1] << 8 | bytes[i + 2] << 16;
  const u16le = (i) => bytes[i] | bytes[i + 1] << 8;
  if (bytes.length >= 24 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) {
    return { w: u32(16), h: u32(20) };
  }
  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 255) return null;
      const marker = bytes[i + 1];
      if (marker === 216 || marker >= 208 && marker <= 215 || marker === 1 || marker === 255) {
        i += marker === 255 ? 1 : 2;
        continue;
      }
      const len = u16(i + 2);
      if (marker >= 192 && marker <= 207 && marker !== 196 && marker !== 200 && marker !== 204) {
        return { h: u16(i + 5), w: u16(i + 7) };
      }
      if (marker === 217 || marker === 218) return null;
      i += 2 + len;
    }
    return null;
  }
  if (bytes.length >= 30 && bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70 && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80) {
    const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
    if (chunk === "VP8 ") return { w: u16le(26) & 16383, h: u16le(28) & 16383 };
    if (chunk === "VP8L") {
      const bits = bytes[21] | bytes[22] << 8 | bytes[23] << 16 | bytes[24] << 24;
      return { w: (bits & 16383) + 1, h: (bits >>> 14 & 16383) + 1 };
    }
    if (chunk === "VP8X") return { w: u24le(24) + 1, h: u24le(27) + 1 };
  }
  return null;
}
function checkScreenshot(size, byteLength) {
  if (!size) return "is not a PNG, JPEG or WebP";
  if (byteLength > MAX_SCREENSHOT_BYTES) return `is ${(byteLength / 1048576).toFixed(1)} MB; keep a screenshot under ${MAX_SCREENSHOT_BYTES / 1048576}`;
  if (size.w < MIN_SCREENSHOT_WIDTH) return `is ${size.w} px wide; a screenshot is at least ${MIN_SCREENSHOT_WIDTH}`;
  if (Math.abs(size.w / size.h - SCREENSHOT_ASPECT) > SCREENSHOT_ASPECT * SCREENSHOT_ASPECT_TOLERANCE) return `is ${size.w} × ${size.h}; a screenshot is 4:3 (${size.w} × ${Math.round(size.w / SCREENSHOT_ASPECT)}, say)`;
  return null;
}
function parseMod(input) {
  const parsed = parseDefinitionPack(input);
  if (!parsed.ok) return parsed;
  const { pack, ...result } = parsed;
  return { ...result, mod: pack };
}
function resolveMod(mod, table) {
  const { pack, ...result } = resolveDefinitions(mod, table);
  return { ...result, mod: pack };
}
const MOD_REGISTRY_REPO = "steel-tide/mods";
const MOD_REGISTRY_URL = `https://raw.githubusercontent.com/${MOD_REGISTRY_REPO}/main/index.json`;
const MOD_CATALOG_URL = `https://raw.githubusercontent.com/${MOD_REGISTRY_REPO}/main/catalog.json`;
const MOD_REGISTRY_WEB = `https://github.com/${MOD_REGISTRY_REPO}`;
function modRegistryBase(id) {
  return `https://raw.githubusercontent.com/${MOD_REGISTRY_REPO}/main/mods/${id}/`;
}
const MOD_REGISTRY_RELEASE = "registry";
const MOD_REGISTRY_COUNTS_URL = `https://api.github.com/repos/${MOD_REGISTRY_REPO}/releases/tags/${MOD_REGISTRY_RELEASE}`;
function modCountUrl(id) {
  return `${MOD_REGISTRY_WEB}/releases/download/${MOD_REGISTRY_RELEASE}/${id}${MOD_FILE_EXT}`;
}
function modFileUrl(entry, file) {
  const base = entry.base || modRegistryBase(entry.id);
  return (base.endsWith("/") ? base : base + "/") + file;
}
function modSummaryFor(entry, details) {
  const { defs, sprites: _sprites, sounds: _sounds, ...summary } = entry;
  const buildings = defs.filter((d) => d.kind === "building").length;
  return { ...summary, units: defs.length - buildings, buildings, details };
}
function parseModCatalog(json) {
  let raw = json;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!isPlainObject(raw) || raw.format !== "steel-tide-mod-catalog" || raw.v !== 1 || !Array.isArray(raw.mods)) return null;
  const mods = [];
  for (const m of raw.mods) {
    if (!isPlainObject(m) || typeof m.details !== "string" || !m.details || typeof m.units !== "number" || !Number.isSafeInteger(m.units) || m.units < 0 || typeof m.buildings !== "number" || !Number.isSafeInteger(m.buildings) || m.buildings < 0) continue;
    const entry = parseModIndex({ format: "steel-tide-mod-index", mods: [m] })?.mods[0];
    if (entry) mods.push({ ...modSummaryFor(entry, m.details), units: m.units, buildings: m.buildings });
  }
  return { format: "steel-tide-mod-catalog", v: 1, generated: typeof raw.generated === "string" ? raw.generated : "", mods };
}
function parseModDetail(json, expected) {
  let raw = json;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!isPlainObject(raw) || raw.id !== expected.id || raw.version !== expected.version || !Array.isArray(raw.defs) || !Array.isArray(raw.sprites)) return null;
  return parseModIndex({ format: "steel-tide-mod-index", mods: [raw] })?.mods[0] ?? null;
}
function indexEntryFor(mod, path, base, extra = {}) {
  const r = resolveMod(mod);
  const sizes = extra.sizes ?? {};
  const screenshots = (mod.screenshots ?? []).filter((f) => sizes[f]).map((f) => ({ file: f, w: sizes[f].w, h: sizes[f].h }));
  return {
    id: mod.id,
    name: contentText(mod.name, mod.id),
    version: mod.version,
    ...mod.author ? { author: mod.author } : {},
    description: contentText(mod.description, ""),
    ...mod.license ? { license: mod.license } : {},
    ...mod.homepage ? { homepage: mod.homepage } : {},
    ...mod.minGame ? { minGame: mod.minGame } : {},
    path,
    base,
    ...extra.updated ? { updated: extra.updated } : {},
    ...extra.downloads !== void 0 ? { downloads: extra.downloads } : {},
    ...screenshots.length > 0 ? { screenshots } : {},
    ...extra.maps?.length ? { maps: extra.maps } : {},
    defs: r.defs.map((d) => {
      const own = mod.defs.find((x) => x.id === d.id);
      return {
        id: d.id,
        kind: d.kind,
        domain: d.domain,
        tier: d.tier,
        cost: d.cost,
        name: contentText(own?.name, d.id),
        sprite: d.sprite,
        ...d.turretSprite ? { turretSprite: d.turretSprite } : {},
        ...own?.extends ? { extends: own.extends } : {}
      };
    }),
    sprites: (mod.sprites ?? []).map((s) => ({
      key: s.key,
      file: s.file,
      frames: s.frames ?? 1,
      ...s.rotated ? { rotated: true } : {},
      ...sizes[s.file] ? { w: sizes[s.file].w, h: sizes[s.file].h } : {}
    })),
    ...mod.sounds?.length ? { sounds: mod.sounds.map((s) => ({ key: s.key, file: s.file })) } : {}
  };
}
function parseModIndex(json) {
  let raw = json;
  if (typeof json === "string") {
    try {
      raw = JSON.parse(json);
    } catch {
      return null;
    }
  }
  if (!isPlainObject(raw) || raw.format !== "steel-tide-mod-index" || !Array.isArray(raw.mods)) return null;
  const mods = [];
  for (const m of raw.mods) {
    if (!isPlainObject(m) || typeof m.id !== "string" || !ID_RE.test(m.id) || typeof m.version !== "string" || typeof m.base !== "string") continue;
    mods.push({
      id: m.id,
      name: contentText(m.name, m.id),
      version: m.version,
      ...typeof m.author === "string" ? { author: m.author } : {},
      description: contentText(m.description, ""),
      ...typeof m.license === "string" ? { license: m.license } : {},
      ...typeof m.homepage === "string" ? { homepage: m.homepage } : {},
      ...typeof m.minGame === "string" ? { minGame: m.minGame } : {},
      path: typeof m.path === "string" ? m.path : `mods/${m.id}`,
      base: m.base,
      ...typeof m.updated === "string" ? { updated: m.updated } : {},
      ...typeof m.downloads === "number" && m.downloads >= 0 ? { downloads: Math.floor(m.downloads) } : {},
      ...Array.isArray(m.screenshots) ? {
        screenshots: m.screenshots.filter((x) => isPlainObject(x) && typeof x.file === "string" && typeof x.w === "number" && typeof x.h === "number" && x.w > 0 && x.h > 0)
      } : {},
      ...Array.isArray(m.maps) ? {
        maps: m.maps.filter((x) => isPlainObject(x) && typeof x.file === "string" && typeof x.name === "string" && typeof x.w === "number" && typeof x.h === "number" && typeof x.spawns === "number")
      } : {},
      defs: Array.isArray(m.defs) ? m.defs.filter((d) => isPlainObject(d) && typeof d.id === "string") : [],
      sprites: Array.isArray(m.sprites) ? m.sprites.filter((s) => isPlainObject(s) && typeof s.key === "string") : [],
      ...Array.isArray(m.sounds) ? { sounds: m.sounds.filter((s) => isPlainObject(s) && typeof s.key === "string" && typeof s.file === "string") } : {}
    });
  }
  return { format: "steel-tide-mod-index", v: 1, generated: typeof raw.generated === "string" ? raw.generated : "", mods };
}
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
registerContentSchema(readExtensions, validateExtensionReferences, checkExtensionPackages);
const VANILLA_DEFS = DEFS;
function typeLabel(spec) {
  switch (spec.type) {
    case "enum":
      return spec.values.join(" | ");
    case "enums":
      return `(${spec.values.join(" | ")})[]`;
    case "text":
      return "text";
    case "number":
    case "int": {
      const range = spec.min !== void 0 || spec.max !== void 0 ? ` ${spec.min ?? ""}–${spec.max ?? ""}` : "";
      return (spec.type === "int" ? "integer" : "number") + range;
    }
    case "id":
      return "id";
    case "ids":
      return "id[]";
    case "strings":
      return "string[]";
    case "images":
      return "path[]";
    case "targets":
      return "(ground | ship | sub | air)[]";
    case "mult":
      return "{ armour: number }";
    case "directionalArmor":
      return "{ front, side, rear }";
    case "body":
      return "{ r, len }";
    case "pair":
      return "[x, y]";
    case "quad":
      return "[x0, y0, x1, y1]";
    case "bool":
      return "boolean";
    case "weapons":
      return "weapon[]";
    case "decals":
      return "decal[]";
    case "mounts":
      return "mount[]";
    case "defs":
      return "def[]";
    case "factions":
      return "faction[]";
    case "terrains":
      return "terrain[]";
    case "cityTerrain":
      return "{ roof, wall, window, lamp, roofTexture, wallTexture, groundTexture, signTexture, accent, accent2, architecture }";
    case "cityArchitecture":
      return "{ forms, minStoreys, maxStoreys, coverage, greenery, equipment, facade }";
    case "sprites":
      return "sheet[]";
    case "sounds":
      return "sound[]";
    case "menuBackground":
      return "{ cuts, queue }";
    case "menuCuts":
      return "cut[]";
    case "menuQueue":
      return "cut id[]";
    case "menuCamera":
      return "{ tx, ty, zoom }";
    case "menuOrders":
      return "{ owner, tx, ty }[]";
    case "music":
      return "{ tracks, menu, setup, battle }";
    case "musicTracks":
      return "track[]";
    case "musicQueue":
      return "track id[]";
    case "files":
      return "{ path: dataURL }";
    case "rules":
      return "rule[]";
    case "shield":
      return "{ hp, regen, delay }";
    case "wing":
      return "{ unit, count, rebuild, sortie, rearm, range }";
    case "look":
      return "look";
    case "anims":
      return "{ moving, idle, firing }";
    case "barrels":
      return "[left, top, right, bottom][]";
    case "cond":
      return "condition";
    case "effects":
      return "effect | effect[]";
    case "button":
      return "button";
    case "spawn":
      return "{ unit, count, side, into, max }";
    case "buff":
      return "{ speed, damage, reload, taken, for }";
    case "explode":
      return "{ dmg, radius, cls, friendlyFire }";
    case "beam":
      return "{ color, width, style, life }";
    case "range":
      return "[first, last] or [first, last, fps]";
    case "near":
      return "{ units, kind, side, within, count }";
    case "extensions":
      return "{ capability: configuration }";
    case "capabilities":
      return "capability id[]";
    case "extensionPackages":
      return "{ id, version, api, capabilities, schema, runtime, presentation? }[]";
    default:
      return "string";
  }
}
function fieldRows(table, lang2 = "en") {
  const i = lang2 === "zh" ? 1 : 0;
  return FIELD_SPECS[table].map((spec) => ({
    name: spec.name,
    type: typeLabel(spec),
    required: spec.required === true ? lang2 === "zh" ? "必填" : "yes" : spec.required ? lang2 === "zh" ? `${spec.required === "unit" ? "单位" : "建筑"}必填` : `${spec.required}s` : spec.only ? lang2 === "zh" ? `仅${spec.only === "unit" ? "单位" : "建筑"}` : `${spec.only}s only` : "",
    default: spec.def ?? "",
    doc: spec.doc[i]
  }));
}
function markdownTable(rows) {
  const esc = (s) => s.replace(/\|/g, "\\|");
  const lines = ["| field | type | required | default | meaning |", "| --- | --- | --- | --- | --- |"];
  for (const r of rows) lines.push(`| \`${r.name}\` | ${esc(r.type)} | ${esc(r.required)} | ${esc(r.default)} | ${esc(r.doc)} |`);
  return lines.join("\n");
}
function rosterLines() {
  const out = [];
  const by = (kind, domain) => Object.values(DEFS).filter((d) => d.kind === kind && (domain === void 0 || d.domain === domain) && !d.warhead).map((d) => `${d.id} (T${d.tier}, ${d.cost}${d.upgradeOnly ? ", upgrade level" : ""})`);
  out.push(`ground units: ${by("unit", "ground").join(", ")}`);
  out.push(`ships: ${by("unit", "ship").join(", ")}`);
  out.push(`amphibious units: ${by("unit", "amphibious").join(", ")}`);
  out.push(`aircraft: ${by("unit", "air").join(", ")}`);
  out.push(`buildings: ${by("building").join(", ")}`);
  return out;
}
function exampleMinimal() {
  return {
    format: MOD_FORMAT,
    v: MOD_FORMAT_VERSION,
    id: "bison-ii",
    name: ["Bison II", "野牛 II"],
    version: "1.0.0",
    author: "you",
    description: ["A heavier Bison for the late game.", "后期用的重型野牛。"],
    defs: [
      {
        id: "bison2",
        extends: "mbt",
        name: ["Bison II", "野牛 II"],
        desc: ["Thicker plate, a bigger gun, and a bigger bill.", "更厚的装甲、更大的炮，也更贵。"],
        tier: 3,
        cost: 520,
        hp: 1100,
        speed: 52,
        requires: ["radar"],
        weapons: [{ id: "cannon", cls: "cannon", dmg: 90, reload: 2, range: 5, splash: 12, turret: true, muzzleOffset: 23 }],
        aiWeight: 2
      }
    ]
  };
}
function exampleFull() {
  return {
    format: MOD_FORMAT,
    v: MOD_FORMAT_VERSION,
    id: "ironworks",
    name: ["Ironworks", "铁工厂"],
    version: "1.0.0",
    author: "you",
    description: ["A hover tank, a bunker and a fusion plant.", "一辆悬浮坦克、一座碉堡和一座聚变电站。"],
    license: "CC-BY-4.0",
    defs: [
      {
        id: "ironworks-hover",
        name: ["Skimmer Hover Tank", "掠行悬浮坦克"],
        desc: ["Fast, thin-skinned, rockets.", "快、皮薄、打火箭。"],
        kind: "unit",
        domain: "ground",
        tier: 2,
        cost: 260,
        hp: 320,
        armor: "light",
        speed: 110,
        turnRate: 5,
        radius: 9,
        body: { r: 10, len: 10 },
        trail: "tire",
        weapons: [{ id: "pods", cls: "rocket", dmg: 16, reload: 2.2, range: 4.5, burst: 4, burstDelay: 0.1, splash: 10, spread: 14 }],
        producedBy: ["factory2", "factory3"],
        aiWeight: 1
      },
      {
        id: "ironworks-bunker",
        name: ["Bunker", "碉堡"],
        desc: ["A gun pit that takes a beating.", "扛打的火力点。"],
        kind: "building",
        cost: 380,
        hp: 1600,
        fw: 2,
        fh: 2,
        power: -3,
        vision: 8,
        weapons: [{ id: "gun", cls: "autocannon", dmg: 22, reload: 0.5, range: 5, turret: false, targets: ["ground", "ship"] }]
      },
      {
        id: "ironworks-fusion",
        name: ["Fusion Plant", "聚变电站"],
        desc: ["The plant line's fourth level.", "发电厂线的第四级。"],
        extends: "power3",
        upgradeOf: "power3",
        cost: 2200,
        hp: 2600,
        power: 500,
        upgradeCost: 1100,
        upgradeTime: 60,
        requires: ["radar", "reactor"]
      }
    ],
    sprites: [
      { key: "u.ironworks-hover", file: "sprites/u.ironworks-hover.png", frames: 1, rotated: true, fw: 24, fh: 26 },
      { key: "u.ironworks-bunker", file: "sprites/u.ironworks-bunker.png", frames: 1 }
    ],
    screenshots: ["screenshots/skimmers.png"]
  };
}
function agentPrompt() {
  const lines = [];
  const p = (s = "") => {
    lines.push(s);
  };
  p("# Making a Steel Tide mod: a brief for a coding agent");
  p();
  p("You are helping make a mod for Steel Tide (https://steelti.de), a browser real-time strategy game.");
  p("A mod adds units, buildings and upgrade levels, and gives them behaviour of their own — forms they turn into, units they spawn, buttons on their cards, planes they carry, weapons that look like nothing in the game (see Behaviour). It cannot change the game's rules, its interface, or an existing unit or building: it only adds, and everything it adds is switched off with it.");
  p("Read this whole brief once, then work from the tables. When in doubt, prefer the smallest mod that plays.");
  p();
  p("## What a mod is");
  p();
  p("A folder:");
  p();
  p("```");
  p("my-mod/");
  p("  mod.json          the manifest: the mod's identity, its defs, and the sheets they draw with");
  p("  sprites/*.png     optional art (a def without any is drawn as a plain placeholder)");
  p("  screenshots/*.png the mod in play, 4:3 (the registry asks for at least one; see Publish)");
  p("  maps/*.steel-tide-map  optional maps from the Scenario Editor, offered in the setup screens while the mod is on (see Maps)");
  p("  README.md         optional");
  p("```");
  p();
  p(`Published mods live in ${MOD_REGISTRY_WEB} under \`mods/<id>/\`; the game lists that registry under Settings → Mods, and the website at https://steelti.de/mods.`);
  p();
  p("## The manifest, minimal");
  p();
  p("One vanilla unit copied and re-tuned. `extends` inherits everything (art, weapons, where it is built) and every field you name overrides it:");
  p();
  p("```json");
  p(JSON.stringify(exampleMinimal(), null, 2));
  p("```");
  p();
  p("## The manifest, deeper");
  p();
  p("Own art, a defended building, and a fourth level for a vanilla building line:");
  p();
  p("```json");
  p(JSON.stringify(exampleFull(), null, 2));
  p("```");
  p();
  p("## Fields");
  p();
  p("Unknown ordinary fields produce a warning. Each extension package defines and validates its own configuration. Numbers outside the stated range are errors.");
  p();
  p("### mod.json (top level)");
  p();
  p(markdownTable(fieldRows("manifest")));
  p();
  p(`\`name\`, \`description\` and every \`desc\`/\`name\` on a def are *text*: a string (used for every language), \`["English", "中文", "한국어"]\` in that order, or \`{ ${LANGS.map((l) => `"${l}": "…"`).join(", ")} }\`. Only English is required; a language left out reads as English.`);
  p();
  p(`Capacity is an installation-time declaration. Omit it for the existing ordinary limits, or set \`capacity: "large"\` in format 4 for ${LARGE_CONTENT_LIMITS.defs} definitions and entries per production/build/reference list (ordinary lists allow 64), ${LARGE_CONTENT_LIMITS.sprites} sheets, ${LARGE_CONTENT_LIMITS.sounds} sounds, ${LARGE_CONTENT_LIMITS.manifestBytes / 1048576} MiB of metadata and ${LARGE_CONTENT_LIMITS.filesBytes / 1048576} MiB of stored data URLs. Large packs allow ${LARGE_CONTENT_LIMITS.hp} HP per definition and ${LARGE_CONTENT_LIMITS.extensionSourceBytes / 1048576} MiB per executable module; their combined source and configuration must still fit the metadata budget. All path, identity, reference and adds-only checks still apply. Budgets do not preallocate runtime memory. Ordinary multiplayer transfers manifests; players install the asset bytes locally.`);
  p();
  p("### Extension packages (format 4)");
  p();
  p("Format 4 packs carry their own `extensionPackages`: versioned, SHA-256 verified schema, simulation and optional presentation code. Extension source, build steps, tests and documentation belong to the mod that owns them; its manifest embeds the executable package. Each mod can define its own namespaced capability IDs and configuration without a shared gameplay package or an engine catalog. The engine provides host API version " + EXTENSION_HOST_VERSION + " and retains compatible older package APIs. Declare package-provided IDs in `requiredCapabilities`, then put their data under `extensions[id]`. Only content which requests extensions prepares the optional host. Extension code is executable trusted code, not sandboxed data.");
  p("Executable packages require `v:4`. Formats 1 and 2 and ordinary format 3 data remain supported; former built-in capability packs need compatible implementations embedded in format 4. A missing/unsupported capability rejects activation. Vanilla keeps its ordinary simulation; optional state and update work belong to the enabled match. Package schemas own their accepted fields, bounds, defaults and localization requirements.");
  p(`A package may declare \`assets: { resourceId: "relative/file.wav" }\` (up to ${STANDARD_CONTENT_LIMITS.extensionAssets} entries, or ${LARGE_CONTENT_LIMITS.extensionAssets} with large capacity). These files travel with the ordinary folder, packed file and world; the existing total asset-size limit applies. Its schema receives only its own \`assetIds\`; its browser factory receives \`asset(id)\` to resolve installed bytes without fetching arbitrary URLs. Optional \`feedback(context, base)\` selects local voice behavior once at match entry and returns \`unitVoice\` plus an optional \`dispose\`. Use the host recording mixer and scoped music queues, release package recordings and music scopes on disposal, and reuse native rendering/recoil where suitable. Gameplay-specific recording choices and cosmetic predicates belong to the mod.`);
  p();
  p(`Read the [extension framework guide](${MOD_REGISTRY_WEB}/blob/main/docs/EXTENSION-FRAMEWORK.md) for the generic package contract, lifecycle, host SDK and trust model. Gameplay behavior and configuration are documented inside the mod that supplies the package.`);
  p();
  p("For locally chosen content, game/API consumers must `await prepareContentSchema(raw, true)` before synchronously calling `parseDefinitionPack(raw)` or `parseMod(raw)` on capability-bearing content; await `prepareContentCapabilities(packs)` before opening a match. For a world, prepare its embedded packs by passing the raw world to `prepareContentSchema`. Registry tooling likewise explicitly approves local files. Network inputs use `prepareContentSchema(raw)` and cannot approve unknown code. Read the extension framework guide in the mod repository for package ownership, trust and SDK details. Never ignore a schema or capability loading failure.");
  p();
  p("The shared inspection model exposes private state and available actions only to authorized viewers. Actions go through `contentAction` and the ordinary commands/orders gateway. The CLI exposes the same interface with `steel content-action <units> <module> <action> [--choice id] [--target id] [--at x,y]`. Port only source combinations the contract represents faithfully; omit and document unsupported behavior.");
  p();
  p("### A faction (`factions[]`, format 2)");
  p();
  p(markdownTable(fieldRows("faction")));
  p();
  p("A faction is selected per seat in Conquest and Breakthrough. It changes the headquarters, starting builders and allowed build/production roster; teams and victory rules still belong to the match. The chooser is hidden with only Steel Tide available. The HQ must produce its builder, and that builder must rebuild its HQ. Both must belong to this mod. A starting HQ has no prerequisites; its builder may require only that HQ. Roster building prerequisites must also be in the roster. Format 1 mods continue to work unchanged.");
  p();
  p("### A terrain variant (`terrains[]`)");
  p();
  p(markdownTable(fieldRows("terrain")));
  p();
  p('Terrain variants add map-selected appearances without changing terrain numbers, movement, construction, cover or city destruction. Enabling a mod alone never repaints a vanilla map. A map opts in with `"terrainVariants": { "city": "my-mod-city" }`; the editor preserves these bindings in saves and exports. Missing or disabled content renders the ordinary base terrain, even when old images remain cached. A terrain-only pack uses `"defs": []`.');
  p();
  p("Terrain materials are single-frame, square sheets named `ter.<mod id>-<name>`, declared in `sprites` with equal whole `fw` and `fh` (4–512; 128 recommended). `teams`, `stripBg`, `rotated`, `fitFootprint` and `freezeStatic` are false; their false defaults preserve the image. Anchors, mounts, animation states/regions and pivots are not supported. Keep flat materials opaque and seamless, without painted buildings, text, cast shadows or transparent cutouts. `city.signTexture` may instead contain sign artwork. A variant can reference only terrain sheets in its own pack.");
  p();
  p("#### City appearance (`terrains[].city`)");
  p();
  p(markdownTable(fieldRows("cityTerrain")));
  p();
  p("A city variant supplies colors, materials or a visual architecture kit while preserving city tile collision, cover and destruction rules. Without `architecture`, city geometry stays exactly ordinary. Flat base terrains require `texture`; cities instead use `roofTexture`, `wallTexture` and `groundTexture`, with `signTexture` for architectural signs. Unsupported bases such as water, forest and cliffs cannot be declared as flat material variants.");
  p();
  p("#### City architecture (`terrains[].city.architecture`)");
  p();
  p(markdownTable(fieldRows("cityArchitecture")));
  p();
  p("The optional kit changes visible building forms, storeys, lot coverage, planting, rooftop equipment and facade treatment. It never changes terrain height, passability or combat. `forms` lists distinct supported forms. Storey bounds use the documented defaults when omitted and must satisfy `minStoreys <= maxStoreys`. The existing damage states still control collapsed buildings and extinguished signs.");
  p();
  p("`signTexture` is a 4×4 atlas of 16 square signs in row-major order; a building’s deterministic seed selects one cell. Use equal `fw`/`fh` divisible by 4 (128 recommended), with dark unlit backing and bright lettering or symbols. Pixels whose strongest RGB channel exceeds 120 emit their own color at night. The image is one frame, not a horizontal 16-frame animation strip. Missing sign artwork uses procedural glyphs.");
  p();
  p("### A def (`defs[]`)");
  p();
  p(markdownTable(fieldRows("def")));
  p();
  p('Defaults when `extends` is absent: a unit is `domain: "ground"`, `tier: 1`, `pop: 1`, `speed: 60`, `turnRate: 3.5`, `vision: 8`, `radius: 9`, no `body` (units part on the circle of `radius`), armour by domain (ground and amphibious `medium`, ship `ship`, air `air`), a tread trail on land (`trail: "none"` for a unit on foot, which is then not heard rolling either) and a wake at sea; a building is `fw: 2, fh: 2`, `armor: "structure"`, `power: 0`, `pop: 0`. `buildTime` defaults to cost ÷ 14 seconds.');
  p("Where a unit is built when `producedBy` is absent: its domain's line from its tier up (" + ["ground", "ship", "air", "amphibious"].map((d) => `${d}: ${[1, 2, 3].map((t) => `T${t} → ${defaultProducers(d, t).join("+")}`).join(", ")}`).join("; ") + ").");
  p("An `upgradeOf` def becomes upgrade-only (never placed directly): the named building gains an Upgrade button that turns it into this def, at `upgradeCost` over `upgradeTime`. A building may have only one next level, so `upgradeOf` can name a vanilla building at the end of its line (`power3`, `factory3`, `extractor3`, `gatling`, `cannonturret2`, `samsite`, `interceptor2`, `radar`, `repairtower`, `reactor`, `nukesilo`) or one of this mod's.");
  p();
  p("### A weapon (`defs[].weapons[]`)");
  p();
  p(markdownTable(fieldRows("weapon")));
  p();
  p("The damage a weapon does is `dmg × the armour matrix cell for (cls, target armour)`, with `mult` overriding single cells. The matrix:");
  p();
  p("```");
  for (const [cls, row] of Object.entries(ARMOR_MATRIX)) p(`${cls.padEnd(11)} ${Object.entries(row).map(([a, m]) => `${a} ×${m}`).join("  ")}`);
  p("```");
  p();
  p("### A decal (`defs[].decals[]`)");
  p();
  p(markdownTable(fieldRows("decal")));
  p();
  p(`A decal is a picture laid on a def besides its body and its turret — a hatch, a crew figure, an outline, a lamp — fixed to the hull or the turret (\`on\`) and turned with it. Up to ${MAX_DEF_DECALS} on a def, drawn in the order listed within a layer. \`x\`/\`y\` are a point on that part's up-facing art: right and down (toward the tail) of its pivot, in the px of the sheet at its \`fw\`×\`fh\` size; the game scales them with the unit. The sheet is one of the mod's own under a \`dec.<name>\` key (see Art), or a body or turret key it borrows. A \`night\` decal is a lamp: laid over the dark rather than dimmed by it, so a headlight or a lit window reads as light, and a unit that carries one gets none of the game's own headlights. Paint a beam soft — a wide, faint falloff, not a hard-edged triangle — or it reads as glass.`);
  p();
  p("### A turret mount (`defs[].turretMounts[]`)");
  p();
  p(markdownTable(fieldRows("mount")));
  p();
  p(`A hull with more than one gun — a battleship's turrets fore and aft, a tank with a turret at each corner — names a ring for each, up to ${MAX_DEF_MOUNTS}: the def's one \`turretSprite\` is drawn on every ring, and every ring is trained on the one target the unit is aiming at, as far round as its own \`arc\` of its \`rest\` bearing goes, so a gun the superstructure blocks waits at its stop while the others fire. A burst walks the rings that bear (the first shot from the first of them, the next from the next), and \`muzzleOffset\` is measured from the ring a shot leaves, so give a weapon of several guns a \`burst\` of that many. \`x\`/\`y\` are a point on the body's up-facing art, as a decal's are. A def with none has one ring, where its body sheet's \`mount\` puts it.`);
  p();
  p("### A sheet (`sprites[]`)");
  p();
  p(markdownTable(fieldRows("sprite")));
  p();
  p("Barrel recoil is available to any definition with a rotating turret: put `recoil: 2` on its turret weapon (stroke in art pixels) and `barrels: [[0.4, 0, 0.6, 0.45]]` on its turret sheet. Rectangles use 0–1 fractions of the up-facing source frame, must have positive area and must not overlap. Keep stationary mantlets outside them. For several barrels, list rectangles in the same order as `muzzlePoints`, or left to right when using `bores`/`boreSpacing`. Each firing mount and barrel recoils independently; custom or hidden muzzle flashes work too. Inherited art keeps its barrel regions; custom art supplies its own. Recoil changes no combat statistic.");
  p();
  p("### Home menu background (`menuBackground`)");
  p();
  for (const section of ["menuBackground", "menuCut", "menuCamera", "menuOrder"]) {
    p(markdownTable(fieldRows(section)));
    p();
  }
  p("Supply a nonempty queue to replace the home-menu reel. It repeats in listed order from a random starting cut, 13 seconds per cut, with the usual camera drift and fades. Mix original IDs with your own, or use only your own. The last active pack with usable cuts wins; disabling it restores the previous reel. A background-only pack may use `defs: []`. A custom cut names a file in `maps`, with its placed units and buildings; every owner needs a spawn, and every camera/order point must be inside the map. Each spawn is a separate side; no AI, default bases or scenario triggers run. Place generators to power the forces. Optional opening orders attack-move all mobile units belonging to the named owner. Missing or invalid cuts are skipped; an unusable queue keeps the previous reel. Reduced motion keeps the still background.");
  p();
  p("### Background music (`music`)");
  p();
  p(markdownTable(fieldRows("music")));
  p();
  p(markdownTable(fieldRows("musicTrack")));
  p();
  p("Each supplied queue replaces that slot, plays in listed order and repeats, keeping the normal gaps, music volume and pause behavior. Keep built-in IDs to mix original tracks with your own; use only your own IDs for a complete replacement. Omitted queues keep the previous selection; an empty queue silences the slot. The last active pack supplying a slot wins. Disabling it restores the preceding pack or the original shuffle. A music-only pack uses `defs: []`. Victory and defeat remain unchanged. Tracks travel with the other mod assets, within the existing total asset limit.");
  p();
  p("Built-in music IDs by original slot: " + Object.entries(MUSIC_FILES).map(([slot, ids]) => `${slot}: ${ids.join(", ")}`).join("; ") + ". Any of these IDs may appear in a custom queue; an unshipped file is skipped.");
  p();
  p("### A sound (`sounds[]`)");
  p();
  p(markdownTable(fieldRows("sound")));
  p();
  p("A weapon fires with the game's sound for its class unless its `sound` names one of these keys. A recording is a dry, close-miked one-shot under a second with no reverb tail; the engine attenuates and pans it by distance, and forty overlapping echoes turn to mud. Mono MP3 is the safe format.");
  p();
  behaviourSection(p);
  p();
  p("## Maps");
  p();
  p(`A mod may carry maps: files the game's Scenario Editor exports (\`${CUSTOM_MAP_EXT}\`), named under \`maps\` in mod.json, up to ${MAX_MOD_MAPS} of them and each under ${MAX_MOD_MAP_BYTES / 1024} KB. While the mod is on, the Conquest setup and the lobby offer them as cards beside the player's own map; choosing one plays it exactly as painted. A map may stand the mod's own units and buildings before the whistle: with the mod on, they are in the editor's forces palette, and the map reads on any game that has the mod (the registry checks it against the mod's own defs, not the vanilla roster). A scene laid this way — a base built up, a horde at the gate — is how a mod shows what it is without a word.`);
  p();
  p("## Units of measure");
  p();
  p("- A tile is 32 world pixels. `speed` and projectile `speed` are world px/s; `range`, `minRange`, `vision`, `sonar`, `stealth`, `detect`, `repairRange` and `interceptRange` are tiles; `radius`, `body.r`, `body.len`, `splash`, `spread`, `muzzleOffset` are world px.");
  p("- Times are seconds: `buildTime`, `reload`, `burstDelay`, `upgradeTime`, `interceptReload`, `nukeTime`.");
  p("- For scale: the Bison main battle tank is cost 280, hp 620, speed 60, radius 10, body `{ r: 13, len: 12 }`, a cannon of dmg 60 every 1.8 s at range 4.6; a scout car is cost 60, hp 150, speed 120; a war factory is 3×3 tiles, hp 1500, power −8.");
  p();
  p("## Art");
  p();
  p('- Keys: a def\'s body is `u.<id>`, a rotating turret `tur.<id>`. A def with no sheet of its own may borrow vanilla art by naming a vanilla key in `sprite` (e.g. `"sprite": "u.mbt", "turretSprite": "tur.mbt"`); with `extends` it inherits the base\'s art. A mod may not replace vanilla art.');
  p("- A sheet is one PNG (WebP and JPEG are accepted): `frames` animation frames left to right in one horizontal strip, evenly spaced, no gaps, no borders.");
  p('- Hulls, turrets and everything that turns: draw ONE image facing UP and set `"rotated": true`; the game bakes the 24 headings. `fw`/`fh` are the in-game size of that up-facing image in world px (a tank hull is about 24×24; the image itself may be any resolution, 2–4× is best). `pivotX`/`pivotY` put the pivot on the turret ring (default centre).');
  p("- Buildings: one strip of frames, not rotated, drawn with a slight top-down southern tilt. The footprint is the bottom `fw×32` by `fh×32` px of the frame; anything above overhangs the terrain behind (towers, masts). Width, height and anchor are sized from the def's footprint automatically.");
  p('- A building with a gun that turns is two sheets like a hull and turret: the body with an empty ring and `"mount": [fx, fy]` saying where the ring sits as fractions of the frame, and a `tur.<id>` sheet for the gun; its weapons carry `"turret": true`.');
  p("- Several guns of one kind on one hull are one `tur.<id>` sheet and a `turretMounts` ring for each, not guns painted on the body: a painted gun never turns.");
  p("- A decal's sheet (`dec.<name>`) is drawn like a turret's: one up-facing image, or a strip of `frames` at `fps` for something that moves (a spinning barrel, a blinking light), sized by `fw`/`fh` and drawn about its centre. Static detail belongs in the body's own sheet; a decal is for what the body cannot hold — a part that turns with the turret, a hatch the barrel sweeps over, a light that comes on at night, a barrel that spins while it fires.");
  p("- Faction colour: paint team-coloured parts in pure magenta (highlight #FF66FF, base #FF00FF, shadow #990099) and use magenta nowhere else; the game recolours it per player.");
  p("- Style: crisp pixel art, hard edges, no anti-aliasing, a muted military palette (DawnBringer-32), dark #222034 outlines. Generated sheets are cleaned automatically (background removal, frame registration), but a transparent background is best.");
  p();
  p("## The vanilla roster (ids you may `extends`, name in `producedBy`/`builtBy`/`requires`/`upgradeOf`, or borrow art from)");
  p();
  for (const line of rosterLines()) p(`- ${line}`);
  p();
  p("## Test");
  p();
  p("1. Validate: in a clone of the registry, `node tools/check.mjs path/to/my-mod` prints every error with its path into mod.json. (No clone? The game says the same things when the mod is loaded.)");
  p("2. Load it in the game: Settings → Mods → *Open folder…* (Chrome keeps the folder open, so *Reload* re-reads your edits) or *Upload file…* (a zip of the folder, or a `.steel-tide-mod` file). Errors are listed on the spot; a loaded mod says how many units and buildings it added.");
  p("3. Play: start a Conquest match. Your units are in the factory's production list from the level you gave them; buildings are in the engineer's build menu; an upgrade level is on its building's Upgrade button. The console (backquote) has `give <id>` for anything. Network players need matching packs and support for their required host API.");
  p("4. From a static server: `npx serve --cors path/to/my-mod` then open `https://play.steelti.de/?mod=http://localhost:3000/`. Data-only mods refresh at boot. Executable packages require an explicit local install first, and changed package code needs an explicit reload.");
  p();
  p("## Publish");
  p();
  p(`1. Fork ${MOD_REGISTRY_WEB}, add your folder as \`mods/<id>/\` (the folder name is the mod's \`id\`), run \`node tools/check.mjs mods/<id>\`, open a pull request.`);
  p(`2. A published mod carries at least one screenshot of it in play, named under \`screenshots\` in mod.json: 4:3 (1600×1200 is a good size), at least ${MIN_SCREENSHOT_WIDTH} px wide, PNG, JPEG or WebP under ${MAX_SCREENSHOT_BYTES / 1048576} MB, up to ${MAX_MOD_SCREENSHOTS} of them. The game's Settings → Mods page and https://steelti.de/mods show them; the first is the mod's card. Take them in a match with the mod's units on screen (the console's \`give\` puts them there) and crop to 4:3.`);
  p("3. CI runs the same check on the whole registry: ids must be unique across every published mod, so prefix a generic word with your mod's id (`ironworks-bunker`, not `bunker`).");
  p("4. Once merged, the index is rebuilt and the mod appears in the game's registry list and at https://steelti.de/mods, where its installs are counted. Bump `version` for every change; the game offers the update.");
  p();
  p("## Rules");
  p();
  p("- A mod adds definitions and assets; it does not change vanilla defs, art, rules or interface. Music and menu-background queues are explicit exceptions: they select the soundtrack and backdrop without overwriting built-in tracks or cuts. Do not try to override a vanilla id or key; the validator refuses it.");
  p("- Keep it honest: a unit needs a counter. The armour matrix is how the game makes one; give a new weapon a class it belongs to rather than an override on every cell.");
  p("- A mod is published under the licence its manifest names (default CC-BY-4.0). Only ship art you have the right to.");
  return lines.join("\n") + "\n";
}
function behaviourSection(p) {
  p("## Behaviour");
  p();
  p(`A def may carry \`rules\`: things that happen to it — it turns into another of the mod's defs, spawns units, heals, pays, takes a buff, blows up — when something happens to it (\`on\`), when a condition comes true (\`when\`), on a clock (\`every\`), or when the player presses a button on its card (\`button\`). The words are a closed vocabulary, each one checked when the mod loads, so a rule can only do what the game already knows how to do safely; there is no scripting. Up to ${MAX_DEF_RULES} rules a def. Rules are never inherited through \`extends\`, and the game's own units have none.`);
  p();
  p("A tank that is a tree while it stands, and a tank again when it moves or fires — two defs, each turning into the other:");
  p();
  p("```json");
  p(JSON.stringify(exampleMirage(), null, 2));
  p("```");
  p();
  p("A hero that ranks itself up from its card — the same unit, a new form, paid as the work is done:");
  p();
  p("```json");
  p(JSON.stringify(exampleHero(), null, 2));
  p("```");
  p();
  p("### A rule (`defs[].rules[]`)");
  p();
  p(markdownTable(fieldRows("rule")));
  p();
  p("Exactly one trigger. A `when` runs the moment its condition becomes true and not again until it has been false; one held back by its `if` or its `cooldown` tries again while the condition still holds. An `every` counts from the unit's making or its last change of form. Conditions are looked at ten times a second; events are answered on the tick they happen. A rule's `do` runs in order and stops at a change of form: what came after belonged to the old one.");
  p();
  p("### Conditions (`when`, `if`)");
  p();
  p(markdownTable(fieldRows("cond")));
  p();
  p("Every key given must hold; `any` and `not` say otherwise. A misspelt condition is an error, not a condition that always holds.");
  p();
  p("### Near (`when.near`)");
  p();
  p(markdownTable(fieldRows("near")));
  p();
  p('What stands near the unit, measured to the other\'s edge: a flyer that takes off only with something to hook onto (`{ "kind": "building", "within": 8 }`), troops that fight harder beside their commander (`{ "units": ["mymod-captain"], "side": "friend", "within": 10 }`), a wall that wakes when its master comes by. Name `units`, a `kind`, or both; an enemy is counted only when its side can see it.');
  p();
  p("### Effects (`do`)");
  p();
  p(markdownTable(fieldRows("effect")));
  p();
  p("### A spawn (`do.spawn`)");
  p();
  p(markdownTable(fieldRows("spawn")));
  p();
  p('A spawn never takes a side past its population cap or a def past its `limit`: it puts down what fits and no more. Spawned units are ordinary units of their side, standing where they were put down; a spawned unit\'s own `created` rules run too. `side: "killer"` on a `destroyed` rule is the dead rising for whoever killed them.');
  p();
  p("### A button (`rule.button`)");
  p();
  p(markdownTable(fieldRows("button")));
  p();
  p("The button is a tile on the unit's card, pressed on every selected unit of that def free to take it. It starts on the production rule — three quarters of the price in hand — and is paid as the work is done; while it runs the tile wears its progress, and pressing it again stops it and gives back what it had cost. It waits while what it `requires` is down. A button whose `do` changes the unit's form is labelled with the form unless it has a `name`; any other button needs one.");
  p();
  p("### A change of form (`do.morph`)");
  p();
  p('The unit becomes another def of the same mod in place: the same unit, its side, where it stands and faces, its kills and veteran rank, its flags, the selection and the groups it is in; its health keeps its share of the whole, its guns carry on from where they were in their reload, and it keeps whatever orders the new form can carry out — a move, an attack. A unit turns only into a unit, and a building only into a building of the same footprint. The change is refused, and nothing happens, while the unit is being carried, while its hold holds more than the new form can, while its line or its magazine has work the new form cannot take over, or where the new form cannot stand (a boat on dry land). A form that nothing builds says `"producedBy": []`; the loader expects that of a form and says nothing.');
  p();
  p("### A weapon's look (`weapons[].look`)");
  p();
  p(markdownTable(fieldRows("look")));
  p();
  p("A look is only what is seen: the round hits as the weapon's numbers say. A beam is the exception by its nature — the round goes at once, so it lands where the beam is drawn. A round's sheet (`prj.<name>`) is small art facing up with `rotated: true`, or a strip of `frames` played as it flies; an effect's sheet (`fx.<name>`) is a strip played once, not rotated.");
  p();
  p("### A shield (`shield`)");
  p();
  p(markdownTable(fieldRows("shield")));
  p();
  p("The shield takes harm before the hull, its bar drawn over the health bar, and shimmers round the hull when struck. `regen` on the def (not the shield) is the hull mending itself.");
  p();
  p("### A carrier's wing (`wing`)");
  p();
  p("A unit may carry planes of the mod's own — a carrier's drones, a destroyer's one anti-submarine plane, an airship's swarm — that fly out at what it fights and come back to it:");
  p();
  p("```json");
  p(JSON.stringify(exampleCarrier(), null, 2));
  p("```");
  p();
  p(markdownTable(fieldRows("wing")));
  p();
  p('The carrier comes with its planes aboard. While it has work — what its player sent it at, what its own guns are on, or else the nearest enemy its side can see within `range` that the planes can hit — a ready plane leaves the deck every third of a second. A plane comes back when the work is done, when it has been out `sortie` seconds, or when it is badly hurt, and waits `rearm` seconds aboard, mended as it waits, before it flies again; a lost one is made again every `rebuild` seconds, for nothing. A carrier with no guns of its own, sent at a target, closes to its wing\'s range and waits there. The planes are units of their side, with guns and kills of their own, but never the player\'s: they cannot be selected or ordered. A carrier lost takes the planes aboard with it; the ones out find another deck of their kind with room, or come down. The plane is an aircraft of the mod\'s own with `"pop": 0` and `"producedBy": []`: its carrier makes it, and nothing else does. A wing is never inherited through `extends`.');
  p();
  p("### Animation states (`sprites[].anims`)");
  p();
  p(markdownTable(fieldRows("anims")));
  p();
  p("On a unit's body sheet, the frames played by what it is doing instead of one loop: the `firing` range within a reload of its last shot, else the `moving` range while it moves, else `idle`. A sheet without `anims` rolls its frames while the unit moves and rests on the first, as treads do.");
}
function exampleCarrier() {
  return [
    {
      id: "mymod-drone",
      name: ["Strike Drone", "攻击无人机"],
      kind: "unit",
      domain: "air",
      cost: 60,
      hp: 80,
      pop: 0,
      speed: 200,
      producedBy: [],
      weapons: [{ id: "gun", cls: "mg", dmg: 8, reload: 0.5, range: 2.5, targets: ["ground", "ship"] }]
    },
    {
      id: "mymod-carrier",
      name: ["Light Carrier", "轻型航母"],
      extends: "destroyer",
      weapons: [],
      wing: { unit: "mymod-drone", count: 8, rebuild: 6, sortie: 12, rearm: 2, range: 12 }
    }
  ];
}
function exampleMirage() {
  return [
    {
      id: "mymod-mirage",
      name: ["Mirage Tank", "幻影坦克"],
      extends: "mbt",
      sprite: "u.mymod-mirage",
      rules: [{ when: { still: 1, quiet: 0.8 }, do: { morph: "mymod-mirage-tree" } }]
    },
    {
      id: "mymod-mirage-tree",
      name: ["Mirage Tank", "幻影坦克"],
      extends: "mymod-mirage",
      producedBy: [],
      untargetable: true,
      stealth: 3,
      rules: [{ when: { moving: true }, do: { morph: "mymod-mirage" } }, { on: "fired", do: { morph: "mymod-mirage" } }]
    }
  ];
}
function exampleHero() {
  return {
    id: "mymod-hero",
    name: ["Hero Tank", "英雄坦克"],
    extends: "mbt",
    limit: 3,
    rules: [
      { button: { cost: 600, time: 20, ai: true }, do: { morph: "mymod-hero-gunner" } },
      { button: { cost: 900, time: 30, requires: ["radar"] }, do: { morph: "mymod-hero-sniper" } },
      { every: 1, if: { hurtWithin: 0.5, hpBelow: 0.3 }, cooldown: 30, do: [{ buff: { taken: 0.5, for: 5 } }, { fx: "fx.repair" }] }
    ]
  };
}
function agentPromptFor(dir) {
  return `${agentPrompt()}
Work in \`${dir}\`. Write \`mod.json\` there, add any sheets under \`sprites/\`, and finish by running the check above.
`;
}
const REGISTRY = { repo: MOD_REGISTRY_REPO, web: MOD_REGISTRY_WEB };
function modTitle(mod, lang2 = "en") {
  return `${pick(contentText(mod.name, mod.id), lang2)} ${mod.version}`;
}
export {
  ARMOR_CLASSES,
  ARMOR_MATRIX,
  CUSTOM_MAP_EXT,
  DECAL_ANCHORS,
  DECAL_LAYERS,
  DECAL_WHENS,
  FIELD_SPECS,
  ID_RE,
  LARGE_CONTENT_LIMITS,
  MAX_CONTENT_INPUT_BYTES,
  MAX_DEF_DECALS,
  MAX_DEF_MOUNTS,
  MAX_HELLO_MODS,
  MAX_MANIFEST_BYTES,
  MAX_MOD_DEFS,
  MAX_MOD_FILES_BYTES,
  MAX_MOD_MAPS,
  MAX_MOD_MAP_BYTES,
  MAX_MOD_MUSIC_QUEUE,
  MAX_MOD_MUSIC_TRACKS,
  MAX_MOD_SCREENSHOTS,
  MAX_MOD_SOUNDS,
  MAX_MOD_SPRITES,
  MAX_MOD_TERRAINS,
  MAX_REQUIRED_MODS,
  MAX_SCREENSHOT_BYTES,
  MIN_SCREENSHOT_WIDTH,
  MOD_CATALOG_URL,
  MOD_FILE_EXT,
  MOD_FORMAT,
  MOD_FORMAT_VERSION,
  MOD_MANIFEST_NAME,
  MOD_REGISTRY_COUNTS_URL,
  MOD_REGISTRY_RELEASE,
  MOD_REGISTRY_REPO,
  MOD_REGISTRY_URL,
  MOD_REGISTRY_WEB,
  PROJECTILES,
  REGISTRY,
  SCREENSHOT_ASPECT,
  SCREENSHOT_ASPECT_TOLERANCE,
  SOUND_KEY_RE,
  STANDARD_CONTENT_LIMITS,
  TARGET_DOMAINS,
  TERRAIN_BASES,
  TRAILS,
  UNIT_DOMAINS,
  VANILLA_DEFS,
  VANILLA_IDS,
  VANILLA_SPRITE_KEYS,
  WEAPON_CLASSES,
  WEAPON_SOUNDS,
  activeContentStamps,
  activeDefinitions,
  activeContentStamps as activeModStamps,
  activeDefinitions as activeMods,
  activeTerrainVariants,
  agentPrompt,
  agentPromptFor,
  applyDefinitions,
  applyDefinitions as applyMods,
  checkScreenshot,
  compareVersions,
  contentFilesSize,
  contentLimits,
  contentName,
  contentOfDef,
  contentText,
  countDefs,
  defaultProducers,
  definitionFiles,
  exampleFull,
  exampleMinimal,
  fieldRows,
  imageSize,
  indexEntryFor,
  isContentStamp,
  isContentStamp as isModStamp,
  menuCutMapError,
  missingContent,
  missingContent as missingMods,
  modCountUrl,
  modFileUrl,
  definitionFiles as modFiles,
  contentName as modName,
  contentOfDef as modOfDef,
  modRegistryBase,
  modSummaryFor,
  contentText as modText,
  modTitle,
  onContentChanged,
  onContentChanged as onModsChanged,
  parseCustomMap,
  parseDefinitionPack,
  parseMod,
  parseModCatalog,
  parseModDetail,
  parseModIndex,
  prepareContentSchema,
  readTerrainAssignments,
  requiredContentOf,
  requiredContentOf as requiredModOf,
  resolveDefinitions,
  resolveMod,
  rosterLines,
  sameStamps,
  stampOf,
  terrainVariant
};

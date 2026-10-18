#!/usr/bin/env python3
"""Port Attack on Titan: The Rumbling (进击の巨人『地鸣』 1.443) from its Rusted Warfare package
into this Steel Tide mod.

Reads the unpacked package at ../../rusted-warfare-mods/进击の巨人『地鸣』1.443【公测】 (git-ignored),
converts the curated roster below into defs, composites the art into sheets — the Titans are
drawn from their parts at the keyframes of their own walk and strike — cuts the sounds to mono
MP3 one-shots, and writes mod.json.

  python3 mods/aot-rumbling/port-aot.py              # convert everything
  python3 mods/aot-rumbling/port-aot.py --dry        # print the conversion, write nothing
  python3 mods/aot-rumbling/port-aot.py --dry --art  # the art each def was cut from
  python3 mods/aot-rumbling/port-aot.py --no-media   # mod.json only (sheets and sounds kept)
  python3 mods/aot-rumbling/port-aot.py --dump <rw name>  # a unit's merged ini

The package is three factions and the Titans: Paradis (the Walls, the Survey Corps on their
omni-directional mobility gear, the shifters), Marley (its army, air force, airships and navy,
and the Warriors who inherit the Nine Titans) and the Middle-East Allied Forces. Each has a
command building the engineer places, which trains the faction's builder. A shifter is one
unit with two forms (`morph`): the human and the Titan, which lasts a while and gives the
human back when it wears off or falls. The rest of what the package scripts is carried by
the rules (`game/modRules.ts`): gear that flies near something to hook onto, squads that
arrive six at a time, Eldians who turn into mindless Titans at the Beast Titan's roar, the
Colossal's blast, and the Walls that crumble into marching Titans when the Founder comes.

Rusted Warfare conventions: a tile is 20 px and the sim runs 60 ticks a second; a bare
time is ticks and `5s` is seconds; `moveSpeed` is px per tick; art faces up and a part's
`y` is forward; a building's footprint is `left,up,right,down` in tiles; `copyFrom` merges
other files as defaults; every `all-units.template` above a unit's folder applies to it;
`@define x: v` and `${x}` are variables; `@copyFromSection` copies a section's keys.
Prices here run about ten times Rusted Warfare's stock ones and are brought down to metal.
"""
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys

from PIL import Image, ImageStat

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
RW = os.path.join(REPO, "rusted-warfare-mods", "进击の巨人『地鸣』1.443【公测】")
MOD_ID = "aot-rumbling"
MIN_GAME = "0.8.8"  # `turretMounts` (a warship's guns alike each turn); 0.8.7 brought behaviour and `near`
DRY = "--dry" in sys.argv
NO_MEDIA = "--no-media" in sys.argv
OUT = os.path.abspath(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else HERE

# ----------------------------------------------------------------- scaling
# World px a Rusted Warfare px is drawn at, by what the thing is. A person is small beside a
# tank here as there; a Titan is drawn big, but the long side of the largest is held back so
# the Founder is a monster and not a map.
DISPLAY = 1.5625            # a unit's sheet is drawn at this many world px a sheet px
HUMAN_ART = 1.2
MACHINE_ART = 1.0
MACHINE_CAP, MACHINE_SLOPE = 40, 0.4    # RW px; beyond this a hull grows at the slope
SHIP_ART = 1.0
SHIP_CAP, SHIP_SLOPE = 60, 0.6          # a warship is held back less than a tank: beside its yard it reads as one
TITAN_ART = 0.85
TITAN_CAP, TITAN_SLOPE = 70, 0.5
TITAN_MAX = 330             # world px, the longest a Titan's frame may be
TITAN_SS = 1.5              # a Titan's sheet px per world px: its art is fine, and moves
HUMAN_MIN = 24              # world px, the least a person's longest side is drawn at
BUILDING_TILE = 0.7         # tiles here a Rusted Warfare tile of footprint is
WALL_RW_PER_TILE = 86       # the Wall's pieces at one scale: a section's 344 RW px of stone to 4 tiles

# numbers: the package's credits and hit points are about ten and three times the stock game's
UNIT_PRICE, UNIT_KNEE, UNIT_EXP = 0.01, 40000, 0.6
BLD_PRICE, BLD_KNEE, BLD_EXP = 0.016, 50000, 0.6
HP, HP_KNEE, HP_EXP = 0.22, 3000, 0.7
BLD_HP, BLD_HP_KNEE, BLD_HP_EXP = 0.4, 5000, 0.6
DMG = 0.22                  # as the hull: the package's fights last as long here
RANGE = 0.6 / 20            # RW px -> tiles
SPEED = 45                  # RW px/tick -> world px/s
VISION = 0.6
INCOME = 0.012              # RW credits a second -> metal a second
COST_MAX = 4000


def clamp(x, lo, hi):
    return max(lo, min(hi, x))


def knee(x, k, knee_at, exp):
    """linear to the knee, then a power: the giants priced and armoured, not priced out"""
    return x * k if x <= knee_at else k * knee_at * (x / knee_at) ** exp


def cost_of(price, building=False):
    c = knee(price, BLD_PRICE, BLD_KNEE, BLD_EXP) if building else knee(price, UNIT_PRICE, UNIT_KNEE, UNIT_EXP)
    return int(clamp(round(c / 5) * 5, 20 if not building else 40, COST_MAX))


def hp_of(hp_rw, building=False):
    h = knee(hp_rw, BLD_HP, BLD_HP_KNEE, BLD_HP_EXP) if building else knee(hp_rw, HP, HP_KNEE, HP_EXP)
    return int(clamp(round(h / 10) * 10, 30, 30000))


def dps_cap(cost, building):
    """damage a second a def of this price may deal: a Bison's 33 at 280, room for specialists"""
    return (0.2 * cost + 20) if building else (0.14 * cost + 14)


def grow(long_px, cap, slope):
    """the share of its size a long thing keeps: all of it to the cap, `slope` of the rest"""
    if long_px <= cap:
        return 1.0
    return (cap + (long_px - cap) * slope) / long_px


# ------------------------------------------------------------- ini parsing
def parse_ini(text):
    secs = {}
    cur = None
    lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        i += 1
        if not line or line[0] in "#;" or line.startswith("//"):
            continue
        m = re.match(r"^\[([^\]]+)\]", line)
        if m:
            cur = m.group(1).strip()
            secs.setdefault(cur, {})
            continue
        if cur is None or ":" not in line:
            continue
        k, _, v = line.partition(":")
        k, v = k.strip(), v.strip()
        if v.startswith('"""'):
            v = v[3:]
            if '"""' in v:
                v = v[: v.index('"""')]
            else:
                parts = [v]
                while i < len(lines):
                    l = lines[i]
                    i += 1
                    if '"""' in l:
                        parts.append(l[: l.index('"""')])
                        break
                    parts.append(l)
                v = "\n".join(parts).strip()
        secs[cur][k] = v
    return secs


def resolve(ref, from_dir):
    r = (ref or "").strip().replace("\\", "/")
    r = re.sub(r":[\d.]+$", "", r) if re.search(r"\.(ogg|wav|mp3):[\d.]+$", r, re.I) else r
    if not r or r.upper() in ("NONE", "AUTO"):
        return None
    up = r.upper()
    if up.startswith("ROOT:"):
        p = os.path.join(RW, r[5:].lstrip("/"))
    elif up.startswith(("SHARED:", "SHADOW:", "CUSTOM:")):
        return None
    else:
        p = os.path.join(from_dir, r)
    p = os.path.normpath(p)
    if os.path.exists(p):
        return p
    d, b = os.path.split(p)
    if os.path.isdir(d):
        for f in os.listdir(d):
            if f.lower() == b.lower():
                return os.path.join(d, f)
    return None


def merge_into(dst, src):
    for sec, kv in src.items():
        d = dst.setdefault(sec, {})
        for k, v in kv.items():
            d[k] = v


_cache = {}


def load_file(path, stack=()):
    """one file with its own copyFrom chain merged beneath it"""
    if path in _cache:
        return _cache[path]
    if path in stack:
        return {}
    own = parse_ini(open(path, encoding="utf-8", errors="replace").read())
    out = {}
    for ref in split_list(own.get("core", {}).get("copyFrom", "")):
        hit = resolve(ref, os.path.dirname(path))
        if hit:
            merge_into(out, load_file(hit, stack + (path,)))
    merge_into(out, own)
    _cache[path] = out
    return out


def load_unit(path):
    """a unit with every folder template above it, then its copyFrom chain, then itself"""
    out = {}
    rel = os.path.relpath(os.path.dirname(path), RW)
    dirs = [RW]
    if rel != ".":
        acc = RW
        for part in rel.split(os.sep):
            acc = os.path.join(acc, part)
            dirs.append(acc)
    for d in dirs:
        t = os.path.join(d, "all-units.template")
        if os.path.exists(t):
            merge_into(out, load_file(t))
    merge_into(out, load_file(path))
    copy_sections(out)
    expand_vars(out)
    expand_turret_copies(out)
    return out


def copy_sections(ini):
    """`@copyFromSection: other` gives a section the other's keys as defaults"""
    for _ in range(3):
        for sec, kv in ini.items():
            src = kv.get("@copyFromSection")
            if not src:
                continue
            base = ini.get(src.strip())
            if base is None:
                continue
            for k, v in base.items():
                if k != "@copyFromSection" and k not in kv:
                    kv[k] = v


def split_list(v):
    return [s.strip() for s in (v or "").split(",") if s.strip()]


def expand_vars(ini):
    defines = {}
    for sec, kv in ini.items():
        for k, v in kv.items():
            if k.startswith("@define "):
                defines[k[8:].strip()] = v
            elif k.startswith("@global "):
                defines[k[8:].strip()] = v
    if not any("${" in v for kv in ini.values() for v in kv.values()):
        return

    def lookup(tok):
        if tok in defines:
            return defines[tok]
        if "." in tok:
            s, k = tok.split(".", 1)
            v = ini.get(s, {}).get(k)
            if v is not None:
                return v
        return None

    for sec, kv in ini.items():
        for k, v in list(kv.items()):
            if "${" not in v:
                continue

            def sub(m):
                expr = m.group(1)
                toks = re.findall(r"[A-Za-z_一-鿿][\w一-鿿]*(?:\.[\w一-鿿]+)?", expr)
                e = expr
                for t in sorted(set(toks), key=len, reverse=True):
                    if t in ("int", "min", "max"):
                        continue
                    val = lookup(t)
                    if val is None:
                        return m.group(0)
                    e = re.sub(r"(?<![\w.])" + re.escape(t) + r"(?![\w.])", str(num(val) if num(val) is not None else val), e)
                try:
                    return str(eval(e, {"__builtins__": {}}, {"int": int, "min": min, "max": max}))
                except Exception:
                    return m.group(0)

            kv[k] = re.sub(r"\$\{([^}]*)\}", sub, v)


def expand_turret_copies(ini):
    for _ in range(3):
        for sec, kv in list(ini.items()):
            if not sec.startswith("turret_") or "copyFrom" not in kv:
                continue
            base = ini.get("turret_" + kv["copyFrom"].strip())
            if base is None:
                continue
            merged = {k: v for k, v in base.items() if k != "copyFrom"}
            merged.update({k: v for k, v in kv.items() if k != "copyFrom"})
            ini[sec] = merged


def num(v):
    if v is None:
        return None
    m = re.match(r"^\s*(-?\d+(\.\d+)?)", str(v))
    return float(m.group(1)) if m else None


def boolish(v, default=False):
    if v is None:
        return default
    s = str(v).strip().lower()
    return s in ("true", "1", "yes")


def seconds(v):
    n = num(v)
    if n is None:
        return None
    return n if re.search(r"s\s*$", str(v).strip(), re.I) else n / 60


def build_seconds(v):
    """`buildSpeed`: seconds as `30s`, else the share of the whole built a tick"""
    n = num(v)
    if n is None or n <= 0:
        return None
    if re.search(r"s\s*$", str(v).strip(), re.I):
        return n
    return 1 / (60 * n) if n < 1 else n / 60


def credits(v):
    """a price's credits: `125000,人力=70` is 125000 credits and 70 of manpower, folded in at 500 each"""
    total = 0.0
    for part in split_list(v):
        if "=" in part:
            k, _, val = part.partition("=")
            if "人力" in k:
                total += 500 * (num(val) or 0)
            elif k.strip() in ("credits", ""):
                total += num(val) or 0
        else:
            total += num(part) or 0
    return total


def strip_quotes(s):
    return re.sub(r"^[“\"”]+|[“\"”]+$", "", (s or "").strip())


def index_units():
    """every unit file, by its [core] name"""
    by_name = {}
    for root, _, files in os.walk(RW):
        for f in sorted(files):
            if not f.lower().endswith(".ini"):
                continue
            p = os.path.join(root, f)
            raw = parse_ini(open(p, encoding="utf-8", errors="replace").read())
            name = raw.get("core", {}).get("name")
            if name:
                by_name.setdefault(strip_quotes(name), p)
    return by_name


def zh_text(desc, fallback=""):
    """the package's description as a card's line: its first point or two"""
    d = (desc or "").replace("\\n", "\n")
    items = []
    for line in d.split("\n"):
        s = line.strip().lstrip("-").strip()
        if not s or s in ("。", "无", "-"):
            continue
        items.append(s.rstrip("。.，,…!！"))
    out = "，".join(items[:2])
    if len(out) > 46:
        out = items[0] if items else ""
    if len(out) > 60:
        out = out[:58] + "…"
    return out or fallback


# ---------------------------------------------------------- hand weapons
# The ODM troops' strikes are the package's scripts (a flyer's nape cut, a hero's own swing), not
# rounds a turret fires; they are written out here from its numbers. `@path` is a recording of the
# package's, cut to a sound of the mod's; "melee" a Titan's reach, sized from the Titan.
CUT = "@进击的巨人MOD/兵团/兵团/cut.ogg"


def blade(dmg_rw, delay_ticks, flying=False, sound=CUT):
    """twin blades: on foot a scuffle; on the gear a cut at the nape, which is what kills a Titan"""
    return {"id": "blades", "cls": "at", "dmg": round(dmg_rw * DMG, 1), "reload": round(delay_ticks / 60, 2),
            "range": 1.0 if flying else 0.6, "targets": ["ground", "ship", "air"] if flying else ["ground", "ship"],
            "projectile": "bullet", "speed": 1500, "mult": {"light": 1.0, "medium": 0.9, "heavy": 2.4 if flying else 1.6},
            "sound": sound}


def gun(wid, cls, dmg_rw, reload_s, rng, sound, **kw):
    w = {"id": wid, "cls": cls, "dmg": round(dmg_rw * DMG, 1), "reload": reload_s, "range": rng, "targets": ["ground", "ship"],
         "projectile": "missile" if cls == "at" else "bullet", "speed": 700 if cls == "at" else 900, "sound": sound}
    w.update(kw)
    return w


MUSKET = gun("musket", "autocannon", 170, 4.2, 4.5, "@进击的巨人MOD/兵团/兵团/火枪开火.ogg", splash=20)
PISTOLS = gun("pistols", "mg", 45, 0.85, 4.5, "@进击的巨人MOD/兵团/兵团/gunfire.ogg", bores=2, boreSpacing=6)
SPEARS = gun("spears", "at", 190, 3.0, 4.5, "@进击的巨人MOD/兵团/兵团/射击.ogg", splash=32, mult={"heavy": 2.2})
REVOLVERS = gun("revolvers", "autocannon", 190, 3.3, 5.0, "@进击的巨人MOD/兵团/兵团/射击.ogg", bores=2, boreSpacing=6, splash=20)


def airborne(w):
    """the same gun fired from the gear, at flyers too"""
    return dict(w, targets=["ground", "ship", "air"])


def maul(wid, dmg, reload_s, splash, air=False):
    """a Titan's blow, its reach sized from the Titan"""
    return {"id": wid, "cls": "he", "dmg": dmg, "reload": reload_s, "range": "melee", "splash": splash,
            "targets": ["ground", "ship", "air"] if air else ["ground", "ship"], "projectile": "bullet", "speed": 1500,
            "mult": {"heavy": 1.0}, "sound": "@units/九大巨人/超大型巨人/超巨打击.ogg"}


BOULDER = {"id": "boulder", "cls": "he", "dmg": 250, "reload": 7.0, "range": 10, "splash": 60, "targets": ["ground", "ship"],
           "projectile": "shell", "arc": True, "speed": 380, "spread": 30, "sound": "@units/九大巨人/鸟、兽巨/feixing.ogg",
           "look": {"sprite": "@units/九大巨人/鸟、兽巨/巨石.png", "impact": "fx.expl.l"}}


# ------------------------------------------------------------------ roster
# (rw name, id suffix, English name, English tooltip, overrides)
# overrides: kind (B/U), art (odm, walker, titan, strip), shoot (the rw name of the firing
#   pose, a walker's third frame and where its gun is read from), odm (a flying form beside
#   it), hero (one a side), squad ((unit, count): a squad that is put down whole), form (taken,
#   never trained), and any def field by name: tier, cost, hp, armor, pop, speed, vision,
#   domain, trail, hovers, transportCap, fw, fh, power, metalRate, requires, limit, aiWeight
B, U = "building", "unit"
ROSTER = [
    # ================================================================ Paradis
    ("基地总部2", "paradis-hq", "Paradis Headquarters", "The island's command: trains the Garrison who build, the carriages and the horses.",
     dict(kind=B, zh_name="帕拉迪岛总部", power=20, fw=4, fh=4, vision=14)),
    ("立体训练营", "odm-camp", "ODM Training Camp", "Trains the Survey Corps, the Military Police and the Anti-Personnel troops, and the Scouts' heroes.",
     dict(fw=6, fh=4, kind=B, power=-6)),
    ("立体训练营", "odm-camp-2", "ODM Training Camp II", "The camp at its second level: the shifters and the thunder spears train here.",
     dict(fw=6, fh=4, kind=B, zh_name="立体训练营 II", power=-8, upgradeOf="odm-camp", upgradeCost=450, upgradeTime=40, requires=["academy"])),
    ("学院", "academy", "Military Academy", "The study of Titans: a shifter takes its Titan form only while one stands.",
     dict(fw=5, fh=4, kind=B, power=-4)),
    ("巨树资源", "giant-tree", "Giant Tree", "One of the forest's giant trees: a steady income, and something for ODM gear to hook onto.",
     dict(kind=B, fw=2, fh=2, metalRate=1.0)),
    ("house", "house", "House", "A home within the Walls: a little metal, and a roof to swing from.",
     dict(kind=B, fw=2, fh=2, metalRate=0.3)),
    ("house_big", "house-big", "Large House", "A bigger household, and more of the town's taxes.",
     dict(kind=B, fw=2, fh=2, metalRate=0.6, upgradeOf="house", upgradeCost=300, upgradeTime=30)),
    ("钟塔", "bell-tower", "Bell Tower", "Sees far over the rooftops and rings the alarm.",
     dict(kind=B, fw=1, fh=1, vision=15, detect=10)),
    ("马厩", "stable", "Stable", "Breeds the horses the Scouts ride beyond the Walls.",
     dict(fw=4, fh=4, kind=B, power=-2)),
    ("固定炮", "wall-cannon", "Wall Cannon", "A fixed cannon of the kind the Garrison mans on the Walls: long reach, and extra harm to Titans.",
     dict(weapons_from="固定炮可控", kind=B, fw=2, fh=2, power=-2, tower=True, requires=["academy"])),
    ("城墙横", "wall", "Wall Section", "Fifty metres of stone around the island, built of Colossal Titans. When the Founder comes near, it crumbles and they march.",
     dict(kind=B, zh_name="城墙", fw=4, fh=2, cost=180, hp=6000, rw_per_tile=WALL_RW_PER_TILE)),
    ("城墙竖", "wall-v", "Wall Section (north–south)", "The Wall running north to south. When the Founder comes near, it crumbles and they march.",
     dict(kind=B, zh_name="城墙（竖）", fw=1, fh=4, cost=180, hp=6000, rw_per_tile=WALL_RW_PER_TILE)),
    # the package's gate is a section of the Wall's own size, so it stands in the line as one
    ("城门关", "gate", "Wall Gate", "A gate in the Wall, and the bravest place to hold. The Founder wakes the Titans in it too.",
     dict(kind=B, zh_name="城门", fw=4, fh=2, cost=400, hp=9000, rw_per_tile=WALL_RW_PER_TILE)),
    ("驻扎_landed", "garrison", "Garrison Soldier", "The Garrison Regiment: builds the island's works, and is no match for a Titan.",
     dict(weapons=[blade(110, 50)], kind=U, art="odm", buildRate=25)),
    ("carriage", "carriage", "Supply Carriage", "Carries the wounded and the builders: six aboard.",
     dict(kind=U, transportCap=6, trail="tire", armor="light")),
    ("马", "horse", "Horse", "A Scout's mount: two riders, and far quicker than a soldier on foot.",
     dict(kind=U, transportCap=2, trail="none", armor="light", cost=40)),
    # the horse as it is ridden: its riders drawn in the saddle, which the game's hold would hide
    ("马", "horse-ridden", "Horse", "A Scout's mount, ridden.",
     dict(kind=U, transportCap=2, trail="none", armor="light", cost=40, riders=1, form=True, zh_name="马（骑乘）")),
    ("马", "horse-ridden-2", "Horse", "A Scout's mount, carrying two.",
     dict(kind=U, transportCap=2, trail="none", armor="light", cost=40, riders=2, form=True, zh_name="马（双人骑乘）")),
    ("火炮", "field-cannon", "Field Cannon", "A Garrison gun: slow to move, long-ranged, and hard on Titans.",
     dict(kind=U, trail="tire", armor="light", mult={"heavy": 1.3}, towed=True)),
    ("轮式火炮", "wheeled-cannon", "Wheeled Cannon", "Lighter and quicker to fire than the field cannon, with less reach.",
     dict(kind=U, trail="tire", armor="light", mult={"heavy": 1.3}, towed=True)),
    # the ODM troops: each fights on foot and takes to the air near something to hook onto
    ("调查_landed", "scout", "Survey Corps Soldier", "Fights on foot with blades; with a building or a Titan close by it takes to the air on its gear and cuts at the nape.",
     dict(weapons=[blade(130, 50)], air_weapons=[blade(150, 90, True)], kind=U, art="odm", odm=True, form=True)),
    ("宪兵火枪_landed", "military-police", "Military Police", "The Interior's police: muskets, and ODM gear beside them.",
     dict(weapons=[MUSKET], air_weapons=[airborne(MUSKET)], kind=U, art="odm", odm=True, form=True)),
    ("新立体枪_landed", "anti-personnel", "Anti-Personnel Trooper", "ODM gear made for fighting people: pistols, not blades.",
     dict(weapons=[PISTOLS], air_weapons=[airborne(PISTOLS)], kind=U, art="odm", odm=True, form=True)),
    ("新立体雷枪_landed", "thunder-spear", "Thunder Spear Trooper", "Rockets fired from the gear that burst a Titan's armour open.",
     dict(weapons=[SPEARS], air_weapons=[airborne(SPEARS)], kind=U, art="odm", odm=True, form=True)),
    ("调查_landed", "scout-squad", "Survey Corps Squad", "Six Survey Corps soldiers.",
     dict(cost=450, kind=U, squad=("scout", 6), zh_name="调查兵团小队")),
    ("宪兵火枪_landed", "military-police-squad", "Military Police Squad", "Six Military Police with muskets.",
     dict(cost=450, kind=U, squad=("military-police", 6), zh_name="宪兵团小队")),
    ("新立体枪_landed", "anti-personnel-squad", "Anti-Personnel Squad", "Five troopers of the Interior's anti-personnel squad.",
     dict(cost=600, kind=U, squad=("anti-personnel", 5), zh_name="新立体机动小队")),
    ("新立体雷枪_landed", "thunder-spear-squad", "Thunder Spear Squad", "Four troopers with thunder spears.",
     dict(cost=900, kind=U, squad=("thunder-spear", 4), zh_name="雷枪小队", requires=["academy"])),
    ("埃尔文_landed", "erwin", "Erwin Smith", "Commander of the Survey Corps. The Scouts who fight beside him give their hearts: they strike faster and shrug off harm.",
     dict(weapons=[blade(140, 50)], air_weapons=[blade(160, 90, True)], kind=U, art="odm", odm=True, hero=True, zh_name="埃尔文·史密斯")),
    ("三笠_landed", "mikasa", "Mikasa Ackerman", "An Ackerman, and the finest blade in the Scouts.",
     dict(weapons=[blade(210, 50)], air_weapons=[blade(250, 80, True)], kind=U, art="odm", odm=True, hero=True, zh_name="三笠·阿克曼")),
    ("利威尔_land", "levi", "Levi Ackerman", "Humanity's strongest soldier: his spinning strike cuts through whatever is in reach.",
     dict(weapons=[blade(200, 25)], air_weapons=[blade(250, 60, True, "@进击的巨人MOD/兵团/兵团/利威尔砍_1.ogg")], kind=U, art="odm", odm=True, hero=True, zh_name="利威尔·阿克曼")),
    ("弗新立体枪_landed", "floch", "Floch Forster", "The Yeagerists' firebrand: the anti-personnel troopers beside him fight harder.",
     dict(weapons=[dict(PISTOLS, dmg=round(55 * DMG, 1))], air_weapons=[airborne(dict(PISTOLS, dmg=round(55 * DMG, 1)))], kind=U, art="odm", odm=True, hero=True, zh_name="弗洛克·弗斯特")),
    ("肯尼火枪_land", "kenny", "Kenny Ackerman", "Kenny the Ripper, captain of the Interior's anti-personnel squad.",
     dict(weapons=[REVOLVERS], air_weapons=[airborne(REVOLVERS)], kind=U, art="odm", odm=True, hero=True, zh_name="肯尼·阿克曼")),
    ("艾伦_landed", "eren", "Eren Yeager", "Holder of the Attack Titan, and in the end of the Founder: the Rumbling is his to begin.",
     dict(weapons=[blade(140, 50)], air_weapons=[blade(150, 90, True)], kind=U, art="odm", odm=True, hero=True, zh_name="艾伦·耶格尔")),
    ("阿尔敏_landed", "armin", "Armin Arlert", "Inherits the Colossal Titan: his transformation is a blast that levels all around him.",
     dict(weapons=[blade(120, 50)], air_weapons=[blade(130, 90, True)], kind=U, art="odm", odm=True, hero=True, zh_name="阿尔敏·阿诺德")),
    ("艾尔迪亚士兵走动", "eldian", "Eldian Soldier", "An Eldian given Titan spinal fluid: at the Beast Titan's roar, or at its own order, it becomes a mindless Titan.",
     dict(kind=U, art="walker", shoot="艾尔迪亚士兵射击", form=True)),
    ("艾尔迪亚士兵走动", "eldian-squad", "Eldian Squad", "Six Eldians who have drunk the spinal fluid.",
     dict(kind=U, squad=("eldian", 6), zh_name="艾尔迪亚班")),
    ("格里莎", "grisha", "Grisha Yeager", "Eren's father, and the Attack Titan before him.",
     dict(weapons=[PISTOLS], kind=U, art="walker", hero=True, zh_name="格里莎·耶格尔")),
    ("吉克走动", "zeke", "Zeke Yeager", "Holder of the Beast Titan, of royal blood: his roar turns Eldians into Titans.",
     dict(kind=U, art="walker", shoot="吉克射击", hero=True, zh_name="吉克·耶格尔")),
    ("罗德巨人体", "rod-reiss", "Rod Reiss's Titan", "An abnormal of royal blood, too vast to stand: it crawls on, crushing all in its way.",
     dict(weapons=[maul("crush", 280, 5.0, 110)], kind=U, art="titan", hero=True, tier=3, armor="heavy")),

    # ================================================================ Marley
    ("马莱基地总部2", "marley-hq", "Marleyan Administration", "Marley's seat of command: trains the engineers and the transport trucks.",
     dict(kind=B, zh_name="马莱行政大楼", power=20, fw=4, fh=4, vision=14)),
    ("马莱陆军厂", "marley-factory", "Marleyan Army Factory", "Trains Marley's infantry squads, its trucks and its armour.",
     dict(kind=B, power=-6)),
    ("超重型工厂", "super-heavy-factory", "Super-Heavy Factory", "Builds the war machines too heavy for any other line.",
     dict(kind=B, power=-10, requires=["institute"])),
    ("马莱空军制造厂", "air-factory", "Aircraft Factory", "Builds the Allied fighters and heavy bombers.",
     dict(kind=B, power=-6, requires=["institute"])),
    ("马莱飞艇制造厂", "airship-factory", "Airship Factory", "Builds Marley's combat and strategic airships.",
     dict(fw=5, fh=5, kind=B, power=-8)),
    ("马莱海军工厂", "naval-yard", "Marleyan Naval Yard", "Builds landing craft, frigates, ironclads and the Allied battleship.",
     dict(kind=B, power=-6)),
    ("实验训练场", "warrior-ground", "Warrior Training Ground", "Where Marley trains its Warriors: the Eldians who inherit the Nine Titans.",
     dict(fw=5, fh=4, kind=B, power=-6)),
    ("实验研究所", "institute", "Weapons Institute", "Research: armour, aircraft, artillery and anti-air. The heavier arms need it standing.",
     dict(fw=5, fh=3, kind=B, power=-4)),
    ("狙击哨塔", "sniper-tower", "Sniper Tower", "A heavy sniper's nest that fires at the ground and the sky.",
     dict(kind=B, fw=1, fh=1, power=-2, tower=True)),
    ("防空机枪", "aa-mg", "AA Machine Gun", "Four machine guns against aircraft and ODM flyers.",
     dict(kind=B, fw=2, fh=2, power=-2, tower=True)),
    ("防空炮", "aa-gun", "AA Cannon", "The machine guns replaced by a flak cannon.",
     dict(kind=B, fw=2, fh=2, power=-3, tower=True, upgradeOf="aa-mg", upgradeCost=420, upgradeTime=30)),
    ("维修站", "repair-station", "Repair Station", "Mends the buildings around it.",
     dict(kind=B, fw=2, fh=2, power=-2, repairRange=6, repairRate=18, repairTargets=2)),
    ("大型维修站", "repair-depot", "Large Repair Station", "Mends more of the buildings around it, and faster.",
     dict(kind=B, power=-4, repairRange=8, repairRate=30, repairTargets=4)),
    ("岸防炮（可控）", "coastal-gun", "Coastal Gun", "A great gun against ships, and against anything of the Colossal's size.",
     dict(kind=B, power=-4, tower=True, requires=["institute"])),
    ("马莱工兵", "marley-engineer", "Marleyan Engineer", "Builds everything Marley builds.",
     dict(kind=U, art="walker", buildRate=25)),
    ("马莱运输卡车", "marley-truck", "Marleyan Transport Truck", "Carries the wounded and the engineers.",
     dict(kind=U, transportCap=6, trail="tire", armor="light")),
    ("马莱士兵走动", "marley-rifleman", "Marleyan Rifleman", "Marley's regulars: cheap, and hard fighters with a bolt-action rifle.",
     dict(kind=U, art="walker", shoot="马莱士兵射击", form=True)),
    ("马莱机枪手走动", "marley-machine-gunner", "Marleyan Machine Gunner", "Short-ranged and all fire.",
     dict(kind=U, art="walker", shoot="马莱机枪手射击", form=True)),
    ("马莱投弹兵走动", "marley-grenadier", "Marleyan Grenadier", "Fragmentation grenades: good against armour and against men in a bunch.",
     dict(kind=U, art="walker", shoot="马莱投弹兵射击", form=True)),
    ("马莱狙击手移动", "marley-at-rifleman", "Marleyan Anti-Tank Rifleman", "A long anti-tank rifle: slow to reload, and it holes armour.",
     dict(kind=U, art="walker", shoot="马莱狙击手射击", form=True)),
    ("马莱喷火兵走动", "marley-flamethrower", "Marleyan Flamethrower", "Sets everything alight.",
     dict(kind=U, art="walker", shoot="马莱喷火兵射击", form=True)),
    ("马莱士兵走动", "marley-rifle-squad", "Marleyan Rifle Squad", "Six Marleyan riflemen.",
     dict(kind=U, squad=("marley-rifleman", 6), zh_name="马莱步兵班")),
    ("马莱机枪手走动", "marley-mg-squad", "Marleyan Machine-Gun Squad", "Six machine gunners.",
     dict(kind=U, squad=("marley-machine-gunner", 6), zh_name="马莱机枪班")),
    ("马莱投弹兵走动", "marley-grenadier-squad", "Marleyan Grenadier Squad", "Six grenadiers.",
     dict(kind=U, squad=("marley-grenadier", 6), zh_name="马莱投弹班")),
    ("马莱狙击手移动", "marley-at-squad", "Marleyan Anti-Tank Squad", "Five anti-tank riflemen.",
     dict(kind=U, squad=("marley-at-rifleman", 5), zh_name="马莱反坦狙击班", requires=["institute"])),
    ("马莱喷火兵走动", "marley-flame-squad", "Marleyan Flamethrower Squad", "Five flamethrowers.",
     dict(kind=U, squad=("marley-flamethrower", 5), zh_name="马莱喷火班", requires=["institute"])),
    ("马莱运兵卡车", "marley-troop-truck", "Troop Truck", "Carries a squad; its crew fights from the bed.",
     dict(kind=U, transportCap=6, trail="tire", armor="light")),
    ("马莱装甲车", "marley-armored-car", "Armored Car", "Fast, armoured and over any hill: carries engineers and guns, and its machine gun keeps infantry off.",
     dict(kind=U, transportCap=4, trail="tire", armor="medium")),
    ("马莱装甲坦克", "marley-tank", "Marleyan Tank", "An anti-Titan gun in armour: with Marley's infantry beside it, the empire's strongest pairing.",
     dict(kind=U, armor="heavy", trail="tread", requires=["institute"])),
    ("重型反巨人炮移动", "anti-titan-gun", "Heavy Anti-Titan Gun", "A towed gun of enormous calibre: slow, precise, and devastating to Titans.",
     dict(kind=U, armor="light", trail="tire", requires=["institute"], mult={"heavy": 1.4}, towed=True)),
    ("马莱超重型坦克", "super-heavy-tank", "Super-Heavy Tank", "Two great guns, a ring of secondary guns and anti-air machine guns: a war machine to fear.",
     dict(kind=U, armor="heavy", trail="tread", tier=3)),
    ("马莱战斗机", "fighter", "Allied Fighter", "Nimble, fights in flocks, and escorts the airships.",
     dict(kind=U)),
    ("马莱重型轰炸机", "heavy-bomber", "Allied Heavy Bomber", "Slow, and devastating to buildings and troops on the ground.",
     dict(kind=U, tier=3)),
    ("马莱战斗飞艇", "combat-airship", "Combat Airship", "A fortress in the sky: carries a company, and fights from the air.",
     dict(kind=U, hovers=True, transportCap=12)),
    ("马莱大型战略飞艇", "strategic-airship", "Strategic Airship", "Marley's great airship: it carries Titans-to-be over the enemy and lets them fall.",
     dict(kind=U, hovers=True, transportCap=20, tier=3)),
    ("马莱登陆艇", "landing-craft", "Landing Craft", "Carries eight ashore; those aboard cannot be hit.",
     dict(kind=U, transportCap=8)),
    ("中东护卫舰", "frigate", "Frigate", "Cheap and hard-hitting: three medium guns and four autocannons.",
     dict(kind=U)),
    ("中东铁甲战舰", "ironclad", "Ironclad", "Three heavy guns, four armour-piercing autocannons and heavy plate.",
     dict(kind=U)),
    ("马莱铁甲战列舰", "battleship", "Allied Ironclad Battleship", "The world's most advanced warship, with the largest anti-Titan guns ever built.",
     dict(kind=U, tier=3)),
    ("贾碧移动", "gabi", "Gabi Braun", "A Warrior candidate and a deadly shot with an anti-armour rifle.",
     dict(kind=U, art="walker", shoot="贾碧射击", hero=True, zh_name="贾碧·布朗")),
    ("波尔克走动", "porco", "Porco Galliard", "Holder of the Jaw Titan.",
     dict(kind=U, art="walker", shoot="波尔克射击", hero=True, zh_name="波尔克·加利亚德")),
    ("法尔科走动", "falco", "Falco Grice", "Inherits the Jaw Titan, and grows it wings.",
     dict(kind=U, art="walker", shoot="法尔科射击", hero=True, zh_name="法尔科·格莱斯")),
    ("皮克走动", "pieck", "Pieck Finger", "Holder of the Cart Titan, which carries Marley's guns on its back.",
     dict(kind=U, art="walker", shoot="皮克射击", hero=True, zh_name="皮克·芬格")),
    ("菈菈·戴巴", "lara", "Lara Tybur", "Holder of the War Hammer Titan, which forges weapons of hardened crystal.",
     dict(weapons=[PISTOLS], kind=U, art="walker", hero=True)),
    ("阿尼_landed", "annie", "Annie Leonhart", "A Warrior who hid among the cadets: the Female Titan.",
     dict(weapons=[blade(120, 50)], air_weapons=[blade(150, 90, True)], kind=U, art="odm", odm=True, hero=True, zh_name="阿尼·利昂纳德")),
    ("莱纳_landed", "reiner", "Reiner Braun", "A Warrior: the Armored Titan.",
     dict(weapons=[blade(140, 50)], air_weapons=[blade(150, 90, True)], kind=U, art="odm", odm=True, hero=True, zh_name="莱纳·布朗")),
    ("贝特霍尔德_landed", "bertholdt", "Bertholdt Hoover", "A Warrior: the Colossal Titan.",
     dict(weapons=[blade(140, 50)], air_weapons=[blade(150, 90, True)], kind=U, art="odm", odm=True, hero=True, zh_name="贝尔托特·胡佛")),

    # ========================================================= Middle East
    ("中东基地总部2", "me-hq", "Middle-East Administration", "The Allied Forces' command: trains engineers and trucks.",
     dict(kind=B, zh_name="中东行政大楼", power=20, fw=4, fh=4, vision=14)),
    ("中东陆军工厂", "me-factory", "Middle-East Army Factory", "Trains the Middle-East's infantry, guns and tanks.",
     dict(kind=B, power=-6)),
    ("中东海军工厂", "me-naval-yard", "Middle-East Naval Yard", "Builds landing craft, frigates, ironclads and the Allied battleship.",
     dict(kind=B, power=-6)),
    ("中东军事城墙", "me-wall", "Military Wall", "Stops boulders, train guns and the Armored Titan's charge.",
     dict(kind=B, fw=2, fh=2)),
    ("中东军事城墙3", "me-fort", "Wall Blockhouse", "A blockhouse on the wall: troops aboard reach low flyers.",
     dict(kind=B, fw=2, fh=2)),
    ("中东碉堡", "me-bunker", "Bunker", "A huge pillbox that stops the Armored Titan's charge.",
     dict(kind=B, fw=3, fh=3, tower=True)),
    ("中东碉堡T2", "me-bunker-2", "Bunker II", "More guns, thicker walls.",
     dict(kind=B, fw=3, fh=3, tower=True, upgradeOf="me-bunker", upgradeCost=500, upgradeTime=40)),
    ("固定炮2", "me-mortar-emplacement", "Heavy Mortar Emplacement", "An enormous mortar for the walls: heavy plate, and extra harm to buildings.",
     dict(kind=B, fw=2, fh=2, power=-2)),
    ("中东工程师", "me-engineer", "Middle-East Engineer", "Builds the Middle-East's defences, and repairs fast.",
     dict(kind=U, art="walker", buildRate=35)),
    ("中东士兵走动", "me-rifleman", "Middle-East Rifleman", "The Allied Forces' infantry.",
     dict(kind=U, art="walker", shoot="中东士兵射击", form=True)),
    ("中东爆破兵走动", "me-sapper", "Middle-East Sapper", "Heavy explosives: devastating to buildings, but thrown from close by.",
     dict(kind=U, art="walker", shoot="中东爆破兵射击", form=True)),
    ("中东士兵走动", "me-rifle-squad", "Middle-East Rifle Squad", "Six Middle-East riflemen.",
     dict(kind=U, squad=("me-rifleman", 6), zh_name="中东步兵班")),
    ("中东爆破兵走动", "me-sapper-squad", "Middle-East Sapper Squad", "Five sappers.",
     dict(kind=U, squad=("me-sapper", 5), zh_name="中东爆破班")),
    ("中东重机枪走动", "me-hmg", "Heavy Machine-Gun Team", "A crew with a heavy machine gun on a tripod.",
     dict(weapons_from="中东重机枪射击", kind=U, armor="light", trail="none")),
    ("中东迫击炮走动", "me-mortar", "Mortar Team", "A crew with a heavy mortar.",
     dict(weapons_from="中东迫击炮射击", kind=U, armor="light", trail="none", arc=True)),
    ("中东卡车", "me-truck", "Middle-East Truck", "Carries the wounded, the engineers or a gun.",
     dict(kind=U, transportCap=6, trail="tire", armor="light")),
    ("中东轻型野战坦克", "me-light-tank", "Light Field Tank", "A light tank with a light anti-Titan gun and a machine gun.",
     dict(kind=U, armor="medium", trail="tread")),
    ("中东坦克", "me-tank", "Middle-East Tank", "The 'meat grinder': a super-heavy tank whose howitzer flattens buildings.",
     dict(kind=U, armor="heavy", trail="tread", tier=3)),
    ("中东反巨人野战炮", "me-at-gun", "Anti-Titan Field Gun", "Holes an armoured tank with ease; long-ranged, precise, and hard on Titans.",
     dict(kind=U, armor="light", trail="tire", mult={"heavy": 1.4}, towed=True)),
    ("中东反步兵榴弹炮", "me-howitzer", "Anti-Infantry Howitzer", "Shells a wide patch of infantry: short-ranged, inaccurate, and hard on buildings.",
     dict(kind=U, armor="light", trail="tire", arc=True, towed=True)),

    # ============================================================ the Titans
    # the Nine, each a form of its shifter
    ("进击的巨人", "attack-titan", "Attack Titan", "Eren's Titan: balanced, explosive, and quick to heal. It hardens its fists at will.",
     dict(kind=U, art="titan", form=True, hero=True, armor="heavy")),
    ("进击的巨人格里莎", "attack-titan-grisha", "Attack Titan (Grisha)", "The Attack Titan as Grisha Yeager bore it.",
     dict(kind=U, art="titan", form=True, hero=True, armor="heavy")),
    ("始祖巨人-艾伦", "founding-titan", "Founding Titan", "The Founder. The Wall Titans come at its call, and the Walls crumble into marching Titans where it passes: the Rumbling.",
     dict(radius=60, body={"r": 44, "len": 230}, weapons=[maul("crush", 250, 4.0, 90, True)], kind=U, art="titan", form=True, hero=True, armor="heavy", tier=3)),
    ("兽之巨人", "beast-titan", "Beast Titan", "An ape of a Titan that hurls boulders like artillery. Its roar turns Eldians into Titans.",
     dict(extra_weapons=[BOULDER], kind=U, art="titan", form=True, hero=True, armor="heavy")),
    ("超大型巨人-阿尔敏", "colossal-armin", "Colossal Titan (Armin)", "Sixty metres of Titan, born in a blast that levels all around it.",
     dict(kind=U, art="titan", form=True, hero=True, armor="heavy", tier=3)),
    ("超大型巨人-贝特霍尔德", "colossal", "Colossal Titan", "Sixty metres of Titan, born in a blast that levels all around it; its steam scalds whatever comes close.",
     dict(kind=U, art="titan", form=True, hero=True, armor="heavy", tier=3)),
    ("铠之巨人", "armored-titan", "Armored Titan", "Plated in hardened armour blades cannot cut. At the end of its strength the armour falls away and it runs.",
     dict(kind=U, art="titan", form=True, hero=True, armor="heavy")),
    ("铠之巨人-卸甲", "armored-titan-shed", "Armored Titan (unarmoured)", "The armour has fallen away: quicker, and far easier to hurt.",
     dict(kind=U, art="titan", form=True, hero=True, armor="medium")),
    ("女巨人", "female-titan", "Female Titan", "Agile and clever: it hardens its nape and its fists at will.",
     dict(kind=U, art="titan", form=True, hero=True, armor="heavy")),
    ("鳄之巨人", "jaw-titan", "Jaw Titan", "Small, and the fastest of the Nine: its jaws crush hardened crystal.",
     dict(kind=U, art="titan", form=True, hero=True, armor="heavy")),
    ("鸟巨", "bird-titan", "Winged Jaw Titan", "Falco's Titan: it flies, and strikes flyers from the air.",
     dict(kind=U, art="titan", form=True, hero=True, domain="air", armor="air", hovers=True)),
    ("车力巨人", "cart-titan", "Cart Titan", "Four-legged and tireless, and quicker than it looks.",
     dict(kind=U, art="strip", form=True, hero=True, armor="heavy")),
    ("车力巨人（大炮）", "cart-titan-cannon", "Cart Titan (artillery)", "The Cart Titan with Marley's cannon on its back: a battery that walks.",
     dict(kind=U, art="strip", form=True, hero=True, armor="heavy")),
    ("战锤巨人", "war-hammer-titan", "War Hammer Titan", "Forges weapons of hardened crystal, and strikes from afar with them.",
     dict(kind=U, art="strip", form=True, hero=True, armor="heavy")),
    # the mindless: what an Eldian becomes, and the Walls' own Titans
    ("小型巨人2", "pure-small", "Small Titan", "A mindless Titan: quick, and quick to bite.",
     dict(kind=U, art="titan", form=True, armor="heavy")),
    ("中型无垢巨人2", "pure-medium", "Medium Titan", "A mindless Titan.",
     dict(kind=U, art="titan", form=True, armor="heavy")),
    ("大型无垢巨人2", "pure-large", "Large Titan", "A mindless Titan, fifteen metres tall.",
     dict(kind=U, art="titan", form=True, armor="heavy")),
    ("胖子巨人2", "pure-fat", "Fat Titan", "A mindless Titan with a great deal to spare.",
     dict(kind=U, art="titan", form=True, armor="heavy")),
    ("戴娜巨人2", "smiling-titan", "Smiling Titan", "Dina Fritz, with her fixed smile.",
     dict(kind=U, art="titan", form=True, armor="heavy")),
    ("奇行种a3", "long-neck-abnormal", "Long-Necked Abnormal", "An abnormal: it does not do what Titans do.",
     dict(kind=U, art="titan", form=True, armor="heavy")),
    ("奇行种4", "leaping-abnormal", "Leaping Abnormal", "It leaps at flyers in the air, and crushes what it lands on.",
     dict(speed=95, kind=U, art="titan", form=True, armor="heavy", domain="ground")),
    ("狗爬巨人2", "crawling-abnormal", "Crawling Abnormal", "Lies in wait on all fours, then runs down what it has chosen.",
     dict(kind=U, art="titan", form=True, armor="heavy")),
    ("娇奔巨人2", "running-abnormal", "Running Abnormal", "Sprints with its arms flung wide.",
     dict(weapons=[maul("bite", 70, 1.5, 30)], kind=U, art="titan", form=True, armor="heavy")),
    ("红眼巨人2", "red-eyed-abnormal", "Red-Eyed Abnormal", "Red eyes, and a hunter's temper.",
     dict(kind=U, art="titan", form=True, armor="heavy")),
    ("地鸣巨", "wall-titan", "Wall Titan", "One of the countless Colossal Titans sealed in the Walls. Where it walks the earth shakes, and everything underfoot is crushed.",
     dict(weapons=[maul("trample", 60, 2.5, 50)], kind=U, art="titan", form=True, armor="heavy", tier=3)),
]

# what a squad or a building makes, what a builder places
PRODUCTION = {
    "paradis-hq": ["garrison", "carriage", "field-cannon", "wheeled-cannon"],
    "stable": ["horse", "carriage"],
    "odm-camp": ["scout-squad", "military-police-squad", "anti-personnel-squad", "erwin", "mikasa", "levi", "floch", "kenny"],
    "odm-camp-2": ["scout-squad", "military-police-squad", "anti-personnel-squad", "thunder-spear-squad", "erwin", "mikasa", "levi",
                   "floch", "kenny", "eren", "armin", "grisha", "zeke", "eldian-squad", "rod-reiss"],
    "marley-hq": ["marley-engineer", "marley-truck"],
    "marley-factory": ["marley-rifle-squad", "marley-mg-squad", "marley-grenadier-squad", "marley-at-squad", "marley-flame-squad",
                       "marley-troop-truck", "marley-armored-car", "marley-tank", "anti-titan-gun"],
    "super-heavy-factory": ["super-heavy-tank"],
    "air-factory": ["fighter", "heavy-bomber"],
    "airship-factory": ["combat-airship", "strategic-airship"],
    "naval-yard": ["landing-craft", "frigate", "ironclad", "battleship"],
    "me-naval-yard": ["landing-craft", "frigate", "ironclad", "battleship"],
    "warrior-ground": ["gabi", "porco", "falco", "pieck", "lara", "annie", "reiner", "bertholdt", "zeke", "eldian-squad"],
    "me-hq": ["me-engineer", "me-truck"],
    "me-factory": ["me-rifle-squad", "me-sapper-squad", "me-hmg", "me-mortar", "me-truck", "me-light-tank", "me-tank", "me-at-gun", "me-howitzer"],
}
BUILDERS = {
    "garrison": ["paradis-hq", "odm-camp", "academy", "giant-tree", "house", "bell-tower", "stable", "wall-cannon", "wall", "wall-v", "gate"],
    "marley-engineer": ["marley-hq", "marley-factory", "super-heavy-factory", "air-factory", "airship-factory", "naval-yard", "warrior-ground",
                        "institute", "sniper-tower", "aa-mg", "repair-station", "repair-depot", "coastal-gun"],
    "me-engineer": ["me-hq", "me-factory", "me-naval-yard", "me-wall", "me-fort", "me-bunker", "me-mortar-emplacement", "institute",
                    "sniper-tower", "aa-mg", "repair-station"],
}
# the command buildings the game's own engineer places: each faction starts here
ENGINEER_BUILDS = ["paradis-hq", "marley-hq", "me-hq"]
# a shifter and its Titan: (Titan, metal, seconds, requires)
SHIFTS = {
    "eren": ("attack-titan", 150, 5, []), "grisha": ("attack-titan-grisha", 150, 5, []), "zeke": ("beast-titan", 200, 5, []),
    "armin": ("colossal-armin", 400, 8, []), "bertholdt": ("colossal", 400, 8, []), "reiner": ("armored-titan", 150, 5, []),
    "annie": ("female-titan", 150, 5, []), "porco": ("jaw-titan", 150, 5, []), "falco": ("bird-titan", 200, 6, []),
    "pieck": ("cart-titan", 100, 4, []), "lara": ("war-hammer-titan", 200, 6, []),
}
RUMBLING = ("eren", "founding-titan", 2000, 30, ["academy", "odm-camp-2"])
SHIFT_REST = 20             # seconds a shifter is human before it may shift again
TITAN_TIME_MIN, TITAN_TIME_MAX = 90, 600
# the mindless Titans an Eldian may become, with the package's odds
TITANIZE = [("pure-small", 0.2), ("pure-medium", 0.2), ("pure-large", 0.2), ("pure-fat", 0.12), ("long-neck-abnormal", 0.06),
            ("leaping-abnormal", 0.06), ("crawling-abnormal", 0.06), ("running-abnormal", 0.06), ("red-eyed-abnormal", 0.01),
            ("smiling-titan", 0.03)]


# ------------------------------------------------------------------ media
SHEETS = []
SHEET_BY_HASH = {}
SOUND_JOBS = {}     # src path -> (key, out file, seconds)
NOTES = []
OUT_SPRITES = os.path.join(OUT, "sprites")
OUT_SOUNDS = os.path.join(OUT, "sounds")


def note(unit, msg):
    NOTES.append(f"{unit}: {msg}")


def clean_alpha(im):
    """drop near-invisible alpha, and keep every pixel out of the game's magenta remap test
    (r>60 && b>60 && (r+b)/2-g>28 && |r-b|<95): the package paints no faction colour, and the
    blood and the Titans' pink flesh would be caught"""
    im = im.convert("RGBA")
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a < 24:
                px[x, y] = (0, 0, 0, 0)
                continue
            if r > 60 and b > 60 and (r + b) / 2 - g > 28 and abs(r - b) < 95:
                g = min(255, int((r + b) / 2 - 27))
                px[x, y] = (r, g, b, a)
    return im


def open_art(path):
    if not path or not os.path.exists(path):
        return None
    if os.path.basename(path).lower() in ("null.png", "blank.png", "none.png", "空.png", "null2.png"):
        return None
    im = Image.open(path).convert("RGBA")
    return im if im.getbbox() else None


def add_sheet(key, im, frames, rotated, fw=None, fh=None, pivot_y=None, mount=None, pivot_x=None, anims=None, fps=None):
    """dedupe identical art: a second def naming the same picture shares the sheet"""
    if frames == 1 and (im.width < 4 or im.height < 4):
        # the game takes a picture under 4 px for a missing file ("not an image"): a one-pixel
        # tracer is padded out about its centre, so its pivot stays where it was
        w, h = max(4, im.width), max(4, im.height)
        cv = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        cv.alpha_composite(im.convert("RGBA"), ((w - im.width) // 2, (h - im.height) // 2))
        im = cv
    h = hashlib.md5(im.tobytes()).hexdigest() + f":{im.size}:{frames}:{fw}:{fh}:{pivot_x}:{pivot_y}:{mount}:{anims}:{fps}"
    if h in SHEET_BY_HASH:
        return SHEET_BY_HASH[h]
    taken = {e["key"] for e in SHEETS}
    k, n = key, 2
    while k in taken:
        k = f"{key}-{n}"
        n += 1
    entry = {"key": k, "file": f"sprites/{k}.png", "frames": frames}
    # the package's art has its own alpha: nothing for the loader to strip, sweep or re-align
    # (a wall's grey fills its frame to the edge and would be taken for a background)
    entry.update(stripBg=False, artifactCleanup=False)
    if frames > 1:
        entry["stabilize"] = False
    if anims:
        entry["anims"] = anims
    if fps:
        entry["fps"] = fps
    if rotated:
        entry.update(rotated=True, fw=fw, fh=fh)
        if pivot_x is not None and abs(pivot_x - 0.5) > 0.01:
            entry["pivotX"] = round(pivot_x, 3)
        if pivot_y is not None and abs(pivot_y - 0.5) > 0.01:
            entry["pivotY"] = round(pivot_y, 3)
    elif fw:
        entry.update(fw=fw, fh=fh)
    if mount and 0 <= mount[0] <= 1 and 0 <= mount[1] <= 1:
        entry["mount"] = [round(mount[0], 3), round(mount[1], 3)]
    if not DRY and not NO_MEDIA:
        im.save(os.path.join(OUT_SPRITES, f"{k}.png"), optimize=True)
    SHEETS.append(entry)
    SHEET_BY_HASH[h] = k
    return k


def sound_slug(src):
    base = os.path.splitext(os.path.basename(src))[0]
    base = re.sub(r"[_(（]\d*[)）]?$", "", base)
    words = {"砍": "slash", "斩": "slash", "攻击": "strike", "射击": "shot", "火枪开火": "musket", "开火": "shot", "枪": "gun",
             "发射绳索": "hook", "收回绳索": "reel", "爆炸": "blast", "吼叫": "roar", "吃人": "bite", "打击": "hit", "撞击": "crash",
             "蒸汽释放": "steam", "变身": "shift", "硬质化结晶": "harden", "心跳": "heartbeat", "炮": "cannon", "机枪": "mg",
             "步枪": "rifle", "喷火": "flame", "投掷": "throw", "喷气": "gas", "利威尔": "levi", "超巨": "colossal", "女巨": "female"}
    slug = re.sub(r"[^a-z0-9]+", "-", base.lower()).strip("-")
    if not slug or re.fullmatch(r"\d+", slug):
        out = []
        for zh, en in sorted(words.items(), key=lambda kv: -len(kv[0])):
            if zh in base and en not in out:
                out.append(en)
                base = base.replace(zh, "")
        slug = "-".join(out) or os.path.basename(os.path.dirname(src))
        slug = re.sub(r"[^a-z0-9]+", "-", slug.lower()).strip("-") or "sound"
    return slug[:40]


def add_sound(src, seconds_max=0.9):
    """one slot per recording; a longer allowance for a roar than for a gunshot"""
    if src in SOUND_JOBS:
        return SOUND_JOBS[src][0]
    h = hashlib.md5(open(src, "rb").read()).hexdigest()
    for s, job in SOUND_JOBS.items():
        if job[3] == h:
            SOUND_JOBS[src] = job
            return job[0]
    slug = sound_slug(src)
    key = f"{MOD_ID}-{slug}"
    taken = {v[0] for v in SOUND_JOBS.values()}
    n = 2
    while key in taken:
        key = f"{MOD_ID}-{slug}-{n}"
        n += 1
    SOUND_JOBS[src] = (key, f"sounds/{key[len(MOD_ID) + 1:]}.mp3", seconds_max, h)
    return key


def write_sounds():
    if NO_MEDIA or DRY:
        return
    shutil.rmtree(OUT_SOUNDS, ignore_errors=True)
    os.makedirs(OUT_SOUNDS)
    done = set()
    for src, (key, out, secs, _) in SOUND_JOBS.items():
        if key in done:
            continue
        done.add(key)
        fade = max(0.1, secs * 0.2)
        af = (f"silenceremove=start_periods=1:start_threshold=-38dB,afade=t=out:st={secs - fade:.2f}:d={fade:.2f},"
              "aformat=channel_layouts=mono,alimiter=limit=0.95")
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", src, "-af", af, "-t", f"{secs:.2f}", "-ar", "44100", "-b:a", "96k",
                        os.path.join(OUT, out)], check=True)


def pkg(rel):
    """a file of the package by its path"""
    p = os.path.join(RW, rel)
    assert os.path.exists(p), rel
    return p


# ------------------------------------------------------------------ art
def prep(im, scale=1.0, angle=0.0, frame0=1):
    """a picture as the package draws it: the first frame of a strip, scaled, turned (degrees clockwise)"""
    im = clean_alpha(im)
    if frame0 > 1:
        im = im.crop((0, 0, im.width // frame0, im.height))
    w, h = im.width * scale, im.height * scale
    if abs(w - im.width) > 0.5 or abs(h - im.height) > 0.5:
        im = im.resize((max(1, round(w)), max(1, round(h))), Image.LANCZOS)
    if angle % 360:
        im = im.rotate(-angle, resample=Image.BICUBIC, expand=True)
    return im


def lay(items, W=None, H=None):
    """one picture centred on the pivot with every item laid at its place: (image, x, y), px, y forward"""
    if W is None:
        half_w = half_h = 1.0
        for im, x, y in items:
            half_w = max(half_w, abs(x) + im.width / 2)
            half_h = max(half_h, abs(y) + im.height / 2)
        W, H = int(math.ceil(half_w * 2)) + 2, int(math.ceil(half_h * 2)) + 2
    cv = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for im, x, y in items:
        cv.alpha_composite(im, (int(round(W / 2 + x - im.width / 2)), int(round(H / 2 - y - im.height / 2))))
    return cv


def trim_frames(frames):
    """frames cut alike to what any of them paints, about the centre, so the pivot stays put"""
    W, H = frames[0].size
    bb = None
    for f in frames:
        b = f.getbbox()
        if b:
            bb = b if bb is None else (min(bb[0], b[0]), min(bb[1], b[1]), max(bb[2], b[2]), max(bb[3], b[3]))
    if not bb:
        return frames
    hw = max(W / 2 - bb[0], bb[2] - W / 2) + 1
    hh = max(H / 2 - bb[1], bb[3] - H / 2) + 1
    x0, x1 = int(max(0, math.floor(W / 2 - hw))), int(min(W, math.ceil(W / 2 + hw)))
    y0, y1 = int(max(0, math.floor(H / 2 - hh))), int(min(H, math.ceil(H / 2 + hh)))
    return [f.crop((x0, y0, x1, y1)) for f in frames]


def fit_width(im, w):
    """a picture widened with clear columns, or narrowed, about its middle to `w` px"""
    w = max(1, int(round(w)))
    out = Image.new("RGBA", (w, im.height), (0, 0, 0, 0))
    if w >= im.width:
        out.alpha_composite(im, ((w - im.width) // 2, 0))
    else:
        x0 = (im.width - w) // 2
        out.alpha_composite(im.crop((x0, 0, x0 + w, im.height)), (0, 0))
    return out


def strip_of(frames):
    W, H = frames[0].size
    out = Image.new("RGBA", (W * len(frames), H), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        out.alpha_composite(f, (i * W, 0))
    return out


def split_frames(im, n):
    fw = im.width // n
    return [im.crop((i * fw, 0, (i + 1) * fw, im.height)) for i in range(n)]


def resize_frames(frames, w, h):
    return [f.resize((max(1, round(w)), max(1, round(h))), Image.LANCZOS) for f in frames]


def anims_of(gfx, frames):
    """the package's frames by state (`animation_moving_*`, `_idle_*`, `_attack_*`), its speed
    being game ticks a frame at sixty a second"""
    out = {}
    for rw, ours in (("moving", "moving"), ("idle", "idle"), ("attack", "firing")):
        a, b = num(gfx.get(f"animation_{rw}_start")), num(gfx.get(f"animation_{rw}_end"))
        if a is None or b is None:
            continue
        a, b = int(a), int(b)
        if a < 0 or b < a or b >= frames:
            continue
        rng = [a, b]
        sp = num(gfx.get(f"animation_{rw}_speed"))
        if b > a and sp and sp > 0:
            rng.append(round(clamp(60 / sp, 0.3, 30), 2))
        out[ours] = rng
    return out or None


# Rusted Warfare composes a unit as it draws it: legs and arms (`[leg_N]`, `[arm_N]`) under the
# body or over it, the turrets on top, decals (`[decal_N]`) on the layer each names, attached units
# on theirs. The order and the scales below are the game's own (read from 1.15p9's classes).
DRAW_LAYERS = {"wreaks": 0, "underwater": 1, "bottom": 2, "ground": 3, "ground2": 4, "experimentals": 5, "air": 6, "top": 7}
DECAL_LAYERS = ("shadow", "beforeBody", "afterBody", "onTop", "beforeUI")


def expr_num(v):
    """a number the package may write as a sum (`60.0/30`), or with a unit's memory in it, read as
    it stands when the unit is new (every memory at 0)"""
    if v is None:
        return None
    s = str(v).strip()
    try:
        return float(s)
    except ValueError:
        pass
    s = re.sub(r"memory\.[\w一-鿿]+", "0", s)
    if not re.fullmatch(r"[\d.+\-*/() ,]*(?:(?:int|min|max)\([\d.+\-*/() ,]*\)[\d.+\-*/() ,]*)*", s):
        return None
    try:
        return float(eval(s, {"__builtins__": {}}, {"int": int, "min": min, "max": max}))
    except Exception:
        return None


def scale_key(v, default=1.0):
    """a scale as written: missing is the default, and 0 is 0 (a part the package hides so)"""
    n = expr_num(v)
    return default if n is None else n


def body_scale(ini, d):
    """the body's scale, which its legs and arms share: `imageScale`, times `scaleImagesTo` px over
    a frame's width when that is set"""
    gfx, core = ini.get("graphics", {}), ini.get("core", {})
    k = 1.0
    sit = num(gfx.get("scaleImagesTo"))
    p = resolve(gfx.get("image"), d)
    if sit and sit > 0 and p:
        fw = Image.open(p).width / max(1, int(num(gfx.get("total_frames")) or 1))
        k = sit * scale_key(core.get("globalScale")) / max(1.0, fw)
    return k * scale_key(gfx.get("imageScale"))


def turret_scale(ini, d):
    """every turret of a unit is drawn at one scale: `scaleTurretImagesTo` px over the width of the
    unit's `image_turret` (not the turret's own picture), else 1, times `turretImageScale`"""
    gfx, core = ini.get("graphics", {}), ini.get("core", {})
    k = 1.0
    stit = num(gfx.get("scaleTurretImagesTo"))
    p = resolve(gfx.get("image_turret"), d)
    if stit and stit > 0 and p:
        k = stit * scale_key(core.get("globalScale")) / max(1, Image.open(p).width)
    return k * scale_key(gfx.get("turretImageScale"))


def looks_like_shadow(path, im):
    """a picture laid under a unit as its shadow: named so (阴, shadow), or dark and grey (or
    see-through) all over; a small dark figure in a red coat is a crewman, not a shadow"""
    name = os.path.basename(path or "").lower()
    if "阴" in name or "shadow" in name:
        return True
    alpha = im.getchannel("A")
    mask = alpha.point(lambda v: 255 if v > 24 else 0)
    if not mask.getbbox():
        return True
    r, g, b = ImageStat.Stat(im.convert("RGB"), mask=mask).mean
    a = ImageStat.Stat(alpha, mask=mask).mean[0]
    return 0.299 * r + 0.587 * g + 0.114 * b < 40 and (max(r, g, b) - min(r, g, b) < 18 or a < 180)


def fade(im, alpha):
    im = im.copy()
    im.putalpha(im.getchannel("A").point(lambda v: int(v * alpha)))
    return im


def decal_items(ini, d):
    """the decals a unit always wears, by layer, as (image, x, y): RW px about its origin, x right
    and y forward like a turret's. A decal a condition shows (`isVisible`: a fire, a shield, a
    health bar), a selection shows, or only the preview shows is the package's play, not its look."""
    out = {k: [] for k in DECAL_LAYERS}
    secs, pos = turret_tree(ini)
    for s, kv in ini.items():
        if not s.startswith("decal_"):
            continue
        if any(kv.get(k) for k in ("isVisible", "drawLineTo", "basePositionFromLeg", "imageStack")):
            continue
        if any(boolish(kv.get(k)) for k in ("onlyWhenSelectedByOwnPlayer", "onlyWhenSelectedByEnemyPlayer", "onlyInPreview",
                                             "onlyWhenSelectedByAllyNotOwnPlayer", "onlyWhenSelectedByAnyPlayer")):
            continue
        layer = (kv.get("layer") or "afterBody").strip()
        if layer not in out:
            continue
        path = resolve(kv.get("image"), d)
        im = open_art(path)
        if im is None or looks_like_shadow(path, im):
            continue
        n = int(num(kv.get("total_frames")) or 1)
        if (num(kv.get("frame_width")) or 0) > 0:
            n = max(1, int(im.width // num(kv.get("frame_width"))))
        i = int(clamp(expr_num(kv.get("frame")) or 0, 0, n - 1))
        if n > 1:
            im = im.crop((i * im.width // n, 0, (i + 1) * im.width // n, im.height))
        k = scale_key(kv.get("imageScale"))
        if k <= 0:
            continue
        pic = prep(im, k, num(kv.get("dirOffset")) or 0)
        a = expr_num(kv.get("alpha"))
        if a is not None and a < 1:
            pic = fade(pic, a)
        x = (expr_num(kv.get("xOffsetRelative")) or 0) + (expr_num(kv.get("xOffsetAbsolute")) or 0)
        y = (expr_num(kv.get("yOffsetRelative")) or 0) - (expr_num(kv.get("yOffsetAbsolute")) or 0)
        base = (kv.get("basePositionFromTurret") or "").strip()
        if base and "turret_" + base in secs:
            bx, by_ = pos("turret_" + base)
            x, y = x + bx, y + by_
        out[layer].append((pic, x, y))
    return out


def limbs(ini, prefix):
    """the `[leg_N]` or `[arm_N]` sections, each with the one it copies (`copyFrom: M`) beneath it"""
    out = []
    for s, kv in ini.items():
        if not s.startswith(prefix):
            continue
        merged, src, seen = dict(kv), (kv.get("copyFrom") or "").strip(), set()
        while src and src not in seen and (prefix + src) in ini:
            seen.add(src)
            base = ini[prefix + src]
            for k, v in base.items():
                merged.setdefault(k, v)
            src = (base.get("copyFrom") or "").strip()
        out.append((s, merged))
    return out


def limb_items(ini, d, sc, anim_at=None):
    """legs and arms as they stand, at the body's scale: (under all units, under the body, over the
    body). Each is its end (a foot, a hand) at (x, y), and its length (`image_leg`, `image_middle`)
    as the game draws it: centred on that end and turned to point at where the limb joins the body
    (`attach_x`, `attach_y`), cut to no more than that distance either side of its middle."""
    ground, under, over = [], [], []
    for prefix in ("leg_", "arm_"):
        for s, kv in limbs(ini, prefix):
            if boolish(kv.get("hidden")):
                continue
            kx = ky = kd = 0.0
            if anim_at:
                kx, ky, kd = anim_at(prefix[:-1] + s[len(prefix):])
            x, y = (num(kv.get("x")) or 0) + kx, (num(kv.get("y")) or 0) + ky
            items = []
            end_ref = kv.get("image_end") or kv.get("image_foot")
            end = open_art(resolve(end_ref, d)) if end_ref else None
            if end is not None and sc > 0:
                ang = (num(kv.get("drawDirOffset")) or 0) + (num(kv.get("endDirOffset")) or 0) + kd
                items.append((prep(end, sc, ang), x, y))
            mid_ref = kv.get("image_middle") or kv.get("image_leg")
            mid = open_art(resolve(mid_ref, d)) if mid_ref else None
            ax, ay = num(kv.get("attach_x")), num(kv.get("attach_y"))
            if mid is not None and sc > 0 and ax is not None and ay is not None and math.hypot(ax - x, ay - y) > 2:
                half = mid.height / 2
                reach = min(math.hypot(ax - x, ay - y), half)
                seg = mid.crop((0, int(half - reach), mid.width, int(math.ceil(half + reach))))
                piece = (prep(seg, sc, math.degrees(math.atan2(ax - x, ay - y))), x, y)
                items = items + [piece] if not boolish(kv.get("draw_foot_on_top")) else [piece] + items
            if boolish(kv.get("drawUnderAllUnits")):
                # under all units: a limb laid on the ground, unless it is only the unit's shadow
                items = [it for it in items if not looks_like_shadow(end_ref, it[0])]
                ground += items
            else:
                (over if boolish(kv.get("drawOverBody")) else under).extend(items)
    return ground, under, over


def turret_tree(ini):
    """every turret's place about the unit's origin, up its attachedTo chain (RW px, y forward)"""
    secs = {s: kv for s, kv in ini.items() if s.startswith("turret_")}

    def pos(s, depth=0):
        kv = secs[s]
        x, y = num(kv.get("x")) or 0, num(kv.get("y")) or 0
        parent = (kv.get("attachedTo") or "").strip()
        if parent and depth < 6 and ("turret_" + parent) in secs:
            px, py = pos("turret_" + parent, depth + 1)
            return px + x, py + y
        return x, y
    return secs, pos


def visible_turrets(ini, d):
    """the turrets the package draws as a unit stands: every one that is always shown, and of the
    ones a script shows and hides, those shown on the first one's condition (a head that changes
    with the Titan's mood is one of several; a gun's two crewmen come and go together)"""
    gfx = ini.get("graphics", {})
    secs, pos = turret_tree(ini)
    out, shown_when = [], None
    for s, kv in secs.items():
        inv = (kv.get("invisible") or "").strip()
        if inv.lower() == "true":
            continue
        img = kv.get("image") or gfx.get("image_turret")
        im = open_art(resolve(img, d)) if img else None
        if im is None:
            continue
        if inv.lower().startswith("if"):
            when = re.sub(r"\s+", "", inv.lower())
            if shown_when is None:
                shown_when = when
            elif when != shown_when:
                continue
        out.append((s, im, pos(s), num(kv.get("idleDir")) or 0))
    return out


def turret_top(secs, s):
    """the turret at the head of `s`'s attachedTo chain, which turns and carries the rest"""
    seen = set()
    while s not in seen:
        seen.add(s)
        parent = (secs[s].get("attachedTo") or "").strip()
        if not parent or ("turret_" + parent) not in secs:
            break
        s = "turret_" + parent
    return s


def gun_chains(ini, d):
    """the guns that turn, each the head of a chain with the drawn turrets that ride on it — the
    head may be a ring with no picture of its own (a tank's `turret_3: null.png` under its turret
    and barrel) — as {head: [(section, image, place, idle)]}, in the package's order"""
    secs, _ = turret_tree(ini)
    chains = {}
    for t in visible_turrets(ini, d):
        chains.setdefault(turret_top(secs, t[0]), []).append(t)
    return chains


def chain_damage(ini, top):
    """the hardest round any turret of the chain under `top` fires: what ranks the guns"""
    secs, _ = turret_tree(ini)
    best = 0.0
    for s, kv in secs.items():
        if turret_top(secs, s) != top or not boolish(kv.get("canShoot"), True):
            continue
        proj = (kv.get("projectile") or "").strip() or s[len("turret_"):]
        if f"projectile_{proj}" in ini:
            direct, area, _, pellets, _ = payload(ini, ini[f"projectile_{proj}"])
            best = max(best, max(direct, area) * pellets)
    return best


def gun_root(ini, d):
    """the head of the unit's main gun: of the chains drawn, the one that fires hardest, then the
    one of most parts, then the one nearest the centre"""
    _, pos = turret_tree(ini)
    chains = gun_chains(ini, d)
    if not chains:
        return None
    return max(chains, key=lambda t: (chain_damage(ini, t), len(chains[t]), -(abs(pos(t)[0]) + abs(pos(t)[1]))))


def chain_picture(ini, d, top, chain, k):
    """a chain drawn about its head as the head points forward (RW px, y forward): what rides on a
    turret is placed in its frame and turned with it, so an aft turret's barrels point aft only
    because the turret does"""
    secs, pos = turret_tree(ini)
    tx, ty = pos(top)
    rest = num(secs[top].get("idleDir")) or 0
    return [(prep(im, k, idle - rest), x - tx, y - ty) for s, im, (x, y), idle in chain]


def chain_rig(ini, d, top, chain):
    """what a chain is made of, about its head: guns alike have the same"""
    secs, pos = turret_tree(ini)
    tx, ty = pos(top)
    rest = num(secs[top].get("idleDir")) or 0
    gfx = ini.get("graphics", {})
    return tuple(sorted((os.path.basename(resolve(secs[s].get("image") or gfx.get("image_turret"), d) or ""),
                         round(x - tx, 1), round(y - ty, 1), round((idle - rest) % 360)) for s, im, (x, y), idle in chain))


def painted_chain(ini, d, top, chain, k):
    """a chain that does not turn here, painted on the hull as it stands: its picture turned to its
    head's rest bearing and laid at the head's place"""
    secs, pos = turret_tree(ini)
    pic = lay(chain_picture(ini, d, top, chain, k))
    return (prep(pic, 1.0, num(secs[top].get("idleDir")) or 0), *pos(top))


def body_offset(gfx):
    """where the body's picture sits on the unit (`image_offsetX/Y`, screen px): RW px, y forward"""
    return num(gfx.get("image_offsetX")) or 0, -(num(gfx.get("image_offsetY")) or 0)


def body_parts(ini, d, anim_at=None, turrets=True):
    """a unit drawn from its parts in the game's order (RW px about the origin, y forward, each
    (image, x, y)): its shadow-layer decals, the limbs laid under all units, the decals before
    the body, the limbs under it, the body, the limbs over it, the decals after it, the turrets,
    and the decals on top. `anim_at` is a function from a limb's name (`arm3`, `leg1`) to its
    keyframed offset (x, y, turn) at the moment drawn."""
    gfx = ini.get("graphics", {})
    sc = body_scale(ini, d)
    ground, under, over = limb_items(ini, d, sc, anim_at)
    dec = decal_items(ini, d)
    items = dec["shadow"] + ground + dec["beforeBody"] + under
    body = open_art(resolve(gfx.get("image"), d))
    if body is not None and sc > 0:
        fr = int(num(gfx.get("total_frames")) or 1)
        items.append((prep(body, sc, frame0=fr), *body_offset(gfx)))
    items += over + dec["afterBody"]
    k = turret_scale(ini, d)
    for s, im, (x, y), idle in (visible_turrets(ini, d) if turrets and k > 0 else []):
        items.append((prep(im, k, idle), x, y))
    return items + dec["onTop"] + dec["beforeUI"]


def keyframes(anim, part):
    """an arm's keyframes in an `[animation_*]` section: [(t, x, y, turn)], in seconds"""
    ts = num(anim.get("KeyframeTimeScale")) or 1.0
    out = []
    for k, v in anim.items():
        m = re.match(rf"^{re.escape(part)}_([\d.]+)s$", k)
        if not m:
            continue
        vals = dict(re.findall(r"(\w+)\s*:\s*(-?[\d.]+)", v))
        out.append((float(m.group(1)) * ts, float(vals.get("x", 0)), float(vals.get("y", 0)), float(vals.get("dir", 0))))
    return sorted(out)


def pose_at(kfs, t):
    """an arm's offset at `t`, eased linearly from rest (0, 0, 0) to its first keyframe and on"""
    if not kfs:
        return (0.0, 0.0, 0.0)
    pts = ([(0.0, 0.0, 0.0, 0.0)] if kfs[0][0] > 0 else []) + kfs
    if t >= pts[-1][0]:
        return pts[-1][1:]
    for a, b in zip(pts, pts[1:]):
        if a[0] <= t <= b[0]:
            f = (t - a[0]) / max(1e-6, b[0] - a[0])
            return tuple(a[i] + (b[i] - a[i]) * f for i in (1, 2, 3))
    return pts[-1][1:]


def anim_section(ini, action):
    """the `[animation_*]` a unit plays for `move` or `attack`, and how long it runs"""
    best = None
    for s, kv in ini.items():
        if not s.startswith("animation_"):
            continue
        acts = (kv.get("onActions") or "").lower()
        name = s[len("animation_"):].lower()
        hit = action in acts or (action == "move" and name in ("move", "跑步", "走路")) or \
            (action == "attack" and name in ("attack", "攻击动画", "a"))
        if not hit:
            continue
        ts = [kf[0] for part in {re.match(r"^((?:arm|leg)\w+?)_[\d.]+s$", k).group(1) for k in kv if re.match(r"^((?:arm|leg)\w+?)_[\d.]+s$", k)}
              for kf in keyframes(kv, part)]
        if ts and (best is None or "onactions" in {k.lower() for k in kv}):
            best = (kv, max(ts))
    return best


def titan_frames(ini, d, n_move=8, n_atk=6):
    """a Titan's sheet from its parts: standing, a walk cycle, and a strike, each posed at the
    package's own keyframes. Returns (frames, anims, the standing picture's size in RW px)."""
    poses = [None]
    move = anim_section(ini, "move")
    atk = anim_section(ini, "attack")
    anims = {"idle": [0, 0]}
    if move:
        kv, length = move
        n = n_move
        poses += [(kv, length * i / n) for i in range(n)]
        anims["moving"] = [1, n, round(clamp(n / max(0.2, length), 1, 30), 2)]
    if atk:
        kv, length = atk
        a0 = len(poses)
        poses += [(kv, length * (i + 0.5) / n_atk) for i in range(n_atk)]
        anims["firing"] = [a0, a0 + n_atk - 1, round(clamp(n_atk / max(0.2, length), 1, 30), 2)]
    pictures = []
    for p in poses:
        at = None
        if p:
            kv, t = p
            at = (lambda part, kv=kv, t=t: pose_at(keyframes(kv, part), t))
        pictures.append(body_parts(ini, d, at))
    half_w = half_h = 1.0
    for items in pictures:
        for im, x, y in items:
            half_w = max(half_w, abs(x) + im.width / 2)
            half_h = max(half_h, abs(y) + im.height / 2)
    W, H = int(math.ceil(half_w * 2)) + 2, int(math.ceil(half_h * 2)) + 2
    frames = trim_frames([clean_alpha(lay(items, W, H)) for items in pictures])
    rest = frames[0].getbbox()
    size = (rest[2] - rest[0], rest[3] - rest[1]) if rest else frames[0].size
    return frames, anims, size


# ---------------------------------------------------------------- weapons
BUILTIN_SOUNDS = {"tank_firing": "cannon", "missile_fire": "missile", "plasma_fire": "autocannon", "large_gun_fire1": "cannon",
                  "large_gun_fire2": "cannon", "gun_fire": "mg", "firing3": "mg", "nuke_launch": "arty", "nuke_explode": "arty",
                  "flamethrower": "flame", "bug_die": "mg"}


def weapon_sound(shoot, d):
    if not shoot:
        return None
    first = split_list(shoot)[0] if split_list(shoot) else ""
    first = re.sub(r":[\d.]+$", "", first)
    low = first.lower()
    if low in BUILTIN_SOUNDS:
        return BUILTIN_SOUNDS[low]
    if not re.search(r"\.(ogg|wav|mp3)$", low):
        return None
    hit = resolve(first, d)
    return add_sound(hit) if hit else None


def projectile_look(p, d, who, wid):
    """the package's own picture for a round: a boulder, a shell, a thunder spear"""
    img = (p.get("image") or "").strip()
    if not img or img.upper() == "NONE":
        return None
    pim = open_art(resolve(img, d))
    if pim is None:
        return None
    pim = clean_alpha(pim)
    n = max(1, pim.width // max(1, pim.height))
    i = int(clamp(num(p.get("frame")) or 0, 0, n - 1))
    fr = pim.crop((i * pim.width // n, 0, (i + 1) * pim.width // n, pim.height))
    bb = fr.getbbox()
    if not bb:
        return None
    fr = fr.crop(bb)
    k = 0.5 * (num(p.get("drawSize")) or 1.0)
    fw, fh = int(clamp(round(fr.width * k), 4, 48)), int(clamp(round(fr.height * k), 4, 48))
    return {"sprite": add_sheet(f"prj.{who}-{wid}"[:44], fr, 1, True, fw, fh)}


# the tags a turret aims only at that are a script's business: a collider, a boulder, the enemy's heart
SCRIPT_TAGS = {"center", "巨石", "后颈", "后颈2", "wall_v", "碰撞体", "钩"}
# the tags that say a gun is for ships and the largest Titans only
NAVAL_TAGS = {"海军", "tyoogatakyojin"}


def range_tiles(px):
    """a reach in RW px as tiles here: the package fights at long range, so the long end is pressed
    in — a rifle's 350 px is 6 tiles, a coastal gun's 1100 is 10.5"""
    t = px / 20
    return clamp(0.5 * t if t <= 8 else 4.0 * (t / 8) ** 0.5, 0.6, 12)


def payload(ini, p, depth=0):
    """what a round does when it lands, following the rounds it spawns (`spawnProjectilesOnCreate`,
    `…OnEndOfLife`): (direct, area, radius, pellets, the section that does it)"""
    direct = num(p.get("directDamage")) or 0
    area = num(p.get("areaDamage")) or 0
    if (direct > 0 or area > 0) or depth > 3:
        return direct, area, num(p.get("areaRadius")) or 0, 1, p
    for key in ("spawnProjectilesOnCreate", "spawnProjectilesOnEndOfLife"):
        v = (p.get(key) or "").strip()
        m = re.match(r"\s*([^*(,\s]+)\s*(?:\*\s*(\d+))?", v)
        if m and f"projectile_{m.group(1)}" in ini:
            dd, aa, rr, n, sec = payload(ini, ini[f"projectile_{m.group(1)}"], depth + 1)
            if dd > 0 or aa > 0:
                return dd, aa, rr, n * int(m.group(2) or 1), sec
    return 0, 0, 0, 1, p


def convert_weapons(ini, d, domain, ov, who, radius_tiles, titan=False):
    """the package's turrets and rounds as weapons: one per round, the turrets that fire it
    counted as barrels or a burst. A turret a script fires (`canShoot: false`), one only the AI
    may use, an interceptor, or one that strikes only one tag is left out: an action's, not a gun's."""
    atk = ini.get("attack", {})
    secs, pos = turret_tree(ini)
    melee_flag = boolish(atk.get("isMelee"))
    range_px = num(atk.get("maxAttackRange")) or (30 if melee_flag else 130)
    delay_default = seconds(atk.get("shootDelay")) or 1.0
    can_land = boolish(atk.get("canAttackLandUnits"), True)
    can_air = boolish(atk.get("canAttackFlyingUnits"), False)
    can_sub = boolish(atk.get("canAttackUnderwaterUnits"), False)
    turret_size = num(atk.get("turretSize")) or 0
    groups = {}
    for s, kv in secs.items():
        if not boolish(kv.get("canShoot"), True) or "拦截" in s:
            continue
        cond = (kv.get("canAttackCondition") or "").replace(" ", "")
        if "isControlledByAI()" in cond and "notself.isControlledByAI" not in cond:
            continue
        only = {t.strip() for t in (kv.get("canOnlyAttackUnitsWithTags") or "").split(",") if t.strip()}
        if only and only <= SCRIPT_TAGS:
            continue
        proj = (kv.get("projectile") or "").strip()
        if not proj:
            n = s[len("turret_"):]
            proj = n if f"projectile_{n}" in ini else ""
        if not proj or f"projectile_{proj}" not in ini:
            continue
        groups.setdefault(proj, []).append((s, kv, pos(s)))
    weapons = []
    core = ini.get("core", {})
    for proj, turrets in groups.items():
        p0 = ini[f"projectile_{proj}"]
        direct, area, ar, pellets, p = payload(ini, p0)
        dmg_rw = max(direct, area) * (1 + (pellets - 1) * 0.6)
        if dmg_rw <= 0:
            continue
        kv = turrets[0][1]
        reload = max(1 / 60, seconds(kv.get("delay")) or delay_default) + (seconds(kv.get("warmup")) or 0)
        usage = num(kv.get("energyUsage")) or 0
        emax = num(core.get("energyMax")) or 0
        regen = num(core.get("energyRegenWhenRecharging")) or num(core.get("energyRegen")) or 0
        if usage > 0 and emax > 0 and regen > 0:
            shots = max(1, emax / usage)
            reload = min(30.0, reload + emax / regen / 60 / shots)
        if kv.get("resourceUsage"):
            reload = max(reload, 3.0)  # a stock of rounds the package refills by hand: a slow reload here
        snd = (kv.get("shoot_sound") or "").lower()
        homing = (num(p.get("turnSpeed")) or 0) > 0 and not boolish(p.get("instant"))
        arc = boolish(p0.get("ballistic")) or boolish(p.get("ballistic")) or (num(p0.get("initialUnguidedSpeedHeight")) or 0) > 0 or ov.get("arc", False)
        flame = boolish(p.get("flameWeapon")) or "flame" in snd or "喷火" in snd
        instant = boolish(p0.get("instant")) or boolish(p.get("instant"))
        t_air = any(boolish(t[1].get("canAttackFlyingUnits"), can_air) for t in turrets)
        t_land = any(boolish(t[1].get("canAttackLandUnits"), can_land) for t in turrets)
        t_sub = any(boolish(t[1].get("canAttackUnderwaterUnits"), can_sub) for t in turrets)
        targets = (["ground", "ship"] if t_land else []) + (["air"] if t_air else []) + (["sub"] if t_sub else [])
        only = {t.strip() for kv_ in (x[1] for x in turrets) for t in (kv_.get("canOnlyAttackUnitsWithTags") or "").split(",") if t.strip()}
        if only and only <= NAVAL_TAGS:
            targets = ["ship"] + (["ground"] if "tyoogatakyojin" in only else [])
        if not targets:
            targets = ["ground", "ship"]
        only_air = t_air and not t_land and not t_sub
        dmg = dmg_rw * DMG
        if reload < 0.3:
            k = math.ceil(0.3 / reload)
            reload *= k
            dmg *= k
        lim = num(kv.get("limitingRange"))
        px = lim if lim and lim < range_px * 3 else range_px
        is_melee = (melee_flag and px <= 60) or px < 25
        rng = range_tiles(px)
        if domain == "air" and not only_air and not is_melee:
            rng = max(rng, 2.4)
        if is_melee:
            # a melee reach is measured from the striker's edge: a Titan's arm is long
            rng = round(clamp(radius_tiles * 0.7 + 0.5, 0.6, 4), 1)
        big = ar >= 45 and dmg >= 20
        if flame:
            rng = max(rng, 2.6)
            cls, projectile = "he", "flame"
        elif only_air:
            cls, projectile = "aa", ("missile" if homing else "flak")
        elif t_sub and not t_land:
            cls, projectile = "torpedo", "torpedo"
        elif is_melee:
            cls, projectile = ("he", "bullet") if titan else ("at", "bullet")
        elif arc:
            cls, projectile = "he", "shell"
        elif domain == "air" and boolish(p.get("targetGround")) and big:
            cls, projectile = "he", "bomb"
        elif homing:
            cls, projectile = "at", "missile"
        elif big and direct >= area * 0.8:
            cls, projectile = ("navgun" if domain == "ship" else "cannon"), "shell"
        elif big:
            cls, projectile = "he", "shell"
        elif dmg < 12:
            cls, projectile = "mg", "bullet"
        elif dmg < 36:
            cls, projectile = "autocannon", "bullet"
        else:
            cls, projectile = "cannon", "shell"
        wid = re.sub(r"[^a-z0-9_-]", "", proj.lower()) or f"w{len(weapons) + 1}"
        if wid[0].isdigit():
            wid = "w" + wid
        w = {"id": wid, "cls": cls, "dmg": round(dmg, 1), "reload": round(max(0.05, reload), 2), "range": round(rng, 1),
             "targets": targets, "projectile": projectile}
        speed = num(p.get("speed")) or num(p0.get("speed"))
        if is_melee or instant:
            w["speed"] = 1500
        elif flame:
            w["speed"] = 240
        elif speed:
            w["speed"] = int(clamp(round(speed * 60 * 0.9), 60, 1500))
        else:
            w["speed"] = 900 if cls in ("mg", "autocannon") else 500
        if area > 0 and ar and not flame and (big or is_melee):
            w["splash"] = int(round(clamp(ar * 0.5, 4, 120)))
        if homing:
            w["homing"] = True
        if arc and cls == "he" and projectile == "shell":
            w["arc"] = True
        if is_melee and titan:
            w["mult"] = {"heavy": 1.0}
        elif is_melee:
            w["mult"] = {"light": 1.0, "medium": 0.9}
        if flame:
            glob = clamp(dmg * 0.5, 3, 14)
            w.update(fan=0.22, burn=round(clamp(glob * 1.5, 4, 18), 1), burnLife=5, splash=30, burst=12, burstDelay=0.04)
            w["dmg"] = round(glob, 1)
            w["reload"] = round(max(2.2, reload * 4), 2)
        n = len(turrets)
        if n > 1 and not flame and not is_melee:
            xs = sorted(t[2][0] for t in turrets)
            if n == 2 and abs(xs[0] + xs[1]) < 1 and abs(xs[1] - xs[0]) > 1:
                w["bores"] = 2
                w["boreSpacing"] = round(min(60, (xs[1] - xs[0]) * 0.8), 1)
            else:
                w["burst"] = min(8, n)
                w["burstDelay"] = 0.12
        spread = num(p.get("targetGroundSpread")) or num(p0.get("targetGroundSpread"))
        if spread and not is_melee and (arc or big):
            w["spread"] = int(round(clamp(spread * 0.5, 2, 60)))
        if pellets > 1:
            w["spread"] = max(w.get("spread", 0), 10)
            w["projectile"] = "bullet"
        w["_reach"] = turrets[0][2][1] + (num(kv.get("size")) or turret_size or 0)
        w["_melee"] = is_melee
        s_ = weapon_sound(kv.get("shoot_sound"), d)
        if s_:
            w["sound"] = s_
        elif flame:
            w["sound"] = "flame"
        look = None if is_melee else projectile_look(p, d, who, wid)
        if look:
            w["look"] = look
        weapons.append(w)
    weapons.sort(key=lambda w: -(w["dmg"] * w.get("burst", 1) / max(0.05, w["reload"])))
    return weapons


def attachments(ini, by_name):
    """the units the package bolts on (`[attachment_*]`): a ship's guns, a truck's hook, a
    stable's fences, as (their ini, their folder, x, y, name, the attachment's own keys, its
    section), RW px, y forward"""
    out = []
    for s, kv in ini.items():
        if not s.startswith("attachment_"):
            continue
        name = strip_quotes(kv.get("onCreateSpawnUnitOf", ""))
        if name in ("钩子",):
            continue
        p = by_name.get(name)
        if not p:
            continue
        out.append((load_unit(p), os.path.dirname(p), num(kv.get("x")) or 0, num(kv.get("y")) or 0, name, kv, s))
    return out


def draw_layer(ini):
    return DRAW_LAYERS.get((ini.get("graphics", {}).get("drawLayer") or "").strip())


def attached_items(ini, by_name, depth=0, skip=()):
    """what the attached units draw as they stand, laid where they ride and turned to their rest
    bearing (`idleDir`: a battleship's aft gun looks aft), RW px, y forward, as (under the unit,
    over it): one the attachment puts at the bottom (`setDrawLayerOnBottom`), or that names a lower
    draw layer than the unit's own (a stable's yard, `wreaks` under `ground2`) and is not put on
    top (`setDrawLayerOnTop`), is drawn before the unit; the rest after it. `skip`: the sections of
    attachments drawn apart, as a turret of their own."""
    under, over = [], []
    mine = draw_layer(ini)
    mine = DRAW_LAYERS["ground"] if mine is None else mine
    for a_ini, a_d, ax, ay, _, a_kv, s in attachments(ini, by_name):
        if s in skip:
            continue
        theirs = draw_layer(a_ini)
        below = boolish(a_kv.get("setDrawLayerOnBottom")) or (
            not boolish(a_kv.get("setDrawLayerOnTop")) and theirs is not None and theirs < mine)
        pics = body_parts(a_ini, a_d)
        if depth < 1:
            u, o = attached_items(a_ini, by_name, depth + 1)
            pics = u + pics + o
        rest = num(a_kv.get("idleDir")) or 0
        if pics and abs(rest % 360) > 0.5:
            pics = [(prep(lay(pics), 1.0, rest), 0, 0)]
        (under if below else over).extend((im, x + ax, y + ay) for im, x, y in pics)
    return under, over


# ------------------------------------------------------------ conversion
SQUAD_PRICE = 2.0            # a squad against the package's price for the lot
HUMAN_SS = 3                # a person's sheet px per world px: small, and worth the detail
MACHINE_SS = 1.5


def produce_prices(ini):
    """what a building asks for each unit it trains: {rw name: (credits a unit, how many, credits for the lot)}"""
    out = {}
    for s, kv in ini.items():
        if not s.startswith("action_") or not kv.get("produceUnits"):
            continue
        price = credits(kv.get("price", "0"))
        for part in split_list(kv["produceUnits"]):
            m = re.match(r"^(.+?)(?:\*(\d+))?$", part.strip())
            if m:
                n = int(m.group(2) or 1)
                out.setdefault(strip_quotes(m.group(1)), (price / n, n, price))
    return out


def flying_name(rw):
    return re.sub(r"_land(ed)?$", "_flying", rw)


def titan_time(core):
    """how long a Titan lasts: the package drains a shifter's strength while it holds the form"""
    emax, regen = num(core.get("energyMax")) or 0, num(core.get("energyRegen")) or 0
    if emax <= 0 or regen >= 0:
        return None
    return int(clamp(round(emax / -regen / 60 / 10) * 10, TITAN_TIME_MIN, TITAN_TIME_MAX))


def world_scale(art, long_rw, naval=False):
    """world px a RW px is drawn at, for a thing of this kind and size"""
    if art in ("odm", "walker"):
        return HUMAN_ART
    if art in ("titan", "strip"):
        k = TITAN_ART * grow(long_rw, TITAN_CAP, TITAN_SLOPE)
        return min(k, TITAN_MAX / max(1, long_rw))
    if naval:
        return SHIP_ART * grow(long_rw, SHIP_CAP, SHIP_SLOPE)
    return MACHINE_ART * grow(long_rw, MACHINE_CAP, MACHINE_SLOPE)


RIDER = "调查_landed"        # who a mount's ridden forms carry in the saddle: a Scout


def rider_items(ini, d, ov, by_name):
    """a mount's riders (`riders`: how many). The package draws whoever it carries at its empty
    attachment slots, which the game cannot; its ridden forms carry a Scout in each saddle."""
    n = ov.get("riders", 0)
    if not n:
        return []
    slots = [(num(kv.get("x")) or 0, num(kv.get("y")) or 0) for s, kv in ini.items()
             if s.startswith("attachment_") and not kv.get("onCreateSpawnUnitOf")]
    p = by_name[RIDER]
    r_ini, r_d = load_unit(p), os.path.dirname(p)
    rg = r_ini.get("graphics", {})
    im = open_art(resolve(rg.get("image"), r_d))
    frames = int(max(1, round(num(rg.get("total_frames")) or 1)))
    idle = (anims_of(rg, frames) or {}).get("idle", [0, 0])[0]
    pic = prep(split_frames(im, frames)[idle] if frames > 1 else im, body_scale(r_ini, r_d))
    return [(pic, x, y) for x, y in slots[:n]]


def unit_art(did, ini, d, ov, by_name, art):
    """a unit's sheet: frames (RW px about its centre, y forward, still at their own scale),
    their states, and the world px a RW px is drawn at. Returns (key, fw, fh, k, anims, frames)"""
    gfx = ini.get("graphics", {})
    sc = body_scale(ini, d)
    n = int(max(1, round(num(gfx.get("total_frames")) or 1)))
    anims = None
    sized_by = None
    if art == "titan":
        frames, anims, _ = titan_frames(ini, d)
    else:
        im = open_art(resolve(gfx.get("image"), d))
        if im is None:
            # a hull of parts alone: the gun that turns stands apart as a turret, the rest is laid on
            plan = gun_plan(ini, d, ov, False, by_name) if art == "hull" else None
            below, above = attached_items(ini, by_name, skip=plan["skip"] if plan else ())
            parts = below + (body_parts(ini, d, turrets=False) + plan["painted"] if plan else body_parts(ini, d)) + above
            frames = [lay(parts)] if parts else []
            if not frames or not frames[0].getbbox():
                return None
            n = 1
        else:
            if im.width % n:
                im = im.crop((0, 0, (im.width // n) * n, im.height))
            raw = [prep(f, sc) for f in split_frames(im, n)]
            if art in ("odm", "walker"):
                anims = anims_of(gfx, n) if art == "odm" else None
                if art == "walker":
                    shoot = ov.get("shoot") and by_name.get(ov["shoot"])
                    extra = None
                    if shoot:
                        s_ini = load_unit(shoot)
                        s_g = s_ini.get("graphics", {})
                        s_im = open_art(resolve(s_g.get("image"), os.path.dirname(shoot)))
                        if s_im is not None:
                            s_n = int(max(1, round(num(s_g.get("total_frames")) or 1)))
                            extra = prep(s_im, body_scale(s_ini, os.path.dirname(shoot)), frame0=s_n)
                    if n > 1 or extra is not None:
                        anims = {"idle": [0, 0]}
                        if n > 1:
                            anims["moving"] = [0, n - 1, 6]
                        if extra is not None:
                            anims["firing"] = [n, n]
                            raw.append(extra)
                W = max(f.width for f in raw)
                H = max(f.height for f in raw)
                frames = [lay([(f, 0, 0)], W, H) for f in raw]
            else:
                # the hull with its limbs and decals, the guns bolted to it that turn on their own,
                # and what rides on it, each on its layer
                dec = decal_items(ini, d)
                ground, under, over = limb_items(ini, d, sc)
                k_tur = turret_scale(ini, d)
                if art == "strip":
                    below, above = attached_items(ini, by_name)
                    guns = [painted_chain(ini, d, t, c, k_tur) for t, c in gun_chains(ini, d).items()] if k_tur > 0 else []
                else:
                    plan = gun_plan(ini, d, ov, False, by_name)
                    below, above = attached_items(ini, by_name, skip=plan["skip"])
                    guns = plan["painted"]
                pre = below + dec["shadow"] + ground + dec["beforeBody"] + under
                post = over + dec["afterBody"] + guns + dec["onTop"] + dec["beforeUI"] + above + rider_items(ini, d, ov, by_name)
                ox, oy = body_offset(gfx)
                half_w = max([abs(ox) + f.width / 2 for f in raw] + [abs(x) + im_.width / 2 for im_, x, y in pre + post])
                half_h = max([abs(oy) + f.height / 2 for f in raw] + [abs(y) + im_.height / 2 for im_, x, y in pre + post])
                W, H = int(math.ceil(half_w * 2)) + 2, int(math.ceil(half_h * 2)) + 2
                frames = [lay(pre + [(f, ox, oy)] + post, W, H) for f in raw]
                if ov.get("towed"):
                    # a towed gun is sized by its carriage, as it was while its barrel turned apart
                    sized_by = lay(pre + [(raw[0], ox, oy)] + [it for it in post if not any(it is g for g in guns)], W, H).getbbox()
                if art == "strip":
                    anims = anims_of(gfx, n)
            frames = [clean_alpha(f) for f in frames]
    frames = trim_frames(frames)
    bb = sized_by or frames[0].getbbox() or (0, 0) + frames[0].size
    long_rw = max(bb[2] - bb[0], bb[3] - bb[1])
    k = world_scale(art, long_rw, naval=(ini.get("movement", {}).get("movementType") or "").upper() in ("WATER", "HOVER"))
    if art in ("titan", "strip"):
        # the whole frame, the strike's reach and the stride's with it, held to the Titans' largest
        k = min(k, TITAN_MAX / max(frames[0].size))
    elif art in ("odm", "walker"):
        k = max(k, HUMAN_MIN / max(1, long_rw))
    fw = max(4, int(round(frames[0].width * k / DISPLAY)))
    fh = max(4, int(round(frames[0].height * k / DISPLAY)))
    ss = HUMAN_SS if art in ("odm", "walker") else TITAN_SS if art in ("titan", "strip") else MACHINE_SS
    px_w, px_h = fw * DISPLAY * ss, fh * DISPLAY * ss
    if px_w < frames[0].width:
        frames = resize_frames(frames, px_w, px_h)
    key = add_sheet(f"u.{did}", strip_of(frames), len(frames), True, fw, fh, anims=anims)
    return key, fw, fh, k, anims, len(frames)


MAX_RINGS = 8               # the game's `MAX_DEF_MOUNTS`


def limit_angle(v):
    """a turret's `limitingAngle` (`+65` is 65) as the half-arc it turns through, degrees"""
    n = num(str(v).strip().lstrip("+")) if v is not None else None
    return None if n is None else clamp(abs(n), 0, 180)


FIXED_ARC = 10              # a gun that turns less than this either way is laid by the hull (a bow gun)


def gun_candidates(ini, d, by_name):
    """every gun that could turn: the unit's own turret chains, and the units bolted on it that
    carry guns (a super-heavy tank's main turret, a battleship's main guns), each a dict: `key`
    (the chain's head, or the attachment's section), `att` (the attached unit, or None), `pos` (its
    place about the unit, RW px), `rest` and `arc` (degrees), `rig` (guns alike have the same),
    `dmg` (the hardest round it fires), `parts`, and `items()` (its picture about its pivot as it
    points forward)"""
    secs, pos = turret_tree(ini)
    k = turret_scale(ini, d)
    out = []
    for t, chain in (gun_chains(ini, d).items() if k > 0 else ()):
        out.append({"key": t, "att": None, "pos": pos(t), "rest": num(secs[t].get("idleDir")) or 0,
                    "arc": limit_angle(secs[t].get("limitingAngle")), "rig": ("turret",) + chain_rig(ini, d, t, chain),
                    "dmg": chain_damage(ini, t), "parts": len(chain),
                    "items": lambda t=t, chain=chain: chain_picture(ini, d, t, chain, k)})
    for a_ini, a_d, ax, ay, name, kv, s in attachments(ini, by_name):
        if not boolish(a_ini.get("attack", {}).get("canAttack"), False):
            continue
        a_chains = gun_chains(a_ini, a_d)
        if not a_chains or turret_scale(a_ini, a_d) <= 0:
            continue
        a_secs, _ = turret_tree(a_ini)
        a_root = gun_root(a_ini, a_d)
        out.append({"key": s, "att": name, "pos": (ax, ay), "rest": num(kv.get("idleDir")) or 0,
                    "arc": limit_angle(a_secs[a_root].get("limitingAngle")), "rig": ("att", name),
                    "dmg": chain_damage(a_ini, a_root), "parts": sum(len(c) for c in a_chains.values()),
                    "items": lambda a_ini=a_ini, a_d=a_d: body_parts(a_ini, a_d)})
    return out


def gun_plan(ini, d, ov, is_b, by_name):
    """how a unit's guns are drawn here, as a dict: `root` (the gun that turns: the candidate that
    fires hardest, then of most parts, then nearest the centre; a gun of a fixed bearing never),
    `rings` (the guns alike it is drawn on, the main one first, for `turretMounts`), `painted` (the
    unit's own chains that do not turn, as items to lay on the hull as they stand) and `skip` (the
    attachments that turn, which the hull then does not draw). A towed gun (`towed`), or one whose
    carriage the package turns with it (`lock_body_rotation_with_main_turret`), does not turn here
    on its own: the whole gun is painted on and the hull lays it, so the barrel never swings off
    the carriage."""
    gfx = ini.get("graphics", {})
    cands = gun_candidates(ini, d, by_name)
    fixed = not is_b and (ov.get("towed") or boolish(gfx.get("lock_body_rotation_with_main_turret")))
    turnable = [c for c in cands if not fixed and (c["arc"] is None or c["arc"] >= FIXED_ARC)]
    root = max(turnable, key=lambda c: (c["dmg"], c["parts"], -(abs(c["pos"][0]) + abs(c["pos"][1])))) if turnable else None
    rings = []
    if root and not is_b:
        rings = [root] + [c for c in turnable if c is not root and c["rig"] == root["rig"]]
        rings = rings[:MAX_RINGS] if len(rings) > 1 else []
    turning = rings or ([root] if root else [])
    k = turret_scale(ini, d)
    chains = gun_chains(ini, d)
    painted = [painted_chain(ini, d, c["key"], chains[c["key"]], k) for c in cands if not c["att"] and not any(c is t for t in turning)]
    return {"root": root, "rings": rings, "painted": painted, "skip": {c["key"] for c in turning if c["att"]}}


def reach_of(item):
    """how far forward of the unit's origin a laid picture paints, RW px"""
    im, x, y = item
    bb = im.getbbox()
    return y + (im.height / 2 - bb[1]) if bb else y


def turret_art(did, ini, d, k_world, bld_fit=None, root=None):
    """the gun that turns: the candidate's picture about its pivot as it points forward. Returns
    (key, fw, fh, its position in RW px, the picture's reach forward in RW px) or None"""
    if not root:
        return None
    rx, ry = root["pos"]
    items = root["items"]()
    if not items:
        return None
    cv = clean_alpha(lay(items))
    bb = cv.getbbox()
    if not bb:
        return None
    # centred on the pivot, cut to what it paints
    hw = max(cv.width / 2 - bb[0], bb[2] - cv.width / 2) + 1
    hh = max(cv.height / 2 - bb[1], bb[3] - cv.height / 2) + 1
    cut = cv.crop((int(cv.width / 2 - hw), int(cv.height / 2 - hh), int(math.ceil(cv.width / 2 + hw)), int(math.ceil(cv.height / 2 + hh))))
    k = bld_fit if bld_fit else k_world / DISPLAY
    tw, th = max(4, round(cut.width * k)), max(4, round(cut.height * k))
    if cut.width > tw * 3:
        cut = cut.resize((tw * 3, th * 3), Image.LANCZOS)
    key = add_sheet(f"tur.{did}", cut, 1, True, tw, th)
    return key, tw, th, (rx, ry), cv.height / 2 - bb[1] - 1


def hand_weapon(w, did, radius_tiles):
    """a weapon written out by hand, with its package sound and picture cut to the mod's"""
    w = json.loads(json.dumps(w))
    if w.get("range") == "melee":
        w["range"] = round(clamp(radius_tiles * 0.7 + 0.5, 0.6, 4), 1)
        w["_melee"] = True
    if isinstance(w.get("sound"), str) and w["sound"].startswith("@"):
        w["sound"] = add_sound(pkg(w["sound"][1:]))
    look = w.get("look")
    if look and str(look.get("sprite", "")).startswith("@"):
        pim = clean_alpha(open_art(pkg(look["sprite"][1:])))
        pim = pim.crop(pim.getbbox())
        look["sprite"] = add_sheet(f"prj.{did}-{w['id']}", pim, 1, True, 12, 12)
    return w


def build_def(rw, sfx, en, desc_en, ov, ini, d, by_name, prices, twin=None):
    did = f"{MOD_ID}-{sfx}"
    core, gfx, atk, mov = (ini.get(s, {}) for s in ("core", "graphics", "attack", "movement"))
    kind = ov["kind"]
    is_b = kind == B
    art = ov.get("art", "building" if is_b else "hull")
    zh_name = ov.get("zh_name") or strip_quotes(core.get("displayText") or rw)
    zh_name = re.sub(r"^[-－]", "", zh_name)
    desc_zh = ov.get("zh") or zh_text(core.get("displayDescription", ""), "")

    # ---- numbers
    hp_rw = num(core.get("maxHp")) or 100
    price = prices.get(rw, (None,))[0] or credits(core.get("price", "0"))
    cost = ov.get("cost", cost_of(price, is_b))
    hp = ov.get("hp", hp_of(hp_rw, is_b))
    tier = ov.get("tier", int(clamp(round(num(core.get("techLevel")) or 1), 1, 3)))
    movement = (mov.get("movementType") or ("NONE" if is_b else "LAND")).upper()
    domain = ov.get("domain") or ("air" if movement == "AIR" else "ship" if movement == "WATER"
                                  else "amphibious" if movement == "HOVER" else "ground")
    df = {"id": did, "name": [en, zh_name], "desc": [desc_en, desc_zh or desc_en], "kind": kind}
    if not is_b:
        df["domain"] = domain
    df["tier"] = tier
    df["cost"] = cost
    bt = build_seconds(core.get("buildSpeed"))
    df["buildTime"] = round(clamp(bt if bt else cost / 14, 4, 90 if is_b else 120), 1)
    df["hp"] = hp
    human = art in ("odm", "walker")
    titan = art in ("titan", "strip")
    if not is_b:
        df["pop"] = ov.get("pop", 1 if human and not ov.get("hero") else 2 if human else
                           (4 if tier == 3 else 3 if ov.get("hero") else 2) if titan else 1 if cost < 250 else 2 if cost < 700 else 3 if cost < 1500 else 4)
    armor = ov.get("armor") or ("structure" if is_b else "air" if domain == "air" else "ship" if domain == "ship"
                                else "light" if human else "heavy" if hp_rw >= 2500 else "medium")
    df["armor"] = armor
    df["vision"] = ov.get("vision", int(clamp(round((num(core.get("fogOfWarSightRange")) or 12) * VISION), 4, 16)))

    # ---- art (units); a building's comes after its footprint
    k_world = 1.0
    hull_len = 20.0
    if not is_b:
        got = None
        if twin is not None and twin.get("sprite"):
            # a second form of the same soldier: its picture, not a second sheet of it
            got = (twin["sprite"], None, None, twin["_k"], None, None)
            df["sprite"] = twin["sprite"]
            k_world = twin["_k"]
            hull_len = twin.get("_len", 20.0)
            df["radius"] = twin["radius"]
            df["body"] = dict(twin["body"])
        else:
            got = unit_art(did, ini, d, ov, by_name, art)
    if not is_b and twin is None:
        if got:
            key, fw, fh, k_world, anims, nfr = got
            df["sprite"] = key
            hull_len = fh * DISPLAY
            df["_k"], df["_len"] = k_world, hull_len
            df["_art"] = f"{art} {nfr}f -> {fw}x{fh} k{k_world:.2f}" + (f" {anims}" if anims else "")
            r_rw = num(core.get("radius")) or 10
            radius = clamp(r_rw * k_world * (0.8 if titan else 1.0), 4, 60)
            if human:
                radius = clamp(radius, 5, 8)
            df["radius"] = int(round(ov.get("radius", radius)))
            if ov.get("body"):
                df["body"] = dict(ov["body"])
            elif titan or human:
                df["body"] = {"r": round(clamp(radius, 4, 60), 1), "len": 0}
            else:
                df["body"] = {"r": round(fw * DISPLAY / 2, 1), "len": round(max(0, (fh - fw) * DISPLAY), 1)}
        else:
            note(did, "no picture of its own; placeholder")
            df["radius"] = 8
    if not is_b:
        sp = num(mov.get("moveSpeed"))
        if sp and sp > 0:
            top = 200 if (domain != "air" or ov.get("odm_air")) else 320
            df["speed"] = int(clamp(round(sp * SPEED), 14, top))
        tr = num(mov.get("maxTurnSpeed"))
        if tr and tr > 0:
            df["turnRate"] = round(clamp(tr * 60 * math.pi / 180, 0.5, 8), 2)
        if "speed" in ov:
            df["speed"] = ov["speed"]
        for f in ("trail", "hovers", "transportCap", "buildRate", "limit", "lowFlying", "altitude"):
            if f in ov:
                df[f] = ov[f]
        if human and domain == "ground":
            df["trail"] = "none"
        if titan and domain != "air":
            df["trail"] = "none"
        cap = num(core.get("maxTransportingUnits"))
        if "transportCap" not in df and cap and cap > 0 and not titan and not human:
            df["transportCap"] = int(clamp(cap, 1, 50))
        if ov.get("hero"):
            df["limit"] = 1
        if domain != "air" and not human and not titan:
            df["fireOnMove"] = True
        if ov.get("odm_air"):
            df.update(hovers=True, lowFlying=True, altitude=10)
    else:
        fp = [num(x) for x in split_list(core.get("footprint", ""))]
        if "fw" in ov:
            df["fw"], df["fh"] = ov["fw"], ov["fh"]
        elif len(fp) == 4 and all(x is not None for x in fp):
            df["fw"] = int(clamp(round((fp[2] - fp[0] + 1) * BUILDING_TILE), 1, 8))
            df["fh"] = int(clamp(round((fp[3] - fp[1] + 1) * BUILDING_TILE), 1, 8))
        else:
            df["fw"], df["fh"] = 2, 2
        df["power"] = ov.get("power", 0)
        for f in ("metalRate", "detect", "repairRange", "repairRate", "repairTargets"):
            if f in ov:
                df[f] = ov[f]
        if "upgradeOf" in ov:
            df["upgradeOf"] = f"{MOD_ID}-{ov['upgradeOf']}"
            df["upgradeCost"] = ov.get("upgradeCost", max(50, cost // 2))
            df["upgradeTime"] = ov.get("upgradeTime", 30)
        # the building's picture, and what stands on it: its arms at rest, its decals, its
        # attachments, each on its layer (a stable's yard under it, its fences over)
        # a gun tower's own gun turns; its other guns stand painted on it as they rest
        plan = gun_plan(ini, d, ov, True, by_name) if ov.get("tower") else None
        below, above = attached_items(ini, by_name, skip=plan["skip"] if plan else ())
        items = below + body_parts(ini, d, turrets=not plan) + (plan["painted"] if plan else []) + above
        bld_fit = None
        if items:
            cv = clean_alpha(lay(items))
            bb = cv.getbbox()
            if bb:
                full = cv
                cv = cv.crop(bb)
                if ov.get("rw_per_tile") and not ov.get("tower"):
                    # pieces that stand in one line (the Wall's sections and its gate) are drawn at
                    # one scale, as the package draws them: each picture widened or narrowed about
                    # its middle to its footprint's share, so a gate stands as tall as the Wall
                    cv = fit_width(cv, df["fw"] * ov["rw_per_tile"])
                bld_fit = df["fw"] * 32 / cv.width
                mount = None
                if plan and plan["root"]:
                    rx, ry = plan["root"]["pos"]
                    mount = ((full.width / 2 + rx - bb[0]) / cv.width, (full.height / 2 - ry - bb[1]) / cv.height)
                if max(cv.size) > 1024:
                    f = 1024 / max(cv.size)
                    cv = cv.resize((round(cv.width * f), round(cv.height * f)), Image.LANCZOS)
                df["sprite"] = add_sheet(f"u.{did}", cv, 1, False, mount=mount)
                df["_art"] = f"building {cv.width}x{cv.height} fit {bld_fit:.2f}"
        if "sprite" not in df:
            note(did, "no picture of its own; placeholder")
        k_world = bld_fit or 1.0

    # ---- weapons
    radius_tiles = (df.get("radius", 8)) / 32
    weapons = [hand_weapon(w, did, radius_tiles) for w in ov["weapons"]] if "weapons" in ov else []
    if "weapons" not in ov:
        src_ini, src_d = ini, d
        other = ov.get("weapons_from") or (ov.get("shoot") if art == "walker" else None)
        if other and by_name.get(other):
            src_ini, src_d = load_unit(by_name[other]), os.path.dirname(by_name[other])
        if boolish(src_ini.get("attack", {}).get("canAttack"), False):
            weapons = convert_weapons(src_ini, src_d, domain, ov, did, radius_tiles, titan=titan)
        weapons += [hand_weapon(w, did, radius_tiles) for w in ov.get("extra_weapons", [])]
    # the guns bolted on: fired from the hull, unless the unit's turret is theirs
    guns_drawn = (not is_b or ov.get("tower")) and art not in ("odm", "walker", "titan", "strip")
    turning = gun_plan(ini, d, ov, is_b, by_name)["skip"] if guns_drawn else set()
    for a_ini, a_d, ax, ay, a_name, _, a_sec in (attachments(ini, by_name) if "weapons" not in ov else []):
        if not boolish(a_ini.get("attack", {}).get("canAttack"), False):
            continue
        for w in convert_weapons(a_ini, a_d, domain, {}, did, 0.3):
            w["id"] = f"{w['id']}-{len(weapons) + 1}"
            same = next((x for x in weapons if x["cls"] == w["cls"] and abs(x["dmg"] - w["dmg"]) < 0.05 and x["range"] == w["range"]), None)
            if same:
                same["burst"] = min(8, same.get("burst", 1) + 1)
                same.setdefault("burstDelay", 0.15)
            else:
                w["_hull"] = a_sec not in turning
                weapons.append(w)
    if ov.get("mult"):
        for w in weapons:
            w["mult"] = dict(ov["mult"], **w.get("mult", {}))
    flames = [w for w in weapons if w.get("projectile") == "flame"]
    if len(flames) > 1:
        weapons = [w for w in weapons if w.get("projectile") != "flame"] + [flames[0]]
    if weapons and "weapons" not in ov and not ov.get("extra_weapons"):
        dps = sum(w["dmg"] * w.get("burst", 1) * w.get("bores", 1) / w["reload"] for w in weapons)
        cap = dps_cap(cost, is_b) * ov.get("dps_mult", 1.0)
        if dps > cap:
            f = cap / dps
            for w in weapons:
                w["dmg"] = round(max(2.0, w["dmg"] * f), 1)
                # a gun's class follows the damage it ends up with
                if w["cls"] in ("mg", "autocannon", "cannon") and not w.get("homing") and not w.get("arc"):
                    w["cls"] = "mg" if w["dmg"] < 12 else "autocannon" if w["dmg"] < 36 else "cannon"
                    w["projectile"] = "shell" if w["cls"] == "cannon" else "bullet"
    if weapons:
        df["weapons"] = weapons[:8]

    # ---- the gun that turns: on a ring of each of its guns alike, or on its one ring; a gun that
    # does not turn here (a towed one) is laid by the hull, and fires from its muzzle
    tur, rings, laid_reach = None, [], None
    if guns_drawn and df.get("weapons"):
        plan = gun_plan(ini, d, ov, is_b, by_name)
        rings = plan["rings"]
        tur = turret_art(did, ini, d, k_world, k_world if is_b else None, root=plan["root"])
        main = gun_root(ini, d)
        if not tur and not is_b and main and turret_scale(ini, d) > 0:
            laid_reach = reach_of(painted_chain(ini, d, main, gun_chains(ini, d)[main], turret_scale(ini, d)))
    if tur:
        key, tw, th, (rx, ry), reach = tur
        df["turretSprite"] = key
        k_sheet = k_world / DISPLAY
        if rings:
            mounts = []
            for c in rings:
                tx, ty = c["pos"]
                ring = {"x": round(tx * k_sheet, 1), "y": round(-ty * k_sheet, 1)}
                rest = (c["rest"] + 180) % 360 - 180
                if abs(rest) > 0.5:
                    ring["rest"] = round(rest)
                if c["arc"] is not None and c["arc"] < 180:
                    ring["arc"] = round(c["arc"])
                mounts.append(ring)
            df["turretMounts"] = mounts
        elif not is_b and (abs(rx) > 0.5 or abs(ry) > 0.5) and "sprite" in df:
            sheet = next(s for s in SHEETS if s["key"] == df["sprite"])
            mount = (0.5 + rx * k_sheet / sheet["fw"], 0.5 - ry * k_sheet / sheet["fh"])
            if 0 <= mount[0] <= 1 and 0 <= mount[1] <= 1:
                sheet["mount"] = [round(mount[0], 3), round(mount[1], 3)]
    for w in df.get("weapons", []):
        reach = w.pop("_reach", None)
        melee = w.pop("_melee", False)
        hull_gun = w.pop("_hull", False)
        if tur and not hull_gun:
            w["turret"] = True
            w["muzzleOffset"] = round(clamp((tur[4] if tur[4] > 0 else (reach or 8)) * k_world, 2, 200), 1)
        else:
            w["turret"] = False
            to_muzzle = laid_reach * k_world if laid_reach and not melee and not hull_gun else hull_len * (0.2 if melee else 0.45)
            w["muzzleOffset"] = round(clamp(to_muzzle, 1, 200), 1)

    if twin is not None:
        for f in ("cost", "pop", "tier", "buildTime", "limit"):
            if f in twin:
                df[f] = twin[f]
    if not is_b:
        df["aiWeight"] = ov.get("aiWeight", 0 if ov.get("form") else 1.0 if ov.get("hero") else 0.6 if df.get("buildRate") else 1.5)
    if ov.get("requires"):
        df["requires"] = [f"{MOD_ID}-{r}" for r in ov["requires"]]
    if ov.get("form"):
        df["_form"] = True
    tt = titan_time(core)
    if tt:
        df["_titan_time"] = tt
    mend = num(core.get("selfRegenRate")) or 0
    if mend > 0 and not is_b:
        # a Titan mends in seconds what a tank never does; held to a percent of its hull a second
        k_hp = hp / max(1.0, hp_rw)
        regen = min(mend * 60 * k_hp, hp * (0.01 if titan else 0.004))
        if regen >= 0.5:
            df["regen"] = round(regen, 1)
    return df


def fx_sheet(rel, frames, name, size_world):
    """an effect the rules play (`fx.<mod>-<name>`): a strip played once, not rotated"""
    im = open_art(pkg(rel))
    im = clean_alpha(im)
    if im.width % frames:
        im = im.crop((0, 0, (im.width // frames) * frames, im.height))
    fr = trim_frames(split_frames(im, frames))
    w = size_world
    h = max(4, round(size_world * fr[0].height / fr[0].width))
    if fr[0].width > w * 2:
        fr = resize_frames(fr, w * 2, h * 2)
    return add_sheet(f"fx.{MOD_ID}-{name}", strip_of(fr), frames, False, fw=w, fh=h, fps=round(frames / 0.6, 1))


def convert():
    by_name = index_units()
    prices = {}
    for rw, sfx, _, _, ov in ROSTER:
        if ov["kind"] == B and by_name.get(rw):
            for k, v in produce_prices(load_unit(by_name[rw])).items():
                prices.setdefault(k, v)
    if not DRY and not NO_MEDIA:
        shutil.rmtree(OUT_SPRITES, ignore_errors=True)
        os.makedirs(OUT_SPRITES)
    defs = []
    for rw, sfx, en, desc_en, ov in ROSTER:
        if ov.get("squad"):
            continue
        path = by_name.get(rw)
        if not path:
            note(rw, "NOT FOUND in the package")
            continue
        df = build_def(rw, sfx, en, desc_en, ov, load_unit(path), os.path.dirname(path), by_name, prices)
        defs.append(df)
        if ov.get("odm"):
            # the same soldier on its gear: a flyer at rooftop height, with the gear's own strikes
            fname = flying_name(rw)
            fpath = by_name.get(fname)
            if not fpath:
                note(rw, f"no flying form {fname}")
                continue
            fov = {k: v for k, v in ov.items() if k not in ("odm", "art", "weapons", "air_weapons")}
            fov.update(odm_air=True, form=True, armor="light", domain="air", art="hull")
            if ov.get("air_weapons"):
                fov["weapons"] = ov["air_weapons"]
            f_ini = load_unit(fpath)
            fdf = build_def(fname, f"{sfx}-odm", en, desc_en, fov, f_ini, os.path.dirname(fpath), by_name, prices, twin=df)
            fdf["name"] = [f"{en} (airborne)", f"{df['name'][1]}（飞行）"]
            defs.append(fdf)
    by_id = {d["id"]: d for d in defs}
    # the squads: put down whole, the moment they roll out
    for rw, sfx, en, desc_en, ov in ROSTER:
        if not ov.get("squad"):
            continue
        usfx, count = ov["squad"]
        u = by_id[f"{MOD_ID}-{usfx}"]
        got = prices.get(rw)
        total = got[2] if got else credits(load_unit(by_name[rw]).get("core", {}).get("price", "0")) * count
        cost = ov.get("cost") or int(clamp(round(cost_of(total) * SQUAD_PRICE / 5) * 5, count * 25, 1600))
        sq = {"id": f"{MOD_ID}-{sfx}", "name": [en, ov.get("zh_name", u["name"][1])], "desc": [desc_en, f"{count} 名{u['name'][1]}。"],
              "kind": "unit", "domain": u["domain"], "tier": u["tier"], "cost": cost,
              "buildTime": round(clamp(cost / 14, 6, 60), 1), "hp": u["hp"], "pop": 1, "armor": u["armor"], "vision": u["vision"]}
        for f in ("sprite", "radius", "body", "speed", "turnRate", "trail"):
            if f in u:
                sq[f] = u[f]
        sq["aiWeight"] = 2.0
        if ov.get("requires"):
            sq["requires"] = [f"{MOD_ID}-{r}" for r in ov["requires"]]
        sq["rules"] = [{"on": "created", "do": [{"spawn": {"unit": u["id"], "count": count}}, {"remove": True}]}]
        # the soldiers are priced as the squad's share
        u["cost"] = max(u["cost"] if u.get("_priced") else 0, int(round(cost / count / 5) * 5) or 5)
        defs.append(sq)
    by_id = {d["id"]: d for d in defs}
    # ---- production and building
    produced = {}
    for bsfx, units in PRODUCTION.items():
        bid = f"{MOD_ID}-{bsfx}"
        if bid not in by_id:
            note(bid, "producer missing")
            continue
        lst = []
        for u in units:
            uid = f"{MOD_ID}-{u}"
            if uid not in by_id:
                note(bid, f"trains {uid}, which is missing")
                continue
            lst.append(uid)
            produced.setdefault(uid, []).append(bid)
        by_id[bid]["produces"] = lst
    for d in defs:
        if d["kind"] != "unit":
            continue
        if d["id"] in produced:
            d["producedBy"] = produced[d["id"]]
            d.pop("_form", None)
        elif d.pop("_form", False):
            d["producedBy"] = []
        else:
            note(d["id"], "nobody trains it")
            d["producedBy"] = []
    for usfx, blds in BUILDERS.items():
        uid = f"{MOD_ID}-{usfx}"
        if uid not in by_id:
            continue
        by_id[uid]["builds"] = [f"{MOD_ID}-{b}" for b in blds if f"{MOD_ID}-{b}" in by_id]
        by_id[uid].setdefault("buildRate", 25)
    for d in defs:
        if d["kind"] == "building" and "upgradeOf" not in d:
            sfx = d["id"][len(MOD_ID) + 1:]
            who = [f"{MOD_ID}-{u}" for u, blds in BUILDERS.items() if sfx in blds]
            d["builtBy"] = (["engineer"] if sfx in ENGINEER_BUILDS else []) + who
            if not d["builtBy"]:
                note(d["id"], "nobody builds it")
    behaviour(defs, by_id)
    order = {"building": 0, "unit": 1}
    defs.sort(key=lambda d: order[d["kind"]])
    return defs


# ------------------------------------------------------------- behaviour
ODM_REST = 4                # seconds on the ground before the gear will lift again
ODM_GAS = 30                # seconds of gas in the air
ANCHOR = 7                  # tiles to something the gear can hook onto
FX = {}                     # the effects and sounds the rules name, filled in by `media_for_rules`


def media_for_rules():
    FX["shift"] = fx_sheet("贴图/变身闪电球.png", 9, "shift", 64)
    FX["blast"] = fx_sheet("units/九大巨人/超大型巨人/核爆效果.png", 1, "blast", 96)
    for name, rel, secs in (("hook", "进击的巨人MOD/兵团/兵团/发射绳索.ogg", 0.6), ("reel", "进击的巨人MOD/兵团/兵团/收回绳索.ogg", 0.6),
                            ("thunder", "units/九大巨人/进，鄂，女，铠，战锤/thunder.ogg", 1.6),
                            ("colossal", "units/九大巨人/超大型巨人/超巨吼叫.ogg", 2.4),
                            ("steam", "units/九大巨人/超大型巨人/蒸汽释放.ogg", 1.2), ("harden", "硬质化结晶.ogg", 1.0),
                            ("levi", "进击的巨人MOD/兵团/兵团/利威尔砍_1.ogg", 1.2)):
        FX[name] = add_sound(pkg(rel), secs)


def behaviour(defs, by_id):
    """What the package scripts, as rules (`game/modRules.ts`): the gear, the squads, the shifters
    and their Titans, the Eldians and the Beast Titan's roar, the heroes' gifts, the Rumbling."""
    media_for_rules()
    I = lambda s: f"{MOD_ID}-{s}"
    rules = {d["id"]: [] for d in defs}
    titans = sorted(d["id"] for d in defs if d.get("armor") == "heavy" and d["kind"] == "unit" and d.get("_k") is not None
                    and d["id"] in {I(r[1]) for r in ROSTER if r[4].get("art") in ("titan", "strip")})
    anchor = lambda r: {"any": [{"near": {"kind": "building", "within": r}}, {"near": {"units": titans, "within": r + 2}}]}

    # the gear: on foot it walks; moving with something to hook onto close by it flies, and it
    # comes down when there is nothing left to hook onto or its gas is spent
    for rw, sfx, *_ in ROSTER:
        ov = _[2]
        if not ov.get("odm"):
            continue
        ground, air = I(sfx), I(sfx + "-odm")
        if air not in by_id:
            continue
        rules[ground].append({"when": {"moving": True, **anchor(ANCHOR)}, "if": {"age": ODM_REST},
                              "do": [{"sound": FX["hook"]}, {"morph": air}]})
        rules[air].append({"when": {"any": [{"age": ODM_GAS}, {"not": anchor(ANCHOR + 3)}]},
                           "do": [{"sound": FX["reel"]}, {"morph": ground}]})
        # over water or a cliff it cannot come down: it tries again as it flies on
        rules[air].append({"every": 3, "if": {"age": ODM_GAS + 3}, "do": {"morph": ground}})

    # the heroes' gifts
    def both(s):
        return [x for x in (I(s), I(s + "-odm")) if x in by_id]
    for u in both("scout"):
        rules[u].append({"every": 1, "if": {"near": {"units": both("erwin"), "side": "friend", "within": 10}},
                         "do": {"buff": {"reload": 0.65, "taken": 0.6, "for": 1.5}}})
    for u in both("anti-personnel") + both("thunder-spear"):
        rules[u].append({"every": 1, "if": {"near": {"units": both("floch"), "side": "friend", "within": 10}},
                         "do": {"buff": {"damage": 1.5, "for": 1.5}}})
    for u in both("eren"):
        rules[u].append({"every": 1, "if": {"near": {"units": both("mikasa"), "side": "friend", "within": 12}},
                         "do": {"buff": {"taken": 0.8, "for": 1.5}}})
    for u in both("levi"):
        rules[u].append({"button": {"name": ["Spinning Strike", "回旋斩"], "desc": ["Levi's spinning strike: two and a half times the harm, twice as fast, for five seconds.", "利威尔的回旋斩：五秒内伤害提升至 2.5 倍，攻速翻倍。"]},
                         "cooldown": 20, "do": [{"sound": FX["levi"]}, {"buff": {"damage": 2.5, "reload": 0.5, "for": 5}}]})

    # a horse shows its riders: it takes its ridden forms as they mount, and gives them up as they leave
    horse, ridden, ridden2 = I("horse"), I("horse-ridden"), I("horse-ridden-2")
    if ridden in by_id and ridden2 in by_id:
        rules[horse].append({"when": {"carrying": 1}, "do": {"morph": ridden}})
        rules[ridden].append({"when": {"carrying": 2}, "do": {"morph": ridden2}})
        rules[ridden].append({"when": {"not": {"carrying": 1}}, "do": {"morph": horse}})
        rules[ridden2].append({"when": {"not": {"carrying": 2}}, "do": {"morph": ridden}})

    # the shifters and their Titans
    human_of = {}
    for hsfx, (tsfx, cost, secs, req) in SHIFTS.items():
        human_of[I(tsfx)] = I(hsfx)
        for h in both(hsfx):
            b = {"cost": cost, "time": secs, "ai": True}
            if req:
                b["requires"] = [I(r) for r in req]
            rules[h].append({"button": b, "if": {"age": SHIFT_REST}, "do": {"morph": I(tsfx)}})
            # wounded, it shifts of itself
            rules[h].append({"when": {"hpBelow": 0.3}, "if": {"age": SHIFT_REST}, "do": {"morph": I(tsfx)}})
    hsfx, tsfx, cost, secs, req = RUMBLING
    human_of[I(tsfx)] = I(hsfx)
    for h in both(hsfx):
        rules[h].append({"button": {"cost": cost, "time": secs, "requires": [I(r) for r in req]}, "if": {"age": SHIFT_REST},
                         "do": {"morph": I(tsfx)}})
    human_of[I("armored-titan-shed")] = I("reiner")
    human_of[I("cart-titan-cannon")] = I("pieck")
    colossi = (I("colossal"), I("colossal-armin"))
    for tid, hid in human_of.items():
        t = by_id[tid]
        t["domain"] = "amphibious" if tid in colossi + (I("founding-titan"),) else t["domain"]
        refresh = tid not in (I("armored-titan-shed"), I("cart-titan"), I("cart-titan-cannon"))
        born = [{"fx": FX["shift"], "fxScale": 2.5 if tid in colossi else 1.4}, {"sound": FX["colossal"] if tid in colossi else FX["thunder"]}]
        if tid in colossi:
            # the transformation is a blast that levels all around it
            born.append({"explode": {"dmg": 320, "radius": 260, "cls": "he"}})
            born.append({"fx": "fx.nuke", "fxScale": 0.7})
            born.append({"fx": FX["blast"], "fxScale": 3})
        if refresh:
            born.append({"healPct": 1})
        rules[tid].append({"on": "morphed", "do": born})
        span = t.pop("_titan_time", None) or TITAN_TIME_MAX
        if tid == I("armored-titan-shed"):
            span = 60
        if tid != I("founding-titan"):
            rules[tid].append({"when": {"age": span}, "do": [{"sound": FX["steam"]}, {"morph": hid}]})
            rules[tid].append({"every": 5, "if": {"age": span + 5}, "do": {"morph": hid}})
        rules[tid].append({"on": "destroyed", "do": {"spawn": {"unit": hid}}})
    for d in defs:
        d.pop("_titan_time", None)
    # the Titans' gifts
    rules[I("attack-titan")].append({"button": {"name": ["Harden", "硬质化"], "desc": ["Hardened fists and skin: takes less than half the harm and strikes harder, for ten seconds.", "硬质化的拳头与皮肤：十秒内所受伤害减半以上，攻击更猛。"], "time": 1},
                                     "cooldown": 30, "do": [{"sound": FX["harden"]}, {"buff": {"taken": 0.4, "damage": 1.3, "for": 10}}]})
    rules[I("female-titan")].append({"button": {"name": ["Harden Nape", "保护后颈"], "desc": ["Crystal over the nape: half the harm for eight seconds.", "用硬质化结晶保护后颈：八秒内所受伤害减半。"], "time": 0.5},
                                     "cooldown": 25, "do": [{"sound": FX["harden"]}, {"buff": {"taken": 0.5, "for": 8}}]})
    rules[I("armored-titan")].append({"when": {"hpBelow": 0.25}, "do": [{"fx": "fx.expl.m"}, {"morph": I("armored-titan-shed")}]})
    rules[I("cart-titan")].append({"button": {"cost": 250, "time": 10, "ai": True}, "do": {"morph": I("cart-titan-cannon")}})
    rules[I("cart-titan-cannon")].append({"button": {"time": 3}, "do": {"morph": I("cart-titan")}})

    # the Rumbling: the Founder calls the Wall Titans, and the Walls crumble into them where it passes
    rules[I("founding-titan")].append({"every": 25, "do": [{"fx": FX["shift"], "fxScale": 2}, {"spawn": {"unit": I("wall-titan"), "max": 6}}]})
    wake = {"near": {"units": [I("founding-titan")], "side": "friend", "within": 10}}
    for w, n in ((I("wall"), 1), (I("wall-v"), 1), (I("gate"), 2)):
        if w not in by_id:
            continue
        crumble = [{"fx": "fx.expl.l", "fxScale": 1.6}, {"sound": "explBig"}]
        rules[w].append({"when": wake, "chance": 0.7 if n == 1 else 1, "do": crumble + [{"spawn": {"unit": I("wall-titan"), "count": n}}, {"remove": True}]})
        if n == 1:
            rules[w].append({"when": wake, "do": crumble + [{"remove": True}]})
    # a Wall Titan crushes what is underfoot as it walks
    rules[I("wall-titan")].append({"every": 2, "if": {"moving": True}, "do": [{"explode": {"dmg": 45, "radius": 80, "cls": "he"}}, {"fx": "fx.smoke", "fxScale": 1.5}]})
    by_id[I("wall-titan")]["domain"] = "amphibious"
    rules[I("founding-titan")].append({"every": 2, "if": {"moving": True}, "do": [{"explode": {"dmg": 70, "radius": 150, "cls": "he"}}, {"fx": "fx.smoke", "fxScale": 2.5}]})

    # the Eldians: at the Beast Titan's roar, or at their own order, each becomes a mindless Titan
    roar = {"near": {"units": [I("beast-titan")], "side": "friend", "within": 14}}
    el = I("eldian")
    rules[el].append({"when": roar, "do": {"flag": "titan"}})
    rules[el].append({"button": {"name": ["Titanize", "巨人化"], "desc": ["The spinal fluid takes hold: it becomes a mindless Titan, of any kind.", "脊髓液发作：变为一只无垢巨人，种类不定。"], "time": 2, "cost": 120},
                      "do": {"flag": "titan"}})
    left = 1.0
    for i, (tsfx, p) in enumerate(TITANIZE):
        r = {"every": 0.25, "if": {"flag": "titan"}}
        if i < len(TITANIZE) - 1:
            r["chance"] = round(min(1.0, p / left), 3)
        r["do"] = [{"fx": FX["shift"], "fxScale": 1.2}, {"sound": FX["thunder"]}, {"spawn": {"unit": I(tsfx)}}, {"remove": True}]
        rules[el].append(r)
        left -= p
    # the mindless eat what they catch
    for tsfx, _ in TITANIZE:
        rules[I(tsfx)].append({"on": "kill", "cooldown": 5, "do": {"healPct": 0.1}})

    for d in defs:
        own = rules.get(d["id"], [])
        if own:
            d["rules"] = d.get("rules", []) + own
        if len(d.get("rules", [])) > 24:
            note(d["id"], f"{len(d['rules'])} rules; the first 24 kept")
            d["rules"] = d["rules"][:24]
        d.pop("_k", None)
        d.pop("_len", None)


def dump(name):
    by_name = index_units()
    p = by_name.get(strip_quotes(name))
    if not p:
        print("not found:", name)
        return
    ini = load_unit(p)
    print("#", p)
    for s, kv in ini.items():
        if re.match(r"^(core|graphics|attack|movement|turret_.*|projectile_.*|arm_.*|attachment_.*)$", s):
            keep = {k: v for k, v in kv.items() if not k.startswith(("@", "effect", "shoot_flame", "shoot_light", "idleSweep", "recoil", "explodeEffect", "trailEffect", "display", "copyFrom", "mutator"))}
            print(f"[{s}] " + ", ".join(f"{k}={v[:40]}" for k, v in keep.items()))


def compare_versions(a, b):
    """positive when `a` is newer, as the game compares them"""
    pa = [int(x) if x.isdigit() else 0 for x in re.split(r"[.+-]", str(a))]
    pb = [int(x) if x.isdigit() else 0 for x in re.split(r"[.+-]", str(b))]
    n = max(len(pa), len(pb))
    pa += [0] * (n - len(pa))
    pb += [0] * (n - len(pb))
    return (pa > pb) - (pa < pb)


def main():
    if "--dump" in sys.argv:
        for n in sys.argv[sys.argv.index("--dump") + 1:]:
            dump(n)
        return
    defs = convert()
    write_sounds()
    desc_en = ("The Walls and the Survey Corps on their gear, Marley's army, air fleet and Warriors, the Middle-East Allied Forces, "
               "and the Titans: shifters who take their Titan forms, Eldians who become mindless ones, and the Rumbling.")
    desc_zh = "城墙与驾驶立体机动装置的调查兵团，马莱的陆军、空军与战士，中东联合军，以及巨人：能变身的九大巨人继承者、化为无垢巨人的艾尔迪亚人，还有地鸣。"
    manifest = {
        "format": "steel-tide-mod",
        "v": 1,
        "id": MOD_ID,
        "name": ["Attack on Titan: The Rumbling", "进击の巨人『地鸣』"],
        "version": "0.1.3",
        "minGame": MIN_GAME,
        "author": "辣条QWQ (original by Mirka)",
        "description": [desc_en, desc_zh],
        "homepage": f"https://github.com/steel-tide/mods/tree/main/mods/{MOD_ID}",
        "license": "LicenseRef-AoT-Rumbling",
        "defs": defs,
        "sprites": SHEETS,
        "sounds": [{"key": k, "file": f} for k, f in {v[0]: v[1] for v in SOUND_JOBS.values()}.items()],
        "screenshots": [],
    }
    old = {}
    if os.path.exists(os.path.join(HERE, "mod.json")):
        old = json.load(open(os.path.join(HERE, "mod.json"), encoding="utf-8"))
        if old.get("id") == MOD_ID and compare_versions(old.get("version", "0"), manifest["version"]) > 0:
            manifest["version"] = old["version"]
        manifest["screenshots"] = old.get("screenshots", [])
    if not manifest["screenshots"]:
        shots_dir = os.path.join(HERE, "screenshots")
        if os.path.isdir(shots_dir):
            manifest["screenshots"] = [f"screenshots/{f}" for f in sorted(os.listdir(shots_dir)) if re.search(r"\.(png|jpe?g|webp)$", f, re.I)]
    maps_dir = os.path.join(HERE, "maps")
    if os.path.isdir(maps_dir):
        found = [f"maps/{f}" for f in sorted(os.listdir(maps_dir)) if f.endswith(".steel-tide-map")]
        if found:
            manifest["maps"] = found
    if DRY:
        art = "--art" in sys.argv
        for d in defs:
            if art:
                print(f"{d['id'][len(MOD_ID) + 1:]:26} {d.get('_art', '-')}")
                continue
            ws = "; ".join(f"{w['id']}:{w['cls']} {w['dmg']}/{w['reload']}s r{w['range']}" + (f" x{w['burst']}" if 'burst' in w else "") + (f" b{w['bores']}" if 'bores' in w else "") + "".join(t[0] for t in w['targets']) for w in d.get("weapons", []))
            print(f"{d['id'][len(MOD_ID) + 1:]:26} {d['kind'][0]} {d.get('domain', '')[:4]:4} T{d['tier']} ${d['cost']:>5} hp {d['hp']:>5} pop {d.get('pop', '-')} spd {d.get('speed', '-'):>3} r {d.get('radius', '-')} {d.get('armor', '')[:5]:5} | {ws}")
        print(f"\n{len(defs)} defs, {len(SHEETS)} sheets, {len({v[0] for v in SOUND_JOBS.values()})} sounds")
    else:
        for d in defs:
            d.pop("_art", None)
        os.makedirs(OUT, exist_ok=True)
        open(os.path.join(OUT, "mod.json"), "w", encoding="utf-8").write(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
        print(f"wrote mod.json: {len(defs)} defs, {len(SHEETS)} sheets, {len({v[0] for v in SOUND_JOBS.values()})} sounds")
    for n in NOTES:
        print("note:", n)


if __name__ == "__main__":
    main()

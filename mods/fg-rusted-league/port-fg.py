#!/usr/bin/env python3
"""Port FG Rusted League (FG铁锈联盟) from its Rusted Warfare package into this Steel Tide mod.

FG Rusted League is not a mod folder but a whole Rusted Warfare 1.13.3 build with its art
redrawn — the builder, the tanks, the factories, the turrets, every hull in a black and
acid-green livery with a Red Alert roster's names — and a plugin of its own units, `GF插件`,
in `assets/units/ GF`. The unpacked package is at ../../rusted-warfare-mods/fg-rusted-league
(git-ignored). This converts the curated roster below into defs, composites the art into
sheets, and writes mod.json.

  python3 mods/fg-rusted-league/port-fg.py            # convert everything
  python3 mods/fg-rusted-league/port-fg.py --dry      # print the conversion, write nothing
  python3 mods/fg-rusted-league/port-fg.py --dry --art  # the art each def was cut from
  python3 mods/fg-rusted-league/port-fg.py --no-media # mod.json only (sheets kept)
  python3 mods/fg-rusted-league/port-fg.py --dump <rw name>  # a unit's merged ini

Three sources, one pipeline:
- the plugin's own units, ini files under `assets/units/ GF`;
- the stock ini units the League repainted, under `assets/units` (a `c_` file is Rusted
  Warfare's ini copy of a unit it otherwise hard-codes);
- the hard-coded units, whose numbers `rw-dex.py` read out of the bytecode into
  `rw-core.json` and whose art is `res/drawable`. A `core:` entry builds an ini from them.

Only the League's own art crosses. Every picture is checked against the same file in a stock
Rusted Warfare build (../../rusted-warfare, git-ignored) and one that matches it pixel for
pixel is Corroding Games' art, not the mod's: it is refused, and the part goes without it.

Rusted Warfare conventions: a tile is 20 px and the sim runs 60 ticks a second; a bare
time is ticks and `5s` is seconds; `moveSpeed` is px per tick; unit art faces up; a
building's footprint is `left,up,right,down` in tiles; `copyFrom` merges other files as
defaults; `@define x: v` and `${x}` are variables. The numbers go through the calibration
the Rusted Expansion mod uses for Rusted Warfare's stock roster (prices ×0.8, hit points
×2.9, ranges ×0.7 in tiles, damage ×1.6, so its tank lands beside the Bison), with the
plugin's giants compressed at the top so a 75 000-credit ship is not 60 000 metal.
"""
import hashlib
import importlib.util
import json
import math
import os
import re
import shutil
import sys

from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
SKY = os.path.join(REPO, "rusted-warfare-mods", "fg-rusted-league")
UNITS = os.path.join(SKY, "assets", "units")
GF = os.path.join(UNITS, " GF")
RES = os.path.join(SKY, "res", "drawable")
STOCK = os.path.join(REPO, "rusted-warfare-mods", "rusted-warfare")
TRANS = os.path.join(SKY, "assets", "translations", "Strings_zh_cn.properties")
MOD_ID = "fg-rusted-league"
MIN_GAME = "0.8.16"  # executable format 4 also requires host API 2
DRY = "--dry" in sys.argv
NO_MEDIA = "--no-media" in sys.argv
OUT = os.path.abspath(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else HERE

# ----------------------------------------------------------------- scaling
# Sheet px per Rusted Warfare px, the Adolence and Rusted Expansion convention; a unit's
# art is then drawn 1.5625× on the map.
ART = 0.82
DISPLAY = 1.5625
SOFT_CAP = 34               # RW px; beyond this the long side grows at 0.35×

# numbers: Rusted Expansion's calibration of Rusted Warfare's roster, compressed at the top
PRICE, PRICE_KNEE, PRICE_EXP, COST_MAX = 0.8, 2000, 0.5, 6000
HP, HP_KNEE, HP_EXP = 2.9, 1500, 0.6
HP_PER_METAL = 3.2              # a unit's hull stays within sight of its price: a Bison is 2.2
# buildings are priced and armoured as the game's own: a Rusted Warfare factory's 1200 is a war factory's 1500
BLD_PRICE, BLD_HP, BLD_HP_KNEE = 0.6, 1.25, 3000
DMG = 1.6
RANGE = 0.7 / 20                # RW px → tiles
SPEED = 58                      # RW px/tick → world px/s
VISION = 0.6
BUILD_TIME = 2.0
INCOME = 0.175                  # RW credits/s → metal/s: an extractor's 8 against the game's 1.4
SHIELD = 0.5                    # a shield counts half its strength as hull


def shrink(long_px):
    if long_px <= SOFT_CAP:
        return 1.0
    return (SOFT_CAP + (long_px - SOFT_CAP) * 0.35) / long_px


def cost_of(price, building=False):
    k = BLD_PRICE if building else PRICE
    c = price * k if price <= PRICE_KNEE else k * PRICE_KNEE * (price / PRICE_KNEE) ** PRICE_EXP
    return int(clamp(round(c / 10) * 10, 20, COST_MAX))


def hp_of(hp_rw, building=False):
    k, knee = (BLD_HP, BLD_HP_KNEE) if building else (HP, HP_KNEE)
    h = hp_rw * k if hp_rw <= knee else k * knee * (hp_rw / knee) ** HP_EXP
    return int(clamp(round(h / 10) * 10, 30, 30000))


def dps_cap(cost, building):
    """damage a second a def of this price may deal: a Bison's 33 at 280, room for specialists"""
    return (0.2 * cost + 20) if building else (0.14 * cost + 12)


def clamp(x, lo, hi):
    return max(lo, min(hi, x))


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


def mod_root(path):
    """a unit's mod folder: the plugin's for its own units, the units folder for the stock ones"""
    return GF if os.path.abspath(path).startswith(GF + os.sep) else UNITS


def resolve(ref, from_dir):
    r = (ref or "").strip().replace("\\", "/")
    if not r or r.upper() in ("NONE", "AUTO"):
        return None
    up = r.upper()
    if up.startswith("ROOT:"):
        p = os.path.join(mod_root(from_dir + os.sep), r[5:].lstrip("/"))
    elif up.startswith(("SHARED:", "SHADOW:", "CUSTOM:", "CORE:")):
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
    """a unit with every folder template above it inside its own mod, then its copyFrom chain, then itself"""
    out = {}
    root = mod_root(path)
    rel = os.path.relpath(os.path.dirname(path), root)
    dirs = [root]
    if rel != ".":
        acc = root
        for part in rel.split(os.sep):
            acc = os.path.join(acc, part)
            dirs.append(acc)
    for d in dirs:
        t = os.path.join(d, "all-units.template")
        if os.path.exists(t):
            merge_into(out, load_file(t))
    merge_into(out, load_file(path))
    expand_vars(out)
    expand_turret_copies(out)
    return out


def split_list(v):
    return [s.strip() for s in (v or "").split(",") if s.strip()]


def expand_vars(ini):
    defines = {}
    for sec, kv in ini.items():
        for k, v in kv.items():
            if k.startswith("@define "):
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
    if s.startswith("if "):
        return True
    return s in ("true", "1", "yes")


def seconds(v):
    n = num(v)
    if n is None:
        return None
    return n if re.search(r"s\s*$", str(v).strip(), re.I) else n / 60


def build_seconds(v):
    n = num(v)
    if n is None or n <= 0:
        return None
    if re.search(r"s\s*$", str(v).strip(), re.I):
        return n
    return 1 / (60 * n) if n < 1 else n / 60


def strip_quotes(s):
    return re.sub(r"^[“\"”]+|[“\"”]+$", "", (s or "").strip())


def index_units():
    """every unit file by its [core] name; the plugin's own win over the stock ones"""
    by_name = {}
    for base in (GF, UNITS):
        for root, _, files in os.walk(base):
            if base == UNITS and (root + os.sep).startswith(GF + os.sep):
                continue
            for f in files:
                if not f.lower().endswith(".ini"):
                    continue
                p = os.path.join(root, f)
                raw = parse_ini(open(p, encoding="utf-8", errors="replace").read())
                name = raw.get("core", {}).get("name")
                if name:
                    by_name.setdefault(strip_quotes(name), p)
    return by_name


def translations():
    tr = {}
    for line in open(TRANS, encoding="utf-8", errors="replace"):
        m = re.match(r"\s*units\.([^.]+)\.(name|description)\s*=\s*(.*)", line)
        if m:
            tr.setdefault(m.group(1), {})[m.group(2)] = m.group(3).strip()
    return tr


def zh_text(desc, fallback=""):
    """the package's bracketed tooltip lines, as one sentence"""
    if not desc:
        return fallback
    items = [s.strip(" -[]]") for s in re.split(r"\]\]|\]\[|\]|\[\[|\[", desc)]
    items = [s.rstrip("。.，,-") for s in items if s and not re.search(r"作者|加群|解释权|画师|绘图|素材|教程|注:", s)]
    out = "，".join(items[:2])
    if len(out) > 46 and items:
        out = items[0][:46]
    return out or fallback


# ------------------------------------------------------------ stock guard
def stock_twin(path):
    """the same file in a stock Rusted Warfare build, if there is one"""
    rel = os.path.relpath(path, SKY)
    if rel.startswith(".."):
        return None
    twin = os.path.join(STOCK, rel)
    return twin if os.path.exists(twin) else None


_stock = {}


def is_stock_art(path):
    """a picture the League kept as Rusted Warfare drew it: Corroding Games' art, which does not ship"""
    if path in _stock:
        return _stock[path]
    twin = stock_twin(path)
    same = False
    if twin:
        a, b = Image.open(path).convert("RGBA"), Image.open(twin).convert("RGBA")
        if a.size == b.size:
            diff = ImageChops.difference(a, b)
            changed = sum(1 for p in diff.getdata() if max(p) > 24)
            same = changed < 0.05 * a.width * a.height
    _stock[path] = same
    return same


# ------------------------------------------------------------ hard-coded units
CORE = json.load(open(os.path.join(HERE, "rw-core.json"), encoding="utf-8"))


def synth_ini(ctype, ov):
    """an ini for a hard-coded unit: its numbers from the bytecode, its pictures from res/drawable"""
    c = CORE[ctype]
    mv = c.get("movement") or "LAND"
    ini = {
        "core": {"name": ctype, "price": str(ov.get("price", c.get("price") or 0)), "maxHp": str(c.get("hp") or 100),
                 "radius": str(c.get("radius") or 10), "buildSpeed": str(c.get("buildSpeed") or 0.001),
                 "techLevel": str(ov.get("tier", 1))},
        "movement": {"movementType": mv},
        "graphics": {"total_frames": str(ov.get("frames", 1))},
        "attack": {},
    }
    if c.get("speed"):
        ini["movement"]["moveSpeed"] = str(c["speed"])
    if c.get("turn"):
        ini["movement"]["maxTurnSpeed"] = str(min(c["turn"], 8))
    if c.get("sight"):
        ini["core"]["fogOfWarSightRange"] = str(c["sight"])
    if ov.get("img"):
        ini["graphics"]["image"] = os.path.join(RES, ov["img"] + ".png")
    if ov.get("back"):
        ini["graphics"]["image_back"] = os.path.join(RES, ov["back"] + ".png")
    if ov.get("turret"):
        ini["graphics"]["image_turret"] = os.path.join(RES, ov["turret"] + ".png")
    shots = [s for s in c.get("shots", []) if (s.get("dmg") or 0) > 0 or (s.get("area") or 0) > 0]
    if shots and ov.get("armed", True):
        a = ini["attack"]
        a.update(canAttack="true", maxAttackRange=str(c.get("range") or 150), shootDelay=str(c.get("delay") or 60),
                 canAttackFlyingUnits=str(bool(c.get("air"))).lower(), canAttackLandUnits=str(bool(c.get("land", 1))).lower(),
                 canAttackUnderwaterUnits=str(bool(c.get("sub"))).lower())
        spots = ov.get("turrets") or [(0, 0)]
        for k, s in enumerate(shots[:2]):
            p = {"directDamage": str(s.get("dmg", 0)), "areaDamage": str(s.get("area", 0))}
            if s.get("areaRadius"):
                p["areaRadius"] = str(s["areaRadius"])
            if s.get("speed"):
                p["speed"] = str(s["speed"])
            else:
                p["instant"] = "true"
            if s.get("area") and not s.get("dmg"):
                p["targetGround"] = "true"
            ini[f"projectile_{k + 1}"] = p
        second_air = len(shots) > 1 and c.get("air") and c.get("land")
        for j, (x, y) in enumerate(spots):
            t = {"x": str(x), "y": str(y), "projectile": "1"}
            if second_air:
                t.update(canAttackFlyingUnits="false", canAttackLandUnits="true")
            ini[f"turret_{j + 1}"] = t
        if second_air:
            ini[f"turret_{len(spots) + 1}"] = {"x": "0", "y": "0", "projectile": "2", "canAttackFlyingUnits": "true", "canAttackLandUnits": "false", "invisible": "true"}
    return ini


def overlay_core(ini, ctype):
    """a stock ini copy's art and turrets with the hard-coded unit's own numbers"""
    c = CORE[ctype]
    ini.setdefault("core", {}).update(price=str(c.get("price") or 0), maxHp=str(c.get("hp") or 100))
    if c.get("speed"):
        ini.setdefault("movement", {})["moveSpeed"] = str(c["speed"])
    if c.get("range"):
        ini.setdefault("attack", {})["maxAttackRange"] = str(c["range"])
    if c.get("delay"):
        ini["attack"]["shootDelay"] = str(c["delay"])
        for s, kv in ini.items():
            if s.startswith("turret_"):
                kv.pop("delay", None)
    shots = [s for s in c.get("shots", []) if (s.get("dmg") or 0) > 0]
    projs = [s for s in ini if s.startswith("projectile_")]
    for k, s in enumerate(projs[: len(shots)]):
        ini[s]["directDamage"] = str(shots[k]["dmg"])


# ------------------------------------------------------------------ roster
# (source, id suffix, English name, English tooltip, overrides). The source is a unit's
# [core] name, or `core:<type>` for a hard-coded one. Overrides:
#   kind, domain, tier, armor, hovers, trail, cost, hp, pop, vision, weapons, extra,
#   stats (a hard-coded type whose numbers go over an ini copy), img/back/turret/frames/
#   turrets (a hard-coded unit's pictures and gun positions), fw/fh, power, metalRate,
#   needsDeposit, upgradeOf, requires, zh_name, zh, turret_from, no_turret, tower, arc
B, U = "building", "unit"
def carrier_guns(n, quick=False):
    """the aircraft carrier's weapons with `n` interceptors on its deck: the interceptors are turrets
    that turn (`turret_rings`); the missiles are its own air defence, fired from the hull whatever the
    turrets are on. The last level recharges five times as fast, as the original's does"""
    k = 0.6 if quick else 1.0
    return [dict(id="interceptors", cls="aa", dmg=60, reload=round(2.4 * k, 2), range=9, burst=n, burstDelay=0.2, targets=["air"],
                 projectile="missile", speed=520, homing=True),
            dict(id="strike", cls="he", dmg=90, reload=round(3 * k, 2), range=8, burst=n - 1, burstDelay=0.2, targets=["ground", "ship"],
                 projectile="rocket", speed=420)]


ROSTER = [
    # ================================================================ buildings
    ("core:commandCenter", "command", "League Command",
     "The base's heart: trains builders, guns down anything in range, and earns its keep.",
     dict(kind=B, img="base", back="base_back", frames=4, fw=3, fh=3, power=20, metalRate=1.75, tier=1)),
    ("core:landFactory", "army-base", "Army Base", "Builds the League's tanks and vehicles.",
     dict(kind=B, img="land_factory_front", back="land_factory_back", fw=3, fh=3, power=-8, tier=1)),
    ("core:landFactory", "army-base-2", "Army Base II", "The army base upgraded: the heavy armour rolls out here.",
     dict(kind=B, img="land_factory_front_t2", back="land_factory_back", fw=3, fh=3, power=-12, tier=2,
          upgradeOf="army-base", upgradeCost=640, upgradeTime=40, hp_mult=1.4)),
    ("core:airFactory", "air-base", "Air Force Base", "Builds the League's helicopters and jets.",
     dict(kind=B, img="air_factory", frames=5, fw=3, fh=3, power=-8, tier=1)),
    ("core:airFactory", "air-base-2", "Air Force Base II", "The air base upgraded: gunships and bombers.",
     dict(kind=B, img="air_factory_t2", frames=5, fw=3, fh=3, power=-12, tier=2,
          upgradeOf="air-base", upgradeCost=800, upgradeTime=45, hp_mult=1.4)),
    ("core:seaFactory", "naval-base", "Naval Base", "Builds the League's fleet. Stands on the water by a shore.",
     dict(kind=B, img="sea_factory", fw=3, fh=3, power=-8, tier=1)),
    ("core:seaFactory", "naval-base-2", "Naval Base II", "The naval base upgraded: battleships and carriers.",
     dict(kind=B, img="sea_factory_t2", fw=3, fh=3, power=-12, tier=2,
          upgradeOf="naval-base", upgradeCost=800, upgradeTime=45, hp_mult=1.4)),
    ("core:extractor", "mine", "Ore Mine", "Mines a deposit.",
     dict(kind=B, img="extractor", frames=4, fw=2, fh=2, power=-4, metalRate=1.4, needsDeposit=True, tier=1, cost=130)),
    ("core:extractor", "mine-2", "Ore Mine II", "Mines faster.",
     dict(kind=B, img="extractor_t2", frames=4, fw=2, fh=2, power=-8, metalRate=3, needsDeposit=True, tier=2,
          upgradeOf="mine", upgradeCost=200, upgradeTime=25, hp_mult=1.25)),
    ("core:extractor", "mine-3", "Ore Mine III", "Mines faster still, and takes more to knock down.",
     dict(kind=B, img="extractor_t3", frames=4, fw=2, fh=2, power=-15, metalRate=8, needsDeposit=True, tier=3,
          upgradeOf="mine-2", upgradeCost=500, upgradeTime=40, hp_mult=2.5)),
    ("core:turret", "sentry", "Sentry Gun", "A gun turret for the ground.",
     dict(kind=B, img="turret_base", turret="turret_top", fw=1, fh=1, power=-3, tier=1, tower=True)),
    ("core:turretT2", "sentry-2", "Sentry Gun II", "Twin barrels, faster fire.",
     dict(kind=B, img="turret_base", turret="turret_top_l2", fw=1, fh=1, power=-4, tier=2, tower=True,
          upgradeOf="sentry", upgradeCost=320, upgradeTime=20, price=900)),
    ("core:turretT3", "sentry-3", "Sentry Gun III", "Triple barrels and a long reach.",
     dict(kind=B, img="turret_base", turret="turret_top_l3", fw=1, fh=1, power=-6, tier=3, tower=True,
          upgradeOf="sentry-2", upgradeCost=1200, upgradeTime=30, price=2400)),
    ("core:turret_artillery", "artillery-emplacement", "Artillery Emplacement", "A long gun that shells the ground far off.",
     dict(kind=B, img="turret_base", turret="turret_top_artillery", fw=1, fh=1, power=-4, tier=2, tower=True, price=800, arc=True)),
    ("core:turret_flamethrower", "flame-turret", "Flamethrower Turret", "Sets the ground in front of it alight.",
     dict(kind=B, img="turret_base", turret="turret_top_flame", fw=1, fh=1, power=-3, tier=2, tower=True, price=1400, flame=True)),
    ("c_antiAirTurret", "patriot", "Patriot Missile", "Anti-air missiles.",
     dict(kind=B, fw=1, fh=1, power=-3, tier=1, tower=True)),
    ("c_antiAirTurretT2", "patriot-2", "Patriot Missile II", "More launchers, harder hits.",
     dict(kind=B, fw=1, fh=1, power=-5, tier=2, tower=True, upgradeOf="patriot", upgradeCost=480, upgradeTime=25)),
    ("c_antiAirTurretT3", "absolute-domain", "Absolute Domain", "The last word in air defence: hits the ground as well.",
     dict(kind=B, fw=1, fh=1, power=-8, tier=3, tower=True, upgradeOf="patriot-2", upgradeCost=1400, upgradeTime=35)),
    ("antiAirTurretFlak", "flak", "Flak Cannon", "Bursts of flak over a short range.",
     dict(kind=B, fw=1, fh=1, power=-4, tier=2, tower=True)),
    ("core:laserDefence", "prism-tower", "Prism Defence Tower", "Shoots down shells and missiles aimed at the base. Cannot attack.",
     dict(kind=B, img="laser_defence", frames=2, fw=1, fh=1, power=-8, tier=2, armed=False,
          extra={"interceptRange": 6, "interceptMag": 6, "interceptReload": 1.2})),
    ("core:laserDefence", "prism-tower-2", "Prism Defence Tower II", "Covers more ground, and reloads faster.",
     dict(kind=B, img="laser_defence_t2", frames=2, fw=1, fh=1, power=-12, tier=3, armed=False,
          upgradeOf="prism-tower", upgradeCost=700, upgradeTime=30, hp_mult=1.5,
          extra={"interceptRange": 8, "interceptMag": 10, "interceptReload": 0.8})),
    ("core:repairbay", "repair-depot", "Repair Depot", "Mends vehicles and ships parked nearby.",
     dict(kind=B, img="repair_bay", fw=2, fh=2, power=-8, tier=2, armed=False,
          extra={"repairRange": 5, "repairRate": 30, "repairTargets": 3})),
    ("core:NukeLaucher", "nuke-silo", "Nuclear Missile Silo", "Builds and launches nuclear missiles.",
     dict(kind=B, img="nuke_launcher", fw=2, fh=2, power=-40, tier=3, armed=False, cost=2000, requires=["battle-lab"],
          extra={"nukeCapacity": 1, "nukeCost": 1200, "nukeTime": 120, "hatch": 2})),
    ("core:experimentalLandFactory", "black-tech-factory", "Black-Tech Factory", "Builds the war machines that end wars.",
     dict(kind=B, img="experimental_unit_factory_front", back="experimental_unit_factory_base", fw=4, fh=4, power=-20, tier=3,
          requires=["battle-lab"])),
    ("zzsy", "battle-lab", "Battle Lab", "Unlocks the League's top tier; guns down air and ground around it.",
     dict(kind=B, tier=2, power=-10)),
    ("skfy", "t3-factory", "T3 Factory", "Builds the heaviest land and air units.",
     dict(kind=B, tier=3, power=-20, requires=["battle-lab"])),
    ("mjjp", "colossus-gun", "Colossus Gun", "A huge gun with a long reach and a longer reload.",
     dict(kind=B, tier=3, power=-10, tower=True, arc=True, requires=["battle-lab"])),
    # the author: too weak. Its reach is the whole map in the original, and a shot's blast a screen wide
    ("zzjp", "proton-cannon", "Proton Collider Cannon", "A superweapon: five shots that reach across the map. Its shells can be shot down.",
     dict(kind=B, tier=3, power=-30, tower=True, arc=True, requires=["battle-lab"], tune=dict(range=60, dmg=500, splash=180))),
    ("prop", "floating-array", "Floating Array", "An alien defence platform that hovers over the base, firing at aircraft.",
     dict(kind=B, tier=2, power=-6, tower=True)),
    # the author's nuclear power station (核电站): the League's builder has no other plant, so it powers
    # the base as well as paying, and stands without the battle lab, as the original's does
    ("money", "reactor", "Overloaded Nuclear Generator", "The League's nuclear power station: powers the base and makes money quickly, and shrugs off small hits.",
     dict(kind=B, tier=2, power=150, zh="联盟的核电站：为基地供电，造钱速度很快；自身可以免疫10血的伤害。")),
    ("战术机场", "airfield", "Tactical Airfield", "A landing strip with its own air defences.",
     dict(kind=B, tier=2, power=-6, zh_name="战术机场")),
    ("小英雄塔", "hero-barracks", "Hero Barracks", "Trains the hero tank and its first two ranks.",
     dict(kind=B, tier=1, power=-5, fw=2, fh=2, zh_name="小英雄塔")),
    ("nb", "hero-tower", "Hero Tower", "Unlocks the heroes' final form, and shoots down shells.",
     dict(kind=B, tier=3, power=-10, requires=["battle-lab"], extra={"interceptRange": 7, "interceptMag": 8, "interceptReload": 1.5})),

    # ================================================================ repainted stock units
    ("core:builder", "builder", "Builder", "Builds and repairs the League's base. Cannot attack.",
     dict(kind=U, img="builder", tier=1, armed=False, trail="tread")),
    ("core:tank", "grizzly", "Grizzly Tank", "Fast and cheap, a gun for the ground only.",
     dict(kind=U, img="tank2", frames=3, turret="tank2_turret", tier=1, armor="medium", trail="tread")),
    ("core:hoverTank", "hover-tank", "Hover Tank", "Skims land and water; fires at air and ground.",
     dict(kind=U, img="hover_tank", tier=1, armor="light", domain="amphibious", trail="none")),
    ("core:artillery", "artillery", "Long-Range Artillery", "Shells the ground from far off.",
     dict(kind=U, img="artillery2", tier=1, armor="light", arc=True, trail="tread")),
    ("core:helicopter", "apache", "Apache Gunship", "A quick helicopter that strafes land, sea and air.",
     dict(kind=U, img="helicopter", tier=1, hovers=True)),
    ("core:airShip", "fighter", "Fighter Jet", "The fastest thing in the sky; attacks aircraft only.",
     dict(kind=U, img="ship", tier=1)),
    ("core:gunShip", "strike-jet", "Ground-Attack Jet", "Heavily armoured; bombs the ground.",
     dict(kind=U, img="gunship", tier=2)),
    ("core:gunBoat", "destroyer", "Destroyer", "A fast gunboat.",
     dict(kind=U, img="gun_boat", tier=1)),
    ("core:missileShip", "cruiser", "Cruiser", "Missiles for air and land, torpedoes for what is under the water.",
     dict(kind=U, img="scout_ship", tier=2)),
    ("core:battleShip", "battleship", "Battleship", "Twin turrets and a long reach.",
     dict(kind=U, img="battle_ship_t2", turret="battle_ship_t2_turret", turrets=[(0, 14), (0, -12)], tier=2)),
    ("core:attackSubmarine", "submarine", "Attack Submarine", "Dives out of sight; torpedoes ships, and surfaces to shell the shore.",
     dict(kind=U, img="attack_submarine", tier=2, extra={"underwater": True, "sonar": 6})),
    ("core:builderShip", "construction-ship", "Construction Ship", "The builder at sea.",
     dict(kind=U, img="builder_ship", tier=1, armed=False)),
    ("core:hovercraft", "hover-transport", "Hover Transport", "Carries four across land and water. Unarmed.",
     dict(kind=U, img="hovercraft", tier=1, armed=False, domain="amphibious", trail="none", extra={"transportCap": 4})),
    ("core:tankDestroyer", "tank-destroyer", "Tank Destroyer", "A longer gun on the Grizzly's hull.",
     dict(kind=U, img="tank2", frames=3, turret="tank2_turret", tier=2, armor="medium", trail="tread")),
    ("core:heavyTank", "heavy-tank", "Heavy Tank", "Twin guns, and missiles for aircraft.",
     dict(kind=U, img="heavy_tank", frames=3, turret="heavy_tank_turret", tier=2, armor="heavy", trail="tread")),
    ("core:heavyHoverTank", "heavy-hover-tank", "Heavy Amphibious Tank", "Heavily armoured, crosses water; air and ground.",
     dict(kind=U, img="heavy_hover_tank", tier=2, armor="heavy", domain="amphibious", trail="none")),
    ("core:laserTank", "prism-tank", "Prism Tank", "One slow, crushing beam at land or air.",
     dict(kind=U, img="laser_tank_base", turret="laser_tank_turrent", tier=2, armor="medium", trail="tread",
          look={"beam": {"color": "#7fd6ff", "width": 3, "style": "laser", "life": 0.25}, "impact": "fx.spark"})),
    ("core:mammothTank", "tesla-tank", "Tesla Tank", "Lightning at land and air, on a slab of armour.",
     dict(kind=U, img="mammoth_tank", frames=2, turret="mammoth_tank_turret", tier=3, armor="heavy", trail="tread",
          look={"beam": {"color": "#b4d2ff", "width": 2, "style": "lightning", "life": 0.2}, "impact": "fx.spark"})),
    ("c_experimentalTank", "experimental-tank", "Experimental Tank", "Four turrets firing long and fast, and anti-air on top.",
     dict(kind=U, tier=3, armor="heavy", trail="tread", stats="experimentalTank", frames_fix=3)),
    ("core:experimentalHoverTank", "star-warship", "Star Warship", "The peak of technology: a plasma cutter that goes through any armour.",
     dict(kind=U, img="experimental_hovertank", turret="experimental_hovertank_turret", tier=3, armor="heavy", domain="amphibious", trail="none")),
    ("c_amphibiousJet", "amphibious-jet", "Amphibious Jet", "Flies, and fires on water, land and air; dives under the sea.",
     dict(kind=U, tier=2)),
    ("c_amphibiousJet_underwater", "amphibious-jet-dived", "Amphibious Jet (dived)", "The amphibious jet under the sea: seen only by sonar.",
     dict(kind=U, tier=2, domain="ship", form=True, extra={"underwater": True})),
    ("missileTank", "rocket-truck", "Multi-Role Rocket Truck", "Rockets for land and air; the tower-rusher's friend.",
     dict(kind=U, tier=2, armor="light", trail="tire")),
    ("heavyBattleship", "general-battleship", "General-Class Battleship", "Long-range guns, air defence and anti-submarine weapons.",
     dict(kind=U, tier=2)),

    # ================================================================ the plugin: land
    ("sctq", "apocalypse", "Atomic Apocalypse", "The real Apocalypse: huge firepower at land and air.",
     dict(kind=U, tier=3, armor="heavy", trail="tread")),
    ("mchy", "mirage-tank", "Mirage Tank", "Stands still and becomes a tree; moves or fires and is a tank again.",
     dict(kind=U, tier=3, armor="medium", trail="tread")),
    # its disguise: the same tank as a tree nothing on the other side can pick out
    ("幻影坦克", "mirage-disguised", "Mirage Tank (disguised)", "A tree, to anyone further off than three tiles; nothing can be ordered to fire on it.",
     dict(kind=U, tier=3, armor="medium", trail="tread", form=True, untargetable=True, extra={"stealth": 3})),
    ("vshj", "v3-launcher", "V3 Launcher", "Long-range rockets that wreck stubborn targets, and ships.",
     dict(kind=U, tier=3, armor="light", trail="tire", arc=True)),
    ("tank2", "pacifier", "Pacifier Artillery", "An amphibious gun: fast guns at air and ground; deploys ashore into heavy artillery.",
     dict(kind=U, tier=3, armor="medium", domain="amphibious", trail="none")),
    ("test_tank", "silencer", "Silencer Artillery", "The Pacifier deployed: heavy guns that hold a pass alone; it cannot move.",
     dict(kind=U, tier=3, armor="medium", trail="tread", form=True, price_of="tank2", zh="平定者的重炮模式：可以一夫当关，万夫莫开；无法移动。")),
    ("gctank", "siege-tank", "Siege Tank", "The army's most advanced tank; shells the ground, and deploys to strike far off with lightning.",
     dict(kind=U, tier=3, armor="heavy", trail="tread")),
    ("attack", "siege-tank-deployed", "Siege Tank (siege form)", "Deployed: long-range electric strikes at the ground, and it mends; it cannot move.",
     dict(kind=U, tier=3, armor="heavy", domain="ground", trail="tread", form=True, price_of="gctank")),
    ("MRLS", "rocket-launcher", "Multiple Rocket Launcher", "Long reach and heavy salvos on a thin hull; deploys to fire further and faster.",
     dict(kind=U, tier=2, armor="light", trail="tire", arc=True)),
    ("固定火箭炮", "rocket-launcher-fixed", "Multiple Rocket Launcher (deployed)", "Dug in: a longer reach and a quicker salvo, and it cannot move.",
     dict(kind=U, tier=2, armor="light", trail="tire", arc=True, form=True, price_of="MRLS", turret_of="rocket-launcher", zh_name="固定火箭炮", zh="转化固定模式，射程更远、攻速更快，无法移动。")),
    ("edd", "minelayer", "Minelayer", "Lays mines that crawl after the enemy; ground only.",
     dict(kind=U, tier=1, armor="medium", trail="tread", manual_turrets=["b"])),
    ("egg", "widow-mine", "Widow Mine", "Waits for a nearby surface enemy, then releases a homing explosive. Laid by the Minelayer.",
     dict(kind=U, tier=1, domain="ground", form=True, pop=0, hp=6, armor="light", trail="none", zh_name="寡妇雷",
          zh="由雷车部署。等待附近的地面或水下敌人，随后发射追踪爆弹；不会攻击飞机。")),
    ("hea", "tank-killer", "Tank Killer", "A mobile gun with a long reach and a long reload.",
     dict(kind=U, tier=2, armor="medium", trail="tread")),
    ("hjkl", "flame-tank", "Flame Tank", "Close-range fire over an area.",
     dict(kind=U, tier=2, armor="medium", trail="tread", flame=True)),
    ("miss", "missile-tank", "Missile Tank", "Long-range, heavy missiles at land and air.",
     dict(kind=U, tier=2, armor="medium", trail="tread")),
    ("djz2", "striker-vx", "Striker-VX", "A two-legged walker with homing missiles for aircraft.",
     dict(kind=U, tier=2, armor="medium", trail="none")),

    # ================================================================ the plugin: air
    ("LLC", "wolfhound", "Wolfhound Gunship", "A helicopter with guns for air and ground, and missiles for the ground.",
     dict(kind=U, tier=2, hovers=True)),
    ("scwz", "twinblade", "Twinblade Gunship", "Strafes air and ground while its missiles hammer the ground.",
     dict(kind=U, tier=2, hovers=True)),
    ("sdog", "tengu-jet", "Tengu Strike Jet", "A fast jet that folds into the Tengu mech.",
     dict(kind=U, tier=2)),
    ("sdog2", "tengu-mech", "Tengu Mech", "The Tengu on the ground: quick, and it crosses water.",
     dict(kind=U, tier=2, armor="light", domain="amphibious", trail="none")),
    ("djz", "striker-gunship", "Striker Gunship", "The Striker in helicopter form.",
     dict(kind=U, tier=2, hovers=True)),
    ("sejing", "vanguard-gunship", "Vanguard Gunship", "A barrage at any target, medium range.",
     dict(kind=U, tier=3)),
    ("sejing2", "heavy-gunship", "Heavy Gunship", "The Vanguard's heavier sister.",
     dict(kind=U, tier=3)),
    ("mcgl", "shield-tank", "Shield Tank", "A hover tank that flies too low for air defences to reach.",
     dict(kind=U, tier=3)),
    ("skyb", "bone-eagle", "Bone Eagle", "Air and ground, agile; takes the sky with surgical strikes.",
     dict(kind=U, tier=2)),
    ("wfq", "strategic-bomber", "Strategic Bomber", "Carpet bombs light targets.",
     dict(kind=U, tier=2)),
    ("bomber", "century-bomber", "Century Bomber", "Very heavy armour, slow; recharges between drops.",
     dict(kind=U, tier=2)),
    ("sckt", "kirov", "Kirov Airship", "Death from above for anything on the ground.",
     dict(kind=U, tier=3)),
    ("kongmu", "lord-of-the-sky", "Lord of the Sky", "The largest thing in the sky.",
     dict(kind=U, tier=3)),
    # the author: too weak. Its bombs are 350 apiece in the original, four to a pass
    ("boss", "b52", "B-52 Stratofortress", "Heavy bombs for the ground, guns for the air.",
     dict(kind=U, tier=3, dps_mult=3.0)),
    ("ycyf", "laser-ufo", "Laser UFO", "Alien technology: laser at air and ground.",
     dict(kind=U, tier=3)),
    ("Battlecruiser", "battlecruiser", "Battlecruiser", "The ultimate warship: thick hide, heavy guns.",
     dict(kind=U, tier=3)),
    ("tttt", "hover-escort", "Hover Escort", "Covers the Battlecruiser's retreat.",
     dict(kind=U, tier=3)),
    ("轰天", "skyshaker", "Skyshaker", "A heavy strike craft.",
     dict(kind=U, tier=3, zh_name="轰天")),
    ("tyui", "teleporter", "Lightspeed Teleporter", "Carries twelve at the speed of light. Unarmed and unstable.",
     dict(kind=U, tier=3, hp=1500, extra={"transportCap": 12})),
    # the airship the Lord of the Sky builds: its drones are its only guns. Its hull is stock
    # Rusted Warfare art, which does not ship, so it wears the League's own airship's
    ("missileAirship", "carrier-airship", "Carrier Airship", "Unarmed itself: ten drones fly from it at what it fights, and come back to reload. Mends itself.",
     dict(kind=U, tier=2, armed=False, borrow="kirov", zh="不能攻击，放出小飞机对空对地；小飞机需要回舰装填；自我修复。",
          wing=dict(unit="airship-drone", count=10, rebuild=5, sortie=30, rearm=1, range=10))),
    # the carriers' planes: made by their carriers alone, and counting no population
    ("小飞机", "airship-drone", "Airship Drone", "One of the carrier airship's swarm: quick guns at air and ground.",
     dict(kind=U, tier=2, pop=0, wing_plane=True, no_turret=True, zh="航飞艇的小飞机：对空对地的速射机枪。")),
    ("mhky", "asw-plane", "ASW Plane", "The littoral ship's own plane: a submarine killer, weak against the rest.",
     dict(kind=U, tier=2, cost=300, hp=380, pop=0, wing_plane=True, extra={"sonar": 5}, zh="濒海战斗舰自带的反潜机：潜艇杀手，对空对地较弱。")),
    # the carriers' drone: in the original a light carrier launches eight at no cost
    ("mhkh2", "wasp", "Wasp", "A small strike drone, all guns.",
     dict(kind=U, tier=1, cost=120, hp=90, pop=1)),
    ("sb", "attack-drone", "Attack Drone", "The light carrier's drone: a strafing run at the ground, then home to reload.",
     dict(kind=U, tier=1, pop=0, wing_plane=True, borrow="wasp", share=True, zh_name="垂直攻击机", zh="只能对地攻击；大量的它们会对敌人造成毁灭性的打击。")),

    # ================================================================ the plugin: sea
    ("mhqz", "littoral-ship", "Littoral Combat Ship", "Built for the open sea; attacks the ground only. Carries its own ASW plane, and trains submarines.",
     dict(kind=U, tier=1, zh="擅长远洋作战，只能对地攻击；自带一架反潜机，可建造潜艇。", extra={"sonar": 8},
          wing=dict(unit="asw-plane", count=1, rebuild=15, sortie=30, rearm=3, range=10))),
    ("mhsd", "aegis-cruiser", "Aegis Cruiser", "Air defence only: however many planes come, it downs them.",
     dict(kind=U, tier=1)),
    ("mhhm", "light-carrier", "Light Carrier", "The core of an early fleet: eight attack drones fly from it at what it fights, and are made again as they are lost.",
     dict(kind=U, tier=1, armed=False,
          wing=dict(unit="attack-drone", count=8, rebuild=5, sortie=15, rearm=1.5, range=12))),
    ("lili", "supply-ship", "Supply Ship", "Unarmed; builds defences at sea and on the shore.",
     dict(kind=U, tier=2, armed=False)),
    ("fghj", "nuclear-sub", "Strategic Nuclear Submarine", "Fires sub-nuclear missiles at the ground, hidden while it lies still.",
     dict(kind=U, tier=2, extra={"underwater": True})),
    ("zdqt", "ghost-sub", "Ghost Submarine", "Sneaks up on units ashore; heavy damage.",
     dict(kind=U, tier=2, domain="ship", extra={"underwater": True})),
    ("wwzj", "dreadnought", "Dawn-Class Dreadnought", "A long-range killer: missiles that track far.",
     dict(kind=U, tier=2)),
    ("bigs", "judgment", "Judgment-Class Battleship", "Built to sink warships.",
     dict(kind=U, tier=3)),
    ("bigs2", "land-cruiser", "Land Cruiser", "A battleship on tracks: a giant gun, lasers and rail guns at air, ground and sub, and a base it builds as it goes.",
     dict(kind=U, tier=3, armor="heavy", trail="tread", zh="陆地上的战列舰：巨炮、激光和电磁炮对空对地对潜，还能边走边建造。")),
    ("hangmu", "battle-carrier", "Battle Carrier", "The largest surface ship: air and ground, and it mends itself.",
     dict(kind=U, tier=3)),
    ("航空母舰", "aircraft-carrier", "Aircraft Carrier", "A flying carrier: its interceptors swarm what comes near. Builds more interceptors from its card, up to eight.",
     dict(kind=U, tier=3, zh_name="航空母舰", weapons=carrier_guns(4))),
    ("蛟龙", "jiaolong", "Jiaolong", "A sea dragon of a warship.",
     dict(kind=U, tier=3, zh_name="蛟龙")),
]

# Authored GF units and deployment forms missing from the initial roster.
ROSTER += [
    ("kongmu2", "sky-support-carrier", "Sky Support Carrier", "Mobile aircraft factory with a rapidly regenerating shield.", dict(kind=U, tier=3)),
    ("hangmu2", "flying-battle-carrier", "Flying Battle Carrier", "An airborne factory that deploys as a ground base.", dict(kind=U, tier=3)),
    ("hangmu3", "battle-carrier-deployed", "Deployed Battle Carrier", "The carrier landed as a forward production base.", dict(kind=U, tier=3, domain="ground", form=True, extra={"speed":0})),
    ("prop2", "floating-array-landed", "Landed Floating Array", "The floating defence array in its landed form.", dict(kind=B, tier=2, power=-6, tower=True)),
    ("拦截机3", "carrier-interceptor", "Carrier Interceptor", "An interceptor launched by the flying carrier.", dict(kind=U, tier=1, domain="air", wing_plane=True, extra={"pop":0}, untargetable=False)),
]

# the aircraft carrier's levels (`航空母舰1`…`4`): a form each, reached from its card
CARRIER_LEVELS = {n: f"aircraft-carrier-{n + 1}" for n in range(1, 5)}
for n, suffix in CARRIER_LEVELS.items():
    roman = ["II", "III", "IV", "V"][n - 1]
    ROSTER.append((f"航空母舰{n}", suffix, f"Aircraft Carrier {roman}", f"The aircraft carrier with {4 + n} interceptors on its deck.",
                   dict(kind=U, tier=3, zh_name=f"航空母舰 {roman}", zh=f"甲板上有 {4 + n} 架拦截机的航空母舰。", form=True,
                        weapons=carrier_guns(4 + n, quick=n == 4))))

# the hero line: a tank that ranks up. Here each rank is its own unit, trained at the
# barracks (ranks 1-3) or the tower (the final form), priced as the rank costs to reach
HERO_NAMES = {
    "lv1": ("hero-1", "Hero Tank Lv1", "The hero tank. Ground only; ranks up into three lines."),
    "lv2a": ("hero-gatling", "Gatling Tank Lv2", "Faster, quicker-firing, longer-reaching; air and ground."),
    "lv2b": ("hero-twin", "Twin-Gun Heavy Lv2", "More firepower; ground only."),
    "lv2c": ("hero-grenade", "Grenade Tank Lv2", "Harder-hitting; ground only."),
    "lv3aa": ("hero-stalker", "Stalker Lv3", "Speed, rate and range pushed further; air and ground."),
    "lv3ab": ("hero-eradicator", "Eradicator Lv3", "More firepower and range; moves on water; air, ground and sub."),
    "lv3ac": ("hero-wrecker", "Wrecker Lv3", "A much wider blast; air and ground."),
    "lv3ba": ("hero-guardian", "Guardian Lv3", "Range and firepower up; air and ground, and it mends itself."),
    "lv3bb": ("hero-hellfire", "Hellfire Lv3", "Range and firepower far up; ground and sub."),
    "lv3bc": ("hero-defender", "Defender Lv3", "Range, firepower and blast up; air, ground and sub."),
    "lv3ca": ("hero-rover", "Rover Lv3", "Everything up; air, ground and sub."),
    "lv3cb": ("hero-destroyer", "Destroyer Lv3", "A far harder hitter; air and ground."),
    "lv3cc": ("hero-aurora", "Aurora Lv3", "Range and rate of fire up; air and ground."),
    "lv4aa": ("hero-stalker-max", "Stalker MAX", "Everything far up; air and ground; mends itself."),
    "lv4ab": ("hero-eradicator-max", "Eradicator MAX", "Everything far up; moves on water; air, ground and sub."),
    "lv4ac": ("hero-wrecker-max", "Wrecker MAX", "Everything far up; air and ground; mends itself."),
    "lv4ba": ("hero-guardian-max", "Guardian MAX", "Everything far up; mends itself."),
    "lv4bb": ("hero-hellfire-max", "Hellfire MAX", "Everything far up; ground and sub."),
    "lv4bc": ("hero-defender-max", "Defender MAX", "Everything far up; air, ground and sub; moves on water."),
    "lv4ca": ("hero-rover-max", "Rover MAX", "Everything far up; air, ground and sub; moves on water."),
    "lv4cb": ("hero-destroyer-max", "Destroyer MAX", "Everything far up; air and ground."),
    "lv4cc": ("hero-aurora-max", "Aurora MAX", "Everything far up; air and ground."),
}
for rw, (suffix, en, desc) in HERO_NAMES.items():
    rank = int(rw[2])
    ROSTER.append((rw, suffix, en, desc, dict(kind=U, tier=min(3, max(1, rank - 1)), armor="medium" if rank < 3 else "heavy",
                                              trail="tread", hero=rank, aiWeight=0.3, form=rank > 1)))

# what each building trains, by suffix
PRODUCTION = {
    "command": ["builder"],
    "army-base": ["grizzly", "hover-tank", "artillery", "hover-transport", "minelayer", "rocket-truck", "tank-killer",
                  "flame-tank", "missile-tank", "rocket-launcher", "striker-vx", "tengu-mech", "tank-destroyer",
                  "heavy-tank", "heavy-hover-tank", "prism-tank", "tesla-tank"],
    "air-base": ["apache", "fighter", "wasp", "strike-jet", "amphibious-jet", "wolfhound", "twinblade", "tengu-jet",
                 "striker-gunship", "bone-eagle", "strategic-bomber", "century-bomber", "carrier-airship"],
    "naval-base": ["destroyer", "construction-ship", "littoral-ship", "aegis-cruiser", "light-carrier", "cruiser",
                   "submarine", "battleship", "supply-ship", "nuclear-sub", "ghost-sub", "dreadnought",
                   "general-battleship", "judgment", "battle-carrier", "jiaolong", "aircraft-carrier"],
    # where Rusted Warfare builds them: the T3 factory's list, the black-tech factory's
    "t3-factory": ["apocalypse", "mirage-tank", "v3-launcher", "pacifier", "siege-tank", "vanguard-gunship",
                   "shield-tank", "kirov", "lord-of-the-sky"],
    "black-tech-factory": ["experimental-tank", "star-warship", "battlecruiser", "hover-escort", "b52", "laser-ufo",
                           "teleporter", "land-cruiser"],
    "airfield": ["vanguard-gunship", "heavy-gunship", "shield-tank", "skyshaker", "sky-support-carrier", "flying-battle-carrier"],
    # the hero tank ranks itself up from its card (`morph` buttons), as the original's does
    "hero-barracks": ["hero-1"],
}
# a line's second level trains everything the first does
for base in ("army-base", "air-base", "naval-base"):
    PRODUCTION[base + "-2"] = list(PRODUCTION[base])
# a unit that needs its line's second level, by tier
BUILDERS = {  # builder unit suffix -> the buildings it places
    "builder": ["command", "army-base", "air-base", "naval-base", "mine", "sentry", "artillery-emplacement",
                "flame-turret", "patriot", "flak", "prism-tower", "repair-depot", "nuke-silo", "black-tech-factory",
                "battle-lab", "t3-factory", "colossus-gun", "proton-cannon", "floating-array", "reactor", "airfield",
                "hero-barracks", "hero-tower"],
    "construction-ship": ["naval-base", "mine", "sentry", "patriot", "flak", "prism-tower", "repair-depot", "floating-array"],
    "supply-ship": ["repair-depot", "prism-tower", "floating-array", "sentry", "patriot"],
    # the rocket truck nano-builds a command centre in the original, a forward base on wheels
    "rocket-truck": ["command"],
}


# ------------------------------------------------------------------ media
SHEETS = []
SHEET_BY_HASH = {}
NOTES = []
OUT_SPRITES = os.path.join(OUT, "sprites")


def note(unit, msg):
    NOTES.append(f"{unit}: {msg}")


def clean_alpha(im):
    """drop near-invisible alpha, and keep every pixel out of the game's magenta remap test
    (r>60 && b>60 && (r+b)/2-g>28 && |r-b|<95): the package paints no faction colour"""
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


def open_art(path, who):
    """a picture of the League's, or None when it is Rusted Warfare's own"""
    if not path or not os.path.exists(path):
        return None
    if is_stock_art(path):
        note(who, f"{os.path.relpath(path, SKY)} is stock Rusted Warfare art; left out")
        return None
    return Image.open(path).convert("RGBA")


def add_sheet(key, im, frames, rotated, fw=None, fh=None, pivot_y=None, mount=None, pivot_x=None, anims=None, fps=None):
    """dedupe identical art: a second def naming the same image shares the sheet"""
    h = hashlib.md5(im.tobytes()).hexdigest() + f":{frames}:{fw}:{fh}:{pivot_x}:{pivot_y}:{mount}:{anims}:{fps}"
    if h in SHEET_BY_HASH:
        return SHEET_BY_HASH[h]
    entry = {"key": key, "file": f"sprites/{key}.png", "frames": frames}
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
    if mount and 0 <= mount[0] <= 1 and 0 <= mount[1] <= 1:
        entry["mount"] = [round(mount[0], 3), round(mount[1], 3)]
    if not DRY and not NO_MEDIA:
        im.save(os.path.join(OUT_SPRITES, f"{key}.png"))
    SHEETS.append(entry)
    SHEET_BY_HASH[h] = key
    return key


def still_hull(im, frames):
    """a helicopter's hull without its blades: the package animates the rotor in the body's
    frames, and the game lays its own spinning rotor on anything that hovers. A pixel most
    frames agree on is the hull; one a blade sweeps across in a frame or two is not"""
    fw = im.width // frames
    fr = [im.crop((i * fw, 0, (i + 1) * fw, im.height)).load() for i in range(frames)]
    need = math.ceil(frames * 0.6)
    out = Image.new("RGBA", (fw, im.height), (0, 0, 0, 0))
    po = out.load()
    for y in range(im.height):
        for x in range(fw):
            vals = [f[x, y] for f in fr if f[x, y][3] > 24]
            if len(vals) < need:
                continue
            best = max(vals, key=lambda v: sum(1 for w in vals if max(abs(v[i] - w[i]) for i in range(3)) <= 16))
            po[x, y] = best
    return out


def anims_of(gfx, frames):
    """the original's frames by state (`animation_moving_*`, `_idle_*`, `_attack_*`): a
    Mirage tank's moving frames are a tank and its idle ones a tree. The package's speed is
    game ticks a frame at sixty a second."""
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


def rw_actions(ini):
    """every action the unit offers, as written in `[action_*]` sections or inline in `[core]`
    (`action_1_convertTo: lv2a`)"""
    acts = {}
    for k, v in ini.get("core", {}).items():
        m = re.match(r"action_(\w+?)_(\w+)$", k)
        if m:
            acts.setdefault("core_" + m.group(1), {})[m.group(2)] = v
    for sec, kv in ini.items():
        if sec.startswith("action_") or sec.startswith("hiddenAction_"):
            a = acts.setdefault(sec, {})
            a.update(kv)
            if sec.startswith("hiddenAction_"):
                a["_hidden"] = True
    return [dict(a, _id=k) for k, a in acts.items()]


# what an action's lock asks to be standing, by the tag the original checks for: the hero
# tower (13), and the second-level mech factory (a), whose place the army base's second level takes
LOCK_TAGS = {"13": "hero-tower", "a": "army-base-2"}


def lock_requires(cond):
    out = []
    for tag in re.findall(r'numberOfUnitsInTeam\(withTag=["\']([^"\']+)["\']', cond or ""):
        if tag in LOCK_TAGS:
            out.append(LOCK_TAGS[tag])
    return out


def rw_color(v, fallback):
    """#RRGGBB, or the package's #AARRGGBB with its alpha dropped"""
    v = (v or "").strip()
    if re.fullmatch(r"#[0-9a-fA-F]{8}", v):
        return "#" + v[3:]
    if re.fullmatch(r"#[0-9a-fA-F]{6}", v):
        return v
    return fallback


def scale_key(v, default=1.0):
    """a scale as written: missing is the default, and 0 is 0 (a part the package hides so)"""
    n = num(v)
    return default if n is None else n


def body_scale(ini, d):
    """the body's scale as Rusted Warfare draws it: `imageScale`, times `scaleImagesTo` px over a
    frame's width when that is set"""
    gfx, core = ini.get("graphics", {}), ini.get("core", {})
    k = 1.0
    sit = num(gfx.get("scaleImagesTo"))
    p = resolve(gfx.get("image"), d)
    if sit and sit > 0 and p:
        fw = Image.open(p).width // max(1, int(num(gfx.get("total_frames")) or 1))
        k = sit * scale_key(core.get("globalScale")) / max(1, fw)
    return k * scale_key(gfx.get("imageScale"))


def turret_scale(ini, d):
    """every turret of a unit is drawn at one scale: `scaleTurretImagesTo` px over the width of the
    unit's `image_turret` (not the turret's own picture), else 1 (not the body's `imageScale`),
    times `turretImageScale`"""
    gfx, core = ini.get("graphics", {}), ini.get("core", {})
    k = 1.0
    stit = num(gfx.get("scaleTurretImagesTo"))
    p = resolve(gfx.get("image_turret"), d)
    if stit and stit > 0 and p:
        k = stit * scale_key(core.get("globalScale")) / max(1, Image.open(p).width)
    return k * scale_key(gfx.get("turretImageScale"))


def prep(im, scale=1.0, angle=0.0, frame0=1):
    im = clean_alpha(im)
    if frame0 > 1:
        im = im.crop((0, 0, im.width // frame0, im.height))
    w, h = im.width * scale, im.height * scale
    if abs(w - im.width) > 0.5 or abs(h - im.height) > 0.5:
        im = im.resize((max(1, round(w)), max(1, round(h))), Image.LANCZOS)
    if angle:
        im = im.rotate(-angle, resample=Image.BICUBIC, expand=True)
    return im


def crop_about(cv):
    """a picture centred on its pivot, cut to what it paints: the cut, and where the pivot now sits (fractions)"""
    bb = cv.getbbox()
    if not bb:
        return cv, 0.5, 0.5
    x0, y0, x1, y1 = max(0, bb[0] - 1), max(0, bb[1] - 1), min(cv.width, bb[2] + 1), min(cv.height, bb[3] + 1)
    px, py = cv.width / 2 - x0, cv.height / 2 - y0
    # the pivot stays inside the frame, even for a gun painted off its ring
    x0 = int(min(x0, cv.width / 2 - 1)); y0 = int(min(y0, cv.height / 2 - 1))
    x1 = int(max(x1, cv.width / 2 + 1)); y1 = int(max(y1, cv.height / 2 + 1))
    out = cv.crop((x0, y0, x1, y1))
    return out, (cv.width / 2 - x0) / out.width, (cv.height / 2 - y0) / out.height


def trim_hull(im, frames):
    """a hull strip cut to what its frames paint, about the centre, so the pivot stays put"""
    fw = im.width // frames
    bb = None
    for i in range(frames):
        b = im.crop((i * fw, 0, (i + 1) * fw, im.height)).getbbox()
        if b:
            bb = b if bb is None else (min(bb[0], b[0]), min(bb[1], b[1]), max(bb[2], b[2]), max(bb[3], b[3]))
    if not bb:
        return im
    hw = max(fw / 2 - bb[0], bb[2] - fw / 2) + 1
    hh = max(im.height / 2 - bb[1], bb[3] - im.height / 2) + 1
    x0, x1 = int(max(0, math.floor(fw / 2 - hw))), int(min(fw, math.ceil(fw / 2 + hw)))
    y0, y1 = int(max(0, math.floor(im.height / 2 - hh))), int(min(im.height, math.ceil(im.height / 2 + hh)))
    if x1 - x0 >= fw and y1 - y0 >= im.height:
        return im
    out = Image.new("RGBA", ((x1 - x0) * frames, y1 - y0), (0, 0, 0, 0))
    for i in range(frames):
        out.alpha_composite(im.crop((i * fw + x0, y0, i * fw + x1, y1)), (i * (x1 - x0), 0))
    return out


def lay_stack(items):
    """one image centred on the pivot with every item laid at its offset: (image, x, y), px, y forward"""
    half_w = half_h = 1.0
    for im, x, y in items:
        half_w = max(half_w, abs(x) + im.width / 2)
        half_h = max(half_h, abs(y) + im.height / 2)
    W, H = int(math.ceil(half_w * 2)) + 2, int(math.ceil(half_h * 2)) + 2
    cv = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for im, x, y in items:
        cv.alpha_composite(im, (int(round(W / 2 + x - im.width / 2)), int(round(H / 2 - y - im.height / 2))))
    return cv


def turret_parts(ini, from_dir):
    """the imaged turrets with their places about the unit's origin (RW px, y forward), the root
    they turn about, and the ones bolted to the hull that turn on their own"""
    secs = {s: kv for s, kv in ini.items() if s.startswith("turret_")}

    def abs_pos(s, depth=0):
        kv = secs[s]
        x, y = num(kv.get("x")) or 0, num(kv.get("y")) or 0
        parent = kv.get("attachedTo")
        if parent and depth < 6:
            ps = "turret_" + parent.strip()
            if ps in secs:
                px, py = abs_pos(ps, depth + 1)
                return px + x, py + y
        return x, y

    gfx = ini.get("graphics", {})
    default_img = gfx.get("image_turret")
    parts = []
    for s, kv in secs.items():
        if boolish(kv.get("invisible")):
            continue
        img = kv.get("image") or default_img
        if not img or img.upper() == "NONE":
            continue
        hit = resolve(img, from_dir)
        if hit:
            parts.append((s, hit, abs_pos(s)))
    parents = {kv.get("attachedTo", "").strip() for kv in secs.values() if kv.get("attachedTo")}
    root = None
    for s, kv in secs.items():
        if s[len("turret_"):] in parents and not kv.get("attachedTo"):
            root = s
            break
    if root is None:
        cands = [p[0] for p in parts if not secs[p[0]].get("attachedTo")]
        if cands:
            root = min(cands, key=lambda s: abs(num(secs[s].get("x")) or 0) + abs(num(secs[s].get("y")) or 0))

    def on_root(s, depth=0):
        if s == root:
            return True
        parent = secs[s].get("attachedTo")
        ps = ("turret_" + parent.strip()) if parent else None
        return bool(ps and ps in secs and depth < 8 and on_root(ps, depth + 1))

    hull_parts = [p for p in parts if root and not on_root(p[0])]
    parts = [p for p in parts if not root or on_root(p[0])]
    root_pos = abs_pos(root) if root else (0, 0)
    parts.sort(key=lambda p: p[0] != root)
    return parts, root_pos, hull_parts


MAX_RINGS = 8  # the game's `MAX_DEF_MOUNTS`


def turret_rings(ini, from_dir, who):
    """where a hull's guns stand when it has several alike: every turret that turns on its own
    (attached to none) and shows a picture, at its place about the unit's origin (RW px, y
    forward). Rusted Warfare turns each of them; the game draws the def's one turret on a ring
    for each (`turretMounts`), so they must be one picture with the same fittings riding on it.
    None for a hull with one gun, or with guns of different kinds (those stay painted on)."""
    secs = {s: kv for s, kv in ini.items() if s.startswith("turret_")}
    default_img = ini.get("graphics", {}).get("image_turret")

    def picture(kv):
        img = kv.get("image") or default_img
        if boolish(kv.get("invisible")) or not img or img.upper() == "NONE":
            return None
        hit = resolve(img, from_dir)
        # a blank marker (the gunships' 1×2 px turrets) is a gun the package does not draw
        return hit if hit and Image.open(hit).convert("RGBA").getbbox() else None

    def parent(s):
        p = (secs[s].get("attachedTo") or "").strip()
        return "turret_" + p if p and "turret_" + p in secs else None

    def place(s, depth=0):
        x, y = num(secs[s].get("x")) or 0, num(secs[s].get("y")) or 0
        p = parent(s)
        if p and depth < 6:
            px, py = place(p, depth + 1)
            return px + x, py + y
        return x, y

    def base(s, depth=0):
        p = parent(s)
        return base(p, depth + 1) if p and depth < 8 else s

    roots = [s for s, kv in secs.items() if not kv.get("attachedTo") and picture(kv)]
    if len(roots) < 2:
        return None

    def rig(r):
        rx, ry = place(r)
        return tuple(sorted((os.path.basename(picture(kv)), round(place(s)[0] - rx, 1), round(place(s)[1] - ry, 1))
                            for s, kv in secs.items() if base(s) == r and picture(kv)))
    if len({rig(r) for r in roots}) > 1:
        note(who, "turrets of different kinds; all but the main one stay painted on the hull")
        return None
    rings = []
    for r in roots:
        if place(r) not in rings:
            rings.append(place(r))
    if len(rings) > MAX_RINGS:
        note(who, f"{len(rings)} turrets; the first {MAX_RINGS} turn")
    return rings[:MAX_RINGS] if len(rings) > 1 else None


# ------------------------------------------------------------ conversion
SCRIPT_PROJECTILES = ()


def first_projectile(ini):
    for s, kv in ini.items():
        if not s.startswith("projectile_"):
            continue
        if boolish(kv.get("invisible")):
            continue
        if (num(kv.get("directDamage")) or 0) > 0 or (num(kv.get("areaDamage")) or 0) > 0:
            return s[len("projectile_"):]
    return None


def projectile_look(p, d, who, wid):
    """the original's own look for a round: its laser or its lightning as a beam, or its picture"""
    laser, bolt = boolish(p.get("laserEffect")), boolish(p.get("lightingEffect"))
    if laser or bolt:
        color = rw_color(p.get("color"), "#a6d8ff" if bolt else "#ff6a5a")
        return {"beam": {"color": color, "width": 1.5 if bolt else 2, "style": "lightning" if bolt else "laser",
                         "life": 0.18 if bolt else 0.14}, "impact": "fx.spark"}
    img = (p.get("image") or "").strip()
    if not img or img.upper() == "NONE":
        return None
    path = resolve(img, d)
    pim = open_art(path, who)  # the package's shared projectile strip is Rusted Warfare's, and left out
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
    size = num(p.get("drawSize")) or 1.0
    k = ART * size
    fw, fh = int(clamp(round(fr.width * k), 4, 48)), int(clamp(round(fr.height * k), 4, 48))
    key = add_sheet(f"prj.{who}-{wid}"[:44], fr, 1, True, fw, fh)
    return {"sprite": key}


def convert_weapons(ini, d, domain, ov, who, rings=False):
    """`rings`: the hull's guns are drawn on rings of their own (`turret_rings`), so a weapon of
    several turrets is a burst the game walks round them, each shot from its own ring"""
    atk = ini.get("attack", {})
    secs = {s: kv for s, kv in ini.items() if s.startswith("turret_")}
    range_px = num(atk.get("maxAttackRange")) or 130
    delay_default = seconds(atk.get("shootDelay")) or 1.0
    can_land = boolish(atk.get("canAttackLandUnits"), True)
    can_air = boolish(atk.get("canAttackFlyingUnits"), False)
    can_sub = boolish(atk.get("canAttackUnderwaterUnits"), False)
    turret_size = num(atk.get("turretSize")) or 0

    def abs_pos(s, depth=0):
        kv = secs[s]
        x, y = num(kv.get("x")) or 0, num(kv.get("y")) or 0
        parent = kv.get("attachedTo")
        if parent and depth < 6 and ("turret_" + parent.strip()) in secs:
            px, py = abs_pos("turret_" + parent.strip(), depth + 1)
            return px + x, py + y
        return x, y

    groups = {}
    for s, kv in secs.items():
        if s[len("turret_"):] in ov.get("manual_turrets", []):
            continue  # fired by a paid action, never an automatic weapon
        if boolish(kv.get("canShoot"), True) is False:
            continue
        proj = (kv.get("projectile") or "").strip()
        if not proj:
            n = s[len("turret_"):]
            proj = n if f"projectile_{n}" in ini else (first_projectile(ini) or "")
        if not proj or f"projectile_{proj}" not in ini:
            continue
        pos = abs_pos(s)
        lst = groups.setdefault(proj, [])
        lst.append((s, kv, pos))
    if not groups and "projectile_1" in ini:
        groups["1"] = [("turret_1", {}, (0, 0))]

    weapons = []
    core = ini.get("core", {})
    for proj, turrets in groups.items():
        p = ini[f"projectile_{proj}"]
        direct = num(p.get("directDamage")) or 0
        area = num(p.get("areaDamage")) or 0
        pellets = 1
        spawn = p.get("spawnProjectilesOnCreate")
        if direct <= 0 and area <= 0 and spawn:
            m = re.match(r"\s*([^*(,\s]+)\s*\*\s*(\d+)", spawn)
            if m and f"projectile_{m.group(1)}" in ini:
                p = ini[f"projectile_{m.group(1)}"]
                pellets = int(m.group(2))
                direct = num(p.get("directDamage")) or 0
                area = num(p.get("areaDamage")) or 0
        target_ground = boolish(p.get("targetGround"))
        dmg_rw = max(direct, area) * (1 + (pellets - 1) * 0.6)
        if dmg_rw <= 0:
            continue
        kv = turrets[0][1]
        # a turret waits out its warmup before every shot, and fires at most once a tick
        reload = max(1 / 60, seconds(kv.get("delay")) or delay_default) + (seconds(kv.get("warmup")) or 0)
        snd = (kv.get("shoot_sound") or "").lower()
        homing = (num(p.get("turnSpeed")) or 0) > 0 or "missile" in snd or "rocket" in snd
        arc = boolish(p.get("ballistic")) or (num(p.get("initialUnguidedSpeedHeight")) or 0) > 0 or ov.get("arc", False)
        flame = boolish(p.get("flameWeapon")) or ov.get("flame", False)
        instant = boolish(p.get("instant")) or boolish(p.get("laserEffect"))
        melee = boolish(atk.get("isMelee")) or range_px < 25
        t_air = boolish(kv.get("canAttackFlyingUnits"), can_air)
        t_land = boolish(kv.get("canAttackLandUnits"), can_land)
        t_sub = boolish(kv.get("canAttackUnderwaterUnits"), can_sub)
        targets = []
        if t_land:
            targets += ["ground", "ship"]
        if t_air:
            targets.append("air")
        if t_sub:
            targets.append("sub")
        if not targets:
            targets = ["ground", "ship"]
        only_air = t_air and not t_land and not t_sub
        dmg = dmg_rw * DMG
        if reload < 0.3:
            k = math.ceil(0.3 / reload)
            reload *= k
            dmg *= k
        rng = clamp(range_px * RANGE, 0.6, 16)
        if domain == "air":
            # an aircraft is never in melee: the package's bombers fly over what they hit, and
            # here drop from a bomber's reach
            if rng < 2.4 and t_land and not t_air:
                target_ground = True
            rng, melee = max(rng, 2.4), False
        elif melee:
            rng = 0.6
        if flame:
            rng = max(rng, 2.6)
        if flame:
            cls, projectile = "he", "flame"
        elif only_air:
            cls, projectile = "aa", ("missile" if homing else "flak")
        elif t_sub and not t_land:
            cls, projectile = "torpedo", "torpedo"
        elif arc or (target_ground and area > 0 and not homing and domain != "air"):
            cls, projectile = "he", "shell"
        elif target_ground and domain == "air":
            cls, projectile = "he", "bomb"
        elif homing:
            cls, projectile = "at", "missile"
        elif domain == "ship" and dmg >= 30:
            cls, projectile = "navgun", "shell"
        elif dmg < 12:
            cls, projectile = "mg", "bullet"
        elif dmg < 36:
            cls, projectile = "autocannon", "bullet"
        else:
            cls, projectile = "cannon", "shell"
        w = {"id": re.sub(r"[^a-z0-9_-]", "", proj.lower()) or f"w{len(weapons) + 1}", "cls": cls,
             "dmg": round(dmg, 1), "reload": round(max(0.05, reload), 2), "range": round(rng, 1), "targets": targets, "projectile": projectile}
        if w["id"][0].isdigit():
            w["id"] = "w" + w["id"]
        speed = num(p.get("speed"))
        if speed and not instant and not flame:
            w["speed"] = int(clamp(round(speed * 96), 60, 1500))
        elif flame:
            w["speed"] = 240
        else:
            w["speed"] = 1500 if instant else (900 if cls in ("mg", "autocannon") else 500)
        ar = num(p.get("areaRadius"))
        if area > 0 and ar and not flame:
            w["splash"] = int(round(clamp(ar * ART * DISPLAY * 0.6, 4, 120)))
        if homing:
            w["homing"] = True
        if arc and cls == "he" and projectile == "shell":
            w["arc"] = True
        if flame:
            glob = clamp(dmg * 0.5, 3, 12)
            w.update(fan=0.22, burn=round(clamp(glob * 1.5, 4, 16), 1), burnLife=5, splash=30, burst=12, burstDelay=0.04)
            w["dmg"] = round(glob, 1)
            w["reload"] = round(max(2.2, reload * 4), 2)
        n = len(turrets)
        if n > 1 and not flame:
            xs = sorted(t[2][0] for t in turrets)
            if n == 2 and abs(xs[0] + xs[1]) < 1 and abs(xs[1] - xs[0]) > 1 and not rings:
                w["bores"] = 2
                w["boreSpacing"] = round(min(60, (xs[1] - xs[0]) * ART * DISPLAY), 1)
            else:
                w["burst"] = min(8, n)
                w["burstDelay"] = 0.12
        spread = num(p.get("targetGroundSpread"))
        if spread:
            w["spread"] = int(round(clamp(spread * ART * DISPLAY, 2, 60)))
        if pellets > 1:
            w["spread"] = max(w.get("spread", 0), 10)
            w["projectile"] = "bullet"
        barrel = num(kv.get("size")) or turret_size or 0
        # a gun on a ring of its own is measured from that ring, not from the hull's centre
        w["_reach"] = barrel if rings else turrets[0][2][1] + barrel
        if flame:
            w["sound"] = "flame"
        # how it looks: a laser or a Tesla arc is a beam; a round with a picture of the mod's own flies as it
        look = projectile_look(p, d, who, w["id"])
        if look:
            w["look"] = look
        weapons.append(w)
    weapons.sort(key=lambda w: -(w["dmg"] * w.get("burst", 1) / max(0.05, w["reload"])))
    return weapons


def hero_prices(by_name):
    """what it costs to reach each rank of the hero: its own price, then the price of every step"""
    out = {"lv1": 1000.0}
    order = ["lv1"] + [k for k in HERO_NAMES if k != "lv1"]
    for rw in order:
        p = by_name.get(rw)
        if not p or rw not in out:
            continue
        core = load_unit(p).get("core", {})
        for k, v in core.items():
            m = re.match(r"action_(\d+)_convertTo$", k)
            if m and v.strip() in HERO_NAMES:
                step = num(core.get(f"action_{m.group(1)}_price")) or 0
                out.setdefault(v.strip(), out[rw] + step)
    return out


RW_TRAINS = {}  # unit id -> the rw names (or our suffixes) it trains, as its ini lists them


def build_list(ini):
    """the rw names a unit's canBuild entries name, in order"""
    lists = []
    for k, v in ini.get("core", {}).items():
        if re.match(r"canBuild_\d+_name$", k):
            lists += split_list(v)
    for sec, kv in ini.items():
        if sec.startswith("canBuild_") and kv.get("name"):
            lists += split_list(kv["name"])
    return [strip_quotes(x) for x in lists]


def convert():
    by_name = index_units()
    tr = translations()
    hero_cost = hero_prices(by_name)
    defs = []
    if not DRY and not NO_MEDIA:
        shutil.rmtree(OUT_SPRITES, ignore_errors=True)
        os.makedirs(OUT_SPRITES)

    for src, suffix, en, desc_en, ov in ROSTER:
        did = f"{MOD_ID}-{suffix}"
        core_type = src[5:] if src.startswith("core:") else None
        if core_type:
            ini, d = synth_ini(core_type, ov), RES
            tr_key = core_type
        else:
            path = by_name.get(src)
            if not path:
                note(src, "NOT FOUND in the package")
                continue
            ini, d = load_unit(path), os.path.dirname(path)
            tr_key = strip_quotes(ini.get("core", {}).get("name") or src)
            if ov.get("stats"):
                overlay_core(ini, ov["stats"])
                tr_key = ov["stats"]
        core, gfx, atk, mov = (ini.get(s, {}) for s in ("core", "graphics", "attack", "movement"))
        kind = ov["kind"]
        is_building = kind == B
        t = tr.get(tr_key, {}) or tr.get(src, {})
        zh_name = ov.get("zh_name") or t.get("name") or strip_quotes(core.get("displayText") or src)
        zh_name = zh_name.strip().strip("⇋⇌")
        desc_zh = ov.get("zh") or zh_text(t.get("description") or core.get("displayDescription", ""), "")

        # ---- numbers
        hp_rw = num(core.get("maxHp")) or 100
        shield = num(core.get("maxShield")) or 0
        price = num(core.get("price")) or 0
        if ov.get("price_of"):
            # a form is worth what the unit it is a form of is
            price = num(load_unit(by_name[ov["price_of"]]).get("core", {}).get("price")) or price
        if ov.get("hero"):
            price = hero_cost.get(src, price)
        cost = ov.get("cost", cost_of(price, is_building))
        # a shield is a shield of its own now (`shield`), not hull added to the hull
        hp = ov.get("hp", hp_of(hp_rw * ov.get("hp_mult", 1.0), is_building))
        if not is_building and "hp" not in ov:
            hp = int(min(hp, round((HP_PER_METAL * cost + 200) / 10) * 10))
        k_hp = hp / max(1.0, hp_rw)  # this unit's hull against the original's, compression and caps included
        tier = ov.get("tier", int(clamp(round(num(core.get("techLevel")) or 1), 1, 3)))
        movement = (mov.get("movementType") or ("NONE" if is_building else "LAND")).upper()
        domain = ov.get("domain") or ("air" if movement == "AIR" else "ship" if movement == "WATER"
                                      else "amphibious" if movement in ("HOVER", "OVER_CLIFF_WATER") else "ground")

        df = {"id": did, "name": [en, zh_name], "desc": [desc_en, desc_zh or desc_en], "kind": "building" if is_building else "unit"}
        if not is_building:
            df["domain"] = domain
        df["tier"] = tier
        df["cost"] = cost
        bt = build_seconds(core.get("buildSpeed"))
        if ov.get("hero"):
            bt = None  # a rank is bought in the original, not built; here it takes what its price says
            df["buildTime"] = round(clamp(cost / 14, 10, 120))
        if bt:
            df["buildTime"] = round(clamp(bt * BUILD_TIME, 4, 90 if is_building else 120), 1)
        df["hp"] = hp
        if not is_building:
            df["pop"] = ov.get("pop", 1 if cost < 250 else 2 if cost < 700 else 3 if cost < 1500 else 4 if cost < 3000 else 5)
        armor = ov.get("armor")
        if not armor:
            if is_building:
                armor = "structure"
            elif domain == "air":
                armor = "air"
            elif domain == "ship":
                armor = "ship"
            else:
                armor = "light" if hp_rw < 200 else "medium" if hp_rw < 550 else "heavy"
        df["armor"] = armor
        vision = num(core.get("fogOfWarSightRange"))
        df["vision"] = ov.get("vision", int(clamp(round((vision or 15) * VISION), 5, 16)))
        radius = num(core.get("radius"))
        if not is_building:
            df["radius"] = int(clamp(round(radius or 10), 4, 30))
            sp = num(mov.get("moveSpeed"))
            if boolish(core.get("isBuilding")):
                df["speed"] = 0  # a form the original deploys into: it stands where it is
            elif sp is not None and sp > 0:
                df["speed"] = int(clamp(round(sp * SPEED), 16, 300))
            tr_ = num(mov.get("maxTurnSpeed"))
            if tr_ is not None and tr_ > 0:
                df["turnRate"] = round(clamp(tr_ * 60 * math.pi / 180, 0.5, 8), 2)
            if "trail" in ov:
                df["trail"] = ov["trail"]
            if ov.get("hovers"):
                df["hovers"] = True
            cap = num(core.get("maxTransportingUnits"))
            if cap and domain != "air" and not ov.get("wing"):
                df["transportCap"] = int(clamp(cap, 1, 50))
            if domain != "air":
                df["fireOnMove"] = True
            # a carrier or a supply ship that earns, as the original's do
            gen = num(core.get("generation_credits"))
            if gen and gen > 0:
                every = (num(core.get("generation_delay")) or 60) / 60
                df["metalRate"] = round(clamp(gen / every * INCOME, 0.1, 4), 2)
        else:
            fp = [num(x) for x in split_list(core.get("footprint", ""))]
            if "fw" in ov:
                df["fw"], df["fh"] = ov["fw"], ov["fh"]
            elif len(fp) == 4 and all(x is not None for x in fp):
                df["fw"] = int(clamp(fp[2] - fp[0] + 1, 1, 8))
                df["fh"] = int(clamp(fp[3] - fp[1] + 1, 1, 8))
            df["power"] = ov.get("power", 0)
            gen = num(core.get("generation_credits"))
            if "metalRate" in ov:
                df["metalRate"] = ov["metalRate"]
            elif gen:
                every = (num(core.get("generation_delay")) or 60) / 60
                df["metalRate"] = round(clamp(gen / every * INCOME, 0.5, 12), 1)
            if ov.get("needsDeposit"):
                df["needsDeposit"] = True
            if "upgradeOf" in ov:
                df["upgradeOf"] = f"{MOD_ID}-{ov['upgradeOf']}"
                df["upgradeCost"] = ov.get("upgradeCost", max(50, cost // 2))
                df["upgradeTime"] = ov.get("upgradeTime", 30)

        # several guns alike that turn on their own: the def's one turret drawn on a ring for each
        hull_guns = "weapons" in ov and all(w.get("turret") is False for w in ov["weapons"])
        rings = None if is_building or ov.get("no_turret") or hull_guns else turret_rings(ini, d, did)

        # ---- weapons
        weapons = []
        if "weapons" in ov:
            weapons = [dict(w) for w in ov["weapons"]]
        elif ov.get("armed", True) and boolish(atk.get("canAttack"), False):
            weapons = convert_weapons(ini, d, domain, ov, did, rings=bool(rings))
        # one fire hose, however many nozzles the original gives it
        flames = [w for w in weapons if w.get("projectile") == "flame"]
        if len(flames) > 1:
            weapons = [w for w in weapons if w.get("projectile") != "flame"] + [flames[0]]
        if weapons and "weapons" not in ov:
            dps = sum(w["dmg"] * w.get("burst", 1) * w.get("bores", 1) / w["reload"] for w in weapons)
            cap = dps_cap(cost, is_building) * ov.get("dps_mult", 1.0)
            if dps > cap:
                k = cap / dps
                for w in weapons:
                    w["dmg"] = round(max(2.0, w["dmg"] * k), 1)
                    if w["cls"] in ("mg", "autocannon", "cannon") and not w.get("homing") and not w.get("arc"):
                        w["cls"] = "mg" if w["dmg"] < 12 else "autocannon" if w["dmg"] < 36 else "cannon"
                        w["projectile"] = "shell" if w["cls"] == "cannon" else "bullet"
        for w in weapons:
            w.update(ov.get("tune", {}))
        if weapons:
            df["weapons"] = weapons[:8]
        else:
            rings = None  # no turret is drawn for an unarmed hull: its guns stay painted on
        if ov.get("requires"):
            df["requires"] = [f"{MOD_ID}-{r}" for r in ov["requires"]]

        # ---- behaviour the original gives it
        if shield > 0:
            # at the half-strength the port counted it at as hull; its recharge is the package's a tick
            regen_rw = num(core.get("shieldRegen")) or 0
            sh = int(round(clamp(shield * k_hp * SHIELD, 5, 20000)))
            regen = regen_rw * 60 * k_hp * SHIELD if regen_rw > 0 else sh * 0.02
            df["shield"] = {"hp": sh, "regen": round(clamp(regen, sh * 0.01, sh / 4), 1), "delay": 2}
        mend = num(core.get("selfRegenRate")) or 0
        if mend > 0:
            # the package's rate is a tick's; here it is held to half a percent of the hull a second
            regen = min(mend * 60 * k_hp, hp * 0.005)
            if regen >= 0.5:
                df["regen"] = round(regen, 1)
        elif mend < 0:
            note(did, f"loses {-mend} hp a tick; restored by the source extension")
        if boolish(core.get("canNotBeDirectlyAttacked")) or ov.get("untargetable"):
            df["untargetable"] = True
        df["_actions"] = rw_actions(ini)
        if boolish(core.get("nukeOnDeath")):
            dmg_rw = num(core.get("nukeOnDeathDamage")) or 1000
            rng_rw = num(core.get("nukeOnDeathRange")) or 150
            df["_blast"] = {"dmg": int(round(clamp(dmg_rw * DMG * 0.25, 80, 900))), "radius": int(round(clamp(rng_rw * 32 * RANGE, 32, 200))), "cls": "he"}
        spawned = (core.get("unitsSpawnedOnDeath") or "").strip()
        if spawned:
            df["_spawned"] = spawned

        # ---- art
        image = resolve(gfx.get("image", ""), d)
        frames = int(max(1, round(num(gfx.get("total_frames")) or 1)))
        # RW px a picture px is drawn at, as the package sets it for the body and for its turrets
        scale, tur_scale = body_scale(ini, d), turret_scale(ini, d)
        art_k = 1.0
        hull_px = None
        bld_fit = None  # a building's px per image px: its frame is stretched to the footprint
        im = open_art(image, did)
        if ov.get("share"):
            im = None  # the same picture as another def's: its sheet is shared (`borrow`)
        if im is not None:
            if ov.get("frames_fix"):
                frames = ov["frames_fix"]
            pw = im.width // frames
            if frames > 1 and im.width % frames:
                im = im.crop((0, 0, pw * frames, im.height))
            if ov.get("hovers") and frames > 1:
                im, frames = still_hull(im, frames), 1
            im = clean_alpha(im)
            if not is_building:
                # the package pads a hull's frame; the collision body and the bake follow what is drawn
                im = trim_hull(im, frames)
                pw = im.width // frames
            parts, root_pos, hull_parts = turret_parts(ini, d)
            if is_building:
                back = resolve(gfx.get("image_back", ""), d)
                b = open_art(back, did) if back else None
                if b is not None:
                    b = clean_alpha(b)
                    width, height = max(b.width, pw), max(b.height, im.height)
                    strip = Image.new("RGBA", (width * frames, height))
                    for frame in range(frames):
                        cv = Image.new("RGBA", (width, height))
                        cv.alpha_composite(b, ((width-b.width)//2, height-b.height))
                        part = im.crop((frame*pw, 0, (frame+1)*pw, im.height))
                        cv.alpha_composite(part, ((width-pw)//2, height-part.height))
                        strip.alpha_composite(cv, (frame*width, 0))
                    im = strip
                bb = im.getbbox()
                if bb:
                    # a building's art stands in a big blank frame in some cases; the game fits the footprint
                    if frames == 1:
                        im = im.crop(bb)
                mount = None
                if ov.get("tower") and parts and not ov.get("no_turret"):
                    mount = (0.5 + root_pos[0] / (im.width // frames), 0.5 - root_pos[1] / im.height)
                sp = num(gfx.get("animation_idle_speed")) or num(gfx.get("animation_moving_speed"))
                fps = round(clamp(60 / sp, 0.3, 30), 2) if frames > 1 and sp and sp > 0 else None
                df["sprite"] = add_sheet(f"u.{did}", im, frames, False, mount=mount, fps=fps)
                bld_fit = df.get("fw", 2) * 32 / (im.width // frames)
            else:
                if frames > 1:
                    pass
                fw, fh, f = sheet_size(pw, im.height, scale)
                art_k = f / (ART * scale)
                hull_px = (pw, im.height)
                # guns bolted to the hull that turn on their own: laid on the body, still, unless
                # they are guns alike, which turn on rings of their own
                if frames == 1 and hull_parts and not rings:
                    items = [(prep(im), 0, 0)]
                    for _, hp_, pos in hull_parts:
                        part = open_art(hp_, did)
                        if part is not None:
                            items.append((prep(part, tur_scale / scale), pos[0] / scale, pos[1] / scale))
                    im = clean_alpha(lay_stack(items))
                    fw, fh, f = sheet_size(im.width, im.height, scale)
                    art_k = f / (ART * scale)
                mount = None
                if rings:
                    # the rings, in the hull sheet's px from its centre (y toward the tail)
                    df["turretMounts"] = [{"x": round(x / scale * fw / pw, 1), "y": round(-y / scale * fh / im.height, 1)} for x, y in rings]
                elif (parts or ov.get("turret")) and (abs(root_pos[0]) > 0.5 or abs(root_pos[1]) > 0.5):
                    mount = (0.5 + root_pos[0] / scale / pw, 0.5 - root_pos[1] / scale / im.height)
                df["sprite"] = add_sheet(f"u.{did}", im, frames, True, fw, fh, mount=mount,
                                         anims=anims_of(gfx, frames) if frames > 1 else None)
                df["body"] = {"r": round(fw * DISPLAY / 2, 1), "len": round(max(0, (fh - fw) * DISPLAY), 1)}
                df["_art"] = f"{os.path.relpath(image, SKY)[-40:]} {pw}x{im.height} f{frames} s{scale:.2f} -> {fw}x{fh}"
        elif ov.get("borrow"):
            other = next((x for x in defs if x["id"] == f"{MOD_ID}-{ov['borrow']}"), None)
            if other and other.get("sprite"):
                df["sprite"] = other["sprite"]
                if "body" in other:
                    df["body"] = dict(other["body"])
                if not ov.get("share"):
                    note(did, f"its own hull is stock art; drawn as {other['id']}")
        else:
            note(did, "no body image of the mod's own; placeholder")

        # ---- turret
        if (not is_building or ov.get("tower")) and not ov.get("no_turret") and not hull_guns and ("weapons" in df or ov.get("tower")):
            parts, root_pos, _ = turret_parts(ini, d)
            items, names = [], []
            for _, pth, pos in parts:
                pim = open_art(pth, did)
                if pim is None:
                    continue
                items.append((prep(pim), (pos[0] - root_pos[0]) / tur_scale, (pos[1] - root_pos[1]) / tur_scale))
                names.append(os.path.basename(pth))
            if items:
                cv = clean_alpha(lay_stack(items))
                if cv.getbbox():
                    k = art_k if hull_px else shrink(max(cv.size) * tur_scale)
                    f = ART * tur_scale * k
                    if bld_fit:
                        # a building's gun is drawn at the scale its body was fitted to the footprint at
                        f = bld_fit * tur_scale / scale
                        k = f / (ART * tur_scale)
                    cut, pvx, pvy = crop_about(cv)
                    tw, th = max(4, round(cut.width * f)), max(4, round(cut.height * f))
                    # a form that turns the same gun as the unit it is a form of shares its sheet
                    df["turretSprite"] = (f"tur.{MOD_ID}-{ov['turret_of']}" if ov.get("turret_of")
                                          else add_sheet(f"tur.{did}", cut, 1, True, tw, th, pivot_y=pvy, mount=None, pivot_x=pvx))
                    df["_tur"] = f"{'+'.join(names)} {cv.width}x{cv.height} ts{tur_scale:.2f} -> {tw}x{th}"
                    for w in df.get("weapons", []):
                        if w.get("turret", True) and "muzzleOffset" not in w:
                            reach = w.pop("_reach", None)
                            if reach is None or reach <= 0:
                                reach = cv.height / 2 * 0.9 * tur_scale
                            w["muzzleOffset"] = round(clamp(reach * k * ART * DISPLAY, 2, 200), 1)
        for w in df.get("weapons", []):
            w.pop("_reach", None)
            if "turretSprite" not in df:
                w["turret"] = False
                w.setdefault("muzzleOffset", round((hull_px[1] if hull_px else 20) * scale * art_k * ART * DISPLAY * 0.45, 1))
            elif w.get("turret") is None:
                w["turret"] = True
        if not is_building:
            df["aiWeight"] = ov.get("aiWeight", 1.0)
        if ov.get("hero"):
            df["_hero"] = ov["hero"]
        if ov.get("form") or ov.get("wing_plane"):
            # a form the unit takes, or a plane its carrier makes (`wing`): not one a line builds
            df["_form"] = True
            df["aiWeight"] = 0
        if ov.get("wing"):
            df["wing"] = dict(ov["wing"], unit=f"{MOD_ID}-{ov['wing']['unit']}")
        for k, v in ov.get("extra", {}).items():
            df[k] = v
        if ov.get("look"):
            for w in df.get("weapons", []):
                w["look"] = dict(ov["look"])
        if not is_building:
            # what the package lets this unit build itself: a carrier's wing, a mothership's escort
            RW_TRAINS[did] = build_list(ini) + ov.get("trains", [])
        defs.append(df)

    # ---- an upgrade level is worth the level below and the upgrade
    by_id = {d["id"]: d for d in defs}
    for d in defs:
        if d.get("upgradeOf") in by_id:
            d["cost"] = by_id[d["upgradeOf"]]["cost"] + d["upgradeCost"]
    # ---- production
    produced = {}
    for bsuf, units in PRODUCTION.items():
        bid = f"{MOD_ID}-{bsuf}"
        if bid not in by_id:
            continue
        lst = [f"{MOD_ID}-{u}" for u in units if f"{MOD_ID}-{u}" in by_id]
        # a line's first level trains its tier-1 units; the second everything
        if not bsuf.endswith("-2") and bsuf in ("army-base", "air-base", "naval-base"):
            lst = [u for u in lst if by_id[u]["tier"] == 1]
        by_id[bid]["produces"] = lst
        for u in lst:
            produced.setdefault(u, []).append(bid)
    # the units that train others (`produces` on a unit: a carrier launches its wing beside itself)
    alias = {}
    for src, suffix, _, _, _ in ROSTER:
        name = src[5:] if src.startswith("core:") else src
        alias.setdefault(name, suffix)
        if name.startswith("c_"):
            alias.setdefault(name[2:], suffix)  # RW's ini copy of a hard-coded unit answers to its name
        alias.setdefault(suffix, suffix)
    for uid, names in RW_TRAINS.items():
        trains = []
        for n in names:
            tid = f"{MOD_ID}-{alias[n]}" if n in alias else None
            # a form is taken, never trained: the Mirage's disguise is not a unit of its own
            if tid and tid != uid and tid in by_id and by_id[tid]["kind"] == "unit" and tid not in trains and not by_id[tid].get("_form"):
                trains.append(tid)
        if trains:
            by_id[uid]["produces"] = trains
            for t in trains:
                produced.setdefault(t, []).append(uid)
    behaviour(defs, by_id, alias)
    prev = f"{MOD_ID}-aircraft-carrier"
    for suffix in CARRIER_LEVELS.values():
        lv = by_id.get(f"{MOD_ID}-{suffix}")
        if lv and prev in by_id:
            step = next((r["button"]["cost"] for r in by_id[prev].get("rules", []) if r.get("do", {}).get("morph") == lv["id"]), 0)
            lv["cost"] = by_id[prev]["cost"] + step
            lv["pop"] = by_id[prev]["pop"]  # the same ship, with more on its deck
            prev = lv["id"]
    for d in defs:
        if d["kind"] == "unit":
            if d.pop("_form", False) and d["id"] not in produced:
                d["producedBy"] = []  # reached by a change of form, not a line
            elif d["id"] in produced:
                d["producedBy"] = produced[d["id"]]
            else:
                note(d["id"], "nobody trains it")
    for usuf, blds in BUILDERS.items():
        uid = f"{MOD_ID}-{usuf}"
        if uid not in by_id:
            continue
        lst = [f"{MOD_ID}-{b}" for b in blds if f"{MOD_ID}-{b}" in by_id]
        by_id[uid]["builds"] = lst
        by_id[uid]["buildRate"] = 30
    for d in defs:
        if d["kind"] == "building" and "upgradeOf" not in d:
            who = [f"{MOD_ID}-{u}" for u, blds in BUILDERS.items() if d["id"][len(MOD_ID) + 1:] in blds]
            d["builtBy"] = who
    order = {"building": 0, "unit": 1}
    defs.sort(key=lambda d: order[d["kind"]])
    return defs


CARRIER_IDS = {f"{MOD_ID}-{suffix}" for suffix in CARRIER_LEVELS.values()}


def faction_setup(defs):
    """Make the League's command/builder pair a self-contained opening."""
    command = next(d for d in defs if d["id"] == f"{MOD_ID}-command")
    command["isHQ"] = True
    # The nuclear generator is the League's only plant. The starter grid must
    # carry mines and production until that 3790-metal investment is possible.
    command["power"] = 60
    command["builtBy"] = [f"{MOD_ID}-builder", f"{MOD_ID}-rocket-truck"]
    return [{"id": f"{MOD_ID}-league", "name": ["FG Rusted League", "FG 铁锈联盟", "FG 러스티드 리그"],
             "headquarters": command["id"], "builder": f"{MOD_ID}-builder"}]


def behaviour(defs, by_id, alias):
    """The original's actions and deaths as rules (`game/modRules.ts`): a button for every
    change of form a player orders — a hero's next rank, a jet folding into a mech — a blast
    where a unit that goes up like a bomb dies, and the Mirage's disguise."""
    for d in defs:
        rules = []
        for a in d.pop("_actions", []):
            to = strip_quotes(a.get("convertTo") or "")
            tsuf = alias.get(to)
            tid = f"{MOD_ID}-{tsuf}" if tsuf else None
            if not tid or tid not in by_id or tid == d["id"] or by_id[tid]["kind"] != d["kind"]:
                continue
            if a.get("_hidden") or a.get("autoTrigger"):
                continue  # a scripted change: the Mirage's is written out below
            if d["kind"] == "building":
                continue  # a building's next level is its upgrade (`upgradeOf`)
            hero = d.get("_hero")
            if hero:
                # a rank is bought: its price the step between the two, its time what that buys
                cost = max(0, by_id[tid]["cost"] - d["cost"])
                secs = clamp(cost / 14, 5, 90)
            else:
                price = num(a.get("price")) or 0
                cost = cost_of(price) if price > 0 else 0
                secs = clamp((build_seconds(a.get("buildSpeed")) or 1.5) * BUILD_TIME, 1, 30)
            b = {"cost": int(cost), "time": round(secs, 1), "ai": True}
            req = [f"{MOD_ID}-{r}" for r in lock_requires(a.get("isLocked")) if f"{MOD_ID}-{r}" in by_id]
            if req:
                b["requires"] = req
            if any(r.get("do", {}).get("morph") == tid for r in rules):
                continue
            rules.append({"button": b, "do": {"morph": tid}})
        blast = d.pop("_blast", None)
        if blast:
            rules.append({"on": "destroyed", "do": {"explode": blast}})
        spawned = d.pop("_spawned", None)
        if spawned:
            sid = f"{MOD_ID}-{alias[spawned]}" if spawned in alias else None
            if sid in by_id and by_id[sid]["kind"] == "unit":
                rules.append({"on": "destroyed", "do": {"spawn": {"unit": sid}}})
            else:
                note(d["id"], f"spawns {spawned} where it dies in the original; not a unit of the port")
        d.pop("_hero", None)
        if rules:
            d["rules"] = rules
    for d in defs:
        for r in d.get("rules", []):
            b, to = r.get("button"), r.get("do", {}).get("morph") if isinstance(r.get("do"), dict) else None
            if not b or not to:
                continue
            other = by_id[to]
            # a change the other form can undo is the player's to make: a computer side flipping a
            # launcher to and fro every few seconds is no use to anyone
            if any(x.get("button") and isinstance(x.get("do"), dict) and x["do"].get("morph") == d["id"] for x in other.get("rules", [])):
                b["ai"] = False
            if other.get("speed") == 0 and d.get("speed", 1) != 0:
                b["name"], b["desc"] = ["Deploy", "部署"], ["Digs in where it stands: it fires further, and cannot move until packed up.", "原地展开：射程更远，收起前无法移动。"]
            elif d.get("speed") == 0 and other.get("speed", 1) != 0:
                b["name"], b["desc"] = ["Pack Up", "收起"], ["Back on its wheels and tracks.", "收起，恢复移动。"]
            elif to in CARRIER_IDS:
                b["name"], b["desc"] = ["Build an Interceptor", "建造拦截机"], ["One more interceptor on the deck.", "建造一架新的拦截机。"]
    # the Mirage: standing still it is a tree, moving or firing a tank (the original keeps
    # it hidden until it fires; here, as in Red Alert, it shows itself when it moves too)
    tank, tree = f"{MOD_ID}-mirage-tank", f"{MOD_ID}-mirage-disguised"
    if tank in by_id and tree in by_id:
        by_id[tank]["rules"] = [{"when": {"still": 1, "quiet": 0.8}, "do": {"morph": tree}}]
        by_id[tree]["rules"] = [{"when": {"moving": True}, "do": {"morph": tank}},
                                {"on": "fired", "do": {"morph": tank}}]


def sheet_size(px_w, px_h, scale):
    k = shrink(max(px_w, px_h) * scale)
    f = ART * scale * k
    return max(4, round(px_w * f)), max(4, round(px_h * f)), f


def dump(name):
    by_name = index_units()
    p = by_name.get(strip_quotes(name))
    if not p:
        print("not found:", name)
        return
    ini = load_unit(p)
    print("#", p)
    for s, kv in ini.items():
        if re.match(r"^(core|graphics|attack|movement|turret_.*|projectile_.*|leg_.*|arm_.*)$", s):
            keep = {k: v for k, v in kv.items() if not k.startswith(("@", "effect", "shoot_flame", "shoot_light", "idleSweep", "recoil", "explodeEffect", "trailEffect", "display", "copyFrom"))}
            print(f"[{s}] " + ", ".join(f"{k}={v[:40]}" for k, v in keep.items()))


def main():
    if "--dump" in sys.argv:
        for n in sys.argv[sys.argv.index("--dump") + 1:]:
            dump(n)
        return
    defs = convert()
    factions = faction_setup(defs)
    desc_en = ("The whole army redrawn in black and acid green — Grizzly and Prism tanks, Kirov airships, Patriot batteries — "
               "and the GF plugin's carriers, dreadnoughts, sky fortresses, a Mirage tank that hides as a tree and a hero tank "
               "that ranks itself up.")
    desc_zh = "整套重绘的军队——灰熊、光棱坦克、基洛夫空艇、爱国者导弹——以及 GF 插件的航母、无畏战舰、空中堡垒、会变成树的幻影坦克和能自己升级的英雄坦克。"
    manifest = {
        "format": "steel-tide-mod",
        "v": 2,
        "id": MOD_ID,
        "name": ["FG Rusted League", "FG 铁锈联盟"],
        "version": "0.5.0",
        "minGame": MIN_GAME,
        "author": "空中之主 (art by 有人, 基卡 and SS元首)",
        "description": [desc_en, desc_zh],
        "homepage": "https://github.com/steel-tide/mods/tree/main/mods/fg-rusted-league",
        "license": "LicenseRef-FG-Rusted-League",
        "defs": defs,
        "factions": factions,
        "sprites": SHEETS,
        "screenshots": [],
    }
    old = {}
    if os.path.exists(os.path.join(HERE, "mod.json")):
        old = json.load(open(os.path.join(HERE, "mod.json"), encoding="utf-8"))
        # Keep a newer hand-bumped version, never downgrade below this script.
        def version_parts(value):
            return tuple(int(n) if n.isdigit() else 0 for n in re.split(r"[.+-]", value))
        if old.get("id") == MOD_ID and version_parts(old.get("version", "0")) > version_parts(manifest["version"]):
            manifest["version"] = old["version"]
        manifest["screenshots"] = old.get("screenshots", [])
    if not manifest["screenshots"]:
        shots_dir = os.path.join(HERE, "screenshots")
        if os.path.isdir(shots_dir):
            manifest["screenshots"] = [f"screenshots/{f}" for f in sorted(os.listdir(shots_dir)) if re.search(r"\.(png|jpe?g|webp)$", f, re.I)]
    # the maps make-map.py writes, in name order; they are the mod's own, not the package's
    maps_dir = os.path.join(HERE, "maps")
    if os.path.isdir(maps_dir):
        found = [f"maps/{f}" for f in sorted(os.listdir(maps_dir)) if f.endswith(".steel-tide-map")]
        if found:
            manifest["maps"] = found
    spec = importlib.util.spec_from_file_location("source_parity", os.path.join(HERE, "source-parity.py"))
    parity = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(parity)
    from types import SimpleNamespace
    parity.apply(SimpleNamespace(**globals()), manifest)
    if DRY:
        art = "--art" in sys.argv
        for d in defs:
            if art:
                print(f"{d['id'][len(MOD_ID) + 1:]:24} {d.get('_art', '-')}" + (f"  | tur {d['_tur']}" if '_tur' in d else ""))
                continue
            ws = "; ".join(f"{w['id']}:{w['cls']} {w['dmg']}/{w['reload']}s r{w['range']}" + (f" x{w['burst']}" if 'burst' in w else "") + (f" b{w['bores']}" if 'bores' in w else "") + ("".join(t[0] for t in w['targets'])) for w in d.get("weapons", []))
            print(f"{d['id'][len(MOD_ID) + 1:]:22} {d['kind'][0]} {d.get('domain', '')[:4]:4} T{d['tier']} ${d['cost']:>5} hp {d['hp']:>5} spd {d.get('speed', '-'):>3} {d.get('armor', '')[:5]:5} | {ws}")
        print(f"\n{len(defs)} defs, {len(SHEETS)} sheets")
    else:
        for d in defs:
            d.pop("_art", None)
            d.pop("_tur", None)
        text = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
        os.makedirs(OUT, exist_ok=True)
        open(os.path.join(OUT, "mod.json"), "w", encoding="utf-8").write(text)
        print(f"wrote mod.json: {len(defs)} defs, {len(SHEETS)} sheets")
    for n in NOTES:
        print("note:", n)


if __name__ == "__main__":
    main()

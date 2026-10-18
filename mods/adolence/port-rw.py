#!/usr/bin/env python3
"""Port Adolence (罪恶之都) from its Rusted Warfare package into this Steel Tide mod.

Reads the unpacked package at ../../rusted-warfare-mods/A9999[V3.0] (git-ignored),
converts the curated roster below into defs, composites the art into sheets,
cuts the firing sounds to mono MP3 one-shots, and writes mod.json.

  python3 mods/adolence/port-rw.py            # convert everything
  python3 mods/adolence/port-rw.py --dry      # print the conversion, write nothing
  python3 mods/adolence/port-rw.py --no-media # mod.json only (sheets and sounds kept)

Rusted Warfare conventions this rests on: a tile is 20 px and the sim runs 60
ticks a second; a bare time is ticks and `5s` is seconds; `moveSpeed` is px per
tick; unit art faces up; a building's footprint is `left,up,right,down` in
tiles; `copyFrom` merges other files as defaults; every `all-units.template`
above a unit's folder applies to it; `@define x: v` and `${x}` are variables.
This package prices things in three resources: credits, 柴油 (diesel) and 补给
(supply). Steel Tide has one, so the three are folded into one figure first.
"""
import hashlib
from copy import deepcopy
import json
import math
import os
import re
import shutil
import subprocess
import sys

from PIL import Image, ImageFilter, ImageStat

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
RW = os.path.join(REPO, "rusted-warfare-mods", "A9999[V3.0]")
MOD_ID = "adolence"
DRY = "--dry" in sys.argv
NO_MEDIA = "--no-media" in sys.argv
# `--out DIR` writes everything to DIR instead of the mod folder (a preview)
OUT = os.path.abspath(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else HERE

# ----------------------------------------------------------------- scaling
# Sheet px per Rusted Warfare world px: 1 RW px ≈ 1.024 sheet px, drawn at 0.8,
# the same convention as the Rusted Expansion mod, so the two look consistent
# side by side. A unit's art is then drawn 1.5625× on the map.
ART = 0.82
DISPLAY = 1.5625
INFANTRY_ART = 0.7          # people are drawn a step smaller still
SOFT_CAP = 30               # RW px; beyond this the long side grows at 0.35×

# numbers
COST_A, COST_B = 0.287, 0.763   # metal = A × (folded price)^B
HP_UNIT = 0.35
HP_BUILDING = 0.8
HP_TOWER = 0.35
DMG = 0.14                      # below HP_UNIT: the package kills ~3× faster than vanilla between equals
ZOMBIE_DMG = 0.25               # bites stay meaningful
INFANTRY_SPEED = 1.4            # people were calibrated as tanks otherwise
RANGE = 0.55 / 20               # RW px → tiles
SPEED = 96 * 0.55               # RW px/tick → world px/s
VISION = 0.6
BUILD_TIME = 2.0
DIESEL, SUPPLY = 10, 5          # credits one unit of each is worth


def shrink(long_px):
    """size compression for the long side of a drawn unit, in RW px"""
    if long_px <= SOFT_CAP:
        return 1.0
    return (SOFT_CAP + (long_px - SOFT_CAP) * 0.35) / long_px


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
    r = ref.strip().replace("\\", "/")
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
            s = re.sub(r"^\d+", "", s)  # `${8core.maxHp}` is a typo for core.maxHp
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
        return True  # a condition: the ability exists
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


def price_parts(v):
    credits = diesel = supply = 0.0
    for part in split_list(v):
        if ":" in part or "=" in part:
            k, val = re.split(r"[:=]", part, maxsplit=1)
            n = num(val) or 0
            if "柴油" in k:
                diesel = n
            elif "补给" in k:
                supply = n
            else:
                credits = n
        else:
            credits = num(part) or 0
    return credits, diesel, supply


def folded_price(v):
    c, d, s = price_parts(v)
    return c + DIESEL * d + SUPPLY * s


def unit_cost(folded):
    return int(max(15, min(4000, round(COST_A * folded ** COST_B / 5) * 5)))


def strip_quotes(s):
    return re.sub(r"^[“\"”]+|[“\"”]+$", "", (s or "").strip())


def clamp(x, lo, hi):
    return max(lo, min(hi, x))


# ------------------------------------------------------------------ roster
# (rw name, id suffix, English name, English tooltip, overrides)
# overrides: tier, armor, pop, hovers, cost, hp, weapons, image, turret_from,
#            produces, producedBy, requires, power, fw, fh, aiWeight, extra,
#            domain (amphibious: the package's hulls that swim and never drown),
#            trail (tread, tire, none: what it cuts in the ground, and sounds like)
B, U, Z = "building", "unit", "zombie"
ROSTER = [
    # ---- buildings
    ("AD-联合警戒中心", "precinct", "Joint Precinct", "The city's police command: trains officers and cruisers, and sees far.",
     dict(kind=B, power=-8, vision=12, aiWeight=0)),
    ("VD-联合警戒中心", "precinct-2", "VD Joint Precinct", "The precinct under martial law: the whole garrison is on call here.",
     dict(kind=B, power=-10, vision=14, upgradeOf="precinct")),
    ("警用哨所", "outpost", "Police Outpost", "Trains the city's police, and the troops that come to its aid.",
     dict(kind=B, power=-5)),
    ("警用车库", "garage", "Police Garage", "Dispatches cruisers, sedans and armoured cars.",
     dict(kind=B, power=-6)),
    ("警用军库", "arsenal", "Police Arsenal", "The garage on a war footing: military vehicles, tanks and the Abrams.",
     dict(kind=B, power=-8, upgradeOf="garage")),
    ("警用机坪", "helipad", "Police Helipad", "A temporary pad for the police helicopter.",
     dict(kind=B, power=-6)),
    ("军用机坪", "airfield", "Military Airfield", "Gunships, fighters, the bomber and the transport fly from here.",
     dict(kind=B, power=-8, upgradeOf="helipad")),
    # the game judges a yard by what it trains (`yardKind`): the scout boat on its list makes
    # this a naval yard, placed on the water by a shore and launching onto it
    ("海警基地", "coast-guard-base", "Coast Guard Base", "Launches the scout boat, the hovercraft IFVs and the drone carrier. Stands on the water by a shore.",
     dict(kind=B, power=-6)),
    ("太阳能板", "solar", "Solar Array", "A quiet trickle of power. Needs room.",
     dict(kind=B, power=25, cost=180, hp=900)),
    ("太阳能板-T2", "solar-2", "Solar Array T2", "Better cells, three times the power.",
     dict(kind=B, power=75, cost=700, hp=1600, upgradeOf="solar")),
    ("物资储藏点", "supply-cache", "Supply Cache", "A police stash on a deposit: metal for the effort.",
     dict(kind=B, power=-4, metalRate=1.4, needsDeposit=True, fw=2, fh=2, cost=140, hp=600)),
    ("物资储藏点-Ⅱ", "supply-cache-2", "Supply Cache II", "The stash, enlarged.",
     dict(kind=B, power=-8, metalRate=3.0, needsDeposit=True, fw=2, fh=2, cost=380, hp=950, upgradeOf="supply-cache")),
    ("机枪塔位", "mg-tower", "MG Tower", "A street barricade with a machine gun on the mount. Fires at aircraft too.",
     dict(kind=B, power=-2, fw=2, fh=2, cost=220, hp=750, tower=True, zh="街垒机枪塔位，对空对地 “战区争锋！”")),
    ("基础扭机", "barricade", "Barricade", "A cheap block of steel to funnel the horde.",
     dict(kind=B, power=0, fw=1, fh=1, cost=40, hp=450)),
    ("懒惰之罪", "sloth-nest", "Sin of Sloth", "A nest of the SPK strain. It breeds the dead. Place it on a deposit.",
     dict(kind=B, power=0, fw=2, fh=2, cost=300, hp=900, image="zombies/懒惰之罪/AA.png", needsDeposit=True, aiWeight=0)),
    # ---- infantry
    ("民警-手枪", "officer-pistol", "Patrol Officer (Pistol)", "Basic beat cop with a sidearm. Cheap, everywhere, brave.",
     dict(kind=U)),
    ("民警-步枪", "officer-rifle", "Patrol Officer (Rifle)", "Basic beat cop with a rifle.",
     dict(kind=U)),
    ("交警-步枪", "traffic-officer", "Traffic Officer", "Directs traffic, then the horde. A rifle and a whistle.",
     dict(kind=U)),
    ("武警-手枪", "armed-police-pistol", "Armed Police (Pistol)", "Paramilitary police with a sidearm.",
     dict(kind=U)),
    ("武警-步枪", "armed-police-rifle", "Armed Police (Rifle)", "Paramilitary police with a rifle.",
     dict(kind=U)),
    ("海战-步枪", "swat-sea", "SWAT (Naval Camo)", "Special police in naval camouflage, shotgun.",
     dict(kind=U)),
    ("野战-步枪", "swat-field", "SWAT (Desert Camo)", "Special police in desert camouflage, shotgun.",
     dict(kind=U)),
    ("草地-步枪", "army-woodland", "Army Trooper (Woodland)", "Regular army, woodland camouflage, shotgun.",
     dict(kind=U)),
    ("陆战-步枪", "army-marksman", "Army Marksman", "Regular army marksman with a sniper rifle.",
     dict(kind=U)),
    ("民兵-步枪", "guard-rifleman", "National Guard Rifleman", "The state guard, called in when the police broke.",
     dict(kind=U, zh_name="民兵-步枪")),
    ("民兵-轻机枪", "guard-gunner", "National Guard Gunner", "Guardsman with a light machine gun.",
     dict(kind=U, zh_name="民兵-轻机枪")),
    ("民兵-火焰喷射器", "guard-flamethrower", "National Guard Flamethrower", "Fire clears a street the way nothing else does.",
     dict(kind=U, flame=True)),
    ("宪兵-步枪", "military-police", "Military Police", "Provost with a rifle.",
     dict(kind=U, zh_name="宪兵-步枪")),
    ("陆战队-步枪A", "taskforce-rifleman", "Task Force Rifleman", "Special task force rifleman. Elite.",
     dict(kind=U)),
    ("陆战队-掷弹兵", "taskforce-grenadier", "Task Force Grenadier", "Rifle with an underslung grenade launcher.",
     dict(kind=U)),
    ("陆战队-反器材", "taskforce-anti-materiel", "Task Force Anti-Materiel", "A rifle that opens vehicles.",
     dict(kind=U)),
    ("陆战队-火箭筒A", "taskforce-rocketeer", "Task Force Rocketeer", "Anti-tank rockets; also reaches aircraft.",
     dict(kind=U)),
    ("陆战队-机枪", "taskforce-gunner", "Task Force Gunner", "Squad machine gun.",
     dict(kind=U)),
    ("陆战队-霰弹枪", "taskforce-shotgunner", "Task Force Shotgunner", "Automatic shotgun for close work.",
     dict(kind=U)),
    ("中州武装步枪", "zhongzhou-rifleman", "Zhongzhou Rifleman", "Zhongzhou armed forces, sent in support.",
     dict(kind=U, requires=["arsenal"])),
    ("中州特战狙击", "zhongzhou-sniper", "Zhongzhou Sniper", "Zhongzhou special forces marksman.",
     dict(kind=U, requires=["arsenal"], zh_name="中州特战狙击")),
    ("肃清协议-MG", "purge-gunner", "Purge Protocol Gunner", "Heavily armoured escort gunner of the purge protocol.",
     dict(kind=U, armor="medium", requires=["arsenal"], zh_name="肃清协议-MG", trail="none")),
    # ---- vehicles
    ("轿车-黑", "sedan-black", "Black Sedan", "A civilian car pressed into service. Carries four.",
     dict(kind=U)),
    ("警车", "cruiser", "Police Cruiser", "The basic patrol car. Carries four officers.",
     dict(kind=U)),
    ("警用装甲车-B", "armoured-car", "Police Armoured Car", "Armoured patrol vehicle. Carries five.",
     dict(kind=U, armor="medium")),
    ("警用两栖车-A", "amphibious-car", "Police Amphibious Car", "Light amphibious carrier for three. Swims.",
     dict(kind=U, armor="medium", domain="amphibious")),
    ("警用指挥车-A3", "command-van", "Police Command Van", "Mobile command post. Carries six.",
     dict(kind=U, armor="medium")),
    ("警用通讯车", "comms-van", "Police Comms Van", "Communications van: unarmed, but it sees very far.",
     dict(kind=U, armor="medium")),
    ("警用重卫车-U0", "heavy-escort", "Police Heavy Escort", "Heavy escort truck. Carries nine.",
     dict(kind=U, armor="medium")),
    ("装甲车", "ambush-car", "Ambush Armoured Car", "Mine-resistant ambush-protected carrier. Unarmed, thick-skinned, carries seven.",
     dict(kind=U, armor="heavy", zh="反地雷伏击车，无武装，可载七人")),
    # crewed pieces and walkers go on feet: no ruts, and no engine heard
    ("警用迫击炮", "mortar", "Police Mortar", "Short-ranged, accurate, three times as hard on buildings.",
     dict(kind=U, armor="light", arc=True, trail="none")),
    ("重机枪", "heavy-mg", "Heavy Machine Gun", "A crewed heavy machine gun. Slow to move, fast to fire.",
     dict(kind=U, armor="light", extra={"speed": 24}, trail="none")),
    ("警卫步械-步枪", "walker-rifle", "Guard Walker (Rifle)", "Police walking armour with an autocannon.",
     dict(kind=U, armor="medium", trail="none")),
    ("警卫步械-榴弹", "walker-grenade", "Guard Walker (Grenade)", "Police walking armour with a grenade launcher.",
     dict(kind=U, armor="medium", trail="none")),
    ("警卫轻坦-轻机枪", "light-tank-lmg", "Guard Light Tank (LMG)", "Black-steel light tank with a light machine gun.",
     dict(kind=U, armor="heavy")),
    ("警卫轻坦-机枪", "light-tank-mg", "Guard Light Tank (MG)", "Black-steel light tank with a heavy machine gun.",
     dict(kind=U, armor="heavy")),
    ("警卫轻坦-常规", "light-tank", "Guard Light Tank", "Black-steel light tank with a long gun.",
     dict(kind=U, armor="heavy")),
    ("警卫轻坦-导弹", "light-tank-missile", "Guard Light Tank (Missile)", "Black-steel chassis with a missile battery.",
     dict(kind=U, armor="heavy")),
    ("警卫轻坦-喷火", "light-tank-flame", "Guard Light Tank (Flame)", "Black-steel light tank with a flamethrower.",
     dict(kind=U, armor="heavy", flame=True)),
    ("警卫轻坦-狙击", "light-tank-sniper", "Guard Light Tank (Sniper)", "Black-steel light tank with a long-range rifle cannon.",
     dict(kind=U, armor="heavy")),
    ("警卫重坦-常规", "heavy-tank", "Guard Heavy Tank", "Riot heavy tank: a huge blast every shot. Clears the ground by force.",
     dict(kind=U, armor="heavy", tier=3, dmg_mult=2.5)),
    ("军用侦查车", "scout-car", "Military Scout Car", "Fast light vehicle for a look ahead.",
     dict(kind=U)),
    ("军用突击车", "assault-car", "Military Assault Car", "Light military vehicle.",
     dict(kind=U)),
    ("多用途轻型车辆", "utility-vehicle", "Light Utility Vehicle", "General-purpose military vehicle; a gun ring on the roof. Carries five.",
     dict(kind=U, armor="medium")),
    ("多用途轻型车辆-MP", "utility-vehicle-mp", "Light Utility Vehicle MP", "Military police utility vehicle. Carries five.",
     dict(kind=U, armor="medium", zh_name="多用途轻型车辆-MP")),
    ("军用运输卡车-B", "transport-truck", "Military Transport Truck", "A truck for a platoon.",
     dict(kind=U, armor="medium")),
    ("M977", "m977", "M977 HEMTT", "Heavy tactical supply truck. Tough and unarmed.",
     dict(kind=U, armor="medium", tier=2, zh_name="M977")),
    ("M1128", "m1128", "M1128 Stryker MGS", "Stryker mobile gun system: a 105 mm gun on eight wheels.",
     dict(kind=U, armor="heavy", tier=3, turret_from="M1128 T", turret_offset=(0, -9.5), weapons=[
         dict(id="gun", cls="cannon", dmg=95, reload=5.5, range=8.5, targets=["ground", "ship"], projectile="shell", speed=600, splash=14, turret=True, sound="105mm"),
         dict(id="coax", cls="mg", dmg=9, reload=0.45, range=6, targets=["ground", "ship"], turret=True, sound="mg"),
     ])),
    ("M1A2", "m1a2", "M1A2 Abrams", "Main battle tank: 120 mm smoothbore, coaxial gun, thick plate.",
     dict(kind=U, armor="heavy", tier=3, trail="tread", turret_from="M1A2 T", weapons=[
         dict(id="gun", cls="cannon", dmg=125, reload=4.5, range=9, targets=["ground", "ship"], projectile="shell", speed=700, splash=12, turret=True, sound="120mm"),
         dict(id="coax", cls="mg", dmg=9, reload=0.45, range=6, targets=["ground", "ship"], turret=True, sound="mg"),
     ])),
    ("M1A2 TUSK II", "m1a2-tusk", "M1A2 TUSK II", "Abrams with the urban survival kit: more armour, same gun.",
     dict(kind=U, armor="heavy", tier=3, trail="tread", turret_from="M1A2 TUSK II T", weapons=[
         dict(id="gun", cls="cannon", dmg=125, reload=4.5, range=9, targets=["ground", "ship"], projectile="shell", speed=700, splash=12, turret=True, sound="120mm"),
         dict(id="coax", cls="mg", dmg=9, reload=0.45, range=6, targets=["ground", "ship"], turret=True, sound="mg"),
     ])),
    ("M1A2 SEPV3", "m1a2-sepv3", "M1A2 SEPv3", "The newest Abrams. Better optics, better gun.",
     dict(kind=U, armor="heavy", tier=3, trail="tread", turret_from="M1A2 SEPV3 T", weapons=[
         dict(id="gun", cls="cannon", dmg=135, reload=4.2, range=9.5, targets=["ground", "ship"], projectile="shell", speed=700, splash=12, turret=True, sound="120mm"),
         dict(id="coax", cls="mg", dmg=9, reload=0.45, range=6, targets=["ground", "ship"], turret=True, sound="mg"),
     ])),
    ("M1A1 HC 标题党", "m1a1-clickbait", "M1A1 HC \"Clickbait\"", "The old Abrams with a name. 120 mm and a coaxial gun.",
     dict(kind=U, armor="heavy", tier=3, trail="tread", turret_from="M1A1 HC 标题党 T", zh_name="M1A1 HC“标题党”", weapons=[
         dict(id="gun", cls="cannon", dmg=120, reload=4.5, range=9, targets=["ground", "ship"], projectile="shell", speed=700, splash=12, turret=True, sound="120mm"),
         dict(id="coax", cls="mg", dmg=9, reload=0.45, range=6, targets=["ground", "ship"], turret=True, sound="mg"),
     ])),
    # hovercraft: they swim, and a skirt cuts no rut and rolls on no wheel
    ("轻型两栖步战", "light-ifv", "Light Amphibious IFV", "Hovercraft infantry carrier with a machine gun. Carries four. Swims.",
     dict(kind=U, armor="medium", domain="amphibious", trail="none", extra={"transportCap": 4})),
    ("重型两栖步战", "heavy-ifv", "Heavy Amphibious IFV", "Big hovercraft carrier with a machine gun. Carries eight. Swims.",
     dict(kind=U, armor="medium", domain="amphibious", trail="none")),
    ("极征主义", "extremism", "\"Extremism\"", "Experimental super-heavy tank. The world belongs to it.",
     dict(kind=U, armor="heavy", tier=3)),
    # ---- air
    # the game lays a spinning rotor on anything that hovers (`rotorMounts`), so the package's blade images stay off
    ("警用直升机-A", "police-heli", "Police Helicopter", "Unarmed transport helicopter for four.",
     dict(kind=U, hovers=True, zh="警用运输直升机，无武装，可载四人")),
    ("轻型武装直升机", "light-gunship", "Light Attack Helicopter", "Light gunship: guns and rockets.",
     dict(kind=U, hovers=True)),
    ("重型武装直升机", "heavy-gunship", "Heavy Attack Helicopter", "Twin cannon and rockets, air and ground. Carries a two-man team.",
     dict(kind=U, hovers=True, tier=2)),
    ("军用轰炸机", "bomber", "Military Bomber", "Heavy bombs on a slow airframe.",
     dict(kind=U, tier=2, weapons=[
         dict(id="bombs", cls="he", dmg=85, reload=6.5, range=2.4, targets=["ground", "ship"], projectile="bomb", speed=120, splash=42, burst=3, burstDelay=0.25, turret=False, sound="bomb"),
     ])),
    ("特区运输机", "transport-heli", "SAR Transport Helicopter", "Transport helicopter for a squad.",
     dict(kind=U, hovers=True)),
    ("鹰击-U9战斗机", "fighter-u9", "Eagle Strike U9", "Air-superiority fighter.",
     dict(kind=U, tier=2)),
    ("鹰击-A2", "fighter-a2", "Eagle Strike A2", "Multirole fighter.",
     dict(kind=U, tier=2)),
    # ---- sea
    ("海警侦船", "scout-boat", "Coast Guard Scout Boat", "Unarmed patrol boat with long eyes.",
     dict(kind=U)),
    ("溃北", "drone-carrier", "\"Rout North\" Carrier", "Experimental drone carrier: naval guns and a missile battery.",
     dict(kind=U, tier=3, no_turret=True, weapons=[
         dict(id="guns", cls="navgun", dmg=45, reload=1.4, range=8, targets=["ground", "ship"], projectile="shell", speed=520, splash=10, bores=2, boreSpacing=9, turret=False, sound="cannon"),
         dict(id="sam", cls="aa", dmg=60, reload=2.4, range=8, targets=["air"], projectile="missile", speed=460, homing=True, turret=False, sound="missile"),
     ])),
    # ---- the dead
    ("丧尸-M", "zombie", "Zombie", "The common dead. Slow, weak, many.", dict(kind=Z)),
    ("丧尸-壮汉", "brute", "Brute", "A big one. Hits hard.", dict(kind=Z)),
    ("丧尸-胖子", "bloater", "Bloater", "Swollen and slow.", dict(kind=Z)),
    ("丧尸-囚徒", "prisoner", "Prisoner", "Still in orange. Tougher than it looks.", dict(kind=Z)),
    ("丧尸-愤怒", "rager", "Rager", "Fast and furious. Goes straight for buildings.", dict(kind=Z, building_breaker=True)),
    ("丧尸-爆裂者", "burster", "Burster", "Bursts on contact.", dict(kind=Z)),
    ("丧尸-聚爆者", "imploder", "Imploder", "Collapses inward with a blast.", dict(kind=Z)),
    ("异常民警-手枪", "turned-officer", "Turned Officer", "Was a beat cop. Still has the pistol.", dict(kind=Z)),
    ("异常陆战队-反器材", "turned-anti-materiel", "Turned Anti-Materiel", "Was task force. Still has the big rifle.", dict(kind=Z)),
    ("路怒症", "road-rage", "Road Rage", "A wrecked car that hates vehicles.", dict(kind=Z, armor="medium")),
    ("血肉酸稠", "acid-mass", "Acid Mass", "A crawling mass that spits acid at vehicles.", dict(kind=Z, armor="medium", no_turret=True)),
    ("幸灾乐祸", "gloater", "Gloater", "An aquatic mutant.", dict(kind=Z, domain="ship")),
    # it circles like a bird rather than hovering: a hovering thing is drawn with a rotor
    ("飞骸", "flying-husk", "Flying Husk", "A winged carcass with a burning gaze.",
     dict(kind=Z, domain="air", zh="飞行的骸骨，目光灼灼", overlays=[("左1.png", -20, 3, 1.1, True), ("右1.png", 20, 3, 1.1, True)])),
    ("大猩猩", "gorilla", "Gorilla", "Looks like a gorilla. Can reach aircraft.", dict(kind=Z, armor="heavy", tier=2)),
    ("人间失格", "no-longer-human", "No Longer Human", "Ten thousand hit points of hate.", dict(kind=Z, armor="heavy", tier=3)),
    ("暴虐之罪", "sin-of-wrath", "Sin of Wrath", "One of the Sins.", dict(kind=Z, armor="heavy", tier=3)),
    ("暴食之罪", "sin-of-gluttony", "Sin of Gluttony", "The eater. One of the Sins.", dict(kind=Z, armor="heavy", tier=2)),
]


def build_list(ini):
    """the rw names a building's canBuild entries name, in order"""
    lists = []
    for k, v in ini.get("core", {}).items():
        if re.match(r"canBuild_\d+_name$", k):
            lists += split_list(v)
    for sec, kv in ini.items():
        if sec.startswith("canBuild_") and kv.get("name"):
            lists += split_list(kv["name"])
    return [strip_quotes(x) for x in lists]


EXTRA_PRODUCES = {
    "outpost": ["zhongzhou-rifleman", "zhongzhou-sniper", "purge-gunner"],
    "sloth-nest": [r[1] for r in ROSTER if r[4].get("kind") == Z],
}
# the builtin Rusted Warfare sound names, to the game's classes
BUILTIN_SOUNDS = {
    "tank_firing": "cannon", "missile_fire": "missile", "plasma_fire": "autocannon", "large_gun_fire1": "cannon",
    "large_gun_fire2": "cannon", "gun_fire": "mg", "firing3": "mg", "nuke_launch": "arty",
}
NAMED_SOUNDS = {  # for the hand-written weapons
    "120mm": "音效/120mm口径1.wav", "105mm": "音效/105mm口径1.wav",
}


# --------------------------------------------------------------- the units
def index_units():
    """every unit file, by its [core] name with quotes stripped"""
    by_name = {}
    for root, _, files in os.walk(RW):
        for f in files:
            if not f.lower().endswith(".ini"):
                continue
            p = os.path.join(root, f)
            raw = parse_ini(open(p, encoding="utf-8", errors="replace").read())
            name = raw.get("core", {}).get("name")
            if name:
                by_name.setdefault(strip_quotes(name), p)
    return by_name


def zh_desc(ini, fallback):
    d = ini.get("core", {}).get("displayDescription", "") or ""
    d = d.replace("\\n", "\n")
    if not d or "DEMO" in d:
        return fallback
    items = []
    quote = None
    for line in d.split("\n"):
        s = line.strip().lstrip("-").strip()
        if not s:
            continue
        if s.startswith(("“", "\"", "[")) and quote is None:
            quote = s
            continue
        items.append(s.rstrip("。.，,…"))
    out = "，".join(items[:2])
    if len(out) > 40:
        out = items[0]
    if quote and len(out) + len(quote) <= 44:
        out = out + " " + quote
    return out or fallback


# ------------------------------------------------------------------ media
SOUND_JOBS = {}   # src path -> (key, out file)
SHEETS = []
SHEET_BY_HASH = {}
NOTES = []
OUT_SPRITES = os.path.join(OUT, "sprites")
OUT_SOUNDS = os.path.join(OUT, "sounds")


def note(unit, msg):
    NOTES.append(f"{unit}: {msg}")


def clean_alpha(im):
    """drop near-invisible alpha, and keep every pixel out of the game's magenta remap test.

    The package draws no faction colour, and a sheet with `teams: false` does not render
    (the atlas looks a unit up by its team key), so the sheets stay team-recoloured and
    the pass below makes sure nothing in them is magenta enough to be recoloured:
    r>60 && b>60 && (r+b)/2-g>28 && |r-b|<95 — the pinks of the dead would be caught.
    """
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


def sound_key(src):
    base = os.path.splitext(os.path.basename(src))[0]
    slug = re.sub(r"[^a-z0-9]+", "-", base.lower()).strip("-")
    zh = {"通用机枪": "gpmg", "机炮": "autocannon", "火箭": "rocket", "开火": "mortar", "火": "flame", "爆炸": "blast", "步枪": "rifle"}
    for k, v in zh.items():
        if k in base:
            slug = v
    if not slug or slug in ("1", "shot3"):
        folder = os.path.basename(os.path.dirname(src))
        slug = {"武装直升机": "heli-gun", "民兵": "guard-rifle", "飞骸": "husk-beam", "M921多功能车辆": "hmg", "7.重机枪": "hmg"}.get(folder, slug or "gun")
    slug = slug.replace("口径", "mm").replace("mm-1", "mm").replace("--", "-")
    key = f"{MOD_ID}-{slug}"
    taken = {v[0] for v in SOUND_JOBS.values()}
    n = 2
    while key in taken:
        key = f"{MOD_ID}-{slug}-{n}"
        n += 1
    return key


SOUND_BY_HASH = {}


def add_sound(src):
    """one slot per recording: the package keeps copies of the same file in several folders"""
    if src in SOUND_JOBS:
        return SOUND_JOBS[src][0]
    h = hashlib.md5(open(src, "rb").read()).hexdigest()
    if h in SOUND_BY_HASH:
        SOUND_JOBS[src] = SOUND_JOBS[SOUND_BY_HASH[h]]
        return SOUND_JOBS[src][0]
    key = sound_key(src)
    SOUND_JOBS[src] = (key, f"sounds/{key[len(MOD_ID) + 1:]}.mp3")
    SOUND_BY_HASH[h] = src
    return key


def weapon_sound(shoot, from_dir, unit):
    if not shoot:
        return None
    first = shoot.split(",")[0].strip()
    first = re.sub(r":[\d.]+$", "", first)  # `large_gun_fire1:0.18` carries a volume
    low = first.lower()
    if low in BUILTIN_SOUNDS:
        return BUILTIN_SOUNDS[low]
    if not re.search(r"\.(ogg|wav|mp3)$", low):
        return None
    hit = resolve(first, from_dir)
    if not hit:
        note(unit, f"shoot_sound {first} not found")
        return None
    return add_sound(hit)


def write_sounds():
    if NO_MEDIA or DRY:
        return
    shutil.rmtree(OUT_SOUNDS, ignore_errors=True)
    os.makedirs(OUT_SOUNDS)
    done = set()
    for src, (key, out) in SOUND_JOBS.items():
        if key in done:
            continue
        done.add(key)
        dst = os.path.join(OUT, out)
        af ="silenceremove=start_periods=1:start_threshold=-38dB,afade=t=out:st=0.72:d=0.18,aformat=channel_layouts=mono,alimiter=limit=0.95"
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", src, "-af", af, "-t", "0.9", "-ar", "44100", "-b:a", "96k", dst], check=True)


def sheet_size(px_w, px_h, scale, infantry):
    k = shrink(max(px_w, px_h) * scale)
    f = ART * scale * k * (INFANTRY_ART if infantry else 1.0)
    return max(4, round(px_w * f)), max(4, round(px_h * f)), f


def add_sheet(key, im, frames, rotated, fw=None, fh=None, pivot_y=None, mount=None, tag=None):
    """dedupe identical art: a second def naming the same image shares the sheet"""
    h = hashlib.md5(im.tobytes()).hexdigest() + f":{frames}:{fw}:{fh}:{pivot_y}"
    if h in SHEET_BY_HASH:
        return SHEET_BY_HASH[h]
    entry = {"key": key, "file": f"sprites/{key}.png", "frames": frames}
    if rotated:
        entry.update(rotated=True, fw=fw, fh=fh)
        if pivot_y is not None and abs(pivot_y - 0.5) > 0.01:
            entry["pivotY"] = round(pivot_y, 3)
    if mount:
        entry["mount"] = [round(mount[0], 3), round(mount[1], 3)]
    if not DRY and not NO_MEDIA:
        im.save(os.path.join(OUT_SPRITES, f"{key}.png"))
    SHEETS.append(entry)
    SHEET_BY_HASH[h] = key
    return key


# ------------------------------------------------------------------ decals
# The package draws much of a unit with `[decal_*]` sections: pictures laid on the
# body or on a turret. Most are still, and are painted into the sheet in the order
# the original draws them; the rest become the game's own decals (`decals` on the
# def): an outline or a shadow the turret carries under the hull, a lamp that comes
# on at night, brake lights when the car stands, barrels that turn while the gun
# fires. The interface ones (selection rings, waypoints, ammo counters, preview
# icons) and the ones that follow a script (a flash off `memory`, shading that
# follows the heading) have no counterpart here and are left out.
DECAL_SLUGS = [("前灯", "headlight"), ("手电", "torch"), ("灯光", "lamp"), ("黑边", "outline"), ("阴影", "shadow"), ("炮管", "barrel"),
               ("尾灯", "taillight"), ("座圈", "ring"), ("驾驶", "driver"), ("车长", "commander"), ("炮手", "gunner"), ("轮胎", "tyre"),
               ("泄压阀", "vent"), ("观察", "sight"), ("红外", "ir"), ("杂物", "stowage"), ("抛瓦", "tile"), ("箱子", "crate"),
               ("挡板", "shield"), ("标题党", "m1a1"), ("轮左", "wheel")]
UI_DECAL_KEYS = ("onlyInPreview", "onlyWhenSelectedByAnyPlayer", "onlyWhenSelectedByOwnPlayer", "drawLineTo", "basePosition",
                 "basePositionFromLegEnd", "onlyTeam", "alwaysStartDirAtZero", "alwayStartDirAtZero")
RW_LAYERS = ("shadow", "beforebody", "afterbody", "ontop")


def slugify(path):
    base = os.path.splitext(os.path.basename(path))[0]
    for zh, en in DECAL_SLUGS:
        base = base.replace(zh, "-" + en + "-")
    return re.sub(r"[^a-z0-9]+", "-", base.lower()).strip("-") or "part"


def numeric(v):
    return v is None or re.match(r"^\s*-?[\d.]+\s*$", str(v)) is not None


def decal_list(ini, d):
    """the image decals of a unit that are pictures of it, in file order, each with its place in RW px
    (x right, y forward) about what it is fixed to, and when the game is to show it"""
    out = []
    for s, kv in ini.items():
        if not s.startswith("decal_") or boolish(kv.get("@copyFrom_skipThisSection")):
            continue
        if any(k in kv for k in UI_DECAL_KEYS) or (kv.get("layer") or "").lower() == "inactive":
            continue
        img = kv.get("image") or kv.get("imageStack")
        path = resolve(img, d) if img else None
        if not path:
            continue
        when = "always"
        vis = (kv.get("isVisible") or "true").strip()
        if vis.lower() not in ("true", "1"):
            if "开前灯" in vis or "开灯" in vis:
                when = "night"
            else:
                continue  # ammo, cargo, script states
        alpha = kv.get("alpha")
        if not numeric(alpha):
            if "speed()" in alpha:
                when, alpha = "still", "0.7"  # brake lights: bright when the car stands
            else:
                continue  # shading that follows the heading, a scripted flash
        if alpha is None and kv.get("image_shadow"):
            alpha = "0.5"  # drawn as a shadow in the original
        if not all(numeric(kv.get(k)) for k in ("imageScale", "imageScaleX", "imageScaleY")):
            continue
        frame = kv.get("frame")
        if frame and "frameSpeed" in frame:
            when = "firing"
        elif frame and not numeric(frame):
            continue
        layer = (kv.get("layer") or "afterBody").lower()
        if layer not in RW_LAYERS:
            continue
        out.append(dict(
            name=s[6:], path=path, frames=int(num(kv.get("total_frames")) or 1), layer=layer,
            on=(kv.get("basePositionFromTurret") or "").strip() or None,
            # an absolute offset is a screen one (down positive); read as if the unit faced up
            x=(num(kv.get("xOffsetRelative")) or 0) + (num(kv.get("xOffsetAbsolute")) or 0) + (num(kv.get("shadowOffsetX")) or 0 if kv.get("image_shadow") else 0),
            y=(num(kv.get("yOffsetRelative")) or 0) - (num(kv.get("yOffsetAbsolute")) or 0) - (num(kv.get("shadowOffsetY")) or 0 if kv.get("image_shadow") else 0),
            angle=num(kv.get("dirOffset")) or 0,  # degrees clockwise on screen, as the game's decals turn
            scale=num(kv.get("imageScale")) or 1.0,
            sx=num(kv.get("imageScaleX")) or 1.0, sy=num(kv.get("imageScaleY")) or 1.0,
            alpha=num(alpha) if alpha is not None else 1.0,
            when=when,
            shadow=bool(kv.get("image_shadow")) or "阴影" in s,
        ))
    return out


def crop_content(im, pad=1):
    """the image cut to what it paints, and how far its centre moved (image px, x right, y down)"""
    bb = im.getbbox()
    if not bb:
        return im, 0.0, 0.0
    x0, y0 = max(0, bb[0] - pad), max(0, bb[1] - pad)
    x1, y1 = min(im.width, bb[2] + pad), min(im.height, bb[3] + pad)
    return im.crop((x0, y0, x1, y1)), (x0 + x1) / 2 - im.width / 2, (y0 + y1) / 2 - im.height / 2


def soften_lamp(im, up=4):
    """a lamp's beam as light rather than paint. The package's cones are flat, hard-edged
    triangles at half alpha, which read as glass on this game's pixel grid beside its own
    headlights; blown up and blurred — the alpha, and the colour under it with the surround
    filled in first so no black is dragged into the edge — they fall off the way light does.
    Returns the picture at `up` times its size, and that factor."""
    w, h = im.size
    big = im.resize((w * up, h * up), Image.LANCZOS)
    a = big.getchannel("A")
    lit = a.point(lambda v: 255 if v > 40 else 0)
    stat = ImageStat.Stat(big.convert("RGB"), mask=lit)
    mean = tuple(int(round(v)) for v in stat.mean) if stat.count[0] else (255, 255, 255)
    rgb = Image.composite(big.convert("RGB"), Image.new("RGB", big.size, mean), lit)
    radius = max(2.0, min(w, h) * up * 0.12)
    out = rgb.filter(ImageFilter.GaussianBlur(radius / 2)).convert("RGBA")
    out.putalpha(a.filter(ImageFilter.GaussianBlur(radius)))
    return out, up


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
    p = resolve(gfx.get("image") or "", d)
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
    p = resolve(gfx.get("image_turret") or "", d)
    if stit and stit > 0 and p:
        k = stit * scale_key(core.get("globalScale")) / max(1, Image.open(p).width)
    return k * scale_key(gfx.get("turretImageScale"))


def prep(im, scale=1.0, sx=1.0, sy=1.0, alpha=1.0, angle=0.0, frame0=1):
    """an image as the package draws it: the first frame of a strip, scaled, turned (degrees clockwise), faded"""
    im = clean_alpha(im)
    if frame0 > 1:
        im = im.crop((0, 0, im.width // frame0, im.height))
    w, h = im.width * scale * sx, im.height * scale * sy
    if abs(w - im.width) > 0.5 or abs(h - im.height) > 0.5:
        im = im.resize((max(1, round(w)), max(1, round(h))), Image.LANCZOS)
    if angle:
        im = im.rotate(-angle, resample=Image.BICUBIC, expand=True)
    if alpha < 1:
        im.putalpha(im.getchannel("A").point(lambda v: int(v * alpha)))
    return im


def lay_stack(items):
    """one image centred on the pivot with every item laid at its offset: (image, x, y), RW px, y forward"""
    half_w = half_h = 1.0
    for im, x, y in items:
        half_w = max(half_w, abs(x) + im.width / 2)
        half_h = max(half_h, abs(y) + im.height / 2)
    W, H = int(math.ceil(half_w * 2)) + 2, int(math.ceil(half_h * 2)) + 2
    cv = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for im, x, y in items:
        cv.alpha_composite(im, (int(round(W / 2 + x - im.width / 2)), int(round(H / 2 - y - im.height / 2))))
    return cv


def turret_positions(ini):
    """every turret's place about the unit's origin, up its attachedTo chain (RW px, y forward)"""
    secs = {s: kv for s, kv in ini.items() if s.startswith("turret_")}

    def abs_pos(s, depth=0):
        kv = secs[s]
        x, y = num(kv.get("x")) or 0, num(kv.get("y")) or 0
        parent = kv.get("attachedTo")
        ps = "turret_" + parent.strip() if parent else None
        if ps and ps in secs and depth < 6:
            px, py = abs_pos(ps, depth + 1)
            return px + x, py + y
        return x, y
    return secs, abs_pos


def unit_picture(ini, d, by_name, depth=0):
    """what the package draws for a unit whose body turns with its gun — a turret unit, a gun bolted on:
    the still parts in draw order as (image, x, y) about the unit's origin (RW px, y forward), and the
    decals the game is to draw itself (shadow-layer ones go under the hull; the rest are conditional)"""
    gfx = ini.get("graphics", {})
    scale, tscale = body_scale(ini, d), turret_scale(ini, d)
    secs, abs_pos = turret_positions(ini)
    stills, dyn = [], []
    decs = decal_list(ini, d)

    def place(dc):
        x, y = dc["x"], dc["y"]
        if dc["on"] and ("turret_" + dc["on"]) in secs:
            px, py = abs_pos("turret_" + dc["on"])
            x, y = x + px, y + py
        return x, y

    def still(dc):
        im = prep(Image.open(dc["path"]), dc["scale"], dc["sx"], dc["sy"], dc["alpha"], dc["angle"], dc["frames"])
        x, y = place(dc)
        return im, x, y

    def statics(layer):
        # one that animates while the gun fires stands at its first frame the rest of the time
        return [still(dc) for dc in decs if dc["when"] in ("always", "firing") and dc["layer"] == layer]

    # the original's order: what goes before the body, the body, what comes after it,
    # the turrets as declared (the last on top), what rides over everything
    stills += statics("beforebody")
    body = resolve(gfx.get("image", ""), d)
    if body and os.path.basename(body).lower() not in ("blank.png", "空.png") and scale > 0:
        stills.append((prep(Image.open(body), scale), 0, 0))
    stills += statics("afterbody")
    # a turret without a picture of its own is drawn with the unit's `image_turret`, as the
    # original does (the TUSK's and the M1A1's commander M2 and loader M249)
    shared = resolve(gfx.get("image_turret") or "", d)
    for s, kv in secs.items():
        if boolish(kv.get("invisible")) or tscale <= 0:
            continue
        img = kv.get("image")
        hit = resolve(img, d) if img else shared
        if not hit:
            continue
        x, y = abs_pos(s)
        stills.append((prep(Image.open(hit), tscale, angle=num(kv.get("idleDir")) or 0), x, y))
    stills += statics("ontop")
    # the crew and their guns: units the original attaches, drawn on top and turned with it
    if depth < 2:
        for s, kv in ini.items():
            if not s.startswith("attachment_") or boolish(kv.get("@copyFrom_skipThisSection")):
                continue
            p = by_name.get(strip_quotes(kv.get("onCreateSpawnUnitOf", "")))
            if not p:
                continue
            sub_stills, sub_dyn = unit_picture(load_unit(p), os.path.dirname(p), by_name, depth + 1)
            ax, ay = num(kv.get("x")) or 0, num(kv.get("y")) or 0
            stills += [(im, x + ax, y + ay) for im, x, y in sub_stills]
            dyn += [dict(dc, x=dc["x"] + ax, y=dc["y"] + ay) for dc in sub_dyn]
    for dc in decs:
        # a drop shadow the original lays under the hull went with the hull's own shadow,
        # which the game does not draw for this art (`shadow: false`); alone it is a smudge
        if dc["layer"] == "shadow" and dc["shadow"]:
            continue
        if dc["when"] != "always" or dc["layer"] == "shadow":
            x, y = place(dc)
            dyn.append(dict(dc, x=x, y=y))
    return stills, dyn


def add_decal_sheet(im, slug, frames, fw, fh, fps=None):
    """a decal's sheet, `dec.<mod>-<name>`: one per distinct picture at a size"""
    h = hashlib.md5(im.tobytes()).hexdigest() + f":{frames}:{fw}:{fh}:{fps}"
    if h in SHEET_BY_HASH:
        return SHEET_BY_HASH[h]
    taken = {e["key"] for e in SHEETS}
    key = f"dec.{MOD_ID}-{slug}"
    n = 2
    while key in taken:
        key = f"dec.{MOD_ID}-{slug}-{n}"
        n += 1
    entry = {"key": key, "file": f"sprites/{key}.png", "frames": frames, "fw": fw, "fh": fh}
    if frames == 1:
        entry["rotated"] = True
    if fps:
        entry["fps"] = fps
    if not DRY and not NO_MEDIA:
        im.save(os.path.join(OUT_SPRITES, f"{key}.png"))
    SHEETS.append(entry)
    SHEET_BY_HASH[h] = key
    return key


DECAL_REFS = {}  # (path, frames, aspect) -> the sizes (sheet px per source px) the picture has been cut at


def emit_decals(df, dyn, ppr, on, over_when_ontop):
    """the game's decals for a def, at their place in the part's sheet px (`ppr` sheet px per RW px),
    in the game's layer. A picture is cut once near the size it is drawn at, and a unit that draws it
    a little larger or smaller than that says so with `scale`, so thirty cruisers share one headlight"""
    for dc in dyn:
        im = Image.open(dc["path"]).convert("RGBA")
        frames = dc["frames"]
        src_w = im.width // frames
        src_h = im.height
        dx = dy = 0.0
        if frames > 1:
            im = clean_alpha(im.crop((0, 0, src_w * frames, im.height)))
        else:
            # cut to what it paints: a lamp's beam sits in one corner of a big blank image
            im, dx, dy = crop_content(clean_alpha(im))
            if im.getbbox() is None:
                continue
            src_w, src_h = im.size
            if dc["when"] == "night":
                # the beam softened, at a finer grid so the falloff survives the cut
                im, up = soften_lamp(im)
                im, dx2, dy2 = crop_content(im, pad=2)
                dx += dx2 / up
                dy += dy2 / up
                src_w, src_h = im.width / up, im.height / up
        k = dc["scale"] * ppr * dc["sx"]
        aspect = round(dc["sy"] / dc["sx"], 3)
        refs = DECAL_REFS.setdefault((dc["path"], frames, aspect), [])
        ref = next((r for r in refs if 0.6 <= k / r <= 1.6), None)
        if ref is None:
            refs.append(k)
            ref = k
        fw = max(4, round(src_w * ref))
        fh = max(4, round(src_h * ref * aspect))
        if max(fw, fh) > 512:
            note(df["id"], f"decal {dc['name']} too large ({fw}x{fh}); dropped")
            continue
        x = (dc["x"] + dx * dc["scale"]) * ppr
        y = (-dc["y"] + dy * dc["scale"]) * ppr
        layer = {"shadow": "under", "beforebody": "under", "afterbody": "hull", "ontop": "over" if over_when_ontop else "hull"}[dc["layer"]]
        key = add_decal_sheet(im, slugify(dc["path"]), frames, fw, fh, fps=30 if dc["when"] == "firing" else None)
        entry = {"sprite": key}
        if on == "turret":
            entry["on"] = "turret"
        if layer != ("over" if on == "turret" else "hull"):
            entry["layer"] = layer
        if abs(k / ref - 1) > 0.01:
            entry["scale"] = round(k / ref, 3)
        if abs(x) >= 0.05:
            entry["x"] = round(x, 1)
        if abs(y) >= 0.05:
            entry["y"] = round(y, 1)
        if dc["angle"] % 360:
            entry["angle"] = round(dc["angle"] % 360, 1)
        if dc["alpha"] < 1:
            entry["alpha"] = round(dc["alpha"], 2)
        if dc["when"] != "always":
            entry["when"] = dc["when"]
        decals = df.setdefault("decals", [])
        if len(decals) >= 12:
            note(df["id"], f"more than 12 decals; {dc['name']} dropped")
            continue
        decals.append(entry)


def turret_parts(ini, from_dir, ov):
    """the turret images with their offsets from the main turret pivot (RW px, y forward)"""
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

    parts = []
    for s, kv in secs.items():
        img = kv.get("image")
        if not img or (boolish(kv.get("invisible")) and s != "turret_炮管"):
            continue  # the Stryker's barrel is drawn by a decal in the original; keep it
        hit = resolve(img, from_dir)
        if not hit:
            continue
        parts.append((s, hit, abs_pos(s)))
    # the base: the turret others attach to, else the imaged one nearest the hull's centre
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

    # guns mounted on the hull that turn on their own: painted onto the hull, still
    hull_parts = [p for p in parts if root and not on_root(p[0])]
    parts = [p for p in parts if not root or on_root(p[0])]
    root_pos = abs_pos(root) if root else (0, 0)
    turret_image = ini.get("graphics", {}).get("image_turret")
    if turret_image and turret_image.upper() != "NONE":
        hit = resolve(turret_image, from_dir)
        if hit:
            parts.insert(0, ("image_turret", hit, root_pos))
    # draw order: bases first, barrels on top; the root part is the base
    parts.sort(key=lambda p: (p[0] != root and p[0] != "image_turret"))
    return parts, root_pos, secs, hull_parts, root, on_root


def composite(parts, root_pos):
    """one image centred on the root pivot with every part laid at its offset"""
    ims = [(Image.open(p).convert("RGBA"), (pos[0] - root_pos[0], pos[1] - root_pos[1])) for _, p, pos in parts]
    half_w = half_h = 0
    for im, (dx, dy) in ims:
        half_w = max(half_w, abs(dx) + im.width / 2)
        half_h = max(half_h, abs(dy) + im.height / 2)
    W, H = int(math.ceil(half_w * 2)) + 2, int(math.ceil(half_h * 2)) + 2
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for im, (dx, dy) in ims:
        x = int(round(W / 2 + dx - im.width / 2))
        y = int(round(H / 2 - dy - im.height / 2))
        canvas.alpha_composite(im, (x, y))
    return canvas


# ------------------------------------------------------------ conversion
def convert():
    by_name = index_units()
    ids = {rw: f"{MOD_ID}-{suffix}" for rw, suffix, *_ in ROSTER}
    suffix_of = {rw: suffix for rw, suffix, *_ in ROSTER}
    defs = []
    produces = {}      # building id -> [unit ids]
    rw_lists = {}      # building id -> rw names it builds

    if not DRY and not NO_MEDIA:
        shutil.rmtree(OUT_SPRITES, ignore_errors=True)
        os.makedirs(OUT_SPRITES)

    for rw_name, suffix, en, desc_en, ov in ROSTER:
        path = by_name.get(rw_name)
        if not path:
            note(rw_name, "NOT FOUND in the package")
            continue
        ini = load_unit(path)
        core = ini.get("core", {})
        gfx = ini.get("graphics", {})
        atk = ini.get("attack", {})
        mov = ini.get("movement", {})
        d = os.path.dirname(path)
        did = ids[rw_name]
        kind = ov["kind"]
        is_building = kind == B
        is_zombie = kind == Z
        tags = [t.strip() for t in core.get("tags", "").split(",")]
        infantry = "步兵" in tags or (is_zombie and (num(core.get("radius")) or 9) <= 9)
        zh_name = ov.get("zh_name") or strip_quotes(core.get("displayText") or core.get("name") or rw_name)
        if is_building and not is_zombie and suffix == "sloth-nest":
            zh_name = "懒惰之罪"

        # ---- numbers
        hp_rw = num(core.get("maxHp")) or 100
        price = core.get("price", "0")
        folded = folded_price(price)
        if is_zombie:
            folded = max(folded, hp_rw * 4)  # the dead are priced by what they take to kill
        c, dsl, sup = price_parts(price)
        if is_building:
            cost = ov.get("cost", int(max(50, round((c + dsl + sup) * 0.1 / 10) * 10)))
            hp = ov.get("hp", int(round(hp_rw * (HP_TOWER if ov.get("tower") else HP_BUILDING))))
        else:
            hp = ov.get("hp", int(clamp(round(hp_rw * HP_UNIT), 40, 6000)))
            # the package prices by role; keep the metal within sight of the hit points
            cost = ov.get("cost", int(clamp(unit_cost(folded), max(15, round(hp / 4 / 5) * 5), max(60, round(hp * 2.5 / 5) * 5))))
        tier = ov.get("tier", int(clamp(round(num(core.get("techLevel")) or 1), 1, 3)))
        movement = (mov.get("movementType") or "LAND").upper()
        domain = ov.get("domain") or ("air" if movement == "AIR" else "ship" if movement in ("WATER", "OVER_CLIFF_WATER") else "ground")
        desc_zh = zh_desc(ini, ov.get("zh", ""))

        df = {"id": did, "name": [en, zh_name], "desc": [desc_en, desc_zh], "kind": "building" if is_building else "unit"}
        if not is_building:
            df["domain"] = domain
        df["tier"] = tier
        df["cost"] = cost
        bt = build_seconds(core.get("buildSpeed"))
        if bt:
            df["buildTime"] = round(clamp(bt * BUILD_TIME, 4, 120), 1)
        df["hp"] = hp
        if not is_building:
            df["pop"] = ov.get("pop", 1 if infantry else 1 if cost < 150 else 2 if cost < 450 else 3 if cost < 1000 else 4 if cost < 2000 else 5)
        armor = ov.get("armor")
        if not armor:
            if is_building:
                armor = "structure"
            elif domain == "air":
                armor = "air"
            elif domain == "ship":
                armor = "ship"
            elif infantry or is_zombie:
                armor = "light"
            elif "tank" in tags or hp_rw >= 2000:
                armor = "heavy"
            else:
                armor = "light"
        df["armor"] = armor
        vision = num(core.get("fogOfWarSightRange"))
        df["vision"] = ov.get("vision", int(clamp(round((vision or 8) * VISION), 3, 16)))
        radius = num(core.get("radius"))
        if not is_building:
            r = radius if radius else (6 if infantry else 10)
            df["radius"] = int(clamp(round(r), 4, 24))
            sp = num(mov.get("moveSpeed"))
            if sp is not None:
                df["speed"] = int(clamp(round(sp * SPEED * (INFANTRY_SPEED if infantry or is_zombie else 1)), 16, 300))
            tr = num(mov.get("maxTurnSpeed"))
            if tr is not None:
                df["turnRate"] = round(clamp(tr * 60 * math.pi / 180, 0.5, 8), 2)
            # HOVER is the package's car movement (its police cars drift, and drown five
            # seconds into the water): tyres, unless the roster says treads. A thing on
            # foot cuts no rut and is not heard as an engine.
            if movement == "HOVER":
                df["trail"] = "tire"
            if (infantry or is_zombie) and domain == "ground":
                df["trail"] = "none"
            if "trail" in ov:
                df["trail"] = ov["trail"]
            if ov.get("hovers"):
                df["hovers"] = True
            cap = num(core.get("maxTransportingUnits"))
            if cap and suffix not in ("drone-carrier",):
                df["transportCap"] = int(cap)
            if domain != "air" and not infantry and not is_zombie:
                df["fireOnMove"] = True
        else:
            fp = [num(x) for x in split_list(core.get("footprint", ""))]
            if "fw" in ov:
                df["fw"], df["fh"] = ov["fw"], ov["fh"]
            elif len(fp) == 4 and all(x is not None for x in fp):
                df["fw"] = int(clamp(fp[2] - fp[0] + 1, 1, 8))
                df["fh"] = int(clamp(fp[3] - fp[1] + 1, 1, 8))
            df["power"] = ov.get("power", 0)
            for k in ("metalRate", "needsDeposit"):
                if k in ov:
                    df[k] = ov[k]
            if "upgradeOf" in ov:
                df["upgradeOf"] = f"{MOD_ID}-{ov['upgradeOf']}"
                up = ini.get("action_upgrade", {})
                # the upgrade's price lives on the source's action; look it up
                src_rw = next((r[0] for r in ROSTER if r[1] == ov["upgradeOf"]), None)
                if src_rw and by_name.get(src_rw):
                    sini = load_unit(by_name[src_rw])
                    act = sini.get("action_upgrade", {})
                    p = folded_price(act.get("price", "0"))
                    if p:
                        df["upgradeCost"] = int(max(50, round(p * 0.1 / 10) * 10))
                    t = build_seconds(act.get("buildSpeed"))
                    df["upgradeTime"] = int(clamp(round((t or 10) * 3), 15, 90))
            rw_lists[did] = build_list(ini)

        # ---- weapons
        weapons = []
        if "weapons" in ov:
            for w in ov["weapons"]:
                w = dict(w)
                if w.get("sound") in NAMED_SOUNDS:
                    w["sound"] = add_sound(os.path.join(RW, NAMED_SOUNDS[w["sound"]]))
                weapons.append(w)
        elif boolish(atk.get("canAttack"), False) or (is_zombie and any(s.startswith("projectile_") for s in ini)):
            weapons = convert_weapons(ini, d, rw_name, domain, infantry, is_zombie, ov)
        if weapons and not is_zombie and not is_building and "weapons" not in ov:
            # the package's guns run hot; keep a unit's damage a second within sight of its price
            mult = ov.get("dmg_mult", 1.0)
            dps = sum(w["dmg"] * w.get("burst", 1) / w["reload"] for w in weapons) * mult
            cap = 0.1 * cost + 5
            if dps > cap:
                mult *= cap / dps
            if abs(mult - 1.0) > 1e-6:
                for w in weapons:
                    w["dmg"] = round(max(2.0, w["dmg"] * mult), 1)
                    # a gun's class follows the damage it ends up with
                    if w["cls"] in ("mg", "autocannon", "cannon") and not w.get("homing") and not w.get("arc"):
                        w["cls"] = "mg" if w["dmg"] < 8 else "autocannon" if w["dmg"] < 30 else "cannon"
                        w["projectile"] = "shell" if w["cls"] == "cannon" else "bullet"
        if weapons:
            df["weapons"] = weapons[:8]
        if ov.get("requires"):
            df["requires"] = [f"{MOD_ID}-{r}" for r in ov["requires"]]

        # ---- art
        image = ov.get("image")
        image = os.path.join(RW, image) if image else resolve(gfx.get("image", ""), d)
        if image and os.path.basename(image).lower() == "blank.png":
            image = None
        frames = int(max(1, round(num(gfx.get("total_frames")) or 1)))
        # RW px a picture px is drawn at, as the package sets it for the body and for its turrets
        scale, tur_scale = body_scale(ini, d), turret_scale(ini, d)
        body_sheet = None
        art_k = 1.0
        hull_px = None
        if image:
            im = clean_alpha(Image.open(image))
            # rotors and wings the original draws as spinning arms, and guns mounted on the
            # hull that turn on their own: laid on the body, still
            body_parts, body_root, hull_secs, hull_parts, _, hull_on_root = turret_parts(ini, d, ov)
            _, hull_abs = turret_positions(ini)
            lays = []  # (image in body px, x, y in RW px with y forward, under the body?)
            for item in ov.get("overlays", []):
                oimg, ox, oy, osc = item[:4]
                op = resolve(oimg, d)
                if not op:
                    note(rw_name, f"overlay {oimg} not found")
                    continue
                lays.append((prep(Image.open(op), osc), ox, oy, len(item) > 4 and item[4]))
            if not is_building and frames == 1 and not ov.get("turret_from") and not ov.get("no_turret"):
                lays += [(prep(Image.open(p[1]), tur_scale / scale), p[2][0], p[2][1], False) for p in hull_parts]
            # the hull's own decals: the still ones are painted on (before or after the body, as
            # the original draws them), the ones fixed to the gun go to the turret's sheet, the
            # conditional ones become the game's decals (`emit_decals`, once the sheet's scale is known)
            own_gun = (not is_building or ov.get("tower")) and not ov.get("no_turret") and not ov.get("turret_from")
            hull_dyn, tur_decs = [], []
            for dc in decal_list(ini, d):
                on_t = ("turret_" + dc["on"]) if dc["on"] else None
                if on_t and on_t in hull_secs and own_gun and hull_on_root(on_t):
                    tur_decs.append(dc)
                    continue
                x, y = dc["x"], dc["y"]
                if on_t and on_t in hull_secs:
                    px, py = hull_abs(on_t)
                    x, y = x + px, y + py
                dc = dict(dc, x=x, y=y)
                if dc["when"] != "always":
                    hull_dyn.append(dc)
                if dc["when"] not in ("always", "firing"):
                    continue
                if dc["layer"] == "shadow":
                    continue  # the game lays a unit's shadow itself
                elif frames == 1:
                    lays.append((prep(Image.open(dc["path"]), dc["scale"] / scale, dc["sx"], dc["sy"], dc["alpha"], dc["angle"], dc["frames"]), x, y, dc["layer"] == "beforebody"))
                else:
                    note(rw_name, f"decal {dc['name']} on an animated body; dropped")
            for o, ox, oy, under in lays:
                dx, dy = ox / scale, -oy / scale
                half_w = max(im.width / 2, abs(dx) + o.width / 2)
                half_h = max(im.height / 2, abs(dy) + o.height / 2)
                W, H = int(math.ceil(half_w * 2)), int(math.ceil(half_h * 2))
                cv = Image.new("RGBA", (W, H), (0, 0, 0, 0))
                layers = [(o, (int(round(W / 2 + dx - o.width / 2)), int(round(H / 2 + dy - o.height / 2)))), (im, ((W - im.width) // 2, (H - im.height) // 2))]
                for layer, at in (layers if under else layers[::-1]):
                    cv.alpha_composite(layer, at)
                im = cv
            if is_building:
                back = resolve(gfx.get("image_back", ""), d)
                if back:
                    b = clean_alpha(Image.open(back))
                    cv = Image.new("RGBA", (max(b.width, im.width), max(b.height, im.height)), (0, 0, 0, 0))
                    cv.alpha_composite(b, ((cv.width - b.width) // 2, (cv.height - b.height) // 2))
                    cv.alpha_composite(im, ((cv.width - im.width) // 2, (cv.height - im.height) // 2))
                    im = cv
                body_sheet = add_sheet(f"u.{did}", im, 1, False)
            else:
                pw = im.width // frames
                fw, fh, f = sheet_size(pw, im.height, scale, infantry)
                art_k = f / (ART * scale * (INFANTRY_ART if infantry else 1.0))
                hull_px = (pw, im.height)
                # the turret ring: where the main turret sits on the hull
                mount = None
                parts, root_pos = body_parts, body_root
                if ov.get("turret_offset"):
                    root_pos = ov["turret_offset"]
                if (parts or ov.get("turret_from")) and (abs(root_pos[0]) > 0.5 or abs(root_pos[1]) > 0.5):
                    mount = (0.5 + root_pos[0] / scale / pw, 0.5 - root_pos[1] / scale / im.height)
                if frames > 1 and im.width % frames:
                    im = im.crop((0, 0, pw * frames, im.height))
                body_sheet = add_sheet(f"u.{did}", im, frames, True, fw, fh, mount=mount)
                df["body"] = {"r": round(fw * DISPLAY / 2, 1), "len": round(max(0, (fh - fw) * DISPLAY), 1)}
                df["_art"] = f"{os.path.relpath(image, RW)[-38:]} {pw}x{im.height} f{frames} s{scale:.2f} k{art_k:.2f} -> {fw}x{fh}"
                # the hull's own decals the game draws: lamps, brake lights, in the sheet's px. One the
                # original lays over its own turrets goes over the game's; over a turret *unit* (which
                # is drawn above the whole hull) it stays on the hull, under the gun
                emit_decals(df, hull_dyn, f / scale, "hull", not ov.get("turret_from"))
        else:
            note(rw_name, "no body image; placeholder")
        if body_sheet:
            df["sprite"] = body_sheet

        # turret: this unit's own imaged turrets, or those of a turret unit it spawns
        tsrc, tdir = ini, d
        if ov.get("turret_from"):
            tp = by_name.get(ov["turret_from"])
            if tp:
                tsrc, tdir = load_unit(tp), os.path.dirname(tp)
        if (not is_building or ov.get("tower")) and not ov.get("no_turret"):
            cv, tur_dyn, tur_names = None, [], []
            if ov.get("turret_from") and tsrc is not ini:
                # a turret unit: its body turns with its gun, so everything it draws still —
                # body, barrel, fittings, the crew and their guns — is one picture (`unit_picture`)
                stills, tur_dyn = unit_picture(tsrc, tdir, by_name)
                if stills:
                    cv = clean_alpha(lay_stack(stills))
                tur_scale = 1.0  # the picture is in RW px already
                tur_names = [os.path.basename(resolve(tsrc.get("graphics", {}).get("image", "") or "", tdir) or "-"), f"{len(stills)} parts"]
            else:
                parts, root_pos, _, _, _, _ = turret_parts(tsrc, tdir, ov)
                _, tabs = turret_positions(tsrc)
                # the parts in the turret's own px (one px is `tur_scale` RW px), about the root
                items = [(prep(Image.open(pth)), (pos[0] - root_pos[0]) / tur_scale, (pos[1] - root_pos[1]) / tur_scale) for _, pth, pos in parts]
                tur_names = [os.path.basename(pth) for _, pth, _ in parts]
                for dc in tur_decs:
                    px, py = tabs("turret_" + dc["on"])
                    dc = dict(dc, x=dc["x"] + px - root_pos[0], y=dc["y"] + py - root_pos[1])
                    if dc["when"] in ("always", "firing") and dc["layer"] != "shadow":
                        items.append((prep(Image.open(dc["path"]), dc["scale"] / tur_scale, dc["sx"], dc["sy"], dc["alpha"], dc["angle"], dc["frames"]), dc["x"] / tur_scale, dc["y"] / tur_scale))
                        tur_names.append(os.path.basename(dc["path"]))
                    if dc["when"] != "always" or dc["layer"] == "shadow":
                        tur_dyn.append(dc)
                if items:
                    cv = clean_alpha(lay_stack(items))
            if cv is not None and cv.getbbox():
                k = art_k if hull_px else shrink(max(cv.size) * tur_scale)
                f = ART * tur_scale * k
                tw, th = max(4, round(cv.width * f)), max(4, round(cv.height * f))
                df["turretSprite"] = add_sheet(f"tur.{did}", cv, 1, True, tw, th)
                df["_tur"] = f"{'+'.join(tur_names)} {cv.width}x{cv.height} ts{tur_scale:.2f} -> {tw}x{th}"
                # the decals the game draws on the gun, in the sheet's px
                emit_decals(df, tur_dyn, f / tur_scale, "turret", True)
                # muzzle: the firing turret's forward offset from the pivot plus its barrel length
                if "weapons" in df:
                    for w in df["weapons"]:
                        if w.get("turret", True) and "muzzleOffset" not in w:
                            reach = w.pop("_reach", None)
                            if reach is None:
                                reach = cv.height / 2 * 0.9
                            w["muzzleOffset"] = round(clamp(reach * tur_scale * k * ART * DISPLAY, 2, 200), 1)
        if "weapons" in df:
            for w in df["weapons"]:
                w.pop("_reach", None)
                if "turretSprite" not in df:
                    w["turret"] = False
                    w.setdefault("muzzleOffset", round((hull_px[1] if hull_px else 20) * scale * art_k * ART * DISPLAY * 0.45, 1))
                elif w.get("turret") is None:
                    w["turret"] = True
        # aiWeight
        if not is_building:
            df["aiWeight"] = ov.get("aiWeight", 0 if is_zombie else 2 if infantry else 1.5)
        for k, v in ov.get("extra", {}).items():
            df[k] = v
        # what the package scripts for it, read after the roster is whole (`behaviour`)
        df["_acts"] = rw_actions(ini)
        df["_mend"] = num(core.get("selfRegenRate")) or 0
        defs.append(df)

    # ---- production
    by_id = {d["id"]: d for d in defs}
    for bid, names in rw_lists.items():
        b = by_id.get(bid)
        if not b:
            continue
        out = []
        for n in names:
            uid = ids.get(n)
            if not uid or uid not in by_id or uid in out:
                continue
            u = by_id[uid]
            if u["kind"] != "unit":
                continue
            out.append(uid)
        produces[bid] = out
    for suffix, extra in EXTRA_PRODUCES.items():
        bid = f"{MOD_ID}-{suffix}"
        produces.setdefault(bid, [])
        for s in extra:
            uid = f"{MOD_ID}-{s}"
            if uid in by_id and uid not in produces[bid]:
                produces[bid].append(uid)
    # a building on land never launches a boat: the game takes a building that trains one for
    # a naval yard (`yardKind`), and the Sin of Sloth could no longer stand on its deposit. The
    # Gloater, the dead's swimmer, is bred by a nest with water near it instead (`behaviour`)
    for bid, lst in produces.items():
        if bid != f"{MOD_ID}-coast-guard-base":
            produces[bid] = [u for u in lst if by_id[u].get("domain") != "ship"]
    for bid, lst in produces.items():
        if lst:
            by_id[bid]["produces"] = lst
        else:
            by_id[bid].pop("produces", None)
    for d in defs:
        if d["kind"] == "unit":
            # every unit comes from one of the mod's own buildings, as it did in the package,
            # but what a nest breeds by the water
            homes = [bid for bid, lst in produces.items() if d["id"] in lst]
            if not homes and d["id"] in WATER_BRED.values():
                d["producedBy"] = []
                continue
            assert homes, f"{d['id']}: no ported building trains it"
            d["producedBy"] = homes

    behaviour(defs, by_id, ids)

    # the zombie tier badge follows the nest
    order = {"building": 0, "unit": 1}
    defs.sort(key=lambda d: (order[d["kind"]], 0))
    return defs


def faction_setup(defs):
    """Adapt the original's city/infected picker to Steel Tide's base building.

    The original places structures through scripted buttons. These support
    variants reuse its own officer, brute and nest art for mobile construction
    and a deposit-independent infected headquarters.
    """
    prefix = f"{MOD_ID}-"
    by_id = {d["id"]: d for d in defs}
    dead = {prefix + r[1] for r in ROSTER if r[4].get("kind") == Z}
    engineer_id, carrier_id, colony_id = (prefix + s for s in ("police-engineer", "spk-carrier", "spk-colony"))
    infected = dead | {prefix + "sloth-nest", carrier_id, colony_id}
    police_buildings = [d["id"] for d in defs if d["kind"] == B and d["id"] not in infected and "upgradeOf" not in d]
    for d in defs:
        if d["kind"] == B:
            d["builtBy"] = [carrier_id if d["id"] in infected else engineer_id]
        if d["id"] in dead:
            d["power"] = 0  # the dead have no electrical grid
            d["aiWeight"] = 1
    for suffix in ("precinct", "precinct-2"):
        hq = by_id[prefix + suffix]
        hq.update(isHQ=True, power=10, metalRate=0.5)
        hq["produces"] = list(dict.fromkeys([engineer_id] + hq["produces"]))
    nest = by_id[prefix + "sloth-nest"]
    nest["metalRate"] = 1.4

    engineer = deepcopy(by_id[prefix + "traffic-officer"])
    engineer.update(id=engineer_id,
                    name=["Police Engineer", "警用工程员", "경찰 공병"],
                    desc=["A police construction specialist with a service rifle.", "配备制式步枪的警用工程人员。", "제식 소총을 갖춘 경찰 건설 전문가."],
                    cost=120, hp=160, buildTime=10, speed=52, buildRate=30, reach=46,
                    builds=police_buildings, producedBy=[prefix + "precinct", prefix + "precinct-2"], aiWeight=0)
    carrier = deepcopy(by_id[prefix + "brute"])
    carrier.update(id=carrier_id,
                   name=["SPK Carrier", "SPK 携巢者", "SPK 둥지 운반자"],
                   desc=["An infected host carrying the beginnings of a colony.", "携带巢群雏体的感染宿主。", "군락의 싹을 품은 감염 숙주."],
                   cost=120, hp=180, buildTime=10, speed=52, buildRate=30, reach=46,
                   builds=[colony_id, nest["id"]], producedBy=[colony_id], aiWeight=0)
    colony = dict(id=colony_id,
                  name=["SPK Colony", "SPK 母巢", "SPK 군락"],
                  desc=["A living heart of the SPK infection, surrounded by hosts and growing nests.", "SPK 感染的活体核心，宿主与滋长的巢穴环绕四周。", "숙주와 자라나는 둥지에 둘러싸인 SPK 감염의 살아 있는 심장."],
                  kind=B, tier=1, cost=1500, buildTime=60, hp=3000, armor="structure",
                  vision=10, fw=3, fh=3, isHQ=True, power=0, metalRate=0.5,
                  sprite=nest["sprite"], regen=4.5, builtBy=[carrier_id], produces=[carrier_id])
    # Idempotent so the same helper can migrate an existing manifest without
    # re-cutting its media, as well as finish a fresh conversion.
    added = {engineer_id, carrier_id, colony_id}
    defs[:] = [d for d in defs if d["id"] not in added] + [colony, engineer, carrier]
    for d in defs:
        for rule in d.get("rules", []):
            killed_by = rule.get("if", {}).get("killedBy", [])
            if prefix + "brute" in killed_by and carrier_id not in killed_by:
                killed_by.append(carrier_id)
    return [
        dict(id=prefix + "city", name=["Adolon City Authority", "阿多隆市政当局", "아돌론 시 당국"],
             headquarters=prefix + "precinct", builder=engineer_id,
             roster=[d["id"] for d in defs if d["id"] not in infected]),
        dict(id=prefix + "infected", name=["SPK Infected", "SPK 感染者", "SPK 감염자"],
             headquarters=colony_id, builder=carrier_id,
             roster=[d["id"] for d in defs if d["id"] in infected]),
    ]


def compare_versions(a, b):
    """positive when `a` is newer, as the game compares them"""
    pa = [int(x) if x.isdigit() else 0 for x in re.split(r"[.+-]", str(a))]
    pb = [int(x) if x.isdigit() else 0 for x in re.split(r"[.+-]", str(b))]
    n = max(len(pa), len(pb))
    pa += [0] * (n - len(pa)); pb += [0] * (n - len(pb))
    return (pa > pb) - (pa < pb)


def rw_actions(ini):
    """every action the unit's scripts define, `[action_*]` and `[hiddenAction_*]` alike"""
    out = []
    for sec, kv in ini.items():
        if sec.startswith("action_") or sec.startswith("hiddenAction_"):
            out.append(dict(kv, _id=sec))
    return out


def spawn_list(v):
    """`丧尸-壮汉*14(spawnChance=0.7,offsety=70),丧尸-M*25(...)` as (name, count, chance)"""
    out = []
    for m in re.finditer(r"([^,*(]+?)\s*(?:\*\s*(\d+))?\s*(?:\(([^)]*)\))?\s*(?:,|$)", v or ""):
        name = m.group(1).strip()
        if not name:
            continue
        chance = 1.0
        for kv in (m.group(3) or "").split(","):
            k, _, val = kv.partition("=")
            if k.strip() == "spawnChance" and num(val) is not None:
                chance = num(val)
        out.append((name, int(m.group(2) or 1), chance, "setToTeamOfLastAttacker=true" in (m.group(3) or "")))
    return out


# a nest's brood, against the package's: the port's dead are fewer and tougher each
BROOD = 0.35
# what a nest breeds only with water within a few tiles: its one swimmer (nest -> unit)
WATER_BRED = {f"{MOD_ID}-sloth-nest": f"{MOD_ID}-gloater"}
# the dead's rage after a kill: its length and its rest are counters in the package's scripts
RAGE = {"damage": 1.4, "reload": 0.7, "for": 8}
RAGE_REST = 20


def behaviour(defs, by_id, ids):
    """The package's scripts that the rules can carry (`game/modRules.ts`): the police and the
    troops rise as the dead when the dead kill them, the Sins' nests breed on a clock, a patrol
    car arrives with its officers aboard, and the dead rage after a kill and mend when left be."""
    dead = sorted(f"{MOD_ID}-{sfx}" for rw, sfx, _, _, ov in ROSTER if ov["kind"] == Z and f"{MOD_ID}-{sfx}" in by_id)
    for d in defs:
        rules = []
        for a in d.pop("_acts", []):
            ev = (a.get("autoTriggerOnEvent") or "").strip()
            cond = a.get("requireConditional") or ""
            spawn = a.get("spawnUnits")
            # risen: killed by the dead, it gets up as one of them for whoever killed it
            if ev == "destroyed" and spawn and "丧尸" in cond:
                for name, n, chance, killer in spawn_list(spawn):
                    uid = ids.get(name)
                    if uid in by_id:
                        rules.append({"on": "destroyed", "if": {"killedBy": dead},
                                      "do": {"spawn": {"unit": uid, "count": n, **({"side": "killer"} if killer else {})}}})
                continue
            # a nest's brood, on the timer the package resets after each
            timer = re.search(r"customTimer\(laterThanSeconds=([\d.]+)\)", a.get("autoTrigger") or "")
            if spawn and timer:
                spawns = []
                for name, n, chance, _ in spawn_list(spawn):
                    uid = ids.get(name)
                    k = round(n * chance * BROOD)
                    if uid in by_id and k >= 1:
                        spawns.append({"spawn": {"unit": uid, "count": min(16, k)}})
                if spawns:
                    rules.append({"every": max(5, num(timer.group(1))), "do": spawns[:8]})
                continue
            # a vehicle arrives crewed
            crew = a.get("addUnitsIntoTransport")
            if ev == "created" and crew and d.get("transportCap"):
                for name, n, _, _ in spawn_list(crew):
                    uid = ids.get(name)
                    if uid in by_id:
                        rules.append({"on": "created", "do": {"spawn": {"unit": uid, "count": n, "into": "hold"}}})
                continue
            # the dead's rage after a kill
            stats = a.get("setUnitStats") or ""
            if ev == "killedAnyUnit" and "shootDamageMultiplier" in stats:
                rules.append({"on": "kill", "cooldown": RAGE_REST, "do": {"buff": dict(RAGE)}})
                continue
            # the dead mend when they have been left alone a while
            if "hp=self.hp+" in stats.replace(" ", ""):
                gain = num(stats.replace(" ", "").split("hp=self.hp+")[1].split(",")[0]) or 0
                if gain > 0:
                    rules.append({"every": 2, "if": {"not": {"hurtWithin": 6}}, "do": {"heal": round(gain * HP_UNIT, 1)}})
        if d["id"] in WATER_BRED and WATER_BRED[d["id"]] in by_id:
            # the spawn finds water within six tiles or puts nothing down: an inland nest breeds none
            rules.append({"every": 60, "do": {"spawn": {"unit": WATER_BRED[d["id"]], "count": 1, "max": 2}}})
        mend = d.pop("_mend", 0)
        if mend > 0:
            regen = min(mend * 60 * HP_UNIT, d["hp"] * 0.005)
            if regen >= 0.3:
                d["regen"] = round(regen, 1)
        # one of each: the package repeats a rule per slot of its own bookkeeping
        seen, kept = set(), []
        for r in rules:
            key = json.dumps(r, sort_keys=True, ensure_ascii=False)
            if key not in seen:
                seen.add(key)
                kept.append(r)
        if kept:
            d["rules"] = kept[:24]
    # a crew is what the hold takes of the package's, and a crewed vehicle costs what that
    # crew does besides: the package's price was for both
    for d in defs:
        room = d.get("transportCap", 0)
        kept = []
        for r in d.get("rules", []):
            sp = r["do"].get("spawn") if isinstance(r["do"], dict) else None
            if r.get("on") == "created" and sp and sp.get("into") == "hold":
                crew = by_id[sp["unit"]]
                weight = crew.get("cargoWeight", crew.get("pop", 1)) or 1
                n = min(sp["count"], int(room // weight))
                if n <= 0:
                    continue
                room -= n * weight
                sp["count"] = n
                d["cost"] = int(d["cost"] + crew["cost"] * n)
            kept.append(r)
        if "rules" in d:
            d["rules"] = kept
            if not kept:
                del d["rules"]


SCRIPT_PROJECTILES = ("ramOver", "yyyy", "碰撞", "旋转", "推动", "K")


def first_projectile(ini):
    for s, kv in ini.items():
        if not s.startswith("projectile_"):
            continue
        n = s[len("projectile_"):]
        if n in SCRIPT_PROJECTILES or boolish(kv.get("invisible")):
            continue
        if (num(kv.get("directDamage")) or 0) > 0 or (num(kv.get("areaDamage")) or 0) > 0:
            return n
    return None


def convert_weapons(ini, d, unit, domain, infantry, is_zombie, ov):
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

    groups = {}  # projectile -> list of (turret name, kv, pos)
    for s, kv in secs.items():
        if boolish(kv.get("canShoot"), True) is False:
            continue
        if kv.get("canAttack", "").strip().lower() == "false":
            continue
        proj = (kv.get("projectile") or "").strip()
        if not proj:
            # a bare turret fires projectile_<its number>, else the first real projectile section
            n = s[len("turret_"):]
            proj = n if f"projectile_{n}" in ini else (first_projectile(ini) or "")
        if not proj or f"projectile_{proj}" not in ini:
            continue
        pos = abs_pos(s)
        lst = groups.setdefault(proj, [])
        if any(abs(p[2][0] - pos[0]) < 0.5 and abs(p[2][1] - pos[1]) < 0.5 for p in lst):
            continue  # the -2 alternates of the same gun
        lst.append((s, kv, pos))
    if not groups and f"projectile_1" in ini:
        groups["1"] = [("turret_1", {}, (0, 0))]

    weapons = []
    for proj, turrets in groups.items():
        p = ini[f"projectile_{proj}"]
        if boolish(p.get("invisible")) and not is_zombie:
            continue
        direct = num(p.get("directDamage")) or 0
        area = num(p.get("areaDamage")) or 0
        pellets = 1
        spawn = p.get("spawnProjectilesOnCreate")
        if direct <= 0 and area <= 0 and spawn:
            # a shotgun: a spawner projectile that scatters N real pellets
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
        reload = seconds(kv.get("delay")) or delay_default
        # the energy magazine: N shots, then a recharge; the average is what a reload means here
        core = ini.get("core", {})
        usage = num(kv.get("energyUsage")) or 0
        emax = num(core.get("energyMax")) or 0
        regen = num(core.get("energyRegenWhenRecharging")) or num(core.get("energyRegen")) or 0
        if usage > 0 and emax > 0 and regen > 0:
            shots = max(1, emax / usage)
            recharge = emax / regen / 60
            reload = reload + recharge / shots
        snd_name = (kv.get("shoot_sound") or "").lower()
        homing = (num(p.get("turnSpeed")) or 0) > 0 or "missile" in snd_name or "rocket" in snd_name or "火箭" in snd_name
        arc = boolish(p.get("ballistic")) or (num(p.get("initialUnguidedSpeedHeight")) or 0) > 0 or ov.get("arc", False)
        flame = boolish(p.get("flameWeapon")) or ov.get("flame", False)
        instant = boolish(p.get("instant"))
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
        dmg = dmg_rw * (ZOMBIE_DMG if is_zombie else DMG)
        if reload < 0.3:
            k = math.ceil(0.3 / reload)
            reload *= k
            dmg *= k
        rng = clamp(range_px * RANGE, 0.6, 12)
        if melee:
            rng = 0.6
        if flame:
            cls, projectile = "he", "flame"
        elif only_air:
            cls, projectile = "aa", ("missile" if homing else "flak")
        elif t_sub and not t_land:
            cls, projectile = "torpedo", "torpedo"
        elif arc or (target_ground and not melee and area > 0 and not homing and domain != "air" and not infantry):
            cls, projectile = "he", "shell"
        elif target_ground and domain == "air":
            cls, projectile = "he", "bomb"
        elif homing or proj.upper().startswith("R") and infantry:
            cls, projectile = "at", "missile"
        elif melee:
            cls, projectile = ("he" if ov.get("building_breaker") else "autocannon"), "bullet"
        elif domain == "ship" and dmg >= 20:
            cls, projectile = "navgun", "shell"
        elif dmg < 8:
            cls, projectile = "mg", "bullet"
        elif dmg < 30:
            cls, projectile = "autocannon", "bullet"
        else:
            cls, projectile = "cannon", "shell"
        w = {"id": re.sub(r"[^a-z0-9_-]", "", proj.lower()) or f"w{len(weapons) + 1}", "cls": cls,
             "dmg": round(dmg, 1), "reload": round(max(0.05, reload), 2), "range": round(rng, 1), "targets": targets, "projectile": projectile}
        speed = num(p.get("speed"))
        if speed and not instant and not flame:
            w["speed"] = int(clamp(round(speed * 96), 60, 1500))
        elif flame:
            w["speed"] = 240
        else:
            w["speed"] = 900 if cls in ("mg", "autocannon") else 500
        ar = num(p.get("areaRadius"))
        if area > 0 and ar and not flame:
            w["splash"] = int(round(clamp(ar * ART * DISPLAY * 0.6, 4, 90)))
        if homing:
            w["homing"] = True
        if arc and cls == "he" and projectile == "shell":
            w["arc"] = True
        w["dmg"] = round(max(2.0, dmg), 1)
        if flame:
            glob = clamp(dmg * 0.5, 3, 9)
            w.update(fan=0.22, burn=round(clamp(glob * 1.5, 4, 14), 1), burnLife=5, splash=30, burst=12, burstDelay=0.04)
            w["dmg"] = round(glob, 1)
            w["reload"] = round(max(2.2, reload * 4), 2)
        n = len(turrets)
        if n > 1 and not flame:
            xs = sorted(t[2][0] for t in turrets)
            if n == 2 and abs(xs[0] + xs[1]) < 1 and abs(xs[1] - xs[0]) > 1:
                w["bores"] = 2
                w["boreSpacing"] = round((xs[1] - xs[0]) * ART * DISPLAY, 1)
            else:
                w["burst"] = min(8, n)
                w["burstDelay"] = 0.12
        spread = num(p.get("targetGroundSpread"))
        if spread:
            w["spread"] = int(round(clamp(spread * ART * DISPLAY, 2, 60)))
        if pellets > 1:
            w["spread"] = max(w.get("spread", 0), 10)
            w["projectile"] = "bullet"
        w["_reach"] = turrets[0][2][1] + (num(kv.get("size")) or turret_size or 0)
        snd = weapon_sound(kv.get("shoot_sound"), d, unit)
        if snd:
            w["sound"] = snd
        elif flame:
            w["sound"] = "flame"
        weapons.append(w)
    # the strongest weapon leads; a def gets at most 8
    weapons.sort(key=lambda w: -(w["dmg"] / max(0.05, w["reload"])))
    return weapons


def dump(name):
    by_name = index_units()
    p = by_name.get(strip_quotes(name))
    if not p:
        print("not found:", name)
        return
    ini = load_unit(p)
    print("#", p)
    for s, kv in ini.items():
        if re.match(r"^(core|graphics|attack|movement|turret_.*|projectile_.*)$", s):
            keep = {k: v for k, v in kv.items() if not k.startswith(("@", "effect", "shoot_flame", "shoot_light", "idleSweep", "recoil", "explodeEffect", "trailEffect", "mutator", "display", "tags", "copyFrom", "soundOn"))}
            print(f"[{s}] " + ", ".join(f"{k}={v[:40]}" for k, v in keep.items()))


def main():
    if "--dump" in sys.argv:
        for n in sys.argv[sys.argv.index("--dump") + 1:]:
            dump(n)
        return
    defs = convert()
    factions = faction_setup(defs)
    write_sounds()
    desc_en = ("The city police and the troops that come to their aid, their cruisers, tanks and helicopters, "
               "and the dead they are fighting: bred from nests you can place yourself, and rising again from the police they kill.")
    desc_zh = "都市警力与前来增援的部队、他们的警车、坦克和直升机，以及他们要对付的死者——从你亲手放置的巢穴中繁殖，被它们杀死的警察也会尸变。"
    manifest = {
        "format": "steel-tide-mod",
        "v": 2,
        "id": MOD_ID,
        "name": ["Adolence: City of Sin", "Adolence·罪恶之都"],
        "version": "1.2.2",
        "minGame": "0.8.14",  # format 2: selectable factions and mod headquarters
        "author": "自然常数也有人用? and the Adolence team",
        "description": [desc_en, desc_zh],
        "homepage": "https://github.com/steel-tide/mods/tree/main/mods/adolence",
        "license": "LicenseRef-Adolence",
        "defs": defs,
        "factions": factions,
        "sprites": SHEETS,
        "sounds": [{"key": k, "file": f} for k, f in dict(SOUND_JOBS.values()).items()],
        "screenshots": [],
    }
    old = {}
    if os.path.exists(os.path.join(HERE, "mod.json")):
        old = json.load(open(os.path.join(HERE, "mod.json"), encoding="utf-8"))
        # bumped by hand in mod.json and kept; never below this script's own
        if compare_versions(old.get("version", "0"), manifest["version"]) > 0:
            manifest["version"] = old["version"]
        manifest["screenshots"] = old.get("screenshots", [])
    if not manifest["screenshots"]:
        # whatever pictures sit in screenshots/, in name order: drop them there and re-run
        shots_dir = os.path.join(HERE, "screenshots")
        if os.path.isdir(shots_dir):
            manifest["screenshots"] = [f"screenshots/{f}" for f in sorted(os.listdir(shots_dir)) if re.search(r"\.(png|jpe?g|webp)$", f, re.I)]
    if old.get("maps"):
        manifest["maps"] = old["maps"]  # the map make-map.py writes; it is the mod's own, not the package's
    text = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    if DRY:
        art = "--art" in sys.argv
        for d in defs:
            if art:
                print(f"{d['id'][9:]:28} {d.get('_art', '-')}" + (f"  | tur {d['_tur']}" if '_tur' in d else "") + (f"  mz {[w.get('muzzleOffset') for w in d['weapons']]}" if 'weapons' in d else ""))
                continue
            ws = "; ".join(f"{w['id']}:{w['cls']} {w['dmg']}/{w['reload']}s r{w['range']}" + (f" ×{w['burst']}" if 'burst' in w else "") + (f" b{w['bores']}" if 'bores' in w else "") for w in d.get("weapons", []))
            print(f"{d['id']:34} {d['kind'][0]} T{d['tier']} cost {d['cost']:>5} hp {d['hp']:>5} pop {d.get('pop','-'):>2} spd {d.get('speed','-'):>3} {d.get('armor','')[:5]:5} | {ws}")
        print(f"\n{len(defs)} defs, {len(SHEETS)} sheets, {len(SOUND_JOBS)} sounds")
    else:
        for d in defs:
            d.pop("_art", None)
            d.pop("_tur", None)
        text = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
        os.makedirs(OUT, exist_ok=True)
        open(os.path.join(OUT, "mod.json"), "w", encoding="utf-8").write(text)
        print(f"wrote mod.json: {len(defs)} defs, {len(SHEETS)} sheets, {len(SOUND_JOBS)} sounds")
    for n in NOTES:
        print("note:", n)


if __name__ == "__main__":
    main()

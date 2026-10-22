"""Unit conversion with explicit units; never balance or clamp a source value.

RW's official reference defines speed 1 as 60 px/s (three 20-pixel tiles).
The pack uses 0.4 world pixels per source pixel. HP and damage retain the
existing common 0.6 scale; source protection and component durability are
independent quantities and are not rescaled by this module.
"""
import math

LENGTH = .4
SOURCE_HZ = 60
SOURCE_TILE = 20
HOST_TILE = 32
HEALTH = .6


def literal(fields, key, default):
    raw = fields.get(key, default)
    try:
        value = float(raw)
    except (TypeError, ValueError):
        raise ValueError(f'{key}: unresolved source value {raw!r}') from None
    if not math.isfinite(value):
        raise ValueError(f'{key}: nonfinite source value')
    return value


def unit_stats(ini):
    core, movement = ini.get('core', {}), ini.get('movement', {})
    result = {
        'hp': literal(core, 'maxHp', 400) * HEALTH,
        'speed': literal(movement, 'moveSpeed', 1) * LENGTH * SOURCE_HZ,
        'turnRate': literal(movement, 'maxTurnSpeed', 2) * math.pi / 180 * SOURCE_HZ,
        'radius': literal(core, 'radius', 10) * LENGTH,
        'vision': literal(core, 'fogOfWarSightRange', 15) * SOURCE_TILE * LENGTH / HOST_TILE,
    }
    if 'selfRegenRate' in core:
        result['regen'] = literal(core, 'selfRegenRate', 0) * SOURCE_HZ * HEALTH
    for key, lo, hi in [('hp', 1, 100_000_000), ('speed', 0, 1000),
                        ('turnRate', 0, 50), ('radius', 1, 200), ('vision', 0, 64), ('regen', 0, 10000)]:
        if key not in result:
            continue
        if not lo <= result[key] <= hi:
            raise ValueError(f'{key}: source-mapped value {result[key]} exceeds host [{lo}, {hi}]; requires an explicit source policy')
    return {key: round(value, 8) for key, value in result.items()}

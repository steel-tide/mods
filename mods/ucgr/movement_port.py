"""Source movement policies for helpers whose lifecycle owns a direct waypoint.

Ordinary ground movement is not opted in: RW reverse/arrival decisions depend on
pathfinder and formation state that native routing does not expose as a hook.
"""
import math


def source_movement(ini):
    movement, core = ini.get('movement', {}), ini.get('core', {})
    if not (movement.get('movementType') == 'AIR'
            and movement.get('moveSlidingMode', 'false').lower() == 'true'
            and movement.get('moveIgnoringBody', 'false').lower() == 'true'
            and movement.get('joinsGroupFormations', 'true').lower() == 'false'
            and core.get('disableAllUnitCollisions', 'false').lower() == 'true'):
        return None
    fields = {'speed': ('moveSpeed', 1), 'acceleration': ('moveAccelerationSpeed', 1),
              'deceleration': ('moveDecelerationSpeed', 1), 'turn': ('maxTurnSpeed', 1),
              'turnAcceleration': ('turnAcceleration', 1), 'yScale': ('moveYAxisScaling', 1)}
    try:
        result = {key: float(movement.get(field, default)) for key, (field, default) in fields.items()}
        scale = float(core.get('globalScale', 1))
    except (ValueError, TypeError):
        return None
    if any(not math.isfinite(n) or n < 0 or n > 100000 for n in result.values()) or result['yScale'] <= 0 or scale <= 0:
        return None
    for key in ('speed', 'acceleration', 'deceleration'):
        result[key] *= scale
    return result

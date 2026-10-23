"""Read the GW BattleUniverse packages without executing their scripts.

Rusted Warfare loads the four packages together: each resolves `ROOT:` against
its own folder, but unit names are global, so a DLC's factory can produce a
projectile unit defined in the main package. A later `overrideAndReplace` of
the same name replaces the main package's placeholder.
"""
from pathlib import Path
from functools import lru_cache
import ast
import operator
import re

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parents[1] / 'rusted-warfare-mods' / 'gw'
# Load order: the main package first, then the series packages that override it.
PACKAGES = ['GW_BattleUniverse_Main', 'GW_BattleUniverse_DLC_0079', 'GW_BattleUniverse_DLC_0087', 'GW_BattleUniverse_DLC_SEED']


class Ini(dict):
    """Sections of key/value strings, with the file each key came from."""
    def __init__(self):
        super().__init__()
        self.origins = {}


def package_of(path):
    rel = Path(path).resolve().relative_to(SOURCE)
    return SOURCE / rel.parts[0]


def _split(line):
    if line.startswith(('@define ', '@global ')):
        word, rest = line.split(' ', 1)
        cut = min((i for i in (rest.find('='), rest.find(':')) if i >= 0), default=-1)
        if cut < 0:
            return None
        return f'{word} {rest[:cut].strip()}', rest[cut + 1:].strip()
    colon, equals = line.find(':'), line.find('=')
    # `disableDeathOnZeroHp=true` is a plain key; `setUnitMemory:a=b` splits at the colon.
    if equals >= 0 and (colon < 0 or equals < colon) and re.fullmatch(r'[\w.]+', line[:equals].strip()):
        return line[:equals].strip(), line[equals + 1:].strip()
    if colon < 0:
        return None
    return line[:colon].strip(), line[colon + 1:].strip()


@lru_cache(None)
def parse(path):
    out = Ini()
    section = None
    lines = Path(path).read_text(encoding='utf-8-sig', errors='replace').splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        i += 1
        if not line or line.startswith(('#', ';', '//')):
            continue
        head = re.match(r'^\[([^\]]+)\]', line)
        if head:
            section = head[1].strip()
            out.setdefault(section, {})
            continue
        if section is None:
            continue
        pair = _split(line)
        if not pair:
            continue
        key, value = pair
        if value.startswith('"""') or '"""' in value:
            prefix, content = value.split('"""', 1)
            while '"""' not in content and i < len(lines):
                content += '\n' + lines[i]
                i += 1
            body, suffix = content.split('"""', 1) if '"""' in content else (content, '')
            value = prefix + body.strip() + suffix
        out[section][key] = value
        out.origins.setdefault(section, {})[key] = str(path)
    return out


def resolve_ref(ref, from_file):
    ref = str(ref or '').strip().strip('"').replace('\\', '/')
    if not ref or ref.upper() in ('NONE', 'AUTO') or ref.upper().startswith(('SHARED:', 'CORE:')):
        return None
    ref = re.sub(r'(\.(?:ogg|wav|mp3)):[\d.]+$', r'\1', ref, flags=re.I)
    if ref.upper().startswith('ROOT:'):
        path = package_of(from_file) / ref[5:].lstrip('/')
    else:
        path = Path(from_file).parent / ref
    path = Path(path)
    if path.is_file():
        return path.resolve()
    # The packages were authored on Windows: paths are case-insensitive.
    probe = package_of(from_file) if ref.upper().startswith('ROOT:') else Path(from_file).parent
    parts = Path(ref[5:].lstrip('/') if ref.upper().startswith('ROOT:') else ref).parts
    for part in parts:
        if part == '..':
            probe = probe.parent
            continue
        if not probe.is_dir():
            return None
        probe = next((p for p in probe.iterdir() if p.name.casefold() == part.casefold()), None)
        if probe is None:
            return None
    return probe.resolve() if probe.is_file() else None


def _merge(dest, src):
    for section, fields in src.items():
        if fields.get('@copyFrom_skipThisSection', '').lower() == 'true':
            dest[section] = {}
        dest.setdefault(section, {}).update(fields)
        dest.origins.setdefault(section, {}).update(src.origins.get(section, {}))


@lru_cache(None)
def load_file(path, stack=()):
    path = Path(path).resolve()
    if path in stack:
        raise ValueError(f'copyFrom cycle: {path}')
    own = parse(path)
    out = Ini()
    for ref in re.split(r'[,\n]', own.get('core', {}).get('copyFrom', '')):
        if not ref.strip():
            continue
        base = resolve_ref(ref, path)
        if base:
            _merge(out, load_file(base, stack + (path,)))
    _merge(out, own)
    return out


def _arith(text):
    ops = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
           ast.Div: operator.truediv, ast.Mod: operator.mod}
    def run(node):
        if isinstance(node, ast.Constant) and type(node.value) in (int, float):
            return node.value
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd)):
            return (-1 if isinstance(node.op, ast.USub) else 1) * run(node.operand)
        if isinstance(node, ast.BinOp) and type(node.op) in ops:
            return ops[type(node.op)](run(node.left), run(node.right))
        raise ValueError(text)
    return run(ast.parse(text, mode='eval').body)


def expand(out):
    """Section inheritance, then `${name}` substitution (section defines win over globals)."""
    for _ in range(10):
        changed = False
        for section, fields in list(out.items()):
            for name in fields.get('@copyFromSection', '').split(','):
                name = name.strip()
                for key, value in out.get(name, {}).items():
                    if key not in fields and key != '@copyFromSection':
                        fields[key] = value
                        changed = True
        if not changed:
            break
    globals_ = {}
    for fields in out.values():
        for key, value in fields.items():
            if key.startswith('@global '):
                globals_[key[8:].strip()] = value
    for _ in range(10):
        changed = False
        for section, fields in out.items():
            local = {k[8:].strip(): v for k, v in fields.items() if k.startswith('@define ')}
            def sub(match):
                name = match[1].strip()
                if name in local:
                    return local[name]
                if name in globals_:
                    return globals_[name]
                # `${turret_X.delay}` reads another section's key.
                sec, _, key = name.partition('.')
                if key and key in out.get(sec, {}):
                    return out[sec][key]
                return match[0]
            for key, value in list(fields.items()):
                new = re.sub(r'\$\{([^}]+)\}', sub, value)
                if new != value:
                    fields[key] = new
                    changed = True
        if not changed:
            break
    return out


@lru_cache(None)
def load(path):
    """A unit as Rusted Warfare composes it: package template, copyFrom chain, sections, variables."""
    path = Path(path).resolve()
    out = Ini()
    template = package_of(path) / 'all-units.template'
    if template.is_file():
        _merge(out, load_file(template))
    _merge(out, load_file(path))
    return expand(out)


def core(ini):
    return ini.get('core', {})


def is_template(path):
    return core(parse(path)).get('dont_load', '').strip().lower() == 'true'


@lru_cache(None)
def index():
    """Global unit name → file, with later packages' overrides winning."""
    names = {}
    for package in PACKAGES:
        for path in sorted((SOURCE / package).rglob('*')):
            if path.suffix.lower() != '.ini' or not path.is_file() or is_template(path):
                continue
            own = core(parse(path))
            name = own.get('name', '').strip()
            if not name:
                name = core(load_file(path)).get('name', '').strip()
            if not name:
                continue
            if name not in names or own.get('overrideAndReplace', '').strip() == name:
                names[name] = path.resolve()
    return names


def unit(name):
    path = index().get(name)
    return (path, load(path)) if path else (None, None)


def text(value):
    """RW display text: only `\\n` breaks a line; the file's own line breaks are layout."""
    joined = ' '.join(line.strip() for line in (value or '').strip().splitlines())
    lines = [line.strip() for line in joined.split('\\n')]
    return '\n'.join(lines).strip()


def memory_block(value):
    """`a=1, b=x*2` from a setUnitMemory block, numbers evaluated where they are plain arithmetic."""
    out = {}
    depth, cur = 0, ''
    for ch in value or '':
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
        if ch in ',\n' and depth == 0:
            out_item = cur.strip()
            cur = ''
            if '=' in out_item:
                k, v = out_item.split('=', 1)
                out[k.strip()] = v.strip()
            continue
        cur += ch
    if '=' in cur:
        k, v = cur.split('=', 1)
        out[k.strip()] = v.strip()
    resolved = {}
    for _ in range(4):
        for k, v in out.items():
            if k in resolved:
                continue
            expr = re.sub(r'memory\.(\w+)', lambda m: f'({resolved[m[1]]})' if m[1] in resolved else m[0], v)
            try:
                resolved[k] = _arith(expr)
            except (ValueError, SyntaxError, TypeError, ZeroDivisionError):
                pass
    return {k: resolved.get(k, v) for k, v in out.items()}


def num(value, default=None):
    try:
        return float(str(value).strip().rstrip('s'))
    except (TypeError, ValueError):
        return default

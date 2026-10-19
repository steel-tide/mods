"""Read the supplied Naval Warfare package without executing its scripts.

Retains per-key origins and raw expressions for the compatibility report. No
Rusted Warfare action is executed, and no game/runtime files are modified.
"""
from pathlib import Path
from copy import deepcopy
from functools import lru_cache
import ast
import operator
import re
import hashlib

HERE = Path(__file__).resolve().parent
RW = HERE.parents[1] / 'rusted-warfare-mods' / 'naval-warfare'

class Ini(dict):
    def __init__(self):
        super().__init__()
        self.origins = {}
        self.warnings = []

def parse(path):
    result = Ini()
    section = None
    lines = Path(path).read_text(encoding='utf-8-sig', errors='replace').splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        i += 1
        if not line or line.startswith(('#', ';', '//')):
            continue
        match = re.match(r'^\[([^]]+)\]', line)
        if match:
            section = match[1].strip()
            result.setdefault(section, {})
            continue
        if section is None or ':' not in line:
            continue
        key, value = (x.strip() for x in line.split(':', 1))
        if '"""' in value:
            prefix, content = value.split('"""', 1)
            while '"""' not in content and i < len(lines):
                content += '\n' + lines[i]
                i += 1
            if '"""' not in content:
                raise ValueError(f'{path}: unterminated multiline value for {section}.{key}')
            body, suffix = content.split('"""', 1)
            value = prefix + body.strip() + suffix
        result[section][key] = value
        result.origins.setdefault(section, {})[key] = str(Path(path).resolve())
    return result

def resolve(ref, from_dir):
    ref = str(ref or '').strip().replace('\\', '/')
    if ref.upper() in ('', 'NONE', 'AUTO') or ref.upper().startswith(('SHARED:', 'SHADOW:', 'CUSTOM:')):
        return None
    ref = re.sub(r'(\.(?:ogg|wav|mp3)):[\d.]+$', r'\1', ref, flags=re.I)
    path = RW / ref[5:].lstrip('/') if ref.upper().startswith('ROOT:') else Path(from_dir) / ref
    path = path.resolve()
    if path.is_file():
        return path
    # The package came from Windows and uses case-insensitive paths.
    if path.parent.is_dir():
        return next((p for p in path.parent.iterdir() if p.name.casefold() == path.name.casefold()), None)
    return None

def merge(dest, src):
    for section, fields in src.items():
        if fields.get('@copyFrom_skipThisSection', '').lower() == 'true':
            dest[section] = {}
            dest.origins[section] = {}
        dest.setdefault(section, {}).update(fields)
        dest.origins.setdefault(section, {}).update(src.origins.get(section, {}))
    dest.warnings.extend(src.warnings)

@lru_cache(None)
def load_file(path, stack=()):
    path = Path(path).resolve()
    if path in stack:
        raise ValueError(f'copyFrom cycle: {path}')
    own = parse(path)
    out = Ini()
    for ref in own.get('core', {}).get('copyFrom', '').split(','):
        if not ref.strip():
            continue
        base = resolve(ref, path.parent)
        if base:
            merge(out, load_file(base, stack + (path,)))
        else:
            out.warnings.append(f'{path.relative_to(RW)}: missing copyFrom {ref}')
    merge(out, own)
    return out

def numeric_expression(text):
    ops = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
           ast.Div: operator.truediv, ast.Pow: operator.pow, ast.Mod: operator.mod}
    def run(node):
        if isinstance(node, ast.Constant) and type(node.value) in (int, float):
            return node.value
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd)):
            return (-1 if isinstance(node.op, ast.USub) else 1) * run(node.operand)
        if isinstance(node, ast.BinOp) and type(node.op) in ops:
            return ops[type(node.op)](run(node.left), run(node.right))
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in ('int', 'min', 'max'):
            return {'int': int, 'min': min, 'max': max}[node.func.id](*(run(a) for a in node.args))
        raise ValueError(text)
    return run(ast.parse(text, mode='eval').body)

def expand(out):
    # Section inheritance precedes variable substitution; section-local defines
    # override globals only in that section.
    for _ in range(8):
        changed = False
        for section, fields in list(out.items()):
            sources = fields.get('@copyFromSection', '')
            if section.startswith(('turret_', 'projectile_', 'arm_', 'leg_')) and fields.get('copyFrom'):
                sources += ',' + section.split('_')[0] + '_' + fields['copyFrom']
            for name in sources.split(','):
                for key, value in out.get(name.strip(), {}).items():
                    if key not in fields and key not in ('@copyFromSection', 'copyFrom'):
                        fields[key] = value
                        out.origins.setdefault(section, {})[key] = out.origins.get(name.strip(), {}).get(key, '')
                        changed = True
        if not changed:
            break
    globals_ = {k[8:].strip(): v for fields in out.values() for k, v in fields.items() if k.startswith('@global ')}
    token_re = r'(?<![\w.])[\w\u4e00-\u9fff]+(?:\.[\w\u4e00-\u9fff]+)?'
    for _ in range(12):
        changed = False
        for section, fields in out.items():
            local = {k[8:].strip(): v for k, v in fields.items() if k.startswith('@define ')}
            def lookup(token):
                if token in local:
                    return local[token]
                if token in globals_:
                    return globals_[token]
                if '.' in token:
                    sec, key = token.split('.', 1)
                    return out.get(sec, {}).get(key)
                return None
            def substitute(match):
                expr = match[1].strip()
                value = lookup(expr)
                if value is not None:
                    return value
                def term(m):
                    val = lookup(m[0])
                    return '(' + val + ')' if val is not None else m[0]
                try:
                    value = numeric_expression(re.sub(token_re, term, expr))
                    return str(value)
                except (ValueError, SyntaxError, TypeError, ZeroDivisionError, OverflowError):
                    return match[0]
            for key, value in list(fields.items()):
                expanded = re.sub(r'\$\{([^}]+)\}', substitute, value)
                if expanded != value:
                    fields[key] = expanded
                    changed = True
        globals_ = {k[8:].strip(): v for fields in out.values() for k, v in fields.items() if k.startswith('@global ')}
        if not changed:
            break

@lru_cache(None)
def load_unit(path):
    path = Path(path).resolve()
    out = Ini()
    parents = [RW] + list(reversed([p for p in path.parent.parents if p != RW and RW in p.parents])) + ([path.parent] if path.parent != RW else [])
    for folder in dict.fromkeys(parents):
        template = folder / 'all-units.template'
        if template.is_file():
            merge(out, load_file(template))
    merge(out, load_file(path))
    expand(out)
    return out

def num(value, default=0):
    try:
        return float(str(value).strip())
    except (ValueError, TypeError):
        return default

def slug(name):
    base = re.sub('[^a-z0-9]+', '-', name.lower()).strip('-')
    if not base:
        base = 'unit-' + hashlib.sha256(name.encode()).hexdigest()[:10]
    if len(base) > 26:
        base = base[:17].rstrip('-') + '-' + hashlib.sha256(name.encode()).hexdigest()[:8]
    return 'naval-warfare-' + base


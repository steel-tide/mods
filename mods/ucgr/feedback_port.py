"""Copy explicitly authored UCGR feedback without evaluating RW scripts.

The extension owns its assets. Recordings retain the source decoded PCM in
portable WAV files and icons are copied byte for byte. Neither commented-out
voices nor skipped full-spectrum music are activated. Source clauses and hashes
are retained in feedback-source-data.json.
"""
from pathlib import Path
import hashlib
import json
import math
import re
import shutil
import subprocess

from rw import RW, HERE, resolve, load_unit
from PIL import Image
from weapons import source_index, seconds, helper_payload
from media import ART_SCALE, UNIT_DISPLAY_SCALE
from logistics_port import resource_values, stock_id

CAPABILITY = 'usgr-re.feedback-v1'
PACKAGE = 'extensions/combined-arms-v1'
PARTS = {'rack': ('amRa', 175, 0), 'track': ('tra', 100, -20),
         'driver': ('dri', 100, 20), 'gunner': ('gun', 100, 40),
         'engine': ('eng', 100, -40)}
ICON_DISABLE = ' and not globalSearchForFirstUnit(withTag="作弊器").tags(includes="关闭击穿显示")'


class SourceMismatch(ValueError):
    pass


class FeedbackExport:
    def __init__(self, out=HERE):
        self.out = Path(out)
        self.assets = {}
        self.asset_sources = {}
        self.records = []
        self.effect_omissions = set()
        self.audio_omissions = set()
        previous = self.out / PACKAGE / 'assets.json'
        self.previous_assets = json.loads(previous.read_text()) if previous.is_file() else {}

    def copy_asset(self, ref, entry, ini, section, key, kind):
        origin = getattr(ini, 'origins', {}).get(section, {}).get(key)
        directory = Path(origin).parent if origin else (RW / entry['source']).parent
        path = resolve(ref, directory)
        if not path:
            raise SourceMismatch(f'{entry["rwName"]} [{section}] {key}: missing original asset {ref}')
        audio = kind in ('voice', 'audio')
        if path.suffix.lower() not in (('.ogg', '.wav', '.mp3') if audio else ('.png',)):
            raise SourceMismatch(f'{entry["rwName"]} [{section}] {key}: unsupported original media')
        source = path.relative_to(RW).as_posix()
        asset = kind + '-' + hashlib.sha256(source.encode()).hexdigest()[:12]
        if asset in self.assets:
            return asset
        file = f'{PACKAGE}/assets/{asset}{".wav" if audio else path.suffix.lower()}'
        target = self.out / file
        target.parent.mkdir(parents=True, exist_ok=True)
        if audio:
            # Keep the original rate and channels. PCM WAV also decodes on the
            # older supported WebKit versions which do not support Ogg Vorbis.
            subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
                            '-i', str(path), '-map_metadata', '-1', '-fflags', '+bitexact',
                            '-flags:a', '+bitexact', '-c:a', 'pcm_s16le', str(target)], check=True)
        else:
            shutil.copyfile(path, target)
        previous = self.previous_assets.get(asset)
        if previous and previous != file and previous.startswith(f'{PACKAGE}/assets/{asset}.'):
            (self.out / previous).unlink(missing_ok=True)
        self.assets[asset] = file
        self.asset_sources[asset] = {'source': source, 'file': file,
                                     'sourceBytes': path.stat().st_size,
                                     'sourceSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                                     'bytes': target.stat().st_size,
                                     'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                                     'encoding': 'Source decoded PCM16; original sample rate and channels in WAV' if audio else 'Original PNG bytes'}
        return asset

    def voice(self, value, entry, ini, section, key, kind='voice'):
        ids, gains = [], []
        for ref in value.split(','):
            ref = ref.strip()
            if not ref:
                continue
            match = re.fullmatch(r'(.*\.(?:ogg|wav|mp3))(?::([\d.]+))?', ref, re.I)
            if not match:
                raise SourceMismatch(f'{entry["rwName"]} [{section}] {key}: unaudited voice reference {ref}')
            # RW 1.15 class_393 initializes every sound item to 0.3.
            gain = float(match[2]) if match[2] else .3
            if not 0 <= gain <= 4:
                raise SourceMismatch(f'{entry["rwName"]}: unsupported voice gain')
            ids.append(self.copy_asset(match[1], entry, ini, section, key, kind))
            gains.append(gain)
        if not ids or len(set(gains)) != 1:
            raise SourceMismatch(f'{entry["rwName"]}: voice alternatives need one authored gain')
        return {'assets': ids, 'gain': gains[0]}

    def augment(self, entry, ini, definition):
        voices, provenance = {}, []
        core = ini.get('core', {})
        for event, key in [('select', 'soundOnNewSelection'), ('move', 'soundOnMoveOrder'), ('attack', 'soundOnAttackOrder')]:
            if core.get(key):
                voices[event] = self.voice(core[key], entry, ini, 'core', key)
                provenance.append({'event': event, 'section': 'core', 'key': key, 'value': core[key]})
        for section, data in ini.items():
            if not section.startswith(('action_', 'hiddenAction_')) or not data.get('playSoundToPlayer'):
                continue
            if data.get('autoTriggerOnEvent') != 'newWaypointGivenByPlayer':
                continue
            condition = data.get('requireConditional', '').strip()
            match = re.fullmatch(r"if self\.hasActiveWaypoint\(type='(attack|MOVE)'\) and self\.resource\.play_timer <= 0", condition)
            if not match or data.get('setResourcesWithLogic') != 'play_timer=5':
                raise SourceMismatch(f'{entry["rwName"]} [{section}]: player voice gate differs from reviewed source')
            event = {'attack': 'attack', 'MOVE': 'move'}[match[1]]
            if event in voices:
                raise SourceMismatch(f'{entry["rwName"]}: multiple {event} voice mechanisms')
            voices[event] = self.voice(data['playSoundToPlayer'], entry, ini, section, 'playSoundToPlayer')
            provenance.append({'event': event, 'section': section, 'key': 'playSoundToPlayer',
                               'value': data['playSoundToPlayer'], 'requireConditional': condition,
                               'setResourcesWithLogic': data['setResourcesWithLogic']})
        result = {'voices': voices}
        if entry.get('_deployment_art'):
            result['appearance'] = entry['_deployment_art']
        projectile_art = self.projectiles(entry, ini, definition)
        if projectile_art:
            result['projectiles'] = projectile_art
        impacts = self.impact_sounds(entry, ini, definition)
        if impacts: result['impacts'] = impacts
        flashes = []
        for weapon in definition['weapons']:
            fields = ini.get(weapon.get('_source', {}).get('turret', ''), {})
            if 'shoot_flame' not in fields:
                self.effect_omissions.add((entry['rwName'], weapon.get('_source', {}).get('turret', ''), 'Source default firing effect has no packaged atlas; host muzzle art is suppressed while recoil is retained.'))
            flashes.append({'weapon': weapon['id'], 'effects': self.effects(entry, ini, fields.get('shoot_flame', ''), parent='unit')})
        if flashes: result['flashes'] = flashes
        audio = self.audio(entry, ini, definition)
        if audio:
            result['audio'] = audio
        parts = definition.get('extensions', {}).get('components-v1', {}).get('parts', [])
        cosmetics = self.cosmetics(entry, ini, definition) if all(any(p['id'] == part for p in parts) for part in PARTS) else []
        wreck = self.wreck(entry, ini, definition)
        if wreck is not None:
            result['wreck'] = wreck
        if cosmetics:
            result['cosmetics'] = cosmetics
            era = self.era(entry, ini, definition)
            if era: result['era'] = era
            low, high = ini.get('hiddenAction_exJu1', {}), ini.get('hiddenAction_exJu2', {})
            if low.get('requireConditional') == 'if self.hp<=550' and high.get('requireConditional') == 'if self.hp>550' and low.get('addResources') == 'setFlag=24':
                result['rack'] = {'threshold': 330, 'low': self.effects(entry, ini, low.get('spawnEffects', '')), 'high': self.effects(entry, ini, high.get('spawnEffects', ''))}
        definition.setdefault('extensions', {})[CAPABILITY] = result
        self.records.append({'rwName': entry['rwName'], 'id': definition['id'], 'source': entry['source'],
                             'voices': provenance, 'cosmetics': cosmetics, 'audio': audio, 'projectiles': projectile_art, 'wreck': wreck, 'era': result.get('era', []), 'impacts': impacts, 'flashes': flashes, 'rack': result.get('rack')})

    def wreck(self, entry, ini, definition):
        layers = []
        graphics = ini.get('graphics', {})
        image = graphics.get('image_wreak')
        if image and image.upper() != 'NONE':
            asset = self.copy_asset(image, entry, ini, 'graphics', 'image_wreak', 'wreck')
            layers.append({'asset': asset, 'scale': float(graphics.get('imageScale', 1)) * ART_SCALE * UNIT_DISPLAY_SCALE, 'x': 0, 'y': 0})
        for section, data in ini.items():
            if not section.startswith('decal_') or data.get('onlyWhileAlive') != 'false' or data.get('isVisible') != 'if self.hp==0':
                continue
            if data.get('basePositionFromTurret') or data.get('layer', '').lower() != 'afterbody':
                continue
            if any(not re.fullmatch(r'[+-]?[\d.]+', data[k]) for k in ['imageScale', 'xOffsetRelative', 'yOffsetRelative'] if k in data):
                continue
            asset = self.copy_asset(data['image'], entry, ini, section, 'image', 'wreck')
            layers.append({'asset': asset, 'scale': float(data.get('imageScale', 1)) * ART_SCALE * UNIT_DISPLAY_SCALE,
                           'x': float(data.get('xOffsetRelative', 0)) * ART_SCALE * UNIT_DISPLAY_SCALE,
                           'y': -float(data.get('yOffsetRelative', 0)) * ART_SCALE * UNIT_DISPLAY_SCALE})
        return layers if image is not None or layers else None

    def fragment_sources(self, entry, ini, weapon):
        """Resolve only child branches whose actual fragment lifecycle is active."""
        payload = weapon.get('extensions', {}).get('components-v1', {})
        helper = weapon.get('_source', {}).get('helper', {})
        if payload.get('fragments') and helper.get('source'):
            target = {**entry, 'source': helper['source']}
            yield -1, target, load_unit(RW / helper['source']), payload['fragments']
        spawned = payload.get('spawned', [])
        if not spawned: return
        projectile = ini.get(weapon.get('_source', {}).get('projectile', ''), {})
        index = 0
        for raw in re.split(r',\s*(?![^()]*\))', projectile.get('spawnUnit', '')):
            match = re.fullmatch(r'\s*([^()*]+)(?:\*([1-9]\d*))?(?:\(([^()]*)\))?\s*', raw)
            if not match: raise SourceMismatch('Compiled fragment helper source changed')
            target = source_index()[match[1].strip()]
            target_ini = load_unit(RW / target['source'])
            for _ in range(int(match[2] or 1)):
                if index >= len(spawned): raise SourceMismatch('Compiled fragment branch order changed')
                fragments = spawned[index]['payload'].get('fragments')
                if fragments: yield index, target, target_ini, fragments
                index += 1
        if index != len(spawned): raise SourceMismatch('Compiled fragment branch count changed')

    def projectiles(self, entry, ini, definition):
        result = []
        for weapon in definition['weapons']:
            source = weapon.get('_source', {})
            missile = source.get('attachedMissile')
            target_entry, target_ini = entry, ini
            if missile and missile in source_index():
                target_entry = source_index()[missile]
                target_ini = load_unit(RW / target_entry['source'])
                section, fields = 'graphics', target_ini.get('graphics', {})
            else:
                section = source.get('projectile', '')
                if not section.startswith('projectile_'): section = 'projectile_' + section
                fields = ini.get(section, {})
            image = fields.get('image', '')
            # Blank control rounds are genuinely invisible in RW.
            if fields.get('invisible', '').lower() == 'true':
                result.append({'weapon': weapon['id'], 'hidden': True})
                continue
            if not image or image.upper() in ('NONE', 'AUTO'):
                self.effect_omissions.add((entry['rwName'], section, 'Original built-in projectile image is not packaged; host projectile art is suppressed.'))
                result.append({'weapon': weapon['id'], 'hidden': True})
                continue
            try:
                asset = self.copy_asset(image, target_entry, target_ini, section, 'image', 'projectile')
            except SourceMismatch:
                self.effect_omissions.add((entry['rwName'], section, 'Original projectile image could not be exported; host projectile art is suppressed.'))
                result.append({'weapon': weapon['id'], 'hidden': True})
                continue
            path = self.out / self.assets[asset]
            with Image.open(path) as picture: width, height = picture.size
            if float(fields.get('total_frames', 1)) != 1:
                self.effect_omissions.add((entry['rwName'], section, 'Original animated projectile image needs its source animation clock; host projectile art is suppressed.'))
                result.append({'weapon': weapon['id'], 'hidden': True})
                continue
            if missile:
                scale = float(fields.get('imageScale', 1))
                if 'scaleImagesTo' in fields: scale *= float(fields['scaleImagesTo']) / width
            else:
                scale = float(fields.get('drawSize', 1))
            result.append({'weapon': weapon['id'], 'asset': asset, 'scale': scale * ART_SCALE * UNIT_DISPLAY_SCALE})
        for weapon in definition['weapons']:
            for branch, target, helper, fragments in self.fragment_sources(entry, ini, weapon):
                for index, _ in enumerate(fragments['rounds']):
                    section = ['projectile_碎片', 'projectile_碎片1', 'projectile_rico'][index]
                    fields = helper.get(section, {})
                    if not fields.get('image') or fields.get('invisible', '').lower() == 'true':
                        picture = {'hidden': True}
                    else:
                        asset = self.copy_asset(fields['image'], target, helper, section, 'image', 'projectile')
                        picture = {'asset': asset, 'scale': float(fields.get('drawSize', 1)) * ART_SCALE * UNIT_DISPLAY_SCALE}
                    result.append({'weapon': weapon['id'], 'variant': {'kind': 'fragment', 'index': index, 'branch': branch}, **picture})
        return result

    def effect_picture(self, entry, ini, section, parent='impact'):
        f = ini.get(section, {})
        if not f.get('image') or f.get('color', '#FFFFFFFF').upper() not in ('#FFFFFFFF', '#FFFFFF'):
            if f.get('image') or f.get('stripIndex'): self.effect_omissions.add((entry['rwName'], section, 'Original built-in atlas or color multiplication semantics need source-equivalent rendering.'))
            return None
        if f.get('shadow', 'false').lower() == 'true' or f.get('imageShadow'):
            self.effect_omissions.add((entry['rwName'], section, 'Source projected image shadow is not simulated.'))
            return None
        try:
            changing_pose = any(float(f.get(k, 0)) != 0 for k in ['delayedStartTimer', 'pivotOffset'])
        except ValueError:
            changing_pose = True
        if any(k in f for k in ['alsoEmitEffectsOnDeath', 'animateFrameSpeedRandom', 'lifeRandom', 'frameIndexRandom', 'dirSpeedRandom', 'delayedStartTimerRandom', 'pivotOffsetRandom']) or f.get('animateFramePingPong') == 'true' or changing_pose:
            self.effect_omissions.add((entry['rwName'], section, 'Conditional or randomized transform/effect termination is not compiled.'))
            return None
        # class_429 defaults liveAfterAttachedDies=true; impact parents stop
        # at their hit point. A live firing parent requires actual translation.
        if f.get('attachedToUnit', 'true') == 'true' and (parent == 'unit' or f.get('liveAfterAttachedDies', 'true') == 'false'):
            self.effect_omissions.add((entry['rwName'], section, 'Effect needs live-parent translation or explicitly dies with its parent.'))
            return None
        # Impact effects lose their projectile parent on this same tick. Only
        # effects explicitly surviving it may keep their original image.
        try:
            numeric = {key: float(f.get(key, default)) for key, default in {
                'life': 200, 'total_frames': 1, 'frameIndex': 0, 'animateFrameStart': f.get('frameIndex', 0),
                'animateFrameEnd': f.get('frameIndex', 0), 'animateFrameSpeed': 0, 'scaleFrom': 1, 'scaleTo': 1,
                'alpha': 1, 'fadeInTime': 0, 'xOffsetAbsolute': 0, 'yOffsetAbsolute': 0, 'xOffsetRelative': 0, 'yOffsetRelative': 0,
                'xSpeedAbsolute': 0, 'ySpeedAbsolute': 0, 'xSpeedRelative': 0, 'ySpeedRelative': 0, 'hOffset': 0, 'hSpeed': 0, 'dirOffset': 0, 'dirSpeed': 0, 'physicsGravity': 1}.items()}
        except ValueError:
            return None
        if not all(math.isfinite(value) for value in numeric.values()): return None
        life = numeric['life'] / 60
        fps = numeric['animateFrameSpeed'] * 60
        looping = f.get('animateFrameLooping', 'false') == 'true'
        duration = min(life, (numeric['animateFrameEnd'] - numeric['animateFrameStart'] + 1) / fps) if fps > 0 and not looping else life
        random = {}
        visual_scale, velocity_scale = ART_SCALE * UNIT_DISPLAY_SCALE, 60 * ART_SCALE
        for source, key, scale in [('xOffsetAbsoluteRandom', 'x', visual_scale), ('yOffsetAbsoluteRandom', 'y', visual_scale),
                                   ('xOffsetRelativeRandom', 'lateral', visual_scale), ('yOffsetRelativeRandom', 'forward', visual_scale),
                                   ('hOffsetRandom', 'height', ART_SCALE), ('xSpeedAbsoluteRandom', 'vx', velocity_scale), ('ySpeedAbsoluteRandom', 'vy', velocity_scale),
                                   ('xSpeedRelativeRandom', 'speedLateral', velocity_scale), ('ySpeedRelativeRandom', 'speedForward', velocity_scale),
                                   ('hSpeedRandom', 'heightVelocity', velocity_scale), ('dirOffsetRandom', 'dir', math.pi / 180)]:
            if source not in f: continue
            try: value = abs(float(f[source])) * scale
            except ValueError: value = math.nan
            if not math.isfinite(value):
                self.effect_omissions.add((entry['rwName'], section, 'Effect random ranges require literal finite source values.'))
                return None
            random[key] = value
        dynamic = f.get('atmospheric') == 'true' or f.get('physics') == 'true' or f.get('showInFog') == 'true' or numeric['dirSpeed'] != 0
        asset = self.copy_asset(f['image'], entry, ini, section, 'image', 'effect')
        return {'asset': asset, 'life': life, 'duration': duration, 'frames': int(numeric['total_frames']),
                'first': int(numeric['animateFrameStart']), 'last': int(numeric['animateFrameEnd']), 'fps': numeric['animateFrameSpeed'] * 60,
                'loop': looping, 'fade': f.get('fadeOut', 'true') == 'true', 'fadeIn': numeric['fadeInTime'] / 60,
                'scaleFrom': numeric['scaleFrom'] * ART_SCALE * UNIT_DISPLAY_SCALE, 'scaleTo': numeric['scaleTo'] * ART_SCALE * UNIT_DISPLAY_SCALE, 'alpha': numeric['alpha'],
                'x': numeric['xOffsetAbsolute'] * ART_SCALE * UNIT_DISPLAY_SCALE, 'y': numeric['yOffsetAbsolute'] * ART_SCALE * UNIT_DISPLAY_SCALE - (0 if dynamic else numeric['hOffset'] * ART_SCALE),
                'forward': numeric['yOffsetRelative'] * ART_SCALE * UNIT_DISPLAY_SCALE, 'lateral': numeric['xOffsetRelative'] * ART_SCALE * UNIT_DISPLAY_SCALE,
                'vx': numeric['xSpeedAbsolute'] * 60 * ART_SCALE, 'vy': (numeric['ySpeedAbsolute'] - (0 if dynamic else numeric['hSpeed'])) * 60 * ART_SCALE,
                'speedForward': numeric['ySpeedRelative'] * 60 * ART_SCALE, 'speedLateral': numeric['xSpeedRelative'] * 60 * ART_SCALE,
                'dir': numeric['dirOffset'] * 3.141592653589793 / 180,
                'zero': f.get('alwayStartDirAtZero', f.get('alwaysStartDirAtZero', 'false')) == 'true',
                'under': f.get('drawUnderUnits', 'false') == 'true',
                **({'height': numeric['hOffset'] * ART_SCALE, 'heightVelocity': numeric['hSpeed'] * velocity_scale,
                    'spin': numeric['dirSpeed'] * math.pi / 180 * 60, 'atmospheric': f.get('atmospheric') == 'true',
                    'physics': f.get('physics') == 'true', 'gravity': numeric['physicsGravity'], 'showInFog': f.get('showInFog') == 'true'} if dynamic else {}),
                **({'random': random} if random else {})}

    def effects(self, entry, ini, value, seen=(), parent='impact'):
        nodes = []
        for item in value.split(','):
            match = re.fullmatch(r'(?:CUSTOM:)?([^,*]+)(?:\*(\d+))?', item.strip(), re.I)
            if not match: continue
            section = 'effect_' + match[1]
            if section in seen or len(seen) > 4: continue
            fields = ini.get(section, {})
            if not fields:
                if match[1].strip().upper() != 'NONE':
                    self.effect_omissions.add((entry['rwName'], section, 'Original built-in effect atlas is not packaged; effect omitted without a native substitute.'))
                continue
            # RW ignores alsoEmitEffects on children created by alsoEmitEffects.
            children = self.effects(entry, ini, fields.get('alsoEmitEffects', ''), (*seen, section), parent=parent) if not seen else []
            cue = self.voice(fields['alsoPlaySound'], entry, ini, section, 'alsoPlaySound', 'audio') if fields.get('alsoPlaySound') else None
            picture = self.effect_picture(entry, ini, section, parent)
            if not cue and not children and not picture: continue
            node = {'chance': float(fields.get('spawnChance', 1)),
                    'land': fields.get('createWhenOverLand', 'true') == 'true',
                    'water': fields.get('createWhenOverLiquid', 'true') == 'true'}
            if cue: node['cue'] = cue
            if picture: node['picture'] = picture
            if children: node['children'] = children
            nodes.extend([node] * min(64, int(match[2] or 1)))
        return nodes

    def impact_sounds(self, entry, ini, definition):
        result = []
        for weapon in definition['weapons']:
            source = weapon.get('_source', {})
            projectile = ini.get(source.get('projectile', ''), {})
            target_entry, target_ini = entry, ini
            helper = source.get('helper', {})
            spawned = weapon.get('extensions', {}).get('components-v1', {}).get('spawned')
            if not spawned and helper.get('source') and helper.get('projectile'):
                target_entry = {**entry, 'source': helper['source']}
                target_ini = load_unit(RW / helper['source'])
                projectile = target_ini.get(helper['projectile'], {})
            if 'explodeEffect' not in projectile:
                self.effect_omissions.add((entry['rwName'], helper.get('projectile', source.get('projectile', '')), 'Original built-in impact appearance is not packaged; native burst, mark and impact recording are suppressed.'))
            nodes = self.effects(target_entry, target_ini, projectile.get('explodeEffect', ''))
            # An explicit source effect list also includes NONE. Unsupported
            # source effects stay absent instead of acquiring a host-class burst.
            weapon['look'] = {**weapon.get('look', {}), 'impact': 'none'}
            result.append({'weapon': weapon['id'], 'effects': nodes})
            if spawned:
                # The component compiler already accepted this entire constant
                # spawn list. Keep exactly its expanded order for transient probes.
                children = []
                for raw in re.split(r',\s*(?![^()]*\))', projectile.get('spawnUnit', '')):
                    match = re.fullmatch(r'\s*([^()*]+)(?:\*([1-9]\d*))?(?:\(([^()]*)\))?\s*', raw)
                    if not match or match[1].strip() not in source_index():
                        raise SourceMismatch(f'{entry["rwName"]}: compiled child helper has no original source')
                    child_entry = source_index()[match[1].strip()]
                    child_ini = load_unit(RW / child_entry['source'])
                    child = helper_payload(child_ini)
                    if not child:
                        raise SourceMismatch(f'{entry["rwName"]}: compiled child helper has no original projectile')
                    effects = self.effects(child_entry, child_ini, child[1].get('explodeEffect', ''))
                    children.extend([effects] * int(match[2] or 1))
                if len(children) != len(spawned):
                    raise SourceMismatch(f'{entry["rwName"]}: child impact media and combat spawn order differ')
                result.extend({'weapon': weapon['id'], 'variant': {'kind': 'helper', 'index': index}, 'effects': effects}
                              for index, effects in enumerate(children))
        for weapon in definition['weapons']:
            for branch, target, helper, fragments in self.fragment_sources(entry, ini, weapon):
                for index, _ in enumerate(fragments['rounds']):
                    section = ['projectile_碎片', 'projectile_碎片1', 'projectile_rico'][index]
                    result.append({'weapon': weapon['id'], 'variant': {'kind': 'fragment', 'index': index, 'branch': branch},
                                   'effects': self.effects(target, helper, helper[section].get('explodeEffect', ''))})
        return result

    def audio(self, entry, ini, definition):
        result = {}
        core = ini.get('core', {})
        if core.get('soundOnDeath'):
            result['death'] = self.voice(core['soundOnDeath'], entry, ini, 'core', 'soundOnDeath', 'audio')
        periodic, reloads = [], []
        stocks = {stock['id']: stock for stock in definition.get('extensions', {}).get('logistics-v1', {}).get('stocks', [])}
        for section, data in ini.items():
            if not section.startswith(('action_', 'hiddenAction_')) or not data.get('playSoundAtUnit'):
                continue
            # RW polls this authored gate every .1 s; only one poll occurs in
            # the .1-second window every two seconds. Preserve one-shots rather
            # than turning the source recording into an invented engine loop.
            if data.get('autoTrigger') == 'if int(self.timeAlive/0.1)%20==0':
                periodic.append({'interval': 2, 'cue': self.voice(data['playSoundAtUnit'], entry, ini, section, 'playSoundAtUnit', 'audio')})
            else:
                additions = resource_values(data.get('addResources')) or {}
                for resource, capacity in additions.items():
                    sid = stock_id(resource)
                    if sid not in stocks or capacity != stocks[sid]['capacity'] or not stocks[sid].get('refillAfter'):
                        continue
                    cue = self.voice(data['playSoundAtUnit'], entry, ini, section, 'playSoundAtUnit', 'audio')
                    if not any(item['stock'] == sid for item in reloads):
                        reloads.append({'stock': sid, 'cue': cue})
        shots = []
        for weapon in definition['weapons']:
            section = weapon.get('_source', {}).get('turret', '')
            data = ini.get(section, {})
            value = data.get('shoot_sound', '').strip()
            missile = weapon.get('_source', {}).get('attachedMissile')
            if missile and missile in source_index() and weapon.get('extensions', {}).get('sensors-v1', {}).get('sourceFlight'):
                helper_entry = source_index()[missile]
                helper = load_unit(RW / helper_entry['source'])
                release = helper.get('hiddenAction_脱离', {})
                queued = release.get('alsoQueueAction', '')
                lock = helper.get('hiddenAction_' + queued, {})
                if release.get('autoTriggerOnEvent') == 'newMessage(withTag="发射")' and lock.get('playSoundAtUnit') and lock.get('buildSpeed'):
                    delay = seconds(lock['buildSpeed'])
                    if .001 <= delay <= 60:
                        shots.append({'weapon': weapon['id'], 'atProjectile': True, 'delay': delay,
                                      'cue': self.voice(lock['playSoundAtUnit'], helper_entry, helper, 'hiddenAction_' + queued, 'playSoundAtUnit', 'audio')})
                        continue
            if not value or value.upper() == 'NONE': continue
            try:
                cue = self.voice(value, entry, ini, section, 'shoot_sound', 'audio')
                # class_397 calls class_392.a(volume): replaces every item gain.
                if 'shoot_sound_vol' in data: cue['gain'] = float(data['shoot_sound_vol'])
            except (ValueError, SourceMismatch):
                continue
            if not 0 <= cue['gain'] <= 4:
                self.audio_omissions.add((entry['rwName'], section, f'Original firing gain {cue["gain"]:g} exceeds the recorded-audio API range 0..4; cue omitted without clamping or replacement.'))
                continue
            shots.append({'weapon': weapon['id'], 'cue': cue})
        if shots: result['shots'] = shots
        if periodic: result['periodic'] = periodic
        if reloads: result['reloads'] = reloads
        return result

    def era(self, entry, ini, definition):
        result = []
        layers = definition['extensions']['components-v1'].get('protection', {}).get('layers', {}).get('chemical', {})
        for face, source_name, memory in [('front', '正', 'frontAEH'), ('side', '侧', 'sideAEH'), ('rear', '后', 'backAEH')]:
            maximum = layers.get(face, 0)
            if maximum <= 0: continue
            section = 'decal_显示装甲状态-' + source_name
            data = ini.get(section, {})
            # Only the source allied-selection armor bars, never hidden armor.
            expected = {'total_frames': '4', 'alpha': '0.45', 'layer': 'beforeBody', 'onlyInPreview': 'false',
                        'alwaysStartDirAtZero': 'true', 'alwaysStartHeightAtZero': 'true', 'includeParentsSelection': 'false',
                        'onlyWhenSelectedByAnyPlayer': 'true', 'onlyTeam': 'ally', 'onlyWhileAlive': 'true'}
            if any(data.get(k) != value for k, value in expected.items()):
                raise SourceMismatch(f'{entry["rwName"]} [{section}]: armor bar visibility differs from source')
            numbers = re.findall(r'memory\.' + memory + r'(?:==|>=)([\d.]+)', data.get('frame', ''))
            if len(numbers) != 3 or [float(v) for v in numbers] != [maximum, maximum * .75, maximum * .4]:
                raise SourceMismatch(f'{entry["rwName"]} [{section}]: armor frame thresholds differ from source')
            result.append({'face': face, 'maximum': maximum, 'asset': self.copy_asset(data['image'], entry, ini, section, 'image', 'armor'),
                           'x': float(data.get('xOffsetAbsolute', 0)) * ART_SCALE * UNIT_DISPLAY_SCALE,
                           'y': float(data.get('yOffsetAbsolute', 0)) * ART_SCALE * UNIT_DISPLAY_SCALE,
                           'scaleX': float(data.get('imageScaleX', data.get('imageScale', 1))) * ART_SCALE * UNIT_DISPLAY_SCALE,
                           'scaleY': float(data.get('imageScaleY', data.get('imageScale', 1))) * ART_SCALE * UNIT_DISPLAY_SCALE,
                           'alpha': float(data['alpha'])})
        return result

    def cosmetics(self, entry, ini, definition):
        parts = {p['id']: p for p in definition.get('extensions', {}).get('components-v1', {}).get('parts', [])}
        if not all(part in parts for part in PARTS):
            raise SourceMismatch('T90M feedback requires the audited component model')
        result = []
        for part, (memory, _, x) in PARTS.items():
            hp = parts[part]['hp']
            hp = int(hp) if hp == int(hp) else hp
            if parts[part]['damagedAt'] != .65:
                raise SourceMismatch(f'T90M {part}: source component thresholds changed')
            item = {'part': part}
            maximum = f'{hp}+memory.空弹药架' if part == 'rack' else str(hp)
            for index, field in [(1, 'damaged'), (2, 'destroyed')]:
                section = f'decal_{memory}DiYe_{index}'
                data = ini.get(section, {})
                condition = (f'if memory.{memory}>=0.65*{hp} and memory.{memory}<={maximum}'
                             if index == 1 else f'if memory.{memory}>={maximum}') + ICON_DISABLE
                expected = {'onlyWhileActive': 'true', 'onlyWhileAlive': 'true',
                            'onlyOnNonPreview': 'true', 'onlyTeam': 'any', 'alwaysStartDirAtZero': 'true',
                            'xOffsetAbsolute': str(x), 'yOffsetAbsolute': '40',
                            'layer': 'beforeUI', 'isVisible': condition, 'imageScale': '0.4'}
                if any(data.get(k) != v for k, v in expected.items()) or any(
                        k in data for k in ['onlyWhenSelectedByAnyPlayer', 'onlyWhenSelectedByOwnPlayer']):
                    raise SourceMismatch(f'T90M [{section}]: public damage icon differs from reviewed source')
                item[field] = self.copy_asset(data['image'], entry, ini, section, 'image', 'icon')
            # Absolute offsets use fixed world axes; beforeUI is drawing order,
            # not a screen-space size. Include the same scale as the unit art.
            world_scale = ART_SCALE * UNIT_DISPLAY_SCALE
            item.update(x=x * world_scale, y=40 * world_scale, scale=.4 * world_scale)
            result.append(item)
        return result

    def finish(self):
        report = {'source': 'UCGR-RE v4.3 巨浪 v1.29.6 信息战 20261004',
                  'policy': 'Only active explicit source feedback; voice recordings retain original decoded PCM16, sample rate and channels in portable WAV files; PNGs retain original bytes. Empty voice objects suppress fabricated native crew replies.',
                  'capability': CAPABILITY, 'assets': self.asset_sources, 'units': self.records,
                  'remainingEffectClauses': [{'rwName': name, 'section': section, 'reason': reason} for name, section, reason in sorted(self.effect_omissions)],
                  'remainingAudioClauses': [{'rwName': name, 'section': section, 'reason': reason} for name, section, reason in sorted(self.audio_omissions)],
                  'orderCooldown': {'seconds': 5, 'scope': 'local player, shared between move and attack',
                    'source': '中立及通用单位/玩家计时器.ini',
                    'omission': 'The source timer starts after the authored sixty-second opening. M5 opening rules are skipped; the five-second local presentation cooldown applies from match start.'},
                  'cosmeticVisibility': 'Public icon states only for visible active living entities; never reveal raw component damage, ammunition, hidden entities, or unseen changes.',
                  'cosmeticGeometry': {'sourceSpace': 'world axes at the unit position; alwaysStartDirAtZero and absolute offsets do not rotate with the unit; beforeUI is drawing order',
                    'artScale': ART_SCALE, 'unitDisplayScale': UNIT_DISPLAY_SCALE,
                    'worldScale': ART_SCALE * UNIT_DISPLAY_SCALE,
                    'sourceY': 40, 'worldY': 25, 'sourceImageScale': .4, 'worldImageScale': .25},
                  'cosmeticPredicates': {'common': 'warning: damage >= hp*0.65 and damage <= hp; danger: damage >= hp. Danger draws on top at equality.',
                    'rack': 'warning: damage >=175*0.65 and damage <=175+missingRounds*(175/48); danger: damage >=175+missingRounds*(175/48). This is >= even though terminal component failure is strict >.',
                    'source': 'tem/tank.key:921-1061',
                    'omission': 'The source global 关闭击穿显示 cheat/display toggle is not recreated.'},
                  'music': {'status': 'deferred with skipped M5', 'source': '中立及通用单位/音乐播放器.ini',
                    'gates': ['全频带阻塞干扰 + 中国', '全频带阻塞干扰 + 北约'],
                    'reason': 'These tracks belong to the authored full-spectrum mode, not the national Conquest factions.'},
                  'rosterExpansion': {'status': 'deferred after source audit; no unsupported unit re-enabled',
                    'candidates': [
                      {'rwNames': ['PLA迷彩79狙', '人民军_78狙', '韩军_K3班机', '韩军精确射手K2'], 'blocker': 'Queued creation reload and idle partial-magazine reload are not represented by the current audited constant empty-magazine converter.'},
                      {'rwNames': ['RUSRE', 'USMARSOC'], 'blocker': 'Selectable alternate weapon loadouts are defining source behavior and remain unconverted.'},
                    ]}}
        (self.out / 'feedback-source-data.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        (self.out / PACKAGE / 'assets.json').write_text(json.dumps(self.assets, ensure_ascii=False, indent=2) + '\n')
        return report

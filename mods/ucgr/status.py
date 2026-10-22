#!/usr/bin/env python3
"""Regenerate actual pack coverage separately from the wider source/compiler audit."""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent

def read(name):
    return json.loads((HERE/name).read_text())


def remaining():
    """Verified dispositions of the non-M5 work, 2026-10-19 (see LEDGER.md)."""
    return [
        {'id':'roster-and-forms', 'status':'complete-for-reachable', 'scope':'Every candidate reached through a national spawn-point deck is recruited, or excluded with its source reason in roster-expansion.json (unreachable easter eggs, air-combat mode, capture points/FOBs, platoon preload flags, trench attachments, paid SUP launches). TOS-1A deploy forms and barrage are implemented.', 'evidence':['roster-expansion.json','artillery-game.test.ts']},
        {'id':'smoke', 'status':'implemented', 'scope':'Deploy Smoke and Engine Smoke actions, gates, shared/self cooldowns, smokeG 5 s markers with ATGM interception, life-999 flight variant, cloud and sounds.', 'evidence':['smoke_port.py','smoke-game.test.ts']},
        {'id':'dynamic-los', 'status':'remaining', 'scope':'Source DynamicLoS (tem/tank.key) target-switch nudges for idle units and its LoS line decal; forest markers from 林区.ini are map content under review against M5. Firing is not gated by it in any recruited unit.'},
        {'id':'aircraft-strike-and-service', 'status':'remaining', 'scope':'Strike-target/route/landing workflows for sandbox and purchased bomb/missile loadouts (Q-5L, JH-7A, Su-25T, Su-34, F-1, Tornado, Rafale, JAS 39E, F-15E). Ground-attack stores stay omitted; air-to-air and cannon armament are live. Paid rearm requires M5 currencies.'},
        {'id':'squads-and-towing', 'status':'partial', 'scope':'Squads, trench forms, HJ-8 team and BREM/96 recovery implemented and tested; full source search/retry/neutral behaviour and amphibious towing edge cases unaudited.'},
        {'id':'source-kinematics', 'status':'partial', 'scope':'Fixed-wing controls and FPV sliding movement are source-exact; ordinary ground acceleration, reverse, formation and collision remain native.', 'evidence':['MOVEMENT-PARITY.md']},
        {'id':'art-and-audio', 'status':'partial', 'scope':'Unported conditional art, artillery warning markers, the T-90M Arena-M global announcement, the flying smoke-round sprite and BMP-2M firing cue (gain 5 exceeds the host 0..4 range).', 'evidence':['APPEARANCE-PARITY.md','M6-FEEDBACK-SOURCE-AUDIT.md']},
        {'id':'localization', 'status':'complete', 'scope':'English/Chinese/Korean for every exposed unit, action, stock, deployment and status label; untranslated source resource names now fail the build.'},
    ]


def main():
    manifest, selection, roster = read('mod.json'), read('mvp-roster.json'), read('roster.json')
    selected = set(sum(selection['nations'].values(), []) + selection['shared'])
    candidates = [e for e in roster['entries'] if e['status'] == 'candidate']
    capabilities = {cap: [d['id'] for d in manifest['defs'] if cap in d.get('extensions', {}) or
                          any(cap in w.get('extensions', {}) for w in d['weapons'])]
                    for cap in manifest['requiredCapabilities']}
    result = {
        'source': roster['source'], 'version': manifest['version'],
        'status': 'in-progress; non-M5 source parity is not complete',
        'engineChanges': False, 'branch': 'main', 'pushed': False,
        'hostApi': manifest['extensionPackages'][0]['api'],
        'summary': {'candidateDefinitions': len(candidates), 'selectedCombatUnits': len(selected),
                    'manifestDefinitions': len(manifest['defs']), 'spriteSheets': len(manifest['sprites']),
                    'ordinarySounds': len(manifest['sounds']),
                    'extensionAssets': len(manifest['extensionPackages'][0].get('assets', {})),
                    'nationalRosters': {k: len(v) for k,v in selection['nations'].items()},
                    'boundDefinitions': {cap:len(ids) for cap,ids in capabilities.items()}},
        'capabilityCoverage': capabilities,
        'remainingNonM5': remaining(),
        'excludedM5': ['source match/deck mode, SUP/SPP, phases, platoon call-ins, score victory',
                       '5v5 TMX scenarios and matching full-spectrum soundtrack',
                       'paid loadout/service purchases remain disabled where they require those currencies'],
        'unselectedCandidates': [{'rwName': e['rwName'], 'source': e['source'], 'category': e['category']}
                                for e in candidates if e['rwName'] not in selected],
        'verification': 'See source tests, actual manifest engine tests, browser-verification.json and verification.json. Coverage is not evidence of side-by-side equivalence with RW.'
    }
    (HERE/'non-m5-status.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(result['summary'], ensure_ascii=False))

if __name__ == '__main__': main()

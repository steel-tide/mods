"""Compile non-economic, literal kill-threshold achievements and their form reward."""
import hashlib
import re
from weapons import source_index

LABELS = {
    'T90M Mod.2025': ['T90M Mod.2025', 'T90M Mod.2025', 'T90M 2025년형'],
}
# Other achievement tags feed the omitted M5 spawn-point/reinforcement system.
# Even T72A's single Soviet Steel tag is consumed by 出生点俄 to spawn T72AV.

def source_achievements(ini):
    result=[]
    for section,a in ini.items():
        if not section.startswith('hiddenAction_') or 'addGlobalTeamTags' not in a or a.get('addResources'):
            continue
        tag=a['addGlobalTeamTags']
        if tag not in LABELS or a.get('temporarilyAddTags')!=tag:
            continue
        suffix=' and not self.tags(includes="'+tag+'") and not self.globalTeamTags(includes="'+tag+'")'
        trigger=a.get('autoTrigger','')
        if not trigger.endswith(suffix):continue
        match=re.fullmatch(r'if self\.(resource\.killstA|resource\.killst|kills)>=([\d.]+)',trigger[:-len(suffix)])
        if not match:continue
        if any(k not in {'convertTo','text','showMessageToAllPlayers','showQuickWarLogToPlayer','temporarilyAddTags','addGlobalTeamTags','autoTrigger'} and not k.startswith('@') for k in a):continue
        out={'id':'achievement-'+hashlib.sha1(tag.encode()).hexdigest()[:10],'label':LABELS[tag],
             'counter':{'resource.killst':'armor','resource.killstA':'air','kills':'kills'}[match[1]],'threshold':float(match[2])}
        if a.get('convertTo'):
            entry=source_index().get(a['convertTo'])
            if not entry:continue
            out['to']=entry['id']
        result.append(out)
    return result

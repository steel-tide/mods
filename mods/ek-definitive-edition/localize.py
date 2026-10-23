#!/usr/bin/env python3
"""Cache missing UI translations; normal port builds are entirely offline.
--refresh translates the supplied public mod's English text via Google Translate.
Existing translations and all upstream English/Chinese strings are preserved.
"""
from pathlib import Path
import concurrent.futures
import json
import re
import sys
import time
import urllib.parse
import urllib.request

HERE=Path(__file__).resolve().parent
LANG='zh-CN' if '--zh' in sys.argv else 'ko'

def collect():
    data=json.loads((HERE/'mod.json').read_text())
    values=set()
    def walk(value):
        if isinstance(value,list):
            if len(value)==3 and all(isinstance(v,str) for v in value):
                if value[0].strip() and (LANG=='ko' or value[1]==value[0]):values.add(value[0])
            else:
                for v in value:walk(v)
        elif isinstance(value,dict):
            if 'en' in value and isinstance(value['en'],str):
                if LANG=='ko' or value.get('zh')==value['en']:values.add(value['en'])
            else:
                for v in value.values():walk(v)
    # Only definition/UI text; internal arrays (tags, targets, package code)
    # are not localization material.
    walk(data['description'])
    for d in data['defs']:
        walk(d['name']);walk(d['desc'])
        for a in d['extensions']['ek-definitive-edition.systems-v1']['actions']:
            walk(a['name']);walk(a.get('desc',[]))
    return sorted(values)

def translate(text):
    url='https://translate.googleapis.com/translate_a/single?'+urllib.parse.urlencode({'client':'gtx','sl':'auto','tl':LANG,'dt':'t','q':text})
    for attempt in range(4):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
            with urllib.request.urlopen(req,timeout=35) as response:data=json.load(response)
            return ''.join(piece[0] or '' for piece in data[0]).strip()
        except Exception:
            if attempt==3:raise
            time.sleep(2*(attempt+1))

if __name__=='__main__':
    path=HERE/('localization-zh.json' if LANG=='zh-CN' else 'localization.json');cache=json.loads(path.read_text()) if path.exists() else {}
    missing=[v for v in collect() if v not in cache]
    print(f'{len(missing)} missing {LANG} strings',flush=True)
    if '--refresh' not in sys.argv:sys.exit(bool(missing))
    groups=[];group=[];size=0
    for text in missing:
        if size+len(text)>2600 and group:groups.append(group);group=[];size=0
        group.append(text);size+=len(text)+20
    if group:groups.append(group)
    def batch(group):
        raw='\n'.join(f'[[[EK{i:04d}]]]\n{text}' for i,text in enumerate(group))
        result=translate(raw)
        parts=re.split(r'\[\[\[\s*EK\s*(\d{4})\s*\]\]\]',result,flags=re.I)
        found={int(parts[i]):parts[i+1].strip() for i in range(1,len(parts)-1,2)}
        if len(found)==len(group) and all(found.get(i) for i in range(len(group))):return dict(zip(group,[found[i] for i in range(len(group))]))
        return {text:translate(text) for text in group}
    errors=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        futures=[pool.submit(batch,group) for group in groups]
        for index,future in enumerate(concurrent.futures.as_completed(futures)):
            try:cache.update(future.result())
            except Exception as error:errors.append(str(error))
            path.write_text(json.dumps(cache,ensure_ascii=False,indent=2,sort_keys=True)+'\n')
            print(f'{index+1}/{len(groups)} batches; {len(cache)} cached; {len(errors)} failed',flush=True)
    if errors:raise SystemExit('\n'.join(errors))

#!/usr/bin/env python3
"""An original two-seat naval review map; not a converted RW scenario."""
import base64
import json
from pathlib import Path
HERE=Path(__file__).resolve().parent
W,H=128,128

def rle(values):
    encoded=bytearray();i=0
    while i<len(values):
        n=1
        while i+n<len(values) and values[i+n]==values[i] and n<255:n+=1
        encoded.extend((n,values[i]));i+=n
    return base64.b64encode(encoded).decode()

def build():
    terrain=[1]*(W*H)
    for y in range(H):
        for x in range(W):
            if x<25 or x>102:terrain[y*W+x]=3
            if x in (24,25,102,103):terrain[y*W+x]=2
            if y%16 in (0,1) and (x<22 or x>105):terrain[y*W+x]=6
    source=json.loads((HERE/'source-inventory.json').read_text())
    ids={e['rwName']:e['id'] for e in source}
    units=[]
    def put(name,owner,x,y):units.append({'id':ids[name],'owner':owner,'x':x,'y':y,'a':0 if owner==0 else 180})
    for name,x,y in [('DDG-105',43,40),('CG-72',54,48),('CVN-74',43,65),('USS America',57,73),('Los Angeles Class sub',33,84)]:put(name,0,x,y)
    for name,x,y in [('Admiral_Nakhimov',81,40),('Project 1164',75,56),('Admiral Kuznetsov Aircraft Carrier',88,74),('Borei',96,93)]:put(name,1,x,y)
    for name,x,y in [('MBT1',17,39),('MBT2',17,43),('m270mlrs',17,47),('F-18',30,53),('F-35C',35,50)]:put(name,0,x,y)
    for name,x,y in [('T-90M',110,43),('BMP2',110,47),('s400',110,51),('Su-57',95,50)]:put(name,1,x,y)
    result={'format':'steel-tide-map','v':1,'name':'Naval Review','w':W,'h':H,'terrain':rle(terrain),
            'deposits':[{'x':x,'y':y} for x,y in [(12,20),(18,20),(109,20),(115,20),(12,100),(115,100)]],
            'spawns':[{'x':12,'y':60},{'x':115,'y':60}],'units':units}
    (HERE/'maps/naval-review.steel-tide-map').write_text(json.dumps(result,separators=(',',':'))+'\n')
    print('Built Naval Review:',len(units),'placed units')
if __name__=='__main__':build()

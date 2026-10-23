"""Compile an explicit subset of RW expressions into inert, validated JSON ASTs.
No eval, Python calls or JavaScript source generation. Unknown syntax is an error.
"""
import re

class Unsupported(ValueError):
    pass

TOKEN = re.compile(r'''\s*(?:(\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+)|("[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')|([\w]+)|(==|!=|>=|<=|[().,=+*/%<>-]))''')
GETS = set('hp maxhp shield energy ammo ammoincludingqueued energyincludingqueued queuesize transportingcount kills customtimer timealive height x y dir hasparent hasactivewaypoint ismoving isattacking iscontrolledbyai isenergyfull isenergyempty isenergyrecharging isammoempty overwater isoverwater isoverliquid isoveropenland isovercliff isatgroundheight isunderwater flying isflying isinwater maxenergy maxshield isinmap numberofqueuedwaypoints'.split())
CALLS = GETS | set('resource hasflag tags globalteamtags hasunitinteam numberofunitsinteam numberofunitsinenemyteam numberofattachedunits isoverpassabletile attachment'.split())

def compile_expr(value):
    if value is None or value == '': return ['lit', True]
    source = re.sub(r'^if\s+', '', str(value).strip(), flags=re.I).replace('self.parent.', 'parent.')
    tokens=[];pos=0
    while pos < len(source):
        m=TOKEN.match(source,pos)
        if not m: raise Unsupported('unrecognized expression: '+source[pos:])
        tokens.append(next(x for x in m.groups() if x is not None));pos=m.end()
    tokens.append('<end>');i=0
    def peek():return tokens[i]
    def pop():
        nonlocal i
        v=tokens[i];i+=1;return v
    def expr(minimum=0):
        t=pop();low=t.lower()
        if low in ('not','-','+'):
            left=['unary',low,expr(6)]
        elif t=='(':
            left=expr()
            if pop()!=')':raise Unsupported('unbalanced expression')
        elif t[0] in ('"',"'"):
            left=['lit',t[1:-1]]
        elif re.fullmatch(r'(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?',t):left=['lit',float(t)]
        elif low in ('true','false','null','nullunit'):left=['lit',{'true':True,'false':False,'null':None,'nullunit':None}[low]]
        else:
            path=low
            while peek()=='.':pop();path+='.'+pop().lower()
            if peek()=='(':
                pop();args={};params=[]
                if peek()!=')':
                    while True:
                        if tokens[i+1]=='=':
                            key=pop().lower();pop();args[key]=expr()
                        else:params.append(expr())
                        if peek()!=',':break
                        pop()
                if pop()!=')':raise Unsupported('unbalanced call')
                method=path.removeprefix('self.').removeprefix('parent.').removeprefix('customtarget1.').removeprefix('thisactiontarget.')
                if method not in CALLS and path not in ('min','max','int','select','rnd','distancebetween'):raise Unsupported('unsupported call '+path)
                left=['call',path,args,params]
                if peek()=='.':
                    tail='self'
                    while peek()=='.':pop();tail+='.'+pop().lower()
                    if not tail.startswith('self.resource.'):raise Unsupported('unsupported reference property '+tail)
                    left=['of',left,['get',tail]]
            else:
                method=path.removeprefix('self.').removeprefix('parent.').removeprefix('customtarget1.')
                if method not in GETS and not path.startswith(('self.resource.','parent.resource.','memory.')) and path not in ('game.nukesenabled','game.mapwidth','game.mapheight','self','parent','self.parent','customtarget1','activewaypointtarget','self.activewaypointtarget','thisactiontarget'):
                    raise Unsupported('unsupported value '+path)
                left=['get',path]
        precedence={'or':1,'and':2,'==':3,'!=':3,'>':3,'<':3,'>=':3,'<=':3,'+':4,'-':4,'*':5,'/':5,'%':5}
        while peek().lower() in precedence and precedence[peek().lower()]>=minimum:
            op=pop().lower();left=['bin',op,left,expr(precedence[op]+1)]
        return left
    result=expr()
    if peek()!='<end>':raise Unsupported('trailing expression '+peek())
    return result

def split_list(text):
    """Comma-separated RW entries, retaining commas inside call parentheses."""
    out=[];start=0;depth=0;quote=None
    for i,c in enumerate(text):
        if quote:
            if c==quote:quote=None
        elif c in ('"',"'"):quote=c
        elif c=='(':depth+=1
        elif c==')':depth-=1
        elif c==',' and depth==0:out.append(text[start:i].strip());start=i+1
    if text[start:].strip():out.append(text[start:].strip())
    return out

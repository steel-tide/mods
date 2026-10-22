/** RW 1.15 float/angle lookup conventions. Tables are constructed only when this
 * package is loaded. See MOVEMENT-PARITY.md for pinned implementation evidence. */
export const f=Math.fround;
const sine=new Float32Array(8192),cosine=new Float32Array(8192),atan=new Float32Array(1025);
for(let i=0;i<8192;i++){const a=f(f(f(i+.5)/8192)*f(6.2831855));sine[i]=Math.sin(a);cosine[i]=Math.cos(a);}
for(let i=0;i<=1024;i++)atan[i]=Math.atan(f(i/1024))*3.1415927410125732/Math.PI;
export function sourceSin(degrees:number):number{return sine[Math.trunc(f(degrees*f(22.755556)))&8191];}
export function sourceCos(degrees:number):number{return cosine[Math.trunc(f(degrees*f(22.755556)))&8191];}
export function sourceDirection(y:number,x:number):number {
  const index=(a:number,b:number)=>Math.trunc(f(f(1024*a)/b)+.5)||0;
  let a:number;
  if(x>=0){if(y>=0)a=x>=y?atan[index(y,x)]:f(f(1.5707964)-atan[index(x,y)]);else a=x>=-y?-atan[index(-y,x)]:f(atan[index(-x,y)]-f(1.5707964));}
  else if(y>=0)a=-x>=y?f(f(3.1415927)-atan[index(-y,x)]):f(atan[index(-x,y)]+f(1.5707964));
  else a=x<=y?f(atan[index(y,x)]-f(3.1415927)):f(-f(1.5707964)-atan[index(x,y)]);
  return f(a*f(57.29578));
}
export function sourceApproach(value:number,target:number,step:number):number {return value>f(target+step)?f(value-step):value<f(target-step)?f(value+step):target;}
export function sourceAngleDelta(from:number,to:number):number {let a=f(f(to%360)-f(from%360));if(a>180)a=f(a-360);if(a< -180)a=f(a+360);return a;}

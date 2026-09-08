import type {Vector3} from './vector.ts';
import {dotProduct,normalizeVector} from './vector.ts';
import {planckSpectralRadiance} from '../rendering/spectrum.ts';

// Geometrised units G=c=M=1; the dimensionless spin a*=Jc/(GM²) is a here.
export const KERR_OUTER_DISC=80;
export const gravitationalSeconds=(massSolar:number)=>4.925490947e-6*massSolar;
export function kerrHorizon(a:number){return 1+Math.sqrt(1-a*a);}
export function kerrIsco(a:number){
  const z1=1+Math.cbrt(1-a*a)*(Math.cbrt(1+a)+Math.cbrt(1-a)),z2=Math.sqrt(3*a*a+z1*z1);
  return 3+z2-Math.sign(a)*Math.sqrt((3-z1)*(3+z1+2*z2));
}
export function kerrCircularOrbit(r:number,a:number){
  const root=Math.sqrt(r),r32=r*root,den=r**.75*Math.sqrt(r32-3*root+2*a);
  const energy=(r32-2*root+a)/den,angularMomentum=(r*r-2*a*root+a*a)/den;
  const omega=1/(r32+a),ut=(1+a/r32)/Math.sqrt(1-3/r+2*a/r32);
  return {energy,angularMomentum,omega,ut};
}
export function kerrDiscProfile(massSolar:number,a:number,eddingtonRatio:number){
  const inner=kerrIsco(a),efficiency=1-kerrCircularOrbit(inner,a).energy;
  const G=6.67430e-11,c=299792458,mass=massSolar*1.98847e30,sigma=5.670374419e-8;
  const mdot=4*Math.PI*G*mass*1.67262192369e-27/(6.6524587321e-29*c*efficiency)*eddingtonRatio;
  const scale=mdot*c**6/(4*Math.PI*G**2*mass**2),temperatures=new Float32Array(1024*4);
  let integral=0,peak=0,previous=0;
  const step=(KERR_OUTER_DISC-inner)/1023;
  for(let i=0;i<1024;i++){
    const r=inner+i*step,{energy,angularMomentum,omega}=kerrCircularOrbit(r,a),h=1e-4;
    const derivative=(kerrCircularOrbit(r+h,a).angularMomentum-kerrCircularOrbit(r-h,a).angularMomentum)/(2*h);
    const integrand=(energy-omega*angularMomentum)*derivative;
    if(i)integral+=(previous+integrand)*step/2;previous=integrand;
    const minusOmegaDerivative=1.5*Math.sqrt(r)/(r**1.5+a)**2;
    const flux=scale*minusOmegaDerivative/(r*(energy-omega*angularMomentum)**2)*Math.max(0,integral);
    const temperature=Math.max(0,flux/sigma)**.25;
    temperatures[i*4]=temperature;temperatures[i*4+3]=1;peak=Math.max(peak,temperature);
  }
  return {inner,efficiency,temperatures,peak};
}
export function kerrCameraExposure(massSolar:number,a:number,ratio:number,bolometric:boolean){
  const {peak}=kerrDiscProfile(massSolar,a,ratio);let signal=0;
  for(let wavelength=360;wavelength<=830;wavelength+=5)signal+=planckSpectralRadiance(wavelength*1e-9,peak)*Math.exp(-.5*((wavelength-545)/38)**2)*5e-9;
  return Math.max(-40,Math.min(20,Math.log2(.3/(bolometric?5.670374419e-8*peak**4/Math.PI/1e10:signal/1e6))));
}

export interface KerrRay {u:number;du:number;z:number;dz:number;phi:number;angularMomentum:number;carter:number;scale:number;energy:number}
/** Future-directed photon constants; integration proceeds backwards from a ZAMO. */
export function initialiseKerrRay(observer:Vector3,direction:Vector3,a:number):KerrRay {
  const r=Math.hypot(observer.x,observer.y,observer.z),radial=normalizeVector(observer);
  const phi=Math.atan2(observer.y,observer.x),z=radial.z,sin=Math.sqrt(Math.max(1e-12,1-z*z));
  const thetaBasis={x:z*Math.cos(phi),y:z*Math.sin(phi),z:-sin},phiBasis={x:-Math.sin(phi),y:Math.cos(phi),z:0};
  const nr=dotProduct(direction,radial),nt=dotProduct(direction,thetaBasis),np=dotProduct(direction,phiBasis);
  const delta=r*r-2*r+a*a,sigma=r*r+a*a*z*z,A=(r*r+a*a)**2-a*a*delta*sin*sin;
  const lapse=Math.sqrt(sigma*delta/A),drag=2*a*r/A,L=-Math.sqrt(A/sigma)*sin*np;
  const energy=lapse+drag*L,angularMomentum=L/energy,pt=-nt*Math.sqrt(sigma)/energy;
  const carter=pt*pt+z*z*(angularMomentum**2/(sin*sin)-a*a),scale=Math.sqrt(Math.max(.01,carter+angularMomentum**2+a*a));
  return {u:1/r,du:-nr*Math.sqrt(delta*sigma)/(energy*r*r*scale),z,dz:-sin*nt*Math.sqrt(sigma)/(energy*scale),phi,angularMomentum,carter,scale,energy};
}
// z=√A cosψ. Integrate the polar azimuth's atan term exactly and RK4 only
// its smooth remainder; direct integration of L/(1-z²) fails near the axis.
function polarPhase(ray:KerrRay,a:number){
  const {angularMomentum:L,carter:Q,z,dz,scale:B}=ray,C=a*a-L*L-Q;
  const A=2*Q/(Math.sqrt(C*C+4*a*a*Q)-C),w=L*L/(Q/A+a*a*A);
  return Math.atan2(-B*dz/Math.sqrt(Q/A+a*a*z*z),Math.sqrt(w)*z);
}
function slope(ray:KerrRay,a:number){
  const {u,z,angularMomentum:L,carter:Q,scale:B}=ray,K=(L-a)**2+Q,C=a*a-L*L-Q;
  let polar=-L/Math.max(1e-12,1-z*z)/B;
  if(Q>0){
    const A=2*Q/(Math.sqrt(C*C+4*a*a*Q)-C),w=L*L/(Q/A+a*a*A);
    const ratio=Math.max(0,Math.min(1,(A-z*z)/Math.max(1e-12,1-z*z)));
    polar=-Math.sign(L)*w*a*a*ratio/(B*Math.max(1e-12,Math.abs(L)+Math.sqrt(w*(Q/A+a*a*z*z))));
  }
  return {u:ray.du,du:(C*u+3*K*u*u-2*a*a*Q*u*u*u)/(B*B),z:ray.dz,dz:(C*z-2*a*a*z*z*z)/(B*B),
    phi:polar-a*(2*u-a*L*u*u)/Math.max(1e-9,1-2*u+a*a*u*u)/B};
}
export function stepKerrRay(ray:KerrRay,a:number,h:number):KerrRay{
  const shifted=(d:ReturnType<typeof slope>,s:number)=>({...ray,u:ray.u+d.u*s,du:ray.du+d.du*s,z:ray.z+d.z*s,dz:ray.dz+d.dz*s,phi:ray.phi+d.phi*s});
  const p=slope(ray,a),q=slope(shifted(p,h/2),a),r=slope(shifted(q,h/2),a),s=slope(shifted(r,h),a);
  const next={...ray};for(const key of ['u','du','z','dz','phi'] as const)next[key]+=h*(p[key]+2*q[key]+2*r[key]+s[key])/6;
  if(ray.carter>0){const delta=polarPhase(next,a)-polarPhase(ray,a);next.phi-=Math.sign(ray.angularMomentum)*Math.atan2(Math.sin(delta),Math.cos(delta));}
  if(ray.angularMomentum===0&&ray.carter>0&&ray.dz*next.dz<0)next.phi+=Math.PI;
  return next;
}
export function kerrRayInvariants(ray:KerrRay,a:number){
  const {u,z,du,dz,angularMomentum:L,carter:Q,scale:B}=ray,K=(L-a)**2+Q,C=a*a-L*L-Q;
  return {radial:du*du*B*B-(1+C*u*u+2*K*u**3-a*a*Q*u**4),polar:dz*dz*B*B-(Q+C*z*z-a*a*z**4)};
}
export function traceKerrRay(observer:Vector3,direction:Vector3,a:number,step=.025,maxSteps=1200){
  let ray=initialiseKerrRay(observer,direction,a);const horizon=kerrHorizon(a),inner=kerrIsco(a),hits:Array<{radius:number;phi:number;g:number}>=[];
  const escapeU=1/Math.max(2000,Math.hypot(observer.x,observer.y,observer.z)*2);
  for(let i=0;i<maxSteps;i++){
    if(ray.u>=.999/horizon)return {ray,hits,captured:true,escaped:false,steps:i};
    if(ray.u<escapeU&&ray.du<0)return {ray,hits,captured:false,escaped:true,steps:i};
    const h=Math.min(step,.08*Math.max(ray.u,.0003)/Math.max(Math.abs(ray.du),1e-9));
    const next=stepKerrRay(ray,a,h);
    if(ray.z*next.z<0){
      const f=ray.z/(ray.z-next.z),radius=1/(ray.u+(next.u-ray.u)*f),phi=ray.phi+(next.phi-ray.phi)*f;
      if(radius>inner&&radius<KERR_OUTER_DISC){const orbit=kerrCircularOrbit(radius,a);hits.push({radius,phi,g:1/(ray.energy*orbit.ut*(1-orbit.omega*ray.angularMomentum))});}
    }
    ray=next;
  }
  return {ray,hits,captured:false,escaped:false,steps:maxSteps};
}

/** Same separated null-geodesic system and RK4 as the CPU reference above. */
export const kerrRayGlsl=`
vec4 raySlope(vec4 y,float a,float L,float Q,float B){
  float u=y.x,z=y.z,K=(L-a)*(L-a)+Q,C=a*a-L*L-Q;
  return vec4(y.y,(C*u+3.0*K*u*u-2.0*a*a*Q*u*u*u)/(B*B),y.w,(C*z-2.0*a*a*z*z*z)/(B*B));
}
float polarPhase(vec4 y,float a,float L,float Q,float B){
  float C=a*a-L*L-Q,A=2.0*Q/(sqrt(C*C+4.0*a*a*Q)-C),w=L*L/(Q/A+a*a*A);
  return atan(-B*y.w/sqrt(Q/A+a*a*y.z*y.z),sqrt(w)*y.z);
}
float phiSlope(vec4 y,float a,float L,float Q,float B){
  float u=y.x,z=y.z,polar=-L/max(1e-12,1.0-z*z)/B;
  if(Q>0.0){
    float C=a*a-L*L-Q,A=2.0*Q/(sqrt(C*C+4.0*a*a*Q)-C),w=L*L/(Q/A+a*a*A);
    float ratio=clamp((A-z*z)/max(1e-12,1.0-z*z),0.0,1.0);
    polar=-sign(L)*w*a*a*ratio/(B*max(1e-12,abs(L)+sqrt(w*(Q/A+a*a*z*z))));
  }
  return polar-a*(2.0*u-a*L*u*u)/max(1e-9,1.0-2.0*u+a*a*u*u)/B;
}
void advanceRay(inout vec4 y,inout float phi,float h,float a,float L,float Q,float B){
  vec4 k1=raySlope(y,a,L,Q,B),q=y+k1*h*.5,k2=raySlope(q,a,L,Q,B);
  vec4 r=y+k2*h*.5,k3=raySlope(r,a,L,Q,B),s=y+k3*h,k4=raySlope(s,a,L,Q,B);
  phi+=h*(phiSlope(y,a,L,Q,B)+2.0*phiSlope(q,a,L,Q,B)+2.0*phiSlope(r,a,L,Q,B)+phiSlope(s,a,L,Q,B))/6.0;
  vec4 next=y+h*(k1+2.0*k2+2.0*k3+k4)/6.0;
  if(Q>0.0){float delta=polarPhase(next,a,L,Q,B)-polarPhase(y,a,L,Q,B);phi-=sign(L)*atan(sin(delta),cos(delta));}
  if(L==0.0&&Q>0.0&&y.w*next.w<0.0)phi+=3.141592653589793;
  y=next;
}
`;

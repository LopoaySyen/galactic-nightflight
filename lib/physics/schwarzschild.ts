import { planckSpectralRadiance } from '../rendering/spectrum.ts';

// Lengths below are in Schwarzschild radii, with G = c = Rs = 1.
export const PHOTON_CAPTURE_IMPACT = Math.sqrt(27) / 2;
export const DISC_INNER_RADIUS = 3;
export const DISC_OUTER_RADIUS = 40;
export const RAY_MAX_IMPACT = 64;
export const RAY_MAX_PHI = 3 * Math.PI;
export const RAY_WIDTH = 1024;
export const RAY_HEIGHT = 512;
const INNER_SAMPLES = 256;
const EDGE_EPSILON = 1e-5;
const LOG_IMPACT_RANGE = Math.log1p((RAY_MAX_IMPACT-PHOTON_CAPTURE_IMPACT)/EDGE_EPSILON);

export function rayImpactAtColumn(column: number) {
  return column < INNER_SAMPLES ? PHOTON_CAPTURE_IMPACT*column/INNER_SAMPLES
    : PHOTON_CAPTURE_IMPACT + EDGE_EPSILON*Math.expm1((column-INNER_SAMPLES)/(RAY_WIDTH-1-INNER_SAMPLES)*LOG_IMPACT_RANGE);
}
export function rayColumnAtImpact(impact: number) {
  return impact<PHOTON_CAPTURE_IMPACT ? impact/PHOTON_CAPTURE_IMPACT*INNER_SAMPLES
    : INNER_SAMPLES+(RAY_WIDTH-1-INNER_SAMPLES)*Math.log1p((impact-PHOTON_CAPTURE_IMPACT)/EDGE_EPSILON)/LOG_IMPACT_RANGE;
}

/** RK4 for the exact Schwarzschild null orbit u'' = -u + 3u²/2. */
export function stepNullOrbit(u:number, derivative:number, step:number):[number,number] {
  const a=(v:number)=>-v+1.5*v*v;
  const k1=derivative, j1=a(u);
  const k2=derivative+step*j1/2, j2=a(u+step*k1/2);
  const k3=derivative+step*j2/2, j3=a(u+step*k2/2);
  const k4=derivative+step*j3, j4=a(u+step*k3);
  return [u+step*(k1+2*k2+2*k3+k4)/6,derivative+step*(j1+2*j2+2*j3+j4)/6];
}
export function traceNullOrbit(impact:number, observerRadius:number, maxPhi=RAY_MAX_PHI, step=.002) {
  let u=1/observerRadius, derivative=Math.sqrt(Math.max(0,1/impact**2-u*u+u**3)),phi=0;
  while(phi<maxPhi && u>0 && u<1){
    const h=Math.min(step,maxPhi-phi), previous=u;
    [u,derivative]=stepNullOrbit(u,derivative,h);phi+=h;
    if(u<=0) return {escaped:true,captured:false,phi:phi-h+h*previous/(previous-u),u:0,derivative};
  }
  return {escaped:false,captured:u>=1,phi,u,derivative};
}
export function encodeUnit16(pixels:Uint8Array,offset:number,value:number) {
  const encoded=Math.round(Math.min(1,Math.max(0,value))*65535);
  pixels[offset]=encoded>>>8;pixels[offset+1]=encoded&255;
}
export interface SchwarzschildRayTable {
  observerRadius:number; pixels:Uint8Array; inverse:Uint8Array; escapePixels:Uint8Array; escape:Float64Array;
}
let cachedTable:SchwarzschildRayTable|undefined;
export function schwarzschildRayTable(observerRadius:number):SchwarzschildRayTable {
  // Beyond this, the finite-observer correction is below the grid resolution.
  const radius=Math.max(65,Math.min(1e6,Math.round(observerRadius*1000)/1000));
  if(cachedTable?.observerRadius===radius)return cachedTable;
  const pixels=new Uint8Array(RAY_WIDTH*RAY_HEIGHT*4), escape=new Float64Array(RAY_WIDTH);
  const h=RAY_MAX_PHI/(RAY_HEIGHT-1);
  for(let x=0;x<RAY_WIDTH;x++){
    const b=Math.max(.002,rayImpactAtColumn(x));
    let u=1/radius, derivative=Math.sqrt(Math.max(0,1/b**2-u*u+u**3));
    for(let y=0;y<RAY_HEIGHT;y++){
      if(!(u>0&&u<1))break;
      const offset=(y*RAY_WIDTH+x)*4;
      encodeUnit16(pixels,offset,u);pixels[offset+2]=255;pixels[offset+3]=255;
      const previous=u;
      [u,derivative]=stepNullOrbit(u,derivative,h);
      if(u<=0)escape[x]=y*h+h*previous/(previous-u);
    }
    // Critical rays still circling at the end of the finite integration window.
    if(u>0&&u<1)escape[x]=RAY_MAX_PHI;
  }
  const inverse=new Uint8Array(RAY_WIDTH*4);
  for(let x=0;x<RAY_WIDTH;x++){
    const target=RAY_MAX_PHI*x/(RAY_WIDTH-1);
    if(target<escape[RAY_WIDTH-1])continue;
    let low=INNER_SAMPLES,high=RAY_WIDTH-1;
    while(high-low>1){const mid=(low+high)>>1;if(escape[mid]>target)low=mid;else high=mid;}
    const t=Math.min(1,Math.max(0,(escape[low]-target)/Math.max(1e-12,escape[low]-escape[high])));
    const b=rayImpactAtColumn(low)*(1-t)+rayImpactAtColumn(high)*t;
    encodeUnit16(inverse,x*4,b/RAY_MAX_IMPACT);inverse[x*4+2]=255;inverse[x*4+3]=255;
  }
  const escapePixels=new Uint8Array(RAY_WIDTH*4);
  for(let x=0;x<RAY_WIDTH;x++){encodeUnit16(escapePixels,x*4,escape[x]/RAY_MAX_PHI);escapePixels[x*4+2]=escape[x]>0&&escape[x]<RAY_MAX_PHI?255:0;escapePixels[x*4+3]=255;}
  return cachedTable={observerRadius:radius,pixels,inverse,escapePixels,escape};
}

const G=6.67430e-11,C=299792458,SOLAR_MASS=1.98847e30,SIGMA=5.670374419e-8;
export const SCHWARZSCHILD_EFFICIENCY=1-Math.sqrt(8/9);
/** Page–Thorne zero-torque flux; r is in Rs, accretion rate is in kg/s. */
export function thinDiscFlux(radius:number,massSolar:number,accretionRate:number) {
  if(radius<=DISC_INNER_RADIUS)return 0;
  const x=Math.sqrt(2*radius),x0=Math.sqrt(6),s=Math.sqrt(3);
  const integral=x-x0-s/2*Math.log((x-s)*(x0+s)/((x+s)*(x0-s)));
  return 3*accretionRate*C**6/(8*Math.PI*G**2*(massSolar*SOLAR_MASS)**2)*Math.max(0,integral)/(x**5*(x*x-3));
}
export function eddingtonAccretionRate(massSolar:number,luminosityRatio:number) {
  // L_Edd = 4 pi G M m_p c / sigma_T for ionised hydrogen.
  return 4*Math.PI*G*(massSolar*SOLAR_MASS)*1.67262192369e-27/(6.6524587321e-29*C*SCHWARZSCHILD_EFFICIENCY)*luminosityRatio;
}
export function thinDiscTemperature(radius:number,massSolar:number,luminosityRatio:number) {
  return (thinDiscFlux(radius,massSolar,eddingtonAccretionRate(massSolar,luminosityRatio))/SIGMA)**.25;
}
/** Ratio of static-observer frequency to circular-emitter frequency. lambda=Lz/E. */
export function discFrequencyShift(radius:number,photonAngularMomentum:number,observerRadius:number) {
  const omega=1/Math.sqrt(2*radius**3);
  return Math.sqrt(1-1.5/radius)/(Math.sqrt(1-1/observerRadius)*(1-omega*photonAngularMomentum));
}

let spectrumPixels:Uint8Array|undefined;
/** Absolute Planck radiance through three explicit Gaussian camera response bands. */
export function thermalSpectrumTexture() {
  if(spectrumPixels)return spectrumPixels;
  const pixels=new Uint8Array(1024*3*4);
  const bands=[[610,48],[545,38],[455,34]];
  for(let x=0;x<1024;x++){
    const temperature=10**(2+5*x/1023);
    for(let band=0;band<3;band++){
      let radiance=0;
      for(let wavelength=360;wavelength<=830;wavelength+=5){
        const response=Math.exp(-.5*((wavelength-bands[band][0])/bands[band][1])**2);
        radiance+=planckSpectralRadiance(wavelength*1e-9,temperature)*response*5e-9;
      }
      // Fixed radiance reference, not per-pixel or per-object brightness normalisation.
      const offset=(band*1024+x)*4;
      encodeUnit16(pixels,offset,(Math.log2(Math.max(1e-24,radiance/1e6))+80)/160);
      pixels[offset+3]=255;
    }
  }
  return spectrumPixels=pixels;
}

export const schwarzschildLookupGlsl=`
uniform sampler2D rayOrbits,rayInverse;
uniform float relativisticRadius;
const float captureImpact=2.598076211353316;
float unpack16(vec4 v){return (v.r*256.0+v.g)/257.0;}
float orbitColumn(float b){
  if(b<captureImpact)return b/captureImpact*256.0;
  return 256.0+767.0*log(1.0+(b-captureImpact)/0.00001)/${LOG_IMPACT_RANGE};
}
vec4 orbitSample(float b,float phi){return texture2D(rayOrbits,vec2((orbitColumn(b)+0.5)/1024.0,(phi/${RAY_MAX_PHI}*511.0+0.5)/512.0));}
float orbitRadius(float b,float phi){vec4 v=orbitSample(b,phi);return v.b>.99?1.0/max(unpack16(v),0.00000001):0.0;}
float inverseImpact(float phi){return unpack16(texture2D(rayInverse,vec2((phi/${RAY_MAX_PHI}*1023.0+0.5)/1024.0,.5)))*64.0;}
`;
import type { Vector3 } from './vector.ts';
import { normalizeVector,dotProduct } from './vector.ts';

function unpackPixel(pixels:Uint8Array,offset:number){return (pixels[offset]*256+pixels[offset+1])/65535;}
export function sampleOrbitRadius(table:SchwarzschildRayTable,impact:number,phi:number) {
  const x=Math.min(1023,Math.max(0,rayColumnAtImpact(impact))),y=Math.min(511,Math.max(0,phi/RAY_MAX_PHI*511));
  const x0=Math.floor(x),x1=Math.min(1023,x0+1),y0=Math.floor(y),y1=Math.min(511,y0+1);
  let u=0,valid=0;
  for(const [cx,wx] of [[x0,1-(x-x0)],[x1,x-x0]])for(const [cy,wy] of [[y0,1-(y-y0)],[y1,y-y0]]){
    const offset=(cy*1024+cx)*4;u+=unpackPixel(table.pixels,offset)*wx*wy;valid+=table.pixels[offset+2]/255*wx*wy;
  }
  return valid>.99?1/Math.max(u,1e-8):0;
}
export function sampleInverseImpact(table:SchwarzschildRayTable,phi:number) {
  const x=Math.min(1023,Math.max(0,phi/RAY_MAX_PHI*1023)),i=Math.floor(x),f=x-i;
  return RAY_MAX_IMPACT*(unpackPixel(table.inverse,i*4)*(1-f)+unpackPixel(table.inverse,Math.min(i+1,1023)*4)*f);
}
export function rayIntersectsDisc(table:SchwarzschildRayTable,b:number,radial:Vector3,axis:Vector3) {
  let phi=Math.atan2(-radial.z,axis.z);if(phi<=0)phi+=Math.PI;
  for(let crossing=0;crossing<3;crossing++){
    const radius=sampleOrbitRadius(table,b,phi+crossing*Math.PI);
    if(radius>3&&radius<40)return true;
  }
  return false;
}
export function relativisticPointImages(direction:Vector3,toHole:Vector3,observerRadius:number) {
  const table=schwarzschildRayTable(observerRadius),cosine=dotProduct(direction,toHole);
  const beta=Math.acos(Math.min(1,Math.max(-1,cosine)));
  const axis=normalizeVector(beta>1e-8?{x:direction.x-cosine*toHole.x,y:direction.y-cosine*toHole.y,z:direction.z-cosine*toHole.z}:Math.abs(toHole.z)<.9?{x:-toHole.y,y:toHole.x,z:0}:{x:1,y:0,z:0});
  const radial={x:-toHole.x,y:-toHole.y,z:-toHole.z};
  const results:Array<{direction:Vector3;magnification:number}>=[];
  for(let order=0;order<3;order++){
    const sign=order===1?-1:1,phi=(order===2?3:1)*Math.PI-sign*beta;
    if(phi<table.escape[1023]||phi>RAY_MAX_PHI){if(order===0)results.push({direction,magnification:1});continue;}
    const b=sampleInverseImpact(table,phi),scaled=b*Math.sqrt(1-1/table.observerRadius)/table.observerRadius;
    const signedAxis={x:axis.x*sign,y:axis.y*sign,z:axis.z*sign};
    if(rayIntersectsDisc(table,b,radial,signedAxis))continue;
    const theta=Math.asin(Math.min(1,scaled)),h=RAY_MAX_PHI/1023;
    const derivative=Math.abs(sampleInverseImpact(table,Math.min(RAY_MAX_PHI,phi+h))-sampleInverseImpact(table,Math.max(0,phi-h)))/(2*h);
    const mu=Math.sin(theta)/Math.max(Math.sin(beta),1e-5)*Math.sqrt(1-1/table.observerRadius)/table.observerRadius/Math.cos(theta)*derivative;
    results.push({direction:normalizeVector({x:toHole.x*Math.cos(theta)+signedAxis.x*Math.sin(theta),y:toHole.y*Math.cos(theta)+signedAxis.y*Math.sin(theta),z:toHole.z*Math.cos(theta)+signedAxis.z*Math.sin(theta)}),magnification:mu});
  }
  return results;
}

export const relativisticPointGlsl=`
${schwarzschildLookupGlsl}
bool applyRelativisticLens(inout vec3 direction,inout float magnitude,vec3 toHole,float order){
  float beta=acos(clamp(dot(direction,toHole),-1.0,1.0));
  float sign=order>.5&&order<1.5?-1.0:1.0;
  float phi=(order>1.5?3.0:1.0)*3.141592653589793-sign*beta;
  if(phi>9.42477796077)return false;
  vec4 inverse=texture2D(rayInverse,vec2((phi/9.42477796077*1023.0+.5)/1024.0,.5));
  if(inverse.b<.99)return order<.5;
  vec3 offset=direction-toHole*dot(direction,toHole);
  vec3 axis=length(offset)>1e-7?normalize(offset):normalize(abs(toHole.z)<.9?cross(vec3(0.0,0.0,1.0),toHole):cross(vec3(0.0,1.0,0.0),toHole));axis*=sign;
  float b=unpack16(inverse)*64.0;
  float crossing=atan(toHole.z,axis.z);if(crossing<=0.0)crossing+=3.141592653589793;
  for(int i=0;i<3;i++){float r=orbitRadius(b,crossing+float(i)*3.141592653589793);if(r>3.0&&r<40.0)return false;}
  float scale=sqrt(1.0-1.0/relativisticRadius)/relativisticRadius;
  float theta=asin(clamp(b*scale,0.0,1.0)),h=9.42477796077/1023.0;
  float derivative=abs(inverseImpact(min(9.42477796077,phi+h))-inverseImpact(max(0.0,phi-h)))/(2.0*h);
  float mu=sin(theta)/max(sin(beta),.00001)*scale/max(cos(theta),.00001)*derivative;
  direction=normalize(toHole*cos(theta)+axis*sin(theta));
  magnitude-=2.5*log(max(mu,.0000001))/log(10.0);return true;
}`;
/** Camera exposure placing the hottest visible thermal band near middle grey. */
export function blackHoleCameraExposure(massSolar:number,luminosityRatio:number,bolometric=false) {
  let peak=0;
  for(let i=0;i<128;i++)peak=Math.max(peak,thinDiscTemperature(3.01+i/128*36,massSolar,luminosityRatio));
  let signal=0;
  for(let wavelength=360;wavelength<=830;wavelength+=5)signal+=planckSpectralRadiance(wavelength*1e-9,peak)*Math.exp(-.5*((wavelength-545)/38)**2)*5e-9;
  const referenceSignal=bolometric?SIGMA*peak**4/Math.PI/1e10:signal/1e6;
  return Math.max(-40,Math.min(20,Math.log2(.3/referenceSignal)));
}

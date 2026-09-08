import {relativisticPointImages,relativisticPointGlsl} from './schwarzschild.ts';
import type { Vector3 } from './vector.ts';
import { normalizeVector, dotProduct } from './vector.ts';

export const SCHWARZSCHILD_PARSEC_PER_SOLAR_MASS = 9.57083e-14;
export interface PointLens { positionParsec: Vector3; massSolar: number }
export interface LensView { direction: Vector3; distance: number; strength: number; shadowAngle: number; discEdgeFade?: boolean }
export function lensView(lens: PointLens, observer: Vector3): LensView | null {
  const offset = { x: lens.positionParsec.x-observer.x, y: lens.positionParsec.y-observer.y, z: lens.positionParsec.z-observer.z };
  const distance = Math.hypot(offset.x,offset.y,offset.z);
  if (!(distance>0)) return null;
  const radius = SCHWARZSCHILD_PARSEC_PER_SOLAR_MASS * lens.massSolar;
  return { direction: normalizeVector(offset), distance, strength: 2*radius/distance, shadowAngle: Math.sqrt(27)/2*radius/distance };
}
export function einsteinAngleRadians(massSolar: number, lensDistance: number, sourceDistance: number) {
  return sourceDistance > lensDistance && lensDistance > 0
    ? Math.sqrt(2*SCHWARZSCHILD_PARSEC_PER_SOLAR_MASS*massSolar/lensDistance*(1-lensDistance/sourceDistance)) : 0;
}
/** Thin point-mass lens, finite source distance. Second image has negative parity. */
export function lensedPointImages(direction: Vector3, sourceDistance: number, lens: LensView | null) {
  if (!lens || sourceDistance<=lens.distance) return [{direction,magnification:1}];
  const radius=2/lens.strength;
  if(lens.distance<1&&radius>=65&&radius<=1e6)return relativisticPointImages(direction,lens.direction,radius,lens.discEdgeFade);
  const cosine=dotProduct(direction,lens.direction), strength=lens.strength*(1-lens.distance/sourceDistance);
  if (cosine<=0) return [{direction,magnification:1}];
  const offset={x:direction.x/cosine-lens.direction.x,y:direction.y/cosine-lens.direction.y,z:direction.z/cosine-lens.direction.z};
  const beta=Math.hypot(offset.x,offset.y,offset.z);
  if(beta>20*Math.sqrt(strength))return [{direction,magnification:1}];
  const unit=beta>1e-12?{x:offset.x/beta,y:offset.y/beta,z:offset.z/beta}:normalizeVector(Math.abs(lens.direction.z)<.9?{x:-lens.direction.y,y:lens.direction.x,z:0}:{x:1,y:0,z:0});
  const u=Math.max(beta/Math.sqrt(strength),1e-4), total=(u*u+2)/(u*Math.sqrt(u*u+4));
  return [1,-1].flatMap(sign=>{
    const theta=(beta+sign*Math.sqrt(beta*beta+4*strength))/2;
    if(Math.abs(theta)<lens.shadowAngle)return [];
    return [{ direction:normalizeVector({x:lens.direction.x+unit.x*theta,y:lens.direction.y+unit.y*theta,z:lens.direction.z+unit.z*theta}),
      magnification:(total+sign)/2 }];
  });
}

/** Inverse thin-lens ray for a distant diffuse background in the close-up. */
export function lensedBackgroundDirection(direction: Vector3, lens: LensView | null): Vector3 | null {
  if(!lens || lens.distance>=1)return direction;
  const cosine=dotProduct(direction,lens.direction);
  if(cosine<=0)return direction;
  const offset={x:direction.x/cosine-lens.direction.x,y:direction.y/cosine-lens.direction.y,z:direction.z/cosine-lens.direction.z};
  const theta2=dotProduct(offset,offset);
  if(theta2<lens.shadowAngle**2)return null;
  if(theta2>400*lens.strength)return direction;
  const scale=1-lens.strength/Math.max(theta2,1e-14);
  return normalizeVector({x:lens.direction.x+offset.x*scale,y:lens.direction.y+offset.y*scale,z:lens.direction.z+offset.z*scale});
}
export const pointLensGlsl = `
${relativisticPointGlsl}
uniform vec3 lensDirection;
uniform float lensDistance,lensStrength,lensShadow,secondaryImage;
bool applyPointLens(inout vec3 direction,float sourceDistance,inout float magnitude){
  if(lensStrength<=0.0||sourceDistance<=lensDistance)return secondaryImage<0.5;
  if(relativisticRadius>0.0)return applyRelativisticLens(direction,magnitude,lensDirection,secondaryImage);
  if(secondaryImage>1.5)return false;
  float cosine=dot(direction,lensDirection);
  if(cosine<=0.0)return secondaryImage<0.5;
  vec3 offset=direction/cosine-lensDirection;
  float beta=length(offset),e2=lensStrength*(1.0-lensDistance/sourceDistance);
  if(beta>20.0*sqrt(e2))return secondaryImage<0.5;
  vec3 axis=beta>0.0000001?offset/beta:normalize(abs(lensDirection.z)<0.9?cross(vec3(0.0,0.0,1.0),lensDirection):cross(vec3(0.0,1.0,0.0),lensDirection));
  float sign=secondaryImage>0.5?-1.0:1.0;
  float theta=0.5*(beta+sign*sqrt(beta*beta+4.0*e2));
  if(abs(theta)<lensShadow)return false;
  float u=max(beta/sqrt(e2),0.0001);
  float mu=0.5*((u*u+2.0)/(u*sqrt(u*u+4.0))+sign);
  direction=normalize(lensDirection+axis*theta);
  magnitude-=2.5*log(max(mu,0.0000001))/log(10.0);
  return true;
}`;

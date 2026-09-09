import type {PointSourceSample} from './contracts.ts';
import type {Vector3} from '../physics/vector.ts';
import {pointSourcePositionAtTime} from '../physics/kinematics.ts';

export const solarNames={zh:'太阳',en:'Sun',aliases:['太阳','太陽','Sun','Sol','日','太阳系恒星']};
export const sunStar:PointSourceSample={
  id:'sun',displayName:'Sun',positionParsec:{x:-8277,y:0,z:0},
  velocityKilometresPerSecond:{x:11.1,y:244.24,z:7.25},
  absoluteVisualMagnitude:4.83,effectiveTemperatureKelvin:5772,
  role:'observed-bright-star',sourceCatalog:'Solar reference · NASA / IAU',
  referenceVisualExtinctionMagnitude:0,
  observedData:{catalog:'solar-reference',referenceDistanceParsec:0,referenceApparentMagnitude:-26.74,
    spectralType:'G2 V',temperatureMethod:'reference-value',measuredVelocity:false,
    sourceUrl:'https://science.nasa.gov/sun/facts/'},
};

/** The solar-neighbourhood preset sits at the Sun's reference coordinate,
 * so its sky direction there is undefined. Never invent an RA/Dec or bearing. */
export function directionToSun(observer:Vector3,timeYears:number):Vector3|null{
  const position=pointSourcePositionAtTime(sunStar,timeYears);
  const direction={x:position.x-observer.x,y:position.y-observer.y,z:position.z-observer.z};
  return Math.hypot(direction.x,direction.y,direction.z)>1e-8?direction:null;
}
export function solarViewingPosition(timeYears:number):Vector3{
  const position=pointSourcePositionAtTime(sunStar,timeYears);
  return {...position,z:position.z+1};
}

import {Body, Equator, HelioVector, Observer, ObserverVector, RotateVector, Rotation_HOR_EQJ, SearchHourAngle, Vector, MakeTime} from 'astronomy-engine';
import {equatorialDirectionToGalactic} from './observed-star-catalog.ts';
import {sunStar} from './solar-star.ts';
import {pointSourcePositionAtTime} from '../physics/kinematics.ts';
import {addVector, dotProduct, normalizeVector, scaleVector, type Vector3} from '../physics/vector.ts';
import type {LocalFrame} from './local-frame.ts';

export const AU_KILOMETRES=149597870.7;
export const AU_PER_PARSEC=648000/Math.PI;
export const EARTH_MIN_DATE=Date.UTC(1900,0,1);
export const EARTH_MAX_DATE=Date.UTC(2100,11,31,23,59);
export interface EarthSettings {utcMillis:number;latitudeDegrees:number;longitudeDegrees:number}
const rad=Math.PI/180;
function eqToGalactic(v:Vector3):Vector3 {
  const length=Math.hypot(v.x,v.y,v.z);
  return scaleVector(equatorialDirectionToGalactic(Math.atan2(v.y,v.x)/rad,Math.asin(v.z/length)/rad),length);
}

/** Keep AU-scale geometry separate from the large Galactic origin. This avoids
 * float32 cancellation and remains usable before the all-sky worker refreshes. */
export function earthObservation(settings:EarthSettings,galacticYears=0){
  const date=new Date(settings.utcMillis),time=MakeTime(date);
  const site=new Observer(settings.latitudeDegrees,settings.longitudeDegrees,0);
  const sun=Equator(Body.Sun,date,site,false,true);
  const sunDirection=normalizeVector(eqToGalactic(sun.vec));
  const rotation=Rotation_HOR_EQJ(time,site);
  const axis=(x:number,y:number,z:number)=>normalizeVector(eqToGalactic(RotateVector(rotation,new Vector(x,y,z,time))));
  // Astronomy Engine HOR is north / west / up, a right-handed frame.
  const frame:LocalFrame={xAxis:axis(1,0,0),yAxis:axis(0,1,0),zenith:axis(0,0,1)};
  const offsetAu=eqToGalactic(addVector(HelioVector(Body.Earth,time),ObserverVector(time,site,false)));
  const observerPosition=addVector(pointSourcePositionAtTime(sunStar,galacticYears),scaleVector(offsetAu,1/AU_PER_PARSEC));
  const altitudeDegrees=Math.asin(Math.max(-1,Math.min(1,dotProduct(sunDirection,frame.zenith))))/rad;
  const azimuthDegrees=(Math.atan2(-dotProduct(sunDirection,frame.yAxis),dotProduct(sunDirection,frame.xAxis))/rad+360)%360;
  const angularRadiusDegrees=Math.asin(695700/(sun.dist*AU_KILOMETRES))/rad;
  return {observerPosition,sunDirection,frame,altitudeDegrees,azimuthDegrees,angularRadiusDegrees,distanceAu:sun.dist};
}
export type EarthObservation=ReturnType<typeof earthObservation>;

/** Noon is a visible, explicitly labelled example, not inferred user location. */
export function earthSolarNoon(settings:EarthSettings):EarthSettings {
  const utcDay=Math.floor((settings.utcMillis+settings.longitudeDegrees/360*86400000)/86400000)*86400000;
  const start=new Date(utcDay-settings.longitudeDegrees/360*86400000);
  const event=SearchHourAngle(Body.Sun,new Observer(settings.latitudeDegrees,settings.longitudeDegrees,0),0,start);
  return {...settings,utcMillis:Math.min(EARTH_MAX_DATE,Math.max(EARTH_MIN_DATE,event.time.date.getTime()))};
}

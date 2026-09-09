import type { Vector3 } from "../physics/vector.ts";
import {dotProduct} from '../physics/vector.ts';

export interface LocalFrame {xAxis:Vector3;yAxis:Vector3;zenith:Vector3}
export function planetaryFrame(inclinationDegrees:number):LocalFrame {
  return {xAxis:localToGalactic({x:1,y:0,z:0},inclinationDegrees),yAxis:{x:0,y:1,z:0},zenith:localZenith(inclinationDegrees)};
}
export function galacticToFrame(direction:Vector3,frame:LocalFrame):Vector3 {
  return {x:dotProduct(direction,frame.xAxis),y:dotProduct(direction,frame.yAxis),z:dotProduct(direction,frame.zenith)};
}

/** A hypothetical planet's local frame, independent of the Galactic plane.
 * Inclination tilts its zenith towards galactocentric +x, around the +y axis. */
export function localZenith(inclinationDegrees: number): Vector3 {
  const angle = inclinationDegrees * Math.PI / 180;
  return { x: Math.sin(angle), y: 0, z: Math.cos(angle) };
}

export function localToGalactic(direction: Vector3, inclinationDegrees: number): Vector3 {
  const angle = inclinationDegrees * Math.PI / 180;
  const sine = Math.sin(angle);
  const cosine = Math.cos(angle);
  return { x: cosine * direction.x + sine * direction.z, y: direction.y,
    z: -sine * direction.x + cosine * direction.z };
}

export function galacticToLocal(direction: Vector3, inclinationDegrees: number): Vector3 {
  return localToGalactic(direction, -inclinationDegrees);
}

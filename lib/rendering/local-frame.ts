import type { Vector3 } from "../physics/vector.ts";

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

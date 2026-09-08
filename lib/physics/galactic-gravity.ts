import type { Vector3 } from './vector.ts';

// Rounded observationally motivated model; see galaxy-structure-and-gravity.md.
export const GRAVITATIONAL_CONSTANT_PC = 0.00430091;
export const CENTRAL_BLACK_HOLE_MASS = 4_000_000;
const haloScale = 21_000, haloVirialMass = 1e12, concentration = 10;
const haloNormalization = Math.log(1 + concentration) - concentration / (1 + concentration);
export function enclosedDarkMatterMass(radiusParsec: number) {
  const x = Math.max(0, radiusParsec) / haloScale;
  return haloVirialMass * (Math.log1p(x) - x / (1 + x)) / haloNormalization;
}
/** (km/s)^2/pc: Miyamoto-Nagai disc + Hernquist bulge + NFW halo + Sgr A*. */
export function galacticAcceleration(position: Vector3, includeDarkMatter = true): Vector3 {
  const { x, y, z } = position;
  const radius = Math.hypot(x, y, z);
  if (radius === 0) return { x: 0, y: 0, z: 0 };
  const height = Math.hypot(z, 280), a = 3000 + height;
  const discFactor = -GRAVITATIONAL_CONSTANT_PC * 6e10 / (x*x + y*y + a*a) ** 1.5;
  const sphericalFactor = -GRAVITATIONAL_CONSTANT_PC * (
    5e9 / (radius * (radius + 500) ** 2) +
    (CENTRAL_BLACK_HOLE_MASS + (includeDarkMatter ? enclosedDarkMatterMass(radius) : 0)) / radius ** 3);
  return { x: x * (discFactor + sphericalFactor), y: y * (discFactor + sphericalFactor),
    z: discFactor * a * z / height + sphericalFactor * z };
}
export function galacticCircularSpeed(position: Vector3) {
  const acceleration = galacticAcceleration(position);
  return Math.sqrt(Math.max(0, -(acceleration.x * position.x + acceleration.y * position.y)));
}

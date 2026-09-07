import { normalizeVector, dotProduct, subtractVector, scaleVector } from "../physics/vector.ts";
import type { Vector3 } from "../physics/vector.ts";
import type { ViewCamera } from "./contracts.ts";
import { projectDirectionPerspective } from "./projection.ts";

/** Celestial north and east in the same Galactic Cartesian frame as the stars. */
export function equatorialTangentAxes(direction: Vector3) {
  const normal = normalizeVector(direction);
  const pole = { x: -0.4838350155, y: 0.7469822445, z: 0.4559837762 };
  let north = subtractVector(pole, scaleVector(normal, dotProduct(pole, normal)));
  if (Math.hypot(north.x, north.y, north.z) < 1e-8) {
    const reference = { x: 1, y: 0, z: 0 };
    north = subtractVector(reference, scaleVector(normal, dotProduct(reference, normal)));
  }
  north = normalizeVector(north);
  const east = normalizeVector({
    x: north.y * normal.z - north.z * normal.y,
    y: north.z * normal.x - north.x * normal.z,
    z: north.x * normal.y - north.y * normal.x,
  });
  return { north, east };
}

/** Catalogue position angle is measured east of celestial north, not on screen. */
export function extendedSourceAxes(direction: Vector3, positionAngleDegrees: number) {
  const { north, east } = equatorialTangentAxes(direction);
  const angle = positionAngleDegrees * Math.PI / 180;
  const combine = (a: number, b: number): Vector3 => ({
    x: north.x * a + east.x * b, y: north.y * a + east.y * b, z: north.z * a + east.z * b,
  });
  return { major: combine(Math.cos(angle), Math.sin(angle)), minor: combine(-Math.sin(angle), Math.cos(angle)) };
}

/** Project a physical half-axis through the same camera as the source centre. */
export function projectExtendedAxis(relative: Vector3, unit: Vector3, diameter: number, camera: ViewCamera, width: number, height: number) {
  const offset = scaleVector(unit, diameter / 2);
  const plus = projectDirectionPerspective({ x: relative.x + offset.x, y: relative.y + offset.y, z: relative.z + offset.z }, camera, width, height);
  const minus = projectDirectionPerspective(subtractVector(relative, offset), camera, width, height);
  return { x: (plus.canvasX - minus.canvasX) / 2, y: (plus.canvasY - minus.canvasY) / 2 };
}

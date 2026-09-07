import type { Vector3 } from "../physics/vector.ts";
import type { ViewCamera } from "./contracts.ts";
import { normalizeVector } from "../physics/vector.ts";

/** Point at the real 3-D target. A blocked direction is viewed from space,
 * never silently replaced with a different patch of sky above the horizon. */
export function resolveQuickView(direction: Vector3, current: ViewCamera, zenith: Vector3, hasAtmosphere: boolean) {
  const unit = normalizeVector(direction);
  const altitudeDegrees = Math.asin(Math.max(-1,Math.min(1,
    unit.x*zenith.x+unit.y*zenith.y+unit.z*zenith.z))) * 180 / Math.PI;
  return {
    camera: { azimuthDegrees: ((Math.atan2(unit.y,unit.x)*180/Math.PI)%360+360)%360,
      elevationDegrees: Math.asin(unit.z)*180/Math.PI,
      // A previously very wide field should not turn a target shortcut into
      // a mostly-ground view even when its centre is technically visible.
      horizontalFieldOfViewDegrees: Math.min(current.horizontalFieldOfViewDegrees,82) },
    switchToSpace: hasAtmosphere && altitudeDegrees < 8,
    altitudeDegrees,
  };
}

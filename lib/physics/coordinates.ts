import {
  normalizeVector,
  subtractVector,
  vectorLength,
  type Vector3,
} from "./vector.ts";

export interface PlanarObserverUpdate {
  positionParsec: Vector3;
  radiusParsec: number;
  galactocentricAzimuthDegrees: number;
  wasClamped: boolean;
}

export function galactocentricRadiusParsec(positionParsec: Vector3): number {
  return vectorLength(positionParsec);
}

export function planarRadiusParsec(positionParsec: Vector3): number {
  return Math.hypot(positionParsec.x, positionParsec.y);
}

export function galactocentricAzimuthDegrees(positionParsec: Vector3): number {
  const angle = (Math.atan2(positionParsec.y, positionParsec.x) * 180) / Math.PI;
  return normalizeDegrees(angle);
}

export function positionFromRadiusAndAzimuth(
  radiusParsec: number,
  azimuthDegrees: number,
  zParsec = 0,
): Vector3 {
  if (!(radiusParsec >= 0) || !Number.isFinite(radiusParsec)) {
    throw new RangeError("Galactocentric radius must be a finite non-negative value.");
  }
  const angleRadians = (azimuthDegrees * Math.PI) / 180;
  return {
    x: radiusParsec * Math.cos(angleRadians),
    y: radiusParsec * Math.sin(angleRadians),
    z: zParsec,
  };
}

export function updateRadiusPreservingAzimuth(
  currentPositionParsec: Vector3,
  nextRadiusParsec: number,
  fallbackAzimuthDegrees = 0,
): Vector3 {
  if (!(nextRadiusParsec >= 0) || !Number.isFinite(nextRadiusParsec)) {
    throw new RangeError("Galactocentric radius must be a finite non-negative value.");
  }
  const currentRadius = galactocentricRadiusParsec(currentPositionParsec);
  if (currentRadius > 0) {
    return {
      x: (currentPositionParsec.x / currentRadius) * nextRadiusParsec,
      y: (currentPositionParsec.y / currentRadius) * nextRadiusParsec,
      z: (currentPositionParsec.z / currentRadius) * nextRadiusParsec,
    };
  }
  return positionFromRadiusAndAzimuth(nextRadiusParsec, fallbackAzimuthDegrees, 0);
}

export function updateFromPlanarPoint(
  xParsec: number,
  yParsec: number,
  minimumRadiusParsec: number,
  maximumRadiusParsec: number,
  fallbackAzimuthDegrees = 0,
): PlanarObserverUpdate {
  if (!(minimumRadiusParsec > 0) || maximumRadiusParsec < minimumRadiusParsec) {
    throw new RangeError("Observer radius bounds are invalid.");
  }
  const requestedRadius = Math.hypot(xParsec, yParsec);
  const azimuth =
    requestedRadius > 0
      ? normalizeDegrees((Math.atan2(yParsec, xParsec) * 180) / Math.PI)
      : normalizeDegrees(fallbackAzimuthDegrees);
  const radius = Math.min(
    maximumRadiusParsec,
    Math.max(minimumRadiusParsec, requestedRadius),
  );

  return {
    positionParsec: positionFromRadiusAndAzimuth(radius, azimuth),
    radiusParsec: radius,
    galactocentricAzimuthDegrees: azimuth,
    wasClamped: radius !== requestedRadius,
  };
}

export function relativePositionParsec(
  starPositionParsec: Vector3,
  observerPositionParsec: Vector3,
): Vector3 {
  return subtractVector(starPositionParsec, observerPositionParsec);
}

export function projectRelativePositionToSky(relativePosition: Vector3): {
  distanceParsec: number;
  unitDirection: Vector3;
  longitudeDegrees: number;
  latitudeDegrees: number;
} {
  const distanceParsec = vectorLength(relativePosition);
  const unitDirection = normalizeVector(relativePosition);
  return {
    distanceParsec,
    unitDirection,
    longitudeDegrees: normalizeDegrees(
      (Math.atan2(unitDirection.y, unitDirection.x) * 180) / Math.PI,
    ),
    latitudeDegrees:
      (Math.asin(Math.max(-1, Math.min(1, unitDirection.z))) * 180) / Math.PI,
  };
}

export function normalizeDegrees(angleDegrees: number): number {
  const normalized = ((angleDegrees + 180) % 360 + 360) % 360 - 180;
  return Object.is(normalized, -0) ? 0 : normalized;
}

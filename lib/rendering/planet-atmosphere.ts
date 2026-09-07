import type { Vector3 } from "../physics/vector.ts";
import type { ObservationMode, ViewCamera } from "./contracts.ts";
import { createCameraBasis } from "./projection.ts";

export type AtmospherePreset = "space" | "earth-clear" | "earth-hazy";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

function dotProduct(first: Vector3, second: Vector3): number {
  return first.x * second.x + first.y * second.y + first.z * second.z;
}

export function relativeAirMass(altitudeDegrees: number): number {
  if (altitudeDegrees <= -5) return Number.POSITIVE_INFINITY;
  const boundedAltitude = Math.max(-4.9, altitudeDegrees);
  const sineAltitude = Math.sin((boundedAltitude * Math.PI) / 180);
  return clamp(
    1 /
      (sineAltitude +
        0.50572 * (boundedAltitude + 6.07995) ** -1.6364),
    1,
    40,
  );
}

export function atmosphericExtinctionMagnitude(
  altitudeDegrees: number,
  atmospherePreset: AtmospherePreset,
  observationMode: ObservationMode,
): number {
  if (atmospherePreset === "space") return 0;
  if (altitudeDegrees <= 0) return Number.POSITIVE_INFINITY;
  const verticalExtinctionMagnitude =
    atmospherePreset === "earth-hazy"
      ? observationMode === "near-infrared"
        ? 0.14
        : 0.38
      : observationMode === "near-infrared"
        ? 0.07
        : 0.18;
  return verticalExtinctionMagnitude * relativeAirMass(altitudeDegrees);
}

export function daylightVisibilityPenaltyMagnitude(
  sunAltitudeDegrees: number,
  atmospherePreset: AtmospherePreset,
): number {
  if (atmospherePreset === "space" || sunAltitudeDegrees <= -18) return 0;
  const twilightProgress = clamp((sunAltitudeDegrees + 18) / 24, 0, 1);
  const daylightProgress = clamp((sunAltitudeDegrees - 6) / 36, 0, 1);
  return 12 * twilightProgress ** 1.45 + 6 * daylightProgress;
}

export function altitudeFromSkyDirection(
  skyDirection: Vector3,
  zenithDirection: Vector3,
): number {
  return (
    (Math.asin(clamp(dotProduct(skyDirection, zenithDirection), -1, 1)) * 180) /
    Math.PI
  );
}

export function applyAtmosphereToViewPixels(
  pixels: Uint8ClampedArray,
  camera: ViewCamera,
  zenithDirection: Vector3,
  sunDirection: Vector3,
  sunAltitudeDegrees: number,
  atmospherePreset: AtmospherePreset,
  observationMode: ObservationMode,
  width: number,
  height: number,
): Uint8ClampedArray {
  if (atmospherePreset === "space") return pixels;
  const basis = createCameraBasis(camera);
  const tangentHorizontal = Math.tan(
    (camera.horizontalFieldOfViewDegrees * Math.PI) / 360,
  );
  const tangentVertical = tangentHorizontal * (height / width);
  const twilightStrength = clamp((sunAltitudeDegrees + 18) / 18, 0, 1);
  const daylightStrength = clamp((sunAltitudeDegrees + 6) / 24, 0, 1);
  const celestialContrast =
    10 ** (-0.4 * daylightVisibilityPenaltyMagnitude(sunAltitudeDegrees, atmospherePreset));
  const hazeStrength = atmospherePreset === "earth-hazy" ? 1.55 : 1;
  const nearInfrared = observationMode === "near-infrared";

  for (let y = 0; y < height; y += 1) {
    const normalizedY = 1 - (2 * (y + 0.5)) / height;
    for (let x = 0; x < width; x += 1) {
      const normalizedX = (2 * (x + 0.5)) / width - 1;
      const cameraX = normalizedX * tangentHorizontal;
      const cameraY = normalizedY * tangentVertical;
      const directionLength = Math.hypot(1, cameraX, cameraY);
      const direction = {
        x:
          (basis.forward.x + cameraX * basis.right.x + cameraY * basis.up.x) /
          directionLength,
        y:
          (basis.forward.y + cameraX * basis.right.y + cameraY * basis.up.y) /
          directionLength,
        z:
          (basis.forward.z + cameraX * basis.right.z + cameraY * basis.up.z) /
          directionLength,
      };
      const altitudeDegrees = altitudeFromSkyDirection(direction, zenithDirection);
      const cosineFromSun = clamp(dotProduct(direction, sunDirection), -1, 1);
      const sunwardScattering = clamp((cosineFromSun + 0.2) / 1.2, 0, 1) ** 4;
      const offset = (y * width + x) * 4;
      if (altitudeDegrees <= 0) {
        const groundLift = clamp((altitudeDegrees + 8) / 8, 0, 1);
        pixels[offset] = Math.round(1 + 2 * groundLift + 24 * daylightStrength);
        pixels[offset + 1] = Math.round(2 + 3 * groundLift + 27 * daylightStrength);
        pixels[offset + 2] = Math.round(3 + 5 * groundLift + 31 * daylightStrength);
        pixels[offset + 3] = 255;
        continue;
      }

      const airMass = relativeAirMass(altitudeDegrees);
      const verticalExtinction =
        atmospherePreset === "earth-hazy"
          ? nearInfrared
            ? 0.14
            : 0.38
          : nearInfrared
            ? 0.07
            : 0.18;
      const opticalMagnitude = verticalExtinction * airMass;
      const redFactor = nearInfrared ? 0.32 : 0.72;
      const greenFactor = nearInfrared ? 0.5 : 1;
      const blueFactor = nearInfrared ? 0.78 : 1.55;
      const redTransmission = 10 ** (-0.4 * opticalMagnitude * redFactor);
      const greenTransmission = 10 ** (-0.4 * opticalMagnitude * greenFactor);
      const blueTransmission = 10 ** (-0.4 * opticalMagnitude * blueFactor);
      const horizonGlow =
        hazeStrength *
        Math.exp(-altitudeDegrees / 7.5) *
        (0.035 + twilightStrength * (0.18 + 0.82 * sunwardScattering));
      const airglow = 0.008 * hazeStrength * Math.exp(-altitudeDegrees / 28);
      const daylightSky =
        daylightStrength *
        (0.34 + 0.66 * Math.sqrt(clamp(Math.sin((altitudeDegrees * Math.PI) / 180), 0, 1)));
      const solarHalo = daylightStrength * sunwardScattering ** 2;
      const twilightRed = nearInfrared ? 22 : 75;
      const twilightGreen = nearInfrared ? 17 : 42;
      const twilightBlue = nearInfrared ? 18 : 23;
      pixels[offset] = clamp(
        Math.round(
          pixels[offset] * redTransmission * celestialContrast +
            horizonGlow * twilightRed +
            airglow * 13 +
            daylightSky * 54 +
            solarHalo * 95,
        ),
        0,
        255,
      );
      pixels[offset + 1] = clamp(
        Math.round(
          pixels[offset + 1] * greenTransmission * celestialContrast +
            horizonGlow * twilightGreen +
            airglow * 24 +
            daylightSky * 94 +
            solarHalo * 76,
        ),
        0,
        255,
      );
      pixels[offset + 2] = clamp(
        Math.round(
          pixels[offset + 2] * blueTransmission * celestialContrast +
            horizonGlow * twilightBlue +
            airglow * 38 +
            daylightSky * 158 +
            solarHalo * 44,
        ),
        0,
        255,
      );
    }
  }
  return pixels;
}

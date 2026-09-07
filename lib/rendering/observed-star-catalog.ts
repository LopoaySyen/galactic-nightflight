import type { PointSourceSample } from "./contracts.ts";
import { integrateVisualExtinctionMagnitude } from "./galaxy-radiance.ts";
import { circularVelocityAtPosition } from "../physics/kinematics.ts";

const SOLAR_POSITION_PARSEC = { x: -8_277, y: 0, z: 0 } as const;

// International Celestial Reference System J2000 equatorial directions to
// Galactic longitude/latitude directions. The matrix is the standard rotation
// used by astronomical catalogues; its first output axis points to Galactic
// longitude 0 degrees, the direction of the Galactic centre.
const EQUATORIAL_TO_GALACTIC = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [0.4941094279, -0.44482963, 0.7469822445],
  [-0.867666149, -0.1980763734, 0.4559837762],
] as const;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

function deterministicVelocityOffset(identifier: string, axis: number): number {
  let hash = 2_166_136_261 + axis * 101;
  for (let index = 0; index < identifier.length; index += 1) {
    hash ^= identifier.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return ((hash >>> 0) / 4_294_967_295) * 2 - 1;
}

function colourIndexToTemperatureKelvin(blueMinusVisualMagnitude: number): number {
  const colourIndex = clamp(blueMinusVisualMagnitude, -0.4, 2.1);
  const temperature =
    4_600 *
    (1 / (0.92 * colourIndex + 1.7) +
      1 / (0.92 * colourIndex + 0.62));
  return clamp(temperature, 2_400, 40_000);
}

export function equatorialDirectionToGalactic(
  rightAscensionDegrees: number,
  declinationDegrees: number,
) {
  const rightAscensionRadians = (rightAscensionDegrees * Math.PI) / 180;
  const declinationRadians = (declinationDegrees * Math.PI) / 180;
  const equatorial = [
    Math.cos(declinationRadians) * Math.cos(rightAscensionRadians),
    Math.cos(declinationRadians) * Math.sin(rightAscensionRadians),
    Math.sin(declinationRadians),
  ] as const;
  return {
    x:
      EQUATORIAL_TO_GALACTIC[0][0] * equatorial[0] +
      EQUATORIAL_TO_GALACTIC[0][1] * equatorial[1] +
      EQUATORIAL_TO_GALACTIC[0][2] * equatorial[2],
    y:
      EQUATORIAL_TO_GALACTIC[1][0] * equatorial[0] +
      EQUATORIAL_TO_GALACTIC[1][1] * equatorial[1] +
      EQUATORIAL_TO_GALACTIC[1][2] * equatorial[2],
    z:
      EQUATORIAL_TO_GALACTIC[2][0] * equatorial[0] +
      EQUATORIAL_TO_GALACTIC[2][1] * equatorial[1] +
      EQUATORIAL_TO_GALACTIC[2][2] * equatorial[2],
  };
}

export function parseObservedBrightStarCatalog(
  commaSeparatedValues: string,
): PointSourceSample[] {
  const rows = commaSeparatedValues.trim().split(/\r?\n/);
  const stars: PointSourceSample[] = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const columns = rows[rowIndex].split(",");
    if (columns.length < 9) continue;
    const rightAscensionDegrees = Number(columns[0]);
    const declinationDegrees = Number(columns[1]);
    const apparentVisualMagnitude = Number(columns[2]);
    const blueMinusVisualMagnitude = Number(columns[3]);
    const hipparcosIdentifier = columns[6].trim();
    const distanceParsec = Number(columns[7]);
    const displayName = columns.slice(8).join(",").trim();
    if (
      !Number.isFinite(rightAscensionDegrees) ||
      !Number.isFinite(declinationDegrees) ||
      !Number.isFinite(apparentVisualMagnitude) ||
      !(distanceParsec > 0) ||
      distanceParsec > 10_000
    ) {
      continue;
    }

    const direction = equatorialDirectionToGalactic(
      rightAscensionDegrees,
      declinationDegrees,
    );
    const absoluteVisualMagnitude =
      apparentVisualMagnitude - 5 * Math.log10(distanceParsec / 10);
    const positionParsec = {
      x: SOLAR_POSITION_PARSEC.x + distanceParsec * direction.x,
      y: SOLAR_POSITION_PARSEC.y + distanceParsec * direction.y,
      z: SOLAR_POSITION_PARSEC.z + distanceParsec * direction.z,
    };
    const modelCircularVelocity = circularVelocityAtPosition(positionParsec);
    const velocityKey = hipparcosIdentifier || String(rowIndex);
    stars.push({
      id: `hip-${hipparcosIdentifier || rowIndex}`,
      positionParsec,
      velocityKilometresPerSecond: {
        x: modelCircularVelocity.x + 34 * deterministicVelocityOffset(velocityKey, 0),
        y: modelCircularVelocity.y + 24 * deterministicVelocityOffset(velocityKey, 1),
        z: 20 * deterministicVelocityOffset(velocityKey, 2),
      },
      absoluteVisualMagnitude,
      effectiveTemperatureKelvin: Number.isFinite(blueMinusVisualMagnitude)
        ? colourIndexToTemperatureKelvin(blueMinusVisualMagnitude)
        : 5_800,
      role: "observed-bright-star",
      displayName: displayName || undefined,
      sourceCatalog: "Yale Bright Star Catalogue with Hipparcos distances",
      observedData: {
        catalog: "yale-hipparcos",
        catalogueIdentifier: hipparcosIdentifier || undefined,
        henryDraperIdentifier: columns[5].trim() || undefined,
        rightAscensionDegrees,
        declinationDegrees,
        referenceDistanceParsec: distanceParsec,
        referenceApparentMagnitude: apparentVisualMagnitude,
        spectralType: columns[4].trim() || undefined,
        temperatureMethod: "colour-estimate",
        measuredVelocity: false,
      },
      referenceVisualExtinctionMagnitude: integrateVisualExtinctionMagnitude(
        SOLAR_POSITION_PARSEC,
        positionParsec,
        distanceParsec < 800 ? 8 : 12,
      ),
    });
  }

  return stars;
}

import type { PointSourceSample } from "./contracts.ts";
import { circularVelocityAtPosition } from "../physics/kinematics.ts";
import { BAR_ANGLE_RADIANS, spiralArmField } from './galaxy-radiance.ts';

const THIN_DISC_COUNT = 122_880;
const THICK_DISC_COUNT = 24_576;
const BAR_AND_BULGE_COUNT = 24_576;
const NUCLEAR_COMPONENT_COUNT = 8_192;
const HALO_COUNT = 4_096;

function haltonValue(index: number, base: number): number {
  let fraction = 1;
  let result = 0;
  let remaining = index;
  while (remaining > 0) {
    fraction /= base;
    result += fraction * (remaining % base);
    remaining = Math.floor(remaining / base);
  }
  return result;
}

function signedExponential(sequenceValue: number, scale: number): number {
  const sign = sequenceValue < 0.5 ? -1 : 1;
  const folded = Math.abs(sequenceValue - 0.5) * 2;
  return sign * -scale * Math.log(Math.max(1e-8, 1 - folded));
}

function stellarProperties(index: number) {
  const luminosityCoordinate = haltonValue(index, 17);
  const temperatureCoordinate = haltonValue(index, 19);
  if (luminosityCoordinate < 0.72) {
    return {
      absoluteVisualMagnitude: 0.4 + 3.8 * temperatureCoordinate,
      effectiveTemperatureKelvin: 3_200 + 5_000 * (1 - temperatureCoordinate),
    };
  }
  if (luminosityCoordinate < 0.965) {
    return {
      absoluteVisualMagnitude: -2.5 + 2.9 * temperatureCoordinate,
      effectiveTemperatureKelvin: 3_400 + 8_000 * temperatureCoordinate,
    };
  }
  return {
    absoluteVisualMagnitude: -7.5 + 5 * temperatureCoordinate,
    effectiveTemperatureKelvin: 3_500 + 25_000 * temperatureCoordinate,
  };
}

function symmetricSequence(index: number, base: number): number {
  return 2 * haltonValue(index, base) - 1;
}

function discVelocity(
  positionParsec: { x: number; y: number; z: number },
  index: number,
  thick: boolean,
) {
  const circular = circularVelocityAtPosition(positionParsec);
  const radiusParsec = Math.max(1, Math.hypot(positionParsec.x, positionParsec.y));
  const radialUnit = {
    x: positionParsec.x / radiusParsec,
    y: positionParsec.y / radiusParsec,
  };
  const tangentialUnit = { x: radialUnit.y, y: -radialUnit.x };
  const radialDispersion = (thick ? 48 : 22) * symmetricSequence(index, 23);
  const tangentialDispersion = (thick ? 36 : 15) * symmetricSequence(index, 29);
  return {
    x:
      circular.x +
      radialUnit.x * radialDispersion +
      tangentialUnit.x * tangentialDispersion,
    y:
      circular.y +
      radialUnit.y * radialDispersion +
      tangentialUnit.y * tangentialDispersion,
    z: (thick ? 34 : 15) * symmetricSequence(index, 31),
  };
}

function rotateFromBarFrame(xBar: number, yBar: number) {
  const cosine = Math.cos(BAR_ANGLE_RADIANS);
  const sine = Math.sin(BAR_ANGLE_RADIANS);
  return {
    x: xBar * cosine - yBar * sine,
    y: xBar * sine + yBar * cosine,
  };
}

function createDiscStar(
  index: number,
  thick: boolean,
): PointSourceSample {
  const radialScaleParsec = thick ? 3_600 : 2_600;
  const radiusParsec = Math.min(
    100_000,
    -radialScaleParsec *
      Math.log(
        Math.max(
          1e-10,
          haltonValue(index, 2) * haltonValue(index, 3),
        ),
      ),
  );
  const azimuthRadians = 2 * Math.PI * haltonValue(index, 5);
  const zParsec = signedExponential(
    haltonValue(index, 7),
    thick ? 900 : 300,
  );
  const positionParsec = {
    x: radiusParsec * Math.cos(azimuthRadians),
    y: radiusParsec * Math.sin(azimuthRadians),
    z: zParsec,
  };
  return {
    id: `${thick ? "thick" : "thin"}-${index}`,
    positionParsec,
    velocityKilometresPerSecond: discVelocity(positionParsec, index, thick),
    ...stellarProperties(index + (thick ? 80_000 : 0)),
    role: "model-population-tracer",
    sourceCatalog: thick
      ? "observation-constrained thick-disc tracer model"
      : "observation-constrained thin-disc tracer model",
  };
}

function createBarStar(index: number): PointSourceSample {
  // Broad Laplace proposal; acceptance below recovers the continuous boxy bulge.
  const xBar = signedExponential(haltonValue(index, 2), 3 * 2_450);
  const yBar = signedExponential(haltonValue(index, 3), 3 * 760);
  const rotated = rotateFromBarFrame(xBar, yBar);
  const positionParsec = {
    x: rotated.x,
    y: rotated.y,
    z: signedExponential(haltonValue(index, 5), 3 * 520),
  };
  const patternSpeedKilometresPerSecondPerParsec = 0.039;
  return {
    id: `bar-${index}`,
    positionParsec,
    velocityKilometresPerSecond: {
      x:
        patternSpeedKilometresPerSecondPerParsec * positionParsec.y +
        78 * symmetricSequence(index, 23),
      y:
        -patternSpeedKilometresPerSecondPerParsec * positionParsec.x +
        78 * symmetricSequence(index, 29),
      z: 62 * symmetricSequence(index, 31),
    },
    ...stellarProperties(index + 100_000),
    role: "model-population-tracer",
    sourceCatalog: "Portail-Sormani constrained bar/bulge tracer model",
  };
}

function createNuclearStar(index: number): PointSourceSample {
  const radiusParsec = -210 * Math.log(Math.max(1e-10, haltonValue(index, 2) * haltonValue(index, 3)));
  const azimuthRadians = 2 * Math.PI * haltonValue(index, 7);
  const positionParsec = {
    x: radiusParsec * Math.cos(azimuthRadians),
    y: radiusParsec * Math.sin(azimuthRadians),
    z: signedExponential(haltonValue(index, 5), 43),
  };
  const radiusSafe = Math.max(1, Math.hypot(positionParsec.x, positionParsec.y));
  return {
    id: `nuclear-${index}`,
    positionParsec,
    velocityKilometresPerSecond: {
      x:
        (positionParsec.y / radiusSafe) * 125 +
        55 * symmetricSequence(index, 23),
      y:
        (-positionParsec.x / radiusSafe) * 125 +
        55 * symmetricSequence(index, 29),
      z: 45 * symmetricSequence(index, 31),
    },
    ...stellarProperties(index + 120_000),
    role: "model-population-tracer",
    sourceCatalog: "nuclear stellar disc tracer model",
  };
}

function createHaloStar(index: number): PointSourceSample {
  const verticalCoordinate = 1 - 2 * haltonValue(index, 2);
  const azimuthRadians = 2 * Math.PI * haltonValue(index, 3);
  const planarScale = Math.sqrt(Math.max(0, 1 - verticalCoordinate ** 2));
  const radiusParsec = 1_000 * 20 ** haltonValue(index, 5);
  const positionParsec = {
    x: radiusParsec * planarScale * Math.cos(azimuthRadians),
    y: radiusParsec * planarScale * Math.sin(azimuthRadians),
    z: radiusParsec * verticalCoordinate * 0.72,
  };
  return {
    id: `halo-${index}`,
    positionParsec,
    velocityKilometresPerSecond: {
      x: 135 * symmetricSequence(index, 23),
      y: 135 * symmetricSequence(index, 29),
      z: 110 * symmetricSequence(index, 31),
    },
    ...stellarProperties(index + 130_000),
    role: "model-population-tracer",
    sourceCatalog: "stellar halo tracer model",
  };
}

function sampleComponent(count: number, create: (index: number) => PointSourceSample,
  acceptance: (position: PointSourceSample['positionParsec']) => number) {
  const result: PointSourceSample[] = [];
  for (let index = 1; result.length < count; index++) {
    const source = create(index);
    if (haltonValue(index, 41) < acceptance(source.positionParsec)) result.push(source);
  }
  return result;
}

export const modelPopulationEmitters: readonly PointSourceSample[] = [
  ...sampleComponent(THIN_DISC_COUNT, index => createDiscStar(index, false), p => {
    const radius = Math.hypot(p.x, p.y);
    if (radius > 24000) return 0;
    return (1 - Math.exp(-((radius / 1650) ** 2))) *
      (.76 + .42 * spiralArmField(radius, Math.atan2(p.y, p.x))) / (.76 + .42 * 1.35);
  }),
  ...sampleComponent(THICK_DISC_COUNT, index => createDiscStar(index, true), p => Math.hypot(p.x, p.y) < 24000 ? 1 : 0),
  ...sampleComponent(BAR_AND_BULGE_COUNT, createBarStar, p => {
    const x = Math.abs(p.x * Math.cos(BAR_ANGLE_RADIANS) + p.y * Math.sin(BAR_ANGLE_RADIANS)) / 2450;
    const y = Math.abs(-p.x * Math.sin(BAR_ANGLE_RADIANS) + p.y * Math.cos(BAR_ANGLE_RADIANS)) / 760;
    const z = Math.abs(p.z) / 520;
    return Math.exp((x + y + z) / 3 - (x ** 4 + y ** 4 + z ** 4) ** .25) / (1 + Math.exp((x * 2450 - 5100) / 260));
  }),
  ...Array.from({ length: NUCLEAR_COMPONENT_COUNT }, (_, offset) =>
    createNuclearStar(offset + 1),
  ),
  ...Array.from({ length: HALO_COUNT }, (_, offset) =>
    createHaloStar(offset + 1),
  ),
];

/** A magnitude-selected solar catalogue is not a spatial density census.
 * Keep prominent real anchors, nearby stars and a searched target everywhere.
 * The fainter naked-eye catalogue is blended locally by the point preparation.
 */
export function observedRenderingAnchors(stars: readonly PointSourceSample[], selectedId?: string | null) {
  return stars.flatMap(source => {
    if (source.id === selectedId || source.observedData?.catalog === 'nearby-simbad') return [source];
    const magnitude = source.observedData?.referenceApparentMagnitude ?? Infinity;
    if (source.observedData?.catalog === 'gaia-dr3' || magnitude > 6.5) return [];
    return [magnitude <= 3.5 ? source : {...source, solarNeighbourhoodOnly: true}];
  });
}

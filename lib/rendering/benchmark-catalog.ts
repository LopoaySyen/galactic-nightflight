import type { PointSourceSample } from "./contracts.ts";

const SOLAR_X_PARSEC = -8_277;
const DENSE_FIELD_SOURCE_COUNT = 8_192;
const BENCHMARK_ORIGIN = { x: SOLAR_X_PARSEC, y: 0, z: 0 } as const;

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

function physicalPropertiesFromSequence(
  index: number,
): Pick<PointSourceSample, "absoluteVisualMagnitude" | "effectiveTemperatureKelvin"> {
  const luminosityCoordinate = haltonValue(index, 7);
  const subtypeCoordinate = haltonValue(index, 11);

  if (luminosityCoordinate < 0.58) {
    return {
      absoluteVisualMagnitude: 4.5 + 5.5 * subtypeCoordinate,
      effectiveTemperatureKelvin: [2_900, 3_500, 4_300, 5_200, 5_800][
        Math.min(4, Math.floor(subtypeCoordinate * 5))
      ],
    };
  }
  if (luminosityCoordinate < 0.88) {
    return {
      absoluteVisualMagnitude: 0.8 + 3.7 * subtypeCoordinate,
      effectiveTemperatureKelvin: [4_300, 5_200, 5_800, 7_500, 9_500][
        Math.min(4, Math.floor(subtypeCoordinate * 5))
      ],
    };
  }
  if (luminosityCoordinate < 0.982) {
    return {
      absoluteVisualMagnitude: -2.5 + 3.3 * subtypeCoordinate,
      effectiveTemperatureKelvin: [3_500, 4_300, 5_200, 7_500, 12_000][
        Math.min(4, Math.floor(subtypeCoordinate * 5))
      ],
    };
  }
  return {
    absoluteVisualMagnitude: -7 + 4.5 * subtypeCoordinate,
    effectiveTemperatureKelvin: [3_500, 5_200, 9_500, 20_000, 32_000][
      Math.min(4, Math.floor(subtypeCoordinate * 5))
    ],
  };
}

function createDenseBenchmarkEmitter(index: number): PointSourceSample {
  const verticalCoordinate = 1 - 2 * haltonValue(index, 2);
  const longitudeRadians = 2 * Math.PI * haltonValue(index, 3);
  const planarScale = Math.sqrt(Math.max(0, 1 - verticalCoordinate ** 2));
  const distanceCoordinate = haltonValue(index, 5);
  const distanceParsec = 10 ** (1.1 + distanceCoordinate * 2.75);
  const properties = physicalPropertiesFromSequence(index);

  return {
    id: `field-${String(index).padStart(5, "0")}`,
    positionParsec: {
      x:
        BENCHMARK_ORIGIN.x +
        distanceParsec * planarScale * Math.cos(longitudeRadians),
      y:
        BENCHMARK_ORIGIN.y +
        distanceParsec * planarScale * Math.sin(longitudeRadians),
      z: BENCHMARK_ORIGIN.z + distanceParsec * verticalCoordinate,
    },
    ...properties,
    role: "deterministic-benchmark-emitter",
  };
}

const directionalAnchors: readonly PointSourceSample[] = [
  { id: "axis-near", positionParsec: { x: SOLAR_X_PARSEC + 40, y: 0, z: 0 }, absoluteVisualMagnitude: 2, effectiveTemperatureKelvin: 5_800, role: "deterministic-benchmark-emitter" },
  { id: "axis-mid", positionParsec: { x: SOLAR_X_PARSEC + 400, y: 0, z: 0 }, absoluteVisualMagnitude: -1, effectiveTemperatureKelvin: 9_500, role: "deterministic-benchmark-emitter" },
  { id: "axis-far", positionParsec: { x: SOLAR_X_PARSEC + 1_600, y: 0, z: 0 }, absoluteVisualMagnitude: -5, effectiveTemperatureKelvin: 3_500, role: "deterministic-benchmark-emitter" },
  { id: "left-10", positionParsec: { x: SOLAR_X_PARSEC + 300, y: -52.9, z: 0 }, absoluteVisualMagnitude: -1, effectiveTemperatureKelvin: 7_500, role: "deterministic-benchmark-emitter" },
  { id: "right-10", positionParsec: { x: SOLAR_X_PARSEC + 300, y: 52.9, z: 0 }, absoluteVisualMagnitude: -1, effectiveTemperatureKelvin: 7_500, role: "deterministic-benchmark-emitter" },
  { id: "left-25", positionParsec: { x: SOLAR_X_PARSEC + 300, y: -139.9, z: 0 }, absoluteVisualMagnitude: -2, effectiveTemperatureKelvin: 4_300, role: "deterministic-benchmark-emitter" },
  { id: "right-25", positionParsec: { x: SOLAR_X_PARSEC + 300, y: 139.9, z: 0 }, absoluteVisualMagnitude: -2, effectiveTemperatureKelvin: 12_000, role: "deterministic-benchmark-emitter" },
  { id: "up-10", positionParsec: { x: SOLAR_X_PARSEC + 300, y: 0, z: 52.9 }, absoluteVisualMagnitude: -1, effectiveTemperatureKelvin: 5_800, role: "deterministic-benchmark-emitter" },
  { id: "down-10", positionParsec: { x: SOLAR_X_PARSEC + 300, y: 0, z: -52.9 }, absoluteVisualMagnitude: -1, effectiveTemperatureKelvin: 5_800, role: "deterministic-benchmark-emitter" },
  { id: "up-25", positionParsec: { x: SOLAR_X_PARSEC + 300, y: 0, z: 139.9 }, absoluteVisualMagnitude: -2, effectiveTemperatureKelvin: 20_000, role: "deterministic-benchmark-emitter" },
  { id: "down-25", positionParsec: { x: SOLAR_X_PARSEC + 300, y: 0, z: -139.9 }, absoluteVisualMagnitude: -2, effectiveTemperatureKelvin: 2_900, role: "deterministic-benchmark-emitter" },
  { id: "rear", positionParsec: { x: SOLAR_X_PARSEC - 120, y: 0, z: 0 }, absoluteVisualMagnitude: -4, effectiveTemperatureKelvin: 5_200, role: "deterministic-benchmark-emitter" },
];

// The field is deterministic and analytic: no random number generator or sky texture is used.
export const numericalBenchmarkEmitters: readonly PointSourceSample[] = [
  ...directionalAnchors,
  ...Array.from({ length: DENSE_FIELD_SOURCE_COUNT }, (_, offset) =>
    createDenseBenchmarkEmitter(offset + 1),
  ),
];


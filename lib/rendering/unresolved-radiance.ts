import { addVector, scaleVector, subtractVector, vectorLength, type Vector3 } from "../physics/vector.ts";

export interface UnresolvedRadianceSample {
  spectralEmissivityWattsPerSquareMetrePerSteradianPerNanometrePerParsec: number;
  extinctionCoefficientPerParsec: number;
}

export interface RadianceBudget {
  totalSpectralRadiance: number;
  resolvedSpectralRadiance: number;
  unresolvedSpectralRadiance: number;
}

export function integrateUnresolvedSpectralRadiance(
  observerPositionParsec: Vector3,
  rayEndPositionParsec: Vector3,
  sampleField: (positionParsec: Vector3) => UnresolvedRadianceSample,
  segments = 1_024,
): number {
  if (!Number.isInteger(segments) || segments < 16) {
    throw new RangeError("Radiance integration needs at least 16 line-of-sight segments.");
  }
  const ray = subtractVector(rayEndPositionParsec, observerPositionParsec);
  const lengthParsec = vectorLength(ray);
  if (!(lengthParsec > 0)) return 0;
  const stepParsec = lengthParsec / segments;
  const unitRay = scaleVector(ray, 1 / lengthParsec);
  let opticalDepth = 0;
  let radiance = 0;

  for (let index = 0; index < segments; index += 1) {
    const midpointDistanceParsec = (index + 0.5) * stepParsec;
    const position = addVector(
      observerPositionParsec,
      scaleVector(unitRay, midpointDistanceParsec),
    );
    const sample = sampleField(position);
    if (
      !(sample.spectralEmissivityWattsPerSquareMetrePerSteradianPerNanometrePerParsec >= 0) ||
      !(sample.extinctionCoefficientPerParsec >= 0) ||
      !Number.isFinite(sample.spectralEmissivityWattsPerSquareMetrePerSteradianPerNanometrePerParsec) ||
      !Number.isFinite(sample.extinctionCoefficientPerParsec)
    ) {
      throw new RangeError("Radiance and extinction field values must be finite and non-negative.");
    }
    const midpointOpticalDepth =
      opticalDepth + 0.5 * sample.extinctionCoefficientPerParsec * stepParsec;
    radiance +=
      sample.spectralEmissivityWattsPerSquareMetrePerSteradianPerNanometrePerParsec *
      Math.exp(-midpointOpticalDepth) *
      stepParsec;
    opticalDepth += sample.extinctionCoefficientPerParsec * stepParsec;
  }
  return radiance;
}

export function assertRadianceBudgetConserved(
  budget: RadianceBudget,
  relativeTolerance = 1e-8,
): true {
  if (!(budget.totalSpectralRadiance >= 0) || !(relativeTolerance >= 0)) {
    throw new RangeError("Radiance and tolerance must be non-negative.");
  }
  const reconstructed =
    budget.resolvedSpectralRadiance + budget.unresolvedSpectralRadiance;
  const scale = Math.max(budget.totalSpectralRadiance, Number.EPSILON);
  if (Math.abs(reconstructed - budget.totalSpectralRadiance) / scale > relativeTolerance) {
    throw new Error("Resolved and unresolved radiance do not conserve the source-field total.");
  }
  return true;
}


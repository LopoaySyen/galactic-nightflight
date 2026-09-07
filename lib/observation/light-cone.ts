import { subtractVector, vectorLength, type Vector3 } from "../physics/vector.ts";

export const LIGHT_SPEED_PARSECS_PER_YEAR = 0.30660139378555057;

export class LightConeConvergenceError extends Error {
  constructor() {
    super("Retarded emission time did not converge within the configured iteration limit.");
    this.name = "LightConeConvergenceError";
  }
}

export function solveRetardedEmissionTimeYears(
  observationTimeYears: number,
  observerPositionAtObservationParsec: Vector3,
  sourcePositionAtTime: (timeYears: number) => Vector3,
  options: { toleranceYears?: number; maximumIterations?: number } = {},
): number {
  const toleranceYears = options.toleranceYears ?? 1e-8;
  const maximumIterations = options.maximumIterations ?? 64;
  if (!(toleranceYears > 0) || !Number.isInteger(maximumIterations) || maximumIterations < 1) {
    throw new RangeError("Light-cone solver settings are invalid.");
  }
  const presentDistance = vectorLength(
    subtractVector(
      sourcePositionAtTime(observationTimeYears),
      observerPositionAtObservationParsec,
    ),
  );
  let emissionTimeYears =
    observationTimeYears - presentDistance / LIGHT_SPEED_PARSECS_PER_YEAR;

  for (let iteration = 0; iteration < maximumIterations; iteration += 1) {
    const retardedDistance = vectorLength(
      subtractVector(
        sourcePositionAtTime(emissionTimeYears),
        observerPositionAtObservationParsec,
      ),
    );
    const nextEmissionTimeYears =
      observationTimeYears - retardedDistance / LIGHT_SPEED_PARSECS_PER_YEAR;
    if (Math.abs(nextEmissionTimeYears - emissionTimeYears) <= toleranceYears) {
      return nextEmissionTimeYears;
    }
    emissionTimeYears = nextEmissionTimeYears;
  }
  throw new LightConeConvergenceError();
}


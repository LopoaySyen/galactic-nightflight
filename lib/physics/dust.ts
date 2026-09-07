import {
  addVector,
  scaleVector,
  subtractVector,
  vectorLength,
  type Vector3,
} from "./vector.ts";

export interface DustIntegrationOptions {
  relativeTolerance?: number;
  maximumDepth?: number;
  requireConvergence?: boolean;
}

export interface DustIntegrationResult {
  opticalDepth: number;
  extinctionMagnitude: number;
  evaluatedSamples: number;
  estimatedAbsoluteError: number;
  converged: boolean;
}

export class DustIntegrationConvergenceError extends Error {
  readonly estimatedAbsoluteError: number;

  constructor(estimatedAbsoluteError: number) {
    super("Dust line-of-sight integration did not reach its requested tolerance.");
    this.name = "DustIntegrationConvergenceError";
    this.estimatedAbsoluteError = estimatedAbsoluteError;
  }
}

export type ExtinctionCoefficientField = (
  positionParsec: Vector3,
  wavelengthNanometres: number,
) => number;

const MAGNITUDES_PER_OPTICAL_DEPTH = 2.5 / Math.log(10);

export function integrateDustExtinction(
  observerPositionParsec: Vector3,
  targetPositionParsec: Vector3,
  wavelengthNanometres: number,
  extinctionCoefficientPerParsec: ExtinctionCoefficientField,
  options: DustIntegrationOptions = {},
): DustIntegrationResult {
  if (!(wavelengthNanometres > 0) || !Number.isFinite(wavelengthNanometres)) {
    throw new RangeError("Wavelength must be finite and greater than zero.");
  }
  const ray = subtractVector(targetPositionParsec, observerPositionParsec);
  const pathLengthParsec = vectorLength(ray);
  if (!(pathLengthParsec > 0)) {
    return {
      opticalDepth: 0,
      extinctionMagnitude: 0,
      evaluatedSamples: 0,
      estimatedAbsoluteError: 0,
      converged: true,
    };
  }

  const relativeTolerance = options.relativeTolerance ?? 1e-5;
  const maximumDepth = options.maximumDepth ?? 18;
  if (!(relativeTolerance > 0) || !Number.isFinite(relativeTolerance)) {
    throw new RangeError("Dust integration tolerance must be finite and greater than zero.");
  }
  if (!Number.isInteger(maximumDepth) || maximumDepth < 0) {
    throw new RangeError("Dust integration maximum depth must be a non-negative integer.");
  }

  let evaluatedSamples = 0;
  const sample = (distanceParsec: number): number => {
    evaluatedSamples += 1;
    const fraction = distanceParsec / pathLengthParsec;
    const position = addVector(
      observerPositionParsec,
      scaleVector(ray, fraction),
    );
    const coefficient = extinctionCoefficientPerParsec(
      position,
      wavelengthNanometres,
    );
    if (!(coefficient >= 0) || !Number.isFinite(coefficient)) {
      throw new RangeError(
        "The dust extinction field returned a negative or non-finite coefficient.",
      );
    }
    return coefficient;
  };

  const start = 0;
  const end = pathLengthParsec;
  const middle = end / 2;
  const startValue = sample(start);
  const middleValue = sample(middle);
  const endValue = sample(end);
  const initial = simpsonEstimate(
    start,
    end,
    startValue,
    middleValue,
    endValue,
  );
  const absoluteTolerance = Math.max(1e-12, Math.abs(initial) * relativeTolerance);
  const integrated = adaptiveSimpson(
    sample,
    start,
    end,
    startValue,
    middleValue,
    endValue,
    initial,
    absoluteTolerance,
    maximumDepth,
  );
  const opticalDepth = Math.max(0, integrated.value);
  if (!integrated.converged && options.requireConvergence !== false) {
    throw new DustIntegrationConvergenceError(integrated.error);
  }
  return {
    opticalDepth,
    extinctionMagnitude: MAGNITUDES_PER_OPTICAL_DEPTH * opticalDepth,
    evaluatedSamples,
    estimatedAbsoluteError: integrated.error,
    converged: integrated.converged,
  };
}

function simpsonEstimate(
  start: number,
  end: number,
  startValue: number,
  middleValue: number,
  endValue: number,
): number {
  return ((end - start) / 6) * (startValue + 4 * middleValue + endValue);
}

function adaptiveSimpson(
  sample: (position: number) => number,
  start: number,
  end: number,
  startValue: number,
  middleValue: number,
  endValue: number,
  wholeEstimate: number,
  tolerance: number,
  remainingDepth: number,
): { value: number; error: number; converged: boolean } {
  const middle = (start + end) / 2;
  const leftMiddle = (start + middle) / 2;
  const rightMiddle = (middle + end) / 2;
  const leftMiddleValue = sample(leftMiddle);
  const rightMiddleValue = sample(rightMiddle);
  const leftEstimate = simpsonEstimate(
    start,
    middle,
    startValue,
    leftMiddleValue,
    middleValue,
  );
  const rightEstimate = simpsonEstimate(
    middle,
    end,
    middleValue,
    rightMiddleValue,
    endValue,
  );
  const combined = leftEstimate + rightEstimate;
  const difference = combined - wholeEstimate;
  const estimatedError = Math.abs(difference) / 15;

  if (estimatedError <= tolerance) {
    return {
      value: combined + difference / 15,
      error: estimatedError,
      converged: true,
    };
  }
  if (remainingDepth <= 0) {
    return {
      value: combined + difference / 15,
      error: estimatedError,
      converged: false,
    };
  }

  const left = adaptiveSimpson(
    sample,
    start,
    middle,
    startValue,
    leftMiddleValue,
    middleValue,
    leftEstimate,
    tolerance / 2,
    remainingDepth - 1,
  );
  const right = adaptiveSimpson(
    sample,
    middle,
    end,
    middleValue,
    rightMiddleValue,
    endValue,
    rightEstimate,
    tolerance / 2,
    remainingDepth - 1,
  );
  return {
    value: left.value + right.value,
    error: left.error + right.error,
    converged: left.converged && right.converged,
  };
}

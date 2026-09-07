import { normalizeVector, type Vector3 } from "./vector.ts";

interface ObserverGeometry {
  positionParsec: Vector3;
  viewDirection: Vector3;
  simulationTimeMillionYears: number;
}

export interface ProbeObserverState extends ObserverGeometry {
  mode: "probe";
}

export interface DynamicObserverState extends ObserverGeometry {
  mode: "dynamic";
  velocityParsecPerMillionYears: Vector3;
}

export type ObserverState = ProbeObserverState | DynamicObserverState;

export class DynamicObserverRequiredError extends Error {
  constructor() {
    super("Time advancement requires an observer with a six-dimensional phase-space state.");
    this.name = "DynamicObserverRequiredError";
  }
}

export function createProbeObserver(
  positionParsec: Vector3,
  viewDirection: Vector3,
  simulationTimeMillionYears = 0,
): ProbeObserverState {
  return {
    mode: "probe",
    positionParsec,
    viewDirection: normalizeVector(viewDirection),
    simulationTimeMillionYears,
  };
}

export function requireDynamicObserver(
  observer: ObserverState,
): DynamicObserverState {
  if (observer.mode !== "dynamic") {
    throw new DynamicObserverRequiredError();
  }
  return observer;
}
